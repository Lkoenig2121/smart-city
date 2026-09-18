import { tileCenter } from "@/lib/city/iso";
import { hash2 } from "@/lib/city/rng";
import type { Tile } from "@/lib/city/types";
import {
  FERRIS_Y,
  WATERFRONT_BOATS,
  ferrisWorldTile,
  isMarinaDockRow,
  isWestBank,
  promenadeXAt,
  riverXAt,
} from "@/lib/city/waterfront";
import { lit, type Lighting } from "./palette";

/** Piers, boats, umbrellas, and the ferris — drawn in the isometric depth pass. */
export function drawWaterfrontDecor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tile: Tile,
  light: Lighting,
  time: number,
  cityId?: string,
) {
  if (cityId === "dustfall") {
    const ferris = ferrisWorldTile("dustfall");
    if (x === Math.floor(ferris.x) && y === Math.floor(ferris.y)) {
      drawFerris(ctx, x, y, light, time);
    }
    return;
  }

  if (
    tile.terrain === "sand" &&
    !tile.road &&
    !tile.buildingId &&
    isWestBank(x, y)
  ) {
    drawBeachUmbrella(ctx, x, y, light);
  }
  if (isMarinaDockRow(y) && x === riverXAt(y)) {
    drawDock(ctx, x, y, light);
  }
  if (y === FERRIS_Y && x === Math.floor(riverXAt(y) + 1.55)) {
    drawFerris(ctx, x, y, light, time);
  }
  for (const boat of WATERFRONT_BOATS) {
    if (Math.floor(boat.x) === x && Math.floor(boat.y) === y) {
      drawBoat(ctx, boat.x, boat.y, boat.color, boat.heading, light, time);
    }
  }
}

function drawBeachUmbrella(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  light: Lighting,
) {
  const n = hash2(x, y, 41);
  if (n < 0.38) return;
  const c = tileCenter(x, y);
  const px = c.x + (n - 0.5) * 18;
  const py = c.y + 4;
  const cloth = n > 0.7 ? "#c0392b" : n > 0.5 ? "#f4f1ea" : "#2471a3";
  ctx.strokeStyle = lit("#4a4f55", light, "ground");
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(px, py + 6);
  ctx.lineTo(px, py - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px - 8, py - 4);
  ctx.quadraticCurveTo(px, py - 14, px + 8, py - 4);
  ctx.closePath();
  ctx.fillStyle = lit(cloth, light, "top");
  ctx.fill();
}

function drawDock(ctx: CanvasRenderingContext2D, x: number, y: number, light: Lighting) {
  const from = tileCenter(promenadeXAt(y), y);
  const to = tileCenter(x + 1.6, y);
  ctx.strokeStyle = lit("#6e5840", light, "ground");
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x + 8, from.y + 6);
  ctx.lineTo(to.x, to.y + 6);
  ctx.stroke();
  ctx.strokeStyle = lit("#4a3b2c", light, "ground");
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawBoat(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  color: string,
  heading: number,
  light: Lighting,
  time: number,
) {
  const c = tileCenter(gx, gy);
  const bob = Math.sin(time * 1.4 + gy) * 1.4;
  ctx.save();
  ctx.translate(c.x, c.y + 8 + bob);
  ctx.rotate(heading > 1 ? 0.4 : -0.4);
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(8, -4);
  ctx.lineTo(10, 0);
  ctx.lineTo(8, 4);
  ctx.closePath();
  ctx.fillStyle = lit(color, light, "ground");
  ctx.fill();
  ctx.fillStyle = lit("#f4efe4", light, "top");
  ctx.fillRect(-2, -3, 6, 6);
  ctx.restore();
}

function drawFerris(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  light: Lighting,
  time: number,
) {
  const c = tileCenter(x, y);
  const cx = c.x;
  const cy = c.y - 18;
  const r = 22;
  ctx.strokeStyle = lit("#c45c4a", light, "top");
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 10, c.y + 10);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + 10, c.y + 10);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = time * 0.18 + (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = lit("#e8c36a", light, "top");
  for (let i = 0; i < 12; i++) {
    const a = time * 0.18 + (i * Math.PI * 2) / 12;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}