export const TILE_W = 88;
export const TILE_H = 44;

export function gridToScreen(gx: number, gy: number) {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

export function screenToGrid(sx: number, sy: number) {
  return {
    x: sy / TILE_H + sx / TILE_W,
    y: sy / TILE_H - sx / TILE_W,
  };
}

export function tileCenter(gx: number, gy: number) {
  const p = gridToScreen(gx, gy);
  return { x: p.x, y: p.y + TILE_H / 2 };
}

export function diamondPoints(gx: number, gy: number) {
  const o = gridToScreen(gx, gy);
  return {
    top: { x: o.x, y: o.y },
    right: { x: o.x + TILE_W / 2, y: o.y + TILE_H / 2 },
    bottom: { x: o.x, y: o.y + TILE_H },
    left: { x: o.x - TILE_W / 2, y: o.y + TILE_H / 2 },
    origin: o,
  };
}

export function worldBounds(size: number) {
  const top = gridToScreen(0, 0);
  const right = gridToScreen(size - 1, 0);
  const left = gridToScreen(0, size - 1);
  const bottom = gridToScreen(size - 1, size - 1);
  return {
    minX: left.x - TILE_W,
    maxX: right.x + TILE_W,
    minY: top.y - 40,
    maxY: bottom.y + TILE_H + 360,
  };
}
