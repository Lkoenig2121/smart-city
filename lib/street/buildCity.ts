import * as THREE from "three";
import type { Building, BuildingKind, CityState, Terrain, Tile } from "@/lib/city/types";
import { lodgingUse } from "@/lib/city/lodging";
import { MeshBuilder } from "./meshBuilder";
import { BAY_W, FLOOR_H, asphaltTexture, facade, rippleNormal, type FacadeStyle } from "./textures";

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
};

/** Axis-aligned box a walker cannot pass through. */
export interface Blocker {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CityMeshes {
  group: THREE.Group;
  water: THREE.Mesh | null;
  blockers: Blocker[];
  /** Lamp head positions, used to place a rolling pool of point lights. */
  lamps: THREE.Vector3[];
  /** Materials whose emissive strength tracks the time of day. */
  emissiveMaterials: THREE.MeshStandardMaterial[];
  /** Street-lamp globes; brighter at night than window glass. */
  lampGlow: THREE.MeshStandardMaterial | null;
  dispose: () => void;
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
        // Pavements hug the edges that face something other than road.
        const north = isRoad(state.tiles, x, y - 1);
        const south = isRoad(state.tiles, x, y + 1);
        const east = isRoad(state.tiles, x + 1, y);
        const west = isRoad(state.tiles, x - 1, y);

        const ax0 = west ? x0 : x0 + SIDEWALK_W;
        const ax1 = east ? x1 : x1 - SIDEWALK_W;
        const az0 = north ? z0 : z0 + SIDEWALK_W;
        const az1 = south ? z1 : z1 - SIDEWALK_W;

        scratch.set(ROAD_COLOR);
        roadB.ground(ax0, az0, ax1, az1, 0, scratch, TILE / 4, TILE / 4);

        scratch.set(SIDEWALK_COLOR);
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
        if (straightNS) {
          for (let i = 0; i < 2; i++) {
            const zs = z0 + i * (TILE / 2) + TILE * 0.12;
            roadB.ground(cx - 0.14, zs, cx + 0.14, zs + TILE * 0.26, 0.012, scratch);
          }
        } else if (straightEW) {
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
  for (const building of state.buildings.values()) {
    addBuilding(building, wallsFor, roofB, trimB, blockers);
  }

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
    lamps,
    emissiveMaterials,
    lampGlow,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

/** A raised pavement slab with a curb face along its street edge. */
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

function addBuilding(
  building: Building,
  wallsFor: (style: FacadeStyle) => MeshBuilder,
  roofB: MeshBuilder,
  trimB: MeshBuilder,
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
      break;
    }

    case "shop": {
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
