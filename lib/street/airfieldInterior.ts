import * as THREE from "three";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";

export interface AirfieldInterior {
  group: THREE.Group;
  blockers: Blocker[];
  spawn: { x: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  groundAt: (x: number, z: number) => number;
  /** Still inside the passage back to Mountain City. */
  nearCityMouth: (x: number, z: number) => boolean;
  /** Clear of the tunnel, out on the field. */
  onField: (x: number, z: number) => boolean;
  dispose: () => void;
}

const TUNNEL_END = 6;

/**
 * A service tunnel that opens onto a grass strip: two runways, taxiways, and
 * hangars. The player starts at the city end of the tunnel.
 */
export function buildAirfieldInterior(): AirfieldInterior {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const grass = new MeshBuilder();
  const asphalt = new MeshBuilder();
  const paint = new MeshBuilder();
  const concrete = new MeshBuilder();
  const wall = new MeshBuilder();
  const roof = new MeshBuilder();

  const g = new THREE.Color("#5ea34a");
  const gDark = new THREE.Color("#3f7a3a");
  const tar = new THREE.Color("#3a3d42");
  const white = new THREE.Color("#f4f1ea");
  const yellow = new THREE.Color("#e6c84a");
  const slab = new THREE.Color("#b7b3aa");
  const hangarWall = new THREE.Color("#e7e2d6");
  const hangarTrim = new THREE.Color("#2f4d3a");
  const hangarRoof = new THREE.Color("#6e7378");
  const hill = new THREE.Color("#6d7a62");
  const snow = new THREE.Color("#e4ebf2");
  const tunnelWall = new THREE.Color("#5a564f");
  const tunnelFloor = new THREE.Color("#4a463f");

  grass.ground(-90, -110, 90, TUNNEL_END + 1, 0, g);
  // Soft darker patches so the field isn't one flat color.
  grass.ground(-40, -90, -12, -60, 0.01, gDark);
  grass.ground(18, -40, 70, -8, 0.01, gDark);

  // Main runway, running away from the tunnel.
  asphalt.ground(-8, -104, 8, 2, 0.04, tar);
  // Crossing runway.
  asphalt.ground(-72, -58, 72, -46, 0.04, tar);
  // Taxiway from the tunnel apron to the hangars.
  asphalt.ground(-64, -24, 64, -16, 0.04, tar);
  asphalt.ground(-4, -24, 4, 2, 0.04, tar);

  paint.ground(-7.6, -104, -7.2, 2, 0.07, white);
  paint.ground(7.2, -104, 7.6, 2, 0.07, white);
  paint.ground(-72, -57.6, 72, -57.2, 0.07, white);
  paint.ground(-72, -46.8, 72, -46.4, 0.07, white);
  for (let z = -100; z < 0; z += 8) {
    paint.ground(-0.2, z, 0.2, z + 4, 0.07, white);
  }
  for (let x = -68; x < 68; x += 10) {
    paint.ground(x, -52.3, x + 5, -51.7, 0.07, yellow);
  }
  // Threshold bars.
  for (let i = -3; i <= 3; i++) {
    paint.ground(i * 2.1 - 0.5, -102, i * 2.1 + 0.5, -100.2, 0.08, white);
    paint.ground(i * 2.1 - 0.5, 0.2, i * 2.1 + 0.5, 1.8, 0.08, white);
  }

  // Tunnel from the city mouth (high z) out onto the strip.
  concrete.ground(-3.3, TUNNEL_END, 3.3, 36, 0.02, tunnelFloor);
  wall.box(-4.2, TUNNEL_END, -3.3, 36.4, 0, 4.6, tunnelWall);
  wall.box(3.3, TUNNEL_END, 4.2, 36.4, 0, 4.6, tunnelWall);
  wall.box(-4.2, 36, 4.2, 36.6, 0, 4.6, tunnelWall);
  wall.box(-4.2, TUNNEL_END, 4.2, 36.4, 4.15, 4.7, tunnelWall);
  blockers.push(
    { minX: -4.2, maxX: -3.3, minZ: TUNNEL_END, maxZ: 36.4 },
    { minX: 3.3, maxX: 4.2, minZ: TUNNEL_END, maxZ: 36.4 },
    { minX: -4.2, maxX: 4.2, minZ: 36, maxZ: 36.6 },
    { minX: -4.2, maxX: 4.2, minZ: TUNNEL_END, maxZ: 36.4, minY: 4.15 },
  );
  // A few ceiling lamps, as bright pads.
  for (const z of [12, 20, 28]) {
    concrete.box(-0.4, z, 0.4, z + 1.2, 3.9, 4.12, new THREE.Color("#fff1c2"));
  }

  const hangars: Array<[number, number, number]> = [
    [-58, -18, 1],
    [-58, -40, 1],
    [-58, -78, 1],
    [38, -18, -1],
    [38, -40, -1],
    [38, -78, -1],
  ];
  for (const [x, z, face] of hangars) {
    addHangar(wall, roof, concrete, blockers, x, z, face, hangarWall, hangarTrim, hangarRoof, slab);
  }

  // Distant ridges so the strip sits in a bowl outside town.
  for (const [x, z, w, d, h, cap] of [
    [-120, -40, 36, 180, 16, false],
    [100, -40, 36, 180, 18, false],
    [-20, -150, 200, 30, 14, true],
    [-40, 20, 160, 24, 12, true],
  ] as Array<[number, number, number, number, number, boolean]>) {
    wall.box(x, z, x + w, z + d, 0, h, hill);
    if (cap) wall.box(x + 4, z + 4, x + w - 4, z + d - 4, h - 0.2, h + 3, snow);
  }

  addMesh(group, grass, 0.95, disposables);
  addMesh(group, asphalt, 0.9, disposables);
  addMesh(group, paint, 0.55, disposables);
  addMesh(group, concrete, 0.75, disposables);
  addMesh(group, wall, 0.8, disposables);
  addMesh(group, roof, 0.7, disposables);

  const planes: Array<[number, number, number, string]> = [
    [-34, -12, Math.PI / 2, "#f4f1ea"],
    [-34, -36, Math.PI / 2, "#d8e4ee"],
    [34, -20, -Math.PI / 2, "#2f4d3a"],
    [34, -74, -Math.PI / 2, "#c9b8a0"],
  ];
  for (const [x, z, yaw, color] of planes) addPlane(group, disposables, x, z, yaw, color);

  return {
    group,
    blockers,
    spawn: { x: 0, z: 30, yaw: 0, pitch: 0 },
    bounds: { minX: -92, maxX: 92, minZ: -112, maxZ: 38 },
    groundAt: () => 0,
    nearCityMouth: (x, z) => z > 33.5 && Math.abs(x) < 3.6,
    onField: (_x, z) => z < TUNNEL_END - 0.5,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

function addHangar(
  wall: MeshBuilder,
  roof: MeshBuilder,
  floor: MeshBuilder,
  blockers: Blocker[],
  x: number,
  z: number,
  face: number,
  body: THREE.Color,
  trim: THREE.Color,
  roofColor: THREE.Color,
  slab: THREE.Color,
) {
  const w = 20;
  const d = 14;
  const h = 6.4;
  const x1 = x + w;
  const z1 = z + d;
  floor.ground(x, z, x1, z1, 0.03, slab);
  // Apron in front of the door.
  const doorX = face > 0 ? x1 : x;
  floor.ground(doorX, z + 1, doorX + face * 10, z1 - 1, 0.03, slab);

  wall.box(x, z, x1, z + 0.45, 0, h, body);
  wall.box(x, z1 - 0.45, x1, z1, 0, h, body);
  if (face > 0) {
    wall.box(x, z, x + 0.45, z1, 0, h, body);
    wall.box(x1 - 0.4, z, x1, z + 2.2, 0, h, trim);
    wall.box(x1 - 0.4, z1 - 2.2, x1, z1, 0, h, trim);
    wall.box(x1 - 0.4, z + 2.2, x1, z1 - 2.2, h - 1.3, h, trim);
    blockers.push(
      { minX: x, maxX: x + 0.45, minZ: z, maxZ: z1 },
      { minX: x1 - 0.4, maxX: x1, minZ: z, maxZ: z + 2.2 },
      { minX: x1 - 0.4, maxX: x1, minZ: z1 - 2.2, maxZ: z1 },
      { minX: x1 - 0.4, maxX: x1, minZ: z + 2.2, maxZ: z1 - 2.2, minY: h - 1.3 },
    );
  } else {
    wall.box(x1 - 0.45, z, x1, z1, 0, h, body);
    wall.box(x, z, x + 0.4, z + 2.2, 0, h, trim);
    wall.box(x, z1 - 2.2, x + 0.4, z1, 0, h, trim);
    wall.box(x, z + 2.2, x + 0.4, z1 - 2.2, h - 1.3, h, trim);
    blockers.push(
      { minX: x1 - 0.45, maxX: x1, minZ: z, maxZ: z1 },
      { minX: x, maxX: x + 0.4, minZ: z, maxZ: z + 2.2 },
      { minX: x, maxX: x + 0.4, minZ: z1 - 2.2, maxZ: z1 },
      { minX: x, maxX: x + 0.4, minZ: z + 2.2, maxZ: z1 - 2.2, minY: h - 1.3 },
    );
  }
  blockers.push(
    { minX: x, maxX: x1, minZ: z, maxZ: z + 0.45 },
    { minX: x, maxX: x1, minZ: z1 - 0.45, maxZ: z1 },
  );
  roof.gable(x - 0.3, z - 0.3, x1 + 0.3, z1 + 0.3, h - 0.05, 2.4, roofColor, "z");
}

function addPlane(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  x: number,
  z: number,
  yaw: number,
  color: string,
) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: "#2a3038", roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.45, 8.2), mat);
  body.position.y = 1.55;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.16, 1.7), mat);
  wing.position.set(0, 1.7, 0.4);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 1.3), dark);
  tail.position.set(0, 2.45, -3.5);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.9), mat);
  stab.position.set(0, 2.7, -3.55);
  const plane = new THREE.Group();
  plane.add(body, wing, tail, stab);
  plane.position.set(x, 0, z);
  plane.rotation.y = yaw;
  group.add(plane);
  for (const mesh of [body, wing, tail, stab]) {
    disposables.push(mesh.geometry);
  }
  disposables.push(mat, dark);
}

function addMesh(
  group: THREE.Group,
  builder: MeshBuilder,
  roughness: number,
  disposables: Array<{ dispose: () => void }>,
) {
  if (builder.empty) return;
  const geometry = builder.build();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  disposables.push(geometry, material);
}
