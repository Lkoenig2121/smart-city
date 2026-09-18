import * as THREE from "three";
import type { Building } from "@/lib/city/types";
import type { ClothStore } from "@/lib/city/clothing";
import { FOOD_COURT_MENU } from "@/lib/city/consumables";
import { venueRole, type VenueRole } from "@/lib/city/venues";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";

export interface VenueInterior {
  group: THREE.Group;
  blockers: Blocker[];
  spawn: { x: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  groundAt: (x: number, z: number, feetY?: number) => number;
  nearDesk: (x: number, z: number) => boolean;
  nearExit: (x: number, z: number, feetY?: number) => boolean;
  nearStore?: (x: number, z: number, feetY?: number) => ClothStore | null;
  nearSnack?: (x: number, z: number, feetY?: number) => { id: string; name: string; items: string[] } | null;
  update?: (dt: number) => void;
  rideAt?: (x: number, z: number, feetY?: number) => { x: number; z: number } | null;
  dispose: () => void;
}

interface Palette {
  floor: string;
  wall: string;
  trim: string;
  accent: string;
  furniture: string;
}

const PALETTE: Record<VenueRole, Palette> = {
  hospital: { floor: "#e8eef2", wall: "#f4f7f8", trim: "#2aa3a0", accent: "#c0392b", furniture: "#d5dde4" },
  school: { floor: "#c4a882", wall: "#f0e6d2", trim: "#3f5d4c", accent: "#2f4a3a", furniture: "#8a5a3a" },
  city_hall: { floor: "#e8dcc8", wall: "#f4efe6", trim: "#c9a44c", accent: "#1a1a1a", furniture: "#5a3d28" },
  police: { floor: "#3a4450", wall: "#d8dde4", trim: "#1f4d8c", accent: "#c9a44c", furniture: "#2c3e50" },
  fire: { floor: "#6a3a32", wall: "#e8d5c4", trim: "#b5523a", accent: "#2c2c2c", furniture: "#4a3728" },
  office: { floor: "#8a9098", wall: "#dce3ea", trim: "#5d7384", accent: "#c9a44c", furniture: "#6f8ea3" },
  shop: { floor: "#d9c4a8", wall: "#f6e6cf", trim: "#6a3a32", accent: "#3f4d5c", furniture: "#c4a882" },
  restaurant: { floor: "#3a2a1c", wall: "#5a3d28", trim: "#c9a44c", accent: "#7a2e2e", furniture: "#2c1c14" },
  bank: { floor: "#e8dcc8", wall: "#f4efe6", trim: "#2f5d4a", accent: "#c9a44c", furniture: "#3a322c" },
  mall: { floor: "#eceae4", wall: "#f5f4f0", trim: "#d5d1c9", accent: "#8a96a3", furniture: "#c8c3bb" },
  dealership: { floor: "#3a4048", wall: "#dce3ea", trim: "#1f4d8c", accent: "#c9a44c", furniture: "#5d7384" },
  house: { floor: "#c4a882", wall: "#f3d7b5", trim: "#6d4c41", accent: "#4d5b3f", furniture: "#8b3d2e" },
  apartment: { floor: "#b7c3c9", wall: "#e6ddd2", trim: "#5c5348", accent: "#3d5a80", furniture: "#6e6256" },
};

export function buildVenueInterior(building: Building): VenueInterior {
  const role = venueRole(building) ?? "office";
  if (role === "mall") return buildMallInterior();
  const pal = PALETTE[role];
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();

  const minX = -11;
  const maxX = 11;
  const minZ = -9;
  const maxZ = 12;
  const ceilY = 4.6;
  const floor = new THREE.Color(pal.floor);
  const wall = new THREE.Color(pal.wall);
  const trim = new THREE.Color(pal.trim);
  const accent = new THREE.Color(pal.accent);
  const furn = new THREE.Color(pal.furniture);

  floorB.ground(minX, minZ, maxX, maxZ, 0, floor);
  addCeiling(floorB, minX, minZ, maxX, maxZ, ceilY, wall);
  wallB.box(minX, minZ, minX + 0.45, maxZ, 0, ceilY, wall);
  wallB.box(maxX - 0.45, minZ, maxX, maxZ, 0, ceilY, wall);
  wallB.box(minX, minZ, maxX, minZ + 0.45, 0, ceilY, wall);
  wallB.box(minX, maxZ - 0.45, -2.2, maxZ, 0, ceilY, wall);
  wallB.box(2.2, maxZ - 0.45, maxX, maxZ, 0, ceilY, wall);
  wallB.box(-2.2, maxZ - 0.45, 2.2, maxZ, 2.6, ceilY, wall);
  blockers.push({ minX, maxX: minX + 0.45, minZ, maxZ });
  blockers.push({ minX: maxX - 0.45, maxX, minZ, maxZ });
  blockers.push({ minX, maxX, minZ, maxZ: minZ + 0.45 });
  blockers.push({ minX, maxX: -2.2, minZ: maxZ - 0.45, maxZ });
  blockers.push({ minX: 2.2, maxX, minZ: maxZ - 0.45, maxZ });

  trimB.box(-6.4, minZ + 0.45, 6.4, -5.4, 0, 1.12, trim);
  wallB.box(-6.1, minZ + 0.6, 6.1, -5.55, 1.12, 1.24, accent);
  blockers.push({ minX: -6.4, maxX: 6.4, minZ: minZ + 0.45, maxZ: -5.4 });

  furnish(role, wallB, trimB, blockers, furn, accent, trim);

  assemble(group, floorB, wallB, trimB, disposables);

  const office = role === "office";
  return {
    group,
    blockers,
    spawn: office ? { x: 0, z: -3.2, yaw: 0, pitch: -0.06 } : { x: 0, z: 9.4, yaw: 0, pitch: -0.06 },
    bounds: { minX, maxX, minZ, maxZ },
    groundAt: () => 0,
    nearDesk: office
      ? (x, z) => Math.abs(x) < 9 && z < 8.4
      : (x, z) => Math.abs(x) < 7.2 && z > -5.2 && z < 0.6,
    nearExit: (x, z) => z > 9.6 && Math.abs(x) < 2.6,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

type StoreFront = "x+" | "x-" | "z+" | "z-";

const MALL_MIN = -62;
const MALL_MAX = 62;
const MALL_CEIL = 24;
const MALL_L2 = 7.6;
const MALL_L3 = 15.2;
const MALL_L2_HOLE = 22;
const MALL_L3_HOLE = 10;
const MALL_DOOR = 2.8;
const MALL_SKY = 22;
const MALL_SHOP = 46;
const MALL_STORE_H = 5.65;
const ESC_W = 4.15;
const ESC_GAP = 0.16;
const ESC_LANDING = 4.4;
const ESC_L1_TOP = MALL_L2_HOLE + ESC_LANDING;
const ESC_L1_BOT = ESC_L1_TOP + 15.8;
const ESC_L3_TOP = MALL_L3_HOLE + ESC_LANDING;
const ESC_L3_BOT = MALL_L2_HOLE + ESC_LANDING;

const MALL_BAYS: {
  id: ClothStore;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y0: number;
  front: StoreFront;
  color: string;
  name: string;
  blurb: string;
}[] = [
  { id: "fashion", minX: -61.4, maxX: -MALL_SHOP, minZ: 2.6, maxZ: 28.2, y0: 0, front: "x+", color: "#c45c4a", name: "Fashion Avenue", blurb: "Jackets · shirts" },
  { id: "jewelry", minX: -61.4, maxX: -MALL_SHOP, minZ: -28.2, maxZ: -2.6, y0: 0, front: "x+", color: "#c9a44c", name: "Harbor Jewels", blurb: "Watches · rings" },
  { id: "sneaker", minX: MALL_SHOP, maxX: 61.4, minZ: 2.6, maxZ: 28.2, y0: 0, front: "x-", color: "#2aa3a0", name: "Sneaker District", blurb: "Kicks · athletic" },
  { id: "kids", minX: MALL_SHOP, maxX: 61.4, minZ: -28.2, maxZ: -2.6, y0: 0, front: "x-", color: "#7eb3e0", name: "Little Harbor", blurb: "Kids · extras" },
  { id: "luxury", minX: -38.4, maxX: -4.2, minZ: -61.4, maxZ: -MALL_SHOP, y0: 0, front: "z+", color: "#1a1206", name: "Luxury Boutique", blurb: "Premium cuts" },
  { id: "department", minX: 4.2, maxX: 38.4, minZ: -61.4, maxZ: -MALL_SHOP, y0: 0, front: "z+", color: "#2f5d4a", name: "Department Store", blurb: "Bags · basics" },
  { id: "gifts", minX: -61.4, maxX: -MALL_SHOP, minZ: -20.4, maxZ: 20.4, y0: MALL_L2, front: "x+", color: "#c45c4a", name: "Atrium Gifts", blurb: "Wraps · souvenirs" },
  { id: "home", minX: MALL_SHOP, maxX: 61.4, minZ: -20.4, maxZ: 20.4, y0: MALL_L2, front: "x-", color: "#8a6a4a", name: "Nest & Linen", blurb: "Lounge · home" },
  { id: "outdoor", minX: -32.4, maxX: 32.4, minZ: -61.4, maxZ: -MALL_SHOP, y0: MALL_L2, front: "z+", color: "#3e8244", name: "River Trail", blurb: "Shells · trail" },
  { id: "books", minX: -38.4, maxX: -6.2, minZ: MALL_SHOP, maxZ: 61.4, y0: MALL_L2, front: "z-", color: "#5c5348", name: "Gallery Books", blurb: "Totes · knits" },
  { id: "beauty", minX: 6.2, maxX: 38.4, minZ: MALL_SHOP, maxZ: 61.4, y0: MALL_L2, front: "z-", color: "#d48aa0", name: "Harbor Beauty", blurb: "Scarves · shades" },
  { id: "gallery", minX: -61.4, maxX: -MALL_SHOP, minZ: -18.4, maxZ: 18.4, y0: MALL_L3, front: "x+", color: "#101826", name: "North Gallery", blurb: "Runway · legend" },
  { id: "tech", minX: MALL_SHOP, maxX: 61.4, minZ: -18.4, maxZ: 18.4, y0: MALL_L3, front: "x-", color: "#2aa3a0", name: "Harbor Tech", blurb: "Buds · nightwalk" },
  { id: "music", minX: -32.4, maxX: 32.4, minZ: -61.4, maxZ: -MALL_SHOP, y0: MALL_L3, front: "z+", color: "#c45c4a", name: "Atrium Records", blurb: "Tees · cans" },
  { id: "sport", minX: -38.4, maxX: -6.2, minZ: MALL_SHOP, maxZ: 61.4, y0: MALL_L3, front: "z-", color: "#1d2d4f", name: "Court Sport", blurb: "Jerseys · kicks" },
  { id: "toys", minX: 6.2, maxX: 38.4, minZ: MALL_SHOP, maxZ: 61.4, y0: MALL_L3, front: "z-", color: "#e67e22", name: "Sky Toys", blurb: "Packs · play" },
];

const HUT_W = 4.6;
const HUT_D = 3.35;
const HUT_H = 2.72;

const SNACK_HUTS: {
  id: string;
  name: string;
  blurb: string;
  x: number;
  z: number;
  y0: number;
  face: StoreFront;
  color: string;
  items: string[];
}[] = [
  { id: "pretzel", name: "Atrium Pretzels", blurb: "Salted twists · lemonade", x: -34.2, z: 34.2, y0: MALL_L2, face: "z-", color: "#c45c4a", items: ["food-pretzel", "drink-lemonade", "drink-soda"] },
  { id: "scoops", name: "Skylight Scoops", blurb: "Soft serve · fruit", x: 34.2, z: 34.2, y0: MALL_L2, face: "z-", color: "#d48aa0", items: ["food-ice-cream", "food-fruit", "drink-smoothie"] },
  { id: "tea", name: "Gallery Tea", blurb: "Iced tea · espresso", x: -34.2, z: -34.2, y0: MALL_L2, face: "z+", color: "#2f5d4a", items: ["drink-tea", "drink-espresso", "food-cookie"] },
  { id: "cookies", name: "Upper Cookies", blurb: "Warm chips", x: 34.2, z: -34.2, y0: MALL_L2, face: "z+", color: "#6a3a32", items: ["food-cookie", "drink-soda", "drink-water"] },
  { id: "burger", name: "Harbor Burger", blurb: "Hamburgers · fries", x: -36.4, z: 38.2, y0: MALL_L3, face: "z-", color: "#6a3a32", items: [...FOOD_COURT_MENU] },
  { id: "dogs", name: "Dog House", blurb: "Hot dogs · soda", x: -21.2, z: 38.2, y0: MALL_L3, face: "z-", color: "#c45c4a", items: [...FOOD_COURT_MENU] },
  { id: "nachos", name: "Sky Nachos", blurb: "Cheese · salsa", x: 21.2, z: 38.2, y0: MALL_L3, face: "z-", color: "#e8c36a", items: [...FOOD_COURT_MENU] },
  { id: "fountain", name: "Fountain Drinks", blurb: "Soda · lemonade", x: 36.4, z: 38.2, y0: MALL_L3, face: "z-", color: "#2aa3a0", items: [...FOOD_COURT_MENU] },
];

type EscLane = {
  axis: "x" | "z";
  a0: number;
  a1: number;
  bot: number;
  top: number;
  y0: number;
  y1: number;
  up: boolean;
  speed: number;
  minFeet: number;
};

function escLanes(
  axis: "x" | "z",
  cx: number,
  bot: number,
  top: number,
  y0: number,
  y1: number,
  speed: number,
  minFeet: number,
  flip = false,
): EscLane[] {
  return [
    { axis, a0: cx - ESC_W, a1: cx - ESC_GAP, bot, top, y0, y1, up: flip, speed, minFeet },
    { axis, a0: cx + ESC_GAP, a1: cx + ESC_W, bot, top, y0, y1, up: !flip, speed, minFeet },
  ];
}

const ESC_LANES: EscLane[] = [
  ...escLanes("z", 0, ESC_L1_BOT, ESC_L1_TOP, 0, MALL_L2, 1.55, 0),
  ...escLanes("z", 0, -ESC_L1_BOT, -ESC_L1_TOP, 0, MALL_L2, 1.55, 0),
  ...escLanes("x", 0, ESC_L3_BOT, ESC_L3_TOP, MALL_L2, MALL_L3, 1.45, MALL_L2 - 1.2, true),
  ...escLanes("x", 0, -ESC_L3_BOT, -ESC_L3_TOP, MALL_L2, MALL_L3, 1.45, MALL_L2 - 1.2, true),
];

type EscalatorBelt = { tex: THREE.CanvasTexture; scroll: number };

function buildMallInterior(): VenueInterior {
  const pal = PALETTE.mall;
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();
  const glassB = new MeshBuilder();
  const minX = MALL_MIN;
  const maxX = MALL_MAX;
  const minZ = MALL_MIN;
  const maxZ = MALL_MAX;
  const ceilY = MALL_CEIL;
  const floor = new THREE.Color(pal.floor);
  const wall = new THREE.Color(pal.wall);
  const marble = new THREE.Color("#f3f1ec");
  const gold = new THREE.Color("#cfd6dc");
  const cream = new THREE.Color("#f7f7f4");
  const water = new THREE.Color("#d7e2ea");
  const leaf = new THREE.Color("#6a9a6e");
  const stone = new THREE.Color("#e4e0d8");
  const glass = new THREE.Color("#e8f4fb");

  floorB.ground(minX, minZ, maxX, maxZ, 0.04, floor);
  floorB.ground(-40, -40, 40, 44, 0.06, marble);
  addCeiling(floorB, minX, minZ, maxX, -MALL_SKY, ceilY, cream);
  addCeiling(floorB, minX, MALL_SKY, maxX, maxZ, ceilY, cream);
  addCeiling(floorB, minX, -MALL_SKY, -MALL_SKY, MALL_SKY, ceilY, cream);
  addCeiling(floorB, MALL_SKY, -MALL_SKY, maxX, MALL_SKY, ceilY, cream);
  addCeiling(floorB, -MALL_SKY, -MALL_SKY, MALL_SKY, MALL_SKY, ceilY + 0.55, new THREE.Color("#fffdf8"));
  glassQuad(glassB, -MALL_SKY, -MALL_SKY, MALL_SKY, MALL_SKY, ceilY - 0.04, glass);
  addSkylightGrid(trimB, ceilY, cream);

  const t = 0.55;
  blockers.push({ minX, maxX: minX + t, minZ, maxZ });
  blockers.push({ minX: maxX - t, maxX, minZ, maxZ });
  blockers.push({ minX, maxX, minZ, maxZ: minZ + t });
  blockers.push({ minX, maxX: -MALL_DOOR - 0.2, minZ: maxZ - t, maxZ });
  blockers.push({ minX: MALL_DOOR + 0.2, maxX, minZ: maxZ - t, maxZ });
  addCurtainWall(wallB, trimB, glassB, minX, maxX, minZ, maxZ, ceilY, t, wall, gold, stone);
  wallB.box(-MALL_DOOR - 0.2, maxZ - t, MALL_DOOR + 0.2, maxZ, 4.35, ceilY, wall);
  trimB.box(-MALL_DOOR - 0.45, maxZ - 0.7, MALL_DOOR + 0.45, maxZ + 0.08, 4.35, 4.62, gold);

  addAtrium(floorB, wallB, trimB, blockers, marble, gold, water, stone, ceilY);
  addGalleries(floorB, wallB, trimB, glassB, blockers, marble, gold);
  const belts = addMallEscalators(group, wallB, trimB, blockers, disposables, gold);
  addMallStores(wallB, trimB, glassB, blockers, wall, gold);
  furnishMallStores(wallB, trimB, blockers, gold);
  addFoodCourt(group, wallB, trimB, blockers, disposables, wall, gold, stone);
  addConcourseProps(wallB, trimB, blockers, gold, leaf, stone);
  addDirectory(wallB, trimB, blockers, gold, marble);
  addSnackHuts(group, wallB, trimB, blockers, disposables, gold);

  for (const bay of MALL_BAYS) {
    const midX = (bay.minX + bay.maxX) / 2;
    const midZ = (bay.minZ + bay.maxZ) / 2;
    const y = bay.y0 + 4.2;
    if (bay.front === "x+") addMallSign(group, disposables, bay.name, bay.blurb, bay.color, bay.maxX + 0.08, y, midZ, Math.PI / 2, 7.4);
    else if (bay.front === "x-") addMallSign(group, disposables, bay.name, bay.blurb, bay.color, bay.minX - 0.08, y, midZ, -Math.PI / 2, 7.4);
    else if (bay.front === "z-") addMallSign(group, disposables, bay.name, bay.blurb, bay.color, midX, y, bay.minZ - 0.08, Math.PI, 8.4);
    else addMallSign(group, disposables, bay.name, bay.blurb, bay.color, midX, y, bay.maxZ + 0.08, 0, 8.4);
  }
  addMallSign(group, disposables, "HARBOR MALL", "Three floors · Stores · Food court", "#5a6570", 0, 4.4, 60.2, Math.PI, 11.2);
  addMallSign(group, disposables, "HARBOR MALL", "Atrium galleries", "#5a6570", 0, 20.6, 0, 0, 12.4);

  assemble(group, floorB, wallB, trimB, disposables, true);
  addGlassMesh(group, glassB, disposables);

  return {
    group,
    blockers,
    spawn: { x: 0, z: 56.6, yaw: 0, pitch: -0.08 },
    bounds: { minX, maxX, minZ, maxZ },
    groundAt: mallGroundAt,
    nearDesk: (x, z) => x > -11.2 && x < -3.6 && z > 49.8 && z < 54.4,
    nearExit: (x, z, feetY = 0) => feetY < 1.5 && z > 58.8 && Math.abs(x) < 4.4,
    nearStore: (x, z, feetY = 0) => {
      const bay = MALL_BAYS.find(
        (item) =>
          x >= item.minX &&
          x <= item.maxX &&
          z >= item.minZ &&
          z <= item.maxZ &&
          feetY >= item.y0 - 0.6 &&
          feetY < item.y0 + MALL_STORE_H,
      );
      return bay?.id ?? null;
    },
    nearSnack: (x, z, feetY = 0) => {
      if (inFoodCourt(x, z, feetY)) {
        return { id: "court", name: "Food Court", items: [...FOOD_COURT_MENU] };
      }
      const hut = SNACK_HUTS.find((item) => inHutServe(item, x, z, feetY));
      return hut ? { id: hut.id, name: hut.name, items: hut.items } : null;
    },
    update: (dt) => {
      for (const belt of belts) {
        belt.tex.offset.y += dt * belt.scroll;
      }
    },
    rideAt: mallRideAt,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

function mallRampY(lane: EscLane, x: number, z: number) {
  const along = lane.axis === "z" ? z : x;
  const across = lane.axis === "z" ? x : z;
  const lo = Math.min(lane.bot, lane.top);
  const hi = Math.max(lane.bot, lane.top);
  if (across < lane.a0 || across > lane.a1 || along < lo || along > hi) return null;
  const t = (along - lane.bot) / (lane.top - lane.bot);
  return THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(lane.y0, lane.y1, t),
    Math.min(lane.y0, lane.y1),
    Math.max(lane.y0, lane.y1),
  );
}

function mallGroundAt(x: number, z: number, feetY = 0) {
  for (const lane of ESC_LANES) {
    const rampY = mallRampY(lane, x, z);
    if (rampY == null) continue;
    if (feetY > rampY + 1.35 || feetY < rampY - 1.6) continue;
    return rampY;
  }
  const r = Math.max(Math.abs(x), Math.abs(z));
  const floors = [0];
  if (onL2ExitPad(x, z) || (r >= MALL_L2_HOLE && !inL1Well(x, z) && !inL3Well(x, z))) floors.push(MALL_L2);
  if (onL3ExitPad(x, z) || (r >= MALL_L3_HOLE && !inL3Well(x, z))) floors.push(MALL_L3);
  let best = 0;
  for (const y of floors) {
    if (y <= feetY + 1.25 && y >= best) best = y;
  }
  return best;
}

function mallRideAt(x: number, z: number, feetY = 0) {
  for (const lane of ESC_LANES) {
    const rampY = mallRampY(lane, x, z);
    if (rampY == null) continue;
    if (feetY > rampY + 1.2 || feetY < rampY - 1.2) continue;
    const dir = Math.sign(lane.top - lane.bot) * (lane.up ? 1 : -1) * lane.speed;
    return lane.axis === "z" ? { x: 0, z: dir } : { x: dir, z: 0 };
  }
  return null;
}

function inL1Well(x: number, z: number) {
  if (Math.abs(x) > ESC_W + 0.2) return false;
  if (z > ESC_L1_TOP + 2.6 && z < ESC_L1_BOT - 0.25) return true;
  if (z < -ESC_L1_TOP - 2.6 && z > -ESC_L1_BOT + 0.25) return true;
  return false;
}

function inL3Well(x: number, z: number) {
  if (Math.abs(z) > ESC_W + 0.2) return false;
  if (x > ESC_L3_TOP + 2.6 && x < ESC_L3_BOT - 0.25) return true;
  if (x < -ESC_L3_TOP - 2.6 && x > -ESC_L3_BOT + 0.25) return true;
  return false;
}

function onL2ExitPad(x: number, z: number) {
  const span = ESC_W + 3.4;
  const depth = 3.1;
  if (Math.abs(x) <= span && Math.abs(z - ESC_L1_TOP) <= depth) return true;
  if (Math.abs(x) <= span && Math.abs(z + ESC_L1_TOP) <= depth) return true;
  if (Math.abs(z) <= span && Math.abs(x - ESC_L3_BOT) <= depth) return true;
  if (Math.abs(z) <= span && Math.abs(x + ESC_L3_BOT) <= depth) return true;
  return false;
}

function onL3ExitPad(x: number, z: number) {
  const span = ESC_W + 3.4;
  const depth = 3.1;
  if (Math.abs(z) <= span && Math.abs(x - ESC_L3_TOP) <= depth) return true;
  if (Math.abs(z) <= span && Math.abs(x + ESC_L3_TOP) <= depth) return true;
  return false;
}

function addAtrium(
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  marble: THREE.Color,
  gold: THREE.Color,
  water: THREE.Color,
  stone: THREE.Color,
  ceilY: number,
) {
  const h = MALL_L2_HOLE;
  floorB.ground(-h + 0.4, -h + 0.4, h - 0.4, h - 0.4, 0.07, marble);
  floorB.ground(-3.8, -3.8, 3.8, 3.8, 0.05, water);
  trimB.box(-2.4, -2.4, 2.4, 2.4, 0.04, 0.52, gold);
  wallB.box(-0.7, -0.7, 0.7, 0.7, 0.52, 1.85, marble);
  trimB.box(-0.22, -0.22, 0.22, 0.22, 1.85, 2.65, gold);
  blockers.push({ minX: -2.4, maxX: 2.4, minZ: -2.4, maxZ: 2.4, maxY: 2.7 });
  for (const [x, z] of [
    [-h, -h],
    [h, -h],
    [-h, h],
    [h, h],
  ]) {
    wallB.box(x - 0.42, z - 0.42, x + 0.42, z + 0.42, 0, ceilY, stone);
    trimB.box(x - 0.52, z - 0.52, x + 0.52, z + 0.52, MALL_L2 - 0.12, MALL_L2 + 0.18, gold);
    trimB.box(x - 0.52, z - 0.52, x + 0.52, z + 0.52, MALL_L3 - 0.12, MALL_L3 + 0.18, gold);
    trimB.box(x - 0.52, z - 0.52, x + 0.52, z + 0.52, ceilY - 0.22, ceilY, gold);
    blockers.push({ minX: x - 0.42, maxX: x + 0.42, minZ: z - 0.42, maxZ: z + 0.42 });
  }
}

function addGalleries(
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  glassB: MeshBuilder,
  blockers: Blocker[],
  marble: THREE.Color,
  gold: THREE.Color,
) {
  const min = MALL_MIN + 0.6;
  const max = MALL_MAX - 0.6;
  const soffit = new THREE.Color("#d5d1c8");
  const fascia = new THREE.Color("#9ec9c8");
  addRingFloor(floorB, wallB, min, max, MALL_L2_HOLE, MALL_L2, marble, soffit, fascia, true);
  addRingFloor(floorB, wallB, min, max, MALL_L3_HOLE, MALL_L3, marble, soffit, fascia, false);
  holeRim(trimB, MALL_L2_HOLE, MALL_L2, gold);
  holeRim(trimB, MALL_L3_HOLE, MALL_L3, gold);

  const rail = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    glassRail(wallB, trimB, glassB, blockers, x0, z0, x1, z1, y, gold);
  };
  const l2 = MALL_L2_HOLE;
  const l3 = MALL_L3_HOLE;
  rail(-l2, l2 - 0.1, l2, l2, MALL_L2);
  rail(-l2, -l2, l2, -l2 + 0.1, MALL_L2);
  rail(-l2, -l2, -l2 + 0.1, -ESC_W, MALL_L2);
  rail(-l2, ESC_W, -l2 + 0.1, l2, MALL_L2);
  rail(l2 - 0.1, -l2, l2, -ESC_W, MALL_L2);
  rail(l2 - 0.1, ESC_W, l2, l2, MALL_L2);

  rail(-l3, l3 - 0.1, l3, l3, MALL_L3);
  rail(-l3, -l3, l3, -l3 + 0.1, MALL_L3);
  rail(-l3, -l3, -l3 + 0.1, l3, MALL_L3);
  rail(l3 - 0.1, -l3, l3, l3, MALL_L3);
  addWellRails(wallB, trimB, glassB, blockers, gold);
}

const DECK = 0.52;

function addDeckRect(
  floorB: MeshBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  top: THREE.Color,
  bot: THREE.Color,
) {
  if (x1 - x0 < 0.2 || z1 - z0 < 0.2) return;
  floorB.ground(x0, z0, x1, z1, y, top);
  floorB.soffit(x0, z0, x1, z1, y - DECK, bot);
}

function addRingFloor(
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  min: number,
  max: number,
  hole: number,
  y: number,
  marble: THREE.Color,
  soffit: THREE.Color,
  fascia: THREE.Color,
  cutL1Wells: boolean,
) {
  const w = ESC_W + 0.14;
  const slab = (x0: number, z0: number, x1: number, z1: number) => addDeckRect(floorB, x0, z0, x1, z1, y, marble, soffit);

  slab(min, hole, -w, max);
  slab(w, hole, max, max);
  if (cutL1Wells) {
    slab(-w, hole, w, ESC_L1_TOP);
    slab(-w, ESC_L1_BOT, w, max);
  } else {
    slab(-w, hole, w, max);
  }

  slab(min, min, -w, -hole);
  slab(w, min, max, -hole);
  if (cutL1Wells) {
    slab(-w, -ESC_L1_TOP, w, -hole);
    slab(-w, min, w, -ESC_L1_BOT);
  } else {
    slab(-w, min, w, -hole);
  }

  const westWellEnd = Math.min(-ESC_L3_TOP, -hole);
  slab(min, -hole, -ESC_L3_BOT, hole);
  slab(-ESC_L3_BOT, -hole, westWellEnd, -w);
  slab(-ESC_L3_BOT, w, westWellEnd, hole);
  if (-ESC_L3_TOP < -hole) slab(-ESC_L3_TOP, -hole, -hole, hole);

  const eastWellStart = Math.max(ESC_L3_TOP, hole);
  slab(ESC_L3_BOT, -hole, max, hole);
  slab(eastWellStart, -hole, ESC_L3_BOT, -w);
  slab(eastWellStart, w, ESC_L3_BOT, hole);
  if (ESC_L3_TOP > hole) slab(hole, -hole, ESC_L3_TOP, hole);

  const d = y - DECK;
  wallB.box(-hole, hole - 0.14, hole, hole, d, y, fascia);
  wallB.box(-hole, -hole, hole, -hole + 0.14, d, y, fascia);
  wallB.box(-hole, -hole, -hole + 0.14, hole, d, y, fascia);
  wallB.box(hole - 0.14, -hole, hole, hole, d, y, fascia);
}

function holeRim(trimB: MeshBuilder, hole: number, y: number, gold: THREE.Color) {
  const t = 0.22;
  trimB.box(-hole - t, hole - 0.08, hole + t, hole + t, y, y + 0.12, gold);
  trimB.box(-hole - t, -hole - t, hole + t, -hole + 0.08, y, y + 0.12, gold);
  trimB.box(-hole - t, -hole, -hole + 0.08, hole, y, y + 0.12, gold);
  trimB.box(hole - 0.08, -hole, hole + t, hole, y, y + 0.12, gold);
}

function addWellRails(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  glassB: MeshBuilder,
  blockers: Blocker[],
  gold: THREE.Color,
) {
  const rail = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    glassRail(wallB, trimB, glassB, blockers, x0, z0, x1, z1, y, gold);
  };
  const t = 0.12;
  const w = ESC_W + 0.1;
  const l1Start = ESC_L1_TOP + 2.7;
  rail(-w - t, l1Start, -w, ESC_L1_BOT, MALL_L2);
  rail(w, l1Start, w + t, ESC_L1_BOT, MALL_L2);
  rail(-w - t, ESC_L1_BOT, w + t, ESC_L1_BOT + t, MALL_L2);
  rail(-w - t, -ESC_L1_BOT, -w, -l1Start, MALL_L2);
  rail(w, -ESC_L1_BOT, w + t, -l1Start, MALL_L2);
  rail(-w - t, -ESC_L1_BOT - t, w + t, -ESC_L1_BOT, MALL_L2);

  const l3Start = ESC_L3_TOP + 2.7;
  rail(MALL_L2_HOLE, -w - t, ESC_L3_BOT, -w, MALL_L2);
  rail(MALL_L2_HOLE, w, ESC_L3_BOT, w + t, MALL_L2);
  rail(-ESC_L3_BOT, -w - t, -MALL_L2_HOLE, -w, MALL_L2);
  rail(-ESC_L3_BOT, w, -MALL_L2_HOLE, w + t, MALL_L2);

  rail(l3Start, -w - t, ESC_L3_BOT, -w, MALL_L3);
  rail(l3Start, w, ESC_L3_BOT, w + t, MALL_L3);
  rail(ESC_L3_BOT, -w - t, ESC_L3_BOT + t, w + t, MALL_L3);
  rail(-ESC_L3_BOT, -w - t, -l3Start, -w, MALL_L3);
  rail(-ESC_L3_BOT, w, -l3Start, w + t, MALL_L3);
  rail(-ESC_L3_BOT - t, -w - t, -ESC_L3_BOT, w + t, MALL_L3);
}

function glassRail(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  glassB: MeshBuilder,
  blockers: Blocker[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  gold: THREE.Color,
) {
  if (x1 - x0 < 0.08 || z1 - z0 < 0.08) return;
  const alongX = x1 - x0 > z1 - z0;
  wallB.box(x0, z0, x1, z1, y, y + 0.08, gold);
  trimB.box(x0 - 0.02, z0 - 0.02, x1 + 0.02, z1 + 0.02, y + 1.02, y + 1.12, gold);
  if (alongX) {
    const z = (z0 + z1) / 2;
    glassPaneZ(glassB, z, x0 + 0.06, x1 - 0.06, y + 0.12, y + 1.02);
    trimB.box(x0, z0, x0 + 0.08, z1, y, y + 1.12, gold);
    trimB.box(x1 - 0.08, z0, x1, z1, y, y + 1.12, gold);
  } else {
    const x = (x0 + x1) / 2;
    glassPaneX(glassB, x, z0 + 0.06, z1 - 0.06, y + 0.12, y + 1.02);
    trimB.box(x0, z0, x1, z0 + 0.08, y, y + 1.12, gold);
    trimB.box(x0, z1 - 0.08, x1, z1, y, y + 1.12, gold);
  }
  blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y - 0.2, maxY: y + 1.15 });
}

function addCurtainWall(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  glassB: MeshBuilder,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  ceilY: number,
  t: number,
  wall: THREE.Color,
  gold: THREE.Color,
  stone: THREE.Color,
) {
  const pier = 1.2;
  wallB.box(minX, minZ, minX + pier, minZ + pier, 0, ceilY, wall);
  wallB.box(maxX - pier, minZ, maxX, minZ + pier, 0, ceilY, wall);
  wallB.box(minX, maxZ - pier, minX + pier, maxZ, 0, ceilY, wall);
  wallB.box(maxX - pier, maxZ - pier, maxX, maxZ, 0, ceilY, wall);
  wallB.box(minX, minZ, minX + t, maxZ, 0, 0.92, stone);
  wallB.box(maxX - t, minZ, maxX, maxZ, 0, 0.92, stone);
  wallB.box(minX, minZ, maxX, minZ + t, 0, 0.92, stone);
  wallB.box(minX, maxZ - t, -MALL_DOOR - 0.2, maxZ, 0, 0.92, stone);
  wallB.box(MALL_DOOR + 0.2, maxZ - t, maxX, maxZ, 0, 0.92, stone);

  const glassBands: Array<[number, number]> = [
    [0.92, 6.9],
    [7.8, 14.4],
    [15.3, 22.8],
  ];
  const spandrels: Array<[number, number]> = [
    [6.9, 7.8],
    [14.4, 15.3],
    [22.8, ceilY],
  ];

  windowWallX(wallB, trimB, glassB, minX + t * 0.45, minZ + pier, maxZ - pier, glassBands, spandrels, wall, gold);
  windowWallX(wallB, trimB, glassB, maxX - t * 0.45, minZ + pier, maxZ - pier, glassBands, spandrels, wall, gold);
  windowWallZ(wallB, trimB, glassB, minZ + t * 0.45, minX + pier, maxX - pier, glassBands, spandrels, wall, gold);
  windowWallZ(
    wallB,
    trimB,
    glassB,
    maxZ - t * 0.45,
    minX + pier,
    -MALL_DOOR - 0.25,
    glassBands,
    spandrels,
    wall,
    gold,
  );
  windowWallZ(
    wallB,
    trimB,
    glassB,
    maxZ - t * 0.45,
    MALL_DOOR + 0.25,
    maxX - pier,
    glassBands,
    spandrels,
    wall,
    gold,
  );
  for (const [y0, y1] of glassBands.slice(1)) {
    glassPaneZ(glassB, maxZ - t * 0.45, -MALL_DOOR - 0.2, MALL_DOOR + 0.2, y0, y1);
  }
  for (const [y0, y1] of spandrels) {
    wallB.box(-MALL_DOOR - 0.25, maxZ - t, MALL_DOOR + 0.25, maxZ, y0, y1, wall);
  }
}

function windowWallX(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  glassB: MeshBuilder,
  x: number,
  z0: number,
  z1: number,
  glassBands: Array<[number, number]>,
  spandrels: Array<[number, number]>,
  wall: THREE.Color,
  gold: THREE.Color,
) {
  const n = Math.max(1, Math.round((z1 - z0) / 6));
  const bay = (z1 - z0) / n;
  for (const [y0, y1] of spandrels) {
    wallB.box(x - 0.16, z0, x + 0.16, z1, y0, y1, wall);
  }
  for (const [y0, y1] of [...glassBands, ...spandrels]) {
    trimB.box(x - 0.18, z0, x + 0.18, z1, y0, y0 + 0.08, gold);
    trimB.box(x - 0.18, z0, x + 0.18, z1, y1 - 0.08, y1, gold);
  }
  const mullionTop = glassBands[glassBands.length - 1][1];
  for (let i = 0; i <= n; i++) {
    const z = z0 + i * bay;
    wallB.box(x - 0.12, z - 0.12, x + 0.12, z + 0.12, 0.92, mullionTop, wall);
  }
  for (let i = 0; i < n; i++) {
    const za = z0 + i * bay + 0.18;
    const zb = z0 + (i + 1) * bay - 0.18;
    for (const [y0, y1] of glassBands) {
      glassPaneX(glassB, x, za, zb, y0, y1);
    }
  }
}

function windowWallZ(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  glassB: MeshBuilder,
  z: number,
  x0: number,
  x1: number,
  glassBands: Array<[number, number]>,
  spandrels: Array<[number, number]>,
  wall: THREE.Color,
  gold: THREE.Color,
) {
  if (x1 - x0 < 0.8) return;
  const n = Math.max(1, Math.round((x1 - x0) / 6));
  const bay = (x1 - x0) / n;
  for (const [y0, y1] of spandrels) {
    wallB.box(x0, z - 0.16, x1, z + 0.16, y0, y1, wall);
  }
  for (const [y0, y1] of [...glassBands, ...spandrels]) {
    trimB.box(x0, z - 0.18, x1, z + 0.18, y0, y0 + 0.08, gold);
    trimB.box(x0, z - 0.18, x1, z + 0.18, y1 - 0.08, y1, gold);
  }
  const mullionTop = glassBands[glassBands.length - 1][1];
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * bay;
    wallB.box(x - 0.12, z - 0.12, x + 0.12, z + 0.12, 0.92, mullionTop, wall);
  }
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * bay + 0.18;
    const xb = x0 + (i + 1) * bay - 0.18;
    for (const [y0, y1] of glassBands) {
      glassPaneZ(glassB, z, xa, xb, y0, y1);
    }
  }
}

function addMallEscalators(
  group: THREE.Group,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  disposables: Array<{ dispose: () => void }>,
  gold: THREE.Color,
): EscalatorBelt[] {
  const metal = new THREE.Color("#4a4e56");
  const belts: EscalatorBelt[] = [];
  for (const lane of ESC_LANES) {
    belts.push(addEscalatorRun(group, wallB, trimB, blockers, disposables, lane, metal, gold));
  }
  const banks = [
    { axis: "z" as const, c: 0, bot: ESC_L1_BOT, top: ESC_L1_TOP, y0: 0, y1: MALL_L2 },
    { axis: "z" as const, c: 0, bot: -ESC_L1_BOT, top: -ESC_L1_TOP, y0: 0, y1: MALL_L2 },
    { axis: "x" as const, c: 0, bot: ESC_L3_BOT, top: ESC_L3_TOP, y0: MALL_L2, y1: MALL_L3 },
    { axis: "x" as const, c: 0, bot: -ESC_L3_BOT, top: -ESC_L3_TOP, y0: MALL_L2, y1: MALL_L3 },
  ];
  for (const bank of banks) {
    const z0 = Math.min(bank.bot, bank.top);
    const z1 = Math.max(bank.bot, bank.top);
    if (bank.axis === "z") {
      wallB.box(bank.c - 0.14, z0, bank.c + 0.14, z1, bank.y0, bank.y1 + 1.05, metal);
      blockers.push({
        minX: bank.c - 0.14,
        maxX: bank.c + 0.14,
        minZ: z0,
        maxZ: z1,
        minY: bank.y0 - 0.2,
        maxY: bank.y1 + 1.1,
      });
    } else {
      wallB.box(z0, bank.c - 0.14, z1, bank.c + 0.14, bank.y0, bank.y1 + 1.05, metal);
      blockers.push({
        minX: z0,
        maxX: z1,
        minZ: bank.c - 0.14,
        maxZ: bank.c + 0.14,
        minY: bank.y0 - 0.2,
        maxY: bank.y1 + 1.1,
      });
    }
  }
  return belts;
}

function addEscalatorRun(
  group: THREE.Group,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  disposables: Array<{ dispose: () => void }>,
  run: {
    axis: "x" | "z";
    a0: number;
    a1: number;
    bot: number;
    top: number;
    y0: number;
    y1: number;
    up: boolean;
  },
  metal: THREE.Color,
  gold: THREE.Color,
): EscalatorBelt {
  const travel = run.bot - run.top;
  const rise = run.y1 - run.y0;
  const len = Math.hypot(travel, rise);
  const segs = Math.max(8, Math.round(len / 1.55));
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const yA = THREE.MathUtils.lerp(run.y0, run.y1, t0);
    const yB = THREE.MathUtils.lerp(run.y0, run.y1, t1);
    const cA = THREE.MathUtils.lerp(run.bot, run.top, t0);
    const cB = THREE.MathUtils.lerp(run.bot, run.top, t1);
    const cMin = Math.min(cA, cB);
    const cMax = Math.max(cA, cB);
    const yTop = Math.max(yA, yB) + 1.08;
    if (t1 < 0.8) {
      if (run.axis === "z") {
        wallB.box(run.a0 - 0.14, cMin, run.a0, cMax, yA, yTop, metal);
        wallB.box(run.a1, cMin, run.a1 + 0.14, cMax, yA, yTop, metal);
        trimB.box(run.a0 - 0.1, cMin, run.a0 + 0.06, cMax, yA + 0.96, yB + 1.1, gold);
        trimB.box(run.a1 - 0.06, cMin, run.a1 + 0.1, cMax, yA + 0.96, yB + 1.1, gold);
        blockers.push({
          minX: run.a0 - 0.14,
          maxX: run.a0,
          minZ: cMin,
          maxZ: cMax,
          minY: yA - 0.2,
          maxY: yTop,
        });
        blockers.push({
          minX: run.a1,
          maxX: run.a1 + 0.14,
          minZ: cMin,
          maxZ: cMax,
          minY: yA - 0.2,
          maxY: yTop,
        });
      } else {
        wallB.box(cMin, run.a0 - 0.14, cMax, run.a0, yA, yTop, metal);
        wallB.box(cMin, run.a1, cMax, run.a1 + 0.14, yA, yTop, metal);
        trimB.box(cMin, run.a0 - 0.1, cMax, run.a0 + 0.06, yA + 0.96, yB + 1.1, gold);
        trimB.box(cMin, run.a1 - 0.06, cMax, run.a1 + 0.1, yA + 0.96, yB + 1.1, gold);
        blockers.push({
          minX: cMin,
          maxX: cMax,
          minZ: run.a0 - 0.14,
          maxZ: run.a0,
          minY: yA - 0.2,
          maxY: yTop,
        });
        blockers.push({
          minX: cMin,
          maxX: cMax,
          minZ: run.a1,
          maxZ: run.a1 + 0.14,
          minY: yA - 0.2,
          maxY: yTop,
        });
      }
    }
  }

  const comb = new THREE.Color("#d8d4cc");
  if (run.axis === "z") {
    trimB.box(run.a0, run.bot - 0.2, run.a1, run.bot + 0.2, run.y0, run.y0 + 0.12, comb);
    trimB.box(run.a0, run.top - 0.2, run.a1, run.top + 0.2, run.y1, run.y1 + 0.12, comb);
  } else {
    trimB.box(run.bot - 0.2, run.a0, run.bot + 0.2, run.a1, run.y0, run.y0 + 0.12, comb);
    trimB.box(run.top - 0.2, run.a0, run.top + 0.2, run.a1, run.y1, run.y1 + 0.12, comb);
  }

  const tex = makeEscalatorTexture();
  tex.repeat.set(1, len / 0.36);
  const geo = new THREE.BufferGeometry();
  const positions = run.axis === "z" ? slopePositionsZ(run.a0, run.a1, run.bot, run.top, run.y0, run.y1) : slopePositionsX(run.bot, run.top, run.a0, run.a1, run.y0, run.y1);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.38,
    metalness: 0.42,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  disposables.push(geo, tex, mat);
  return { tex, scroll: run.up ? -0.72 : 0.72 };
}

function slopePositionsZ(x0: number, x1: number, zBot: number, zTop: number, y0: number, y1: number) {
  return new Float32Array([
    x0, y0 + 0.06, zBot,
    x1, y0 + 0.06, zBot,
    x1, y1 + 0.06, zTop,
    x0, y0 + 0.06, zBot,
    x1, y1 + 0.06, zTop,
    x0, y1 + 0.06, zTop,
  ]);
}

function slopePositionsX(xBot: number, xTop: number, z0: number, z1: number, y0: number, y1: number) {
  return new Float32Array([
    xBot, y0 + 0.06, z0,
    xBot, y0 + 0.06, z1,
    xTop, y1 + 0.06, z1,
    xBot, y0 + 0.06, z0,
    xTop, y1 + 0.06, z1,
    xTop, y1 + 0.06, z0,
  ]);
}

function makeEscalatorTexture() {
  const el = document.createElement("canvas");
  el.width = 64;
  el.height = 256;
  const ctx = el.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(el);
  for (let y = 0; y < 256; y += 28) {
    ctx.fillStyle = y % 56 === 0 ? "#2c2d32" : "#c4bfb4";
    ctx.fillRect(0, y, 64, 28);
    ctx.fillStyle = "#d8b44a";
    ctx.fillRect(0, y + 24, 64, 4);
    ctx.fillStyle = "#111214";
    ctx.fillRect(0, y, 4, 28);
    ctx.fillRect(60, y, 4, 28);
  }
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function addMallStores(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  glassB: MeshBuilder,
  blockers: Blocker[],
  wall: THREE.Color,
  gold: THREE.Color,
) {
  for (const bay of MALL_BAYS) {
    const y0 = bay.y0;
    const y1 = bay.y0 + MALL_STORE_H;
    const lintel = new THREE.Color(bay.color);
    const midZ = (bay.minZ + bay.maxZ) / 2;
    const midX = (bay.minX + bay.maxX) / 2;
    if (bay.front === "x+") {
      storefrontX(wallB, trimB, glassB, blockers, bay.maxX - 0.28, bay.maxX, bay.minZ, bay.maxZ, midZ - MALL_DOOR, midZ + MALL_DOOR, y0, y1, wall, lintel, gold);
      partition(wallB, blockers, bay.minX, bay.minZ - 0.28, bay.maxX, bay.minZ, y0, y1, wall);
      partition(wallB, blockers, bay.minX, bay.maxZ, bay.maxX, bay.maxZ + 0.28, y0, y1, wall);
    } else if (bay.front === "x-") {
      storefrontX(wallB, trimB, glassB, blockers, bay.minX, bay.minX + 0.28, bay.minZ, bay.maxZ, midZ - MALL_DOOR, midZ + MALL_DOOR, y0, y1, wall, lintel, gold);
      partition(wallB, blockers, bay.minX, bay.minZ - 0.28, bay.maxX, bay.minZ, y0, y1, wall);
      partition(wallB, blockers, bay.minX, bay.maxZ, bay.maxX, bay.maxZ + 0.28, y0, y1, wall);
    } else if (bay.front === "z-") {
      storefrontZ(wallB, trimB, glassB, blockers, bay.minX, bay.maxX, bay.minZ, bay.minZ + 0.28, midX - MALL_DOOR, midX + MALL_DOOR, y0, y1, wall, lintel, gold);
      partition(wallB, blockers, bay.maxX, bay.minZ, bay.maxX + 0.28, bay.maxZ, y0, y1, wall);
      partition(wallB, blockers, bay.minX - 0.28, bay.minZ, bay.minX, bay.maxZ, y0, y1, wall);
    } else {
      storefrontZ(wallB, trimB, glassB, blockers, bay.minX, bay.maxX, bay.maxZ - 0.28, bay.maxZ, midX - MALL_DOOR, midX + MALL_DOOR, y0, y1, wall, lintel, gold);
      partition(wallB, blockers, bay.maxX, bay.minZ, bay.maxX + 0.28, bay.maxZ, y0, y1, wall);
      partition(wallB, blockers, bay.minX - 0.28, bay.minZ, bay.minX, bay.maxZ, y0, y1, wall);
    }
  }
  partition(wallB, blockers, -4.2, -MALL_SHOP - 0.28, 4.2, -MALL_SHOP, 0, MALL_STORE_H, wall);
  partition(wallB, blockers, -6.2, MALL_SHOP, 6.2, MALL_SHOP + 0.28, MALL_L2, MALL_L2 + MALL_STORE_H, wall);
  partition(wallB, blockers, -6.2, MALL_SHOP, 6.2, MALL_SHOP + 0.28, MALL_L3, MALL_L3 + MALL_STORE_H, wall);
  partition(wallB, blockers, -61.4, -2.6, -MALL_SHOP, 2.6, 0, MALL_STORE_H, wall);
  partition(wallB, blockers, MALL_SHOP, -2.6, 61.4, 2.6, 0, MALL_STORE_H, wall);
}

function storefrontX(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  glassB: MeshBuilder,
  blockers: Blocker[],
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  doorZ0: number,
  doorZ1: number,
  y0: number,
  y1: number,
  wall: THREE.Color,
  lintel: THREE.Color,
  gold: THREE.Color,
) {
  const doorTop = y0 + 4.25;
  wallB.box(x0, z0, x1, doorZ0, y0, y1, wall);
  wallB.box(x0, doorZ1, x1, z1, y0, y1, wall);
  wallB.box(x0, doorZ0, x1, doorZ1, doorTop, y1, wall);
  blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: doorZ0, minY: y0, maxY: y1 });
  blockers.push({ minX: x0, maxX: x1, minZ: doorZ1, maxZ: z1, minY: y0, maxY: y1 });
  trimB.box(x0 - 0.1, z0, x1 + 0.1, z1, y1 - 0.6, y1, lintel);
  trimB.box(x0 - 0.06, doorZ0 - 0.12, x1 + 0.06, doorZ0, y0, doorTop, gold);
  trimB.box(x0 - 0.06, doorZ1, x1 + 0.06, doorZ1 + 0.12, y0, doorTop, gold);
  const gx = (x0 + x1) / 2;
  glassPaneX(glassB, gx, z0 + 0.35, doorZ0 - 0.2, y0 + 0.7, doorTop - 0.4);
  glassPaneX(glassB, gx, doorZ1 + 0.2, z1 - 0.35, y0 + 0.7, doorTop - 0.4);
}

function storefrontZ(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  glassB: MeshBuilder,
  blockers: Blocker[],
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  doorX0: number,
  doorX1: number,
  y0: number,
  y1: number,
  wall: THREE.Color,
  lintel: THREE.Color,
  gold: THREE.Color,
) {
  const doorTop = y0 + 4.25;
  wallB.box(x0, z0, doorX0, z1, y0, y1, wall);
  wallB.box(doorX1, z0, x1, z1, y0, y1, wall);
  wallB.box(doorX0, z0, doorX1, z1, doorTop, y1, wall);
  blockers.push({ minX: x0, maxX: doorX0, minZ: z0, maxZ: z1, minY: y0, maxY: y1 });
  blockers.push({ minX: doorX1, maxX: x1, minZ: z0, maxZ: z1, minY: y0, maxY: y1 });
  trimB.box(x0, z0 - 0.1, x1, z1 + 0.1, y1 - 0.6, y1, lintel);
  trimB.box(doorX0 - 0.12, z0 - 0.06, doorX0, z1 + 0.06, y0, doorTop, gold);
  trimB.box(doorX1, z0 - 0.06, doorX1 + 0.12, z1 + 0.06, y0, doorTop, gold);
  const gz = (z0 + z1) / 2;
  glassPaneZ(glassB, gz, x0 + 0.35, doorX0 - 0.2, y0 + 0.7, doorTop - 0.4);
  glassPaneZ(glassB, gz, doorX1 + 0.2, x1 - 0.35, y0 + 0.7, doorTop - 0.4);
}

function partition(
  wallB: MeshBuilder,
  blockers: Blocker[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  y1: number,
  wall: THREE.Color,
) {
  wallB.box(x0, z0, x1, z1, y0, y1, wall);
  blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y0, maxY: y1 });
}

function furnishMallStores(wallB: MeshBuilder, trimB: MeshBuilder, blockers: Blocker[], gold: THREE.Color) {
  for (const bay of MALL_BAYS) {
    const cloth = new THREE.Color(bay.color);
    const midX = (bay.minX + bay.maxX) / 2;
    const midZ = (bay.minZ + bay.maxZ) / 2;
    if (bay.front === "z+") {
      rackRow(trimB, blockers, midX - 6.4, midZ - 4.2, midX - 0.4, bay.y0, cloth, gold);
      rackRow(trimB, blockers, midX + 0.4, midZ - 4.2, midX + 6.4, bay.y0, cloth, gold);
      mannequin(wallB, trimB, blockers, midX, midZ + 2.4, bay.y0, cloth, gold);
    } else if (bay.front === "z-") {
      rackRow(trimB, blockers, midX - 6.4, midZ + 1.6, midX - 0.4, bay.y0, cloth, gold);
      rackRow(trimB, blockers, midX + 0.4, midZ + 1.6, midX + 6.4, bay.y0, cloth, gold);
      mannequin(wallB, trimB, blockers, midX, midZ - 2.2, bay.y0, cloth, gold);
    } else {
      const x0 = Math.min(bay.minX, bay.maxX) + 2.2;
      const x1 = Math.max(bay.minX, bay.maxX) - 2.2;
      rackRow(trimB, blockers, x0, midZ - 5.4, x1, bay.y0, cloth, gold);
      rackRow(trimB, blockers, x0, midZ + 2.2, x1, bay.y0, cloth, gold);
      mannequin(wallB, trimB, blockers, midX, midZ, bay.y0, cloth, gold);
    }
  }
}

function addFoodCourt(
  group: THREE.Group,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  disposables: Array<{ dispose: () => void }>,
  wall: THREE.Color,
  gold: THREE.Color,
  stone: THREE.Color,
) {
  const wood = new THREE.Color("#6b4a32");
  const teal = new THREE.Color("#1a6b6b");
  const y = MALL_L3;
  trimB.ground(-44.8, 12.6, 44.8, 44.6, y + 0.04, stone);
  trimB.box(-8.2, 33.8, 8.2, 36.9, y, y + 1.18, teal);
  trimB.box(-8.0, 33.95, 8.0, 36.75, y + 1.18, y + 1.28, gold);
  blockers.push({ minX: -8.2, maxX: 8.2, minZ: 33.8, maxZ: 36.9, minY: y, maxY: y + 1.35 });
  addMallSign(group, disposables, "FOOD COURT", "Press E · burgers · dogs · nachos · drinks", "#1a6b6b", 0, y + 3.55, 35.4, Math.PI, 12.2);
  for (const [x, z] of [
    [-34.6, 18.4],
    [-24.4, 18.4],
    [-14.2, 18.4],
    [-34.6, 25.6],
    [-24.4, 25.6],
    [-14.2, 25.6],
    [11.4, 18.4],
    [21.6, 18.4],
    [31.8, 18.4],
    [11.4, 25.6],
    [21.6, 25.6],
    [31.8, 25.6],
  ]) {
    trimB.box(x, z, x + 2.8, z + 2.8, y, y + 0.78, wood);
    trimB.box(x + 0.15, z + 0.15, x + 2.65, z + 2.65, y + 0.78, y + 0.86, gold);
    blockers.push({ minX: x, maxX: x + 2.8, minZ: z, maxZ: z + 2.8, minY: y, maxY: y + 1.1 });
  }
  for (const x of [-8.4, -2.8, 1.0, 6.6]) {
    trimB.box(x, 31.2, x + 1.8, 32.2, y, y + 0.48, stone);
    blockers.push({ minX: x, maxX: x + 1.8, minZ: 31.2, maxZ: 32.2, minY: y, maxY: y + 0.7 });
  }
  wallB.box(-0.32, 31.4, 0.32, 32.0, y, y + 1.15, wall);
}

function addConcourseProps(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  gold: THREE.Color,
  leaf: THREE.Color,
  stone: THREE.Color,
) {
  for (const [x, z] of [
    [-32.6, -32.6],
    [30.8, -32.6],
    [-32.6, 31.4],
    [30.8, 31.4],
    [-26.2, 24.8],
    [24.6, 24.8],
    [-26.2, -25.4],
    [24.6, -25.4],
  ]) {
    wallB.box(x, z, x + 2.2, z + 2.2, 0, 0.55, stone);
    trimB.box(x + 0.22, z + 0.22, x + 1.98, z + 1.98, 0.55, 1.55, leaf);
    blockers.push({ minX: x, maxX: x + 2.2, minZ: z, maxZ: z + 2.2, maxY: 1.7 });
  }
  for (const [x, z] of [
    [-33.4, 8.2],
    [31.6, 8.2],
    [-33.4, -10.8],
    [31.6, -10.8],
  ]) {
    trimB.box(x, z, x + 3.2, z + 0.8, 0, 0.42, gold);
    blockers.push({ minX: x, maxX: x + 3.2, minZ: z, maxZ: z + 0.8, maxY: 0.6 });
  }
  for (const [x, z] of [
    [-24.6, 36.2],
    [22.8, 36.2],
    [0.0, -32.8],
  ]) {
    wallB.box(x, z, x + 0.7, z + 0.7, 0, MALL_CEIL, stone);
    blockers.push({ minX: x, maxX: x + 0.7, minZ: z, maxZ: z + 0.7 });
  }
}

function addDirectory(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  gold: THREE.Color,
  marble: THREE.Color,
) {
  trimB.box(-10.8, 50.4, -4.2, 54.2, 0, 1.12, gold);
  wallB.box(-10.55, 50.6, -4.45, 53.95, 1.12, 1.85, marble);
  trimB.box(-10.9, 50.3, -4.1, 54.3, 1.85, 2.05, gold);
  blockers.push({ minX: -10.8, maxX: -4.2, minZ: 50.4, maxZ: 54.2, maxY: 2.2 });
}

function hutBox(hut: (typeof SNACK_HUTS)[number]) {
  const hw = HUT_W / 2;
  if (hut.face === "z-") return { minX: hut.x - hw, maxX: hut.x + hw, minZ: hut.z, maxZ: hut.z + HUT_D };
  if (hut.face === "z+") return { minX: hut.x - hw, maxX: hut.x + hw, minZ: hut.z - HUT_D, maxZ: hut.z };
  if (hut.face === "x+") return { minX: hut.x - HUT_D, maxX: hut.x, minZ: hut.z - hw, maxZ: hut.z + hw };
  return { minX: hut.x, maxX: hut.x + HUT_D, minZ: hut.z - hw, maxZ: hut.z + hw };
}

function inFoodCourt(x: number, z: number, feetY: number) {
  if (feetY < MALL_L3 - 0.7 || feetY > MALL_L3 + 2.4) return false;
  return x > -42 && x < 42 && z > 15.5 && z < 44;
}

function inHutServe(hut: (typeof SNACK_HUTS)[number], x: number, z: number, feetY: number) {
  if (feetY < hut.y0 - 0.6 || feetY > hut.y0 + 2.2) return false;
  const hw = HUT_W / 2 + 0.85;
  const reach = 3.2;
  if (hut.face === "z-") return x >= hut.x - hw && x <= hut.x + hw && z >= hut.z - reach && z <= hut.z + 0.85;
  if (hut.face === "z+") return x >= hut.x - hw && x <= hut.x + hw && z >= hut.z - 0.85 && z <= hut.z + reach;
  if (hut.face === "x+") return z >= hut.z - hw && z <= hut.z + hw && x >= hut.x - reach && x <= hut.x + 0.85;
  return z >= hut.z - hw && z <= hut.z + hw && x >= hut.x - 0.85 && x <= hut.x + reach;
}

function addSnackHuts(
  group: THREE.Group,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  disposables: Array<{ dispose: () => void }>,
  gold: THREE.Color,
) {
  const cream = new THREE.Color("#f4efe6");
  for (const hut of SNACK_HUTS) {
    const b = hutBox(hut);
    const cloth = new THREE.Color(hut.color);
    const y0 = hut.y0;
    const y1 = y0 + HUT_H;
    const door = 1.35;
    wallB.box(b.minX, b.minZ, b.maxX, b.maxZ, y0, y0 + 0.08, cream);
    if (hut.face === "z-" || hut.face === "z+") {
      const frontZ0 = hut.face === "z-" ? b.minZ : b.maxZ - 0.16;
      const frontZ1 = hut.face === "z-" ? b.minZ + 0.16 : b.maxZ;
      const backZ0 = hut.face === "z-" ? b.maxZ - 0.16 : b.minZ;
      const backZ1 = hut.face === "z-" ? b.maxZ : b.minZ + 0.16;
      wallB.box(b.minX, backZ0, b.maxX, backZ1, y0, y1, cloth);
      wallB.box(b.minX, b.minZ, b.minX + 0.16, b.maxZ, y0, y1, cloth);
      wallB.box(b.maxX - 0.16, b.minZ, b.maxX, b.maxZ, y0, y1, cloth);
      wallB.box(b.minX, frontZ0, hut.x - door, frontZ1, y0, y1, cloth);
      wallB.box(hut.x + door, frontZ0, b.maxX, frontZ1, y0, y1, cloth);
      wallB.box(hut.x - door, frontZ0, hut.x + door, frontZ1, y0 + 2.05, y1, cloth);
      trimB.box(hut.x - door, frontZ0 - 0.12, hut.x + door, frontZ1 + 0.12, y0 + 1.02, y0 + 1.16, gold);
      blockers.push({ minX: b.minX, maxX: b.maxX, minZ: backZ0, maxZ: backZ1, minY: y0, maxY: y1 });
      blockers.push({ minX: b.minX, maxX: b.minX + 0.16, minZ: b.minZ, maxZ: b.maxZ, minY: y0, maxY: y1 });
      blockers.push({ minX: b.maxX - 0.16, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, minY: y0, maxY: y1 });
      blockers.push({ minX: b.minX, maxX: hut.x - door, minZ: frontZ0, maxZ: frontZ1, minY: y0, maxY: y1 });
      blockers.push({ minX: hut.x + door, maxX: b.maxX, minZ: frontZ0, maxZ: frontZ1, minY: y0, maxY: y1 });
    } else {
      const frontX0 = hut.face === "x+" ? b.maxX - 0.16 : b.minX;
      const frontX1 = hut.face === "x+" ? b.maxX : b.minX + 0.16;
      const backX0 = hut.face === "x+" ? b.minX : b.maxX - 0.16;
      const backX1 = hut.face === "x+" ? b.minX + 0.16 : b.maxX;
      wallB.box(backX0, b.minZ, backX1, b.maxZ, y0, y1, cloth);
      wallB.box(b.minX, b.minZ, b.maxX, b.minZ + 0.16, y0, y1, cloth);
      wallB.box(b.minX, b.maxZ - 0.16, b.maxX, b.maxZ, y0, y1, cloth);
      wallB.box(frontX0, b.minZ, frontX1, hut.z - door, y0, y1, cloth);
      wallB.box(frontX0, hut.z + door, frontX1, b.maxZ, y0, y1, cloth);
      wallB.box(frontX0, hut.z - door, frontX1, hut.z + door, y0 + 2.05, y1, cloth);
      trimB.box(frontX0 - 0.12, hut.z - door, frontX1 + 0.12, hut.z + door, y0 + 1.02, y0 + 1.16, gold);
      blockers.push({ minX: backX0, maxX: backX1, minZ: b.minZ, maxZ: b.maxZ, minY: y0, maxY: y1 });
      blockers.push({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.minZ + 0.16, minY: y0, maxY: y1 });
      blockers.push({ minX: b.minX, maxX: b.maxX, minZ: b.maxZ - 0.16, maxZ: b.maxZ, minY: y0, maxY: y1 });
      blockers.push({ minX: frontX0, maxX: frontX1, minZ: b.minZ, maxZ: hut.z - door, minY: y0, maxY: y1 });
      blockers.push({ minX: frontX0, maxX: frontX1, minZ: hut.z + door, maxZ: b.maxZ, minY: y0, maxY: y1 });
    }
    trimB.gable(b.minX - 0.12, b.minZ - 0.12, b.maxX + 0.12, b.maxZ + 0.12, y1, 0.92, cloth, hut.face === "x+" || hut.face === "x-" ? "z" : "x");
    const midX = (b.minX + b.maxX) / 2;
    const midZ = (b.minZ + b.maxZ) / 2;
    const signY = y0 + 3.35;
    if (hut.face === "x+") addMallSign(group, disposables, hut.name, hut.blurb, hut.color, b.maxX + 0.06, signY, midZ, Math.PI / 2, 4.2);
    else if (hut.face === "x-") addMallSign(group, disposables, hut.name, hut.blurb, hut.color, b.minX - 0.06, signY, midZ, -Math.PI / 2, 4.2);
    else if (hut.face === "z-") addMallSign(group, disposables, hut.name, hut.blurb, hut.color, midX, signY, b.minZ - 0.06, Math.PI, 4.2);
    else addMallSign(group, disposables, hut.name, hut.blurb, hut.color, midX, signY, b.maxZ + 0.06, 0, 4.2);
  }
}

function glassPaneX(glassB: MeshBuilder, x: number, z0: number, z1: number, y0: number, y1: number) {
  if (z1 - z0 < 0.4) return;
  glassB.quad(
    { x, y: y0, z: z1 },
    { x, y: y0, z: z0 },
    { x, y: y1, z: z0 },
    { x, y: y1, z: z1 },
    new THREE.Color("#e8f4fb"),
  );
}

function glassPaneZ(glassB: MeshBuilder, z: number, x0: number, x1: number, y0: number, y1: number) {
  if (x1 - x0 < 0.4) return;
  glassB.quad(
    { x: x0, y: y0, z },
    { x: x1, y: y0, z },
    { x: x1, y: y1, z },
    { x: x0, y: y1, z },
    new THREE.Color("#e8f4fb"),
  );
}

function glassQuad(glassB: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, color: THREE.Color) {
  glassB.quad(
    { x: x0, y, z: z0 },
    { x: x1, y, z: z0 },
    { x: x1, y, z: z1 },
    { x: x0, y, z: z1 },
    color,
  );
}

function addGlassMesh(group: THREE.Group, glassB: MeshBuilder, disposables: Array<{ dispose: () => void }>) {
  if (glassB.empty) return;
  const geometry = glassB.build();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: "#f2f8fc",
    transparent: true,
    opacity: 0.05,
    roughness: 0.08,
    metalness: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  disposables.push(geometry, material);
}

function addMallSign(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  title: string,
  subtitle: string,
  bg: string,
  x: number,
  y: number,
  z: number,
  rotY: number,
  width: number,
) {
  const el = document.createElement("canvas");
  el.width = 768;
  el.height = 192;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 768, 192);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, 768, 16);
  ctx.fillRect(0, 176, 768, 16);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "bold 58px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, 384, 78);
  ctx.font = "28px sans-serif";
  ctx.fillStyle = "#e8dcc8";
  ctx.fillText(subtitle, 384, 138);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.55,
    roughness: 0.48,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(width, 1.05);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  group.add(mesh);
  disposables.push(geo, tex, mat);
}

function rackRow(
  trimB: MeshBuilder,
  blockers: Blocker[],
  x0: number,
  z: number,
  x1: number,
  y0: number,
  cloth: THREE.Color,
  rail: THREE.Color,
) {
  const width = x1 - x0;
  trimB.box(x0, z, x1, z + 0.55, y0 + 1.05, y0 + 1.18, rail);
  trimB.box(x0, z + 0.08, x1, z + 0.47, y0 + 0.2, y0 + 1.05, cloth);
  blockers.push({ minX: x0, maxX: x1, minZ: z, maxZ: z + 0.55, minY: y0, maxY: y0 + 1.8 });
  trimB.box(x0 + width * 0.12, z + 2.1, x1 - width * 0.12, z + 2.55, y0 + 0.2, y0 + 1.7, cloth);
  blockers.push({
    minX: x0 + width * 0.12,
    maxX: x1 - width * 0.12,
    minZ: z + 2.1,
    maxZ: z + 2.55,
    minY: y0,
    maxY: y0 + 1.8,
  });
}

function mannequin(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  x: number,
  z: number,
  y0: number,
  cloth: THREE.Color,
  stand: THREE.Color,
) {
  trimB.box(x - 0.28, z - 0.28, x + 0.28, z + 0.28, y0, y0 + 0.12, stand);
  wallB.box(x - 0.18, z - 0.14, x + 0.18, z + 0.14, y0 + 0.12, y0 + 1.05, cloth);
  wallB.box(x - 0.16, z - 0.16, x + 0.16, z + 0.16, y0 + 1.05, y0 + 1.38, new THREE.Color("#e0c2a2"));
  blockers.push({ minX: x - 0.32, maxX: x + 0.32, minZ: z - 0.32, maxZ: z + 0.32, minY: y0, maxY: y0 + 1.6 });
}

function furnish(
  role: VenueRole,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  furn: THREE.Color,
  accent: THREE.Color,
  trim: THREE.Color,
) {
  if (role === "hospital") {
    for (const x of [-8.4, -4.6, -0.8, 3.0]) {
      trimB.box(x, 1.2, x + 3.2, 3.6, 0, 0.55, furn);
      wallB.box(x + 0.15, 1.35, x + 3.05, 3.4, 0.55, 0.95, new THREE.Color("#f4f1ea"));
      blockers.push({ minX: x, maxX: x + 3.2, minZ: 1.2, maxZ: 3.6 });
    }
    trimB.box(6.2, -2.4, 10.2, 2.8, 0, 1.1, furn);
    blockers.push({ minX: 6.2, maxX: 10.2, minZ: -2.4, maxZ: 2.8 });
  } else if (role === "school") {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const x = -8 + col * 4;
        const z = -1.2 + row * 3.2;
        trimB.box(x, z, x + 2.4, z + 1.5, 0, 0.78, furn);
        blockers.push({ minX: x, maxX: x + 2.4, minZ: z, maxZ: z + 1.5 });
      }
    }
    trimB.box(-9.2, 8.2, 9.2, 9.4, 0.9, 2.4, accent);
  } else if (role === "city_hall") {
    trimB.box(-8.8, 1.4, 8.8, 8.6, 0, 0.42, furn);
    for (const x of [-6.4, -2.1, 2.1, 6.4]) {
      wallB.box(x - 0.7, 2.2, x + 0.7, 3.6, 0.42, 1.05, trim);
    }
    blockers.push({ minX: -8.8, maxX: 8.8, minZ: 1.4, maxZ: 8.6 });
  } else if (role === "police") {
    trimB.box(5.6, -2.8, 10.2, 4.4, 0, 2.4, furn);
    trimB.box(5.85, -0.2, 6.15, 1.8, 0.4, 2.1, accent);
    blockers.push({ minX: 5.6, maxX: 10.2, minZ: -2.8, maxZ: 4.4 });
    for (const x of [-8, -4.2, -0.4]) {
      wallB.box(x, 2.2, x + 2.8, 4.4, 0, 1.05, trim);
      blockers.push({ minX: x, maxX: x + 2.8, minZ: 2.2, maxZ: 4.4 });
    }
  } else if (role === "fire") {
    trimB.box(-9.4, 0.6, 4.8, 8.8, 0, 0.12, accent);
    trimB.box(-8.6, 1.4, -1.2, 7.6, 0.12, 1.55, furn);
    blockers.push({ minX: -8.6, maxX: -1.2, minZ: 1.4, maxZ: 7.6 });
    wallB.box(6.2, 1.2, 10.2, 8.4, 0, 2.1, trim);
    blockers.push({ minX: 6.2, maxX: 10.2, minZ: 1.2, maxZ: 8.4 });
  } else if (role === "office") {
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 2; row++) {
        const x = -8.6 + col * 5.8;
        const z = 0.4 + row * 4.2;
        trimB.box(x, z, x + 4.6, z + 3.4, 0, 1.12, furn);
        blockers.push({ minX: x, maxX: x + 4.6, minZ: z, maxZ: z + 3.4 });
      }
    }
  } else if (role === "shop") {
    for (const z of [-1.6, 2.2, 6.0]) {
      trimB.box(-9.4, z, -5.2, z + 1.4, 0, 1.7, furn);
      trimB.box(5.2, z, 9.4, z + 1.4, 0, 1.7, furn);
      blockers.push({ minX: -9.4, maxX: -5.2, minZ: z, maxZ: z + 1.4 });
      blockers.push({ minX: 5.2, maxX: 9.4, minZ: z, maxZ: z + 1.4 });
    }
  } else if (role === "restaurant") {
    for (const [x, z] of [
      [-7.4, 1.2],
      [-2.6, 1.2],
      [2.2, 1.2],
      [-7.4, 5.4],
      [-2.6, 5.4],
      [2.2, 5.4],
    ]) {
      trimB.box(x, z, x + 2.6, z + 2.6, 0, 0.78, furn);
      blockers.push({ minX: x, maxX: x + 2.6, minZ: z, maxZ: z + 2.6 });
    }
    wallB.box(6.6, -2.2, 10.3, 8.6, 0, 1.15, accent);
    blockers.push({ minX: 6.6, maxX: 10.3, minZ: -2.2, maxZ: 8.6 });
  } else if (role === "bank") {
    for (const x of [-8.2, -3.6, 1.0]) {
      trimB.box(x, 1.6, x + 3.6, 3.4, 0, 1.18, furn);
      blockers.push({ minX: x, maxX: x + 3.6, minZ: 1.6, maxZ: 3.4 });
    }
    trimB.box(5.8, 0.8, 10.2, 8.4, 0, 2.6, accent);
    blockers.push({ minX: 5.8, maxX: 10.2, minZ: 0.8, maxZ: 8.4 });
  } else {
    wallB.box(-10.2, 1.2, -4.4, 7.8, 0, 0.48, furn);
    wallB.box(-10.2, 1.2, -9.4, 4.2, 0.48, 1.15, furn);
    blockers.push({ minX: -10.2, maxX: -4.4, minZ: 1.2, maxZ: 7.8 });
    trimB.box(3.4, 1.6, 9.6, 5.8, 0, 0.78, trim);
    blockers.push({ minX: 3.4, maxX: 9.6, minZ: 1.6, maxZ: 5.8 });
    wallB.box(5.6, 6.4, 9.8, 9.6, 0, 1.05, furn);
    blockers.push({ minX: 5.6, maxX: 9.8, minZ: 6.4, maxZ: 9.6 });
  }
}

function addCeiling(
  builder: MeshBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  color: THREE.Color,
) {
  builder.quad(
    { x: x0, y, z: z0 },
    { x: x1, y, z: z0 },
    { x: x1, y, z: z1 },
    { x: x0, y, z: z1 },
    color,
  );
}

function addSkylightGrid(trimB: MeshBuilder, ceilY: number, rib: THREE.Color) {
  const s = MALL_SKY;
  const y0 = ceilY - 0.08;
  const y1 = ceilY + 0.62;
  for (let i = -3; i <= 3; i++) {
    const x = (i / 3) * s;
    trimB.box(x - 0.12, -s, x + 0.12, s, y0, y1, rib);
    trimB.box(-s, x - 0.12, s, x + 0.12, y0, y1, rib);
  }
  trimB.box(-s - 0.2, -s - 0.2, s + 0.2, s + 0.2, ceilY + 0.5, ceilY + 0.72, rib);
}

function assemble(
  group: THREE.Group,
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  disposables: Array<{ dispose: () => void }>,
  mall = false,
) {
  const add = (builder: MeshBuilder, material: THREE.MeshStandardMaterial) => {
    if (builder.empty) {
      material.dispose();
      return;
    }
    const geometry = builder.build();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
    disposables.push(geometry, material);
  };
  add(
    floorB,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: mall ? 0.38 : 0.58,
      metalness: mall ? 0.08 : 0,
      polygonOffset: mall,
      polygonOffsetFactor: mall ? -2 : 0,
      polygonOffsetUnits: mall ? -2 : 0,
    }),
  );
  add(wallB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: mall ? 0.62 : 0.74 }));
  add(
    trimB,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: mall ? 0.28 : 0.42,
      metalness: mall ? 0.34 : 0.16,
      emissive: new THREE.Color(mall ? "#f4f7fb" : "#ffd9a0"),
      emissiveIntensity: mall ? 0.06 : 0.08,
    }),
  );
}
