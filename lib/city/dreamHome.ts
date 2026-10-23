import { clearTreesAround } from "./siteTrees";
import type { Building, CityClock, CityState, Tile } from "./types";
import { CITIES, CITY_IDS, type CityId } from "./world/cities";
import {
  furnishById,
  type OwnedHome,
} from "./furnishings";
import { earnCash, readPlayer, spendWallet, writePlayer, type PlayerState } from "./player";

export type DreamFacing = 0 | 1 | 2 | 3;
export type DreamRoof = "gable" | "hip" | "flat";
export type PropertyCategory = "home" | "townhouse" | "apartment" | "luxury" | "mixed";
export type LotZone = "residential" | "park" | "waterfront";

export const PROPERTY_CATEGORIES: { id: PropertyCategory; label: string }[] = [
  { id: "home", label: "Homes" },
  { id: "townhouse", label: "Townhouses" },
  { id: "apartment", label: "Apartments" },
  { id: "luxury", label: "Luxury" },
  { id: "mixed", label: "Mixed-use" },
];

export interface DreamStyle {
  id: string;
  name: string;
  description: string;
  category: PropertyCategory;
  /** Tiles along the street. */
  front: number;
  /** Tiles back from the street. */
  depth: number;
  minStories: number;
  maxStories: number;
  price: number;
  wall: string;
  roofColor: string;
  accent: string;
  roof: DreamRoof;
  porch: boolean;
  garage: boolean;
  steep: boolean;
  glass: boolean;
}

export interface DreamPlot {
  cityId: CityId;
  /** Stable id for this grass rectangle in this city. */
  lotId: string;
  x: number;
  y: number;
  w: number;
  d: number;
  facing: DreamFacing;
  landPrice: number;
  marketValue: number;
  zone: LotZone;
  roadAccess: boolean;
}

export interface DreamChoice {
  styleId: string;
  stories: number;
  wall: string;
  roofColor: string;
  accent: string;
  roof: DreamRoof;
  floorId: string | null;
}

export interface DreamQuote {
  land: number;
  base: number;
  stories: number;
  floor: number;
  total: number;
  shortfall: number;
  fits: boolean;
}

const SIZES: Array<[number, number]> = [
  [4, 4],
  [4, 3],
  [3, 4],
  [3, 3],
  [4, 2],
  [2, 4],
  [3, 2],
  [2, 3],
  [2, 2],
];

export const DREAM_STYLES: DreamStyle[] = [
  { id: "starter", name: "Starter Home", description: "A compact one-family house with a front porch.", category: "home", front: 2, depth: 2, minStories: 1, maxStories: 2, price: 25_000, wall: "#d8c4a8", roofColor: "#6a5340", accent: "#c9a44c", roof: "gable", porch: true, garage: false, steep: false, glass: false },
  { id: "traditional", name: "Traditional Family Home", description: "A wider family house with a brick-toned gable.", category: "home", front: 3, depth: 2, minStories: 1, maxStories: 2, price: 65_000, wall: "#c45c4a", roofColor: "#4a3028", accent: "#f4efe6", roof: "gable", porch: true, garage: false, steep: false, glass: false },
  { id: "craftsman", name: "Craftsman Home", description: "Low eaves, a deep porch, and warm wood trim.", category: "home", front: 2, depth: 2, minStories: 1, maxStories: 2, price: 85_000, wall: "#8a6a4a", roofColor: "#3a2a1c", accent: "#c4a36a", roof: "gable", porch: true, garage: false, steep: false, glass: false },
  { id: "farmhouse", name: "Modern Farmhouse", description: "A long porch and a simple gable.", category: "home", front: 3, depth: 2, minStories: 1, maxStories: 2, price: 95_000, wall: "#f4f1ea", roofColor: "#2c2c2c", accent: "#1a2744", roof: "gable", porch: true, garage: false, steep: false, glass: false },
  { id: "coastal", name: "Coastal Home", description: "Light walls and a hip roof facing the street.", category: "home", front: 3, depth: 2, minStories: 1, maxStories: 3, price: 125_000, wall: "#f7f3ea", roofColor: "#3d5a73", accent: "#2aa3a0", roof: "hip", porch: true, garage: false, steep: false, glass: false },
  { id: "chalet", name: "Mountain Chalet", description: "A steep roof for snow country.", category: "home", front: 2, depth: 2, minStories: 1, maxStories: 3, price: 90_000, wall: "#6a5340", roofColor: "#2a2420", accent: "#e8dcc8", roof: "gable", porch: true, garage: false, steep: true, glass: false },
  { id: "townhouse", name: "Row Townhouses", description: "Three homes in a row, sharing walls, each with its own door and gable.", category: "townhouse", front: 3, depth: 2, minStories: 2, maxStories: 3, price: 168_000, wall: "#c4b29a", roofColor: "#4a3728", accent: "#f4efe6", roof: "gable", porch: true, garage: false, steep: false, glass: false },
  { id: "apartment", name: "Walk-up Apartments", description: "A small apartment building with a flat roof and a shared entry.", category: "apartment", front: 2, depth: 2, minStories: 3, maxStories: 5, price: 140_000, wall: "#d8cfc4", roofColor: "#3a4450", accent: "#1a2744", roof: "flat", porch: false, garage: false, steep: false, glass: false },
  { id: "penthouse", name: "Penthouse Block", description: "A glass-fronted residential block with a terrace roof.", category: "apartment", front: 3, depth: 2, minStories: 3, maxStories: 5, price: 220_000, wall: "#d5e6ea", roofColor: "#1a2744", accent: "#c9a44c", roof: "flat", porch: false, garage: false, steep: false, glass: true },
  { id: "modern", name: "Modern Home", description: "Clean lines and a flat roof.", category: "luxury", front: 3, depth: 2, minStories: 1, maxStories: 3, price: 110_000, wall: "#e8e4dc", roofColor: "#2a2a2a", accent: "#1a2744", roof: "flat", porch: false, garage: false, steep: false, glass: false },
  { id: "mansion", name: "Luxury Mansion", description: "A broad estate house with room to grow upward.", category: "luxury", front: 4, depth: 3, minStories: 2, maxStories: 4, price: 250_000, wall: "#f4efe6", roofColor: "#3a3a3a", accent: "#c9a44c", roof: "hip", porch: true, garage: false, steep: false, glass: false },
  { id: "glass", name: "Glass House", description: "Pale walls and a wide band of windows.", category: "luxury", front: 3, depth: 2, minStories: 1, maxStories: 3, price: 180_000, wall: "#d5e6ea", roofColor: "#1a2744", accent: "#8fd0d8", roof: "flat", porch: false, garage: false, steep: false, glass: true },
  { id: "estate", name: "Contemporary Estate", description: "The largest footprint, with a hipped roof.", category: "luxury", front: 4, depth: 3, minStories: 2, maxStories: 4, price: 300_000, wall: "#cfc8bc", roofColor: "#1c1c1c", accent: "#c9a44c", roof: "hip", porch: true, garage: false, steep: false, glass: false },
  { id: "garage", name: "Garage Estate", description: "A family house with a garage on the street.", category: "luxury", front: 3, depth: 3, minStories: 2, maxStories: 3, price: 160_000, wall: "#d8d0c4", roofColor: "#3a3a3a", accent: "#1a1a1a", roof: "gable", porch: false, garage: true, steep: false, glass: false },
  { id: "future", name: "Future Home", description: "A flat-roofed house with a lit crown.", category: "luxury", front: 3, depth: 3, minStories: 2, maxStories: 4, price: 350_000, wall: "#d8dde6", roofColor: "#10141c", accent: "#7ec8ff", roof: "flat", porch: false, garage: false, steep: false, glass: true },
  { id: "mixed", name: "Corner Mixed-Use", description: "Shops on the street and apartments above a flat roof.", category: "mixed", front: 3, depth: 2, minStories: 2, maxStories: 4, price: 155_000, wall: "#e6ddd2", roofColor: "#2a3138", accent: "#c45c4a", roof: "flat", porch: false, garage: false, steep: false, glass: true },
];

export const DREAM_WALLS = ["#d8c4a8", "#f4efe6", "#c45c4a", "#1c3a5a", "#2f6b48", "#e8e4dc", "#6a5340", "#111418", "#d5e6ea", "#8a6a4a"];
export const DREAM_ROOFS = ["#6a5340", "#3a3a3a", "#8a3030", "#1a2744", "#c4a36a", "#2a2a2a", "#f4f1ea", "#3d5a73"];
export const DREAM_ACCENTS = ["#c9a44c", "#f4f1ea", "#1a2744", "#6a3030", "#2f6b48", "#2aa3a0", "#111418", "#7ec8ff"];

export function dreamStyle(id: string) {
  return DREAM_STYLES.find((style) => style.id === id) ?? DREAM_STYLES[0];
}

export function dreamCityName(id: string) {
  return (CITY_IDS as readonly string[]).includes(id) ? CITIES[id as CityId].name : id;
}

function tileAt(state: CityState, x: number, y: number): Tile | null {
  return state.tiles[y]?.[x] ?? null;
}

function buildableTile(tile: Tile | null) {
  if (!tile || tile.road || tile.buildingId || tile.bridge) return false;
  return tile.terrain === "grass" || tile.terrain === "park";
}

function sideHasRoad(state: CityState, x: number, y: number, w: number, d: number, facing: DreamFacing) {
  if (facing === 0) {
    for (let i = 0; i < w; i++) if (tileAt(state, x + i, y + d)?.road) return true;
  } else if (facing === 2) {
    for (let i = 0; i < w; i++) if (tileAt(state, x + i, y - 1)?.road) return true;
  } else if (facing === 1) {
    for (let i = 0; i < d; i++) if (tileAt(state, x + w, y + i)?.road) return true;
  } else {
    for (let i = 0; i < d; i++) if (tileAt(state, x - 1, y + i)?.road) return true;
  }
  return false;
}

function rectBuildable(state: CityState, x: number, y: number, w: number, d: number) {
  if (x < 0 || y < 0 || x + w > state.size || y + d > state.size) return false;
  for (let iy = 0; iy < d; iy++) {
    for (let ix = 0; ix < w; ix++) {
      if (!buildableTile(tileAt(state, x + ix, y + iy))) return false;
    }
  }
  return true;
}

function landPrice(cityId: CityId, tiles: number) {
  const base = 8_000 + Math.max(0, tiles - 4) * 2_200;
  const mult = cityId === "riverside" ? 1.15 : cityId === "future" ? 1.25 : cityId === "coastal" ? 1.1 : 1;
  return Math.round((base * mult) / 100) * 100;
}

function lotZone(state: CityState, x: number, y: number, w: number, d: number): LotZone {
  let park = false;
  let water = false;
  for (let iy = -1; iy <= d; iy++) {
    for (let ix = -1; ix <= w; ix++) {
      const tile = tileAt(state, x + ix, y + iy);
      if (!tile) continue;
      if (tile.terrain === "park") park = true;
      if (tile.terrain === "water" || tile.terrain === "sand") water = true;
    }
  }
  if (water) return "waterfront";
  if (park) return "park";
  return "residential";
}

function hasRoadAccess(state: CityState, x: number, y: number, w: number, d: number) {
  for (const facing of [0, 1, 2, 3] as const) {
    if (sideHasRoad(state, x, y, w, d, facing)) return true;
  }
  const cx = x + w / 2;
  const cy = y + d / 2;
  for (let radius = 1; radius <= 12; radius++) {
    for (let i = -radius; i <= radius; i++) {
      if (tileAt(state, Math.round(cx + i), Math.round(cy + radius))?.road) return true;
      if (tileAt(state, Math.round(cx + i), Math.round(cy - radius))?.road) return true;
      if (tileAt(state, Math.round(cx + radius), Math.round(cy + i))?.road) return true;
      if (tileAt(state, Math.round(cx - radius), Math.round(cy + i))?.road) return true;
    }
  }
  return false;
}

function nearestFacing(state: CityState, x: number, y: number, w: number, d: number, px: number, py: number): DreamFacing {
  const sides: DreamFacing[] = [];
  for (const facing of [0, 1, 2, 3] as const) {
    if (sideHasRoad(state, x, y, w, d, facing)) sides.push(facing);
  }
  const cx = x + w / 2;
  const cy = y + d / 2;
  if (sides.length) {
    let best = sides[0];
    let bestD = Infinity;
    for (const facing of sides) {
      const sx = facing === 1 ? x + w : facing === 3 ? x : cx;
      const sy = facing === 0 ? y + d : facing === 2 ? y : cy;
      const dist = (sx - px) ** 2 + (sy - py) ** 2;
      if (dist < bestD) {
        bestD = dist;
        best = facing;
      }
    }
    return best;
  }
  // Open lawns sit inside the block. Houses already line the curb, so the
  // door faces the nearest street even when grass is between the lot and the road.
  let best: DreamFacing = 0;
  let bestD = Infinity;
  for (let radius = 1; radius <= 12; radius++) {
    for (let i = -radius; i <= radius; i++) {
      const samples: Array<{ x: number; y: number; facing: DreamFacing }> = [
        { x: Math.round(cx + i), y: Math.round(cy + radius), facing: 0 },
        { x: Math.round(cx + i), y: Math.round(cy - radius), facing: 2 },
        { x: Math.round(cx + radius), y: Math.round(cy + i), facing: 1 },
        { x: Math.round(cx - radius), y: Math.round(cy + i), facing: 3 },
      ];
      for (const sample of samples) {
        if (!tileAt(state, sample.x, sample.y)?.road) continue;
        const dist = (sample.x + 0.5 - px) ** 2 + (sample.y + 0.5 - py) ** 2;
        if (dist < bestD) {
          bestD = dist;
          best = sample.facing;
        }
      }
    }
    if (bestD < Infinity) return best;
  }
  const dx = px - cx;
  const dy = py - cy;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 0 : 2;
}

function plotAround(
  state: CityState,
  cityId: CityId,
  seedX: number,
  seedY: number,
  px: number,
  py: number,
  fx: number,
  fz: number,
): DreamPlot | null {
  let best: DreamPlot | null = null;
  let bestScore = -Infinity;
  for (const [w, d] of SIZES) {
    for (let oy = 0; oy < d; oy++) {
      for (let ox = 0; ox < w; ox++) {
        const x = seedX - ox;
        const y = seedY - oy;
        if (!rectBuildable(state, x, y, w, d)) continue;
        const facing = nearestFacing(state, x, y, w, d, px, py);
        const centerX = x + w / 2;
        const centerY = y + d / 2;
        const ahead = (centerX - px) * fx + (centerY - py) * fz;
        const score = w * d + ahead * 3;
        if (score <= bestScore) continue;
        bestScore = score;
        const price = landPrice(cityId, w * d);
        best = {
          cityId,
          lotId: `${cityId}-${x}-${y}-${w}x${d}`,
          x,
          y,
          w,
          d,
          facing,
          landPrice: price,
          marketValue: Math.round((price * 1.12) / 100) * 100,
          zone: lotZone(state, x, y, w, d),
          roadAccess: hasRoadAccess(state, x, y, w, d),
        };
      }
    }
  }
  return best;
}

/**
 * Largest road-front grass rectangle along the direction the player is looking.
 * The glance reaches across a street, so a lawn on the far curb still counts.
 */
export function findDreamPlot(state: CityState, worldX: number, worldZ: number, yaw: number): DreamPlot | null {
  const cityId = state.id as CityId;
  if (!(CITY_IDS as readonly string[]).includes(cityId)) return null;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const px = worldX / 10;
  const py = worldZ / 10;
  const seen = new Set<string>();
  for (let dist = 0; dist <= 42; dist += 2) {
    const x = Math.floor(px + fx * (dist / 10));
    const y = Math.floor(py + fz * (dist / 10));
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!buildableTile(tileAt(state, x, y))) continue;
    const plot = plotAround(state, cityId, x, y, px, py, fx, fz);
    if (plot) return plot;
  }
  return null;
}

export function styleFits(plot: DreamPlot, style: DreamStyle) {
  const edge = plot.facing === 0 || plot.facing === 2 ? plot.w : plot.d;
  const depth = plot.facing === 0 || plot.facing === 2 ? plot.d : plot.w;
  return style.front <= edge && style.depth <= depth;
}

export function houseFootprint(plot: DreamPlot, style: DreamStyle) {
  const ns = plot.facing === 0 || plot.facing === 2;
  const houseW = ns ? style.front : style.depth;
  const houseD = ns ? style.depth : style.front;
  let houseX = plot.x + Math.floor((plot.w - houseW) / 2);
  let houseY = plot.y + Math.floor((plot.d - houseD) / 2);
  if (plot.facing === 0) houseY = plot.y + plot.d - houseD;
  if (plot.facing === 2) houseY = plot.y;
  if (plot.facing === 1) houseX = plot.x + plot.w - houseW;
  if (plot.facing === 3) houseX = plot.x;
  return { houseX, houseY, houseW, houseD };
}

export function quoteDreamHome(plot: DreamPlot, choice: DreamChoice, player: PlayerState): DreamQuote {
  const style = dreamStyle(choice.styleId);
  const fits = styleFits(plot, style) && choice.stories >= style.minStories && choice.stories <= style.maxStories;
  const stories = Math.max(0, choice.stories - style.minStories) * Math.round(style.price * 0.22);
  const floorItem = choice.floorId ? furnishById(choice.floorId) : null;
  const floor = floorItem && !player.ownedFurnishings.includes(floorItem.id) ? floorItem.price : 0;
  const total = plot.landPrice + style.price + stories + floor;
  return {
    land: plot.landPrice,
    base: style.price,
    stories,
    floor,
    total,
    shortfall: Math.max(0, total - player.wallet),
    fits,
  };
}

export function previewDreamBuilding(plot: DreamPlot, choice: DreamChoice): Building {
  const style = dreamStyle(choice.styleId);
  const foot = houseFootprint(plot, style);
  return dreamBuilding({
    id: "dream-preview",
    listingId: `dream:${style.id}`,
    name: style.name,
    kind: "house",
    purchasePrice: 0,
    plot: { ...plot, ...foot },
    design: {
      styleId: style.id,
      stories: choice.stories,
      wallColor: choice.wall,
      roofColor: choice.roofColor,
      accentColor: choice.accent,
      roof: choice.roof,
      floorId: choice.floorId,
    },
  });
}

function dreamBuilding(home: OwnedHome): Building {
  const plot = home.plot!;
  const design = home.design!;
  return {
    id: home.id,
    kind: "house",
    name: home.name,
    origin: { x: plot.houseX, y: plot.houseY },
    width: plot.houseW,
    depth: plot.houseD,
    variant: 0,
    floors: design.stories,
    wallColor: design.wallColor,
    roofColor: design.roofColor,
    accentColor: design.accentColor,
    constructionLeft: 0,
    stats: {
      residents: 1,
      capacity: 4,
      employees: 0,
      jobs: 0,
      revenue: 0,
      energy: 80,
      parking: 70,
      happiness: 90,
      propertyValue: home.purchasePrice,
      status: "open",
      extra: {
        lodging: "residences",
        dream: "1",
        facing: String(plot.facing),
        roof: design.roof,
        style: design.styleId,
      },
    },
  };
}

function occupyPlot(state: CityState, home: OwnedHome) {
  const plot = home.plot!;
  for (let iy = 0; iy < plot.d; iy++) {
    for (let ix = 0; ix < plot.w; ix++) {
      const tile = state.tiles[plot.y + iy]?.[plot.x + ix];
      if (tile) {
        tile.buildingId = home.id;
        tile.tree = null;
      }
    }
  }
  clearTreesAround(state.tiles, plot.x, plot.y, plot.w, plot.d, 2);
}

function clearPlot(state: CityState, home: OwnedHome) {
  const plot = home.plot;
  if (!plot) return;
  for (let iy = 0; iy < plot.d; iy++) {
    for (let ix = 0; ix < plot.w; ix++) {
      const tile = state.tiles[plot.y + iy]?.[plot.x + ix];
      if (tile?.buildingId === home.id) tile.buildingId = null;
    }
  }
}

export function confirmDreamHome(
  state: CityState,
  plot: DreamPlot,
  choice: DreamChoice,
  clock: CityClock,
): { player: PlayerState; building: Building } | string {
  const player = readPlayer();
  const quote = quoteDreamHome(plot, choice, player);
  const style = dreamStyle(choice.styleId);
  if (!quote.fits) return "That design does not fit this lot.";
  if (!rectBuildable(state, plot.x, plot.y, plot.w, plot.d)) return "That lot is no longer empty.";
  if (quote.shortfall > 0) return "Not enough cash in your wallet.";
  const spent = spendWallet(quote.total, clock, `Built ${style.name}`);
  if (typeof spent === "string") return spent;

  const foot = houseFootprint(plot, style);
  const home: OwnedHome = {
    id: `dream-${style.id}-${Date.now().toString(36)}`,
    listingId: `dream:${style.id}`,
    name: style.name,
    kind: style.front >= 4 ? "mansion" : "house",
    purchasePrice: quote.total,
    plot: { ...plot, ...foot },
    design: {
      styleId: style.id,
      stories: choice.stories,
      wallColor: choice.wall,
      roofColor: choice.roofColor,
      accentColor: choice.accent,
      roof: choice.roof,
      floorId: choice.floorId,
    },
  };
  const latest = readPlayer();
  latest.ownedHomes.push(home);
  latest.activeHomeId = home.id;
  if (choice.floorId && !latest.ownedFurnishings.includes(choice.floorId)) {
    latest.ownedFurnishings.push(choice.floorId);
    latest.equippedFurnish = { ...latest.equippedFurnish, floorId: choice.floorId };
  } else if (choice.floorId) {
    latest.equippedFurnish = { ...latest.equippedFurnish, floorId: choice.floorId };
  }
  writePlayer(latest);
  const building = dreamBuilding(home);
  occupyPlot(state, home);
  state.buildings.set(building.id, building);
  return { player: latest, building };
}

export function refundDreamHome(state: CityState, homeId: string, clock: CityClock) {
  const player = readPlayer();
  const home = player.ownedHomes.find((item) => item.id === homeId);
  if (!home) return player;
  if (home.plot) clearPlot(state, home);
  state.buildings.delete(homeId);
  player.ownedHomes = player.ownedHomes.filter((item) => item.id !== homeId);
  if (player.activeHomeId === homeId) player.activeHomeId = player.ownedHomes[0]?.id ?? null;
  writePlayer(player);
  if (home.purchasePrice > 0) earnCash(home.purchasePrice, clock, `Refund ${home.name}`);
  return readPlayer();
}

/** Put saved dream homes back on a freshly generated city. */
export function stampDreamHomes(state: CityState) {
  const cityId = state.id as CityId;
  if (!(CITY_IDS as readonly string[]).includes(cityId)) return;
  for (const home of readPlayer().ownedHomes) {
    if (!home.plot || !home.design || home.plot.cityId !== cityId) continue;
    if (state.buildings.has(home.id)) continue;
    if (!rectBuildable(state, home.plot.x, home.plot.y, home.plot.w, home.plot.d)) continue;
    occupyPlot(state, home);
    state.buildings.set(home.id, dreamBuilding(home));
  }
}

export function dreamExitTile(building: Building) {
  const facing = Number(building.stats.extra?.facing ?? 0);
  const cx = building.origin.x + Math.floor(building.width / 2);
  const cy = building.origin.y + Math.floor(building.depth / 2);
  if (facing === 1) return { x: building.origin.x + building.width, y: cy };
  if (facing === 3) return { x: building.origin.x - 1, y: cy };
  if (facing === 2) return { x: cx, y: building.origin.y - 1 };
  return { x: cx, y: building.origin.y + building.depth };
}

export function dreamDoorYaw(building: Building) {
  const facing = Number(building.stats.extra?.facing ?? 0);
  if (facing === 2) return Math.PI;
  if (facing === 1) return Math.PI / 2;
  if (facing === 3) return -Math.PI / 2;
  return 0;
}
