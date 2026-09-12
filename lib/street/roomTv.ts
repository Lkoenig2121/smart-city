import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { formatClock } from "@/lib/simulation/city/cityTick";

export interface RoomTv {
  update: (dt: number, state: CityState) => void;
  dispose: () => void;
}

const W = 640;
const H = 360;
const CHANNEL_SECS = 11;
const SWITCH_SECS = 0.7;
const CYCLE = CHANNEL_SECS + SWITCH_SECS;

const CHANNELS = [
  { id: 12, name: "RNV SPORT", title: "LIVE HOCKEY" },
  { id: 7, name: "RIVERSIDE 7", title: "CITY TONIGHT" },
  { id: 4, name: "WX 4", title: "FORECAST" },
] as const;

/** Flat hotel TV on the dresser, with a canvas that cycles live channels. */
export function addRoomTelevision(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
): RoomTv {
  const tv = new THREE.Group();
  tv.name = "television";

  const black = new THREE.MeshStandardMaterial({
    color: "#121417",
    roughness: 0.32,
    metalness: 0.55,
  });
  const silver = new THREE.MeshStandardMaterial({
    color: "#b8bec6",
    roughness: 0.28,
    metalness: 0.7,
  });
  const ink = new THREE.MeshStandardMaterial({
    color: "#07080a",
    roughness: 0.45,
    metalness: 0.2,
  });
  disposables.push(black, silver, ink);

  const box = (mat: THREE.MeshStandardMaterial, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    tv.add(mesh);
    disposables.push(geo);
    return mesh;
  };

  const screenW = 2.28;
  const screenH = 1.28;
  const bezel = 0.055;
  const chin = 0.09;
  const cx = 4.58;
  const cz = -3.42;
  const deskY = 0.85;

  box(silver, 0.72, 0.04, 0.28, cx, deskY + 0.03, cz + 0.02);
  box(silver, 0.08, 0.18, 0.08, cx, deskY + 0.13, cz);
  box(black, screenW + bezel * 2, screenH + bezel + chin, 0.07, cx, deskY + 0.86, cz);
  box(ink, screenW + 0.02, screenH + 0.02, 0.02, cx, deskY + 0.9, cz + 0.028);
  box(silver, 0.22, 0.018, 0.03, cx, deskY + 0.24, cz + 0.04);

  const ledGeo = new THREE.BoxGeometry(0.03, 0.012, 0.012);
  const ledMat = new THREE.MeshStandardMaterial({
    color: "#2ecc71",
    emissive: new THREE.Color("#2ecc71"),
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(cx + screenW / 2 - 0.12, deskY + 0.24, cz + 0.042);
  tv.add(led);
  disposables.push(ledGeo, ledMat);

  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  if (canvas) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas?.getContext("2d") ?? null;
  const texture = canvas ? new THREE.CanvasTexture(canvas) : null;
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
  }

  const screenMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: texture ?? undefined,
    emissive: new THREE.Color("#ffffff"),
    emissiveMap: texture ?? undefined,
    emissiveIntensity: 0.82,
    roughness: 0.16,
    metalness: 0.04,
  });
  const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(cx, deskY + 0.915, cz + 0.042);
  screen.receiveShadow = false;
  tv.add(screen);
  disposables.push(screenGeo, screenMat);
  if (texture) disposables.push(texture);

  const glow = new THREE.PointLight(0x9ec8ff, 2.4, 6.5, 2);
  glow.position.set(cx, deskY + 0.95, cz + 0.55);
  tv.add(glow);

  group.add(tv);

  let elapsed = 2.4;
  const draw = (dt: number, state: CityState) => {
    if (!ctx || !texture) return;
    elapsed += dt;
    const slot = elapsed % (CYCLE * CHANNELS.length);
    const index = Math.floor(slot / CYCLE) % CHANNELS.length;
    const local = slot % CYCLE;
    const clock = formatClock(state);

    if (local < SWITCH_SECS) {
      drawZap(ctx, CHANNELS[index], local / SWITCH_SECS);
      glow.color.set(0xc8c8c8);
      glow.intensity = 0.6;
    } else {
      const t = local - SWITCH_SECS + elapsed * 0.15;
      if (index === 0) drawHockey(ctx, t, clock);
      else if (index === 1) drawNews(ctx, t, clock, state);
      else drawWeather(ctx, t, clock, state);
      glow.color.set(index === 0 ? 0xb8d8ff : index === 1 ? 0x6a90c8 : 0x7ec8ff);
      glow.intensity = 2.4;
    }
    texture.needsUpdate = true;
  };

  return {
    update: draw,
    dispose: () => undefined,
  };
}

function drawZap(ctx: CanvasRenderingContext2D, channel: (typeof CHANNELS)[number], u: number) {
  ctx.fillStyle = "#050608";
  ctx.fillRect(0, 0, W, H);
  if (u < 0.35 || u > 0.82) {
    for (let y = 0; y < H; y += 2) {
      ctx.fillStyle = Math.random() > 0.5 ? "#d8d8d8" : "#222";
      ctx.fillRect(0, y, W, 2);
    }
  }
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "700 54px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`CH ${channel.id}`, 36, 86);
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillStyle = "#c9a44c";
  ctx.fillText(channel.name, 38, 124);
}

function drawHockey(ctx: CanvasRenderingContext2D, t: number, clock: ReturnType<typeof formatClock>) {
  ctx.fillStyle = "#0d1a28";
  ctx.fillRect(0, 0, W, H);

  const iceX = 28;
  const iceY = 58;
  const iceW = 584;
  const iceH = 248;
  ctx.fillStyle = "#1a3a2c";
  roundRectPath(ctx, iceX - 8, iceY - 8, iceW + 16, iceH + 16, 28);
  ctx.fill();
  ctx.fillStyle = "#e8f4fb";
  roundRectPath(ctx, iceX, iceY, iceW, iceH, 22);
  ctx.fill();

  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(iceX + iceW / 2, iceY + 6);
  ctx.lineTo(iceX + iceW / 2, iceY + iceH - 6);
  ctx.stroke();
  ctx.strokeStyle = "#2f6fbf";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(iceX + iceW * 0.28, iceY + 6);
  ctx.lineTo(iceX + iceW * 0.28, iceY + iceH - 6);
  ctx.moveTo(iceX + iceW * 0.72, iceY + 6);
  ctx.lineTo(iceX + iceW * 0.72, iceY + iceH - 6);
  ctx.stroke();

  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(iceX + iceW / 2, iceY + iceH / 2, 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#c0392b";
  ctx.beginPath();
  ctx.arc(iceX + iceW / 2, iceY + iceH / 2, 5, 0, Math.PI * 2);
  ctx.fill();

  drawCrease(ctx, iceX + 18, iceY + iceH / 2, 1);
  drawCrease(ctx, iceX + iceW - 18, iceY + iceH / 2, -1);

  const puckX = iceX + iceW * (0.5 + Math.sin(t * 1.7) * 0.32);
  const puckY = iceY + iceH * (0.5 + Math.cos(t * 1.15) * 0.28);

  for (let i = 0; i < 5; i++) {
    const x = iceX + 70 + ((t * 42 + i * 97) % (iceW - 140));
    const y = iceY + 36 + (i * 41 + Math.sin(t * 1.8 + i) * 16) % (iceH - 72);
    drawSkater(ctx, x, y, "#1e3a6b", t + i);
  }
  for (let i = 0; i < 5; i++) {
    const x = iceX + iceW - 70 - ((t * 38 + i * 81) % (iceW - 140));
    const y = iceY + 48 + (i * 37 + Math.cos(t * 1.5 + i) * 18) % (iceH - 72);
    drawSkater(ctx, x, y, "#c9a44c", t + i * 1.3);
  }

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.ellipse(puckX, puckY, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(10,14,22,0.78)";
  roundRectPath(ctx, 16, 10, 268, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("RIV  3", 28, 37);
  ctx.fillStyle = "#c9a44c";
  ctx.fillText("HBR  2", 118, 37);
  ctx.fillStyle = "#ff6b5a";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.fillText("LIVE", 210, 36);

  ctx.fillStyle = "rgba(10,14,22,0.78)";
  roundRectPath(ctx, 470, 10, 154, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#e8dcc8";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("2nd  08:14", 610, 28);
  ctx.fillStyle = "#9aa4ae";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText(`RNV SPORT  ·  ${clock.time}`, 610, 44);

  ctx.fillStyle = "rgba(10,14,22,0.7)";
  ctx.fillRect(0, H - 28, W, 28);
  ctx.fillStyle = "#f4e6c0";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("RIVERSIDE RIVERMEN vs HARBOR BEARS", 16, H - 10);
}

function drawCrease(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number) {
  ctx.fillStyle = "rgba(80,150,220,0.28)";
  ctx.beginPath();
  ctx.ellipse(x + dir * 18, y, 22, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(x - 4, y - 28, 8, 56);
}

function drawSkater(ctx: CanvasRenderingContext2D, x: number, y: number, jersey: string, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2.2) * 0.25);
  ctx.fillStyle = jersey;
  ctx.fillRect(-7, -5, 14, 16);
  ctx.fillStyle = "#f0d2b4";
  ctx.beginPath();
  ctx.arc(0, -10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-9, 10, 18, 3);
  ctx.restore();
}

function drawNews(
  ctx: CanvasRenderingContext2D,
  t: number,
  clock: ReturnType<typeof formatClock>,
  state: CityState,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#12203a");
  sky.addColorStop(1, "#0a1220");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#1c3358";
  ctx.fillRect(0, 168, W, 192);
  ctx.fillStyle = "#c9a44c";
  ctx.fillRect(0, 164, W, 5);

  ctx.fillStyle = "#2a3138";
  for (let i = 0; i < 7; i++) {
    const h = 40 + ((i * 29) % 70);
    ctx.fillRect(400 + i * 34, 168 - h, 26, h);
  }

  const bob = Math.sin(t * 6) * 1.4;
  ctx.fillStyle = "#1e3a6b";
  ctx.fillRect(86, 198 + bob, 78, 90);
  ctx.fillStyle = "#f0d2b4";
  ctx.beginPath();
  ctx.arc(125, 182 + bob, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a2420";
  ctx.beginPath();
  ctx.arc(125, 176 + bob, 22, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#c9a44c";
  ctx.font = "800 16px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("R7", 18, 32);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillText("RIVERSIDE TONIGHT", 52, 32);
  ctx.fillStyle = "#9aa4ae";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${clock.day.toUpperCase()}  ${clock.time}`, W - 16, 32);

  ctx.fillStyle = "#c0392b";
  ctx.fillRect(18, 248, 92, 22);
  ctx.fillStyle = "#fff8f2";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BREAKING", 64, 264);

  ctx.fillStyle = "#f4f1ea";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Downtown waterfront draws record visitors", 18, 300);

  const headlines = [
    `Population ${state.population.toLocaleString()} and still climbing`,
    "Harborview books out the club floor  ·  Room 1110 still open",
    "Rivermen lead the Bears 3–2 in the second period",
    "City Hall: promenade lights stay on past midnight",
  ];
  const ticker = headlines.join("     ◆     ");
  const scroll = (t * 70) % (ticker.length * 9 + 200);
  ctx.fillStyle = "#c9a44c";
  ctx.fillRect(0, H - 32, W, 32);
  ctx.fillStyle = "#1a1206";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.fillText(ticker + "     ◆     " + ticker, 20 - scroll, H - 11);
}

function drawWeather(
  ctx: CanvasRenderingContext2D,
  t: number,
  clock: ReturnType<typeof formatClock>,
  state: CityState,
) {
  const night = clock.hour24 < 6 || clock.hour24 >= 20;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  if (night) {
    sky.addColorStop(0, "#10182c");
    sky.addColorStop(1, "#1a2748");
  } else {
    sky.addColorStop(0, "#4d8fd6");
    sky.addColorStop(1, "#9ecfff");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  if (night) {
    ctx.fillStyle = "#f4efe4";
    for (let i = 0; i < 28; i++) {
      const x = (i * 97 + 20) % W;
      const y = (i * 53 + 18) % 160;
      ctx.fillRect(x, y, 2, 2);
    }
  } else {
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.arc(520, 70, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = night ? "rgba(180,200,220,0.35)" : "rgba(255,255,255,0.55)";
  for (let i = 0; i < 4; i++) {
    const x = ((t * 18 + i * 160) % (W + 80)) - 40;
    const y = 46 + i * 22;
    cloud(ctx, x, y, 70 + i * 8);
  }

  ctx.fillStyle = night ? "#2a3138" : "#3d4a58";
  ctx.beginPath();
  ctx.moveTo(0, 250);
  ctx.lineTo(70, 190);
  ctx.lineTo(130, 230);
  ctx.lineTo(200, 160);
  ctx.lineTo(270, 210);
  ctx.lineTo(340, 150);
  ctx.lineTo(410, 200);
  ctx.lineTo(500, 140);
  ctx.lineTo(580, 195);
  ctx.lineTo(W, 170);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();

  ctx.fillStyle = "rgba(10,14,22,0.72)";
  roundRectPath(ctx, 18, 16, 250, 86, 10);
  ctx.fill();
  ctx.fillStyle = "#7dd3fc";
  ctx.font = "800 16px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("WX 4  RIVERSIDE", 32, 42);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "700 36px system-ui, sans-serif";
  const temp = night ? 54 : clock.hour24 < 10 ? 61 : 72;
  ctx.fillText(`${temp}°`, 32, 86);
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillStyle = "#c9e4ff";
  ctx.fillText(night ? "Clear  ·  Light wind" : "Mostly sunny  ·  Harbor breeze", 108, 80);

  const days = ["MON", "TUE", "WED", "THU", "FRI"].map((d, i) => ({
    d,
    hi: 68 + ((i * 3 + state.clock.dayIndex) % 8),
    icon: i === 2 ? "cloud" : "sun",
  }));
  days.forEach((day, i) => {
    const x = 28 + i * 122;
    ctx.fillStyle = "rgba(10,14,22,0.55)";
    roundRectPath(ctx, x, 280, 110, 64, 8);
    ctx.fill();
    ctx.fillStyle = "#e8dcc8";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(day.d, x + 55, 302);
    ctx.fillStyle = day.icon === "sun" ? "#fbbf24" : "#cbd5e1";
    ctx.beginPath();
    ctx.arc(x + 36, 322, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f1ea";
    ctx.fillText(`${day.hi}°`, x + 78, 328);
  });

  ctx.fillStyle = "rgba(10,14,22,0.45)";
  ctx.fillRect(400, 16, 224, 28);
  ctx.fillStyle = "#9aa4ae";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(clock.time, W - 24, 36);
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.38, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.28, y - 6, w * 0.3, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.52, y + 2, w * 0.34, 15, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
