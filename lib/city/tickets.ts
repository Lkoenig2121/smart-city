import { spendWallet, writePlayer, type PlayerState } from "./player";
import { GAME_END_MINUTE, hasGameToday } from "./stadium";
import type { CityState } from "./types";

export const GAME_TICKET_PRICE = 100;
export const SEASON_PASS_PRICE = 500;

/** Gates stay ticketed until half an hour after the last out. */
const TICKETED_UNTIL = GAME_END_MINUTE + 30;

function ticketKey(state: CityState) {
  return `${state.id}:${state.clock.year}:${state.clock.dayOfYear}`;
}

/** Whether a game is on at this park right now, so the gate needs a ticket. */
export function gateIsTicketed(state: CityState) {
  return hasGameToday(state) && state.clock.minuteOfDay < TICKETED_UNTIL;
}

export type StadiumAccess = "open" | "pass" | "ticket" | "needed";

export function stadiumAccess(player: PlayerState, state: CityState): StadiumAccess {
  if (player.seasonPass) return "pass";
  if (!gateIsTicketed(state)) return "open";
  return player.ballTickets.includes(ticketKey(state)) ? "ticket" : "needed";
}

export function buyGameTicket(state: CityState, parkName: string): PlayerState | string {
  const spent = spendWallet(GAME_TICKET_PRICE, state.clock, `${parkName} · game ticket`);
  if (typeof spent === "string") return spent;
  const key = ticketKey(state);
  spent.ballTickets = [key, ...spent.ballTickets.filter((k) => k !== key)].slice(0, 12);
  writePlayer(spent);
  return spent;
}

export function buySeasonPass(state: CityState, parkName: string): PlayerState | string {
  const spent = spendWallet(SEASON_PASS_PRICE, state.clock, `${parkName} · season pass`);
  if (typeof spent === "string") return spent;
  spent.seasonPass = true;
  writePlayer(spent);
  return spent;
}
