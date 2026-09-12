import * as THREE from "three";
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
  nearExit: (x: number, z: number) => boolean;
  computerHit: THREE.Object3D | null;
  dispose: () => void;
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
    tv: null,
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

function buildRoom(building: Building, state: CityState, room: LodgingRoom | null): LodgingInterior {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();
  const hotel = lodgingUse(building) === "hotel";
  const club = Boolean(room && hotel && room.floor >= Math.max(2, building.floors - 2));

  const minX = -7.5;
  const maxX = 7.5;
  const minZ = -6.5;
  const maxZ = 8.5;
  const ceilY = 4.35;
  const winX0 = -2.85;
  const winX1 = 3.25;
  const winY0 = 1.05;
  const winY1 = 3.55;
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

  addCityView(floorB, wallB, trimB, building, state, minZ, room?.floor ?? 8);

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
    spawn: { x: 0.3, z: 3.4, yaw: 0, pitch: -0.06 },
    bounds: { minX, maxX, minZ, maxZ },
    deskMat: null,
    tv,
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

function addCityView(
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  here: Building,
  state: CityState,
  windowZ: number,
  floor = 8,
) {
  const groundY = -10 - floor * 1.35;
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
    tv: null,
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
