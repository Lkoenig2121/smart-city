import { pick } from "@/lib/city/rng";
import type { CityState, ParkedCar, TrafficLight, VehicleKind } from "@/lib/city/types";
import { allRoadTiles } from "./pathfinding";

export const SIGNAL_COST = 8_000;
export const WORKS_COST = 3_500;
export const WORKS_SECONDS = 28;
const SIGNAL_PHASE = 8.5;

export function roadKey(x: number, y: number) {
  return `${x},${y}`;
}

export function intersectionArms(state: CityState, x: number, y: number) {
  const road = state.tiles[y]?.[x]?.road;
  if (!road) return 0;
  return Number(road.north) + Number(road.east) + Number(road.south) + Number(road.west);
}

export function lightAt(state: CityState, x: number, y: number) {
  return state.trafficLights.find((light) => light.x === x && light.y === y) ?? null;
}

export function worksAt(state: CityState, x: number, y: number) {
  return state.roadWorks.find((work) => work.x === x && work.y === y) ?? null;
}

export function isWorksBlocked(state: CityState, x: number, y: number) {
  return Boolean(worksAt(state, x, y));
}

export function lightAllows(
  state: CityState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  kind: VehicleKind,
) {
  if (kind === "ambulance" || kind === "firetruck") return true;
  const light = lightAt(state, toX, toY);
  if (!light) return true;
  if (Math.round(fromX) === toX && Math.round(fromY) === toY) return true;
  const ns = Math.abs(toY - Math.round(fromY)) >= Math.abs(toX - Math.round(fromX));
  return light.phase === 0 ? ns : !ns;
}

export function seedTrafficNetwork(state: CityState, rand: () => number) {
  state.trafficLights = [];
  state.roadWorks = [];
  state.parked = [];
  for (let y = 1; y < state.size - 1; y++) {
    for (let x = 1; x < state.size - 1; x++) {
      if (intersectionArms(state, x, y) < 3) continue;
      if (x % 5 !== 0 && y % 5 !== 0) continue;
      state.trafficLights.push({
        x,
        y,
        phase: (x + y) % 2 === 0 ? 0 : 1,
        t: rand() * SIGNAL_PHASE,
      });
    }
  }

  const roads = allRoadTiles(state).filter((tile) => intersectionArms(state, tile.x, tile.y) === 2);
  for (let i = 0; i < 2 && roads.length; i++) {
    const tile = pick(rand, roads);
    if (worksAt(state, tile.x, tile.y) || lightAt(state, tile.x, tile.y)) continue;
    state.roadWorks.push({ x: tile.x, y: tile.y, remaining: 18 + rand() * 16 });
  }

  seedParkedCars(state, rand);
}

function seedParkedCars(state: CityState, rand: () => number) {
  const lots = lotTiles(state);
  const colors = ["#c0392b", "#2471a3", "#1e8449", "#2c3e50", "#ecf0f1", "#e67e22"];
  let n = 0;
  for (const lot of lots) {
    if (rand() > 0.32 || n > 28) continue;
    state.parked.push(makeParked(lot.x, lot.y, pick(rand, colors), 40 + rand() * 80, n));
    n += 1;
  }
}

function makeParked(x: number, y: number, color: string, remaining: number, i: number): ParkedCar {
  const stall = i % 4;
  return {
    id: `park-${x}-${y}-${i}`,
    x,
    y,
    ox: stall % 2 === 0 ? -0.18 : 0.18,
    oy: stall < 2 ? -0.16 : 0.16,
    color,
    remaining,
  };
}

export function lotTiles(state: CityState) {
  const lots: { x: number; y: number }[] = [];
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (state.tiles[y][x].terrain === "lot") lots.push({ x, y });
    }
  }
  return lots;
}

export function parkingFill(state: CityState) {
  const lots = lotTiles(state).length;
  return { parked: state.parked.length, lots, pct: lots ? Math.round((state.parked.length / Math.max(1, lots * 2)) * 100) : 0 };
}

export function trafficFlowScore(state: CityState) {
  if (!state.vehicles.length) return 100;
  let jammed = 0;
  for (const vehicle of state.vehicles) {
    if (densityAt(state, vehicle.x, vehicle.y) >= 3) jammed += 1;
    if (worksAt(state, Math.round(vehicle.x), Math.round(vehicle.y))) jammed += 1;
  }
  const lights = state.trafficLights.length;
  const paved = pavedCount(state);
  const relief = Math.min(18, lights * 0.45 + paved * 0.35);
  const raw = 100 - (jammed / state.vehicles.length) * 62 - state.roadWorks.length * 3 + relief;
  return Math.max(18, Math.min(100, Math.round(raw)));
}

export function pavedCount(state: CityState) {
  let n = 0;
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (state.tiles[y][x].upgraded) n += 1;
    }
  }
  return n;
}

export function densityAt(state: CityState, x: number, y: number) {
  let n = 0;
  for (const vehicle of state.vehicles) {
    if (Math.abs(vehicle.x - x) + Math.abs(vehicle.y - y) < 1.35) n += 1;
  }
  return n;
}

export function densityScale(state: CityState, x: number, y: number) {
  const n = densityAt(state, x, y);
  let scale = n >= 5 ? 0.28 : n >= 3 ? 0.55 : n >= 2 ? 0.78 : 1;
  const tile = state.tiles[Math.round(y)]?.[Math.round(x)];
  if (tile?.upgraded) scale = Math.min(1, scale + 0.18);
  if (lightAt(state, Math.round(x), Math.round(y))) scale = Math.min(1, scale + 0.08);
  return scale;
}

export function tickRoadNetwork(state: CityState, dt: number, rand: () => number) {
  for (const light of state.trafficLights) {
    light.t += dt;
    if (light.t >= SIGNAL_PHASE) {
      light.t = 0;
      light.phase = light.phase === 0 ? 1 : 0;
    }
  }

  for (let i = state.roadWorks.length - 1; i >= 0; i--) {
    const work = state.roadWorks[i];
    work.remaining -= dt;
    if (work.remaining <= 0) {
      const tile = state.tiles[work.y]?.[work.x];
      if (tile) tile.upgraded = true;
      state.roadWorks.splice(i, 1);
    }
  }

  for (let i = state.parked.length - 1; i >= 0; i--) {
    state.parked[i].remaining -= dt;
    if (state.parked[i].remaining <= 0) state.parked.splice(i, 1);
  }

  if (rand() < dt * 0.012 && state.roadWorks.length < 4) {
    const roads = allRoadTiles(state).filter(
      (tile) => !worksAt(state, tile.x, tile.y) && intersectionArms(state, tile.x, tile.y) <= 2,
    );
    if (roads.length) {
      const tile = pick(rand, roads);
      state.roadWorks.push({ x: tile.x, y: tile.y, remaining: WORKS_SECONDS });
    }
  }
}

export function toggleTrafficLight(state: CityState, x: number, y: number): string | true {
  if (!state.tiles[y]?.[x]?.road) return "Lights go on a road intersection.";
  if (intersectionArms(state, x, y) < 3) return "Needs a 3-way or 4-way junction.";
  const existing = lightAt(state, x, y);
  if (existing) {
    state.trafficLights = state.trafficLights.filter((light) => light !== existing);
    return true;
  }
  if (state.budget.treasury < SIGNAL_COST) return `Traffic lights cost $${(SIGNAL_COST / 1000).toFixed(0)}K.`;
  state.budget.treasury -= SIGNAL_COST;
  state.trafficLights.push({ x, y, phase: 0, t: 0 });
  return true;
}

export function startRoadWorks(state: CityState, x: number, y: number): string | true {
  if (!state.tiles[y]?.[x]?.road) return "Pick a road to repair.";
  if (worksAt(state, x, y)) return "Crews are already on this block.";
  if (state.budget.treasury < WORKS_COST) return `Road works cost $${(WORKS_COST / 1000).toFixed(0)}K.`;
  state.budget.treasury -= WORKS_COST;
  state.roadWorks.push({ x, y, remaining: WORKS_SECONDS });
  return true;
}

export function parkNearby(state: CityState, x: number, y: number, color: string, rand: () => number) {
  const lots = lotTiles(state).filter((lot) => Math.abs(lot.x - x) + Math.abs(lot.y - y) <= 2);
  if (!lots.length) return false;
  const lot = pick(rand, lots);
  const parkedHere = state.parked.filter((car) => car.x === lot.x && car.y === lot.y).length;
  if (parkedHere >= 3) return false;
  state.parked.push(makeParked(lot.x, lot.y, color, 25 + rand() * 50, state.parked.length));
  return true;
}

export function removeTrafficAt(state: CityState, x: number, y: number) {
  state.trafficLights = state.trafficLights.filter((light) => !(light.x === x && light.y === y));
  state.roadWorks = state.roadWorks.filter((work) => !(work.x === x && work.y === y));
}
