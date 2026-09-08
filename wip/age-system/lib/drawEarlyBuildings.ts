import { TILE_H, TILE_W, gridToScreen } from "@/lib/city/iso";
import { hash2 } from "@/lib/city/rng";
import type { Building } from "@/lib/city/types";
import { drawIsoBox, drawSlopedRoof } from "./drawIso";
import { alpha, lit, mix, shade, type Lighting } from "./palette";

type P = { x: number; y: number };

/** Screen-space centre of a building footprint, at ground level. */
function center(b: Building): P {
  const p = gridToScreen(b.origin.x + (b.width - 1) / 2, b.origin.y + (b.depth - 1) / 2);
  return { x: p.x, y: p.y + TILE_H / 2 };
}

function poly(ctx: CanvasRenderingContext2D, pts: P[], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// ─── Stone Age ──────────────────────────────────────────────────────────────

export function drawCave(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const c = center(b);
  const rock = b.wallColor;

  // A boulder mass built from three overlapping domes.
  const lobes = [
    { dx: -12, dy: 2, rx: 20, ry: 15, tone: 0.78 },
    { dx: 13, dy: 4, rx: 17, ry: 12, tone: 0.9 },
    { dx: 0, dy: -6, rx: 24, ry: 20, tone: 1 },
  ];
  for (const lobe of lobes) {
    ellipse(
      ctx,
      c.x + lobe.dx,
      c.y + lobe.dy - 8,
      lobe.rx,
      lobe.ry,
      lit(shade(rock, lobe.tone), light, "top"),
    );
  }

  // Shaded underside so the mass reads as three-dimensional.
  ellipse(ctx, c.x + 2, c.y + 2, 26, 11, alpha(shade(rock, 0.62), 0.85));

  // The mouth of the cave.
  ctx.beginPath();
  ctx.moveTo(c.x - 11, c.y + 2);
  ctx.quadraticCurveTo(c.x, c.y - 22, c.x + 11, c.y + 2);
  ctx.closePath();
  ctx.fillStyle = "#241f1a";
  ctx.fill();

  // Firelight spilling out after dark.
  if (light.phase === "night" || light.phase === "dusk") {
    ctx.beginPath();
    ctx.moveTo(c.x - 7, c.y + 1);
    ctx.quadraticCurveTo(c.x, c.y - 13, c.x + 7, c.y + 1);
    ctx.closePath();
    ctx.fillStyle = alpha("#ff9a3c", 0.45);
    ctx.fill();
  }

  // Hand prints daubed beside the entrance.
  ctx.fillStyle = alpha("#b4553a", 0.55);
  for (let i = 0; i < 3; i++) {
    const n = hash2(b.origin.x, b.origin.y + i, 7);
    ctx.beginPath();
    ctx.arc(c.x + 15 + i * 2, c.y - 12 - n * 8, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCampfire(
  ctx: CanvasRenderingContext2D,
  b: Building,
  light: Lighting,
  time: number,
) {
  const c = center(b);

  // Ring of stones.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ellipse(
      ctx,
      c.x + Math.cos(a) * 17,
      c.y + Math.sin(a) * 9,
      4,
      3,
      lit(i % 2 ? "#8d8579" : "#7a7369", light, "top"),
    );
  }

  // Crossed logs.
  ctx.strokeStyle = lit("#6b4a32", light, "right");
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  for (const a of [0.4, 2.2, 4.1]) {
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(a) * 10, c.y + Math.sin(a) * 5);
    ctx.lineTo(c.x - Math.cos(a) * 10, c.y - Math.sin(a) * 5 - 3);
    ctx.stroke();
  }

  const flicker = 0.75 + 0.25 * Math.sin(time * 6.1) + 0.1 * Math.sin(time * 11.3);
  const h = 16 * flicker;

  // Glow pool on the ground.
  const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 46);
  glow.addColorStop(0, alpha("#ffb457", light.phase === "night" ? 0.5 : 0.22));
  glow.addColorStop(1, alpha("#ff9a3c", 0));
  ctx.fillStyle = glow;
  ctx.fillRect(c.x - 46, c.y - 46, 92, 92);

  poly(
    ctx,
    [
      { x: c.x - 7, y: c.y - 1 },
      { x: c.x, y: c.y - h - 6 },
      { x: c.x + 7, y: c.y - 1 },
    ],
    alpha("#ff7a2f", 0.9),
  );
  poly(
    ctx,
    [
      { x: c.x - 4, y: c.y - 1 },
      { x: c.x + 1, y: c.y - h },
      { x: c.x + 4, y: c.y - 1 },
    ],
    alpha("#ffd76a", 0.95),
  );
}

export function drawTent(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const c = center(b);
  const hide = b.wallColor;

  poly(
    ctx,
    [
      { x: c.x, y: c.y - 34 },
      { x: c.x + 20, y: c.y + 4 },
      { x: c.x - 20, y: c.y + 4 },
    ],
    lit(hide, light, "left"),
  );
  poly(
    ctx,
    [
      { x: c.x, y: c.y - 34 },
      { x: c.x + 20, y: c.y + 4 },
      { x: c.x + 4, y: c.y + 6 },
    ],
    lit(shade(hide, 0.82), light, "right"),
  );

  // Doorway flap.
  poly(
    ctx,
    [
      { x: c.x - 2, y: c.y - 18 },
      { x: c.x + 7, y: c.y + 4 },
      { x: c.x - 9, y: c.y + 4 },
    ],
    "#2b231c",
  );

  // Support poles crossing at the peak.
  ctx.strokeStyle = lit("#6b5236", light, "top");
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(c.x - 5, c.y - 40);
  ctx.lineTo(c.x + 3, c.y - 26);
  ctx.moveTo(c.x + 6, c.y - 40);
  ctx.lineTo(c.x - 2, c.y - 26);
  ctx.stroke();

  // Totem charm hanging at the apex.
  ellipse(ctx, c.x + 0.5, c.y - 30, 2.6, 3.4, lit(b.accentColor, light, "top"));
}

export function drawGatherCamp(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const c = center(b);
  const wood = b.wallColor;

  // Drying rack: two uprights and a crossbar.
  ctx.strokeStyle = lit(shade(wood, 0.7), light, "right");
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(c.x - 16, c.y + 3);
  ctx.lineTo(c.x - 14, c.y - 26);
  ctx.moveTo(c.x + 16, c.y - 1);
  ctx.lineTo(c.x + 14, c.y - 30);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(c.x - 14, c.y - 26);
  ctx.lineTo(c.x + 14, c.y - 30);
  ctx.stroke();

  // Hides and stores hanging from the bar.
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4;
    const x = c.x - 14 + 28 * t;
    const y = c.y - 26 - 4 * t;
    const n = hash2(b.origin.x + i, b.origin.y, 3);
    poly(
      ctx,
      [
        { x: x - 4, y },
        { x: x + 4, y: y + 1 },
        { x: x + 3, y: y + 12 + n * 5 },
        { x: x - 3, y: y + 12 + n * 5 },
      ],
      lit(mix(b.accentColor, "#7a5a3e", n * 0.6), light, "left"),
    );
  }

  // Stacked goods at the base.
  for (let i = 0; i < 3; i++) {
    ellipse(
      ctx,
      c.x - 6 + i * 9,
      c.y + 4 - i * 1.5,
      6,
      3.4,
      lit(shade(wood, 0.86 - i * 0.06), light, "top"),
    );
  }
}

// ─── Agricultural Age ───────────────────────────────────────────────────────

export function drawHut(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const box = drawIsoBox(
    ctx,
    b.origin.x,
    b.origin.y,
    b.width,
    b.depth,
    16,
    lit(shade(b.wallColor, 0.78), light, "left"),
    lit(b.wallColor, light, "right"),
    lit(shade(b.wallColor, 0.9), light, "top"),
    12,
  );

  // Conical thatch, drawn as a shallow cone rather than a pitched roof.
  const apex = {
    x: (box.Te.x + box.Be.x) / 2,
    y: (box.Te.y + box.Be.y) / 2 - 26,
  };
  const thatch = lit(b.roofColor, light, "right");
  poly(ctx, [box.Te, box.Re, apex], thatch);
  poly(ctx, [box.Re, box.Be, apex], lit(shade(b.roofColor, 0.86), light, "right"));
  poly(ctx, [box.Be, box.Le, apex], lit(shade(b.roofColor, 0.74), light, "left"));
  poly(ctx, [box.Le, box.Te, apex], lit(shade(b.roofColor, 0.8), light, "left"));

  // Thatch texture lines running to the apex.
  ctx.strokeStyle = alpha(shade(b.roofColor, 0.6), 0.4);
  ctx.lineWidth = 0.8;
  for (const corner of [box.Te, box.Re, box.Be, box.Le]) {
    for (const t of [0.3, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y);
      ctx.lineTo(apex.x + (corner.x - apex.x) * (0.5 + t * 0.5), apex.y + (corner.y - apex.y) * (0.5 + t * 0.5));
      ctx.stroke();
    }
  }

  // Doorway on the right face.
  const door = {
    x: (box.R.x + box.B.x) / 2,
    y: (box.R.y + box.B.y) / 2,
  };
  poly(
    ctx,
    [
      { x: door.x - 4, y: door.y - 2 },
      { x: door.x + 4, y: door.y + 2 },
      { x: door.x + 4, y: door.y - 11 },
      { x: door.x - 4, y: door.y - 15 },
    ],
    "#2b231c",
  );
}

export function drawFarm(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const p = gridToScreen(b.origin.x, b.origin.y);
  const cx = p.x;
  const cy = p.y + TILE_H / 2;

  // Tilled soil on the tile diamond.
  poly(
    ctx,
    [
      { x: cx, y: cy - TILE_H / 2 },
      { x: cx + TILE_W / 2, y: cy },
      { x: cx, y: cy + TILE_H / 2 },
      { x: cx - TILE_W / 2, y: cy },
    ],
    lit("#6b5232", light, "ground"),
  );

  // Furrows of grain, drawn as parallel lines across the tile diamond.
  const west = { x: cx - TILE_W / 2, y: cy };
  const north = { x: cx, y: cy - TILE_H / 2 };
  const south = { x: cx, y: cy + TILE_H / 2 };
  const east = { x: cx + TILE_W / 2, y: cy };

  const rows = 7;
  ctx.lineWidth = 2.6;
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    ctx.beginPath();
    ctx.moveTo(west.x + (north.x - west.x) * t, west.y + (north.y - west.y) * t);
    ctx.lineTo(south.x + (east.x - south.x) * t, south.y + (east.y - south.y) * t);
    ctx.strokeStyle = alpha(lit(b.wallColor, light, "ground"), 0.85);
    ctx.stroke();
  }

  // Sheaves standing at the field edge.
  for (let i = 0; i < 3; i++) {
    const sx = cx - 14 + i * 14;
    const sy = cy + 4 - i * 2;
    poly(
      ctx,
      [
        { x: sx, y: sy - 14 },
        { x: sx + 5, y: sy + 1 },
        { x: sx - 5, y: sy + 1 },
      ],
      lit("#dcc27a", light, "top"),
    );
  }
}

export function drawPasture(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const p = gridToScreen(b.origin.x, b.origin.y);
  const cx = p.x;
  const cy = p.y + TILE_H / 2;

  poly(
    ctx,
    [
      { x: cx, y: cy - TILE_H / 2 },
      { x: cx + TILE_W / 2, y: cy },
      { x: cx, y: cy + TILE_H / 2 },
      { x: cx - TILE_W / 2, y: cy },
    ],
    lit("#8fae63", light, "ground"),
  );

  // Post-and-rail fence around the diamond.
  const corners = [
    { x: cx, y: cy - TILE_H / 2 },
    { x: cx + TILE_W / 2, y: cy },
    { x: cx, y: cy + TILE_H / 2 },
    { x: cx - TILE_W / 2, y: cy },
  ];
  ctx.strokeStyle = lit("#6b5236", light, "right");
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const c2 = corners[(i + 1) % 4];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 8);
    ctx.lineTo(c2.x, c2.y - 8);
    ctx.stroke();
    for (let s = 0; s <= 3; s++) {
      const t = s / 3;
      const px = a.x + (c2.x - a.x) * t;
      const py = a.y + (c2.y - a.y) * t;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 9);
      ctx.stroke();
    }
  }

  // A couple of grazing animals.
  for (let i = 0; i < 2; i++) {
    const ax = cx - 8 + i * 18;
    const ay = cy - 2 + i * 6;
    ellipse(ctx, ax, ay - 6, 7, 4.2, lit("#e8e2d6", light, "top"));
    ellipse(ctx, ax + 6, ay - 9, 3, 2.6, lit("#3a3128", light, "top"));
    ctx.strokeStyle = lit("#4a4036", light, "right");
    ctx.lineWidth = 1.2;
    for (const dx of [-4, 3]) {
      ctx.beginPath();
      ctx.moveTo(ax + dx, ay - 3);
      ctx.lineTo(ax + dx, ay + 2);
      ctx.stroke();
    }
  }
}

export function drawWell(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const c = center(b);

  // Stone drum.
  ellipse(ctx, c.x, c.y - 6, 14, 8, lit(shade(b.wallColor, 0.7), light, "left"));
  poly(
    ctx,
    [
      { x: c.x - 14, y: c.y - 6 },
      { x: c.x + 14, y: c.y - 6 },
      { x: c.x + 14, y: c.y - 14 },
      { x: c.x - 14, y: c.y - 14 },
    ],
    lit(b.wallColor, light, "right"),
  );
  ellipse(ctx, c.x, c.y - 14, 14, 8, lit(shade(b.wallColor, 1.05), light, "top"));
  ellipse(ctx, c.x, c.y - 14, 9, 5, "#1d2b33");
  ellipse(ctx, c.x, c.y - 13, 7, 3.6, alpha(b.accentColor, 0.7));

  // Roof on two posts.
  ctx.strokeStyle = lit("#6b5236", light, "right");
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(c.x - 11, c.y - 14);
  ctx.lineTo(c.x - 11, c.y - 34);
  ctx.moveTo(c.x + 11, c.y - 14);
  ctx.lineTo(c.x + 11, c.y - 34);
  ctx.stroke();

  poly(
    ctx,
    [
      { x: c.x - 15, y: c.y - 33 },
      { x: c.x, y: c.y - 44 },
      { x: c.x + 15, y: c.y - 33 },
    ],
    lit("#7c5f3a", light, "right"),
  );
}

export function drawGranary(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const box = drawIsoBox(
    ctx,
    b.origin.x,
    b.origin.y,
    b.width,
    b.depth,
    22,
    lit(shade(b.wallColor, 0.76), light, "left"),
    lit(b.wallColor, light, "right"),
    lit(shade(b.wallColor, 0.92), light, "top"),
    13,
  );
  drawSlopedRoof(
    ctx,
    box,
    lit(shade(b.roofColor, 0.8), light, "left"),
    lit(b.roofColor, light, "right"),
    "x",
  );

  // Raised on staddle stones to keep the grain dry.
  ctx.fillStyle = lit(shade(b.accentColor, 0.8), light, "right");
  for (const corner of [box.L, box.B, box.R]) {
    ctx.fillRect(corner.x - 2, corner.y - 4, 4, 5);
  }

  // Loading hatch.
  const face = { x: (box.R.x + box.B.x) / 2, y: (box.R.y + box.B.y) / 2 };
  poly(
    ctx,
    [
      { x: face.x - 4, y: face.y - 8 },
      { x: face.x + 4, y: face.y - 4 },
      { x: face.x + 4, y: face.y - 14 },
      { x: face.x - 4, y: face.y - 18 },
    ],
    "#3a2c1e",
  );
}

export function drawStall(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const c = center(b);

  // Trestle table.
  poly(
    ctx,
    [
      { x: c.x - 20, y: c.y - 8 },
      { x: c.x, y: c.y - 17 },
      { x: c.x + 20, y: c.y - 8 },
      { x: c.x, y: c.y + 1 },
    ],
    lit("#a8845a", light, "top"),
  );

  // Goods heaped on it.
  const hues = ["#c0392b", "#d68910", "#7d8c3a", "#8e5a2b"];
  for (let i = 0; i < 5; i++) {
    const n = hash2(b.origin.x + i, b.origin.y, 11);
    ellipse(
      ctx,
      c.x - 12 + i * 6,
      c.y - 11 + (i % 2) * 3,
      3.4,
      2.4,
      lit(hues[i % hues.length], light, "top"),
    );
    void n;
  }

  // Striped awning on four poles.
  ctx.strokeStyle = lit("#6b5236", light, "right");
  ctx.lineWidth = 1.8;
  for (const [dx, dy] of [
    [-19, -8],
    [19, -8],
    [0, -17],
    [0, 1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(c.x + dx, c.y + dy);
    ctx.lineTo(c.x + dx, c.y + dy - 24);
    ctx.stroke();
  }

  const canopy = [
    { x: c.x - 19, y: c.y - 32 },
    { x: c.x, y: c.y - 41 },
    { x: c.x + 19, y: c.y - 32 },
    { x: c.x, y: c.y - 23 },
  ];
  poly(ctx, canopy, lit(b.roofColor, light, "top"));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(canopy[0].x, canopy[0].y);
  for (const pt of canopy.slice(1)) ctx.lineTo(pt.x, pt.y);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = alpha(lit(b.wallColor, light, "top"), 0.85);
  for (let i = -2; i < 5; i++) {
    ctx.fillRect(c.x - 20 + i * 9, c.y - 44, 4.5, 26);
  }
  ctx.restore();
}

// ─── Ancient Age ────────────────────────────────────────────────────────────

export function drawStoneHouse(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const box = drawIsoBox(
    ctx,
    b.origin.x,
    b.origin.y,
    b.width,
    b.depth,
    26,
    lit(shade(b.wallColor, 0.74), light, "left"),
    lit(b.wallColor, light, "right"),
    lit(shade(b.wallColor, 0.9), light, "top"),
    10,
  );
  drawSlopedRoof(
    ctx,
    box,
    lit(shade(b.roofColor, 0.82), light, "left"),
    lit(b.roofColor, light, "right"),
    "y",
  );

  // Roof tile courses.
  ctx.strokeStyle = alpha(shade(b.roofColor, 0.6), 0.45);
  ctx.lineWidth = 0.7;
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(box.Te.x + (box.Le.x - box.Te.x) * t, box.Te.y + (box.Le.y - box.Te.y) * t - 10 * t);
    ctx.lineTo(box.Re.x + (box.Be.x - box.Re.x) * t, box.Re.y + (box.Be.y - box.Re.y) * t - 10 * t);
    ctx.stroke();
  }

  // Shuttered openings and a stone door.
  const rightFace = { x: (box.R.x + box.B.x) / 2, y: (box.R.y + box.B.y) / 2 };
  poly(
    ctx,
    [
      { x: rightFace.x - 4, y: rightFace.y - 3 },
      { x: rightFace.x + 4, y: rightFace.y + 1 },
      { x: rightFace.x + 4, y: rightFace.y - 13 },
      { x: rightFace.x - 4, y: rightFace.y - 17 },
    ],
    lit(shade(b.accentColor, 0.7), light, "right"),
  );

  const leftFace = { x: (box.L.x + box.B.x) / 2, y: (box.L.y + box.B.y) / 2 };
  ctx.fillStyle = light.phase === "night" ? alpha("#ffcb72", 0.75) : "#2f2a22";
  ctx.fillRect(leftFace.x - 3, leftFace.y - 18, 5, 6);

  // Coursed masonry hint on the sunlit wall.
  ctx.strokeStyle = alpha(shade(b.wallColor, 0.72), 0.35);
  ctx.lineWidth = 0.6;
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(box.R.x, box.R.y - box.lift * t);
    ctx.lineTo(box.B.x, box.B.y - box.lift * t);
    ctx.stroke();
  }
}

function columnRow(
  ctx: CanvasRenderingContext2D,
  a: P,
  bp: P,
  height: number,
  count: number,
  light: Lighting,
  color: string,
) {
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const x = a.x + (bp.x - a.x) * t;
    const y = a.y + (bp.y - a.y) * t;
    ctx.fillStyle = lit(color, light, "right");
    ctx.fillRect(x - 2, y - height, 4, height);
    ctx.fillStyle = lit(shade(color, 1.08), light, "top");
    ctx.fillRect(x - 3, y - height - 2.5, 6, 2.5);
    ctx.fillRect(x - 3, y - 2, 6, 2);
  }
}

export function drawTemple(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  // Stepped stylobate.
  const base = drawIsoBox(
    ctx,
    b.origin.x,
    b.origin.y,
    b.width,
    b.depth,
    10,
    lit(shade(b.wallColor, 0.72), light, "left"),
    lit(shade(b.wallColor, 0.86), light, "right"),
    lit(shade(b.wallColor, 1.02), light, "top"),
    6,
  );

  const colH = 30;
  columnRow(ctx, base.Le, base.Be, colH, 3, light, b.wallColor);
  columnRow(ctx, base.Be, base.Re, colH, 3, light, b.wallColor);

  // Entablature and pitched roof above the colonnade.
  const roofBase = {
    Te: { x: base.Te.x, y: base.Te.y - colH - 3 },
    Re: { x: base.Re.x, y: base.Re.y - colH - 3 },
    Be: { x: base.Be.x, y: base.Be.y - colH - 3 },
    Le: { x: base.Le.x, y: base.Le.y - colH - 3 },
    T: base.T,
    R: base.R,
    B: base.B,
    L: base.L,
    lift: colH,
  };
  poly(
    ctx,
    [roofBase.Te, roofBase.Re, roofBase.Be, roofBase.Le],
    lit(shade(b.wallColor, 0.95), light, "top"),
  );
  drawSlopedRoof(
    ctx,
    roofBase as ReturnType<typeof drawIsoBox>,
    lit(shade(b.roofColor, 0.8), light, "left"),
    lit(b.roofColor, light, "right"),
    "x",
  );

  // Gilded pediment ornament.
  const apex = {
    x: (roofBase.Re.x + roofBase.Be.x) / 2,
    y: (roofBase.Re.y + roofBase.Be.y) / 2 - 10,
  };
  ellipse(ctx, apex.x, apex.y - 2, 4, 4, lit(b.accentColor, light, "top"));

  // Brazier glow at the steps after dark.
  if (light.phase === "night" || light.phase === "dusk") {
    const glow = ctx.createRadialGradient(base.B.x, base.B.y, 1, base.B.x, base.B.y, 34);
    glow.addColorStop(0, alpha("#ffb457", 0.4));
    glow.addColorStop(1, alpha("#ffb457", 0));
    ctx.fillStyle = glow;
    ctx.fillRect(base.B.x - 34, base.B.y - 34, 68, 68);
  }
}

export function drawArena(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const c = center(b);
  const rx = 12 + b.width * 13;
  const ry = 8 + b.depth * 8;
  const wallH = 26;

  // Outer wall as an extruded ellipse.
  ellipse(ctx, c.x, c.y - 6, rx, ry, lit(shade(b.wallColor, 0.7), light, "left"));
  ctx.beginPath();
  ctx.moveTo(c.x - rx, c.y - 6);
  ctx.lineTo(c.x - rx, c.y - 6 - wallH);
  ctx.ellipse(c.x, c.y - 6 - wallH, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(c.x + rx, c.y - 6);
  ctx.ellipse(c.x, c.y - 6, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = lit(b.wallColor, light, "right");
  ctx.fill();

  // Arcade openings around the facade.
  const arches = 12;
  for (let i = 0; i <= arches; i++) {
    const a = Math.PI * (i / arches);
    const x = c.x - Math.cos(a) * rx * 0.94;
    const y = c.y - 6 + Math.sin(a) * ry * 0.94;
    if (y < c.y - 8) continue;
    ctx.beginPath();
    ctx.ellipse(x, y - wallH * 0.45, 3, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = alpha("#3b332a", 0.8);
    ctx.fill();
  }

  // Sunken sand floor.
  ellipse(ctx, c.x, c.y - 6 - wallH, rx * 0.98, ry * 0.98, lit(shade(b.wallColor, 1.04), light, "top"));
  ellipse(ctx, c.x, c.y - 4 - wallH, rx * 0.72, ry * 0.66, lit("#d9c08a", light, "ground"));

  // Banner poles on the rim.
  for (const side of [-1, 1]) {
    const px = c.x + side * rx * 0.8;
    const py = c.y - 10 - wallH;
    ctx.strokeStyle = lit("#6b5236", light, "right");
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 14);
    ctx.stroke();
    poly(
      ctx,
      [
        { x: px, y: py - 14 },
        { x: px + side * 8, y: py - 11 },
        { x: px, y: py - 7 },
      ],
      lit(b.accentColor, light, "top"),
    );
  }
}

export function drawHarbor(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const box = drawIsoBox(
    ctx,
    b.origin.x,
    b.origin.y,
    b.width,
    b.depth,
    20,
    lit(shade(b.wallColor, 0.74), light, "left"),
    lit(b.wallColor, light, "right"),
    lit(shade(b.wallColor, 0.9), light, "top"),
    10,
  );
  drawSlopedRoof(
    ctx,
    box,
    lit(shade(b.roofColor, 0.8), light, "left"),
    lit(b.roofColor, light, "right"),
    "x",
  );

  const c = center(b);

  // Crane arm reaching over the water.
  ctx.strokeStyle = lit("#6b5238", light, "right");
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(c.x + 14, c.y - 2);
  ctx.lineTo(c.x + 12, c.y - 34);
  ctx.lineTo(c.x + 34, c.y - 28);
  ctx.stroke();

  ctx.strokeStyle = alpha(lit("#d8cbb0", light, "top"), 0.8);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(c.x + 34, c.y - 28);
  ctx.lineTo(c.x + 34, c.y - 14);
  ctx.stroke();
  ctx.fillStyle = lit("#8a6a44", light, "right");
  ctx.fillRect(c.x + 30, c.y - 14, 8, 6);

  // Amphorae stacked on the quay.
  for (let i = 0; i < 4; i++) {
    const n = hash2(b.origin.x, b.origin.y + i, 5);
    ellipse(
      ctx,
      c.x - 22 + i * 7,
      c.y + 2 - (i % 2) * 4,
      3.2,
      4.6,
      lit(mix("#a5643c", "#7d4a2c", n), light, "right"),
    );
  }
}

export function drawWorkshop(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const box = drawIsoBox(
    ctx,
    b.origin.x,
    b.origin.y,
    b.width,
    b.depth,
    22,
    lit(shade(b.wallColor, 0.74), light, "left"),
    lit(b.wallColor, light, "right"),
    lit(shade(b.wallColor, 0.9), light, "top"),
    11,
  );
  drawSlopedRoof(
    ctx,
    box,
    lit(shade(b.roofColor, 0.8), light, "left"),
    lit(b.roofColor, light, "right"),
    "x",
  );

  // Open forge front glowing from within.
  const face = { x: (box.R.x + box.B.x) / 2, y: (box.R.y + box.B.y) / 2 };
  poly(
    ctx,
    [
      { x: face.x - 6, y: face.y - 2 },
      { x: face.x + 6, y: face.y + 4 },
      { x: face.x + 6, y: face.y - 12 },
      { x: face.x - 6, y: face.y - 18 },
    ],
    "#2a201a",
  );
  ellipse(ctx, face.x, face.y - 7, 4.5, 3.6, alpha("#ff7a2f", light.phase === "night" ? 0.9 : 0.6));

  // Chimney with a smoke plume.
  const stack = { x: (box.Te.x + box.Re.x) / 2, y: (box.Te.y + box.Re.y) / 2 - 8 };
  ctx.fillStyle = lit(shade(b.accentColor, 0.8), light, "right");
  ctx.fillRect(stack.x - 3, stack.y - 14, 6, 16);
  ctx.fillStyle = alpha("#c9c2b6", 0.35);
  for (let i = 0; i < 3; i++) {
    ellipse(ctx, stack.x + i * 2.5, stack.y - 18 - i * 7, 4 + i * 1.6, 3 + i, alpha("#cfc8bb", 0.28));
  }
}

export function drawLibrary(ctx: CanvasRenderingContext2D, b: Building, light: Lighting) {
  const box = drawIsoBox(
    ctx,
    b.origin.x,
    b.origin.y,
    b.width,
    b.depth,
    30,
    lit(shade(b.wallColor, 0.74), light, "left"),
    lit(b.wallColor, light, "right"),
    lit(shade(b.wallColor, 0.94), light, "top"),
    9,
  );

  // Flat roof with a parapet.
  poly(ctx, [box.Te, box.Re, box.Be, box.Le], lit(shade(b.wallColor, 1.0), light, "top"));
  ctx.strokeStyle = lit(b.accentColor, light, "top");
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(box.Te.x, box.Te.y);
  ctx.lineTo(box.Re.x, box.Re.y);
  ctx.lineTo(box.Be.x, box.Be.y);
  ctx.lineTo(box.Le.x, box.Le.y);
  ctx.closePath();
  ctx.stroke();

  // Portico columns along the entrance face.
  columnRow(ctx, box.B, box.R, 24, 4, light, shade(b.wallColor, 1.05));

  // Narrow high windows on the flank.
  ctx.fillStyle =
    light.phase === "night" ? alpha("#ffd27a", 0.8) : alpha(shade(b.wallColor, 0.55), 0.8);
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const x = box.L.x + (box.B.x - box.L.x) * t;
    const y = box.L.y + (box.B.y - box.L.y) * t;
    ctx.fillRect(x - 1.6, y - 24, 3.2, 9);
  }
}

/** Rubble left where something older used to stand. */
export function drawRuin(ctx: CanvasRenderingContext2D, gx: number, gy: number, light: Lighting) {
  const p = gridToScreen(gx, gy);
  const cx = p.x;
  const cy = p.y + TILE_H / 2;
  const stone = lit("#9a9184", light, "top");
  const dark = lit("#6f675c", light, "left");

  for (let i = 0; i < 5; i++) {
    const n = hash2(gx, gy + i, 13);
    const n2 = hash2(gy, gx + i, 29);
    const x = cx + (n - 0.5) * 30;
    const y = cy + (n2 - 0.5) * 14;
    const w = 3 + n * 5;
    poly(
      ctx,
      [
        { x: x - w, y },
        { x, y: y - 3 - n2 * 4 },
        { x: x + w, y },
        { x, y: y + 3 },
      ],
      i % 2 ? stone : dark,
    );
  }

  // A stub of standing wall.
  poly(
    ctx,
    [
      { x: cx - 10, y: cy - 2 },
      { x: cx - 2, y: cy - 6 },
      { x: cx - 2, y: cy - 16 },
      { x: cx - 10, y: cy - 12 },
    ],
    stone,
  );
}
