import * as THREE from "three";
import { findStadium, hasGameToday } from "@/lib/city/stadium";
import type { Building, CityState } from "@/lib/city/types";
import { TILE } from "./buildCity";
import { buildStreetPerson, disposeObject3D } from "./streetPerson";

/** Valets work the gate from 4:30 PM until just after first pitch. */
const VALET_START = 16 * 60 + 30;
const VALET_END = 18 * 60 + 30;
const CARS = 7;
const SPACING = 6.2;
const CYCLE = 7;
const CAR_COLORS = ["#c0392b", "#1f4d8c", "#f4f1ea", "#2c3e50", "#7f8c8d", "#16a085", "#e8c36a", "#111418", "#8e44ad"];
const GUEST_SHIRTS = ["#1f4d8c", "#c0392b", "#f4f1ea", "#2c3e50", "#e67e22", "#27ae60"];
const VEST = { shirt: "#b3202a", pants: "#15171a", shoes: "#0c0c0c" };

interface ValetCar {
  root: THREE.Group;
  paint: THREE.MeshStandardMaterial;
}

function smooth(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Pre-game valet queue at the ballpark's street gate: cars inch up, guests hop out, valets drive off. */
export class ValetLine {
  readonly group = new THREE.Group();
  private stadiumId: string | null = null;
  private recheck = 0;
  private time = 0;
  private cars: ValetCar[] = [];
  private shared: Array<{ dispose: () => void }> = [];
  private guest: THREE.Group | null = null;
  private guestShirt: THREE.MeshStandardMaterial | null = null;
  private runner: THREE.Group | null = null;
  private headX = 0;
  private laneZ = 0;
  private curbZ = 0;
  private gateX = 0;
  private gateZ = 0;

  constructor(
    private state: CityState,
    private groundAt: (x: number, z: number) => number,
  ) {
    this.group.name = "valet-line";
    this.group.visible = false;
  }

  update(dt: number) {
    this.recheck -= dt;
    if (this.recheck <= 0) {
      this.recheck = 1;
      this.refresh();
    }
    if (!this.group.visible) return;
    this.time += dt;
    this.animate();
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
  }

  private refresh() {
    const stadium = findStadium(this.state);
    const minute = this.state.clock.minuteOfDay;
    const on = Boolean(stadium) && hasGameToday(this.state) && minute >= VALET_START && minute < VALET_END;
    if (on && stadium && stadium.id !== this.stadiumId) this.build(stadium);
    this.group.visible = on && this.cars.length > 0;
  }

  private clear() {
    disposeObject3D(this.group);
    for (const item of this.shared) item.dispose();
    this.shared = [];
    this.group.clear();
    this.cars = [];
    this.guest = null;
    this.guestShirt = null;
    this.runner = null;
  }

  private build(stadium: Building) {
    this.clear();
    this.stadiumId = stadium.id;
    const gateTileX = Math.floor(stadium.origin.x + stadium.width / 2);
    if (!this.state.tiles[stadium.origin.y - 1]?.[gateTileX]?.road) return;

    const wallZ = stadium.origin.y * TILE;
    this.gateX = (stadium.origin.x + stadium.width / 2) * TILE;
    this.gateZ = wallZ - 0.3;
    this.laneZ = wallZ - 3.6;
    this.curbZ = wallZ - 0.9;
    this.headX = this.gateX - 7;

    this.buildStand();
    for (let i = 0; i < CARS; i++) this.cars.push(this.buildCar());

    const attendant = buildStreetPerson(VEST);
    attendant.position.set(this.headX + 1.5, this.groundAt(this.headX + 1.5, this.curbZ + 0.6), this.curbZ + 0.6);
    attendant.rotation.y = Math.PI;
    this.group.add(attendant);

    this.runner = buildStreetPerson(VEST);
    this.group.add(this.runner);

    this.guest = buildStreetPerson({ shirt: GUEST_SHIRTS[0] });
    this.guest.traverse((obj) => {
      if (this.guestShirt || !(obj instanceof THREE.Mesh)) return;
      const mat = obj.material;
      if (mat instanceof THREE.MeshStandardMaterial && mat.color.getHexString() === GUEST_SHIRTS[0].slice(1)) {
        this.guestShirt = mat;
      }
    });
    this.group.add(this.guest);
  }

  private buildStand() {
    const x = this.headX + 1.5;
    const z = this.curbZ;
    const y = this.groundAt(x, z);
    const dark = new THREE.MeshStandardMaterial({ color: "#1c1f24", roughness: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: "#b3202a", roughness: 0.7 });
    const steel = new THREE.MeshStandardMaterial({ color: "#c9d0d6", roughness: 0.4, metalness: 0.6 });
    const cone = new THREE.MeshStandardMaterial({ color: "#ff7a1a", roughness: 0.6 });

    const podium = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.15, 0.55), dark);
    podium.position.set(x, y + 0.575, z);
    this.group.add(podium);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 2.2), red);
    canopy.position.set(x, y + 2.7, z);
    this.group.add(canopy);
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.7, 6);
    for (const [dx, dz] of [
      [-1.4, -1],
      [1.4, -1],
      [-1.4, 1],
      [1.4, 1],
    ]) {
      const pole = new THREE.Mesh(poleGeo, steel);
      pole.position.set(x + dx, y + 1.35, z + dz);
      this.group.add(pole);
    }

    const el = document.createElement("canvas");
    el.width = 512;
    el.height = 128;
    const ctx = el.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#b3202a";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#fff8e8";
      ctx.font = "bold 76px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("VALET", 256, 68);
    }
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.45,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), signMat);
    sign.position.set(x, y + 3.1, z - 1.12);
    sign.rotation.y = Math.PI;
    this.group.add(sign);
    this.shared.push(tex);

    const coneGeo = new THREE.ConeGeometry(0.2, 0.55, 10);
    for (let i = 0; i < 5; i++) {
      const cx = this.headX + 3.5 - i * SPACING;
      const c = new THREE.Mesh(coneGeo, cone);
      c.position.set(cx, this.groundAt(cx, this.laneZ - 1.9) + 0.275, this.laneZ - 1.9);
      this.group.add(c);
    }
  }

  private buildCar(): ValetCar {
    const root = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: CAR_COLORS[0], roughness: 0.42, metalness: 0.35 });
    const glass = new THREE.MeshStandardMaterial({ color: "#9ec5e8", roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.6 });
    const tire = new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 1.9), paint);
    body.position.y = 0.55;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 1.7), glass);
    cabin.position.set(-0.15, 1.05, 0);
    root.add(body, cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
    wheelGeo.rotateX(Math.PI / 2);
    for (const [wx, wz] of [
      [1.25, 0.85],
      [1.25, -0.85],
      [-1.25, 0.85],
      [-1.25, -0.85],
    ]) {
      const wheel = new THREE.Mesh(wheelGeo, tire);
      wheel.position.set(wx, 0.38, wz);
      root.add(wheel);
    }
    this.group.add(root);
    return { root, paint };
  }

  private animate() {
    const cycle = Math.floor(this.time / CYCLE);
    const t = (this.time % CYCLE) / CYCLE;
    const advance = smooth((t - 0.55) / 0.4);

    this.cars.forEach((car, i) => {
      let x: number;
      if (i === 0) {
        const pull = t > 0.35 ? ((t - 0.35) / 0.65) ** 2 * 40 : 0;
        x = this.headX + pull;
        car.root.visible = pull < 38;
      } else {
        x = this.headX - (i - advance) * SPACING;
        car.root.visible = true;
      }
      car.root.position.set(x, this.groundAt(x, this.laneZ), this.laneZ);
      car.paint.color.set(CAR_COLORS[(cycle + i) % CAR_COLORS.length]);
    });

    if (this.guest) {
      const walk = (t - 0.08) / 0.26;
      this.guest.visible = walk >= 0 && walk <= 1;
      if (this.guest.visible) {
        const fromX = this.headX;
        const fromZ = this.laneZ + 1.3;
        const x = fromX + (this.gateX - fromX) * walk;
        const z = fromZ + (this.gateZ - fromZ) * walk;
        this.guest.position.set(x, this.groundAt(x, z) + Math.abs(Math.sin(walk * 18)) * 0.04, z);
        this.guest.rotation.y = Math.atan2(this.gateX - fromX, this.gateZ - fromZ);
        this.guestShirt?.color.set(GUEST_SHIRTS[cycle % GUEST_SHIRTS.length]);
      }
    }

    if (this.runner) {
      const start = { x: this.headX + 2.4, z: this.curbZ + 0.4 };
      const corner = { x: this.headX + 2.7, z: this.laneZ - 1.3 };
      const door = { x: this.headX + 0.5, z: this.laneZ - 1.3 };
      let x = start.x;
      let z = start.z;
      let face = Math.PI;
      this.runner.visible = t < 0.32;
      if (t >= 0.08 && t < 0.2) {
        const k = (t - 0.08) / 0.12;
        x = start.x + (corner.x - start.x) * k;
        z = start.z + (corner.z - start.z) * k;
        face = Math.atan2(corner.x - start.x, corner.z - start.z);
      } else if (t >= 0.2) {
        const k = Math.min(1, (t - 0.2) / 0.1);
        x = corner.x + (door.x - corner.x) * k;
        z = corner.z;
        face = -Math.PI / 2;
      }
      const moving = t >= 0.08 && t < 0.3;
      this.runner.position.set(x, this.groundAt(x, z) + (moving ? Math.abs(Math.sin(t * 90)) * 0.05 : 0), z);
      this.runner.rotation.y = face;
    }
  }
}
