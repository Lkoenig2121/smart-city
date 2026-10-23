import * as THREE from "three";
import type { Building } from "@/lib/city/types";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";
import type { LodgingInterior } from "./lodgingInterior";
import { addRoomTelevision } from "./roomTv";

const BOOK_SPINES = ["#c4493a", "#1f3f78", "#e6d7b8", "#2f6b45", "#d4a017", "#5c6b8a", "#8d3a4a", "#eceae4", "#3a5a40", "#b9c4ce", "#6a5340"];

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
  shellB: MeshBuilder,
  disposables: Array<{ dispose: () => void }>,
) {
  const add = (builder: MeshBuilder, material: THREE.Material, shadows = true) => {
    if (builder.empty) {
      material.dispose();
      return;
    }
    const geometry = builder.build();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = shadows;
    mesh.castShadow = shadows;
    group.add(mesh);
    disposables.push(geometry, material);
  };
  add(floorB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
  add(wallB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 }));
  add(shellB, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), false);
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

/** A short run of book spines, enough to read as shelves without a huge mesh. */
function addBookcase(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  y1: number,
  rows: number,
  face: "x" | "z",
) {
  const white = new THREE.Color("#f7f6f3");
  wallB.box(x0, z0, x1, z1, y0, y1, white);
  const span = Math.abs(face === "z" ? x1 - x0 : z1 - z0);
  const count = Math.min(12, Math.max(6, Math.floor(span / 0.18)));
  for (let r = 0; r < rows; r++) {
    const y = y0 + 0.08 + ((r + 1) * (y1 - y0 - 0.16)) / (rows + 1);
    if (face === "z") trimB.box(x0 + 0.05, z0 + 0.04, x1 - 0.05, z0 + 0.08, y, y + 0.035, white);
    else trimB.box(x0 + 0.04, z0 + 0.05, x0 + 0.08, z1 - 0.05, y, y + 0.035, white);
    for (let n = 0; n < count; n++) {
      const t0 = (n + 0.12) / count;
      const t1 = (n + 0.78) / count;
      const color = new THREE.Color(BOOK_SPINES[(r * 3 + n) % BOOK_SPINES.length]);
      const top = Math.min(y + 0.26 + (n % 3) * 0.012, y1 - 0.08);
      if (face === "z") trimB.box(x0 + span * t0, z0 + 0.09, x0 + span * t1, z1 - 0.05, y + 0.04, top, color);
      else trimB.box(x0 + 0.09, z0 + span * t0, x1 - 0.05, z0 + span * t1, y + 0.04, top, color);
    }
  }
}

export function addTownhouseComputer(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  at: { x: number; y: number; z: number; yaw: number },
) {
  const computer = new THREE.Group();
  computer.name = "computer";
  computer.position.set(at.x, at.y, at.z);
  computer.rotation.y = at.yaw;

  const silver = new THREE.MeshStandardMaterial({ color: "#c8ccd1", roughness: 0.28, metalness: 0.62 });
  const inkMat = new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.4, metalness: 0.2 });
  const keys = new THREE.MeshStandardMaterial({ color: "#ece8e1", roughness: 0.55 });
  disposables.push(silver, inkMat, keys);

  const addBox = (mat: THREE.MeshStandardMaterial, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    computer.add(mesh);
    disposables.push(geo);
  };

  const deskY = 0.8;
  addBox(silver, 0.42, 0.04, 0.28, -0.28, deskY + 0.04, 0);
  addBox(silver, 0.06, 0.32, 0.06, -0.28, deskY + 0.22, 0);
  addBox(inkMat, 0.06, 0.92, 1.28, -0.32, deskY + 0.72, 0);
  addBox(keys, 0.26, 0.025, 0.72, 0.05, deskY + 0.03, 0);
  addBox(inkMat, 0.1, 0.03, 0.16, 0.12, deskY + 0.03, 0.48);

  const wallpaper = makeComputerWallpaper();
  const screenMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: wallpaper ?? undefined,
    emissive: new THREE.Color("#ffffff"),
    emissiveMap: wallpaper ?? undefined,
    emissiveIntensity: 0.55,
    roughness: 0.18,
  });
  const screenGeo = new THREE.PlaneGeometry(1.16, 0.72);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(-0.28, deskY + 0.74, 0);
  screen.rotation.y = -Math.PI / 2;
  computer.add(screen);
  disposables.push(screenGeo, screenMat);
  if (wallpaper) disposables.push(wallpaper);

  const glow = new THREE.PointLight(0x9ecfff, 2.4, 4.5, 2);
  glow.position.set(0.15, 1.35, 0);
  computer.add(glow);

  const hitGeo = new THREE.BoxGeometry(0.7, 1.15, 1.45);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.position.set(-0.15, 1.15, 0);
  computer.add(hit);
  disposables.push(hitGeo, hitMat);

  group.add(computer);
  return computer;
}

function makeComputerWallpaper() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const sky = ctx.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, "#3d6aa8");
  sky.addColorStop(0.45, "#f0b27a");
  sky.addColorStop(1, "#16324a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = "#ffd19a";
  ctx.beginPath();
  ctx.arc(460, 120, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "600 28px sans-serif";
  ctx.fillText("Smart City", 36, 64);
  ctx.font = "16px sans-serif";
  ctx.fillText("Home office", 36, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Parlor for one home in the row: navy stairs on the left, kitchen through
 * the opening, fireplace and shelves ahead. The stairs are a walkable ramp.
 */
export function buildTownhouseHome(building: Building): LodgingInterior {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();
  const shellB = new MeshBuilder();

  const minX = -6.5;
  const maxX = 6.6;
  const minZ = -8.2;
  const maxZ = 8.4;
  const UP = 3.2;
  const TOP = 6.4;
  const hasUp = building.floors >= 2;
  const SX0 = -6.15;
  const SX1 = -3.4;
  const SZ0 = -0.35;
  const SZ1 = 4.35;
  // Flat top landing, then open mouths at the upper and lower ends of the run.
  const LAND_Z = SZ0 + 1.6;
  const MOUTH_Z = SZ1 - 1.8;
  const wall = 0.24;
  const shellTop = hasUp ? TOP : 3.15;
  const ceilY = hasUp ? UP : shellTop;

  const oak = new THREE.Color("#e4c8a0");
  const white = new THREE.Color("#f4f5f7");
  const ceiling = new THREE.Color("#f7f7f8");
  const navy = new THREE.Color("#1f3f78");
  const tread = new THREE.Color("#3a2c24");
  const ink = new THREE.Color("#1c2128");
  const sofa = new THREE.Color("#d5d3ce");
  const cushion = new THREE.Color("#eceae6");
  const stone = new THREE.Color("#3a3d42");
  const hearth = new THREE.Color("#2a2d32");
  const marble = new THREE.Color("#e7e4df");
  const metal = new THREE.Color("#c5c8cc");
  const cabinet = new THREE.Color("#f7f6f3");
  const counter = new THREE.Color("#2c3138");
  const linen = new THREE.Color("#f4f1ea");
  const wood = new THREE.Color("#8a6848");
  const orange = new THREE.Color("#e25a2a");
  const bowl = new THREE.Color("#2f4a32");

  const low = (box: Blocker) => blockers.push(hasUp ? { ...box, maxY: 2.55 } : box);
  const high = (box: Blocker) => blockers.push({ ...box, minY: UP + 0.08 });

  floorB.ground(minX, minZ, maxX, maxZ, 0, oak);

  shellB.box(minX, minZ, minX + wall, maxZ, 0, shellTop, white);
  shellB.box(maxX - wall, minZ, maxX, maxZ, 0, shellTop, white);
  blockers.push({ minX, maxX: minX + wall, minZ, maxZ });
  blockers.push({ minX: maxX - wall, maxX, minZ, maxZ });

  const winX0 = -3.4;
  const winX1 = 2.6;
  shellB.box(minX, minZ, winX0, minZ + wall, 0, shellTop, white);
  shellB.box(winX1, minZ, maxX, minZ + wall, 0, shellTop, white);
  shellB.box(winX0, minZ, winX1, minZ + wall, 0, 0.72, white);
  shellB.box(winX0, minZ, winX1, minZ + wall, 2.45, hasUp ? UP : shellTop, white);
  if (hasUp) {
    shellB.box(winX0, minZ, winX1, minZ + wall, UP, UP + 0.42, white);
    shellB.box(winX0, minZ, winX1, minZ + wall, TOP - 0.4, TOP, white);
  }
  blockers.push({ minX, maxX, minZ, maxZ: minZ + wall });

  shellB.box(minX, maxZ - wall, -1.2, maxZ, 0, shellTop, white);
  shellB.box(1.2, maxZ - wall, maxX, maxZ, 0, shellTop, white);
  shellB.box(-1.2, maxZ - wall, 1.2, maxZ, 2.35, shellTop, white);
  blockers.push({ minX, maxX: -1.2, minZ: maxZ - wall, maxZ });
  blockers.push({ minX: 1.2, maxX, minZ: maxZ - wall, maxZ });
  blockers.push({ minX: -1.2, maxX: 1.2, minZ: maxZ - wall, maxZ, minY: 2.15 });

  const partition = -1.62;

  if (hasUp) {
    const slab = (x0: number, z0: number, x1: number, z1: number, inset = 0.55) => {
      floorB.ground(x0, z0, x1, z1, UP, oak);
      floorB.soffit(x0, z0, x1, z1, UP - 0.14, ceiling);
      const ix0 = x0 + (x0 > SX0 ? inset : 0);
      const iz0 = z0 + (z0 >= SZ0 - 0.01 && z0 < SZ1 ? inset : 0);
      const iz1 = z1 - (z1 <= SZ0 + 0.01 ? inset : 0);
      blockers.push({
        minX: ix0,
        maxX: x1,
        minZ: iz0,
        maxZ: iz1,
        minY: UP - 0.2,
        maxY: UP - 0.12,
      });
    };
    slab(minX + wall, minZ + wall, maxX - wall, SZ0);
    slab(SX1, SZ0, maxX - wall, SZ1);
    slab(minX + wall, SZ1, maxX - wall, maxZ - wall);
    addCeiling(floorB, minX, minZ, maxX, maxZ, TOP, ceiling);
    trimB.box(SX1 - 0.06, LAND_Z + 0.5, SX1 + 0.06, SZ1, UP + 0.72, UP + 0.9, navy);
    trimB.box(SX0, SZ1 - 0.05, SX1, SZ1 + 0.06, UP + 0.72, UP + 0.9, navy);
    blockers.push({
      minX: SX1 - 0.1,
      maxX: SX1 + 0.1,
      minZ: LAND_Z + 0.5,
      maxZ: SZ1,
      minY: UP + 0.55,
      maxY: UP + 1.05,
    });
    blockers.push({
      minX: SX0,
      maxX: SX1,
      minZ: SZ1 - 0.08,
      maxZ: SZ1 + 0.1,
      minY: UP + 0.55,
      maxY: UP + 1.05,
    });
  } else {
    addCeiling(floorB, minX, minZ, maxX, maxZ, shellTop, ceiling);
  }

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#d7eef8",
    transparent: true,
    opacity: 0.12,
    roughness: 0.04,
    metalness: 0.15,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const addPane = (x: number, y: number, z: number, w: number, h: number, rotY = 0) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mesh = new THREE.Mesh(geo, glassMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
    disposables.push(geo);
  };
  addPane((winX0 + winX1) / 2, 1.58, minZ + 0.2, winX1 - winX0 - 0.2, 1.65);
  if (hasUp) addPane((winX0 + winX1) / 2, (UP + 0.42 + TOP - 0.4) / 2, minZ + 0.2, winX1 - winX0 - 0.2, TOP - UP - 0.95);
  trimB.box(winX0, minZ + 0.02, winX0 + 0.06, minZ + 0.18, 0.72, hasUp ? TOP - 0.4 : 2.45, ink);
  trimB.box(winX1 - 0.06, minZ + 0.02, winX1, minZ + 0.18, 0.72, hasUp ? TOP - 0.4 : 2.45, ink);

  if (hasUp) {
    floorB.ground(SX0 + 0.08, SZ0 - 0.08, SX1 + 0.85, LAND_Z, UP, oak);
    floorB.soffit(SX0 + 0.08, SZ0 - 0.08, SX1 + 0.85, LAND_Z, UP - 0.14, ceiling);
    const steps = 12;
    const run = (SZ1 - LAND_Z) / steps;
    for (let i = 0; i < steps; i++) {
      const z1 = SZ1 - i * run;
      const z0 = z1 - run;
      const y = ((i + 1) / steps) * UP;
      const prev = (i / steps) * UP;
      wallB.box(SX0 + 0.14, z0, SX1 - 0.12, z1, y - 0.07, y, tread);
      wallB.box(SX0 + 0.14, z1 - 0.045, SX1 - 0.12, z1, prev, y - 0.02, white);
    }
    trimB.box(SX1 - 0.06, LAND_Z + 0.5, SX1 + 0.06, MOUTH_Z, 0.55, UP + 0.15, navy);
    trimB.box(SX0 + 0.02, LAND_Z + 0.5, SX0 + 0.1, MOUTH_Z, 0.35, UP + 0.9, tread);
    blockers.push({ minX: SX0, maxX: SX0 + 0.12, minZ: LAND_Z + 0.5, maxZ: MOUTH_Z, maxY: UP + 0.15 });
    blockers.push({ minX: SX1 - 0.08, maxX: SX1 + 0.08, minZ: LAND_Z + 0.5, maxZ: MOUTH_Z, maxY: UP + 0.15 });
  }

  wallB.box(-5.7, -7.95, -3.45, -7.15, 0, 0.92, cabinet);
  wallB.box(2.7, -7.95, 5.5, -7.15, 0, 0.92, cabinet);
  wallB.box(winX0, -7.95, winX1, -7.2, 0, 0.9, cabinet);
  trimB.box(-5.75, -8.0, 5.55, -7.12, 0.9, 1.0, counter);
  wallB.box(-5.65, -7.9, -3.5, -7.25, 1.45, 2.15, cabinet);
  wallB.box(2.75, -7.9, 5.4, -7.25, 1.45, 2.15, cabinet);
  trimB.box(-0.55, -7.55, 0.35, -7.25, 1.0, 1.12, metal);
  low({ minX: -5.8, maxX: 5.6, minZ: -8.02, maxZ: -7.1 });

  wallB.box(-4.35, -5.85, -1.15, -3.85, 0, 0.9, cabinet);
  trimB.box(-4.45, -5.95, -1.05, -3.75, 0.9, 1.0, counter);
  low({ minX: -4.5, maxX: -1.0, minZ: -6.0, maxZ: -3.7 });
  wallB.box(-3.9, -3.7, -3.35, -3.25, 0, 0.62, cabinet);
  wallB.box(-2.15, -3.7, -1.6, -3.25, 0, 0.62, cabinet);
  trimB.box(-3.75, -3.6, -3.5, -3.35, 0.62, 0.95, cushion);
  trimB.box(-2.0, -3.6, -1.75, -3.35, 0.62, 0.95, cushion);

  const pendantKitchen = new THREE.PointLight(0xfff6ea, 5, 8, 1.6);
  pendantKitchen.position.set(-2.7, 2.4, -4.8);
  group.add(pendantKitchen);
  trimB.box(-2.85, -4.95, -2.55, -4.65, 2.15, 2.35, ink);

  addBookcase(wallB, trimB, -0.05, partition + 0.12, 2.2, partition + 0.62, 0.15, 2.35, 4, "z");
  low({ minX: -0.05, maxX: 2.2, minZ: partition + 0.1, maxZ: partition + 0.66 });

  wallB.box(2.45, partition + 0.1, 6.15, -0.72, 0, 1.45, stone);
  wallB.box(2.35, -0.78, 6.25, -0.62, 0, 0.1, hearth);
  wallB.box(2.35, partition + 0.05, 6.25, -0.68, 1.45, 1.58, new THREE.Color("#5c6168"));
  wallB.box(3.55, -1.22, 5.15, -0.95, 0.32, 0.95, ink);
  low({ minX: 2.3, maxX: 6.3, minZ: partition, maxZ: -0.58 });
  trimB.box(3.7, -1.48, 5.05, -1.32, 1.68, 3.02, white);
  trimB.box(3.82, -1.44, 4.93, -1.34, 1.8, 2.9, new THREE.Color("#8d9398"));
  trimB.box(4.15, -1.42, 4.6, -1.36, 1.95, 2.7, new THREE.Color("#3e4650"));

  const fireGeo = new THREE.BoxGeometry(1.15, 0.38, 0.2);
  const fireMat = new THREE.MeshStandardMaterial({ color: "#ffb15a", emissive: "#ff6a1f", emissiveIntensity: 1.5 });
  const fire = new THREE.Mesh(fireGeo, fireMat);
  fire.position.set(4.35, 0.58, -1.08);
  group.add(fire);
  disposables.push(fireGeo, fireMat);
  const fireLight = new THREE.PointLight(0xff7a32, 6, 6, 1.8);
  fireLight.position.set(4.35, 0.7, -0.7);
  group.add(fireLight);

  wallB.box(0.2, -1.15, 0.85, -0.45, 0, 0.42, ink);
  wallB.box(0.28, -1.05, 0.78, -0.55, 0.42, 0.85, orange);
  low({ minX: 0.2, maxX: 0.85, minZ: -1.15, maxZ: -0.45 });

  addBookcase(wallB, trimB, maxX - wall - 0.42, 3.15, maxX - wall - 0.02, 6.85, 0.12, 2.7, 5, "x");
  low({ minX: maxX - wall - 0.46, maxX: maxX - wall, minZ: 3.1, maxZ: 6.9 });

  wallB.box(-1.25, 1.9, 1.45, 3.55, 0.16, 0.46, sofa);
  wallB.box(-1.25, 2.85, 1.15, 3.58, 0.46, 0.95, sofa);
  wallB.box(-1.28, 1.85, -1.0, 3.58, 0.46, 0.82, sofa);
  wallB.box(-0.95, 1.98, 1.1, 2.75, 0.46, 0.62, cushion);
  wallB.box(-0.7, 2.9, -0.15, 3.4, 0.62, 0.82, cushion);
  wallB.box(0.15, 2.9, 0.75, 3.4, 0.62, 0.82, new THREE.Color("#c5c8ce"));
  wallB.box(1.2, 1.35, 3.15, 2.7, 0.16, 0.46, sofa);
  wallB.box(1.28, 1.45, 3.05, 2.58, 0.46, 0.6, cushion);
  low({ minX: -1.32, maxX: 3.2, minZ: 1.3, maxZ: 3.62 });

  const tableGeo = new THREE.BoxGeometry(1.7, 0.04, 0.85);
  const tableMat = new THREE.MeshStandardMaterial({
    color: "#d5e8ee",
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0.2,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.set(0.55, 0.42, 0.85);
  group.add(table);
  disposables.push(tableGeo, tableMat);
  trimB.box(0.05, 0.5, 0.12, 0.58, 0.02, 0.42, metal);
  trimB.box(0.98, 0.5, 1.05, 0.58, 0.02, 0.42, metal);
  trimB.box(0.05, 1.15, 0.12, 1.23, 0.02, 0.42, metal);
  trimB.box(0.98, 1.15, 1.05, 1.23, 0.02, 0.42, metal);
  low({ minX: -0.35, maxX: 1.45, minZ: 0.4, maxZ: 1.3 });

  trimB.box(1.85, 3.7, 2.65, 4.5, 0.58, 0.66, marble);
  trimB.box(2.14, 3.98, 2.36, 4.2, 0.1, 0.58, white);
  trimB.box(1.98, 3.82, 2.52, 4.36, 0.02, 0.1, white);
  trimB.box(2.08, 3.92, 2.42, 4.22, 0.66, 0.8, bowl);
  low({ minX: 1.8, maxX: 2.7, minZ: 3.65, maxZ: 4.55 });

  wallB.box(4.55, 5.05, 5.95, 6.4, 0.12, 0.48, new THREE.Color("#3e4c66"));
  wallB.box(5.35, 5.15, 5.95, 6.3, 0.48, 0.85, new THREE.Color("#3e4c66"));
  low({ minX: 4.55, maxX: 5.95, minZ: 5.05, maxZ: 6.4 });


  if (hasUp) {
    wallB.box(1.3, -7.15, 5.3, -4.55, UP, UP + 0.36, wood);
    wallB.box(1.5, -6.95, 5.1, -4.75, UP + 0.36, UP + 0.7, linen);
    wallB.box(1.35, -7.3, 5.25, -7.0, UP + 0.36, UP + 1.08, wood);
    wallB.box(1.9, -6.6, 3.0, -5.7, UP + 0.7, UP + 0.9, cushion);
    wallB.box(3.5, -6.6, 4.6, -5.7, UP + 0.7, UP + 0.9, cushion);
    high({ minX: 1.3, maxX: 5.3, minZ: -7.35, maxZ: -4.55 });
    trimB.box(0.7, -6.3, 1.25, -5.4, UP, UP + 0.46, wood);
    trimB.box(5.35, -6.3, 5.9, -5.4, UP, UP + 0.46, wood);
    wallB.box(4.85, 5.4, 6.22, 6.9, UP, UP + 0.74, wood);
    trimB.box(4.8, 5.35, 6.28, 6.95, UP + 0.74, UP + 0.8, new THREE.Color("#3a2a1c"));
    wallB.box(4.15, 5.7, 4.7, 6.55, UP, UP + 0.46, navy);
    high({ minX: 4.1, maxX: 6.3, minZ: 5.3, maxZ: 7.0 });
    const lamp = new THREE.PointLight(0xfff1d6, 4, 7, 1.8);
    lamp.position.set(3.2, UP + 2.15, -6.0);
    group.add(lamp);
    const office = new THREE.PointLight(0xfff4e4, 7, 10, 1.6);
    office.position.set(2.4, UP + 2.3, 6.1);
    group.add(office);
  }

  const ballGeo = new THREE.IcosahedronGeometry(0.38, 1);
  const ballMat = new THREE.MeshStandardMaterial({ color: "#f6f1e6", wireframe: true, roughness: 0.45 });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.position.set(0.4, 2.35, 1.55);
  group.add(ball);
  disposables.push(ballGeo, ballMat);
  trimB.box(0.37, 1.5, 0.43, 1.58, 2.7, ceilY - 0.16, ink);
  const pendant = new THREE.PointLight(0xfff4e0, 7, 9, 1.5);
  pendant.position.set(0.4, 2.15, 1.55);
  group.add(pendant);

  const wash = (x: number, y: number, z: number, intensity: number, distance: number) => {
    const light = new THREE.PointLight(0xfff6ee, intensity, distance, 1.5);
    light.position.set(x, y, z);
    group.add(light);
  };
  wash(0.4, 2.35, 2.2, 18, 24);
  wash(4.6, 2.15, 1.4, 16, 18);
  wash(-3.4, 2.15, 2.2, 14, 18);
  wash(0.2, 2.2, 6.4, 14, 16);
  if (hasUp) {
    wash(1.2, UP + 1.9, -2.2, 16, 20);
    wash(2.2, UP + 1.9, 5.4, 14, 18);
  }

  assemble(group, floorB, wallB, trimB, shellB, disposables);
  disposables.push(glassMat);

  const screens = [
    addRoomTelevision(group, disposables, {
      mount: "wall",
      scale: 1.05,
      at: { x: 4.15, y: 2.25, z: -1.28, yaw: 0 },
    }),
    addRoomTelevision(group, disposables, {
      mount: "wall",
      scale: 1.05,
      at: { x: 0.35, y: UP + 1.55, z: maxZ - 0.46, yaw: Math.PI },
    }),
  ];
  const tv = {
    update: (dt: number, state: Parameters<(typeof screens)[number]["update"]>[1]) => {
      for (const screen of screens) screen.update(dt, state);
    },
    hasConsole: () => false,
    isNuketown: () => false,
    toggleNuketown: () => false,
    dispose: () => undefined,
  };
  const computer = addTownhouseComputer(group, disposables, { x: 5.15, y: UP, z: 6.15, yaw: Math.PI });

  const dreamGround = (x: number, z: number, feetY = 0) => {
    if (!hasUp) return 0;
    const onLanding = x > SX0 && x < SX1 + 0.95 && z > SZ0 - 0.45 && z < LAND_Z + 0.08;
    if (onLanding && feetY > UP - 1.15) return UP;
    const onStair = x > SX0 + 0.08 && x < SX1 + 0.2 && z >= LAND_Z - 0.05 && z < SZ1 + 0.3;
    if (onStair) {
      const t = Math.min(1, Math.max(0, (SZ1 - z) / (SZ1 - LAND_Z)));
      const ramp = t * UP;
      if (feetY > ramp - 1.35 && feetY < ramp + 1.2) return ramp;
    }
    const inHole = x > SX0 + 0.08 && x < SX1 - 0.02 && z > LAND_Z + 0.02 && z < SZ1 - 0.05;
    if (feetY > UP - 1.05 && !inHole) return UP;
    return 0;
  };

  return {
    group,
    blockers,
    spawn: { x: 0.15, z: 6.9, yaw: 0, pitch: -0.02 },
    bounds: { minX, maxX, minZ, maxZ },
    deskMat: null,
    tv,
    groundAt: dreamGround,
    nearDesk: () => false,
    nearComputer: (x, z) => x > 3.25 && x < 4.25 && z > 5.25 && z < 6.95,
    nearBed: (x, z) => hasUp && x > 1.6 && x < 5.0 && z > -4.05 && z < -3.15,
    nearConsole: () => false,
    nearExit: (x, z) => z > 7.3 && Math.abs(x) < 1.2,
    computerHit: computer,
    windowMesh: null,
    windowAnchor: { x: (winX0 + winX1) / 2, y: 1.55, z: minZ + 0.2 },
    slider: null,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}
