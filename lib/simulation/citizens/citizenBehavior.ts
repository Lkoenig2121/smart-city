import { pick } from "@/lib/city/rng";
import type { Citizen, CitizenActivity, CityState, Vec2 } from "@/lib/city/types";
import { findPath, nearestRoad } from "@/lib/simulation/traffic/pathfinding";
import {
  citizenIsOutdoors,
  librariesOf,
  parkRoads,
  scheduledActivity,
  stadiumsOf,
} from "./citizenSchedules";

function buildingDoor(state: CityState, buildingId: string | null): Vec2 | null {
  if (!buildingId) return null;
  const building = state.buildings.get(buildingId);
  if (!building) return null;
  return nearestRoad(state, building.origin.x, building.origin.y);
}

function setPath(state: CityState, citizen: Citizen, goal: Vec2 | null) {
  if (!goal) {
    citizen.path = [];
    return;
  }
  const start = nearestRoad(state, Math.round(citizen.x), Math.round(citizen.y));
  if (!start) {
    citizen.path = [];
    return;
  }
  citizen.path = findPath(state, start, goal);
  citizen.pathIndex = 0;
}

function goalFor(state: CityState, citizen: Citizen, activity: CitizenActivity): Vec2 | null {
  if (activity === "work") return buildingDoor(state, citizen.workplaceId);
  if (activity === "school") return buildingDoor(state, citizen.schoolId);
  if (activity === "shop") return buildingDoor(state, citizen.shopId);
  if (activity === "restaurant") return buildingDoor(state, citizen.restaurantId);
  if (activity === "library") {
    const library = librariesOf(state)[0];
    return library ? buildingDoor(state, library.id) : buildingDoor(state, citizen.schoolId);
  }
  if (activity === "stadium") {
    const stadium = stadiumsOf(state)[0];
    return stadium ? buildingDoor(state, stadium.id) : nearestRoad(state, 20, 26);
  }
  if (activity === "park") return nearestRoad(state, 20, 26);
  if (activity === "home" || activity === "sleep" || activity === "hotel") {
    return buildingDoor(state, citizen.homeId);
  }
  return null;
}

export function syncCitizenSchedules(state: CityState) {
  for (const citizen of state.citizens) {
    const next = scheduledActivity(state, citizen);
    if (next === citizen.activity) continue;
    citizen.activity = next;
    setPath(state, citizen, goalFor(state, citizen, next));
  }
}

export function stepCitizens(state: CityState, dt: number) {
  for (const citizen of state.citizens) {
    if (citizen.path.length < 2) continue;
    const target = citizen.path[Math.min(citizen.pathIndex + 1, citizen.path.length - 1)];
    const dx = target.x - citizen.x;
    const dy = target.y - citizen.y;
    const dist = Math.hypot(dx, dy);
    const step = citizen.speed * dt;
    if (dist <= step || dist === 0) {
      citizen.x = target.x;
      citizen.y = target.y;
      citizen.pathIndex += 1;
      if (citizen.pathIndex >= citizen.path.length - 1) citizen.path = [];
    } else {
      citizen.x += (dx / dist) * step;
      citizen.y += (dy / dist) * step;
    }
  }
}

/** After they arrive at an outdoor stop, give them a short sidewalk loop. */
export function wanderOutdoors(state: CityState, rand: () => number) {
  for (const citizen of state.citizens) {
    if (!citizenIsOutdoors(citizen) || citizen.path.length) continue;
    if (citizen.activity === "park") {
      const spot = pick(rand, parkRoads());
      const goal = nearestRoad(state, spot.x, spot.y);
      if (goal) setPath(state, citizen, goal);
      continue;
    }
    const door = goalFor(state, citizen, citizen.activity);
    if (!door) continue;
    const around = [
      { x: door.x + 1, y: door.y },
      { x: door.x - 1, y: door.y },
      { x: door.x, y: door.y + 1 },
      { x: door.x, y: door.y - 1 },
    ];
    const goal = nearestRoad(state, pick(rand, around).x, pick(rand, around).y) ?? door;
    setPath(state, citizen, goal);
  }
}

export { citizenIsOutdoors };
