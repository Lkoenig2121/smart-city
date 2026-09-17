import * as THREE from "three";
import { roomHasInteriorBalcony } from "@/lib/city/balconies";
import type { Building, CityState } from "@/lib/city/types";
import { lodgingUse, type LodgingRoom, type LodgingZone } from "@/lib/city/lodging";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";
import { addRoomTelevision, type RoomTv } from "./roomTv";

export interface LodgingInterior {
  group: THREE.Group;
  blockers: Blocker[];
  spawn: { x: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  deskMat: THREE.MeshStandardMaterial | null;
  tv: RoomTv | null;
  groundAt: (x: number, z: number) => number;
  nearDesk: (x: number, z: number) => boolean;
  nearComputer: (x: number, z: number) => boolean;
  nearBed: (x: number, z: number) => boolean;
  nearExit: (x: number, z: number) => boolean;
  computerHit: THREE.Object3D | null;
  windowMesh: THREE.Mesh | null;
  windowAnchor: { x: number; y: number; z: number } | null;
  slider: SliderDoor | null;
  update?: (dt: number, ctx?: { fireworks?: boolean }) => void;
  dispose: () => void;
}

export interface SliderDoor {
  open: boolean;
  near: (x: number, z: number) => boolean;
  blockingClose: (x: number, z: number) => boolean;
  toggle: () => void;
  update: (dt: number) => void;
}

const MARBLE = "#e8dcc8";
const GOLD = "#c9a44c";
const INK = "#1a1a1a";
const WATER = "#2aa8c4";
const WATER_SHALLOW = "#5ec8d6";

export function buildLodgingInterior(
  building: Building,
  zone: LodgingZone,
  state: CityState,
  room: LodgingRoom | null = null,
): LodgingInterior {
  if (zone === "room") return buildRoom(building, state, room);
  if (zone === "pool") return buildPool(building, state);
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
    tv: null,
    groundAt: () => 0,
    nearDesk: (x, z) => Math.abs(x) < 8 && z > -4.4 && z < 1.6,
    nearComputer: () => false,
    nearBed: () => false,
    nearExit: (x, z) => z > 12.4 && Math.abs(x) < 8,
    computerHit: null,
    windowMesh: null,
    windowAnchor: null,
    slider: null,
    dispose: () => {
      for (const item of disposables) item.dispose();
      deskMat.dispose();
    },
  };
}

function buildRoom(building: Building, state: CityState, room: LodgingRoom | null): LodgingInterior {
  void state;
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();
  const hotel = lodgingUse(building) === "hotel";
  const club = Boolean(room && hotel && room.floor >= Math.max(2, building.floors - 2));
  const balcony = roomHasInteriorBalcony(building, room);

  const minX = -7.5;
  const maxX = 7.5;
  const minZ = -6.5;
  const maxZ = 8.5;
  const balDepth = balcony ? 2.05 : 0;
  const balZ0 = minZ - balDepth;
  const ceilY = 4.35;
  const winX0 = balcony ? -2.35 : -2.85;
  const winX1 = balcony ? 2.35 : 3.25;
  const winY0 = 1.05;
  const winY1 = 3.55;
  const doorH = 3.18;
  const carpet = new THREE.Color(club ? "#3d3a48" : hotel ? "#d8d0c4" : "#cfc4b4");
  const goldWall = new THREE.Color(club ? "#2c3344" : hotel ? "#c9b17a" : "#d4c4a8");
  const wood = new THREE.Color(club ? "#2a2420" : "#5a3d28");
  const white = new THREE.Color(club ? "#e8e2d4" : "#f4f1ea");
  const navy = new THREE.Color(club ? "#c9a44c" : "#1e3a6b");
  const charcoal = new THREE.Color("#2c2c2c");
  const ceiling = new THREE.Color(club ? "#1c1a22" : "#efe8dc");

  floorB.ground(minX, minZ, maxX, maxZ, 0, carpet);
  addCeiling(floorB, minX, minZ, maxX, maxZ, ceilY, ceiling);
  trimB.box(-1.1, -1.1, 1.1, 1.1, ceilY - 0.12, ceilY, white);

  wallB.box(minX, minZ, minX + 0.4, maxZ, 0, ceilY, goldWall);
  wallB.box(maxX - 0.4, minZ, maxX, maxZ, 0, ceilY, goldWall);
  wallB.box(minX, maxZ - 0.4, maxX, maxZ, 0, ceilY, goldWall);

  // Window wall: a sealed grid, or a floor-to-header opening for the slider.
  wallB.box(minX, minZ, winX0, minZ + 0.4, 0, ceilY, goldWall);
  wallB.box(winX1, minZ, maxX, minZ + 0.4, 0, ceilY, goldWall);
  if (!balcony) {
    wallB.box(winX0, minZ, winX1, minZ + 0.4, 0, winY0, goldWall);
    wallB.box(winX0, minZ, winX1, minZ + 0.4, winY1, ceilY, goldWall);
  } else {
    wallB.box(winX0, minZ, winX1, minZ + 0.4, doorH, ceilY, goldWall);
  }

  blockers.push({ minX, maxX: minX + 0.4, minZ, maxZ });
  blockers.push({ minX: maxX - 0.4, maxX, minZ, maxZ });
  blockers.push({ minX, maxX: winX0, minZ, maxZ: minZ + 0.4 });
  blockers.push({ minX: winX1, maxX, minZ, maxZ: minZ + 0.4 });
  if (!balcony) {
    blockers.push({ minX: winX0, maxX: winX1, minZ, maxZ: minZ + 0.4 });
  }
  blockers.push({ minX, maxX, minZ: maxZ - 0.4, maxZ });

  let glass: THREE.Mesh | null = null;
  let slider: SliderDoor | null = null;
  if (!balcony) {
    trimB.box(winX0 - 0.12, minZ + 0.18, winX0 + 0.12, minZ + 0.48, winY0 - 0.12, winY1 + 0.12, charcoal);
    trimB.box(winX1 - 0.12, minZ + 0.18, winX1 + 0.12, minZ + 0.48, winY0 - 0.12, winY1 + 0.12, charcoal);
    trimB.box(winX0, minZ + 0.18, winX1, minZ + 0.48, winY0 - 0.12, winY0 + 0.1, charcoal);
    trimB.box(winX0, minZ + 0.18, winX1, minZ + 0.48, winY1 - 0.1, winY1 + 0.12, charcoal);
    trimB.box((winX0 + winX1) / 2 - 0.05, minZ + 0.2, (winX0 + winX1) / 2 + 0.05, minZ + 0.42, winY0, winY1, charcoal);
    trimB.box(winX0, minZ + 0.2, winX1, minZ + 0.42, (winY0 + winY1) / 2 - 0.05, (winY0 + winY1) / 2 + 0.05, charcoal);

    const curtain = new THREE.Color("#2a2a2e");
    wallB.box(winX0 - 0.85, minZ + 0.45, winX0 - 0.15, minZ + 0.7, 0.7, ceilY - 0.15, curtain);
    wallB.box(winX1 + 0.15, minZ + 0.45, winX1 + 0.85, minZ + 0.7, 0.7, ceilY - 0.15, curtain);

    const glassW = winX1 - winX0 - 0.04;
    const glassH = winY1 - winY0 - 0.04;
    const glassGeo = new THREE.PlaneGeometry(glassW, glassH);
    const glassMat = new THREE.MeshStandardMaterial({
      color: "#d7eef8",
      transparent: true,
      opacity: 0.07,
      roughness: 0.04,
      metalness: 0.12,
      depthWrite: false,
    });
    glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set((winX0 + winX1) / 2, (winY0 + winY1) / 2, minZ + 0.28);
    group.add(glass);
    disposables.push(glassGeo, glassMat);
  } else {
    addSliderCurtains(trimB, wallB, winX0, winX1, minZ, doorH);
    slider = addSlidingDoors(group, disposables, blockers, winX0, winX1, minZ, doorH);
    addRoomBalcony(floorB, trimB, blockers, winX0, winX1, minX, maxX, minZ, balZ0);
  }

  // Bed.
  trimB.box(-6.6, -1.4, -1.1, 5.2, 0, 0.55, wood);
  wallB.box(-6.5, -1.2, -1.2, 5.0, 0.55, 0.82, white);
  wallB.box(-6.5, 3.6, -1.2, 5.0, 0.82, 1.15, white);
  trimB.box(-6.7, -1.5, -1.0, -1.15, 0.4, 1.7, wood);
  blockers.push({ minX: -6.7, maxX: -1.0, minZ: -1.5, maxZ: 5.2 });

  // Nightstand + lamp.
  trimB.box(-6.6, 5.3, -5.1, 6.5, 0, 0.7, wood);
  trimB.box(-6.05, 5.7, -5.55, 6.15, 0.7, 1.35, white);

  // Dresser; the television mesh sits on top and faces the armchair.
  trimB.box(2.4, -4.6, 6.8, -3.2, 0, 0.85, new THREE.Color("#c4a882"));
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

  addRoomPlaque(group, disposables, room, hotel, maxZ);

  assemble(group, floorB, wallB, trimB, disposables);

  const computer = addDeskComputer(group, disposables);
  const tv = addRoomTelevision(group, disposables);

  return {
    group,
    blockers,
    spawn: {
      x: 0.3,
      z: 3.4,
      yaw: 0,
      pitch: -0.1 - Math.min(0.2, (room?.floor ?? 8) * 0.014),
    },
    bounds: { minX, maxX, minZ: balcony ? balZ0 + 0.2 : minZ, maxZ },
    deskMat: null,
    tv,
    groundAt: () => 0,
    nearDesk: () => false,
    nearComputer: (x, z) => x > 1.05 && x < 5.4 && z > 4.2 && z < 6.55,
    nearBed: (x, z) =>
      (x > -1.5 && x < -0.12 && z > -1.6 && z < 5.35) ||
      (x > -6.5 && x < -1.15 && z > 5.05 && z < 6.4),
    nearExit: (_x, z) => z > 6.6,
    computerHit: computer,
    windowMesh: glass,
    windowAnchor: { x: (winX0 + winX1) / 2, y: 1.7, z: balcony ? balZ0 : minZ },
    slider,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

function addSliderCurtains(
  trimB: MeshBuilder,
  wallB: MeshBuilder,
  winX0: number,
  winX1: number,
  wallZ: number,
  doorH: number,
) {
  const rod = new THREE.Color("#3d342c");
  const cloth = new THREE.Color("#efe6d6");
  const z = wallZ + 0.52;
  trimB.box(winX0 - 0.85, z - 0.04, winX1 + 0.85, z + 0.04, doorH + 0.12, doorH + 0.2, rod);
  wallB.box(winX0 - 0.78, z - 0.08, winX0 + 0.08, z + 0.12, 0.08, doorH + 0.1, cloth);
  wallB.box(winX1 - 0.08, z - 0.08, winX1 + 0.78, z + 0.12, 0.08, doorH + 0.1, cloth);
}

function addSlidingDoors(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  blockers: Blocker[],
  x0: number,
  x1: number,
  wallZ: number,
  doorH: number,
): SliderDoor {
  const frameMat = new THREE.MeshStandardMaterial({
    color: "#e8eaee",
    roughness: 0.28,
    metalness: 0.58,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#c4d8e6",
    transparent: true,
    opacity: 0.22,
    roughness: 0.05,
    metalness: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: "#9aa3ad",
    roughness: 0.25,
    metalness: 0.7,
  });
  disposables.push(frameMat, glassMat, handleMat);

  const addBox = (
    parent: THREE.Object3D,
    mat: THREE.MeshStandardMaterial,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    zz: number,
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, zz);
    mesh.castShadow = true;
    parent.add(mesh);
    disposables.push(geo);
  };

  const addPanel = (parent: THREE.Object3D, w: number) => {
    const t = 0.055;
    const glassW = w - t * 2.2;
    const glassH = doorH - 0.18;
    addBox(parent, frameMat, w, t, 0.07, 0, t * 0.5, 0);
    addBox(parent, frameMat, w, t, 0.07, 0, doorH - t * 0.5, 0);
    addBox(parent, frameMat, t, doorH, 0.07, -w / 2 + t / 2, doorH / 2, 0);
    addBox(parent, frameMat, t, doorH, 0.07, w / 2 - t / 2, doorH / 2, 0);
    addBox(parent, frameMat, t * 0.7, doorH - 0.12, 0.05, 0, doorH / 2, 0);
    const glassGeo = new THREE.PlaneGeometry(glassW * 0.46, glassH);
    const left = new THREE.Mesh(glassGeo, glassMat);
    left.position.set(-glassW * 0.25, doorH / 2, 0);
    const right = new THREE.Mesh(glassGeo, glassMat);
    right.position.set(glassW * 0.25, doorH / 2, 0);
    parent.add(left, right);
    disposables.push(glassGeo);
  };

  const mid = (x0 + x1) / 2;
  const panelW = (x1 - x0) / 2 + 0.04;
  const trackZ = wallZ + 0.16;
  const closedX = mid - panelW / 2;
  const openX = mid + panelW / 2;

  addBox(group, frameMat, x1 - x0 + 0.12, 0.05, 0.16, mid, 0.03, trackZ);
  addBox(group, frameMat, x1 - x0 + 0.12, 0.08, 0.14, mid, doorH + 0.04, trackZ);
  addBox(group, frameMat, 0.08, doorH + 0.08, 0.14, x0 - 0.02, doorH / 2, trackZ);
  addBox(group, frameMat, 0.08, doorH + 0.08, 0.14, x1 + 0.02, doorH / 2, trackZ);

  const fixed = new THREE.Group();
  fixed.position.set(openX, 0, trackZ - 0.02);
  addPanel(fixed, panelW);
  group.add(fixed);

  const moving = new THREE.Group();
  moving.position.set(closedX, 0, trackZ + 0.07);
  addPanel(moving, panelW);
  addBox(moving, handleMat, 0.04, 0.42, 0.05, -panelW / 2 + 0.1, 1.05, 0.06);
  group.add(moving);

  const leaf = {
    minX: mid - 0.08,
    maxX: x1 + 0.1,
    minZ: wallZ - 0.05,
    maxZ: wallZ + 0.28,
  };
  blockers.push(leaf);

  const applyBlocker = (amount: number) => {
    const leftEdge = closedX - panelW / 2 + amount * (openX - closedX);
    leaf.minX = leftEdge - 0.06;
    leaf.maxX = x1 + 0.1;
  };

  let amount = 0;
  let target = 0;
  applyBlocker(amount);

  const slider: SliderDoor = {
    get open() {
      return target > 0.5;
    },
    near: (x, z) => x > x0 - 0.7 && x < x1 + 0.7 && z > wallZ - 1.6 && z < wallZ + 2.2,
    blockingClose: (x, z) => x > x0 - 0.15 && x < mid + 0.2 && z > wallZ - 0.4 && z < wallZ + 0.55,
    toggle() {
      target = target > 0.5 ? 0 : 1;
    },
    update(dt: number) {
      if (Math.abs(amount - target) < 0.001) {
        amount = target;
        moving.position.x = closedX + amount * (openX - closedX);
        applyBlocker(amount);
        return;
      }
      const dir = Math.sign(target - amount);
      amount = THREE.MathUtils.clamp(amount + dir * dt * 1.35, 0, 1);
      moving.position.x = closedX + amount * (openX - closedX);
      applyBlocker(amount);
    },
  };

  return slider;
}

function addRoomBalcony(
  floorB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  winX0: number,
  winX1: number,
  roomMinX: number,
  roomMaxX: number,
  wallZ: number,
  balZ0: number,
) {
  const tileA = new THREE.Color("#e4dccf");
  const tileB = new THREE.Color("#d5ccbe");
  const metal = new THREE.Color("#2c3036");
  const pad = 0.28;
  const x0 = winX0 - pad;
  const x1 = winX1 + pad;
  const railH = 1.12;
  const post = 0.035;

  floorB.ground(winX0, wallZ, winX1, wallZ + 0.45, 0.012, tileA);
  const tilesX = 6;
  const tilesZ = 3;
  for (let i = 0; i < tilesX; i++) {
    for (let j = 0; j < tilesZ; j++) {
      const tx0 = x0 + ((x1 - x0) * i) / tilesX;
      const tx1 = x0 + ((x1 - x0) * (i + 1)) / tilesX;
      const tz0 = balZ0 + ((wallZ - balZ0) * j) / tilesZ;
      const tz1 = balZ0 + ((wallZ - balZ0) * (j + 1)) / tilesZ;
      floorB.ground(tx0, tz0, tx1, tz1, 0, (i + j) % 2 === 0 ? tileA : tileB);
    }
  }

  const postsX = 10;
  for (let i = 0; i <= postsX; i++) {
    const x = x0 + ((x1 - x0) * i) / postsX;
    trimB.box(x - post / 2, balZ0, x + post / 2, balZ0 + post, 0.04, railH, metal);
  }
  const postsZ = 4;
  for (let i = 1; i < postsZ; i++) {
    const z = balZ0 + ((wallZ - balZ0) * i) / postsZ;
    trimB.box(x0, z - post / 2, x0 + post, z + post / 2, 0.04, railH, metal);
    trimB.box(x1 - post, z - post / 2, x1, z + post / 2, 0.04, railH, metal);
  }
  trimB.box(x0, balZ0, x1, balZ0 + post, railH - 0.04, railH, metal);
  trimB.box(x0, balZ0, x0 + post, wallZ, railH - 0.04, railH, metal);
  trimB.box(x1 - post, balZ0, x1, wallZ, railH - 0.04, railH, metal);
  trimB.box(x0, balZ0, x1, balZ0 + post, 0.48, 0.54, metal);

  blockers.push({ minX: x0, maxX: x1, minZ: balZ0, maxZ: balZ0 + 0.1 });
  blockers.push({ minX: x0, maxX: x0 + 0.1, minZ: balZ0, maxZ: wallZ });
  blockers.push({ minX: x1 - 0.1, maxX: x1, minZ: balZ0, maxZ: wallZ });
  blockers.push({ minX: roomMinX, maxX: x0, minZ: balZ0, maxZ: wallZ });
  blockers.push({ minX: x1, maxX: roomMaxX, minZ: balZ0, maxZ: wallZ });

  addPatioSeating(trimB, blockers, (winX0 + winX1) / 2 - 0.85, balZ0 + 0.55);
}

function addPatioSeating(
  trimB: MeshBuilder,
  blockers: Blocker[],
  cx: number,
  cz: number,
) {
  const metal = new THREE.Color("#3a3d42");
  const seat = new THREE.Color("#2f3238");
  const top = new THREE.Color("#d8d2c8");

  const tw = 0.78;
  const td = 0.78;
  trimB.box(cx - tw / 2, cz - td / 2, cx + tw / 2, cz + td / 2, 0.7, 0.76, top);
  for (const [lx, lz] of [
    [-0.3, -0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [0.3, 0.3],
  ] as const) {
    trimB.box(cx + lx - 0.03, cz + lz - 0.03, cx + lx + 0.03, cz + lz + 0.03, 0, 0.7, metal);
  }

  addPatioChair(trimB, cx - 0.85, cz, metal, seat);
  addPatioChair(trimB, cx + 0.85, cz, metal, seat);
  blockers.push({ minX: cx - 1.25, maxX: cx + 1.25, minZ: cz - 0.55, maxZ: cz + 0.55 });
}

function addPatioChair(
  trimB: MeshBuilder,
  x: number,
  z: number,
  metal: THREE.Color,
  seat: THREE.Color,
) {
  const w = 0.48;
  const d = 0.5;
  trimB.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0.42, 0.48, seat);
  trimB.box(x - w / 2, z - d / 2, x + w / 2, z - d / 2 + 0.07, 0.48, 0.92, seat);
  for (const [lx, lz] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ] as const) {
    trimB.box(x + lx - 0.025, z + lz - 0.025, x + lx + 0.025, z + lz + 0.025, 0, 0.42, metal);
  }
}

function addRoomPlaque(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  room: LodgingRoom | null,
  hotel: boolean,
  doorZ: number,
) {
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  if (canvas) {
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1a1612";
      ctx.fillRect(0, 0, 512, 192);
      ctx.fillStyle = "#c9a44c";
      ctx.fillRect(0, 0, 512, 10);
      ctx.fillRect(0, 182, 512, 10);
      ctx.fillStyle = "#f4e6c0";
      ctx.font = "600 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(hotel ? "GUEST ROOM" : "RESIDENCE", 256, 58);
      ctx.font = "700 72px system-ui, sans-serif";
      ctx.fillText(room?.label ?? "—", 256, 140);
    }
  }

  const tex = canvas ? new THREE.CanvasTexture(canvas) : null;
  if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 0.5),
    new THREE.MeshStandardMaterial({
      color: "#c9a44c",
      map: tex ?? undefined,
      roughness: 0.35,
      metalness: 0.25,
    }),
  );
  plate.position.set(0, 1.55, doorZ - 0.42);
  plate.rotation.y = Math.PI;
  group.add(plate);
  disposables.push(plate.geometry, plate.material);
  if (tex) disposables.push(tex);
}

function addDeskComputer(group: THREE.Group, disposables: Array<{ dispose: () => void }>) {
  const computer = new THREE.Group();
  computer.name = "computer";

  const silverMat = new THREE.MeshStandardMaterial({
    color: "#c8ccd1",
    roughness: 0.28,
    metalness: 0.62,
  });
  const inkMat = new THREE.MeshStandardMaterial({
    color: "#1a1c20",
    roughness: 0.4,
    metalness: 0.2,
  });
  const keyMat = new THREE.MeshStandardMaterial({
    color: "#ece8e1",
    roughness: 0.55,
    metalness: 0.08,
  });
  disposables.push(silverMat, inkMat, keyMat);

  const addBox = (
    mat: THREE.MeshStandardMaterial,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    computer.add(mesh);
    disposables.push(geo);
    return mesh;
  };

  const cx = 6.22;
  const cz = 5.62;
  const deskY = 0.82;
  const screenW = 1.72;
  const screenH = 1.08;

  // Stand foot and neck.
  addBox(silverMat, 0.55, 0.05, 0.42, cx, deskY + 0.04, cz);
  addBox(silverMat, 0.08, 0.42, 0.08, cx, deskY + 0.28, cz);

  // Bezel + chin.
  addBox(inkMat, 0.07, screenH + 0.18, screenW + 0.16, cx, deskY + 0.92, cz);
  addBox(silverMat, 0.08, 0.1, screenW + 0.18, cx, deskY + 0.32, cz);

  const wallpaper = makeComputerWallpaper();
  const screenMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: wallpaper ?? undefined,
    emissive: new THREE.Color("#ffffff"),
    emissiveMap: wallpaper ?? undefined,
    emissiveIntensity: 0.55,
    roughness: 0.18,
    metalness: 0.05,
  });
  const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(cx - 0.045, deskY + 0.96, cz);
  screen.rotation.y = -Math.PI / 2;
  computer.add(screen);
  disposables.push(screenGeo, screenMat);
  if (wallpaper) disposables.push(wallpaper);

  // Camera jewel on the bezel.
  addBox(silverMat, 0.03, 0.03, 0.03, cx - 0.05, deskY + 1.48, cz);

  // Keyboard and mouse.
  addBox(silverMat, 0.42, 0.03, 1.12, 4.55, deskY + 0.03, cz);
  addBox(keyMat, 0.34, 0.025, 1.0, 4.55, deskY + 0.055, cz);
  addBox(inkMat, 0.18, 0.035, 0.12, 5.28, deskY + 0.04, 6.12);

  const glow = new THREE.PointLight(0x9ecfff, 3.2, 5.2, 2);
  glow.position.set(4.7, 1.35, cz);
  computer.add(glow);

  const hitGeo = new THREE.BoxGeometry(3.7, 1.9, 2.2);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.position.set(4.7, 0.95, 5.6);
  computer.add(hit);
  disposables.push(hitGeo, hitMat);

  group.add(computer);
  return computer;
}

function makeComputerWallpaper() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const sky = ctx.createLinearGradient(0, 0, 0, 480);
  sky.addColorStop(0, "#3d6aa8");
  sky.addColorStop(0.42, "#f0b27a");
  sky.addColorStop(0.62, "#c26b4a");
  sky.addColorStop(1, "#16324a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 768, 480);

  ctx.fillStyle = "#ffd19a";
  ctx.beginPath();
  ctx.arc(560, 168, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1d4f70";
  ctx.fillRect(0, 290, 768, 190);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, 318, 768, 10);

  ctx.fillStyle = "#2a3138";
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 82;
    const h = 70 + ((i * 37) % 90);
    ctx.fillRect(x, 290 - h, 54, h);
  }

  ctx.fillStyle = "rgba(10,14,22,0.55)";
  roundRect(ctx, 180, 400, 408, 54, 18);
  ctx.fill();
  const icons = ["#7dd3fc", "#fbbf24", "#86efac", "#f9a8d4", "#c4b5fd"];
  icons.forEach((color, i) => {
    ctx.fillStyle = color;
    roundRect(ctx, 214 + i * 72, 412, 30, 30, 8);
    ctx.fill();
  });

  ctx.fillStyle = "rgba(12,18,28,0.45)";
  roundRect(ctx, 24, 16, 720, 36, 10);
  ctx.fill();
  ctx.fillStyle = "#f4efe4";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Riverside OS", 40, 40);
  ctx.textAlign = "right";
  ctx.fillStyle = "#e8c36a";
  ctx.fillText("Harborview", 728, 40);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function vistaDrop(floor: number) {
  return 3.4 + Math.min(floor, 24) * 2.55;
}

function addCityView(
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  here: Building,
  state: CityState,
  view: { edgeZ: number; toward: -1 | 1; floor: number },
) {
  const dir = view.toward;
  // Air gap so the near ground is a distant street, not a wall in the window.
  const zNear = view.edgeZ + dir * 10;
  const zFar = view.edgeZ + dir * 240;
  const z0 = Math.min(zNear, zFar);
  const z1 = Math.max(zNear, zFar);
  const groundY = -vistaDrop(view.floor);
  const grass = new THREE.Color("#3d8c42");
  const park = new THREE.Color("#2a6a32");
  const pavement = new THREE.Color("#7d7972");
  const asphalt = new THREE.Color("#3f4148");
  const water = new THREE.Color("#2a6d94");
  const sand = new THREE.Color("#cbb67a");
  const trunk = new THREE.Color("#5a3d28");
  const leaf = new THREE.Color("#1f6b2c");

  floorB.ground(-150, z0, 150, z1, groundY, grass);
  for (let i = 0; i < 5; i++) {
    const x = -72 + i * 34;
    floorB.ground(x, z0, x + 6.4, z1, groundY + 0.08, asphalt);
  }
  for (let i = 0; i < 7; i++) {
    const mid = zNear + dir * (16 + i * 26);
    const a = mid - dir * 3;
    const b = mid + dir * 3;
    floorB.ground(-150, Math.min(a, b), 150, Math.max(a, b), groundY + 0.1, asphalt);
  }
  floorB.ground(-22, z0, 22, z0 + Math.abs(z1 - z0) * 0.08, groundY + 0.06, pavement);

  const riverA = zNear + dir * 78;
  const riverB = zNear + dir * 104;
  floorB.ground(-150, Math.min(riverA, riverB), -18, Math.max(riverA, riverB), groundY + 0.04, water);
  floorB.ground(-18, Math.min(riverA, riverB) + 6, -6, Math.max(riverA, riverB) - 4, groundY + 0.05, sand);
  const parkA = zNear + dir * 32;
  const parkB = zNear + dir * 62;
  floorB.ground(28, Math.min(parkA, parkB), 96, Math.max(parkA, parkB), groundY + 0.03, park);

  const neighbors = [...state.buildings.values()]
    .filter((b) => b.id !== here.id)
    .map((b) => ({
      b,
      dist: (b.origin.x - here.origin.x) ** 2 + (b.origin.y - here.origin.y) ** 2,
    }))
    .sort((a, c) => a.dist - c.dist)
    .slice(0, 40);

  neighbors.forEach(({ b }, i) => {
    const col = (i % 8) - 3.5;
    const row = Math.floor(i / 8);
    const x = col * 11.4 + ((b.origin.x * 2.1) % 3.2) - 1.6;
    const z = zNear + dir * (8 + row * 18 + (i % 5) * 2.1);
    const w = Math.max(3.1, b.width * 2.5);
    const d = Math.max(2.6, b.depth * 2.1);
    const h = 3.2 + b.floors * 1.12;
    const top = groundY + h;
    wallB.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, groundY, top, new THREE.Color(b.wallColor));
    trimB.box(
      x - w / 2 - 0.08,
      z - d / 2 - 0.08,
      x + w / 2 + 0.08,
      z + d / 2 + 0.08,
      top - 0.38,
      top,
      new THREE.Color(b.roofColor),
    );
    const win = new THREE.Color(b.wallColor).offsetHSL(0, -0.08, -0.18);
    const bands = Math.min(6, Math.max(2, Math.round(h / 3.2)));
    for (let k = 0; k < bands; k++) {
      const y = groundY + 0.7 + k * (h / (bands + 0.6));
      if (y + 0.45 > top - 0.5) continue;
      trimB.box(x - w / 2 + 0.18, z - d / 2 - 0.04, x + w / 2 - 0.18, z - d / 2 + 0.06, y, y + 0.42, win);
    }
  });

  for (let i = 0; i < 34; i++) {
    const x = -62 + (i % 12) * 11 + ((i * 5) % 4);
    const z = zNear + dir * (12 + Math.floor(i / 12) * 24 + (i % 4) * 4);
    const s = 0.8 + (i % 4) * 0.16;
    wallB.box(x - 0.14, z - 0.14, x + 0.14, z + 0.14, groundY, groundY + 1.6 * s, trunk);
    trimB.box(
      x - 1.05 * s,
      z - 1.05 * s,
      x + 1.05 * s,
      z + 1.05 * s,
      groundY + 1.3 * s,
      groundY + 3.8 * s,
      leaf,
    );
  }
}

function addCityFlank(
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  here: Building,
  state: CityState,
  edgeX: number,
  toward: -1 | 1,
  floor: number,
) {
  const dir = toward;
  const xNear = edgeX + dir * 8;
  const xFar = edgeX + dir * 150;
  const x0 = Math.min(xNear, xFar);
  const x1 = Math.max(xNear, xFar);
  const groundY = -vistaDrop(floor);
  const grass = new THREE.Color("#3d8c42");
  const asphalt = new THREE.Color("#3f4148");
  const trunk = new THREE.Color("#5a3d28");
  const leaf = new THREE.Color("#1f6b2c");

  floorB.ground(x0, -80, x1, 80, groundY, grass);
  floorB.ground(x0, -4, x1, 4, groundY + 0.08, asphalt);

  const neighbors = [...state.buildings.values()]
    .filter((b) => b.id !== here.id)
    .slice(0, 18);

  neighbors.forEach((b, i) => {
    const row = Math.floor(i / 6);
    const col = (i % 6) - 2.5;
    const x = xNear + dir * (10 + row * 20 + (i % 3) * 2);
    const z = col * 10.5 + ((b.origin.y * 1.8) % 2.2);
    const w = Math.max(3, b.width * 2.3);
    const d = Math.max(2.4, b.depth * 2);
    const h = 3.2 + b.floors * 1.05;
    wallB.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, groundY, groundY + h, new THREE.Color(b.wallColor));
    trimB.box(
      x - w / 2 - 0.08,
      z - d / 2 - 0.08,
      x + w / 2 + 0.08,
      z + d / 2 + 0.08,
      groundY + h - 0.35,
      groundY + h,
      new THREE.Color(b.roofColor),
    );
  });

  for (let i = 0; i < 14; i++) {
    const x = xNear + dir * (7 + (i % 5) * 14);
    const z = -36 + Math.floor(i / 5) * 28 + (i % 4) * 3;
    const s = 0.82 + (i % 3) * 0.14;
    wallB.box(x - 0.14, z - 0.14, x + 0.14, z + 0.14, groundY, groundY + 1.55 * s, trunk);
    trimB.box(x - s, z - s, x + s, z + s, groundY + 1.25 * s, groundY + 3.6 * s, leaf);
  }
}

const POOL_SKIN = ["#e8c4a0", "#c9956c", "#8d5a3b", "#f1d0b0", "#6b3f2a"];
const POOL_HAIR = ["#1a1410", "#4a2c12", "#c9a44c", "#2c1810", "#f4f1ea"];
const POOL_SWIM = ["#c0392b", "#1f4d8c", "#e8c36a", "#1a6b6b", "#f4f1ea", "#2aa8c4"];
const POOL_CASUAL = ["#1c1c1c", "#ece6da", "#3a3a3a", "#6b4a32", "#1a6b6b"];

type PoolPose = "sit" | "lie" | "swim" | "tread" | "stand";

interface PoolGuest {
  root: THREE.Group;
  pose: PoolPose;
  phase: number;
  baseY: number;
  baseYaw: number;
}

interface PoolStop {
  x: number;
  z: number;
  wait?: number;
  yaw?: number;
  hide?: boolean;
}

interface PoolWalker {
  root: THREE.Group;
  figure: THREE.Group;
  path: PoolStop[];
  lookout: PoolStop;
  index: number;
  waitLeft: number;
  speed: number;
  phase: number;
  watching: boolean;
}

function addPoolGuests(
  group: THREE.Group,
  blockers: Blocker[],
  disposables: Array<{ dispose: () => void }>,
): { guests: PoolGuest[]; walkers: PoolWalker[] } {
  const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.62, 4, 8);
  const headGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const hairGeo = new THREE.SphereGeometry(0.155, 10, 8);
  const limbGeo = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(bodyGeo, headGeo, hairGeo, limbGeo);

  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (hex: string, roughness: number) => {
    const key = `${hex}:${roughness}`;
    let material = mats.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: hex, roughness });
      mats.set(key, material);
      disposables.push(material);
    }
    return material;
  };

  const figureOf = (pose: PoolPose, cloth: string, i: number) => {
    const clothMat = mat(cloth, 0.78);
    const skinMat = mat(POOL_SKIN[i % POOL_SKIN.length], 0.72);
    const hairMat = mat(POOL_HAIR[i % POOL_HAIR.length], 0.86);
    const pivot = new THREE.Group();
    const figure = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, clothMat);
    const head = new THREE.Mesh(headGeo, skinMat);
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    body.castShadow = true;
    head.castShadow = true;
    hairMesh.castShadow = true;
    hairMesh.scale.set(1.1, 0.64, 1.08);

    if (pose === "sit") {
      body.scale.set(1, 0.7, 0.92);
      body.position.set(0, 1.0, 0.02);
      head.position.set(0, 1.44, 0.05);
      hairMesh.position.set(0, 1.52, 0.03);
      const thighs = new THREE.Mesh(limbGeo, clothMat);
      thighs.scale.set(0.42, 0.14, 0.46);
      thighs.position.set(0, 0.73, 0.22);
      const shins = new THREE.Mesh(limbGeo, clothMat);
      shins.scale.set(0.34, 0.44, 0.12);
      shins.position.set(0, 0.4, 0.42);
      figure.add(body, head, hairMesh, thighs, shins);
    } else if (pose === "lie" || pose === "swim") {
      body.position.y = 0.54;
      head.position.y = 1.18;
      hairMesh.position.set(0, 1.28, 0.02);
      const arms = new THREE.Mesh(limbGeo, skinMat);
      arms.scale.set(0.78, 0.09, 0.09);
      arms.position.set(0, 0.92, 0);
      figure.add(body, head, hairMesh, arms);
      figure.rotation.z = -Math.PI / 2;
    } else if (pose === "tread") {
      body.scale.set(1.04, 0.82, 1.04);
      body.position.y = 0.48;
      head.position.y = 1.04;
      hairMesh.position.set(0, 1.12, 0);
      figure.add(body, head, hairMesh);
    } else {
      body.position.y = 0.58;
      head.position.y = 1.22;
      hairMesh.position.set(0, 1.32, 0);
      figure.add(body, head, hairMesh);
    }

    pivot.add(figure);
    group.add(pivot);
    return { pivot, figure };
  };

  const guests: PoolGuest[] = [];
  const add = (
    pose: PoolPose,
    x: number,
    y: number,
    z: number,
    yaw: number,
    cloth: string,
    i: number,
    block = true,
  ) => {
    const { pivot } = figureOf(pose, cloth, i);
    pivot.position.set(x, y, z);
    pivot.rotation.y = yaw;
    guests.push({ root: pivot, pose, phase: i * 1.17, baseY: y, baseYaw: yaw });
    if (block) {
      const r = pose === "sit" ? 0.38 : pose === "stand" ? 0.32 : 0.55;
      blockers.push({ minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r });
    }
  };

  // Cabana: bartender plus three guests on the stools.
  add("stand", -13.45, 0, -6.95, Math.PI / 2, "#ece6da", 0, false);
  add("sit", -11.12, 0, -8.14, -Math.PI / 2, POOL_CASUAL[0], 1);
  add("sit", -11.12, 0, -6.94, -Math.PI / 2, POOL_CASUAL[1], 2);
  add("sit", -11.12, 0, -5.74, -Math.PI / 2, POOL_CASUAL[2], 3);

  // Grass loungers — lie along the chair, head toward the pool.
  add("lie", -14.7, 0.48, 5.47, 0, POOL_SWIM[0], 4);
  add("lie", -14.7, 0.48, 9.87, 0, POOL_CASUAL[3], 5);
  add("lie", 14.85, 0.48, 5.47, Math.PI, POOL_SWIM[1], 6);
  add("lie", 14.85, 0.48, 9.87, Math.PI, POOL_SWIM[2], 7);

  // Submerged shelf loungers.
  add("lie", -5.05, 0.38, -4.1, 0, POOL_SWIM[3], 8);
  add("lie", -1.45, 0.38, -4.1, 0, POOL_SWIM[4], 9);
  add("lie", 2.15, 0.38, -4.1, 0, POOL_SWIM[5], 10);

  // Deep water: floaters on their backs and people treading.
  add("swim", 5.6, 0.08, 0.9, 0.15, POOL_SWIM[0], 11);
  add("swim", -6.1, 0.08, 2.6, Math.PI - 0.2, POOL_SWIM[1], 12);
  add("swim", 4.9, 0.08, 5.8, Math.PI / 2, POOL_SWIM[4], 13);
  add("tread", -5.9, -0.62, 6.5, 0.5, POOL_SWIM[2], 14);
  add("tread", 6.5, -0.62, 3.4, -1.2, POOL_SWIM[3], 15);
  add("tread", -2.6, -0.58, 4.9, 2.1, POOL_SWIM[5], 16);

  const door: PoolStop = { x: 1.2, z: -14.55 };
  const elevator: PoolStop = { x: 0.2, z: 14.45 };
  const plaza: PoolStop = { x: 0, z: -8.4 };
  const cabana: PoolStop = { x: -10.05, z: -4.15, wait: 5.2, yaw: -Math.PI / 2 };
  const westLane: PoolStop = { x: -9.5, z: 2.6 };
  const westNorth: PoolStop = { x: -9.5, z: 10.4 };
  const northMid: PoolStop = { x: 0, z: 12.35, wait: 6.5, yaw: 0 };
  const northWest: PoolStop = { x: -10.2, z: 12.35, wait: 5, yaw: 0 };
  const northEast: PoolStop = { x: 8.2, z: 12.35, wait: 5.5, yaw: 0 };
  const eastLane: PoolStop = { x: 10.2, z: 6.1 };
  const eastSouth: PoolStop = { x: 10.2, z: 1.15 };
  const eastRail: PoolStop = { x: 16.55, z: 7.7, wait: 5.4, yaw: Math.PI / 2 };
  const westRail: PoolStop = { x: -16.55, z: 1.9, wait: 5, yaw: -Math.PI / 2 };
  const westCorner: PoolStop = { x: -16.5, z: 12.2 };
  const poolWest: PoolStop = { x: -8.7, z: 0.7, wait: 2.8, yaw: Math.PI / 2 };
  const poolEast: PoolStop = { x: 8.7, z: 1.8, wait: 2.4, yaw: -Math.PI / 2 };

  const routes: Array<{ cloth: string; speed: number; lookout: PoolStop; path: PoolStop[] }> = [
    {
      cloth: POOL_CASUAL[0],
      speed: 1.12,
      lookout: northMid,
      path: [
        { ...door, hide: true, wait: 4.5 },
        door,
        plaza,
        cabana,
        westLane,
        northMid,
        plaza,
        door,
        { ...door, hide: true, wait: 9 },
      ],
    },
    {
      cloth: POOL_CASUAL[1],
      speed: 1.05,
      lookout: northEast,
      path: [
        { ...elevator, hide: true, wait: 5.5 },
        elevator,
        northEast,
        eastLane,
        poolEast,
        eastSouth,
        plaza,
        door,
        { ...door, hide: true, wait: 8 },
      ],
    },
    {
      cloth: POOL_SWIM[1],
      speed: 1.18,
      lookout: northEast,
      path: [eastLane, eastSouth, plaza, cabana, plaza, eastSouth, eastLane, eastRail],
    },
    {
      cloth: POOL_SWIM[0],
      speed: 1.08,
      lookout: northMid,
      path: [poolWest, westLane, westNorth, northMid, northWest, westCorner, westRail, westLane],
    },
    {
      cloth: POOL_SWIM[4],
      speed: 1.22,
      lookout: northEast,
      path: [poolEast, eastLane, eastRail, northEast, northMid, westNorth, cabana, westLane],
    },
    {
      cloth: POOL_CASUAL[3],
      speed: 1.15,
      lookout: northWest,
      path: [
        { ...elevator, hide: true, wait: 6.2 },
        elevator,
        northWest,
        westLane,
        cabana,
        plaza,
        elevator,
        { ...elevator, hide: true, wait: 7.5 },
      ],
    },
    {
      cloth: POOL_CASUAL[2],
      speed: 0.98,
      lookout: { x: -4.2, z: 12.35, wait: 7, yaw: 0 },
      path: [
        { x: 6.2, z: -8.4 },
        plaza,
        door,
        { ...door, hide: true, wait: 6.5 },
        door,
        plaza,
        eastSouth,
        eastLane,
        northMid,
        plaza,
      ],
    },
  ];

  const walkers: PoolWalker[] = routes.map((route, i) => {
    const { pivot, figure } = figureOf("stand", route.cloth, 20 + i);
    const startAt = i % route.path.length;
    const start = route.path[startAt];
    pivot.position.set(start.x, 0, start.z);
    pivot.visible = !start.hide;
    if (start.yaw != null) pivot.rotation.y = start.yaw;
    return {
      root: pivot,
      figure,
      path: route.path,
      lookout: route.lookout,
      index: startAt,
      waitLeft: start.hide ? start.wait ?? 3 : 0.4 + i * 0.35,
      speed: route.speed,
      phase: i * 1.7,
      watching: false,
    };
  });

  return { guests, walkers };
}

function buildPool(building: Building, state: CityState): LodgingInterior {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();

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

  // Low parapet — look over it at the city.
  wallB.box(minX, minZ, minX + 0.45, maxZ, 0, 0.72, cream);
  wallB.box(maxX - 0.45, minZ, maxX, maxZ, 0, 0.72, cream);
  wallB.box(minX, maxZ - 0.45, maxX, maxZ, 0, 0.62, cream);
  blockers.push({ minX, maxX: minX + 0.45, minZ, maxZ });
  blockers.push({ minX: maxX - 0.45, maxX, minZ, maxZ });
  blockers.push({ minX, maxX, minZ: maxZ - 0.45, maxZ });

  // Walk-in pool: basin walls + bottom, water surface, no collision in the water.
  const px0 = -8.1;
  const px1 = 8.1;
  const deepZ0 = -2.2;
  const deepZ1 = 7.8;
  const shelfZ0 = -6.0;
  const shelfZ1 = -2.2;
  const bottom = -0.9;
  const lip = 0.06;
  wallB.box(px0 - 0.35, deepZ0 - 0.2, px0, deepZ1 + 0.2, bottom, 0.1, dark);
  wallB.box(px1, deepZ0 - 0.2, px1 + 0.35, deepZ1 + 0.2, bottom, 0.1, dark);
  wallB.box(px0 - 0.35, deepZ1, px1 + 0.35, deepZ1 + 0.28, bottom, 0.1, dark);
  wallB.box(px0 - 0.35, shelfZ0 - 0.2, px1 + 0.35, shelfZ0, bottom, 0.1, dark);
  floorB.ground(px0, deepZ0, px1, deepZ1, bottom, dark);
  floorB.ground(px0, deepZ0, px1, deepZ1, lip, water);
  floorB.ground(px0, shelfZ0, px1, shelfZ1, 0.12, shelf);

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

  // Open cabana bar — walk up to the counter for food and drinks.
  const barX0 = -16.2;
  const barX1 = -11.7;
  const barZ0 = -9.4;
  const barZ1 = -4.55;
  const teal = new THREE.Color("#1a6b6b");
  const wood = new THREE.Color("#6b4a32");
  const bottle = ["#1f4d8c", "#c0392b", "#e8c36a", "#2aa8c4", "#f4f1ea"];
  wallB.box(barX0, barZ0, barX0 + 0.42, barZ1, 0, 3.15, cream);
  wallB.box(barX0, barZ0, barX1, barZ0 + 0.38, 0, 3.15, cream);
  wallB.box(barX0, barZ1 - 0.38, barX1, barZ1, 0, 3.15, cream);
  trimB.box(barX0 - 0.12, barZ0 - 0.2, barX1 + 0.9, barZ1 + 0.2, 3.08, 3.32, teal);
  trimB.box(barX1 - 0.5, barZ0 + 0.28, barX1 + 0.18, barZ1 - 0.28, 1.02, 1.2, wood);
  trimB.box(barX0 + 0.42, barZ0 + 0.45, barX0 + 0.92, barZ1 - 0.45, 1.35, 2.55, wood);
  blockers.push({ minX: barX0, maxX: barX1, minZ: barZ0, maxZ: barZ1 });
  for (let i = 0; i < 5; i++) {
    const z = barZ0 + 0.85 + i * 0.85;
    const color = new THREE.Color(bottle[i]);
    trimB.box(barX0 + 0.5, z, barX0 + 0.78, z + 0.22, 1.55, 2.05, color);
  }
  for (let i = 0; i < 4; i++) {
    const z = barZ0 + 1.1 + i * 1.05;
    trimB.box(barX1 - 0.42, z, barX1 - 0.08, z + 0.32, 1.2, 1.42, new THREE.Color(i % 2 ? "#e8c36a" : "#c0392b"));
  }
  for (const z of [-8.35, -7.15, -5.95]) {
    trimB.box(-11.35, z, -10.88, z + 0.42, 0, 0.7, navy);
    blockers.push({ minX: -11.35, maxX: -10.88, minZ: z, maxZ: z + 0.42 });
  }
  addBarSign(group, disposables, "CABANA", "Food · Drinks", "#1a6b6b", barX1 + 0.22, 2.42, (barZ0 + barZ1) / 2, -Math.PI / 2, 3.6);

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

  const roofFloor = Math.max(8, building.floors);
  addCityView(floorB, wallB, trimB, building, state, {
    edgeZ: maxZ,
    toward: 1,
    floor: roofFloor,
  });
  addCityFlank(floorB, wallB, trimB, building, state, maxX, 1, roofFloor);
  addCityFlank(floorB, wallB, trimB, building, state, minX, -1, roofFloor);

  assemble(group, floorB, wallB, trimB, disposables);
  const { guests, walkers } = addPoolGuests(group, blockers, disposables);
  let guestTime = 0;

  const stepWalker = (walker: PoolWalker, dt: number, fireworks: boolean) => {
    const dest = walker.watching ? walker.lookout : walker.path[walker.index];
    if (walker.waitLeft > 0) {
      walker.waitLeft -= dt;
      walker.figure.position.y = 0;
      if (dest.yaw != null && !dest.hide) {
        walker.root.rotation.y += (dest.yaw - walker.root.rotation.y) * Math.min(1, dt * 4);
      }
      if (walker.waitLeft > 0) return;
      if (walker.watching) {
        walker.watching = false;
      } else {
        walker.index = (walker.index + 1) % walker.path.length;
        if (fireworks) walker.watching = true;
      }
      return;
    }

    const target = walker.watching ? walker.lookout : walker.path[walker.index];
    const dx = target.x - walker.root.position.x;
    const dz = target.z - walker.root.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.14) {
      walker.root.position.x = target.x;
      walker.root.position.z = target.z;
      walker.figure.position.y = 0;
      walker.root.visible = !target.hide;
      walker.waitLeft = target.wait ?? (target.hide ? 4 : 0.35);
      if (target.yaw != null && !target.hide) walker.root.rotation.y = target.yaw;
      return;
    }

    walker.root.visible = true;
    const step = Math.min(dist, walker.speed * dt);
    walker.root.position.x += (dx / dist) * step;
    walker.root.position.z += (dz / dist) * step;
    walker.root.rotation.y = Math.atan2(dx, dz);
    walker.figure.position.y = Math.sin(guestTime * 10.5 + walker.phase) * 0.045;
  };

  return {
    group,
    blockers,
    spawn: { x: 0, z: -8.2, yaw: Math.PI, pitch: -0.08 },
    bounds: { minX, maxX, minZ, maxZ },
    deskMat: null,
    tv: null,
    groundAt: (x, z) => {
      if (x > px0 && x < px1 && z > deepZ0 && z < deepZ1) return -0.62;
      if (x > px0 && x < px1 && z > shelfZ0 && z < shelfZ1) return 0.12;
      return 0;
    },
    nearDesk: (x, z) => x > -12.05 && x < -8.7 && z > -9.35 && z < -4.6,
    nearComputer: () => false,
    nearBed: () => false,
    nearExit: (_x, z) => z > 12.8,
    computerHit: null,
    windowMesh: null,
    windowAnchor: null,
    slider: null,
    update: (dt, ctx) => {
      guestTime += dt;
      for (const guest of guests) {
        if (guest.pose !== "swim" && guest.pose !== "tread") continue;
        const bob =
          Math.sin(guestTime * (guest.pose === "tread" ? 1.7 : 1.15) + guest.phase) *
          (guest.pose === "tread" ? 0.07 : 0.04);
        guest.root.position.y = guest.baseY + bob;
        guest.root.rotation.y =
          guest.baseYaw + Math.sin(guestTime * 0.45 + guest.phase) * (guest.pose === "tread" ? 0.22 : 0.08);
      }
      const fireworks = Boolean(ctx?.fireworks);
      for (const walker of walkers) stepWalker(walker, dt, fireworks);
    },
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

function addBarSign(
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
  ctx.fillStyle = "#b8f0e8";
  ctx.fillText(subtitle, 256, 118);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.45,
    roughness: 0.5,
  });
  const geo = new THREE.PlaneGeometry(width, 0.9);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  group.add(mesh);
  disposables.push(geo, tex, mat);
}

function inkColor() {
  return new THREE.Color(INK);
}
