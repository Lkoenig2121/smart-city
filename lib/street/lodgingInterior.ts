import * as THREE from "three";
import type { Building, CityState } from "@/lib/city/types";
import { lodgingUse, type LodgingZone } from "@/lib/city/lodging";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";

export interface LodgingInterior {
  group: THREE.Group;
  blockers: Blocker[];
  spawn: { x: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  deskMat: THREE.MeshStandardMaterial | null;
  groundAt: (x: number, z: number) => number;
  nearDesk: (x: number, z: number) => boolean;
  nearComputer: (x: number, z: number) => boolean;
  nearExit: (x: number, z: number) => boolean;
  computerHit: THREE.Object3D | null;
  dispose: () => void;
}

const MARBLE = "#e8dcc8";
const GOLD = "#c9a44c";
const INK = "#1a1a1a";
const WATER = "#2aa8c4";
const WATER_SHALLOW = "#5ec8d6";

export function buildLodgingInterior(building: Building, zone: LodgingZone, state: CityState): LodgingInterior {
  if (zone === "room") return buildRoom(building, state);
  if (zone === "pool") return buildPool(building);
  return buildLobby(building);
}

function addCeiling(builder: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, color: THREE.Color) {
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
  add(floorB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
  add(wallB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 }));
  add(
    trimB,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.18,
      emissive: new THREE.Color("#ffd9a0"),
      emissiveIntensity: 0.12,
    }),
  );
}

function buildLobby(building: Building): LodgingInterior {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();
  void lodgingUse(building);

  const minX = -16;
  const maxX = 16;
  const minZ = -14;
  const maxZ = 18;
  const marble = new THREE.Color(MARBLE);
  const ink = new THREE.Color(INK);
  const gold = new THREE.Color(GOLD);
  const cream = new THREE.Color("#f4efe6");

  floorB.ground(minX, minZ, maxX, maxZ, 0, marble);
  floorB.ground(-10, -10, 10, 10, 0.02, ink);
  floorB.ground(-9.2, -9.2, 9.2, 9.2, 0.03, marble);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if ((i + j) % 2 !== 0) continue;
      const x = -8 + i * 2;
      const z = -8 + j * 2;
      floorB.ground(x, z, x + 2, z + 2, 0.035, ink);
    }
  }

  wallB.box(minX, minZ, minX + 0.55, maxZ, 0, 8.5, cream);
  wallB.box(maxX - 0.55, minZ, maxX, maxZ, 0, 8.5, cream);
  wallB.box(minX, minZ, maxX, minZ + 0.55, 0, 8.5, cream);
  wallB.box(minX, maxZ - 0.55, maxX, maxZ, 0, 8.5, cream);
  addCeiling(floorB, minX, minZ, maxX, maxZ, 8.48, cream);
  blockers.push({ minX, maxX: minX + 0.55, minZ, maxZ });
  blockers.push({ minX: maxX - 0.55, maxX, minZ, maxZ });
  blockers.push({ minX, maxX, minZ, maxZ: minZ + 0.55 });
  blockers.push({ minX, maxX, minZ: maxZ - 0.55, maxZ });

  // Geometric diamond wall behind the desk.
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      const x = -7.2 + i * 2.4;
      const y0 = 1.1 + j * 2.1;
      trimB.box(x, minZ + 0.55, x + 2.1, minZ + 0.85, y0, y0 + 1.9, (i + j) % 2 === 0 ? ink : gold);
    }
  }

  // Fluted pillar.
  wallB.box(-0.7, 6.2, 0.7, 7.6, 0, 8.4, cream);
  blockers.push({ minX: -0.7, maxX: 0.7, minZ: 6.2, maxZ: 7.6 });

  // Glowing onyx desk.
  const deskZ0 = -7.4;
  const deskZ1 = -4.6;
  trimB.box(-6.4, deskZ0, 6.4, deskZ1, 0, 1.15, gold);
  wallB.box(-6.2, deskZ0 + 0.15, 6.2, deskZ1 - 0.1, 1.15, 1.28, ink);
  blockers.push({ minX: -6.4, maxX: 6.4, minZ: deskZ0, maxZ: deskZ1 });

  const deskGeo = new THREE.PlaneGeometry(8.4, 2.4);
  const deskMat = new THREE.MeshStandardMaterial({
    color: "#111",
    emissive: new THREE.Color("#c9a44c"),
    emissiveIntensity: 0.7,
    roughness: 0.35,
  });
  const deskScreen = new THREE.Mesh(deskGeo, deskMat);
  deskScreen.position.set(0, 2.55, deskZ0 + 0.08);
  group.add(deskScreen);
  disposables.push(deskGeo);

  // Lounge.
  const navy = new THREE.Color("#1e3a5f");
  wallB.box(9.2, 2.2, 14.4, 8.4, 0, 0.55, navy);
  trimB.box(9.6, 2.6, 11.6, 4.4, 0.55, 1.15, navy);
  trimB.box(12.0, 5.2, 13.9, 7.6, 0.55, 1.15, navy);
  blockers.push({ minX: 9.2, maxX: 14.4, minZ: 2.2, maxZ: 8.4 });

  // Elevator bank.
  wallB.box(-14.8, -2.4, -11.2, 4.8, 0, 3.6, ink);
  trimB.box(-14.6, -2.2, -11.4, -1.9, 0.4, 3.1, gold);
  trimB.box(-14.6, 1.0, -11.4, 1.3, 0.4, 3.1, gold);
  blockers.push({ minX: -14.8, maxX: -11.2, minZ: -2.4, maxZ: 4.8 });

  const chandelier = new THREE.PointLight(0xffe0b0, 22, 28, 1.6);
  chandelier.position.set(0, 6.4, 2);
  group.add(chandelier);

  assemble(group, floorB, wallB, trimB, disposables);

  return {
    group,
    blockers,
    spawn: { x: 0, z: 14.6, yaw: 0, pitch: -0.08 },
    bounds: { minX, maxX, minZ, maxZ },
    deskMat,
    groundAt: () => 0,
    nearDesk: (x, z) => Math.abs(x) < 8 && z > -4.4 && z < 1.6,
    nearComputer: () => false,
    nearExit: (x, z) => z > 12.4 && Math.abs(x) < 8,
    computerHit: null,
    dispose: () => {
      for (const item of disposables) item.dispose();
      deskMat.dispose();
    },
  };
}

function buildRoom(building: Building, state: CityState): LodgingInterior {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();
  const hotel = lodgingUse(building) === "hotel";

  const minX = -7.5;
  const maxX = 7.5;
  const minZ = -6.5;
  const maxZ = 8.5;
  const ceilY = 4.35;
  const winX0 = -2.85;
  const winX1 = 3.25;
  const winY0 = 1.05;
  const winY1 = 3.55;
  const carpet = new THREE.Color("#d8d0c4");
  const goldWall = new THREE.Color("#c9b17a");
  const wood = new THREE.Color("#5a3d28");
  const white = new THREE.Color("#f4f1ea");
  const navy = new THREE.Color("#1e3a6b");
  const charcoal = new THREE.Color("#2c2c2c");
  const ceiling = new THREE.Color("#efe8dc");

  floorB.ground(minX, minZ, maxX, maxZ, 0, carpet);
  addCeiling(floorB, minX, minZ, maxX, maxZ, ceilY, ceiling);
  trimB.box(-1.1, -1.1, 1.1, 1.1, ceilY - 0.12, ceilY, white);

  wallB.box(minX, minZ, minX + 0.4, maxZ, 0, ceilY, goldWall);
  wallB.box(maxX - 0.4, minZ, maxX, maxZ, 0, ceilY, goldWall);
  wallB.box(minX, maxZ - 0.4, maxX, maxZ, 0, ceilY, goldWall);

  // Window wall with an opening onto the city.
  wallB.box(minX, minZ, winX0, minZ + 0.4, 0, ceilY, goldWall);
  wallB.box(winX1, minZ, maxX, minZ + 0.4, 0, ceilY, goldWall);
  wallB.box(winX0, minZ, winX1, minZ + 0.4, 0, winY0, goldWall);
  wallB.box(winX0, minZ, winX1, minZ + 0.4, winY1, ceilY, goldWall);

  blockers.push({ minX, maxX: minX + 0.4, minZ, maxZ });
  blockers.push({ minX: maxX - 0.4, maxX, minZ, maxZ });
  blockers.push({ minX, maxX, minZ, maxZ: minZ + 0.4 });
  blockers.push({ minX, maxX, minZ: maxZ - 0.4, maxZ });

  trimB.box(winX0 - 0.12, minZ + 0.18, winX0 + 0.12, minZ + 0.48, winY0 - 0.12, winY1 + 0.12, charcoal);
  trimB.box(winX1 - 0.12, minZ + 0.18, winX1 + 0.12, minZ + 0.48, winY0 - 0.12, winY1 + 0.12, charcoal);
  trimB.box(winX0, minZ + 0.18, winX1, minZ + 0.48, winY0 - 0.12, winY0 + 0.1, charcoal);
  trimB.box(winX0, minZ + 0.18, winX1, minZ + 0.48, winY1 - 0.1, winY1 + 0.12, charcoal);
  trimB.box((winX0 + winX1) / 2 - 0.05, minZ + 0.2, (winX0 + winX1) / 2 + 0.05, minZ + 0.42, winY0, winY1, charcoal);
  trimB.box(winX0, minZ + 0.2, winX1, minZ + 0.42, (winY0 + winY1) / 2 - 0.05, (winY0 + winY1) / 2 + 0.05, charcoal);

  const curtain = new THREE.Color("#2a2a2e");
  wallB.box(winX0 - 0.85, minZ + 0.45, winX0 - 0.15, minZ + 0.7, 0.7, ceilY - 0.15, curtain);
  wallB.box(winX1 + 0.15, minZ + 0.45, winX1 + 0.85, minZ + 0.7, 0.7, ceilY - 0.15, curtain);

  const glassGeo = new THREE.PlaneGeometry(winX1 - winX0 - 0.1, winY1 - winY0 - 0.1);
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#d7eef8",
    transparent: true,
    opacity: 0.18,
    roughness: 0.08,
    metalness: 0.12,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set((winX0 + winX1) / 2, (winY0 + winY1) / 2, minZ + 0.28);
  group.add(glass);
  disposables.push(glassGeo, glassMat);

  addCityView(floorB, wallB, trimB, building, state, minZ);

  // Bed.
  trimB.box(-6.6, -1.4, -1.1, 5.2, 0, 0.55, wood);
  wallB.box(-6.5, -1.2, -1.2, 5.0, 0.55, 0.82, white);
  wallB.box(-6.5, 3.6, -1.2, 5.0, 0.82, 1.15, white);
  trimB.box(-6.7, -1.5, -1.0, -1.15, 0.4, 1.7, wood);
  blockers.push({ minX: -6.7, maxX: -1.0, minZ: -1.5, maxZ: 5.2 });

  // Nightstand + lamp.
  trimB.box(-6.6, 5.3, -5.1, 6.5, 0, 0.7, wood);
  trimB.box(-6.05, 5.7, -5.55, 6.15, 0.7, 1.35, white);

  // Dresser + TV.
  trimB.box(2.4, -4.6, 6.8, -3.2, 0, 0.85, new THREE.Color("#c4a882"));
  wallB.box(3.3, -4.55, 5.9, -3.35, 0.85, 2.15, charcoal);
  blockers.push({ minX: 2.4, maxX: 6.8, minZ: -4.6, maxZ: -3.2 });

  // Blue armchair.
  wallB.box(3.4, 1.4, 5.6, 3.8, 0, 0.45, navy);
  wallB.box(3.4, 1.4, 5.6, 1.75, 0.45, 1.05, navy);
  blockers.push({ minX: 3.4, maxX: 5.6, minZ: 1.4, maxZ: 3.8 });

  // Writing desk + computer, door-side of the room.
  const pcX0 = 3.25;
  const pcX1 = 6.8;
  const pcZ0 = 4.65;
  const pcZ1 = 6.6;
  trimB.box(pcX0, pcZ0, pcX1, pcZ1, 0, 0.76, wood);
  trimB.box(pcX0 + 0.08, pcZ0 + 0.08, pcX1 - 0.08, pcZ1 - 0.08, 0.76, 0.82, new THREE.Color("#3a2a1c"));
  wallB.box(2.15, 4.95, 3.12, 6.25, 0, 0.48, charcoal);
  wallB.box(2.15, 6.0, 3.12, 6.25, 0.48, 0.95, charcoal);
  blockers.push({ minX: pcX0, maxX: pcX1, minZ: pcZ0, maxZ: pcZ1 });
  blockers.push({ minX: 2.15, maxX: 3.12, minZ: 4.95, maxZ: 6.25 });
  trimB.box(5.55, 5.15, 6.55, 6.15, 0.82, 1.58, charcoal);
  trimB.box(4.05, 5.2, 5.45, 6.05, 0.82, 0.9, charcoal);
  trimB.box(5.95, 5.35, 6.25, 5.95, 0.82, 1.08, white);
  void hotel;

  assemble(group, floorB, wallB, trimB, disposables);

  const screenGeo = new THREE.PlaneGeometry(0.92, 0.58);
  const screenMat = new THREE.MeshStandardMaterial({
    color: "#0b1c2c",
    emissive: new THREE.Color("#1a6ea8"),
    emissiveIntensity: 0.85,
    roughness: 0.22,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(5.52, 1.22, 5.65);
  screen.rotation.y = Math.PI / 2;
  const glow = new THREE.PointLight(0x4aa8e8, 4.5, 5.5, 2);
  glow.position.set(4.6, 1.25, 5.65);
  const hitGeo = new THREE.BoxGeometry(3.7, 1.9, 2.2);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.position.set(4.7, 0.95, 5.6);
  const computer = new THREE.Group();
  computer.name = "computer";
  computer.add(screen, hit);
  group.add(computer, glow);
  disposables.push(screenGeo, screenMat, hitGeo, hitMat);

  return {
    group,
    blockers,
    spawn: { x: 0.3, z: 3.4, yaw: 0, pitch: -0.06 },
    bounds: { minX, maxX, minZ, maxZ },
    deskMat: null,
    groundAt: () => 0,
    nearDesk: () => false,
    nearComputer: (x, z) => x > 1.05 && x < 5.4 && z > 4.2 && z < 6.55,
    nearExit: (_x, z) => z > 6.6,
    computerHit: computer,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

function addCityView(
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  here: Building,
  state: CityState,
  windowZ: number,
) {
  const groundY = -22;
  const grass = new THREE.Color("#4a8a44");
  const pavement = new THREE.Color("#8a8680");
  const water = new THREE.Color("#2f6f96");
  floorB.ground(-90, -140, 90, windowZ - 1.2, groundY, grass);
  floorB.ground(-14, -70, 14, windowZ - 8, groundY + 0.08, pavement);
  floorB.ground(-70, -48, -18, -22, groundY + 0.04, water);

  const neighbors = [...state.buildings.values()]
    .filter((b) => b.id !== here.id)
    .map((b) => ({
      b,
      dist: (b.origin.x - here.origin.x) ** 2 + (b.origin.y - here.origin.y) ** 2,
    }))
    .sort((a, c) => a.dist - c.dist)
    .slice(0, 22);

  for (const { b } of neighbors) {
    const x = (b.origin.x - here.origin.x) * 3.4;
    const z = windowZ - 10 - Math.max(2, b.origin.y - here.origin.y) * 3.1 - (b.origin.x % 3);
    const w = Math.max(2.2, b.width * 2.1);
    const d = Math.max(2.0, b.depth * 1.8);
    const h = Math.max(4.5, b.floors * 0.62);
    const wall = new THREE.Color(b.wallColor);
    const roof = new THREE.Color(b.roofColor);
    wallB.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, groundY, groundY + h, wall);
    trimB.box(x - w / 2 - 0.08, z - d / 2 - 0.08, x + w / 2 + 0.08, z + d / 2 + 0.08, groundY + h - 0.35, groundY + h, roof);
  }
}

function buildPool(building: Building): LodgingInterior {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();
  void building;

  const minX = -18;
  const maxX = 18;
  const minZ = -16;
  const maxZ = 16;
  const stone = new THREE.Color("#d5cfc4");
  const grass = new THREE.Color("#3fa34a");
  const water = new THREE.Color(WATER);
  const shelf = new THREE.Color(WATER_SHALLOW);
  const dark = new THREE.Color("#3a3a3a");
  const cream = new THREE.Color("#ece6da");
  const navy = new THREE.Color("#1c1c1c");
  const facade = new THREE.Color("#d8c4a8");

  floorB.ground(minX, minZ, maxX, maxZ, 0, stone);

  // Building wall along -Z, as if the deck sits against the tower.
  wallB.box(minX, minZ, maxX, minZ + 0.7, 0, 9.5, facade);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      const x = -14 + i * 5;
      const y0 = 1.4 + j * 2.4;
      trimB.box(x, minZ + 0.7, x + 2.4, minZ + 0.82, y0, y0 + 1.6, dark);
    }
  }
  blockers.push({ minX, maxX, minZ, maxZ: minZ + 0.7 });

  // Parapet.
  wallB.box(minX, minZ, minX + 0.45, maxZ, 0, 1.15, cream);
  wallB.box(maxX - 0.45, minZ, maxX, maxZ, 0, 1.15, cream);
  wallB.box(minX, maxZ - 0.45, maxX, maxZ, 0, 1.15, cream);
  blockers.push({ minX, maxX: minX + 0.45, minZ, maxZ });
  blockers.push({ minX: maxX - 0.45, maxX, minZ, maxZ });
  blockers.push({ minX, maxX, minZ: maxZ - 0.45, maxZ });

  // Pool + sun shelf.
  floorB.ground(-8.5, -6.4, 8.5, 8.2, 0.04, dark);
  floorB.ground(-8.1, -2.2, 8.1, 7.8, 0.08, water);
  floorB.ground(-8.1, -6.0, 8.1, -2.2, 0.12, shelf);
  blockers.push({ minX: -7.6, maxX: 7.6, minZ: -1.8, maxZ: 7.4 });

  // Submerged loungers on the shelf.
  const white = new THREE.Color("#f4f1ea");
  for (const x of [-5.2, -1.6, 2.0]) {
    trimB.box(x, -5.4, x + 2.2, -2.8, 0.12, 0.28, white);
  }

  // Grass patches + lounge chairs.
  for (const [x, z] of [
    [-15.2, 4.2],
    [-15.2, 8.6],
    [12.4, 4.2],
    [12.4, 8.6],
  ]) {
    floorB.ground(x, z, x + 3.4, z + 2.6, 0.05, grass);
    trimB.box(x + 0.35, z + 0.35, x + 3.0, z + 2.2, 0.05, 0.28, navy);
    blockers.push({ minX: x + 0.35, maxX: x + 3.0, minZ: z + 0.35, maxZ: z + 2.2 });
  }

  // Cabana bar.
  wallB.box(-15.6, -8.4, -8.4, -4.8, 0, 3.2, cream);
  trimB.box(-15.4, -8.2, -8.6, -7.9, 3.2, 3.45, dark);
  trimB.box(-15.2, -6.2, -8.8, -5.1, 1.05, 1.2, dark);
  blockers.push({ minX: -15.6, maxX: -8.4, minZ: -8.4, maxZ: -4.8 });

  // Giant chess.
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = 8.8 + i * 1.7;
      const z = -8.6 + j * 1.7;
      floorB.ground(x, z, x + 1.7, z + 1.7, 0.04, (i + j) % 2 === 0 ? white : inkColor());
    }
  }
  trimB.box(9.3, -8.1, 10.2, -7.2, 0.04, 1.05, white);
  trimB.box(12.6, -4.8, 13.5, -3.9, 0.04, 1.05, inkColor());

  assemble(group, floorB, wallB, trimB, disposables);

  return {
    group,
    blockers,
    spawn: { x: 0, z: 12.4, yaw: 0, pitch: -0.12 },
    bounds: { minX, maxX, minZ, maxZ },
    deskMat: null,
    groundAt: (x, z) => {
      if (x > -8.1 && x < 8.1 && z > -6.0 && z < -2.2) return 0.12;
      return 0;
    },
    nearDesk: () => false,
    nearComputer: () => false,
    nearExit: (_x, z) => z > 12.8,
    computerHit: null,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

function inkColor() {
  return new THREE.Color(INK);
}
