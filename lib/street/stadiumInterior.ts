import * as THREE from "three";
import { STADIUM_STAND_MENUS } from "@/lib/city/consumables";
import type { Blocker } from "./buildCity";
import { displayFood } from "./heldItem";
import { MeshBuilder } from "./meshBuilder";
import {
  addGreenMonsterInterior,
  addMonsterSeating,
  monsterGroundAt,
  monsterSeatWalkY,
  MONSTER_DECK_Y,
  MONSTER_ROW_RISE,
  MONSTER_ROW_RUN,
  MONSTER_ROWS,
} from "./scorpionMonster";

export interface StadiumInterior {
  group: THREE.Group;
  blockers: Blocker[];
  spawn: { x: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  scoreboard: THREE.MeshStandardMaterial;
  fans: THREE.InstancedMesh;
  seatedCount: number;
  walkingCount: number;
  /** Seated fan indices on the Green Monster — only shown during gametime. */
  monsterFanStart: number;
  rest: Float32Array;
  /** Hidden until a World Series game: sell-out extras + neon glow gear. */
  seriesCrowd: {
    extras: THREE.InstancedMesh;
    sticks: THREE.InstancedMesh;
    bands: THREE.InstancedMesh;
    neonRest: Float32Array;
    neonCount: number;
  };
  stands: StadiumStand[];
  nearStand: (x: number, z: number) => StadiumStand | null;
  groundAt: (x: number, z: number) => number;
  dispose: () => void;
}

/** A concession counter: where to order, which way the line forms, and where fans carry food. */
export interface StadiumStand {
  name: string;
  title: string;
  items: string[];
  color: string;
  /** Point just in front of the counter. */
  counter: { x: number; z: number };
  /** Unit direction the line extends away from the counter. */
  out: { x: number; z: number };
  /** Route a served fan follows with their food, counter first. */
  walk: { x: number; z: number }[];
  /** Max people in line without spilling into walls/columns. */
  maxLine: number;
}

const SEAT_ROWS = 10;
const ROW_RISE = 0.36;
const ROW_RUN = 0.82;
const SEAT_Z0 = 16.5;
const SEAT_THICK = 0.4;
const AISLE_HALF = 1.15;
const AISLES = [0, -13.35, 13.35];
const STAND_CLEAR = 2.88;
const STAIR_STEPS = 20;
const STAIR_Z1 = 38.2;
const STAIR_Z0 = SEAT_Z0 + (SEAT_ROWS - 1) * ROW_RUN + 0.55;
const FIELD_HALF = 18;
const FIELD_Z_FAR = -19;
const CF_GAP = 7.2;
const SEATED_FANS = 480;
const WALKING_FANS = 42;
const PLAYER_FANS = 4;

export const STADIUM_FAN_WALK_START = SEATED_FANS;
export const STADIUM_SEATED_COUNT = SEATED_FANS;
export const STADIUM_WALKING_COUNT = WALKING_FANS;

function rowWalkY(row: number) {
  return STAND_CLEAR + SEAT_THICK + row * ROW_RISE;
}

function topSeatY() {
  return rowWalkY(SEAT_ROWS - 1);
}

function inAisle(x: number) {
  return AISLES.some((ax) => Math.abs(x - ax) <= AISLE_HALF);
}

/** Which seating plank contains this point, wrapping the whole bowl. */
function bowlSeatRow(x: number, z: number, greenMonster = false) {
  const slack = 0.4;
  for (let row = 0; row < SEAT_ROWS; row++) {
    const pad = row * ROW_RUN;
    const run = ROW_RUN;
    const xInner = FIELD_HALF + pad;
    const zNear = SEAT_Z0 + pad;
    const zFar = FIELD_Z_FAR - pad;
    const xOuter = xInner + run;
    if (z >= zNear - slack && z <= zNear + run + slack && x >= -xInner - slack && x <= xInner + slack) {
      return row;
    }
    if (x >= xInner - slack && x <= xOuter + slack && z >= zFar - slack && z <= zNear + slack) {
      return row;
    }
    // Skip continuous left-foul / left-CF slabs when Monster seating owns that space.
    if (!greenMonster) {
      if (x <= -xInner + slack && x >= -xOuter - slack && z >= zFar - slack && z <= zNear + slack) {
        return row;
      }
      if (z <= zFar + slack && z >= zFar - run - slack && x >= -xOuter - slack && x <= -CF_GAP + 0.35) {
        return row;
      }
    }
    if (z <= zFar + slack && z >= zFar - run - slack && x >= CF_GAP - 0.35 && x <= xOuter + slack) {
      return row;
    }
  }
  return null;
}

/** Walkable height: concourse, stairs onto the deck, then the rake around the bowl. */
export function stadiumGroundAt(x: number, z: number, greenMonster = false) {
  if (greenMonster) {
    const monsterY = monsterGroundAt(x, z, {
      fieldHalf: FIELD_HALF,
      fieldZFar: FIELD_Z_FAR,
      cfGap: CF_GAP,
      seatZ0: SEAT_Z0,
    });
    if (monsterY != null) return monsterY;
  }
  const top = topSeatY();
  if (inAisle(x) && z >= STAIR_Z0 && z <= STAIR_Z1) {
    const t = (STAIR_Z1 - z) / (STAIR_Z1 - STAIR_Z0);
    const step = Math.min(STAIR_STEPS, Math.max(1, Math.ceil(t * STAIR_STEPS)));
    return (top * step) / STAIR_STEPS;
  }
  const row = bowlSeatRow(x, z, greenMonster);
  if (row != null) return rowWalkY(row);
  return 0;
}

const GREEN = "#2f7a3e";
const DIRT = "#c4a56a";
const CONCRETE = "#b9b3a8";
const NAVY = "#1f4d8c";
const SEAT = "#c0392b";
const BRICK = "#8a5340";
const IVY = "#1f4a28";

/**
 * A walkable ballpark: concourse behind home plate, seating bowl, field,
 * dugouts, scoreboard, and concession stands around the bowl.
 */
export function buildStadiumInterior(opts: { greenMonster?: boolean } = {}): StadiumInterior {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const seatB = new MeshBuilder();
  const trimB = new MeshBuilder();
  const scratch = new THREE.Color();

  const minX = -36;
  const maxX = 36;
  const minZ = -38;
  const maxZ = 48;

  const concrete = new THREE.Color(CONCRETE);
  const brick = new THREE.Color(BRICK);
  const ivy = new THREE.Color(IVY);
  const navy = new THREE.Color(NAVY);
  const fieldWall = new THREE.Color("#2c5a34");
  const outerPad = SEAT_ROWS * ROW_RUN;
  const ox = FIELD_HALF + outerPad;
  const ozNear = SEAT_Z0 + outerPad;
  const ozFar = FIELD_Z_FAR - outerPad;

  // One slab under the whole park so concourse, tunnels, and foul ground never drop to void.
  scratch.set(CONCRETE);
  floorB.ground(minX, minZ, maxX, maxZ, 0, scratch);

  // Playing surface fills the entire bowl opening, then dirt sits on top.
  const track = 1.45;
  scratch.set("#b7925c");
  floorB.ground(-FIELD_HALF, FIELD_Z_FAR, FIELD_HALF, SEAT_Z0, 0.02, scratch);
  scratch.set(GREEN);
  floorB.ground(-FIELD_HALF + track, FIELD_Z_FAR + track, FIELD_HALF - track, SEAT_Z0 - track, 0.04, scratch);
  scratch.set(DIRT);
  floorB.ground(-9, 2, 9, 15.6, 0.05, scratch);
  floorB.ground(-2.2, 13.8, 2.2, 16.1, 0.06, scratch);
  scratch.set("#b7925c");
  floorB.ground(-1.3, 7.2, 1.3, 10.2, 0.2, scratch);
  scratch.set("#f4f1ea");
  floorB.ground(-0.45, 15.4, 0.45, 16.05, 0.08, scratch);
  floorB.ground(7.4, 8.6, 8.3, 9.5, 0.08, scratch);
  floorB.ground(-8.3, 8.6, -7.4, 9.5, 0.08, scratch);
  floorB.ground(-0.45, 1.6, 0.45, 2.5, 0.08, scratch);
  scratch.set("#f2eee6");
  floorB.ground(-0.12, FIELD_Z_FAR + track, 0.12, 15.8, 0.07, scratch);

  addDugout(wallB, seatB, blockers, -16.5, 6, 1);
  addDugout(wallB, seatB, blockers, 12.5, 6, -1);

  // ─── Outer bowl walls ──────────────────────────────────────────────────────
  const wallH = 11.5;
  wallB.box(minX, minZ, minX + 0.8, maxZ, 0, wallH, brick);
  wallB.box(maxX - 0.8, minZ, maxX, maxZ, 0, wallH, brick);
  wallB.box(minX, minZ, maxX, minZ + 0.8, 0, wallH, brick);
  wallB.box(minX, maxZ - 0.8, maxX, maxZ, 0, wallH, brick);
  blockers.push({ minX, maxX: minX + 0.8, minZ, maxZ });
  blockers.push({ minX: maxX - 0.8, maxX, minZ, maxZ });
  blockers.push({ minX, maxX, minZ, maxZ: minZ + 0.8 });
  blockers.push({ minX, maxX, minZ: maxZ - 0.8, maxZ });

  wallB.box(minX + 0.8, 25.6, minX + 1.3, maxZ - 0.8, 0, 6.5, concrete);
  wallB.box(maxX - 1.3, 25.6, maxX - 0.8, maxZ - 0.8, 0, 6.5, concrete);

  addBathroom(wallB, trimB, blockers, 10, 40.6);
  addLockerRoom(wallB, trimB, blockers, 20.5, 38.8);

  // ─── Seating bowl wrapping the field ───────────────────────────────────────
  for (let row = 0; row < SEAT_ROWS; row++) {
    const y0 = rowWalkY(row) - SEAT_THICK;
    const y1 = y0 + SEAT_THICK;
    const prevY = row === 0 ? STAND_CLEAR : rowWalkY(row - 1);
    const pad = row * ROW_RUN;
    const xInner = FIELD_HALF + pad;
    const zNear = SEAT_Z0 + pad;
    const zFar = FIELD_Z_FAR - pad;
    const run = ROW_RUN - 0.07;
    scratch.set(row % 2 === 0 ? SEAT : "#9b2e24");

    addSeatBand(seatB, -xInner, xInner, zNear, zNear + run, y0, y1, scratch);
    seatB.box(-xInner, zNear, xInner, zNear + 0.14, prevY, y1, scratch);

    seatB.box(xInner, zFar, xInner + run, zNear, y0, y1, scratch);
    seatB.box(xInner, zFar, xInner + 0.14, zNear, prevY, y1, scratch);

    if (!opts.greenMonster) {
      seatB.box(-xInner - run, zFar, -xInner, zNear, y0, y1, scratch);
      seatB.box(-xInner - 0.14, zFar, -xInner, zNear, prevY, y1, scratch);
      seatB.box(-xInner, zFar - run, -CF_GAP, zFar, y0, y1, scratch);
      seatB.box(-xInner, zFar - 0.14, -CF_GAP, zFar, prevY, y1, scratch);
    }

    seatB.box(CF_GAP, zFar - run, xInner, zFar, y0, y1, scratch);
    seatB.box(CF_GAP, zFar - 0.14, xInner, zFar, prevY, y1, scratch);
  }

  const fasciaH = topSeatY() + 2.4;
  wallB.box(-ox - 0.55, ozFar - 0.55, -CF_GAP, ozFar, 0, fasciaH, ivy);
  wallB.box(CF_GAP, ozFar - 0.55, ox + 0.55, ozFar, 0, fasciaH, ivy);
  wallB.box(-ox - 0.55, ozFar, -ox, ozNear, 0, fasciaH, navy);
  wallB.box(ox, ozFar, ox + 0.55, ozNear, 0, fasciaH, navy);

  // Solid inner walls (no aisle cuts) plus a rail so the field stays closed.
  const lip = STAND_CLEAR + 0.35;
  const railTop = lip + 1.12;
  const rail = new THREE.Color("#e8eef4");
  wallB.box(-FIELD_HALF, SEAT_Z0 - 0.5, FIELD_HALF, SEAT_Z0 + 0.22, 0, lip, fieldWall);
  wallB.box(FIELD_HALF - 0.22, FIELD_Z_FAR, FIELD_HALF + 0.42, SEAT_Z0, 0, lip, ivy);
  if (opts.greenMonster) {
    // Right-field ivy stays short; left field is the Monster.
    wallB.box(CF_GAP, FIELD_Z_FAR - 0.42, FIELD_HALF, FIELD_Z_FAR + 0.22, 0, lip, ivy);
    wallB.box(-CF_GAP, FIELD_Z_FAR - 0.42, CF_GAP, FIELD_Z_FAR + 0.22, 0, 1.45, ivy);
    addGreenMonsterInterior(wallB, trimB, blockers, {
      fieldHalf: FIELD_HALF,
      fieldZFar: FIELD_Z_FAR,
      seatZ0: SEAT_Z0,
      cfGap: CF_GAP,
    });
    addMonsterSeating(seatB, floorB, trimB, blockers, {
      fieldHalf: FIELD_HALF,
      fieldZFar: FIELD_Z_FAR,
      seatZ0: SEAT_Z0,
      cfGap: CF_GAP,
    });
    // Short left-field foul lip from the Monster return up to the dugout.
    const foulJoin = FIELD_Z_FAR + (SEAT_Z0 - FIELD_Z_FAR) * 0.42;
    wallB.box(-FIELD_HALF - 0.42, foulJoin, -FIELD_HALF + 0.22, SEAT_Z0, 0, lip, ivy);
    trimB.box(-FIELD_HALF + 0.12, foulJoin, -FIELD_HALF + 0.48, SEAT_Z0, lip, railTop, rail);
  } else {
    wallB.box(-FIELD_HALF - 0.42, FIELD_Z_FAR, -FIELD_HALF + 0.22, SEAT_Z0, 0, lip, ivy);
    wallB.box(-FIELD_HALF, FIELD_Z_FAR - 0.42, -CF_GAP, FIELD_Z_FAR + 0.22, 0, lip, ivy);
    wallB.box(CF_GAP, FIELD_Z_FAR - 0.42, FIELD_HALF, FIELD_Z_FAR + 0.22, 0, lip, ivy);
    wallB.box(-CF_GAP, FIELD_Z_FAR - 0.42, CF_GAP, FIELD_Z_FAR + 0.22, 0, 1.45, ivy);
  }
  trimB.box(-FIELD_HALF, SEAT_Z0 - 0.58, FIELD_HALF, SEAT_Z0 - 0.16, lip, railTop, rail);
  trimB.box(FIELD_HALF - 0.48, FIELD_Z_FAR, FIELD_HALF - 0.12, SEAT_Z0, lip, railTop, rail);
  if (!opts.greenMonster) {
    trimB.box(-FIELD_HALF + 0.12, FIELD_Z_FAR, -FIELD_HALF + 0.48, SEAT_Z0, lip, railTop, rail);
    trimB.box(-FIELD_HALF, FIELD_Z_FAR + 0.12, -CF_GAP, FIELD_Z_FAR + 0.48, lip, railTop, rail);
  }
  trimB.box(CF_GAP, FIELD_Z_FAR + 0.12, FIELD_HALF, FIELD_Z_FAR + 0.48, lip, railTop, rail);
  trimB.box(-CF_GAP, FIELD_Z_FAR + 0.12, CF_GAP, FIELD_Z_FAR + 0.48, 1.45, 2.55, rail);

  const fieldInset = 0.58;
  blockers.push({
    minX: -FIELD_HALF + fieldInset,
    maxX: FIELD_HALF - fieldInset,
    minZ: FIELD_Z_FAR + fieldInset,
    maxZ: SEAT_Z0 - fieldInset,
  });

  addFloodTowers(wallB, trimB, blockers);

  // Soffits and extra columns close the under-stand tunnels.
  addSeatBand(floorB, -ox, ox, SEAT_Z0, ozNear, STAND_CLEAR - 0.16, STAND_CLEAR, concrete);
  floorB.box(FIELD_HALF, FIELD_Z_FAR, ox, SEAT_Z0, STAND_CLEAR - 0.16, STAND_CLEAR, concrete);
  floorB.box(-ox, FIELD_Z_FAR, -FIELD_HALF, SEAT_Z0, STAND_CLEAR - 0.16, STAND_CLEAR, concrete);
  floorB.box(-ox, ozFar, -CF_GAP, FIELD_Z_FAR, STAND_CLEAR - 0.16, STAND_CLEAR, concrete);
  floorB.box(CF_GAP, ozFar, ox, FIELD_Z_FAR, STAND_CLEAR - 0.16, STAND_CLEAR, concrete);
  for (const ax of AISLES) {
    for (const side of [-1, 1]) {
      const px = ax + side * (AISLE_HALF + 0.18);
      wallB.box(px - 0.22, SEAT_Z0 + 0.35, px + 0.22, ozNear - 0.2, 0, STAND_CLEAR, concrete);
    }
  }
  for (const z of [-12, -2, 8]) {
    wallB.box(FIELD_HALF + 0.5, z - 0.22, FIELD_HALF + 0.94, z + 0.22, 0, STAND_CLEAR, concrete);
    wallB.box(-FIELD_HALF - 0.94, z - 0.22, -FIELD_HALF - 0.5, z + 0.22, 0, STAND_CLEAR, concrete);
  }

  for (const ax of AISLES) {
    addStairFlight(floorB, trimB, ax - AISLE_HALF, ax + AISLE_HALF);
  }

  // ─── Scoreboard in center field ────────────────────────────────────────────
  const boardZ = ozFar - 2.4;
  scratch.set("#2ea44a");
  wallB.box(-10.4, boardZ, 10.4, boardZ + 2.5, 0, 15.4, scratch);
  blockers.push({ minX: -10.4, maxX: 10.4, minZ: boardZ, maxZ: boardZ + 2.5 });
  const boardGeo = new THREE.PlaneGeometry(19.2, 11.8);
  const boardMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: new THREE.Color("#6ecf7a"),
    emissiveIntensity: 0.42,
    roughness: 0.55,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(0, 8.15, boardZ + 2.52);
  group.add(board);
  disposables.push(boardGeo);

  // ─── Concession stands under the bleachers ─────────────────────────────────
  const shops: ShopSpec[] = [
    { name: "NACHOS", menu: "Cheese · Salsa · Jalapeños", face: "z+", x: -21.6, z: 21.4, color: "#e67e22", width: 5.8 },
    { name: "HOT DOGS", menu: "Mustard · Relish · Chili", face: "z+", x: -12.0, z: 21.4, color: "#c0392b", width: 5.3 },
    { name: "PRETZELS", menu: "Salted · Cheese dip", face: "z+", x: -6.45, z: 21.4, color: "#c47a2c", width: 5.1 },
    { name: "BURGERS", menu: "Cheeseburgers · Fries", face: "z+", x: 1.35, z: 21.4, color: "#8b5a2b", width: 5.1 },
    { name: "DRINKS", menu: "Soda · Lemonade · Water", face: "z+", x: 6.6, z: 21.4, color: "#1f4d8c", width: 5.3 },
    { name: "ICE CREAM", menu: "Soft serve · Sundaes", face: "z+", x: 15.0, z: 21.4, color: "#d48aa8", width: 5.8 },
    { name: "PIZZA", menu: "Pepperoni · Extra cheese", face: "x+", x: -24.8, z: 2.2, color: "#b83218", width: 5.6 },
    { name: "SWEETS", menu: "Cotton candy · Popcorn", face: "x-", x: 21.3, z: 2.2, color: "#7b2d8b", width: 5.6 },
    { name: "PIZZERIA", menu: "Whole pies · Calzones · Garlic knots", face: "x-", x: 21.3, z: -9.3, color: "#2f7a3e", width: 5.6 },
  ];
  const stands = shops.map((shop) => addShop(wallB, trimB, blockers, group, disposables, shop));

  // ─── Assemble ──────────────────────────────────────────────────────────────
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
    disposables.push(geometry);
    disposables.push(material);
  };

  add(floorB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
  add(wallB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  add(seatB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  add(
    trimB,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.15,
      emissive: new THREE.Color("#ffd9a0"),
      emissiveIntensity: 0.15,
    }),
  );

  const { mesh: fans, rest, monsterFanStart } = buildFans(Boolean(opts.greenMonster));
  group.add(fans);
  disposables.push(fans.geometry);
  disposables.push(fans.material as THREE.Material);
  const seriesCrowd = buildSeriesCrowd(Boolean(opts.greenMonster));
  group.add(seriesCrowd.extras, seriesCrowd.sticks, seriesCrowd.bands);
  disposables.push(seriesCrowd);

  return {
    group,
    blockers,
    spawn: { x: 0, z: 40.4, yaw: 0, pitch: -0.18 },
    bounds: { minX, maxX, minZ, maxZ },
    scoreboard: boardMat,
    fans,
    seatedCount: SEATED_FANS,
    walkingCount: WALKING_FANS,
    monsterFanStart,
    rest,
    seriesCrowd,
    stands,
    nearStand: (x, z) => {
      let best: StadiumStand | null = null;
      let bestD = 2.4;
      for (const stand of stands) {
        const d = Math.hypot(x - stand.counter.x, z - stand.counter.z);
        if (d < bestD) {
          bestD = d;
          best = stand;
        }
      }
      return best;
    },
    groundAt: (x, z) => stadiumGroundAt(x, z, Boolean(opts.greenMonster)),
    dispose: () => {
      for (const item of disposables) item.dispose();
      boardMat.dispose();
    },
  };
}

type ShopFace = "x+" | "x-" | "z+" | "z-";

interface ShopSpec {
  name: string;
  menu: string;
  face: ShopFace;
  x: number;
  z: number;
  color: string;
  width?: number;
  depth?: number;
}

function addShop(
  walls: MeshBuilder,
  trim: MeshBuilder,
  blockers: Blocker[],
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  spec: ShopSpec,
): StadiumStand {
  const depth = spec.depth ?? 3.35;
  const width = spec.width ?? 5.6;
  const h = 2.52;
  const concrete = new THREE.Color(CONCRETE);
  const accent = new THREE.Color(spec.color);
  const counterTop = new THREE.Color("#3d342c");

  let x0 = spec.x;
  let z0 = spec.z;
  let x1: number;
  let z1: number;
  if (spec.face === "x+" || spec.face === "x-") {
    x1 = x0 + depth;
    z1 = z0 + width;
  } else {
    x1 = x0 + width;
    z1 = z0 + depth;
  }

  walls.box(x0, z0, x1, z1, 0, h, concrete);
  walls.box(x0 - 0.06, z0 - 0.06, x1 + 0.06, z1 + 0.06, h, h + 0.12, accent);
  blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, maxY: STAND_CLEAR + 0.05 });

  const awning = 0.7;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  let signX = cx;
  let signZ = cz;
  let rotY = 0;
  if (spec.face === "x+") {
    trim.box(x1, z0 + 0.12, x1 + awning, z1 - 0.12, 1.95, 2.22, accent);
    trim.box(x1 - 0.08, z0 + 0.3, x1 + 0.12, z1 - 0.3, 1.02, 1.16, counterTop);
    addFoodProps(trim, group, disposables, spec.name, x1 - 0.45, z0 + 0.6, z1 - 0.6);
    signX = x1 + 0.1;
    signZ = cz;
    rotY = -Math.PI / 2;
  } else if (spec.face === "x-") {
    trim.box(x0 - awning, z0 + 0.12, x0, z1 - 0.12, 1.95, 2.22, accent);
    trim.box(x0 - 0.12, z0 + 0.3, x0 + 0.08, z1 - 0.3, 1.02, 1.16, counterTop);
    addFoodProps(trim, group, disposables, spec.name, x0 + 0.2, z0 + 0.6, z1 - 0.6);
    signX = x0 - 0.1;
    signZ = cz;
    rotY = Math.PI / 2;
  } else if (spec.face === "z+") {
    trim.box(x0 + 0.12, z1, x1 - 0.12, z1 + awning, 1.95, 2.22, accent);
    trim.box(x0 + 0.3, z1 - 0.08, x1 - 0.3, z1 + 0.12, 1.02, 1.16, counterTop);
    addFoodProps(trim, group, disposables, spec.name, x0 + 0.6, z1 - 0.45, x1 - 0.6, true);
    signX = cx;
    signZ = z1 + 0.1;
    rotY = 0;
  } else {
    trim.box(x0 + 0.12, z0 - awning, x1 - 0.12, z0, 1.95, 2.22, accent);
    trim.box(x0 + 0.3, z0 - 0.12, x1 - 0.3, z0 + 0.08, 1.02, 1.16, counterTop);
    signX = cx;
    signZ = z0 - 0.1;
    rotY = Math.PI;
  }

  addShopSign(group, disposables, spec.name, spec.menu, spec.color, signX, 2.38, signZ, rotY, width * 0.82);

  const reach = awning + 0.55;
  const out =
    spec.face === "x+" ? { x: 1, z: 0 } : spec.face === "x-" ? { x: -1, z: 0 } : spec.face === "z+" ? { x: 0, z: 1 } : { x: 0, z: -1 };
  const counter =
    spec.face === "x+"
      ? { x: x1 + reach, z: cz }
      : spec.face === "x-"
        ? { x: x0 - reach, z: cz }
        : spec.face === "z+"
          ? { x: cx, z: z1 + reach }
          : { x: cx, z: z0 - reach };
  const side = spec.face === "x+" || spec.face === "x-";
  const aisle = AISLES.reduce((a, b) => (Math.abs(b - cx) < Math.abs(a - cx) ? b : a));
  // Side corridors run under the stands toward home plate; the main concourse
  // sends fans to the foot of the nearest aisle stair and up into the seats.
  const walk = side
    ? [counter, { x: counter.x + out.x * 0.6, z: counter.z + 1.2 }, { x: counter.x + out.x * 0.6, z: SEAT_Z0 - 1.2 }]
    : [
        counter,
        { x: aisle + Math.sign(cx - aisle || 1) * (AISLE_HALF + 0.9), z: STAIR_Z1 - 0.2 },
        { x: aisle, z: STAIR_Z1 + 0.4 },
        { x: aisle, z: STAIR_Z0 + 0.5 },
      ];
  return {
    name: spec.name,
    title: STAND_TITLES[spec.name] ?? spec.name,
    items: STADIUM_STAND_MENUS[spec.name] ?? [],
    color: spec.color,
    counter,
    out,
    walk,
    maxLine: side ? 3 : 7,
  } satisfies StadiumStand;
}

const STAND_TITLES: Record<string, string> = {
  NACHOS: "Nacho Stand",
  "HOT DOGS": "Hot Dog Stand",
  PRETZELS: "Pretzel Cart",
  BURGERS: "Burger Grill",
  DRINKS: "Drink Stand",
  "ICE CREAM": "Ice Cream Stand",
  PIZZA: "Pizza Slices",
  PIZZERIA: "Ballpark Pizzeria",
  SWEETS: "Sweets Stand",
};

const COUNTER_DISPLAYS: Record<string, string[]> = {
  "HOT DOGS": ["food-hotdog", "food-relish-dog", "food-chili-dog"],
  PRETZELS: ["food-pretzel", "food-pretzel-cheese", "food-pretzel"],
};

function addFoodProps(
  trim: MeshBuilder,
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  name: string,
  a: number,
  b: number,
  c: number,
  alongX = false,
) {
  const display = COUNTER_DISPLAYS[name];
  if (display) {
    const steel = new THREE.Color("#9aa3ab");
    const slot = alongX ? (c - a) / 3 : (c - b) / 3;
    display.forEach((id, i) => {
      const x = alongX ? a + slot * (i + 0.5) : a + 0.22;
      const z = alongX ? b + 0.22 : b + slot * (i + 0.5);
      const hx = alongX ? 0.36 : 0.17;
      const hz = alongX ? 0.17 : 0.36;
      trim.box(x - hx, z - hz, x + hx, z + hz, 1.16, 1.18, steel);
      for (const offset of [-0.17, 0.17]) {
        const food = displayFood(id, disposables);
        if (!food) continue;
        food.scale.setScalar(1.3);
        food.rotation.y = alongX ? 0 : Math.PI / 2;
        food.position.set(alongX ? x + offset : x, 1.19, alongX ? z : z + offset);
        group.add(food);
      }
    });
    return;
  }
  const colors: Record<string, string[]> = {
    NACHOS: ["#e8c36a", "#e67e22", "#c0392b"],
    "HOT DOGS": ["#c0392b", "#f4f1ea", "#6b8f3a"],
    BURGERS: ["#8b5a2b", "#e8c36a", "#3d7a3a"],
    DRINKS: ["#c0392b", "#1f4d8c", "#f4f1ea"],
    PRETZELS: ["#c47a2c", "#e8c36a", "#8b5a2b"],
    "ICE CREAM": ["#f4f1ea", "#d48aa8", "#7ec8e3"],
    PIZZA: ["#c0392b", "#e8c36a", "#3d7a3a"],
    PIZZERIA: ["#e8c36a", "#b83218", "#f4f1ea"],
    SWEETS: ["#e8a0d0", "#f4f1ea", "#e67e22"],
  };
  const palette = colors[name] ?? ["#e8c36a", "#c0392b", "#1f4d8c"];
  for (let i = 0; i < 3; i++) {
    const color = new THREE.Color(palette[i]);
    if (alongX) {
      const x = a + i * ((c - a) / 3);
      trim.box(x, b, x + 0.55, b + 0.45, 1.18, 1.42, color);
    } else {
      const z = b + i * ((c - b) / 3);
      trim.box(a, z, a + 0.45, z + 0.55, 1.18, 1.42, color);
    }
  }
}

function addShopSign(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  title: string,
  subtitle: string,
  bg: string,
  x: number,
  y: number,
  z: number,
  rotY: number,
  width = 4.4,
) {
  const el = document.createElement("canvas");
  el.width = 512;
  el.height = 160;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, 512, 14);
  ctx.fillRect(0, 146, 512, 14);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "bold 54px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, 256, 62);
  ctx.font = "22px sans-serif";
  ctx.fillStyle = "#ffe9b8";
  ctx.fillText(subtitle, 256, 118);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.4,
    roughness: 0.5,
  });
  const geo = new THREE.PlaneGeometry(width, 0.95);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  group.add(mesh);
  disposables.push(geo, tex, mat);
}

function addSeatBand(
  seats: MeshBuilder,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
  color: THREE.Color,
) {
  const cuts = [...AISLES].sort((a, b) => a - b);
  let cursor = x0;
  for (const aisle of cuts) {
    const gap0 = aisle - AISLE_HALF;
    const gap1 = aisle + AISLE_HALF;
    if (gap1 < x0 || gap0 > x1) continue;
    if (cursor < gap0) seats.box(cursor, z0, Math.min(gap0, x1), z1, y0, y1, color);
    cursor = Math.max(cursor, gap1);
  }
  if (cursor < x1) seats.box(cursor, z0, x1, z1, y0, y1, color);
}

function addStairFlight(floorB: MeshBuilder, trimB: MeshBuilder, x0: number, x1: number) {
  const concrete = new THREE.Color("#c5c0b6");
  const nosing = new THREE.Color("#d8d3c8");
  const rail = new THREE.Color("#dfe6ee");
  const top = topSeatY();

  for (let i = 1; i <= STAIR_STEPS; i++) {
    const t = i / STAIR_STEPS;
    const zFar = STAIR_Z1 - (STAIR_Z1 - STAIR_Z0) * ((i - 1) / STAIR_STEPS);
    const zNear = STAIR_Z1 - (STAIR_Z1 - STAIR_Z0) * t;
    const y = top * t;
    floorB.box(x0, Math.min(zNear, zFar), x1, Math.max(zNear, zFar), 0, y, concrete);
    floorB.box(x0, Math.min(zNear, zFar), x1, Math.max(zNear, zFar), y - 0.05, y, nosing);
  }

  for (let row = SEAT_ROWS - 1; row >= 0; row--) {
    const z0 = SEAT_Z0 + row * ROW_RUN;
    const z1 = z0 + ROW_RUN;
    const y = rowWalkY(row);
    floorB.box(x0, z0, x1, z1, 0, y, concrete);
    floorB.box(x0, z0, x1, z1, y - 0.05, y, nosing);
  }

  const railH = 0.92;
  for (const x of [x0 + 0.08, x1 - 0.08]) {
    for (let i = 0; i <= STAIR_STEPS; i += 2) {
      const t = i / STAIR_STEPS;
      const z = STAIR_Z1 - (STAIR_Z1 - STAIR_Z0) * t;
      const y = top * t;
      trimB.box(x - 0.04, z - 0.04, x + 0.04, z + 0.04, y, y + railH, rail);
    }
    trimB.box(x - 0.05, STAIR_Z0, x + 0.05, STAIR_Z1, top + railH - 0.06, top + railH + 0.02, rail);
    for (let row = 0; row < SEAT_ROWS; row += 2) {
      const z = SEAT_Z0 + row * ROW_RUN + ROW_RUN * 0.5;
      const y = rowWalkY(row);
      trimB.box(x - 0.04, z - 0.04, x + 0.04, z + 0.04, y, y + railH, rail);
    }
  }
}

function addBathroom(
  walls: MeshBuilder,
  trim: MeshBuilder,
  blockers: Blocker[],
  x: number,
  z: number,
) {
  const concrete = new THREE.Color(CONCRETE);
  const navy = new THREE.Color(NAVY);
  walls.box(x, z, x + 0.4, z + 5.5, 0, 3.4, concrete);
  walls.box(x + 7.6, z, x + 8, z + 5.5, 0, 3.4, concrete);
  walls.box(x, z + 5.1, x + 8, z + 5.5, 0, 3.4, concrete);
  walls.box(x, z, x + 3.1, z + 0.4, 0, 3.4, concrete);
  walls.box(x + 4.6, z, x + 8, z + 0.4, 0, 3.4, concrete);
  trim.box(x + 0.5, z + 0.2, x + 7.5, z + 0.55, 3.4, 3.55, navy);
  blockers.push({ minX: x, maxX: x + 0.4, minZ: z, maxZ: z + 5.5 });
  blockers.push({ minX: x + 7.6, maxX: x + 8, minZ: z, maxZ: z + 5.5 });
  blockers.push({ minX: x, maxX: x + 8, minZ: z + 5.1, maxZ: z + 5.5 });
  blockers.push({ minX: x, maxX: x + 3.1, minZ: z, maxZ: z + 0.4 });
  blockers.push({ minX: x + 4.6, maxX: x + 8, minZ: z, maxZ: z + 0.4 });
}

function addLockerRoom(
  walls: MeshBuilder,
  trim: MeshBuilder,
  blockers: Blocker[],
  x: number,
  z: number,
) {
  const concrete = new THREE.Color(CONCRETE);
  const navy = new THREE.Color(NAVY);
  const wood = new THREE.Color("#6b4a32");
  walls.box(x, z, x + 0.4, z + 8, 0, 3.6, concrete);
  walls.box(x + 9.6, z, x + 10, z + 8, 0, 3.6, concrete);
  walls.box(x, z + 7.6, x + 10, z + 8, 0, 3.6, concrete);
  walls.box(x, z, x + 3.2, z + 0.4, 0, 3.6, concrete);
  walls.box(x + 4.8, z, x + 10, z + 0.4, 0, 3.6, concrete);
  for (let i = 0; i < 5; i++) {
    const lx = x + 1.2 + i * 1.6;
    trim.box(lx, z + 1.4, lx + 1.1, z + 2.5, 0, 2.1, wood);
    blockers.push({ minX: lx, maxX: lx + 1.1, minZ: z + 1.4, maxZ: z + 2.5 });
  }
  trim.box(x + 1, z + 0.15, x + 9, z + 0.5, 3.6, 3.85, navy);
  blockers.push({ minX: x, maxX: x + 0.4, minZ: z, maxZ: z + 8 });
  blockers.push({ minX: x + 9.6, maxX: x + 10, minZ: z, maxZ: z + 8 });
  blockers.push({ minX: x, maxX: x + 10, minZ: z + 7.6, maxZ: z + 8 });
  blockers.push({ minX: x, maxX: x + 3.2, minZ: z, maxZ: z + 0.4 });
  blockers.push({ minX: x + 4.8, maxX: x + 10, minZ: z, maxZ: z + 0.4 });
}

function addDugout(
  walls: MeshBuilder,
  seats: MeshBuilder,
  blockers: Blocker[],
  x: number,
  z: number,
  facing: 1 | -1,
) {
  const concrete = new THREE.Color("#8e8a82");
  const bench = new THREE.Color("#4a3728");
  const x1 = x + 4;
  walls.box(x, z, x1, z + 6, 0, 1.15, concrete);
  seats.box(x + 0.3, z + 0.4, x1 - 0.3, z + 5.6, 0.45, 0.7, bench);
  if (facing > 0) blockers.push({ minX: x, maxX: x + 0.45, minZ: z, maxZ: z + 6 });
  else blockers.push({ minX: x1 - 0.45, maxX: x1, minZ: z, maxZ: z + 6 });
}

function addFloodTowers(walls: MeshBuilder, trim: MeshBuilder, blockers: Blocker[]) {
  const steel = new THREE.Color("#c5cdd6");
  const lamp = new THREE.Color("#fff4d2");
  const spots = [
    { x: -22.4, z: 13.6 },
    { x: 21.6, z: 13.6 },
    { x: -23.2, z: -16.4 },
    { x: 22.4, z: -16.4 },
  ];
  for (const spot of spots) {
    walls.box(spot.x, spot.z, spot.x + 0.55, spot.z + 0.55, 0, 15.2, steel);
    trim.box(spot.x - 0.55, spot.z - 0.35, spot.x + 1.1, spot.z + 0.9, 15.2, 16.1, lamp);
    blockers.push({ minX: spot.x, maxX: spot.x + 0.55, minZ: spot.z, maxZ: spot.z + 0.55 });
  }
}

function seatLayout(greenMonster = false) {
  const seats: { x: number; y: number; z: number }[] = [];
  for (let row = 0; row < SEAT_ROWS; row++) {
    const pad = row * ROW_RUN;
    const y = rowWalkY(row) + 0.55;
    const zNear = SEAT_Z0 + pad + 0.32;
    const zFar = FIELD_Z_FAR - pad - 0.32;
    const xInner = FIELD_HALF + pad + 0.42;
    for (let x = -16.6; x <= 16.6; x += 0.95) {
      if (inAisle(x)) continue;
      seats.push({ x, y, z: zNear });
    }
    for (let z = -15.2; z <= 13.8; z += 1.05) {
      seats.push({ x: xInner, y, z });
      // Left foul is Monster seating at Scorpion Field.
      if (!greenMonster) seats.push({ x: -xInner, y, z });
    }
    if (!greenMonster) {
      for (let x = -17.2; x <= -CF_GAP - 1.15; x += 1.05) seats.push({ x, y, z: zFar });
    }
    for (let x = CF_GAP + 1.15; x <= 17.2; x += 1.05) seats.push({ x, y, z: zFar });
  }
  return seats;
}

/** Guests on the Green Monster ledge, bleachers, and left-foul stands. */
function monsterFanSeats() {
  const seats: { x: number; y: number; z: number }[] = [];
  const wallX0 = -FIELD_HALF - 0.55;
  const wallX1 = -CF_GAP + 0.35;
  const wallZ = FIELD_Z_FAR;
  const aisleX0 = (wallX0 + wallX1) / 2 - 0.55;
  const aisleX1 = aisleX0 + 1.1;

  // Standing row along the viewing ledge (top of the wall).
  const standY = MONSTER_DECK_Y + 0.95;
  const standZ = wallZ + 0.2;
  for (let x = wallX0 + 0.7; x <= wallX1 - 0.7; x += 0.72) {
    if (x >= aisleX0 - 0.15 && x <= aisleX1 + 0.15) continue;
    seats.push({ x, y: standY, z: standZ });
  }

  // Raised bleachers behind the Monster.
  for (let row = 0; row < MONSTER_ROWS; row++) {
    const z1 = wallZ - 0.5 - row * MONSTER_ROW_RUN;
    const z0 = z1 - (MONSTER_ROW_RUN - 0.14);
    const z = z0 + 0.34;
    const y = monsterSeatWalkY(row) + 0.48;
    for (let x = wallX0 + 0.7; x <= wallX1 - 0.35; x += 0.68) {
      if (x >= aisleX0 - 0.1 && x <= aisleX1 + 0.1) continue;
      seats.push({ x, y, z });
    }
  }

  // Left-foul Monster bleachers.
  const foulX1 = -FIELD_HALF + 0.1;
  const foulZ0 = FIELD_Z_FAR + 1.4;
  const foulZ1 = SEAT_Z0 - 1.8;
  for (let row = 0; row < MONSTER_ROWS; row++) {
    const x1 = foulX1 - row * MONSTER_ROW_RUN;
    const x0 = x1 - (MONSTER_ROW_RUN - 0.1);
    const x = x0 + 0.31;
    const y = 3.55 + row * MONSTER_ROW_RISE + 0.48;
    for (let z = foulZ0 + 0.55; z <= foulZ1 - 0.55; z += 0.7) {
      seats.push({ x, y, z });
    }
  }

  return seats;
}

function buildFans(greenMonster = false) {
  const bowlSeats = seatLayout(greenMonster);
  const monsterSeats = greenMonster ? monsterFanSeats() : [];
  // Trailing block of seated fans live on the Monster — fillCrowd only shows
  // them during gametime, same capsules as the rest of the bowl.
  const monsterSlots = Math.min(monsterSeats.length, Math.floor(SEATED_FANS * 0.35));
  const monsterFanStart = SEATED_FANS - monsterSlots;
  const geo = new THREE.CapsuleGeometry(0.22, 0.72, 3, 6);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  const count = SEATED_FANS + WALKING_FANS + PLAYER_FANS;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const palettes = greenMonster
    ? ["#2a6b5a", "#c9a44c", "#1a4d3a", "#f4f1ea", "#9b2e24", "#e8c36a", "#3d5a80", "#d4a017", "#4aa3c4", "#8a4b2f"]
    : ["#1f4d8c", "#c0392b", "#f4f1ea", "#2c3e6b", "#7a2e2e", "#e8c36a", "#3d5a80", "#d4a017", "#4aa3c4", "#8a4b2f"];
  const homeAccent = greenMonster ? "#2a6b5a" : "#1f4d8c";
  const rest = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let x: number;
    let z: number;
    let y: number;
    if (i < SEATED_FANS) {
      const seat =
        i >= monsterFanStart && monsterSeats.length > 0
          ? monsterSeats[(i - monsterFanStart) % monsterSeats.length]
          : bowlSeats[i % bowlSeats.length];
      x = seat.x;
      y = seat.y;
      z = seat.z;
    } else if (i < SEATED_FANS + WALKING_FANS) {
      const n = i - SEATED_FANS;
      x = -19 + (n % 20) * 1.9;
      z = 40.6 + Math.floor(n / 20) * 1.35 + (n % 3) * 0.2;
      y = 0.97;
    } else {
      const n = i - SEATED_FANS - WALKING_FANS;
      x = n < 2 ? -14.6 : 14.6;
      z = 7.4 + (n % 2) * 1.5;
      y = 0.95;
    }
    rest[i * 3] = x;
    rest[i * 3 + 1] = y;
    rest[i * 3 + 2] = z;
    matrix.makeTranslation(x, y, z);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.set(i >= SEATED_FANS + WALKING_FANS ? homeAccent : palettes[i % palettes.length]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return { mesh, rest, monsterFanStart };
}

const NEON = ["#00e8ff", "#ff2d95", "#39ff14", "#ffe14a", "#c44dff", "#ff8c00"];

/**
 * Sell-out extras for World Series nights: fans in every bowl seat the regular
 * crowd leaves empty, plus glow sticks / neon headbands for most of the house.
 */
function buildSeriesCrowd(greenMonster = false) {
  const seats = seatLayout(greenMonster);
  const extraSeats = seats.slice(SEATED_FANS);

  const fanGeo = new THREE.CapsuleGeometry(0.22, 0.72, 3, 6);
  const fanMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  const extras = new THREE.InstancedMesh(fanGeo, fanMat, Math.max(1, extraSeats.length));
  extras.frustumCulled = false;
  extras.visible = false;
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const shirts = ["#1f4d8c", "#c0392b", "#f4f1ea", "#2c3e6b", "#e8c36a", "#3d5a80", "#d4a017", "#4aa3c4", "#2a6b5a", "#3d7ea6"];
  extraSeats.forEach((seat, i) => {
    matrix.makeTranslation(seat.x, seat.y, seat.z);
    extras.setMatrixAt(i, matrix);
    extras.setColorAt(i, color.set(shirts[(i * 7) % shirts.length]));
  });
  extras.instanceMatrix.needsUpdate = true;
  if (extras.instanceColor) extras.instanceColor.needsUpdate = true;

  const glowing = seats.filter((_, i) => ((i * 2654435761) >>> 0) % 100 < 62);
  const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const stickGeo = new THREE.BoxGeometry(0.06, 0.46, 0.06);
  stickGeo.translate(0, 0.23, 0);
  const sticks = new THREE.InstancedMesh(stickGeo, neonMat, Math.max(1, glowing.length));
  const bandGeo = new THREE.TorusGeometry(0.21, 0.035, 5, 14);
  bandGeo.rotateX(Math.PI / 2);
  const bands = new THREE.InstancedMesh(bandGeo, neonMat, Math.max(1, glowing.length));
  const neonRest = new Float32Array(glowing.length * 3);
  for (const mesh of [sticks, bands]) {
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  glowing.forEach((seat, i) => {
    neonRest[i * 3] = seat.x;
    neonRest[i * 3 + 1] = seat.y;
    neonRest[i * 3 + 2] = seat.z;
    color.set(NEON[i % NEON.length]);
    sticks.setColorAt(i, color);
    bands.setColorAt(i, color.set(NEON[(i + 3) % NEON.length]));
    matrix.makeTranslation(seat.x, seat.y + 0.44, seat.z);
    bands.setMatrixAt(i, matrix);
    matrix.makeTranslation(seat.x + 0.2, seat.y + 0.3, seat.z);
    sticks.setMatrixAt(i, matrix);
  });
  for (const mesh of [sticks, bands]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return {
    extras,
    sticks,
    bands,
    neonRest,
    neonCount: glowing.length,
    dispose() {
      fanGeo.dispose();
      fanMat.dispose();
      neonMat.dispose();
      stickGeo.dispose();
      bandGeo.dispose();
    },
  };
}
