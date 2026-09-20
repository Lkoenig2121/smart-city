import {
  awardXp,
  formatDollars,
  readPlayer,
  writePlayer,
  type PlayerState,
} from "@/lib/city/player";

const STORAGE = "smartcity-development";

/** Extensible city ids — Riverside & Dustfall today; more regions later. */
export type DevCityId = string;

export type ProjectStatus = "locked" | "available" | "active" | "completed";

export type DevCategory =
  | "infrastructure"
  | "transportation"
  | "residential"
  | "commercial"
  | "industrial"
  | "services";

export interface CategoryScores {
  infrastructure: number;
  transportation: number;
  residential: number;
  commercial: number;
  industrial: number;
  services: number;
}

export interface CityDevelopmentSnapshot {
  cityId: DevCityId;
  name: string;
  categories: CategoryScores;
  overall: number;
  populationHint: number;
  businessesHint: number;
}

export type HighwayRepairStepId = "visit" | "materials" | "repair" | "inspect";

export interface ProjectDef {
  id: string;
  cityId: DevCityId;
  name: string;
  description: string;
  category: DevCategory;
  /** Category deltas applied once on completion. */
  impact: Partial<CategoryScores>;
  rewardCash: number;
  rewardXp: number;
  steps: { id: HighwayRepairStepId | string; label: string }[];
}

export interface ProjectProgress {
  status: ProjectStatus;
  steps: Record<string, boolean>;
  rewarded: boolean;
}

export interface DevelopmentSave {
  cities: Record<
    string,
    {
      /** Bonuses from completed projects (added to baseline). */
      bonus: Partial<CategoryScores>;
      projects: Record<string, ProjectProgress>;
    }
  >;
}

const WEIGHTS: Record<DevCategory, number> = {
  infrastructure: 1.15,
  transportation: 1.1,
  residential: 1,
  commercial: 1,
  industrial: 0.85,
  services: 0.9,
};

const BASELINES: Record<
  string,
  { name: string; categories: CategoryScores; populationHint: number; businessesHint: number }
> = {
  riverside: {
    name: "Riverside",
    categories: {
      infrastructure: 42,
      transportation: 38,
      residential: 48,
      commercial: 44,
      industrial: 28,
      services: 40,
    },
    populationHint: 12_400,
    businessesHint: 86,
  },
  dustfall: {
    name: "Dustfall",
    categories: {
      infrastructure: 10,
      transportation: 8,
      residential: 6,
      commercial: 14,
      industrial: 18,
      services: 12,
    },
    populationHint: 45,
    businessesHint: 8,
  },
};

export const HIGHWAY_REPAIR_ID = "dustfall-highway-repair";

/** Mid-corridor construction site (tile space on Highway 93 map). */
export const HIGHWAY_REPAIR_SITE = {
  /** Progress along corridor 0→1 (Dustfall-bound). */
  progress: 0.48,
  collectRadius: 0.06,
};

export const PROJECT_CATALOG: ProjectDef[] = [
  {
    id: HIGHWAY_REPAIR_ID,
    cityId: "dustfall",
    name: "Repair Dustfall Highway",
    description:
      "Restore Highway 93 between Riverside and Dustfall. Fix the mid-desert construction zone so traffic can flow again.",
    category: "infrastructure",
    impact: {
      infrastructure: 4,
      transportation: 6,
    },
    rewardCash: 900,
    rewardXp: 120,
    steps: [
      { id: "visit", label: "Visit the highway construction site" },
      { id: "materials", label: "Collect construction materials at the site" },
      { id: "repair", label: "Complete the repair work" },
      { id: "inspect", label: "Inspect the repaired roadway" },
    ],
  },
];

function emptyCityProgress() {
  return { bonus: {} as Partial<CategoryScores>, projects: {} as Record<string, ProjectProgress> };
}

function emptySave(): DevelopmentSave {
  return { cities: {} };
}

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mergeCategories(base: CategoryScores, bonus: Partial<CategoryScores>): CategoryScores {
  return {
    infrastructure: clampScore(base.infrastructure + (bonus.infrastructure ?? 0)),
    transportation: clampScore(base.transportation + (bonus.transportation ?? 0)),
    residential: clampScore(base.residential + (bonus.residential ?? 0)),
    commercial: clampScore(base.commercial + (bonus.commercial ?? 0)),
    industrial: clampScore(base.industrial + (bonus.industrial ?? 0)),
    services: clampScore(base.services + (bonus.services ?? 0)),
  };
}

function overallFrom(categories: CategoryScores) {
  let sum = 0;
  let w = 0;
  for (const key of Object.keys(WEIGHTS) as DevCategory[]) {
    sum += categories[key] * WEIGHTS[key];
    w += WEIGHTS[key];
  }
  return clampScore(sum / Math.max(1, w));
}

function emptyProjectProgress(def: ProjectDef): ProjectProgress {
  const steps: Record<string, boolean> = {};
  for (const step of def.steps) steps[step.id] = false;
  return { status: "locked", steps, rewarded: false };
}

export function readDevelopment(): DevelopmentSave {
  if (typeof window === "undefined") return emptySave();
  try {
    const raw = window.localStorage.getItem(STORAGE);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as Partial<DevelopmentSave>;
    const cities: DevelopmentSave["cities"] = {};
    if (parsed.cities && typeof parsed.cities === "object") {
      for (const [id, entry] of Object.entries(parsed.cities)) {
        cities[id] = {
          bonus: { ...(entry?.bonus ?? {}) },
          projects: { ...(entry?.projects ?? {}) },
        };
      }
    }
    return { cities };
  } catch {
    return emptySave();
  }
}

export function writeDevelopment(save: DevelopmentSave) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE, JSON.stringify(save));
}

function ensureCity(save: DevelopmentSave, cityId: DevCityId) {
  if (!save.cities[cityId]) save.cities[cityId] = emptyCityProgress();
  return save.cities[cityId];
}

function ensureProject(save: DevelopmentSave, def: ProjectDef) {
  const city = ensureCity(save, def.cityId);
  if (!city.projects[def.id]) {
    city.projects[def.id] = emptyProjectProgress(def);
  } else {
    const progress = city.projects[def.id];
    for (const step of def.steps) {
      if (progress.steps[step.id] === undefined) progress.steps[step.id] = false;
    }
  }
  return city.projects[def.id];
}

function resolveStatus(
  def: ProjectDef,
  progress: ProjectProgress,
  player: PlayerState,
): ProjectStatus {
  if (progress.status === "completed") return "completed";
  if (progress.status === "active") return "active";
  if (def.id === HIGHWAY_REPAIR_ID) {
    return player.dustfallUnlocked ? "available" : "locked";
  }
  return progress.status === "available" ? "available" : "locked";
}

export function cityDevelopment(cityId: DevCityId): CityDevelopmentSnapshot {
  const base = BASELINES[cityId] ?? {
    name: cityId,
    categories: {
      infrastructure: 10,
      transportation: 10,
      residential: 10,
      commercial: 10,
      industrial: 10,
      services: 10,
    },
    populationHint: 0,
    businessesHint: 0,
  };
  const save = readDevelopment();
  const city = save.cities[cityId];
  const categories = mergeCategories(base.categories, city?.bonus ?? {});
  const completed = Object.values(city?.projects ?? {}).filter((p) => p.status === "completed").length;
  return {
    cityId,
    name: base.name,
    categories,
    overall: overallFrom(categories),
    populationHint: base.populationHint + completed * (cityId === "dustfall" ? 40 : 120),
    businessesHint: base.businessesHint + completed * (cityId === "dustfall" ? 2 : 4),
  };
}

export function findProject(projectId: string) {
  return PROJECT_CATALOG.find((p) => p.id === projectId) ?? null;
}

export function projectsForCity(cityId: DevCityId, player: PlayerState = readPlayer()) {
  const save = readDevelopment();
  return PROJECT_CATALOG.filter((p) => p.cityId === cityId).map((def) => {
    const progress = ensureProject(save, def);
    const status = resolveStatus(def, progress, player);
    progress.status = status === "locked" && progress.status !== "completed" ? "locked" : status;
    const steps = def.steps.map((step) => ({
      ...step,
      done: Boolean(progress.steps[step.id]),
    }));
    return {
      def,
      status: progress.status,
      steps,
      rewarded: progress.rewarded,
      allStepsDone: steps.every((s) => s.done),
    };
  });
}

export function syncDevelopment(player: PlayerState = readPlayer()) {
  const save = readDevelopment();
  for (const def of PROJECT_CATALOG) {
    const progress = ensureProject(save, def);
    const status = resolveStatus(def, progress, player);
    if (progress.status !== "completed" && progress.status !== "active") {
      progress.status = status === "available" ? "available" : status;
    }
  }
  writeDevelopment(save);
  return save;
}

export function startProject(projectId: string, player: PlayerState = readPlayer()) {
  const def = findProject(projectId);
  if (!def) return null;
  const save = syncDevelopment(player);
  const progress = ensureProject(save, def);
  if (progress.status === "completed") return progress;
  const unlocked = resolveStatus(def, progress, player);
  if (unlocked === "locked") return progress;
  progress.status = "active";
  writeDevelopment(save);
  return progress;
}

export function markProjectStep(projectId: string, stepId: string) {
  const def = findProject(projectId);
  if (!def) return null;
  const save = readDevelopment();
  const progress = ensureProject(save, def);
  if (progress.status === "completed") return progress;
  if (progress.status !== "active") {
    const player = readPlayer();
    if (resolveStatus(def, progress, player) === "locked") return progress;
    progress.status = "active";
  }
  if (!def.steps.some((s) => s.id === stepId)) return progress;
  progress.steps[stepId] = true;
  writeDevelopment(save);

  if (def.steps.every((s) => progress.steps[s.id])) {
    return completeProject(projectId);
  }
  return progress;
}

export function completeProject(projectId: string, player: PlayerState = readPlayer()) {
  const def = findProject(projectId);
  if (!def) return null;
  const save = readDevelopment();
  const city = ensureCity(save, def.cityId);
  const progress = ensureProject(save, def);
  if (progress.status === "completed" && progress.rewarded) {
    writeDevelopment(save);
    return progress;
  }

  for (const step of def.steps) progress.steps[step.id] = true;
  progress.status = "completed";

  if (!progress.rewarded) {
    progress.rewarded = true;
    for (const [key, value] of Object.entries(def.impact) as [DevCategory, number][]) {
      city.bonus[key] = (city.bonus[key] ?? 0) + value;
    }
    player.wallet += def.rewardCash;
    writePlayer(player);
    awardXp(def.rewardXp, `project:${def.id}`, "exploration");
  }

  writeDevelopment(save);
  return progress;
}

export function isHighwayRepaired() {
  const save = readDevelopment();
  const progress = save.cities.dustfall?.projects?.[HIGHWAY_REPAIR_ID];
  return progress?.status === "completed";
}

export function activeHighwayRepair(player: PlayerState = readPlayer()) {
  syncDevelopment(player);
  const list = projectsForCity("dustfall", player);
  return list.find((p) => p.def.id === HIGHWAY_REPAIR_ID) ?? null;
}

export function highwayRepairRewardLabel() {
  const def = findProject(HIGHWAY_REPAIR_ID);
  if (!def) return "";
  return `${formatDollars(def.rewardCash)} + XP`;
}
