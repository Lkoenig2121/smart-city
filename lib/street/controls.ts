import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { bridgeDeckHeight, TILE, type Blocker } from "./buildCity";
import { InputKeys } from "./keys";

export const EYE_HEIGHT = 1.7;

export type MoveMode = "hop" | "free";

/** Seconds of travel per tile of a hop, floored so short hops still read. */
const HOP_SECONDS_PER_TILE = 0.16;
const HOP_MIN_SECONDS = 0.26;
/** Pause after landing before a held key triggers the next hop. */
const HOP_REST = 0.07;
/** How much faster hops travel while Shift is held. */
const HOP_RUN_SCALE = 0.42;

const TURN_SPEED = 2.1;

const WALK_SPEED = 19.8;
const RUN_SPEED = 46;
const ACCEL = 117;
const RUN_ACCEL = 240;
const FRICTION = 12;
const RADIUS = 0.42;
const GRAVITY = 32;
const JUMP_SPEED = 10.2;
const PITCH_LIMIT = Math.PI / 2 - 0.04;
const LOOK_SENSITIVITY = 0.0022;

const CARDINALS = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
] as const;

interface Hop {
  from: THREE.Vector3;
  to: THREE.Vector3;
  elapsed: number;
  duration: number;
}

/**
 * Moves the player around the city at street level.
 *
 * The default `hop` mode imitates Google Street View: each press travels along
 * the current street and lands on the next intersection, so you can turn onto
 * a cross street. `free` mode is a conventional continuous walk with collision
 * resolved against the same building boxes the mesh builder produced.
 */
export class StreetControls {
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  mode: MoveMode = "hop";
  enabled = true;
  boost = { walk: 1, run: 1, jump: 1, hop: 1 };
  /**
   * Optional tile the player is navigating toward (phone / police waypoint).
   * When set, hops prefer stepping off the street into the open square that
   * gets you closer — so you can land inside a plaza / park block.
   */
  hopFocus: { x: number; z: number } | null = null;

  private velocity = new THREE.Vector3();
  private keys = new InputKeys();
  private hop: Hop | null = null;
  private rest = 0;
  private grounded = true;
  /** Buildings bucketed by tile so collision only tests nearby boxes. */
  private grid = new Map<string, Blocker[]>();

  constructor(
    private state: CityState,
    blockers: Blocker[],
  ) {
    for (const blocker of blockers) {
      const tx0 = Math.floor(blocker.minX / TILE);
      const tx1 = Math.floor(blocker.maxX / TILE);
      const tz0 = Math.floor(blocker.minZ / TILE);
      const tz1 = Math.floor(blocker.maxZ / TILE);
      for (let tz = tz0; tz <= tz1; tz++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const key = `${tx},${tz}`;
          const bucket = this.grid.get(key);
          if (bucket) bucket.push(blocker);
          else this.grid.set(key, [blocker]);
        }
      }
    }
  }

  /** Unit vector the camera is pointing along. */
  get forward() {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
  }

  /** 0 at rest, peaking mid-hop. Used for the transition zoom. */
  get hopEase() {
    if (!this.hop) return 0;
    const t = Math.min(1, this.hop.elapsed / this.hop.duration);
    return Math.sin(t * Math.PI);
  }

  /** Start and end of the current hop, if one is in flight. */
  get hopEnds() {
    if (!this.hop) return null;
    return { from: this.hop.from, to: this.hop.to };
  }

  get moving() {
    if (this.mode === "hop") return this.hop !== null;
    return Math.hypot(this.velocity.x, this.velocity.z) > 0.2;
  }

  setMode(mode: MoveMode) {
    this.mode = mode;
    this.hop = null;
    this.rest = 0;
    this.velocity.set(0, 0, 0);
    this.grounded = true;
  }

  /** Places the walker at the centre of a tile, facing along the street. */
  spawnAt(tileX: number, tileY: number, yaw = 0) {
    const x = tileX * TILE + TILE / 2;
    const z = tileY * TILE + TILE / 2;
    this.position.set(x, this.groundAt(x, z) + EYE_HEIGHT, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this.hop = null;
    this.rest = 0;
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
    if (!this.enabled) return;
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = Math.max(
      -PITCH_LIMIT,
      Math.min(PITCH_LIMIT, this.pitch - dy * LOOK_SENSITIVITY),
    );
  }

  private has(...codes: string[]) {
    return this.keys.has(...codes);
  }

  update(dt: number) {
    if (!this.enabled) return;
    if (this.mode === "hop") this.updateHop(dt);
    else this.updateFree(dt);
    this.applyJump(dt);
  }

  // ─── Street View style stepping ────────────────────────────────────────────

  private updateHop(dt: number) {
    // Left and right turn the view, as they do in Street View.
    let turn = 0;
    if (this.has("KeyA", "ArrowLeft")) turn += 1;
    if (this.has("KeyD", "ArrowRight")) turn -= 1;
    if (turn !== 0) this.yaw += turn * TURN_SPEED * dt;

    if (this.hop) {
      this.hop.elapsed += dt * (this.keys.running ? 1 / HOP_RUN_SCALE : 1);
      const t = Math.min(1, this.hop.elapsed / this.hop.duration);
      // Smoothstep, so the move accelerates away and glides to a stop.
      const eased = t * t * (3 - 2 * t);
      this.position.x = this.hop.from.x + (this.hop.to.x - this.hop.from.x) * eased;
      this.position.z = this.hop.from.z + (this.hop.to.z - this.hop.from.z) * eased;
      // Height comes from the surface underfoot so a hop across the river
      // rides the deck instead of cutting through it.
      if (t >= 1) {
        this.hop = null;
        this.rest = this.keys.running ? 0 : HOP_REST;
      }
      return;
    }

    if (this.rest > 0) {
      if (this.keys.running) this.rest = 0;
      else {
        this.rest -= dt;
        return;
      }
    }

    const forward = this.has("KeyW", "ArrowUp");
    const backward = this.has("KeyS", "ArrowDown");
    if (forward === backward) return;

    this.beginHop(forward ? 1 : -1);
  }

  /**
   * Travels along the street and lands on the next intersection, so a hop never
   * overshoots a turning point. Hopping off a street into an open plaza / park
   * square lands on the first square tile. If the road ends first, it stops at
   * the last tile you can stand on.
   */
  private beginHop(sign: 1 | -1) {
    const cardinal = this.hopCardinal(sign);
    const fromTileX = Math.floor(this.position.x / TILE);
    const fromTileZ = Math.floor(this.position.z / TILE);
    const fromStreet = this.isStreet(fromTileX, fromTileZ);
    const maxSteps = this.state.size;

    let reachedX = fromTileX;
    let reachedZ = fromTileZ;
    let junctionX: number | null = null;
    let junctionZ: number | null = null;

    for (let step = 1; step <= maxSteps; step++) {
      const nx = fromTileX + cardinal.x * step;
      const nz = fromTileZ + cardinal.z * step;
      if (!this.tileHoppable(nx, nz)) break;
      reachedX = nx;
      reachedZ = nz;
      // Street → open square: hop into the square, don't skip across it.
      if (fromStreet && this.isOpenSquare(nx, nz)) break;
      if (this.isJunction(nx, nz)) {
        junctionX = nx;
        junctionZ = nz;
        break;
      }
    }

    const destX = junctionX ?? reachedX;
    const destZ = junctionZ ?? reachedZ;
    if (destX === fromTileX && destZ === fromTileZ) return;

    const destWorldX = destX * TILE + TILE / 2;
    const destWorldZ = destZ * TILE + TILE / 2;
    const distance = Math.abs(destX - fromTileX) + Math.abs(destZ - fromTileZ);
    const to = new THREE.Vector3(
      destWorldX,
      this.groundAt(destWorldX, destWorldZ) + EYE_HEIGHT,
      destWorldZ,
    );

    this.hop = {
      from: this.position.clone(),
      to,
      elapsed: 0,
      duration: Math.max(HOP_MIN_SECONDS, distance * HOP_SECONDS_PER_TILE) / Math.max(0.5, this.boost.hop),
    };
  }

  /**
   * Picks a compass heading for the hop. Street View always steps onto the
   * road closest to the look direction, even if you are glancing at a facade.
   * From a street you can also hop into an open plaza / park square.
   */
  private hopCardinal(sign: 1 | -1) {
    const fx = -Math.sin(this.yaw) * sign;
    const fz = -Math.cos(this.yaw) * sign;
    const ranked = [...CARDINALS].sort(
      (a, b) => b.x * fx + b.z * fz - (a.x * fx + a.z * fz),
    );

    const fromX = Math.floor(this.position.x / TILE);
    const fromZ = Math.floor(this.position.z / TILE);
    const onRoad = this.isStreet(fromX, fromZ);
    const inSquare = this.isOpenSquare(fromX, fromZ);

    // Near a waypoint: prefer hopping into the open square toward the pin
    // instead of skating past on the ring road.
    if (onRoad && this.hopFocus) {
      const focus = this.hopFocus;
      const before = Math.hypot(focus.x + 0.5 - (fromX + 0.5), focus.z + 0.5 - (fromZ + 0.5));
      for (const candidate of ranked) {
        const look = candidate.x * fx + candidate.z * fz;
        if (look < 0.05) continue;
        const nx = fromX + candidate.x;
        const nz = fromZ + candidate.z;
        if (!this.isOpenSquare(nx, nz)) continue;
        const after = Math.hypot(focus.x + 0.5 - (nx + 0.5), focus.z + 0.5 - (nz + 0.5));
        if (after < before - 0.05) return candidate;
      }
    }

    for (const candidate of ranked) {
      const nx = fromX + candidate.x;
      const nz = fromZ + candidate.z;
      if (onRoad) {
        if (this.isStreet(nx, nz) || this.isOpenSquare(nx, nz)) return candidate;
      } else if (inSquare) {
        if (this.isOpenSquare(nx, nz) || this.isStreet(nx, nz)) return candidate;
      } else if (this.tileHoppable(nx, nz)) {
        return candidate;
      }
    }
    return ranked[0];
  }

  /** Roads and bridge decks — the network Street View actually travels. */
  private isStreet(tx: number, tz: number) {
    const tile = this.state.tiles[tz]?.[tx];
    return Boolean(tile?.road || tile?.bridge);
  }

  /**
   * Open block interiors ringed by streets — plazas, parks, lots, playgrounds,
   * and clear grass lots. These are the squares you can hop into from the road.
   */
  private isOpenSquare(tx: number, tz: number) {
    const tile = this.state.tiles[tz]?.[tx];
    if (!tile || tile.road || tile.bridge) return false;
    if (tile.terrain === "water") return false;
    if (tile.buildingId) {
      const building = this.state.buildings.get(tile.buildingId);
      if (building && building.kind !== "park_pavilion") return false;
    }
    return (
      tile.terrain === "plaza" ||
      tile.terrain === "park" ||
      tile.terrain === "playground" ||
      tile.terrain === "lot" ||
      tile.terrain === "grass"
    );
  }

  /**
   * A place you can change streets: a crossing, a T, a corner, or a dead end.
   * Straight mid-block tiles are not junctions.
   */
  private isJunction(tx: number, tz: number) {
    if (!this.isStreet(tx, tz)) return false;
    const north = this.isStreet(tx, tz - 1);
    const south = this.isStreet(tx, tz + 1);
    const east = this.isStreet(tx + 1, tz);
    const west = this.isStreet(tx - 1, tz);
    const arms = Number(north) + Number(south) + Number(east) + Number(west);
    if (arms !== 2) return true;
    const straight = (north && south && !east && !west) || (east && west && !north && !south);
    return !straight;
  }

  /** Whether a hop can land on this tile. */
  private tileHoppable(tx: number, tz: number) {
    const tile = this.state.tiles[tz]?.[tx];
    if (!tile) return false;
    if (tile.terrain === "water" && !tile.bridge) return false;
    if (tile.buildingId) {
      const building = this.state.buildings.get(tile.buildingId);
      if (building && building.kind !== "park_pavilion") return false;
    }
    const fromX = Math.floor(this.position.x / TILE);
    const fromZ = Math.floor(this.position.z / TILE);
    const fromStreet = this.isStreet(fromX, fromZ);
    const fromSquare = this.isOpenSquare(fromX, fromZ);
    // Streets link to open squares so you can hop into a plaza / park block.
    if (fromStreet) return this.isStreet(tx, tz) || this.isOpenSquare(tx, tz);
    if (fromSquare) return this.isOpenSquare(tx, tz) || this.isStreet(tx, tz);
    return true;
  }

  // ─── Continuous walking ────────────────────────────────────────────────────

  private updateFree(dt: number) {
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
      // Forward is (-sin, -cos) and right is (cos, -sin) for this yaw.
      const wx = -sin * f + cos * r;
      const wz = -cos * f - sin * r;
      this.velocity.x += wx * accel * dt;
      this.velocity.z += wz * accel * dt;
    }

    // Damp toward rest and clamp to the current top speed.
    const damp = Math.max(0, 1 - FRICTION * dt);
    this.velocity.x *= damp;
    this.velocity.z *= damp;
    const planar = Math.hypot(this.velocity.x, this.velocity.z);
    if (planar > speed) {
      this.velocity.x = (this.velocity.x / planar) * speed;
      this.velocity.z = (this.velocity.z / planar) * speed;
    }

    // Move on each axis separately so sliding along a wall feels natural.
    this.step(this.velocity.x * dt, 0);
    this.step(0, this.velocity.z * dt);
  }

  /** Space launches off the ground; gravity brings you back onto the surface. */
  private applyJump(dt: number) {
    const floor = this.groundAt(this.position.x, this.position.z) + EYE_HEIGHT;

    if (this.grounded && this.has("Space")) {
      this.velocity.y = JUMP_SPEED * this.boost.jump;
      this.grounded = false;
    }

    if (!this.grounded) {
      this.velocity.y -= GRAVITY * dt;
      this.position.y += this.velocity.y * dt;
      // Only snap back once the jump is falling, or we'd cancel it the same frame.
      if (this.velocity.y <= 0 && this.position.y <= floor) {
        this.position.y = floor;
        this.velocity.y = 0;
        this.grounded = true;
      }
    } else {
      // Snap onto ramps and decks; a slow lerp here puts the camera inside
      // the slab for several frames.
      const gap = floor - this.position.y;
      if (this.hop || Math.abs(gap) > 0.28) this.position.y = floor;
      else this.position.y += gap * Math.min(1, dt * 9);
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

  /** True when a walker of `RADIUS` can stand at this world position. */
  private passable(x: number, z: number) {
    const size = this.state.size;
    const margin = RADIUS + 0.1;
    if (x < margin || z < margin) return false;
    if (x > size * TILE - margin || z > size * TILE - margin) return false;

    const tx = Math.floor(x / TILE);
    const tz = Math.floor(z / TILE);
    const tile = this.state.tiles[tz]?.[tx];
    if (!tile) return false;
    // Open water is only crossable where a bridge spans it.
    if (tile.terrain === "water" && !tile.bridge) return false;

    for (let oz = -1; oz <= 1; oz++) {
      for (let ox = -1; ox <= 1; ox++) {
        const bucket = this.grid.get(`${tx + ox},${tz + oz}`);
        if (!bucket) continue;
        for (const b of bucket) {
          if (
            x > b.minX - RADIUS &&
            x < b.maxX + RADIUS &&
            z > b.minZ - RADIUS &&
            z < b.maxZ + RADIUS
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /** Surface height under a world position, raised on bridge decks. */
  groundAt(x: number, z: number) {
    const tx = Math.floor(x / TILE);
    const tz = Math.floor(z / TILE);
    const tile = this.state.tiles[tz]?.[tx];
    if (!tile) return 0;
    if (tile.bridge) return bridgeDeckHeight(tile, x, z, this.state.tiles);

    const neighbours = [
      this.state.tiles[tz]?.[tx - 1],
      this.state.tiles[tz]?.[tx + 1],
      this.state.tiles[tz - 1]?.[tx],
      this.state.tiles[tz + 1]?.[tx],
    ];
    const approach = neighbours.find((n) => n?.bridge);
    if (!approach?.bridge) return tile.road ? 0.02 : 0;

    // Stay on the bank until we actually step onto the span, so the camera
    // never rides through the underside of the deck.
    return tile.road ? 0.02 : 0;
  }

  applyTo(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.position);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(this.yaw);
    camera.rotateX(this.pitch);
  }
}
