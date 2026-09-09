import * as THREE from "three";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";

export interface StadiumInterior {
  group: THREE.Group;
  blockers: Blocker[];
  spawn: { x: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  scoreboard: THREE.MeshStandardMaterial;
  fans: THREE.InstancedMesh;
  groundAt: (x: number, z: number) => number;
  dispose: () => void;
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
const FIELD_STAIR_Z0 = SEAT_Z0 - 4.4;
const FIELD_HALF = 18;
const FIELD_Z_FAR = -19;
const CF_GAP = 7.2;
const SEATED_FANS = 52;
const WALKING_FANS = 24;
const PLAYER_FANS = 4;

export const STADIUM_FAN_WALK_START = SEATED_FANS;

function rowWalkY(row: number) {
  return STAND_CLEAR + SEAT_THICK + row * ROW_RISE;
}

function topSeatY() {
  return rowWalkY(SEAT_ROWS - 1);
}

function inAisle(x: number) {
  return AISLES.some((ax) => Math.abs(x - ax) <= AISLE_HALF);
}

function seatRowAtZ(z: number) {
  const t = (z - SEAT_Z0) / ROW_RUN;
  return Math.max(0, Math.min(SEAT_ROWS - 1, Math.floor(t + 0.001)));
}

/** Walkable height: concourse, stairs onto the deck, then the rake of the seats. */
export function stadiumGroundAt(x: number, z: number) {
  const top = topSeatY();
  if (inAisle(x) && z >= STAIR_Z0 && z <= STAIR_Z1) {
    const t = (STAIR_Z1 - z) / (STAIR_Z1 - STAIR_Z0);
    const step = Math.min(STAIR_STEPS, Math.max(1, Math.ceil(t * STAIR_STEPS)));
    return (top * step) / STAIR_STEPS;
  }
  if (inAisle(x) && z >= FIELD_STAIR_Z0 && z < SEAT_Z0) {
    const t = (z - FIELD_STAIR_Z0) / (SEAT_Z0 - FIELD_STAIR_Z0);
    return rowWalkY(0) * Math.max(0, Math.min(1, t));
  }
  const seatEnd = SEAT_Z0 + SEAT_ROWS * ROW_RUN;
  if (z >= SEAT_Z0 && z <= seatEnd && Math.abs(x) <= FIELD_HALF + SEAT_ROWS * ROW_RUN) {
    return rowWalkY(seatRowAtZ(z));
  }
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
export function buildStadiumInterior(): StadiumInterior {
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

    seatB.box(-xInner - run, zFar, -xInner, zNear, y0, y1, scratch);
    seatB.box(-xInner - 0.14, zFar, -xInner, zNear, prevY, y1, scratch);

    seatB.box(-xInner, zFar - run, -CF_GAP, zFar, y0, y1, scratch);
    seatB.box(CF_GAP, zFar - run, xInner, zFar, y0, y1, scratch);
    seatB.box(-xInner, zFar - 0.14, -CF_GAP, zFar, prevY, y1, scratch);
    seatB.box(CF_GAP, zFar - 0.14, xInner, zFar, prevY, y1, scratch);
  }

  const fasciaH = topSeatY() + 2.4;
  wallB.box(-ox - 0.55, ozFar - 0.55, -CF_GAP, ozFar, 0, fasciaH, ivy);
  wallB.box(CF_GAP, ozFar - 0.55, ox + 0.55, ozFar, 0, fasciaH, ivy);
  wallB.box(-ox - 0.55, ozFar, -ox, ozNear, 0, fasciaH, navy);
  wallB.box(ox, ozFar, ox + 0.55, ozNear, 0, fasciaH, navy);

  // Inner field walls so the bowl meets the grass instead of open sky.
  const lip = STAND_CLEAR + 0.35;
  addSeatBand(wallB, -FIELD_HALF, FIELD_HALF, SEAT_Z0 - 0.5, SEAT_Z0 + 0.22, 0, lip, fieldWall);
  wallB.box(FIELD_HALF - 0.22, FIELD_Z_FAR, FIELD_HALF + 0.42, SEAT_Z0, 0, lip, ivy);
  wallB.box(-FIELD_HALF - 0.42, FIELD_Z_FAR, -FIELD_HALF + 0.22, SEAT_Z0, 0, lip, ivy);
  wallB.box(-FIELD_HALF, FIELD_Z_FAR - 0.42, -CF_GAP, FIELD_Z_FAR + 0.22, 0, lip, ivy);
  wallB.box(CF_GAP, FIELD_Z_FAR - 0.42, FIELD_HALF, FIELD_Z_FAR + 0.22, 0, lip, ivy);
  wallB.box(-CF_GAP, FIELD_Z_FAR - 0.42, CF_GAP, FIELD_Z_FAR + 0.22, 0, 1.45, ivy);

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
  scratch.set("#12171c");
  wallB.box(-10, boardZ, 10, boardZ + 2.4, 0, 14, scratch);
  blockers.push({ minX: -10, maxX: 10, minZ: boardZ, maxZ: boardZ + 2.4 });
  const boardGeo = new THREE.PlaneGeometry(18, 8);
  const boardMat = new THREE.MeshStandardMaterial({
    color: "#111",
    emissive: new THREE.Color("#1a3a12"),
    emissiveIntensity: 0.8,
    roughness: 0.4,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(0, 9.2, boardZ + 2.42);
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
  ];
  for (const shop of shops) {
    addShop(wallB, trimB, blockers, group, disposables, shop);
  }

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

  const fans = buildFans();
  group.add(fans);
  disposables.push(fans.geometry);
  disposables.push(fans.material as THREE.Material);

  return {
    group,
    blockers,
    spawn: { x: 0, z: 40.4, yaw: 0, pitch: -0.18 },
    bounds: { minX, maxX, minZ, maxZ },
    scoreboard: boardMat,
    fans,
    groundAt: stadiumGroundAt,
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
) {
  const depth = spec.depth ?? 3.35;
  const width = spec.width ?? 5.6;
  const h = 2.52;
  const concrete = new THREE.Color(CONCRETE);
  const accent = new THREE.Color(spec.color);
  const counter = new THREE.Color("#3d342c");

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
  blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });

  const awning = 0.7;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  let signX = cx;
  let signZ = cz;
  let rotY = 0;
  if (spec.face === "x+") {
    trim.box(x1, z0 + 0.12, x1 + awning, z1 - 0.12, 1.95, 2.22, accent);
    trim.box(x1 - 0.08, z0 + 0.3, x1 + 0.12, z1 - 0.3, 1.02, 1.16, counter);
    addFoodProps(trim, spec.name, x1 - 0.45, z0 + 0.6, z1 - 0.6);
    signX = x1 + 0.1;
    signZ = cz;
    rotY = -Math.PI / 2;
  } else if (spec.face === "x-") {
    trim.box(x0 - awning, z0 + 0.12, x0, z1 - 0.12, 1.95, 2.22, accent);
    trim.box(x0 - 0.12, z0 + 0.3, x0 + 0.08, z1 - 0.3, 1.02, 1.16, counter);
    addFoodProps(trim, spec.name, x0 + 0.2, z0 + 0.6, z1 - 0.6);
    signX = x0 - 0.1;
    signZ = cz;
    rotY = Math.PI / 2;
  } else if (spec.face === "z+") {
    trim.box(x0 + 0.12, z1, x1 - 0.12, z1 + awning, 1.95, 2.22, accent);
    trim.box(x0 + 0.3, z1 - 0.08, x1 - 0.3, z1 + 0.12, 1.02, 1.16, counter);
    addFoodProps(trim, spec.name, x0 + 0.6, z1 - 0.45, x1 - 0.6, true);
    signX = cx;
    signZ = z1 + 0.1;
    rotY = 0;
  } else {
    trim.box(x0 + 0.12, z0 - awning, x1 - 0.12, z0, 1.95, 2.22, accent);
    trim.box(x0 + 0.3, z0 - 0.12, x1 - 0.3, z0 + 0.08, 1.02, 1.16, counter);
    signX = cx;
    signZ = z0 - 0.1;
    rotY = Math.PI;
  }

  addShopSign(group, disposables, spec.name, spec.menu, spec.color, signX, 2.38, signZ, rotY, width * 0.82);
}

function addFoodProps(trim: MeshBuilder, name: string, a: number, b: number, c: number, alongX = false) {
  const colors: Record<string, string[]> = {
    NACHOS: ["#e8c36a", "#e67e22", "#c0392b"],
    "HOT DOGS": ["#c0392b", "#f4f1ea", "#6b8f3a"],
    BURGERS: ["#8b5a2b", "#e8c36a", "#3d7a3a"],
    DRINKS: ["#c0392b", "#1f4d8c", "#f4f1ea"],
    PRETZELS: ["#c47a2c", "#e8c36a", "#8b5a2b"],
    "ICE CREAM": ["#f4f1ea", "#d48aa8", "#7ec8e3"],
    PIZZA: ["#c0392b", "#e8c36a", "#3d7a3a"],
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

  const fieldTop = rowWalkY(0);
  const fieldSteps = 8;
  for (let i = 1; i <= fieldSteps; i++) {
    const t = i / fieldSteps;
    const zFar = SEAT_Z0 - (SEAT_Z0 - FIELD_STAIR_Z0) * ((i - 1) / fieldSteps);
    const zNear = SEAT_Z0 - (SEAT_Z0 - FIELD_STAIR_Z0) * t;
    const y = fieldTop * (1 - (i - 1) / fieldSteps);
    floorB.box(x0, Math.min(zNear, zFar), x1, Math.max(zNear, zFar), 0, Math.max(0.08, y), concrete);
    floorB.box(x0, Math.min(zNear, zFar), x1, Math.max(zNear, zFar), Math.max(0.08, y) - 0.05, Math.max(0.08, y), nosing);
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

function buildFans() {
  const geo = new THREE.CapsuleGeometry(0.24, 0.78, 3, 6);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  const count = SEATED_FANS + WALKING_FANS + PLAYER_FANS;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const palettes = ["#1f4d8c", "#c0392b", "#f4f1ea", "#2c3e6b", "#7a2e2e", "#e8c36a", "#3d5a80", "#d4a017"];
  const fieldSpots = [
    [0, 8.6],
    [7.6, 9],
    [-7.6, 9],
    [0, 16.8],
  ];
  for (let i = 0; i < count; i++) {
    let x: number;
    let z: number;
    let y: number;
    if (i < SEATED_FANS) {
      const row = i % SEAT_ROWS;
      const section = Math.floor(i / SEAT_ROWS) % 4;
      const along = Math.floor(i / 4) % 12;
      const pad = row * ROW_RUN;
      const xInner = FIELD_HALF + pad + 0.4;
      const zNear = SEAT_Z0 + pad + 0.28;
      const zFar = FIELD_Z_FAR - pad - 0.28;
      y = rowWalkY(row) + 0.55;
      if (section === 0) {
        x = -15 + along * 2.7 + (i % 2) * 0.35;
        if (inAisle(x)) x += 2.1;
        z = zNear;
      } else if (section === 1) {
        x = xInner;
        z = -15 + along * 2.5;
      } else if (section === 2) {
        x = -xInner;
        z = -15 + along * 2.5;
      } else {
        x = -16 + along * 2.6;
        if (Math.abs(x) < CF_GAP) x = x < 0 ? -CF_GAP - 1.2 : CF_GAP + 1.2;
        z = zFar;
      }
    } else if (i < SEATED_FANS + WALKING_FANS) {
      const n = i - SEATED_FANS;
      x = -18 + n * 1.55;
      z = 41.4 + ((n * 2) % 4) * 0.28;
      y = 0.97;
    } else {
      const spot = fieldSpots[i - SEATED_FANS - WALKING_FANS];
      x = spot[0];
      z = spot[1];
      y = 0.95;
    }
    matrix.makeTranslation(x, y, z);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.set(i >= SEATED_FANS + WALKING_FANS ? "#1f4d8c" : palettes[i % palettes.length]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
