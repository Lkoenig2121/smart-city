import { buildingDef } from "@/lib/buildings/catalog";
import { ageIndex } from "@/lib/progression/ages";
import type { BuildingKind, CityState, Terrain } from "@/lib/city/types";

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
}

const FALLBACK: Terrain[] = ["grass", "park", "plaza", "sand", "lot", "playground"];

export function isUnlocked(state: CityState, kind: BuildingKind) {
  return ageIndex(buildingDef(kind).age) <= ageIndex(state.progression.age);
}

export function canBuild(
  state: CityState,
  kind: BuildingKind,
  x: number,
  y: number,
): PlacementCheck {
  const def = buildingDef(kind);

  if (!isUnlocked(state, kind)) {
    return { ok: false, reason: `Unlocks in the ${def.age} age` };
  }
  if (state.progression.coins < def.cost) {
    return { ok: false, reason: "Not enough coins" };
  }

  const allowed = def.placement.terrain ?? FALLBACK;

  for (let dy = 0; dy < def.footprint.d; dy++) {
    for (let dx = 0; dx < def.footprint.w; dx++) {
      const tile = state.tiles[y + dy]?.[x + dx];
      if (!tile) return { ok: false, reason: "Outside the map" };
      if (!tile.revealed) return { ok: false, reason: "Unexplored land" };
      if (tile.road) return { ok: false, reason: "A road is in the way" };
      if (tile.buildingId) return { ok: false, reason: "Already occupied" };
      if (!allowed.includes(tile.terrain)) {
        return { ok: false, reason: `Cannot build on ${tile.terrain}` };
      }
    }
  }

  if (def.placement.adjacentTo?.length) {
    const wanted = def.placement.adjacentTo;
    let found = false;
    for (let dy = -1; dy <= def.footprint.d && !found; dy++) {
      for (let dx = -1; dx <= def.footprint.w && !found; dx++) {
        const edge =
          dx === -1 || dy === -1 || dx === def.footprint.w || dy === def.footprint.d;
        if (!edge) continue;
        const tile = state.tiles[y + dy]?.[x + dx];
        if (tile && wanted.includes(tile.terrain)) found = true;
      }
    }
    if (!found) {
      return { ok: false, reason: `Must be built beside ${wanted.join(" or ")}` };
    }
  }

  return { ok: true };
}

export function upgradeCost(kind: BuildingKind) {
  const def = buildingDef(kind);
  if (!def.upgradesTo) return null;
  // Upgrading in place is cheaper than demolishing and rebuilding.
  return Math.round(buildingDef(def.upgradesTo).cost * 0.7);
}
