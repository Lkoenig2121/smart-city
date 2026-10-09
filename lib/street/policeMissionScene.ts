import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import type { PoliceCall } from "@/lib/city/player";
import type { PoliceSceneEvent } from "@/lib/city/police";
import type { OwnedVehicle, VehicleCategory } from "@/lib/city/vehicles";
import { nearestRoad } from "@/lib/simulation/traffic/pathfinding";
import { TILE } from "./buildCity";
import { disposeCarMesh, makePlayerCarMesh } from "./playerCar";
import { buildStreetPerson, disposeObject3D } from "./streetPerson";

export interface MissionPlayer {
  x: number;
  z: number;
  yaw: number;
  driving: boolean;
  inCruiser: boolean;
  lights: boolean;
}

type Tile = { x: number; y: number };

const LANE = 1.7;
const CURB = 3.4;
const SPOT_RANGE = 36;
const CHECKPOINT_RANGE = 15;
const PULL_OVER_RANGE = 16;
const LOSE_RANGE = 170;
/** Pursuit: after this long on the chase, closing to CATCH_RANGE stops the car. */
const CATCH_AFTER = 10;
const CATCH_RANGE = 10;
const VIP_GAP = 13;

function npcCar(id: string, category: VehicleCategory, color: string, plate: string, tint = false): OwnedVehicle {
  return {
    id,
    catalogId: "npc",
    model: "npc",
    category,
    purchasePrice: 0,
    currentValue: 0,
    color,
    mileage: 0,
    fuel: 100,
    condition: 100,
    licensePlate: plate,
    garageLocation: "npc",
    upgrades: { performance: 0 },
    wheels: "stock",
    interior: "cloth",
    accessories: tint ? ["tint"] : [],
    owned: true,
    parkX: 0,
    parkY: 0,
    parkYaw: 0,
  };
}

function categoryFor(model: string | undefined): VehicleCategory {
  const m = (model ?? "").toLowerCase();
  if (m.includes("suv")) return "suv";
  if (m.includes("coupe")) return "sports";
  if (m.includes("hatch")) return "compact";
  return "sedan";
}

/** Yaw for a car mesh whose nose points down local -z. */
function yawToward(dx: number, dz: number) {
  return Math.atan2(-dx, -dz);
}

function turnToward(current: number, target: number, rate: number) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * Math.min(1, rate);
}

/** Tile-to-tile road follower in the right-hand lane. */
class RoadDriver {
  from: Tile;
  to: Tile;
  t = 0;
  speed = 0;
  lane = LANE;
  yaw = 0;
  /** True while the nose is still sweeping through a corner. */
  turning = false;
  readonly pos = new THREE.Vector3();
  private turnRate: number;
  /** Chance to keep going straight at an intersection instead of juking. */
  private holdStraight: number;

  constructor(
    private state: CityState,
    start: Tile,
    private choose: (options: Tile[], at: Tile) => Tile,
    opts?: { turnRate?: number; holdStraight?: number },
  ) {
    this.turnRate = opts?.turnRate ?? 7;
    this.holdStraight = opts?.holdStraight ?? 0;
    this.from = start;
    this.to = this.pick(start, null);
    this.place();
    this.yaw = yawToward(this.to.x - this.from.x, this.to.y - this.from.y);
  }

  private isRoad(x: number, y: number) {
    const tile = this.state.tiles[y]?.[x];
    return Boolean(tile?.road || tile?.bridge);
  }

  private pick(at: Tile, came: Tile | null): Tile {
    const options: Tile[] = [];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: at.x + dx, y: at.y + dy };
      if (!this.isRoad(n.x, n.y)) continue;
      if (came && n.x === came.x && n.y === came.y) continue;
      options.push(n);
    }
    if (!options.length) return came ?? at;
    if (options.length === 1) return options[0];
    if (came && this.holdStraight > 0) {
      const dx = at.x - came.x;
      const dy = at.y - came.y;
      const straight = options.find((o) => o.x === at.x + dx && o.y === at.y + dy);
      if (straight && Math.random() < this.holdStraight) return straight;
    }
    return this.choose(options, at);
  }

  step(dt: number) {
    this.t += (this.speed * dt) / TILE;
    while (this.t >= 1) {
      this.t -= 1;
      const came = this.from;
      this.from = this.to;
      this.to = this.pick(this.from, came);
    }
    this.place();
    const dx = this.to.x - this.from.x;
    const dy = this.to.y - this.from.y;
    if (dx || dy) {
      const target = yawToward(dx, dy);
      let err = target - this.yaw;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      this.turning = Math.abs(err) > 0.4;
      this.yaw = turnToward(this.yaw, target, dt * this.turnRate);
    } else {
      this.turning = false;
    }
  }

  private place() {
    const dx = this.to.x - this.from.x;
    const dy = this.to.y - this.from.y;
    const len = Math.hypot(dx, dy) || 1;
    const fx = dx / len;
    const fz = dy / len;
    this.pos.set(
      (this.from.x + 0.5 + dx * this.t) * TILE - fz * this.lane,
      0,
      (this.from.y + 0.5 + dy * this.t) * TILE + fx * this.lane,
    );
  }
}

interface MissionCar {
  mesh: THREE.Group;
  driver: RoadDriver | null;
  hazards: THREE.Mesh[];
  person: THREE.Group | null;
}

/**
 * Street props for police missions: the speeder, the fleeing suspect, the
 * VIP limo, the parked stolen car, and patrol checkpoint beacons. Reports
 * what happened as `PoliceSceneEvent`s for the career layer to apply.
 */
export class PoliceMissionScene {
  readonly group = new THREE.Group();
  private callId: string | null = null;
  private car: MissionCar | null = null;
  private beacon: THREE.Group | null = null;
  private beaconKey = "";
  private time = 0;
  private pullTimer = 0;
  private lostTimer = 0;
  private chaseTime = 0;
  private stopping = false;
  private sent = new Set<string>();
  private trail: Array<{ x: number; z: number; d: number }> = [];
  private trailDist = 0;
  private limoDist = 0;
  note: string | null = null;

  constructor(
    private state: CityState,
    private groundAt: (x: number, z: number) => number,
  ) {
    this.group.name = "police-missions";
  }

  /** Mirror the saved call: build or tear down props when it changes. */
  sync(call: PoliceCall | null) {
    if (!call || call.phase === "completed" || call.id !== this.callId) {
      if (this.callId) this.clear();
      if (!call || call.phase === "completed") return;
      this.callId = call.id;
    }
    this.syncBeacon(call);
    this.ensureCar(call);
  }

  private clear() {
    this.removeCar();
    this.removeBeacon();
    this.callId = null;
    this.pullTimer = 0;
    this.lostTimer = 0;
    this.chaseTime = 0;
    this.stopping = false;
    this.sent.clear();
    this.trail = [];
    this.trailDist = 0;
    this.limoDist = 0;
    this.note = null;
  }

  dispose() {
    this.clear();
  }

  // ── Props ────────────────────────────────────────────────────────────

  private syncBeacon(call: PoliceCall) {
    const want = call.kind === "patrol" ? `${call.tileX},${call.tileY}` : "";
    if (want === this.beaconKey) return;
    this.removeBeacon();
    this.beaconKey = want;
    if (!want) return;
    const beacon = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 26, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: "#4aa8ff", transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 13;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.14, 8, 36),
      new THREE.MeshBasicMaterial({ color: "#7cc4ff" }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    ring.name = "ring";
    beacon.add(beam, ring);
    const x = (call.tileX + 0.5) * TILE;
    const z = (call.tileY + 0.5) * TILE;
    beacon.position.set(x, this.groundAt(x, z), z);
    this.group.add(beacon);
    this.beacon = beacon;
  }

  private removeBeacon() {
    if (!this.beacon) return;
    this.group.remove(this.beacon);
    disposeObject3D(this.beacon);
    this.beacon = null;
    this.beaconKey = "";
  }

  private ensureCar(call: PoliceCall) {
    const parked = call.phase === "stopped" || call.phase === "inspecting" || call.phase === "resolving";
    switch (call.kind) {
      case "traffic_stop":
      case "pursuit":
        // Moving cars appear once spotted; a reload mid-stop parks them back where they stopped.
        if (!this.car && parked) {
          this.spawnCar(call, { x: call.tileX + 0.5, z: call.tileY + 0.5 }, false);
        }
        if (this.car) this.syncPerson(call, parked);
        return;
      case "stolen_vehicle":
        if (!this.car) {
          const x = (call.targetTileX ?? call.tileX) + 0.5;
          const z = (call.targetTileY ?? call.tileY) + 0.5;
          this.spawnCar(call, { x, z }, false, true);
        }
        return;
      case "vip_escort":
        if (!this.car) {
          this.spawnLimo(call);
        }
        return;
      default:
        return;
    }
  }

  private spawnCar(call: PoliceCall, at: { x: number; z: number }, moving: boolean, hazards = false) {
    const look = npcCar(
      `mission-${call.id}`,
      categoryFor(call.vehicleModel),
      call.vehicleColor ?? "#2b2f36",
      call.plate ?? "RIV-000",
    );
    const mesh = makePlayerCarMesh(look);
    const lights: THREE.Mesh[] = [];
    if (hazards) {
      const amber = new THREE.MeshStandardMaterial({ color: "#ffb020", emissive: "#ff9a00", emissiveIntensity: 2 });
      const geo = new THREE.BoxGeometry(0.22, 0.12, 0.06);
      for (const [x, z] of [
        [-0.7, -2.18],
        [0.7, -2.18],
        [-0.7, 2.18],
        [0.7, 2.18],
      ]) {
        const lamp = new THREE.Mesh(geo, amber);
        lamp.position.set(x, 0.85, z);
        mesh.add(lamp);
        lights.push(lamp);
      }
    }
    const tile = { x: Math.floor(at.x), y: Math.floor(at.z) };
    const pursuit = call.kind === "pursuit";
    const driver = moving
      ? new RoadDriver(this.state, tile, (opts) => this.chooseTurn(call, opts), {
          // Pursuit corners sweep instead of snapping 90° at every intersection.
          turnRate: pursuit ? 1.55 : 3.2,
          holdStraight: pursuit ? 0.9 : 0.5,
        })
      : null;
    if (driver && pursuit) driver.speed = 12;
    if (pursuit) this.addTracker(mesh);
    if (driver) {
      mesh.position.copy(driver.pos);
      mesh.rotation.y = driver.yaw;
    } else {
      const wx = at.x * TILE;
      const wz = at.z * TILE;
      mesh.position.set(wx, this.groundAt(wx, wz) - 0.15, wz);
      mesh.rotation.y = this.roadYaw(tile);
    }
    this.group.add(mesh);
    this.car = { mesh, driver, hazards: lights, person: null };
  }

  private spawnLimo(call: PoliceCall) {
    const look = npcCar(`vip-${call.id}`, "luxury", "#0d0e12", "VIP-1", true);
    const mesh = makePlayerCarMesh(look);
    const flagMat = new THREE.MeshStandardMaterial({ color: "#c9a44c", emissive: "#5a4210", emissiveIntensity: 0.4 });
    for (const x of [-0.85, 0.85]) {
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.34), flagMat);
      flag.position.set(x, 1.15, -2.2);
      mesh.add(flag);
    }
    const x = (call.tileX + 0.5) * TILE;
    const z = (call.tileY + 0.5) * TILE;
    mesh.position.set(x, this.groundAt(x, z) - 0.15, z);
    mesh.rotation.y = this.roadYaw({ x: call.tileX, y: call.tileY });
    this.group.add(mesh);
    this.car = { mesh, driver: null, hazards: [], person: null };
    this.trail = [{ x, z, d: 0 }];
    this.trailDist = 0;
    this.limoDist = 0;
  }

  /** Driver (traffic stop) or suspect (pursuit) standing at the door once the car is stopped. */
  private syncPerson(call: PoliceCall, parked: boolean) {
    const car = this.car;
    if (!car) return;
    const want = parked && call.phase !== "stopped";
    if (!want) {
      if (car.person) {
        this.group.remove(car.person);
        disposeObject3D(car.person);
        car.person = null;
      }
      return;
    }
    if (car.person) return;
    const person = buildStreetPerson(
      call.kind === "pursuit"
        ? { shirt: "#2a2a2e", pants: "#1c1c22", hair: "#141010" }
        : { shirt: "#8a6a4a", pants: "#2a3a5a", hair: "#4a3020" },
    );
    const yaw = car.mesh.rotation.y;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    // Driver side is the car's left.
    const x = car.mesh.position.x + fz * 1.55;
    const z = car.mesh.position.z - fx * 1.55;
    person.position.set(x, this.groundAt(x, z), z);
    person.rotation.y = yaw + Math.PI / 2;
    this.group.add(person);
    car.person = person;
  }

  private removeCar() {
    const car = this.car;
    if (!car) return;
    this.group.remove(car.mesh);
    disposeCarMesh(car.mesh);
    if (car.person) {
      this.group.remove(car.person);
      disposeObject3D(car.person);
    }
    this.car = null;
  }

  /** A road tile a few car lengths ahead, so the suspect appears in view. */
  private spawnPointAhead(player: MissionPlayer) {
    const fx = -Math.sin(player.yaw);
    const fz = -Math.cos(player.yaw);
    let found: Tile | null = null;
    for (let step = 2; step <= 4; step++) {
      const tx = Math.floor(player.x / TILE + fx * step);
      const tz = Math.floor(player.z / TILE + fz * step);
      const tile = this.state.tiles[tz]?.[tx];
      if (tile?.road || tile?.bridge) found = { x: tx, y: tz };
    }
    if (!found) {
      const near = nearestRoad(this.state, Math.floor(player.x / TILE), Math.floor(player.z / TILE));
      if (near) found = { x: near.x, y: near.y };
    }
    const tile = found ?? { x: Math.floor(player.x / TILE), y: Math.floor(player.z / TILE) };
    return { x: tile.x + 0.5, z: tile.y + 0.5 };
  }

  private roadYaw(tile: Tile) {
    const road = (x: number, y: number) => Boolean(this.state.tiles[y]?.[x]?.road);
    if (road(tile.x, tile.y - 1) || road(tile.x, tile.y + 1)) return 0;
    return Math.PI / 2;
  }

  private playerPos = { x: 0, z: 0 };

  /** Roof mast plus a red column so the fleeing car stays visible. */
  private addTracker(mesh: THREE.Group) {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: "#1a1a1a", metalness: 0.4, roughness: 0.5 }),
    );
    mast.position.set(0, 1.12, 0.15);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 8),
      new THREE.MeshStandardMaterial({ color: "#ff3b30", emissive: "#ff2018", emissiveIntensity: 2.2 }),
    );
    bulb.position.set(0, 1.38, 0.15);
    bulb.name = "tracker";
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.55, 22, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#ff3344",
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beam.position.y = 12;
    beam.name = "tracker-beam";
    mesh.add(mast, bulb, beam);
  }

  /** Tile position of the mission car, for the minimap tracker. */
  trackedCar(): { x: number; y: number } | null {
    const mesh = this.car?.mesh;
    if (!mesh) return null;
    return { x: mesh.position.x / TILE, y: mesh.position.z / TILE };
  }

  private chooseTurn(call: PoliceCall, options: Tile[]) {
    if (call.kind !== "pursuit" || Math.random() < 0.15) {
      return options[Math.floor(Math.random() * options.length)];
    }
    // Run away from the cruiser.
    let best = options[0];
    let bestD = -Infinity;
    for (const o of options) {
      const d = Math.hypot((o.x + 0.5) * TILE - this.playerPos.x, (o.y + 0.5) * TILE - this.playerPos.z);
      if (d > bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  // ── Per-frame ────────────────────────────────────────────────────────

  update(dt: number, call: PoliceCall | null, player: MissionPlayer): PoliceSceneEvent[] {
    this.time += dt;
    this.playerPos = { x: player.x, z: player.z };
    const events: PoliceSceneEvent[] = [];
    this.note = null;
    if (this.beacon) {
      const ring = this.beacon.getObjectByName("ring");
      if (ring) ring.scale.setScalar(1 + Math.sin(this.time * 3) * 0.08);
    }
    if (this.car) {
      for (const lamp of this.car.hazards) {
        (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(this.time * 6) > 0 ? 2.4 : 0.1;
      }
      const bulb = this.car.mesh.getObjectByName("tracker");
      if (bulb && bulb instanceof THREE.Mesh) {
        const mat = bulb.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = Math.sin(this.time * 7) > 0 ? 3.4 : 0.35;
      }
      const beam = this.car.mesh.getObjectByName("tracker-beam");
      if (beam && beam instanceof THREE.Mesh) {
        const mat = beam.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.14 + (Math.sin(this.time * 4) > 0 ? 0.16 : 0);
      }
    }
    if (!call || call.id !== this.callId || call.phase === "completed") return events;

    const emit = (event: PoliceSceneEvent, key: string = event.type) => {
      if (this.sent.has(key)) return;
      this.sent.add(key);
      events.push(event);
    };
    const distTo = (x: number, z: number) => Math.hypot(x - player.x, z - player.z);
    const callX = (call.tileX + 0.5) * TILE;
    const callZ = (call.tileY + 0.5) * TILE;

    switch (call.kind) {
      case "patrol": {
        const d = distTo(callX, callZ);
        this.note = `${Math.round(d)} m`;
        if (player.inCruiser && d < CHECKPOINT_RANGE) emit({ type: "checkpoint" }, `checkpoint:${call.checkpoint ?? 0}`);
        break;
      }
      case "traffic_stop":
      case "pursuit": {
        const pursuit = call.kind === "pursuit";
        const waiting =
          call.phase === "accepted" ||
          call.phase === "traveling" ||
          (pursuit && call.phase === "pursuing");
        if (waiting && !this.car) {
          const close = player.inCruiser && distTo(callX, callZ) < SPOT_RANGE + (pursuit ? 6 : 0);
          // A reload keeps the call in "pursuing" and used to leave the street empty.
          const resume = pursuit && call.phase === "pursuing" && player.inCruiser;
          if (close || resume) {
            const at = pursuit
              ? this.spawnPointAhead(player)
              : { x: call.tileX + 0.5, z: call.tileY + 0.5 };
            this.spawnCar(call, at, true);
            if (call.phase !== "pursuing") emit({ type: "spotted" });
          }
          if (!this.car || call.phase !== "pursuing") break;
        }
        const car = this.car;
        if (!car?.driver || call.phase !== "pursuing") break;
        const driver = car.driver;
        const d = distTo(driver.pos.x, driver.pos.z);
        if (pursuit) {
          this.chaseTime += dt;
          // Straight-line pace stays catchable; corners bleed speed so the turn is wide.
          const cruise = Math.max(12, 17 - this.chaseTime * 0.1);
          const flee = this.stopping ? 0 : cruise * (driver.turning ? 0.42 : 1);
          driver.speed += (flee - driver.speed) * Math.min(1, dt * (this.stopping ? 3 : 1.2));
          if (!this.stopping) {
            this.lostTimer = d > LOSE_RANGE ? this.lostTimer + dt : 0;
            const ready = this.chaseTime >= CATCH_AFTER;
            if (ready && d < CATCH_RANGE) this.stopping = true;
            if (this.lostTimer >= 8) {
              this.removeCar();
              emit({ type: "escaped" });
              break;
            }
            const wait = Math.max(0, Math.ceil(CATCH_AFTER - this.chaseTime));
            this.note =
              d > LOSE_RANGE
                ? `Losing them — ${Math.max(0, Math.ceil(8 - this.lostTimer))} s`
                : ready
                  ? `${Math.round(d)} m · within 10 m catches them`
                  : `${Math.round(d)} m · tracker live · catch in ${wait} s`;
          }
        } else {
          const cruise = this.stopping ? 0 : player.lights && d < 40 ? 8 : 11;
          driver.speed += (cruise - driver.speed) * Math.min(1, dt * (this.stopping ? 1.6 : 1.2));
          if (!this.stopping) {
            this.pullTimer = player.lights && d < PULL_OVER_RANGE ? this.pullTimer + dt : Math.max(0, this.pullTimer - dt);
            if (this.pullTimer >= 1.4) this.stopping = true;
            this.note = `${Math.round(d)} m`;
          }
        }
        if (this.stopping) {
          driver.lane += (CURB - driver.lane) * Math.min(1, dt * 2);
          this.note = pursuit ? "Suspect stopping…" : "Pulling over…";
        }
        driver.step(dt);
        car.mesh.position.set(driver.pos.x, this.groundAt(driver.pos.x, driver.pos.z) - 0.15, driver.pos.z);
        car.mesh.rotation.y = driver.yaw;
        if (this.stopping && driver.speed < 0.35) {
          driver.speed = 0;
          car.driver = null;
          emit({ type: "stopped", x: driver.pos.x / TILE, y: driver.pos.z / TILE });
        }
        break;
      }
      case "stolen_vehicle": {
        if (call.phase !== "accepted" && call.phase !== "traveling") break;
        const car = this.car;
        if (!car) break;
        const d = distTo(car.mesh.position.x, car.mesh.position.z);
        if (d < 22) emit({ type: "found", x: car.mesh.position.x / TILE, y: car.mesh.position.z / TILE });
        break;
      }
      case "vip_escort": {
        const car = this.car;
        if (!car) break;
        if (call.phase !== "escorting") {
          const d = distTo(car.mesh.position.x, car.mesh.position.z);
          if (player.inCruiser && d < 24) emit({ type: "vip_ready" });
          break;
        }
        this.followTrail(dt, player);
        const gap = this.trailDist - this.limoDist;
        const destX = ((call.destTileX ?? call.tileX) + 0.5) * TILE;
        const destZ = ((call.destTileY ?? call.tileY) + 0.5) * TILE;
        const toDest = distTo(destX, destZ);
        this.note = gap > 70 ? "Slow down — the limo is falling behind" : `limo ${Math.round(gap)} m back · ${Math.round(toDest)} m to go`;
        if (toDest < 20 && gap < 34) emit({ type: "vip_delivered" });
        break;
      }
      default:
        break;
    }
    return events;
  }

  /** The limo drives the exact line the cruiser drove, a few car lengths back. */
  private followTrail(dt: number, player: MissionPlayer) {
    const car = this.car;
    if (!car) return;
    const last = this.trail[this.trail.length - 1];
    if (!last) {
      this.trail.push({ x: player.x, z: player.z, d: 0 });
      return;
    }
    const step = Math.hypot(player.x - last.x, player.z - last.z);
    if (step > 0.8) {
      this.trailDist += step;
      this.trail.push({ x: player.x, z: player.z, d: this.trailDist });
    }
    const want = this.trailDist - VIP_GAP;
    if (want > this.limoDist) this.limoDist += Math.min(want - this.limoDist, 17 * dt);
    while (this.trail.length > 2 && this.trail[1].d < this.limoDist - 25) this.trail.shift();
    let i = 0;
    while (i < this.trail.length - 2 && this.trail[i + 1].d < this.limoDist) i++;
    const a = this.trail[i];
    const b = this.trail[Math.min(i + 1, this.trail.length - 1)];
    const span = Math.max(0.0001, b.d - a.d);
    const u = THREE.MathUtils.clamp((this.limoDist - a.d) / span, 0, 1);
    const x = a.x + (b.x - a.x) * u;
    const z = a.z + (b.z - a.z) * u;
    if (b !== a) car.mesh.rotation.y = turnToward(car.mesh.rotation.y, yawToward(b.x - a.x, b.z - a.z), dt * 6);
    car.mesh.position.set(x, this.groundAt(x, z) - 0.15, z);
  }
}
