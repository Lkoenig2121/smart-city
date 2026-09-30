import * as THREE from "three";
import { leagueStandings } from "@/lib/city/stadium";
import type { BuildingKind, CityState, VehicleKind } from "@/lib/city/types";
import { formatClock } from "@/lib/simulation/city/cityTick";

type Bucket = Array<{ dispose: () => void }>;

const W = 1024;
const H = 576;
const SLIDE_SECONDS = 7;
const REDRAW_SECONDS = 1;
const PALETTE = ["#4fc3f7", "#ffb74d", "#81c784", "#e57373", "#ba68c8", "#fff176", "#90a4ae"];
const BG = "#0f1722";
const PANEL = "#17222f";
const INK = "#eef3f8";
const MUTED = "#8fa3b8";

interface Slice {
  label: string;
  value: number;
}

interface Slide {
  title: string;
  draw: (ctx: CanvasRenderingContext2D, state: CityState) => void;
}

const LAND_USE: Record<BuildingKind, string> = {
  house: "Residential",
  apartment: "Residential",
  shop: "Retail",
  office: "Offices",
  skyscraper: "Offices",
  tower: "Offices",
  hospital: "Civic",
  school: "Civic",
  police: "Civic",
  fire: "Civic",
  city_hall: "Civic",
  park_pavilion: "Leisure",
  baseball_stadium: "Leisure",
  subway_station: "Transit",
};

const VEHICLE_LABEL: Record<VehicleKind, string> = {
  car: "Cars",
  bus: "Buses",
  truck: "Trucks",
  taxi: "Taxis",
  ambulance: "Ambulances",
  firetruck: "Fire trucks",
};

const money = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
  return `${sign}$${Math.round(abs)}`;
};

const count = (n: number) => (n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : Math.round(n).toLocaleString("en-US"));

function tally<T>(items: Iterable<T>, key: (item: T) => string | null, weight: (item: T) => number = () => 1): Slice[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) totals.set(k, (totals.get(k) ?? 0) + weight(item));
  }
  return [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function empty(ctx: CanvasRenderingContext2D, message: string) {
  ctx.fillStyle = MUTED;
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(message, W / 2, H / 2 + 20);
}

function pie(ctx: CanvasRenderingContext2D, slices: Slice[], unit: (n: number) => string, donut: boolean) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return empty(ctx, "No data yet");
  const cx = 290;
  const cy = 318;
  const r = 180;
  let angle = -Math.PI / 2;
  slices.forEach((slice, i) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fill();
    ctx.strokeStyle = BG;
    ctx.lineWidth = 4;
    ctx.stroke();
    angle += sweep;
  });
  if (donut) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.56, 0, Math.PI * 2);
    ctx.fillStyle = BG;
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = "bold 38px sans-serif";
    ctx.fillText(unit(total), cx, cy + 6);
    ctx.fillStyle = MUTED;
    ctx.font = "20px sans-serif";
    ctx.fillText("total", cx, cy + 36);
  }

  const rows = slices.slice(0, 7);
  const rowH = Math.min(52, 330 / rows.length);
  const top = cy - (rows.length * rowH) / 2 + rowH / 2;
  ctx.textAlign = "left";
  rows.forEach((slice, i) => {
    const y = top + i * rowH;
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fillRect(540, y - 13, 26, 26);
    ctx.fillStyle = INK;
    ctx.font = "26px sans-serif";
    ctx.fillText(fit(ctx, slice.label, 230), 582, y + 9);
    ctx.textAlign = "right";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(`${Math.round((slice.value / total) * 100)}%`, 960, y + 9);
    ctx.fillStyle = MUTED;
    ctx.font = "20px sans-serif";
    ctx.fillText(unit(slice.value), 880, y + 8);
    ctx.textAlign = "left";
  });
}

function bars(ctx: CanvasRenderingContext2D, rows: Slice[], unit: (n: number) => string) {
  if (!rows.length) return empty(ctx, "No data yet");
  const max = Math.max(...rows.map((r) => r.value), 1);
  const left = 300;
  const right = 900;
  const rowH = Math.min(72, 380 / rows.length);
  const top = 130 + (380 - rows.length * rowH) / 2;
  rows.forEach((row, i) => {
    const y = top + i * rowH;
    const barH = rowH * 0.62;
    ctx.fillStyle = INK;
    ctx.font = "26px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(fit(ctx, row.label, left - 80), left - 20, y + barH / 2 + 9);
    ctx.fillStyle = PANEL;
    ctx.fillRect(left, y, right - left, barH);
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fillRect(left, y, Math.max(6, ((right - left) * row.value) / max), barH);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(unit(row.value), right + 14, y + barH / 2 + 8);
  });
}

function tile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, value: string, accent: string) {
  ctx.fillStyle = PANEL;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, 8, h);
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = "22px sans-serif";
  ctx.fillText(label.toUpperCase(), x + 28, y + 42);
  ctx.fillStyle = INK;
  ctx.font = "bold 50px sans-serif";
  ctx.fillText(fit(ctx, value, w - 44), x + 28, y + h - 34);
}

const SLIDES: Slide[] = [
  {
    title: "City at a glance",
    draw: (ctx, state) => {
      const buildings = [...state.buildings.values()];
      const jobs = buildings.reduce((sum, b) => sum + b.stats.jobs, 0);
      const employed = buildings.reduce((sum, b) => sum + b.stats.employees, 0);
      const mood = buildings.length ? buildings.reduce((sum, b) => sum + b.stats.happiness, 0) / buildings.length : 0;
      const output = buildings.reduce((sum, b) => sum + b.stats.revenue, 0);
      const cells: Array<[string, string]> = [
        ["Population", count(state.population)],
        ["Treasury", money(state.budget.treasury)],
        ["Jobs filled", jobs ? `${Math.round((employed / jobs) * 100)}%` : "—"],
        ["Happiness", `${Math.round(mood)}%`],
        ["Daily output", money(output)],
        ["Weather", `${Math.round(state.weather.tempF)}°F ${state.weather.label}`],
      ];
      const w = 300;
      const h = 170;
      cells.forEach(([label, value], i) => {
        const x = 42 + (i % 3) * (w + 20);
        const y = 130 + Math.floor(i / 3) * (h + 22);
        tile(ctx, x, y, w, h, label, value, PALETTE[i % PALETTE.length]);
      });
    },
  },
  {
    title: "Land use · buildings by type",
    draw: (ctx, state) => pie(ctx, tally(state.buildings.values(), (b) => LAND_USE[b.kind] ?? null), count, false),
  },
  {
    title: "Budget allocation",
    draw: (ctx, state) => {
      const { police, fire, healthcare, education, parks, roads } = state.budget;
      const slices: Slice[] = [
        { label: "Police", value: police },
        { label: "Fire", value: fire },
        { label: "Healthcare", value: healthcare },
        { label: "Education", value: education },
        { label: "Parks", value: parks },
        { label: "Roads", value: roads },
      ];
      pie(ctx, slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value), money, true);
    },
  },
  {
    title: "Top earners · daily revenue",
    draw: (ctx, state) =>
      bars(
        ctx,
        [...state.buildings.values()]
          .filter((b) => b.stats.revenue > 0)
          .sort((a, b) => b.stats.revenue - a.stats.revenue)
          .slice(0, 5)
          .map((b) => ({ label: b.name, value: b.stats.revenue })),
        money,
      ),
  },
  {
    title: "Street traffic right now",
    draw: (ctx, state) => {
      const rows = tally(state.vehicles, (v) => VEHICLE_LABEL[v.kind] ?? null).slice(0, 5);
      const parked = state.parked.length;
      if (parked) rows.push({ label: "Parked", value: parked });
      bars(ctx, rows, count);
    },
  },
  {
    title: "League standings",
    draw: (ctx, state) => {
      const table = leagueStandings(state.clock).slice(0, 6);
      if (!table.length) return empty(ctx, "Season hasn't started");
      const cols = [80, 600, 720, 840, 950];
      ctx.font = "22px sans-serif";
      ctx.fillStyle = MUTED;
      ctx.textAlign = "left";
      ctx.fillText("CLUB", cols[0], 150);
      ctx.textAlign = "right";
      ["W", "L", "PCT", "GB"].forEach((h, i) => ctx.fillText(h, cols[i + 1], 150));
      table.forEach((row, i) => {
        const y = 200 + i * 58;
        const home = row.cityId === state.id;
        ctx.fillStyle = home ? "#223246" : i % 2 ? BG : PANEL;
        ctx.fillRect(56, y - 36, 916, 52);
        ctx.fillStyle = row.club.accent;
        ctx.fillRect(56, y - 36, 8, 52);
        ctx.textAlign = "left";
        ctx.fillStyle = INK;
        ctx.font = `${home ? "bold " : ""}28px sans-serif`;
        ctx.fillText(fit(ctx, `${i + 1}. ${row.club.fullName}`, 440), cols[0], y);
        ctx.textAlign = "right";
        const gb = row.gamesBack === 0 ? "—" : row.gamesBack.toFixed(1);
        [String(row.wins), String(row.losses), row.pct.toFixed(3).replace(/^0/, ""), gb].forEach((v, j) =>
          ctx.fillText(v, cols[j + 1], y),
        );
      });
    },
  },
];

/** Canvas-driven conference TV that cycles live city dashboards. */
export function makeConferenceScreen(
  bucket: Bucket,
  width: number,
  height: number,
  getState: () => CityState | null,
  companyName: string,
) {
  const el = document.createElement("canvas");
  el.width = W;
  el.height = H;
  const ctx = el.getContext("2d");
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });
  const geo = new THREE.PlaneGeometry(width, height);
  bucket.push(tex, mat, geo);

  let slide = 0;
  let slideTime = 0;
  let sinceDraw = Infinity;

  const draw = () => {
    if (!ctx) return;
    const state = getState();
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    if (!state) {
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.font = "bold 56px sans-serif";
      ctx.fillText(companyName, W / 2, H / 2);
      tex.needsUpdate = true;
      return;
    }

    const current = SLIDES[slide];
    const clock = formatClock(state);
    ctx.fillStyle = PANEL;
    ctx.fillRect(0, 0, W, 92);
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = "bold 40px sans-serif";
    ctx.fillText(current.title, 40, 60);
    ctx.textAlign = "right";
    ctx.fillStyle = MUTED;
    ctx.font = "22px sans-serif";
    ctx.fillText(`${state.name} · ${clock.day} ${clock.time}`, W - 36, 56);

    ctx.save();
    current.draw(ctx, state);
    ctx.restore();

    ctx.fillStyle = MUTED;
    ctx.font = "18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(companyName, 40, H - 24);
    SLIDES.forEach((_, i) => {
      ctx.beginPath();
      ctx.arc(W / 2 - ((SLIDES.length - 1) * 22) / 2 + i * 22, H - 30, i === slide ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === slide ? INK : "#3a4a5c";
      ctx.fill();
    });
    ctx.fillStyle = "#2a3a4c";
    ctx.fillRect(0, H - 6, W, 6);
    ctx.fillStyle = PALETTE[slide % PALETTE.length];
    ctx.fillRect(0, H - 6, (W * Math.min(1, slideTime / SLIDE_SECONDS)), 6);
    tex.needsUpdate = true;
  };

  const update = (dt: number) => {
    slideTime += dt;
    sinceDraw += dt;
    if (slideTime >= SLIDE_SECONDS) {
      slideTime = 0;
      slide = (slide + 1) % SLIDES.length;
      sinceDraw = Infinity;
    }
    if (sinceDraw >= REDRAW_SECONDS) {
      sinceDraw = 0;
      draw();
    }
  };

  const makeMesh = () => new THREE.Mesh(geo, mat);
  return { makeMesh, update };
}
