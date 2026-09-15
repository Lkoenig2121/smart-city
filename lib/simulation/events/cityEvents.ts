import { hash2, pick } from "@/lib/city/rng";
import { findStadium, stadiumIsOpen } from "@/lib/city/stadium";
import type { Building, CityEvent, CityEventKind, CityState } from "@/lib/city/types";
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

function seedDailyEvents(state: CityState, rand: () => number) {
  seedStorm(state);

  const stadium = findStadium(state);
  const hash = hash2(state.clock.year, state.clock.dayOfYear, 441);
  if (stadium && stadiumIsOpen(stadium)) {
    const weekend = state.clock.dayIndex >= 4;
    if (weekend || hash < 0.18) {
      pushEvent(state, {
        kind: "baseball",
        headline: "Riverside Ravens vs. Bayville Bears — 6:00 PM.",
        detail: `${stadium.name} first pitch at six, last out around nine.`,
        x: stadium.origin.x,
        y: stadium.origin.y,
        buildingId: stadium.id,
        remaining: 240,
      });
    } else if (hash > 0.88) {
      pushEvent(state, {
        kind: "concert",
        headline: "Riverside Stadium is hosting a concert tonight.",
        detail: "Harbor lights and a full house after dusk.",
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


