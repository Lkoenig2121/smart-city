import { hash2 } from "@/lib/city/rng";
import { lodgingUse } from "@/lib/city/lodging";
import { isGameNight } from "@/lib/city/stadium";
import { MALL_DAILY_REVENUE, venueRole } from "@/lib/city/venues";
import type { Building, BuildingKind, CityState } from "@/lib/city/types";

export function isResidential(building: Building) {
  return (
    building.kind === "house" ||
    building.kind === "apartment" ||
    lodgingUse(building) === "residences"
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function wobble(building: Building, salt: number) {
  return (hash2(building.origin.x, building.origin.y, salt) - 0.5) * 8;
}

function occupancyFor(state: CityState, building: Building) {
  const hour = state.clock.minuteOfDay / 60;
  const weekday = state.clock.dayIndex < 5;
  const kind = building.kind;
  const hotel = lodgingUse(building) === "hotel";

  if (building.constructionLeft && building.constructionLeft > 0) return 0.08;
  if (isResidential(building) && !hotel) {
    if (hour < 6.5 || hour >= 21) return 0.9;
    if (weekday && hour >= 9 && hour < 16) return 0.38;
    return 0.68;
  }
  if (hotel) {
    if (hour < 7 || hour >= 22) return 0.82;
    if (hour >= 10 && hour < 16) return 0.48;
    return 0.64;
  }
  if (kind === "shop") {
    if (hour >= 10 && hour < 20) return 0.82;
    if (hour >= 8 && hour < 22) return 0.42;
    return 0.1;
  }
  if (kind === "school") {
    if (weekday && hour >= 7.5 && hour < 15.5) return 0.92;
    if (weekday && hour >= 15.5 && hour < 18) return 0.28;
    return 0.08;
  }
  if (kind === "baseball_stadium") {
    if (isGameNight(state)) return 0.88;
    if (hour >= 10 && hour < 16) return 0.22;
    return 0.12;
  }
  if (kind === "park_pavilion") {
    if (hour >= 10 && hour < 19) return 0.7;
    return 0.2;
  }
  if (kind === "subway_station") {
    if (hour >= 7 && hour < 9.5) return 0.9;
    if (hour >= 16.5 && hour < 19) return 0.86;
    if (hour >= 9.5 && hour < 21) return 0.45;
    return 0.12;
  }
  if (kind === "hospital" || kind === "police" || kind === "fire") {
    return hour >= 8 && hour < 20 ? 0.78 : 0.42;
  }
  // Offices, towers, city hall.
  if (!weekday) return hour >= 10 && hour < 16 ? 0.2 : 0.07;
  if (hour >= 8 && hour < 17) return 0.88;
  if (hour >= 7 && hour < 19) return 0.42;
  return 0.08;
}

function outputRate(kind: BuildingKind, hotel: boolean) {
  if (hotel) return 95;
  switch (kind) {
    case "shop":
      return 220;
    case "office":
      return 155;
    case "skyscraper":
      return 148;
    case "tower":
      return 142;
    case "hospital":
      return 90;
    case "baseball_stadium":
      return 85;
    case "subway_station":
      return 60;
    default:
      return 0;
  }
}

function parkingScore(state: CityState, building: Building, occupancy: number) {
  let lots = 0;
  let curb = 0;
  const pad = 4;
  const x0 = building.origin.x - pad;
  const y0 = building.origin.y - pad;
  const x1 = building.origin.x + building.width + pad;
  const y1 = building.origin.y + building.depth + pad;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const tile = state.tiles[y]?.[x];
      if (!tile) continue;
      if (tile.terrain === "lot") lots += 1;
      else if (tile.road && !tile.buildingId) curb += 1;
    }
  }
  const demand = Math.max(
    4,
    ((building.stats.jobs + building.stats.residents) * (0.35 + occupancy * 0.65)) / 9,
  );
  const supply = lots * 22 + curb * 1.5;
  return clamp(Math.round((supply / demand) * 100 + wobble(building, 11)), 28, 99);
}

/**
 * Refreshes live occupancy, daily output, energy, parking, and satisfaction.
 */
export function tickBuildingStats(state: CityState) {
  const hour = state.clock.minuteOfDay / 60;
  for (const building of state.buildings.values()) {
    const occupancy = occupancyFor(state, building);
    const hotel = lodgingUse(building) === "hotel";

    if (building.stats.jobs > 0) {
      const present = Math.round(building.stats.jobs * occupancy);
      building.stats.employees = clamp(present, hotel || building.stats.jobs > 4 ? 1 : 0, building.stats.jobs);
    }

    const rate = outputRate(building.kind, hotel);
    if (venueRole(building) === "mall") {
      const open = !(building.constructionLeft && building.constructionLeft > 0);
      building.stats.revenue = open ? Math.round(MALL_DAILY_REVENUE * (occupancy > 0.35 ? 1 : 0.4)) : 0;
    } else if (building.kind === "baseball_stadium") {
      building.stats.revenue = Math.round(15_000 * (occupancy > 0.5 ? 1 : 0.22));
    } else if (rate > 0) {
      building.stats.revenue = Math.round(building.stats.employees * rate);
    } else {
      building.stats.revenue = 0;
    }

    let energy = 26 + building.floors * 0.55 + occupancy * 50;
    if (isResidential(building) && !hotel && (hour >= 18 || hour < 7)) energy += 10;
    if (building.kind === "park_pavilion") energy = 18 + occupancy * 12;
    building.stats.energy = clamp(Math.round(energy + wobble(building, 3)), 16, 99);

    building.stats.parking = parkingScore(state, building, occupancy);

    const satisfaction =
      58 +
      occupancy * 16 +
      (building.stats.parking - 70) * 0.16 -
      Math.max(0, building.stats.energy - 92) * 0.5 +
      (building.kind === "park_pavilion" ? 14 : 0) +
      wobble(building, 29) * 0.35;
    building.stats.happiness = clamp(Math.round(satisfaction), 38, 99);

    if (occupancy >= 0.8) building.stats.status = "busy";
    else if (building.constructionLeft && building.constructionLeft > 0) building.stats.status = "closed";
    else building.stats.status = "open";
  }
}
