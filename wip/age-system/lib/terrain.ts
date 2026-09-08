import type { Building, Terrain, Tile } from "./types";

export const SIZE = 40;

/** Water spans `riverXAt(y)` through `riverXAt(y) + RIVER_W - 1`. */
export const RIVER_W = 4;

export const BRIDGE_DECK = 22;

/**
 * The river is defined once and shared by every world generator, so the
 * wilderness the player starts on is literally the same land Riverside
 * eventually occupies.
 */
export function riverXAt(y: number) {
  return 7 + Math.round(Math.sin(y * 0.18) * 1.2);
}

export function emptyTile(x: number, y: number, revealed = true): Tile {
  return {
    x,
    y,
    terrain: "grass",
    road: null,
    bridge: null,
    buildingId: null,
    tree: null,
    graffiti: null,
    revealed,
    ruin: false,
  };
}

export function createGrid(revealed = true): Tile[][] {
  return Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => emptyTile(x, y, revealed)),
  );
}

export function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
}

export function carveRiver(tiles: Tile[][]) {
  for (let y = 0; y < SIZE; y++) {
    const riverX = riverXAt(y);
    for (let w = 0; w < RIVER_W; w++) {
      const tile = tiles[y][riverX + w];
      if (!tile) continue;
      tile.terrain = "water";
      tile.tree = null;
    }
    for (const bank of [riverX - 1, riverX + RIVER_W]) {
      const tile = tiles[y][bank];
      if (tile && tile.terrain !== "water") tile.terrain = "sand";
    }
  }
}

export function addRoad(tiles: Tile[][], x: number, y: number) {
  if (!inBounds(x, y)) return;
  const tile = tiles[y][x];
  if (tile.terrain === "water" || tile.buildingId) return;
  if (tile.terrain === "mountain") return;
  tile.road = { north: false, east: false, south: false, west: false };
  tile.tree = null;
}

export function connectRoads(tiles: Tile[][]) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const tile = tiles[y][x];
      if (!tile.road) continue;
      tile.road = {
        north: Boolean(tiles[y - 1]?.[x]?.road),
        east: Boolean(tiles[y][x + 1]?.road),
        south: Boolean(tiles[y + 1]?.[x]?.road),
        west: Boolean(tiles[y][x - 1]?.road),
      };
    }
  }
}

export function canPlace(tiles: Tile[][], x: number, y: number, w: number, d: number) {
  for (let dy = 0; dy < d; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inBounds(tx, ty)) return false;
      const tile = tiles[ty][tx];
      if (tile.road || tile.buildingId) return false;
      if (tile.terrain === "water" || tile.terrain === "mountain") return false;
    }
  }
  return true;
}

export function stampBuilding(tiles: Tile[][], building: Building) {
  for (let dy = 0; dy < building.depth; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const tile = tiles[building.origin.y + dy]?.[building.origin.x + dx];
      if (!tile) continue;
      tile.buildingId = building.id;
      tile.tree = null;
      tile.ruin = false;
    }
  }
}

export function fillRect(
  tiles: Tile[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  terrain: Terrain,
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBounds(x, y)) continue;
      const tile = tiles[y][x];
      if (tile.road || tile.buildingId) continue;
      if (tile.terrain === "water" || tile.terrain === "sand") continue;
      if (tile.terrain === "mountain" || tile.terrain === "rock") continue;
      tile.terrain = terrain;
    }
  }
}

/** Marks every tile within `radius` of the settlement as explored. */
export function revealAround(tiles: Tile[][], cx: number, cy: number, radius: number) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (Math.hypot(x - cx, y - cy) <= radius) tiles[y][x].revealed = true;
    }
  }
}
