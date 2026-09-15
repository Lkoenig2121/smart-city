import { TILE_H, TILE_W, gridToScreen } from "@/lib/city/iso";
import type { Building, CityState } from "@/lib/city/types";
import { findStadium, stadiumAttendance, stadiumIsOpen } from "./stadium";

export const FIREWORK_PALETTE = ["#ffd36a", "#ff6b5a", "#7ec8ff", "#f4f1ea", "#c9a44c", "#ff8ad4"];

export interface FireworkSpark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  tint: number;
}

export interface FireworkBurstOpts {
  spreadX?: number;
  spreadZ?: number;
  z0?: number;
  height0?: number;
  height1?: number;
  bursts?: number;
  sparksPerBurst?: number;
  rate?: number;
}

export function createFireworkSparks(count: number): FireworkSpark[] {
  const sparks: FireworkSpark[] = [];
  for (let i = 0; i < count; i++) {
    sparks.push({
      x: 0,
      y: -40,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 99,
      life: 1,
      tint: i % FIREWORK_PALETTE.length,
    });
  }
  return sparks;
}

export function stadiumFireworksOn(state: CityState) {
  const stadium = findStadium(state);
  if (!stadium || !stadiumIsOpen(stadium)) return false;
  return stadiumAttendance(state).fireworks;
}

/** Advance bursts. Coordinates are metres around the stadium centre. */
export function stepFireworks(
  sparks: FireworkSpark[],
  on: boolean,
  time: number,
  dt: number,
  opts: FireworkBurstOpts = {},
) {
  const spreadX = opts.spreadX ?? 16;
  const spreadZ = opts.spreadZ ?? 10;
  const z0 = opts.z0 ?? 0;
  const height0 = opts.height0 ?? 18;
  const height1 = opts.height1 ?? 28;
  const bursts = opts.bursts ?? 1;
  const per = opts.sparksPerBurst ?? 16;
  const rate = opts.rate ?? 2.2;

  if (on && Math.floor(time * rate) !== Math.floor((time - dt) * rate)) {
    for (let b = 0; b < bursts; b++) {
      const ox = (Math.random() - 0.5) * spreadX;
      const oz = z0 + (Math.random() - 0.5) * spreadZ;
      const oy = height0 + Math.random() * (height1 - height0);
      const hue = Math.floor(Math.random() * sparks.length);
      for (let i = 0; i < per; i++) {
        const spark = sparks[(hue + i) % sparks.length];
        const a = (i / per) * Math.PI * 2;
        const s = 4.5 + Math.random() * 3.5;
        spark.x = ox;
        spark.y = oy;
        spark.z = oz;
        spark.vx = Math.cos(a) * s * (0.4 + Math.random());
        spark.vy = Math.sin(a * 1.7) * s * 0.55 + 1.2;
        spark.vz = Math.sin(a) * s * (0.4 + Math.random());
        spark.age = 0;
        spark.life = 1.15 + Math.random() * 0.5;
        spark.tint = (hue + i) % FIREWORK_PALETTE.length;
      }
    }
  }

  for (const spark of sparks) {
    spark.age += dt;
    if (!on || spark.age > spark.life) continue;
    spark.vy -= 7.5 * dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.z += spark.vz * dt;
  }
}

export function sparkFade(spark: FireworkSpark) {
  if (spark.age > spark.life) return 0;
  return Math.max(0, 1 - spark.age / spark.life);
}

/** Paint live bursts over the ballpark in isometric city view. */
export function drawStadiumFireworks(
  ctx: CanvasRenderingContext2D,
  stadium: Building,
  sparks: FireworkSpark[],
) {
  const cx = stadium.origin.x + stadium.width / 2;
  const cy = stadium.origin.y + stadium.depth / 2;
  const g = gridToScreen(cx, cy);
  const kx = TILE_W / 20;
  const kz = TILE_H / 20;
  const ky = 2.9;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const spark of sparks) {
    const fade = sparkFade(spark);
    if (fade <= 0) continue;
    const x = g.x + (spark.x - spark.z) * kx;
    const y = g.y + (spark.x + spark.z) * kz - spark.y * ky;
    const hex = FIREWORK_PALETTE[spark.tint] ?? FIREWORK_PALETTE[0];
    const r = 1.4 + fade * 3.8;
    ctx.fillStyle = hexAlpha(hex, 0.18 + fade * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexAlpha("#fff6d8", 0.35 + fade * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexAlpha(hex, 0.45 + fade * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function hexAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
