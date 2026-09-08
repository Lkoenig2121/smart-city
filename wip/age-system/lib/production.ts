import { buildingDef } from "@/lib/buildings/catalog";
import { ageIndex } from "@/lib/progression/ages";
import type { CityState } from "@/lib/city/types";

/** The five settlers you begin with never leave, whatever the conditions. */
const FOUNDERS = 5;

export interface EconomySnapshot {
  coinsPerSecond: number;
  xpPerSecond: number;
  housing: number;
  jobs: number;
  workforceUsed: number;
  happiness: number;
  monuments: number;
}

/**
 * Structures lose output as the ages pass, which is the pressure that makes
 * upgrading worthwhile. Nothing ever drops below a third of its original rate.
 */
export function efficiencyOf(state: CityState, builtIn: Parameters<typeof ageIndex>[0]) {
  const drift = ageIndex(state.progression.age) - ageIndex(builtIn);
  return Math.min(1, Math.max(0.3, 1 - drift * 0.12));
}

export function assessEconomy(state: CityState): EconomySnapshot {
  const buildings = [...state.buildings.values()];

  let housing = 0;
  let jobs = 0;
  let happinessPoints = 0;
  let monuments = 0;

  // Staff the most productive buildings first.
  const employers = buildings
    .filter((b) => !b.preserved && buildingDef(b.kind).jobs > 0)
    .sort((a, b) => buildingDef(b.kind).coins - buildingDef(a.kind).coins);

  for (const building of buildings) {
    const def = buildingDef(building.kind);
    if (building.preserved) {
      monuments += 1;
      // A protected monument still lifts spirits even though it produces nothing.
      happinessPoints += def.happiness * 0.6 + 2;
      continue;
    }
    housing += def.housing;
    jobs += def.jobs;
    happinessPoints += def.happiness;
  }

  let workforce = Math.floor(state.population);
  let coinsPerSecond = 0;
  let xpPerSecond = 0;
  let workforceUsed = 0;

  for (const building of employers) {
    const def = buildingDef(building.kind);
    const staffed = Math.min(def.jobs, workforce);
    workforce -= staffed;
    workforceUsed += staffed;
    const ratio = def.jobs > 0 ? staffed / def.jobs : 1;
    const efficiency = efficiencyOf(state, building.builtIn);
    coinsPerSecond += def.coins * ratio * efficiency;
    xpPerSecond += def.xp * ratio * efficiency;
    building.stats.employees = staffed;
    building.stats.status = staffed === 0 ? "closed" : ratio < 0.6 ? "busy" : "open";
  }

  // Buildings that need no staff (hearths, wells, parks) always contribute.
  for (const building of buildings) {
    const def = buildingDef(building.kind);
    if (building.preserved || def.jobs > 0) continue;
    const efficiency = efficiencyOf(state, building.builtIn);
    coinsPerSecond += def.coins * efficiency;
    xpPerSecond += def.xp * efficiency;
  }

  // The founding party can rough it; everyone after them expects a roof.
  const homeless = Math.max(0, Math.floor(state.population) - housing - FOUNDERS);
  const happiness = Math.round(
    Math.min(100, Math.max(5, 45 + happinessPoints * 1.5 - homeless * 3)),
  );

  // A contented, growing population generates civilization points on its own.
  xpPerSecond += (state.population / 60) * (happiness / 100);

  return {
    coinsPerSecond,
    xpPerSecond,
    housing,
    jobs,
    workforceUsed,
    happiness,
    monuments,
  };
}

/** Spreads the current population across housing so panels show real numbers. */
export function distributeResidents(state: CityState) {
  const homes = [...state.buildings.values()].filter(
    (b) => !b.preserved && buildingDef(b.kind).housing > 0,
  );
  let remaining = Math.floor(state.population);
  for (const home of homes) {
    const capacity = buildingDef(home.kind).housing;
    const placed = Math.min(capacity, remaining);
    home.stats.residents = placed;
    remaining -= placed;
  }
  for (const building of state.buildings.values()) {
    if (building.preserved) {
      building.stats.residents = 0;
      building.stats.employees = 0;
      building.stats.status = "closed";
    }
  }
}

export function applyEconomy(state: CityState, snapshot: EconomySnapshot, dt: number) {
  const p = state.progression;
  p.coins += snapshot.coinsPerSecond * dt;
  p.xp += snapshot.xpPerSecond * dt;
  p.totalXp += snapshot.xpPerSecond * dt;
  p.coinsPerSecond = snapshot.coinsPerSecond;
  p.xpPerSecond = snapshot.xpPerSecond;
  p.happiness = snapshot.happiness;
  p.housing = snapshot.housing;
  p.workforceUsed = snapshot.workforceUsed;
  p.workforceTotal = Math.floor(state.population);
  state.budget.treasury = p.coins;

  // Population drifts toward available housing, faster when people are happy.
  const target = snapshot.housing + FOUNDERS;
  if (snapshot.happiness >= 45 && state.population < target) {
    const rate = 0.12 + (snapshot.happiness - 45) * 0.006;
    state.population = Math.min(target, state.population + rate * dt);
  } else if (snapshot.happiness < 32 && state.population > FOUNDERS) {
    state.population = Math.max(FOUNDERS, state.population - 0.05 * dt);
  }

  distributeResidents(state);
}
