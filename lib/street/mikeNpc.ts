import * as THREE from "three";

type Vec = { x: number; z: number };
type SpotId = "counter" | "phone" | "tools" | "lift";

interface Spot {
  at: Vec;
  yaw: number;
  /** Waypoints from this spot out to the shared hub by the east end of the counter. */
  toHub: Vec[];
}

const HUB: Vec = { x: 8.2, z: -3 };
const BEHIND_EAST: Vec = { x: 8.2, z: -7.4 };

const SPOTS: Record<SpotId, Spot> = {
  counter: { at: { x: 0, z: -7.4 }, yaw: 0, toHub: [BEHIND_EAST, HUB] },
  phone: { at: { x: 4.5, z: -7.7 }, yaw: Math.PI, toHub: [BEHIND_EAST, HUB] },
  tools: { at: { x: 8.75, z: 1.7 }, yaw: Math.PI / 2, toHub: [HUB] },
  lift: { at: { x: -6.1, z: 1.8 }, yaw: 0, toHub: [{ x: -6.1, z: -3 }, HUB] },
};

const BEHIND_COUNTER = new Set<SpotId>(["counter", "phone"]);
const PHONE_WALL = { x: 4.5, y: 1.55, z: -8.5 };
const WALK_SPEED = 1.7;

function route(from: SpotId, to: SpotId): Vec[] {
  const target = SPOTS[to].at;
  if (from === to) return [target];
  if (BEHIND_COUNTER.has(from) && BEHIND_COUNTER.has(to)) return [target];
  return [...SPOTS[from].toHub, ...[...SPOTS[to].toHub].reverse(), target];
}

function turnToward(current: number, target: number, amount: number) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * Math.min(1, amount);
}

/**
 * Mike, owner of the garage: minds the counter, works under the car on the
 * lift, digs through the tool chests, and answers the wall phone when it rings.
 */
export class MikeNpc {
  readonly group = new THREE.Group();
  private root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private thighs: THREE.Group[] = [];
  private shins: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private wrench: THREE.Mesh;
  private handset: THREE.Mesh;
  private wallHandset: THREE.Mesh;
  private disposables: Array<{ dispose: () => void }> = [];

  private spot: SpotId = "counter";
  private path: Vec[] = [];
  private dwell = 6;
  private t = 0;
  private stride = 0;
  private ringIn = 18 + Math.random() * 14;
  private ringing = false;
  private onCall = 0;

  constructor() {
    const mat = (color: string) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      this.disposables.push(m);
      return m;
    };
    const geo = <G extends THREE.BufferGeometry>(g: G) => {
      this.disposables.push(g);
      return g;
    };
    const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const coverall = mat("#2e4a72");
    const skin = mat("#d9a982");
    const cap = mat("#1f3a5c");
    const boot = mat("#2a1d14");
    const steel = mat("#9aa3ab");
    const black = mat("#1a1c20");
    const yellow = mat("#e8b923");

    this.group.add(this.root);
    this.root.add(this.body);
    add(geo(new THREE.CapsuleGeometry(0.23, 0.38, 4, 8)), coverall, 0, 1.08, 0, this.body);
    add(geo(new THREE.BoxGeometry(0.14, 0.07, 0.02)), mat("#f4f1ea"), 0.1, 1.24, 0.225, this.body);
    add(geo(new THREE.BoxGeometry(0.48, 0.06, 0.3)), mat("#3a2a1c"), 0, 0.82, 0, this.body);

    this.head.position.y = 1.5;
    this.body.add(this.head);
    add(geo(new THREE.SphereGeometry(0.17, 12, 10)), skin, 0, 0.16, 0, this.head);
    add(geo(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)), cap, 0, 0.2, 0, this.head);
    add(geo(new THREE.BoxGeometry(0.26, 0.03, 0.16)), cap, 0, 0.21, 0.17, this.head);
    add(geo(new THREE.BoxGeometry(0.2, 0.08, 0.05)), mat("#5a4030"), 0, 0.07, 0.15, this.head);

    for (const side of [-1, 1]) {
      const thigh = new THREE.Group();
      thigh.position.set(side * 0.11, 0.86, 0);
      this.body.add(thigh);
      add(geo(new THREE.CapsuleGeometry(0.09, 0.22, 3, 6)), coverall, 0, -0.19, 0, thigh);
      const shin = new THREE.Group();
      shin.position.y = -0.4;
      thigh.add(shin);
      add(geo(new THREE.CapsuleGeometry(0.08, 0.2, 3, 6)), coverall, 0, -0.18, 0, shin);
      add(geo(new THREE.BoxGeometry(0.14, 0.1, 0.26)), boot, 0, -0.36, 0.05, shin);
      const arm = new THREE.Group();
      arm.position.set(side * 0.3, 1.36, 0);
      this.body.add(arm);
      add(geo(new THREE.CapsuleGeometry(0.065, 0.38, 3, 6)), coverall, 0, -0.25, 0, arm);
      add(geo(new THREE.SphereGeometry(0.065, 8, 6)), skin, 0, -0.52, 0, arm);
      this.thighs.push(thigh);
      this.shins.push(shin);
      this.arms.push(arm);
    }

    this.wrench = add(geo(new THREE.BoxGeometry(0.04, 0.3, 0.06)), steel, 0, -0.62, 0.04, this.arms[1]);
    this.handset = add(geo(new THREE.BoxGeometry(0.06, 0.22, 0.07)), black, -0.02, -0.56, 0.04, this.arms[0]);

    // Wall phone behind the counter.
    add(geo(new THREE.BoxGeometry(0.3, 0.42, 0.1)), yellow, PHONE_WALL.x, PHONE_WALL.y, PHONE_WALL.z, this.group);
    this.wallHandset = add(
      geo(new THREE.BoxGeometry(0.08, 0.3, 0.08)),
      black,
      PHONE_WALL.x - 0.08,
      PHONE_WALL.y + 0.02,
      PHONE_WALL.z + 0.09,
      this.group,
    );

    const start = SPOTS.counter.at;
    this.root.position.set(start.x, 0, start.z);
    this.root.rotation.y = SPOTS.counter.yaw;
    this.pose();
  }

  private goTo(next: SpotId, dwell: number) {
    this.path = route(this.spot, next);
    this.spot = next;
    this.dwell = dwell;
  }

  private pickNext() {
    if (this.spot !== "counter") {
      this.goTo("counter", 8 + Math.random() * 8);
      return;
    }
    const next: SpotId = Math.random() < 0.65 ? "lift" : "tools";
    this.goTo(next, next === "lift" ? 10 + Math.random() * 8 : 5 + Math.random() * 3);
  }

  update(dt: number) {
    this.t += dt;

    if (!this.ringing && this.onCall <= 0) {
      this.ringIn -= dt;
      // Only pick up from a standstill so the walk route always starts at a known spot.
      if (this.ringIn <= 0 && !this.path.length) {
        this.ringing = true;
        this.goTo("phone", 0);
      }
    }

    const target = this.path[0];
    if (target) {
      const p = this.root.position;
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      const step = WALK_SPEED * dt;
      this.root.rotation.y = turnToward(this.root.rotation.y, Math.atan2(dx, dz), dt * 10);
      if (dist <= step) {
        p.x = target.x;
        p.z = target.z;
        this.path.shift();
      } else {
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
      }
      this.stride += dt * 7.5;
      this.walkPose();
    } else {
      this.root.rotation.y = turnToward(this.root.rotation.y, this.spotYaw(), dt * 6);
      if (this.spot === "phone") this.phoneTick(dt);
      else {
        this.dwell -= dt;
        if (this.dwell <= 0) this.pickNext();
      }
      this.pose();
    }

    this.wallHandset.visible = this.onCall <= 0;
    this.handset.visible = this.onCall > 0;
    this.wrench.visible = this.spot === "lift" && !this.path.length;
    const jiggle = this.ringing ? Math.sin(this.t * 55) * 0.012 : 0;
    this.wallHandset.position.x = PHONE_WALL.x - 0.08 + jiggle;
  }

  private spotYaw() {
    if (this.spot === "phone" && this.onCall > 0) return Math.PI / 2;
    return SPOTS[this.spot].yaw;
  }

  private phoneTick(dt: number) {
    if (this.ringing) {
      this.ringing = false;
      this.onCall = 7 + Math.random() * 6;
      return;
    }
    this.onCall -= dt;
    if (this.onCall <= 0) {
      this.onCall = 0;
      this.ringIn = 30 + Math.random() * 30;
      this.goTo("counter", 6 + Math.random() * 6);
    }
  }

  private walkPose() {
    const s = Math.sin(this.stride);
    this.body.position.y = Math.abs(Math.cos(this.stride)) * 0.035;
    this.body.rotation.x = 0;
    this.head.rotation.set(0, 0, 0);
    for (let i = 0; i < 2; i++) {
      const dir = i === 0 ? 1 : -1;
      this.thighs[i].rotation.x = s * 0.55 * dir;
      this.shins[i].rotation.x = Math.max(0, -s * dir) * 0.7;
      this.arms[i].rotation.set(-s * 0.45 * dir, 0, 0);
    }
    if (this.ringing) this.arms[0].rotation.x = -0.6;
  }

  private pose() {
    const t = this.t;
    this.body.position.y = 0;
    this.body.rotation.x = 0;
    this.head.rotation.set(0, 0, 0);
    for (let i = 0; i < 2; i++) {
      this.thighs[i].rotation.x = 0;
      this.shins[i].rotation.x = 0;
      this.arms[i].rotation.set(0, 0, 0);
    }
    const [left, right] = this.arms;
    switch (this.spot) {
      case "counter":
        // Writing up a work order, glancing up at the door now and then.
        left.rotation.x = -0.7;
        right.rotation.x = -0.8 + Math.sin(t * 6) * 0.08;
        right.rotation.z = Math.sin(t * 3) * 0.06;
        this.body.rotation.x = 0.12;
        this.head.rotation.x = Math.sin(t * 0.4) > 0.6 ? -0.1 : 0.35;
        this.head.rotation.y = Math.sin(t * 0.25) * 0.4;
        break;
      case "lift":
        // Wrench up into the undercarriage.
        this.head.rotation.x = -0.75;
        right.rotation.x = -2.7 + Math.sin(t * 5) * 0.18;
        right.rotation.z = Math.sin(t * 5) * 0.12;
        left.rotation.x = -2.4;
        left.rotation.z = 0.25;
        break;
      case "tools":
        // Bent over the open drawer, rummaging.
        this.body.rotation.x = 0.35;
        this.head.rotation.x = 0.3;
        left.rotation.x = -1.1 + Math.sin(t * 7) * 0.15;
        right.rotation.x = -1.0 + Math.sin(t * 7 + 1.4) * 0.15;
        break;
      case "phone":
        if (this.onCall > 0) {
          left.rotation.x = -2.35;
          left.rotation.z = 0.55;
          right.rotation.x = -0.5 + Math.max(0, Math.sin(t * 2.2)) * -0.6;
          right.rotation.z = Math.sin(t * 2.2) * 0.2;
          this.head.rotation.z = 0.18;
          this.head.rotation.x = Math.sin(t * 3.1) * 0.08;
        } else {
          left.rotation.x = -0.9;
        }
        break;
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const item of this.disposables) item.dispose();
  }
}
