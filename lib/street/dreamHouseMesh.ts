import * as THREE from "three";
import type { Building } from "@/lib/city/types";
import { TILE, type Blocker } from "./buildCity";
import { FLOOR_H } from "./textures";
import { MeshBuilder } from "./meshBuilder";

const INSET = 0.55;
/** Bump when the house mesh changes so an open studio rebuilds the preview. */
export const DREAM_MESH_REV = 5;

function bounds(building: Building) {
  const x0 = building.origin.x * TILE + INSET;
  const z0 = building.origin.y * TILE + INSET;
  const x1 = (building.origin.x + building.width) * TILE - INSET;
  const z1 = (building.origin.y + building.depth) * TILE - INSET;
  return { x0, z0, x1, z1 };
}

function addRoof(builder: MeshBuilder, building: Building, x0: number, z0: number, x1: number, z1: number, y: number, color: THREE.Color) {
  const roof = building.stats.extra?.roof ?? "gable";
  const steep = building.stats.extra?.style === "chalet";
  const rise = steep ? 4.4 : 2.3;
  if (roof === "flat") {
    builder.box(x0 - 0.25, z0 - 0.25, x1 + 0.25, z1 + 0.25, y, y + 0.35, color);
    return;
  }
  if (roof === "hip") {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const peak = y + rise;
    const s = 0.35;
    builder.quad(
      { x: x0, y, z: z1 },
      { x: x1, y, z: z1 },
      { x: cx + s, y: peak, z: cz + s },
      { x: cx - s, y: peak, z: cz + s },
      color,
    );
    builder.quad(
      { x: x1, y, z: z1 },
      { x: x1, y, z: z0 },
      { x: cx + s, y: peak, z: cz - s },
      { x: cx + s, y: peak, z: cz + s },
      color,
    );
    builder.quad(
      { x: x1, y, z: z0 },
      { x: x0, y, z: z0 },
      { x: cx - s, y: peak, z: cz - s },
      { x: cx + s, y: peak, z: cz - s },
      color,
    );
    builder.quad(
      { x: x0, y, z: z0 },
      { x: x0, y, z: z1 },
      { x: cx - s, y: peak, z: cz + s },
      { x: cx - s, y: peak, z: cz - s },
      color,
    );
    return;
  }
  const ridge = x1 - x0 >= z1 - z0 ? "x" : "z";
  builder.gable(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, y, rise, color, ridge);
}

function addWindows(builder: MeshBuilder, x0: number, z0: number, x1: number, z1: number, floors: number, glass: boolean, facing: number) {
  const ink = new THREE.Color(glass ? "#16343c" : "#1a2430");
  const winH = glass ? 1.7 : 1.15;
  const winW = glass ? 1.5 : 0.9;
  for (let floor = 0; floor < floors; floor++) {
    const y0 = 0.85 + floor * FLOOR_H;
    const y1 = y0 + winH;
    const spanX = x1 - x0;
    const spanZ = z1 - z0;
    const cols = Math.max(1, Math.floor(spanX / 3.2));
    const rows = Math.max(1, Math.floor(spanZ / 3.2));
    for (let i = 0; i < cols; i++) {
      const cx = x0 + ((i + 0.5) * spanX) / cols;
      if (facing !== 2) builder.box(cx - winW / 2, z1 - 0.02, cx + winW / 2, z1 + 0.08, y0, y1, ink);
      if (facing !== 0) builder.box(cx - winW / 2, z0 - 0.08, cx + winW / 2, z0 + 0.02, y0, y1, ink);
    }
    for (let i = 0; i < rows; i++) {
      const cz = z0 + ((i + 0.5) * spanZ) / rows;
      if (facing !== 3) builder.box(x1 - 0.02, cz - winW / 2, x1 + 0.08, cz + winW / 2, y0, y1, ink);
      if (facing !== 1) builder.box(x0 - 0.08, cz - winW / 2, x0 + 0.02, cz + winW / 2, y0, y1, ink);
    }
  }
}

function addDoor(builder: MeshBuilder, building: Building, x0: number, z0: number, x1: number, z1: number, accent: THREE.Color) {
  const facing = Number(building.stats.extra?.facing ?? 0);
  const garage = building.stats.extra?.style === "garage";
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const door = accent;
  if (facing === 0) {
    builder.box(cx - 0.55, z1 - 0.05, cx + 0.55, z1 + 0.16, 0, 2.15, door);
    if (garage) builder.box(x1 - 2.4, z1 - 0.05, x1 - 0.45, z1 + 0.2, 0, 2.05, new THREE.Color("#1a1a1a"));
  } else if (facing === 2) {
    builder.box(cx - 0.55, z0 - 0.16, cx + 0.55, z0 + 0.05, 0, 2.15, door);
    if (garage) builder.box(x0 + 0.45, z0 - 0.2, x0 + 2.4, z0 + 0.05, 0, 2.05, new THREE.Color("#1a1a1a"));
  } else if (facing === 1) {
    builder.box(x1 - 0.05, cz - 0.55, x1 + 0.16, cz + 0.55, 0, 2.15, door);
    if (garage) builder.box(x1 - 0.05, z0 + 0.45, x1 + 0.2, z0 + 2.4, 0, 2.05, new THREE.Color("#1a1a1a"));
  } else {
    builder.box(x0 - 0.16, cz - 0.55, x0 + 0.05, cz + 0.55, 0, 2.15, door);
    if (garage) builder.box(x0 - 0.2, z1 - 2.4, x0 + 0.05, z1 - 0.45, 0, 2.05, new THREE.Color("#1a1a1a"));
  }
}

/** Street face of a modern house: wide glass bands, a deep flat roof, and a set-back top floor. */
function addModernHouse(
  walls: MeshBuilder,
  roof: MeshBuilder,
  glass: MeshBuilder,
  trim: MeshBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  floors: number,
  wall: THREE.Color,
  roofColor: THREE.Color,
  accent: THREE.Color,
  facing: number,
) {
  const baseFloors = floors > 1 ? floors - 1 : 1;
  const baseH = baseFloors * FLOOR_H;
  const topH = floors * FLOOR_H;
  const pane = new THREE.Color("#163044");
  const frame = accent;
  walls.walls(x0, z0, x1, z1, 0, baseH, wall);
  roof.box(x0 - 1.25, z0 - 1.25, x1 + 1.25, z1 + 1.25, baseH, baseH + 0.22, roofColor);

  let upper: { x0: number; z0: number; x1: number; z1: number } | null = null;
  if (floors > 1) {
    const span = facing === 0 || facing === 2 ? z1 - z0 : x1 - x0;
    const inset = Math.min(2.6, span * 0.34);
    upper =
      facing === 0
        ? { x0: x0 + 0.45, z0, x1: x1 - 0.45, z1: z1 - inset }
        : facing === 2
          ? { x0: x0 + 0.45, z0: z0 + inset, x1: x1 - 0.45, z1 }
          : facing === 1
            ? { x0, z0: z0 + 0.45, x1: x1 - inset, z1: z1 - 0.45 }
            : { x0: x0 + inset, z0: z0 + 0.45, x1, z1: z1 - 0.45 };
    if (upper.x1 - upper.x0 > 3 && upper.z1 - upper.z0 > 3) {
      walls.walls(upper.x0, upper.z0, upper.x1, upper.z1, baseH + 0.22, topH, wall);
      roof.box(upper.x0 - 0.9, upper.z0 - 0.9, upper.x1 + 0.9, upper.z1 + 0.9, topH, topH + 0.2, roofColor);
    } else {
      upper = null;
    }
  }

  const ribbon = (y0: number, y1: number, gapDoor: boolean) => {
    const margin = 0.55;
    const doorHalf = 0.7;
    if (facing === 0 || facing === 2) {
      const left = x0 + margin;
      const right = x1 - margin;
      const mid = (x0 + x1) / 2;
      if (gapDoor && right - left > 3) {
        faceStrip(glass, facing, x0, z0, x1, z1, left, mid - doorHalf, y0, y1, pane);
        faceStrip(glass, facing, x0, z0, x1, z1, mid + doorHalf, right, y0, y1, pane);
      } else {
        faceStrip(glass, facing, x0, z0, x1, z1, left, right, y0, y1, pane);
      }
    } else {
      const left = z0 + margin;
      const right = z1 - margin;
      const mid = (z0 + z1) / 2;
      if (gapDoor && right - left > 3) {
        faceStrip(glass, facing, x0, z0, x1, z1, left, mid - doorHalf, y0, y1, pane);
        faceStrip(glass, facing, x0, z0, x1, z1, mid + doorHalf, right, y0, y1, pane);
      } else {
        faceStrip(glass, facing, x0, z0, x1, z1, left, right, y0, y1, pane);
      }
    }
  };

  ribbon(0.55, 2.35, true);
  for (let floor = 1; floor < baseFloors; floor++) {
    const y0 = floor * FLOOR_H + 0.55;
    ribbon(y0, y0 + 1.7, false);
    trim.box(x0 - 0.08, z0 - 0.08, x1 + 0.08, z1 + 0.08, floor * FLOOR_H - 0.06, floor * FLOOR_H + 0.08, frame);
  }
  if (upper) {
    const y0 = baseH + 0.7;
    faceStrip(
      glass,
      facing,
      upper.x0,
      upper.z0,
      upper.x1,
      upper.z1,
      facing === 0 || facing === 2 ? upper.x0 + 0.4 : upper.z0 + 0.4,
      facing === 0 || facing === 2 ? upper.x1 - 0.4 : upper.z1 - 0.4,
      y0,
      y0 + 1.45,
      pane,
    );
  }

  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const door = new THREE.Color("#10141c");
  if (facing === 0) {
    trim.box(cx - 0.55, z1 - 0.04, cx + 0.55, z1 + 0.16, 0, 2.45, door);
    trim.box(cx - 1.15, z1, cx + 1.15, z1 + 1.55, 2.5, 2.64, roofColor);
  } else if (facing === 2) {
    trim.box(cx - 0.55, z0 - 0.16, cx + 0.55, z0 + 0.04, 0, 2.45, door);
    trim.box(cx - 1.15, z0 - 1.55, cx + 1.15, z0, 2.5, 2.64, roofColor);
  } else if (facing === 1) {
    trim.box(x1 - 0.04, cz - 0.55, x1 + 0.16, cz + 0.55, 0, 2.45, door);
    trim.box(x1, cz - 1.15, x1 + 1.55, cz + 1.15, 2.5, 2.64, roofColor);
  } else {
    trim.box(x0 - 0.16, cz - 0.55, x0 + 0.04, cz + 0.55, 0, 2.45, door);
    trim.box(x0 - 1.55, cz - 1.15, x0, cz + 1.15, 2.5, 2.64, roofColor);
  }
}

function faceStrip(
  builder: MeshBuilder,
  facing: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  color: THREE.Color,
) {
  const depth = 0.16;
  if (facing === 0) builder.box(a0, z1 - 0.02, a1, z1 + depth, y0, y1, color);
  else if (facing === 2) builder.box(a0, z0 - depth, a1, z0 + 0.02, y0, y1, color);
  else if (facing === 1) builder.box(x1 - 0.02, a0, x1 + depth, a1, y0, y1, color);
  else builder.box(x0 - depth, a0, x0 + 0.02, a1, y0, y1, color);
}

function addPorch(builder: MeshBuilder, building: Building, x0: number, z0: number, x1: number, z1: number, accent: THREE.Color) {
  if (building.stats.extra?.style !== "starter" && building.stats.extra?.style !== "traditional" && building.stats.extra?.style !== "craftsman" && building.stats.extra?.style !== "farmhouse" && building.stats.extra?.style !== "chalet" && building.stats.extra?.style !== "coastal" && building.stats.extra?.style !== "mansion" && building.stats.extra?.style !== "estate") {
    return;
  }
  const facing = Number(building.stats.extra?.facing ?? 0);
  const slab = new THREE.Color("#cfc6b8");
  if (facing === 0) {
    builder.box(x0 + 0.4, z1, x1 - 0.4, z1 + 1.35, 0, 0.28, slab);
    builder.box(x0 + 0.55, z1 + 0.35, x0 + 0.85, z1 + 0.7, 0.28, 2.4, accent);
    builder.box(x1 - 0.85, z1 + 0.35, x1 - 0.55, z1 + 0.7, 0.28, 2.4, accent);
  } else if (facing === 2) {
    builder.box(x0 + 0.4, z0 - 1.35, x1 - 0.4, z0, 0, 0.28, slab);
    builder.box(x0 + 0.55, z0 - 0.7, x0 + 0.85, z0 - 0.35, 0.28, 2.4, accent);
    builder.box(x1 - 0.85, z0 - 0.7, x1 - 0.55, z0 - 0.35, 0.28, 2.4, accent);
  } else if (facing === 1) {
    builder.box(x1, z0 + 0.4, x1 + 1.35, z1 - 0.4, 0, 0.28, slab);
    builder.box(x1 + 0.35, z0 + 0.55, x1 + 0.7, z0 + 0.85, 0.28, 2.4, accent);
    builder.box(x1 + 0.35, z1 - 0.85, x1 + 0.7, z1 - 0.55, 0.28, 2.4, accent);
  } else {
    builder.box(x0 - 1.35, z0 + 0.4, x0, z1 - 0.4, 0, 0.28, slab);
    builder.box(x0 - 0.7, z0 + 0.55, x0 - 0.35, z0 + 0.85, 0.28, 2.4, accent);
    builder.box(x0 - 0.7, z1 - 0.85, x0 - 0.35, z1 - 0.55, 0.28, 2.4, accent);
  }
}

const ROW_TINTS = ["#f4efe6", "#c45c4a", "#6a5340"];

/** Three street-facing homes sharing party walls. */
function addTownhouseRow(
  walls: MeshBuilder,
  roof: MeshBuilder,
  trim: MeshBuilder,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  floors: number,
  height: number,
  wall: THREE.Color,
  roofColor: THREE.Color,
  accent: THREE.Color,
  facing: number,
) {
  const alongX = facing === 0 || facing === 2;
  const count = 3;
  const span0 = alongX ? x0 : z0;
  const span1 = alongX ? x1 : z1;
  const party = 0.42;
  const bay = (span1 - span0 - party * (count - 1)) / count;
  const door = new THREE.Color("#2a2420");
  const ink = new THREE.Color("#1a2430");
  const slab = new THREE.Color("#cfc6b8");

  for (let i = 0; i < count; i++) {
    const a0 = span0 + i * (bay + party);
    const a1 = a0 + bay;
    const color = wall.clone().lerp(new THREE.Color(ROW_TINTS[i]), 0.55);
    const bx0 = alongX ? a0 : x0;
    const bx1 = alongX ? a1 : x1;
    const bz0 = alongX ? z0 : a0;
    const bz1 = alongX ? z1 : a1;
    walls.walls(bx0, bz0, bx1, bz1, 0, height, color);
    roof.gable(bx0 - 0.08, bz0 - 0.08, bx1 + 0.08, bz1 + 0.08, height, 1.7 + (i % 2) * 0.35, roofColor, alongX ? "z" : "x");
    if (i < count - 1) {
      const seam = a1;
      if (alongX) trim.box(seam, z0 - 0.08, seam + party, z1 + 0.08, 0, height + 0.85, accent);
      else trim.box(x0 - 0.08, seam, x1 + 0.08, seam + party, 0, height + 0.85, accent);
    }
    const mid = (a0 + a1) / 2;
    for (let floor = 0; floor < floors; floor++) {
      const y0 = floor === 0 ? 1.15 : 0.85 + floor * FLOOR_H;
      const y1 = y0 + (floor === 0 ? 0.95 : 1.15);
      const places = floor === 0 ? [mid - bay * 0.28, mid + bay * 0.28] : [mid];
      for (const at of places) {
        if (facing === 0) trim.box(at - 0.32, z1 - 0.02, at + 0.32, z1 + 0.08, y0, y1, ink);
        else if (facing === 2) trim.box(at - 0.32, z0 - 0.08, at + 0.32, z0 + 0.02, y0, y1, ink);
        else if (facing === 1) trim.box(x1 - 0.02, at - 0.32, x1 + 0.08, at + 0.32, y0, y1, ink);
        else trim.box(x0 - 0.08, at - 0.32, x0 + 0.02, at + 0.32, y0, y1, ink);
      }
    }
    if (facing === 0) {
      trim.box(mid - 0.38, z1 - 0.04, mid + 0.38, z1 + 0.14, 0, 2.2, door);
      trim.box(mid - 0.7, z1, mid + 0.7, z1 + 0.95, 0, 0.22, slab);
      trim.box(mid - 0.55, z1 + 0.72, mid + 0.55, z1 + 0.95, 0.22, 0.38, slab);
    } else if (facing === 2) {
      trim.box(mid - 0.38, z0 - 0.14, mid + 0.38, z0 + 0.04, 0, 2.2, door);
      trim.box(mid - 0.7, z0 - 0.95, mid + 0.7, z0, 0, 0.22, slab);
      trim.box(mid - 0.55, z0 - 0.95, mid + 0.55, z0 - 0.72, 0.22, 0.38, slab);
    } else if (facing === 1) {
      trim.box(x1 - 0.04, mid - 0.38, x1 + 0.14, mid + 0.38, 0, 2.2, door);
      trim.box(x1, mid - 0.7, x1 + 0.95, mid + 0.7, 0, 0.22, slab);
      trim.box(x1 + 0.72, mid - 0.55, x1 + 0.95, mid + 0.55, 0.22, 0.38, slab);
    } else {
      trim.box(x0 - 0.14, mid - 0.38, x0 + 0.04, mid + 0.38, 0, 2.2, door);
      trim.box(x0 - 0.95, mid - 0.7, x0, mid + 0.7, 0, 0.22, slab);
      trim.box(x0 - 0.95, mid - 0.55, x0 - 0.72, mid + 0.55, 0.22, 0.38, slab);
    }
  }
}

export function dreamCollider(building: Building): Blocker {
  const { x0, z0, x1, z1 } = bounds(building);
  return { minX: x0, maxX: x1, minZ: z0, maxZ: z1 };
}

/** Solid-color house matching the saved style, stories, and colors. */
export function buildDreamHouseGroup(building: Building, ghost = false): THREE.Group {
  const group = new THREE.Group();
  group.name = ghost ? "dream-preview" : `dream-${building.id}`;
  const walls = new MeshBuilder();
  const roof = new MeshBuilder();
  const trim = new MeshBuilder();
  const glassB = new MeshBuilder();
  const { x0, z0, x1, z1 } = bounds(building);
  const floors = Math.max(1, building.floors);
  const height = floors * FLOOR_H;
  const wall = new THREE.Color(building.wallColor);
  const roofColor = new THREE.Color(building.roofColor);
  const accent = new THREE.Color(building.accentColor);
  const styleId = building.stats.extra?.style ?? "";
  const glassy = styleId === "glass" || styleId === "future" || styleId === "penthouse" || styleId === "mixed";
  if (styleId === "townhouse") {
    addTownhouseRow(walls, roof, trim, x0, z0, x1, z1, floors, height, wall, roofColor, accent, Number(building.stats.extra?.facing ?? 0));
  } else if (styleId === "modern" || styleId === "apartment" || styleId === "penthouse" || styleId === "mixed") {
    addModernHouse(
      walls,
      roof,
      glassB,
      trim,
      x0,
      z0,
      x1,
      z1,
      floors,
      wall,
      roofColor,
      accent,
      Number(building.stats.extra?.facing ?? 0),
    );
  } else {
    walls.walls(x0, z0, x1, z1, 0, height, wall);
    addRoof(roof, building, x0, z0, x1, z1, height, roofColor);
    addWindows(trim, x0, z0, x1, z1, floors, glassy, Number(building.stats.extra?.facing ?? 0));
    addDoor(trim, building, x0, z0, x1, z1, accent);
    addPorch(trim, building, x0, z0, x1, z1, accent);
    if (styleId === "future") {
      trim.box(x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, height + 0.35, height + 0.55, accent);
    }
    if (styleId === "craftsman" || styleId === "traditional") {
      trim.box(x0 + 0.8, z0 + 0.8, x0 + 1.35, z0 + 1.35, height, height + 1.6, accent);
    }
  }

  const materialFor = (roughness: number, metalness: number) =>
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: ghost ? 0.4 : roughness,
      metalness,
      transparent: ghost,
      opacity: ghost ? 0.86 : 1,
      depthWrite: !ghost,
    });

  const add = (builder: MeshBuilder, roughness: number, metalness = 0.04) => {
    if (builder.empty) return;
    const mesh = new THREE.Mesh(builder.build(), materialFor(roughness, metalness));
    mesh.castShadow = !ghost;
    mesh.receiveShadow = !ghost;
    group.add(mesh);
  };
  add(walls, 0.72);
  add(roof, 0.5, 0.08);
  add(trim, 0.4);
  add(glassB, 0.16, 0.42);
  return group;
}

export function disposeDreamGroup(group: THREE.Group) {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((item) => item.dispose());
      else mat.dispose();
    }
  });
  group.removeFromParent();
}
