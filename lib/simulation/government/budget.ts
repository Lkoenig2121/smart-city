import type { CityBudget } from "@/lib/city/types";

export function serviceFunding(budget: CityBudget) {
  return {
    police: budget.police,
    fire: budget.fire,
    healthcare: budget.healthcare,
    education: budget.education,
    parks: budget.parks,
    roads: budget.roads,
  };
}
