import { footprintFor } from "@/lib/simulation/buildings/buildings";
import type { Building, CityClock, CityState } from "@/lib/city/types";
import { weekdayOf } from "./calendar";
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
/** Home club win rate for a finished nine-inning game. */
export const HOME_WIN_RATE = 0.75;

export interface Ballclub {
  shortName: string;
  fullName: string;
  parkName: string;
  abbrev: string;
  lineup: string[];
  visitorShort: string;
  visitorAbbrev: string;
  visitorLineup: string[];
  accent: string;
  /** Share of this club's games it wins — drives the league standings. */
  winRate: number;
  /** Per-club salt so every team's schedule of wins is different. */
  seed: number;
}

const RAVENS_ROSTER = ["Rivera", "Chen", "Brooks", "Patel", "Nguyen", "Walsh", "Ortiz", "Kim", "Hale"];
const BEARS_ROSTER = ["Vargas", "Cole", "Dunn", "Rossi", "Blake", "Frost", "Dean", "Pike", "Moss"];
const SCORPIONS_ROSTER = ["Hassan", "Reed", "Okoro", "Sato", "Vega", "Quinn", "Nassar", "Lane", "Cruz"];
const COYOTES_ROSTER = ["Marsh", "Boone", "Silva", "York", "Perez", "Clay", "Nguyen", "West", "Hahn"];
const WOLVES_ROSTER = ["Alpine", "Frost", "Berg", "Knox", "Stein", "Vogel", "Hunt", "Ridge", "Snow"];
const GULLS_ROSTER = ["Shore", "Bay", "Coral", "Drake", "Finch", "Gale", "Harbor", "Isle", "Jetty"];
const CIRCUITS_ROSTER = ["Nova", "Pixel", "Quark", "Relay", "Spark", "Tesla", "Volt", "Wave", "Zen"];
const LYNX_ROSTER = ["Ash", "Bramble", "Cedar", "Dale", "Elm", "Fern", "Grove", "Hawk", "Ivy"];
const TIDES_ROSTER = ["Anchor", "Brine", "Current", "Drift", "Eddy", "Foam", "Gulf", "Hull", "Inlet"];
const PHANTOMS_ROSTER = ["Arc", "Blink", "Cipher", "Drift", "Echo", "Flux", "Ghost", "Holo", "Ion"];

export const BALLCLUBS: Record<string, Ballclub> = {
  riverside: {
    shortName: "Ravens",
    fullName: "Riverside Ravens",
    parkName: "Ravens Ballpark",
    abbrev: "RAV",
    lineup: RAVENS_ROSTER,
    visitorShort: "Bears",
    visitorAbbrev: "BEA",
    visitorLineup: BEARS_ROSTER,
    accent: "#1f4d8c",
    winRate: 0.6,
    seed: 0,
  },
  dustfall: {
    shortName: "Scorpions",
    fullName: "Dustfall Scorpions",
    parkName: "Scorpion Field",
    abbrev: "SCR",
    lineup: SCORPIONS_ROSTER,
    visitorShort: "Coyotes",
    visitorAbbrev: "COY",
    visitorLineup: COYOTES_ROSTER,
    accent: "#2a6b5a",
    winRate: 0.57,
    seed: 37,
  },
  mountain: {
    shortName: "Wolves",
    fullName: "Mountain Wolves",
    parkName: "Summit Field",
    abbrev: "WLV",
    lineup: WOLVES_ROSTER,
    visitorShort: "Lynx",
    visitorAbbrev: "LYX",
    visitorLineup: LYNX_ROSTER,
    accent: "#5a7a6a",
    winRate: 0.45,
    seed: 71,
  },
  coastal: {
    shortName: "Gulls",
    fullName: "Coastal Gulls",
    parkName: "Harbor Park",
    abbrev: "GUL",
    lineup: GULLS_ROSTER,
    visitorShort: "Tides",
    visitorAbbrev: "TID",
    visitorLineup: TIDES_ROSTER,
    accent: "#3d7ea6",
    winRate: 0.52,
    seed: 113,
  },
  future: {
    shortName: "Circuits",
    fullName: "Future Circuits",
    parkName: "Neon Dome",
    abbrev: "CIR",
    lineup: CIRCUITS_ROSTER,
    visitorShort: "Phantoms",
    visitorAbbrev: "PHN",
    visitorLineup: PHANTOMS_ROSTER,
    accent: "#6a8cff",
    winRate: 0.55,
    seed: 157,
  },
};

/** Home club lineup for Riverside (legacy alias). */
export const RAVENS_LINEUP = RAVENS_ROSTER;
/** Visiting club lineup for Riverside (legacy alias). */
export const BEARS_LINEUP = BEARS_ROSTER;

export function ballclubFor(state: Pick<CityState, "id">): Ballclub {
  return BALLCLUBS[state.id] ?? BALLCLUBS.riverside;
}

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

/** This city's park hosts a game today (regular season or World Series). */
export function hasGameToday(state: CityState) {
  const stadium = findStadium(state);
  if (!stadium || !stadiumIsOpen(stadium)) return false;
  return matchupFor(state.id, state.clock) !== null;
}

export function isGameNight(state: CityState) {
  const stadium = findStadium(state);
  if (!stadium || !stadiumIsOpen(stadium)) return false;
  return isBroadcastWindow(state) && matchupFor(state.id, state.clock) !== null;
}

// ─── League season + World Series ────────────────────────────────────────────

export const LEAGUE_CITY_IDS = ["riverside", "dustfall", "mountain", "coastal", "future"] as const;
/** Apr 1 (0-based day of a 365-day year). */
export const SEASON_START_DOY = 90;
/** Oct 24 — last regular-season game. */
export const SEASON_END_DOY = 296;
/** Oct 26 — World Series Game 1. */
export const SERIES_START_DOY = 298;
export const SERIES_WINS_NEEDED = 4;
export const SERIES_HOST_CITY = "riverside";

export interface TeamRecord {
  cityId: string;
  club: Ballclub;
  wins: number;
  losses: number;
  pct: number;
  gamesBack: number;
}

export interface SeriesGame {
  game: number;
  doy: number;
  topSeedWon: boolean;
}

export interface WorldSeries {
  topSeed: TeamRecord;
  secondSeed: TeamRecord;
  games: SeriesGame[];
}

interface Matchup {
  club: Ballclub;
  favorHome: boolean;
  series: { game: number; topWins: number; secondWins: number } | null;
}

function clockOn(year: number, doy: number, minuteOfDay = GAME_END_MINUTE): CityClock {
  return { year, dayOfYear: doy, minuteOfDay, dayIndex: 0 };
}

function previousDay(clock: CityClock): CityClock {
  return {
    dayIndex: (clock.dayIndex + 6) % 7,
    minuteOfDay: GAME_END_MINUTE,
    dayOfYear: clock.dayOfYear <= 0 ? 364 : clock.dayOfYear - 1,
    year: clock.dayOfYear <= 0 ? clock.year - 1 : clock.year,
  };
}

/** Last day of this year whose game has gone final. */
function lastFinalDoy(clock: CityClock) {
  return clock.minuteOfDay >= GAME_END_MINUTE ? clock.dayOfYear : clock.dayOfYear - 1;
}

/** League games count Fri–Sun (~88 a season); weeknights are exhibitions. */
export function isLeagueDay(year: number, doy: number) {
  return weekdayOf(year, doy) >= 4;
}

function standingsThrough(year: number, lastDoy: number): TeamRecord[] {
  const last = Math.min(SEASON_END_DOY, lastDoy);
  const rows = LEAGUE_CITY_IDS.map((cityId) => {
    const club = BALLCLUBS[cityId];
    let wins = 0;
    let losses = 0;
    for (let d = SEASON_START_DOY; d <= last; d++) {
      if (!isLeagueDay(year, d)) continue;
      if (homeFavoredToday(clockOn(year, d), club)) wins += 1;
      else losses += 1;
    }
    const played = wins + losses;
    return { cityId, club, wins, losses, pct: played ? wins / played : 0, gamesBack: 0 };
  });
  rows.sort((a, b) => b.pct - a.pct || b.wins - a.wins || a.club.fullName.localeCompare(b.club.fullName));
  const leader = rows[0];
  for (const row of rows) {
    row.gamesBack = (leader.wins - row.wins + (row.losses - leader.losses)) / 2;
  }
  return rows;
}

/** Live league table as of the city clock. */
export function leagueStandings(clock: CityClock): TeamRecord[] {
  return standingsThrough(clock.year, lastFinalDoy(clock));
}

/** Top two regular-season clubs meet in a best-of-seven at Ravens Ballpark. */
export function worldSeriesFor(year: number): WorldSeries {
  const [topSeed, secondSeed] = standingsThrough(year, SEASON_END_DOY);
  const odds = topSeed.club.winRate / (topSeed.club.winRate + secondSeed.club.winRate);
  const games: SeriesGame[] = [];
  let top = 0;
  let second = 0;
  for (let i = 0; top < SERIES_WINS_NEEDED && second < SERIES_WINS_NEEDED; i++) {
    const topSeedWon = leagueRoll(year, 900 + i, 77) < odds;
    if (topSeedWon) top += 1;
    else second += 1;
    games.push({ game: i + 1, doy: SERIES_START_DOY + i, topSeedWon });
  }
  return { topSeed, secondSeed, games };
}

function seriesClub(series: WorldSeries): Ballclub {
  const home = series.topSeed.club;
  const away = series.secondSeed.club;
  return {
    ...home,
    parkName: BALLCLUBS[SERIES_HOST_CITY].parkName,
    visitorShort: away.shortName,
    visitorAbbrev: away.abbrev,
    visitorLineup: away.lineup,
  };
}

/** Who plays at this city's park on a given day, or null for an off day. */
function matchupFor(cityId: string, clock: CityClock): Matchup | null {
  const doy = clock.dayOfYear;
  const club = BALLCLUBS[cityId] ?? BALLCLUBS.riverside;
  if (doy >= SEASON_START_DOY && doy <= SEASON_END_DOY) {
    return { club, favorHome: homeFavoredToday(clock, club), series: null };
  }
  if (cityId !== SERIES_HOST_CITY || doy < SERIES_START_DOY) return null;
  const series = worldSeriesFor(clock.year);
  const index = series.games.findIndex((g) => g.doy === doy);
  if (index < 0) return null;
  const before = series.games.slice(0, index);
  return {
    club: seriesClub(series),
    favorHome: series.games[index].topSeedWon,
    series: {
      game: index + 1,
      topWins: before.filter((g) => g.topSeedWon).length,
      secondWins: before.filter((g) => !g.topSeedWon).length,
    },
  };
}

/** The matchup on the scoreboard right now: tonight's, or the most recent final. */
function scoreboardMatchup(state: CityState): Matchup | null {
  const clock = state.clock;
  if (clock.minuteOfDay >= GAME_START_MINUTE) return matchupFor(state.id, clock);
  return matchupFor(state.id, previousDay(clock));
}

/** Club names for the scoreboard — World Series finalists when Riverside hosts. */
export function stadiumClubFor(state: CityState): Ballclub {
  return scoreboardMatchup(state)?.club ?? ballclubFor(state);
}

/** Tonight's World Series game at this city's park (null on any other day/city). */
export function seriesGameToday(state: CityState) {
  return matchupFor(state.id, state.clock)?.series ?? null;
}

/** World Series game number + series score before it, when this park hosts one. */
export function stadiumSeriesGame(state: CityState) {
  return scoreboardMatchup(state)?.series ?? null;
}

export type LeaguePhase = "preseason" | "regular" | "break" | "series" | "complete";

export interface LeagueStatus {
  phase: LeaguePhase;
  standings: TeamRecord[];
  series: {
    topSeed: TeamRecord;
    secondSeed: TeamRecord;
    topWins: number;
    secondWins: number;
    nextGame: number | null;
    nextDoy: number | null;
  } | null;
  champion: Ballclub | null;
}

export function leagueStatus(clock: CityClock): LeagueStatus {
  const doy = clock.dayOfYear;
  if (doy < SEASON_START_DOY) {
    const last = worldSeriesFor(clock.year - 1);
    const topTook = last.games.filter((g) => g.topSeedWon).length >= SERIES_WINS_NEEDED;
    return {
      phase: "preseason",
      standings: standingsThrough(clock.year, -1),
      series: null,
      champion: topTook ? last.topSeed.club : last.secondSeed.club,
    };
  }
  const standings = leagueStandings(clock);
  if (lastFinalDoy(clock) < SEASON_END_DOY) {
    return { phase: "regular", standings, series: null, champion: null };
  }
  const ws = worldSeriesFor(clock.year);
  const done = ws.games.filter((g) => g.doy <= lastFinalDoy(clock));
  const topWins = done.filter((g) => g.topSeedWon).length;
  const secondWins = done.length - topWins;
  const next = ws.games[done.length] ?? null;
  const champion =
    topWins >= SERIES_WINS_NEEDED ? ws.topSeed.club : secondWins >= SERIES_WINS_NEEDED ? ws.secondSeed.club : null;
  return {
    phase: champion ? "complete" : doy < SERIES_START_DOY ? "break" : "series",
    standings,
    series: {
      topSeed: ws.topSeed,
      secondSeed: ws.secondSeed,
      topWins,
      secondWins,
      nextGame: next?.game ?? null,
      nextDoy: next?.doy ?? null,
    },
    champion,
  };
}

/** True during first-pitch hours — used for TV even in cities without a ballpark. */
export function isBroadcastWindow(state: CityState) {
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
  if (!matchupFor(state.id, state.clock)) {
    return { seated: 0.04, walking: 0.08, lights: 0, fireworks: false };
  }
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
  /** Home club runs (field name kept for callers). */
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
  const matchup = matchupFor(state.id, state.clock);
  if (!matchup) return null;
  return simulateGame(state.clock, state.clock.minuteOfDay, matchup.club, matchup.favorHome);
}

/**
 * Completed box score for the most recent game. Null while a game is still
 * underway, or on day one before first pitch.
 */
export function stadiumFinal(state: CityState): StadiumGame | null {
  const stadium = findStadium(state);
  if (!stadium || !stadiumIsOpen(stadium)) return null;
  return broadcastFinal(state);
}

/** Box score / live game for hotel TVs — local club when the city has a park. */
export function stadiumOnTv(state: CityState) {
  if (isBroadcastWindow(state)) {
    const matchup = matchupFor(state.id, state.clock);
    return matchup ? simulateGame(state.clock, state.clock.minuteOfDay, matchup.club, matchup.favorHome) : null;
  }
  return broadcastFinal(state);
}

function broadcastFinal(state: CityState): StadiumGame | null {
  const minute = state.clock.minuteOfDay;
  if (minute >= GAME_START_MINUTE && minute < GAME_END_MINUTE) return null;
  const day = minute >= GAME_END_MINUTE ? state.clock : previousDay(state.clock);
  const matchup = matchupFor(state.id, day);
  if (!matchup) return null;
  return simulateGame(day, GAME_END_MINUTE, matchup.club, matchup.favorHome);
}

export function stadiumWinner(game: StadiumGame, club: Ballclub = BALLCLUBS.riverside) {
  if (game.ravens > game.visitors) return club.shortName;
  if (game.visitors > game.ravens) return club.visitorShort;
  return null;
}

export interface StadiumBigPlay {
  inning: number;
  runs: number;
  home: boolean;
  batter: string;
  label: string;
}

/** Best scoring frame to replay on TV — hometown inning if the home club crossed. */
export function stadiumBigPlay(game: StadiumGame, club: Ballclub = BALLCLUBS.riverside): StadiumBigPlay {
  let inning = 1;
  let runs = 0;
  let home = true;
  for (let i = 0; i < 9; i++) {
    const r = game.ravensLine[i] ?? -1;
    if (r > runs) {
      runs = r;
      inning = i + 1;
      home = true;
    }
  }
  if (runs < 1) {
    for (let i = 0; i < 9; i++) {
      const v = game.visitorsLine[i] ?? -1;
      if (v > runs) {
        runs = v;
        inning = i + 1;
        home = false;
      }
    }
  }
  const lineup = home ? club.lineup : club.visitorLineup;
  const batter = lineup[(inning * 3 + (home ? 1 : 2)) % 9];
  const frame = inningOrdinal(inning);
  let label = `${batter} in the ${frame}`;
  if (runs >= 3) label = `${batter}'s ${runs}-run shot in the ${frame}`;
  else if (runs === 2) label = `${batter} plates two in the ${frame}`;
  else if (runs === 1) label = `${batter} scores in the ${frame}`;
  return { inning, runs, home, batter, label };
}

function inningOrdinal(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

/** Well-mixed 0–1 roll; `hash2` loses its low bits for year-sized inputs. */
function leagueRoll(a: number, b: number, c: number) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function homeFavoredToday(clock: CityClock, club: Ballclub) {
  return leagueRoll(clock.year, clock.dayOfYear, 501 + club.seed) < club.winRate;
}

function simulateGame(clock: CityClock, minuteOfDay: number, club: Ballclub, favorHome: boolean): StadiumGame {
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
    const events = scoringTimes(clock, half, favorHome);
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

  // Lock the day's winner once the game is final (exact HOME_WIN_RATE).
  if (!playing) {
    const fixed = enforceFinalScore(clock, favorHome, ravens, visitors, ravensLine, visitorsLine);
    ravens = fixed.home;
    visitors = fixed.away;
  }

  const outs = playing ? Math.min(2, Math.floor(hash2(clock.dayOfYear, elapsed, 19) * 3)) : 0;
  const balls = playing ? Math.min(3, Math.floor(hash2(clock.dayOfYear, Math.floor(elapsed), 21) * 4)) : 0;
  const strikes = playing ? Math.min(2, Math.floor(hash2(clock.dayOfYear, Math.floor(elapsed), 22) * 3)) : 0;
  const visitorsHits = hitsFor(clock, 3, visitors, halfIndex);
  const ravensHits = hitsFor(clock, 7, ravens, halfIndex);
  const visitorsErrors = errorsFor(clock, 11);
  const ravensErrors = errorsFor(clock, 13);
  const lineup = top ? club.visitorLineup : club.lineup;
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

function enforceFinalScore(
  clock: CityClock,
  favorHome: boolean,
  home: number,
  away: number,
  homeLine: Array<number | null>,
  awayLine: Array<number | null>,
) {
  const margin = 1 + Math.floor(hash2(clock.year, clock.dayOfYear, 512) * 3);
  if (favorHome) {
    if (home > away) return { home, away };
    const need = away - home + margin;
    home += need;
    homeLine[8] = (homeLine[8] ?? 0) + need;
  } else {
    if (away > home) return { home, away };
    const need = home - away + margin;
    away += need;
    awayLine[8] = (awayLine[8] ?? 0) + need;
  }
  return { home, away };
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
 * Moments (0–1 through a half-inning) when a run crosses. Favored side
 * scores a little more often; finals still snap to HOME_WIN_RATE.
 */
function scoringTimes(clock: CityClock, half: number, favorHome: boolean) {
  const homeHalf = half % 2 === 1;
  const favored = homeHalf === favorHome;
  const chance = favored ? 0.17 : 0.14;
  const times: number[] = [];
  for (let i = 0; i < 4; i++) {
    const roll = hash2(clock.year, clock.dayOfYear, 80 + half * 19 + i * 7);
    if (roll >= chance) continue;
    times.push(0.1 + hash2(clock.year, clock.dayOfYear, 180 + half * 13 + i * 11) * 0.8);
  }
  times.sort((a, b) => a - b);
  const rareFour = favored && hash2(clock.year, clock.dayOfYear, 410 + half * 23) > 0.94;
  return times.slice(0, rareFour ? 4 : favored ? 3 : 2);
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
