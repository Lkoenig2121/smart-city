import * as THREE from "three";
import type { Building, Tile } from "@/lib/city/types";
import { TILE } from "./buildCity";

const WALL_INSET = 0.55;
const DOOR_W = 4.8;
const DOOR_H = 3.3;
const OPEN_RADIUS = 18;
const REARM_RADIUS = 10;

type Face = { nx: number; nz: number; x: number; z: number; width: number };

/** The building wall with the most road frontage; ties prefer south, east, west, north. */
function streetFace(building: Building, tiles: Tile[][]): Face {
  const { x: ox, y: oy } = building.origin;
  const { width: w, depth: d } = building;
  const x0 = ox * TILE + WALL_INSET;
  const z0 = oy * TILE + WALL_INSET;
  const x1 = (ox + w) * TILE - WALL_INSET;
  const z1 = (oy + d) * TILE - WALL_INSET;
  const road = (tx: number, ty: number) => (tiles[ty]?.[tx]?.road ? 1 : 0);
  const count = (n: number, at: (i: number) => [number, number]) => {
    let c = 0;
    for (let i = 0; i < n; i++) c += road(...at(i));
    return c;
  };
  const faces: Array<Face & { roads: number }> = [
    { nx: 0, nz: 1, x: (x0 + x1) / 2, z: z1, width: x1 - x0, roads: count(w, (i) => [ox + i, oy + d]) },
    { nx: 1, nz: 0, x: x1, z: (z0 + z1) / 2, width: z1 - z0, roads: count(d, (j) => [ox + w, oy + j]) },
    { nx: -1, nz: 0, x: x0, z: (z0 + z1) / 2, width: z1 - z0, roads: count(d, (j) => [ox - 1, oy + j]) },
    { nx: 0, nz: -1, x: (x0 + x1) / 2, z: z0, width: x1 - x0, roads: count(w, (i) => [ox + i, oy - 1]) },
  ];
  return faces.reduce((best, face) => (face.roads > best.roads ? face : best));
}

/**
 * Roll-up service door on Mike's street-facing wall. It lifts whenever your
 * car is nearby; nosing into the open bay counts as driving in.
 */
export class GarageDoor {
  readonly group = new THREE.Group();
  private panel = new THREE.Group();
  private open = 0;
  private armed = true;
  private readonly face: Face;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(building: Building, name: string, tiles: Tile[][]) {
    this.face = streetFace(building, tiles);
    const { nx, nz } = this.face;
    this.group.name = "garage-door";
    this.group.position.set(this.face.x, 0, this.face.z);
    this.group.rotation.y = Math.atan2(nx, nz);

    const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, parent = this.group) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      this.disposables.push(geo, mat);
      return mesh;
    };

    // Everything below is in door space: x along the wall, +z out toward the street.
    box(DOOR_W, DOOR_H, 0.04, "#0d0e10", 0, DOOR_H / 2, 0.03);
    box(0.34, DOOR_H + 0.3, 0.36, "#2c2f33", -DOOR_W / 2 - 0.17, (DOOR_H + 0.3) / 2, 0.18);
    box(0.34, DOOR_H + 0.3, 0.36, "#2c2f33", DOOR_W / 2 + 0.17, (DOOR_H + 0.3) / 2, 0.18);
    box(DOOR_W + 0.68, 0.5, 0.5, "#2c2f33", 0, DOOR_H + 0.25, 0.25);
    box(DOOR_W + 0.4, 0.03, 1.2, "#e8b923", 0, 0.03, 0.75);

    this.panel.position.set(0, DOOR_H, 0.12);
    this.group.add(this.panel);
    const slats = 12;
    const h = DOOR_H / slats;
    for (let i = 0; i < slats; i++) {
      box(DOOR_W - 0.04, h - 0.03, 0.08, i % 2 ? "#c9cfd6" : "#b8bec6", 0, -h * (i + 0.5), 0, this.panel);
    }
    box(DOOR_W - 0.04, 0.12, 0.12, "#3a3d40", 0, -DOOR_H + 0.06, 0.02, this.panel);

    const el = document.createElement("canvas");
    el.width = 1024;
    el.height = 160;
    const ctx = el.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1f3a5c";
      ctx.fillRect(0, 0, el.width, el.height);
      ctx.fillStyle = "#e8b923";
      ctx.fillRect(0, el.height - 14, el.width, 14);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 72px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name.toUpperCase(), el.width / 2, el.height / 2 - 6, el.width - 40);
    }
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    const signW = Math.min(8.2, this.face.width - 0.4);
    const signGeo = new THREE.PlaneGeometry(signW, signW * (160 / 1024));
    const signMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.55,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, DOOR_H + 1.25, 0.05);
    this.group.add(sign);
    this.disposables.push(tex, signGeo, signMat);
  }

  /** Animate toward the car; returns true the moment the car noses into the open bay. */
  update(dt: number, car: { x: number; z: number; yaw: number } | null) {
    const { nx, nz } = this.face;
    let across = Infinity;
    let out = Infinity;
    if (car) {
      const dx = car.x - this.face.x;
      const dz = car.z - this.face.z;
      across = dx * nz - dz * nx;
      out = dx * nx + dz * nz;
    }
    const dist = Math.hypot(across, out - 3);
    const target = dist < OPEN_RADIUS ? 1 : 0;
    this.open += Math.sign(target - this.open) * Math.min(Math.abs(target - this.open), dt * 1.6);
    this.panel.scale.y = 1 - this.open * 0.92;
    if (dist > REARM_RADIUS) this.armed = true;
    if (!car || !this.armed || this.open < 0.85) return false;
    // Driving past runs parallel to the wall; only a car pointed at the bay goes in.
    const facing = -(-Math.sin(car.yaw) * nx + -Math.cos(car.yaw) * nz);
    if (Math.abs(across) < DOOR_W / 2 + 0.3 && out > 0 && out < 2.8 && facing > 0.6) {
      this.armed = false;
      return true;
    }
    return false;
  }

  dispose() {
    this.group.removeFromParent();
    for (const item of this.disposables) item.dispose();
  }
}
