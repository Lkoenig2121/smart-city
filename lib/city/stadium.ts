import { footprintFor } from "@/lib/simulation/buildings/buildings";
import type { Building, CityState } from "@/lib/city/types";

export const STADIUM_COST = 750_000;
export const STADIUM_MIN_POPULATION = 5_000;
export const STADIUM_BUILD_SECONDS = 30;
export const STADIUM_DAILY_REVENUE = 15_000;
export const STADIUM_HAPPINESS_BOOST = 1_000;

export function findStadium(state: CityState) {
  for (const building of state.buildings.values()) {
    if (building.kind === "baseball_stadium") return building;
  }
  return null;
}

export function stadiumIsOpen(building: Building) {
  return building.kind === "baseball_stadium" && !(building.constructionLeft && building.constructionLeft > 0);
}

/** Tile just outside the north (street-facing) gate. */
export function stadiumGateTile(building: Building) {
  return {
    x: building.origin.x + Math.floor(building.width / 2),
    y: building.origin.y - 1,
  };
}

export function isGameNight(state: CityState) {
  const stadium = findStadium(state);
  if (!stadium || !stadiumIsOpen(stadium)) return false;
  const hour = Math.floor(state.clock.minuteOfDay / 60);
  return hour >= 18 && hour < 22;
}

function ringHasRoad(state: CityState, x: number, y: number, w: number, d: number) {
  for (let i = 0; i < w; i++) {
    if (state.tiles[y - 1]?.[x + i]?.road) return true;
    if (state.tiles[y + d]?.[x + i]?.road) return true;
  }
  for (let i = 0; i < d; i++) {
    if (state.tiles[y + i]?.[x - 1]?.road) return true;
    if (state.tiles[y + i]?.[x + w]?.road) return true;
  }
  return false;
}

function ringLotCount(state: CityState, x: number, y: number, w: number, d: number) {
  let n = 0;
  const visit = (tx: number, ty: number) => {
    const tile = state.tiles[ty]?.[tx];
    if (tile?.terrain === "lot") n += 1;
  };
  for (let i = 0; i < w; i++) {
    visit(x + i, y - 1);
    visit(x + i, y + d);
  }
  for (let i = 0; i < d; i++) {
    visit(x - 1, y + i);
    visit(x + w, y + i);
  }
  return n;
}

/** Why a stadium cannot be placed at this origin, or null if it can. */
export function stadiumPlacementError(state: CityState, x: number, y: number): string | null {
  const fp = footprintFor("baseball_stadium");
  for (let dy = 0; dy < fp.d; dy++) {
    for (let dx = 0; dx < fp.w; dx++) {
      const tile = state.tiles[y + dy]?.[x + dx];
      if (!tile) return "Needs a larger clear plot";
      if (tile.road || tile.buildingId || tile.terrain === "water") {
        return "Needs a clear plot (no road, water, or building)";
      }
    }
  }
  if (state.budget.treasury < STADIUM_COST) {
    return `Costs $${(STADIUM_COST / 1000).toFixed(0)}K — treasury is short`;
  }
  if (state.population < STADIUM_MIN_POPULATION) {
    return `Needs ${STADIUM_MIN_POPULATION.toLocaleString()} people (city has ${state.population.toLocaleString()})`;
  }
  if (!ringHasRoad(state, x, y, fp.w, fp.d)) return "Needs a road along the plot";
  if (ringLotCount(state, x, y, fp.w, fp.d) < 4) {
    return "Needs parking lots along the plot (paint Parking first)";
  }
  return null;
}
