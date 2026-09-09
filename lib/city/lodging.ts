import type { Building, CityState } from "@/lib/city/types";

export type LodgingUse = "hotel" | "residences";
export type LodgingZone = "lobby" | "room" | "pool";

const KEYS_STORAGE = "smartcity-lodging-keys";

export function lodgingUse(building: Building): LodgingUse | null {
  const value = building.stats.extra?.lodging;
  if (value === "hotel" || value === "residences") return value;
  return null;
}

export function isLodging(building: Building) {
  return lodgingUse(building) !== null;
}

export function lodgingBuildings(state: CityState) {
  return [...state.buildings.values()].filter(isLodging);
}

export function findLodging(state: CityState, id: string) {
  const building = state.buildings.get(id);
  return building && isLodging(building) ? building : null;
}

/** Tile just south of the tower, toward the downtown streets. */
export function lodgingGateTile(building: Building) {
  return {
    x: building.origin.x + Math.floor(building.width / 2),
    y: building.origin.y + building.depth,
  };
}

export function markLodging(building: Building, use: LodgingUse) {
  building.stats.extra = {
    ...building.stats.extra,
    lodging: use,
    ...(use === "hotel"
      ? { rooms: 240, nightly: "$189" }
      : { homes: 186, amenities: "Roof deck" }),
  };
  if (use === "hotel") {
    building.wallColor = "#d8c4a8";
    building.roofColor = "#2a2420";
    building.accentColor = "#c9a44c";
    building.name = building.origin.x === 21 ? "The Helio Grand" : "The Riverside Hotel";
  } else {
    building.wallColor = "#c4b09a";
    building.roofColor = "#3a322c";
    building.accentColor = "#8a5a3a";
    building.name = building.origin.y === 6 ? "Harbor House" : "Plaza Residences";
  }
}

export function lodgingLabel(building: Building) {
  return lodgingUse(building) === "hotel" ? "Hotel" : "Residences";
}

function readKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEYS_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function hasLodgingKey(buildingId: string) {
  return readKeys().includes(buildingId);
}

export function grantLodgingKey(buildingId: string) {
  if (typeof window === "undefined") return;
  const next = new Set(readKeys());
  next.add(buildingId);
  window.localStorage.setItem(KEYS_STORAGE, JSON.stringify([...next]));
}
