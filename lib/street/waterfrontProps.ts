import { cityThemeFor } from "@/lib/city/world/cities";
import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { hash2 } from "@/lib/city/rng";
import {
  FERRIS_Y,
  MARINA_DOCK_ROWS,
  RIVER_W,
  ferrisWorldTile,
  promenadeXAt,
  riverXAt,
  WATERFRONT_BOATS,
} from "@/lib/city/waterfront";
import type { MeshBuilder } from "./meshBuilder";

const TILE = 10;
const CURB_H = 0.16;

export interface WaterfrontBlocker {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WaterfrontDecor {
  boats: THREE.Group;
  ferrisWheel: THREE.Group;
  dispose: () => void;
}

/**
 * Piers, boats, the ferris, beach umbrellas, and promenade railings.
 * Boardwalk paving itself is handled in the city ground pass.
 * Dustfall skips Riverside pier clutter and plants the ferris in open sand.
 */
export function addWaterfrontDecor(
  state: CityState,
  group: THREE.Group,
  trimB: MeshBuilder,
  lampHeadB: MeshBuilder,
  lamps: THREE.Vector3[],
  blockers: WaterfrontBlocker[],
): WaterfrontDecor {
  const disposables: Array<{ dispose: () => void }> = [];

  if (cityThemeFor(state.id).waterfront === "nile") {
    const wood = new THREE.Color("#8a6a4a");
    const woodDark = new THREE.Color("#5c4030");
    addDustfallFerrisPad(trimB, wood, woodDark, blockers);
    const boats = new THREE.Group();
    const { root, wheel } = buildFerris(disposables, "dustfall");
    group.add(root);
    return {
      boats,
      ferrisWheel: wheel,
      dispose: () => {
        for (const item of disposables) item.dispose();
      },
    };
  }

  const wood = new THREE.Color("#6e5840");
  const woodDark = new THREE.Color("#4a3b2c");
  const rail = new THREE.Color("#3d454c");
  const bulb = new THREE.Color("#ffd19a");
  const canvas = new THREE.Color("#f4efe4");
  const pole = new THREE.Color("#4a4f55");

  addPromenadeTrim(state, trimB, lampHeadB, lamps, wood, woodDark, rail, bulb, pole);
  addDocks(trimB, wood, woodDark);
  addFerrisPier(trimB, wood, woodDark);
  addBeachUmbrellas(state, trimB, blockers, canvas, pole);
  addEastBoardwalk(state, trimB, wood);
  addShoreFoam(trimB);

  const boats = buildBoats(disposables);
  group.add(boats);

  const { root, wheel } = buildFerris(disposables);
  group.add(root);

  return {
    boats,
    ferrisWheel: wheel,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

/** Low sand platform under the Dustfall ferris — no pier rails. */
function addDustfallFerrisPad(
  trimB: MeshBuilder,
  wood: THREE.Color,
  woodDark: THREE.Color,
  blockers: WaterfrontBlocker[],
) {
  const tile = ferrisWorldTile("dustfall");
  const cx = tile.x * TILE;
  const cz = tile.y * TILE;
  const half = 7.5;
  trimB.ground(cx - half, cz - half, cx + half, cz + half, 0.08, wood);
  trimB.ground(cx - half + 0.6, cz - half + 0.6, cx + half - 0.6, cz + half - 0.6, 0.14, woodDark);
  blockers.push({
    minX: cx - 2.8,
    maxX: cx + 2.8,
    minZ: cz - 5.2,
    maxZ: cz + 5.2,
  });
}

/** True when the boardwalk meets an east–west bridge — leave that opening clear. */
function isBridgeCrossing(state: CityState, x: number, y: number) {
  return Boolean(state.tiles[y]?.[x]?.bridge || state.tiles[y]?.[x + 1]?.bridge);
}

function addPromenadeTrim(
  state: CityState,
  trimB: MeshBuilder,
  lampHeadB: MeshBuilder,
  lamps: THREE.Vector3[],
  wood: THREE.Color,
  woodDark: THREE.Color,
  rail: THREE.Color,
  bulb: THREE.Color,
  pole: THREE.Color,
) {
  for (let y = 1; y < state.size - 1; y++) {
    const boardwalk = promenadeXAt(y);
    const sandX = riverXAt(y) - 1;
    const railX = state.tiles[y]?.[sandX]?.road ? sandX : boardwalk;
    const z0 = y * TILE;
    const z1 = z0 + TILE;
    const bridgeOpening = isBridgeCrossing(state, railX, y);

    if (state.tiles[y]?.[railX]?.road && !bridgeOpening) {
      const x1 = (railX + 1) * TILE;
      const waterEdge = x1 - 0.22;
      for (let i = 0; i < 4; i++) {
        const z = z0 + 1.1 + i * 2.2;
        trimB.box(waterEdge - 0.08, z - 0.08, waterEdge + 0.08, z + 0.08, CURB_H, 1.15, rail);
      }
      trimB.box(waterEdge - 0.05, z0 + 0.4, waterEdge + 0.05, z1 - 0.4, 1.05, 1.18, rail);

      if (y % 2 === 0) {
        const px = waterEdge - 0.55;
        const pz = z0 + TILE * 0.5;
        trimB.box(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1, CURB_H, 5.4, pole);
        lampHeadB.box(px - 0.28, pz - 0.22, px + 0.28, pz + 0.22, 5.05, 5.45, bulb);
        lamps.push(new THREE.Vector3(px, 5.2, pz));
      }

      if (y % 2 === 1) {
        const lx = waterEdge - 0.15;
        const lz = z0 + 2.4;
        lampHeadB.box(lx - 0.1, lz - 0.1, lx + 0.1, lz + 0.1, 3.35, 3.55, bulb);
      }
    }

    if (state.tiles[y]?.[boardwalk]?.road && y % 3 === 1) {
      const bx = boardwalk * TILE + 1.15;
      const bz = z0 + 3.4;
      trimB.box(bx, bz, bx + 1.7, bz + 0.5, CURB_H, 0.58, wood);
      trimB.box(bx, bz + 0.08, bx + 0.12, bz + 0.42, CURB_H, 0.95, woodDark);
      trimB.box(bx + 1.58, bz + 0.08, bx + 1.7, bz + 0.42, CURB_H, 0.95, woodDark);
    }
  }
}

function addDocks(trimB: MeshBuilder, wood: THREE.Color, woodDark: THREE.Color) {
  for (const y of MARINA_DOCK_ROWS) {
    const start = (promenadeXAt(y) + 1) * TILE - 1.2;
    const end = (riverXAt(y) + 2.15) * TILE;
    const z = y * TILE + 3.2;
    trimB.ground(start, z, end, z + 3.4, 0.42, wood);
    trimB.walls(start, z, end, z + 3.4, -0.35, 0.42, woodDark);
    for (let i = 0; i < 5; i++) {
      const px = start + 4 + i * 5.5;
      if (px > end - 1) break;
      trimB.box(px - 0.12, z - 0.15, px + 0.12, z + 3.55, -1.6, 0.42, woodDark);
    }
    // Finger piers for two slips.
    trimB.ground(end - 8.5, z - 2.8, end - 0.4, z, 0.42, wood);
    trimB.ground(end - 8.5, z + 3.4, end - 0.4, z + 6.2, 0.42, wood);
  }
}

function addFerrisPier(trimB: MeshBuilder, wood: THREE.Color, woodDark: THREE.Color) {
  const y = FERRIS_Y;
  const start = (promenadeXAt(y) + 1) * TILE - 1;
  const end = (riverXAt(y) + 2.4) * TILE;
  const z = y * TILE + 3.4;
  trimB.ground(start, z, end, z + 4.2, 0.5, wood);
  trimB.walls(start, z, end, z + 4.2, -0.35, 0.5, woodDark);
  for (let i = 0; i < 6; i++) {
    const px = start + 3 + i * 6;
    if (px > end - 1) break;
    trimB.box(px - 0.16, z - 0.12, px + 0.16, z + 4.32, -1.8, 0.5, woodDark);
  }
}

function addBeachUmbrellas(
  state: CityState,
  trimB: MeshBuilder,
  blockers: WaterfrontBlocker[],
  canvas: THREE.Color,
  pole: THREE.Color,
) {
  const colors = [
    new THREE.Color("#c0392b"),
    new THREE.Color("#f4f1ea"),
    new THREE.Color("#2471a3"),
    new THREE.Color("#e8c36a"),
  ];
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < riverXAt(y); x++) {
      const tile = state.tiles[y]?.[x];
      if (!tile || tile.road || tile.buildingId || tile.terrain !== "sand") continue;
      const n = hash2(x, y, 41);
      if (n < 0.38) continue;
      const cx = x * TILE + 2.5 + n * 5;
      const cz = y * TILE + 2.2 + hash2(x, y, 7) * 5.5;
      const cloth = colors[Math.floor(n * colors.length) % colors.length];
      trimB.box(cx - 0.07, cz - 0.07, cx + 0.07, cz + 0.07, 0, 2.6, pole);
      trimB.box(cx - 1.35, cz - 1.35, cx + 1.35, cz + 1.35, 2.45, 2.62, cloth);
      trimB.box(cx - 0.45, cz - 0.45, cx + 0.45, cz + 0.45, 2.62, 2.78, canvas);
      blockers.push({ minX: cx - 0.25, maxX: cx + 0.25, minZ: cz - 0.25, maxZ: cz + 0.25 });
    }
  }
}

function addShoreFoam(trimB: MeshBuilder) {
  const foam = new THREE.Color("#e8f4fa");
  const wash = new THREE.Color("#9fd0e0");
  for (let y = 0; y < 40; y++) {
    const x = riverXAt(y);
    const x0 = x * TILE;
    const z0 = y * TILE;
    trimB.ground(x0 - 1.2, z0 + 0.4, x0 + 3.2, z0 + TILE - 0.4, 0.02, wash);
    trimB.ground(x0 - 0.4, z0 + 1.2, x0 + 1.6, z0 + TILE - 1.2, 0.08, foam);
  }
}

function addEastBoardwalk(state: CityState, trimB: MeshBuilder, wood: THREE.Color) {
  for (let y = 1; y < state.size - 1; y++) {
    const x = riverXAt(y) + RIVER_W;
    const tile = state.tiles[y]?.[x];
    if (!tile || tile.terrain !== "sand" || tile.road || tile.bridge) continue;
    const x0 = x * TILE;
    const z0 = y * TILE;
    trimB.ground(x0, z0 + 0.4, x0 + 2.2, z0 + TILE - 0.4, 0.12, wood);
  }
}

function buildBoats(disposables: Array<{ dispose: () => void }>) {
  const group = new THREE.Group();
  const hullGeo = new THREE.BoxGeometry(1, 1, 1);
  const cabinGeo = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(hullGeo, cabinGeo);

  WATERFRONT_BOATS.forEach((def, i) => {
    const boat = new THREE.Group();
    const s = def.scale;
    const hullMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.48, metalness: 0.08 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: def.cabin, roughness: 0.55 });
    disposables.push(hullMat, cabinMat);

    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.scale.set(3.6 * s, 0.55 * s, 1.35 * s);
    hull.position.y = 0.12;
    hull.castShadow = true;
    boat.add(hull);

    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.scale.set(1.35 * s, 0.85 * s, 1.15 * s);
    cabin.position.set(-0.35 * s, 0.75 * s, 0);
    cabin.castShadow = true;
    boat.add(cabin);

    boat.position.set(def.x * TILE, 0, def.y * TILE);
    boat.rotation.y = def.heading;
    boat.userData.bob = i * 0.85;
    group.add(boat);
  });

  return group;
}

function buildFerris(disposables: Array<{ dispose: () => void }>, cityId?: string) {
  const root = new THREE.Group();
  const tile = ferrisWorldTile(cityId);
  // Dustfall sits on a sand pad (y≈0); Riverside ferris stands on the pier deck.
  root.position.set(tile.x * TILE, cityId === "dustfall" ? 0.14 : 0.5, tile.y * TILE);

  const steelMat = new THREE.MeshStandardMaterial({ color: "#c45c4a", roughness: 0.35, metalness: 0.45 });
  const darkMat = new THREE.MeshStandardMaterial({ color: "#3a3230", roughness: 0.5, metalness: 0.3 });
  const gondolaMat = new THREE.MeshStandardMaterial({ color: "#f4efe4", roughness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: "#e8c36a",
    emissive: "#e8a35a",
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  disposables.push(steelMat, darkMat, gondolaMat, accentMat);

  const legGeo = new THREE.BoxGeometry(0.45, 14.5, 0.45);
  const beamGeo = new THREE.BoxGeometry(0.35, 0.35, 8.4);
  disposables.push(legGeo, beamGeo);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, steelMat);
    leg.position.set(-2.4, 7.1, side * 4.2);
    leg.rotation.z = 0.28 * side * 0 + 0.22;
    leg.rotation.x = -0.32 * side;
    root.add(leg);
    const legB = new THREE.Mesh(legGeo, steelMat);
    legB.position.set(2.4, 7.1, side * 4.2);
    legB.rotation.z = -0.22;
    legB.rotation.x = -0.32 * side;
    root.add(legB);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.4, 12), darkMat);
  hub.rotation.z = Math.PI / 2;
  hub.position.y = 11.2;
  root.add(hub);
  disposables.push(hub.geometry);

  const wheel = new THREE.Group();
  wheel.position.y = 11.2;
  const radius = 8.4;
  const ringGeo = new THREE.TorusGeometry(radius, 0.18, 8, 32);
  const ring = new THREE.Mesh(ringGeo, steelMat);
  ring.rotation.y = Math.PI / 2;
  wheel.add(ring);
  disposables.push(ringGeo);

  const spokeGeo = new THREE.BoxGeometry(0.12, radius * 2, 0.12);
  disposables.push(spokeGeo);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(spokeGeo, steelMat);
    spoke.rotation.x = (i * Math.PI) / 8;
    wheel.add(spoke);
  }

  const gondolaGeo = new THREE.BoxGeometry(1.15, 0.95, 0.85);
  disposables.push(gondolaGeo);
  const gondolas: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const gondola = new THREE.Mesh(gondolaGeo, i % 2 === 0 ? gondolaMat : accentMat);
    gondola.position.set(0, Math.sin(a) * radius, Math.cos(a) * radius);
    gondola.castShadow = true;
    wheel.add(gondola);
    gondolas.push(gondola);
  }
  wheel.userData.gondolas = gondolas;
  root.add(wheel);

  return { root, wheel };
}