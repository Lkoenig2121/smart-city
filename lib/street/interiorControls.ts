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
const CLIMB_SPEED = 3.4;

/** A climbable zone: W climbs, S descends, topping out drops you at `exit`. */
export type Ladder = { bottom: number; top: number; exit: { x: number; z: number; yaw: number } };

/**
 * First-person walking for interiors: the same feel as Street View's walk
 * mode, without hops or the city tile grid.
 */
export class InteriorControls {
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  enabled = true;
  boost = { walk: 1, run: 1, jump: 1 };

  private velocity = new THREE.Vector3();
  private keys = new InputKeys();
  private grounded = true;
  private onLadder = false;

  constructor(
    private blockers: Blocker[],
    private groundY: (x: number, z: number, feetY?: number) => number,
    private bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    private ladderAt?: (x: number, z: number, feetY: number) => Ladder | null,
  ) {}

  spawn(x: number, z: number, yaw: number, pitch = 0) {
    this.position.set(x, this.groundY(x, z, 0) + EYE_HEIGHT, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.onLadder = false;
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
    if (!this.enabled) return;
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - dy * LOOK_SENSITIVITY));
  }

  private has(...codes: string[]) {
    return this.keys.has(...codes);
  }

  update(dt: number) {
    if (!this.enabled) return;
    if (this.climb(dt)) return;
    let f = 0;
    let r = 0;
    if (this.has("KeyW", "ArrowUp")) f += 1;
    if (this.has("KeyS", "ArrowDown")) f -= 1;
    if (this.has("KeyD", "ArrowRight")) r += 1;
    if (this.has("KeyA", "ArrowLeft")) r -= 1;

    const running = this.keys.running;
    const speed = (running ? RUN_SPEED : WALK_SPEED) * (running ? this.boost.run : this.boost.walk);
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

    const floor = this.groundY(this.position.x, this.position.z, this.position.y - EYE_HEIGHT) + EYE_HEIGHT;
    if (this.grounded && this.has("Space")) {
      this.velocity.y = JUMP_SPEED * this.boost.jump;
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
    } else if (this.position.y > floor + 0.5) {
      this.grounded = false;
    } else {
      this.position.y = floor;
    }
  }

  private climb(dt: number) {
    const feet = this.position.y - EYE_HEIGHT;
    const ladder = this.ladderAt?.(this.position.x, this.position.z, feet) ?? null;
    if (!ladder) {
      this.onLadder = false;
      return false;
    }
    const v = (this.has("KeyW", "ArrowUp") ? 1 : 0) - (this.has("KeyS", "ArrowDown") ? 1 : 0);
    if (!this.onLadder) {
      if (feet <= ladder.bottom + 0.05 && v <= 0) return false;
      this.onLadder = true;
      if (feet >= ladder.top - 0.05) {
        // Stepping in from above: grab the rungs facing the ladder.
        this.position.y = ladder.top - 0.8 + EYE_HEIGHT;
        this.yaw = ladder.exit.yaw + Math.PI;
        this.velocity.set(0, 0, 0);
        return true;
      }
    }
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    const next = Math.max(ladder.bottom, feet + v * CLIMB_SPEED * dt);
    if (next >= ladder.top) {
      this.position.set(ladder.exit.x, ladder.top + EYE_HEIGHT, ladder.exit.z);
      this.yaw = ladder.exit.yaw;
      this.onLadder = false;
      return true;
    }
    this.position.y = next + EYE_HEIGHT;
    if (next <= ladder.bottom && v < 0) this.onLadder = false;
    const side = (this.has("KeyD", "ArrowRight") ? 1 : 0) - (this.has("KeyA", "ArrowLeft") ? 1 : 0);
    if (side !== 0) {
      const s = side * WALK_SPEED * 0.35 * dt;
      this.nudge(Math.cos(this.yaw) * s, -Math.sin(this.yaw) * s);
    }
    return true;
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

  nudge(dx: number, dz: number) {
    this.step(dx, 0);
    this.step(0, dz);
  }

  private passable(x: number, z: number) {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    if (x < minX + RADIUS || x > maxX - RADIUS) return false;
    if (z < minZ + RADIUS || z > maxZ - RADIUS) return false;
    const feet = this.position.y - EYE_HEIGHT;
    const head = this.position.y + 0.15;
    for (const b of this.blockers) {
      if (x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS) {
        if (b.maxY != null && feet >= b.maxY) continue;
        if (b.minY != null && head <= b.minY) continue;
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
