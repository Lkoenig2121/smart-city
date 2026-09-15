import { lodgingUse, type LodgingRoom } from "./lodging";
import { hash2 } from "./rng";
import type { Building } from "./types";

/** Seeded plot of The Riverside Hotel. */
export function isRiversideHotel(building: Building) {
  if (building.name === "The Riverside Hotel") return true;
  return building.origin.x === 17 && building.origin.y === 13 && lodgingUse(building) === "hotel";
}

/**
 * Street-facing decks. Every hotel gets them; residences and walk-up
 * apartments only when the plot hash says so, so the skyline stays mixed.
 */
export function hasExteriorBalconies(building: Building) {
  if (isRiversideHotel(building) || lodgingUse(building) === "hotel") return true;
  if (lodgingUse(building) === "residences") {
    return hash2(building.origin.x, building.origin.y, 21) > 0.22;
  }
  if (building.kind === "apartment") {
    return hash2(building.origin.x, building.origin.y, 21) > 0.42;
  }
  return false;
}

/**
 * Walk-out room terrace. Riverside always; other hotels skip every third
 * room; residences get a scatter so not every flat opens outside.
 */
export function roomHasInteriorBalcony(building: Building, room: LodgingRoom | null) {
  if (!room) return false;
  if (isRiversideHotel(building)) return true;
  if (!hasExteriorBalconies(building)) return false;
  if (lodgingUse(building) === "hotel") {
    const n = Number.parseInt(room.label.slice(-2), 10);
    if (Number.isFinite(n)) return n % 3 !== 0;
    return room.floor % 2 === 0;
  }
  return hash2(building.origin.x, room.floor, 33) > 0.48;
}
