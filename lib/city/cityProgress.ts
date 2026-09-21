import type { BuildingKind, CityState, Tool } from "@/lib/city/types";
import { awardXp, readPlayer, writePlayer, type PlayerState } from "@/lib/city/player";
import { characterProgress } from "@/lib/city/progression";
import type { SkillPath } from "@/lib/city/skills";

/** Reach this character level to open Dustfall from the city overview. */
export const DUSTFALL_UNLOCK_LEVEL = 10;

const POP_STEPS = [40, 80, 140, 220, 320, 450, 600, 800, 1100, 1500];
const JOB_STEPS = [30, 60, 100, 160, 240, 360, 520];
const HAPPY_STEPS = [55, 70, 82, 90];

let levelToast: string | null = null;

/** One-shot toast for the city HUD (level-ups / Dustfall unlock). */
export function takeLevelToast() {
  const note = levelToast;
  levelToast = null;
  return note;
}

export function dustfallUnlockedByLevel(player: PlayerState = readPlayer()) {
  return characterProgress(player.life.xp).level >= DUSTFALL_UNLOCK_LEVEL;
}

/** Keep the Dustfall flag in sync with character level (and migrate older saves). */
export function syncDustfallUnlock(player: PlayerState = readPlayer()): PlayerState {
  if (dustfallUnlockedByLevel(player) && !player.dustfallUnlocked) {
    player.dustfallUnlocked = true;
    writePlayer(player);
    if (!levelToast) {
      levelToast = `Level ${DUSTFALL_UNLOCK_LEVEL} — Dustfall unlocked on the city map`;
    }
  }
  return player;
}

function noteLevels(newLevels: number[]) {
  if (!newLevels.length) return;
  const top = newLevels[newLevels.length - 1];
  if (newLevels.includes(DUSTFALL_UNLOCK_LEVEL)) {
    levelToast = `Level ${DUSTFALL_UNLOCK_LEVEL} — Dustfall unlocked on the city map`;
  } else {
    levelToast = `Level up · you're now level ${top}`;
  }
}

function grant(amount: number, key: string | null, path: SkillPath = "technical") {
  if (amount <= 0) return null;
  const result = awardXp(amount, key, path);
  syncDustfallUnlock(result.player);
  noteLevels(result.newLevels);
  return result;
}

/** XP for laying a single tile with a build tool. */
export function awardTileXp(tool: Tool) {
  const amount =
    tool === "road"
      ? 10
      : tool === "park" || tool === "sand" || tool === "parking"
        ? 14
        : tool === "tree"
          ? 6
          : tool === "signal" || tool === "works"
            ? 18
            : 0;
  if (!amount) return;
  grant(amount, null, "technical");
}

/** XP for placing (or converting) a building. */
export function awardBuildingXp(
  kind: BuildingKind,
  buildingId: string,
  opts?: { lodging?: string; venue?: string },
) {
  let amount = 55;
  if (kind === "apartment") amount = 85;
  else if (kind === "shop") amount = 70;
  else if (kind === "office") amount = 75;
  else if (kind === "skyscraper") amount = 95;
  else if (kind === "baseball_stadium") amount = 260;
  else if (kind === "house") amount = 55;

  if (opts?.lodging === "hotel") amount = 140;
  if (opts?.venue === "mall") amount = 220;
  if (opts?.venue === "bank") amount = 90;

  grant(amount, `build:${buildingId}`, "technical");
}

export function awardHotelStackXp(buildingId: string, floors: number) {
  grant(55, `hotel-stack:${buildingId}:${floors}`, "technical");
}

export function awardBankConvertXp(buildingId: string) {
  grant(90, `bank:${buildingId}`, "technical");
}

/**
 * Population, jobs, and happiness milestones — keyed so each threshold pays once.
 * Call from the sim tick; cheap when nothing new unlocks.
 */
export function syncCityMilestones(state: CityState) {
  // Mayor XP is for growing Riverside (not Dustfall / corridor).
  if (state.id !== "riverside") return;

  const keys = new Set(readPlayer().life.xpKeys);
  const pop = state.population;
  for (const step of POP_STEPS) {
    const key = `pop:${state.id}:${step}`;
    if (pop >= step && !keys.has(key)) grant(70, key, "exploration");
  }

  let jobs = 0;
  let happySum = 0;
  let happyN = 0;
  for (const building of state.buildings.values()) {
    jobs += building.stats.employees;
    if (building.stats.happiness > 0) {
      happySum += building.stats.happiness;
      happyN += 1;
    }
  }
  for (const step of JOB_STEPS) {
    const key = `jobs:${state.id}:${step}`;
    if (jobs >= step && !keys.has(key)) grant(55, key, "career");
  }

  const happyAvg = happyN ? happySum / happyN : 0;
  for (const step of HAPPY_STEPS) {
    const key = `happy:${state.id}:${step}`;
    if (happyAvg >= step && !keys.has(key)) grant(50, key, "exploration");
  }
}
