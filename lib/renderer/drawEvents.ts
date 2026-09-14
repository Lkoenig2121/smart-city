import { gridToScreen, TILE_H } from "@/lib/city/iso";
import { drawPoiMark, isJobBuilding } from "@/lib/city/minimapPois";
import { readPlayer } from "@/lib/city/player";
import type { Building, CityState } from "@/lib/city/types";
import { buildingDrawHeight } from "./pickBuilding";
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

export function drawJobMarkers(
  ctx: CanvasRenderingContext2D,
  state: CityState,
  time: number,
) {
  const employerId = readPlayer().career?.employerId ?? null;
  for (const building of state.buildings.values()) {
    if (!isJobBuilding(building) && building.id !== employerId) continue;
    drawJobPin(ctx, building, time, building.id === employerId);
  }
}

function drawJobPin(ctx: CanvasRenderingContext2D, building: Building, time: number, yours: boolean) {
  const gx = building.origin.x + building.width / 2;
  const gy = building.origin.y + building.depth / 2;
  const p = gridToScreen(gx, gy);
  const y = p.y - buildingDrawHeight(building) + TILE_H * 0.15;
  const pulse = yours ? 1.15 + Math.sin(time * 3.2) * 0.12 : 1;
  if (yours) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, y, 11 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = alpha("#f4d03f", 0.85);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  drawPoiMark(ctx, p.x, y, "office", 7.4 * pulse);
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
