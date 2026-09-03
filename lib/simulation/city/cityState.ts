import { generateCity } from "@/lib/city/generateCity";
import type { CityState } from "@/lib/city/types";

export function createInitialCity(seed?: number): CityState {
  return generateCity(seed);
}

export function getTile(state: CityState, x: number, y: number) {
  return state.tiles[y]?.[x] ?? null;
}

export function getBuildingAt(state: CityState, x: number, y: number) {
  const tile = getTile(state, x, y);
  if (!tile?.buildingId) return null;
  return state.buildings.get(tile.buildingId) ?? null;
}

export function recountPopulation(state: CityState) {
  state.population = [...state.buildings.values()].reduce(
    (sum, building) => sum + building.stats.residents,
    0,
  );
}
