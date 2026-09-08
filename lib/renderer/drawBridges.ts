import { gridToScreen } from "@/lib/city/iso";
import { hash2 } from "@/lib/city/rng";
import type { BridgeCell, Graffiti } from "@/lib/city/types";
import { alpha, lit, mix, shade, type Lighting } from "./palette";

const DECK_THICKNESS = 7;
const RAIL_H = 9;
const CONCRETE = "#9a978f";
const DECK_TOP = "#41434a";

type P = { x: number; y: number };

function g2s(gx: number, gy: number, lift = 0): P {
  const p = gridToScreen(gx, gy);
  return { x: p.x, y: p.y - lift };
}

function quad(ctx: CanvasRenderingContext2D, pts: P[], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Corners of the deck footprint, narrowed across the direction of travel. */
function deckCorners(x: number, y: number, axis: BridgeCell["axis"], lift: number) {
  const m = 0.16;
  if (axis === "ew") {
    return [
      g2s(x, y + m, lift),
      g2s(x + 1, y + m, lift),
      g2s(x + 1, y + 1 - m, lift),
      g2s(x, y + 1 - m, lift),
    ];
  }
  return [
    g2s(x + m, y, lift),
    g2s(x + 1 - m, y, lift),
    g2s(x + 1 - m, y + 1, lift),
    g2s(x + m, y + 1, lift),
  ];
}

export function drawBridge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridge: BridgeCell,
  light: Lighting,
  time: number,
) {
  const lift = bridge.deck;
  const top = deckCorners(x, y, bridge.axis, lift);
  const under = deckCorners(x, y, bridge.axis, lift - DECK_THICKNESS);

  // Shadow the water beneath the span.
  quad(ctx, deckCorners(x, y, bridge.axis, 0), alpha("#06131f", 0.3));

  if (bridge.pier) drawPier(ctx, x, y, bridge, light, lift);
  if (bridge.abutment) drawAbutment(ctx, x, y, bridge, light, lift);

  // Underside slab: the two faces that look toward the camera.
  quad(ctx, [top[2], top[3], under[3], under[2]], lit(shade(CONCRETE, 0.6), light, "left"));
  quad(ctx, [top[1], top[2], under[2], under[1]], lit(shade(CONCRETE, 0.72), light, "right"));

  // Deck surface.
  quad(ctx, top, lit(DECK_TOP, light, "ground"));
  drawDeckMarkings(ctx, top, bridge.axis, light);

  drawRailing(ctx, top[0], top[1], light);
  drawRailing(ctx, top[3], top[2], light);

  if (bridge.pylon) drawPylon(ctx, top, light, time);
}

function drawDeckMarkings(
  ctx: CanvasRenderingContext2D,
  top: P[],
  axis: BridgeCell["axis"],
  light: Lighting,
) {
  const a = { x: (top[0].x + top[3].x) / 2, y: (top[0].y + top[3].y) / 2 };
  const b = { x: (top[1].x + top[2].x) / 2, y: (top[1].y + top[2].y) / 2 };
  ctx.save();
  ctx.setLineDash([7, 8]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = alpha(
    lit("#e2dcc8", light, "top"),
    light.phase === "night" ? 0.4 : 0.72,
  );
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  void axis;
}

function drawRailing(ctx: CanvasRenderingContext2D, a: P, b: P, light: Lighting) {
  const rail = lit("#b9bec4", light, "top");
  const postColor = lit("#8b9096", light, "right");

  quad(
    ctx,
    [a, b, { x: b.x, y: b.y - RAIL_H }, { x: a.x, y: a.y - RAIL_H }],
    alpha(lit("#7f858c", light, "right"), 0.35),
  );

  const posts = 5;
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    ctx.fillStyle = postColor;
    ctx.fillRect(px - 0.7, py - RAIL_H, 1.4, RAIL_H);
  }

  ctx.beginPath();
  ctx.moveTo(a.x, a.y - RAIL_H);
  ctx.lineTo(b.x, b.y - RAIL_H);
  ctx.strokeStyle = rail;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(a.x, a.y - RAIL_H * 0.5);
  ctx.lineTo(b.x, b.y - RAIL_H * 0.5);
  ctx.strokeStyle = alpha(rail, 0.5);
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

function drawPier(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridge: BridgeCell,
  light: Lighting,
  lift: number,
) {
  const a = 0.32;
  const b = 0.68;
  const footTop = g2s(x + a, y + b, 2);
  const cornerL = g2s(x + a, y + a, 2);
  const cornerR = g2s(x + b, y + b, 2);

  const capY = lift - DECK_THICKNESS;
  const upL = { x: cornerL.x, y: cornerL.y - capY };
  const upF = { x: footTop.x, y: footTop.y - capY };
  const upR = { x: cornerR.x, y: cornerR.y - capY };

  // Waterline stain where the column meets the river.
  ctx.beginPath();
  ctx.fillStyle = alpha("#12303f", 0.35);
  ctx.ellipse(footTop.x, footTop.y + 2, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  quad(ctx, [cornerL, footTop, upF, upL], lit(shade(CONCRETE, 0.66), light, "left"));
  quad(ctx, [cornerR, footTop, upF, upR], lit(shade(CONCRETE, 0.82), light, "right"));

  if (bridge.graffiti) {
    paintGraffiti(
      ctx,
      { x: (cornerR.x + upF.x) / 2 + 3, y: (cornerR.y + upR.y) / 2 - 2 },
      15,
      Math.min(20, capY - 6),
      bridge.graffiti,
      light,
    );
  }
}

function drawAbutment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bridge: BridgeCell,
  light: Lighting,
  lift: number,
) {
  const start = bridge.abutment === "start";
  // The wall sits at whichever end of the span meets the bank.
  const ex = bridge.axis === "ew" ? (start ? x : x + 1) : x;
  const ey = bridge.axis === "ns" ? (start ? y : y + 1) : y;

  const m = 0.16;
  const p0 =
    bridge.axis === "ew" ? g2s(ex, ey + m, 2) : g2s(ex + m, ey, 2);
  const p1 =
    bridge.axis === "ew" ? g2s(ex, ey + 1 - m, 2) : g2s(ex + 1 - m, ey, 2);

  const h = lift - 2;
  const t0 = { x: p0.x, y: p0.y - h };
  const t1 = { x: p1.x, y: p1.y - h };

  quad(ctx, [p0, p1, t1, t0], lit(shade(CONCRETE, 0.7), light, "left"));

  ctx.beginPath();
  ctx.moveTo(t0.x, t0.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.strokeStyle = alpha(lit(CONCRETE, light, "top"), 0.8);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (bridge.graffiti) {
    paintGraffiti(
      ctx,
      { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 - h * 0.45 },
      20,
      Math.min(18, h * 0.7),
      bridge.graffiti,
      light,
    );
  }
}

function drawPylon(
  ctx: CanvasRenderingContext2D,
  top: P[],
  light: Lighting,
  time: number,
) {
  const mid = {
    x: (top[0].x + top[1].x + top[2].x + top[3].x) / 4,
    y: (top[0].y + top[1].y + top[2].y + top[3].y) / 4,
  };
  const height = 76;
  const tipY = mid.y - height;

  const legs = [
    { x: (top[0].x + top[1].x) / 2, y: (top[0].y + top[1].y) / 2 },
    { x: (top[3].x + top[2].x) / 2, y: (top[3].y + top[2].y) / 2 },
  ];

  for (const leg of legs) {
    quad(
      ctx,
      [
        { x: leg.x - 3, y: leg.y },
        { x: leg.x + 3, y: leg.y },
        { x: mid.x + 2, y: tipY + 14 },
        { x: mid.x - 2, y: tipY + 14 },
      ],
      lit(mix(CONCRETE, "#cfd4d8", 0.4), light, "right"),
    );
  }

  quad(
    ctx,
    [
      { x: mid.x - 2.6, y: tipY + 16 },
      { x: mid.x + 2.6, y: tipY + 16 },
      { x: mid.x + 1.6, y: tipY },
      { x: mid.x - 1.6, y: tipY },
    ],
    lit("#d3d8dc", light, "top"),
  );

  // Cable stays fanning down to the deck.
  ctx.strokeStyle = alpha(lit("#dfe6ea", light, "top"), 0.55);
  ctx.lineWidth = 0.9;
  for (const leg of legs) {
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      ctx.beginPath();
      ctx.moveTo(mid.x, tipY + 6);
      ctx.lineTo(leg.x + (leg.x - mid.x) * t * 1.6, leg.y + 1);
      ctx.stroke();
    }
  }

  const blink = 0.55 + 0.45 * Math.sin(time * 2.2);
  ctx.beginPath();
  ctx.fillStyle = alpha("#ff6b5a", light.phase === "night" ? blink : 0.7);
  ctx.arc(mid.x, tipY - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Sprays a tag onto a wall face. Kept intentionally loose — a few overlapping
 * strokes read as graffiti at city zoom without needing sprite art.
 */
export function paintGraffiti(
  ctx: CanvasRenderingContext2D,
  center: P,
  width: number,
  height: number,
  g: Graffiti,
  light: Lighting,
) {
  if (height < 5 || width < 5) return;
  const dim = light.phase === "night" ? 0.55 : 1;
  const base = `hsl(${g.hue} 85% ${light.phase === "night" ? 42 : 55}%)`;
  const accent = `hsl(${(g.hue + 145) % 360} 90% ${light.phase === "night" ? 48 : 62}%)`;

  ctx.save();
  ctx.beginPath();
  ctx.rect(center.x - width / 2, center.y - height / 2, width, height);
  ctx.clip();

  ctx.globalAlpha = 0.78 * dim;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const strokes = 3 + (g.variant % 3);
  for (let i = 0; i < strokes; i++) {
    const n = hash2(g.variant, i, 17);
    const n2 = hash2(i, g.variant, 43);
    const sx = center.x - width / 2 + width * (0.12 + n * 0.6);
    const sy = center.y - height / 2 + height * (0.2 + n2 * 0.55);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(
      sx + width * 0.2,
      sy - height * (0.18 + n * 0.2),
      sx + width * (0.24 + n2 * 0.24),
      sy + height * 0.12,
    );
    ctx.strokeStyle = i % 2 === 0 ? base : accent;
    ctx.lineWidth = 1.5 + n * 1.6;
    ctx.stroke();
  }

  // A blocky throw-up behind the strokes.
  ctx.globalAlpha = 0.32 * dim;
  ctx.fillStyle = base;
  ctx.fillRect(
    center.x - width * 0.3,
    center.y - height * 0.16,
    width * (0.34 + (g.variant % 2) * 0.2),
    height * 0.3,
  );

  ctx.restore();
}
