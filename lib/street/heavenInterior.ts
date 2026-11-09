import * as THREE from "three";
import type { Blocker } from "./buildCity";
import { MeshBuilder } from "./meshBuilder";

export interface HeavenInterior {
  group: THREE.Group;
  blockers: Blocker[];
  spawn: { x: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** One full turn of the four staircases. The world repeats by this height. */
  cycle: number;
  /** Radians per second the escalator carries a rider. */
  escalatorOmega: number;
  groundAt: (x: number, z: number, feetY?: number) => number;
  onEscalator: (x: number, z: number) => boolean;
  nearExit: (x: number, z: number) => boolean;
  nearHost: (x: number, z: number) => boolean;
  dispose: () => void;
}

const RISE = 3.4;
const PERIOD = RISE * 4;
const INNER = 4.2;
const OUTER = 7.4;
const TAU = Math.PI * 2;
const COPY_MIN = 0;
const COPY_MAX = 12;
const ES_IN = 9.2;
const ES_OUT = 13.15;
const ES_MID = (ES_IN + ES_OUT) / 2;
const ESCALATOR_OMEGA = 0.32;

/**
 * Open cloud. Circular white stairs, a spiral escalator that carries you
 * upward from a meadow that surrounds the start. One holy city stands in the north.
 */
export function buildHeavenInterior(): HeavenInterior {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const steps = new MeshBuilder();
  const white = new THREE.Color("#f7fbff");
  const mist = new THREE.Color("#e7f0fa");

  const cloudMat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const puff = new THREE.SphereGeometry(1, 12, 10);
  disposables.push(cloudMat, puff);

  const blockers: Blocker[] = [];
  for (let copy = COPY_MIN; copy <= COPY_MAX; copy++) {
    const base = copy * PERIOD;
    addLoop(steps, white, mist, base);
    addClouds(group, disposables, cloudMat, puff, base);
    blockers.push(
      { minX: -22.4, maxX: -16.4, minZ: 2.6, maxZ: 9.4, minY: base, maxY: base + 7.2 },
      { minX: -21.2, maxX: -14.6, minZ: -10.2, maxZ: -3.8, minY: base, maxY: base + 6.2 },
    );
  }
  addCloudDeck(group, disposables);
  addEscalator(group, disposables);
  addDistantClouds(group, disposables, puff);
  addHost(group, disposables);
  addSkyCrosses(group, disposables);
  addHolyCity(group, disposables);

  addMesh(group, steps, disposables);

  return {
    group,
    blockers,
    spawn: { x: -5.8, z: -5.8, yaw: -Math.PI / 2, pitch: 0 },
    bounds: { minX: -110, maxX: 110, minZ: -110, maxZ: 110 },
    cycle: PERIOD,
    escalatorOmega: ESCALATOR_OMEGA,
    groundAt: (x, z, feetY = 0) => standOn(surfaces(x, z), feetY),
    onEscalator: (x, z) => {
      const radius = Math.hypot(x, z);
      return radius > ES_IN + 0.25 && radius < ES_OUT - 0.25;
    },
    nearExit: (x, z) => Math.abs(x) < 1.5 && z > 2.15 && z < 3.7,
    nearHost: (x, z) => Math.hypot(x + 20, z - 6) < 7.5 || Math.hypot(x + 18, z + 7) < 6.5,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

function addLoop(steps: MeshBuilder, white: THREE.Color, mist: THREE.Color, base: number) {
  const band = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number) => {
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const run = alongX ? x1 - x0 : z1 - z0;
    const count = Math.max(2, Math.round(Math.abs(run) / 0.34));
    for (let i = 0; i < count; i++) {
      const t0 = i / count;
      const t1 = (i + 1) / count;
      const yA = base + y0 + (y1 - y0) * t0;
      const yB = base + y0 + (y1 - y0) * t1;
      const top = Math.max(yA, yB);
      if (alongX) {
        const a = x0 + run * t0;
        const b = x0 + run * t1;
        steps.box(Math.min(a, b), z0, Math.max(a, b), z1, top - 0.16, top, i % 2 === 0 ? white : mist);
      } else {
        const a = z0 + run * t0;
        const b = z0 + run * t1;
        steps.box(x0, Math.min(a, b), x1, Math.max(a, b), top - 0.16, top, i % 2 === 0 ? white : mist);
      }
    }
  };

  band(-INNER, -OUTER, INNER, -INNER, 0, RISE);
  band(INNER, -INNER, OUTER, INNER, RISE, RISE * 2);
  band(INNER, INNER, -INNER, OUTER, RISE * 2, RISE * 3);
  band(-OUTER, INNER, -INNER, -INNER, RISE * 3, RISE * 4);

  const pad = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    steps.box(x0, z0, x1, z1, base + y - 0.12, base + y, white);
  };
  pad(-OUTER, -OUTER, -INNER, -INNER, 0);
  pad(INNER, -OUTER, OUTER, -INNER, RISE);
  pad(INNER, INNER, OUTER, OUTER, RISE * 2);
  pad(-OUTER, INNER, -INNER, OUTER, RISE * 3);
  pad(-INNER, -INNER, INNER, INNER, 0);
  pad(-2.6, -10.6, 2.6, -7.45, 0);
}

/** Steps and escalator only. The meadow is the floor, and nothing below it can be reached. */
function standOn(locals: number[], feetY: number) {
  const stepUp = 0.28;
  const sink = 0.1;
  let best = -Infinity;
  if (feetY <= stepUp) best = 0;
  for (const local of locals) {
    for (let n = 0; n <= COPY_MAX; n++) {
      const y = local + n * PERIOD;
      if (y < 0) continue;
      if (y <= feetY + stepUp && y >= feetY - sink && y > best) best = y;
    }
  }
  if (best === -Infinity) return 0;
  return best;
}

function surfaces(x: number, z: number) {
  const found: number[] = [];
  if (x >= -INNER && x <= INNER && z >= -OUTER && z <= -INNER) {
    found.push(((x + INNER) / (INNER * 2)) * RISE);
  }
  if (x >= INNER && x <= OUTER && z >= -INNER && z <= INNER) {
    found.push(RISE + ((z + INNER) / (INNER * 2)) * RISE);
  }
  if (x >= -INNER && x <= INNER && z >= INNER && z <= OUTER) {
    found.push(RISE * 2 + ((INNER - x) / (INNER * 2)) * RISE);
  }
  if (x >= -OUTER && x <= -INNER && z >= -INNER && z <= INNER) {
    found.push(RISE * 3 + ((INNER - z) / (INNER * 2)) * RISE);
  }
  if (x >= -OUTER && x <= -INNER && z >= -OUTER && z <= -INNER) found.push(0);
  if (x >= INNER && x <= OUTER && z >= -OUTER && z <= -INNER) found.push(RISE);
  if (x >= INNER && x <= OUTER && z >= INNER && z <= OUTER) found.push(RISE * 2);
  if (x >= -OUTER && x <= -INNER && z >= INNER && z <= OUTER) found.push(RISE * 3);
  if (Math.abs(x) <= INNER && Math.abs(z) <= INNER) found.push(0);
  if (Math.abs(x) <= 2.6 && z <= -7.45 && z >= -10.6) found.push(0);
  const radius = Math.hypot(x, z);
  if (radius >= ES_IN && radius <= ES_OUT) found.push(beltHeight(beltAlong(x, z)));
  return found;
}

/** 0 at the south boarding lip, one full rise after a complete turn. */
function beltAlong(x: number, z: number) {
  let along = Math.PI - Math.atan2(x, z);
  if (along < 0) along += TAU;
  else if (along >= TAU) along -= TAU;
  return along;
}

function beltHeight(along: number) {
  return (along / TAU) * PERIOD;
}

function addClouds(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  material: THREE.Material,
  puff: THREE.BufferGeometry,
  base: number,
) {
  const spots: Array<[number, number, number, number]> = [
    [0, 0.85, 0, 2.6],
    [-1.8, 1.3, 1.6, 1.8],
    [2.1, 1.05, -1.4, 1.7],
    [0.4, 1.5, -2.2, 1.5],
    [-6, 0.9, -6, 2.3],
    [6, RISE + 0.8, -6, 2.1],
    [6, RISE * 2 + 0.8, 6, 2.2],
    [-6, RISE * 3 + 0.8, 6, 2.1],
    [-2, 1.6, -6.2, 1.5],
    [6.2, RISE + 1.4, 0, 1.6],
    [1.5, RISE * 2 + 1.3, 6.2, 1.5],
    [-6.2, RISE * 3 + 1.4, -1, 1.6],
    [0, 4.2, 5, 1.3],
    [-4, 8, -4, 1.4],
  ];
  for (const [x, y, z, scale] of spots) {
    const cloud = new THREE.Mesh(puff, material);
    cloud.position.set(x, base + y, z);
    cloud.scale.setScalar(scale);
    group.add(cloud);
  }

  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.09, 10, 22, Math.PI),
    new THREE.MeshBasicMaterial({ color: "#fffef8" }),
  );
  arch.position.set(0, base + 1.7, 3.15);
  group.add(arch);
  disposables.push(arch.geometry, arch.material);

  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.6),
    new THREE.MeshBasicMaterial({
      color: "#fffef6",
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  veil.position.set(0, base + 1.35, 3.15);
  group.add(veil);
  disposables.push(veil.geometry, veil.material as THREE.Material);
}

function addCloudDeck(group: THREE.Group, disposables: Array<{ dispose: () => void }>) {
  const deck = new THREE.Mesh(
    new THREE.CircleGeometry(280, 64),
    new THREE.MeshBasicMaterial({ color: "#6dbe8c" }),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = -0.04;
  group.add(deck);
  disposables.push(deck.geometry, deck.material);
}

function addEscalator(group: THREE.Group, disposables: Array<{ dispose: () => void }>) {
  const steps = 72;
  const copies = COPY_MAX - COPY_MIN + 1;
  const count = steps * copies;
  const stepGeo = new THREE.BoxGeometry(0.92, 0.14, ES_OUT - ES_IN);
  const noseGeo = new THREE.BoxGeometry(0.1, 0.05, ES_OUT - ES_IN - 0.2);
  const railGeo = new THREE.BoxGeometry(0.86, 0.07, 0.07);
  const glassGeo = new THREE.BoxGeometry(0.78, 0.82, 0.04);
  const stepMat = new THREE.MeshStandardMaterial({ color: "#f7fbff", roughness: 0.72 });
  const noseMat = new THREE.MeshStandardMaterial({
    color: "#f0d78c",
    emissive: "#8a6a2a",
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.55,
  });
  const railMat = noseMat;
  const glassMat = new THREE.MeshBasicMaterial({
    color: "#f7fbff",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const stepMesh = new THREE.InstancedMesh(stepGeo, stepMat, count);
  const noseMesh = new THREE.InstancedMesh(noseGeo, noseMat, count);
  const railMesh = new THREE.InstancedMesh(railGeo, railMat, count * 2);
  const glassMesh = new THREE.InstancedMesh(glassGeo, glassMat, count * 2);
  const dummy = new THREE.Object3D();
  let index = 0;
  for (let copy = COPY_MIN; copy <= COPY_MAX; copy++) {
    for (let i = 0; i < steps; i++) {
      const along = ((i + 0.5) / steps) * TAU;
      const height = copy * PERIOD + beltHeight(along);
      const theta = Math.PI - along;
      dummy.position.set(Math.sin(theta) * ES_MID, height - 0.07, Math.cos(theta) * ES_MID);
      dummy.rotation.set(0, theta, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stepMesh.setMatrixAt(index, dummy.matrix);
      dummy.position.y = height + 0.012;
      dummy.position.x = Math.sin(theta) * ES_MID + Math.cos(theta) * 0.38;
      dummy.position.z = Math.cos(theta) * ES_MID - Math.sin(theta) * 0.38;
      dummy.updateMatrix();
      noseMesh.setMatrixAt(index, dummy.matrix);
      let rail = 0;
      for (const radius of [ES_IN + 0.08, ES_OUT - 0.08]) {
        dummy.position.set(Math.sin(theta) * radius, height + 1.02, Math.cos(theta) * radius);
        dummy.updateMatrix();
        railMesh.setMatrixAt(index * 2 + rail, dummy.matrix);
        dummy.position.y = height + 0.48;
        dummy.updateMatrix();
        glassMesh.setMatrixAt(index * 2 + rail, dummy.matrix);
        rail += 1;
      }
      index += 1;
    }
  }
  for (const mesh of [stepMesh, noseMesh, railMesh, glassMesh]) {
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  disposables.push(stepGeo, noseGeo, railGeo, glassGeo, stepMat, noseMat, glassMat);
}

function addDistantClouds(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  puff: THREE.BufferGeometry,
) {
  const mist = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const far = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  disposables.push(mist, far);
  const banks: Array<[number, number, number, number]> = [
    [26, 3, 10, 7.5],
    [22, 8, -24, 8],
    [-28, 5, 16, 8.5],
    [-24, 11, -18, 7],
    [8, 6, 32, 9],
    [-10, 4, -34, 8],
    [34, 9, -6, 7.5],
    [-32, 7, -4, 8],
    [16, 14, 22, 6],
    [-18, 16, 24, 6.5],
    [0, 12, -28, 7],
    [30, 2, 24, 6],
  ];
  for (let copy = COPY_MIN; copy <= COPY_MAX; copy++) {
    const base = copy * PERIOD;
    for (const [x, y, z, scale] of banks) {
      const cloud = new THREE.Mesh(puff, Math.hypot(x, z) > 30 ? far : mist);
      cloud.position.set(x, base + y, z);
      cloud.scale.set(scale, scale * 0.62, scale);
      group.add(cloud);
    }
  }
}

function addHost(group: THREE.Group, disposables: Array<{ dispose: () => void }>) {
  const robe = new THREE.MeshStandardMaterial({ color: "#f7fbff", roughness: 0.84 });
  const gold = new THREE.MeshStandardMaterial({
    color: "#f0d78c",
    emissive: "#8a6828",
    emissiveIntensity: 0.45,
    roughness: 0.38,
    metalness: 0.62,
  });
  const skin = new THREE.MeshStandardMaterial({ color: "#f3d2b0", roughness: 0.7 });
  const wing = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });
  const shaftMat = new THREE.MeshBasicMaterial({
    color: "#fff6d8",
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const body = new THREE.CapsuleGeometry(0.32, 1.05, 4, 8);
  const head = new THREE.SphereGeometry(0.22, 12, 10);
  const halo = new THREE.TorusGeometry(0.34, 0.035, 8, 18);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const harp = new THREE.TorusGeometry(0.7, 0.045, 8, 16, Math.PI);
  const horn = new THREE.CylinderGeometry(0.05, 0.11, 0.7, 8);
  const shaft = new THREE.CylinderGeometry(0.7, 1.6, 16, 12, 1, true);
  disposables.push(robe, gold, skin, wing, shaftMat, body, head, halo, box, harp, horn, shaft);

  const michael = createAngel(body, head, halo, box, robe, gold, skin, wing, { sword: true });
  const gabriel = createAngel(body, head, halo, box, robe, gold, skin, wing, { trumpet: horn });
  const cherub = createAngel(body, head, halo, box, robe, gold, skin, wing, {});
  const harpGroup = createHarp(harp, box, gold);
  const crown = createCrown(halo, box, gold);
  const dove = createDove(head, box, wing);

  placeFigure(group, michael, -20, 0, 6, Math.PI / 2, 3);
  placeFigure(group, gabriel, -18, 0, -7, Math.atan2(18, 7), 2.35);
  placeFigure(group, cherub, -15.2, 2.1, 2.2, 0.4, 1.05);
  placeFigure(group, cherub, -15.6, 2.5, 9.2, 0.9, 0.95);
  placeFigure(group, harpGroup, -16.4, 0, -0.6, 0.6, 1.35);
  placeFigure(group, crown, -20, 6.4, 6, 0, 1.15);
  placeFigure(group, dove, -13.5, 4.2, 4.5, 0.8, 1);
  placeFigure(group, dove, -12.4, 5.1, 8.4, -0.4, 0.85);
  placeFigure(group, dove, -17, 4.6, -3.2, 1.2, 0.9);
  const light = new THREE.Mesh(shaft, shaftMat);
  light.position.set(-20, 8, 6);
  group.add(light);
}

/** Latin cross. Only yaw is applied later, so the upright never leans. */
function latinCross(beam: THREE.BufferGeometry, material: THREE.Material, height: number) {
  const cross = new THREE.Group();
  const upright = new THREE.Mesh(beam, material);
  upright.scale.set(height * 0.14, height, height * 0.08);
  upright.position.y = height / 2;
  cross.add(upright);
  const bar = new THREE.Mesh(beam, material);
  bar.scale.set(height * 0.64, height * 0.13, height * 0.08);
  bar.position.y = height * 0.72;
  cross.add(bar);
  return cross;
}

function addSkyCrosses(group: THREE.Group, disposables: Array<{ dispose: () => void }>) {
  const gold = new THREE.MeshStandardMaterial({
    color: "#f0d48a",
    emissive: "#8a6828",
    emissiveIntensity: 0.5,
    metalness: 0.45,
    roughness: 0.35,
  });
  const white = new THREE.MeshStandardMaterial({
    color: "#fffaf2",
    emissive: "#fff4d2",
    emissiveIntensity: 0.28,
    roughness: 0.55,
  });
  const beam = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(gold, white, beam);
  const spots: Array<[number, number, number, number, number, boolean]> = [
    [0, 16, 24, 8, 0, true],
    [22, 22, 6, 5.5, 0.4, false],
    [-18, 18, -12, 7, 0.2, true],
    [14, 30, -16, 4.5, 1.1, false],
    [-10, 34, 14, 6, 0.5, true],
    [28, 14, -4, 9, 0, true],
    [-28, 24, 8, 6.5, 0.8, false],
    [8, 40, -6, 5, 0.3, true],
    [-6, 12, 30, 10, 0, true],
    [32, 28, 18, 5, 1.2, false],
    [-32, 16, -20, 7, 0.6, true],
    [16, 42, 12, 8, 0, true],
    [-14, 26, 20, 4.5, 0.15, false],
    [4, 20, -28, 9, 0, true],
    [-24, 36, 16, 5.5, 0.9, true],
    [20, 18, 28, 6, 0.4, false],
    [0, 28, 8, 4, 0.2, true],
    [-8, 22, -26, 7.5, 0, false],
    [26, 34, -14, 5, 0.7, true],
    [-20, 14, 24, 6, 0.3, true],
    [10, 48, 0, 11, 0, true],
    [-4, 18, 18, 3.5, 0.5, false],
  ];
  for (const [x, y, z, height, yaw, isGold] of spots) {
    const cross = latinCross(beam, isGold ? gold : white, height);
    cross.position.set(x, y, z);
    cross.rotation.y = yaw;
    group.add(cross);
  }
}

function placeFigure(
  group: THREE.Group,
  template: THREE.Group,
  x: number,
  y: number,
  z: number,
  rotY: number,
  scale: number,
) {
  const figure = template.clone();
  figure.position.set(x, y, z);
  figure.rotation.y = rotY;
  figure.scale.setScalar(scale);
  group.add(figure);
}

function createAngel(
  body: THREE.BufferGeometry,
  head: THREE.BufferGeometry,
  halo: THREE.BufferGeometry,
  box: THREE.BufferGeometry,
  robe: THREE.Material,
  gold: THREE.Material,
  skin: THREE.Material,
  wing: THREE.Material,
  gear: { sword?: boolean; trumpet?: THREE.BufferGeometry },
) {
  const figure = new THREE.Group();
  const robeMesh = new THREE.Mesh(body, robe);
  robeMesh.position.y = 0.845;
  figure.add(robeMesh);
  const plate = new THREE.Mesh(box, gold);
  plate.scale.set(0.52, 0.42, 0.18);
  plate.position.set(0, 1.15, 0.16);
  figure.add(plate);
  const face = new THREE.Mesh(head, skin);
  face.position.y = 1.78;
  figure.add(face);
  const hair = new THREE.Mesh(head, gold);
  hair.scale.set(1.05, 0.7, 1.05);
  hair.position.y = 1.96;
  figure.add(hair);
  const ring = new THREE.Mesh(halo, gold);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2.28;
  figure.add(ring);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const feather = new THREE.Mesh(box, wing);
      feather.scale.set(0.07, 0.42 + i * 0.16, 0.22);
      feather.position.set(side * (0.42 + i * 0.22), 1.22 + i * 0.2, -0.08);
      feather.rotation.z = side * -(0.2 + i * 0.14);
      figure.add(feather);
    }
  }
  if (gear.sword) {
    const cross = latinCross(box, gold, 1.7);
    cross.position.set(0.62, 0.05, 0.22);
    figure.add(cross);
  }
  if (gear.trumpet) {
    const trumpet = new THREE.Mesh(gear.trumpet, gold);
    trumpet.rotation.z = Math.PI / 2;
    trumpet.position.set(0.42, 1.55, 0.28);
    figure.add(trumpet);
  }
  return figure;
}

function createHarp(frame: THREE.BufferGeometry, box: THREE.BufferGeometry, gold: THREE.Material) {
  const harp = new THREE.Group();
  const bow = new THREE.Mesh(frame, gold);
  bow.rotation.y = Math.PI / 2;
  bow.position.y = 0.85;
  harp.add(bow);
  for (let i = 0; i < 4; i++) {
    const string = new THREE.Mesh(box, gold);
    string.scale.set(0.02, 0.7 - i * 0.08, 0.02);
    string.position.set(0, 0.7, -0.28 + i * 0.16);
    harp.add(string);
  }
  return harp;
}

function createCrown(halo: THREE.BufferGeometry, box: THREE.BufferGeometry, gold: THREE.Material) {
  const crown = new THREE.Group();
  const band = new THREE.Mesh(halo, gold);
  band.rotation.x = Math.PI / 2;
  crown.add(band);
  for (const x of [-0.22, 0, 0.22]) {
    const point = new THREE.Mesh(box, gold);
    point.scale.set(0.06, 0.22, 0.06);
    point.position.set(x, 0.12, 0);
    crown.add(point);
  }
  return crown;
}

function createDove(body: THREE.BufferGeometry, box: THREE.BufferGeometry, wing: THREE.Material) {
  const dove = new THREE.Group();
  const torso = new THREE.Mesh(body, wing);
  torso.scale.set(0.28, 0.16, 0.42);
  dove.add(torso);
  for (const side of [-1, 1]) {
    const feather = new THREE.Mesh(box, wing);
    feather.scale.set(0.55, 0.04, 0.22);
    feather.position.set(side * 0.32, 0.04, 0);
    feather.rotation.z = side * -0.4;
    dove.add(feather);
  }
  return dove;
}

const GIANT = 4.4;
const VISTA_Z = 22 + 34 * GIANT;

/** One holy city, large enough to fill the northern sky, sitting on the starting meadow. */
function addHolyCity(group: THREE.Group, disposables: Array<{ dispose: () => void }>) {
  const vista = new THREE.Group();
  const city = new MeshBuilder();
  const white = new THREE.Color("#f7f4ff");
  const pearl = new THREE.Color("#fffdf8");
  const gold = new THREE.Color("#f0d48a");
  const meadow = new THREE.Color("#7ecf98");
  const grass = new THREE.Color("#3e9a62");
  const jasper = new THREE.Color("#8ed0b4");
  const bark = new THREE.Color("#8a5a32");

  city.box(-22, -34, 22, 16, 0, 0.4, grass);
  city.box(-18, -30, 18, 12, 0.4, 0.72, meadow);
  city.box(-7.2, -32, -2.2, 1, 0.72, 0.9, gold);
  city.box(2.2, -32, 7.2, 1, 0.72, 0.9, gold);
  city.box(-17.2, -4, -15.4, 13, 0.72, 3.1, jasper);
  city.box(15.4, -4, 17.2, 13, 0.72, 3.1, jasper);
  city.box(-16, -2, 16, 15, 0.72, 2.5, white);
  city.box(-12, 0, 12, 13, 2.5, 4.5, pearl);
  city.box(-14, 1, -8, 9, 2.5, 5.4, pearl);
  city.box(8, 1, 14, 9, 2.5, 5.4, pearl);
  city.box(-7, 2, 7, 11, 4.5, 6.8, white);
  city.box(-3.4, 3.2, 3.4, 9.4, 6.8, 11.4, pearl);
  city.gable(-4.2, 2.8, 4.2, 9.8, 11.4, 1.5, gold, "z");
  city.box(-0.45, 5.4, 0.45, 6.5, 12.6, 13.15, gold);
  city.box(-1.15, -2.08, 1.15, -1.85, 0.9, 2.45, gold);
  city.box(-1.7, 3.05, -0.45, 3.35, 8.1, 9.3, gold);
  city.box(0.45, 3.05, 1.7, 3.35, 8.1, 9.3, gold);
  city.box(10.4, -12, 11.5, -10.8, 0.72, 3.3, bark);

  const cityGeo = city.build();
  const cityMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74 });
  vista.add(new THREE.Mesh(cityGeo, cityMat));
  disposables.push(cityGeo, cityMat);

  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 30),
    new THREE.MeshBasicMaterial({
      color: "#d8f6ff",
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, 0.98, -15);
  vista.add(river);
  const fall = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 3.6),
    new THREE.MeshBasicMaterial({
      color: "#fff6d0",
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  fall.position.set(0, 2.7, -2);
  fall.rotation.y = Math.PI;
  vista.add(fall);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(16, 28),
    new THREE.MeshBasicMaterial({
      color: "#fff4c8",
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glow.position.set(0, 7.2, 12);
  vista.add(glow);
  const star = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 8),
    new THREE.MeshBasicMaterial({ color: "#fff6c2" }),
  );
  star.position.set(0, 12.3, 4);
  vista.add(star);
  disposables.push(river.geometry, river.material, fall.geometry, fall.material, glow.geometry, glow.material, star.geometry, star.material);

  const bowColors = ["#ff5d6e", "#ff9a3c", "#ffe56a", "#7dde98", "#7ec8ff", "#6d7ae6", "#c58cff"];
  bowColors.forEach((color, band) => {
    const bow = new THREE.Mesh(
      new THREE.TorusGeometry(9.2 + band * 0.28, 0.16, 6, 48, Math.PI),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    bow.position.set(0, 1.15, 2);
    vista.add(bow);
    disposables.push(bow.geometry, bow.material);
  });

  const cypressGeo = new THREE.ConeGeometry(1, 1, 6);
  const pineGeo = new THREE.ConeGeometry(1, 1, 6);
  const bloomGeo = new THREE.SphereGeometry(1, 8, 6);
  const fruitGeo = new THREE.SphereGeometry(1, 8, 6);
  const cypressMat = new THREE.MeshStandardMaterial({ color: "#1d6a40", roughness: 0.86 });
  const pineMat = new THREE.MeshStandardMaterial({ color: "#2f8f55", roughness: 0.84 });
  const bloomMat = new THREE.MeshStandardMaterial({ color: "#f3a0c4", roughness: 0.7 });
  const fruitMat = new THREE.MeshStandardMaterial({
    color: "#f0d48a",
    emissive: "#8a6820",
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });
  const cypress: Array<[number, number, number, number]> = [];
  const pines: Array<[number, number, number, number]> = [];
  const blooms: Array<[number, number, number]> = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      cypress.push([side * (9 + (i % 2) * 2.2), -8 - i * 4.4, 6.4 + (i % 3) * 0.4, 1.15]);
      pines.push([side * (13.5 + (i % 2)), -6 - i * 4.8, 4.2, 2.1]);
    }
    blooms.push([side * 6.5, -16, 1.5], [side * 11, -22, 1.25], [side * 4.2, -24, 1.1]);
  }
  layOnce(vista, disposables, cypressGeo, cypressMat, cypress, (x, z, height, radius) => [
    x,
    0.72 + height / 2,
    z,
    radius,
    height,
    radius,
  ]);
  layOnce(vista, disposables, pineGeo, pineMat, pines, (x, z, height, radius) => [
    x,
    0.72 + height / 2,
    z,
    radius,
    height,
    radius,
  ]);
  layOnce(vista, disposables, bloomGeo, bloomMat, blooms, (x, z, scale) => [
    x,
    1.5 + scale * 0.2,
    z,
    scale,
    scale * 0.75,
    scale,
  ]);
  layOnce(vista, disposables, fruitGeo, fruitMat, [
    [10.9, 3.6, -11.4, 0.28],
    [11.6, 4.1, -11.1, 0.22],
    [10.2, 4.3, -11.6, 0.2],
    [11.2, 4.7, -10.7, 0.24],
  ], (x, y, z, scale) => [x, y, z, scale, scale, scale]);

  const hide = new THREE.MeshStandardMaterial({ color: "#c4884a", roughness: 0.78 });
  const hoof = new THREE.MeshStandardMaterial({ color: "#6b3e22", roughness: 0.8 });
  const wool = new THREE.MeshStandardMaterial({ color: "#fffaf2", roughness: 0.9 });
  const deer = createDeer(hide, hoof, disposables);
  const lamb = createLamb(wool, hoof, disposables);
  const wing = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const bird = createDove(new THREE.SphereGeometry(1, 8, 6), new THREE.BoxGeometry(1, 1, 1), wing);
  disposables.push(hide, hoof, wool, wing, bird.children[0].geometry as THREE.BufferGeometry);
  const birdBox = (bird.children[1] as THREE.Mesh).geometry;
  disposables.push(birdBox);
  placeFigure(vista, deer, -8.5, 0.72, -18, 0.7, 1.6);
  placeFigure(vista, lamb, 7.4, 0.72, -13, -0.4, 1.3);
  placeFigure(vista, bird, -5, 7.9, -2, 0.4, 1.15);
  placeFigure(vista, bird, 6, 9.1, 3, -0.8, 1);
  placeFigure(vista, bird, 13, 6.9, -16, 1.1, 0.9);

  const crossGold = new THREE.MeshStandardMaterial({
    color: "#f0d48a",
    emissive: "#8a6828",
    emissiveIntensity: 0.5,
    metalness: 0.45,
    roughness: 0.35,
  });
  const crossBeam = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(crossGold, crossBeam);
  for (const [x, y, z, height] of [
    [0, 16, 4, 3.2],
    [-12, 14, -6, 2.4],
    [11, 15, -2, 2.6],
    [-4, 18, 10, 2.1],
    [6, 13, -16, 2.2],
  ] as Array<[number, number, number, number]>) {
    const cross = latinCross(crossBeam, crossGold, height);
    cross.position.set(x, y, z);
    vista.add(cross);
  }

  vista.scale.setScalar(GIANT);
  vista.position.set(0, 0, VISTA_Z);
  group.add(vista);
}

function layOnce<T extends number[]>(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  spots: T[],
  place: (...args: T) => [number, number, number, number, number, number],
) {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach((spot, index) => {
    const [x, y, z, sx, sy, sz] = place(...spot);
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.frustumCulled = false;
  group.add(mesh);
  disposables.push(geometry, material);
}

function createDeer(
  hide: THREE.Material,
  hoof: THREE.Material,
  disposables: Array<{ dispose: () => void }>,
) {
  const deer = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(0.95, 0.42, 0.36);
  const legGeo = new THREE.BoxGeometry(0.08, 0.48, 0.08);
  const headGeo = new THREE.SphereGeometry(0.16, 8, 6);
  disposables.push(bodyGeo, legGeo, headGeo);
  const body = new THREE.Mesh(bodyGeo, hide);
  body.position.set(0, 0.68, 0);
  deer.add(body);
  const neck = new THREE.Mesh(bodyGeo, hide);
  neck.scale.set(0.28, 0.9, 0.45);
  neck.position.set(0.42, 0.95, 0);
  neck.rotation.z = -0.7;
  deer.add(neck);
  const head = new THREE.Mesh(headGeo, hide);
  head.position.set(0.66, 1.18, 0);
  deer.add(head);
  for (const x of [-0.28, 0.28]) {
    for (const z of [-0.1, 0.1]) {
      const leg = new THREE.Mesh(legGeo, hoof);
      leg.position.set(x, 0.24, z);
      deer.add(leg);
    }
  }
  return deer;
}

function createLamb(
  wool: THREE.Material,
  hoof: THREE.Material,
  disposables: Array<{ dispose: () => void }>,
) {
  const lamb = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.34, 10, 8);
  const headGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const legGeo = new THREE.BoxGeometry(0.07, 0.28, 0.07);
  disposables.push(bodyGeo, headGeo, legGeo);
  const body = new THREE.Mesh(bodyGeo, wool);
  body.scale.set(1.25, 0.85, 0.9);
  body.position.y = 0.48;
  lamb.add(body);
  const head = new THREE.Mesh(headGeo, wool);
  head.position.set(0.38, 0.62, 0);
  lamb.add(head);
  for (const x of [-0.16, 0.16]) {
    for (const z of [-0.1, 0.1]) {
      const leg = new THREE.Mesh(legGeo, hoof);
      leg.position.set(x, 0.14, z);
      lamb.add(leg);
    }
  }
  return lamb;
}

function addMesh(group: THREE.Group, builder: MeshBuilder, disposables: Array<{ dispose: () => void }>) {
  if (builder.empty) return;
  const geometry = builder.build();
  const material = new THREE.MeshStandardMaterial({ color: "#f4f8fc", vertexColors: true, roughness: 0.92 });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  disposables.push(geometry, material);
}
