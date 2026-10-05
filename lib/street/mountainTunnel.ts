import * as THREE from "three";
import type { Blocker } from "./buildCity";
import { TILE } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";

/** Park tile on Mountain City's west ridge, pressed against the rock. */
export const MOUNTAIN_TUNNEL_TILE = { x: 8, y: 28 };

const MOUTH_X = MOUNTAIN_TUNNEL_TILE.x * TILE + 0.4;
const MOUTH_Z = MOUNTAIN_TUNNEL_TILE.y * TILE + TILE / 2;
const HALF = 2.15;

export function nearMountainTunnel(x: number, z: number) {
  return x > MOUTH_X - 1 && x < MOUTH_X + 14 && Math.abs(z - MOUTH_Z) < 5.5;
}

/** Concrete arch set into the ridge. The opening faces town. */
export function buildMountainTunnelMouth(): { group: THREE.Group; blockers: Blocker[] } {
  const group = new THREE.Group();
  const frame = new MeshBuilder();
  const throat = new MeshBuilder();
  const concrete = new THREE.Color("#7d7872");
  const stain = new THREE.Color("#5c5854");
  const black = new THREE.Color("#101318");

  const x0 = MOUTH_X - 1.6;
  const x1 = MOUTH_X + 1.5;
  frame.box(x0, MOUTH_Z - HALF - 0.7, x1, MOUTH_Z - HALF, 0, 4.4, concrete);
  frame.box(x0, MOUTH_Z + HALF, x1, MOUTH_Z + HALF + 0.7, 0, 4.4, concrete);
  frame.box(x0, MOUTH_Z - HALF - 0.7, x1, MOUTH_Z + HALF + 0.7, 3.55, 4.7, stain);
  throat.box(x0 - 2.4, MOUTH_Z - HALF + 0.08, x1 - 0.2, MOUTH_Z + HALF - 0.08, 0.02, 3.45, black);

  const blockers: Blocker[] = [
    { minX: x0, maxX: x1, minZ: MOUTH_Z - HALF - 0.7, maxZ: MOUTH_Z - HALF },
    { minX: x0, maxX: x1, minZ: MOUTH_Z + HALF, maxZ: MOUTH_Z + HALF + 0.7 },
    { minX: x0, maxX: x1, minZ: MOUTH_Z - HALF - 0.7, maxZ: MOUTH_Z + HALF + 0.7, minY: 3.55 },
  ];

  const add = (builder: MeshBuilder, roughness: number) => {
    if (builder.empty) return;
    const geometry = builder.build();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(frame, 0.82);
  add(throat, 1);
  return { group, blockers };
}
