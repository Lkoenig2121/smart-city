import { createBuilding, footprintFor } from "@/lib/simulation/buildings/buildings";
import { markLodging } from "./lodging";
import { mulberry32, pick, randRange } from "./rng";
import { spawnCitizens } from "@/lib/simulation/citizens/spawnCitizens";
import { bootstrapEvents } from "@/lib/simulation/events/cityEvents";
import { seedTrafficNetwork } from "@/lib/simulation/traffic/roadNetwork";
import { openingClock, weatherFor } from "@/lib/simulation/weather/weather";
import { markAllEnterableVenues } from "./venues";
import type {
  Building,
  BuildingKind,
  CityState,
  Tile,
  Vehicle,
  VehicleKind,
} from "./types";

/** Egypt-inspired desert city past Highway 93 — isometric overview + street. */
const SIZE = 36;
const NILE_X = 10;
const NILE_W = 3;
const ARTERIALS = [7, 16, 24, 31];

const SANDSTONE = ["#e8d5a8", "#d4bc86", "#c9a86a", "#b8956a", "#f0e0b8"];
const SAND_ROOFS = ["#8a5a3a", "#6b4428", "#a07040", "#5c4030"];
const ACCENTS = ["#2a6b5a", "#c9a44c", "#1f4d6a", "#8b1e1e"];

function emptyTile(x: number, y: number): Tile {
  return {
    x,
    y,
    terrain: "sand",
    road: null,
    bridge: null,
    buildingId: null,
    tree: null,
    graffiti: null,
  };
}

function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
}

function addRoad(tiles: Tile[][], x: number, y: number) {
  if (!inBounds(x, y)) return;
  const tile = tiles[y][x];
  if (tile.terrain === "water" || tile.buildingId) return;
  tile.road = { north: false, east: false, south: false, west: false };
  tile.tree = null;
}

function connectRoads(tiles: Tile[][]) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const tile = tiles[y][x];
      if (!tile.road) continue;
      tile.road = {
        north: Boolean(tiles[y - 1]?.[x]?.road),
        east: Boolean(tiles[y][x + 1]?.road),
        south: Boolean(tiles[y + 1]?.[x]?.road),
        west: Boolean(tiles[y][x - 1]?.road),
      };
    }
  }
}

function canPlace(tiles: Tile[][], x: number, y: number, w: number, d: number) {
  for (let dy = 0; dy < d; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inBounds(tx, ty)) return false;
      const tile = tiles[ty][tx];
      if (tile.road || tile.buildingId || tile.terrain === "water") return false;
    }
  }
  return true;
}

function stampBuilding(tiles: Tile[][], building: Building) {
  for (let dy = 0; dy < building.depth; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const tile = tiles[building.origin.y + dy][building.origin.x + dx];
      tile.buildingId = building.id;
      tile.tree = null;
    }
  }
}

function paintEgypt(building: Building, rand: () => number) {
  building.wallColor = pick(rand, SANDSTONE);
  building.roofColor = pick(rand, SAND_ROOFS);
  building.accentColor = pick(rand, ACCENTS);
  if (building.kind === "tower" || building.kind === "skyscraper") {
    // Pyramid-like silhouette: fewer floors but warm stone.
    building.floors = Math.max(8, Math.min(building.floors, 18));
    building.wallColor = pick(rand, ["#e6d2a0", "#d2b87a", "#c4a86a"]);
    building.roofColor = "#a08050";
  }
  if (building.kind === "city_hall") {
    building.name = "Temple of the Horizon";
    building.wallColor = "#f0e4c4";
    building.roofColor = "#2a6b5a";
    building.accentColor = "#c9a44c";
  }
  if (building.kind === "park_pavilion") {
    building.name = "Oasis Court";
  }
}

/** Desert metropolis on the far side of Highway 93 — Nile, sandstone, temples. */
export function generateDustfall(seed = 934201): CityState {
  const rand = mulberry32(seed);
  const tiles: Tile[][] = Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => emptyTile(x, y)),
  );

  // Nile corridor.
  for (let y = 0; y < SIZE; y++) {
    for (let w = 0; w < NILE_W; w++) {
      const tile = tiles[y][NILE_X + w];
      if (!tile) continue;
      tile.terrain = "water";
      tile.tree = null;
      tile.road = null;
    }
    for (const bank of [NILE_X - 1, NILE_X + NILE_W]) {
      const tile = tiles[y][bank];
      if (tile && tile.terrain !== "water") tile.terrain = "sand";
    }
  }

  // Sparse oasis parks.
  for (const [ox, oy] of [
    [18, 8],
    [26, 18],
    [20, 28],
  ] as const) {
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const tile = tiles[oy + dy]?.[ox + dx];
        if (tile && tile.terrain !== "water") tile.terrain = "park";
      }
    }
  }

  for (const x of ARTERIALS) {
    for (let y = 0; y < SIZE; y++) {
      if (tiles[y][x]?.terrain === "water") continue;
      addRoad(tiles, x, y);
    }
  }
  for (const y of [4, 11, 18, 25, 32]) {
    for (let x = 0; x < SIZE; x++) {
      if (tiles[y][x]?.terrain === "water") continue;
      addRoad(tiles, x, y);
    }
  }
  // South approach from Highway 93 / Riverside Bridge.
  for (let y = SIZE - 6; y < SIZE; y++) addRoad(tiles, 16, y);
  // Canyon wash just north of the portal — bridge carries the arterial south to Riverside.
  for (let x = 14; x <= 18; x++) {
    for (const y of [33, 34]) {
      const tile = tiles[y]?.[x];
      if (!tile) continue;
      if (x === 16) {
        tile.terrain = "sand";
        tile.bridge = {
          axis: "ns",
          deck: 20,
          pier: true,
          pylon: true,
          abutment: y === 33 ? "start" : "end",
          graffiti: null,
        };
        addRoad(tiles, x, y);
      } else {
        tile.terrain = "water";
        tile.road = null;
        tile.tree = null;
        tile.bridge = null;
      }
    }
  }
  // Bridge across the Nile on a few latitudes.
  for (const y of [11, 18, 25]) {
    for (let w = 0; w < NILE_W; w++) {
      const tile = tiles[y][NILE_X + w];
      if (!tile) continue;
      tile.terrain = "sand";
      tile.bridge = { axis: "ew", deck: 18, pier: true, pylon: false, abutment: null, graffiti: null };
      addRoad(tiles, NILE_X + w, y);
    }
  }
  connectRoads(tiles);

  const buildings = new Map<string, Building>();
  let buildingIndex = 0;

  const placeSized = (kind: BuildingKind, x: number, y: number, w: number, d: number) => {
    if (!canPlace(tiles, x, y, w, d)) return null;
    const id = `df${buildingIndex++}`;
    const building = createBuilding(id, kind, x, y, rand, buildingIndex);
    building.width = w;
    building.depth = d;
    paintEgypt(building, rand);
    buildings.set(id, building);
    stampBuilding(tiles, building);
    return building;
  };

  const place = (kind: BuildingKind, x: number, y: number) => {
    const fp = footprintFor(kind);
    return placeSized(kind, x, y, fp.w, fp.d);
  };

  const temple = place("city_hall", 17, 12);
  if (temple) temple.name = "Temple of the Horizon";

  const inn = placeSized("shop", 18, 19, 3, 2);
  if (inn) {
    markLodging(inn, "hotel");
    inn.name = "Caravanserai";
    paintEgypt(inn, rand);
  }

  // Pyramid district (west of Nile).
  place("tower", 4, 6);
  place("skyscraper", 4, 14);
  place("tower", 5, 22);
  const great = placeSized("tower", 3, 10, 3, 3);
  if (great) {
    great.name = "Great Pyramid";
    great.floors = 22;
    great.wallColor = "#e8d5a0";
    great.roofColor = "#c9a44c";
  }

  // Market & civic east of the river.
  place("shop", 17, 5);
  place("shop", 20, 5);
  place("shop", 24, 12);
  place("shop", 25, 19);
  place("hospital", 28, 6);
  place("school", 28, 14);
  place("police", 22, 25);
  place("fire", 26, 25);
  place("park_pavilion", 19, 9);
  place("park_pavilion", 27, 19);

  place("house", 15, 7);
  place("house", 15, 8);
  place("house", 18, 26);
  place("house", 19, 26);
  const flatsA = place("apartment", 22, 7);
  if (flatsA) {
    markLodging(flatsA, "residences");
    flatsA.name = "Nile Court";
    paintEgypt(flatsA, rand);
  }
  const flatsB = place("apartment", 24, 7);
  if (flatsB) {
    markLodging(flatsB, "residences");
    flatsB.name = "Sandstone Residences";
    paintEgypt(flatsB, rand);
  }
  place("office", 21, 14);
  place("office", 22, 14);
  place("skyscraper", 30, 20);
  place("tower", 31, 10);

  // Every Dustfall building should be walk-in (civic by kind, rest tagged here).
  markAllEnterableVenues(buildings);

  for (let i = 0; i < 18; i++) {
    const x = 1 + Math.floor(rand() * (SIZE - 2));
    const y = 1 + Math.floor(rand() * (SIZE - 2));
    const tile = tiles[y][x];
    if (!tile.road && !tile.buildingId && tile.terrain === "sand" && rand() > 0.72) {
      tile.tree = { variant: Math.floor(rand() * 4), scale: 0.55 + rand() * 0.5 };
    }
  }

  const citizens = spawnCitizens(buildings, rand).slice(0, 36);
  const population = [...buildings.values()].reduce((sum, b) => sum + b.stats.residents, 0);

  const vehicles: Vehicle[] = [];
  const colors = ["#c9a44c", "#8a5a3a", "#2a6b5a", "#e8d5a8", "#1f4d6a", "#c0392b"];
  const kinds: VehicleKind[] = ["car", "car", "car", "truck", "taxi", "bus"];
  for (let i = 0; i < 22; i++) {
    vehicles.push({
      id: `dfv${i}`,
      kind: pick(rand, kinds),
      color: pick(rand, colors),
      x: 16,
      y: 20,
      path: [],
      pathIndex: 0,
      speed: randRange(rand, 1.3, 2.1),
      ownerId: null,
    });
  }

  const clock = openingClock();
  const state: CityState = {
    id: "dustfall",
    name: "Dustfall",
    size: SIZE,
    tiles,
    buildings,
    citizens,
    vehicles,
    clock,
    weather: weatherFor(clock),
    events: [],
    budget: {
      treasury: 1_450_000,
      police: 0.52,
      fire: 0.58,
      healthcare: 0.48,
      education: 0.42,
      parks: 0.55,
      roads: 0.68,
    },
    population,
    trafficLights: [],
    roadWorks: [],
    parked: [],
  };
  seedTrafficNetwork(state, rand);
  bootstrapEvents(state);
  return state;
}

/** Street spawn when arriving from Highway 93 (just north of the Riverside Bridge). */
export const DUSTFALL_ARRIVAL = { x: 16.5, y: 31.5, yaw: 0 };
