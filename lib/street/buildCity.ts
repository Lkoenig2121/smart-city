import * as THREE from "three";
import type { Building, BuildingKind, CityState, Terrain, Tile } from "@/lib/city/types";
import { hasExteriorBalconies, isRiversideHotel } from "@/lib/city/balconies";
import { lodgingUse } from "@/lib/city/lodging";
import { venueRole } from "@/lib/city/venues";
import { BUS_STOPS, isTramTile } from "@/lib/city/transit";
import { MeshBuilder } from "./meshBuilder";
import { BAY_W, FLOOR_H, asphaltTexture, facade, rippleNormal, type FacadeStyle } from "./textures";
import { addWaterfrontDecor } from "./waterfrontProps";
import { isPromenadeTile } from "@/lib/city/waterfront";

/** World units per city tile. One tile is roughly a ten metre plot. */
export const TILE = 10;

/** Height of a bridge deck above the water, in world units. */
export const DECK_H = 3.2;
const DECK_THICK = 0.4;

const SIDEWALK_W = 1.7;
export const CURB_H = 0.16;
const WALL_INSET = 0.55;

const TERRAIN_COLOR: Record<Terrain, string> = {
  grass: "#4f8f45",
  park: "#3e8244",
  plaza: "#bdb5a6",
  water: "#2f6f96",
  sand: "#cdb782",
  playground: "#5f9b52",
  lot: "#87847e",
};

const ROAD_COLOR = "#3b3d43";
const BOARDWALK_COLOR = "#6a5640";
const SIDEWALK_COLOR = "#a8a49b";
const MARKING_COLOR = "#cfc7ab";

const STYLE_OF: Record<BuildingKind, FacadeStyle> = {
  house: "residential",
  apartment: "brick",
  shop: "brick",
  office: "office",
  skyscraper: "glass",
  tower: "glass",
  hospital: "office",
  school: "brick",
  police: "civic",
  fire: "brick",
  city_hall: "civic",
  park_pavilion: "residential",
  baseball_stadium: "civic",
  subway_station: "glass",
};

/** Axis-aligned box a walker cannot pass through. */
export interface Blocker {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Omit to block every height. Used so under-stand shops don't seal the deck above. */
  minY?: number;
  maxY?: number;
}

export interface CityMeshes {
  group: THREE.Group;
  water: THREE.Mesh | null;
  blockers: Blocker[];
  /** Axis-aligned bounds for each building, used to highlight a selection. */
  volumes: BuildingVolume[];
  /** Lamp head positions, used to place a rolling pool of point lights. */
  lamps: THREE.Vector3[];
  /** Materials whose emissive strength tracks the time of day. */
  emissiveMaterials: THREE.MeshStandardMaterial[];
  /** Street-lamp globes; brighter at night than window glass. */
  lampGlow: THREE.MeshStandardMaterial | null;
  /** Traffic-signal lenses; colours follow `state.trafficLights` each frame. */
  signals: StreetSignal[];
  /** Moored boats; bobbed each frame. */
  boats: THREE.Group | null;
  /** Ferris wheel; spun each frame. */
  ferrisWheel: THREE.Group | null;
  dispose: () => void;
}

/** One intersection's unlit lens materials, shared by both facing heads. */
export interface StreetSignal {
  x: number;
  y: number;
  nsGreen: THREE.MeshBasicMaterial;
  nsRed: THREE.MeshBasicMaterial;
  ewGreen: THREE.MeshBasicMaterial;
  ewRed: THREE.MeshBasicMaterial;
}

export interface BuildingVolume {
  id: string;
  box: THREE.Box3;
}

function terrainColorOf(tile: Tile) {
  return TERRAIN_COLOR[tile.terrain];
}

function isRoad(tiles: Tile[][], x: number, y: number) {
  return Boolean(tiles[y]?.[x]?.road);
}

/**
 * Builds the entire static city as a small number of merged meshes. Everything
 * derives from the same tile and building data the isometric view renders, so
 * the two views always agree.
 */
export function buildCity(state: CityState): CityMeshes {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const lamps: THREE.Vector3[] = [];
  const emissiveMaterials: THREE.MeshStandardMaterial[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const groundB = new MeshBuilder();
  const roadB = new MeshBuilder();
  const concreteB = new MeshBuilder();
  const roofB = new MeshBuilder();
  const trimB = new MeshBuilder();
  const balconyB = new MeshBuilder();
  const lampHeadB = new MeshBuilder();
  const wallB: Partial<Record<FacadeStyle, MeshBuilder>> = {};

  const wallsFor = (style: FacadeStyle) => {
    let builder = wallB[style];
    if (!builder) {
      builder = new MeshBuilder();
      wallB[style] = builder;
    }
    return builder;
  };

  const scratch = new THREE.Color();
  const size = state.size;

  // ─── Ground, roads, pavements ──────────────────────────────────────────────
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = state.tiles[y][x];
      const x0 = x * TILE;
      const z0 = y * TILE;
      const x1 = x0 + TILE;
      const z1 = z0 + TILE;

      if (tile.terrain === "water") {
        // The river gets its own animated surface; carve nothing here.
        continue;
      }

      if (tile.road) {
        const boardwalk = isPromenadeTile(x, y);
        // Pavements hug the edges that face something other than road.
        const north = isRoad(state.tiles, x, y - 1);
        const south = isRoad(state.tiles, x, y + 1);
        const east = isRoad(state.tiles, x + 1, y);
        const west = isRoad(state.tiles, x - 1, y);

        const ax0 = west ? x0 : x0 + SIDEWALK_W;
        const ax1 = east ? x1 : x1 - SIDEWALK_W;
        const az0 = north ? z0 : z0 + SIDEWALK_W;
        const az1 = south ? z1 : z1 - SIDEWALK_W;

        scratch.set(boardwalk ? BOARDWALK_COLOR : ROAD_COLOR);
        roadB.ground(ax0, az0, ax1, az1, 0, scratch, TILE / 4, TILE / 4);

        scratch.set(boardwalk ? "#c4b49a" : SIDEWALK_COLOR);
        if (!west) addSidewalk(concreteB, x0, z0, x0 + SIDEWALK_W, z1, scratch);
        if (!east) addSidewalk(concreteB, x1 - SIDEWALK_W, z0, x1, z1, scratch);
        if (!north) addSidewalk(concreteB, ax0, z0, ax1, z0 + SIDEWALK_W, scratch);
        if (!south) addSidewalk(concreteB, ax0, z1 - SIDEWALK_W, ax1, z1, scratch);

        // Lane markings down the middle of straight runs.
        scratch.set(MARKING_COLOR);
        const straightNS = north && south && !east && !west;
        const straightEW = east && west && !north && !south;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        if (isTramTile(x, y)) {
          scratch.set("#9aa3ab");
          trimB.box(cx - 1.15, az0, cx - 0.95, az1, 0.02, 0.05, scratch);
          trimB.box(cx + 0.95, az0, cx + 1.15, az1, 0.02, 0.05, scratch);
        }

        if (!boardwalk && straightNS) {
          for (let i = 0; i < 2; i++) {
            const zs = z0 + i * (TILE / 2) + TILE * 0.12;
            roadB.ground(cx - 0.14, zs, cx + 0.14, zs + TILE * 0.26, 0.012, scratch);
          }
        } else if (!boardwalk && straightEW) {
          for (let i = 0; i < 2; i++) {
            const xs = x0 + i * (TILE / 2) + TILE * 0.12;
            roadB.ground(xs, cz - 0.14, xs + TILE * 0.26, cz + 0.14, 0.012, scratch);
          }
        }

        // A lamp post on every other block, including crossings.
        if ((x + y) % 2 === 0) {
          const px = west ? x1 - SIDEWALK_W * 0.5 : x0 + SIDEWALK_W * 0.5;
          const pz = z0 + SIDEWALK_W * 0.5;
          addLamp(trimB, lampHeadB, px, pz, lamps);
        }
        continue;
      }

      scratch.set(terrainColorOf(tile));
      groundB.ground(x0, z0, x1, z1, 0, scratch, 1, 1);
    }
  }

  // ─── Buildings ─────────────────────────────────────────────────────────────
  const volumes: BuildingVolume[] = [];
  for (const building of state.buildings.values()) {
    addBuilding(building, wallsFor, roofB, trimB, balconyB, blockers);
    volumes.push(volumeFor(building));
  }

  for (const stop of BUS_STOPS) {
    addBusShelter(stop.x, stop.y, state.tiles, trimB, roofB);
  }

  const signals = addTrafficSignals(state, trimB, group, blockers, disposables);

  const waterfront = addWaterfrontDecor(state, group, trimB, lampHeadB, lamps, blockers);

  // ─── Bridges ───────────────────────────────────────────────────────────────
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = state.tiles[y][x];
      if (!tile.bridge) continue;
      addBridge(tile, state.tiles, concreteB, roadB, trimB, lampHeadB, lamps, scratch);
    }
  }

  // ─── Assemble meshes ───────────────────────────────────────────────────────
  const addMesh = (
    builder: MeshBuilder,
    material: THREE.Material,
    shadows: { cast: boolean; receive: boolean },
  ) => {
    if (builder.empty) return;
    const geometry = builder.build();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadows.cast;
    mesh.receiveShadow = shadows.receive;
    group.add(mesh);
    disposables.push(geometry);
    disposables.push(material);
  };

  addMesh(
    groundB,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    { cast: false, receive: true },
  );

  const asphalt = asphaltTexture();
  addMesh(
    roadB,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: asphalt,
      roughness: 0.82,
      metalness: 0.02,
    }),
    { cast: false, receive: true },
  );

  addMesh(
    concreteB,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    { cast: true, receive: true },
  );

  addMesh(
    roofB,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.05 }),
    { cast: true, receive: true },
  );

  addMesh(
    trimB,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 }),
    { cast: true, receive: true },
  );

  if (!balconyB.empty) {
    const balconyMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      metalness: 0.22,
    });
    const balconyGeo = balconyB.build();
    const balconyMesh = new THREE.Mesh(balconyGeo, balconyMat);
    balconyMesh.castShadow = true;
    balconyMesh.receiveShadow = true;
    balconyMesh.userData.facadeBalconies = true;
    group.add(balconyMesh);
    disposables.push(balconyGeo, balconyMat);
  }

  let lampGlow: THREE.MeshStandardMaterial | null = null;
  if (!lampHeadB.empty) {
    lampGlow = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: new THREE.Color("#ffc37a"),
      emissiveIntensity: 0,
      roughness: 0.28,
      metalness: 0.05,
    });
    addMesh(lampHeadB, lampGlow, { cast: false, receive: false });
  }

  for (const [style, builder] of Object.entries(wallB) as Array<[FacadeStyle, MeshBuilder]>) {
    if (!builder || builder.empty) continue;
    const art = facade(style);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: art.map,
      emissiveMap: art.emissive,
      emissive: new THREE.Color("#ffd9a0"),
      emissiveIntensity: 0,
      roughness: style === "glass" ? 0.22 : 0.72,
      metalness: style === "glass" ? 0.35 : 0.05,
    });
    emissiveMaterials.push(material);
    addMesh(builder, material, { cast: true, receive: true });
  }

  // ─── River surface ─────────────────────────────────────────────────────────
  const water = buildWater(state);
  if (water) {
    group.add(water);
    disposables.push(water.geometry);
    disposables.push(water.material as THREE.Material);
  }

  // ─── Trees ─────────────────────────────────────────────────────────────────
  const trees = buildTrees(state);
  for (const mesh of trees) {
    group.add(mesh);
    disposables.push(mesh.geometry);
    disposables.push(mesh.material as THREE.Material);
  }

  return {
    group,
    water,
    blockers,
    volumes,
    lamps,
    emissiveMaterials,
    lampGlow,
    signals,
    boats: waterfront.boats,
    ferrisWheel: waterfront.ferrisWheel,
    dispose: () => {
      waterfront.dispose();
      for (const item of disposables) item.dispose();
    },
  };
}

/** A raised pavement slab with a curb face along its street edge. */
function addBusShelter(
  tx: number,
  ty: number,
  tiles: Tile[][],
  trimB: MeshBuilder,
  roofB: MeshBuilder,
) {
  const tile = tiles[ty]?.[tx];
  if (!tile?.road) return;
  const x0 = tx * TILE;
  const z0 = ty * TILE;
  const steel = new THREE.Color("#6a727a");
  const glass = new THREE.Color("#9bb8c6");
  const roof = new THREE.Color("#2a3138");
  const sx = x0 + TILE - SIDEWALK_W + 0.25;
  const sz = z0 + 2.2;
  trimB.box(sx, sz, sx + 0.12, sz + 3.4, 0, 2.6, steel);
  trimB.box(sx + 1.5, sz, sx + 1.62, sz + 3.4, 0, 2.6, steel);
  trimB.box(sx + 0.12, sz + 3.28, sx + 1.5, sz + 3.4, 0.4, 2.4, glass);
  roofB.ground(sx - 0.1, sz - 0.1, sx + 1.7, sz + 3.55, 2.65, roof);
}

function addSidewalk(
  builder: MeshBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  color: THREE.Color,
) {
  builder.ground(x0, z0, x1, z1, CURB_H, color);
  builder.walls(x0, z0, x1, z1, 0, CURB_H, color);
}

function addLamp(
  postB: MeshBuilder,
  headB: MeshBuilder,
  x: number,
  z: number,
  lamps: THREE.Vector3[],
  opts?: { armX?: number; armZ?: number; y?: number },
) {
  const grey = new THREE.Color("#4a4f55");
  const head = new THREE.Color("#fff4d0");
  const h = 6.2;
  const base = opts?.y ?? CURB_H;
  const top = base + h;
  const armX = opts?.armX ?? 1.5;
  const armZ = opts?.armZ ?? 0;
  const hx = x + armX;
  const hz = z + armZ;

  postB.box(x - 0.12, z - 0.12, x + 0.12, z + 0.12, base, top, grey);
  postB.box(
    Math.min(x, hx) - 0.1,
    Math.min(z, hz) - 0.1,
    Math.max(x, hx) + 0.1,
    Math.max(z, hz) + 0.1,
    top - 0.35,
    top - 0.12,
    grey,
  );
  headB.box(hx - 0.38, hz - 0.28, hx + 0.38, hz + 0.28, top - 0.7, top - 0.28, head);

  lamps.push(new THREE.Vector3(hx, top - 0.55, hz));
}

const SIGNAL_GREEN = "#3dcc6a";
const SIGNAL_RED = "#e74c3c";
const SIGNAL_OFF = "#1a1c20";

function lensMaterial(hex: string) {
  return new THREE.MeshBasicMaterial({ color: hex });
}

/**
 * Mast-arm signals on opposite sidewalk corners. Lenses are unlit meshes so
 * red and green stay readable in daylight; `updateTrafficSignals` paints them
 * from the live phase each frame.
 */
function addTrafficSignals(
  state: CityState,
  trimB: MeshBuilder,
  group: THREE.Group,
  blockers: Blocker[],
  disposables: Array<{ dispose: () => void }>,
): StreetSignal[] {
  const signals: StreetSignal[] = [];
  if (!state.trafficLights.length) return signals;

  const pole = new THREE.Color("#3a4048");
  const housing = new THREE.Color("#1c1e22");
  const visor = new THREE.Color("#141618");
  const lensGeo = new THREE.SphereGeometry(0.1, 10, 8);
  disposables.push(lensGeo);

  const addLens = (material: THREE.MeshBasicMaterial, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(lensGeo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  };

  for (const light of state.trafficLights) {
    const x0 = light.x * TILE;
    const z0 = light.y * TILE;
    const x1 = x0 + TILE;
    const z1 = z0 + TILE;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const inset = SIDEWALK_W * 0.42;

    const nsGreen = lensMaterial(SIGNAL_OFF);
    const nsRed = lensMaterial(SIGNAL_OFF);
    const ewGreen = lensMaterial(SIGNAL_OFF);
    const ewRed = lensMaterial(SIGNAL_OFF);
    disposables.push(nsGreen, nsRed, ewGreen, ewRed);

    addSignalPole(trimB, x0 + inset, z0 + inset, cx, z0 + inset, x0 + inset, cz, pole, blockers);
    addSignalPole(trimB, x1 - inset, z1 - inset, cx, z1 - inset, x1 - inset, cz, pole, blockers);

    addSignalHead(trimB, addLens, nsGreen, nsRed, cx, z0 + 1.05, "ns", 1, housing, visor);
    addSignalHead(trimB, addLens, nsGreen, nsRed, cx, z1 - 1.05, "ns", -1, housing, visor);
    addSignalHead(trimB, addLens, ewGreen, ewRed, x0 + 1.05, cz, "ew", 1, housing, visor);
    addSignalHead(trimB, addLens, ewGreen, ewRed, x1 - 1.05, cz, "ew", -1, housing, visor);

    signals.push({ x: light.x, y: light.y, nsGreen, nsRed, ewGreen, ewRed });
  }

  updateTrafficSignals(signals, state);
  return signals;
}

function addSignalPole(
  trimB: MeshBuilder,
  px: number,
  pz: number,
  armX: number,
  armZAlongX: number,
  armXAlongZ: number,
  armZ: number,
  color: THREE.Color,
  blockers: Blocker[],
) {
  const top = 4.55;
  trimB.box(px - 0.09, pz - 0.09, px + 0.09, pz + 0.09, CURB_H, top, color);
  trimB.box(
    Math.min(px, armX) - 0.07,
    armZAlongX - 0.07,
    Math.max(px, armX) + 0.07,
    armZAlongX + 0.07,
    top - 0.22,
    top,
    color,
  );
  trimB.box(
    armXAlongZ - 0.07,
    Math.min(pz, armZ) - 0.07,
    armXAlongZ + 0.07,
    Math.max(pz, armZ) + 0.07,
    top - 0.22,
    top,
    color,
  );
  blockers.push({ minX: px - 0.28, maxX: px + 0.28, minZ: pz - 0.28, maxZ: pz + 0.28 });
}

function addSignalHead(
  trimB: MeshBuilder,
  addLens: (material: THREE.MeshBasicMaterial, x: number, y: number, z: number) => void,
  green: THREE.MeshBasicMaterial,
  red: THREE.MeshBasicMaterial,
  hx: number,
  hz: number,
  axis: "ns" | "ew",
  face: 1 | -1,
  housing: THREE.Color,
  visor: THREE.Color,
) {
  const y0 = 3.52;
  const y1 = 4.38;
  const thick = 0.2;
  const wide = 0.34;
  if (axis === "ns") {
    trimB.box(hx - wide / 2, hz - thick / 2, hx + wide / 2, hz + thick / 2, y0, y1, housing);
  } else {
    trimB.box(hx - thick / 2, hz - wide / 2, hx + thick / 2, hz + wide / 2, y0, y1, housing);
  }

  const bump = 0.14 * face;
  const lx = axis === "ew" ? hx + bump : hx;
  const lz = axis === "ns" ? hz + bump : hz;
  addLens(red, lx, 4.16, lz);
  addLens(green, lx, 3.74, lz);

  const hood = 0.16;
  if (axis === "ns") {
    const zFace = face > 0 ? hz + thick / 2 : hz - thick / 2 - hood;
    trimB.box(hx - 0.14, zFace, hx + 0.14, zFace + hood, 4.22, 4.36, visor);
    trimB.box(hx - 0.14, zFace, hx + 0.14, zFace + hood, 3.8, 3.94, visor);
  } else {
    const xFace = face > 0 ? hx + thick / 2 : hx - thick / 2 - hood;
    trimB.box(xFace, hz - 0.14, xFace + hood, hz + 0.14, 4.22, 4.36, visor);
    trimB.box(xFace, hz - 0.14, xFace + hood, hz + 0.14, 3.8, 3.94, visor);
  }
}

/** Paints Street View lenses to match the isometric red/green phase. */
export function updateTrafficSignals(signals: StreetSignal[], state: CityState) {
  for (const signal of signals) {
    const light = state.trafficLights.find((item) => item.x === signal.x && item.y === signal.y);
    const nsGo = light?.phase === 0;
    const ewGo = light?.phase === 1;
    signal.nsGreen.color.set(nsGo ? SIGNAL_GREEN : SIGNAL_OFF);
    signal.nsRed.color.set(light && !nsGo ? SIGNAL_RED : SIGNAL_OFF);
    signal.ewGreen.color.set(ewGo ? SIGNAL_GREEN : SIGNAL_OFF);
    signal.ewRed.color.set(light && !ewGo ? SIGNAL_RED : SIGNAL_OFF);
  }
}

function addFacadeBalconies(
  building: Building,
  trimB: MeshBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  y1: number,
  accent: THREE.Color,
) {
  void accent;
  if (!hasExteriorBalconies(building)) return;

  const hotel = lodgingUse(building) === "hotel" || isRiversideHotel(building);
  const dense = hotel;
  const slab = new THREE.Color("#b8b4ad");
  const rail = new THREE.Color("#2c3036");
  const plant = new THREE.Color("#3d6b45");
  const depth = hotel ? 1.22 : 1.05;
  const first = Math.max(1, Math.ceil(y0 / FLOOR_H + 0.02));
  const last = Math.floor((y1 - 0.55) / FLOOR_H);
  const spanX = x1 - x0;
  const spanZ = z1 - z0;
  const baysX = Math.max(1, Math.round(spanX / BAY_W));
  const baysZ = Math.max(1, Math.round(spanZ / BAY_W));
  const step = dense ? 1 : 2;
  const west = hotel || building.origin.x <= 20;
  const east = building.width >= 2;
  const south = true;

  for (let f = first; f < last; f += step) {
    const y = f * FLOOR_H;
    if (south && f >= 2) {
      const bay = spanX / baysX;
      for (let i = 0; i < baysX; i++) {
        if (!dense && i % 2 === 1) continue;
        const bx0 = x0 + i * bay + 0.38;
        const bx1 = x0 + (i + 1) * bay - 0.38;
        if (bx1 - bx0 < 1.15) continue;
        addBalconyDeck(trimB, bx0, z1, bx1, z1 + depth, y, slab, rail, plant, i % 3 === 0, "n");
      }
    }
    if (west) {
      const bay = spanZ / baysZ;
      for (let i = 0; i < baysZ; i++) {
        if (!dense && i % 2 === 0) continue;
        const bz0 = z0 + i * bay + 0.38;
        const bz1 = z0 + (i + 1) * bay - 0.38;
        if (bz1 - bz0 < 1.15) continue;
        addBalconyDeck(trimB, x0 - depth, bz0, x0, bz1, y, slab, rail, plant, i % 3 === 1, "e");
      }
    }
    if (east && hotel) {
      const bay = spanZ / baysZ;
      for (let i = 0; i < baysZ; i++) {
        if (i % 2 === 1) continue;
        const bz0 = z0 + i * bay + 0.38;
        const bz1 = z0 + (i + 1) * bay - 0.38;
        if (bz1 - bz0 < 1.15) continue;
        addBalconyDeck(trimB, x1, bz0, x1 + depth, bz1, y, slab, rail, plant, false, "w");
      }
    }
  }
}

function addBalconyDeck(
  trimB: MeshBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  slab: THREE.Color,
  rail: THREE.Color,
  plant: THREE.Color,
  greenery: boolean,
  open: "n" | "s" | "e" | "w",
) {
  const top = y + 0.09;
  const railY = y + 1.08;
  trimB.box(x0, z0, x1, z1, y, top, slab);
  const t = 0.055;
  if (open !== "w") trimB.box(x0, z0, x0 + t, z1, top, railY, rail);
  if (open !== "e") trimB.box(x1 - t, z0, x1, z1, top, railY, rail);
  if (open !== "n") trimB.box(x0, z0, x1, z0 + t, top, railY, rail);
  if (open !== "s") trimB.box(x0, z1 - t, x1, z1, top, railY, rail);
  if (greenery) {
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    trimB.box(mx - 0.22, mz - 0.18, mx + 0.22, mz + 0.18, top, top + 0.28, plant);
  }
}

function volumeFor(building: Building): BuildingVolume {
  const x0 = building.origin.x * TILE + WALL_INSET;
  const z0 = building.origin.y * TILE + WALL_INSET;
  const x1 = (building.origin.x + building.width) * TILE - WALL_INSET;
  const z1 = (building.origin.y + building.depth) * TILE - WALL_INSET;
  return {
    id: building.id,
    box: new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, volumeHeight(building), z1)),
  };
}

function volumeHeight(building: Building) {
  const floors = Math.max(1, building.floors);
  switch (building.kind) {
    case "house":
      return floors * FLOOR_H + 2.6;
    case "shop":
      if (venueRole(building) === "mall") return 20;
      return Math.max(2, floors) * FLOOR_H + 0.55;
    case "park_pavilion":
      return 4.7;
    case "baseball_stadium":
      return 13;
    case "subway_station":
      return 4.6;
    case "skyscraper":
    case "tower":
      return floors * FLOOR_H + 14;
    case "city_hall":
      return floors * FLOOR_H + 5.4;
    default:
      return floors * FLOOR_H + 0.8;
  }
}

function addBuilding(
  building: Building,
  wallsFor: (style: FacadeStyle) => MeshBuilder,
  roofB: MeshBuilder,
  trimB: MeshBuilder,
  balconyB: MeshBuilder,
  blockers: Blocker[],
) {
  const x0 = building.origin.x * TILE + WALL_INSET;
  const z0 = building.origin.y * TILE + WALL_INSET;
  const x1 = (building.origin.x + building.width) * TILE - WALL_INSET;
  const z1 = (building.origin.y + building.depth) * TILE - WALL_INSET;

  // An open pavilion can be walked through; the stadium is a ring with a gate.
  if (building.kind !== "park_pavilion" && building.kind !== "baseball_stadium") {
    blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
  }

  const style = STYLE_OF[building.kind];
  const walls = wallsFor(style);
  const wall = new THREE.Color(building.wallColor);
  const roof = new THREE.Color(building.roofColor);
  const accent = new THREE.Color(building.accentColor);
  const floors = Math.max(1, building.floors);

  switch (building.kind) {
    case "house": {
      const h = floors * FLOOR_H;
      walls.walls(x0, z0, x1, z1, 0, h, wall, BAY_W, FLOOR_H);
      const ridge = x1 - x0 >= z1 - z0 ? "x" : "z";
      roofB.gable(x0 - 0.35, z0 - 0.35, x1 + 0.35, z1 + 0.35, h, 2.6, roof, ridge);
      // Front door and a low garden wall.
      trimB.box(x0 + 1.2, z1 - 0.12, x0 + 2.4, z1 + 0.18, 0, 2.1, accent);
      break;
    }

    case "skyscraper":
    case "tower": {
      // Stacked setbacks, each stage narrower than the one below.
      const stages = building.kind === "tower" ? 4 : 3;
      let bx0 = x0;
      let bz0 = z0;
      let bx1 = x1;
      let bz1 = z1;
      let base = 0;

      for (let i = 0; i < stages; i++) {
        const share = i === stages - 1 ? 1 : 0.42 - i * 0.06;
        const remaining = floors * FLOOR_H - base;
        const h = base + Math.max(FLOOR_H * 2, remaining * share);
        walls.walls(bx0, bz0, bx1, bz1, base, h, wall, BAY_W, FLOOR_H);
        // Banding at each setback catches the light.
        trimB.box(bx0 - 0.2, bz0 - 0.2, bx1 + 0.2, bz1 + 0.2, h - 0.5, h, accent);
        addFacadeBalconies(building, balconyB, bx0, bz0, bx1, bz1, base, h, accent);
        base = h;
        const inset = (Math.min(bx1 - bx0, bz1 - bz0) * 0.16) / 2;
        bx0 += inset;
        bz0 += inset;
        bx1 -= inset;
        bz1 -= inset;
      }

      roofB.ground(bx0, bz0, bx1, bz1, base, roof);
      // Crown and mast.
      const mx = (bx0 + bx1) / 2;
      const mz = (bz0 + bz1) / 2;
      trimB.box(mx - 0.35, mz - 0.35, mx + 0.35, mz + 0.35, base, base + 14, accent);
      const lodging = lodgingUse(building);
      if (lodging) {
        const gold = new THREE.Color(lodging === "hotel" ? "#c9a44c" : "#8a5a3a");
        trimB.box(x0 + 4.2, z1 - 0.2, x1 - 4.2, z1 + 1.6, 3.2, 3.55, gold);
        trimB.box(x0 + 5.4, z1 - 0.35, x1 - 5.4, z1 + 0.2, 3.55, 5.4, gold);
      }
      break;
    }

    case "apartment":
    case "office":
    case "hospital": {
      const h = floors * FLOOR_H;
      walls.walls(x0, z0, x1, z1, 0, h, wall, BAY_W, FLOOR_H);
      roofB.ground(x0, z0, x1, z1, h, roof);
      // Parapet plus a couple of rooftop plant boxes.
      trimB.walls(x0, z0, x1, z1, h, h + 0.75, accent);
      trimB.box(x0 + 1.5, z0 + 1.5, x0 + 4, z0 + 3.6, h, h + 1.6, accent);
      // Ground-floor entrance canopy.
      trimB.box(x0 + 1, z1 - 0.1, x0 + 5, z1 + 1.4, 3.1, 3.4, accent);
      addFacadeBalconies(building, balconyB, x0, z0, x1, z1, FLOOR_H, h, accent);
      break;
    }

    case "shop": {
      if (venueRole(building) === "mall") {
        const h = Math.max(15.6, Math.max(3, floors) * FLOOR_H);
        const glassWalls = wallsFor("glass");
        const stone = new THREE.Color("#d8cfc4");
        const gold = new THREE.Color("#c9a44c");
        const glass = new THREE.Color("#9eb8c6");
        walls.walls(x0, z0, x1, z1, 0, 1.15, stone, BAY_W, FLOOR_H);
        glassWalls.walls(x0, z0, x1, z1, 1.15, h, glass, BAY_W, FLOOR_H);
        trimB.walls(x0 - 0.12, z0 - 0.12, x1 + 0.12, z1 + 0.12, h, h + 0.85, gold);
        roofB.ground(x0 + 1.2, z0 + 1.2, x1 - 1.2, z1 - 1.2, h + 0.85, roof);
        const mx = (x0 + x1) / 2;
        trimB.box(mx - 12, z1 - 0.15, mx + 12, z1 + 3.2, 3.35, 3.72, gold);
        trimB.box(mx - 11.2, z1 + 0.15, mx + 11.2, z1 + 2.6, 3.72, 5.4, gold);
        trimB.box(x0 + 6, z0 + 8, x0 + 14, z0 + 16, h + 0.85, h + 3.1, roof);
        trimB.box(x1 - 16, z0 + 10, x1 - 7, z0 + 18, h + 0.85, h + 2.6, roof);
        trimB.box(mx - 3.2, z1 - 18, mx + 3.2, z1 - 10, h + 0.85, h + 4.4, gold);
        break;
      }
      const h = Math.max(2, floors) * FLOOR_H;
      // Glazed shopfront below, solid wall above.
      walls.walls(x0, z0, x1, z1, 3.4, h, wall, BAY_W, FLOOR_H);
      const glassWalls = wallsFor("glass");
      glassWalls.walls(x0, z0, x1, z1, 0.1, 3.4, new THREE.Color("#8fa6b4"));
      roofB.ground(x0, z0, x1, z1, h, roof);
      trimB.walls(x0, z0, x1, z1, h, h + 0.5, accent);
      // Awning over the pavement.
      trimB.box(x0, z1, x1, z1 + 1.6, 3.5, 3.75, accent);
      break;
    }

    case "school":
    case "police":
    case "fire":
    case "city_hall": {
      const h = floors * FLOOR_H;
      walls.walls(x0, z0, x1, z1, 0, h, wall, BAY_W, FLOOR_H);
      roofB.ground(x0, z0, x1, z1, h, roof);
      trimB.walls(x0, z0, x1, z1, h, h + 0.6, accent);

      // Portico: a row of columns across the entrance face.
      const columns = 4;
      for (let i = 0; i <= columns; i++) {
        const cx = x0 + ((x1 - x0) * i) / columns;
        trimB.box(cx - 0.3, z1 - 0.1, cx + 0.3, z1 + 1.5, 0, h * 0.62, accent);
      }
      trimB.box(x0, z1 - 0.1, x1, z1 + 1.7, h * 0.62, h * 0.62 + 0.7, accent);

      if (building.kind === "city_hall") {
        // A dome drum on the roof.
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        const r = Math.min(x1 - x0, z1 - z0) * 0.22;
        trimB.box(cx - r, cz - r, cx + r, cz + r, h, h + 3.2, roof);
        trimB.box(cx - r * 0.5, cz - r * 0.5, cx + r * 0.5, cz + r * 0.5, h + 3.2, h + 5.4, accent);
      }
      break;
    }

    case "park_pavilion": {
      // Open shelter: four posts and a hipped roof.
      for (const [px, pz] of [
        [x0 + 0.4, z0 + 0.4],
        [x1 - 0.4, z0 + 0.4],
        [x0 + 0.4, z1 - 0.4],
        [x1 - 0.4, z1 - 0.4],
      ]) {
        trimB.box(px - 0.18, pz - 0.18, px + 0.18, pz + 0.18, 0, 3, accent);
      }
      roofB.gable(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, 3, 1.6, roof, "x");
      break;
    }

    case "baseball_stadium": {
      addStadiumMesh(building, walls, roofB, trimB, blockers, wall, roof, accent);
      break;
    }

    case "subway_station": {
      const glass = wallsFor("glass");
      glass.walls(x0 + 0.8, z0 + 0.6, x1 - 0.8, z1 - 0.4, 0.08, 3.1, new THREE.Color("#8fa6b4"));
      trimB.box(x0 + 0.5, z1 - 0.15, x1 - 0.5, z1 + 1.5, 3.05, 3.28, accent);
      trimB.box(x0 + 1.6, z0 + 1.4, x1 - 1.6, z1 - 1.1, 0, 0.08, new THREE.Color("#14161a"));
      trimB.box((x0 + x1) / 2 - 0.55, z1 + 0.15, (x0 + x1) / 2 + 0.55, z1 + 0.45, 3.28, 4.55, accent);
      roofB.ground(x0 + 0.7, z0 + 0.5, x1 - 0.7, z1 - 0.3, 3.3, roof);
      break;
    }
  }
}

function addStadiumMesh(
  building: Building,
  walls: MeshBuilder,
  roofB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  wall: THREE.Color,
  grass: THREE.Color,
  accent: THREE.Color,
) {
  const x0 = building.origin.x * TILE + 0.35;
  const z0 = building.origin.y * TILE + 0.35;
  const x1 = (building.origin.x + building.width) * TILE - 0.35;
  const z1 = (building.origin.y + building.depth) * TILE - 0.35;
  const h = 13;
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  const navy = new THREE.Color("#1f4d8c");
  const dirt = new THREE.Color("#c4a56a");
  const steel = new THREE.Color("#d5dde4");
  const lamp = new THREE.Color("#fff3c4");

  blockers.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });

  // Outer bowl.
  walls.walls(x0, z0, x1, z1, 0, h, wall, BAY_W, 3.2);
  // Recessed north gate so the entrance reads from the arterial.
  trimB.box(mx - 5.2, z0 - 0.35, mx + 5.2, z0 + 1.1, 0, 5.4, accent);
  trimB.box(mx - 5.4, z0 - 0.2, mx + 5.4, z0 + 1.2, 5.2, 7.1, navy);
  // Ravens fascia.
  trimB.box(mx - 6.5, z0 - 0.45, mx + 6.5, z0 + 0.15, 7.2, 9.4, navy);

  // Seating terraces stepping down to the field.
  for (let i = 0; i < 5; i++) {
    const inset = 2.4 + i * 1.55;
    const y = 2 + i * 1.45;
    roofB.box(x0 + inset, z0 + inset, x1 - inset, z0 + inset + 1.35, y, y + 1.2, navy);
    roofB.box(x0 + inset, z1 - inset - 1.35, x1 - inset, z1 - inset, y, y + 1.2, navy);
    roofB.box(x0 + inset, z0 + inset, x0 + inset + 1.35, z1 - inset, y, y + 1.2, navy);
    roofB.box(x1 - inset - 1.35, z0 + inset, x1 - inset, z1 - inset, y, y + 1.2, navy);
  }

  roofB.ground(x0 + 10, z0 + 9, x1 - 10, z1 - 9, 0.05, grass);
  roofB.ground(mx - 6, mz - 2, mx + 6, mz + 8, 0.07, dirt);

  // Light towers at the four corners.
  for (const [lx, lz] of [
    [x0 + 2.2, z0 + 2.2],
    [x1 - 2.2, z0 + 2.2],
    [x0 + 2.2, z1 - 2.2],
    [x1 - 2.2, z1 - 2.2],
  ]) {
    trimB.box(lx - 0.22, lz - 0.22, lx + 0.22, lz + 0.22, 0, 24, steel);
    trimB.box(lx - 1.2, lz - 0.45, lx + 1.2, lz + 0.45, 22.4, 23.6, lamp);
  }

  // Scoreboard above the south stands.
  trimB.box(mx - 6, z1 - 2.8, mx + 6, z1 - 1.5, 8, 14.5, new THREE.Color("#161b21"));
  trimB.box(mx - 0.3, z1 - 2.2, mx + 0.3, z1 - 1.9, 14.5, 16.2, accent);
}

function addBridge(
  tile: Tile,
  tiles: Tile[][],
  concreteB: MeshBuilder,
  roadB: MeshBuilder,
  trimB: MeshBuilder,
  lampHeadB: MeshBuilder,
  lamps: THREE.Vector3[],
  scratch: THREE.Color,
) {
  const bridge = tile.bridge;
  if (!bridge) return;

  const x0 = tile.x * TILE;
  const z0 = tile.y * TILE;
  const x1 = x0 + TILE;
  const z1 = z0 + TILE;
  const curb = 1.55;

  // Keep the roadway, leave the sides open so the river shows.
  const dx0 = bridge.axis === "ew" ? x0 : x0 + curb;
  const dx1 = bridge.axis === "ew" ? x1 : x1 - curb;
  const dz0 = bridge.axis === "ns" ? z0 : z0 + curb;
  const dz1 = bridge.axis === "ns" ? z1 : z1 - curb;

  const yWest = bridgeDeckHeight(tile, x0 + 0.01, z0 + TILE / 2, tiles);
  const yEast = bridgeDeckHeight(tile, x1 - 0.01, z0 + TILE / 2, tiles);
  const yNorth = bridgeDeckHeight(tile, x0 + TILE / 2, z0 + 0.01, tiles);
  const ySouth = bridgeDeckHeight(tile, x0 + TILE / 2, z1 - 0.01, tiles);

  const asphalt = new THREE.Color("#3b3d43");
  const under = new THREE.Color("#8a8680");
  const rail = new THREE.Color("#c5c9ce");

  if (bridge.axis === "ew") {
    slopedDeck(roadB, dx0, dz0, dx1, dz1, yWest, yEast, "ew", asphalt);
    slopedDeck(
      concreteB,
      dx0,
      dz0,
      dx1,
      dz1,
      yWest - DECK_THICK,
      yEast - DECK_THICK,
      "ew",
      under,
    );
    // Fascia along the travelled edges.
    slopedFascia(concreteB, dx0, dz0, dx1, yWest, yEast, under);
    slopedFascia(concreteB, dx0, dz1, dx1, yWest, yEast, under);
    railing(trimB, dx0, dz0, dx1, yWest, yEast, "ew", rail);
    railing(trimB, dx0, dz1, dx1, yWest, yEast, "ew", rail);
  } else {
    slopedDeck(roadB, dx0, dz0, dx1, dz1, yNorth, ySouth, "ns", asphalt);
    slopedDeck(
      concreteB,
      dx0,
      dz0,
      dx1,
      dz1,
      yNorth - DECK_THICK,
      ySouth - DECK_THICK,
      "ns",
      under,
    );
    slopedFasciaNS(concreteB, dx0, dz0, dz1, yNorth, ySouth, under);
    slopedFasciaNS(concreteB, dx1, dz0, dz1, yNorth, ySouth, under);
    railing(trimB, dz0, dx0, dz1, yNorth, ySouth, "ns", rail);
    railing(trimB, dz0, dx1, dz1, yNorth, ySouth, "ns", rail);
  }

  // Lane dash so the span reads as the same street.
  scratch.set("#cfc7bc");
  if (bridge.axis === "ew") {
    const cz = (dz0 + dz1) / 2;
    slopedDeck(roadB, x0 + 2.2, cz - 0.08, x1 - 2.2, cz + 0.08, yWest + 0.02, yEast + 0.02, "ew", scratch);
  } else {
    const cx = (dx0 + dx1) / 2;
    slopedDeck(roadB, cx - 0.08, z0 + 2.2, cx + 0.08, z1 - 2.2, yNorth + 0.02, ySouth + 0.02, "ns", scratch);
  }

  if (bridge.pier) {
    scratch.set("#8a8680");
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    // Pair of columns under the edges — never in the driving lane.
    if (bridge.axis === "ew") {
      concreteB.box(cx - 0.4, dz0 - 0.65, cx + 0.4, dz0 - 0.1, -2.4, Math.min(yWest, yEast) - DECK_THICK, scratch);
      concreteB.box(cx - 0.4, dz1 + 0.1, cx + 0.4, dz1 + 0.65, -2.4, Math.min(yWest, yEast) - DECK_THICK, scratch);
    } else {
      concreteB.box(dx0 - 0.65, cz - 0.4, dx0 - 0.1, cz + 0.4, -2.4, Math.min(yNorth, ySouth) - DECK_THICK, scratch);
      concreteB.box(dx1 + 0.1, cz - 0.4, dx1 + 0.65, cz + 0.4, -2.4, Math.min(yNorth, ySouth) - DECK_THICK, scratch);
    }
  }

  // One lamp per span tile so the crossing is not a black gap at night.
  if (bridge.axis === "ew") {
    const lx = x0 + TILE * 0.35;
    const lz = dz0 + 0.2;
    addLamp(trimB, lampHeadB, lx, lz, lamps, {
      armX: 0,
      armZ: 1.15,
      y: bridgeDeckHeight(tile, lx, lz, tiles),
    });
  } else {
    const lx = dx0 + 0.2;
    const lz = z0 + TILE * 0.35;
    addLamp(trimB, lampHeadB, lx, lz, lamps, {
      armX: 1.15,
      armZ: 0,
      y: bridgeDeckHeight(tile, lx, lz, tiles),
    });
  }

  // Towers sit beside the roadway so they never swallow the walker.
  if (bridge.pylon) {
    scratch.set("#d5dae0");
    const cx = (x0 + x1) / 2;
    const mid = (z0 + z1) / 2;
    if (bridge.axis === "ew") {
      addPylon(trimB, cx, dz0 - 0.35, scratch);
      addPylon(trimB, cx, dz1 + 0.35, scratch);
    } else {
      addPylon(trimB, dx0 - 0.35, mid, scratch);
      addPylon(trimB, dx1 + 0.35, mid, scratch);
    }
  }
}

/** Deck height under a world point. Shared by the mesh and the walker. */
export function bridgeDeckHeight(tile: Tile, x: number, z: number, tiles?: Tile[][]) {
  const bridge = tile.bridge;
  if (!bridge) return 0;
  const abutment = bridge.abutment ?? inferAbutment(tile, tiles);
  const localX = (x - tile.x * TILE) / TILE;
  const localZ = (z - tile.y * TILE) / TILE;
  if (bridge.axis === "ew") {
    if (abutment === "start") return DECK_H * clamp01(localX);
    if (abutment === "end") return DECK_H * clamp01(1 - localX);
    return DECK_H;
  }
  if (abutment === "start") return DECK_H * clamp01(localZ);
  if (abutment === "end") return DECK_H * clamp01(1 - localZ);
  return DECK_H;
}

function inferAbutment(tile: Tile, tiles?: Tile[][]) {
  const bridge = tile.bridge;
  if (!bridge || !tiles) return null;
  if (bridge.axis === "ew") {
    const west = tiles[tile.y]?.[tile.x - 1]?.bridge;
    const east = tiles[tile.y]?.[tile.x + 1]?.bridge;
    if (!west && east) return "start" as const;
    if (west && !east) return "end" as const;
  } else {
    const north = tiles[tile.y - 1]?.[tile.x]?.bridge;
    const south = tiles[tile.y + 1]?.[tile.x]?.bridge;
    if (!north && south) return "start" as const;
    if (north && !south) return "end" as const;
  }
  return null;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function slopedDeck(
  builder: MeshBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  yA: number,
  yB: number,
  axis: "ew" | "ns",
  color: THREE.Color,
) {
  if (axis === "ew") {
    builder.quad(
      { x: x0, y: yA, z: z1 },
      { x: x1, y: yB, z: z1 },
      { x: x1, y: yB, z: z0 },
      { x: x0, y: yA, z: z0 },
      color,
    );
  } else {
    builder.quad(
      { x: x0, y: yA, z: z0 },
      { x: x0, y: yB, z: z1 },
      { x: x1, y: yB, z: z1 },
      { x: x1, y: yA, z: z0 },
      color,
    );
  }
}

function slopedFascia(
  builder: MeshBuilder,
  x0: number,
  z: number,
  x1: number,
  y0: number,
  y1: number,
  color: THREE.Color,
) {
  builder.quad(
    { x: x0, y: y0 - DECK_THICK, z },
    { x: x1, y: y1 - DECK_THICK, z },
    { x: x1, y: y1, z },
    { x: x0, y: y0, z },
    color,
  );
}

function slopedFasciaNS(
  builder: MeshBuilder,
  x: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
  color: THREE.Color,
) {
  builder.quad(
    { x, y: y0 - DECK_THICK, z: z0 },
    { x, y: y1 - DECK_THICK, z: z1 },
    { x, y: y1, z: z1 },
    { x, y: y0, z: z0 },
    color,
  );
}

function railing(
  builder: MeshBuilder,
  a0: number,
  side: number,
  a1: number,
  y0: number,
  y1: number,
  axis: "ew" | "ns",
  color: THREE.Color,
) {
  const posts = 4;
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    const y = y0 + (y1 - y0) * t;
    if (axis === "ew") {
      const x = a0 + (a1 - a0) * t;
      builder.box(x - 0.05, side - 0.05, x + 0.05, side + 0.05, y, y + 1.05, color);
    } else {
      const z = a0 + (a1 - a0) * t;
      builder.box(side - 0.05, z - 0.05, side + 0.05, z + 0.05, y, y + 1.05, color);
    }
  }
  if (axis === "ew") {
    builder.quad(
      { x: a0, y: y0 + 1.05, z: side },
      { x: a1, y: y1 + 1.05, z: side },
      { x: a1, y: y1 + 1.12, z: side },
      { x: a0, y: y0 + 1.12, z: side },
      color,
    );
  } else {
    builder.quad(
      { x: side, y: y0 + 1.05, z: a0 },
      { x: side, y: y1 + 1.05, z: a1 },
      { x: side, y: y1 + 1.12, z: a1 },
      { x: side, y: y0 + 1.12, z: a0 },
      color,
    );
  }
}

function addPylon(builder: MeshBuilder, x: number, z: number, color: THREE.Color) {
  builder.box(x - 0.28, z - 0.28, x + 0.28, z + 0.28, -2.4, DECK_H + 9, color);
  builder.box(x - 0.4, z - 0.4, x + 0.4, z + 0.4, DECK_H + 8.6, DECK_H + 9.3, color);
}

function buildWater(state: CityState) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let found = false;

  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (state.tiles[y][x].terrain !== "water") continue;
      found = true;
      minX = Math.min(minX, x * TILE);
      maxX = Math.max(maxX, (x + 1) * TILE);
      minZ = Math.min(minZ, y * TILE);
      maxZ = Math.max(maxZ, (y + 1) * TILE);
    }
  }
  if (!found) return null;

  // A single quad spanning the river's bounding box, which the banks overlap.
  const geometry = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((minX + maxX) / 2, -0.35, (minZ + maxZ) / 2);

  const normalMap = rippleNormal();
  normalMap.repeat.set((maxX - minX) / 18, (maxZ - minZ) / 18);

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2c6b93"),
    roughness: 0.12,
    metalness: 0.4,
    normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    transparent: true,
    opacity: 0.92,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false;
  return mesh;
}

function buildTrees(state: CityState) {
  const spots: Array<{ x: number; z: number; scale: number; variant: number }> = [];
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      const tile = state.tiles[y][x];
      if (!tile.tree || tile.buildingId) continue;
      spots.push({
        x: x * TILE + TILE / 2,
        z: y * TILE + TILE / 2,
        scale: tile.tree.scale,
        variant: tile.tree.variant,
      });
    }
  }
  if (!spots.length) return [];

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3.4, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#5b4630", roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);

  const canopyGeo = new THREE.IcosahedronGeometry(2.3, 0);
  const canopyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    flatShading: true,
  });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const color = new THREE.Color();
  const greens = ["#2f6b34", "#3a7d3c", "#275c30", "#457f3a", "#356b45", "#2c7040"];

  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    const s = 0.85 + spot.scale * 0.4;

    position.set(spot.x, 1.7 * s, spot.z);
    scale.set(s, s, s);
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.variant);
    matrix.compose(position, quat, scale);
    trunks.setMatrixAt(i, matrix);

    position.set(spot.x, 3.6 * s + 0.9, spot.z);
    scale.set(s * 1.05, s * 1.25, s * 1.05);
    matrix.compose(position, quat, scale);
    canopies.setMatrixAt(i, matrix);
    canopies.setColorAt(i, color.set(greens[spot.variant % greens.length]));
  }

  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  trunks.castShadow = true;
  canopies.castShadow = true;

  return [trunks, canopies];
}
