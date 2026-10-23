import type { Building, Tile } from "@/lib/city/types";

/** Drop trees on a footprint and the tiles around it so canopies cannot sit in the building. */
export function clearTreesAround(tiles: Tile[][], x: number, y: number, w: number, d: number, pad = 2) {
  for (let iy = -pad; iy < d + pad; iy++) {
    for (let ix = -pad; ix < w + pad; ix++) {
      const tile = tiles[y + iy]?.[x + ix];
      if (tile) tile.tree = null;
    }
  }
}

export function clearTreesNearBuildings(
  tiles: Tile[][],
  buildings: Iterable<Pick<Building, "origin" | "width" | "depth">>,
  pad = 2,
) {
  for (const building of buildings) {
    clearTreesAround(tiles, building.origin.x, building.origin.y, building.width, building.depth, pad);
  }
}
