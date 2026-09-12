import { TILE_H, TILE_W, diamondPoints, gridToScreen } from "@/lib/city/iso";

export function drawDiamond(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  fill: string,
  stroke?: string,
) {
  const d = diamondPoints(gx, gy);
  ctx.beginPath();
  ctx.moveTo(d.top.x, d.top.y);
  ctx.lineTo(d.right.x, d.right.y);
  ctx.lineTo(d.bottom.x, d.bottom.y);
  ctx.lineTo(d.left.x, d.left.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function isoBoxCorners(
  gx: number,
  gy: number,
  width: number,
  depth: number,
  height: number,
  inset = 6,
) {
  const topP = gridToScreen(gx, gy);
  const rightP = gridToScreen(gx + width - 1, gy);
  const leftP = gridToScreen(gx, gy + depth - 1);
  const bottomP = gridToScreen(gx + width - 1, gy + depth - 1);

  const T = { x: topP.x, y: topP.y + inset * 0.45 };
  const R = {
    x: rightP.x + TILE_W / 2 - inset,
    y: rightP.y + TILE_H / 2 + inset * 0.2,
  };
  const B = { x: bottomP.x, y: bottomP.y + TILE_H - inset * 0.1 };
  const L = {
    x: leftP.x - TILE_W / 2 + inset,
    y: leftP.y + TILE_H / 2 + inset * 0.2,
  };

  const lift = height;
  const Te = { x: T.x, y: T.y - lift };
  const Re = { x: R.x, y: R.y - lift };
  const Be = { x: B.x, y: B.y - lift };
  const Le = { x: L.x, y: L.y - lift };
  return { T, R, B, L, Te, Re, Be, Le, lift };
}

export function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  width: number,
  depth: number,
  height: number,
  left: string,
  right: string,
  top: string,
  inset = 6,
) {
  const { T, R, B, L, Te, Re, Be, Le, lift } = isoBoxCorners(gx, gy, width, depth, height, inset);

  ctx.beginPath();
  ctx.moveTo(L.x, L.y);
  ctx.lineTo(B.x, B.y);
  ctx.lineTo(Be.x, Be.y);
  ctx.lineTo(Le.x, Le.y);
  ctx.closePath();
  ctx.fillStyle = left;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(R.x, R.y);
  ctx.lineTo(B.x, B.y);
  ctx.lineTo(Be.x, Be.y);
  ctx.lineTo(Re.x, Re.y);
  ctx.closePath();
  ctx.fillStyle = right;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(Te.x, Te.y);
  ctx.lineTo(Re.x, Re.y);
  ctx.lineTo(Be.x, Be.y);
  ctx.lineTo(Le.x, Le.y);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();

  return { T, R, B, L, Te, Re, Be, Le, lift };
}

export function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  width: number,
  depth: number,
  strength = 0.22,
) {
  const d = diamondPoints(gx + (width - 1) * 0.15, gy + (depth - 1) * 0.15);
  ctx.beginPath();
  ctx.moveTo(d.top.x + 10, d.top.y + 6);
  ctx.lineTo(d.right.x + 16, d.right.y + 8);
  ctx.lineTo(d.bottom.x + 8, d.bottom.y + 10);
  ctx.lineTo(d.left.x + 6, d.left.y + 8);
  ctx.closePath();
  ctx.fillStyle = `rgba(20, 28, 24, ${strength})`;
  ctx.fill();
}

export function drawWindowGrid(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  cols: number,
  rows: number,
  glass: string,
  frame: string,
) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u0 = (c + 0.18) / cols;
      const u1 = (c + 0.82) / cols;
      const v0 = (r + 0.2) / rows;
      const v1 = (r + 0.82) / rows;
      const p00 = lerp2(x0, y0, x1, y1, x3, y3, x2, y2, u0, v0);
      const p10 = lerp2(x0, y0, x1, y1, x3, y3, x2, y2, u1, v0);
      const p11 = lerp2(x0, y0, x1, y1, x3, y3, x2, y2, u1, v1);
      const p01 = lerp2(x0, y0, x1, y1, x3, y3, x2, y2, u0, v1);
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.fillStyle = glass;
      ctx.fill();
      ctx.strokeStyle = frame;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }
}

function lerp2(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x3: number,
  y3: number,
  x2: number,
  y2: number,
  u: number,
  v: number,
) {
  const ax = x0 + (x1 - x0) * u;
  const ay = y0 + (y1 - y0) * u;
  const bx = x3 + (x2 - x3) * u;
  const by = y3 + (y2 - y3) * u;
  return { x: ax + (bx - ax) * v, y: ay + (by - ay) * v };
}

export function drawSlopedRoof(
  ctx: CanvasRenderingContext2D,
  box: ReturnType<typeof drawIsoBox>,
  left: string,
  right: string,
  ridge: "x" | "y" = "x",
) {
  const { Te, Re, Be, Le } = box;
  if (ridge === "x") {
    const ridgeL = { x: (Te.x + Le.x) / 2, y: (Te.y + Le.y) / 2 - 10 };
    const ridgeR = { x: (Re.x + Be.x) / 2, y: (Re.y + Be.y) / 2 - 10 };
    ctx.beginPath();
    ctx.moveTo(Te.x, Te.y);
    ctx.lineTo(Re.x, Re.y);
    ctx.lineTo(ridgeR.x, ridgeR.y);
    ctx.lineTo(ridgeL.x, ridgeL.y);
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(Le.x, Le.y);
    ctx.lineTo(Be.x, Be.y);
    ctx.lineTo(ridgeR.x, ridgeR.y);
    ctx.lineTo(ridgeL.x, ridgeL.y);
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();
  } else {
    const ridgeT = { x: (Te.x + Re.x) / 2, y: (Te.y + Re.y) / 2 - 10 };
    const ridgeB = { x: (Le.x + Be.x) / 2, y: (Le.y + Be.y) / 2 - 10 };
    ctx.beginPath();
    ctx.moveTo(Te.x, Te.y);
    ctx.lineTo(Le.x, Le.y);
    ctx.lineTo(ridgeB.x, ridgeB.y);
    ctx.lineTo(ridgeT.x, ridgeT.y);
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(Re.x, Re.y);
    ctx.lineTo(Be.x, Be.y);
    ctx.lineTo(ridgeB.x, ridgeB.y);
    ctx.lineTo(ridgeT.x, ridgeT.y);
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();
  }
}
