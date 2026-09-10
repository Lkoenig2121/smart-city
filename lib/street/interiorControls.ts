import * as THREE from "three";
import type { Blocker } from "./buildCity";
import { InputKeys } from "./keys";

export const EYE_HEIGHT = 1.7;

const WALK_SPEED = 8.4;
const RUN_SPEED = 22;
const ACCEL = 70;
const RUN_ACCEL = 160;
const FRICTION = 10;
const RADIUS = 0.42;
const GRAVITY = 32;
const JUMP_SPEED = 8.5;
const PITCH_LIMIT = Math.PI / 2 - 0.04;
const LOOK_SENSITIVITY = 0.0022;

/**
 * First-person walking for interiors: the same feel as Street View's walk
 * mode, without hops or the city tile grid.
 */
export class InteriorControls {
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  enabled = true;

  private velocity = new THREE.Vector3();
  private keys = new InputKeys();
  private grounded = true;

  constructor(
    private blockers: Blocker[],
    private groundY: (x: number, z: number) => number,
    private bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  ) {}

  spawn(x: number, z: number, yaw: number, pitch = 0) {
    this.position.set(x, this.groundY(x, z) + EYE_HEIGHT, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.velocity.set(0, 0, 0);
    this.grounded = true;
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

  look(dx: number, dy: number) {
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - dy * LOOK_SENSITIVITY));
  }

  private has(...codes: string[]) {
    return this.keys.has(...codes);
  }

  update(dt: number) {
    if (!this.enabled) return;
    let f = 0;
    let r = 0;
    if (this.has("KeyW", "ArrowUp")) f += 1;
    if (this.has("KeyS", "ArrowDown")) f -= 1;
    if (this.has("KeyD", "ArrowRight")) r += 1;
    if (this.has("KeyA", "ArrowLeft")) r -= 1;

    const running = this.keys.running;
    const speed = running ? RUN_SPEED : WALK_SPEED;
    const accel = running ? RUN_ACCEL : ACCEL;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    if (f !== 0 || r !== 0) {
      const len = Math.hypot(f, r);
      f /= len;
      r /= len;
      this.velocity.x += (-sin * f + cos * r) * accel * dt;
      this.velocity.z += (-cos * f - sin * r) * accel * dt;
    }

    const damp = Math.max(0, 1 - FRICTION * dt);
    this.velocity.x *= damp;
    this.velocity.z *= damp;
    const planar = Math.hypot(this.velocity.x, this.velocity.z);
    if (planar > speed) {
      this.velocity.x = (this.velocity.x / planar) * speed;
      this.velocity.z = (this.velocity.z / planar) * speed;
    }

    this.step(this.velocity.x * dt, 0);
    this.step(0, this.velocity.z * dt);

    const floor = this.groundY(this.position.x, this.position.z) + EYE_HEIGHT;
    if (this.grounded && this.has("Space")) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.velocity.y -= GRAVITY * dt;
      this.position.y += this.velocity.y * dt;
      if (this.velocity.y <= 0 && this.position.y <= floor) {
        this.position.y = floor;
        this.velocity.y = 0;
        this.grounded = true;
      }
    } else {
      this.position.y = floor;
    }
  }

  private step(dx: number, dz: number) {
    if (dx === 0 && dz === 0) return;
    const nextX = this.position.x + dx;
    const nextZ = this.position.z + dz;
    if (!this.passable(nextX, nextZ)) {
      if (dx !== 0) this.velocity.x = 0;
      if (dz !== 0) this.velocity.z = 0;
      return;
    }
    this.position.x = nextX;
    this.position.z = nextZ;
  }

  private passable(x: number, z: number) {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    if (x < minX + RADIUS || x > maxX - RADIUS) return false;
    if (z < minZ + RADIUS || z > maxZ - RADIUS) return false;
    for (const b of this.blockers) {
      if (x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS) {
        return false;
      }
    }
    return true;
  }

  applyTo(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.position);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(this.yaw);
    camera.rotateX(this.pitch);
  }
}
