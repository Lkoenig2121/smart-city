import * as THREE from "three";
import type { Building } from "@/lib/city/types";
import type { ClothStore } from "@/lib/city/clothing";
import { venueRole, type VenueRole } from "@/lib/city/venues";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";

export interface VenueInterior {
  group: THREE.Group;
  blockers: Blocker[];
  spawn: { x: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  groundAt: (x: number, z: number) => number;
  nearDesk: (x: number, z: number) => boolean;
  nearExit: (x: number, z: number) => boolean;
  nearStore?: (x: number, z: number) => ClothStore | null;
  update?: (dt: number) => void;
  rideAt?: (x: number, z: number) => { x: number; z: number } | null;
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
  mall: { floor: "#d8cfc4", wall: "#f4efe6", trim: "#c9a44c", accent: "#6a3a32", furniture: "#5a3d28" },
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

const MALL_BAYS: {
  id: ClothStore;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  color: string;
  name: string;
  blurb: string;
}[] = [
  { id: "fashion", minX: -35.45, maxX: -21.2, minZ: -16.2, maxZ: 16.2, color: "#c45c4a", name: "Fashion Avenue", blurb: "Jackets · shirts" },
  { id: "sneaker", minX: 21.2, maxX: 35.45, minZ: -16.2, maxZ: 16.2, color: "#2aa3a0", name: "Sneaker District", blurb: "Kicks · athletic" },
  { id: "luxury", minX: -35.45, maxX: -2.4, minZ: -35.45, maxZ: -21.2, color: "#1a1206", name: "Luxury Boutique", blurb: "Premium cuts" },
  { id: "department", minX: 2.4, maxX: 35.45, minZ: -35.45, maxZ: -21.2, color: "#2f5d4a", name: "Department Store", blurb: "Bags · basics" },
];

const MALL_MIN = -36;
const MALL_MAX = 36;
const MALL_CEIL = 15.2;
const MALL_L2 = 5.2;
const MALL_L3 = 10.4;
const MALL_POOL = 9.2;
const MALL_HOLE = 2.2;
const MALL_L3_R = 5.55;
const MALL_DOOR = 2.45;

const ESC1 = {
  xUp0: -3.18,
  xUp1: -0.16,
  xDn0: 0.16,
  xDn1: 3.18,
  zTop: 9.08,
  zBot: 16.55,
  speed: 1.38,
};

const ESC2 = {
  xUp0: -3.18,
  xUp1: -0.16,
  xDn0: 0.16,
  xDn1: 3.18,
  zTop: -2.38,
  zBot: -9.08,
  speed: 1.22,
};

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
  const marble = new THREE.Color("#ece6dc");
  const gold = new THREE.Color("#c9a44c");
  const cream = new THREE.Color("#f7f1e8");
  const water = new THREE.Color("#7eb3c9");
  const leaf = new THREE.Color("#3e8244");
  const stone = new THREE.Color("#cfc6b8");
  const glass = new THREE.Color("#c5e4f4");

  floorB.ground(minX, minZ, maxX, maxZ, 0, floor);
  floorB.ground(-18, -18, 18, 22, 0.02, marble);
  addCeiling(floorB, minX, minZ, maxX, -9.6, ceilY, cream);
  addCeiling(floorB, minX, 9.6, maxX, maxZ, ceilY, cream);
  addCeiling(floorB, minX, -9.6, -9.6, 9.6, ceilY, cream);
  addCeiling(floorB, 9.6, -9.6, maxX, 9.6, ceilY, cream);
  addCeiling(floorB, -9.6, -9.6, 9.6, 9.6, ceilY + 0.42, new THREE.Color("#fff6e4"));
  glassQuad(glassB, -9.2, -9.2, 9.2, 9.2, ceilY - 0.08, glass);

  const t = 0.55;
  blockers.push({ minX, maxX: minX + t, minZ, maxZ });
  blockers.push({ minX: maxX - t, maxX, minZ, maxZ });
  blockers.push({ minX, maxX, minZ, maxZ: minZ + t });
  blockers.push({ minX, maxX: -MALL_DOOR - 0.2, minZ: maxZ - t, maxZ });
  blockers.push({ minX: MALL_DOOR + 0.2, maxX, minZ: maxZ - t, maxZ });
  addCurtainWall(wallB, trimB, glassB, minX, maxX, minZ, maxZ, ceilY, t, wall, gold, stone);
  wallB.box(-MALL_DOOR - 0.2, maxZ - t, MALL_DOOR + 0.2, maxZ, 3.15, ceilY, wall);
  trimB.box(-MALL_DOOR - 0.45, maxZ - 0.7, MALL_DOOR + 0.45, maxZ + 0.08, 3.15, 3.42, gold);

  addAtrium(floorB, wallB, trimB, blockers, marble, gold, water, stone, ceilY);
  addGalleries(floorB, wallB, trimB, glassB, blockers, marble, gold);
  const belts = addMallEscalators(group, wallB, trimB, blockers, disposables, gold);
  addMallStores(wallB, trimB, glassB, blockers, wall, gold);
  furnishMallStores(wallB, trimB, blockers, gold);
  addFoodCourt(wallB, trimB, blockers, wall, gold, stone);
  addConcourseProps(wallB, trimB, blockers, gold, leaf, stone);
  addDirectory(wallB, trimB, blockers, gold, marble);

  for (const bay of MALL_BAYS) {
    const midX = (bay.minX + bay.maxX) / 2;
    if (bay.id === "fashion") addMallSign(group, disposables, bay.name, bay.blurb, bay.color, -21.05, 3.55, 0, Math.PI / 2, 6.4);
    else if (bay.id === "sneaker") addMallSign(group, disposables, bay.name, bay.blurb, bay.color, 21.05, 3.55, 0, -Math.PI / 2, 6.4);
    else addMallSign(group, disposables, bay.name, bay.blurb, bay.color, midX, 3.55, -21.05, 0, 7.2);
  }
  addMallSign(group, disposables, "HARBOR MALL", "Three floors · Stores · Food court", "#6a3a32", 0, 4.05, 35.2, Math.PI, 8.8);
  addMallSign(group, disposables, "HARBOR MALL", "Atrium galleries", "#6a3a32", 0, 14.05, 0, 0, 7.6);

  assemble(group, floorB, wallB, trimB, disposables);
  addGlassMesh(group, glassB, disposables);

  return {
    group,
    blockers,
    spawn: { x: 0, z: 32.8, yaw: 0, pitch: -0.06 },
    bounds: { minX, maxX, minZ, maxZ },
    groundAt: mallGroundAt,
    nearDesk: (x, z) => x > -7.4 && x < -2.2 && z > 25.8 && z < 30.4,
    nearExit: (x, z) => z > 33.7 && Math.abs(x) < 3.2,
    nearStore: (x, z) => {
      const bay = MALL_BAYS.find((item) => x >= item.minX && x <= item.maxX && z >= item.minZ && z <= item.maxZ);
      return bay?.id ?? null;
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

function mallGroundAt(x: number, z: number) {
  if (x >= ESC1.xUp0 && x <= ESC1.xDn1 && z >= ESC1.zTop && z <= ESC1.zBot) {
    const t = (ESC1.zBot - z) / (ESC1.zBot - ESC1.zTop);
    return THREE.MathUtils.clamp(t * MALL_L2, 0, MALL_L2);
  }
  if (x >= ESC2.xUp0 && x <= ESC2.xDn1 && z >= ESC2.zBot && z <= ESC2.zTop) {
    const t = (z - ESC2.zBot) / (ESC2.zTop - ESC2.zBot);
    return THREE.MathUtils.clamp(MALL_L2 + t * (MALL_L3 - MALL_L2), MALL_L2, MALL_L3);
  }
  const r = Math.max(Math.abs(x), Math.abs(z));
  if (r < MALL_HOLE) return 0;
  if (r <= MALL_L3_R) return MALL_L3;
  if (r <= MALL_POOL) return MALL_L2;
  return 0;
}

function mallRideAt(x: number, z: number) {
  if (z >= ESC1.zTop && z <= ESC1.zBot) {
    if (x >= ESC1.xUp0 && x <= ESC1.xUp1) return { x: 0, z: ESC1.speed };
    if (x >= ESC1.xDn0 && x <= ESC1.xDn1) return { x: 0, z: -ESC1.speed };
  }
  if (z >= ESC2.zBot && z <= ESC2.zTop) {
    if (x >= ESC2.xUp0 && x <= ESC2.xUp1) return { x: 0, z: -ESC2.speed };
    if (x >= ESC2.xDn0 && x <= ESC2.xDn1) return { x: 0, z: ESC2.speed };
  }
  return null;
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
  const p = MALL_POOL;
  floorB.ground(-p, -p, p, p, 0.06, water);
  trimB.box(-p, -p, p, p, 0, 0.42, stone);
  blockers.push({ minX: -p, maxX: p, minZ: -p, maxZ: p, maxY: 0.95 });
  trimB.box(-1.7, -1.7, 1.7, 1.7, 0.06, 0.62, gold);
  wallB.box(-0.55, -0.55, 0.55, 0.55, 0.62, 1.55, marble);
  trimB.box(-0.18, -0.18, 0.18, 0.18, 1.55, 2.35, gold);
  blockers.push({ minX: -1.7, maxX: 1.7, minZ: -1.7, maxZ: 1.7, maxY: 2.4 });
  for (const [x, z] of [
    [-p + 0.55, -p + 0.55],
    [p - 0.55, -p + 0.55],
    [-p + 0.55, p - 0.55],
    [p - 0.55, p - 0.55],
  ]) {
    wallB.box(x - 0.38, z - 0.38, x + 0.38, z + 0.38, 0, ceilY, stone);
    trimB.box(x - 0.48, z - 0.48, x + 0.48, z + 0.48, MALL_L2 - 0.12, MALL_L2 + 0.18, gold);
    trimB.box(x - 0.48, z - 0.48, x + 0.48, z + 0.48, MALL_L3 - 0.12, MALL_L3 + 0.18, gold);
    trimB.box(x - 0.48, z - 0.48, x + 0.48, z + 0.48, ceilY - 0.22, ceilY, gold);
    blockers.push({ minX: x - 0.38, maxX: x + 0.38, minZ: z - 0.38, maxZ: z + 0.38 });
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
  const p = MALL_POOL;
  const r3 = MALL_L3_R;
  const hole = MALL_HOLE;
  const y2 = MALL_L2;
  const y3 = MALL_L3;
  floorB.ground(-p, -p, p, -r3, y2, marble);
  floorB.ground(-p, r3, p, p, y2, marble);
  floorB.ground(-p, -r3, -r3, r3, y2, marble);
  floorB.ground(r3, -r3, p, r3, y2, marble);
  trimB.box(-p - 0.08, -p - 0.08, p + 0.08, p + 0.08, y2, y2 + 0.1, gold);

  floorB.ground(-r3, -r3, r3, -hole, y3, marble);
  floorB.ground(-r3, hole, r3, r3, y3, marble);
  floorB.ground(-r3, -hole, -hole, hole, y3, marble);
  floorB.ground(hole, -hole, r3, hole, y3, marble);
  trimB.box(-r3 - 0.08, -r3 - 0.08, r3 + 0.08, r3 + 0.08, y3, y3 + 0.1, gold);

  const rail = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    glassRail(wallB, trimB, glassB, blockers, x0, z0, x1, z1, y, gold);
  };
  rail(-hole, -hole, hole, -hole + 0.1, y3);
  rail(-hole, hole - 0.1, hole, hole, y3);
  rail(-hole, -hole, -hole + 0.1, hole, y3);
  rail(hole - 0.1, -hole, hole, hole, y3);

  rail(-r3, r3 - 0.1, r3, r3, y3);
  rail(-r3, -r3, -r3 + 0.1, r3, y3);
  rail(r3 - 0.1, -r3, r3, r3, y3);
  rail(-r3, -r3, -ESC2.xDn1, -r3 + 0.1, y3);
  rail(ESC2.xDn1, -r3, r3, -r3 + 0.1, y3);

  rail(-r3, r3 - 0.1, r3, r3, y2);
  rail(-r3, -r3, -r3 + 0.1, r3, y2);
  rail(r3 - 0.1, -r3, r3, r3, y2);
  rail(-r3, -r3, -ESC2.xDn1, -r3 + 0.1, y2);
  rail(ESC2.xDn1, -r3, r3, -r3 + 0.1, y2);

  rail(-p, p - 0.1, -ESC1.xDn1, p, y2);
  rail(ESC1.xDn1, p - 0.1, p, p, y2);
  rail(-p, -p, -p + 0.1, p, y2);
  rail(p - 0.1, -p, p, p, y2);
  rail(-p, -p, -ESC2.xDn1, -p + 0.1, y2);
  rail(ESC2.xDn1, -p, p, -p + 0.1, y2);
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
    [0.92, 4.72],
    [5.58, 9.88],
    [10.74, 14.48],
  ];
  const spandrels: Array<[number, number]> = [
    [4.72, 5.58],
    [9.88, 10.74],
    [14.48, ceilY],
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
  for (const y of [4.72, 5.58, 9.88, 10.74, 14.48]) {
    trimB.box(x - 0.18, z0, x + 0.18, z1, y, y + 0.08, gold);
  }
  for (let i = 0; i <= n; i++) {
    const z = z0 + i * bay;
    wallB.box(x - 0.12, z - 0.12, x + 0.12, z + 0.12, 0.92, 14.48, wall);
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
  for (const y of [4.72, 5.58, 9.88, 10.74, 14.48]) {
    trimB.box(x0, z - 0.18, x1, z + 0.18, y, y + 0.08, gold);
  }
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * bay;
    wallB.box(x - 0.12, z - 0.12, x + 0.12, z + 0.12, 0.92, 14.48, wall);
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
  belts.push(
    addEscalatorRun(
      group,
      wallB,
      trimB,
      blockers,
      disposables,
      {
        axis: "z",
        a0: ESC1.xUp0,
        a1: ESC1.xUp1,
        bot: ESC1.zBot,
        top: ESC1.zTop,
        y0: 0,
        y1: MALL_L2,
        up: false,
      },
      metal,
      gold,
    ),
  );
  belts.push(
    addEscalatorRun(
      group,
      wallB,
      trimB,
      blockers,
      disposables,
      {
        axis: "z",
        a0: ESC1.xDn0,
        a1: ESC1.xDn1,
        bot: ESC1.zBot,
        top: ESC1.zTop,
        y0: 0,
        y1: MALL_L2,
        up: true,
      },
      metal,
      gold,
    ),
  );
  wallB.box(-0.14, ESC1.zTop, 0.14, ESC1.zBot, 0, MALL_L2 + 1.05, metal);
  blockers.push({ minX: -0.14, maxX: 0.14, minZ: ESC1.zTop, maxZ: ESC1.zBot, maxY: MALL_L2 + 1.1 });

  belts.push(
    addEscalatorRun(
      group,
      wallB,
      trimB,
      blockers,
      disposables,
      {
        axis: "z",
        a0: ESC2.xUp0,
        a1: ESC2.xUp1,
        bot: ESC2.zBot,
        top: ESC2.zTop,
        y0: MALL_L2,
        y1: MALL_L3,
        up: false,
      },
      metal,
      gold,
    ),
  );
  belts.push(
    addEscalatorRun(
      group,
      wallB,
      trimB,
      blockers,
      disposables,
      {
        axis: "z",
        a0: ESC2.xDn0,
        a1: ESC2.xDn1,
        bot: ESC2.zBot,
        top: ESC2.zTop,
        y0: MALL_L2,
        y1: MALL_L3,
        up: true,
      },
      metal,
      gold,
    ),
  );
  wallB.box(-0.14, ESC2.zBot, 0.14, ESC2.zTop, MALL_L2, MALL_L3 + 1.05, metal);
  blockers.push({
    minX: -0.14,
    maxX: 0.14,
    minZ: ESC2.zBot,
    maxZ: ESC2.zTop,
    minY: MALL_L2 - 0.2,
    maxY: MALL_L3 + 1.1,
  });
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
  const segs = 8;
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
  const fashion = MALL_BAYS[0];
  const sneaker = MALL_BAYS[1];
  const luxury = MALL_BAYS[2];
  const department = MALL_BAYS[3];
  storefrontX(wallB, trimB, glassB, blockers, fashion.maxX - 0.28, fashion.maxX, fashion.minZ, fashion.maxZ, -MALL_DOOR, MALL_DOOR, wall, new THREE.Color(fashion.color), gold);
  storefrontX(wallB, trimB, glassB, blockers, sneaker.minX, sneaker.minX + 0.28, sneaker.minZ, sneaker.maxZ, -MALL_DOOR, MALL_DOOR, wall, new THREE.Color(sneaker.color), gold);
  storefrontZ(wallB, trimB, glassB, blockers, luxury.minX, luxury.maxX, luxury.maxZ - 0.28, luxury.maxZ, -16.4, -8.2, wall, new THREE.Color(luxury.color), gold);
  storefrontZ(wallB, trimB, glassB, blockers, department.minX, department.maxX, department.maxZ - 0.28, department.maxZ, 8.2, 16.4, wall, new THREE.Color(department.color), gold);

  partition(wallB, blockers, fashion.minX, fashion.minZ - 0.28, fashion.maxX, fashion.minZ, wall);
  partition(wallB, blockers, fashion.minX, fashion.maxZ, fashion.maxX, fashion.maxZ + 0.28, wall);
  partition(wallB, blockers, sneaker.minX, sneaker.minZ - 0.28, sneaker.maxX, sneaker.minZ, wall);
  partition(wallB, blockers, sneaker.minX, sneaker.maxZ, sneaker.maxX, sneaker.maxZ + 0.28, wall);
  partition(wallB, blockers, luxury.maxX, luxury.minZ, luxury.maxX + 0.28, luxury.maxZ, wall);
  partition(wallB, blockers, department.minX - 0.28, department.minZ, department.minX, department.maxZ, wall);
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
  wall: THREE.Color,
  lintel: THREE.Color,
  gold: THREE.Color,
) {
  wallB.box(x0, z0, x1, doorZ0, 0, 4.45, wall);
  wallB.box(x0, doorZ1, x1, z1, 0, 4.45, wall);
  wallB.box(x0, doorZ0, x1, doorZ1, 3.35, 4.45, wall);
  blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: doorZ0 });
  blockers.push({ minX: x0, maxX: x1, minZ: doorZ1, maxZ: z1 });
  trimB.box(x0 - 0.1, z0, x1 + 0.1, z1, 3.9, 4.45, lintel);
  trimB.box(x0 - 0.06, doorZ0 - 0.12, x1 + 0.06, doorZ0, 0, 3.35, gold);
  trimB.box(x0 - 0.06, doorZ1, x1 + 0.06, doorZ1 + 0.12, 0, 3.35, gold);
  const gx = (x0 + x1) / 2;
  glassPaneX(glassB, gx, z0 + 0.35, doorZ0 - 0.2, 0.7, 3.85);
  glassPaneX(glassB, gx, doorZ1 + 0.2, z1 - 0.35, 0.7, 3.85);
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
  wall: THREE.Color,
  lintel: THREE.Color,
  gold: THREE.Color,
) {
  wallB.box(x0, z0, doorX0, z1, 0, 4.45, wall);
  wallB.box(doorX1, z0, x1, z1, 0, 4.45, wall);
  wallB.box(doorX0, z0, doorX1, z1, 3.35, 4.45, wall);
  blockers.push({ minX: x0, maxX: doorX0, minZ: z0, maxZ: z1 });
  blockers.push({ minX: doorX1, maxX: x1, minZ: z0, maxZ: z1 });
  trimB.box(x0, z0 - 0.1, x1, z1 + 0.1, 3.9, 4.45, lintel);
  trimB.box(doorX0 - 0.12, z0 - 0.06, doorX0, z1 + 0.06, 0, 3.35, gold);
  trimB.box(doorX1, z0 - 0.06, doorX1 + 0.12, z1 + 0.06, 0, 3.35, gold);
  const gz = (z0 + z1) / 2;
  glassPaneZ(glassB, gz, x0 + 0.35, doorX0 - 0.2, 0.7, 3.85);
  glassPaneZ(glassB, gz, doorX1 + 0.2, x1 - 0.35, 0.7, 3.85);
}

function partition(
  wallB: MeshBuilder,
  blockers: Blocker[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  wall: THREE.Color,
) {
  wallB.box(x0, z0, x1, z1, 0, 4.45, wall);
  blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
}

function furnishMallStores(wallB: MeshBuilder, trimB: MeshBuilder, blockers: Blocker[], gold: THREE.Color) {
  const fashion = new THREE.Color("#c45c4a");
  const sneaker = new THREE.Color("#2aa3a0");
  const luxury = new THREE.Color("#1a1206");
  const department = new THREE.Color("#2f5d4a");
  for (const z of [-10.4, -4.2, 2.2, 8.6]) {
    rackRow(trimB, blockers, -33.8, z, -24.4, fashion, gold);
    rackRow(trimB, blockers, 24.4, z, 33.8, sneaker, gold);
  }
  mannequin(wallB, trimB, blockers, -28.6, 0, fashion, gold);
  mannequin(wallB, trimB, blockers, -23.4, 12.2, fashion, gold);
  mannequin(wallB, trimB, blockers, 28.6, 0, sneaker, gold);
  mannequin(wallB, trimB, blockers, 23.4, -12.2, sneaker, gold);
  for (const x of [-28.4, -18.6, -9.4]) {
    rackRow(trimB, blockers, x, -33.4, x + 6.6, luxury, gold);
  }
  mannequin(wallB, trimB, blockers, -16.8, -26.4, luxury, gold);
  mannequin(wallB, trimB, blockers, -8.2, -24.2, luxury, gold);
  for (const x of [6.4, 16.2, 26.0]) {
    rackRow(trimB, blockers, x, -33.4, x + 6.6, department, gold);
  }
  mannequin(wallB, trimB, blockers, 12.4, -26.4, department, gold);
  mannequin(wallB, trimB, blockers, 24.8, -24.2, department, gold);
}

function addFoodCourt(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  wall: THREE.Color,
  gold: THREE.Color,
  stone: THREE.Color,
) {
  const wood = new THREE.Color("#6b4a32");
  const teal = new THREE.Color("#1a6b6b");
  trimB.box(-32.4, 30.4, -8.6, 32.8, 0, 1.12, teal);
  trimB.box(8.6, 30.4, 32.4, 32.8, 0, 1.12, teal);
  wallB.box(-32.1, 30.55, -8.9, 32.55, 1.12, 2.35, wall);
  wallB.box(8.9, 30.55, 32.1, 32.55, 1.12, 2.35, wall);
  blockers.push({ minX: -32.4, maxX: -8.6, minZ: 30.4, maxZ: 32.8 });
  blockers.push({ minX: 8.6, maxX: 32.4, minZ: 30.4, maxZ: 32.8 });
  for (const [x, z] of [
    [-28.6, 22.4],
    [-22.4, 22.4],
    [-16.2, 22.4],
    [-28.6, 26.6],
    [-22.4, 26.6],
    [-16.2, 26.6],
    [13.8, 22.4],
    [20.0, 22.4],
    [26.2, 22.4],
    [13.8, 26.6],
    [20.0, 26.6],
    [26.2, 26.6],
  ]) {
    trimB.box(x, z, x + 2.4, z + 2.4, 0, 0.78, wood);
    trimB.box(x + 0.15, z + 0.15, x + 2.25, z + 2.25, 0.78, 0.86, gold);
    blockers.push({ minX: x, maxX: x + 2.4, minZ: z, maxZ: z + 2.4 });
  }
  for (const x of [-12.4, -6.2, 4.0, 10.2]) {
    trimB.box(x, 18.4, x + 1.6, 19.3, 0, 0.48, stone);
    blockers.push({ minX: x, maxX: x + 1.6, minZ: 18.4, maxZ: 19.3 });
  }
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
    [-18.6, -18.6],
    [16.8, -18.6],
    [-18.6, 17.4],
    [16.8, 17.4],
    [-12.2, 12.8],
    [10.6, 12.8],
    [-12.2, -13.4],
    [10.6, -13.4],
  ]) {
    wallB.box(x, z, x + 1.8, z + 1.8, 0, 0.55, stone);
    trimB.box(x + 0.18, z + 0.18, x + 1.62, z + 1.62, 0.55, 1.45, leaf);
    blockers.push({ minX: x, maxX: x + 1.8, minZ: z, maxZ: z + 1.8 });
  }
  for (const [x, z] of [
    [-19.4, 4.2],
    [17.6, 4.2],
    [-19.4, -6.8],
    [17.6, -6.8],
  ]) {
    trimB.box(x, z, x + 2.6, z + 0.7, 0, 0.42, gold);
    blockers.push({ minX: x, maxX: x + 2.6, minZ: z, maxZ: z + 0.7 });
  }
  for (const [x, z] of [
    [-14.6, 20.2],
    [12.8, 20.2],
    [0.0, -18.8],
  ]) {
    wallB.box(x, z, x + 0.55, z + 0.55, 0, MALL_CEIL, stone);
    blockers.push({ minX: x, maxX: x + 0.55, minZ: z, maxZ: z + 0.55 });
  }
}

function addDirectory(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  gold: THREE.Color,
  marble: THREE.Color,
) {
  trimB.box(-6.8, 26.4, -2.6, 29.6, 0, 1.12, gold);
  wallB.box(-6.55, 26.6, -2.85, 29.35, 1.12, 1.85, marble);
  trimB.box(-6.9, 26.3, -2.5, 29.7, 1.85, 2.05, gold);
  blockers.push({ minX: -6.8, maxX: -2.6, minZ: 26.4, maxZ: 29.6 });
}

function glassPaneX(glassB: MeshBuilder, x: number, z0: number, z1: number, y0: number, y1: number) {
  if (z1 - z0 < 0.4) return;
  glassB.quad(
    { x, y: y0, z: z1 },
    { x, y: y0, z: z0 },
    { x, y: y1, z: z0 },
    { x, y: y1, z: z1 },
    new THREE.Color("#c5e4f4"),
  );
}

function glassPaneZ(glassB: MeshBuilder, z: number, x0: number, x1: number, y0: number, y1: number) {
  if (x1 - x0 < 0.4) return;
  glassB.quad(
    { x: x0, y: y0, z },
    { x: x1, y: y0, z },
    { x: x1, y: y1, z },
    { x: x0, y: y1, z },
    new THREE.Color("#c5e4f4"),
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
    color: "#d7eef8",
    transparent: true,
    opacity: 0.3,
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
    emissiveIntensity: 0.4,
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
  cloth: THREE.Color,
  rail: THREE.Color,
) {
  const width = x1 - x0;
  trimB.box(x0, z, x1, z + 0.55, 1.05, 1.18, rail);
  trimB.box(x0, z + 0.08, x1, z + 0.47, 0.2, 1.05, cloth);
  blockers.push({ minX: x0, maxX: x1, minZ: z, maxZ: z + 0.55 });
  trimB.box(x0 + width * 0.12, z + 2.1, x1 - width * 0.12, z + 2.55, 0.2, 1.7, cloth);
  blockers.push({ minX: x0 + width * 0.12, maxX: x1 - width * 0.12, minZ: z + 2.1, maxZ: z + 2.55 });
}

function mannequin(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  x: number,
  z: number,
  cloth: THREE.Color,
  stand: THREE.Color,
) {
  trimB.box(x - 0.28, z - 0.28, x + 0.28, z + 0.28, 0, 0.12, stand);
  wallB.box(x - 0.18, z - 0.14, x + 0.18, z + 0.14, 0.12, 1.05, cloth);
  wallB.box(x - 0.16, z - 0.16, x + 0.16, z + 0.16, 1.05, 1.38, new THREE.Color("#e0c2a2"));
  blockers.push({ minX: x - 0.32, maxX: x + 0.32, minZ: z - 0.32, maxZ: z + 0.32 });
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

function assemble(
  group: THREE.Group,
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  disposables: Array<{ dispose: () => void }>,
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
  add(floorB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58 }));
  add(wallB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74 }));
  add(
    trimB,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.16,
      emissive: new THREE.Color("#ffd9a0"),
      emissiveIntensity: 0.08,
    }),
  );
}
