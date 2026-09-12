import { mulberry32 } from "@/lib/city/rng";
import type { CityState } from "@/lib/city/types";
import { STADIUM_DAILY_REVENUE, stadiumIsOpen } from "@/lib/city/stadium";
import { tickBuildingStats } from "../buildings/buildingLogic";
import { stepCitizens, syncCitizenSchedules, wanderOutdoors } from "../citizens/citizenBehavior";
import { seedVehicle, stepVehicles } from "../traffic/vehicleMovement";

export function formatClock(state: CityState) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hour24 = Math.floor(state.clock.minuteOfDay / 60);
  const minute = Math.floor(state.clock.minuteOfDay % 60);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    day: days[state.clock.dayIndex],
    time: `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`,
    hour24,
    minute,
  };
}

export function dayPhase(state: CityState): "night" | "dawn" | "day" | "dusk" {
  const t = state.clock.minuteOfDay / 60;
  if (t < 5.5 || t >= 21) return "night";
  if (t < 7.2) return "dawn";
  if (t < 17.4) return "day";
  if (t < 20.2) return "dusk";
  return "night";
}

export function tickCity(state: CityState, dtSeconds: number, seeded = true) {
  const rand = seeded
    ? mulberry32((state.clock.dayIndex + 1) * 100000 + state.clock.minuteOfDay)
    : Math.random;

  state.clock.minuteOfDay += dtSeconds * 7.5;
  if (state.clock.minuteOfDay >= 24 * 60) {
    state.clock.minuteOfDay -= 24 * 60;
    state.clock.dayIndex = (state.clock.dayIndex + 1) % 7;
    for (const building of state.buildings.values()) {
      if (stadiumIsOpen(building)) state.budget.treasury += STADIUM_DAILY_REVENUE;
    }
  }

  for (const building of state.buildings.values()) {
    if (!building.constructionLeft || building.constructionLeft <= 0) continue;
    building.constructionLeft = Math.max(0, building.constructionLeft - dtSeconds);
    if (building.constructionLeft === 0) {
      building.stats.status = "open";
      for (const citizen of state.citizens) {
        citizen.happiness = Math.min(100, citizen.happiness + 12);
      }
    }
  }

  if (state.vehicles.some((v) => v.path.length === 0)) {
    for (const vehicle of state.vehicles) {
      if (vehicle.path.length === 0) seedVehicle(state, vehicle, rand);
    }
  }

  syncCitizenSchedules(state);
  wanderOutdoors(state, rand);
  stepVehicles(state, dtSeconds, rand);
  stepCitizens(state, dtSeconds);
  tickBuildingStats(state);
}
