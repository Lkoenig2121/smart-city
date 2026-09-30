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
  | "mall"
  | "dealership"
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
  "mall",
  "dealership",
  "house",
  "apartment",
];

export function isVenueRole(value: unknown): value is VenueRole {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export function venueRole(building: Building): VenueRole | null {
  if (lodgingUse(building)) return null;
  const tagged = building.stats.extra?.venue;
  if (isVenueRole(tagged)) return tagged;
  if (
    building.kind === "baseball_stadium" ||
    building.kind === "park_pavilion" ||
    building.kind === "subway_station"
  ) {
    return null;
  }
  if (building.kind === "hospital") return "hospital";
  if (building.kind === "school") return "school";
  if (building.kind === "city_hall") return "city_hall";
  if (building.kind === "police") return "police";
  if (building.kind === "fire") return "fire";
  if (building.kind === "office") return "office";
  return null;
}

/** Make every non-lodging building enterable (Dustfall / full-city pass). */
export function markAllEnterableVenues(buildings: Map<string, Building>) {
  let shopI = 0;
  for (const building of [...buildings.values()].sort(
    (a, b) => a.origin.y - b.origin.y || a.origin.x - b.origin.x,
  )) {
    if (lodgingUse(building)) continue;
    if (venueRole(building)) continue;

    switch (building.kind) {
      case "shop":
        if (shopI === 0) markVenue(building, "bank", building.name || "Desert Ledger");
        else if (shopI % 2 === 1) markVenue(building, "restaurant");
        else markVenue(building, "shop");
        shopI += 1;
        break;
      case "house":
        markVenue(building, "house");
        break;
      case "apartment":
        markVenue(building, "apartment");
        break;
      case "tower":
      case "skyscraper":
        markVenue(building, "office");
        break;
      case "park_pavilion":
        markVenue(building, "shop", building.name);
        break;
      default:
        break;
    }
  }
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

export function findMall(state: CityState) {
  for (const building of state.buildings.values()) {
    if (venueRole(building) === "mall") return building;
  }
  return null;
}

export function findDealership(state: CityState) {
  for (const building of state.buildings.values()) {
    if (venueRole(building) === "dealership") return building;
  }
  return null;
}

export function markDealership(building: Building, name = "Riverside Motors") {
  markVenue(building, "dealership", name);
  building.wallColor = "#ff5c8a";
  building.roofColor = "#2a3038";
  building.accentColor = "#ffe0ea";
  building.floors = Math.max(building.floors, 2);
}

export const MALL_FOOTPRINT = { w: 8, d: 8 };
export const MALL_COST = 480_000;
export const MALL_BUILD_SECONDS = 24;
export const MALL_DAILY_REVENUE = 100_000;

export function mallPlacementError(state: CityState, x: number, y: number): string | null {
  if (findMall(state)) return "The city already has a mall · bulldoze it to place another";
  const { w, d } = MALL_FOOTPRINT;
  for (let dy = 0; dy < d; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tile = state.tiles[y + dy]?.[x + dx];
      if (!tile) return "Needs a clear 8×8 plot";
      if (tile.road || tile.buildingId || tile.terrain === "water") {
        return "Needs a clear 8×8 plot (no road, water, or building)";
      }
    }
  }
  if (state.budget.treasury < MALL_COST) {
    return `Costs $${(MALL_COST / 1000).toFixed(0)}K — treasury is short`;
  }
  return null;
}

export function markVenue(building: Building, role: VenueRole, name?: string) {
  building.stats.extra = { ...building.stats.extra, venue: role };
  if (name) building.name = name;
}

const BANK_NAMES = [
  "Riverside Trust",
  "Northline Savings",
  "Harbor Credit Union",
  "Cedar Street Bank",
  "Plaza National",
  "Westbank Mutual",
  "Helio Savings",
  "Pioneer Ledger",
];

export function nextBankName(state: CityState) {
  const used = new Set(
    [...state.buildings.values()].filter((building) => venueRole(building) === "bank").map((building) => building.name),
  );
  const open = BANK_NAMES.find((name) => !used.has(name));
  if (open) return open;
  return `${BANK_NAMES[used.size % BANK_NAMES.length]} ${used.size + 1}`;
}

export function markBank(building: Building, name?: string) {
  markVenue(building, "bank", name);
  building.wallColor = "#e6eee8";
  building.roofColor = "#2f5d4a";
  building.accentColor = "#c9a44c";
  building.stats.jobs = Math.max(building.stats.jobs, 16);
  building.stats.employees = Math.max(building.stats.employees, 12);
  building.stats.revenue = Math.max(building.stats.revenue, 3800);
}

export function isPizzeria(building: Building) {
  return building.stats.extra?.cuisine === "pizzeria";
}

export function markPizzeria(building: Building, name = "That's Amore") {
  markVenue(building, "restaurant", name);
  building.stats.extra = { ...building.stats.extra, cuisine: "pizzeria" };
  building.wallColor = "#f4efe6";
  building.roofColor = "#c0392b";
  building.accentColor = "#2f7a3e";
  building.stats.jobs = Math.max(building.stats.jobs, 14);
  building.stats.employees = Math.max(building.stats.employees, 10);
}

export function markMall(building: Building, name = "Harbor Mall") {
  markVenue(building, "mall", name);
  building.wallColor = "#ead9c4";
  building.roofColor = "#6a3a32";
  building.accentColor = "#c9a44c";
  building.floors = Math.max(building.floors, 3);
  building.stats.jobs = Math.max(building.stats.jobs, 120);
  building.stats.employees = Math.max(building.stats.employees, 90);
  building.stats.revenue = Math.max(building.stats.revenue, MALL_DAILY_REVENUE);
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
    case "mall":
      return "Mall";
    case "dealership":
      return "Dealership";
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
    case "mall":
      return "Enter the mall";
    case "dealership":
      return "Browse vehicles";
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
  const reserved = (b: Building) => {
    const role = venueRole(b);
    return role === "mall" || role === "dealership" || role === "bank" || isPizzeria(b);
  };
  const shops = list.filter(
    (b) => b.kind === "shop" && !b.stats.extra?.waterfront && !reserved(b),
  );
  if (shops[0]) markVenue(shops[0], "shop");
  if (shops[1]) markVenue(shops[1], "restaurant");
  if (shops[2]) markBank(shops[2], "Riverside Trust");
  if (shops[3]) markVenue(shops[3], "shop");
  if (shops[4]) markVenue(shops[4], "restaurant");
  if (!list.some((building) => venueRole(building) === "mall")) {
    const harborMall = shops.find((_, i) => i > 4);
    if (harborMall) markMall(harborMall, "Harbor Mall");
  }
  const secondBank = shops.find((shop, i) => i > 4 && venueRole(shop) !== "mall" && venueRole(shop) !== "dealership");
  if (secondBank) markBank(secondBank, "Northline Savings");

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
