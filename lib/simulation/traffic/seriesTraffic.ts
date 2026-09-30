import { pick } from "@/lib/city/rng";
import { BALLCLUBS, findStadium, seriesGameToday, stadiumGateTile, worldSeriesFor } from "@/lib/city/stadium";
import type { CityState, Vec2, Vehicle, VehicleKind } from "@/lib/city/types";
import { allRoadTiles, findPath, nearestRoad } from "./pathfinding";
import { parkNearby } from "./roadNetwork";

/** Extra vehicle slots the renderers reserve for World Series crowds. */
export const SERIES_TRAFFIC_EXTRA = 56;
const PREFIX = "ws-";
const KINDS: VehicleKind[] = ["car", "car", "car", "car", "taxi", "taxi", "bus"];

type Phase = "arrive" | "game" | "depart";

function seriesPhase(state: CityState): Phase | null {
  if (!seriesGameToday(state)) return null;
  const m = state.clock.minuteOfDay;
  if (m >= 15 * 60 && m < 18 * 60 + 15) return "arrive";
  if (m >= 18 * 60 + 15 && m < 21 * 60) return "game";
  if (m >= 21 * 60 && m < 22 * 60 + 45) return "depart";
  return null;
}

const TARGET: Record<Phase, number> = { arrive: SERIES_TRAFFIC_EXTRA, game: 18, depart: SERIES_TRAFFIC_EXTRA };

function isSeriesVehicle(vehicle: Vehicle) {
  return vehicle.id.startsWith(PREFIX);
}

function dist(a: Vec2, b: Vec2) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function route(state: CityState, vehicle: Vehicle, from: Vec2, to: Vec2) {
  vehicle.x = from.x;
  vehicle.y = from.y;
  const path = findPath(state, from, to);
  vehicle.path = path.length > 1 ? path : [];
  vehicle.pathIndex = 0;
  return vehicle.path.length > 1;
}

/**
 * World Series nights in the host city: cars, cabs and buses stream toward the
 * ballpark before first pitch, a few circle during the game, and the lot
 * empties back across town after the final out.
 */
export function tickSeriesTraffic(state: CityState, dt: number, rand: () => number) {
  const phase = seriesPhase(state);
  const stadium = phase ? findStadium(state) : null;
  const gate = stadium ? nearestRoad(state, stadiumGateTile(stadium).x, stadiumGateTile(stadium).y) : null;
  if (!phase || !gate) {
    if (state.vehicles.some(isSeriesVehicle)) {
      state.vehicles = state.vehicles.filter((v) => !isSeriesVehicle(v));
    }
    return;
  }

  const roads = allRoadTiles(state);
  const far = roads.filter((r) => dist(r, gate) >= 10);
  const near = roads.filter((r) => dist(r, gate) <= 4);
  if (!far.length || !near.length) return;

  const series = worldSeriesFor(state.clock.year);
  const colors = [
    series.topSeed.club.accent,
    series.secondSeed.club.accent,
    BALLCLUBS.riverside.accent,
    "#f4f1ea",
    "#2c3e50",
    "#c0392b",
    "#e8c36a",
  ];

  const mine = state.vehicles.filter(isSeriesVehicle);
  const target = TARGET[phase];
  if (mine.length > target) {
    const drop = new Set(mine.slice(target).map((v) => v.id));
    state.vehicles = state.vehicles.filter((v) => !drop.has(v.id));
  }
  // Trickle in rather than popping a full lot at once.
  let spawn = Math.min(target - mine.length, Math.max(1, Math.round(dt * 3)));
  let n = 0;
  while (spawn-- > 0) {
    while (state.vehicles.some((v) => v.id === `${PREFIX}${n}`)) n++;
    const vehicle: Vehicle = {
      id: `${PREFIX}${n}`,
      kind: pick(rand, KINDS),
      color: pick(rand, colors),
      x: 0,
      y: 0,
      path: [],
      pathIndex: 0,
      speed: 1.1 + rand() * 0.8,
      ownerId: null,
    };
    if (phase === "depart") route(state, vehicle, pick(rand, near), pick(rand, far));
    else route(state, vehicle, pick(rand, far), gate);
    state.vehicles.push(vehicle);
  }

  for (const vehicle of state.vehicles) {
    if (!isSeriesVehicle(vehicle)) continue;
    const here = { x: Math.round(vehicle.x), y: Math.round(vehicle.y) };
    const goal = vehicle.path[vehicle.path.length - 1];
    if (phase === "arrive") {
      if (dist(here, gate) <= 1) {
        if (vehicle.kind !== "bus") parkNearby(state, here.x, here.y, vehicle.color, rand);
        route(state, vehicle, pick(rand, far), gate);
      } else if (!goal || dist(goal, gate) > 1) {
        if (!route(state, vehicle, here, gate)) route(state, vehicle, pick(rand, far), gate);
      }
    } else if (phase === "depart") {
      const done = !goal || vehicle.pathIndex >= vehicle.path.length - 1;
      if (done && dist(here, gate) >= 10) {
        route(state, vehicle, pick(rand, near), pick(rand, far));
      } else if (goal && dist(goal, gate) < 10) {
        if (!route(state, vehicle, here, pick(rand, far))) route(state, vehicle, pick(rand, near), pick(rand, far));
      }
    }
  }
}
