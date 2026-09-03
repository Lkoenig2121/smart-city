import { tileCenter } from "@/lib/city/iso";
import type { Tree } from "@/lib/city/types";
import { alpha, lit, mix, type Lighting } from "./palette";

const CANOPY = ["#2f7a3e", "#3b8f49", "#246434", "#4ea15a", "#1f5c32", "#5aa85f"];

export function drawTree(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  tree: Tree,
  light: Lighting,
) {
  const c = tileCenter(gx, gy);
  const s = tree.scale;
  const color = CANOPY[tree.variant % CANOPY.length]!;
  const trunk = lit("#6b4a2e", light, "right");

  ctx.beginPath();
  ctx.fillStyle = alpha("#1b2a1c", light.phase === "night" ? 0.28 : 0.16);
  ctx.ellipse(c.x + 4, c.y + 8, 10 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = trunk;
  ctx.fillRect(c.x - 2, c.y - 10 * s, 4, 14 * s);

  const layers = [
    { dx: 0, dy: -18 * s, rx: 13 * s, ry: 9 * s, k: 0.75 },
    { dx: -6 * s, dy: -14 * s, rx: 11 * s, ry: 8 * s, k: 0.9 },
    { dx: 6 * s, dy: -13 * s, rx: 10 * s, ry: 7.5 * s, k: 1 },
  ];
  for (const layer of layers) {
    ctx.beginPath();
    ctx.fillStyle = lit(mix(color, "#9be08a", 1 - layer.k), light, layer.k > 0.9 ? "top" : "left");
    ctx.ellipse(c.x + layer.dx, c.y + layer.dy, layer.rx, layer.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawFountain(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  light: Lighting,
  time: number,
) {
  const c = tileCenter(gx, gy);
  ctx.beginPath();
  ctx.fillStyle = lit("#b7b1a6", light, "top");
  ctx.ellipse(c.x, c.y, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = lit(mix("#3a7ea8", "#8fd4e8", 0.4 + Math.sin(time * 3) * 0.1), light, "top");
  ctx.ellipse(c.x, c.y, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha("#eaf8ff", 0.55);
  ctx.fillRect(c.x - 1, c.y - 16 - Math.sin(time * 6) * 2, 2, 14);
}
