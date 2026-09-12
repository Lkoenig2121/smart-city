import { pick } from "@/lib/city/rng";
import type { CityState, Vehicle } from "@/lib/city/types";
import { jamScale, weatherTrafficScale } from "../events/cityEvents";
import { allRoadTiles, findPath } from "./pathfinding";

export function seedVehicle(state: CityState, vehicle: Vehicle, rand: () => number) {
  const roads = allRoadTiles(state);
  if (roads.length < 2) return;
  const start = pick(rand, roads);
  vehicle.x = start.x;
  vehicle.y = start.y;
  assignRoute(state, vehicle, rand);
}

export function assignRoute(state: CityState, vehicle: Vehicle, rand: () => number) {
  const roads = allRoadTiles(state);
  if (roads.length < 2) {
    vehicle.path = [];
    return;
  }
  const start = {
    x: Math.round(vehicle.x),
    y: Math.round(vehicle.y),
  };
  let goal = pick(rand, roads);
  let guard = 0;
  while (goal.x === start.x && goal.y === start.y && guard++ < 8) {
    goal = pick(rand, roads);
  }
  const path = findPath(state, start, goal);
  vehicle.path = path.length > 1 ? path : [];
  vehicle.pathIndex = 0;
}

export function stepVehicles(state: CityState, dt: number, rand: () => number) {
  const hour = Math.floor(state.clock.minuteOfDay / 60);
  const rush = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
  const night = hour < 5 || hour >= 22;
  const trafficScale = night ? 0.45 : rush ? 1.35 : 1;

  for (const vehicle of state.vehicles) {
    if (vehicle.path.length < 2) {
      assignRoute(state, vehicle, rand);
      continue;
    }
    const target = vehicle.path[Math.min(vehicle.pathIndex + 1, vehicle.path.length - 1)];
    const dx = target.x - vehicle.x;
    const dy = target.y - vehicle.y;
    const dist = Math.hypot(dx, dy);
    const step = vehicle.speed * trafficScale * weatherTrafficScale(state) * jamScale(state, vehicle.x, vehicle.y) * dt;
    if (dist <= step || dist === 0) {
      vehicle.x = target.x;
      vehicle.y = target.y;
      vehicle.pathIndex += 1;
      if (vehicle.pathIndex >= vehicle.path.length - 1) {
        assignRoute(state, vehicle, rand);
      }
    } else {
      vehicle.x += (dx / dist) * step;
      vehicle.y += (dy / dist) * step;
    }
  }
}
