import * as THREE from "three";
import { HOSPITAL_DESK_FLOOR, HOSPITAL_LEVELS, type DoctorCase } from "@/lib/city/doctor";
import type { Building, CityState } from "@/lib/city/types";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";
import {
  assemble,
  builders,
  c,
  CEIL,
  DOOR_X,
  elevatorDoors,
  makeSign,
  MAX_X,
  MAX_Z,
  MIN_X,
  MIN_Z,
  OFFICE_ROOF_DECK,
  plant,
  shell,
  WALL_T,
  windows,
  type Bucket,
  type Layout,
  type OfficeElevator,
  type Sign,
} from "./officeInterior";
import { OfficeCrowd, StaffKit, type CrowdSpec, type StaffSpot } from "./officeStaff";
import { FLOOR_H } from "./textures";
import type { VenueInterior } from "./venueInterior";

const MATTRESS = 0.58;
const BED_LEN = 2.16;
const BED_WID = 0.92;
const WALL_H_KNEE = 1.08;
const WALL_H_HEAD = 2.42;
const T = 0.16;

const FLOOR = c("#e8eef2");
const WALL = c("#f4f7f8");
const TEAL = c("#2aa3a0");
const WHITE = c("#f7f4ee");
const STEEL = c("#b9c3cc");
const RED = c("#c0392b");
const WOOD = c("#6b4a32");

type Head = "x+" | "x-" | "z+" | "z-";
type Edge = "x0" | "x1" | "z0" | "z1";
type PropKind = "monitor" | "iv" | "toys" | "eeg" | "crutch" | "vent";

interface BedSpot {
  x: number;
  z: number;
  head: Head;
}

interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

interface FloorLayout extends Layout {
  beds: BedSpot[];
  floorSign: Sign;
  caseMarker: THREE.Object3D;
  crowd: OfficeCrowd;
  /** Set on the roof so the helicopter rotors keep turning. */
  rotors?: { main: THREE.Object3D; tail: THREE.Object3D };
}

interface WardStyle {
  title: string;
  wall: string;
  floor: string;
  accent: string;
  blanket: string;
  blanketAlt?: string;
  prop: PropKind;
  gallery: "chairs" | "toys" | "bars" | "quiet" | "supplies";
}

function headDir(head: Head) {
  if (head === "x+") return { x: 1, z: 0 };
  if (head === "x-") return { x: -1, z: 0 };
  if (head === "z+") return { x: 0, z: 1 };
  return { x: 0, z: -1 };
}

/** Root sits near the foot; local -z (the head) points at the headboard. */
function patientSpot(bed: BedSpot): StaffSpot {
  const d = headDir(bed.head);
  return {
    x: bed.x - d.x * 0.88,
    z: bed.z - d.z * 0.88,
    yaw: Math.atan2(-d.x, -d.z),
    lie: MATTRESS,
    role: "always",
    uniform: "gown",
  };
}

function bedBlock(bed: BedSpot): Blocker {
  const alongX = bed.head === "x+" || bed.head === "x-";
  const hx = alongX ? BED_LEN / 2 + 0.05 : BED_WID / 2 + 0.08;
  const hz = alongX ? BED_WID / 2 + 0.08 : BED_LEN / 2 + 0.05;
  return { minX: bed.x - hx, maxX: bed.x + hx, minZ: bed.z - hz, maxZ: bed.z + hz };
}

function drawBed(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  bed: BedSpot,
  blanket: THREE.Color,
  prop: PropKind,
  drape = false,
) {
  const d = headDir(bed.head);
  const alongX = d.x !== 0;
  const wid = drape ? 0.72 : BED_WID;
  const hx = alongX ? BED_LEN / 2 : wid / 2;
  const hz = alongX ? wid / 2 : BED_LEN / 2;
  const perp = { x: -d.z, z: d.x };

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wx = bed.x + (alongX ? sx * (hx - 0.12) : sx * (hx - 0.08));
      const wz = bed.z + (alongX ? sz * (hz - 0.08) : sz * (hz - 0.12));
      wallB.box(wx - 0.06, wz - 0.06, wx + 0.06, wz + 0.06, 0, 0.14, STEEL);
    }
  }
  wallB.box(bed.x - hx, bed.z - hz, bed.x + hx, bed.z + hz, 0.14, 0.4, STEEL);
  trimB.box(bed.x - hx + 0.04, bed.z - hz + 0.04, bed.x + hx - 0.04, bed.z + hz - 0.04, 0.4, MATTRESS, WHITE);

  const headX = bed.x + d.x * (alongX ? hx - 0.04 : 0);
  const headZ = bed.z + d.z * (alongX ? 0 : hz - 0.04);
  const boardW = alongX ? 0.08 : wid / 2 + 0.06;
  const boardD = alongX ? wid / 2 + 0.06 : 0.08;
  wallB.box(headX - boardW, headZ - boardD, headX + boardW, headZ + boardD, 0.4, 1.05, STEEL);

  const footX = bed.x - d.x * (alongX ? hx - 0.06 : 0);
  const footZ = bed.z - d.z * (alongX ? 0 : hz - 0.06);
  wallB.box(footX - boardW * 0.7, footZ - boardD * 0.7, footX + boardW * 0.7, footZ + boardD * 0.7, 0.4, 0.72, STEEL);

  const railLen = alongX ? hx * 0.7 : 0.05;
  const railWid = alongX ? 0.05 : hz * 0.7;
  for (const side of [-1, 1]) {
    const rx = bed.x + perp.x * side * (wid / 2);
    const rz = bed.z + perp.z * side * (wid / 2);
    trimB.box(rx - railLen, rz - railWid, rx + railLen, rz + railWid, MATTRESS, MATTRESS + 0.16, STEEL);
  }

  const px = bed.x + d.x * 0.78;
  const pz = bed.z + d.z * 0.78;
  const pL = alongX ? 0.22 : 0.32;
  const pW = alongX ? 0.32 : 0.22;
  trimB.box(px - pL, pz - pW, px + pL, pz + pW, MATTRESS, MATTRESS + 0.1, c("#ffffff"));

  const cover = drape ? 0.55 : 0.32;
  const bx = bed.x - d.x * cover;
  const bz = bed.z - d.z * cover;
  const bL = alongX ? (drape ? 0.85 : 0.62) : wid / 2 - 0.06;
  const bW = alongX ? wid / 2 - 0.06 : drape ? 0.85 : 0.62;
  trimB.box(bx - bL, bz - bW, bx + bL, bz + bW, MATTRESS - 0.01, MATTRESS + (drape ? 0.14 : 0.12), blanket);

  const propX = bed.x + d.x * 0.55 + perp.x * (wid / 2 + 0.28);
  const propZ = bed.z + d.z * 0.55 + perp.z * (wid / 2 + 0.28);
  if (prop === "monitor" || prop === "vent" || prop === "eeg") {
    const screen = prop === "eeg" ? c("#c9b6f2") : c("#3dff9a");
    trimB.box(propX - 0.08, propZ - 0.08, propX + 0.08, propZ + 0.08, 0.7, 1.15, c("#1c242c"));
    trimB.box(propX - 0.16, propZ - 0.05, propX + 0.16, propZ + 0.05, 1.15, 1.48, c("#12171c"));
    trimB.box(propX - 0.13, propZ - 0.02, propX + 0.13, propZ + 0.02, 1.2, 1.42, screen);
    if (prop === "vent") {
      trimB.box(propX - 0.2, propZ - 0.16, propX + 0.2, propZ + 0.16, 0.4, 0.85, c("#dfe6ea"));
    }
  } else if (prop === "iv" || prop === "crutch") {
    trimB.box(propX - 0.04, propZ - 0.04, propX + 0.04, propZ + 0.04, 0, 1.65, STEEL);
    trimB.box(propX - 0.1, propZ - 0.06, propX + 0.1, propZ + 0.06, 1.42, 1.68, c("#e7eef5"));
  }

  blockers.push(bedBlock(bed));
}

function spanWall(
  wallB: MeshBuilder,
  blockers: Blocker[],
  along: "x" | "z",
  thick0: number,
  thick1: number,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  color: THREE.Color,
  gap: { at: number; width: number } | null,
) {
  const parts: Array<[number, number]> = [];
  if (!gap) parts.push([Math.min(a0, a1), Math.max(a0, a1)]);
  else {
    const lo = Math.min(a0, a1);
    const hi = Math.max(a0, a1);
    const g0 = gap.at - gap.width / 2;
    const g1 = gap.at + gap.width / 2;
    if (g0 - lo > 0.08) parts.push([lo, g0]);
    if (hi - g1 > 0.08) parts.push([g1, hi]);
  }
  for (const [s0, s1] of parts) {
    if (along === "x") {
      wallB.box(s0, thick0, s1, thick1, y0, y1, color);
      if (y0 < 0.2) blockers.push({ minX: s0, maxX: s1, minZ: Math.min(thick0, thick1), maxZ: Math.max(thick0, thick1) });
    } else {
      wallB.box(thick0, s0, thick1, s1, y0, y1, color);
      if (y0 < 0.2) blockers.push({ minX: Math.min(thick0, thick1), maxX: Math.max(thick0, thick1), minZ: s0, maxZ: s1 });
    }
  }
  if (gap && y1 > WALL_H_HEAD + 0.2) {
    const g0 = gap.at - gap.width / 2;
    const g1 = gap.at + gap.width / 2;
    if (along === "x") wallB.box(g0, thick0, g1, thick1, WALL_H_HEAD, y1, color);
    else wallB.box(thick0, g0, thick1, g1, WALL_H_HEAD, y1, color);
  }
}

/** Solid partitions, plus a hallway face with a door and a sill you can see over. */
function addRoom(
  wallB: MeshBuilder,
  blockers: Blocker[],
  rect: Rect,
  wallColor: THREE.Color,
  hallColor: THREE.Color,
  door: Edge,
  skip: Edge[] = [],
) {
  const edges: Edge[] = ["x0", "x1", "z0", "z1"];
  for (const edge of edges) {
    if (skip.includes(edge)) continue;
    const hallway = edge === door;
    const color = hallway ? hallColor : wallColor;
    const gap = hallway
      ? {
          at: edge === "x0" || edge === "x1" ? (rect.z0 + rect.z1) / 2 : (rect.x0 + rect.x1) / 2,
          width: 1.45,
        }
      : null;
    const y0 = hallway ? 0 : 0;
    const mid = hallway ? WALL_H_KNEE : CEIL;
    if (edge === "x0") spanWall(wallB, blockers, "z", rect.x0, rect.x0 + T, rect.z0, rect.z1, y0, mid, color, gap);
    if (edge === "x1") spanWall(wallB, blockers, "z", rect.x1 - T, rect.x1, rect.z0, rect.z1, y0, mid, color, gap);
    if (edge === "z0") spanWall(wallB, blockers, "x", rect.z0, rect.z0 + T, rect.x0, rect.x1, y0, mid, color, gap);
    if (edge === "z1") spanWall(wallB, blockers, "x", rect.z1 - T, rect.z1, rect.x0, rect.x1, y0, mid, color, gap);
    if (!hallway) continue;
    if (edge === "x0") spanWall(wallB, blockers, "z", rect.x0, rect.x0 + T, rect.z0, rect.z1, WALL_H_HEAD, CEIL, color, gap);
    if (edge === "x1") spanWall(wallB, blockers, "z", rect.x1 - T, rect.x1, rect.z0, rect.z1, WALL_H_HEAD, CEIL, color, gap);
    if (edge === "z0") spanWall(wallB, blockers, "x", rect.z0, rect.z0 + T, rect.x0, rect.x1, WALL_H_HEAD, CEIL, color, gap);
    if (edge === "z1") spanWall(wallB, blockers, "x", rect.z1 - T, rect.z1, rect.x0, rect.x1, WALL_H_HEAD, CEIL, color, gap);
    const step = edge === "x0" || edge === "x1" ? (rect.z1 - rect.z0) / 4 : (rect.x1 - rect.x0) / 4;
    const doorAt = gap?.at ?? 0;
    const doorW = (gap?.width ?? 0) / 2 + 0.15;
    for (let i = 1; i < 4; i++) {
      if (edge === "x0" || edge === "x1") {
        const z = rect.z0 + i * step;
        if (Math.abs(z - doorAt) < doorW) continue;
        const x0 = edge === "x0" ? rect.x0 : rect.x1 - T;
        wallB.box(x0, z - 0.04, x0 + T, z + 0.04, WALL_H_KNEE, WALL_H_HEAD, color);
      } else {
        const x = rect.x0 + i * step;
        if (Math.abs(x - doorAt) < doorW) continue;
        const z0 = edge === "z0" ? rect.z0 : rect.z1 - T;
        wallB.box(x - 0.04, z0, x + 0.04, z0 + T, WALL_H_KNEE, WALL_H_HEAD, color);
      }
    }
  }
}

function roomPlate(bucket: Bucket, group: THREE.Group, label: string, x: number, z: number, yaw: number) {
  const sign = makeSign(bucket, 0.7, 0.28, "#14343a", "#e7f6f4");
  sign.draw(label);
  sign.mesh.position.set(x, 1.55, z);
  sign.mesh.rotation.y = yaw;
  group.add(sign.mesh);
}

function hallGraph(): CrowdSpec["graph"] {
  return {
    nodes: [
      [0, 9.2],
      [0, 6.4],
      [0, 2.2],
      [0, -1.6],
      [0, -4.6],
      [0, -7.35],
      [-3.4, -7.55],
      [3.4, -7.55],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [5, 7],
    ],
  };
}

function caseMarkerMesh(bucket: Bucket) {
  const group = new THREE.Group();
  const geoH = new THREE.BoxGeometry(0.62, 0.14, 0.08);
  const geoV = new THREE.BoxGeometry(0.14, 0.62, 0.08);
  const mat = new THREE.MeshStandardMaterial({
    color: "#c0392b",
    emissive: "#c0392b",
    emissiveIntensity: 0.9,
    roughness: 0.35,
  });
  bucket.push(geoH, geoV, mat);
  group.add(new THREE.Mesh(geoH, mat), new THREE.Mesh(geoV, mat));
  group.visible = false;
  return group;
}

function placeCaseMarker(marker: THREE.Object3D, bed: BedSpot | null) {
  if (!bed) {
    marker.visible = false;
    return;
  }
  const d = headDir(bed.head);
  marker.visible = true;
  marker.position.set(bed.x - d.x * 0.15, 2.05, bed.z - d.z * 0.15);
}

function pair(side: "L" | "R", rect: Rect): BedSpot[] {
  const x = side === "L" ? -6.55 : 6.55;
  const head: Head = side === "L" ? "x-" : "x+";
  const span = rect.z1 - rect.z0;
  return [
    { x, z: rect.z0 + span * 0.3, head },
    { x, z: rect.z0 + span * 0.72, head },
  ];
}

const LEFT_S: Rect = { x0: -10.5, z0: -6.05, x1: -1.85, z1: 0 };
const LEFT_N: Rect = { x0: -10.5, z0: 0, x1: -1.85, z1: 6.85 };
const RIGHT_S: Rect = { x0: 1.85, z0: -6.05, x1: 10.5, z1: 0 };
const RIGHT_N: Rect = { x0: 1.85, z0: 0, x1: 10.5, z1: 6.85 };
const QUADS: Array<{ rect: Rect; side: "L" | "R"; door: Edge }> = [
  { rect: LEFT_S, side: "L", door: "x1" },
  { rect: LEFT_N, side: "L", door: "x1" },
  { rect: RIGHT_S, side: "R", door: "x0" },
  { rect: RIGHT_N, side: "R", door: "x0" },
];

function plateFor(group: THREE.Group, bucket: Bucket, rect: Rect, door: Edge, label: string) {
  const z = (rect.z0 + rect.z1) / 2 + 0.95;
  if (door === "x1") roomPlate(bucket, group, label, rect.x1 + 0.05, z, Math.PI / 2);
  else roomPlate(bucket, group, label, rect.x0 - 0.05, z, -Math.PI / 2);
}

function galleryBits(
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  style: WardStyle["gallery"],
  accent: THREE.Color,
) {
  if (style === "bars") {
    for (const z of [8.35, 9.15]) {
      trimB.box(-8.4, z - 0.05, -4.2, z + 0.05, 0.82, 0.94, STEEL);
      wallB.box(-8.3, z - 0.08, -8.15, z + 0.08, 0, 0.94, STEEL);
      wallB.box(-4.45, z - 0.08, -4.3, z + 0.08, 0, 0.94, STEEL);
    }
    return;
  }
  if (style === "toys") {
    const colors = ["#e07a3d", "#3aa0d8", "#f2c14e", "#d45d8c"];
    colors.forEach((hex, i) => {
      const x = -8.2 + (i % 2) * 0.7;
      const z = 8.4 + Math.floor(i / 2) * 0.7;
      wallB.box(x, z, x + 0.45, z + 0.45, 0, 0.35 + (i % 3) * 0.12, c(hex));
    });
    return;
  }
  if (style === "supplies") {
    wallB.box(6.2, 8.1, 9.4, 9.6, 0, 1.7, accent);
    blockers.push({ minX: 6.2, maxX: 9.4, minZ: 8.1, maxZ: 9.6 });
    return;
  }
  if (style === "quiet") {
    wallB.box(-9.2, 8.2, -5.4, 9.3, 0, 0.48, c("#6c5b8a"));
    blockers.push({ minX: -9.2, maxX: -5.4, minZ: 8.2, maxZ: 9.3 });
    return;
  }
  wallB.box(-9.4, 8.15, -6.2, 9.2, 0, 0.48, c("#2f4a6a"));
  wallB.box(6.2, 8.15, 9.4, 9.2, 0, 0.48, c("#2f4a6a"));
  blockers.push({ minX: -9.4, maxX: -6.2, minZ: 8.15, maxZ: 9.2 });
  blockers.push({ minX: 6.2, maxX: 9.4, minZ: 8.15, maxZ: 9.2 });
}

function floorDesk(wallB: MeshBuilder, blockers: Blocker[], color: THREE.Color) {
  wallB.box(-9.3, -7.55, -5.5, -6.9, 0, 1.05, color);
  blockers.push({ minX: -9.3, maxX: -5.5, minZ: -7.55, maxZ: -6.9 });
}

function finish(
  group: THREE.Group,
  bucket: Bucket,
  kit: StaffKit,
  floorB: MeshBuilder,
  wallB: MeshBuilder,
  trimB: MeshBuilder,
  blockers: Blocker[],
  beds: BedSpot[],
  extraSpots: StaffSpot[],
  seed: number,
  sign: string,
): FloorLayout {
  const floorSign = makeSign(bucket, 2.8, 0.55, "#14343a", "#e7f6f4");
  floorSign.draw(sign, "");
  floorSign.mesh.position.set(0, 3.15, MIN_Z + WALL_T + 0.14);
  group.add(floorSign.mesh);
  const spots = [...beds.map(patientSpot), ...extraSpots];
  const crowd = new OfficeCrowd(group, kit, { spots, graph: hallGraph(), walkers: 2 }, seed);
  const marker = caseMarkerMesh(bucket);
  group.add(marker);
  addVendingMachine(group, bucket, wallB, blockers);
  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: MIN_Z + WALL_T, beds, floorSign, caseMarker: marker, crowd };
}

/** Same machine on every floor, in the elevator lobby to the right of the doors. */
const VEND_X = 9.15;
const VEND_Z = -7.85;

function addVendingMachine(group: THREE.Group, bucket: Bucket, wallB: MeshBuilder, blockers: Blocker[]) {
  const x0 = VEND_X - 0.58;
  const x1 = VEND_X + 0.58;
  const z0 = VEND_Z - 0.26;
  const z1 = VEND_Z + 0.26;
  wallB.box(x0, z0, x1, z1, 0, 1.95, c("#14161a"));
  wallB.box(x0 - 0.04, z0 - 0.02, x0, z1 + 0.02, 0, 1.95, c("#f4f1ea"));
  wallB.box(x1, z0 - 0.02, x1 + 0.04, z1 + 0.02, 0, 1.95, c("#f4f1ea"));
  const swatches = [
    "#f2c200",
    "#c45c26",
    "#6aaa4a",
    "#f0a020",
    "#e0b15a",
    "#e8a317",
    "#6a3a32",
    "#c47a3a",
    "#e23b6a",
    "#b42318",
    "#d7eef8",
    "#f0a020",
  ];
  for (let row = 0; row < 4; row++) {
    const y = 1.52 - row * 0.3;
    for (let col = 0; col < 3; col++) {
      const cx = VEND_X - 0.34 + col * 0.34;
      wallB.box(cx - 0.12, z1 - 0.02, cx + 0.12, z1 + 0.05, y, y + 0.22, c(swatches[row * 3 + col] ?? "#888"));
    }
  }
  wallB.box(x0 + 0.12, z1 - 0.02, x1 - 0.12, z1 + 0.06, 0.12, 0.38, c("#0c0d10"));
  blockers.push({ minX: x0 - 0.04, maxX: x1 + 0.04, minZ: z0, maxZ: z1 + 0.08 });
  const sign = makeSign(bucket, 1.05, 0.22, "#111111", "#f2c200");
  sign.draw("VENDING", "");
  sign.mesh.position.set(VEND_X, 1.78, z1 + 0.08);
  group.add(sign.mesh);
}

function nearHospitalVending(x: number, z: number) {
  return Math.abs(x - VEND_X) < 1.25 && z > VEND_Z + 0.15 && z < VEND_Z + 1.65;
}

/** Lobby: reception, a closed waiting room, and a triage room with occupied gurneys. */
function buildLobby(building: Building, bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, FLOOR, WALL, true);
  const faceZ = MIN_Z + WALL_T;
  elevatorDoors(wallB, trimB, faceZ);
  floorB.ground(-2, 9.4, 2, 11.5, 0.01, c("#3a3f46"));
  floorB.ground(-1.2, -8.2, 1.2, 11.2, 0.012, c("#d5ebe8"));

  wallB.box(-3.2, -1.8, 3.2, -0.55, 0, 1.12, TEAL);
  trimB.box(-3.3, -1.9, 3.3, -0.45, 1.12, 1.22, STEEL);
  blockers.push({ minX: -3.3, maxX: 3.3, minZ: -1.9, maxZ: -0.45 });

  const cross = makeSign(bucket, 1.4, 1.4, "#ffffff", "#c0392b");
  cross.draw("+");
  cross.mesh.position.set(0, 2.85, -0.42);
  group.add(cross.mesh);
  const title = makeSign(bucket, 5.4, 0.62, "#14343a", "#e7f6f4");
  title.draw(building.name, "Emergency Reception");
  title.mesh.position.set(0, 3.6, faceZ + 0.08);
  group.add(title.mesh);

  const waiting: Rect = { x0: -10.5, z0: 0.4, x1: -4.15, z1: 7.4 };
  const triage: Rect = { x0: 4.15, z0: 0.4, x1: 10.5, z1: 7.4 };
  floorB.ground(waiting.x0 + 0.2, waiting.z0 + 0.2, waiting.x1 - 0.2, waiting.z1 - 0.2, 0.015, c("#efe6d4"));
  floorB.ground(triage.x0 + 0.2, triage.z0 + 0.2, triage.x1 - 0.2, triage.z1 - 0.2, 0.015, c("#f6e4e4"));
  addRoom(wallB, blockers, waiting, c("#efe6d4"), TEAL, "x1", ["x0"]);
  addRoom(wallB, blockers, triage, c("#f8ecec"), RED, "x0", ["x1"]);
  plateFor(group, bucket, waiting, "x1", "WAIT");
  plateFor(group, bucket, triage, "x0", "TRIAGE");

  for (const [x, z] of [
    [-8.6, 2.2],
    [-6.6, 2.2],
    [-8.6, 4.4],
    [-6.6, 4.4],
  ] as Array<[number, number]>) {
    wallB.box(x, z, x + 1.3, z + 0.55, 0, 0.46, c("#2f4a6a"));
    blockers.push({ minX: x, maxX: x + 1.3, minZ: z, maxZ: z + 0.55 });
  }
  const gurneys: BedSpot[] = [
    { x: 7.3, z: 2.3, head: "x+" },
    { x: 7.3, z: 5.1, head: "x+" },
  ];
  for (const bed of gurneys) drawBed(wallB, trimB, blockers, bed, c("#e7eef3"), "iv");

  plant(wallB, blockers, -9.4, 10.2);
  plant(wallB, blockers, 9.4, 10.2);
  wallB.box(5.6, 9.4, 7.1, 10.6, 0, 1.7, c("#2c3e50"));
  blockers.push({ minX: 5.6, maxX: 7.1, minZ: 9.4, maxZ: 10.6 });

  return finish(group, bucket, kit, floorB, wallB, trimB, blockers, [], [
    { x: 0, z: -2.5, yaw: 0, role: "always", uniform: "scrubs" },
    { x: -1.8, z: -2.5, yaw: 0.3, role: "day", uniform: "coat" },
    { x: -7.6, z: 3.3, yaw: Math.PI / 2, seat: 0.46, role: "always" },
    { x: -7.6, z: 5.2, yaw: Math.PI / 2, seat: 0.46, role: "always" },
    ...gurneys.map(patientSpot),
    { x: 5.2, z: 3.6, yaw: -Math.PI / 2, role: "always", uniform: "scrubs" },
  ], 41, "LOBBY");
}

/** Three curtained bays on each side of a central aisle. */
function buildER(bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, FLOOR, c("#f7f1f1"), false, true);
  windows(group, wallB, bucket);
  elevatorDoors(wallB, trimB, MIN_Z + WALL_T);
  floorB.ground(-0.9, -8, 0.9, 10.5, 0.012, c("#e7c8c8"));
  floorDesk(wallB, blockers, TEAL);

  const centers = [-4.5, -1.5, 1.5];
  const leftBeds: BedSpot[] = [];
  const rightBeds: BedSpot[] = [];
  centers.forEach((z, i) => {
    const left: Rect = { x0: -10.5, z0: z - 1.5, x1: -3.05, z1: z + 1.5 };
    const right: Rect = { x0: 3.05, z0: z - 1.5, x1: 10.5, z1: z + 1.5 };
    floorB.ground(left.x0 + 0.15, left.z0 + 0.15, left.x1 - 0.15, left.z1 - 0.15, 0.016, c("#f8ecec"));
    floorB.ground(right.x0 + 0.15, right.z0 + 0.15, right.x1 - 0.15, right.z1 - 0.15, 0.016, c("#f8ecec"));
    addRoom(wallB, blockers, left, c("#f4e4e4"), RED, "x1", ["x0"]);
    addRoom(wallB, blockers, right, c("#f4e4e4"), RED, "x0", ["x1"]);
    plateFor(group, bucket, left, "x1", `ER ${i + 1}`);
    plateFor(group, bucket, right, "x0", `ER ${i + 4}`);
    const a: BedSpot = { x: -6.7, z, head: "x-" };
    const b: BedSpot = { x: 6.7, z, head: "x+" };
    leftBeds.push(a);
    rightBeds.push(b);
    drawBed(wallB, trimB, blockers, a, c("#e7eef3"), "iv");
    drawBed(wallB, trimB, blockers, b, c("#e7eef3"), "monitor");
  });
  const beds = [...leftBeds, ...rightBeds];

  return finish(group, bucket, kit, floorB, wallB, trimB, blockers, beds, [
    { x: -7.2, z: -6.65, yaw: 0, role: "always", uniform: "scrubs" },
    { x: 0.4, z: 4.2, yaw: Math.PI, role: "day", uniform: "coat" },
  ], 52, "EMERGENCY");
}

function buildImaging(bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, c("#e7eef2"), c("#e4eaf0"), false, true);
  windows(group, wallB, bucket);
  elevatorDoors(wallB, trimB, MIN_Z + WALL_T);
  floorB.ground(-0.7, -8, 0.7, 10.5, 0.012, c("#c5d4e4"));

  const mri: Rect = { x0: -10.5, z0: -5.8, x1: -2.05, z1: 3.4 };
  const xray: Rect = { x0: 2.05, z0: -5.8, x1: 10.5, z1: 3.4 };
  floorB.ground(mri.x0 + 0.2, mri.z0 + 0.2, mri.x1 - 0.2, mri.z1 - 0.2, 0.016, c("#d5dde6"));
  floorB.ground(xray.x0 + 0.2, xray.z0 + 0.2, xray.x1 - 0.2, xray.z1 - 0.2, 0.016, c("#e7eef2"));
  addRoom(wallB, blockers, mri, c("#d5dde6"), c("#5d6b7a"), "x1", ["x0"]);
  addRoom(wallB, blockers, xray, c("#e4eaf0"), c("#5d6b7a"), "x0", ["x1"]);
  plateFor(group, bucket, mri, "x1", "MRI");
  plateFor(group, bucket, xray, "x0", "X-RAY");

  const beds: BedSpot[] = [
    { x: -6.4, z: -1.2, head: "x-" },
    { x: 6.4, z: -1.2, head: "x+" },
  ];
  drawBed(wallB, trimB, blockers, beds[0], c("#d5dde6"), "monitor");
  drawBed(wallB, trimB, blockers, beds[1], c("#e7eef3"), "monitor");

  // MRI bore around the head of the table — open through the middle so the patient stays visible.
  const boreX = -7.15;
  wallB.box(boreX - 0.45, -2.15, boreX + 0.45, -1.85, 0.35, 1.7, STEEL);
  wallB.box(boreX - 0.45, -0.55, boreX + 0.45, -0.25, 0.35, 1.7, STEEL);
  wallB.box(boreX - 0.45, -2.15, boreX + 0.45, -0.25, 1.4, 1.75, STEEL);
  blockers.push({ minX: boreX - 0.45, maxX: boreX + 0.45, minZ: -2.15, maxZ: -1.85 });
  blockers.push({ minX: boreX - 0.45, maxX: boreX + 0.45, minZ: -0.55, maxZ: -0.25 });

  trimB.box(7.5, 0.6, 9.2, 0.85, 1.5, 2.7, STEEL);
  wallB.box(-1.5, 7.6, 1.5, 8.8, 0, 1.05, TEAL);
  blockers.push({ minX: -1.5, maxX: 1.5, minZ: 7.6, maxZ: 8.8 });

  return finish(group, bucket, kit, floorB, wallB, trimB, blockers, beds, [
    { x: 0, z: 6.9, yaw: 0, role: "always", uniform: "coat" },
    { x: -4.2, z: 8.6, yaw: Math.PI, role: "day", uniform: "scrubs" },
  ], 63, "IMAGING");
}

function buildSurgery(bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, c("#e7f0ee"), c("#e7eeea"), false, true);
  windows(group, wallB, bucket);
  elevatorDoors(wallB, trimB, MIN_Z + WALL_T);
  floorB.ground(-0.12, -8, 0.12, 8.5, 0.02, RED);

  const left: Rect = { x0: -10.5, z0: -4.7, x1: -2.15, z1: 4.7 };
  const right: Rect = { x0: 2.15, z0: -4.7, x1: 10.5, z1: 4.7 };
  floorB.ground(left.x0 + 0.2, left.z0 + 0.2, left.x1 - 0.2, left.z1 - 0.2, 0.016, c("#dceee8"));
  floorB.ground(right.x0 + 0.2, right.z0 + 0.2, right.x1 - 0.2, right.z1 - 0.2, 0.016, c("#dceee8"));
  addRoom(wallB, blockers, left, c("#d5ebe4"), c("#1f6f62"), "x1", ["x0"]);
  addRoom(wallB, blockers, right, c("#d5ebe4"), c("#1f6f62"), "x0", ["x1"]);
  plateFor(group, bucket, left, "x1", "OR 1");
  plateFor(group, bucket, right, "x0", "OR 2");

  const beds: BedSpot[] = [
    { x: -6.3, z: 0, head: "z-" },
    { x: 6.3, z: 0, head: "z-" },
  ];
  const drape = c("#1f6f62");
  for (const bed of beds) {
    drawBed(wallB, trimB, blockers, bed, drape, "iv", true);
    trimB.box(bed.x - 0.42, bed.z - 0.42, bed.x + 0.42, bed.z + 0.42, 3.25, 3.45, STEEL);
    trimB.box(bed.x - 0.16, bed.z - 0.16, bed.x + 0.16, bed.z + 0.16, 2.55, 3.25, c("#fff1c9"));
  }
  wallB.box(-1.7, 2.4, -1.15, 3.5, 0, 0.95, STEEL);
  wallB.box(1.15, 2.4, 1.7, 3.5, 0, 0.95, STEEL);
  blockers.push({ minX: -1.7, maxX: -1.15, minZ: 2.4, maxZ: 3.5 });
  blockers.push({ minX: 1.15, maxX: 1.7, minZ: 2.4, maxZ: 3.5 });

  return finish(group, bucket, kit, floorB, wallB, trimB, blockers, beds, [
    { x: -4.6, z: -2.4, yaw: 0, role: "always", uniform: "scrubs" },
    { x: -4.6, z: 2.2, yaw: Math.PI, role: "always", uniform: "coat" },
    { x: 4.8, z: 2.2, yaw: Math.PI, role: "day", uniform: "scrubs" },
  ], 74, "SURGERY");
}

function buildWard(bucket: Bucket, kit: StaffKit, seed: number, floorIndex: number, style: WardStyle): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  const wall = c(style.wall);
  shell(floorB, wallB, blockers, c(style.floor), wall, false, true);
  windows(group, wallB, bucket);
  elevatorDoors(wallB, trimB, MIN_Z + WALL_T);
  floorB.ground(-0.85, -8.1, 0.85, 11.1, 0.012, c(style.accent));
  floorDesk(wallB, blockers, c(style.accent));

  const beds: BedSpot[] = [];
  QUADS.forEach((quad, room) => {
    const tint = c(style.floor);
    floorB.ground(quad.rect.x0 + 0.2, quad.rect.z0 + 0.2, quad.rect.x1 - 0.2, quad.rect.z1 - 0.2, 0.016, tint);
    addRoom(wallB, blockers, quad.rect, wall, c(style.accent), quad.door, [quad.side === "L" ? "x0" : "x1"]);
    const label = String((floorIndex + 1) * 100 + room + 1);
    plateFor(group, bucket, quad.rect, quad.door, label);
    const roomBeds = pair(quad.side, quad.rect);
    roomBeds.forEach((bed, slot) => {
      const blanket = style.blanketAlt && slot === 1 ? c(style.blanketAlt) : c(style.blanket);
      drawBed(wallB, trimB, blockers, bed, blanket, style.prop);
      if (style.prop === "toys") {
        const tx = bed.x + (quad.side === "L" ? -1.5 : 1.5);
        wallB.box(tx, bed.z - 0.2, tx + 0.35, bed.z + 0.15, 0, 0.28, c(slot === 0 ? "#e07a3d" : "#3aa0d8"));
      }
      if (style.prop === "crutch") {
        const cx = bed.x + (quad.side === "L" ? 1.7 : -1.7);
        trimB.box(cx, bed.z - 0.04, cx + 0.08, bed.z + 0.04, 0, 1.25, WOOD);
      }
    });
    beds.push(...roomBeds);
  });

  galleryBits(wallB, trimB, blockers, style.gallery, c(style.accent));
  plant(wallB, blockers, -9.2, 10.1);

  return finish(group, bucket, kit, floorB, wallB, trimB, blockers, beds, [
    { x: -7.3, z: -6.65, yaw: 0, role: "always", uniform: "scrubs" },
    { x: 0.6, z: 8.7, yaw: Math.PI, role: "day", uniform: "coat" },
    { x: -0.5, z: -3.2, yaw: Math.PI / 2, role: "day", uniform: "scrubs" },
  ], seed, style.title);
}

/** Cabin floor height. A standing player (eye 1.7) fits under the roof with the side doors open. */
const HELI_FLOOR = 0.7;
const HELI_X = 0;
const HELI_Z = 1.05;
/** Underside of the cabin lid. Heads inside the cabin stay below this. */
const HELI_ROOF_UNDER = 2.95;
/** Walkable top of the fuselage. */
const HELI_ROOF_TOP = 3.11;
/** Anything at or below this is cleared once your feet are on the fuselage. */
const HELI_ROOF_CLEAR = 2.4;
/**
 * Ramp on the open pad, right of the tail. High end is outside the fuselage
 * walls so you can walk up before you meet any helicopter collision.
 */
const RAMP_X0 = 2.9;
const RAMP_X1 = 6.6;
const RAMP_Z0 = -2.7;
const RAMP_Z1 = -0.5;

/** Black-and-yellow helicopter on the pad. The cabin is hollow so you can walk in through either door. */
function addHelicopter(group: THREE.Group, bucket: Bucket, blockers: Blocker[]) {
  const heli = new THREE.Group();
  heli.position.set(HELI_X, 0, HELI_Z);
  const paint = new THREE.MeshStandardMaterial({ color: "#17191c", roughness: 0.42, metalness: 0.18 });
  const yellow = new THREE.MeshStandardMaterial({ color: "#f2c200", roughness: 0.45, metalness: 0.08 });
  const dark = new THREE.MeshStandardMaterial({ color: "#0c0d0f", roughness: 0.55, metalness: 0.25 });
  const glass = new THREE.MeshStandardMaterial({
    color: "#1a2420",
    roughness: 0.06,
    metalness: 0.55,
    transparent: true,
    opacity: 0.55,
  });
  const bladeMat = new THREE.MeshStandardMaterial({ color: "#2c3036", roughness: 0.35, metalness: 0.25 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.85 });
  bucket.push(paint, yellow, dark, glass, bladeMat, rubber);

  const box = (mat: THREE.Material, w: number, h: number, d: number, px: number, py: number, pz: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, py, pz);
    heli.add(mesh);
    bucket.push(geo);
    return mesh;
  };
  const block = (x0: number, z0: number, x1: number, z1: number, minY?: number, maxY?: number) => {
    blockers.push({
      minX: HELI_X + x0,
      maxX: HELI_X + x1,
      minZ: HELI_Z + z0,
      maxZ: HELI_Z + z1,
      minY,
      maxY,
    });
  };

  const inner = 1.22;
  const outer = 1.58;
  const z0 = -1.55;
  const z1 = 2.8;
  const door0 = 0.05;
  const door1 = 1.72;
  const roofY = HELI_ROOF_UNDER;

  box(dark, inner * 2, 0.16, z1 - z0, 0, HELI_FLOOR - 0.08, (z0 + z1) / 2);
  box(paint, inner * 2 - 0.08, 0.06, z1 - z0 - 0.12, 0, HELI_FLOOR + 0.03, (z0 + z1) / 2);
  block(-inner, z0, inner, z1, undefined, HELI_FLOOR);

  const wallY0 = HELI_FLOOR;
  const wallY1 = roofY;
  const addWall = (x0: number, zLo: number, x1: number, zHi: number) => {
    box(paint, x1 - x0, wallY1 - wallY0, zHi - zLo, (x0 + x1) / 2, (wallY0 + wallY1) / 2, (zLo + zHi) / 2);
    block(x0, zLo, x1, zHi, wallY0, HELI_ROOF_CLEAR);
  };
  for (const side of [-1, 1]) {
    const xNear = side * inner;
    const xFar = side * outer;
    const xa = Math.min(xNear, xFar);
    const xb = Math.max(xNear, xFar);
    addWall(xa, z0, xb, door0);
    addWall(xa, door1, xb, z1);
    box(yellow, 0.06, 0.14, z1 - z0 - 0.2, side * (outer + 0.02), 1.22, (z0 + z1) / 2);
    box(yellow, 0.08, wallY1 - wallY0, 0.08, side * outer, (wallY0 + wallY1) / 2, door0);
    box(yellow, 0.08, wallY1 - wallY0, 0.08, side * outer, (wallY0 + wallY1) / 2, door1);
    const doorMid = (door0 + door1) / 2;
    const doorW = door1 - door0 - 0.08;
    box(dark, 0.5, 0.24, doorW, side * 2.55, 0.12, doorMid);
    box(dark, 0.48, 0.46, doorW, side * 2.05, 0.23, doorMid);
    box(dark, 0.42, HELI_FLOOR, doorW, side * 1.78, HELI_FLOOR / 2, doorMid);
  }

  addWall(-inner, z0 - 0.16, inner, z0);
  addWall(-inner, z1, inner, z1 + 0.16);
  box(paint, inner * 2 + 0.4, 0.16, z1 - z0 + 0.5, 0, roofY + 0.08, (z0 + z1) / 2);
  // Slab, not a column: heads under the lid pass, feet on HELI_ROOF_TOP stand on it.
  block(-1.5, -1.95, 1.5, 3.05, HELI_ROOF_UNDER, HELI_ROOF_CLEAR);

  box(paint, 1.7, 1.15, 1.55, 0, 1.35, 3.55);
  box(yellow, 1.78, 0.12, 1.55, 0, 1.18, 3.55);
  box(glass, 1.45, 0.7, 0.12, 0, 1.72, 4.28);
  box(glass, 0.08, 0.55, 0.9, 0.82, 1.62, 3.7);
  box(glass, 0.08, 0.55, 0.9, -0.82, 1.62, 3.7);
  block(-0.95, z1, 0.95, 4.45, undefined, 1.95);

  box(paint, 0.55, 0.48, 4.35, 0, 1.85, -3.7);
  box(yellow, 0.62, 0.1, 4.15, 0, 1.62, -3.7);
  box(paint, 0.14, 1.7, 0.85, 0, 2.35, -5.85);
  box(yellow, 0.08, 1.55, 0.1, 0.1, 2.35, -6.22);
  box(paint, 2.4, 0.08, 0.45, 0, 2.15, -5.55);
  block(-0.4, -6.3, 0.4, z0, undefined, 2.2);

  for (const side of [-1, 1]) {
    box(dark, 0.5, 0.36, 0.7, side * 0.62, HELI_FLOOR + 0.22, -0.95);
    block(side * 0.62 - 0.28, -1.32, side * 0.62 + 0.28, -0.58, HELI_FLOOR, 1.2);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 10);
  bucket.push(wheelGeo, hubGeo);
  const addWheel = (px: number, py: number, pz: number, radius = 0.42) => {
    const tire = new THREE.Mesh(wheelGeo, rubber);
    tire.scale.setScalar(radius / 0.42);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(px, py, pz);
    const hub = new THREE.Mesh(hubGeo, dark);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(px, py, pz);
    heli.add(tire, hub);
    block(px - radius, pz - radius, px + radius, pz + radius, undefined, py + radius + 0.05);
  };
  addWheel(-1.85, 0.42, -0.7);
  addWheel(1.85, 0.42, -0.7);
  addWheel(0, 0.36, 3.85, 0.34);
  addWheel(0, 0.32, -5.7, 0.3);
  for (const side of [-1, 1]) {
    box(dark, 0.08, 0.55, 0.08, side * 1.7, 0.55, -0.7);
  }
  box(dark, 0.08, 0.45, 0.08, 0, 0.5, 3.7);

  box(paint, 0.5, 0.28, 0.7, -1.15, HELI_ROOF_TOP + 0.14, 2.05);
  box(paint, 0.5, 0.28, 0.7, 1.15, HELI_ROOF_TOP + 0.14, 2.05);
  const mastGeo = new THREE.CylinderGeometry(0.09, 0.13, 2.15, 10);
  const mast = new THREE.Mesh(mastGeo, dark);
  mast.position.set(0, HELI_ROOF_TOP + 1.08, 0.45);
  heli.add(mast);
  bucket.push(mastGeo);

  const main = new THREE.Group();
  main.position.set(0, HELI_ROOF_TOP + 2.25, 0.45);
  const bladeGeo = new THREE.BoxGeometry(11.2, 0.05, 0.26);
  const rotorHubGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12);
  const bladeA = new THREE.Mesh(bladeGeo, bladeMat);
  const bladeB = new THREE.Mesh(bladeGeo, bladeMat);
  bladeB.rotation.y = Math.PI / 2;
  const hub = new THREE.Mesh(rotorHubGeo, dark);
  main.add(bladeA, bladeB, hub);
  heli.add(main);
  bucket.push(bladeGeo, rotorHubGeo);

  const tail = new THREE.Group();
  tail.position.set(-0.22, 2.45, -5.85);
  const tailGeo = new THREE.BoxGeometry(0.05, 1.7, 0.16);
  const tailA = new THREE.Mesh(tailGeo, bladeMat);
  const tailB = new THREE.Mesh(tailGeo, bladeMat);
  tailB.rotation.x = Math.PI / 2;
  const tailHubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
  const tailHub = new THREE.Mesh(tailHubGeo, dark);
  tailHub.rotation.z = Math.PI / 2;
  tail.add(tailA, tailB, tailHub);
  heli.add(tail);
  bucket.push(tailGeo, tailHubGeo);

  const beaconGeo = new THREE.SphereGeometry(0.1, 8, 6);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: "#ff4d4d",
    emissive: "#ff2a2a",
    emissiveIntensity: 0.85,
    roughness: 0.4,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0, roofY + 0.95, -5.7);
  heli.add(beacon);
  bucket.push(beaconGeo, beaconMat);

  const rampSteps = 10;
  const rampZ = (RAMP_Z0 + RAMP_Z1) / 2;
  const rampD = RAMP_Z1 - RAMP_Z0;
  for (let i = 0; i < rampSteps; i++) {
    const xHi = RAMP_X1 - ((RAMP_X1 - RAMP_X0) * i) / rampSteps;
    const xLo = RAMP_X1 - ((RAMP_X1 - RAMP_X0) * (i + 1)) / rampSteps;
    const yTop = (HELI_ROOF_TOP * (i + 1)) / rampSteps;
    box(i % 2 === 0 ? yellow : dark, xHi - xLo - 0.02, Math.max(0.14, yTop), rampD, (xLo + xHi) / 2, yTop / 2, rampZ);
  }
  box(yellow, RAMP_X0 - 1.15, 0.08, rampD, (1.15 + RAMP_X0) / 2, HELI_ROOF_TOP - 0.04, rampZ);

  group.add(heli);
  return { main, tail };
}

/** Ramp height from the pad (0) up to the fuselage. Null when you are not on it. */
function rampHeight(lx: number, lz: number) {
  if (lx < RAMP_X0 || lx > RAMP_X1 || lz < RAMP_Z0 || lz > RAMP_Z1) return null;
  const t = (RAMP_X1 - lx) / (RAMP_X1 - RAMP_X0);
  return HELI_ROOF_TOP * Math.min(1, Math.max(0, t));
}

/** Deck, cabin, the side ramp, and the top of the fuselage. */
function helicopterFloor(x: number, z: number, feetY = 0) {
  const lx = x - HELI_X;
  const lz = z - HELI_Z;
  const ramp = rampHeight(lx, lz);
  if (ramp != null) return ramp;
  const onRoof = Math.abs(lx) <= 1.55 && lz >= -1.95 && lz <= 3.05;
  const onPlank = lx >= 1.15 && lx < RAMP_X0 && lz >= RAMP_Z0 && lz <= RAMP_Z1;
  if ((onRoof || onPlank) && feetY >= 1.6) return HELI_ROOF_TOP;
  if (Math.abs(lx) <= 1.22 && lz >= -1.55 && lz <= 2.8) return HELI_FLOOR;
  if (lz >= 0.05 && lz <= 1.72) {
    const ax = Math.abs(lx);
    if (ax > 1.22 && ax <= 1.9) return HELI_FLOOR;
    if (ax > 1.9 && ax <= 2.35) return 0.42;
    if (ax > 2.35 && ax <= 2.85) return 0.2;
  }
  return 0;
}

function buildRoof(building: Building, bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  const deck = c("#5a6570");
  floorB.ground(MIN_X, MIN_Z, MAX_X, MAX_Z, 0, deck);
  const rail = 0.85;
  for (const [x0, x1] of [
    [MIN_X, MIN_X + WALL_T],
    [MAX_X - WALL_T, MAX_X],
  ] as Array<[number, number]>) {
    wallB.box(x0, MIN_Z, x1, MAX_Z, 0, rail, RED);
  }
  wallB.box(MIN_X, MIN_Z, MAX_X, MIN_Z + WALL_T, 0, rail, RED);
  wallB.box(MIN_X, MAX_Z - WALL_T, MAX_X, MAX_Z, 0, rail, RED);
  blockers.push({ minX: MIN_X, maxX: MIN_X + WALL_T, minZ: MIN_Z, maxZ: MAX_Z });
  blockers.push({ minX: MAX_X - WALL_T, maxX: MAX_X, minZ: MIN_Z, maxZ: MAX_Z });
  blockers.push({ minX: MIN_X, maxX: MAX_X, minZ: MIN_Z, maxZ: MIN_Z + WALL_T });
  blockers.push({ minX: MIN_X, maxX: MAX_X, minZ: MAX_Z - WALL_T, maxZ: MAX_Z });

  const faceZ = MIN_Z + WALL_T;
  elevatorDoors(wallB, trimB, faceZ);
  // Penthouse sits between the cars and out past them. The door lanes stay open,
  // otherwise the rider steps out inside a solid box and cannot move.
  const shaft: Array<[number, number]> = [
    [-1.55, 1.55],
    [-7.4, -5.05],
    [5.05, 7.4],
  ];
  for (const [x0, x1] of shaft) {
    wallB.box(x0, faceZ, x1, faceZ + 1.55, 0, 3.05, c("#4a5560"));
    blockers.push({ minX: x0, maxX: x1, minZ: faceZ, maxZ: faceZ + 1.55 });
  }

  floorB.ground(-5.5, -4.5, 5.5, 6.5, 0.02, c("#2a3038"));
  trimB.box(-4.2, -0.25, 4.2, 0.25, 0.03, 0.08, WHITE);
  trimB.box(-0.25, -3.2, 0.25, 3.2, 0.03, 0.08, WHITE);
  trimB.box(-4.4, -3.4, -3.9, 3.4, 0.03, 0.08, WHITE);
  trimB.box(3.9, -3.4, 4.4, 3.4, 0.03, 0.08, WHITE);

  const rotors = addHelicopter(group, bucket, blockers);
  addVendingMachine(group, bucket, wallB, blockers);

  const title = makeSign(bucket, 4.2, 0.6, "#1a1a1a", "#ffffff");
  title.draw("HELIPAD", building.name);
  title.mesh.position.set(0, 2.4, faceZ + 2.85);
  group.add(title.mesh);
  const floorSign = makeSign(bucket, 2.4, 0.5, "#1a1a1a", "#ffffff");
  floorSign.draw("ROOF", "Helipad");
  floorSign.mesh.position.set(0, 2.9, faceZ + 0.14);
  group.add(floorSign.mesh);

  const spots: StaffSpot[] = [
    { x: -6.5, z: 8.2, yaw: Math.PI, role: "day", uniform: "scrubs" },
    { x: 6.5, z: 8.2, yaw: Math.PI, role: "day", uniform: "coat" },
  ];
  const crowd = new OfficeCrowd(
    group,
    kit,
    {
      spots,
      graph: {
        nodes: [
          [-6.2, 8.2],
          [0, 8.6],
          [6.2, 8.2],
          [-6.4, 1.2],
          [-6.4, -3.2],
          [5.6, 4.6],
        ],
        edges: [
          [0, 1],
          [1, 2],
          [0, 3],
          [3, 4],
          [2, 5],
          [5, 1],
        ],
      },
      walkers: 1,
    },
    88,
  );
  const marker = caseMarkerMesh(bucket);
  group.add(marker);
  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ, beds: [], floorSign, caseMarker: marker, crowd, rotors };
}

const WARD_STYLES: WardStyle[] = [
  {
    title: "CARDIOLOGY",
    wall: "#f8eeee",
    floor: "#f4e4e4",
    accent: "#9b2c3a",
    blanket: "#c45c6a",
    prop: "monitor",
    gallery: "chairs",
  },
  {
    title: "PEDIATRICS",
    wall: "#fff6e4",
    floor: "#ffe7c2",
    accent: "#e07a3d",
    blanket: "#f2c14e",
    blanketAlt: "#7ec8e3",
    prop: "toys",
    gallery: "toys",
  },
  {
    title: "MEDICINE",
    wall: "#f4f7f8",
    floor: "#e7f3f1",
    accent: "#2aa3a0",
    blanket: "#b7d4dc",
    prop: "iv",
    gallery: "chairs",
  },
  {
    title: "NEUROLOGY",
    wall: "#f3eef8",
    floor: "#ece4f4",
    accent: "#6c5b8a",
    blanket: "#c9bdd8",
    prop: "eeg",
    gallery: "quiet",
  },
  {
    title: "ORTHOPEDICS",
    wall: "#eef3f8",
    floor: "#e4eef6",
    accent: "#3d6ea8",
    blanket: "#8fb4d9",
    prop: "crutch",
    gallery: "bars",
  },
  {
    title: "ICU",
    wall: "#e7f1f3",
    floor: "#dce9ec",
    accent: "#1a6b7a",
    blanket: "#f7f4ee",
    prop: "vent",
    gallery: "supplies",
  },
];

/** Multi-floor hospital: private rooms, department floors, patients tucked into the beds. */
export function buildHospital(building: Building, getState: () => CityState | null = () => null): VenueInterior {
  if (building.floors < 10) building.floors = 10;
  const bucket: Bucket = [];
  const root = new THREE.Group();
  const seed = [...building.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 11);
  const kit = new StaffKit(bucket);

  const lobby = buildLobby(building, bucket, kit);
  const er = buildER(bucket, kit);
  const imaging = buildImaging(bucket, kit);
  const surgery = buildSurgery(bucket, kit);
  const wards = WARD_STYLES.map((style, i) => buildWard(bucket, kit, seed + (i + 4) * 17, i + 4, style));
  const roof = buildRoof(building, bucket, kit);

  const layouts: FloorLayout[] = [lobby, er, imaging, surgery, ...wards, roof];
  for (const layout of layouts) {
    layout.group.visible = false;
    root.add(layout.group);
  }

  const roofIndex = layouts.length - 1;
  const floors = HOSPITAL_LEVELS.map((level) => level.short);
  const floorNames = HOSPITAL_LEVELS.map((level) => level.name);

  const blockers: Blocker[] = [];
  let current = 0;
  let activeCase: DoctorCase | null = null;

  const refreshCase = () => {
    const layout = layouts[current];
    const bed =
      activeCase && activeCase.floor === current && layout.beds[activeCase.bed]
        ? layout.beds[activeCase.bed]
        : null;
    placeCaseMarker(layout.caseMarker, bed);
  };

  const show = (index: number) => {
    current = Math.min(roofIndex, Math.max(0, Math.round(index)));
    for (let i = 0; i < layouts.length; i++) layouts[i].group.visible = i === current;
    const layout = layouts[current];
    blockers.length = 0;
    blockers.push(...layout.blockers);
    const level = HOSPITAL_LEVELS[current];
    layout.floorSign.draw(level.short.toUpperCase(), level.name);
    layout.crowd.apply(seed + current * 101, 0.9, 0, false);
    refreshCase();
    return layout;
  };
  show(0);

  const elevator: OfficeElevator = {
    floors,
    floorNames,
    deskFloor: HOSPITAL_DESK_FLOOR,
    markLabel: () => (activeCase ? `Case · ${activeCase.bedLabel}` : null),
    markFloor: () => (activeCase ? activeCase.floor : null),
    current: () => current,
    isRoof: (index) => index === roofIndex,
    near: (x, z) => {
      const { doorZ } = layouts[current];
      return z > doorZ - 0.3 && z < doorZ + 2.2 && (Math.abs(x - DOOR_X) < 1.5 || Math.abs(x + DOOR_X) < 1.5);
    },
    goTo: (index) => {
      const layout = show(index);
      const onHelipad = index === roofIndex;
      return { x: -DOOR_X, z: layout.doorZ + (onHelipad ? 2.7 : 1.4), yaw: Math.PI };
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
    groundAt: (x, z, feetY) => (current === roofIndex ? helicopterFloor(x, z, feetY) : 0),
    nearVending: (x, z) => nearHospitalVending(x, z),
    nearDesk: (x, z) => current === HOSPITAL_DESK_FLOOR && x > -4.0 && x < 4.0 && z > -2.6 && z < 0.8,
    nearExit: (x, z) => current === 0 && z > 9.6 && Math.abs(x) < 2.6,
    nearPatient: (x, z) => {
      if (!activeCase || activeCase.floor !== current) return false;
      const bed = layouts[current].beds[activeCase.bed];
      if (!bed) return false;
      return Math.hypot(x - bed.x, z - bed.z) < 2.6;
    },
    setCase: (next) => {
      activeCase = next;
      refreshCase();
    },
    elevator,
    update: (dt) => {
      void getState;
      layouts[current].crowd.update(dt);
      const marker = layouts[current].caseMarker;
      if (marker.visible) marker.rotation.y += dt * 1.2;
      const rotors = layouts[current].rotors;
      if (rotors) {
        rotors.main.rotation.y += dt * 9;
        rotors.tail.rotation.x += dt * 26;
      }
    },
    dispose: () => {
      for (const item of bucket) item.dispose();
    },
  };
}
