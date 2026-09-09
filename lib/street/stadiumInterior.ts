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
const STAIR_STEPS = 16;
const STAIR_Z1 = 31.1;
const STAIR_Z0 = SEAT_Z0 + (SEAT_ROWS - 1) * ROW_RUN + 0.55;

function rowWalkY(row: number) {
  return SEAT_THICK + row * ROW_RISE;
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

/** Walkable height: concourse, stairs, then the rake of the home-plate seats. */
export function stadiumGroundAt(x: number, z: number) {
  const top = topSeatY();
  if (inAisle(x) && z >= STAIR_Z0 && z <= STAIR_Z1) {
    const t = (STAIR_Z1 - z) / (STAIR_Z1 - STAIR_Z0);
    const step = Math.min(STAIR_STEPS, Math.max(1, Math.ceil(t * STAIR_STEPS)));
    return (top * step) / STAIR_STEPS;
  }
  const seatEnd = SEAT_Z0 + SEAT_ROWS * ROW_RUN;
  if (z >= SEAT_Z0 && z <= seatEnd) return rowWalkY(seatRowAtZ(z));
  return 0;
}

const GREEN = "#2f7a3e";
const DIRT = "#c4a56a";
const CONCRETE = "#b9b3a8";
const NAVY = "#1f4d8c";
const SEAT = "#c0392b";
const GOLD = "#e8c36a";

/**
 * A walkable ballpark: concourse behind home plate, seating bowl, field,
 * dugouts, scoreboard, and service rooms under the stands.
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
  const minZ = -32;
  const maxZ = 44;

  // ─── Concourse (behind home plate, +z) ─────────────────────────────────────
  scratch.set(CONCRETE);
  floorB.ground(minX, 26, maxX, maxZ, 0, scratch);
  wallB.box(minX, 26, minX + 0.7, maxZ, 0, 6.5, scratch);
  wallB.box(maxX - 0.7, 26, maxX, maxZ, 0, 6.5, scratch);
  wallB.box(minX, maxZ - 0.7, maxX, maxZ, 0, 6.5, scratch);
  blockers.push({ minX, maxX: minX + 0.7, minZ: 26, maxZ });
  blockers.push({ minX: maxX - 0.7, maxX, minZ: 26, maxZ });
  blockers.push({ minX, maxX, minZ: maxZ - 0.7, maxZ });

  addConcession(wallB, trimB, blockers, -22, 34);
  addConcession(wallB, trimB, blockers, -8, 34);
  addBathroom(wallB, trimB, blockers, 10, 33);
  addLockerRoom(wallB, trimB, blockers, 22, 32);

  // ─── Field ─────────────────────────────────────────────────────────────────
  scratch.set(GREEN);
  floorB.ground(-22, -22, 22, 20, 0, scratch);
  scratch.set(DIRT);
  // Infield diamond, home plate toward +z.
  floorB.ground(-9, 2, 9, 16, 0.03, scratch);
  floorB.ground(-2.2, 14.5, 2.2, 18.2, 0.04, scratch);
  // Mound.
  scratch.set("#b7925c");
  floorB.ground(-1.3, 7.2, 1.3, 10.2, 0.18, scratch);
  // Bases.
  scratch.set("#f4f1ea");
  floorB.ground(-0.45, 16.6, 0.45, 17.5, 0.06, scratch);
  floorB.ground(7.4, 8.6, 8.3, 9.5, 0.06, scratch);
  floorB.ground(-8.3, 8.6, -7.4, 9.5, 0.06, scratch);
  floorB.ground(-0.45, 1.6, 0.45, 2.5, 0.06, scratch);
  // Foul lines.
  scratch.set("#f2eee6");
  floorB.ground(-0.12, -18, 0.12, 17, 0.05, scratch);

  // Dugouts.
  addDugout(wallB, seatB, blockers, -16.5, 6, 1);
  addDugout(wallB, seatB, blockers, 12.5, 6, -1);

  // Warning track.
  scratch.set("#b7925c");
  floorB.ground(-22, -22, 22, -20.2, 0.02, scratch);

  // ─── Seating bowl ──────────────────────────────────────────────────────────
  for (let row = 0; row < SEAT_ROWS; row++) {
    const y = rowWalkY(row) - SEAT_THICK;
    const zNear = SEAT_Z0 + row * ROW_RUN;
    const zFar = zNear + ROW_RUN - 0.06;
    scratch.set(row % 2 === 0 ? SEAT : "#9b2e24");
    addSeatBand(seatB, -21 + row * 0.12, 21 - row * 0.12, zNear, zFar, y, y + SEAT_THICK, scratch);
    seatB.box(16.1 + row * 0.7, -18, 16.8 + row * 0.7, 16, y, y + SEAT_THICK, scratch);
    seatB.box(-16.8 - row * 0.7, -18, -16.1 - row * 0.7, 16, y, y + SEAT_THICK, scratch);
    seatB.box(-21 + row * 0.12, -23 - row * 0.5, 21 - row * 0.12, -22.3 - row * 0.5, y, y + SEAT_THICK, scratch);
  }

  for (const ax of AISLES) {
    addStairFlight(floorB, trimB, ax - AISLE_HALF, ax + AISLE_HALF);
  }

  // ─── Scoreboard in center field ────────────────────────────────────────────
  scratch.set("#12171c");
  wallB.box(-10, -28, 10, -25.4, 0, 14, scratch);
  blockers.push({ minX: -10, maxX: 10, minZ: -28, maxZ: -25.4 });
  const boardGeo = new THREE.PlaneGeometry(18, 8);
  const boardMat = new THREE.MeshStandardMaterial({
    color: "#111",
    emissive: new THREE.Color("#1a3a12"),
    emissiveIntensity: 0.8,
    roughness: 0.4,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(0, 9.2, -25.38);
  group.add(board);
  disposables.push(boardGeo);

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
    spawn: { x: 0, z: 33.2, yaw: 0, pitch: -0.22 },
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

  // Climb from the concourse up to the back row.
  for (let i = 1; i <= STAIR_STEPS; i++) {
    const t = i / STAIR_STEPS;
    const zFar = STAIR_Z1 - (STAIR_Z1 - STAIR_Z0) * ((i - 1) / STAIR_STEPS);
    const zNear = STAIR_Z1 - (STAIR_Z1 - STAIR_Z0) * t;
    const y = top * t;
    floorB.box(x0, Math.min(zNear, zFar), x1, Math.max(zNear, zFar), 0, y, concrete);
    floorB.box(x0, Math.min(zNear, zFar), x1, Math.max(zNear, zFar), y - 0.05, y, nosing);
  }

  // Then step down through each seating row toward the field.
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

function addConcession(
  walls: MeshBuilder,
  trim: MeshBuilder,
  blockers: Blocker[],
  x: number,
  z: number,
) {
  const w = 8;
  const d = 4.2;
  const concrete = new THREE.Color(CONCRETE);
  const navy = new THREE.Color(NAVY);
  const gold = new THREE.Color(GOLD);
  walls.box(x, z, x + w, z + 0.45, 0, 3.2, concrete);
  walls.box(x, z, x + 0.45, z + d, 0, 3.2, concrete);
  walls.box(x + w - 0.45, z, x + w, z + d, 0, 3.2, concrete);
  trim.box(x + 0.5, z + 0.5, x + w - 0.5, z + 1.6, 1.1, 2.2, navy);
  trim.box(x + 1, z + 0.2, x + w - 1, z + 0.55, 3.2, 3.55, gold);
  blockers.push({ minX: x, maxX: x + w, minZ: z, maxZ: z + d * 0.55 });
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
  const count = 64;
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
    if (i < 36) {
      const row = i % SEAT_ROWS;
      x = -18 + (i % 9) * 4.1 + (i % 2) * 0.45;
      if (inAisle(x)) x += 2.2;
      z = SEAT_Z0 + row * ROW_RUN + 0.3;
      y = rowWalkY(row) + 0.55;
    } else if (i < 60) {
      x = -18 + (i - 36) * 1.55;
      z = 32.6 + ((i * 2) % 4) * 0.28;
      y = 0.97;
    } else {
      const spot = fieldSpots[i - 60];
      x = spot[0];
      z = spot[1];
      y = 0.95;
    }
    matrix.makeTranslation(x, y, z);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.set(i >= 60 ? "#1f4d8c" : palettes[i % palettes.length]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
