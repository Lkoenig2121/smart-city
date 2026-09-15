import type { CityClock } from "./types";
import { clothingById, EMPTY_SLOTS, STARTER_CLOTHING, type ClothSlot, type OutfitSlots, type SavedOutfit } from "./clothing";
import { characterProgress } from "./progression";
import { LEVEL_REWARDS, rewardForLevel, type LevelReward } from "./rewards";
import {
  ABILITIES,
  abilityById,
  skillProgress,
  type FlagId,
  type SkillPath,
  type StatId,
} from "./skills";

export interface LifeState {
  xp: number;
  skills: Record<SkillPath, number>;
  unlocked: string[];
  collections: string[];
  owned: string[];
  equipped: OutfitSlots;
  outfits: SavedOutfit[];
  discovered: string[];
  xpKeys: string[];
  grantedLevels: number[];
}

export interface CharacterStats {
  walk: number;
  run: number;
  jump: number;
  hop: number;
  taskPay: number;
  salary: number;
  discount: number;
  interest: number;
  discover: number;
  hotel: number;
  xpGain: number;
  flags: Set<FlagId>;
}

const SKILL_IDS: SkillPath[] = ["athletics", "career", "exploration", "fashion", "technical"];

export function emptyLife(): LifeState {
  return {
    xp: 0,
    skills: { athletics: 0, career: 0, exploration: 0, fashion: 0, technical: 0 },
    unlocked: [],
    collections: ["everyday"],
    owned: [...STARTER_CLOTHING],
    equipped: { ...EMPTY_SLOTS, upper: "tee-harbor", lower: "jeans-indigo", feet: "kicks-river" },
    outfits: [
      {
        id: "everyday",
        name: "Everyday",
        slots: { ...EMPTY_SLOTS, upper: "tee-harbor", lower: "jeans-indigo", feet: "kicks-river" },
      },
    ],
    discovered: [],
    xpKeys: [],
    grantedLevels: [1],
  };
}

export function parseLife(value: unknown): LifeState {
  const fallback = emptyLife();
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<LifeState>;
  const xp = Number(raw.xp);
  const skills = { ...fallback.skills };
  if (raw.skills && typeof raw.skills === "object") {
    for (const path of SKILL_IDS) {
      const n = Number((raw.skills as Record<string, unknown>)[path]);
      skills[path] = Number.isFinite(n) && n >= 0 ? n : 0;
    }
  }
  const owned = Array.isArray(raw.owned) ? raw.owned.filter((id) => typeof id === "string") : fallback.owned;
  const equipped = { ...fallback.equipped };
  if (raw.equipped && typeof raw.equipped === "object") {
    for (const slot of Object.keys(EMPTY_SLOTS) as ClothSlot[]) {
      const id = (raw.equipped as OutfitSlots)[slot];
      equipped[slot] = typeof id === "string" && owned.includes(id) ? id : null;
    }
  }
  return {
    xp: Number.isFinite(xp) && xp >= 0 ? xp : 0,
    skills,
    unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.filter((id) => typeof id === "string") : [],
    collections: Array.isArray(raw.collections)
      ? Array.from(new Set(["everyday", ...raw.collections.filter((id) => typeof id === "string")]))
      : fallback.collections,
    owned: owned.length ? Array.from(new Set(owned)) : fallback.owned,
    equipped,
    outfits: Array.isArray(raw.outfits) ? raw.outfits.filter(isOutfit) : fallback.outfits,
    discovered: Array.isArray(raw.discovered) ? raw.discovered.filter((id) => typeof id === "string") : [],
    xpKeys: Array.isArray(raw.xpKeys) ? raw.xpKeys.filter((id) => typeof id === "string").slice(-400) : [],
    grantedLevels: Array.isArray(raw.grantedLevels)
      ? raw.grantedLevels.filter((n) => typeof n === "number")
      : fallback.grantedLevels,
  };
}

function isOutfit(value: unknown): value is SavedOutfit {
  if (!value || typeof value !== "object") return false;
  const raw = value as SavedOutfit;
  return typeof raw.id === "string" && typeof raw.name === "string" && Boolean(raw.slots);
}

export function characterStats(life: LifeState): CharacterStats {
  const stats: CharacterStats = {
    walk: 1,
    run: 1,
    jump: 1,
    hop: 1,
    taskPay: 1,
    salary: 1,
    discount: 0,
    interest: 0,
    discover: 1,
    hotel: 0,
    xpGain: 1,
    flags: new Set(),
  };
  const add = (stat: StatId, amount: number) => {
    if (stat === "discount" || stat === "hotel" || stat === "interest") stats[stat] += amount;
    else stats[stat] += amount;
  };
  for (const reward of LEVEL_REWARDS) {
    if (!life.grantedLevels.includes(reward.level)) continue;
    if (reward.effect.kind === "stat") add(reward.effect.stat, reward.effect.amount);
  }
  for (const ability of ABILITIES) {
    if (!abilityUnlocked(life, ability.id)) continue;
    if (ability.effect.kind === "stat") add(ability.effect.stat, ability.effect.amount);
    else stats.flags.add(ability.effect.flag);
  }
  for (const slot of Object.keys(life.equipped) as ClothSlot[]) {
    const item = clothingById(life.equipped[slot] ?? "");
    if (item?.bonus) add(item.bonus.stat, item.bonus.amount);
  }
  stats.discount = Math.min(0.4, stats.discount);
  stats.hotel = Math.min(0.4, stats.hotel);
  return stats;
}

export function abilityUnlocked(life: LifeState, abilityId: string): boolean {
  const ability = abilityById(abilityId);
  if (!ability) return false;
  if (life.unlocked.includes(abilityId)) return true;
  const skill = skillProgress(life.skills[ability.path]);
  if (skill.level < ability.skillLevel) return false;
  return (ability.requires ?? []).every((id) => abilityUnlocked(life, id));
}

export function grantCharacterXp(
  life: LifeState,
  amount: number,
  key: string | null,
  path?: SkillPath,
): { life: LifeState; gained: number; newLevels: number[]; rewards: LevelReward[] } {
  if (key && life.xpKeys.includes(key)) return { life, gained: 0, newLevels: [], rewards: [] };
  const stats = characterStats(life);
  const gained = Math.max(0, Math.round(amount * stats.xpGain));
  if (gained <= 0 && !key) return { life, gained: 0, newLevels: [], rewards: [] };
  const before = characterProgress(life.xp).level;
  life.xp += gained;
  if (path) life.skills[path] += gained;
  if (key) {
    life.xpKeys.push(key);
    if (life.xpKeys.length > 400) life.xpKeys.splice(0, life.xpKeys.length - 400);
  }
  const after = characterProgress(life.xp).level;
  const newLevels: number[] = [];
  const rewards: LevelReward[] = [];
  for (let level = before + 1; level <= after; level++) {
    if (life.grantedLevels.includes(level)) continue;
    life.grantedLevels.push(level);
    newLevels.push(level);
    const reward = rewardForLevel(level);
    if (reward) {
      rewards.push(reward);
      applyReward(life, reward);
    }
  }
  return { life, gained, newLevels, rewards };
}

function applyReward(life: LifeState, reward: LevelReward) {
  const effect = reward.effect;
  if (effect.kind === "collection" && !life.collections.includes(effect.collection)) {
    life.collections.push(effect.collection);
  }
  if (effect.kind === "ability" && !life.unlocked.includes(effect.abilityId)) {
    life.unlocked.push(effect.abilityId);
  }
  if (effect.kind === "skillXp") life.skills[effect.path] += effect.amount;
}

export function applyCashRewards(wallet: number, rewards: LevelReward[]) {
  return wallet + rewards.reduce((sum, reward) => (reward.effect.kind === "cash" ? sum + reward.effect.amount : sum), 0);
}

export function collectionOpen(life: LifeState, id: string) {
  return life.collections.includes(id);
}
