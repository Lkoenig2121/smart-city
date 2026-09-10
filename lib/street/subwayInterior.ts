import * as THREE from "three";
import { stationDef, SUBWAY_LINE, type SubwayStationDef } from "@/lib/city/subway";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";

export const HALL_Y = 4.15;
export const PLATFORM_Y = 0;
export const PIT_Y = -1.82;
export const TRACK_Z = -2.05;
export const PLATFORM_EDGE = 1.22;

export interface SubwayInterior {
  group: THREE.Group;
  train: THREE.Group;
  blockers: Blocker[];
  spawn: { x: number; z: number; yaw: number; pitch: number };
  platformSpawn: { x: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  groundAt: (x: number, z: number) => number;
  nearExit: (x: number, z: number) => boolean;
  nearPlatform: (x: number, z: number) => boolean;
  sign: THREE.MeshStandardMaterial;
  dispose: () => void;
}

/**
 * Open mezzanine over a long platform. Stairs drop you onto the deck facing
 * the rails; the tunnel keeps going in both directions.
 */
export function buildSubwayInterior(stationId: string): SubwayInterior {
  const station = stationDef(stationId);
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const floorB = new MeshBuilder();
  const wallB = new MeshBuilder();
  const trimB = new MeshBuilder();
  const metalB = new MeshBuilder();

  const tile = new THREE.Color("#d4c4a6");
  const tileDark = new THREE.Color("#b39a78");
  const wall = new THREE.Color("#f0ece4");
  const concrete = new THREE.Color("#5a616c");
  const pit = new THREE.Color("#1a1d22");
  const accent = new THREE.Color(station.color);
  const gold = new THREE.Color("#e8c36a");
  const steel = new THREE.Color("#c5ccd3");
  const rust = new THREE.Color("#5a4030");
  const lamp = new THREE.Color("#fff4c4");
  const dark = new THREE.Color("#2a3038");

  const minX = -24;
  const maxX = 24;
  const tunnel = 92;
  const ceil = 6.2;
  const stairMin = -2.6;
  const stairMax = 2.6;
  const hallZ0 = 11.2;
  const hallZ1 = 16.8;

  // Open mezzanine — no front wall, so the platform and tunnel are visible.
  floorB.ground(-7.6, hallZ0, 7.6, hallZ1, HALL_Y, tile);
  addCeiling(floorB, -7.6, hallZ0, 7.6, hallZ1, HALL_Y + 3.4, dark);
  wallB.box(-7.8, hallZ0, -7.35, hallZ1, HALL_Y, HALL_Y + 3.4, wall);
  wallB.box(7.35, hallZ0, 7.8, hallZ1, HALL_Y, HALL_Y + 3.4, wall);
  wallB.box(-7.8, hallZ1 - 0.4, 7.8, hallZ1, HALL_Y, HALL_Y + 3.4, wall);
  blockers.push({ minX: -7.8, maxX: -7.35, minZ: hallZ0, maxZ: hallZ1 });
  blockers.push({ minX: 7.35, maxX: 7.8, minZ: hallZ0, maxZ: hallZ1 });
  blockers.push({ minX: -7.8, maxX: 7.8, minZ: hallZ1 - 0.4, maxZ: hallZ1 });

  // Street exit is a marked doorway in the back wall, not the whole hall.
  trimB.box(-1.6, hallZ1 - 0.42, 1.6, hallZ1 - 0.12, HALL_Y + 2.2, HALL_Y + 3.2, gold);
  metalB.box(-0.15, hallZ1 - 0.55, 0.15, hallZ1 - 0.05, HALL_Y + 1.1, HALL_Y + 2.0, lamp);

  // Stairs: a clear ramp down the center onto the platform.
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const t1 = (i + 1) / steps;
    const z0 = hallZ0 - (i / steps) * (hallZ0 - 8.15);
    const z1 = hallZ0 - t1 * (hallZ0 - 8.15);
    const y = HALL_Y * (1 - t1);
    floorB.ground(stairMin, z1, stairMax, z0, y, tileDark);
    wallB.box(stairMin - 0.28, z1, stairMin, z0, y, y + 0.95, concrete);
    wallB.box(stairMax, z1, stairMax + 0.28, z0, y, y + 0.95, concrete);
  }
  blockers.push({ minX: stairMin - 0.28, maxX: stairMin, minZ: 8.15, maxZ: hallZ0 });
  blockers.push({ minX: stairMax, maxX: stairMax + 0.28, minZ: 8.15, maxZ: hallZ0 });

  // Platform deck — open under the mezzanine so the stair mouth is clear.
  floorB.ground(minX, PLATFORM_EDGE, maxX, 8.2, PLATFORM_Y, tile);
  trimB.box(minX, PLATFORM_EDGE, maxX, PLATFORM_EDGE + 0.28, PLATFORM_Y, PLATFORM_Y + 0.05, gold);
  blockers.push({ minX, maxX, minZ: PLATFORM_EDGE - 0.2, maxZ: PLATFORM_EDGE });

  // Side walls beside the stairs, with a gap in the middle.
  wallB.box(minX - 0.35, 8.15, stairMin - 0.2, 8.55, PLATFORM_Y, ceil, wall);
  wallB.box(stairMax + 0.2, 8.15, maxX + 0.35, 8.55, PLATFORM_Y, ceil, wall);
  blockers.push({ minX: minX - 0.35, maxX: stairMin - 0.2, minZ: 8.15, maxZ: 8.55 });
  blockers.push({ minX: stairMax + 0.2, maxX: maxX + 0.35, minZ: 8.15, maxZ: 8.55 });

  for (let x = -21; x <= 21; x += 6) {
    if (Math.abs(x) < 4) continue;
    trimB.box(x - 0.32, 6.4, x + 0.32, 7.85, PLATFORM_Y, ceil, concrete);
    blockers.push({ minX: x - 0.32, maxX: x + 0.32, minZ: 6.4, maxZ: 7.85 });
    metalB.box(x - 1.35, 5.2, x + 1.35, 6.05, PLATFORM_Y, PLATFORM_Y + 0.5, rust);
    blockers.push({ minX: x - 1.35, maxX: x + 1.35, minZ: 5.2, maxZ: 6.05 });
  }

  trimB.box(minX, 7.7, stairMin - 0.3, 7.92, 2.2, 2.55, accent);
  trimB.box(stairMax + 0.3, 7.7, maxX, 7.92, 2.2, 2.55, accent);
  for (let x = minX + 1; x < maxX; x += 3.8) {
    metalB.box(x, 3.4, x + 2.4, 3.75, 4.15, 4.35, lamp);
  }

  floorB.ground(-tunnel, -5.7, tunnel, PLATFORM_EDGE, PIT_Y, pit);
  addRails(metalB, rust, steel, -tunnel, tunnel, TRACK_Z);
  addTunnel(wallB, trimB, metalB, concrete, dark, lamp, accent, -tunnel, tunnel, ceil);

  const sign = makeSign(station);
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.8), sign);
  signMesh.position.set(0, 3.5, 8.12);
  signMesh.rotation.y = Math.PI;
  group.add(signMesh);
  disposables.push(signMesh.geometry, sign);

  assemble(group, floorB, wallB, trimB, metalB, disposables);
  const train = buildTrain(station, disposables);
  group.add(train);

  return {
    group,
    train,
    blockers,
    spawn: { x: 0, z: 13.4, yaw: 0, pitch: -0.18 },
    platformSpawn: { x: 0, z: 4.8, yaw: 0, pitch: -0.06 },
    bounds: { minX: -23.2, maxX: 23.2, minZ: PLATFORM_EDGE + 0.4, maxZ: 16.55 },
    groundAt: (x, z) => {
      if (z >= hallZ0) return HALL_Y;
      if (z > 8.15) {
        const t = (hallZ0 - z) / (hallZ0 - 8.15);
        return THREE.MathUtils.clamp(HALL_Y * (1 - t), PLATFORM_Y, HALL_Y);
      }
      void x;
      return PLATFORM_Y;
    },
    nearExit: (x, z) => z >= 10.8 && Math.abs(x) < 6.8,
    nearPlatform: (x, z) => z < 6.2 && z > PLATFORM_EDGE + 0.25 && Math.abs(x) < 18,
    sign,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
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

function addRails(
  metalB: MeshBuilder,
  rust: THREE.Color,
  steel: THREE.Color,
  x0: number,
  x1: number,
  z: number,
) {
  const gauge = 0.72;
  for (let x = x0; x < x1; x += 0.78) {
    metalB.box(x, z - 1.05, x + 0.16, z + 1.05, PIT_Y + 0.02, PIT_Y + 0.1, rust);
  }
  metalB.box(x0, z - gauge, x1, z - gauge + 0.08, PIT_Y + 0.1, PIT_Y + 0.18, steel);
  metalB.box(x0, z + gauge - 0.08, x1, z + gauge, PIT_Y + 0.1, PIT_Y + 0.18, steel);
  metalB.box(x0, z + 1.18, x1, z + 1.28, PIT_Y + 0.16, PIT_Y + 0.24, new THREE.Color("#8a3a32"));
}

function addTunnel(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  metalB: MeshBuilder,
  concrete: THREE.Color,
  dark: THREE.Color,
  lamp: THREE.Color,
  accent: THREE.Color,
  x0: number,
  x1: number,
  ceil: number,
) {
  const zBack = -5.7;
  const zFront = PLATFORM_EDGE;
  wallB.box(x0, zBack - 0.45, x1, zBack, PIT_Y, ceil, concrete);
  for (let x = x0 + 2; x < x1; x += 5.5) {
    trimB.box(x, zBack, x + 0.38, zFront, PIT_Y, ceil, dark);
    metalB.box(x + 0.05, zBack + 0.15, x + 0.33, zBack + 0.5, 3.5, 3.68, lamp);
  }
  wallB.box(x0 - 0.6, zBack, x0, zFront, PIT_Y, ceil, dark);
  wallB.box(x1, zBack, x1 + 0.6, zFront, PIT_Y, ceil, dark);
  addCeiling(wallB, x0, zBack, x1, zFront, ceil, dark);
  trimB.box(x0, zBack + 0.1, x1, zBack + 0.22, 2.45, 2.62, accent);
}

function buildTrain(station: SubwayStationDef, disposables: Array<{ dispose: () => void }>) {
  const group = new THREE.Group();
  const body = new MeshBuilder();
  const trim = new MeshBuilder();
  const silver = new THREE.Color("#d5dde4");
  const shadow = new THREE.Color("#2a3036");
  const glass = new THREE.Color("#8fd4f0");
  const accent = new THREE.Color(station.color);
  const lamp = new THREE.Color("#fff4c8");

  const cars = [-13.2, 0, 13.2];
  for (const cx of cars) {
    body.box(cx - 6.1, TRACK_Z - 1.15, cx + 6.1, TRACK_Z + 1.15, PIT_Y + 0.28, PIT_Y + 3.15, silver);
    trim.box(cx - 6.1, TRACK_Z - 1.18, cx + 6.1, TRACK_Z - 1.08, PIT_Y + 1.35, PIT_Y + 1.58, accent);
    for (const wx of [-4.4, -1.5, 1.5, 4.4]) {
      trim.box(cx + wx - 0.85, TRACK_Z + 1.05, cx + wx + 0.85, TRACK_Z + 1.16, PIT_Y + 1.45, PIT_Y + 2.45, glass);
    }
    trim.box(cx - 5.6, TRACK_Z - 1.05, cx - 4.4, TRACK_Z + 1.05, PIT_Y + 0.45, PIT_Y + 2.55, shadow);
    trim.box(cx + 4.4, TRACK_Z - 1.05, cx + 5.6, TRACK_Z + 1.05, PIT_Y + 0.45, PIT_Y + 2.55, shadow);
  }
  trim.box(-20.2, TRACK_Z - 0.35, -19.6, TRACK_Z + 0.35, PIT_Y + 1.7, PIT_Y + 2.05, lamp);
  trim.box(19.6, TRACK_Z - 0.35, 20.2, TRACK_Z + 0.35, PIT_Y + 1.7, PIT_Y + 2.05, lamp);

  const add = (builder: MeshBuilder, material: THREE.MeshStandardMaterial) => {
    if (builder.empty) {
      material.dispose();
      return;
    }
    const geometry = builder.build();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
    disposables.push(geometry, material);
  };
  add(body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.55 }));
  add(
    trim,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.28,
      metalness: 0.4,
      emissive: new THREE.Color("#9fd4f0"),
      emissiveIntensity: 0.35,
    }),
  );
  group.position.set(-28, 0, 0);
  return group;
}

function makeSign(station: SubwayStationDef) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 168;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.fillStyle = "#0d1116";
  ctx.fillRect(0, 0, 1024, 168);
  ctx.fillStyle = station.color;
  ctx.fillRect(0, 0, 16, 168);
  ctx.fillRect(1008, 0, 16, 168);
  ctx.fillStyle = "#e8c36a";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(SUBWAY_LINE.toUpperCase(), 512, 44);
  ctx.fillStyle = "#f4f7fb";
  ctx.font = "bold 58px sans-serif";
  ctx.fillText(station.name.toUpperCase(), 512, 108);
  ctx.fillStyle = "#9aa7b2";
  ctx.font = "22px sans-serif";
  ctx.fillText(station.hint, 512, 148);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 1.1,
    roughness: 0.4,
  });
  const dispose = material.dispose.bind(material);
  material.dispose = () => {
    texture.dispose();
    dispose();
  };
  return material;
}

function assemble(
  group: THREE.Group,
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  metalB: MeshBuilder,
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
  add(floorB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68 }));
  add(wallB, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74 }));
  add(
    trimB,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.18,
      emissive: new THREE.Color("#ffd9a0"),
      emissiveIntensity: 0.22,
    }),
  );
  add(
    metalB,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.28,
      metalness: 0.55,
      emissive: new THREE.Color("#fff1c4"),
      emissiveIntensity: 0.18,
    }),
  );
}
