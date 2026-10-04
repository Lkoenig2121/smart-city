import * as THREE from "three";
import type { Building, CityState } from "@/lib/city/types";
import type { Blocker } from "./buildCity";
import { makeConferenceScreen } from "./conferenceScreen";
import { isAfterHours, OfficeCrowd, officeBusyness, StaffKit, type CrowdSpec, type StaffSpot } from "./officeStaff";
import { MeshBuilder } from "./meshBuilder";
import { FLOOR_H } from "./textures";
import type { VenueInterior } from "./venueInterior";

export const MIN_X = -11;
export const MAX_X = 11;
export const MIN_Z = -9;
export const MAX_Z = 12;
export const CEIL = 4.6;
export const WALL_T = 0.45;
export const DOOR_X = 3.2;
const MAX_FLOORS = 20;
const MIN_FLOORS = 6;
const SILL = 1.0;
const HEAD = 3.7;
const WIN_Z0 = -6.2;
const WIN_Z1 = MAX_Z - 1;
const WIN_X0 = MIN_X + 3;
const WIN_X1 = MAX_X - 3;
/** The rooftop deck sits this far above the tower's modelled roof so parapets and plant boxes stay underneath. */
export const OFFICE_ROOF_DECK = 1.75;

export type Bucket = Array<{ dispose: () => void }>;

export interface OfficeElevator {
  /** Button labels, bottom to top: Lobby, 2, 3 … Roof. */
  floors: string[];
  /** Longer names for the panel (optional; hospital departments). */
  floorNames?: string[];
  deskFloor: number;
  /** Hint under the elevator panel (e.g. "Case · ER bed 3"). */
  markLabel?: () => string | null;
  /** Floor index to highlight for the active case. */
  markFloor?: () => number | null;
  current: () => number;
  isRoof: (index: number) => boolean;
  near: (x: number, z: number) => boolean;
  /** Switches to a floor and returns where the rider steps out. */
  goTo: (index: number) => { x: number; z: number; yaw: number };
  /**
   * How the real streets line up with a floor that has a view outside: `height` up the modelled
   * tower plus `lift` above that, both in city units. Null for floors without windows.
   */
  view: (index: number) => { height: number; lift: number } | null;
}

export interface Layout {
  group: THREE.Group;
  blockers: Blocker[];
  doorZ: number;
}

export interface Sign {
  mesh: THREE.Mesh;
  draw: (title: string, subtitle?: string) => void;
}

type ConferenceScreen = ReturnType<typeof makeConferenceScreen>;

const HALF_PI = Math.PI / 2;

function workSpots(): StaffSpot[] {
  const spots: StaffSpot[] = [];
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 2; row++) {
      const x = -8.6 + col * 5.8;
      const z = 0.4 + row * 4.2;
      const seat = { seat: 0.46, chair: true };
      // Rows sit back to back across a narrow gap, so the inner side only gets one chair, staggered.
      if (row === 0) {
        for (const mx of [x + 1.15, x + 3.45]) spots.push({ x: mx, z: z - 0.45, yaw: 0, ...seat, desk: col === 1 });
        spots.push({ x: x + 1.15, z: z + 3.85, yaw: Math.PI, ...seat });
      } else {
        for (const mx of [x + 1.15, x + 3.45]) spots.push({ x: mx, z: z + 3.85, yaw: Math.PI, ...seat });
        spots.push({ x: x + 3.45, z: z - 0.45, yaw: 0, ...seat });
      }
    }
  }
  spots.push(
    { x: 9.2, z: -6.1, yaw: Math.PI },
    { x: -9.1, z: -6.2, yaw: Math.PI },
    { x: 5.5, z: -4.6, yaw: HALF_PI },
    { x: 6.4, z: -4.6, yaw: -HALF_PI },
  );
  return spots;
}

const WORK_CROWD: CrowdSpec = {
  spots: workSpots(),
  walkers: 5,
  graph: {
    nodes: [
      [-9.6, -2.5],
      [-3.4, -2.5],
      [2.4, -2.5],
      [9.1, -2.5],
      [-9.6, 9.4],
      [-3.4, 9.4],
      [2.4, 9.4],
      [9.1, 9.4],
      [7.9, -5.4],
      [-7.9, -5.4],
      [-3.2, -7.4],
      [3.2, -7.4],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [4, 5],
      [5, 6],
      [6, 7],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
      [3, 8],
      [0, 9],
      [1, 10],
      [2, 11],
    ],
  },
};

const LOBBY_CROWD: CrowdSpec = {
  spots: [
    { x: 0, z: -2.3, yaw: 0, role: "day" },
    { x: 0.9, z: -2.3, yaw: 0, role: "night", uniform: "guard" },
    ...[-9.6, -8.0, 8.0, 9.6].map((x) => ({ x, z: 3.55, yaw: Math.PI, seat: 0.45 })),
    { x: -6.2, z: -6.4, yaw: Math.PI },
    { x: 5.4, z: 7.4, yaw: -HALF_PI },
    { x: 4.6, z: 7.4, yaw: HALF_PI },
  ],
  walkers: 4,
  graph: {
    nodes: [
      [0, 10.4],
      [0, 6],
      [-4.6, 6],
      [4.6, 6],
      [-4.6, -3.2],
      [4.6, -3.2],
      [-3.2, -7.3],
      [3.2, -7.3],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 6],
      [5, 7],
      [6, 7],
    ],
  },
};

const ROOF_CROWD: CrowdSpec = {
  spots: [
    ...[0, 1.35, 2.7, 4.05].flatMap((z) => [
      { x: -8.4, z, yaw: HALF_PI, seat: 0.46 },
      { x: -3.6, z, yaw: -HALF_PI, seat: 0.46 },
    ]),
    { x: -7.5, z: -1.5, yaw: 0.3 },
    { x: 7.8, z: -3.75, yaw: Math.PI },
    { x: 9.3, z: -3.75, yaw: Math.PI },
    { x: 3.6, z: 7.05, yaw: Math.PI, seat: 0.45 },
    { x: 5.2, z: 7.05, yaw: Math.PI, seat: 0.45 },
    { x: 2.85, z: 4.6, yaw: HALF_PI, seat: 0.45 },
    { x: 2.85, z: 5.9, yaw: HALF_PI, seat: 0.45 },
    ...[2.2, 8.2].flatMap((z) => [
      { x: 7.5, z, yaw: HALF_PI, seat: 0.62 },
      { x: 9.3, z, yaw: -HALF_PI, seat: 0.62 },
    ]),
  ],
  walkers: 3,
  graph: {
    nodes: [
      [-3.2, -5.8],
      [3.2, -5.8],
      [0, -4.5],
      [-1.4, 2],
      [1, 9.6],
      [6.8, 3.4],
      [6, -2.5],
      [6.8, 9.6],
    ],
    edges: [
      [0, 2],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 7],
      [7, 5],
      [5, 6],
      [6, 1],
      [6, 2],
      [3, 5],
    ],
  },
};

export const c = (hex: string) => new THREE.Color(hex);

/** Multi-floor office tower: lobby, open-plan work floors, and a rooftop conference and break deck. */
export function buildOfficeTower(building: Building, getState: () => CityState | null = () => null): VenueInterior {
  const bucket: Bucket = [];
  const screen = makeConferenceScreen(bucket, 2.1, 1.18, getState, building.name);
  const root = new THREE.Group();
  const floorCount = Math.min(MAX_FLOORS, Math.max(MIN_FLOORS, building.floors));
  const roofIndex = floorCount;
  const deskIndex = Math.min(floorCount - 1, Math.max(1, Math.round(floorCount / 2) - 1));
  const floors = Array.from({ length: floorCount + 1 }, (_, i) =>
    i === 0 ? "Lobby" : i === roofIndex ? "Roof" : String(i + 1),
  );

  const lobby = buildLobby(building, bucket);
  const work = buildWorkFloor(bucket);
  const roof = buildRoof(building, bucket, screen);
  root.add(lobby.group, work.group, roof.group);

  const seed = [...building.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
  const kit = new StaffKit(bucket);
  const lobbyCrowd = new OfficeCrowd(lobby.group, kit, LOBBY_CROWD, seed + 1);
  const workCrowd = new OfficeCrowd(work.group, kit, WORK_CROWD, seed + 2);
  const roofCrowd = new OfficeCrowd(roof.group, kit, ROOF_CROWD, seed + 3);
  const minuteNow = () => getState()?.clock.minuteOfDay ?? 12 * 60;
  const busyNow = () => Math.round(officeBusyness(minuteNow()) * 25) / 25;
  let busy = busyNow();
  const janitorFloors = [deskIndex, Math.abs(seed) % (roofIndex + 1)];
  let janitorTimer = 30;

  const blockers: Blocker[] = [];
  let current = 0;
  const layoutFor = (index: number): Layout => (index === 0 ? lobby : index === roofIndex ? roof : work);
  const crowdFor = (index: number) => (index === 0 ? lobbyCrowd : index === roofIndex ? roofCrowd : workCrowd);
  const refreshStaff = () => {
    const janitors = isAfterHours(busy) ? janitorFloors.filter((f) => f === current).length : 0;
    crowdFor(current).apply(seed + current * 101, busy, janitors, current === deskIndex);
  };
  const show = (index: number) => {
    current = Math.min(roofIndex, Math.max(0, Math.round(index)));
    const layout = layoutFor(current);
    lobby.group.visible = layout === lobby;
    work.group.visible = layout === work;
    roof.group.visible = layout === roof;
    blockers.length = 0;
    blockers.push(...layout.blockers);
    if (layout === work) {
      work.floorSign.draw(`FLOOR ${current + 1}`, current === deskIndex ? "Your desk is on this floor" : building.name);
      work.deskSign.mesh.visible = current === deskIndex;
    }
    refreshStaff();
    return layout;
  };
  show(0);

  const elevator: OfficeElevator = {
    floors,
    deskFloor: deskIndex,
    current: () => current,
    isRoof: (index) => index === roofIndex,
    near: (x, z) => {
      const { doorZ } = layoutFor(current);
      return z > doorZ - 0.3 && z < doorZ + 2.2 && (Math.abs(x - DOOR_X) < 1.5 || Math.abs(x + DOOR_X) < 1.5);
    },
    goTo: (index) => {
      const layout = show(index);
      return { x: -DOOR_X, z: layout.doorZ + 1.4, yaw: Math.PI };
    },
    view: (index) => {
      const towerHeight = Math.max(1, building.floors) * FLOOR_H;
      if (index <= 0) return null;
      if (index >= roofIndex) return { height: towerHeight, lift: OFFICE_ROOF_DECK };
      return { height: (index / roofIndex) * towerHeight, lift: 0 };
    },
  };

  return {
    group: root,
    blockers,
    spawn: { x: 0, z: 9.2, yaw: 0, pitch: -0.04 },
    bounds: { minX: MIN_X, maxX: MAX_X, minZ: MIN_Z, maxZ: MAX_Z },
    groundAt: () => 0,
    nearDesk: (x, z) => current === deskIndex && x > -4.2 && x < 3.2 && z > -0.9 && z < 5.2,
    nearExit: (x, z) => current === 0 && z > 9.6 && Math.abs(x) < 2.6,
    elevator,
    update: (dt) => {
      const nextBusy = busyNow();
      let changed = nextBusy !== busy;
      busy = nextBusy;
      janitorTimer -= dt;
      if (janitorTimer <= 0) {
        janitorTimer = 45 + Math.random() * 45;
        const i = Math.random() < 0.5 ? 0 : 1;
        if (janitorFloors[i] !== current) {
          janitorFloors[i] = Math.floor(Math.random() * (roofIndex + 1));
          changed ||= janitorFloors[i] === current;
        }
      }
      if (changed) refreshStaff();
      crowdFor(current).update(dt);
      if (current === roofIndex) screen.update(dt);
    },
    dispose: () => {
      for (const item of bucket) item.dispose();
    },
  };
}

export function builders() {
  return { floorB: new MeshBuilder(), wallB: new MeshBuilder(), trimB: new MeshBuilder() };
}

export function shell(
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  blockers: Blocker[],
  floor: THREE.Color,
  wall: THREE.Color,
  withDoor: boolean,
  glazed = false,
) {
  floorB.ground(MIN_X, MIN_Z, MAX_X, MAX_Z, 0, floor);
  floorB.quad(
    { x: MIN_X, y: CEIL, z: MIN_Z },
    { x: MAX_X, y: CEIL, z: MIN_Z },
    { x: MAX_X, y: CEIL, z: MAX_Z },
    { x: MIN_X, y: CEIL, z: MAX_Z },
    wall,
  );
  for (const [x0, x1] of [
    [MIN_X, MIN_X + WALL_T],
    [MAX_X - WALL_T, MAX_X],
  ]) {
    if (!glazed) {
      wallB.box(x0, MIN_Z, x1, MAX_Z, 0, CEIL, wall);
      continue;
    }
    wallB.box(x0, MIN_Z, x1, WIN_Z0, 0, CEIL, wall);
    wallB.box(x0, WIN_Z1, x1, MAX_Z, 0, CEIL, wall);
    wallB.box(x0, WIN_Z0, x1, WIN_Z1, 0, SILL, wall);
    wallB.box(x0, WIN_Z0, x1, WIN_Z1, HEAD, CEIL, wall);
  }
  wallB.box(MIN_X, MIN_Z, MAX_X, MIN_Z + WALL_T, 0, CEIL, wall);
  blockers.push({ minX: MIN_X, maxX: MIN_X + WALL_T, minZ: MIN_Z, maxZ: MAX_Z });
  blockers.push({ minX: MAX_X - WALL_T, maxX: MAX_X, minZ: MIN_Z, maxZ: MAX_Z });
  blockers.push({ minX: MIN_X, maxX: MAX_X, minZ: MIN_Z, maxZ: MIN_Z + WALL_T });
  if (withDoor) {
    wallB.box(MIN_X, MAX_Z - WALL_T, -2.2, MAX_Z, 0, CEIL, wall);
    wallB.box(2.2, MAX_Z - WALL_T, MAX_X, MAX_Z, 0, CEIL, wall);
    wallB.box(-2.2, MAX_Z - WALL_T, 2.2, MAX_Z, 2.6, CEIL, wall);
    blockers.push({ minX: MIN_X, maxX: -2.2, minZ: MAX_Z - WALL_T, maxZ: MAX_Z });
    blockers.push({ minX: 2.2, maxX: MAX_X, minZ: MAX_Z - WALL_T, maxZ: MAX_Z });
  } else if (glazed) {
    wallB.box(MIN_X, MAX_Z - WALL_T, WIN_X0, MAX_Z, 0, CEIL, wall);
    wallB.box(WIN_X1, MAX_Z - WALL_T, MAX_X, MAX_Z, 0, CEIL, wall);
    wallB.box(WIN_X0, MAX_Z - WALL_T, WIN_X1, MAX_Z, 0, SILL, wall);
    wallB.box(WIN_X0, MAX_Z - WALL_T, WIN_X1, MAX_Z, HEAD, CEIL, wall);
    blockers.push({ minX: MIN_X, maxX: MAX_X, minZ: MAX_Z - WALL_T, maxZ: MAX_Z });
  } else {
    wallB.box(MIN_X, MAX_Z - WALL_T, MAX_X, MAX_Z, 0, CEIL, wall);
    blockers.push({ minX: MIN_X, maxX: MAX_X, minZ: MAX_Z - WALL_T, maxZ: MAX_Z });
  }
}

/** Clear panes and mullions filling the window openings that `shell(..., glazed)` leaves. */
export function windows(group: THREE.Group, wallB: MeshBuilder, bucket: Bucket) {
  const glassB = new MeshBuilder();
  const glass = c("#bcdcee");
  const mullion = c("#5d6670");
  for (const [x0, x1] of [
    [MIN_X, MIN_X + WALL_T],
    [MAX_X - WALL_T, MAX_X],
  ]) {
    const mid = (x0 + x1) / 2;
    glassB.box(mid - 0.02, WIN_Z0, mid + 0.02, WIN_Z1, SILL, HEAD, glass);
    const step = (WIN_Z1 - WIN_Z0) / 7;
    for (let i = 0; i <= 7; i++) {
      const z = WIN_Z0 + i * step;
      wallB.box(x0 - 0.02, z - 0.07, x1 + 0.02, z + 0.07, SILL, HEAD, mullion);
    }
    wallB.box(x0 - 0.02, WIN_Z0, x1 + 0.02, WIN_Z1, SILL - 0.06, SILL, mullion);
  }
  const zMid = MAX_Z - WALL_T / 2;
  glassB.box(WIN_X0, zMid - 0.02, WIN_X1, zMid + 0.02, SILL, HEAD, glass);
  const step = (WIN_X1 - WIN_X0) / 6;
  for (let i = 0; i <= 6; i++) {
    const x = WIN_X0 + i * step;
    wallB.box(x - 0.07, MAX_Z - WALL_T - 0.02, x + 0.07, MAX_Z + 0.02, SILL, HEAD, mullion);
  }
  wallB.box(WIN_X0, MAX_Z - WALL_T - 0.02, WIN_X1, MAX_Z + 0.02, SILL - 0.06, SILL, mullion);

  const geometry = glassB.build();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.14,
    roughness: 0.05,
    metalness: 0.2,
    depthWrite: false,
  });
  const pane = new THREE.Mesh(geometry, material);
  pane.renderOrder = 2;
  group.add(pane);
  bucket.push(geometry, material);
}

/** Twin elevator doors on a wall face that looks toward +z. */
export function elevatorDoors(wallB: MeshBuilder, trimB: MeshBuilder, faceZ: number) {
  const gold = c("#c9a44c");
  const steel = c("#b9c3cc");
  const lamp = c("#ffb347");
  for (const x of [-DOOR_X, DOOR_X]) {
    trimB.box(x - 1.25, faceZ, x + 1.25, faceZ + 0.12, 0, 2.95, gold);
    wallB.box(x - 1.0, faceZ + 0.1, x - 0.03, faceZ + 0.18, 0.02, 2.7, steel);
    wallB.box(x + 0.03, faceZ + 0.1, x + 1.0, faceZ + 0.18, 0.02, 2.7, steel);
    trimB.box(x - 0.2, faceZ + 0.1, x + 0.2, faceZ + 0.16, 3.02, 3.24, lamp);
  }
  trimB.box(-0.16, faceZ, 0.16, faceZ + 0.12, 1.05, 1.55, steel);
  trimB.box(-0.07, faceZ + 0.1, 0.07, faceZ + 0.15, 1.34, 1.46, lamp);
}

export function plant(wallB: MeshBuilder, blockers: Blocker[], x: number, z: number) {
  wallB.box(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 0, 0.6, c("#3a3a3a"));
  wallB.box(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.6, 1.8, c("#3f7a4a"));
  blockers.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
}

export function makeSign(bucket: Bucket, width: number, height: number, bg: string, fg: string): Sign {
  const el = document.createElement("canvas");
  el.width = 512;
  el.height = Math.max(64, Math.round((512 * height) / width));
  const ctx = el.getContext("2d");
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (title: string, subtitle = "") => {
    if (!ctx) return;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, el.width, el.height);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const big = el.height * (subtitle ? 0.4 : 0.52);
    ctx.font = `bold ${big}px sans-serif`;
    let size = big;
    while (ctx.measureText(title).width > el.width * 0.92 && size > 12) {
      size -= 2;
      ctx.font = `bold ${size}px sans-serif`;
    }
    ctx.fillText(title, el.width / 2, subtitle ? el.height * 0.4 : el.height / 2);
    if (subtitle) {
      ctx.font = `${el.height * 0.2}px sans-serif`;
      ctx.globalAlpha = 0.8;
      ctx.fillText(subtitle, el.width / 2, el.height * 0.76);
      ctx.globalAlpha = 1;
    }
    tex.needsUpdate = true;
  };
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.35,
  });
  const geo = new THREE.PlaneGeometry(width, height);
  bucket.push(tex, mat, geo);
  return { mesh: new THREE.Mesh(geo, mat), draw };
}

function buildLobby(building: Building, bucket: Bucket): Layout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, c("#d9d4cb"), c("#eef1f4"), true);
  const wood = c("#6b4a32");
  const gold = c("#c9a44c");
  const fabric = c("#2f4a6a");
  const faceZ = MIN_Z + WALL_T;

  elevatorDoors(wallB, trimB, faceZ);
  floorB.ground(-2, 9.4, 2, 11.5, 0.01, c("#3a3f46"));
  floorB.ground(-6, faceZ, 6, faceZ + 2.4, 0.01, c("#c8c1b5"));

  wallB.box(-2.8, -1.6, 2.8, -0.6, 0, 1.1, wood);
  trimB.box(-2.9, -1.7, 2.9, -0.5, 1.1, 1.18, gold);
  blockers.push({ minX: -2.9, maxX: 2.9, minZ: -1.7, maxZ: -0.5 });

  for (const x0 of [-10.3, 7.3]) {
    const x1 = x0 + 3;
    wallB.box(x0, 3, x1, 4.1, 0, 0.45, fabric);
    wallB.box(x0, 4.1, x1, 4.5, 0, 0.95, fabric);
    wallB.box(x0 + 0.6, 1.2, x1 - 0.6, 2.2, 0, 0.4, wood);
    blockers.push({ minX: x0, maxX: x1, minZ: 3, maxZ: 4.5 });
    blockers.push({ minX: x0 + 0.6, maxX: x1 - 0.6, minZ: 1.2, maxZ: 2.2 });
  }
  for (const [x, z] of [
    [-9.8, 10.6],
    [9.8, 10.6],
    [-9.8, -7.6],
    [9.8, -7.6],
  ]) {
    plant(wallB, blockers, x, z);
  }

  const sign = makeSign(bucket, 7, 1.1, "#1f2a36", "#f4efe6");
  sign.draw(building.name, "Lobby · Elevators to every floor and the roof");
  sign.mesh.position.set(0, 3.8, faceZ + 0.02);
  group.add(sign.mesh);

  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ };
}

function buildWorkFloor(bucket: Bucket): Layout & { floorSign: Sign; deskSign: Sign } {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, c("#5f6b78"), c("#e4e8ec"), false, true);
  windows(group, wallB, bucket);
  const desk = c("#d7d2c8");
  const divider = c("#7d8a96");
  const screen = c("#1c2128");
  const gold = c("#c9a44c");
  const faceZ = MIN_Z + WALL_T;

  elevatorDoors(wallB, trimB, faceZ);

  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 2; row++) {
      const x = -8.6 + col * 5.8;
      const z = 0.4 + row * 4.2;
      wallB.box(x, z, x + 4.6, z + 3.4, 0, 0.76, desk);
      wallB.box(x, z + 1.65, x + 4.6, z + 1.75, 0.76, 1.3, divider);
      for (const mx of [x + 1.15, x + 3.45]) {
        for (const mz of [z + 1.25, z + 2.15]) {
          wallB.box(mx - 0.42, mz - 0.04, mx + 0.42, mz + 0.04, 0.95, 1.45, screen);
        }
      }
      blockers.push({ minX: x, maxX: x + 4.6, minZ: z, maxZ: z + 3.4 });
    }
  }
  trimB.box(-1.4, 0.3, 0.4, 0.42, 0.76, 0.95, gold);

  wallB.box(8.6, -7.6, 9.8, -6.6, 0, 1.3, c("#d5d9de"));
  blockers.push({ minX: 8.6, maxX: 9.8, minZ: -7.6, maxZ: -6.6 });
  wallB.box(-9.9, -7.8, -8.3, -6.6, 0, 1.1, c("#c4c9cf"));
  blockers.push({ minX: -9.9, maxX: -8.3, minZ: -7.8, maxZ: -6.6 });
  plant(wallB, blockers, -9.8, 10.4);
  plant(wallB, blockers, 9.8, 10.4);

  const floorSign = makeSign(bucket, 3.4, 0.9, "#1f2a36", "#f4efe6");
  floorSign.mesh.position.set(0, 3.8, faceZ + 0.02);
  group.add(floorSign.mesh);

  const deskSign = makeSign(bucket, 2.4, 0.55, "#c9a44c", "#1a1a1a");
  deskSign.draw("YOUR DESK");
  deskSign.mesh.position.set(-0.5, 2.9, 0.2);
  deskSign.mesh.rotation.y = Math.PI;
  group.add(deskSign.mesh);

  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ, floorSign, deskSign };
}

function buildRoof(building: Building, bucket: Bucket, screen: ConferenceScreen): Layout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  const pavers = c("#9a968e");
  const deck = c("#8a6a4a");
  const wood = c("#7a5638");
  const white = c("#f1efe9");
  const dark = c("#2a2f36");
  const steel = c("#c9d0d6");
  const fabric = c("#35536f");
  const green = c("#3f7a4a");
  const umbrella = c("#c0392b");
  const house = c("#d9dde2");

  floorB.ground(MIN_X, MIN_Z, MAX_X, MAX_Z, 0, pavers);
  floorB.ground(-10.4, -3.6, -1.4, 6.8, 0.01, deck);
  floorB.ground(1.6, 1, 10.4, 10.4, 0.01, deck);
  wallB.walls(MIN_X, MIN_Z, MAX_X, MAX_Z, -OFFICE_ROOF_DECK * 4, 0, c("#c9c4ba"));

  const glass = c("#a9d3ea");
  trimB.box(MIN_X, MIN_Z, MIN_X + 0.06, MAX_Z, 0, 1.1, glass);
  trimB.box(MAX_X - 0.06, MIN_Z, MAX_X, MAX_Z, 0, 1.1, glass);
  trimB.box(MIN_X, MAX_Z - 0.06, MAX_X, MAX_Z, 0, 1.1, glass);
  trimB.box(MIN_X, MIN_Z, MAX_X, MIN_Z + 0.06, 0, 1.1, glass);
  wallB.box(MIN_X - 0.03, MIN_Z, MIN_X + 0.09, MAX_Z, 1.1, 1.18, steel);
  wallB.box(MAX_X - 0.09, MIN_Z, MAX_X + 0.03, MAX_Z, 1.1, 1.18, steel);
  wallB.box(MIN_X, MAX_Z - 0.09, MAX_X, MAX_Z + 0.03, 1.1, 1.18, steel);
  wallB.box(MIN_X, MIN_Z - 0.03, MAX_X, MIN_Z + 0.09, 1.1, 1.18, steel);

  const faceZ = -6.8;
  wallB.box(-6, MIN_Z, 6, faceZ, 0, 3.4, house);
  wallB.box(-6.2, MIN_Z, 6.2, faceZ + 0.2, 3.4, 3.62, c(building.accentColor));
  blockers.push({ minX: -6, maxX: 6, minZ: MIN_Z, maxZ: faceZ });
  elevatorDoors(wallB, trimB, faceZ);
  const sign = makeSign(bucket, 4.4, 0.8, "#1f2a36", "#f4efe6");
  sign.draw("ROOF DECK", building.name);
  sign.mesh.position.set(0, 4.15, faceZ + 0.1);
  group.add(sign.mesh);

  wallB.box(-0.55, -0.55, 0.55, 0.55, 0, 2.4, house);
  trimB.box(-0.3, -0.3, 0.3, 0.3, 2.4, 6, steel);
  blockers.push({ minX: -0.55, maxX: 0.55, minZ: -0.55, maxZ: 0.55 });

  // Conference pergola.
  for (const [px, pz] of [
    [-10, -3],
    [-2, -3],
    [-10, 6],
    [-2, 6],
  ]) {
    wallB.box(px - 0.15, pz - 0.15, px + 0.15, pz + 0.15, 0, 2.9, wood);
    blockers.push({ minX: px - 0.15, maxX: px + 0.15, minZ: pz - 0.15, maxZ: pz + 0.15 });
  }
  wallB.box(-10.15, -3.15, -1.85, -2.85, 2.8, 3.0, wood);
  wallB.box(-10.15, 5.85, -1.85, 6.15, 2.8, 3.0, wood);
  for (let z = -3; z <= 6; z += 0.9) {
    wallB.box(-10.15, z - 0.06, -1.85, z + 0.06, 3.0, 3.12, wood);
  }
  wallB.box(-7.6, -0.6, -4.4, 4.6, 0.72, 0.8, white);
  wallB.box(-6.3, 0.6, -5.7, 3.4, 0, 0.72, dark);
  blockers.push({ minX: -7.6, maxX: -4.4, minZ: -0.6, maxZ: 4.6 });
  for (const z of [0, 1.35, 2.7, 4.05]) {
    for (const [sx, back] of [
      [-8.4, -8.75],
      [-3.6, -3.25],
    ]) {
      wallB.box(sx - 0.28, z - 0.28, sx + 0.28, z + 0.28, 0, 0.46, dark);
      wallB.box(back - 0.07, z - 0.28, back + 0.07, z + 0.28, 0.46, 1.0, dark);
      blockers.push({ minX: sx - 0.3, maxX: sx + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }
  }
  wallB.box(-6.1, -2.35, -5.9, -2.25, 0, 1.2, dark);
  wallB.box(-7.1, -2.42, -4.9, -2.3, 1.2, 2.5, c("#1b2530"));
  blockers.push({ minX: -7.1, maxX: -4.9, minZ: -2.45, maxZ: -2.2 });
  const front = screen.makeMesh();
  front.position.set(-6, 1.85, -2.29);
  group.add(front);

  // Break area: coffee bar, lounge, umbrella tables.
  wallB.box(6.4, -5.6, 10.3, -4.4, 0, 1.05, wood);
  wallB.box(6.3, -5.7, 10.4, -4.3, 1.05, 1.12, white);
  wallB.box(7, -5.3, 7.6, -4.8, 1.12, 1.6, steel);
  wallB.box(8.2, -5.3, 8.5, -4.9, 1.12, 1.3, c("#8b3a22"));
  wallB.box(8.7, -5.3, 9.0, -4.9, 1.12, 1.3, white);
  blockers.push({ minX: 6.3, maxX: 10.4, minZ: -5.7, maxZ: -4.3 });

  wallB.box(2.4, 6.6, 6.4, 7.5, 0, 0.45, fabric);
  wallB.box(2.4, 7.5, 6.4, 7.9, 0, 0.95, fabric);
  wallB.box(2.4, 3.6, 3.3, 6.6, 0, 0.45, fabric);
  wallB.box(2.0, 3.6, 2.4, 7.9, 0, 0.95, fabric);
  wallB.box(3.9, 4.4, 5.6, 5.8, 0, 0.4, wood);
  blockers.push({ minX: 2.0, maxX: 6.4, minZ: 6.6, maxZ: 7.9 });
  blockers.push({ minX: 2.0, maxX: 3.3, minZ: 3.6, maxZ: 6.6 });
  blockers.push({ minX: 3.9, maxX: 5.6, minZ: 4.4, maxZ: 5.8 });

  for (const [x, z] of [
    [8.4, 2.2],
    [8.4, 8.2],
  ]) {
    wallB.box(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.7, 0.76, white);
    wallB.box(x - 0.05, z - 0.05, x + 0.05, z + 0.05, 0, 2.6, steel);
    trimB.box(x - 1.3, z - 1.3, x + 1.3, z + 1.3, 2.5, 2.62, umbrella);
    for (const dx of [-0.9, 0.9]) {
      wallB.box(x + dx - 0.2, z - 0.2, x + dx + 0.2, z + 0.2, 0, 0.62, dark);
    }
    blockers.push({ minX: x - 1.1, maxX: x + 1.1, minZ: z - 0.5, maxZ: z + 0.5 });
  }

  for (const x of [-9, -5, 5]) {
    wallB.box(x - 1.2, 10.6, x + 1.2, 11.5, 0, 0.7, c("#5a5047"));
    wallB.box(x - 1.1, 10.7, x + 1.1, 11.4, 0.7, 1.25, green);
    blockers.push({ minX: x - 1.2, maxX: x + 1.2, minZ: 10.6, maxZ: 11.5 });
  }

  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ };
}

export function assemble(group: THREE.Group, floorB: MeshBuilder, wallB: MeshBuilder, trimB: MeshBuilder, bucket: Bucket) {
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
    bucket.push(geometry, material);
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
