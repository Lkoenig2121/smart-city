import type { BuildingKind, CityState } from "@/lib/city/types";

export interface Discovery {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  coins: number;
  xp: number;
  test: (state: CityState) => boolean;
}

function hasBuilt(state: CityState, kind: BuildingKind) {
  for (const building of state.buildings.values()) {
    if (building.kind === kind) return true;
  }
  return false;
}

function countKind(state: CityState, kind: BuildingKind) {
  let n = 0;
  for (const building of state.buildings.values()) {
    if (building.kind === kind) n += 1;
  }
  return n;
}

export const DISCOVERIES: Discovery[] = [
  {
    id: "fire",
    name: "Discovered Fire",
    blurb: "Warmth, cooked food, and a reason to gather after dark.",
    icon: "🔥",
    coins: 120,
    xp: 40,
    test: (s) => hasBuilt(s, "campfire"),
  },
  {
    id: "shelter",
    name: "First Shelter",
    blurb: "The clan sleeps out of the rain.",
    icon: "🪨",
    coins: 60,
    xp: 25,
    test: (s) => hasBuilt(s, "cave"),
  },
  {
    id: "hunting",
    name: "Organised Hunting",
    blurb: "Coordinated hunts feed far more mouths.",
    icon: "🦌",
    coins: 90,
    xp: 35,
    test: (s) => hasBuilt(s, "hunting_ground"),
  },
  {
    id: "fishing",
    name: "River Harvest",
    blurb: "The water gives as freely as the forest.",
    icon: "🐟",
    coins: 110,
    xp: 45,
    test: (s) => hasBuilt(s, "fishing_spot"),
  },
  {
    id: "language",
    name: "Story and Ritual",
    blurb: "Knowledge outlives the people who found it.",
    icon: "⭐",
    coins: 150,
    xp: 90,
    test: (s) => hasBuilt(s, "shaman_tent"),
  },
  {
    id: "clan",
    name: "A Real Clan",
    blurb: "Eighteen souls share one fire.",
    icon: "👥",
    coins: 250,
    xp: 120,
    test: (s) => s.population >= 18,
  },
  {
    id: "farming",
    name: "Discovered Farming",
    blurb: "Food you plant beats food you chase.",
    icon: "🌾",
    coins: 400,
    xp: 180,
    test: (s) => hasBuilt(s, "farm"),
  },
  {
    id: "domestication",
    name: "Animal Husbandry",
    blurb: "Herds that follow you are herds you keep.",
    icon: "🐄",
    coins: 420,
    xp: 190,
    test: (s) => hasBuilt(s, "pasture"),
  },
  {
    id: "village",
    name: "First Village",
    blurb: "Six huts and a well make a home.",
    icon: "🛖",
    coins: 600,
    xp: 260,
    test: (s) => countKind(s, "hut") >= 6,
  },
  {
    id: "commerce",
    name: "Invention of Trade",
    blurb: "Barter becomes currency at the market stalls.",
    icon: "🛒",
    coins: 700,
    xp: 300,
    test: (s) => hasBuilt(s, "market_stall"),
  },
  {
    id: "masonry",
    name: "Mastery of Stone",
    blurb: "Walls that will outlast everyone who raised them.",
    icon: "🧱",
    coins: 1200,
    xp: 520,
    test: (s) => hasBuilt(s, "stone_house"),
  },
  {
    id: "faith",
    name: "Age of Temples",
    blurb: "The city looks upward for the first time.",
    icon: "🏛",
    coins: 1600,
    xp: 800,
    test: (s) => hasBuilt(s, "temple"),
  },
  {
    id: "writing",
    name: "Invention of Writing",
    blurb: "The Great Library begins its collection.",
    icon: "📜",
    coins: 1800,
    xp: 1100,
    test: (s) => hasBuilt(s, "library"),
  },
  {
    id: "seafaring",
    name: "Seafaring",
    blurb: "Trade routes reach beyond the valley.",
    icon: "⛵",
    coins: 2200,
    xp: 900,
    test: (s) => hasBuilt(s, "harbor"),
  },
  {
    id: "heritage",
    name: "Keeper of History",
    blurb: "An original structure is protected as a monument.",
    icon: "🏺",
    coins: 800,
    xp: 600,
    test: (s) => [...s.buildings.values()].some((b) => b.preserved),
  },
];

export interface DiscoveryAward extends Discovery {
  awardedAt: number;
}

/** Grants any newly satisfied discoveries and returns them for the UI. */
export function claimDiscoveries(state: CityState): DiscoveryAward[] {
  const earned: DiscoveryAward[] = [];
  const owned = new Set(state.progression.discoveries);

  for (const discovery of DISCOVERIES) {
    if (owned.has(discovery.id)) continue;
    if (!discovery.test(state)) continue;
    state.progression.discoveries.push(discovery.id);
    state.progression.coins += discovery.coins;
    state.progression.xp += discovery.xp;
    state.progression.totalXp += discovery.xp;
    earned.push({ ...discovery, awardedAt: Date.now() });
  }

  return earned;
}
