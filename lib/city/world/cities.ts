import { generateCity } from "@/lib/city/generateCity";
import { generateDustfall } from "@/lib/city/generateDustfall";
import { generateStubCity } from "@/lib/city/generateStubCity";
import type { CityState } from "@/lib/city/types";

export const CITY_IDS = [
  "riverside",
  "dustfall",
  "mountain",
  "coastal",
  "future",
] as const;

export type CityId = (typeof CITY_IDS)[number];

export type CityEnvironment = "river" | "desert" | "mountain" | "coast" | "future";

/** Visual / climate knobs shared by iso, street, and lodging. */
export interface CityTheme {
  daySky: string;
  nightSky: string;
  fogDay: number;
  fogNight: number;
  /** Iso renderer sky/tint mix toward desert warmth. */
  isoWarmth: number;
  /** Lodging / street “desert” accent palette. */
  desertAccent: boolean;
  /** Waterfront uses Nile/ferris pad instead of promenade. */
  waterfront: "promenade" | "nile";
  climateLabel: string;
}

export interface CityDefinition {
  id: CityId;
  name: string;
  blurb: string;
  environment: CityEnvironment;
  /** null = stub / not playable yet */
  generate: (() => CityState) | null;
  theme: CityTheme;
  /** Discovered on a fresh save. */
  startUnlocked: boolean;
  /** Character level that discovers this city (null = story / other gate). */
  unlockLevel: number | null;
  /** World Map node position (percent of map box). */
  mapX: number;
  mapY: number;
}

const RIVERSIDE_THEME: CityTheme = {
  daySky: "#7eb3e0",
  nightSky: "#10182c",
  fogDay: 0x7eb3e0,
  fogNight: 0x10182c,
  isoWarmth: 0,
  desertAccent: false,
  waterfront: "promenade",
  climateLabel: "Temperate harbor",
};

const DUSTFALL_THEME: CityTheme = {
  daySky: "#e8b86a",
  nightSky: "#10182c",
  fogDay: 0xe8b86a,
  fogNight: 0x10182c,
  isoWarmth: 1,
  desertAccent: true,
  waterfront: "nile",
  climateLabel: "Arid desert",
};

const MOUNTAIN_THEME: CityTheme = {
  daySky: "#a8c4d8",
  nightSky: "#10182c",
  fogDay: 0xa8c4d8,
  fogNight: 0x10182c,
  isoWarmth: 0,
  desertAccent: false,
  waterfront: "promenade",
  climateLabel: "Alpine",
};

const COASTAL_THEME: CityTheme = {
  daySky: "#6eb8e0",
  nightSky: "#10182c",
  fogDay: 0x6eb8e0,
  fogNight: 0x10182c,
  isoWarmth: 0.15,
  desertAccent: false,
  waterfront: "promenade",
  climateLabel: "Maritime",
};

const FUTURE_THEME: CityTheme = {
  daySky: "#7eb0e8",
  nightSky: "#1a1040",
  fogDay: 0xa8c8f0,
  fogNight: 0x1a1040,
  isoWarmth: 0.08,
  desertAccent: false,
  waterfront: "promenade",
  climateLabel: "Synthetic",
};

export const CITIES: Record<CityId, CityDefinition> = {
  riverside: {
    id: "riverside",
    name: "Riverside",
    blurb: "Developed modern city on the harbor.",
    environment: "river",
    generate: () => generateCity(),
    theme: RIVERSIDE_THEME,
    startUnlocked: true,
    unlockLevel: null,
    mapX: 50,
    mapY: 48,
  },
  dustfall: {
    id: "dustfall",
    name: "Dustfall",
    blurb: "Desert town beyond the dunes.",
    environment: "desert",
    generate: () => generateDustfall(),
    theme: DUSTFALL_THEME,
    startUnlocked: true,
    unlockLevel: null,
    mapX: 18,
    mapY: 48,
  },
  mountain: {
    id: "mountain",
    name: "Mountain City",
    blurb: "Alpine downtown · ski country.",
    environment: "mountain",
    generate: () => generateStubCity("mountain"),
    theme: MOUNTAIN_THEME,
    startUnlocked: true,
    unlockLevel: null,
    mapX: 50,
    mapY: 14,
  },
  coastal: {
    id: "coastal",
    name: "Coastal City",
    blurb: "Beach · marina · boardwalk.",
    environment: "coast",
    generate: () => generateStubCity("coastal"),
    theme: COASTAL_THEME,
    startUnlocked: true,
    unlockLevel: null,
    mapX: 82,
    mapY: 48,
  },
  future: {
    id: "future",
    name: "Future City",
    blurb: "Neon crossing · dense towers · LED canyon.",
    environment: "future",
    generate: () => generateStubCity("future"),
    theme: FUTURE_THEME,
    startUnlocked: true,
    unlockLevel: null,
    mapX: 50,
    mapY: 84,
  },
};

export function getCityDef(id: string): CityDefinition | null {
  if ((CITY_IDS as readonly string[]).includes(id)) {
    return CITIES[id as CityId];
  }
  return null;
}

export function isCityId(value: unknown): value is CityId {
  return typeof value === "string" && (CITY_IDS as readonly string[]).includes(value);
}

export function isPlayableCity(id: CityId): boolean {
  return CITIES[id].generate != null;
}

export function cityThemeFor(stateId: string): CityTheme {
  return getCityDef(stateId)?.theme ?? RIVERSIDE_THEME;
}

export function parseCityId(value: unknown, fallback: CityId = "riverside"): CityId {
  return isCityId(value) ? value : fallback;
}

/** Cities unlocked on a fresh save (every startUnlocked entry). */
export function defaultDiscoveredCities(): CityId[] {
  return CITY_IDS.filter((id) => CITIES[id].startUnlocked);
}

export function parseDiscoveredCities(value: unknown, dustfallUnlockedLegacy?: boolean): CityId[] {
  const set = new Set<CityId>(defaultDiscoveredCities());
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isCityId(item)) set.add(item);
    }
  }
  if (dustfallUnlockedLegacy) set.add("dustfall");
  // Always include every currently start-unlocked city (migration when more open up).
  for (const id of defaultDiscoveredCities()) set.add(id);
  return CITY_IDS.filter((id) => set.has(id));
}
