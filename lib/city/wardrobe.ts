import {
  clothingById,
  POLICE_UNIFORM_IDS,
  POLICE_UNIFORM_SLOTS,
  type ClothSlot,
  type OutfitSlots,
  type SavedOutfit,
} from "./clothing";
import { characterStats, type LifeState } from "./character";
import { awardXp, readPlayer, spendWallet, writePlayer, type PlayerState } from "./player";
import type { CityClock } from "./types";

export function wardrobeLockedWhileOnDuty(player: PlayerState) {
  return Boolean(player.policeShift);
}

export function itemLocked(_life: LifeState, itemId: string) {
  if (!clothingById(itemId)) return "Unknown item.";
  return null;
}

export function clothingPrice(life: LifeState, itemId: string) {
  const item = clothingById(itemId);
  if (!item) return 0;
  const discount = Math.min(0.4, characterStats(life).discount);
  return Math.max(1, Math.round(item.price * (1 - discount)));
}

export function buyClothing(itemId: string, clock: CityClock): PlayerState | string {
  const player = readPlayer();
  const item = clothingById(itemId);
  if (!item) return "That piece is not in the catalog.";
  if (player.life.owned.includes(itemId)) return "You already own that.";
  const lock = itemLocked(player.life, itemId);
  if (lock) return lock;
  const price = clothingPrice(player.life, itemId);
  const spent = spendWallet(price, clock, `Bought ${item.name}`);
  if (typeof spent === "string") return spent;
  const latest = readPlayer();
  latest.life.owned.push(itemId);
  writePlayer(latest);
  awardXp(12, `buy:${itemId}`, "fashion");
  return readPlayer();
}

export function equipOwned(itemId: string): PlayerState | string {
  const player = readPlayer();
  if (wardrobeLockedWhileOnDuty(player)) return "Change clothes after your police shift.";
  const item = clothingById(itemId);
  if (!item) return "Unknown item.";
  if (!player.life.owned.includes(itemId)) return "You do not own that.";
  player.life.equipped[item.slot] = itemId;
  writePlayer(player);
  return player;
}

export function unequipSlot(slot: ClothSlot): PlayerState | string {
  const player = readPlayer();
  if (wardrobeLockedWhileOnDuty(player)) return "Change clothes after your police shift.";
  player.life.equipped[slot] = null;
  writePlayer(player);
  return player;
}

export function wearOutfit(outfitId: string): PlayerState | string {
  const player = readPlayer();
  if (wardrobeLockedWhileOnDuty(player)) return "Change clothes after your police shift.";
  const outfit = player.life.outfits.find((item) => item.id === outfitId);
  if (!outfit) return "No such outfit.";
  const next: OutfitSlots = { ...outfit.slots };
  for (const slot of Object.keys(next) as ClothSlot[]) {
    const id = next[slot];
    if (id && !player.life.owned.includes(id)) next[slot] = null;
  }
  player.life.equipped = next;
  writePlayer(player);
  return player;
}

/**
 * Snapshot civilian slots, grant police pieces, and equip the duty uniform.
 * Returns the stashed outfit separately so the shift can restore it exactly.
 */
export function equipPoliceDutyUniform(
  player: PlayerState = readPlayer(),
): (PlayerState & { civilianOutfit: OutfitSlots }) | string {
  const civilianOutfit: OutfitSlots = { ...player.life.equipped };
  for (const id of POLICE_UNIFORM_IDS) {
    if (!player.life.owned.includes(id)) player.life.owned.push(id);
  }
  let outfit = player.life.outfits.find((item) => item.id === "police_uniform");
  if (!outfit) {
    outfit = { id: "police_uniform", name: "Police Uniform", slots: { ...POLICE_UNIFORM_SLOTS } };
    player.life.outfits.push(outfit);
  } else {
    outfit.slots = { ...POLICE_UNIFORM_SLOTS };
  }
  player.life.equipped = { ...POLICE_UNIFORM_SLOTS };
  writePlayer(player);
  return { ...readPlayer(), civilianOutfit };
}

export function restoreStashedOutfit(slots: OutfitSlots): PlayerState {
  const player = readPlayer();
  player.life.equipped = { ...slots };
  writePlayer(player);
  return player;
}

export function saveCurrentOutfit(name: string): PlayerState | string {
  const player = readPlayer();
  if (wardrobeLockedWhileOnDuty(player)) return "Save outfits after your police shift.";
  const label = name.trim() || `Look ${player.life.outfits.length + 1}`;
  const outfit: SavedOutfit = {
    id: `look-${Date.now()}`,
    name: label.slice(0, 24),
    slots: { ...player.life.equipped },
  };
  player.life.outfits.push(outfit);
  if (player.life.outfits.length > 8) player.life.outfits.shift();
  writePlayer(player);
  return player;
}

export function deleteOutfit(outfitId: string): PlayerState | string {
  const player = readPlayer();
  const next = player.life.outfits.filter((item) => item.id !== outfitId);
  if (next.length === player.life.outfits.length) return "No such outfit.";
  player.life.outfits = next;
  writePlayer(player);
  return player;
}

export function discoverPlace(placeId: string, amount = 36) {
  const player = readPlayer();
  if (player.life.discovered.includes(placeId)) return player;
  player.life.discovered.push(placeId);
  writePlayer(player);
  const scaled = Math.round(amount * characterStats(player.life).discover);
  awardXp(scaled, `discover:${placeId}`, "exploration");
  return readPlayer();
}
