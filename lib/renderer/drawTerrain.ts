import { diamondPoints, tileCenter } from "@/lib/city/iso";
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
    drawWaterTile(ctx, x, y, light, time, n, n2);
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

function drawWaterTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  light: Lighting,
  time: number,
  n: number,
  n2: number,
) {
  const deep = "#1a4e6e";
  const mid = "#2a6f96";
  const shallow = "#4a9aba";
  const highlight = "#7ac4e0";

  const depthNoise = hash2(x, y, 77);
  const depthBase = 0.3 + depthNoise * 0.4;

  // Waves use continuous world-space coords so adjacent tiles match seamlessly
  const wave1 = Math.sin(time * 0.9 + x * 0.55 + y * 0.35) * 0.5 + 0.5;
  const wave2 = Math.sin(time * 1.3 + x * 0.8 - y * 0.6 + 2.1) * 0.5 + 0.5;
  const wave3 = Math.sin(time * 0.5 + y * 1.1 + 4.7) * 0.5 + 0.5;
  const combined = wave1 * 0.45 + wave2 * 0.35 + wave3 * 0.2;

  const baseColor = mix(deep, mid, depthBase + combined * 0.25);
  const surfaceColor = mix(baseColor, shallow, combined * 0.3 * light.waterSparkle);
  drawDiamond(ctx, x, y, lit(surfaceColor, light, "ground"));

  const c = tileCenter(x, y);
  const d = diamondPoints(x, y);

  // Clip to tile diamond for detail overlays
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d.top.x, d.top.y);
  ctx.lineTo(d.right.x, d.right.y);
  ctx.lineTo(d.bottom.x, d.bottom.y);
  ctx.lineTo(d.left.x, d.left.y);
  ctx.closePath();
  ctx.clip();

  // Continuous ripple lines — use grid-row y to keep them aligned across tiles
  // in the same row, and extend far past tile edges so seams disappear.
  const span = 60; // extends well past one tile width
  for (let i = 0; i < 4; i++) {
    // Phase based on continuous grid y — same row = same ripple position
    const rowPhase = time * (0.55 + i * 0.18) + y * 1.6 + i * 1.57;
    const rippleScreenY = c.y - 7 + i * 4.5 + Math.sin(rowPhase) * 2.5;
    const waveOff = Math.sin(rowPhase + 0.8) * 1.8;
    const rippleAlpha = (0.05 + combined * 0.05) * light.waterSparkle;

    ctx.beginPath();
    ctx.moveTo(c.x - span, rippleScreenY + waveOff);
    ctx.quadraticCurveTo(
      c.x,
      rippleScreenY - waveOff,
      c.x + span,
      rippleScreenY + waveOff * 0.7,
    );
    ctx.strokeStyle = alpha(lit(highlight, light, "top"), rippleAlpha + 0.03);
    ctx.lineWidth = 0.7 + wave2 * 0.3;
    ctx.stroke();
  }

  // Continuous flow/current — uses grid y for smooth alignment between tiles
  const flowPhase = time * 0.35 + y * 0.4;
  const currentOff = Math.sin(flowPhase) * 3;
  const flowAlpha = 0.025 + wave3 * 0.025;
  ctx.beginPath();
  ctx.moveTo(c.x - span, c.y + currentOff + Math.sin(flowPhase + 0.5) * 1.5);
  ctx.bezierCurveTo(
    c.x - span * 0.33, c.y + currentOff - 2,
    c.x + span * 0.33, c.y + currentOff + 2,
    c.x + span, c.y + currentOff - Math.sin(flowPhase + 1) * 1.5,
  );
  ctx.strokeStyle = alpha(lit("#8fd4ef", light, "top"), flowAlpha);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Sparkle highlights (these are per-tile and intentionally unique)
  if (light.waterSparkle > 0.3) {
    const sparklePhase = time * 2.2 + n * 30;
    const s1 = Math.pow(Math.max(0, Math.sin(sparklePhase)), 8);
    if (s1 > 0.1) {
      ctx.beginPath();
      ctx.fillStyle = alpha("#ffffff", s1 * 0.35 * light.waterSparkle);
      ctx.arc(c.x + (n - 0.5) * 22, c.y + (n2 - 0.5) * 10 - 2, 1.2 + s1 * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    const s2 = Math.pow(Math.max(0, Math.sin(sparklePhase + 3.5)), 8);
    if (s2 > 0.1) {
      ctx.beginPath();
      ctx.fillStyle = alpha("#ffffff", s2 * 0.28 * light.waterSparkle);
      ctx.arc(c.x + (n2 - 0.5) * 18, c.y + (n - 0.5) * 8, 1 + s2 * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // Night overlay and moonlight reflections
  if (light.phase === "night") {
    drawDiamond(ctx, x, y, alpha("#0a1628", 0.06));
    const moonPhase = Math.sin(time * 0.3 + y * 0.15) * 0.5 + 0.5;
    if (moonPhase > 0.65 && n > 0.5) {
      ctx.beginPath();
      ctx.fillStyle = alpha("#c8d8f0", (moonPhase - 0.65) * 0.2);
      ctx.ellipse(c.x, c.y - 1, 10 + moonPhase * 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
