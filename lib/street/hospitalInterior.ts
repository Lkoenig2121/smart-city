import * as THREE from "three";
import { HOSPITAL_DESK_FLOOR, HOSPITAL_LEVELS, type DoctorCase } from "@/lib/city/doctor";
import type { Building, CityState } from "@/lib/city/types";
import type { Blocker } from "./buildCity";
import {
  assemble,
  builders,
  c,
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

const HALF_PI = Math.PI / 2;
const MATTRESS = 0.55;
const FLOOR = c("#e8eef2");
const WALL = c("#f4f7f8");
const TEAL = c("#2aa3a0");
const WHITE = c("#f7f4ee");
const STEEL = c("#b9c3cc");
const RED = c("#c0392b");
const CURTAIN = c("#5dade2");

interface BedSpot {
  x: number;
  z: number;
  /** Yaw of the bed so the foot faces away from the approach side. */
  yaw: number;
}

interface FloorLayout extends Layout {
  beds: BedSpot[];
  floorSign: Sign;
  caseMarker: THREE.Mesh;
  crowd: OfficeCrowd;
}

function bedBlock(x: number, z: number, yaw: number): Blocker {
  const along = Math.abs(Math.cos(yaw)) > 0.7;
  return along
    ? { minX: x - 1.15, maxX: x + 1.15, minZ: z - 0.55, maxZ: z + 0.55 }
    : { minX: x - 0.55, maxX: x + 0.55, minZ: z - 1.15, maxZ: z + 1.15 };
}

function drawBed(
  wallB: import("./meshBuilder").MeshBuilder,
  trimB: import("./meshBuilder").MeshBuilder,
  blockers: Blocker[],
  bed: BedSpot,
) {
  const along = Math.abs(Math.cos(bed.yaw)) > 0.7;
  const hx = along ? 1.1 : 0.48;
  const hz = along ? 0.48 : 1.1;
  wallB.box(bed.x - hx, bed.z - hz, bed.x + hx, bed.z + hz, 0, 0.42, STEEL);
  trimB.box(bed.x - hx + 0.05, bed.z - hz + 0.05, bed.x + hx - 0.05, bed.z + hz - 0.05, 0.42, MATTRESS, WHITE);
  const headX = bed.x - Math.cos(bed.yaw) * (along ? 1.05 : 0) - Math.sin(bed.yaw) * (along ? 0 : 1.05);
  const headZ = bed.z - Math.sin(bed.yaw) * (along ? 0 : 1.05) - Math.cos(bed.yaw) * (along ? 1.05 : 0);
  const hw = along ? 0.08 : 0.48;
  const hd = along ? 0.48 : 0.08;
  wallB.box(headX - hw, headZ - hd, headX + hw, headZ + hd, 0.42, 1.15, STEEL);
  blockers.push(bedBlock(bed.x, bed.z, bed.yaw));
}

function patientSpot(bed: BedSpot): StaffSpot {
  // Feet at the foot of the bed; liePose points head toward local -z, so yaw faces foot→head.
  const footX = bed.x + Math.sin(bed.yaw) * 0.85;
  const footZ = bed.z + Math.cos(bed.yaw) * 0.85;
  return {
    x: footX,
    z: footZ,
    yaw: bed.yaw + Math.PI,
    lie: MATTRESS,
    role: "always",
    uniform: "gown",
  };
}

function hallGraph(): CrowdSpec["graph"] {
  return {
    nodes: [
      [-7, 8],
      [0, 8],
      [7, 8],
      [-7, 0],
      [0, 0],
      [7, 0],
      [-7, -5],
      [0, -5],
      [7, -5],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [0, 3],
      [1, 4],
      [2, 5],
      [3, 4],
      [4, 5],
      [3, 6],
      [4, 7],
      [5, 8],
      [6, 7],
      [7, 8],
    ],
  };
}

function caseMarkerMesh(bucket: Bucket): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.55, 0.55, 0.08);
  const mat = new THREE.MeshStandardMaterial({
    color: "#c0392b",
    emissive: "#c0392b",
    emissiveIntensity: 0.85,
    roughness: 0.4,
  });
  bucket.push(geo, mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return mesh;
}

function placeCaseMarker(marker: THREE.Mesh, bed: BedSpot | null) {
  if (!bed) {
    marker.visible = false;
    return;
  }
  marker.visible = true;
  marker.position.set(bed.x, 2.35, bed.z);
  marker.rotation.y = bed.yaw;
}

/** Lobby reception + waiting area. Desk is the doctor clock-in point. */
function buildLobby(building: Building, bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, FLOOR, WALL, true);
  const faceZ = MIN_Z + WALL_T;
  elevatorDoors(wallB, trimB, faceZ);
  floorB.ground(-2, 9.4, 2, 11.5, 0.01, c("#3a3f46"));
  floorB.ground(-6, faceZ, 6, faceZ + 2.4, 0.01, c("#d5dde4"));

  // Reception desk (clock in / page patients).
  wallB.box(-3.2, -1.8, 3.2, -0.55, 0, 1.12, TEAL);
  trimB.box(-3.3, -1.9, 3.3, -0.45, 1.12, 1.22, STEEL);
  blockers.push({ minX: -3.3, maxX: 3.3, minZ: -1.9, maxZ: -0.45 });

  const cross = makeSign(bucket, 1.6, 1.6, "#ffffff", "#c0392b");
  cross.draw("+");
  cross.mesh.position.set(0, 2.9, -0.5);
  group.add(cross.mesh);

  const title = makeSign(bucket, 5.2, 0.7, "#1a3a44", "#e8f6f5");
  title.draw(building.name, "Emergency Reception");
  title.mesh.position.set(0, 3.55, faceZ + 0.08);
  group.add(title.mesh);

  // Waiting chairs.
  for (const x0 of [-10.2, 7.2]) {
    wallB.box(x0, 2.4, x0 + 3, 3.5, 0, 0.45, c("#2f4a6a"));
    wallB.box(x0, 3.5, x0 + 3, 3.9, 0, 0.95, c("#2f4a6a"));
    blockers.push({ minX: x0, maxX: x0 + 3, minZ: 2.4, maxZ: 3.9 });
  }
  plant(wallB, blockers, -9.6, 10.4);
  plant(wallB, blockers, 9.6, 10.4);

  const floorSign = makeSign(bucket, 2.4, 0.55, "#1a3a44", "#e8f6f5");
  floorSign.draw("LOBBY", "Reception");
  floorSign.mesh.position.set(0, 3.1, faceZ + 0.14);
  group.add(floorSign.mesh);

  const beds: BedSpot[] = [];
  const spots: StaffSpot[] = [
    { x: 0, z: -2.4, yaw: 0, role: "day", uniform: "scrubs" },
    { x: -2.2, z: -2.4, yaw: 0.2, role: "day", uniform: "coat" },
    { x: -8.6, z: 2.9, yaw: HALF_PI, seat: 0.45, role: "always" },
    { x: -7.4, z: 2.9, yaw: HALF_PI, seat: 0.45, role: "always" },
    { x: 8.6, z: 2.9, yaw: -HALF_PI, seat: 0.45, role: "always" },
    { x: 2.4, z: 7.2, yaw: Math.PI, role: "day", uniform: "guard" },
  ];
  const crowd = new OfficeCrowd(group, kit, { spots, graph: hallGraph(), walkers: 3 }, 41);
  const marker = caseMarkerMesh(bucket);
  group.add(marker);
  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ, beds, floorSign, caseMarker: marker, crowd };
}

/** Six curtained ER bays along the sides. */
function buildER(bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, FLOOR, WALL, false, true);
  windows(group, wallB, bucket);
  const faceZ = MIN_Z + WALL_T;
  elevatorDoors(wallB, trimB, faceZ);

  // Nurses station mid-room.
  wallB.box(-2.4, -0.6, 2.4, 1.4, 0, 1.05, TEAL);
  trimB.box(-2.5, -0.7, 2.5, 1.5, 1.05, 1.15, STEEL);
  blockers.push({ minX: -2.5, maxX: 2.5, minZ: -0.7, maxZ: 1.5 });

  const beds: BedSpot[] = [
    { x: -8.2, z: -5.2, yaw: HALF_PI },
    { x: -8.2, z: -1.2, yaw: HALF_PI },
    { x: -8.2, z: 3.0, yaw: HALF_PI },
    { x: 8.2, z: -5.2, yaw: -HALF_PI },
    { x: 8.2, z: -1.2, yaw: -HALF_PI },
    { x: 8.2, z: 3.0, yaw: -HALF_PI },
  ];
  for (const bed of beds) {
    drawBed(wallB, trimB, blockers, bed);
    // Curtain rail beside each bay.
    const railX = bed.x + (bed.x < 0 ? 1.6 : -1.6);
    trimB.box(railX - 0.04, bed.z - 1.2, railX + 0.04, bed.z + 1.2, 2.1, 2.2, STEEL);
    wallB.box(railX - 0.02, bed.z - 1.1, railX + 0.02, bed.z + 1.1, 0.8, 2.1, CURTAIN);
  }

  const floorSign = makeSign(bucket, 2.6, 0.55, "#1a3a44", "#e8f6f5");
  floorSign.draw("ER", "Emergency");
  floorSign.mesh.position.set(0, 3.1, faceZ + 0.14);
  group.add(floorSign.mesh);

  const spots: StaffSpot[] = [
    ...beds.map(patientSpot),
    { x: 0, z: -1.5, yaw: 0, role: "always", uniform: "scrubs" },
    { x: -1.6, z: 0.2, yaw: HALF_PI, role: "day", uniform: "coat" },
    { x: 1.8, z: 0.4, yaw: -HALF_PI, role: "day", uniform: "scrubs" },
  ];
  const crowd = new OfficeCrowd(group, kit, { spots, graph: hallGraph(), walkers: 2 }, 52);
  const marker = caseMarkerMesh(bucket);
  group.add(marker);
  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ, beds, floorSign, caseMarker: marker, crowd };
}

/** Imaging suite: MRI tube + X-ray table. */
function buildImaging(bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, FLOOR, WALL, false, true);
  windows(group, wallB, bucket);
  const faceZ = MIN_Z + WALL_T;
  elevatorDoors(wallB, trimB, faceZ);

  // MRI cylinder on the left.
  wallB.box(-9.2, -2.4, -5.4, 2.4, 0, 2.4, STEEL);
  wallB.box(-8.6, -1.6, -6.0, 1.6, 0.6, 2.0, c("#1a1f28"));
  blockers.push({ minX: -9.2, maxX: -5.4, minZ: -2.4, maxZ: 2.4 });

  // X-ray / CT table on the right.
  const beds: BedSpot[] = [
    { x: 6.5, z: -3.2, yaw: 0 },
    { x: 6.5, z: 2.8, yaw: Math.PI },
  ];
  for (const bed of beds) drawBed(wallB, trimB, blockers, bed);
  trimB.box(5.2, -4.6, 7.8, -4.4, 1.6, 2.8, STEEL);
  trimB.box(5.2, 4.0, 7.8, 4.2, 1.6, 2.8, STEEL);

  // Console desk.
  wallB.box(-1.8, 5.5, 1.8, 7.2, 0, 1.05, TEAL);
  blockers.push({ minX: -1.8, maxX: 1.8, minZ: 5.5, maxZ: 7.2 });

  const floorSign = makeSign(bucket, 2.8, 0.55, "#1a3a44", "#e8f6f5");
  floorSign.draw("IMAGING", "Radiology");
  floorSign.mesh.position.set(0, 3.1, faceZ + 0.14);
  group.add(floorSign.mesh);

  const spots: StaffSpot[] = [
    ...beds.map(patientSpot),
    { x: 0, z: 4.8, yaw: 0, role: "always", uniform: "coat" },
    { x: -7.2, z: 3.4, yaw: Math.PI, role: "day", uniform: "scrubs" },
  ];
  const crowd = new OfficeCrowd(group, kit, { spots, graph: hallGraph(), walkers: 1 }, 63);
  const marker = caseMarkerMesh(bucket);
  group.add(marker);
  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ, beds, floorSign, caseMarker: marker, crowd };
}

/** Twin operating rooms. */
function buildSurgery(bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, c("#dfe8ec"), WALL, false, true);
  windows(group, wallB, bucket);
  const faceZ = MIN_Z + WALL_T;
  elevatorDoors(wallB, trimB, faceZ);

  // Divider wall between ORs.
  wallB.box(-0.2, -6.5, 0.2, 6.5, 0, 3.6, WALL);
  blockers.push({ minX: -0.2, maxX: 0.2, minZ: -6.5, maxZ: 6.5 });

  const beds: BedSpot[] = [
    { x: -5.5, z: 0, yaw: HALF_PI },
    { x: 5.5, z: 0, yaw: -HALF_PI },
  ];
  for (const bed of beds) {
    drawBed(wallB, trimB, blockers, bed);
    // Surgical lamp.
    trimB.box(bed.x - 0.45, bed.z - 0.45, bed.x + 0.45, bed.z + 0.45, 3.4, 3.55, STEEL);
    trimB.box(bed.x - 0.15, bed.z - 0.15, bed.x + 0.15, bed.z + 0.15, 2.6, 3.4, c("#ffd9a0"));
  }

  const floorSign = makeSign(bucket, 2.6, 0.55, "#1a3a44", "#e8f6f5");
  floorSign.draw("SURGERY", "Operating rooms");
  floorSign.mesh.position.set(0, 3.1, faceZ + 0.14);
  group.add(floorSign.mesh);

  const spots: StaffSpot[] = [
    ...beds.map(patientSpot),
    { x: -5.5, z: -2.2, yaw: 0, role: "always", uniform: "scrubs" },
    { x: -3.6, z: 0.4, yaw: -HALF_PI, role: "always", uniform: "coat" },
    { x: 5.5, z: 2.2, yaw: Math.PI, role: "always", uniform: "scrubs" },
    { x: 3.6, z: -0.4, yaw: HALF_PI, role: "day", uniform: "coat" },
  ];
  const crowd = new OfficeCrowd(group, kit, { spots, graph: hallGraph(), walkers: 1 }, 74);
  const marker = caseMarkerMesh(bucket);
  group.add(marker);
  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ, beds, floorSign, caseMarker: marker, crowd };
}

/** Shared 8-bed ward used for Cardio / Peds / Medicine / Neuro / Ortho / ICU. */
function buildWard(bucket: Bucket, kit: StaffKit, seed: number): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  shell(floorB, wallB, blockers, FLOOR, WALL, false, true);
  windows(group, wallB, bucket);
  const faceZ = MIN_Z + WALL_T;
  elevatorDoors(wallB, trimB, faceZ);

  // Central nurses station.
  wallB.box(-2.2, -1.2, 2.2, 1.2, 0, 1.05, TEAL);
  trimB.box(-2.3, -1.3, 2.3, 1.3, 1.05, 1.15, STEEL);
  blockers.push({ minX: -2.3, maxX: 2.3, minZ: -1.3, maxZ: 1.3 });

  const beds: BedSpot[] = [
    { x: -8.0, z: -5.5, yaw: HALF_PI },
    { x: -8.0, z: -2.0, yaw: HALF_PI },
    { x: -8.0, z: 1.6, yaw: HALF_PI },
    { x: -8.0, z: 5.2, yaw: HALF_PI },
    { x: 8.0, z: -5.5, yaw: -HALF_PI },
    { x: 8.0, z: -2.0, yaw: -HALF_PI },
    { x: 8.0, z: 1.6, yaw: -HALF_PI },
    { x: 8.0, z: 5.2, yaw: -HALF_PI },
  ];
  for (const bed of beds) {
    drawBed(wallB, trimB, blockers, bed);
    // Bedside monitor.
    const mx = bed.x + (bed.x < 0 ? 1.55 : -1.55);
    trimB.box(mx - 0.2, bed.z - 0.15, mx + 0.2, bed.z + 0.15, 1.0, 1.45, c("#1a1f28"));
  }

  const floorSign = makeSign(bucket, 2.8, 0.55, "#1a3a44", "#e8f6f5");
  floorSign.draw("WARD", "");
  floorSign.mesh.position.set(0, 3.1, faceZ + 0.14);
  group.add(floorSign.mesh);

  const spots: StaffSpot[] = [
    ...beds.map(patientSpot),
    { x: 0, z: -2.0, yaw: 0, role: "always", uniform: "scrubs" },
    { x: -1.4, z: 0.2, yaw: HALF_PI, role: "day", uniform: "coat" },
    { x: 1.5, z: 0.3, yaw: -HALF_PI, role: "day", uniform: "scrubs" },
  ];
  const crowd = new OfficeCrowd(group, kit, { spots, graph: hallGraph(), walkers: 2 }, seed);
  const marker = caseMarkerMesh(bucket);
  group.add(marker);
  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ, beds, floorSign, caseMarker: marker, crowd };
}

function buildRoof(building: Building, bucket: Bucket, kit: StaffKit): FloorLayout {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const { floorB, wallB, trimB } = builders();
  const deck = c("#5a6570");
  const parapet = RED;
  floorB.ground(MIN_X, MIN_Z, MAX_X, MAX_Z, 0, deck);
  // Open roof: parapet only, no ceiling/walls from shell.
  for (const [x0, x1] of [
    [MIN_X, MIN_X + WALL_T],
    [MAX_X - WALL_T, MAX_X],
  ]) {
    wallB.box(x0, MIN_Z, x1, MAX_Z, 0, 1.1, parapet);
  }
  wallB.box(MIN_X, MIN_Z, MAX_X, MIN_Z + WALL_T, 0, 1.1, parapet);
  wallB.box(MIN_X, MAX_Z - WALL_T, MAX_X, MAX_Z, 0, 1.1, parapet);
  blockers.push({ minX: MIN_X, maxX: MIN_X + WALL_T, minZ: MIN_Z, maxZ: MAX_Z });
  blockers.push({ minX: MAX_X - WALL_T, maxX: MAX_X, minZ: MIN_Z, maxZ: MAX_Z });
  blockers.push({ minX: MIN_X, maxX: MAX_X, minZ: MIN_Z, maxZ: MIN_Z + WALL_T });
  blockers.push({ minX: MIN_X, maxX: MAX_X, minZ: MAX_Z - WALL_T, maxZ: MAX_Z });

  const faceZ = MIN_Z + WALL_T;
  elevatorDoors(wallB, trimB, faceZ);
  // Elevator overrun shaft.
  wallB.box(-4.6, faceZ, 4.6, faceZ + 2.8, 0, 3.2, c("#4a5560"));
  blockers.push({ minX: -4.6, maxX: 4.6, minZ: faceZ, maxZ: faceZ + 2.8 });

  // Helipad circle + H.
  floorB.ground(-5.5, -4.5, 5.5, 6.5, 0.02, c("#2a3038"));
  trimB.box(-4.2, -0.25, 4.2, 0.25, 0.03, 0.08, WHITE);
  trimB.box(-0.25, -3.2, 0.25, 3.2, 0.03, 0.08, WHITE);
  trimB.box(-4.4, -3.4, -3.9, 3.4, 0.03, 0.08, WHITE);
  trimB.box(3.9, -3.4, 4.4, 3.4, 0.03, 0.08, WHITE);

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
          [-6, 7],
          [0, 7],
          [6, 7],
          [-4, 2],
          [4, 2],
        ],
        edges: [
          [0, 1],
          [1, 2],
          [0, 3],
          [2, 4],
          [3, 4],
        ],
      },
      walkers: 1,
    },
    88,
  );
  const marker = caseMarkerMesh(bucket);
  group.add(marker);
  assemble(group, floorB, wallB, trimB, bucket);
  return { group, blockers, doorZ: faceZ, beds: [], floorSign, caseMarker: marker, crowd };
}

/** Multi-floor hospital with a doctor career loop (reception → elevator → patient bed). */
export function buildHospital(building: Building, getState: () => CityState | null = () => null): VenueInterior {
  // Older saves may still carry the 4-storey hospital; the career tower is always 10 (+ roof).
  if (building.floors < 10) building.floors = 10;
  const bucket: Bucket = [];
  const root = new THREE.Group();
  const seed = [...building.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 11);
  const kit = new StaffKit(bucket);

  const lobby = buildLobby(building, bucket, kit);
  const er = buildER(bucket, kit);
  const imaging = buildImaging(bucket, kit);
  const surgery = buildSurgery(bucket, kit);
  const wards = [4, 5, 6, 7, 8, 9].map((i) => buildWard(bucket, kit, seed + i * 17));
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
    layout.crowd.apply(seed + current * 101, 0.88, 0, false);
    refreshCase();
    return layout;
  };
  show(0);

  const elevator: OfficeElevator = {
    floors,
    floorNames,
    deskFloor: HOSPITAL_DESK_FLOOR,
    markLabel: () => {
      if (!activeCase) return null;
      return `Case · ${activeCase.bedLabel}`;
    },
    markFloor: () => (activeCase ? activeCase.floor : null),
    current: () => current,
    isRoof: (index) => index === roofIndex,
    near: (x, z) => {
      const { doorZ } = layouts[current];
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
    nearDesk: (x, z) => current === HOSPITAL_DESK_FLOOR && x > -4.0 && x < 4.0 && z > -2.6 && z < 0.8,
    nearExit: (x, z) => current === 0 && z > 9.6 && Math.abs(x) < 2.6,
    nearPatient: (x, z) => {
      if (!activeCase || activeCase.floor !== current) return false;
      const bed = layouts[current].beds[activeCase.bed];
      if (!bed) return false;
      return Math.hypot(x - bed.x, z - bed.z) < 2.4;
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
      if (marker.visible) marker.rotation.y += dt * 1.4;
    },
    dispose: () => {
      for (const item of bucket) item.dispose();
    },
  };
}
