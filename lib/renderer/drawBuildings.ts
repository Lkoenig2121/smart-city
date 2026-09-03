import { TILE_H, TILE_W, diamondPoints, gridToScreen } from "@/lib/city/iso";
import { hash2 } from "@/lib/city/rng";
import type { Building } from "@/lib/city/types";
import { drawGroundShadow, drawIsoBox, drawSlopedRoof, drawWindowGrid } from "./drawIso";
import { alpha, lit, mix, shade, type Lighting } from "./palette";

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  building: Building,
  light: Lighting,
  selected: boolean,
) {
  drawGroundShadow(
    ctx,
    building.origin.x,
    building.origin.y,
    building.width,
    building.depth,
    light.phase === "night" ? 0.35 : 0.2,
  );

  switch (building.kind) {
    case "house":
      drawHouse(ctx, building, light);
      break;
    case "apartment":
      drawApartment(ctx, building, light);
      break;
    case "shop":
      drawShop(ctx, building, light);
      break;
    case "office":
      drawOffice(ctx, building, light);
      break;
    case "skyscraper":
      drawSkyscraper(ctx, building, light);
      break;
    case "hospital":
      drawHospital(ctx, building, light);
      break;
    case "school":
      drawSchool(ctx, building, light);
      break;
    case "police":
      drawCivic(ctx, building, light, "#2c3e6b");
      break;
    case "fire":
      drawFirehouse(ctx, building, light);
      break;
    case "city_hall":
      drawCityHall(ctx, building, light);
      break;
    case "park_pavilion":
      drawPavilion(ctx, building, light);
      break;
  }

  if (selected) {
    const d = diamondPoints(building.origin.x, building.origin.y);
    ctx.save();
    ctx.strokeStyle = alpha("#f4d03f", 0.95);
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(d.top.x, d.top.y - 8);
    ctx.lineTo(d.right.x + 8, d.right.y);
    ctx.lineTo(d.bottom.x, d.bottom.y + 8);
    ctx.lineTo(d.left.x - 8, d.left.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

function glassColor(light: Lighting, seed: number) {
  if (light.windowLit > 0.5 && seed > 1 - light.windowLit * 0.75) {
    return mix("#f6e27a", "#ffe9a8", seed);
  }
  return mix("#9fd4ef", "#d7eef8", 0.35 + seed * 0.4);
}

function drawHouse(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const h = 26 + (b.variant % 3) * 3;
  const left = lit(b.wallColor, light, "left");
  const right = lit(b.wallColor, light, "right");
  const top = lit(mix(b.wallColor, "#fff6e8", 0.15), light, "top");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, 1, 1, h, left, right, top, 10);
  const seed = hash2(b.origin.x, b.origin.y, b.variant);
  const glass = glassColor(light, seed);
  drawWindowGrid(ctx, box.L.x, box.L.y, box.B.x, box.B.y, box.Be.x, box.Be.y, box.Le.x, box.Le.y, 2, 1, glass, shade(left, 0.75));
  drawWindowGrid(ctx, box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y, 2, 1, glass, shade(right, 0.75));
  drawSlopedRoof(
    ctx,
    box,
    lit(shade(b.roofColor, 0.78), light, "left"),
    lit(b.roofColor, light, "right"),
    b.variant % 2 === 0 ? "x" : "y",
  );

  ctx.beginPath();
  ctx.fillStyle = lit(shade(b.roofColor, 0.7), light, "right");
  ctx.fillRect(box.Re.x - 10, box.Re.y - 16, 5, 16);
  ctx.fillStyle = lit("#b8c2c8", light, "top");
  ctx.fillRect(box.Re.x - 11, box.Re.y - 19, 7, 4);

  if (b.variant % 3 !== 0) {
    const door = mix(b.accentColor, "#2a1c14", 0.2);
    ctx.beginPath();
    ctx.fillStyle = lit(door, light, "right");
    const dx = (box.B.x + box.R.x) / 2;
    const dy = (box.B.y + box.R.y) / 2;
    ctx.moveTo(dx - 3, dy - 2);
    ctx.lineTo(dx + 5, dy - 6);
    ctx.lineTo(dx + 5, dy - 18);
    ctx.lineTo(dx - 3, dy - 14);
    ctx.closePath();
    ctx.fill();
  }
}

function drawApartment(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const h = 18 + b.floors * 14;
  const left = lit(b.wallColor, light, "left");
  const right = lit(b.wallColor, light, "right");
  const top = lit(b.roofColor, light, "top");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, 1, 1, h, left, right, top, 7);
  const seed = hash2(b.origin.x, b.origin.y, 4);
  drawWindowGrid(
    ctx,
    box.L.x, box.L.y, box.B.x, box.B.y, box.Be.x, box.Be.y, box.Le.x, box.Le.y,
    3, b.floors, glassColor(light, seed), shade(left, 0.7),
  );
  drawWindowGrid(
    ctx,
    box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y,
    3, b.floors, glassColor(light, seed + 0.1), shade(right, 0.7),
  );
  roofProps(ctx, box, light);
}

function drawShop(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const h = 30;
  const left = lit(b.wallColor, light, "left");
  const right = lit(b.wallColor, light, "right");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, 1, 1, h, left, right, lit(b.roofColor, light, "top"), 8);
  const awning = lit(b.accentColor, light, "right");
  ctx.beginPath();
  ctx.moveTo(box.B.x, box.B.y - 16);
  ctx.lineTo(box.R.x, box.R.y - 16);
  ctx.lineTo(box.R.x + 4, box.R.y - 10);
  ctx.lineTo(box.B.x, box.B.y - 10);
  ctx.closePath();
  ctx.fillStyle = awning;
  ctx.fill();
  drawWindowGrid(
    ctx,
    box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y - 8, box.Be.x, box.Be.y - 8,
    2, 1, glassColor(light, 0.4), shade(right, 0.65),
  );
  drawSlopedRoof(ctx, box, lit(shade(b.roofColor, 0.8), light, "left"), lit(b.roofColor, light, "right"));
}

function drawOffice(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const h = 22 + b.floors * 13;
  const left = lit(shade(b.wallColor, 0.85), light, "left");
  const right = lit(b.wallColor, light, "right");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, 1, 1, h, left, right, lit(b.roofColor, light, "top"), 6);
  drawWindowGrid(
    ctx,
    box.L.x, box.L.y, box.B.x, box.B.y, box.Be.x, box.Be.y, box.Le.x, box.Le.y,
    3, b.floors, glassColor(light, hash2(b.origin.x, b.origin.y, 1)), "#5b7382",
  );
  drawWindowGrid(
    ctx,
    box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y,
    3, b.floors, glassColor(light, hash2(b.origin.x, b.origin.y, 2)), "#6a8494",
  );
  roofProps(ctx, box, light);
}

function drawSkyscraper(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const baseH = 36 + b.floors * 11;
  const left = lit(shade(b.wallColor, 0.82), light, "left");
  const right = lit(b.wallColor, light, "right");
  const roof = lit(b.roofColor, light, "top");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, 2, 2, baseH, left, right, roof, 8);
  drawWindowGrid(
    ctx,
    box.L.x, box.L.y, box.B.x, box.B.y, box.Be.x, box.Be.y, box.Le.x, box.Le.y,
    5, Math.min(b.floors, 16), glassColor(light, 0.33), "#4a6070",
  );
  drawWindowGrid(
    ctx,
    box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y,
    5, Math.min(b.floors, 16), glassColor(light, 0.41), "#587384",
  );

  const cap = drawIsoBox(
    ctx,
    b.origin.x + 0.28,
    b.origin.y + 0.28,
    1.4,
    1.4,
    baseH + 26,
    shade(left, 0.95),
    shade(right, 0.95),
    roof,
    0,
  );
  ctx.beginPath();
  ctx.strokeStyle = lit("#c5d0d6", light, "top");
  ctx.lineWidth = 2;
  ctx.moveTo(cap.Be.x, cap.Be.y);
  ctx.lineTo(cap.Be.x, cap.Be.y - 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = light.phase === "night" ? "#ff6b5a" : "#d0d6db";
  ctx.arc(cap.Be.x, cap.Be.y - 28, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHospital(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const h = 58;
  const left = lit(b.wallColor, light, "left");
  const right = lit(b.wallColor, light, "right");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, 3, 3, h, left, right, lit(b.roofColor, light, "top"), 8);
  drawWindowGrid(ctx, box.L.x, box.L.y, box.B.x, box.B.y, box.Be.x, box.Be.y, box.Le.x, box.Le.y, 6, 3, glassColor(light, 0.5), "#c9c2b8");
  drawWindowGrid(ctx, box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y, 6, 3, glassColor(light, 0.45), "#d2cbc0");

  ctx.save();
  ctx.fillStyle = lit(b.accentColor, light, "top");
  const c = box.Be;
  ctx.fillRect(c.x - 10, c.y - 8, 20, 6);
  ctx.fillRect(c.x - 3, c.y - 15, 6, 20);
  ctx.restore();
}

function drawSchool(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const h = 40;
  const left = lit(b.wallColor, light, "left");
  const right = lit(b.wallColor, light, "right");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, 3, 2, h, left, right, lit(b.roofColor, light, "top"), 8);
  drawWindowGrid(ctx, box.L.x, box.L.y, box.B.x, box.B.y, box.Be.x, box.Be.y, box.Le.x, box.Le.y, 5, 2, glassColor(light, 0.3), "#8a6a4a");
  drawWindowGrid(ctx, box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y, 6, 2, glassColor(light, 0.28), "#9a7854");
  drawSlopedRoof(ctx, box, lit(shade(b.roofColor, 0.75), light, "left"), lit(b.roofColor, light, "right"));
}

function drawCivic(ctx: CanvasRenderingContext2D, b: Building, light: Lighting, accent: string) {
  const h = 38;
  const left = lit(b.wallColor, light, "left");
  const right = lit(b.wallColor, light, "right");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, b.width, b.depth, h, left, right, lit(b.roofColor, light, "top"), 7);
  drawWindowGrid(ctx, box.L.x, box.L.y, box.B.x, box.B.y, box.Be.x, box.Be.y, box.Le.x, box.Le.y, 4, 2, glassColor(light, 0.4), "#8a96a4");
  drawWindowGrid(ctx, box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y, 4, 2, glassColor(light, 0.36), "#97a3b0");
  ctx.fillStyle = lit(accent, light, "top");
  ctx.fillRect(box.Te.x - 6, box.Te.y - 4, 18, 5);
}

function drawFirehouse(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  drawCivic(ctx, b, light, b.accentColor);
  const p = gridToScreen(b.origin.x + 0.6, b.origin.y);
  ctx.fillStyle = lit("#8f2a22", light, "right");
  ctx.fillRect(p.x + 18, p.y - 70, 7, 42);
}

function drawCityHall(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const h = 48;
  const left = lit(b.wallColor, light, "left");
  const right = lit(b.wallColor, light, "right");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, 2, 2, h, left, right, lit(b.roofColor, light, "top"), 8);
  drawWindowGrid(ctx, box.L.x, box.L.y, box.B.x, box.B.y, box.Be.x, box.Be.y, box.Le.x, box.Le.y, 4, 2, glassColor(light, 0.25), "#b9aa90");
  drawWindowGrid(ctx, box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y, 4, 2, glassColor(light, 0.22), "#c4b59a");
  ctx.beginPath();
  ctx.fillStyle = lit(b.roofColor, light, "top");
  ctx.ellipse(box.Be.x, box.Be.y - 8, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = lit(b.accentColor, light, "top");
  ctx.ellipse(box.Be.x, box.Be.y - 18, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPavilion(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const box = drawIsoBox(
    ctx,
    b.origin.x,
    b.origin.y,
    1,
    1,
    18,
    lit("#d9c4a0", light, "left"),
    lit("#e8d3b0", light, "right"),
    lit(b.roofColor, light, "top"),
    14,
  );
  drawSlopedRoof(ctx, box, lit(shade(b.roofColor, 0.75), light, "left"), lit(b.roofColor, light, "right"));
}

function roofProps(ctx: CanvasRenderingContext2D, box: ReturnType<typeof drawIsoBox>, light: Lighting) {
  ctx.fillStyle = lit("#6b7280", light, "right");
  ctx.fillRect(box.Be.x - 14, box.Be.y - 6, 9, 6);
  ctx.fillStyle = lit("#7b8490", light, "top");
  ctx.fillRect(box.Be.x + 4, box.Be.y - 5, 7, 5);
}

void TILE_W;
void TILE_H;
