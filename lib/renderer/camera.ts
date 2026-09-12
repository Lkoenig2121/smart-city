import { TILE_H, TILE_W, gridToScreen, screenToGrid } from "@/lib/city/iso";

export class CityCamera {
  x = 0;
  y = 0;
  zoom = 1;
  targetX = 0;
  targetY = 0;
  targetZoom = 1;

  centerOn(gx: number, gy: number, width: number, height: number) {
    const p = gridToScreen(gx, gy);
    this.targetX = width / 2 - p.x * this.targetZoom;
    this.targetY = height / 2 - (p.y + TILE_H / 2) * this.targetZoom;
    this.x = this.targetX;
    this.y = this.targetY;
  }

  update(dt: number) {
    const k = 1 - Math.pow(0.0008, dt);
    this.x += (this.targetX - this.x) * k;
    this.y += (this.targetY - this.y) * k;
    this.zoom += (this.targetZoom - this.zoom) * k;
    if (Math.abs(this.x - this.targetX) < 0.35) this.x = this.targetX;
    if (Math.abs(this.y - this.targetY) < 0.35) this.y = this.targetY;
    if (Math.abs(this.zoom - this.targetZoom) < 0.001) this.zoom = this.targetZoom;
  }

  panBy(dx: number, dy: number) {
    this.targetX += dx;
    this.targetY += dy;
    this.x += dx;
    this.y += dy;
  }

  /** Moves only the target so `update` eases the camera into place. */
  nudge(dx: number, dy: number) {
    this.targetX += dx;
    this.targetY += dy;
  }

  zoomAt(screenX: number, screenY: number, factor: number) {
    const next = Math.min(2.4, Math.max(0.42, this.targetZoom * factor));
    const wx = (screenX - this.targetX) / this.targetZoom;
    const wy = (screenY - this.targetY) / this.targetZoom;
    this.targetZoom = next;
    this.targetX = screenX - wx * next;
    this.targetY = screenY - wy * next;
  }

  screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.x) / this.zoom,
      y: (sy - this.y) / this.zoom,
    };
  }

  pickTile(sx: number, sy: number) {
    const w = this.screenToWorld(sx, sy);
    const g = screenToGrid(w.x, w.y);
    return { x: Math.floor(g.x), y: Math.floor(g.y) };
  }

  apply(ctx: CanvasRenderingContext2D, dpr = 1) {
    ctx.setTransform(this.zoom * dpr, 0, 0, this.zoom * dpr, this.x * dpr, this.y * dpr);
  }
}

export function tileVisible(
  gx: number,
  gy: number,
  cam: CityCamera,
  width: number,
  height: number,
  pad = 160,
) {
  const p = gridToScreen(gx, gy);
  const sx = p.x * cam.zoom + cam.x;
  const sy = p.y * cam.zoom + cam.y;
  return sx > -pad && sy > -pad && sx < width + pad && sy < height + pad + 220;
}

/** Grid AABB covering the current screen, plus padding for tall facades. */
export function visibleTileRange(
  cam: CityCamera,
  width: number,
  height: number,
  size: number,
  pad = 8,
) {
  const corners = [
    cam.screenToWorld(-80, -80),
    cam.screenToWorld(width + 80, -80),
    cam.screenToWorld(-80, height + 280),
    cam.screenToWorld(width + 80, height + 280),
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const world of corners) {
    const g = screenToGrid(world.x, world.y);
    minX = Math.min(minX, g.x);
    maxX = Math.max(maxX, g.x);
    minY = Math.min(minY, g.y);
    maxY = Math.max(maxY, g.y);
  }
  return {
    x0: Math.max(0, Math.floor(minX) - pad),
    x1: Math.min(size - 1, Math.ceil(maxX) + pad),
    y0: Math.max(0, Math.floor(minY) - pad),
    y1: Math.min(size - 1, Math.ceil(maxY) + pad),
  };
}

void TILE_W;
