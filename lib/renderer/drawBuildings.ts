import { TILE_H, TILE_W, diamondPoints, gridToScreen } from "@/lib/city/iso";
import { hash2 } from "@/lib/city/rng";
import type { Building } from "@/lib/city/types";
import { lodgingUse } from "@/lib/city/lodging";
import { paintGraffiti } from "./drawBridges";
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
    case "tower":
      drawTower(ctx, building, light);
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
    case "baseball_stadium":
      drawStadium(ctx, building, light);
      break;
    case "subway_station":
      drawSubwayStation(ctx, building, light);
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

/** Tags the street-facing base of older, low-rise stock. */
function tagStreetWall(
  ctx: CanvasRenderingContext2D,
  b: Building,
  box: ReturnType<typeof drawIsoBox>,
  light: Lighting,
) {
  const roll = hash2(b.origin.x, b.origin.y, 91);
  if (roll < 0.68) return;
  const hue = Math.floor(hash2(b.origin.y, b.origin.x, 12) * 360);
  const anchor = {
    x: (box.B.x + box.R.x) / 2 + 2,
    y: (box.B.y + box.R.y) / 2 - 7,
  };
  paintGraffiti(
    ctx,
    anchor,
    18,
    12,
    { variant: Math.floor(roll * 6), hue },
    light,
  );
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
  tagStreetWall(ctx, b, box, light);
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
  tagStreetWall(ctx, b, box, light);
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

/** Draws a stacked shaft with setbacks; shared by high-rises and landmarks. */
function drawStackedShaft(
  ctx: CanvasRenderingContext2D,
  b: Building,
  light: Lighting,
  stages: { inset: number; height: number; cols: number }[],
) {
  const left = lit(shade(b.wallColor, 0.82), light, "left");
  const right = lit(b.wallColor, light, "right");
  const roof = lit(b.roofColor, light, "top");
  let last = drawIsoBox(ctx, b.origin.x, b.origin.y, 2, 2, stages[0].height, left, right, roof, 8);

  stages.forEach((stage, i) => {
    const span = 2 - stage.inset * 2;
    const box =
      i === 0
        ? last
        : drawIsoBox(
            ctx,
            b.origin.x + stage.inset,
            b.origin.y + stage.inset,
            span,
            span,
            stage.height,
            shade(left, 1 - i * 0.04),
            shade(right, 1 - i * 0.03),
            roof,
            i === 0 ? 8 : 0,
          );

    const rows = Math.max(4, Math.round(stage.height / 12));
    drawWindowGrid(
      ctx,
      box.L.x, box.L.y, box.B.x, box.B.y, box.Be.x, box.Be.y, box.Le.x, box.Le.y,
      stage.cols, rows, glassColor(light, hash2(b.origin.x, b.origin.y + i, 3)), "#44586a",
    );
    drawWindowGrid(
      ctx,
      box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y,
      stage.cols, rows, glassColor(light, hash2(b.origin.y, b.origin.x + i, 7)), "#546b7d",
    );

    // Cornice band marking each setback.
    ctx.beginPath();
    ctx.moveTo(box.Le.x, box.Le.y);
    ctx.lineTo(box.Be.x, box.Be.y);
    ctx.lineTo(box.Re.x, box.Re.y);
    ctx.strokeStyle = alpha(lit(b.accentColor, light, "top"), 0.35);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    last = box;
  });

  return last;
}

function drawMast(
  ctx: CanvasRenderingContext2D,
  apex: { x: number; y: number },
  height: number,
  light: Lighting,
) {
  ctx.beginPath();
  ctx.strokeStyle = lit("#c5d0d6", light, "top");
  ctx.lineWidth = 2;
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(apex.x, apex.y - height);
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = light.phase === "night" ? "#ff6b5a" : "#d0d6db";
  ctx.arc(apex.x, apex.y - height, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSkyscraper(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const baseH = 40 + b.floors * 9;
  const cap = drawStackedShaft(ctx, b, light, [
    { inset: 0, height: baseH, cols: 5 },
    { inset: 0.3, height: baseH + b.floors * 3.4, cols: 4 },
  ]);
  drawMast(ctx, cap.Be, 26, light);
  drawLodgingPlaque(ctx, b, cap.B, light);
}

function drawTower(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const podium = 54;
  const shaft = podium + b.floors * 7.6;
  const crown = shaft + b.floors * 2.2;

  const cap = drawStackedShaft(ctx, b, light, [
    { inset: 0, height: podium, cols: 6 },
    { inset: 0.18, height: shaft, cols: 5 },
    { inset: 0.42, height: crown, cols: 3 },
  ]);

  // Observation deck ring just below the crown.
  ctx.beginPath();
  ctx.moveTo(cap.Le.x, cap.Le.y + 14);
  ctx.lineTo(cap.Be.x, cap.Be.y + 20);
  ctx.lineTo(cap.Re.x, cap.Re.y + 14);
  ctx.strokeStyle = alpha(
    light.phase === "night" ? "#ffe9a8" : lit("#dfe9f0", light, "top"),
    0.8,
  );
  ctx.lineWidth = 3.2;
  ctx.stroke();

  drawMast(ctx, cap.Be, 54, light);

  // Aircraft warning lights up the spire.
  if (light.phase === "night" || light.phase === "dusk") {
    for (const t of [0.34, 0.68]) {
      ctx.beginPath();
      ctx.fillStyle = alpha("#ff6b5a", 0.85);
      ctx.arc(cap.Be.x, cap.Be.y - 54 * t, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawLodgingPlaque(ctx, b, cap.B, light);
}

function drawLodgingPlaque(
  ctx: CanvasRenderingContext2D,
  b: Building,
  face: { x: number; y: number },
  light: Lighting,
) {
  const use = lodgingUse(b);
  if (!use) return;
  const hotel = use === "hotel";
  ctx.fillStyle = lit(hotel ? "#c9a44c" : "#8a5a3a", light, "right");
  ctx.fillRect(face.x - 26, face.y - 36, 52, 12);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "bold 7px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(hotel ? "HOTEL" : "RESIDENCES", face.x, face.y - 27);
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

function drawSubwayStation(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const h = 22;
  const glass = glassColor(light, 0.55);
  const left = lit("#b7c4cc", light, "left");
  const right = lit("#9aabb6", light, "right");
  const box = drawIsoBox(ctx, b.origin.x, b.origin.y, 1, 1, h, left, right, lit("#1a1c20", light, "top"), 8);
  drawWindowGrid(ctx, box.B.x, box.B.y, box.R.x, box.R.y, box.Re.x, box.Re.y, box.Be.x, box.Be.y, 2, 1, glass, "#6a7882");
  ctx.fillStyle = lit(b.accentColor, light, "top");
  ctx.fillRect(box.Be.x - 10, box.Be.y - 28, 20, 8);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("M", box.Be.x, box.Be.y - 22);
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

type IsoPt = { x: number; y: number };

function quadPt(Te: IsoPt, Re: IsoPt, Be: IsoPt, Le: IsoPt, u: number, v: number): IsoPt {
  const ax = Te.x + (Re.x - Te.x) * u;
  const ay = Te.y + (Re.y - Te.y) * u;
  const bx = Le.x + (Be.x - Le.x) * u;
  const by = Le.y + (Be.y - Le.y) * u;
  return { x: ax + (bx - ax) * v, y: ay + (by - ay) * v };
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: IsoPt[], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawStadium(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const building = b.constructionLeft && b.constructionLeft > 0;
  const brick = building ? "#9a8f7a" : "#8a5340";

  const facade = drawIsoBox(
    ctx,
    b.origin.x,
    b.origin.y,
    b.width,
    b.depth,
    28,
    lit(shade(brick, 0.68), light, "left"),
    lit(brick, light, "right"),
    lit("#3d2a22", light, "top"),
    6,
  );

  const bowl = drawIsoBox(
    ctx,
    b.origin.x + 0.18,
    b.origin.y + 0.14,
    b.width - 0.36,
    b.depth - 0.28,
    34,
    lit("#1e4a2c", light, "left"),
    lit("#2a5d38", light, "right"),
    lit("#1f4d2e", light, "top"),
    8,
  );

  const { Te, Re, Be, Le } = bowl;
  const p = (u: number, v: number) => quadPt(Te, Re, Be, Le, u, v);

  // Jewel-box seating is the forest-green top; the field is a fan cut out of it.
  const field = [
    p(0.5, 0.86),
    p(0.78, 0.62),
    p(0.9, 0.36),
    p(0.84, 0.16),
    p(0.66, 0.08),
    p(0.5, 0.06),
    p(0.34, 0.08),
    p(0.16, 0.16),
    p(0.1, 0.36),
    p(0.22, 0.62),
  ];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(field[0].x, field[0].y);
  for (const pt of field.slice(1)) ctx.lineTo(pt.x, pt.y);
  ctx.closePath();
  ctx.clip();

  const grassA = lit("#3aa14a", light, "ground");
  const grassB = lit("#2d7d3a", light, "ground");
  for (let i = 0; i < 11; i++) {
    const u0 = i / 11;
    const u1 = (i + 1) / 11;
    fillPoly(ctx, [p(u0, 0.02), p(u1, 0.02), p(u1, 0.9), p(u0, 0.9)], i % 2 === 0 ? grassA : grassB);
  }

  const dirt = lit("#c45a32", light, "ground");
  ctx.beginPath();
  ctx.moveTo(field[0].x, field[0].y);
  for (const pt of field.slice(1)) ctx.lineTo(pt.x, pt.y);
  ctx.closePath();
  ctx.strokeStyle = dirt;
  ctx.lineWidth = 5;
  ctx.stroke();
  const dirtLite = lit("#d47a48", light, "top");
  fillPoly(
    ctx,
    [p(0.5, 0.78), p(0.7, 0.56), p(0.5, 0.36), p(0.3, 0.56)],
    dirt,
  );
  fillPoly(
    ctx,
    [p(0.5, 0.7), p(0.62, 0.56), p(0.5, 0.44), p(0.38, 0.56)],
    lit("#348a40", light, "ground"),
  );

  ctx.strokeStyle = dirt;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(p(0.5, 0.7).x, p(0.5, 0.7).y);
  ctx.lineTo(p(0.62, 0.56).x, p(0.62, 0.56).y);
  ctx.lineTo(p(0.5, 0.44).x, p(0.5, 0.44).y);
  ctx.lineTo(p(0.38, 0.56).x, p(0.38, 0.56).y);
  ctx.closePath();
  ctx.stroke();

  const home = p(0.5, 0.78);
  ctx.beginPath();
  ctx.ellipse(home.x, home.y, 7, 3.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = dirt;
  ctx.fill();

  const mound = p(0.5, 0.56);
  ctx.beginPath();
  ctx.ellipse(mound.x, mound.y, 4.2, 2.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = dirtLite;
  ctx.fill();

  ctx.fillStyle = lit("#f4f1ea", light, "top");
  for (const base of [p(0.5, 0.78), p(0.7, 0.56), p(0.5, 0.36), p(0.3, 0.56)]) {
    ctx.fillRect(base.x - 2, base.y - 1.3, 4, 2.5);
  }

  ctx.strokeStyle = lit("#f2eee6", light, "top");
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(home.x, home.y);
  ctx.lineTo(p(0.86, 0.2).x, p(0.86, 0.2).y);
  ctx.moveTo(home.x, home.y);
  ctx.lineTo(p(0.14, 0.2).x, p(0.14, 0.2).y);
  ctx.stroke();

  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(field[0].x, field[0].y);
  for (const pt of field.slice(1)) ctx.lineTo(pt.x, pt.y);
  ctx.closePath();
  ctx.strokeStyle = lit("#6a3a28", light, "ground");
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = lit("#1a3f24", light, "top");
  ctx.lineWidth = 3.6;
  ctx.stroke();

  const roofBand = [
    [p(0.04, 0.88), p(0.96, 0.88), p(0.92, 0.99), p(0.08, 0.99)],
    [p(0.02, 0.32), p(0.12, 0.36), p(0.12, 0.88), p(0.02, 0.92)],
    [p(0.98, 0.32), p(0.98, 0.92), p(0.88, 0.88), p(0.88, 0.36)],
  ];
  for (const band of roofBand) {
    fillPoly(ctx, band, lit("#2a2d2c", light, "top"));
  }

  const cf = p(0.5, 0.07);
  ctx.fillStyle = lit("#14301c", light, "right");
  ctx.fillRect(cf.x - 12, cf.y - 24, 24, 18);
  ctx.fillStyle = lit("#c0392b", light, "top");
  ctx.fillRect(cf.x - 12, cf.y - 24, 24, 3);
  ctx.fillStyle = lit("#1a1a1a", light, "top");
  ctx.beginPath();
  ctx.arc(cf.x, cf.y - 24, 3.2, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#e8c36a";
  ctx.font = "bold 6px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RAVENS", cf.x, cf.y - 13);

  const towers: IsoPt[] = [p(0.1, 0.9), p(0.9, 0.9), p(0.06, 0.52), p(0.94, 0.52)];
  for (const tower of towers) {
    ctx.strokeStyle = lit("#e8eef2", light, "right");
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y + 4);
    ctx.lineTo(tower.x, tower.y - 22);
    ctx.moveTo(tower.x - 5, tower.y - 6);
    ctx.lineTo(tower.x, tower.y - 22);
    ctx.lineTo(tower.x + 5, tower.y - 6);
    ctx.moveTo(tower.x - 4, tower.y - 12);
    ctx.lineTo(tower.x + 4, tower.y - 12);
    ctx.stroke();
    ctx.fillStyle = light.phase === "night" ? "#ffe08a" : lit("#f7f4ea", light, "top");
    ctx.fillRect(tower.x - 6, tower.y - 26, 12, 5);
  }

  ctx.fillStyle = lit("#c0392b", light, "right");
  ctx.fillRect(facade.B.x - 22, facade.B.y - 32, 44, 12);
  ctx.fillStyle = "#f4f7fb";
  ctx.font = "bold 8px sans-serif";
  ctx.fillText("RAVENS", facade.B.x, facade.B.y - 23);

  if (building) {
    ctx.fillStyle = alpha("#c9a227", 0.85);
    ctx.fillRect(bowl.Be.x - 22, bowl.Be.y - 8, 44, 11);
    ctx.fillStyle = "#1a1206";
    ctx.font = "bold 8px sans-serif";
    ctx.fillText("UNDER CONSTRUCTION", bowl.Be.x, bowl.Be.y);
  }
}

function roofProps(ctx: CanvasRenderingContext2D, box: ReturnType<typeof drawIsoBox>, light: Lighting) {
  ctx.fillStyle = lit("#6b7280", light, "right");
  ctx.fillRect(box.Be.x - 14, box.Be.y - 6, 9, 6);
  ctx.fillStyle = lit("#7b8490", light, "top");
  ctx.fillRect(box.Be.x + 4, box.Be.y - 5, 7, 5);
}

void TILE_W;
void TILE_H;
