import * as THREE from "three";
import { advanceDay, weekdayOf } from "@/lib/city/calendar";
import { DAYS, type CityState } from "@/lib/city/types";
import { formatClock } from "@/lib/simulation/city/cityTick";
import { forecastFor, weatherEmoji } from "@/lib/simulation/weather/weather";
import { isBroadcastWindow, ballclubFor, stadiumBigPlay, stadiumOnTv, stadiumWinner } from "@/lib/city/stadium";

export interface RoomTv {
  update: (dt: number, state: CityState) => void;
  /** True when a console is present under the TV. */
  hasConsole: () => boolean;
  /** Whether the console feed is currently on screen. */
  isNuketown: () => boolean;
  /** Flip between TV channels and Nuketown. Returns false if no console. */
  toggleNuketown: () => boolean;
  dispose: () => void;
}

const W = 640;
const H = 360;
const CHANNEL_SECS = 11;
const SWITCH_SECS = 0.7;
const CYCLE = CHANNEL_SECS + SWITCH_SECS;

const CHANNELS = [
  { id: 12, name: "RNV SPORT", title: "RAVENS BASEBALL" },
  { id: 7, name: "RIVERSIDE 7", title: "CITY TONIGHT" },
  { id: 4, name: "WX 4", title: "FORECAST" },
] as const;

/** Flat hotel TV on the dresser, with a canvas that cycles live channels. */
export function addRoomTelevision(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  options: { scale?: number; hasConsole?: boolean } = {},
): RoomTv {
  const tv = new THREE.Group();
  tv.name = "television";
  const scale = Math.max(0.85, Math.min(2.2, options.scale ?? 1));
  const hasConsole = Boolean(options.hasConsole);
  let nuketownMode = false;

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

  const screenW = 2.28 * scale;
  const screenH = 1.28 * scale;
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
    const clock = formatClock(state);

    // Console feed — player toggles this with P beside the PlayStation.
    if (hasConsole && nuketownMode) {
      drawNuketown(ctx, elapsed, clock);
      glow.color.set(0xe8a060);
      glow.intensity = 2.6;
      texture.needsUpdate = true;
      return;
    }

    // During the live game window, lock onto RNV Sport — no channel surfing.
    if (isBroadcastWindow(state)) {
      drawBaseball(ctx, elapsed, clock, state);
      glow.color.set(0x8fd48a);
      glow.intensity = 2.4;
      texture.needsUpdate = true;
      return;
    }

    const slot = elapsed % (CYCLE * CHANNELS.length);
    const index = Math.floor(slot / CYCLE) % CHANNELS.length;
    const local = slot % CYCLE;

    if (local < SWITCH_SECS) {
      drawZap(ctx, CHANNELS[index], local / SWITCH_SECS);
      glow.color.set(0xc8c8c8);
      glow.intensity = 0.6;
    } else {
      const t = local - SWITCH_SECS + elapsed * 0.15;
      if (index === 0) drawBaseball(ctx, t, clock, state);
      else if (index === 1) drawNews(ctx, t, clock, state);
      else drawWeather(ctx, t, clock, state);
      glow.color.set(index === 0 ? 0x8fd48a : index === 1 ? 0x6a90c8 : 0x7ec8ff);
      glow.intensity = 2.4;
    }
    texture.needsUpdate = true;
  };

  return {
    update: draw,
    hasConsole: () => hasConsole,
    isNuketown: () => nuketownMode,
    toggleNuketown: () => {
      if (!hasConsole) return false;
      nuketownMode = !nuketownMode;
      return true;
    },
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

function drawBaseball(
  ctx: CanvasRenderingContext2D,
  t: number,
  clock: ReturnType<typeof formatClock>,
  state: CityState,
) {
  const game = stadiumOnTv(state);
  const club = ballclubFor(state);
  const play = game ? stadiumBigPlay(game, club) : null;
  const winner = game ? stadiumWinner(game, club) : null;
  const live = Boolean(game?.playing);
  const loop = 6.4;
  const u = (t % loop) / loop;

  const night = live || clock.hour24 >= 18;
  const sky = ctx.createLinearGradient(0, 0, 0, 120);
  sky.addColorStop(0, night ? "#0c1428" : "#6aa7d8");
  sky.addColorStop(1, night ? "#1a2744" : "#9ecfff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  drawCrowdBowl(ctx, t, night);

  ctx.fillStyle = night ? "#3a2418" : "#8a5340";
  ctx.beginPath();
  ctx.moveTo(18, 118);
  ctx.quadraticCurveTo(320, 44, 622, 118);
  ctx.lineTo(622, 138);
  ctx.quadraticCurveTo(320, 68, 18, 138);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = night ? "#163822" : "#1f4a28";
  ctx.beginPath();
  ctx.moveTo(22, 122);
  ctx.quadraticCurveTo(320, 52, 618, 122);
  ctx.lineTo(618, 134);
  ctx.quadraticCurveTo(320, 64, 22, 134);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = night ? "#1a2740" : "#c9a44c";
  roundRectPath(ctx, 268, 28, 104, 42, 4);
  ctx.fill();
  ctx.fillStyle = night ? "#c9a44c" : "#1f4d8c";
  ctx.font = "800 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RAVENS", 320, 46);
  ctx.fillStyle = night ? "#f4f1ea" : "#10233f";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillText(game ? `${game.ravens}  ${game.visitors}` : "0  0", 320, 64);

  ctx.fillStyle = "#c9a44c";
  ctx.fillRect(46, 86, 6, 52);
  ctx.fillRect(588, 86, 6, 52);

  ctx.fillStyle = "#2f7a3e";
  ctx.beginPath();
  ctx.moveTo(-10, 330);
  ctx.lineTo(18, 138);
  ctx.quadraticCurveTo(320, 68, 622, 138);
  ctx.lineTo(650, 330);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#b7925c";
  ctx.beginPath();
  ctx.moveTo(8, 330);
  ctx.lineTo(34, 148);
  ctx.quadraticCurveTo(320, 84, 606, 148);
  ctx.lineTo(632, 330);
  ctx.lineTo(608, 330);
  ctx.lineTo(586, 156);
  ctx.quadraticCurveTo(320, 98, 54, 156);
  ctx.lineTo(32, 330);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#34844a";
  ctx.beginPath();
  ctx.moveTo(32, 330);
  ctx.lineTo(54, 156);
  ctx.quadraticCurveTo(320, 98, 586, 156);
  ctx.lineTo(608, 330);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(244,241,234,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(320, 292);
  ctx.lineTo(36, 150);
  ctx.moveTo(320, 292);
  ctx.lineTo(604, 150);
  ctx.stroke();

  ctx.fillStyle = "#2a5a34";
  roundRectPath(ctx, 8, 188, 78, 36, 4);
  ctx.fill();
  roundRectPath(ctx, 554, 188, 78, 36, 4);
  ctx.fill();
  ctx.fillStyle = "#1f4d8c";
  ctx.fillRect(14, 194, 28, 24);
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(598, 194, 28, 24);

  ctx.fillStyle = "#c4a56a";
  ctx.beginPath();
  ctx.ellipse(320, 228, 118, 78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(320, 304);
  ctx.lineTo(456, 208);
  ctx.lineTo(320, 140);
  ctx.lineTo(184, 208);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b7925c";
  ctx.beginPath();
  ctx.ellipse(320, 228, 28, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4f1ea";
  ctx.beginPath();
  ctx.moveTo(312, 298);
  ctx.lineTo(320, 286);
  ctx.lineTo(328, 298);
  ctx.lineTo(320, 306);
  ctx.closePath();
  ctx.fill();

  const bases = [
    { x: 320, y: 286 },
    { x: 430, y: 214 },
    { x: 320, y: 156 },
    { x: 210, y: 214 },
  ];
  ctx.fillStyle = "#f4f1ea";
  for (const base of bases) {
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(320, 228, 7, 0, Math.PI * 2);
  ctx.fill();

  const fielders = [
    { x: 320, y: 228 },
    { x: 328, y: 300 },
    { x: 452, y: 200 },
    { x: 352, y: 168 },
    { x: 188, y: 200 },
    { x: 250, y: 176 },
    { x: 150, y: 118 },
    { x: 320, y: 86 },
    { x: 490, y: 118 },
  ];
  for (const spot of fielders) drawBallplayer(ctx, spot.x, spot.y, "#1f4d8c", 0.85);

  const batterX = 308;
  const batterY = 298;
  const swinging = u > 0.18 && u < 0.28;
  drawBallplayer(ctx, batterX, batterY, play?.home === false ? "#c0392b" : "#e8ece8", 1.05, swinging ? -0.55 : 0.08);

  let ballX = 320;
  let ballY = 236;
  if (u < 0.2) {
    const p = u / 0.2;
    ballX = 320 + (batterX + 10 - 320) * p;
    ballY = 228 + (batterY - 8 - 228) * p;
  } else if (u < 0.62) {
    const p = (u - 0.2) / 0.42;
    const endX = play && !play.home ? 490 : play && play.runs >= 3 ? 318 : 150;
    const endY = play && play.runs >= 3 ? 52 : 108;
    ballX = batterX + 10 + (endX - batterX - 10) * p;
    ballY = batterY - 8 + (endY - (batterY - 8)) * p - Math.sin(p * Math.PI) * (play && play.runs >= 3 ? 92 : 48);
  } else {
    const endX = play && !play.home ? 490 : play && play.runs >= 3 ? 318 : 150;
    const endY = play && play.runs >= 3 ? 52 : 108;
    ballX = endX;
    ballY = endY;
  }
  ctx.fillStyle = "#f4f1ea";
  ctx.beginPath();
  ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = 1;
  ctx.stroke();

  const runnerCount = Math.max(1, Math.min(4, play?.runs || 1));
  if (u > 0.24) {
    const runT = Math.min(1, (u - 0.24) / 0.62);
    for (let i = 0; i < runnerCount; i++) {
      const along = Math.max(0, Math.min(1, runT - i * 0.12));
      const pos = basePath(along);
      drawBallplayer(ctx, pos.x, pos.y, play?.home === false ? "#c0392b" : "#e8ece8", 0.9);
    }
  }

  roundRectPath(ctx, 14, 10, 268, 72, 8);
  ctx.fillStyle = "#10233f";
  ctx.fill();
  ctx.fillStyle = "#c9a44c";
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(live ? "LIVE  ·  RNV SPORT" : "FINAL  ·  RNV SPORT", 26, 30);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.fillText(`${club.abbrev}  ${game?.ravens ?? 0}`, 26, 56);
  ctx.fillStyle = "#ffb4a8";
  ctx.fillText(`${club.visitorAbbrev}  ${game?.visitors ?? 0}`, 132, 56);
  ctx.fillStyle = "#e8c36a";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.fillText(live ? `${game?.inning ?? 1}` : winner ? `${winner} win` : "TIE", 230, 54);

  roundRectPath(ctx, 430, 10, 196, 40, 8);
  ctx.fillStyle = "rgba(10,14,22,0.78)";
  ctx.fill();
  ctx.fillStyle = "#e8dcc8";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(clock.time, 610, 36);

  ctx.fillStyle = "#10233f";
  ctx.fillRect(0, H - 42, W, 42);
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(0, H - 42, 108, 42);
  ctx.fillStyle = "#fff8f2";
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(live ? "LIVE" : "RECAP", 54, H - 16);
  ctx.fillStyle = "#f4e6c0";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    play?.label ?? `${club.shortName} vs ${club.visitorShort}  ·  first pitch 6:00 PM`,
    122,
    H - 16,
  );
}

function drawCrowdBowl(ctx: CanvasRenderingContext2D, t: number, night: boolean) {
  const deck = night ? "#3a3530" : "#b9b3a8";
  const seat = "#9b2b24";
  ctx.fillStyle = deck;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(0, 38);
  ctx.quadraticCurveTo(320, -8, 640, 38);
  ctx.lineTo(640, 128);
  ctx.quadraticCurveTo(320, 58, 0, 128);
  ctx.closePath();
  ctx.fill();

  const palettes = night
    ? ["#1f4d8c", "#c0392b", "#ece6da", "#c9a44c", "#2a2420", "#6b4a32"]
    : ["#1f4d8c", "#c0392b", "#f4f1ea", "#c9a44c", "#3a3a3a", "#6b4a32"];
  for (let row = 0; row < 5; row++) {
    const y0 = 36 + row * 16;
    ctx.fillStyle = seat;
    ctx.beginPath();
    ctx.moveTo(12 + row * 6, y0 + 14);
    ctx.quadraticCurveTo(320, y0 - 10, 628 - row * 6, y0 + 14);
    ctx.lineTo(628 - row * 6, y0 + 18);
    ctx.quadraticCurveTo(320, y0 - 6, 12 + row * 6, y0 + 18);
    ctx.closePath();
    ctx.fill();
    const count = 28 + row * 4;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;
      const x = 24 + row * 8 + u * (592 - row * 16);
      const y = y0 + 4 + Math.sin(u * Math.PI) * (row * -1.6) + Math.sin(t * 3.2 + i * 0.7 + row) * 0.7;
      if (Math.abs(x - 320) < 58 && row < 2) continue;
      ctx.fillStyle = palettes[(i * 3 + row) % palettes.length];
      ctx.fillRect(x - 2.2, y, 4.4, 7.5);
      ctx.fillStyle = "#e0c2a2";
      ctx.beginPath();
      ctx.arc(x, y - 1.6, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function basePath(t: number) {
  const pts = [
    { x: 320, y: 286 },
    { x: 430, y: 214 },
    { x: 320, y: 156 },
    { x: 210, y: 214 },
    { x: 320, y: 286 },
  ];
  const scaled = t * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(scaled));
  const u = scaled - i;
  return {
    x: pts[i].x + (pts[i + 1].x - pts[i].x) * u,
    y: pts[i].y + (pts[i + 1].y - pts[i].y) * u,
  };
}

function drawBallplayer(ctx: CanvasRenderingContext2D, x: number, y: number, jersey: string, s = 1, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(s, s);
  ctx.fillStyle = jersey;
  ctx.fillRect(-6, -4, 12, 14);
  ctx.fillStyle = "#f0d2b4";
  ctx.beginPath();
  ctx.arc(0, -8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-5, -12, 10, 3);
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

  const game = stadiumOnTv(state);
  const club = ballclubFor(state);
  const winner = game ? stadiumWinner(game, club) : null;
  const headlines = [
    ...state.events.map((event) => event.headline),
    `Population ${state.population.toLocaleString()} and still climbing`,
    "Harborview books out the club floor  ·  Room 1110 still open",
    game
      ? game.playing
        ? `${club.shortName} ${game.ravens}–${game.visitors} ${club.visitorShort}  ·  inning ${game.inning} at the Ballpark`
        : `FINAL  ${club.shortName} ${game.ravens}–${game.visitors} ${club.visitorShort}  ·  ${winner ? `${winner} win` : "tied"}`
      : `${club.shortName} host the ${club.visitorShort} tonight  ·  first pitch 6:00 PM`,
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
  const kind = state.weather?.kind ?? "clear";
  const night = clock.hour24 < 6 || clock.hour24 >= 20;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  if (kind === "snow") {
    sky.addColorStop(0, "#9aafc4");
    sky.addColorStop(1, "#d8e4f0");
  } else if (kind === "rain" || kind === "cloudy") {
    sky.addColorStop(0, "#3d4e62");
    sky.addColorStop(1, "#6a7c8e");
  } else if (night) {
    sky.addColorStop(0, "#10182c");
    sky.addColorStop(1, "#1a2748");
  } else {
    sky.addColorStop(0, "#4d8fd6");
    sky.addColorStop(1, "#9ecfff");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  if (kind === "clear" && night) {
    ctx.fillStyle = "#f4efe4";
    for (let i = 0; i < 28; i++) {
      const x = (i * 97 + 20) % W;
      const y = (i * 53 + 18) % 160;
      ctx.fillRect(x, y, 2, 2);
    }
  } else if (kind === "clear") {
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.arc(520, 70, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle =
    kind === "snow" ? "rgba(255,255,255,0.7)" : night ? "rgba(180,200,220,0.35)" : "rgba(255,255,255,0.55)";
  for (let i = 0; i < (kind === "rain" ? 7 : 4); i++) {
    const x = ((t * (kind === "rain" ? 36 : 18) + i * 160) % (W + 80)) - 40;
    const y = 46 + i * 22;
    cloud(ctx, x, y, 70 + i * 8);
  }
  if (kind === "rain") {
    ctx.strokeStyle = "rgba(210,225,235,0.45)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 37 + t * 80) % W;
      const y = (i * 23 + t * 140) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3, y + 12);
      ctx.stroke();
    }
  } else if (kind === "snow") {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc((i * 53 + t * 12) % W, (i * 41 + t * 18) % H, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
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
  const temp = state.weather?.tempF ?? (night ? 54 : 72);
  ctx.fillText(`${temp}°`, 32, 86);
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillStyle = "#c9e4ff";
  ctx.fillText(`${weatherEmoji(kind)} ${state.weather?.label ?? "Clear"}  ·  Harbor`, 108, 80);

  const days = forecastFor(state.clock, 5).map((day, i) => {
    let year = state.clock.year;
    let doy = state.clock.dayOfYear;
    for (let n = 0; n < i; n++) {
      const next = advanceDay(year, doy);
      year = next.year;
      doy = next.dayOfYear;
    }
    return {
      d: i === 0 ? "NOW" : DAYS[weekdayOf(year, doy)].slice(0, 3).toUpperCase(),
      hi: day.tempF,
      kind: day.kind,
    };
  });
  days.forEach((day, i) => {
    const x = 28 + i * 122;
    ctx.fillStyle = "rgba(10,14,22,0.55)";
    roundRectPath(ctx, x, 280, 110, 64, 8);
    ctx.fill();
    ctx.fillStyle = "#e8dcc8";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(day.d, x + 55, 302);
    ctx.fillStyle = day.kind === "snow" || day.kind === "rain" ? "#7dd3fc" : day.kind === "cloudy" ? "#cbd5e1" : "#fbbf24";
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

function drawNuketown(
  ctx: CanvasRenderingContext2D,
  t: number,
  clock: ReturnType<typeof formatClock>,
) {
  const loop = 8.5;
  const u = (t % loop) / loop;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#6a7a48");
  sky.addColorStop(0.45, "#9aaa62");
  sky.addColorStop(1, "#c4b48a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Dust bowl ground.
  ctx.fillStyle = "#b89a62";
  ctx.fillRect(0, 210, W, H - 210);
  ctx.fillStyle = "#9a7a48";
  ctx.beginPath();
  ctx.moveTo(0, 210);
  ctx.quadraticCurveTo(220, 188, 640, 218);
  ctx.lineTo(640, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Ruined houses.
  const houses = [
    { x: 40, w: 110, h: 78 },
    { x: 190, w: 96, h: 64 },
    { x: 360, w: 128, h: 86 },
    { x: 520, w: 90, h: 70 },
  ];
  for (const house of houses) {
    ctx.fillStyle = "#d8c8a0";
    ctx.fillRect(house.x, 210 - house.h, house.w, house.h);
    ctx.fillStyle = "#6a5030";
    ctx.beginPath();
    ctx.moveTo(house.x - 8, 210 - house.h);
    ctx.lineTo(house.x + house.w / 2, 210 - house.h - 28);
    ctx.lineTo(house.x + house.w + 8, 210 - house.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(house.x + 18, 210 - house.h + 22, 28, 34);
    ctx.fillRect(house.x + house.w - 42, 210 - house.h + 18, 24, 22);
  }

  // Bus / car husk.
  const busX = 240 + Math.sin(t * 0.4) * 6;
  ctx.fillStyle = "#4a6a3a";
  ctx.fillRect(busX, 236, 150, 42);
  ctx.fillStyle = "#2a3a22";
  ctx.fillRect(busX + 12, 242, 36, 18);
  ctx.fillRect(busX + 58, 242, 36, 18);
  ctx.fillRect(busX + 104, 242, 30, 18);

  // Muzzle flash / gunfire spark.
  if (u > 0.2 && u < 0.28) {
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.arc(420, 250, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soldiers.
  const bob = Math.sin(t * 9) * 2;
  drawBallplayer(ctx, 180 + Math.sin(t * 1.4) * 40, 268 + bob, "#3d5a40", 1.05);
  drawBallplayer(ctx, 460 - Math.cos(t * 1.1) * 30, 272 - bob, "#5a4030", 1.05);

  roundRectPath(ctx, 14, 10, 220, 54, 8);
  ctx.fillStyle = "#10233f";
  ctx.fill();
  ctx.fillStyle = "#e8a060";
  ctx.font = "800 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("PS4  ·  LIVE", 26, 30);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "800 18px system-ui, sans-serif";
  ctx.fillText("NUKETOWN", 26, 52);

  roundRectPath(ctx, 430, 10, 196, 40, 8);
  ctx.fillStyle = "rgba(10,14,22,0.78)";
  ctx.fill();
  ctx.fillStyle = "#e8dcc8";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(clock.time, 610, 36);

  ctx.fillStyle = "#1a1206";
  ctx.fillRect(0, H - 42, W, 42);
  ctx.fillStyle = "#e67e22";
  ctx.fillRect(0, H - 42, 108, 42);
  ctx.fillStyle = "#fff8f2";
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MP", 54, H - 16);
  ctx.fillStyle = "#f4e6c0";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Team Deathmatch  ·  Nuketown  ·  Harbor Cinema", 122, H - 16);
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
