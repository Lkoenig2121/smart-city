import { hash2, pick } from "@/lib/city/rng";
import { formatDate } from "@/lib/city/calendar";
import {
  BALLCLUBS,
  SEASON_END_DOY,
  SEASON_START_DOY,
  SERIES_HOST_CITY,
  SERIES_START_DOY,
  ballclubFor,
  findStadium,
  leagueStatus,
  stadiumIsOpen,
} from "@/lib/city/stadium";
import type { Building, CityEvent, CityEventKind, CityState } from "@/lib/city/types";
import { cityThemeFor } from "@/lib/city/world/cities";
import { findPath, nearestRoad } from "../traffic/pathfinding";
import {
  formatClockMinutes,
  stormRemainingSeconds,
  weatherFor,
  wetWindow,
} from "../weather/weather";

const STREET = [
  "Maple",
  "Cedar",
  "Harbor",
  "Willow",
  "Oak",
  "Pioneer",
  "Lakeside",
  "Summit",
  "Orchid",
  "Beacon",
];

let nextId = 1;

export function eventIcon(kind: CityEventKind) {
  switch (kind) {
    case "accident":
      return "🚗";
    case "fire":
      return "🔥";
    case "storm":
      return "🌧️";
    case "concert":
      return "🎤";
    case "baseball":
      return "⚾";
    case "festival":
      return "🎉";
    case "construction":
      return "🏗️";
  }
}

export function hasEvent(state: CityState, kind: CityEventKind) {
  return state.events.some((event) => event.kind === kind);
}

export function eventsAt(state: CityState, kind: CityEventKind) {
  return state.events.filter((event) => event.kind === kind);
}

function pushEvent(state: CityState, event: Omit<CityEvent, "id" | "icon"> & { icon?: string }) {
  state.events.push({
    id: `ev-${nextId++}-${state.clock.year}-${state.clock.dayOfYear}`,
    icon: event.icon ?? eventIcon(event.kind),
    ...event,
  });
}

function streetName(x: number, y: number) {
  if (x === 20 || y === 20) return "Riverside Avenue";
  const name = STREET[(x + y) % STREET.length];
  return x % 5 === 0 ? `${name} Avenue` : `${name} Street`;
}

function randomRoad(state: CityState, rand: () => number) {
  const roads: { x: number; y: number }[] = [];
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (state.tiles[y][x].road) roads.push({ x, y });
    }
  }
  return roads.length ? pick(rand, roads) : { x: 20, y: 20 };
}

function homes(state: CityState) {
  return [...state.buildings.values()].filter(
    (b) => (b.kind === "apartment" || b.kind === "house") && !(b.constructionLeft && b.constructionLeft > 0),
  );
}

export function announceConstruction(state: CityState, building: Building) {
  if (hasEvent(state, "construction") && state.events.some((e) => e.buildingId === building.id)) return;
  pushEvent(state, {
    kind: "construction",
    headline:
      building.stats.extra?.lodging === "hotel"
        ? "New hotel construction begins."
        : building.stats.extra?.venue === "mall"
          ? "New mall construction begins."
          : `New ${building.kind === "skyscraper" ? "skyscraper" : building.kind.replace("_", " ")} construction begins.`,
    detail: `${building.name} is going up.`,
    x: building.origin.x,
    y: building.origin.y,
    buildingId: building.id,
    remaining: Math.max(18, building.constructionLeft ?? 24),
  });
}

function seedStorm(state: CityState) {
  if (hasEvent(state, "storm") || !state.weather.wet) return;
  const window = wetWindow(state.clock.year, state.clock.dayOfYear);
  const snow = state.weather.kind === "snow";
  pushEvent(state, {
    kind: "storm",
    headline: snow ? "Snow moving through Riverside." : "Heavy rainfall expected.",
    detail: window
      ? `WX 4: ${state.weather.tempF}° until ${formatClockMinutes(window.endMin)}.`
      : `WX 4: ${state.weather.tempF}° for the next few hours.`,
    icon: snow ? "❄️" : "🌧️",
    x: 20,
    y: 20,
    remaining: stormRemainingSeconds(state.clock),
  });
}

/** League-wide World Series coverage — every city's news desk runs it. */
function seedWorldSeriesNews(state: CityState) {
  const doy = state.clock.dayOfYear;
  if (doy < SEASON_END_DOY - 7) return;
  const status = leagueStatus(state.clock);
  const host = BALLCLUBS[SERIES_HOST_CITY].parkName;
  const stadium = findStadium(state);
  const at = stadium ? { x: stadium.origin.x, y: stadium.origin.y, buildingId: stadium.id } : { x: 16, y: 16 };
  const date = (d: number) => formatDate(state.clock.year, d);

  if (status.phase === "regular") {
    const [first, second, third] = status.standings;
    const left = SEASON_END_DOY - doy + 1;
    pushEvent(state, {
      kind: "baseball",
      headline:
        left <= 1
          ? "Final day of the regular season — World Series berths on the line."
          : `Pennant race: ${first.club.shortName} and ${second.club.shortName} hold the World Series spots.`,
      detail: third
        ? `${third.club.fullName} sit ${third.gamesBack - second.gamesBack} back of 2nd with ${left} day${left === 1 ? "" : "s"} left. Series opens ${date(SERIES_START_DOY)} at ${host}.`
        : `Series opens ${date(SERIES_START_DOY)} at ${host}.`,
      ...at,
      remaining: 240,
    });
    return;
  }

  const series = status.series;
  if (!series) return;
  const a = series.topSeed.club;
  const b = series.secondSeed.club;

  if (status.phase === "break") {
    pushEvent(state, {
      kind: "baseball",
      headline: `World Series set: ${a.fullName} vs. ${b.fullName}.`,
      detail: `Best of seven at ${host}, Riverside. Game 1 ${date(SERIES_START_DOY)} at 6:00 PM.`,
      ...at,
      remaining: 240,
    });
    return;
  }

  if (status.phase === "series" && series.nextGame && series.nextDoy === doy) {
    const tally =
      series.topWins === series.secondWins
        ? `Series tied ${series.topWins}–${series.secondWins}.`
        : series.topWins > series.secondWins
          ? `${a.shortName} lead ${series.topWins}–${series.secondWins}.`
          : `${b.shortName} lead ${series.secondWins}–${series.topWins}.`;
    const clinch = series.topWins === 3 || series.secondWins === 3;
    pushEvent(state, {
      kind: "baseball",
      headline: `World Series Game ${series.nextGame} tonight: ${a.shortName} vs. ${b.shortName}.`,
      detail: `${series.nextGame === 1 ? "Series opener." : tally}${clinch ? " A title could be decided tonight." : ""} First pitch 6:00 PM at ${host} — watch for the blimp.${state.id === SERIES_HOST_CITY ? " Heavy traffic around the ballpark from 3 PM." : ""}`,
      ...at,
      remaining: 240,
    });
    return;
  }

  if (status.phase === "complete" && status.champion) {
    const lastGame = series.topWins + series.secondWins;
    const clinchedDoy = SERIES_START_DOY + lastGame - 1;
    if (doy > clinchedDoy + 2) return;
    const high = Math.max(series.topWins, series.secondWins);
    const low = Math.min(series.topWins, series.secondWins);
    pushEvent(state, {
      kind: "baseball",
      icon: "🏆",
      headline: `${status.champion.fullName} win the World Series!`,
      detail: `Took the series ${high}–${low} at ${host}. Parade talk is already underway.`,
      ...at,
      remaining: 240,
    });
  }
}

function seedDailyEvents(state: CityState, rand: () => number) {
  seedStorm(state);

  const stadium = findStadium(state);
  const club = ballclubFor(state);
  const hash = hash2(state.clock.year, state.clock.dayOfYear, 441);
  const doy = state.clock.dayOfYear;
  const inSeason = doy >= SEASON_START_DOY && doy <= SEASON_END_DOY;
  seedWorldSeriesNews(state);
  if (stadium && stadiumIsOpen(stadium)) {
    const weekend = state.clock.dayIndex >= 4;
    if (inSeason && (weekend || hash < 0.18)) {
      pushEvent(state, {
        kind: "baseball",
        headline: `${club.fullName} vs. ${club.visitorShort} — 6:00 PM.`,
        detail: `${stadium.name} first pitch at six, last out around nine.`,
        x: stadium.origin.x,
        y: stadium.origin.y,
        buildingId: stadium.id,
        remaining: 240,
      });
    } else if (hash > 0.88) {
      pushEvent(state, {
        kind: "concert",
        headline: `${stadium.name} is hosting a concert tonight.`,
        detail:
          cityThemeFor(state.id).desertAccent
            ? "Sandstone lights and a full house after dusk."
            : "Harbor lights and a full house after dusk.",
        x: stadium.origin.x,
        y: stadium.origin.y,
        buildingId: stadium.id,
        remaining: 240,
      });
    }
  }

  if (state.clock.dayIndex === 5 && hash2(state.clock.year, state.clock.dayOfYear, 77) < 0.45) {
    pushEvent(state, {
      kind: "festival",
      headline: "Waterfront Festival begins Saturday.",
      detail: "Music, food stalls, and the ferris wheel until late.",
      x: 3,
      y: 18,
      remaining: 240,
    });
  }

  for (const building of state.buildings.values()) {
    if (building.constructionLeft && building.constructionLeft > 0) {
      announceConstruction(state, building);
      break;
    }
  }

  void rand;
}

function spawnAccident(state: CityState, rand: () => number) {
  const at = randomRoad(state, rand);
  pushEvent(state, {
    kind: "accident",
    headline: `Accident reported on ${streetName(at.x, at.y)}.`,
    detail: "Expect delays. Emergency crews are on the way.",
    x: at.x,
    y: at.y,
    remaining: 55,
  });
}

function spawnFire(state: CityState, rand: () => number) {
  const options = homes(state);
  const building = options.length ? pick(rand, options) : [...state.buildings.values()][0];
  if (!building) return;
  pushEvent(state, {
    kind: "fire",
    headline: `Fire reported at ${building.name}.`,
    detail: "Riverside Fire is rolling. Stay clear of the block.",
    x: building.origin.x,
    y: building.origin.y,
    buildingId: building.id,
    remaining: 70,
  });
  dispatchFiretruck(state, building);
}

function dispatchFiretruck(state: CityState, building: Building) {
  const truck = state.vehicles.find((v) => v.kind === "firetruck");
  if (!truck) return;
  const door = nearestRoad(state, building.origin.x, building.origin.y);
  if (!door) return;
  const start = { x: Math.round(truck.x), y: Math.round(truck.y) };
  const path = findPath(state, start, door);
  truck.path = path.length > 1 ? path : [start, door];
  truck.pathIndex = 0;
}

export function bootstrapEvents(state: CityState) {
  state.weather = weatherFor(state.clock);
  state.events = [];
  seedDailyEvents(state, () => hash2(state.clock.year, state.clock.dayOfYear, 3));
}

export function tickCityEvents(state: CityState, dt: number, rand: () => number, newDay: boolean) {
  state.weather = weatherFor(state.clock);

  if (newDay) {
    state.events = state.events.filter((event) => {
      if (event.kind !== "construction") return false;
      const building = event.buildingId ? state.buildings.get(event.buildingId) : null;
      return Boolean(building?.constructionLeft && building.constructionLeft > 0);
    });
    seedDailyEvents(state, rand);
  }

  if (state.weather.wet) seedStorm(state);
  else state.events = state.events.filter((event) => event.kind !== "storm");

  for (const event of state.events) event.remaining -= dt;
  state.events = state.events.filter((event) => event.remaining > 0);

  const hour = Math.floor(state.clock.minuteOfDay / 60);
  if (hour >= 8 && hour <= 20 && !hasEvent(state, "accident") && rand() < dt * 0.005) {
    spawnAccident(state, rand);
  }
  if (hour >= 9 && hour <= 22 && !hasEvent(state, "fire") && rand() < dt * 0.0016) {
    spawnFire(state, rand);
  }
}

export function weatherTrafficScale(state: CityState) {
  if (state.weather.kind === "snow") return 0.58;
  if (state.weather.kind === "rain") return 0.72;
  return 1;
}

export function jamScale(state: CityState, x: number, y: number) {
  let scale = 1;
  for (const event of state.events) {
    if (event.kind !== "accident") continue;
    const dist = Math.hypot(x - event.x, y - event.y);
    if (dist < 0.8) scale = Math.min(scale, 0.05);
    else if (dist < 2.4) scale = Math.min(scale, 0.35);
  }
  return scale;
}


