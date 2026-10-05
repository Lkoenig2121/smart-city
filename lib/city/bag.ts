import { consumableById, CONSUME_BITES } from "./consumables";
import { readPlayer, spendWallet, writePlayer, type PlayerState } from "./player";
import type { CityClock } from "./types";

export function buyConsumable(itemId: string, clock: CityClock, source = "Cabana bar"): PlayerState | string {
  const item = consumableById(itemId);
  if (!item) return "Unknown item.";
  const spent = spendWallet(item.price, clock, `${source} · ${item.name}`);
  if (typeof spent === "string") return spent;
  const player = addConsumable(itemId);
  if (typeof player === "string") return player;
  if (item.kind !== "goods") {
    player.life.held = itemId;
    player.life.heldSips = 0;
  }
  writePlayer(player);
  return player;
}

export function addConsumable(itemId: string, count = 1): PlayerState | string {
  const item = consumableById(itemId);
  if (!item) return "Unknown item.";
  const player = readPlayer();
  player.life.bag = player.life.bag ?? {};
  const next = (player.life.bag[itemId] ?? 0) + Math.max(1, Math.floor(count));
  player.life.bag[itemId] = Math.min(99, next);
  writePlayer(player);
  return player;
}

export function equipHeld(itemId: string): PlayerState | string {
  const item = consumableById(itemId);
  if (!item) return "Unknown item.";
  const player = readPlayer();
  if ((player.life.bag[itemId] ?? 0) < 1) return "You do not have that.";
  if (player.life.held === itemId) {
    player.life.held = null;
    player.life.heldSips = 0;
  } else {
    player.life.held = itemId;
    player.life.heldSips = 0;
  }
  writePlayer(player);
  return player;
}

export function unequipHeld(): PlayerState {
  const player = readPlayer();
  player.life.held = null;
  player.life.heldSips = 0;
  writePlayer(player);
  return player;
}

export function consumeHeld(): PlayerState | string {
  const player = readPlayer();
  const item = consumableById(player.life.held ?? "");
  if (!item) return "You are not holding anything.";
  if (item.kind === "goods") return "That's already in your bag.";
  player.life.heldSips = (player.life.heldSips ?? 0) + 1;
  if (player.life.heldSips < CONSUME_BITES) {
    writePlayer(player);
    return player;
  }
  const left = (player.life.bag[item.id] ?? 1) - 1;
  if (left <= 0) delete player.life.bag[item.id];
  else player.life.bag[item.id] = left;
  player.life.held = null;
  player.life.heldSips = 0;
  writePlayer(player);
  return player;
}

export function sipHeldDrink(): PlayerState | string {
  return consumeHeld();
}
