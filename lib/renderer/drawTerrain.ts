import { diamondPoints, tileCenter } from "@/lib/city/iso";
import { hash2 } from "@/lib/city/rng";
import type { Graffiti, Terrain, Tile, WeatherKind } from "@/lib/city/types";
import { isWestBank, isWestShoreWater } from "@/lib/city/waterfront";
import { isMountainTerrain, mountainIsoHeight, mountainNeighborIsoHeight } from "@/lib/city/terrainElevation";
import { paintGraffiti } from "./drawBridges";
import { drawDiamond, isoBoxCorners } from "./drawIso";
import { alpha, lit, mix, shade, type Lighting } from "./palette";

const TERRAIN: Record<Terrain, string> = {
  grass: "#4d9a4a",
  park: "#3f8f4a",
  plaza: "#c9c0b2",
  water: "#3a7ea8",
  sand: "#d6c38a",
  playground: "#5aa35a",
  lot: "#8d8a84",
  rock: "#7a7368",
  snow: "#e8eef4",
};

function rockPalette(x: number, y: number, light: Lighting) {
  const n = hash2(x, y, 11);
  const base = mix("#6e675c", n > 0.5 ? "#8a8274" : "#554e44", 0.35 + n * 0.35);
  return {
    left: lit(shade(base, 0.72), light, "left"),
    right: lit(shade(base, 0.88), light, "right"),
    top: lit(mix(base, "#9a9284", 0.35), light, "top"),
    base,
  };
}

function snowPalette(x: number, y: number, light: Lighting) {
  const n = hash2(x, y, 11);
  const base = mix("#eef3f8", n > 0.55 ? "#ffffff" : "#d5dde8", 0.4 + n * 0.25);
  return {
    left: lit(mix("#b8c4d0", "#8a949e", 0.35), light, "left"),
    right: lit(mix("#c8d4e0", "#9aa6b2", 0.3), light, "right"),
    top: lit(base, light, "top"),
    base,
  };
}

/**
 * One continuous massif: raised top flush with neighbours, cliffs only where
 * the mountain meets foothills (or a much lower neighbour).
 */
export function drawMountainColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  terrain: Terrain,
  light: Lighting,
  tiles?: Tile[][] | null,
) {
  if (!isMountainTerrain(terrain)) return;
  const h = mountainIsoHeight(terrain, x, y, tiles);
  if (h <= 0) return;
  const pal = terrain === "snow" ? snowPalette(x, y, light) : rockPalette(x, y, light);
  // Zero inset so adjacent tops abut into one surface.
  const { R, B, L, Te, Re, Be, Le } = isoBoxCorners(x, y, 1, 1, h, 0);

  const he = mountainNeighborIsoHeight(tiles, x + 1, y);
  const hs = mountainNeighborIsoHeight(tiles, x, y + 1);
  const cliffGap = 10;

  // Right face (east) — only on the massif rim.
  if (he < h - cliffGap) {
    ctx.beginPath();
    ctx.moveTo(R.x, R.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(Be.x, Be.y);
    ctx.lineTo(Re.x, Re.y);
    ctx.closePath();
    ctx.fillStyle = pal.right;
    ctx.fill();
  }

  // Left face (south) — only on the massif rim.
  if (hs < h - cliffGap) {
    ctx.beginPath();
    ctx.moveTo(L.x, L.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(Be.x, Be.y);
    ctx.lineTo(Le.x, Le.y);
    ctx.closePath();
    ctx.fillStyle = pal.left;
    ctx.fill();
  }

  // Continuous plateau / slope top.
  ctx.beginPath();
  ctx.moveTo(Te.x, Te.y);
  ctx.lineTo(Re.x, Re.y);
  ctx.lineTo(Be.x, Be.y);
  ctx.lineTo(Le.x, Le.y);
  ctx.closePath();
  ctx.fillStyle = pal.top;
  ctx.fill();

  // Subtle ridge shading so the dome reads without per-tile spikes.
  if (terrain === "snow") {
    ctx.fillStyle = alpha("#ffffff", 0.14);
    ctx.fill();
  }
}

export function drawTerrainTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  terrain: Terrain,
  light: Lighting,
  time: number,
  graffiti: Graffiti | null = null,
  weather: WeatherKind = "clear",
  staticWater = false,
) {
  const n = hash2(x, y, 11);
  const n2 = hash2(x, y, 29);
  let base = TERRAIN[terrain];

  if (terrain === "grass") base = mix("#4d9a4a", n > 0.5 ? "#5aaa52" : "#3f8644", 0.35 + n * 0.3);
  if (terrain === "park") base = mix("#348646", n > 0.55 ? "#4ca05a" : "#2d7340", 0.4);
  if (terrain === "plaza") base = mix("#c9c0b2", "#b7afa0", n);
  if (terrain === "lot") base = mix("#8d8a84", "#7a7771", n);
  if (terrain === "rock") base = rockPalette(x, y, light).base;
  if (terrain === "snow") base = snowPalette(x, y, light).base;
  if (terrain === "sand") {
    const beach = isWestBank(x, y) || y <= 8;
    base = mix(beach ? "#e2d09a" : "#d6c38a", beach ? "#d4bc7c" : "#c4af74", n);
  }

  if (terrain === "water") {
    if (staticWater) {
      const depth = 0.3 + hash2(x, y, 77) * 0.4;
      drawDiamond(ctx, x, y, lit(mix("#1a4e6e", "#4a9aba", depth), light, "ground"));
      return;
    }
    drawWaterTile(ctx, x, y, light, time, n, n2);
    if (isWestShoreWater(x, y)) drawWestSurf(ctx, x, y, light, time);
    return;
  }

  // Rock/snow stay flat in the ground bake; elevation is drawn live.
  drawDiamond(ctx, x, y, lit(base, light, "ground"));
  if (weather === "snow") {
    drawDiamond(ctx, x, y, alpha("#f4f7fb", terrain === "lot" || terrain === "plaza" ? 0.28 : 0.42));
  }

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

  if (terrain === "lot") {
    const d = diamondPoints(x, y);
    ctx.strokeStyle = alpha(lit("#d9d4c4", light, "top"), 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo((d.top.x + d.left.x) / 2, (d.top.y + d.left.y) / 2);
    ctx.lineTo((d.bottom.x + d.right.x) / 2, (d.bottom.y + d.right.y) / 2);
    ctx.moveTo((d.top.x + d.right.x) / 2, (d.top.y + d.right.y) / 2);
    ctx.lineTo((d.bottom.x + d.left.x) / 2, (d.bottom.y + d.left.y) / 2);
    ctx.stroke();
  }

  if (terrain === "rock") {
    drawDiamond(ctx, x, y, alpha("#3a342c", 0.12 + n * 0.1));
  }

  if (terrain === "snow") {
    drawDiamond(ctx, x, y, alpha("#ffffff", 0.18));
  }

  if (terrain === "playground") {
    drawDiamond(ctx, x, y, lit(mix("#5aa35a", "#d4a24c", n2 * 0.25), light, "ground"));
  }

  if (terrain === "sand" && graffiti) {
    drawEmbankment(ctx, x, y, graffiti, light);
  }
}

/** A low concrete lip along the river, the kind that collects tags. */
function drawEmbankment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  graffiti: Graffiti,
  light: Lighting,
) {
  const d = diamondPoints(x, y);
  const h = 11;
  const face = [
    d.bottom,
    d.right,
    { x: d.right.x, y: d.right.y - h },
    { x: d.bottom.x, y: d.bottom.y - h },
  ];

  ctx.beginPath();
  ctx.moveTo(face[0].x, face[0].y);
  for (let i = 1; i < face.length; i++) ctx.lineTo(face[i].x, face[i].y);
  ctx.closePath();
  ctx.fillStyle = lit("#8f8c84", light, "right");
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(face[3].x, face[3].y);
  ctx.lineTo(face[2].x, face[2].y);
  ctx.strokeStyle = lit("#b3afa6", light, "top");
  ctx.lineWidth = 1.5;
  ctx.stroke();

  paintGraffiti(
    ctx,
    { x: (d.bottom.x + d.right.x) / 2, y: (d.bottom.y + d.right.y) / 2 - h * 0.5 },
    22,
    h - 2,
    graffiti,
    light,
  );
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

/** Breaking foam on the HUD-side (west) river edge. */
function drawWestSurf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  light: Lighting,
  time: number,
) {
  const d = diamondPoints(x, y);
  const c = tileCenter(x, y);
  const crest = 0.5 + 0.5 * Math.sin(time * 2.1 + y * 0.55);
  const foam = alpha(lit("#f4fbff", light, "top"), 0.22 + crest * 0.35);
  const wash = alpha(lit("#c5e8f4", light, "ground"), 0.18 + crest * 0.2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d.top.x, d.top.y);
  ctx.lineTo(d.left.x, d.left.y);
  ctx.lineTo(d.bottom.x, d.bottom.y);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.moveTo(d.top.x, d.top.y);
  ctx.quadraticCurveTo(
    d.left.x + 6,
    d.left.y - 2 + crest * 3,
    d.bottom.x,
    d.bottom.y,
  );
  ctx.lineTo(d.left.x, d.left.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = foam;
  ctx.lineWidth = 2.2 + crest * 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(d.top.x + 4, d.top.y + 6);
  ctx.quadraticCurveTo(
    c.x - 18,
    c.y + Math.sin(time * 2.4 + y) * 3,
    d.bottom.x + 4,
    d.bottom.y - 6,
  );
  ctx.stroke();

  ctx.strokeStyle = alpha(lit("#ffffff", light, "top"), 0.15 + crest * 0.25);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(d.top.x + 10, d.top.y + 10);
  ctx.quadraticCurveTo(
    c.x - 10,
    c.y + 2 + Math.cos(time * 1.7 + y * 0.4) * 2,
    d.bottom.x + 8,
    d.bottom.y - 8,
  );
  ctx.stroke();
  ctx.restore();
}
