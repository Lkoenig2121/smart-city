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

export interface StadiumGame {
  inning: number;
  top: boolean;
  ravens: number;
  visitors: number;
  outs: number;
  playing: boolean;
  firstPitch: boolean;
}

/** Live nine-inning game from 6:00 PM to about 9:00 PM, deterministic per city day. */
export function stadiumGame(state: CityState): StadiumGame | null {
  if (!isGameNight(state)) return null;
  const elapsed = state.clock.minuteOfDay - GAME_START_MINUTE;
  const playMinutes = GAME_END_MINUTE - GAME_START_MINUTE - 8;
  const playing = elapsed < playMinutes;
  const halves = 18;
  const halfIndex = playing
    ? Math.min(halves - 1, Math.floor((elapsed / playMinutes) * halves))
    : halves;
  const inning = Math.min(9, Math.floor((playing ? halfIndex : halves - 1) / 2) + 1);
  const top = playing ? halfIndex % 2 === 0 : false;
  let ravens = 0;
  let visitors = 0;
  const completed = playing ? halfIndex : halves;
  for (let half = 0; half < completed; half++) {
    const runs = inningRuns(state.clock, half);
    if (half % 2 === 0) visitors += runs;
    else ravens += runs;
  }
  const outs = playing ? Math.min(2, Math.floor(hash2(state.clock.dayOfYear, elapsed, 19) * 3)) : 0;
  return {
    inning,
    top,
    ravens,
    visitors,
    outs,
    playing,
    firstPitch: elapsed < 3,
  };
}

function inningRuns(clock: CityClock, half: number) {
  const n = hash2(clock.year, clock.dayOfYear, 80 + half * 17);
  if (n > 0.82) return 2;
  if (n > 0.55) return 1;
  return 0;
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
