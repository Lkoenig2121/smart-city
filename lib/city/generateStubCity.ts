import { createBuilding, footprintFor } from "@/lib/simulation/buildings/buildings";
import { mulberry32, pick, randInt, randRange } from "@/lib/city/rng";
import { BALLCLUBS, type Ballclub } from "@/lib/city/stadium";
import { spawnCitizens } from "@/lib/simulation/citizens/spawnCitizens";
import { bootstrapEvents } from "@/lib/simulation/events/cityEvents";
import { seedTrafficNetwork } from "@/lib/simulation/traffic/roadNetwork";
import { openingClock, weatherFor } from "@/lib/simulation/weather/weather";
import type {
  Building,
  BuildingKind,
  CityState,
  Tile,
  Vehicle,
  VehicleKind,
} from "@/lib/city/types";
import type { CityId } from "@/lib/city/world/cities";

const SIZE = 32;

type StubSpec = {
  id: CityId;
  name: string;
  seed: number;
  ground: "grass" | "sand" | "plaza";
  treasury: number;
  colors: string[];
};

const SPECS: Record<"mountain" | "coastal" | "future", StubSpec> = {
  mountain: {
    id: "mountain",
    name: "Mountain City",
    seed: 440222,
    ground: "grass",
    treasury: 980_000,
    colors: ["#5a7a6a", "#c9d6e0", "#8a6a4a", "#2f4d3a"],
  },
  coastal: {
    id: "coastal",
    name: "Coastal City",
    seed: 550323,
    ground: "sand",
    treasury: 1_200_000,
    colors: ["#3d7ea6", "#e8d5a8", "#2a6b5a", "#c45c4a"],
  },
  future: {
    id: "future",
    name: "Future City",
    seed: 660459,
    ground: "plaza",
    treasury: 2_400_000,
    colors: ["#00e8ff", "#ff2d55", "#39ff14", "#ff8c00", "#1a2434"],
  },
};

function emptyTile(x: number, y: number, ground: StubSpec["ground"]): Tile {
  return {
    x,
    y,
    terrain: ground,
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

function blockedTerrain(terrain: Tile["terrain"]) {
  return terrain === "water" || terrain === "rock" || terrain === "snow";
}

function addRoad(tiles: Tile[][], x: number, y: number) {
  if (!inBounds(x, y)) return;
  const tile = tiles[y][x];
  if (blockedTerrain(tile.terrain) || tile.buildingId) return;
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
      const tile = tiles[y + dy]?.[x + dx];
      if (!tile || tile.road || tile.buildingId || blockedTerrain(tile.terrain)) return false;
    }
  }
  return true;
}

/** Clear rock/snow and ring the plot with parking lots for a ballpark. */
function prepStadiumSite(tiles: Tile[][], x: number, y: number) {
  const fp = footprintFor("baseball_stadium");
  for (let dy = -1; dy <= fp.d; dy++) {
    for (let dx = -1; dx <= fp.w; dx++) {
      const onPad = dx >= 0 && dy >= 0 && dx < fp.w && dy < fp.d;
      const onRing =
        !onPad && dx >= -1 && dy >= -1 && dx <= fp.w && dy <= fp.d;
      if (!onPad && !onRing) continue;
      const tile = tiles[y + dy]?.[x + dx];
      if (!tile || tile.road) continue;
      if (tile.terrain === "water") continue;
      tile.terrain = "lot";
      tile.tree = null;
    }
  }
}

function brandStadium(
  building: Building,
  club: Ballclub,
  colors: { wall: string; roof: string; accent: string },
) {
  building.name = club.parkName;
  building.wallColor = colors.wall;
  building.roofColor = colors.roof;
  building.accentColor = colors.accent;
  building.stats.extra = {
    ...(building.stats.extra ?? {}),
    team: club.fullName,
    seats: "12,000",
    tourism: "Regional draw",
    traffic: "Game-day surge",
    "daily gate": "$15,000",
    "city happiness": "+1,000",
  };
}

function stampBuilding(tiles: Tile[][], building: Building) {
  for (let dy = 0; dy < building.depth; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const tile = tiles[building.origin.y + dy]?.[building.origin.x + dx];
      if (!tile) continue;
      tile.buildingId = building.id;
      tile.tree = null;
    }
  }
}

function peakHeight(cx: number, cy: number, x: number, y: number, radius: number) {
  const d = Math.hypot(x - cx, y - cy) / radius;
  return Math.max(0, 1 - d);
}

function paintMountainTerrain(tiles: Tile[][], rand: () => number) {
  const peaks = [
    { x: 3, y: 3, r: 11 },
    { x: 16, y: 1, r: 9 },
    { x: 28, y: 3, r: 10 },
    { x: 1, y: 14, r: 8 },
    { x: 30, y: 14, r: 8 },
    { x: 4, y: 28, r: 9 },
    { x: 16, y: 30, r: 8 },
    { x: 28, y: 28, r: 9 },
    { x: 8, y: 8, r: 6 },
    { x: 24, y: 8, r: 6 },
    { x: 8, y: 24, r: 5 },
    { x: 24, y: 24, r: 5 },
  ];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let h = 0;
      for (const peak of peaks) {
        h = Math.max(h, peakHeight(peak.x, peak.y, x, y, peak.r));
      }
      // Soft noise so ridges aren't perfect circles.
      h += (rand() - 0.5) * 0.1;
      const tile = tiles[y][x];
      if (h > 0.68) tile.terrain = "snow";
      else if (h > 0.38) tile.terrain = "rock";
      else if (h > 0.2) tile.terrain = "park";
      else tile.terrain = "grass";
    }
  }

  // Narrower valley bowl for the town core — keep ridges close.
  for (let y = 12; y <= 20; y++) {
    for (let x = 12; x <= 20; x++) {
      const tile = tiles[y][x];
      if (tile.terrain === "snow" || tile.terrain === "rock") {
        tile.terrain = rand() > 0.5 ? "park" : "grass";
      }
    }
  }

  // Alpine lake tucked against the west ridge.
  for (let y = 13; y <= 17; y++) {
    for (let x = 2; x <= 5; x++) {
      tiles[y][x].terrain = "water";
      tiles[y][x].tree = null;
    }
  }
}

function paintFutureTerrain(tiles: Tile[][], rand: () => number) {
  // Dense commercial pads — dark lots and plazas, no big canal ring.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      tiles[y][x].terrain = rand() > 0.55 ? "lot" : "plaza";
    }
  }
  // Scramble crossing plaza at the hub (Shibuya-style open intersection).
  for (let y = 14; y <= 17; y++) {
    for (let x = 14; x <= 17; x++) {
      tiles[y][x].terrain = "plaza";
      tiles[y][x].tree = null;
    }
  }
  // Pocket parks / street trees along the rim of the scramble.
  for (const [x, y] of [
    [13, 14],
    [13, 17],
    [18, 14],
    [18, 17],
    [14, 13],
    [17, 13],
    [14, 18],
    [17, 18],
  ] as const) {
    if (tiles[y]?.[x]) {
      tiles[y][x].terrain = "park";
    }
  }
  // Tiny reflecting pools at two corners — accents, not barriers.
  for (const [x, y] of [
    [2, 2],
    [29, 2],
    [2, 29],
    [29, 29],
  ] as const) {
    tiles[y][x].terrain = "water";
    tiles[y][x].tree = null;
  }
}

function paintCoastalTerrain(tiles: Tile[][]) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = SIZE - 5; x < SIZE; x++) {
      tiles[y][x].terrain = "water";
    }
    if (tiles[y][SIZE - 6]) tiles[y][SIZE - 6].terrain = "sand";
    if (tiles[y][SIZE - 7]) tiles[y][SIZE - 7].terrain = "sand";
  }
}

/**
 * Lightweight playable maps for regions that do not have full generators yet.
 * Mountain / Future / Coastal each get a distinct terrain + skyline identity.
 */
export function generateStubCity(kind: "mountain" | "coastal" | "future"): CityState {
  const spec = SPECS[kind];
  const rand = mulberry32(spec.seed);
  const tiles: Tile[][] = Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => emptyTile(x, y, spec.ground)),
  );

  if (kind === "mountain") paintMountainTerrain(tiles, rand);
  else if (kind === "coastal") paintCoastalTerrain(tiles);
  else paintFutureTerrain(tiles, rand);

  const arterials =
    kind === "future" ? [5, 11, 16, 21, 26] : kind === "mountain" ? [11, 16, 21] : [6, 14, 21];

  for (const a of arterials) {
    for (let i = 0; i < SIZE; i++) {
      addRoad(tiles, i, a);
      addRoad(tiles, a, i);
    }
  }
  // Mountain switchbacks into the valley.
  if (kind === "mountain") {
    for (let y = 6; y <= 11; y++) addRoad(tiles, 16, y);
    for (let x = 16; x <= 21; x++) addRoad(tiles, x, 6);
  }
  connectRoads(tiles);

  const buildings = new Map<string, Building>();
  let buildingIndex = 0;

  const place = (bKind: BuildingKind, x: number, y: number, paint?: (b: Building) => void) => {
    const fp = footprintFor(bKind);
    if (!canPlace(tiles, x, y, fp.w, fp.d)) return null;
    const id = `${spec.id}-b${buildingIndex++}`;
    const building = createBuilding(id, bKind, x, y, rand, buildingIndex);
    paint?.(building);
    buildings.set(id, building);
    stampBuilding(tiles, building);
    return building;
  };

  if (kind === "mountain") {
    place("city_hall", 14, 14, (b) => {
      b.name = "Peak Hall";
      b.wallColor = "#c9b8a0";
      b.roofColor = "#5a3d28";
    });
    place("police", 11, 14);
    place("hospital", 18, 14);
    place("school", 14, 11);
    place("shop", 11, 11, (b) => {
      b.name = "Trail Outfitters";
    });
    place("shop", 18, 11, (b) => {
      b.name = "Alpine Cafe";
    });
    place("office", 11, 18);
    place("apartment", 18, 18, (b) => {
      b.floors = 5;
      b.wallColor = "#d8cfc0";
      b.roofColor = "#6a5040";
    });
    place("house", 12, 20);
    place("house", 19, 20);
    place("house", 13, 12);
    place("park_pavilion", 20, 12, (b) => {
      b.name = "Ski Lodge";
      b.wallColor = "#8a6a4a";
      b.roofColor = "#3a2a1c";
    });

    // Summit Field — valley south edge with parking.
    {
      const sx = 17;
      const sy = 22;
      prepStadiumSite(tiles, sx, sy);
      const club = BALLCLUBS.mountain;
      place("baseball_stadium", sx, sy, (b) => {
        brandStadium(b, club, {
          wall: "#c9b8a0",
          roof: "#2f4d3a",
          accent: club.accent,
        });
      });
    }

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const tile = tiles[y][x];
        if (tile.road || tile.buildingId || blockedTerrain(tile.terrain)) continue;
        if (tile.terrain === "park" && rand() > 0.45) {
          tile.tree = { variant: randInt(rand, 0, 5), scale: randRange(rand, 0.9, 1.35) };
        } else if (tile.terrain === "grass" && rand() > 0.72) {
          tile.tree = { variant: randInt(rand, 0, 5), scale: randRange(rand, 0.75, 1.15) };
        }
      }
    }
  } else if (kind === "future") {
    const NEON = ["#00e8ff", "#ff2d55", "#39ff14", "#ff8c00", "#c44dff", "#ffe14a"] as const;
    // Light glass / metal — neon reads on pale facades instead of crushed blacks.
    const WALLS = ["#c8d8e8", "#b0c4d8", "#d4e0ec", "#a8b8cc", "#e0e8f4", "#bcc8dc"] as const;
    const paintNeon = (b: Building, floors?: number) => {
      b.wallColor = pick(rand, [...WALLS]);
      b.roofColor = pick(rand, ["#3a4a68", "#2a3850", "#4a6080", "#1e2a40"]);
      b.accentColor = pick(rand, [...NEON]);
      if (floors) b.floors = floors;
      b.stats.extra = { ...(b.stats.extra ?? {}), neon: b.accentColor };
    };

    // Civic anchors around the scramble plaza.
    place("city_hall", 12, 12, (b) => {
      b.name = "Neon Nexus";
      paintNeon(b, 14);
      b.accentColor = "#00e8ff";
      b.stats.extra = { ...(b.stats.extra ?? {}), neon: "#00e8ff" };
    });
    place("police", 18, 12, (b) => paintNeon(b, 6));
    place("hospital", 12, 18, (b) => {
      paintNeon(b, 8);
      b.accentColor = "#ff2d55";
      b.stats.extra = { ...(b.stats.extra ?? {}), neon: "#ff2d55" };
    });
    place("school", 18, 18, (b) => paintNeon(b, 7));

    // Neon Dome — west rim before the dense canyon fill.
    {
      const sx = 1;
      const sy = 25;
      prepStadiumSite(tiles, sx, sy);
      const club = BALLCLUBS.future;
      place("baseball_stadium", sx, sy, (b) => {
        brandStadium(b, club, {
          wall: "#c8d8e8",
          roof: "#1a2434",
          accent: club.accent,
        });
        b.stats.extra = { ...(b.stats.extra ?? {}), neon: club.accent };
      });
    }

    // Landmark glass / neon towers framing the crossing.
    place("skyscraper", 8, 8, (b) => {
      b.name = "Cyan Cylinder";
      b.wallColor = "#b8e0f8";
      b.roofColor = "#00e8ff";
      b.accentColor = "#00e8ff";
      b.floors = 28;
      b.stats.extra = { ...(b.stats.extra ?? {}), neon: "#00e8ff" };
    });
    place("tower", 22, 8, (b) => {
      b.name = "Pulse Spire";
      paintNeon(b, 32);
      b.accentColor = "#ff2d55";
      b.stats.extra = { ...(b.stats.extra ?? {}), neon: "#ff2d55" };
    });
    place("tower", 8, 22, (b) => {
      b.name = "Maglev Hub";
      paintNeon(b, 26);
      b.accentColor = "#39ff14";
      b.stats.extra = { ...(b.stats.extra ?? {}), neon: "#39ff14" };
    });
    place("skyscraper", 22, 22, (b) => {
      b.name = "Orbit Tower";
      paintNeon(b, 36);
      b.accentColor = "#ff8c00";
      b.stats.extra = { ...(b.stats.extra ?? {}), neon: "#ff8c00" };
    });

    // Dense mid-rise fill — pack every clear lot like a neon canyon.
    const fillKinds: BuildingKind[] = [
      "shop",
      "shop",
      "office",
      "office",
      "apartment",
      "apartment",
      "office",
      "shop",
    ];
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        // Keep the scramble plaza open.
        if (x >= 14 && x <= 17 && y >= 14 && y <= 17) continue;
        if (!canPlace(tiles, x, y, 1, 1)) continue;
        // Prefer stacking against roads for the canyon feel.
        const nearRoad =
          Boolean(tiles[y]?.[x - 1]?.road) ||
          Boolean(tiles[y]?.[x + 1]?.road) ||
          Boolean(tiles[y - 1]?.[x]?.road) ||
          Boolean(tiles[y + 1]?.[x]?.road);
        if (!nearRoad && rand() > 0.35) continue;

        // Occasional 2×2 office block.
        if (rand() > 0.78 && canPlace(tiles, x, y, 2, 2)) {
          place("skyscraper", x, y, (b) => {
            paintNeon(b, randInt(rand, 12, 22));
            b.name = pick(rand, ["LED Exchange", "Holo Mall", "Byte Plaza", "Circuit Hall"]);
          });
          continue;
        }

        const k = pick(rand, fillKinds);
        place(k, x, y, (b) => {
          const floors =
            k === "shop"
              ? randInt(rand, 3, 6)
              : k === "apartment"
                ? randInt(rand, 10, 18)
                : randInt(rand, 8, 16);
          paintNeon(b, floors);
          if (k === "shop") {
            b.name = pick(rand, [
              "Neon Mart",
              "Ramen Node",
              "Drone Depot",
              "Synth Market",
              "Arcade Bay",
              "Glow Drugs",
            ]);
          }
        });
      }
    }

    place("park_pavilion", 15, 15, (b) => {
      b.name = "Crossing Hub";
      b.wallColor = "#b8e8e0";
      b.roofColor = "#00e8ff";
      b.accentColor = "#39ff14";
      b.stats.extra = { ...(b.stats.extra ?? {}), neon: "#00e8ff" };
    });

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const tile = tiles[y][x];
        if (tile.road || tile.buildingId || tile.terrain === "water") continue;
        if (tile.terrain === "park") {
          tile.tree = { variant: randInt(rand, 0, 2), scale: randRange(rand, 0.7, 1.05) };
        } else if (tile.terrain === "plaza" && rand() > 0.93) {
          tile.tree = { variant: randInt(rand, 0, 2), scale: randRange(rand, 0.55, 0.85) };
        }
      }
    }
  } else {
    place("city_hall", 12, 12);
    place("police", 8, 12);
    place("hospital", 16, 12);
    place("school", 12, 8);
    place("shop", 8, 8);
    place("shop", 16, 8);
    place("office", 8, 16);
    place("apartment", 16, 16);
    place("house", 4, 4);
    place("house", 20, 4);
    place("house", 4, 20);
    place("park_pavilion", 20, 20);

    // Harbor Park — inland of the beach strip.
    {
      const sx = 8;
      const sy = 22;
      prepStadiumSite(tiles, sx, sy);
      const club = BALLCLUBS.coastal;
      place("baseball_stadium", sx, sy, (b) => {
        brandStadium(b, club, {
          wall: "#e8d5a8",
          roof: "#2a6b5a",
          accent: club.accent,
        });
      });
    }
  }

  const citizens = spawnCitizens(buildings, rand);
  const vehicles: Vehicle[] = [];
  const kinds: VehicleKind[] =
    kind === "future"
      ? ["car", "car", "taxi", "bus", "taxi"]
      : ["car", "car", "taxi", "bus", "truck"];
  for (let i = 0; i < (kind === "future" ? 36 : 14); i++) {
    vehicles.push({
      id: `${spec.id}-v${i}`,
      kind: pick(rand, kinds),
      color: pick(rand, spec.colors),
      x: 14,
      y: 14,
      path: [],
      pathIndex: 0,
      speed: randRange(rand, kind === "future" ? 1.6 : 1.2, kind === "future" ? 2.6 : 2.0),
      ownerId: null,
    });
  }

  const clock = openingClock();
  const state: CityState = {
    id: spec.id,
    name: spec.name,
    size: SIZE,
    tiles,
    buildings,
    citizens,
    vehicles,
    clock,
    weather: weatherFor(clock),
    events: [],
    budget: {
      treasury: spec.treasury,
      police: 0.5,
      fire: 0.5,
      healthcare: 0.5,
      education: 0.5,
      parks: 0.55,
      roads: 0.6,
    },
    population: citizens.length,
    trafficLights: [],
    roadWorks: [],
    parked: [],
  };
  seedTrafficNetwork(state, rand);
  bootstrapEvents(state);
  return state;
}
