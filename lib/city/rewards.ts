import { COLLECTIONS, type ClothCollection } from "./clothing";
import type { SkillPath, StatId } from "./skills";

export type RewardCategory = SkillPath | "milestone";

export type RewardEffect =
  | { kind: "stat"; stat: StatId; amount: number }
  | { kind: "cash"; amount: number }
  | { kind: "collection"; collection: ClothCollection }
  | { kind: "skillXp"; path: SkillPath; amount: number }
  | { kind: "ability"; abilityId: string };

export interface LevelReward {
  id: string;
  name: string;
  description: string;
  category: RewardCategory;
  level: number;
  effect: RewardEffect;
  requiresSkill?: { path: SkillPath; level: number };
  requiresCareer?: "office_worker";
}

const NAMED: LevelReward[] = [
  { id: "lv2-first-paycheck", name: "First Paycheck Habit", description: "Office tasks pay 2% more.", category: "career", level: 2, effect: { kind: "stat", stat: "taskPay", amount: 0.02 }, requiresCareer: "office_worker" },
  { id: "lv3-block-legs", name: "Block Legs", description: "Walk 2% faster.", category: "athletics", level: 3, effect: { kind: "stat", stat: "walk", amount: 0.02 } },
  { id: "lv4-open-map", name: "Open Map", description: "Discovering places grants 8% more XP.", category: "exploration", level: 4, effect: { kind: "stat", stat: "discover", amount: 0.08 } },
  { id: "lv5-window-shop", name: "Window Shopper", description: "Clothing is 3% cheaper.", category: "fashion", level: 5, effect: { kind: "stat", stat: "discount", amount: 0.03 } },
  { id: "lv6-kit", name: "Starter Kit", description: "Unlock Pocket Kit on the technical path.", category: "technical", level: 6, effect: { kind: "ability", abilityId: "tec-kit" } },
  { id: "lv7-jump", name: "Curb Pop", description: "Jump 4% higher.", category: "athletics", level: 7, effect: { kind: "stat", stat: "jump", amount: 0.04 } },
  { id: "lv8-tip", name: "Desk Tip Jar", description: "Gain $80.", category: "career", level: 8, effect: { kind: "cash", amount: 80 } },
  { id: "lv9-stride", name: "City Stride", description: "Unlock City Stride.", category: "athletics", level: 9, effect: { kind: "ability", abilityId: "ath-stride" } },
  {
    id: "lv10-dustfall",
    name: "World Map",
    description: "Dustfall unlocks on the World Map — and Sneaker District athletic wear can be bought.",
    category: "milestone",
    level: 10,
    effect: { kind: "collection", collection: "athletic" },
  },
  { id: "lv11-run", name: "Late Bus Dash", description: "Run 3% faster.", category: "athletics", level: 11, effect: { kind: "stat", stat: "run", amount: 0.03 } },
  { id: "lv12-eyes", name: "Street Eyes", description: "Unlock Street Eyes.", category: "exploration", level: 12, effect: { kind: "ability", abilityId: "exp-eyes" } },
  { id: "lv13-punctual", name: "Punctual Pay", description: "Unlock Punctual Pay.", category: "career", level: 13, effect: { kind: "ability", abilityId: "car-punctual" } },
  { id: "lv14-shop-eye", name: "Shopper's Eye", description: "Unlock Shopper's Eye.", category: "fashion", level: 14, effect: { kind: "ability", abilityId: "fas-eye" } },
  { id: "lv15-hop", name: "Hop Cadence", description: "Street hops 5% quicker.", category: "athletics", level: 15, effect: { kind: "stat", stat: "hop", amount: 0.05 } },
  { id: "lv16-interest", name: "Saver's Nudge", description: "Bank interest 0.2% richer.", category: "career", level: 16, effect: { kind: "stat", stat: "interest", amount: 0.002 } },
  { id: "lv17-xp", name: "Practice Loop", description: "All XP +3%.", category: "technical", level: 17, effect: { kind: "stat", stat: "xpGain", amount: 0.03 } },
  { id: "lv18-cash", name: "Side Gig", description: "Gain $150.", category: "career", level: 18, effect: { kind: "cash", amount: 150 } },
  { id: "lv19-hotel", name: "Weekend Rate", description: "Hotel nights 4% cheaper.", category: "fashion", level: 19, effect: { kind: "stat", stat: "hotel", amount: 0.04 } },
  { id: "lv20-independence", name: "Independence Bonus", description: "Career skill XP +80.", category: "milestone", level: 20, effect: { kind: "skillXp", path: "career", amount: 80 } },
  { id: "lv21-salary", name: "Cost of Living", description: "Salary +4%.", category: "career", level: 21, effect: { kind: "stat", stat: "salary", amount: 0.04 } },
  { id: "lv22-sprint", name: "Open Sprint", description: "Unlock Open Sprint.", category: "athletics", level: 22, effect: { kind: "ability", abilityId: "ath-sprint" } },
  { id: "lv23-discover", name: "Alley Notes", description: "Discovery XP +10%.", category: "exploration", level: 23, effect: { kind: "stat", stat: "discover", amount: 0.1 } },
  { id: "lv24-discount", name: "Regular", description: "Clothing 4% off.", category: "fashion", level: 24, effect: { kind: "stat", stat: "discount", amount: 0.04 } },
  { id: "lv25-pro", name: "Professional Collection", description: "Office wear unlocks at the mall.", category: "milestone", level: 25, effect: { kind: "collection", collection: "professional" } },
  { id: "lv26-raise", name: "Raise Packet", description: "Unlock Raise Packet.", category: "career", level: 26, effect: { kind: "ability", abilityId: "car-raise" }, requiresCareer: "office_worker" },
  { id: "lv27-spring", name: "Spring Step", description: "Unlock Spring Step.", category: "athletics", level: 27, effect: { kind: "ability", abilityId: "ath-spring" } },
  { id: "lv28-fit", name: "Fitting Room", description: "Unlock Fitting Room previews.", category: "fashion", level: 28, effect: { kind: "ability", abilityId: "fas-fit" } },
  { id: "lv29-walk", name: "Long Blocks", description: "Walk +3%.", category: "athletics", level: 29, effect: { kind: "stat", stat: "walk", amount: 0.03 } },
  { id: "lv30-spec", name: "Career Specialization", description: "Task pay +5%.", category: "milestone", level: 30, effect: { kind: "stat", stat: "taskPay", amount: 0.05 } },
  { id: "lv31-shortcut", name: "Backstreet Map", description: "Unlock Backstreet Map.", category: "exploration", level: 31, effect: { kind: "ability", abilityId: "exp-shortcut" } },
  { id: "lv32-tools", name: "Site Sense", description: "Unlock Site Sense.", category: "technical", level: 32, effect: { kind: "ability", abilityId: "tec-build" } },
  { id: "lv33-negotiate", name: "Negotiate", description: "Unlock Negotiate.", category: "career", level: 33, effect: { kind: "ability", abilityId: "car-negotiate" }, requiresCareer: "office_worker" },
  { id: "lv34-cash2", name: "Finder's Fee", description: "Gain $220.", category: "exploration", level: 34, effect: { kind: "cash", amount: 220 } },
  { id: "lv35-run2", name: "Promenade Pace", description: "Run +4%.", category: "athletics", level: 35, effect: { kind: "stat", stat: "run", amount: 0.04 } },
  { id: "lv36-xp2", name: "Curious Finds", description: "Unlock Curious Finds.", category: "exploration", level: 36, effect: { kind: "ability", abilityId: "exp-finds" } },
  { id: "lv37-hop2", name: "Quick Hop", description: "Unlock Quick Hop.", category: "athletics", level: 37, effect: { kind: "ability", abilityId: "ath-hop" } },
  { id: "lv38-interest2", name: "Compound Habit", description: "Bank interest +0.25%.", category: "career", level: 38, effect: { kind: "stat", stat: "interest", amount: 0.0025 } },
  { id: "lv39-hotel2", name: "Preferred Nights", description: "Hotel 5% off.", category: "fashion", level: 39, effect: { kind: "stat", stat: "hotel", amount: 0.05 } },
  { id: "lv40-explore", name: "City Exploration", description: "Exploration skill XP +120.", category: "milestone", level: 40, effect: { kind: "skillXp", path: "exploration", amount: 120 } },
  { id: "lv41-parkour", name: "Parkour Lines", description: "Unlock Parkour Lines.", category: "athletics", level: 41, effect: { kind: "ability", abilityId: "ath-parkour" } },
  { id: "lv42-rep", name: "Riverside Rep", description: "Unlock Riverside Rep.", category: "fashion", level: 42, effect: { kind: "ability", abilityId: "fas-rep" } },
  { id: "lv43-jump2", name: "Landing Soft", description: "Jump +5%.", category: "athletics", level: 43, effect: { kind: "stat", stat: "jump", amount: 0.05 } },
  { id: "lv44-bonus", name: "Closing Bonus", description: "Unlock Closing Bonus.", category: "career", level: 44, effect: { kind: "ability", abilityId: "car-bonus" } },
  { id: "lv45-tec-tools", name: "Better Tools", description: "Unlock Better Tools.", category: "technical", level: 45, effect: { kind: "ability", abilityId: "tec-tools" } },
  { id: "lv46-discount2", name: "Mall Regular", description: "Clothing 5% off.", category: "fashion", level: 46, effect: { kind: "stat", stat: "discount", amount: 0.05 } },
  { id: "lv47-night", name: "Night Routes", description: "Unlock Night Routes.", category: "exploration", level: 47, effect: { kind: "ability", abilityId: "exp-night" } },
  { id: "lv48-cash3", name: "Consulting Hour", description: "Gain $300.", category: "career", level: 48, effect: { kind: "cash", amount: 300 } },
  { id: "lv49-walk3", name: "All-Day Walk", description: "Walk +4%.", category: "athletics", level: 49, effect: { kind: "stat", stat: "walk", amount: 0.04 } },
  { id: "lv50-luxury", name: "Luxury Collection", description: "Luxury Boutique stock unlocks.", category: "milestone", level: 50, effect: { kind: "collection", collection: "luxury" } },
  { id: "lv51-guest", name: "Preferred Guest", description: "Unlock Preferred Guest.", category: "fashion", level: 51, effect: { kind: "ability", abilityId: "fas-stay" } },
  { id: "lv52-exec", name: "Executive Track", description: "Unlock Executive Track.", category: "career", level: 52, effect: { kind: "ability", abilityId: "car-exec" } },
  { id: "lv53-second", name: "Second Wind", description: "Unlock Second Wind.", category: "athletics", level: 53, effect: { kind: "ability", abilityId: "ath-second-wind" } },
  { id: "lv54-craft", name: "Craft Bench", description: "Unlock Craft Bench.", category: "technical", level: 54, effect: { kind: "ability", abilityId: "tec-craft" } },
  { id: "lv55-salary2", name: "Market Rate", description: "Salary +6%.", category: "career", level: 55, effect: { kind: "stat", stat: "salary", amount: 0.06 } },
  { id: "lv56-xp3", name: "City Memory", description: "Unlock City Memory.", category: "exploration", level: 56, effect: { kind: "ability", abilityId: "exp-master" } },
  { id: "lv57-run3", name: "River Loop", description: "Run +5%.", category: "athletics", level: 57, effect: { kind: "stat", stat: "run", amount: 0.05 } },
  { id: "lv58-interest3", name: "Private Rate", description: "Bank interest +0.3%.", category: "career", level: 58, effect: { kind: "stat", stat: "interest", amount: 0.003 } },
  { id: "lv59-icon", name: "Style Icon", description: "Unlock Style Icon.", category: "fashion", level: 59, effect: { kind: "ability", abilityId: "fas-icon" } },
  { id: "lv60-mastery", name: "Skill Mastery", description: "Athletics skill XP +140.", category: "milestone", level: 60, effect: { kind: "skillXp", path: "athletics", amount: 140 } },
  { id: "lv61-peak", name: "Peak Condition", description: "Unlock Peak Condition.", category: "athletics", level: 61, effect: { kind: "ability", abilityId: "ath-peak" } },
  { id: "lv62-task", name: "Billable Hour", description: "Task pay +6%.", category: "career", level: 62, effect: { kind: "stat", stat: "taskPay", amount: 0.06 } },
  { id: "lv63-discover2", name: "Hidden Courts", description: "Discovery XP +12%.", category: "exploration", level: 63, effect: { kind: "stat", stat: "discover", amount: 0.12 } },
  { id: "lv64-cash4", name: "Patent Filing", description: "Gain $450.", category: "technical", level: 64, effect: { kind: "cash", amount: 450 } },
  { id: "lv65-hop3", name: "Skip the Light", description: "Hops +8%.", category: "athletics", level: 65, effect: { kind: "stat", stat: "hop", amount: 0.08 } },
  { id: "lv66-xp4", name: "Always Learning", description: "XP gain +5%.", category: "technical", level: 66, effect: { kind: "stat", stat: "xpGain", amount: 0.05 } },
  { id: "lv67-hotel3", name: "Suite Rate", description: "Hotel 6% off.", category: "fashion", level: 67, effect: { kind: "stat", stat: "hotel", amount: 0.06 } },
  { id: "lv68-jump3", name: "High Step", description: "Jump +6%.", category: "athletics", level: 68, effect: { kind: "stat", stat: "jump", amount: 0.06 } },
  { id: "lv69-discount3", name: "Private Client", description: "Clothing 6% off.", category: "fashion", level: 69, effect: { kind: "stat", stat: "discount", amount: 0.06 } },
  { id: "lv70-expert", name: "Expert Progression", description: "Technical skill XP +160.", category: "milestone", level: 70, effect: { kind: "skillXp", path: "technical", amount: 160 } },
  { id: "lv71-walk4", name: "Marathon Errands", description: "Walk +5%.", category: "athletics", level: 71, effect: { kind: "stat", stat: "walk", amount: 0.05 } },
  { id: "lv72-salary3", name: "Principal Band", description: "Salary +8%.", category: "career", level: 72, effect: { kind: "stat", stat: "salary", amount: 0.08 } },
  { id: "lv73-run4", name: "Stadium Warmup", description: "Run +6%.", category: "athletics", level: 73, effect: { kind: "stat", stat: "run", amount: 0.06 } },
  { id: "lv74-cash5", name: "Board Stipend", description: "Gain $600.", category: "career", level: 74, effect: { kind: "cash", amount: 600 } },
  { id: "lv75-exclusive", name: "Exclusive Collection", description: "Nightline fashion unlocks.", category: "milestone", level: 75, effect: { kind: "collection", collection: "exclusive" } },
  { id: "lv76-xp5", name: "Deep Practice", description: "XP gain +6%.", category: "exploration", level: 76, effect: { kind: "stat", stat: "xpGain", amount: 0.06 } },
  { id: "lv77-interest4", name: "Family Office", description: "Bank interest +0.4%.", category: "career", level: 77, effect: { kind: "stat", stat: "interest", amount: 0.004 } },
  { id: "lv78-task2", name: "Rainmaker", description: "Task pay +8%.", category: "career", level: 78, effect: { kind: "stat", stat: "taskPay", amount: 0.08 } },
  { id: "lv79-discover3", name: "Every Door", description: "Discovery XP +15%.", category: "exploration", level: 79, effect: { kind: "stat", stat: "discover", amount: 0.15 } },
  { id: "lv80-elite", name: "Elite Progression", description: "Fashion skill XP +180.", category: "milestone", level: 80, effect: { kind: "skillXp", path: "fashion", amount: 180 } },
  { id: "lv81-hop4", name: "Ghost Hop", description: "Hops +10%.", category: "athletics", level: 81, effect: { kind: "stat", stat: "hop", amount: 0.1 } },
  { id: "lv82-hotel4", name: "House Account", description: "Hotel 8% off.", category: "fashion", level: 82, effect: { kind: "stat", stat: "hotel", amount: 0.08 } },
  { id: "lv83-walk5", name: "Silent Miles", description: "Walk +6%.", category: "athletics", level: 83, effect: { kind: "stat", stat: "walk", amount: 0.06 } },
  { id: "lv84-cash6", name: "Keynote Fee", description: "Gain $900.", category: "career", level: 84, effect: { kind: "cash", amount: 900 } },
  { id: "lv85-discount4", name: "Atelier Rate", description: "Clothing 8% off.", category: "fashion", level: 85, effect: { kind: "stat", stat: "discount", amount: 0.08 } },
  { id: "lv86-jump4", name: "Rooftop Reach", description: "Jump +8%.", category: "athletics", level: 86, effect: { kind: "stat", stat: "jump", amount: 0.08 } },
  { id: "lv87-xp6", name: "Master Class", description: "XP gain +7%.", category: "technical", level: 87, effect: { kind: "stat", stat: "xpGain", amount: 0.07 } },
  { id: "lv88-run5", name: "Last Train", description: "Run +7%.", category: "athletics", level: 88, effect: { kind: "stat", stat: "run", amount: 0.07 } },
  { id: "lv89-salary4", name: "Partner Track", description: "Salary +10%.", category: "career", level: 89, effect: { kind: "stat", stat: "salary", amount: 0.1 } },
  { id: "lv90-near", name: "Near Mastery", description: "All-path skill XP +40 each.", category: "milestone", level: 90, effect: { kind: "skillXp", path: "career", amount: 200 } },
  { id: "lv91-discover4", name: "Cartographer", description: "Discovery XP +18%.", category: "exploration", level: 91, effect: { kind: "stat", stat: "discover", amount: 0.18 } },
  { id: "lv92-interest5", name: "Endowment Rate", description: "Bank interest +0.5%.", category: "career", level: 92, effect: { kind: "stat", stat: "interest", amount: 0.005 } },
  { id: "lv93-walk6", name: "City in the Legs", description: "Walk +7%.", category: "athletics", level: 93, effect: { kind: "stat", stat: "walk", amount: 0.07 } },
  { id: "lv94-cash7", name: "Legacy Grant", description: "Gain $1,200.", category: "milestone", level: 94, effect: { kind: "cash", amount: 1200 } },
  { id: "lv95-task3", name: "Signature Work", description: "Task pay +10%.", category: "career", level: 95, effect: { kind: "stat", stat: "taskPay", amount: 0.1 } },
  { id: "lv96-xp7", name: "Living Manual", description: "XP gain +8%.", category: "technical", level: 96, effect: { kind: "stat", stat: "xpGain", amount: 0.08 } },
  { id: "lv97-run6", name: "Uncatchable", description: "Run +8%.", category: "athletics", level: 97, effect: { kind: "stat", stat: "run", amount: 0.08 } },
  { id: "lv98-discount5", name: "House Discount", description: "Clothing 10% off.", category: "fashion", level: 98, effect: { kind: "stat", stat: "discount", amount: 0.1 } },
  { id: "lv99-hotel5", name: "Always Welcome", description: "Hotel 10% off.", category: "fashion", level: 99, effect: { kind: "stat", stat: "hotel", amount: 0.1 } },
  { id: "lv100-legend", name: "Riverside Legend", description: "Legendary clothing can be bought.", category: "milestone", level: 100, effect: { kind: "collection", collection: "legendary" } },
];

export const LEVEL_REWARDS: LevelReward[] = NAMED;

export function rewardForLevel(level: number) {
  return LEVEL_REWARDS.find((item) => item.level === level) ?? null;
}

export function collectionUnlockLevel(id: ClothCollection) {
  return COLLECTIONS.find((item) => item.id === id)?.level ?? 1;
}

export function assertRewardCatalog() {
  const levels = new Set(LEVEL_REWARDS.map((item) => item.level));
  const missing: number[] = [];
  for (let level = 2; level <= 100; level++) {
    if (!levels.has(level)) missing.push(level);
  }
  return missing;
}
