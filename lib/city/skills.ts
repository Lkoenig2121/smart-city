export type SkillPath = "athletics" | "career" | "exploration" | "fashion" | "technical";

export type AbilityKind = "passive" | "active";

export interface Ability {
  id: string;
  path: SkillPath;
  name: string;
  description: string;
  kind: AbilityKind;
  /** Skill level on this path required. */
  skillLevel: number;
  requires?: string[];
  effect: AbilityEffect;
}

export type AbilityEffect =
  | { kind: "stat"; stat: StatId; amount: number }
  | { kind: "flag"; flag: FlagId };

export type StatId =
  | "walk"
  | "run"
  | "jump"
  | "hop"
  | "taskPay"
  | "salary"
  | "discount"
  | "interest"
  | "discover"
  | "hotel"
  | "xpGain";

export type FlagId = "parkour" | "negotiate" | "repair" | "shortcut" | "fitting";

export const SKILL_PATHS: { id: SkillPath; name: string; blurb: string }[] = [
  { id: "athletics", name: "Athletics", blurb: "Speed, stamina, jumping, and parkour." },
  { id: "career", name: "Career & Business", blurb: "Pay, rank, and professional openings." },
  { id: "exploration", name: "Exploration", blurb: "New places, shortcuts, and finds." },
  { id: "fashion", name: "Fashion & Social", blurb: "Style, discounts, and reputation." },
  { id: "technical", name: "Technical & Crafting", blurb: "Tools, repairs, and construction." },
];

export function skillXpToNext(level: number) {
  if (level < 1) return 40;
  if (level >= 20) return 0;
  return 40 + 20 * (level - 1);
}

export function skillProgress(xp: number) {
  const total = Math.max(0, Math.round(xp));
  let level = 1;
  let spent = 0;
  while (level < 20) {
    const need = skillXpToNext(level);
    if (spent + need > total) break;
    spent += need;
    level += 1;
  }
  const into = total - spent;
  const need = skillXpToNext(level);
  return { level, xp: total, into, need, pct: need <= 0 ? 100 : Math.min(100, (into / need) * 100) };
}

export const ABILITIES: Ability[] = [
  { id: "ath-stride", path: "athletics", name: "City Stride", description: "Walk 4% faster on the street.", kind: "passive", skillLevel: 1, effect: { kind: "stat", stat: "walk", amount: 0.04 } },
  { id: "ath-sprint", path: "athletics", name: "Open Sprint", description: "Running is 6% faster.", kind: "passive", skillLevel: 3, requires: ["ath-stride"], effect: { kind: "stat", stat: "run", amount: 0.06 } },
  { id: "ath-spring", path: "athletics", name: "Spring Step", description: "Jump a little higher.", kind: "passive", skillLevel: 5, effect: { kind: "stat", stat: "jump", amount: 0.08 } },
  { id: "ath-hop", path: "athletics", name: "Quick Hop", description: "Street View hops travel faster.", kind: "passive", skillLevel: 7, requires: ["ath-stride"], effect: { kind: "stat", stat: "hop", amount: 0.1 } },
  { id: "ath-parkour", path: "athletics", name: "Parkour Lines", description: "Read rooftop and alley shortcuts.", kind: "active", skillLevel: 10, requires: ["ath-spring"], effect: { kind: "flag", flag: "parkour" } },
  { id: "ath-second-wind", path: "athletics", name: "Second Wind", description: "Another 5% walk speed.", kind: "passive", skillLevel: 14, requires: ["ath-sprint"], effect: { kind: "stat", stat: "walk", amount: 0.05 } },
  { id: "ath-peak", path: "athletics", name: "Peak Condition", description: "Run 8% faster at the top of the tree.", kind: "passive", skillLevel: 18, requires: ["ath-parkour"], effect: { kind: "stat", stat: "run", amount: 0.08 } },

  { id: "car-punctual", path: "career", name: "Punctual Pay", description: "Office tasks pay 5% more.", kind: "passive", skillLevel: 1, effect: { kind: "stat", stat: "taskPay", amount: 0.05 } },
  { id: "car-raise", path: "career", name: "Raise Packet", description: "Career salary ticks 6% higher.", kind: "passive", skillLevel: 4, requires: ["car-punctual"], effect: { kind: "stat", stat: "salary", amount: 0.06 } },
  { id: "car-negotiate", path: "career", name: "Negotiate", description: "Unlock better professional deals.", kind: "active", skillLevel: 8, requires: ["car-raise"], effect: { kind: "flag", flag: "negotiate" } },
  { id: "car-bonus", path: "career", name: "Closing Bonus", description: "Task pay +8%.", kind: "passive", skillLevel: 12, requires: ["car-negotiate"], effect: { kind: "stat", stat: "taskPay", amount: 0.08 } },
  { id: "car-exec", path: "career", name: "Executive Track", description: "Salary +10%.", kind: "passive", skillLevel: 16, requires: ["car-bonus"], effect: { kind: "stat", stat: "salary", amount: 0.1 } },

  { id: "exp-eyes", path: "exploration", name: "Street Eyes", description: "Discovering places grants 10% more XP.", kind: "passive", skillLevel: 1, effect: { kind: "stat", stat: "discover", amount: 0.1 } },
  { id: "exp-shortcut", path: "exploration", name: "Backstreet Map", description: "Hidden shortcuts show on the minimap later.", kind: "active", skillLevel: 5, requires: ["exp-eyes"], effect: { kind: "flag", flag: "shortcut" } },
  { id: "exp-finds", path: "exploration", name: "Curious Finds", description: "All XP gains +4%.", kind: "passive", skillLevel: 9, effect: { kind: "stat", stat: "xpGain", amount: 0.04 } },
  { id: "exp-night", path: "exploration", name: "Night Routes", description: "Discovery XP +15%.", kind: "passive", skillLevel: 13, requires: ["exp-shortcut"], effect: { kind: "stat", stat: "discover", amount: 0.15 } },
  { id: "exp-master", path: "exploration", name: "City Memory", description: "XP gain +6%.", kind: "passive", skillLevel: 17, requires: ["exp-finds"], effect: { kind: "stat", stat: "xpGain", amount: 0.06 } },

  { id: "fas-eye", path: "fashion", name: "Shopper's Eye", description: "Clothing is 5% cheaper.", kind: "passive", skillLevel: 1, effect: { kind: "stat", stat: "discount", amount: 0.05 } },
  { id: "fas-fit", path: "fashion", name: "Fitting Room", description: "Preview outfits before you buy.", kind: "active", skillLevel: 4, effect: { kind: "flag", flag: "fitting" } },
  { id: "fas-rep", path: "fashion", name: "Riverside Rep", description: "Shop discount +7%.", kind: "passive", skillLevel: 8, requires: ["fas-eye"], effect: { kind: "stat", stat: "discount", amount: 0.07 } },
  { id: "fas-stay", path: "fashion", name: "Preferred Guest", description: "Hotel nights cost 8% less.", kind: "passive", skillLevel: 12, effect: { kind: "stat", stat: "hotel", amount: 0.08 } },
  { id: "fas-icon", path: "fashion", name: "Style Icon", description: "Clothing another 8% off.", kind: "passive", skillLevel: 16, requires: ["fas-rep"], effect: { kind: "stat", stat: "discount", amount: 0.08 } },

  { id: "tec-kit", path: "technical", name: "Pocket Kit", description: "Repair jobs and tools unlock.", kind: "active", skillLevel: 1, effect: { kind: "flag", flag: "repair" } },
  { id: "tec-build", path: "technical", name: "Site Sense", description: "City construction reads faster.", kind: "passive", skillLevel: 6, requires: ["tec-kit"], effect: { kind: "stat", stat: "xpGain", amount: 0.03 } },
  { id: "tec-tools", path: "technical", name: "Better Tools", description: "Walk +3% while carrying know-how.", kind: "passive", skillLevel: 10, requires: ["tec-kit"], effect: { kind: "stat", stat: "walk", amount: 0.03 } },
  { id: "tec-craft", path: "technical", name: "Craft Bench", description: "XP gain +5%.", kind: "passive", skillLevel: 15, requires: ["tec-build"], effect: { kind: "stat", stat: "xpGain", amount: 0.05 } },
];

export function abilityById(id: string) {
  return ABILITIES.find((item) => item.id === id) ?? null;
}

export function abilitiesFor(path: SkillPath) {
  return ABILITIES.filter((item) => item.path === path);
}
