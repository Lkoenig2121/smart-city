import type { CityState } from "@/lib/city/types";

export function cityRevenue(state: CityState) {
  return [...state.buildings.values()].reduce((sum, building) => sum + building.stats.revenue, 0);
}

export function estimatedTaxIncome(state: CityState) {
  return Math.round(cityRevenue(state) * 0.12 + state.population * 420);
}
