import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { bridgeDeckHeight, TILE, type Blocker } from "./buildCity";
import { InputKeys } from "./keys";

/** Max yaw rate (rad/s) at a crawl — falls off with speed like GTA arcade steering. */
const STEER_MAX = 3.4;
const STEER_SOFT = 11;
const FRICTION = 1.35;
const BRAKE = 48;
const LAT_GRIP = 10;
const LAT_HANDBRAKE = 2.4;
const RADIUS = 0.95;
const CAMERA_HEIGHT = 1.65;
const CAMERA_BACK = 7.6;
const CAMERA_LOOK = 9.5;
const LOOK_SENS = 0.0024;

/**
 * GTA-style arcade driving: A/D steers the body, velocity can slip,
 * Space handbrake drifts, mouse orbits the chase cam then springs back.
 */
export class DriveControls {
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  /** Signed speed along the car's forward axis (world units / s). */
  speed = 0;
  enabled = true;
  topSpeed = 38;
  accel = 32;
  /** When true, skip road snap / curb preference (Highway 93 corridor). */
  offroad = false;

  private vx = 0;
  private vz = 0;
  private camYaw = 0;
  private camPitch = 0.14;
  private readonly keys = new InputKeys();
  private readonly blockers: Blocker[];
  private readonly state: CityState;

  constructor(state: CityState, blockers: Blocker[]) {
    this.state = state;
    this.blockers = blockers;
  }

  keyDown(event: KeyboardEvent) {
    this.keys.down(event);
  }

  keyUp(event: KeyboardEvent) {
    this.keys.up(event);
  }

  clearKeys() {
    this.keys.clear();
  }

  /** Mouse orbits the chase camera; does not turn the wheels. */
  look(dx: number, dy: number) {
    this.camYaw -= dx * LOOK_SENS;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * LOOK_SENS, -0.28, 0.55);
  }

  spawnAt(x: number, z: number, yaw: number) {
    const snapped = this.snapToDrivable(x, z);
    this.position.set(snapped.x, this.groundAt(snapped.x, snapped.z) + 0.55, snapped.z);
    this.yaw = yaw;
    this.pitch = 0;
    this.speed = 0;
    this.vx = 0;
    this.vz = 0;
    this.camYaw = 0;
    this.camPitch = 0.14;
  }

  update(dt: number, fuelEmpty = false) {
    if (!this.enabled) return;
    const forward = this.keys.has("KeyW", "ArrowUp") ? 1 : 0;
    const back = this.keys.has("KeyS", "ArrowDown") ? 1 : 0;
    const left = this.keys.has("KeyA", "ArrowLeft") ? 1 : 0;
    const right = this.keys.has("KeyD", "ArrowRight") ? 1 : 0;
    const handbrake = this.keys.has("Space");
    const boost = this.keys.running ? 1.28 : 1;
    const steerInput = right - left;
    const throttle = forward - back;

    let fx = -Math.sin(this.yaw);
    let fz = -Math.cos(this.yaw);
    let fwd = this.vx * fx + this.vz * fz;

    // Throttle / brake along the car's nose (world velocity stays until grip acts).
    if (fuelEmpty) {
      this.vx = THREE.MathUtils.damp(this.vx, 0, FRICTION * 3.2, dt);
      this.vz = THREE.MathUtils.damp(this.vz, 0, FRICTION * 3.2, dt);
    } else if (throttle > 0) {
      this.vx += fx * this.accel * boost * dt;
      this.vz += fz * this.accel * boost * dt;
    } else if (throttle < 0) {
      if (fwd > 0.6) {
        const brake = BRAKE * dt;
        const sp = Math.hypot(this.vx, this.vz) || 1;
        this.vx -= (this.vx / sp) * brake;
        this.vz -= (this.vz / sp) * brake;
      } else {
        this.vx -= fx * this.accel * 0.7 * dt;
        this.vz -= fz * this.accel * 0.7 * dt;
      }
    } else {
      this.vx = THREE.MathUtils.damp(this.vx, 0, FRICTION, dt);
      this.vz = THREE.MathUtils.damp(this.vz, 0, FRICTION, dt);
    }

    fwd = this.vx * fx + this.vz * fz;
    const moving = Math.hypot(this.vx, this.vz) > 0.35;

    // Wheel turn: sharper crawling, softer at speed; reverse flips steer.
    // Yaw sign matches on-foot controls (A left / D right).
    if (steerInput !== 0 && (moving || throttle !== 0)) {
      const falloff = 1 / (1 + Math.abs(fwd) / STEER_SOFT);
      const sign = moving ? Math.sign(fwd || 1) : Math.sign(throttle || 1);
      this.yaw -= steerInput * STEER_MAX * falloff * (moving ? 1 : 0.55) * sign * dt;
      fx = -Math.sin(this.yaw);
      fz = -Math.cos(this.yaw);
    }

    // Lateral grip vs handbrake drift — velocity is not forced to face instantly.
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    fwd = this.vx * fx + this.vz * fz;
    let lat = this.vx * rx + this.vz * rz;
    const grip = handbrake ? LAT_HANDBRAKE : LAT_GRIP;
    lat = THREE.MathUtils.damp(lat, 0, grip, dt);
    if (handbrake && Math.abs(fwd) > 2) {
      fwd = THREE.MathUtils.damp(fwd, fwd * 0.9, 2.2, dt);
    }

    this.vx = fx * fwd + rx * lat;
    this.vz = fz * fwd + rz * lat;

    const max = this.topSpeed * boost;
    const sp = Math.hypot(this.vx, this.vz);
    const maxAllowed = fwd < 0 ? max * 0.52 : max;
    if (sp > maxAllowed && sp > 0.001) {
      const s = maxAllowed / sp;
      this.vx *= s;
      this.vz *= s;
    }

    this.speed = this.vx * fx + this.vz * fz;

    const nextX = this.position.x + this.vx * dt;
    const nextZ = this.position.z + this.vz * dt;
    this.tryMove(nextX, nextZ);

    if (
      !this.offroad &&
      !this.onDrivable(this.position.x, this.position.z) &&
      Math.hypot(this.vx, this.vz) > 2
    ) {
      const snap = this.snapToDrivable(this.position.x, this.position.z);
      this.position.x = THREE.MathUtils.damp(this.position.x, snap.x, 6, dt);
      this.position.z = THREE.MathUtils.damp(this.position.z, snap.z, 6, dt);
    }

    this.position.y = this.groundAt(this.position.x, this.position.z) + 0.55;

    this.camYaw = THREE.MathUtils.damp(this.camYaw, 0, 2.8, dt);
    this.camPitch = THREE.MathUtils.damp(this.camPitch, 0.14, 2.8, dt);
  }

  applyTo(camera: THREE.PerspectiveCamera) {
    const viewYaw = this.yaw + this.camYaw;
    const fx = -Math.sin(viewYaw);
    const fz = -Math.cos(viewYaw);
    const lift = Math.sin(this.camPitch) * CAMERA_BACK * 0.85;
    const back = Math.cos(this.camPitch) * CAMERA_BACK;
    camera.position.set(
      this.position.x - fx * back,
      this.position.y + CAMERA_HEIGHT + lift,
      this.position.z - fz * back,
    );
    camera.lookAt(
      this.position.x + fx * CAMERA_LOOK,
      this.position.y + 0.4 + this.camPitch * 2.2,
      this.position.z + fz * CAMERA_LOOK,
    );
  }

  mph() {
    return Math.round(Math.hypot(this.vx, this.vz) * 2.35);
  }

  groundAt(x: number, z: number) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(z / TILE);
    const tile = this.state.tiles[ty]?.[tx];
    if (!tile) return 0;
    if (tile.bridge) return bridgeDeckHeight(tile, x, z, this.state.tiles);
    return tile.road ? 0.02 : 0;
  }

  private tryMove(x: number, z: number) {
    const canX = this.passable(x, this.position.z);
    const canZ = this.passable(this.position.x, z);
    if (canX) this.position.x = x;
    else this.vx *= 0.2;
    if (canZ) this.position.z = z;
    else this.vz *= 0.2;
    if (!canX || !canZ) this.speed *= 0.45;
  }

  private onDrivable(x: number, z: number) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(z / TILE);
    const tile = this.state.tiles[ty]?.[tx];
    if (!tile) return Math.abs(tx - 20) <= 1 && ty <= 5;
    return Boolean(tile.road || tile.bridge);
  }

  private snapToDrivable(x: number, z: number) {
    if (this.onDrivable(x, z)) {
      return { x: (Math.floor(x / TILE) + 0.5) * TILE, z: (Math.floor(z / TILE) + 0.5) * TILE };
    }
    const ox = Math.floor(x / TILE);
    const oz = Math.floor(z / TILE);
    let best: { x: number; z: number } | null = null;
    let bestD = Infinity;
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = ox + dx;
          const ty = oz + dy;
          const tile = this.state.tiles[ty]?.[tx];
          if (!tile?.road && !tile?.bridge) continue;
          const cx = (tx + 0.5) * TILE;
          const cz = (ty + 0.5) * TILE;
          const d = (cx - x) ** 2 + (cz - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { x: cx, z: cz };
          }
        }
      }
      if (best) break;
    }
    return best ?? { x, z };
  }

  private passable(x: number, z: number) {
    const margin = 0.4;
    const max = this.state.size * TILE;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(z / TILE);
    const onHwyExit = Math.abs(tx - 20) <= 1 && ty <= 5;

    if (x < margin || x > max - margin) return false;
    if (!onHwyExit && (z < margin || z > max - margin)) return false;
    if (onHwyExit && z < -TILE * 0.35) return false;

    const tile = this.state.tiles[ty]?.[tx] ?? (onHwyExit ? this.state.tiles[0]?.[20] : null);
    if (!tile && !onHwyExit) return false;
    if (tile?.terrain === "water" && !tile.bridge) return false;

    // Highway corridor: rocks / poles / buildings are always solid.
    if (this.offroad) {
      const pad = RADIUS * 0.55;
      for (const b of this.blockers) {
        if (x + pad > b.minX && x - pad < b.maxX && z + pad > b.minZ && z - pad < b.maxZ) {
          return false;
        }
      }
      return true;
    }

    const onDriveway = Boolean(tile?.road || tile?.bridge) || onHwyExit;
    const pad = onDriveway ? RADIUS * 0.25 : RADIUS * 0.7;

    for (const b of this.blockers) {
      if (x + pad > b.minX && x - pad < b.maxX && z + pad > b.minZ && z - pad < b.maxZ) {
        if (onDriveway) {
          const cx = (b.minX + b.maxX) / 2;
          const cz = (b.minZ + b.maxZ) / 2;
          const insetX = (b.maxX - b.minX) * 0.22;
          const insetZ = (b.maxZ - b.minZ) * 0.22;
          if (Math.abs(x - cx) < insetX && Math.abs(z - cz) < insetZ) return false;
        } else {
          return false;
        }
      }
    }
    return true;
  }
}
