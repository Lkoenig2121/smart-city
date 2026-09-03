import { createBuilding, footprintFor } from "@/lib/simulation/buildings/buildings";
import { citizenName } from "./names";
import { mulberry32, pick, randInt, randRange } from "./rng";
import type {
  Building,
  BuildingKind,
  Citizen,
  CityState,
  RoadCell,
  Terrain,
  Tile,
  Vehicle,
  VehicleKind,
} from "./types";

const SIZE = 40;
const ARTERIALS = [5, 12, 20, 27, 34];

function emptyTile(x: number, y: number): Tile {
  return {
    x,
    y,
    terrain: "grass",
    road: null,
    buildingId: null,
    tree: null,
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

function fillRect(
  tiles: Tile[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  terrain: Terrain,
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBounds(x, y)) continue;
      if (tiles[y][x].road || tiles[y][x].buildingId) continue;
      tiles[y][x].terrain = terrain;
    }
  }
}

export function generateCity(seed = 20260903): CityState {
  const rand = mulberry32(seed);
  const tiles: Tile[][] = Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => emptyTile(x, y)),
  );

  for (let i = 0; i < SIZE; i++) {
    const riverX = Math.round(1 + Math.sin(i * 0.28) * 1.2);
    for (let w = 0; w < 2; w++) {
      if (inBounds(riverX + w, i)) {
        tiles[i][riverX + w].terrain = "water";
        tiles[i][riverX + w].tree = null;
      }
    }
    if (inBounds(riverX + 2, i) && tiles[i][riverX + 2].terrain !== "water") {
      tiles[i][riverX + 2].terrain = "sand";
    }
  }

  const buildings = new Map<string, Building>();
  let buildingIndex = 0;

  const place = (kind: BuildingKind, x: number, y: number) => {
    const fp = footprintFor(kind);
    if (!canPlace(tiles, x, y, fp.w, fp.d)) return null;
    const id = `b${buildingIndex++}`;
    const building = createBuilding(id, kind, x, y, rand, buildingIndex);
    buildings.set(id, building);
    stampBuilding(tiles, building);
    return building;
  };

  place("school", 6, 6);
  place("hospital", 29, 6);
  place("city_hall", 17, 16);
  place("police", 28, 13);
  place("fire", 31, 13);
  place("park_pavilion", 17, 25);

  const skyPlots = [
    [13, 6],
    [14, 7],
    [21, 6],
    [22, 7],
    [13, 13],
    [21, 13],
    [17, 9],
    [23, 10],
  ];
  for (const [x, y] of skyPlots) place("skyscraper", x, y);

  fillRect(tiles, 14, 22, 25, 31, "park");
  fillRect(tiles, 6, 6, 11, 10, "playground");
  fillRect(tiles, 16, 15, 22, 19, "plaza");
  fillRect(tiles, 28, 6, 33, 11, "lot");

  for (const a of ARTERIALS) {
    for (let i = 3; i < SIZE - 1; i++) {
      addRoad(tiles, a, i);
      addRoad(tiles, i, a);
    }
  }
  for (const y of [8, 16, 24, 31]) {
    for (let x = 6; x <= 36; x++) addRoad(tiles, x, y);
  }
  for (const x of [8, 16, 24, 31]) {
    for (let y = 6; y <= 36; y++) addRoad(tiles, x, y);
  }

  connectRoads(tiles);

  for (let y = 6; y <= 18; y++) {
    for (let x = 13; x <= 26; x++) {
      const tile = tiles[y][x];
      if (tile.road || tile.buildingId || tile.terrain === "water") continue;
      if ((x + y) % 3 === 0) place("office", x, y);
      else if (rand() < 0.38) place("shop", x, y);
    }
  }

  const shopStrip = [
    [6, 13],
    [7, 13],
    [9, 21],
    [11, 21],
    [13, 21],
    [21, 33],
    [22, 33],
    [28, 21],
    [33, 21],
    [35, 28],
    [6, 28],
    [36, 16],
  ];
  for (const [x, y] of shopStrip) place("shop", x, y);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const tile = tiles[y][x];
      if (tile.road || tile.buildingId || tile.terrain === "water") continue;
      if (tile.terrain === "park" || tile.terrain === "playground" || tile.terrain === "plaza") {
        continue;
      }

      const downtown = x >= 13 && x <= 26 && y >= 6 && y <= 18;
      if (downtown) continue;

      const nearRoad =
        tiles[y - 1]?.[x]?.road ||
        tiles[y + 1]?.[x]?.road ||
        tiles[y][x - 1]?.road ||
        tiles[y][x + 1]?.road;

      if (nearRoad && rand() < 0.74) {
        if (rand() < 0.18) place("apartment", x, y);
        else place("house", x, y);
      } else if (rand() < 0.55 && tile.terrain === "grass") {
        tile.tree = { variant: randInt(rand, 0, 5), scale: randRange(rand, 0.75, 1.15) };
      }
    }
  }

  for (let y = 22; y <= 31; y++) {
    for (let x = 14; x <= 25; x++) {
      const tile = tiles[y][x];
      if (tile.road || tile.buildingId) continue;
      tile.terrain = "park";
      if (rand() < 0.42) {
        tile.tree = { variant: randInt(rand, 0, 5), scale: randRange(rand, 0.85, 1.25) };
      }
    }
  }

  const homes = [...buildings.values()].filter(
    (b) => b.kind === "house" || b.kind === "apartment",
  );
  const workplaces = [...buildings.values()].filter((b) =>
    ["office", "shop", "skyscraper", "hospital", "school", "police", "fire", "city_hall"].includes(
      b.kind,
    ),
  );

  const citizens: Citizen[] = [];
  for (let i = 0; i < 86; i++) {
    const home = homes.length ? pick(rand, homes) : null;
    const work = workplaces.length ? pick(rand, workplaces) : null;
    citizens.push({
      id: `c${i}`,
      name: citizenName(rand),
      age: randInt(rand, 18, 72),
      homeId: home?.id ?? null,
      workplaceId: work?.id ?? null,
      money: randInt(rand, 1200, 9400),
      happiness: randInt(rand, 58, 94),
      health: randInt(rand, 62, 98),
      education: randInt(rand, 40, 96),
      transport: pick(rand, ["walk", "car", "bus"]),
      x: home ? home.origin.x + 0.3 : randRange(rand, 8, 30),
      y: home ? home.origin.y + 0.3 : randRange(rand, 8, 30),
      path: [],
      pathIndex: 0,
      speed: randRange(rand, 0.9, 1.6),
      color: pick(rand, ["#2c3e6b", "#6b2d2d", "#2f5d4a", "#4a3728", "#3d5a80", "#7a3e2e"]),
      activity: "home",
    });
  }

  const population = [...buildings.values()].reduce((sum, b) => sum + b.stats.residents, 0);

  const vehicles: Vehicle[] = [];
  const colors = [
    "#c0392b",
    "#2471a3",
    "#1e8449",
    "#f4d03f",
    "#7d3c98",
    "#e67e22",
    "#2c3e50",
    "#ecf0f1",
  ];
  const kinds: VehicleKind[] = ["car", "car", "car", "car", "taxi", "bus", "truck"];
  for (let i = 0; i < 38; i++) {
    vehicles.push({
      id: `v${i}`,
      kind: i === 0 ? "ambulance" : i === 1 ? "firetruck" : pick(rand, kinds),
      color: pick(rand, colors),
      x: 12,
      y: 12,
      path: [],
      pathIndex: 0,
      speed: randRange(rand, 1.6, 2.6),
      ownerId: null,
    });
  }

  return {
    id: "riverside",
    name: "Riverside",
    size: SIZE,
    tiles,
    buildings,
    citizens,
    vehicles,
    clock: { dayIndex: 0, minuteOfDay: 7 * 60 + 18 },
    budget: {
      treasury: 4_200_000,
      police: 0.72,
      fire: 0.58,
      healthcare: 0.81,
      education: 0.69,
      parks: 0.44,
      roads: 0.63,
    },
    population,
  };
}

export function roadMask(road: RoadCell) {
  return (
    (road.north ? 1 : 0) |
    (road.east ? 2 : 0) |
    (road.south ? 4 : 0) |
    (road.west ? 8 : 0)
  );
}
