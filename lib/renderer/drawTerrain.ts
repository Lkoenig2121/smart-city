import { hash2 } from "@/lib/city/rng";
import type { Terrain } from "@/lib/city/types";
import { drawDiamond } from "./drawIso";
import { alpha, lit, mix, shade, type Lighting } from "./palette";

const TERRAIN: Record<Terrain, string> = {
  grass: "#4d9a4a",
  park: "#3f8f4a",
  plaza: "#c9c0b2",
  water: "#3a7ea8",
  sand: "#d6c38a",
  playground: "#5aa35a",
  lot: "#8d8a84",
};

export function drawTerrainTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  terrain: Terrain,
  light: Lighting,
  time: number,
) {
  const n = hash2(x, y, 11);
  const n2 = hash2(x, y, 29);
  let base = TERRAIN[terrain];

  if (terrain === "grass") base = mix("#4d9a4a", n > 0.5 ? "#5aaa52" : "#3f8644", 0.35 + n * 0.3);
  if (terrain === "park") base = mix("#348646", n > 0.55 ? "#4ca05a" : "#2d7340", 0.4);
  if (terrain === "plaza") base = mix("#c9c0b2", "#b7afa0", n);
  if (terrain === "lot") base = mix("#8d8a84", "#7a7771", n);
  if (terrain === "sand") base = mix("#d6c38a", "#c4af74", n);

  if (terrain === "water") {
    const wave = 0.5 + 0.5 * Math.sin(time * 1.4 + x * 0.7 + y * 0.45);
    base = mix("#2c6d96", "#5fb0c9", 0.25 + wave * 0.35 * light.waterSparkle);
    drawDiamond(ctx, x, y, lit(base, light, "ground"));
    if (wave > 0.72) {
      drawDiamond(ctx, x, y, alpha("#d9f4ff", 0.08 + wave * 0.08));
    }
    return;
  }

  drawDiamond(ctx, x, y, lit(base, light, "ground"));

  if (terrain === "grass" || terrain === "park") {
    if (n2 > 0.86) {
      ctx.fillStyle = lit(mix("#d96b8a", "#f0d56a", n), light, "ground");
      const p = { x: (x - y) * 44, y: (x + y) * 22 + 22 };
      ctx.beginPath();
      ctx.arc(p.x + (n - 0.5) * 16, p.y + (n2 - 0.5) * 8, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (terrain === "park" && n > 0.78) {
      drawDiamond(ctx, x, y, alpha("#2d5d38", 0.08));
    }
  }

  if (terrain === "plaza") {
    ctx.strokeStyle = alpha(shade("#9c9488", light.ambient), 0.35);
    ctx.lineWidth = 0.8;
    drawDiamond(ctx, x, y, "transparent", ctx.strokeStyle);
  }

  if (terrain === "playground") {
    drawDiamond(ctx, x, y, lit(mix("#5aa35a", "#d4a24c", n2 * 0.25), light, "ground"));
  }
}
