import { footprintFor } from "@/lib/simulation/buildings/buildings";
import type { Building, CityClock, CityState } from "@/lib/city/types";
import { hash2 } from "./rng";

export const STADIUM_COST = 750_000;
export const STADIUM_MIN_POPULATION = 5_000;
export const STADIUM_BUILD_SECONDS = 30;
export const STADIUM_DAILY_REVENUE = 15_000;
export const STADIUM_HAPPINESS_BOOST = 1_000;
/** First pitch. */
export const GAME_START_MINUTE = 18 * 60;
/** Final out, about 9:00 PM. */
export const GAME_END_MINUTE = 21 * 60;
export const GAME_HOURS_LABEL = "6:00–9:00 PM";

export function findStadium(state: CityState) {
  for (const building of state.buildings.values()) {
    if (building.kind === "baseball_stadium") return building;
  }
  return null;
}

export function stadiumIsOpen(building: Building) {
  return building.kind === "baseball_stadium" && !(building.constructionLeft && building.constructionLeft > 0);
}

/** Tile just outside the north (street-facing) gate. */
export function stadiumGateTile(building: Building) {
  return {
    x: building.origin.x + Math.floor(building.width / 2),
    y: building.origin.y - 1,
  };
}

export function isGameNight(state: CityState) {
  const stadium = findStadium(state);
  if (!stadium || !stadiumIsOpen(stadium)) return false;
  const minute = state.clock.minuteOfDay;
  return minute >= GAME_START_MINUTE && minute < GAME_END_MINUTE;
}

export interface StadiumAttendance {
  seated: number;
  walking: number;
  lights: number;
  fireworks: boolean;
}

/** How full the park is. Seats stay sparse until first pitch, then pack. */
export function stadiumAttendance(state: CityState): StadiumAttendance {
  const m = state.clock.minuteOfDay;
  const start = GAME_START_MINUTE;
  const end = GAME_END_MINUTE;
  if (m >= start && m < end) {
    return { seated: 1, walking: 0.26, lights: 1, fireworks: m >= start + 12 };
  }
  if (m >= end && m < end + 40) {
    const t = (m - end) / 40;
    return {
      seated: Math.max(0.08, 1 - t * 0.9),
      walking: 0.4,
      lights: Math.max(0.25, 1 - t * 0.7),
      fireworks: t < 0.6,
    };
  }
  if (m >= start - 120 && m < start) {
    const t = (m - (start - 120)) / 120;
    return {
      seated: 0.06 + t * 0.38,
      walking: 0.18 + t * 0.72,
      lights: t > 0.72 ? ((t - 0.72) / 0.28) * 0.55 : 0,
      fireworks: false,
    };
  }
  if (m >= 10 * 60 && m < start - 120) {
    return { seated: 0.07, walking: 0.16, lights: 0, fireworks: false };
  }
  return { seated: 0.04, walking: 0.08, lights: 0, fireworks: false };
}

export const RAVENS_LINEUP = ["Rivera", "Chen", "Brooks", "Patel", "Nguyen", "Walsh", "Ortiz", "Kim", "Hale"];
export const BEARS_LINEUP = ["Vargas", "Cole", "Dunn", "Rossi", "Blake", "Frost", "Dean", "Pike", "Moss"];

export interface StadiumGame {
  inning: number;
  top: boolean;
  ravens: number;
  visitors: number;
  outs: number;
  balls: number;
  strikes: number;
  ravensHits: number;
  visitorsHits: number;
  ravensErrors: number;
  visitorsErrors: number;
  ravensLine: Array<number | null>;
  visitorsLine: Array<number | null>;
  hitLight: boolean;
  errorLight: boolean;
  atBat: string;
  onDeck: string;
  inTheHole: string;
  playing: boolean;
  firstPitch: boolean;
}

/** Live nine-inning game from 6:00 PM to about 9:00 PM, deterministic per city day. */
export function stadiumGame(state: CityState): StadiumGame | null {
  if (!isGameNight(state)) return null;
  return simulateGame(state.clock, state.clock.minuteOfDay);
}

/**
 * Completed box score for the most recent game. Null while a game is still
 * underway, or on day one before first pitch.
 */
export function stadiumFinal(state: CityState): StadiumGame | null {
  const stadium = findStadium(state);
  if (!stadium || !stadiumIsOpen(stadium)) return null;
  const minute = state.clock.minuteOfDay;
  if (minute >= GAME_START_MINUTE && minute < GAME_END_MINUTE) return null;
  if (minute >= GAME_END_MINUTE) return simulateGame(state.clock, GAME_END_MINUTE);
  const previous: CityClock = {
    dayIndex: state.clock.dayIndex - 1,
    minuteOfDay: GAME_END_MINUTE,
    dayOfYear: state.clock.dayOfYear <= 1 ? 365 : state.clock.dayOfYear - 1,
    year: state.clock.dayOfYear <= 1 ? state.clock.year - 1 : state.clock.year,
  };
  return simulateGame(previous, GAME_END_MINUTE);
}

export function stadiumWinner(game: StadiumGame) {
  if (game.ravens > game.visitors) return "Ravens";
  if (game.visitors > game.ravens) return "Bears";
  return null;
}

function simulateGame(clock: CityClock, minuteOfDay: number): StadiumGame {
  const elapsed = Math.max(0, minuteOfDay - GAME_START_MINUTE);
  const playMinutes = GAME_END_MINUTE - GAME_START_MINUTE - 8;
  const playing = elapsed < playMinutes;
  const halves = 18;
  const rawHalf = playing ? (elapsed / playMinutes) * halves : halves;
  const halfIndex = playing ? Math.min(halves - 1, Math.floor(rawHalf)) : halves;
  const halfProgress = playing ? Math.min(1, rawHalf - halfIndex) : 1;
  const inning = Math.min(9, Math.floor((playing ? halfIndex : halves - 1) / 2) + 1);
  const top = playing ? halfIndex % 2 === 0 : false;
  const visitorsLine: Array<number | null> = Array.from({ length: 9 }, () => null);
  const ravensLine: Array<number | null> = Array.from({ length: 9 }, () => null);
  let ravens = 0;
  let visitors = 0;
  let justScored = false;
  const lastHalf = playing ? halfIndex : halves - 1;
  for (let half = 0; half <= lastHalf; half++) {
    const events = scoringTimes(clock, half);
    const progress = half < halfIndex ? 1 : playing ? halfProgress : 1;
    const runs = events.filter((at) => at <= progress).length;
    if (half === halfIndex && playing) {
      justScored = events.some((at) => progress - at >= 0 && progress - at < 0.09);
    }
    const slot = Math.floor(half / 2);
    if (half % 2 === 0) {
      visitors += runs;
      visitorsLine[slot] = runs;
    } else {
      ravens += runs;
      ravensLine[slot] = runs;
    }
  }
  const outs = playing ? Math.min(2, Math.floor(hash2(clock.dayOfYear, elapsed, 19) * 3)) : 0;
  const balls = playing ? Math.min(3, Math.floor(hash2(clock.dayOfYear, Math.floor(elapsed), 21) * 4)) : 0;
  const strikes = playing ? Math.min(2, Math.floor(hash2(clock.dayOfYear, Math.floor(elapsed), 22) * 3)) : 0;
  const visitorsHits = hitsFor(clock, 3, visitors, halfIndex);
  const ravensHits = hitsFor(clock, 7, ravens, halfIndex);
  const visitorsErrors = errorsFor(clock, 11);
  const ravensErrors = errorsFor(clock, 13);
  const lineup = top ? BEARS_LINEUP : RAVENS_LINEUP;
  const batter = Math.floor(elapsed / 3.4) % 9;
  return {
    inning,
    top,
    ravens,
    visitors,
    outs,
    balls,
    strikes,
    ravensHits,
    visitorsHits,
    ravensErrors,
    visitorsErrors,
    ravensLine,
    visitorsLine,
    hitLight: playing && (justScored || hash2(clock.dayOfYear, Math.floor(elapsed * 2), 31) > 0.86),
    errorLight: playing && hash2(clock.dayOfYear, Math.floor(elapsed * 2), 32) > 0.93,
    atBat: playing ? lineup[batter] : "",
    onDeck: playing ? lineup[(batter + 1) % 9] : "",
    inTheHole: playing ? lineup[(batter + 2) % 9] : "",
    playing,
    firstPitch: elapsed < 3,
  };
}

function hitsFor(clock: CityClock, salt: number, runs: number, halfIndex: number) {
  return runs + Math.floor(hash2(clock.year, clock.dayOfYear, 200 + salt) * 2) + Math.floor(halfIndex * 0.35);
}

function errorsFor(clock: CityClock, salt: number) {
  const n = hash2(clock.year, clock.dayOfYear, 240 + salt);
  if (n > 0.88) return 2;
  if (n > 0.62) return 1;
  return 0;
}

/**
 * Moments (0–1 through a half-inning) when a run crosses. Ravens still
 * outscore the Bears overall, but a 4-run frame is rare.
 */
function scoringTimes(clock: CityClock, half: number) {
  const ravensHalf = half % 2 === 1;
  const chance = ravensHalf ? 0.2 : 0.14;
  const times: number[] = [];
  for (let i = 0; i < 4; i++) {
    const roll = hash2(clock.year, clock.dayOfYear, 80 + half * 19 + i * 7);
    if (roll >= chance) continue;
    times.push(0.1 + hash2(clock.year, clock.dayOfYear, 180 + half * 13 + i * 11) * 0.8);
  }
  times.sort((a, b) => a - b);
  const rareFour = ravensHalf && hash2(clock.year, clock.dayOfYear, 410 + half * 23) > 0.94;
  return times.slice(0, rareFour ? 4 : ravensHalf ? 3 : 2);
}

function ringHasRoad(state: CityState, x: number, y: number, w: number, d: number) {
  for (let i = 0; i < w; i++) {
    if (state.tiles[y - 1]?.[x + i]?.road) return true;
    if (state.tiles[y + d]?.[x + i]?.road) return true;
  }
  for (let i = 0; i < d; i++) {
    if (state.tiles[y + i]?.[x - 1]?.road) return true;
    if (state.tiles[y + i]?.[x + w]?.road) return true;
  }
  return false;
}

function ringLotCount(state: CityState, x: number, y: number, w: number, d: number) {
  let n = 0;
  const visit = (tx: number, ty: number) => {
    const tile = state.tiles[ty]?.[tx];
    if (tile?.terrain === "lot") n += 1;
  };
  for (let i = 0; i < w; i++) {
    visit(x + i, y - 1);
    visit(x + i, y + d);
  }
  for (let i = 0; i < d; i++) {
    visit(x - 1, y + i);
    visit(x + w, y + i);
  }
  return n;
}

/** Why a stadium cannot be placed at this origin, or null if it can. */
export function stadiumPlacementError(state: CityState, x: number, y: number): string | null {
  const fp = footprintFor("baseball_stadium");
  for (let dy = 0; dy < fp.d; dy++) {
    for (let dx = 0; dx < fp.w; dx++) {
      const tile = state.tiles[y + dy]?.[x + dx];
      if (!tile) return "Needs a larger clear plot";
      if (tile.road || tile.buildingId || tile.terrain === "water") {
        return "Needs a clear plot (no road, water, or building)";
      }
    }
  }
  if (state.budget.treasury < STADIUM_COST) {
    return `Costs $${(STADIUM_COST / 1000).toFixed(0)}K — treasury is short`;
  }
  if (state.population < STADIUM_MIN_POPULATION) {
    return `Needs ${STADIUM_MIN_POPULATION.toLocaleString()} people (city has ${state.population.toLocaleString()})`;
  }
  if (!ringHasRoad(state, x, y, fp.w, fp.d)) return "Needs a road along the plot";
  if (ringLotCount(state, x, y, fp.w, fp.d) < 4) {
    return "Needs parking lots along the plot (paint Parking first)";
  }
  return null;
}
