import { ageDef } from "@/lib/progression/ages";
import { citizenName } from "./names";
import { mulberry32, pick, randInt, randRange } from "./rng";
import {
  SIZE,
  carveRiver,
  createGrid,
  inBounds,
  revealAround,
} from "./terrain";
import type { Building, Citizen, CityState, Tile } from "./types";

/** Where the first five settlers make camp. Close to the river for fishing. */
export const SETTLEMENT = { x: 14, y: 20 };

function scatterMountains(tiles: Tile[][], rand: () => number) {
  // A ridge across the north-east, plus a smaller spur in the south-east.
  const ridges = [
    { cx: 34, cy: 3, rx: 7, ry: 4 },
    { cx: 37, cy: 30, rx: 4, ry: 6 },
  ];
  for (const ridge of ridges) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const tile = tiles[y][x];
        if (tile.terrain === "water" || tile.terrain === "sand") continue;
        const n = ((x - ridge.cx) / ridge.rx) ** 2 + ((y - ridge.cy) / ridge.ry) ** 2;
        if (n < 0.55) {
          tile.terrain = "mountain";
          tile.tree = null;
        } else if (n < 1 && rand() < 0.55) {
          tile.terrain = "rock";
          tile.tree = null;
        }
      }
    }
  }

  // Loose boulders elsewhere.
  for (let i = 0; i < 90; i++) {
    const x = randInt(rand, 0, SIZE - 1);
    const y = randInt(rand, 0, SIZE - 1);
    const tile = tiles[y][x];
    if (tile.terrain !== "grass") continue;
    if (Math.hypot(x - SETTLEMENT.x, y - SETTLEMENT.y) < 3) continue;
    tile.terrain = "rock";
    tile.tree = null;
  }
}

function growForest(tiles: Tile[][], rand: () => number) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const tile = tiles[y][x];
      if (tile.terrain !== "grass") continue;

      // Thin the trees right around camp so there is room to build.
      const distance = Math.hypot(x - SETTLEMENT.x, y - SETTLEMENT.y);
      const density = distance < 4 ? 0.12 : distance < 8 ? 0.42 : 0.68;
      if (rand() < density) {
        tile.tree = { variant: randInt(rand, 0, 5), scale: randRange(rand, 0.8, 1.3) };
      }
    }
  }
}

export function generateWorld(seed = 20260907): CityState {
  const rand = mulberry32(seed);
  const tiles = createGrid(false);

  carveRiver(tiles);
  scatterMountains(tiles, rand);
  growForest(tiles, rand);

  const stone = ageDef("stone");
  revealAround(tiles, SETTLEMENT.x, SETTLEMENT.y, stone.revealRadius);

  // Clear a small campsite so the first shelters have somewhere to go.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tile = tiles[SETTLEMENT.y + dy]?.[SETTLEMENT.x + dx];
      if (!tile || tile.terrain === "water") continue;
      tile.terrain = "grass";
      tile.tree = null;
    }
  }

  const citizens: Citizen[] = [];
  for (let i = 0; i < 5; i++) {
    citizens.push({
      id: `c${i}`,
      name: citizenName(rand),
      age: randInt(rand, 16, 44),
      homeId: null,
      workplaceId: null,
      money: 0,
      happiness: 55,
      health: 70,
      education: 4,
      transport: "walk",
      x: SETTLEMENT.x + randRange(rand, -1.2, 1.2),
      y: SETTLEMENT.y + randRange(rand, -1.2, 1.2),
      path: [],
      pathIndex: 0,
      speed: randRange(rand, 0.7, 1.1),
      color: pick(rand, ["#6b4a32", "#7a5a3e", "#5c4530", "#8a6a4a"]),
      activity: "home",
    });
  }

  return {
    id: "riverside",
    name: "Riverside",
    size: SIZE,
    tiles,
    buildings: new Map<string, Building>(),
    citizens,
    vehicles: [],
    clock: { dayIndex: 0, minuteOfDay: 7 * 60, year: stone.startYear },
    budget: {
      treasury: 0,
      police: 0,
      fire: 0,
      healthcare: 0,
      education: 0,
      parks: 0,
      roads: 0,
    },
    population: citizens.length,
    progression: {
      age: "stone",
      coins: 120,
      xp: 0,
      totalXp: 0,
      discoveries: [],
      happiness: 55,
      coinsPerSecond: 0,
      xpPerSecond: 0,
      workforceUsed: 0,
      workforceTotal: citizens.length,
      housing: 0,
    },
  };
}

export function isWalkable(tile: Tile | undefined) {
  if (!tile) return false;
  if (!tile.revealed) return false;
  if (tile.terrain === "water" && !tile.bridge) return false;
  return tile.terrain !== "mountain";
}

export function randomWalkableNear(
  tiles: Tile[][],
  x: number,
  y: number,
  spread: number,
  rand: () => number,
) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const nx = Math.round(x + randRange(rand, -spread, spread));
    const ny = Math.round(y + randRange(rand, -spread, spread));
    if (!inBounds(nx, ny)) continue;
    if (isWalkable(tiles[ny][nx])) return { x: nx, y: ny };
  }
  return null;
}
