import { createBuilding, footprintFor } from "@/lib/simulation/buildings/buildings";
import { markLodging } from "./lodging";
import { SUBWAY_STATIONS, markSubwayStation } from "./subway";
import { markNotableVenues } from "./venues";
import {
  RIVER_W,
  riverXAt,
} from "./waterfront";
import { mulberry32, pick, randInt, randRange } from "./rng";
import { spawnCitizens } from "@/lib/simulation/citizens/spawnCitizens";
import type {
  Building,
  BuildingKind,
  CityState,
  Graffiti,
  RoadCell,
  Terrain,
  Tile,
  Vehicle,
  VehicleKind,
} from "./types";

const SIZE = 40;
const ARTERIALS = [5, 12, 20, 27, 34];

export const BRIDGE_DECK = 22;

function emptyTile(x: number, y: number): Tile {
  return {
    x,
    y,
    terrain: "grass",
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
      const tile = tiles[y][x];
      if (tile.road || tile.buildingId) continue;
      if (tile.terrain === "water" || tile.terrain === "sand") continue;
      tile.terrain = terrain;
    }
  }
}

/** Overwrites grass (and optionally sand) so the beach and park can claim the bank. */
function paintOpen(
  tiles: Tile[][],
  x: number,
  y: number,
  terrain: Terrain,
) {
  if (!inBounds(x, y)) return;
  const tile = tiles[y][x];
  if (tile.road || tile.buildingId) return;
  if (tile.terrain === "water") return;
  tile.terrain = terrain;
  if (terrain === "sand" || terrain === "park") tile.tree = null;
}

function makeGraffiti(rand: () => number): Graffiti {
  return { variant: randInt(rand, 0, 5), hue: randInt(rand, 0, 359) };
}

/**
 * Carries a road across the river at row `y`, marking each water tile as an
 * elevated deck with piers, and pylons at the shoulders for `signature` spans.
 */
function buildBridge(tiles: Tile[][], y: number, rand: () => number, signature: boolean) {
  const start = riverXAt(y);
  const span: number[] = [];
  for (let x = start; x < start + RIVER_W; x++) {
    if (inBounds(x, y) && tiles[y][x].terrain === "water") span.push(x);
  }
  if (span.length === 0) return;

  span.forEach((x, i) => {
    const tile = tiles[y][x];
    tile.road = { north: false, east: false, south: false, west: false };
    tile.tree = null;
    tile.bridge = {
      axis: "ew",
      deck: BRIDGE_DECK,
      pier: i === 1 || i === span.length - 2,
      pylon: signature && (i === 0 || i === span.length - 1),
      abutment: i === 0 ? "start" : i === span.length - 1 ? "end" : null,
      graffiti: rand() < 0.75 ? makeGraffiti(rand) : null,
    };
  });

  // Tag the concrete embankment on both banks.
  for (const x of [span[0] - 1, span[span.length - 1] + 1]) {
    const tile = tiles[y]?.[x];
    if (tile && tile.terrain !== "water" && rand() < 0.8) {
      tile.graffiti = makeGraffiti(rand);
    }
  }
}

export function generateCity(seed = 20260903): CityState {
  const rand = mulberry32(seed);
  const tiles: Tile[][] = Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => emptyTile(x, y)),
  );

  for (let y = 0; y < SIZE; y++) {
    const riverX = riverXAt(y);
    for (let w = 0; w < RIVER_W; w++) {
      const tile = tiles[y][riverX + w];
      if (!tile) continue;
      tile.terrain = "water";
      tile.tree = null;
    }
    for (const bank of [riverX - 1, riverX + RIVER_W]) {
      const tile = tiles[y][bank];
      if (tile && tile.terrain !== "water") tile.terrain = "sand";
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

  place("hospital", 29, 6);
  place("school", 28, 17);
  place("city_hall", 21, 17);
  place("police", 28, 13);
  place("fire", 31, 13);
  place("park_pavilion", 17, 25);

  // Downtown core: 2x2 plots that fall between the street grid lines.
  const supertall: [number, number][] = [
    [17, 9],
    [13, 6],
    [21, 13],
  ];
  const highrise: [number, number][] = [
    [21, 6],
    [25, 6],
    [13, 9],
    [21, 9],
    [25, 9],
    [13, 13],
    [17, 13],
    [25, 13],
  ];
  for (const [x, y] of supertall) {
    const building = place("tower", x, y);
    if (building && x === 21 && y === 13) markLodging(building, "hotel");
    if (building && x === 13 && y === 6) markLodging(building, "residences");
  }
  for (const [x, y] of highrise) {
    const building = place("skyscraper", x, y);
    if (building && x === 17 && y === 13) markLodging(building, "hotel");
    if (building && x === 25 && y === 13) markLodging(building, "residences");
  }

  fillRect(tiles, 14, 22, 25, 31, "park");
  fillRect(tiles, 16, 15, 22, 19, "plaza");
  fillRect(tiles, 28, 6, 33, 11, "lot");
  fillRect(tiles, 28, 19, 30, 19, "playground");

  for (const a of ARTERIALS) {
    for (let i = 3; i < SIZE - 1; i++) {
      addRoad(tiles, a, i);
      addRoad(tiles, i, a);
    }
  }

  // East-bank street grid.
  for (const y of [8, 16, 24, 31]) {
    for (let x = 13; x <= 36; x++) addRoad(tiles, x, y);
  }
  for (const x of [16, 24, 31]) {
    for (let y = 6; y <= 36; y++) addRoad(tiles, x, y);
  }

  // West-bank riverfront strip.
  for (const y of [8, 16, 24, 31]) {
    for (let x = 1; x <= 4; x++) addRoad(tiles, x, y);
  }
  for (let y = 6; y <= 34; y++) addRoad(tiles, 2, y);
  // Boardwalk rides the existing west sand bank so it does not take house lots.
  for (let y = 9; y <= 38; y++) addRoad(tiles, riverXAt(y) - 1, y);

  for (const y of [12, 20, 27]) {
    buildBridge(tiles, y, rand, y === 20);
  }

  connectRoads(tiles);

  // Southeast landmark: the Ravens' park sits on a clear plot with parking
  // between it and the arterial, so Street View can walk up to the gate.
  place("baseball_stadium", 35, 35);
  fillRect(tiles, 32, 32, 39, 34, "lot");
  fillRect(tiles, 32, 35, 34, 39, "lot");

  for (const def of SUBWAY_STATIONS) {
    const station = place("subway_station", def.x, def.y);
    if (station) markSubwayStation(station, def);
  }

  for (let y = 6; y <= 18; y++) {
    for (let x = 13; x <= 26; x++) {
      const tile = tiles[y][x];
      if (tile.road || tile.buildingId || tile.terrain === "water") continue;
      if ((x + y) % 3 === 0) place("office", x, y);
      else if (rand() < 0.38) place("shop", x, y);
    }
  }

  const shopStrip = [
    [1, 13],
    [3, 13],
    [21, 33],
    [22, 33],
    [28, 21],
    [33, 21],
    [35, 28],
    [36, 16],
  ];
  for (const [x, y] of shopStrip) place("shop", x, y);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const tile = tiles[y][x];
      if (tile.road || tile.buildingId || tile.terrain === "water") continue;
      if (tile.terrain === "park" || tile.terrain === "playground" || tile.terrain === "plaza" || tile.terrain === "lot") {
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

  // Beach fills empty ground on the west bank (the screen-left shore by the HUD).
  // Buildings and roads stay put — sand only claims leftover grass.
  for (let y = 0; y < SIZE; y++) {
    const river = riverXAt(y);
    const inland = y <= 8 ? 0 : river - 3;
    for (let x = inland; x < river; x++) {
      paintOpen(tiles, x, y, "sand");
    }
  }

  // Tags accumulate on the retaining walls along both riverbanks.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const tile = tiles[y][x];
      if (tile.terrain !== "sand" || tile.graffiti) continue;
      if (tile.buildingId) continue;
      if (y <= 8) continue;
      if (rand() < 0.22) tile.graffiti = makeGraffiti(rand);
    }
  }

  markNotableVenues(buildings);

  const citizens = spawnCitizens(buildings, rand);

  if ([...buildings.values()].some((b) => b.kind === "baseball_stadium")) {
    for (const citizen of citizens) {
      citizen.happiness = Math.min(100, citizen.happiness + 12);
    }
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
  for (let i = 0; i < 48; i++) {
    vehicles.push({
      id: `v${i}`,
      kind: i === 0 ? "ambulance" : i === 1 ? "firetruck" : pick(rand, kinds),
      color: pick(rand, colors),
      x: 20,
      y: 20,
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
