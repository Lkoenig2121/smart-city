import { TILE_H, TILE_W, diamondPoints } from "@/lib/city/iso";
import { isTramTile } from "@/lib/city/transit";
import type { RoadCell } from "@/lib/city/types";
import { drawDiamond } from "./drawIso";
import { alpha, lit, shade, type Lighting } from "./palette";

export function drawRoadTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  road: RoadCell,
  light: Lighting,
) {
  drawDiamond(ctx, x, y, lit("#6d6a66", light, "ground"));
  drawDiamond(ctx, x, y, lit("#3c3d44", light, "ground"));

  const d = diamondPoints(x, y);
  const asphalt = lit("#3c3d44", light, "ground");
  const mark = alpha(lit("#d9d4c4", light, "top"), light.phase === "night" ? 0.35 : 0.7);
  const walk = lit("#c4bfb4", light, "ground");

  ctx.lineJoin = "round";

  if (road.north || road.south) {
    strokeSeg(ctx, mid(d.top, d.left), mid(d.bottom, d.right), walk, 7);
    strokeSeg(ctx, mid(d.top, d.right), mid(d.bottom, d.left), walk, 7);
  }
  if (road.east || road.west) {
    strokeSeg(ctx, mid(d.left, d.bottom), mid(d.top, d.right), walk, 7);
    strokeSeg(ctx, mid(d.right, d.bottom), mid(d.top, d.left), walk, 7);
  }

  drawDiamond(ctx, x, y, asphalt);

  const straightNS = road.north && road.south && !road.east && !road.west;
  const straightEW = road.east && road.west && !road.north && !road.south;
  if (straightNS) {
    dashed(ctx, d.top.x, d.top.y + 6, d.bottom.x, d.bottom.y - 6, mark);
  } else if (straightEW) {
    dashed(ctx, d.left.x + 8, d.left.y, d.right.x - 8, d.right.y, mark);
  } else {
    const arms = [road.north, road.east, road.south, road.west].filter(Boolean).length;
    if (arms >= 3) {
      ctx.beginPath();
      ctx.arc((d.top.x + d.bottom.x) / 2, (d.top.y + d.bottom.y) / 2, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = shade(asphalt, 0.8);
      ctx.fill();
    }
  }

  if (isTramTile(x, y)) {
    const rail = alpha(lit("#c5ccd3", light, "top"), 0.85);
    if (road.north || road.south) {
      strokeSeg(ctx, mid(d.top, d.left), mid(d.bottom, d.right), rail, 1.4);
      strokeSeg(ctx, mid(d.top, d.right), mid(d.bottom, d.left), rail, 1.4);
    }
  }

  if (light.phase === "night") {
    drawDiamond(ctx, x, y, alpha("#1b2430", 0.06));
  }

  if (light.phase === "night" || light.phase === "dusk") {
    drawStreetLight(ctx, x, y, road, light);
  }
}

function mid(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function strokeSeg(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
  width: number,
) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function dashed(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
) {
  ctx.save();
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawStreetLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  road: RoadCell,
  light: Lighting,
) {
  const shouldPlace = (x + y) % 3 === 0;
  if (!shouldPlace) return;

  const d = diamondPoints(x, y);
  const cx = (d.top.x + d.bottom.x) / 2;
  const cy = (d.top.y + d.bottom.y) / 2;

  const side = road.north || road.south ? -1 : 1;
  const px = cx + side * 14;
  const py = cy - 2;

  const intensity = light.phase === "night" ? 1 : 0.5;

  ctx.fillStyle = `rgba(60, 60, 60, ${0.7 * intensity})`;
  ctx.fillRect(px - 0.8, py - 18, 1.6, 18);

  ctx.fillStyle = `rgba(80, 80, 80, ${0.6 * intensity})`;
  ctx.fillRect(px - 3, py - 19, 6, 2);

  ctx.beginPath();
  ctx.fillStyle = `rgba(255, 240, 180, ${0.95 * intensity})`;
  ctx.arc(px, py - 19, 2, 0, Math.PI * 2);
  ctx.fill();

  const glow = ctx.createRadialGradient(px, py - 6, 2, px, py - 2, 28);
  glow.addColorStop(0, `rgba(255, 230, 150, ${0.22 * intensity})`);
  glow.addColorStop(0.5, `rgba(255, 220, 120, ${0.10 * intensity})`);
  glow.addColorStop(1, "rgba(255, 220, 120, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(px - 30, py - 32, 60, 56);

  const pool = ctx.createRadialGradient(px, py + 4, 1, px, py + 4, 22);
  pool.addColorStop(0, `rgba(255, 235, 160, ${0.14 * intensity})`);
  pool.addColorStop(1, "rgba(255, 235, 160, 0)");
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(px, py + 4, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();
}

void TILE_W;
void TILE_H;
