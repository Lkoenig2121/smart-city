import * as THREE from "three";
import type { Building } from "@/lib/city/types";
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
  house: { floor: "#c4a882", wall: "#f3d7b5", trim: "#6d4c41", accent: "#4d5b3f", furniture: "#8b3d2e" },
  apartment: { floor: "#b7c3c9", wall: "#e6ddd2", trim: "#5c5348", accent: "#3d5a80", furniture: "#6e6256" },
};

export function buildVenueInterior(building: Building): VenueInterior {
  const role = venueRole(building) ?? "office";
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
