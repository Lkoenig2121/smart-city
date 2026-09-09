import { pick } from "@/lib/city/rng";
import type { Citizen, CityState, Vec2 } from "@/lib/city/types";
import { findPath, nearestRoad } from "@/lib/simulation/traffic/pathfinding";

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

export function syncCitizenSchedules(state: CityState) {
  const hour = Math.floor(state.clock.minuteOfDay / 60);
  const weekend = state.clock.dayIndex >= 5;

  for (const citizen of state.citizens) {
    let next: Citizen["activity"] = citizen.activity;
    if (hour >= 22 || hour < 6) next = "sleep";
    else if (!weekend && hour >= 8 && hour < 17) next = "work";
    else if (hour >= 17 && hour < 19) next = "shop";
    else if (hour >= 18 && hour < 22) {
      const stadium = [...state.buildings.values()].find((b) => b.kind === "baseball_stadium");
      next = stadium && !(stadium.constructionLeft && stadium.constructionLeft > 0) ? "game" : "park";
    }
    else next = "home";

    if (next === citizen.activity && citizen.path.length) continue;
    citizen.activity = next;

    if (next === "work") setPath(state, citizen, buildingDoor(state, citizen.workplaceId));
    else if (next === "home" || next === "sleep") {
      setPath(state, citizen, buildingDoor(state, citizen.homeId));
    } else if (next === "shop") {
      const shops = [...state.buildings.values()].filter((b) => b.kind === "shop");
      const shop = shops.length ? shops[citizen.age % shops.length] : null;
      setPath(state, citizen, shop ? buildingDoor(state, shop.id) : null);
    } else if (next === "park") {
      setPath(state, citizen, nearestRoad(state, 20, 26));
    } else if (next === "game") {
      const stadium = [...state.buildings.values()].find((b) => b.kind === "baseball_stadium");
      setPath(state, citizen, stadium ? buildingDoor(state, stadium.id) : nearestRoad(state, 20, 26));
    }
  }
}

export function stepCitizens(state: CityState, dt: number) {
  for (const citizen of state.citizens) {
    if (citizen.activity === "sleep" || citizen.activity === "work") {
      if (citizen.path.length < 2) continue;
    }
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

export function randomParkWander(state: CityState, rand: () => number) {
  const wanderers = state.citizens.filter((c) => c.activity === "park" && !c.path.length);
  for (const citizen of wanderers) {
    const spots = [
      { x: 16, y: 24 },
      { x: 22, y: 28 },
      { x: 18, y: 29 },
      { x: 24, y: 24 },
    ];
    const goal = nearestRoad(state, pick(rand, spots).x, pick(rand, spots).y);
    if (goal) setPath(state, citizen, goal);
  }
}
