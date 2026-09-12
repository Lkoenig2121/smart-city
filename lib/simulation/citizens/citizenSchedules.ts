import type { Citizen, CitizenActivity, CitizenRole, CityState } from "@/lib/city/types";
import { lodgingUse } from "@/lib/city/lodging";
import { venueRole } from "@/lib/city/venues";

export type DayPart = "morning" | "work" | "evening" | "night";

export function dayPartFromHour(hour: number): DayPart {
  if (hour < 6) return "night";
  if (hour < 8) return "morning";
  if (hour < 17) return "work";
  if (hour < 21) return "evening";
  return "night";
}

/** Small per-person offset so the whole city does not turn at the same minute. */
export function staggeredHour(state: CityState, citizen: Citizen) {
  const n = Number.parseInt(citizen.id.replace(/\D/g, ""), 10);
  const shift = Number.isFinite(n) ? ((n % 9) - 4) * 0.18 : 0;
  return state.clock.minuteOfDay / 60 - shift;
}

/**
 * Daily loop for each citizen type. Indoor stops hide them; outdoor stops
 * stay on the sidewalk so the city still reads as busy.
 */
export function scheduledActivity(state: CityState, citizen: Citizen): CitizenActivity {
  const hour = staggeredHour(state, citizen);
  const weekend = state.clock.dayIndex >= 5;
  return schedule(citizen.role, hour, weekend);
}

function schedule(role: CitizenRole, hour: number, weekend: boolean): CitizenActivity {
  if (role === "worker") {
    if (hour < 6.4 || hour >= 22) return "sleep";
    if (weekend) {
      if (hour < 10.5) return "home";
      if (hour < 14) return "park";
      if (hour < 16.5) return "restaurant";
      return "home";
    }
    if (hour < 7.1) return "home";
    if (hour < 17) return "work";
    if (hour < 19.2) return "restaurant";
    return "home";
  }

  if (role === "family") {
    if (hour < 6.5 || hour >= 21.4) return "sleep";
    if (weekend) {
      if (hour < 10) return "home";
      if (hour < 13) return "park";
      if (hour < 15) return "restaurant";
      if (hour < 18) return "park";
      return "home";
    }
    if (hour < 9) return "school";
    if (hour < 15.4) return "work";
    if (hour < 18.6) return "park";
    return "home";
  }

  if (role === "shopper") {
    if (hour < 7 || hour >= 22) return "sleep";
    if (hour < 10) return "home";
    if (hour < 15.5) return "shop";
    if (hour < 17.8) return "restaurant";
    return "home";
  }

  if (role === "student") {
    if (hour < 7 || hour >= 21) return "sleep";
    if (weekend) {
      if (hour < 11) return "home";
      if (hour < 16) return "library";
      if (hour < 18) return "park";
      return "home";
    }
    if (hour < 15) return "school";
    if (hour < 18) return "library";
    return "home";
  }

  // Tourist: hotel → stadium → restaurant → hotel
  if (hour < 7.4 || hour >= 23) return "sleep";
  if (hour < 10) return "hotel";
  if (hour < 16.2) return "stadium";
  if (hour < 19.2) return "restaurant";
  return "hotel";
}

export function citizenIsOutdoors(citizen: { activity: CitizenActivity; path: { x: number; y: number }[] }) {
  if (citizen.path.length >= 2) return true;
  return (
    citizen.activity === "park" ||
    citizen.activity === "shop" ||
    citizen.activity === "restaurant" ||
    citizen.activity === "stadium"
  );
}

export function homesOf(state: Pick<CityState, "buildings">) {
  return [...state.buildings.values()].filter(
    (b) => b.kind === "house" || b.kind === "apartment" || lodgingUse(b) === "residences",
  );
}

export function hotelsOf(state: Pick<CityState, "buildings">) {
  return [...state.buildings.values()].filter((b) => lodgingUse(b) === "hotel");
}

export function jobsOf(state: Pick<CityState, "buildings">) {
  return [...state.buildings.values()].filter((b) =>
    ["office", "shop", "skyscraper", "tower", "hospital", "school", "police", "fire", "city_hall"].includes(
      b.kind,
    ),
  );
}

export function schoolsOf(state: Pick<CityState, "buildings">) {
  return [...state.buildings.values()].filter((b) => b.kind === "school");
}

export function shopsOf(state: Pick<CityState, "buildings">) {
  return [...state.buildings.values()].filter(
    (b) => b.kind === "shop" && venueRole(b) !== "restaurant",
  );
}

export function restaurantsOf(state: Pick<CityState, "buildings">) {
  const tagged = [...state.buildings.values()].filter((b) => venueRole(b) === "restaurant");
  if (tagged.length) return tagged;
  return [...state.buildings.values()].filter((b) => b.kind === "shop");
}

export function librariesOf(state: Pick<CityState, "buildings">) {
  const halls = [...state.buildings.values()].filter((b) => b.kind === "city_hall");
  if (halls.length) return halls;
  return schoolsOf(state);
}

export function stadiumsOf(state: Pick<CityState, "buildings">) {
  return [...state.buildings.values()].filter((b) => b.kind === "baseball_stadium");
}

export function parkRoads(): { x: number; y: number }[] {
  return [
    { x: 16, y: 24 },
    { x: 20, y: 26 },
    { x: 22, y: 28 },
    { x: 18, y: 29 },
    { x: 24, y: 24 },
  ];
}
