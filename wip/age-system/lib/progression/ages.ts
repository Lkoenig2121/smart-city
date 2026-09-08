import type { AgeId } from "@/lib/city/types";

export interface AgeRequirement {
  coins: number;
  xp: number;
  population: number;
}

export interface AgeDef {
  id: AgeId;
  index: number;
  name: string;
  tagline: string;
  startYear: number;
  /** In-world years that pass per real second while in this age. */
  yearsPerSecond: number;
  /** Radius of explorable land, in tiles, from the settlement origin. */
  revealRadius: number;
  /** Cost to leave this age. `null` on the final age. */
  advance: AgeRequirement | null;
  /** Whether the age has hand-authored content yet. */
  playable: boolean;
  sky: { top: string; bottom: string };
}

export const AGES: AgeDef[] = [
  {
    id: "stone",
    index: 0,
    name: "Stone Age",
    tagline: "Shelter, fire, and the first five souls",
    startYear: -10000,
    yearsPerSecond: 4,
    revealRadius: 7,
    advance: { coins: 1200, xp: 400, population: 18 },
    playable: true,
    sky: { top: "#7ea9c9", bottom: "#cfe0e4" },
  },
  {
    id: "agricultural",
    index: 1,
    name: "Agricultural Age",
    tagline: "Seed the valley and settle down",
    startYear: -6000,
    yearsPerSecond: 3,
    revealRadius: 11,
    advance: { coins: 4200, xp: 1500, population: 60 },
    playable: true,
    sky: { top: "#84b3d6", bottom: "#dbeae0" },
  },
  {
    id: "ancient",
    index: 2,
    name: "Ancient Age",
    tagline: "Stone streets, temples, and trade",
    startYear: -2000,
    yearsPerSecond: 2,
    revealRadius: 16,
    advance: { coins: 14000, xp: 5200, population: 160 },
    playable: true,
    sky: { top: "#7fb2dd", bottom: "#e3e7d8" },
  },
  {
    id: "medieval",
    index: 3,
    name: "Medieval Age",
    tagline: "Castles, walls, and kingdoms",
    startYear: 900,
    yearsPerSecond: 1.4,
    revealRadius: 21,
    advance: { coins: 46000, xp: 18000, population: 420 },
    playable: false,
    sky: { top: "#7aa8cc", bottom: "#dfe0d4" },
  },
  {
    id: "industrial",
    index: 4,
    name: "Industrial Age",
    tagline: "Steam, steel, and smoke",
    startYear: 1780,
    yearsPerSecond: 0.8,
    revealRadius: 27,
    advance: { coins: 140000, xp: 62000, population: 1200 },
    playable: false,
    sky: { top: "#8f9aa6", bottom: "#d6cec2" },
  },
  {
    id: "modern",
    index: 5,
    name: "Modern Age",
    tagline: "Riverside, at last",
    startYear: 1960,
    yearsPerSecond: 0.4,
    revealRadius: 34,
    advance: { coins: 480000, xp: 210000, population: 4200 },
    playable: false,
    sky: { top: "#79b7ea", bottom: "#d7edfb" },
  },
  {
    id: "smart",
    index: 6,
    name: "Smart City Age",
    tagline: "Sensors, grids, and autonomy",
    startYear: 2025,
    yearsPerSecond: 0.2,
    revealRadius: 40,
    advance: { coins: 1600000, xp: 720000, population: 12000 },
    playable: false,
    sky: { top: "#6fc0e8", bottom: "#e6f6fb" },
  },
  {
    id: "future",
    index: 7,
    name: "Future Age",
    tagline: "Spires, skyways, and the stars",
    startYear: 2140,
    yearsPerSecond: 0.1,
    revealRadius: 40,
    advance: null,
    playable: false,
    sky: { top: "#2b2f66", bottom: "#8f6fd8" },
  },
];

export const AGE_BY_ID = new Map(AGES.map((age) => [age.id, age]));

export function ageDef(id: AgeId): AgeDef {
  return AGE_BY_ID.get(id) ?? AGES[0];
}

export function ageIndex(id: AgeId) {
  return ageDef(id).index;
}

export function nextAge(id: AgeId): AgeDef | null {
  const current = ageDef(id);
  return AGES[current.index + 1] ?? null;
}

/** Civilization level derived from lifetime XP, on a gentle curve. */
export function civLevel(totalXp: number) {
  return Math.max(1, Math.floor(Math.sqrt(totalXp / 45)) + 1);
}

export function levelProgress(totalXp: number) {
  const level = civLevel(totalXp);
  const floor = Math.pow(level - 1, 2) * 45;
  const ceiling = Math.pow(level, 2) * 45;
  return {
    level,
    floor,
    ceiling,
    ratio: Math.min(1, Math.max(0, (totalXp - floor) / (ceiling - floor))),
  };
}

export function formatYear(year: number) {
  const rounded = Math.round(year);
  if (rounded < 0) return `${Math.abs(rounded).toLocaleString()} BC`;
  return `AD ${rounded.toLocaleString()}`;
}
