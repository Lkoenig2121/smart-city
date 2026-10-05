import * as THREE from "three";
import { hash2, mulberry32, pick } from "@/lib/city/rng";

type Bucket = Array<{ dispose: () => void }>;

const HIP = 0.74;
const LOW = 0.06;
const HIGH = 0.92;

const SKINS = ["#f1d0b5", "#e2b894", "#c68e64", "#9a6440", "#6b4329"];
const HAIRS = ["#2b1d14", "#4a3222", "#8a5a32", "#1a1a1a", "#c8a060", "#7a7a7a"];
const SHIRTS = ["#f4f6f8", "#b9d3ea", "#2f4a6a", "#8d99a6", "#7a2f3a", "#3f6b55", "#d9c7a7", "#4b5563"];
const PANTS = ["#222831", "#2f3640", "#3d3a36", "#4a5160", "#1f2a44"];

interface Look {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
}

export interface StaffSpot {
  x: number;
  z: number;
  /** Rotation about y; 0 faces +z. */
  yaw: number;
  /** Seat height when the person sits here. */
  seat?: number;
  /**
   * Lie on a bed: body pitched back, feet at the root, head toward local -z.
   * Value is the mattress height.
   */
  lie?: number;
  /** Brings an office chair along (for desks that have none modelled). */
  chair?: boolean;
  /** The player's own desk: kept empty on the player's floor. */
  desk?: boolean;
  /** "staff" come and go with office hours; "day"/"night" swap at the reception desk; "always" stays put. */
  role?: "staff" | "day" | "night" | "always";
  uniform?: "guard" | "scrubs" | "coat" | "gown";
}

export interface WalkGraph {
  nodes: Array<[number, number]>;
  edges: Array<[number, number]>;
}

export interface CrowdSpec {
  spots: StaffSpot[];
  graph: WalkGraph;
  walkers: number;
}

/** Share of an office's people who are in at this minute of the day: full 9–5, a skeleton crew otherwise. */
export function officeBusyness(minuteOfDay: number) {
  const h = minuteOfDay / 60;
  if (h >= 9 && h < 17) return HIGH;
  if (h >= 8 && h < 9) return LOW + (HIGH - LOW) * (h - 8);
  if (h >= 17 && h < 18) return HIGH - (HIGH - LOW) * (h - 17);
  return LOW;
}

export const isAfterHours = (busy: number) => busy < 0.3;

/** Shared geometry and materials for every figure in one building. */
export class StaffKit {
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private geos = new Map<string, THREE.BufferGeometry>();

  constructor(private bucket: Bucket) {}

  mesh(key: string, make: () => THREE.BufferGeometry, color: string, x: number, y: number, z: number, parent: THREE.Object3D) {
    let geo = this.geos.get(key);
    if (!geo) {
      geo = make();
      this.geos.set(key, geo);
      this.bucket.push(geo);
    }
    let mat = this.mats.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
      this.mats.set(color, mat);
      this.bucket.push(mat);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
}

interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  thighs: THREE.Group[];
  shins: THREE.Group[];
  arms: THREE.Group[];
}

function buildRig(kit: StaffKit, look: Look, extra: "chair" | "cart" | null): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  kit.mesh("torso", () => new THREE.CapsuleGeometry(0.21, 0.36, 4, 8), look.shirt, 0, 1.08, 0, body);
  kit.mesh("head", () => new THREE.SphereGeometry(0.17, 12, 10), look.skin, 0, 1.66, 0, body);
  kit.mesh(
    "hair",
    () => new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    look.hair,
    0,
    1.7,
    -0.01,
    body,
  );

  const thighs: THREE.Group[] = [];
  const shins: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.1, HIP, 0);
    body.add(thigh);
    kit.mesh("thigh", () => new THREE.CapsuleGeometry(0.085, 0.22, 3, 6), look.pants, 0, -0.19, 0, thigh);
    const shin = new THREE.Group();
    shin.position.y = -0.37;
    thigh.add(shin);
    kit.mesh("shin", () => new THREE.CapsuleGeometry(0.075, 0.2, 3, 6), look.pants, 0, -0.17, 0, shin);
    kit.mesh("foot", () => new THREE.BoxGeometry(0.13, 0.08, 0.24), "#1a1410", 0, -0.33, 0.05, shin);
    const arm = new THREE.Group();
    arm.position.set(side * 0.28, 1.36, 0);
    body.add(arm);
    kit.mesh("arm", () => new THREE.CapsuleGeometry(0.06, 0.38, 3, 6), look.shirt, 0, -0.25, 0, arm);
    kit.mesh("hand", () => new THREE.SphereGeometry(0.06, 8, 6), look.skin, 0, -0.52, 0, arm);
    thighs.push(thigh);
    shins.push(shin);
    arms.push(arm);
  }

  if (extra === "chair") {
    const chair = "#2b2f36";
    kit.mesh("chair-seat", () => new THREE.BoxGeometry(0.5, 0.06, 0.48), chair, 0, 0.43, 0.02, root);
    kit.mesh("chair-back", () => new THREE.BoxGeometry(0.46, 0.5, 0.05), chair, 0, 0.8, -0.27, root);
    kit.mesh("chair-post", () => new THREE.BoxGeometry(0.06, 0.34, 0.06), "#6b7280", 0, 0.23, 0, root);
    kit.mesh("chair-base", () => new THREE.BoxGeometry(0.5, 0.04, 0.5), "#6b7280", 0, 0.03, 0, root);
  } else if (extra === "cart") {
    const yellow = "#e3b422";
    const dark = "#1f2328";
    kit.mesh("cart-base", () => new THREE.BoxGeometry(0.56, 0.06, 0.72), yellow, 0, 0.2, 0.88, root);
    for (const wx of [-0.26, 0.26]) {
      for (const wz of [0.6, 1.16]) {
        kit.mesh("cart-wheel", () => new THREE.BoxGeometry(0.06, 0.13, 0.13), dark, wx, 0.08, wz, root);
      }
      kit.mesh("cart-upright", () => new THREE.BoxGeometry(0.04, 0.78, 0.04), yellow, wx * 0.92, 0.6, 0.52, root);
    }
    kit.mesh("cart-handle", () => new THREE.BoxGeometry(0.52, 0.045, 0.045), dark, 0, 0.98, 0.5, root);
    kit.mesh("cart-can", () => new THREE.CylinderGeometry(0.25, 0.22, 0.76, 14), "#56606a", 0, 0.61, 0.92, root);
    kit.mesh("cart-rim", () => new THREE.CylinderGeometry(0.27, 0.27, 0.05, 14), "#3d444b", 0, 1.0, 0.92, root);
    kit.mesh("cart-bag", () => new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), dark, 0, 0.98, 0.92, root);
  }
  return { root, body, thighs, shins, arms };
}

function standPose(rig: Rig, armX = 0) {
  rig.body.position.y = 0;
  for (let i = 0; i < 2; i++) {
    rig.thighs[i].rotation.x = 0;
    rig.shins[i].rotation.x = 0;
    rig.arms[i].rotation.x = armX;
  }
}

function sitPose(rig: Rig, seat: number) {
  rig.body.position.y = seat - HIP;
  for (let i = 0; i < 2; i++) {
    rig.thighs[i].rotation.x = -Math.PI / 2;
    rig.shins[i].rotation.x = Math.PI / 2;
  }
}

/** How far the lying body sits above the mattress top so the back sinks into it. */
const LIE_LIFT = 0.06;

/** Flat on a mattress: root stays at the foot of the bed, head toward local -z. */
function liePose(rig: Rig, mattress: number) {
  standPose(rig, -0.15);
  rig.body.rotation.x = -Math.PI / 2;
  rig.body.rotation.z = 0;
  rig.body.rotation.y = 0;
  rig.body.position.set(0, mattress + LIE_LIFT, 0);
  for (let i = 0; i < 2; i++) {
    rig.arms[i].rotation.x = -0.15;
    rig.arms[i].rotation.z = i === 0 ? 0.35 : -0.35;
  }
}

function lookForUniform(base: Look, uniform: StaffSpot["uniform"] | undefined): Look {
  if (uniform === "guard") return { ...base, shirt: "#1f2a44", pants: "#1a1f2b" };
  if (uniform === "scrubs") return { ...base, shirt: "#5dade2", pants: "#2e86ab" };
  if (uniform === "coat") return { ...base, shirt: "#f4f6f8", pants: "#2f3640" };
  if (uniform === "gown") return { ...base, shirt: "#d5e3ee", pants: "#c5d5e2" };
  return base;
}

function turnToward(current: number, target: number, amount: number) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * Math.min(1, amount);
}

interface Walk {
  to: number;
  prev: number;
  pause: number;
  speed: number;
  phase: number;
}

interface Actor {
  rig: Rig;
  spot: StaffSpot | null;
  walk: Walk | null;
  janitor: boolean;
  offset: number;
}

const JANITOR_ARMS = -0.78;

/** Everyone who works on one office layout: desk workers, people standing around, walkers, and two janitors. */
export class OfficeCrowd {
  private spots: Actor[] = [];
  private walkers: Actor[] = [];
  private janitors: Actor[] = [];
  private adj: number[][];
  private rand: () => number;
  private time = 0;

  constructor(parent: THREE.Group, kit: StaffKit, private spec: CrowdSpec, seed: number) {
    this.rand = mulberry32(seed);
    const rand = this.rand;
    const { nodes, edges } = spec.graph;
    this.adj = nodes.map(() => []);
    for (const [a, b] of edges) {
      this.adj[a].push(b);
      this.adj[b].push(a);
    }
    const civilian = (): Look => ({
      shirt: pick(rand, SHIRTS),
      pants: pick(rand, PANTS),
      skin: pick(rand, SKINS),
      hair: pick(rand, HAIRS),
    });

    for (const spot of spec.spots) {
      const look = lookForUniform(civilian(), spot.uniform);
      const rig = buildRig(kit, look, spot.chair ? "chair" : null);
      rig.root.position.set(spot.x, 0, spot.z);
      rig.root.rotation.y = spot.yaw;
      if (spot.lie !== undefined) liePose(rig, spot.lie);
      else if (spot.seat !== undefined) sitPose(rig, spot.seat);
      else standPose(rig);
      rig.root.visible = false;
      parent.add(rig.root);
      this.spots.push({ rig, spot, walk: null, janitor: false, offset: rand() * 10 });
    }

    const spawnWalker = (janitor: boolean) => {
      const look = janitor ? { ...civilian(), shirt: "#2f6f73", pants: "#2a4a4d" } : civilian();
      const rig = buildRig(kit, look, janitor ? "cart" : null);
      const from = Math.floor(rand() * nodes.length);
      const walk: Walk = {
        to: this.nextNode(from, -1),
        prev: from,
        pause: rand() * 3,
        speed: janitor ? 0.7 : 1.1 + rand() * 0.4,
        phase: rand() * 6,
      };
      rig.root.position.set(nodes[from][0], 0, nodes[from][1]);
      standPose(rig, janitor ? JANITOR_ARMS : 0);
      rig.root.visible = false;
      parent.add(rig.root);
      return { rig, spot: null, walk, janitor, offset: rand() * 10 };
    };
    if (nodes.length > 1) {
      for (let i = 0; i < spec.walkers; i++) this.walkers.push(spawnWalker(false));
      for (let i = 0; i < 2; i++) this.janitors.push(spawnWalker(true));
    }
  }

  private nextNode(node: number, prev: number) {
    const options = this.adj[node];
    if (!options.length) return node;
    const fresh = options.filter((n) => n !== prev);
    return pick(this.rand, fresh.length ? fresh : options);
  }

  /** Decides who is in: `seed` varies the faces between floors that share this layout. */
  apply(seed: number, busy: number, janitorsHere: number, hideDesk: boolean) {
    const afterHours = isAfterHours(busy);
    this.spots.forEach((actor, i) => {
      const spot = actor.spot!;
      const role = spot.role ?? "staff";
      actor.rig.root.visible =
        role === "always"
          ? !(hideDesk && spot.desk)
          : role === "night"
            ? afterHours
            : role === "day"
              ? !afterHours
              : hash2(seed, i, 11) < busy && !(hideDesk && spot.desk);
    });
    this.walkers.forEach((actor, i) => {
      actor.rig.root.visible = hash2(seed, i, 29) < busy;
    });
    this.janitors.forEach((actor, i) => {
      actor.rig.root.visible = i < janitorsHere;
    });
  }

  update(dt: number) {
    this.time += dt;
    for (const actor of this.spots) {
      if (!actor.rig.root.visible) continue;
      const { rig, spot } = actor;
      const t = this.time + actor.offset;
      if (spot!.lie !== undefined) {
        rig.body.rotation.x = -Math.PI / 2;
        rig.body.rotation.y = 0;
        rig.body.rotation.z = 0;
        rig.body.position.y = spot!.lie + LIE_LIFT + Math.sin(t * 1.35) * 0.012;
        rig.arms[0].rotation.x = -0.15 + Math.sin(t * 0.7) * 0.02;
        rig.arms[1].rotation.x = -0.15 + Math.sin(t * 0.7 + 1.1) * 0.02;
      } else if (spot!.seat !== undefined) {
        const typing = spot!.chair ? -0.95 : -0.25;
        rig.arms[0].rotation.x = typing + Math.sin(t * 9) * 0.05;
        rig.arms[1].rotation.x = typing + Math.sin(t * 9 + 1.7) * 0.05;
        rig.body.rotation.y = Math.sin(t * 0.35) * 0.12;
      } else {
        rig.body.rotation.y = Math.sin(t * 0.5) * 0.18;
        rig.arms[0].rotation.x = Math.sin(t * 1.3) * 0.12;
      }
    }
    for (const actor of [...this.walkers, ...this.janitors]) {
      if (actor.rig.root.visible) this.step(actor, dt);
    }
  }

  private step(actor: Actor, dt: number) {
    const walk = actor.walk!;
    const { rig } = actor;
    const armRest = actor.janitor ? JANITOR_ARMS : 0;
    if (walk.pause > 0) {
      walk.pause -= dt;
      standPose(rig, armRest);
      return;
    }
    const [tx, tz] = this.spec.graph.nodes[walk.to];
    const pos = rig.root.position;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const dist = Math.hypot(dx, dz);
    const stride = walk.speed * dt;
    if (dist <= stride) {
      pos.set(tx, 0, tz);
      const here = walk.to;
      walk.to = this.nextNode(here, walk.prev);
      walk.prev = here;
      const lingers = actor.janitor ? this.rand() < 0.55 : this.rand() < 0.3;
      if (lingers) walk.pause = actor.janitor ? 3 + this.rand() * 5 : 1 + this.rand() * 3;
      return;
    }
    pos.x += (dx / dist) * stride;
    pos.z += (dz / dist) * stride;
    rig.root.rotation.y = turnToward(rig.root.rotation.y, Math.atan2(dx, dz), dt * 8);

    walk.phase += dt * walk.speed * 5.4;
    const swing = Math.sin(walk.phase) * (actor.janitor ? 0.38 : 0.5);
    rig.thighs[0].rotation.x = swing;
    rig.thighs[1].rotation.x = -swing;
    rig.shins[0].rotation.x = Math.max(0, swing) * 1.1 + 0.08;
    rig.shins[1].rotation.x = Math.max(0, -swing) * 1.1 + 0.08;
    rig.arms[0].rotation.x = actor.janitor ? armRest : -swing * 0.8;
    rig.arms[1].rotation.x = actor.janitor ? armRest : swing * 0.8;
    rig.body.position.y = Math.abs(Math.cos(walk.phase)) * 0.03;
  }
}
