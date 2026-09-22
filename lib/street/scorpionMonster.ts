import * as THREE from "three";
import type { Building } from "@/lib/city/types";
import type { Blocker } from "./buildCity";
import type { MeshBuilder } from "./meshBuilder";

/** Fenway-style left-field wall — Scorpion Field only. */
export const MONSTER_H = 11.2;
export const MONSTER_GREEN = "#1f6b2e";
export const MONSTER_GREEN_DEEP = "#145022";
export const MONSTER_LADDER = "#c9a44c";
export const MONSTER_SEAT = "#1a4d3a";
export const MONSTER_SEAT_ALT = "#c9a44c";
export const MONSTER_ROWS = 5;
export const MONSTER_ROW_RISE = 0.62;
export const MONSTER_ROW_RUN = 1.05;
/** Walkable deck sitting above the wall so eyes clear the parapet. */
export const MONSTER_DECK_Y = MONSTER_H + 0.72;

export function hasGreenMonster(building: Building) {
  if (building.kind !== "baseball_stadium") return false;
  if (building.name === "Scorpion Field") return true;
  const team = building.stats.extra?.team;
  return typeof team === "string" && team.toLowerCase().includes("scorpion");
}

export function monsterSeatWalkY(row: number) {
  return MONSTER_DECK_Y + 0.15 + row * MONSTER_ROW_RISE;
}

/** Walk height for Monster seats / left-field bleachers, or null if elsewhere. */
export function monsterGroundAt(
  x: number,
  z: number,
  opts: { fieldHalf: number; fieldZFar: number; cfGap: number; seatZ0: number },
): number | null {
  const { fieldHalf, fieldZFar, cfGap, seatZ0 } = opts;
  const wallX0 = -fieldHalf - 0.55;
  const wallX1 = -cfGap + 0.35;
  const wallZ = fieldZFar;

  // Narrow cap on the Monster — just enough to stand at the rail.
  if (x >= wallX0 + 0.2 && x <= wallX1 - 0.2 && z >= wallZ - 0.45 && z <= wallZ + 0.72) {
    return MONSTER_DECK_Y;
  }

  // Stairs: high at the Monster deck, low toward the foul aisle (+Z).
  const stairX0 = wallX0 + 0.35;
  const stairX1 = wallX0 + 1.55;
  const stairZ0 = wallZ + 0.55;
  const stairZ1 = wallZ + 0.55 + 14 * 0.42;
  if (x >= stairX0 && x <= stairX1 && z >= stairZ0 && z <= stairZ1) {
    const t = Math.max(0, Math.min(1, (z - stairZ0) / (stairZ1 - stairZ0)));
    return MONSTER_DECK_Y - (MONSTER_DECK_Y - 3.4) * t;
  }

  // Bleachers stacked immediately behind the wall (−Z).
  const bleacherZ0 = wallZ - 0.5 - MONSTER_ROWS * MONSTER_ROW_RUN;
  const bleacherZ1 = wallZ - 0.4;
  if (x >= wallX0 - 0.1 && x <= wallX1 + 0.4 && z >= bleacherZ0 && z <= bleacherZ1) {
    const fromFront = bleacherZ1 - z;
    const row = Math.min(MONSTER_ROWS - 1, Math.max(0, Math.floor(fromFront / MONSTER_ROW_RUN)));
    return monsterSeatWalkY(row);
  }

  // Left-field foul-line bleachers (third-base side).
  const foulX1 = -fieldHalf + 0.15;
  const foulX0 = foulX1 - MONSTER_ROWS * MONSTER_ROW_RUN - 0.4;
  const foulZ0 = wallZ + 1.2;
  const foulZ1 = seatZ0 - 1.5;
  if (x >= foulX0 && x <= foulX1 && z >= foulZ0 && z <= foulZ1) {
    const fromField = foulX1 - x;
    const row = Math.min(MONSTER_ROWS - 1, Math.max(0, Math.floor(fromField / MONSTER_ROW_RUN)));
    return 3.4 + row * MONSTER_ROW_RISE;
  }

  return null;
}

/**
 * Tall left-field wall inside the walkable park. Home faces −Z; left field is −X.
 */
export function addGreenMonsterInterior(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  opts: {
    fieldHalf: number;
    fieldZFar: number;
    seatZ0: number;
    cfGap: number;
  },
) {
  const { fieldHalf, fieldZFar, seatZ0, cfGap } = opts;
  const green = new THREE.Color(MONSTER_GREEN);
  const deep = new THREE.Color(MONSTER_GREEN_DEEP);
  const ladder = new THREE.Color(MONSTER_LADDER);
  const cream = new THREE.Color("#f4f1ea");
  const ink = new THREE.Color("#1a1206");

  const x0 = -fieldHalf - 0.55;
  const x1 = -cfGap + 0.35;
  const z0 = fieldZFar - 0.55;
  const z1 = fieldZFar + 0.55;
  wallB.box(x0, z0, x1, z1, 0, MONSTER_H, green);
  for (let i = 0; i < 5; i++) {
    const t0 = i / 5;
    const t1 = (i + 1) / 5;
    const px0 = x0 + (x1 - x0) * t0 + 0.12;
    const px1 = x0 + (x1 - x0) * t1 - 0.12;
    wallB.box(px0, z1 - 0.02, px1, z1 + 0.08, 0.35, MONSTER_H - 0.4, i % 2 === 0 ? deep : green);
  }
  blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 + 0.15 });

  const foulZ1 = fieldZFar + (seatZ0 - fieldZFar) * 0.42;
  wallB.box(x0, fieldZFar + 0.5, x0 + 0.7, foulZ1, 0, MONSTER_H * 0.72, green);
  blockers.push({ minX: x0, maxX: x0 + 0.7, minZ: fieldZFar + 0.5, maxZ: foulZ1 });

  trimB.box(x0 - 0.08, z0 - 0.08, x1 + 0.08, z1 + 0.12, MONSTER_H - 0.18, MONSTER_H, cream);
  const midX = (x0 + x1) / 2;
  for (let i = 0; i < 9; i++) {
    const y0 = 0.6 + i * 1.05;
    trimB.box(midX - 0.55, z1 + 0.05, midX - 0.4, z1 + 0.18, y0, y0 + 0.85, ladder);
    trimB.box(midX + 0.4, z1 + 0.05, midX + 0.55, z1 + 0.18, y0, y0 + 0.85, ladder);
    trimB.box(midX - 0.55, z1 + 0.05, midX + 0.55, z1 + 0.16, y0 + 0.75, y0 + 0.9, ladder);
  }
  trimB.box(x0 + 0.35, z1 + 0.1, x0 + 3.4, z1 + 0.22, MONSTER_H * 0.42, MONSTER_H * 0.78, cream);
  trimB.box(x0 + 0.5, z1 + 0.22, x0 + 3.25, z1 + 0.28, MONSTER_H * 0.46, MONSTER_H * 0.74, ink);
  trimB.box(x1 - 2.8, z1 + 0.1, x1 - 0.4, z1 + 0.2, 1.1, 2.85, cream);
  trimB.box(x1 - 2.55, z1 + 0.2, x1 - 0.65, z1 + 0.26, 1.35, 2.6, ink);
}

/**
 * Fenway-style Monster seats: open viewing gallery on the wall, short-backed
 * seats set back so the field stays in sight, plus left-foul bleachers.
 */
export function addMonsterSeating(
  seatB: MeshBuilder,
  floorB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  opts: {
    fieldHalf: number;
    fieldZFar: number;
    seatZ0: number;
    cfGap: number;
  },
) {
  const { fieldHalf, fieldZFar, seatZ0, cfGap } = opts;
  const seat = new THREE.Color(MONSTER_SEAT);
  const seatAlt = new THREE.Color(MONSTER_SEAT_ALT);
  const deck = new THREE.Color("#2a3a32");
  const rail = new THREE.Color("#e8eef4");
  const concrete = new THREE.Color("#b9b3a8");
  const wallX0 = -fieldHalf - 0.55;
  const wallX1 = -cfGap + 0.35;
  const wallZ = fieldZFar;

  // Tight viewing ledge on the wall top — rail at your toes, little floor in view.
  floorB.ground(wallX0 + 0.15, wallZ - 0.45, wallX1 - 0.15, wallZ + 0.7, MONSTER_DECK_Y, deck);
  trimB.box(wallX0 + 0.15, wallZ + 0.55, wallX1 - 0.15, wallZ + 0.68, MONSTER_DECK_Y, MONSTER_DECK_Y + 0.38, rail);
  for (let i = 0; i < 7; i++) {
    const px = wallX0 + 0.4 + i * ((wallX1 - wallX0 - 0.8) / 6);
    trimB.box(px - 0.04, wallZ + 0.55, px + 0.04, wallZ + 0.68, MONSTER_DECK_Y, MONSTER_DECK_Y + 0.38, rail);
  }

  // Bleachers start right behind the ledge (no empty promenade).
  for (let row = 0; row < MONSTER_ROWS; row++) {
    const z1 = wallZ - 0.5 - row * MONSTER_ROW_RUN;
    const z0 = z1 - (MONSTER_ROW_RUN - 0.14);
    const yWalk = monsterSeatWalkY(row);
    const y0 = yWalk - 0.32;
    const color = row % 2 === 0 ? seat : seatAlt;
    floorB.ground(wallX0 + 0.2, z0, wallX1 + 0.15, z1, yWalk, concrete);
    addSeatRowAlongX(
      seatB,
      trimB,
      wallX0 + 0.55,
      wallX1 - 0.2,
      z0 + 0.12,
      z0 + 0.55,
      y0,
      color,
      color,
      0.28,
      true,
    );
    seatB.box(wallX0 + 0.2, z1 - 0.08, wallX1 + 0.15, z1, y0 - 0.1, yWalk, concrete);
  }
  const backZ = wallZ - 0.5 - MONSTER_ROWS * MONSTER_ROW_RUN;
  const topY = monsterSeatWalkY(MONSTER_ROWS - 1);
  trimB.box(wallX0 + 0.15, backZ, wallX0 + 0.28, wallZ + 0.2, MONSTER_DECK_Y, topY + 0.7, rail);
  trimB.box(wallX1 - 0.05, backZ, wallX1 + 0.1, wallZ + 0.2, MONSTER_DECK_Y, topY + 0.7, rail);

  const aisleX0 = (wallX0 + wallX1) / 2 - 0.55;
  const aisleX1 = aisleX0 + 1.1;
  for (let row = 0; row < MONSTER_ROWS; row++) {
    const z1 = wallZ - 0.5 - row * MONSTER_ROW_RUN;
    const z0 = z1 - MONSTER_ROW_RUN;
    const y = monsterSeatWalkY(row);
    floorB.box(aisleX0, z0, aisleX1, z1, y - 0.05, y, concrete);
  }

  // Stairs from the Monster deck down toward the foul aisle.
  const stairX0 = wallX0 + 0.35;
  const stairX1 = wallX0 + 1.55;
  const stairSteps = 14;
  const stairZ0 = wallZ + 0.55;
  const stairZ1 = wallZ + 0.55 + stairSteps * 0.42;
  for (let i = 0; i < stairSteps; i++) {
    const y = MONSTER_DECK_Y - (MONSTER_DECK_Y - 3.4) * ((i + 1) / stairSteps);
    const zA = stairZ0 + i * 0.42;
    const zB = zA + 0.4;
    floorB.box(stairX0, zA, stairX1, zB, y - 0.08, y, concrete);
  }
  trimB.box(stairX0 - 0.06, stairZ0, stairX0 + 0.06, stairZ1, 3.4, MONSTER_DECK_Y + 0.55, rail);
  trimB.box(stairX1 - 0.06, stairZ0, stairX1 + 0.06, stairZ1, 3.4, MONSTER_DECK_Y + 0.55, rail);

  // Left-foul bleachers with short backs and a front walk strip toward the field.
  const foulX1 = -fieldHalf + 0.1;
  const foulZ0 = fieldZFar + 1.4;
  const foulZ1 = seatZ0 - 1.8;
  const foulRows = MONSTER_ROWS;
  for (let row = 0; row < foulRows; row++) {
    const x1 = foulX1 - row * MONSTER_ROW_RUN;
    const x0 = x1 - (MONSTER_ROW_RUN - 0.1);
    const yWalk = 3.55 + row * MONSTER_ROW_RISE;
    const y0 = yWalk - 0.32;
    const color = row % 2 === 0 ? seat : new THREE.Color("#9b2e24");
    floorB.ground(x0, foulZ0, x1, foulZ1, yWalk, concrete);
    addSeatRowAlongZ(seatB, trimB, x0 + 0.12, x0 + 0.5, foulZ0 + 0.35, foulZ1 - 0.35, y0, color, 0.28);
    seatB.box(x1 - 0.08, foulZ0, x1, foulZ1, y0 - 0.1, yWalk, concrete);
  }
  for (const az of [-8, 0, 8]) {
    if (az < foulZ0 + 1 || az > foulZ1 - 1) continue;
    const yTop = 3.55 + (foulRows - 1) * MONSTER_ROW_RISE;
    floorB.box(foulX1 - foulRows * MONSTER_ROW_RUN, az - 0.55, foulX1, az + 0.55, 3.35, yTop, concrete);
  }
  trimB.box(
    foulX1 - foulRows * MONSTER_ROW_RUN - 0.05,
    foulZ0,
    foulX1 - foulRows * MONSTER_ROW_RUN + 0.1,
    foulZ1,
    3.55,
    3.55 + (foulRows - 1) * MONSTER_ROW_RISE + 0.7,
    rail,
  );
  void blockers;
}

function addSeatRowAlongX(
  seatB: MeshBuilder,
  trimB: MeshBuilder,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  color: THREE.Color,
  alt: THREE.Color,
  backH: number,
  /** When true, seat back sits on the rear edge away from the field. */
  backAtRear = false,
) {
  const seatW = 0.58;
  const gap = 0.1;
  let x = x0;
  let i = 0;
  const divider = new THREE.Color("#2c2c2c");
  // Field is +Z from the Monster; "rear" = away from the diamond (−Z).
  const backZ0 = backAtRear ? z0 : z1 - 0.1;
  const backZ1 = backAtRear ? z0 + 0.1 : z1;
  while (x + seatW <= x1) {
    const c = i % 3 === 1 ? alt : color;
    seatB.box(x, z0, x + seatW, z1, y0, y0 + 0.28, c);
    seatB.box(x, backZ0, x + seatW, backZ1, y0 + 0.22, y0 + 0.22 + backH, c);
    trimB.box(x - 0.025, z0, x + 0.025, z1, y0, y0 + 0.38, divider);
    x += seatW + gap;
    i += 1;
  }
}

function addSeatRowAlongZ(
  seatB: MeshBuilder,
  trimB: MeshBuilder,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  color: THREE.Color,
  backH: number,
) {
  const seatW = 0.58;
  const gap = 0.12;
  let z = z0;
  const divider = new THREE.Color("#2c2c2c");
  while (z + seatW <= z1) {
    seatB.box(x0, z, x1, z + seatW, y0, y0 + 0.28, color);
    // Back on the outer (−X) edge so the field (+X) stays open.
    seatB.box(x0, z, x0 + 0.1, z + seatW, y0 + 0.22, y0 + 0.22 + backH, color);
    trimB.box(x0, z - 0.025, x1, z + 0.025, y0, y0 + 0.36, divider);
    z += seatW + gap;
  }
}

/** Street-view / city mesh: tall green slab on the park’s west–south corner. */
export function addGreenMonsterExterior(
  building: Building,
  walls: MeshBuilder,
  trimB: MeshBuilder,
  tile: number,
) {
  const x0 = building.origin.x * tile + 0.35;
  const z0 = building.origin.y * tile + 0.35;
  const x1 = (building.origin.x + building.width) * tile - 0.35;
  const z1 = (building.origin.y + building.depth) * tile - 0.35;
  const green = new THREE.Color(MONSTER_GREEN);
  const deep = new THREE.Color(MONSTER_GREEN_DEEP);
  const cream = new THREE.Color("#f4f1ea");
  const wallX0 = x0 + 1.1;
  const wallX1 = x0 + 2.35;
  const wallZ0 = z0 + (z1 - z0) * 0.28;
  const wallZ1 = z1 - 1.6;
  walls.box(wallX0, wallZ0, wallX1, wallZ1, 0, 16.5, green);
  trimB.box(wallX0 - 0.08, wallZ0 - 0.08, wallX1 + 0.08, wallZ1 + 0.08, 16.2, 16.9, cream);
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4;
    const t1 = (i + 1) / 4;
    const pz0 = wallZ0 + (wallZ1 - wallZ0) * t0 + 0.2;
    const pz1 = wallZ0 + (wallZ1 - wallZ0) * t1 - 0.2;
    trimB.box(wallX1 - 0.02, pz0, wallX1 + 0.12, pz1, 1.2, 15.4, i % 2 === 0 ? deep : green);
  }
}
