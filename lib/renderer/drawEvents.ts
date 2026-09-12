import { gridToScreen, TILE_H } from "@/lib/city/iso";
import type { CityState } from "@/lib/city/types";
import { alpha } from "./palette";

export function drawEventMarkers(
  ctx: CanvasRenderingContext2D,
  state: CityState,
  time: number,
) {
  for (const event of state.events) {
    if (event.kind === "fire") drawFire(ctx, event.x, event.y, time);
    if (event.kind === "accident") drawCrash(ctx, event.x, event.y, time);
  }
}

function drawFire(ctx: CanvasRenderingContext2D, gx: number, gy: number, time: number) {
  const p = gridToScreen(gx, gy);
  const x = p.x;
  const y = p.y + TILE_H * 0.35;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const wobble = Math.sin(time * 9 + i * 1.4) * 3;
    const h = 16 + (i % 3) * 7 + Math.sin(time * 7 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(x - 6 + i * 4, y);
    ctx.quadraticCurveTo(x + wobble + i * 2, y - h, x + 2 + i * 3, y);
    ctx.fillStyle = alpha(i % 2 === 0 ? "#ff6b2a" : "#ffd166", 0.72);
    ctx.fill();
  }
  ctx.fillStyle = alpha("#ff9a3c", 0.18);
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 4, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrash(ctx: CanvasRenderingContext2D, gx: number, gy: number, time: number) {
  const p = gridToScreen(gx, gy);
  const x = p.x;
  const y = p.y + TILE_H * 0.55;
  ctx.save();
  ctx.translate(x, y);
  drawCar(ctx, -8, -2, 0.5, "#c0392b");
  drawCar(ctx, 10, 3, -0.7, "#2c3e6b");
  const flash = Math.sin(time * 12) > 0;
  ctx.fillStyle = flash ? "#ff4d4d" : "#f4d03f";
  ctx.beginPath();
  ctx.arc(-14, -10, 2.4, 0, Math.PI * 2);
  ctx.arc(16, -8, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rot: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.fillRect(-8, -4, 16, 8);
  ctx.fillStyle = "#d7eef8";
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();
}
