import { TILE_H, TILE_W, gridToScreen } from "@/lib/city/iso";
import type { Building, CityState } from "@/lib/city/types";
import { isoBoxCorners } from "./drawIso";

type Pt = { x: number; y: number };

export function buildingDrawHeight(b: Building) {
  switch (b.kind) {
    case "house":
      return 26 + (b.variant % 3) * 3 + 16;
    case "apartment":
      return 18 + b.floors * 14;
    case "shop":
      return 36;
    case "office":
      return 22 + b.floors * 13;
    case "skyscraper":
      return 40 + b.floors * 12.4;
    case "tower":
      return 54 + b.floors * 9.8;
    case "hospital":
      return 58;
    case "school":
      return 40;
    case "police":
    case "fire":
      return 38;
    case "city_hall":
      return 48;
    case "park_pavilion":
      return 24;
    case "baseball_stadium":
      return 34;
    case "subway_station":
      return 28;
  }
}

export function mastHeight(b: Building) {
  if (b.kind === "tower") return 54;
  if (b.kind === "skyscraper") return 26;
  return 0;
}

function pointInTri(p: Pt, a: Pt, b: Pt, c: Pt) {
  const s = (a.x - c.x) * (p.y - c.y) - (a.y - c.y) * (p.x - c.x);
  const t = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const u = (c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x);
  return (s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0);
}

function pointInQuad(p: Pt, a: Pt, b: Pt, c: Pt, d: Pt) {
  return pointInTri(p, a, b, c) || pointInTri(p, a, c, d);
}

function hitsMast(px: number, py: number, b: Building, boxHeight: number) {
  const extra = mastHeight(b);
  if (!extra) return false;
  const inset = b.kind === "tower" ? 0.42 : 0.3;
  const span = Math.max(0.4, b.width - inset * 2);
  const box = isoBoxCorners(b.origin.x + inset, b.origin.y + inset, span, span, boxHeight);
  return Math.abs(px - box.Be.x) <= 6 && py <= box.Be.y && py >= box.Be.y - extra;
}

function inReach(px: number, py: number, b: Building) {
  const h = buildingDrawHeight(b);
  const c = gridToScreen(b.origin.x + (b.width - 1) * 0.5, b.origin.y + (b.depth - 1) * 0.5);
  const rad = (TILE_W / 2) * (b.width + b.depth) + 28;
  return px >= c.x - rad && px <= c.x + rad && py <= c.y + TILE_H + 24 && py >= c.y - h - 80;
}

function hitsBuilding(px: number, py: number, b: Building) {
  const h = buildingDrawHeight(b);
  const box = isoBoxCorners(b.origin.x, b.origin.y, b.width, b.depth, h);
  const p = { x: px, y: py };
  return (
    pointInQuad(p, box.Te, box.Re, box.Be, box.Le) ||
    pointInQuad(p, box.L, box.B, box.Be, box.Le) ||
    pointInQuad(p, box.R, box.B, box.Be, box.Re) ||
    hitsMast(px, py, b, h)
  );
}

function frontKey(b: Building) {
  return b.origin.x + b.origin.y + b.width + b.depth + buildingDrawHeight(b) / 200;
}

/** Front-most building whose drawn volume contains a world-space click. */
export function pickBuildingAt(state: CityState, worldX: number, worldY: number) {
  let best: Building | null = null;
  let bestKey = -Infinity;
  for (const building of state.buildings.values()) {
    if (!inReach(worldX, worldY, building) || !hitsBuilding(worldX, worldY, building)) continue;
    const key = frontKey(building);
    if (key >= bestKey) {
      best = building;
      bestKey = key;
    }
  }
  return best;
}
