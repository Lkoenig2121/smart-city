import { createBuilding, footprintFor } from "@/lib/simulation/buildings/buildings";
import { mulberry32, pick, randInt, randRange } from "@/lib/city/rng";
import { BALLCLUBS, type Ballclub } from "@/lib/city/stadium";
import { markVenue, type VenueRole } from "@/lib/city/venues";
import { COASTAL_BOARDWALK_X } from "@/lib/city/waterfront";
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

const DEFAULT_SIZE = 32;
/** Wider than the other stub maps so the valley can grow without pulling the peaks inward. */
const MOUNTAIN_SIZE = 48;

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
    ground: "grass",
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

function inBounds(x: number, y: number, size: number) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

function blockedTerrain(terrain: Tile["terrain"]) {
  return terrain === "water" || terrain === "rock" || terrain === "snow";
}

function addRoad(tiles: Tile[][], x: number, y: number, size: number) {
  if (!inBounds(x, y, size)) return;
  const tile = tiles[y][x];
  if (blockedTerrain(tile.terrain) || tile.buildingId) return;
  tile.road = { north: false, east: false, south: false, west: false };
  tile.tree = null;
}

function connectRoads(tiles: Tile[][], size: number) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
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

function paintMountainTerrain(tiles: Tile[][], rand: () => number, size: number) {
  const edge = size - 1;
  const mid = size / 2;
  const peaks = [
    { x: 1, y: 1, r: 16 },
    { x: mid, y: 0, r: 14 },
    { x: edge, y: 1, r: 16 },
    { x: 0, y: mid, r: 14 },
    { x: edge, y: mid, r: 14 },
    { x: 1, y: edge, r: 16 },
    { x: mid, y: edge, r: 14 },
    { x: edge, y: edge, r: 16 },
    { x: size * 0.28, y: 0, r: 12 },
    { x: size * 0.72, y: 0, r: 12 },
    { x: 0, y: size * 0.28, r: 12 },
    { x: edge, y: size * 0.28, r: 12 },
    { x: 0, y: size * 0.72, r: 12 },
    { x: edge, y: size * 0.72, r: 12 },
    { x: size * 0.28, y: edge, r: 12 },
    { x: size * 0.72, y: edge, r: 12 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const peak of peaks) {
        h = Math.max(h, peakHeight(peak.x, peak.y, x, y, peak.r));
      }
      h += (rand() - 0.5) * 0.08;
      const tile = tiles[y][x];
      if (h > 0.72) tile.terrain = "snow";
      else if (h > 0.4) tile.terrain = "rock";
      else tile.terrain = "grass";
    }
  }

  // Peaks stay on the rim. Everything inside that band is the town: a park
  // foothill, then grass and streets.
  const rim = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = tiles[y][x];
      const edgeDist = Math.min(x, y, edge - x, edge - y);
      if (edgeDist < 2) {
        tile.terrain = "snow";
      } else if (edgeDist < rim) {
        if (tile.terrain !== "snow") tile.terrain = "rock";
      } else if (edgeDist === rim) {
        tile.terrain = "park";
      } else {
        tile.terrain = "grass";
      }
    }
  }

  // Alpine lake in the west ridge, outside the street grid.
  for (let y = 18; y <= 24; y++) {
    for (let x = 2; x <= 6; x++) {
      tiles[y][x].terrain = "water";
      tiles[y][x].tree = null;
    }
  }
}

function paintFutureTerrain(tiles: Tile[][], rand: () => number, size: number) {
  // Dense commercial pads — dark lots and plazas, no big canal ring.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
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

function paintCoastalTerrain(tiles: Tile[][], size: number) {
  for (let y = 0; y < size; y++) {
    for (let x = 20; x < size; x++) tiles[y][x].terrain = "water";
    if (tiles[y][18]) tiles[y][18].terrain = "sand";
    if (tiles[y][19]) tiles[y][19].terrain = "sand";
  }
  // Far headland, so the strait has two shores for the suspension span.
  for (let y = 8; y <= 20; y++) {
    for (let x = 29; x < size; x++) tiles[y][x].terrain = "grass";
  }
}

/** East–west suspension span across the open water on row `y`. */
function buildGateBridge(tiles: Tile[][], y: number) {
  const span: number[] = [];
  for (let x = 0; x < tiles.length; x++) {
    if (tiles[y]?.[x]?.terrain === "water") span.push(x);
  }
  if (span.length < 6) return;
  span.forEach((x, i) => {
    const tile = tiles[y][x];
    tile.road = { north: false, east: false, south: false, west: false };
    tile.tree = null;
    tile.buildingId = null;
    tile.bridge = {
      axis: "ew",
      deck: 22,
      pier: false,
      pylon: i === 2 || i === span.length - 3,
      abutment: i === 0 ? "start" : i === span.length - 1 ? "end" : null,
      graffiti: null,
      suspension: true,
    };
  });
}

/**
 * Lightweight playable maps for regions that do not have full generators yet.
 * Mountain / Future / Coastal each get a distinct terrain + skyline identity.
 */
export function generateStubCity(kind: "mountain" | "coastal" | "future"): CityState {
  const spec = SPECS[kind];
  const size = kind === "mountain" ? MOUNTAIN_SIZE : DEFAULT_SIZE;
  const rand = mulberry32(spec.seed);
  const tiles: Tile[][] = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => emptyTile(x, y, spec.ground)),
  );

  if (kind === "mountain") paintMountainTerrain(tiles, rand, size);
  else if (kind === "coastal") paintCoastalTerrain(tiles, size);
  else paintFutureTerrain(tiles, rand, size);

  const arterials =
    kind === "future" ? [5, 11, 16, 21, 26] : kind === "mountain" ? [12, 18, 24, 30, 36] : [6, 14, 21];

  for (const a of arterials) {
    for (let i = 0; i < size; i++) {
      addRoad(tiles, i, a, size);
      addRoad(tiles, a, i, size);
    }
  }
  if (kind === "coastal") {
    for (let y = 1; y < size - 1; y++) addRoad(tiles, COASTAL_BOARDWALK_X, y, size);
    for (let y = 9; y <= 19; y++) addRoad(tiles, 30, y, size);
  }
  // Short spurs from the valley cross out to the foothills.
  if (kind === "mountain") {
    for (let y = 8; y <= 12; y++) addRoad(tiles, 24, y, size);
    for (let y = 36; y <= 39; y++) addRoad(tiles, 24, y, size);
    for (let x = 8; x <= 12; x++) addRoad(tiles, x, 24, size);
    for (let x = 36; x <= 39; x++) addRoad(tiles, x, 24, size);
    // Dead-end lane into the west ridge, ending at the service tunnel.
    for (let x = 8; x <= 12; x++) addRoad(tiles, x, 28, size);
  }
  connectRoads(tiles, size);
  if (kind === "coastal") {
    buildGateBridge(tiles, 14);
    connectRoads(tiles, size);
  }

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
    place("city_hall", 21, 21, (b) => {
      b.name = "Peak Hall";
      b.wallColor = "#c9b8a0";
      b.roofColor = "#5a3d28";
    });
    place("police", 19, 22);
    place("hospital", 25, 19);
    place("school", 19, 25);
    place("fire", 27, 25);
    place("shop", 19, 19, (b) => {
      b.name = "Trail Outfitters";
    });
    place("shop", 22, 19, (b) => {
      b.name = "Alpine Cafe";
    });
    place("office", 25, 25);
    place("apartment", 26, 22, (b) => {
      b.floors = 5;
      b.wallColor = "#d8cfc0";
      b.roofColor = "#6a5040";
    });
    place("house", 22, 26);
    place("house", 23, 26);
    place("park_pavilion", 28, 19, (b) => {
      b.name = "Ski Lodge";
      b.wallColor = "#8a6a4a";
      b.roofColor = "#3a2a1c";
    });

    // Neighborhoods out from the town center, along the new streets.
    const outskirts: Array<[BuildingKind, number, number, string?]> = [
      ["house", 13, 14],
      ["house", 15, 14],
      ["house", 20, 13],
      ["shop", 26, 13, "Pine Market"],
      ["apartment", 28, 14],
      ["house", 33, 13],
      ["shop", 34, 15, "Cedar Books"],
      ["house", 14, 20],
      ["house", 13, 22],
      ["shop", 14, 26, "Wool & Wax"],
      ["apartment", 13, 28],
      ["park_pavilion", 14, 32, "Lookout Cabin"],
      ["house", 33, 20],
      ["house", 34, 22],
      ["shop", 33, 26, "Gear Shed"],
      ["apartment", 34, 28],
      ["house", 13, 32],
      ["house", 15, 33],
      ["shop", 20, 32, "Summit Deli"],
      ["house", 22, 33],
      ["office", 26, 32],
      ["apartment", 28, 31],
      ["house", 37, 32],
      ["shop", 28, 34, "Fireside Goods"],
    ];
    for (const [bKind, x, y, name] of outskirts) {
      place(bKind, x, y, (b) => {
        if (name) b.name = name;
        if (bKind === "apartment") {
          b.floors = 4;
          b.wallColor = "#d8cfc0";
          b.roofColor = "#6a5040";
        }
        if (bKind === "park_pavilion") {
          b.wallColor = "#8a6a4a";
          b.roofColor = "#3a2a1c";
        }
      });
    }

    // Summit Field — southeast of town, between the outer arterials.
    {
      const sx = 31;
      const sy = 31;
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

    // A few more houses and shops on open street frontage, leaving the block middles as grass.
    const frontage: BuildingKind[] = ["house", "house", "house", "shop", "apartment"];
    for (let y = 10; y < size - 10; y++) {
      for (let x = 10; x < size - 10; x++) {
        if (Math.abs(x - 24) <= 2 && Math.abs(y - 24) <= 2) continue;
        if (!canPlace(tiles, x, y, 1, 1)) continue;
        const nearRoad =
          Boolean(tiles[y]?.[x - 1]?.road) ||
          Boolean(tiles[y]?.[x + 1]?.road) ||
          Boolean(tiles[y - 1]?.[x]?.road) ||
          Boolean(tiles[y + 1]?.[x]?.road);
        if (!nearRoad || rand() > 0.28) continue;
        const bKind = pick(rand, frontage);
        place(bKind, x, y, (b) => {
          if (bKind === "shop") {
            b.name = pick(rand, ["Trail Post", "Maple Goods", "Ridge Bakery", "Lantern Supply"]);
          } else if (bKind === "apartment") {
            b.floors = randInt(rand, 4, 6);
            b.wallColor = "#d8cfc0";
            b.roofColor = "#6a5040";
          }
        });
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
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

    // Neon Dome — southwest block between the x=5/11 and y=26 arterials, before the canyon fill.
    {
      const sx = 6;
      const sy = 27;
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
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
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

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
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
    place("shop", 8, 8);
    place("shop", 16, 8);
    place("office", 8, 16);
    place("apartment", 16, 16);
    place("house", 4, 4);
    place("house", 20, 4);
    place("house", 4, 20);
    place("park_pavilion", 20, 20);

    // Boardwalk storefronts facing the sea.
    const BOARDWALK_SHOPS: { y: number; name: string; role: VenueRole; wall: string }[] = [
      { y: 3, name: "Saltwater Taffy Co.", role: "shop", wall: "#f4c6d0" },
      { y: 8, name: "Crab Shack", role: "restaurant", wall: "#f2e2b8" },
      { y: 10, name: "Surf & Rental", role: "shop", wall: "#bfe3ee" },
      { y: 16, name: "Boardwalk Arcade", role: "shop", wall: "#d8c8f0" },
      { y: 18, name: "Pier Fish & Chips", role: "restaurant", wall: "#f6efe0" },
      { y: 24, name: "Gelato Cove", role: "restaurant", wall: "#c8f0d8" },
      { y: 27, name: "Lifeguard Supply", role: "shop", wall: "#f0d0b0" },
    ];
    for (const shop of BOARDWALK_SHOPS) {
      place("shop", COASTAL_BOARDWALK_X - 1, shop.y, (b) => {
        markVenue(b, shop.role);
        b.name = shop.name;
        b.wallColor = shop.wall;
        b.roofColor = "#3a7a8a";
        b.accentColor = "#ffffff";
        b.stats.extra = { ...(b.stats.extra ?? {}), attraction: "Boardwalk" };
      });
    }

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

    place("fire", 2, 16);
    place("school", 10, 28);
    place("hospital", 15, 28);
    place("office", 9, 2);
    place("office", 10, 4);
    place("office", 29, 16);
    place("apartment", 17, 18);
    place("apartment", 31, 12);
    place("apartment", 9, 28);
    place("shop", 2, 8, (b) => {
      b.name = "Harbor Market";
    });
    place("shop", 3, 10, (b) => {
      b.name = "Tide Books";
    });
    place("house", 2, 2);
    place("house", 9, 4);
    place("house", 16, 4);
    place("house", 2, 22);
    place("house", 13, 30);

    // West green, clear of the arterials, so the neighborhoods still have a lawn.
    for (let y = 23; y <= 30; y++) {
      for (let x = 1; x <= 5; x++) {
        const tile = tiles[y]?.[x];
        if (!tile || tile.road || tile.buildingId || tile.terrain === "water" || tile.terrain === "sand") continue;
        tile.terrain = "park";
        tile.tree = null;
      }
    }

    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const tile = tiles[y][x];
        if (tile.road || tile.buildingId || blockedTerrain(tile.terrain)) continue;
        if (tile.terrain === "sand" || tile.terrain === "lot" || tile.terrain === "park") continue;
        const nearRoad =
          Boolean(tiles[y - 1]?.[x]?.road) ||
          Boolean(tiles[y + 1]?.[x]?.road) ||
          Boolean(tiles[y][x - 1]?.road) ||
          Boolean(tiles[y][x + 1]?.road);
        if (nearRoad && rand() < 0.74) {
          const roll = rand();
          const bKind: BuildingKind = roll < 0.16 ? "apartment" : roll < 0.28 ? "shop" : "house";
          place(bKind, x, y, (b) => {
            if (bKind === "shop") {
              b.name = pick(rand, ["Cove Goods", "Salt Market", "Pier Bakery", "Dune Supply", "Harbor Deli"]);
            }
          });
        } else if (tile.terrain === "grass" && rand() < 0.55) {
          tile.tree = { variant: randInt(rand, 0, 5), scale: randRange(rand, 0.75, 1.15) };
        }
      }
    }

    for (let y = 23; y <= 30; y++) {
      for (let x = 1; x <= 5; x++) {
        const tile = tiles[y]?.[x];
        if (!tile || tile.road || tile.buildingId || tile.terrain !== "park") continue;
        if (rand() < 0.42) {
          tile.tree = { variant: randInt(rand, 0, 5), scale: randRange(rand, 0.85, 1.25) };
        }
      }
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
    size,
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
