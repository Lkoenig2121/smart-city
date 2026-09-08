import type { AgeId, BuildingKind, Terrain } from "@/lib/city/types";

export type Archetype =
  | "cave"
  | "campfire"
  | "tent"
  | "gather"
  | "hut"
  | "farm"
  | "pasture"
  | "well"
  | "granary"
  | "stall"
  | "stone_house"
  | "temple"
  | "arena"
  | "harbor"
  | "workshop"
  | "library"
  | "house"
  | "apartment"
  | "shop"
  | "office"
  | "skyscraper"
  | "tower"
  | "hospital"
  | "school"
  | "civic"
  | "firehouse"
  | "city_hall"
  | "pavilion";

export interface Placement {
  /** Terrain the footprint may sit on. */
  terrain?: Terrain[];
  /** At least one orthogonal neighbour must be one of these. */
  adjacentTo?: Terrain[];
}

export interface BuildingDef {
  id: BuildingKind;
  age: AgeId;
  name: string;
  label: string;
  icon: string;
  description: string;
  cost: number;
  footprint: { w: number; d: number };
  archetype: Archetype;
  palette: { wall: string; roof: string; accent: string };
  floors: number;
  /** Population this structure can shelter. */
  housing: number;
  /** Worker slots. Production scales with how many are filled. */
  jobs: number;
  /** Coins per second at full staffing. */
  coins: number;
  /** Civilization points per second at full staffing. */
  xp: number;
  /** Flat contribution to city happiness. */
  happiness: number;
  upgradesTo: BuildingKind | null;
  placement: Placement;
}

const BUILDABLE: Terrain[] = ["grass", "park", "plaza", "sand", "lot", "playground"];

function def(d: Partial<BuildingDef> & Pick<BuildingDef, "id" | "age" | "name" | "archetype">): BuildingDef {
  return {
    label: d.label ?? d.name,
    icon: d.icon ?? "◻",
    description: d.description ?? "",
    cost: d.cost ?? 0,
    footprint: d.footprint ?? { w: 1, d: 1 },
    palette: d.palette ?? { wall: "#d9c4a8", roof: "#8b3d2e", accent: "#3d5a80" },
    floors: d.floors ?? 1,
    housing: d.housing ?? 0,
    jobs: d.jobs ?? 0,
    coins: d.coins ?? 0,
    xp: d.xp ?? 0,
    happiness: d.happiness ?? 0,
    upgradesTo: d.upgradesTo ?? null,
    placement: d.placement ?? { terrain: BUILDABLE },
    ...d,
  } as BuildingDef;
}

export const CATALOG: Record<BuildingKind, BuildingDef> = {
  // ─── Stone Age ────────────────────────────────────────────────────────────
  cave: def({
    id: "cave",
    age: "stone",
    name: "Cave",
    label: "Shelter",
    icon: "🪨",
    description: "A dry hollow in the rock. Shelters a small family.",
    cost: 25,
    archetype: "cave",
    palette: { wall: "#8d8579", roof: "#6b6459", accent: "#4a4438" },
    housing: 3,
    xp: 0.02,
    happiness: 1,
    upgradesTo: "hut",
  }),
  campfire: def({
    id: "campfire",
    age: "stone",
    name: "Campfire",
    label: "Hearth",
    icon: "🔥",
    description: "Warmth and cooked food. The heart of the camp.",
    cost: 15,
    archetype: "campfire",
    palette: { wall: "#7a6a55", roof: "#c9622b", accent: "#ffb347" },
    xp: 0.05,
    happiness: 6,
  }),
  hunting_ground: def({
    id: "hunting_ground",
    age: "stone",
    name: "Hunting Ground",
    label: "Food",
    icon: "🦌",
    description: "Staked hides and drying racks. Trades meat for coin.",
    cost: 40,
    archetype: "gather",
    palette: { wall: "#8a7a5e", roof: "#5f5340", accent: "#c0a071" },
    jobs: 3,
    coins: 0.55,
    xp: 0.03,
  }),
  wood_camp: def({
    id: "wood_camp",
    age: "stone",
    name: "Gathering Camp",
    label: "Materials",
    icon: "🪵",
    description: "Woodcutters working the treeline.",
    cost: 30,
    archetype: "gather",
    palette: { wall: "#7d6a4f", roof: "#4f4534", accent: "#a3854f" },
    jobs: 2,
    coins: 0.4,
    xp: 0.02,
  }),
  fishing_spot: def({
    id: "fishing_spot",
    age: "stone",
    name: "Fishing Weir",
    label: "Food",
    icon: "🐟",
    description: "Woven traps in the shallows. Must touch the river.",
    cost: 35,
    archetype: "gather",
    palette: { wall: "#6f7f7a", roof: "#4a5a55", accent: "#9fc3b8" },
    jobs: 2,
    coins: 0.5,
    xp: 0.03,
    placement: { terrain: ["grass", "sand"], adjacentTo: ["water"] },
  }),
  shaman_tent: def({
    id: "shaman_tent",
    age: "stone",
    name: "Shaman's Tent",
    label: "Knowledge",
    icon: "⭐",
    description: "Stories, medicine, and the first ideas. Generates insight.",
    cost: 60,
    archetype: "tent",
    palette: { wall: "#9a7f63", roof: "#6d4f3a", accent: "#e0c078" },
    jobs: 1,
    coins: 0.05,
    xp: 0.25,
    happiness: 4,
  }),

  // ─── Agricultural Age ─────────────────────────────────────────────────────
  hut: def({
    id: "hut",
    age: "agricultural",
    name: "Thatched Hut",
    label: "Housing",
    icon: "🛖",
    description: "Timber and thatch. A real roof at last.",
    cost: 90,
    archetype: "hut",
    palette: { wall: "#c9a877", roof: "#7c5f3a", accent: "#5c4630" },
    housing: 6,
    xp: 0.03,
    happiness: 2,
    upgradesTo: "stone_house",
  }),
  farm: def({
    id: "farm",
    age: "agricultural",
    name: "Farm Plot",
    label: "Food",
    icon: "🌾",
    description: "Tilled rows of grain. The engine of the village.",
    cost: 140,
    archetype: "farm",
    palette: { wall: "#c8b06a", roof: "#8a6d3a", accent: "#e2cd86" },
    jobs: 5,
    coins: 1.6,
    xp: 0.08,
  }),
  pasture: def({
    id: "pasture",
    age: "agricultural",
    name: "Pasture",
    label: "Livestock",
    icon: "🐄",
    description: "Fenced grazing for cattle and goats.",
    cost: 160,
    archetype: "pasture",
    palette: { wall: "#8fae63", roof: "#6b5236", accent: "#c7d69b" },
    jobs: 4,
    coins: 1.5,
    xp: 0.07,
  }),
  well: def({
    id: "well",
    age: "agricultural",
    name: "Village Well",
    label: "Utility",
    icon: "💧",
    description: "Clean water in the square. Everyone is healthier.",
    cost: 70,
    archetype: "well",
    palette: { wall: "#9b968c", roof: "#6b5f4c", accent: "#7fb4c9" },
    xp: 0.06,
    happiness: 8,
  }),
  granary: def({
    id: "granary",
    age: "agricultural",
    name: "Granary",
    label: "Storage",
    icon: "🏚",
    description: "Stored surplus against a hard winter.",
    cost: 200,
    archetype: "granary",
    palette: { wall: "#cbb383", roof: "#75593a", accent: "#9c7c4c" },
    jobs: 2,
    coins: 0.4,
    xp: 0.1,
    happiness: 5,
  }),
  market_stall: def({
    id: "market_stall",
    age: "agricultural",
    name: "Market Stall",
    label: "Trade",
    icon: "🛒",
    description: "Barter turns into currency here.",
    cost: 180,
    archetype: "stall",
    palette: { wall: "#d9bf8e", roof: "#a2452f", accent: "#e8d6a8" },
    jobs: 3,
    coins: 2.1,
    xp: 0.12,
    happiness: 2,
  }),

  // ─── Ancient Age ──────────────────────────────────────────────────────────
  stone_house: def({
    id: "stone_house",
    age: "ancient",
    name: "Stone House",
    label: "Housing",
    icon: "🏠",
    description: "Mortared walls and a tiled roof. Built to last centuries.",
    cost: 320,
    archetype: "stone_house",
    palette: { wall: "#d5cdbc", roof: "#9c5a3c", accent: "#7a6a52" },
    floors: 2,
    housing: 10,
    xp: 0.04,
    happiness: 3,
    upgradesTo: "house",
  }),
  temple: def({
    id: "temple",
    age: "ancient",
    name: "Temple",
    label: "Faith",
    icon: "🏛",
    description: "Columns, incense, and civic pride.",
    cost: 700,
    footprint: { w: 2, d: 2 },
    archetype: "temple",
    palette: { wall: "#e6ddc8", roof: "#b6553c", accent: "#c9a44c" },
    floors: 2,
    jobs: 6,
    coins: 0.2,
    xp: 0.6,
    happiness: 14,
  }),
  arena: def({
    id: "arena",
    age: "ancient",
    name: "Arena",
    label: "Entertainment",
    icon: "🏟",
    description: "Games and spectacle. The crowd loves you.",
    cost: 900,
    footprint: { w: 3, d: 2 },
    archetype: "arena",
    palette: { wall: "#ded3bb", roof: "#8d7a5c", accent: "#b8863f" },
    floors: 2,
    jobs: 8,
    coins: 1.2,
    xp: 0.4,
    happiness: 18,
  }),
  harbor: def({
    id: "harbor",
    age: "ancient",
    name: "Harbor",
    label: "Trade",
    icon: "⛵",
    description: "Docks and warehouses. Wealth arrives by water.",
    cost: 850,
    footprint: { w: 2, d: 1 },
    archetype: "harbor",
    palette: { wall: "#b9a888", roof: "#6d5238", accent: "#8fa9b8" },
    jobs: 10,
    coins: 4.5,
    xp: 0.3,
    happiness: 3,
    placement: { terrain: ["grass", "sand", "plaza"], adjacentTo: ["water"] },
  }),
  workshop: def({
    id: "workshop",
    age: "ancient",
    name: "Workshop",
    label: "Industry",
    icon: "⚒",
    description: "Potters, smiths, and masons under one roof.",
    cost: 480,
    archetype: "workshop",
    palette: { wall: "#c2ac8c", roof: "#6b4a32", accent: "#8f5a2e" },
    jobs: 6,
    coins: 3.2,
    xp: 0.25,
  }),
  library: def({
    id: "library",
    age: "ancient",
    name: "Library",
    label: "Knowledge",
    icon: "📜",
    description: "Scrolls and scribes. Accelerates civilization.",
    cost: 620,
    footprint: { w: 2, d: 1 },
    archetype: "library",
    palette: { wall: "#e2d8c0", roof: "#7b6547", accent: "#c0a05c" },
    floors: 2,
    jobs: 5,
    xp: 0.9,
    happiness: 6,
  }),

  // ─── Modern Age (the Riverside target) ────────────────────────────────────
  house: def({
    id: "house",
    age: "modern",
    name: "House",
    label: "Residence",
    icon: "🏡",
    description: "Suburban home with a yard and a driveway.",
    cost: 1400,
    archetype: "house",
    palette: { wall: "#f3d7b5", roof: "#b5523a", accent: "#2f4a3a" },
    housing: 5,
    xp: 0.05,
    happiness: 3,
    upgradesTo: "apartment",
  }),
  apartment: def({
    id: "apartment",
    age: "modern",
    name: "Apartment Block",
    label: "Apartment",
    icon: "🏘",
    description: "Dense mid-rise housing.",
    cost: 5200,
    archetype: "apartment",
    palette: { wall: "#d8cfc4", roof: "#5c5348", accent: "#6b4f3a" },
    floors: 5,
    housing: 48,
    xp: 0.08,
    happiness: 2,
  }),
  shop: def({
    id: "shop",
    age: "modern",
    name: "Storefront",
    label: "Business",
    icon: "🏬",
    description: "Street-level retail.",
    cost: 2600,
    archetype: "shop",
    palette: { wall: "#f0d3b5", roof: "#6a3a32", accent: "#c0392b" },
    jobs: 14,
    coins: 6.5,
    xp: 0.1,
    happiness: 3,
    upgradesTo: "office",
  }),
  office: def({
    id: "office",
    age: "modern",
    name: "Office Building",
    label: "Offices",
    icon: "🏢",
    description: "Floors of desks and glass.",
    cost: 9800,
    archetype: "office",
    palette: { wall: "#8aa4b8", roof: "#3a4450", accent: "#d7e6f0" },
    floors: 6,
    jobs: 90,
    coins: 24,
    xp: 0.3,
    upgradesTo: "skyscraper",
  }),
  skyscraper: def({
    id: "skyscraper",
    age: "modern",
    name: "High-rise",
    label: "High-rise",
    icon: "🏙",
    description: "A serious tower on a serious plot.",
    cost: 42000,
    footprint: { w: 2, d: 2 },
    archetype: "skyscraper",
    palette: { wall: "#6f8ea3", roof: "#2a3138", accent: "#d5e8f4" },
    floors: 26,
    jobs: 420,
    coins: 96,
    xp: 1.1,
    happiness: 2,
    upgradesTo: "tower",
  }),
  tower: def({
    id: "tower",
    age: "modern",
    name: "Landmark Tower",
    label: "Landmark Tower",
    icon: "🗼",
    description: "The building the skyline is named after.",
    cost: 165000,
    footprint: { w: 2, d: 2 },
    archetype: "tower",
    palette: { wall: "#41566b", roof: "#20272e", accent: "#e2f1fb" },
    floors: 52,
    jobs: 1400,
    coins: 320,
    xp: 3.2,
    happiness: 8,
  }),
  hospital: def({
    id: "hospital",
    age: "modern",
    name: "Hospital",
    label: "Hospital",
    icon: "🏥",
    description: "Emergency care and inpatient beds.",
    cost: 32000,
    footprint: { w: 3, d: 3 },
    archetype: "hospital",
    palette: { wall: "#f4efe6", roof: "#d7e4ea", accent: "#c0392b" },
    floors: 4,
    jobs: 110,
    xp: 0.5,
    happiness: 16,
  }),
  school: def({
    id: "school",
    age: "modern",
    name: "School",
    label: "School",
    icon: "🏫",
    description: "Classrooms, a gym, and a playground.",
    cost: 14000,
    footprint: { w: 3, d: 2 },
    archetype: "school",
    palette: { wall: "#d9b48a", roof: "#6b3a32", accent: "#2f5d4a" },
    floors: 2,
    jobs: 40,
    xp: 0.8,
    happiness: 12,
  }),
  police: def({
    id: "police",
    age: "modern",
    name: "Police Station",
    label: "Police",
    icon: "🚓",
    description: "Patrol coverage for the surrounding district.",
    cost: 9800,
    footprint: { w: 2, d: 1 },
    archetype: "civic",
    palette: { wall: "#dfe6ee", roof: "#2c3e6b", accent: "#1d2d4f" },
    floors: 2,
    jobs: 28,
    xp: 0.2,
    happiness: 9,
  }),
  fire: def({
    id: "fire",
    age: "modern",
    name: "Fire Station",
    label: "Fire Station",
    icon: "🚒",
    description: "Engines ready to roll.",
    cost: 8600,
    footprint: { w: 2, d: 1 },
    archetype: "firehouse",
    palette: { wall: "#efe4d8", roof: "#8f2a22", accent: "#c0392b" },
    floors: 2,
    jobs: 18,
    xp: 0.2,
    happiness: 9,
  }),
  city_hall: def({
    id: "city_hall",
    age: "modern",
    name: "City Hall",
    label: "Government",
    icon: "🏛",
    description: "Where the budget gets argued over.",
    cost: 24000,
    footprint: { w: 2, d: 2 },
    archetype: "city_hall",
    palette: { wall: "#e6d8c4", roof: "#4a6d7c", accent: "#c9a44c" },
    floors: 3,
    jobs: 60,
    xp: 0.6,
    happiness: 10,
  }),
  park_pavilion: def({
    id: "park_pavilion",
    age: "modern",
    name: "Park Pavilion",
    label: "Park",
    icon: "🌳",
    description: "Shade, benches, and a place to breathe.",
    cost: 1200,
    archetype: "pavilion",
    palette: { wall: "#e8d7b8", roof: "#6b4a32", accent: "#3f5d4c" },
    xp: 0.05,
    happiness: 11,
  }),
};

export function buildingDef(kind: BuildingKind): BuildingDef {
  return CATALOG[kind];
}

export function buildingsForAge(age: AgeId): BuildingDef[] {
  return Object.values(CATALOG).filter((d) => d.age === age);
}

export function allDefs(): BuildingDef[] {
  return Object.values(CATALOG);
}
