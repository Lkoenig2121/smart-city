import type { Terrain, Tile } from "@/lib/city/types";

/** Iso apartment floor pitch — mountain massifs sit on a mid-rise scale. */
export const MOUNTAIN_ISO_FLOOR_PX = 14;
const MOUNTAIN_ISO_BASE_PX = 18;

/** Chebyshev steps from (x,y) to the nearest non-mountain tile (0 = foothill edge). */
export function mountainDistToEdge(tiles: Tile[][], x: number, y: number): number {
  const tile = tiles[y]?.[x];
  if (!tile || !isMountainTerrain(tile.terrain)) return 0;
  for (let r = 1; r <= 14; r++) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        const n = tiles[y + oy]?.[x + ox];
        if (!n || !isMountainTerrain(n.terrain)) return r - 1;
      }
    }
  }
  return 14;
}

/**
 * Height of a mountain tile as part of one continuous massif:
 * low at the foothills, rising toward the interior of the connected rock/snow.
 */
export function mountainFloorsSmooth(
  tiles: Tile[][] | null | undefined,
  x: number,
  y: number,
): number {
  const tile = tiles?.[y]?.[x];
  if (!tile || !isMountainTerrain(tile.terrain)) return 0;
  if (!tiles) return tile.terrain === "snow" ? 11 : 10;

  const dist = mountainDistToEdge(tiles, x, y);
  // Dome: edges ~3–4 storeys, deep interior ~10–12.
  const base = 3.2 + Math.min(dist, 9) * 0.95;
  const snow = tile.terrain === "snow" ? 1.2 : 0;
  return base + snow;
}

export function mountainFloors(terrain: Terrain, x: number, y: number): number {
  if (terrain !== "rock" && terrain !== "snow") return 0;
  return terrain === "snow" ? 11 : 10;
}

/** Pixel lift for isometric mountain massifs. */
export function mountainIsoHeight(
  terrain: Terrain,
  x: number,
  y: number,
  tiles?: Tile[][] | null,
): number {
  const floors = tiles ? mountainFloorsSmooth(tiles, x, y) : mountainFloors(terrain, x, y);
  return floors ? MOUNTAIN_ISO_BASE_PX + floors * MOUNTAIN_ISO_FLOOR_PX : 0;
}

/** World-unit height for street-view meshes. */
export function mountainWorldHeight(
  terrain: Terrain,
  x: number,
  y: number,
  floorH: number,
  tiles?: Tile[][] | null,
): number {
  const floors = tiles ? mountainFloorsSmooth(tiles, x, y) : mountainFloors(terrain, x, y);
  return floors * floorH;
}

export function isMountainTerrain(terrain: Terrain): boolean {
  return terrain === "rock" || terrain === "snow";
}

/** Neighbour mountain height in iso pixels (0 if not mountain). */
export function mountainNeighborIsoHeight(
  tiles: Tile[][] | null | undefined,
  x: number,
  y: number,
): number {
  const tile = tiles?.[y]?.[x];
  if (!tile || !isMountainTerrain(tile.terrain)) return 0;
  return mountainIsoHeight(tile.terrain, x, y, tiles);
}
