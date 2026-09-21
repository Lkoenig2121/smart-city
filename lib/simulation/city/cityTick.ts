import { advanceDay, formatDate, weekdayOf } from "@/lib/city/calendar";
import { mulberry32 } from "@/lib/city/rng";
import type { CityState } from "@/lib/city/types";
import { STADIUM_DAILY_REVENUE, stadiumIsOpen } from "@/lib/city/stadium";
import { tickBuildingStats } from "../buildings/buildingLogic";
import { stepCitizens, syncCitizenSchedules, wanderOutdoors } from "../citizens/citizenBehavior";
import { tickCityEvents } from "../events/cityEvents";
import { seedVehicle, stepVehicles } from "../traffic/vehicleMovement";
import { tickRoadNetwork } from "../traffic/roadNetwork";
import { SIM_MINUTES_PER_SECOND } from "../weather/weather";
import { abandonOpenShift, accrueBankInterest, payOvernightInterest, syncPlayerShift } from "@/lib/city/player";
import { syncCityMilestones } from "@/lib/city/cityProgress";

export function formatClock(state: CityState) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hour24 = Math.floor(state.clock.minuteOfDay / 60);
  const minute = Math.floor(state.clock.minuteOfDay % 60);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    day: days[state.clock.dayIndex],
    date: formatDate(state.clock.year, state.clock.dayOfYear),
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

/** Earliest you can turn in: 10:00 PM. Wake-up is 8:00 AM the following morning. */
export const SLEEP_AFTER_MINUTE = 22 * 60;
export const WAKE_MINUTE = 8 * 60;

export function canSleepNow(state: CityState) {
  const minute = state.clock.minuteOfDay;
  return minute >= SLEEP_AFTER_MINUTE || minute < WAKE_MINUTE;
}

/** Fast-forward overnight so the clock reads 8:00 AM. No-op if it isn't late enough. */
export function sleepUntilMorning(state: CityState) {
  if (!canSleepNow(state)) return { slept: false, interest: 0 };
  const originYear = state.clock.year;
  const originDay = state.clock.dayOfYear;
  const fromNight = state.clock.minuteOfDay >= SLEEP_AFTER_MINUTE;
  let remaining = fromNight
    ? 24 * 60 - state.clock.minuteOfDay + WAKE_MINUTE
    : WAKE_MINUTE - state.clock.minuteOfDay;
  const chunk = 30;
  try {
    while (remaining > 0.5) {
      const step = Math.min(chunk, remaining);
      tickCity(state, step / SIM_MINUTES_PER_SECOND, true, { skipInterest: true });
      remaining -= step;
    }
  } catch {
    // Still wake up and post interest if the overnight sim hiccups.
  }
  if (fromNight && state.clock.year === originYear && state.clock.dayOfYear === originDay) {
    const next = advanceDay(state.clock.year, state.clock.dayOfYear);
    state.clock.year = next.year;
    state.clock.dayOfYear = next.dayOfYear;
    state.clock.dayIndex = weekdayOf(state.clock.year, state.clock.dayOfYear);
  }
  state.clock.minuteOfDay = WAKE_MINUTE;
  abandonOpenShift();
  const { player, interest } = payOvernightInterest(state.clock);
  tickCity(state, 0, true, { skipInterest: true });
  return { slept: true, interest, player };
}

/** Advance the live city clock by a number of simulated minutes. */
export function skipCityMinutes(state: CityState, minutes: number) {
  if (minutes <= 0) return;
  tickCity(state, minutes / SIM_MINUTES_PER_SECOND);
}

export function tickCity(
  state: CityState,
  dtSeconds: number,
  seeded = true,
  options?: { skipInterest?: boolean },
) {
  const rand = seeded
    ? mulberry32((state.clock.dayIndex + 1) * 100000 + state.clock.minuteOfDay)
    : Math.random;

  state.clock.minuteOfDay += dtSeconds * SIM_MINUTES_PER_SECOND;
  let newDay = false;
  if (state.clock.minuteOfDay >= 24 * 60) {
    state.clock.minuteOfDay -= 24 * 60;
    const next = advanceDay(state.clock.year, state.clock.dayOfYear);
    state.clock.year = next.year;
    state.clock.dayOfYear = next.dayOfYear;
    state.clock.dayIndex = weekdayOf(state.clock.year, state.clock.dayOfYear);
    newDay = true;
    for (const building of state.buildings.values()) {
      if (stadiumIsOpen(building)) state.budget.treasury += STADIUM_DAILY_REVENUE;
    }
    if (!options?.skipInterest) accrueBankInterest(state.clock);
  }
  tickCityEvents(state, dtSeconds, rand, newDay);
  tickRoadNetwork(state, dtSeconds, rand);

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
  syncPlayerShift(state);
  syncCityMilestones(state);
}
