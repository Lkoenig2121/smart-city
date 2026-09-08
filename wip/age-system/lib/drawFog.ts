import { diamondPoints, tileCenter } from "@/lib/city/iso";
import { hash2 } from "@/lib/city/rng";
import type { Tile } from "@/lib/city/types";
import { drawDiamond } from "./drawIso";
import { alpha, type Lighting } from "./palette";

/**
 * Unexplored land reads as a pale, rolling mist rather than black nothing, so
 * the map still looks like a world the player has yet to walk into.
 */
export function drawFogTile(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  light: Lighting,
  time: number,
  edge: boolean,
) {
  const { x, y } = tile;
  const n = hash2(x, y, 17);

  const base = light.phase === "night" ? "#0d1420" : "#8f9aa8";
  drawDiamond(ctx, x, y, alpha(base, edge ? 0.55 : 0.88));

  // Slow-drifting cloud blobs give the mist some motion.
  const c = tileCenter(x, y);
  const drift = Math.sin(time * 0.25 + n * 6.28) * 6;
  const puffs = edge ? 2 : 3;
  for (let i = 0; i < puffs; i++) {
    const m = hash2(x + i, y, 31);
    ctx.beginPath();
    ctx.ellipse(
      c.x + (m - 0.5) * 40 + drift,
      c.y - 4 + (n - 0.5) * 12,
      16 + m * 12,
      8 + m * 5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = alpha(light.phase === "night" ? "#1a2436" : "#c3ccd6", edge ? 0.16 : 0.3);
    ctx.fill();
  }

  if (edge) {
    // Soft boundary so explored land does not end on a hard line.
    const d = diamondPoints(x, y);
    ctx.beginPath();
    ctx.moveTo(d.top.x, d.top.y);
    ctx.lineTo(d.right.x, d.right.y);
    ctx.lineTo(d.bottom.x, d.bottom.y);
    ctx.lineTo(d.left.x, d.left.y);
    ctx.closePath();
    ctx.strokeStyle = alpha(light.phase === "night" ? "#2c3a52" : "#e2e8ee", 0.22);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** True when at least one orthogonal neighbour has been explored. */
export function isFogEdge(tiles: Tile[][], x: number, y: number) {
  return Boolean(
    tiles[y - 1]?.[x]?.revealed ||
      tiles[y + 1]?.[x]?.revealed ||
      tiles[y]?.[x - 1]?.revealed ||
      tiles[y]?.[x + 1]?.revealed,
  );
}
