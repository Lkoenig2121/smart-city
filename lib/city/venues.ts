import type { Building, CityState } from "@/lib/city/types";
import { lodgingUse } from "./lodging";

export type VenueRole =
  | "hospital"
  | "school"
  | "city_hall"
  | "police"
  | "fire"
  | "office"
  | "shop"
  | "restaurant"
  | "bank"
  | "house"
  | "apartment";

const ROLES: VenueRole[] = [
  "hospital",
  "school",
  "city_hall",
  "police",
  "fire",
  "office",
  "shop",
  "restaurant",
  "bank",
  "house",
  "apartment",
];

export function isVenueRole(value: unknown): value is VenueRole {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export function venueRole(building: Building): VenueRole | null {
  if (lodgingUse(building)) return null;
  if (
    building.kind === "baseball_stadium" ||
    building.kind === "park_pavilion" ||
    building.kind === "subway_station"
  ) {
    return null;
  }
  const tagged = building.stats.extra?.venue;
  if (isVenueRole(tagged)) return tagged;
  if (building.kind === "hospital") return "hospital";
  if (building.kind === "school") return "school";
  if (building.kind === "city_hall") return "city_hall";
  if (building.kind === "police") return "police";
  if (building.kind === "fire") return "fire";
  return null;
}

export function isEnterableVenue(building: Building) {
  return venueRole(building) !== null;
}

export function enterableVenues(state: CityState) {
  return [...state.buildings.values()].filter(isEnterableVenue);
}

export function findVenue(state: CityState, id: string) {
  const building = state.buildings.get(id);
  return building && isEnterableVenue(building) ? building : null;
}

export function venueGateTile(building: Building) {
  return {
    x: building.origin.x + Math.floor(building.width / 2),
    y: building.origin.y + building.depth,
  };
}

export function markVenue(building: Building, role: VenueRole) {
  building.stats.extra = { ...building.stats.extra, venue: role };
  if (role === "bank") building.name = "Riverside Trust";
  if (role === "restaurant" && !building.name.toLowerCase().includes("kitchen")) {
    building.name = `${building.name} Kitchen`;
  }
}

export function venueLabel(role: VenueRole) {
  switch (role) {
    case "hospital":
      return "Hospital";
    case "school":
      return "School";
    case "city_hall":
      return "City Hall";
    case "police":
      return "Police";
    case "fire":
      return "Fire Station";
    case "office":
      return "Offices";
    case "shop":
      return "Store";
    case "restaurant":
      return "Restaurant";
    case "bank":
      return "Bank";
    case "house":
      return "Home";
    case "apartment":
      return "Apartment";
  }
}

export function venueEnterHint(role: VenueRole) {
  switch (role) {
    case "hospital":
      return "Enter for medical services";
    case "school":
      return "Enter to attend class";
    case "city_hall":
      return "Enter to manage the city";
    case "police":
      return "Enter the station";
    case "fire":
      return "Enter the firehouse";
    case "office":
      return "Go to work";
    case "shop":
      return "Come in and shop";
    case "restaurant":
      return "Come in to eat";
    case "bank":
      return "Enter for banking";
    case "house":
      return "Visit this home";
    case "apartment":
      return "Visit residents";
  }
}

/** Tags a small, deterministic subset of shops, offices, and homes. Civic buildings are enterable by kind. */
export function markNotableVenues(buildings: Map<string, Building>) {
  const list = [...buildings.values()].sort(
    (a, b) => a.origin.y - b.origin.y || a.origin.x - b.origin.x,
  );
  const shops = list.filter((b) => b.kind === "shop" && !b.stats.extra?.waterfront);
  if (shops[0]) markVenue(shops[0], "shop");
  if (shops[1]) markVenue(shops[1], "restaurant");
  if (shops[2]) markVenue(shops[2], "bank");
  if (shops[3]) markVenue(shops[3], "shop");
  if (shops[4]) markVenue(shops[4], "restaurant");

  const offices = list.filter((b) => b.kind === "office");
  for (const building of offices.slice(0, 2)) markVenue(building, "office");

  const towers = list.filter(
    (b) => (b.kind === "skyscraper" || b.kind === "tower") && !lodgingUse(b),
  );
  for (const building of towers.slice(0, 2)) markVenue(building, "office");

  const houses = list.filter((b) => b.kind === "house" && !b.stats.extra?.waterfront);
  for (const building of houses.slice(0, 3)) markVenue(building, "house");

  const apartments = list.filter((b) => b.kind === "apartment" && !b.stats.extra?.waterfront);
  for (const building of apartments.slice(0, 2)) markVenue(building, "apartment");
}
