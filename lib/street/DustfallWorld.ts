import * as THREE from "three";
import { DriveControls } from "./driveControls";
import type { CityState } from "@/lib/city/types";
import { TILE, type Blocker } from "./buildCity";

const ROAD_HALF = 5.5;
const SEGMENT = 48;
const SEGMENTS = 28;
/** Flat sim grid — large enough that the full highway fits before the south edge. */
const MAP_SIZE = 200;
const LANE_TILE = 100;

/** Minimap / drive bounds for the Highway 93 corridor (tile space). */
export const HIGHWAY_CORRIDOR = {
  size: MAP_SIZE,
  laneTile: LANE_TILE,
  /** South end — Riverside approach. */
  startTileY: MAP_SIZE - 8,
  /** North end — Dustfall skyline. */
  get endTileY() {
    return (MAP_SIZE - 8) - (SEGMENTS * SEGMENT) / TILE;
  },
} as const;

let corridorStateCache: CityState | null = null;

/** Shared CityState used by DustfallWorld driving and the highway minimap. */
export function highwayCorridorState(): CityState {
  if (corridorStateCache) return corridorStateCache;
  corridorStateCache = makeFlatDriveState();
  return corridorStateCache;
}

function makeFlatDriveState(): CityState {
  const size = MAP_SIZE;
  const startY = HIGHWAY_CORRIDOR.startTileY;
  const endY = HIGHWAY_CORRIDOR.endTileY;
  const tiles = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const along = (startY - y) / Math.max(1, startY - endY);
      const terrain =
        along < 0.28 ? ("park" as const) : along < 0.55 ? ("sand" as const) : ("sand" as const);
      return {
        x,
        y,
        terrain: Math.abs(x - LANE_TILE) > 14 ? ("sand" as const) : terrain,
        road:
          Math.abs(x - LANE_TILE) <= 1
            ? { north: true, south: true, east: false, west: false }
            : null,
        bridge: null,
        buildingId: null,
        tree: null,
        graffiti: null,
      };
    }),
  );
  return {
    id: "dustfall-corridor",
    name: "Highway 93",
    seed: 0,
    size,
    tiles,
    buildings: new Map(),
    citizens: [],
    vehicles: [],
    parked: [],
    buses: [],
    signals: [],
    roadWorks: [],
    events: [],
    budget: { treasury: 0, income: 0, expense: 0 },
    clock: { dayIndex: 0, minuteOfDay: 12 * 60, dayOfYear: 1, year: 2026 },
    weather: null,
  } as unknown as CityState;
}

function boxBlocker(x: number, z: number, halfX: number, halfZ: number): Blocker {
  return {
    minX: x - halfX,
    maxX: x + halfX,
    minZ: z - halfZ,
    maxZ: z + halfZ,
  };
}

/**
 * Continuous Highway 93 corridor between Riverside and Dustfall.
 * `toward: "dustfall"` drives north into the desert; `"riverside"` drives south home.
 */
export class DustfallWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: DriveControls;
  readonly toward: "dustfall" | "riverside";

  private readonly group = new THREE.Group();
  private carMesh: THREE.Group;
  private progress = 0;
  private arrived = false;
  private exitRequested = false;
  private readonly startZ: number;
  private readonly endZ: number;
  private readonly laneX: number;
  private readonly blockers: Blocker[] = [];
  private readonly traffic: HighwayTrafficCar[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    color: string,
    toward: "dustfall" | "riverside" = "dustfall",
  ) {
    this.toward = toward;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1200);
    const startSky = toward === "riverside" ? "#e8b86a" : "#7eb3e0";
    this.scene.background = new THREE.Color(startSky);
    this.scene.fog = new THREE.Fog(startSky, 80, 420);

    const hemi = new THREE.HemisphereLight(0xf4f8fc, 0xc4a574, 1.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe6c2, 1.4);
    sun.position.set(30, 70, 10);
    this.scene.add(sun);

    this.laneX = LANE_TILE * TILE + TILE / 2;
    // Keep the whole drive inside the map: z decreases north toward Dustfall.
    this.startZ = (MAP_SIZE - 8) * TILE;
    this.endZ = this.startZ - SEGMENTS * SEGMENT;

    this.buildCorridor();

    const state = highwayCorridorState();
    this.controls = new DriveControls(state, this.blockers);
    this.controls.topSpeed = 42;
    this.controls.accel = 28;
    this.controls.offroad = true;
    if (toward === "riverside") {
      // Start just past Dustfall skyline, facing south toward Riverside.
      this.controls.spawnAt(this.laneX, this.endZ + 28, Math.PI);
      this.progress = 0.92;
    } else {
      this.controls.spawnAt(this.laneX, this.startZ - 8, 0);
    }

    this.scene.add(this.group);
    this.carMesh = makeSimpleCar(color);
    this.scene.add(this.carMesh);
    this.spawnTraffic();
  }

  private buildCorridor() {
    const roadMat = new THREE.MeshStandardMaterial({ color: "#3b3d43", roughness: 0.92 });
    const sandMat = new THREE.MeshStandardMaterial({ color: "#c4a574", roughness: 1 });
    const rockMat = new THREE.MeshStandardMaterial({ color: "#8a5a3a", roughness: 0.95 });
    const grassMat = new THREE.MeshStandardMaterial({ color: "#2f6b34", roughness: 1 });
    const dashMat = new THREE.MeshStandardMaterial({ color: "#cfc7bc" });
    const cx = this.laneX;

    for (let i = 0; i < SEGMENTS; i++) {
      const z = this.startZ - 20 - i * SEGMENT;
      const t = i / (SEGMENTS - 1);
      const groundMat =
        t < 0.3
          ? grassMat
          : t < 0.55
            ? new THREE.MeshStandardMaterial({
                color: new THREE.Color().lerpColors(
                  new THREE.Color("#2f6b34"),
                  new THREE.Color("#c4a574"),
                  (t - 0.3) / 0.25,
                ),
                roughness: 1,
              })
            : sandMat;

      const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, SEGMENT + 4), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(cx, -0.04, z);
      this.group.add(ground);

      const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, SEGMENT + 2), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(cx, 0.03, z);
      this.group.add(road);

      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 5), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(cx, 0.05, z);
      this.group.add(dash);

      if (i % 3 === 0) {
        const poleX = cx + ROAD_HALF + 2.4;
        const lamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.18, 10, 6),
          new THREE.MeshStandardMaterial({ color: "#2a2e34" }),
        );
        lamp.position.set(poleX, 5, z);
        this.group.add(lamp);
        this.blockers.push(boxBlocker(poleX, z, 0.55, 0.55));
      }

      // Rocks stay well off the pavement.
      if (t > 0.4 && i % 2 === 0) {
        const radius = 2.2 + (i % 3) * 0.6;
        const side = i % 2 ? 1 : -1;
        const rockX = cx + side * (18 + (i % 4) * 4);
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), rockMat);
        rock.position.set(rockX, 1.4, z);
        this.group.add(rock);
        this.blockers.push(boxBlocker(rockX, z, radius * 0.85, radius * 0.85));
      }

      if (i === 1) {
        const sign = makeHighwaySign();
        sign.position.set(cx - 10, 7, z);
        this.group.add(sign);
        // Keep the sign collider off the asphalt (halfX 5.8 used to clip the left lane).
        this.blockers.push(boxBlocker(cx - 12.5, z, 3.2, 0.6));
      }
    }

    // Dustfall skyline past the finish — leave a clear road gap through the middle.
    const townZ = this.endZ - 36;
    const leftXs = [-28, -22, -16];
    const rightXs = [16, 22, 28, 34];
    for (const [list, odd] of [
      [leftXs, true],
      [rightXs, false],
    ] as const) {
      list.forEach((dx, i) => {
        const h = 5 + ((i + (odd ? 1 : 0)) % 4) * 2.8;
        const bx = cx + dx;
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(5.5, h, 5.5),
          new THREE.MeshStandardMaterial({
            color: i % 2 ? "#8a6a4a" : "#6a5340",
            roughness: 0.9,
          }),
        );
        b.position.set(bx, h / 2, townZ);
        this.group.add(b);
        this.blockers.push(boxBlocker(bx, townZ, 2.9, 2.9));
      });
    }

    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2, 20, 8),
      new THREE.MeshStandardMaterial({ color: "#a08060" }),
    );
    tower.position.set(cx + 20, 10, townZ - 18);
    this.group.add(tower);
    this.blockers.push(boxBlocker(cx + 20, townZ - 18, 2.2, 2.2));

    const motel = new THREE.Mesh(
      new THREE.BoxGeometry(16, 4, 8),
      new THREE.MeshStandardMaterial({ color: "#b8956a" }),
    );
    motel.position.set(cx - 22, 2, townZ + 18);
    this.group.add(motel);
    this.blockers.push(boxBlocker(cx - 22, townZ + 18, 8.2, 4.2));
  }

  /** Two-way NPC traffic sharing the pavement with the player. */
  private spawnTraffic() {
    const colors = [
      "#c0392b",
      "#2c3e50",
      "#f4f1ea",
      "#1f4d8c",
      "#d4a017",
      "#4a6741",
      "#8e44ad",
      "#e67e22",
      "#1abc9c",
      "#7f8c8d",
      "#b8956a",
      "#34495e",
    ];
    const count = 12;
    const travel = this.startZ - this.endZ;
    const laneOffset = 2.75;
    for (let i = 0; i < count; i++) {
      const northbound = i % 2 === 0;
      // Right-hand traffic: northbound on +X, southbound on −X.
      const lane = northbound ? 1 : -1;
      const dir: 1 | -1 = northbound ? -1 : 1;
      const t = (i + 0.35) / count;
      const z = this.endZ + 36 + t * (travel - 72);
      const x = this.laneX + lane * laneOffset;
      const speed = 16 + (i % 5) * 3.2 + (northbound ? 1.5 : 0);
      const mesh = makeSimpleCar(colors[i % colors.length], i % 4 === 0 ? "truck" : "car");
      mesh.position.set(x, 0.4, z);
      mesh.rotation.y = northbound ? 0 : Math.PI;
      this.scene.add(mesh);
      const halfZ = i % 4 === 0 ? 3.1 : 2.15;
      // Visual traffic only — solid NPC hitboxes were wedging the player in place.
      this.traffic.push({
        mesh,
        z,
        lane,
        speed,
        dir,
        blocker: boxBlocker(x, z, 1.15, halfZ),
        halfZ,
      });
    }
  }

  private updateTraffic(dt: number) {
    const minZ = this.endZ - 24;
    const maxZ = this.startZ + 24;
    const laneOffset = 2.75;
    const playerX = this.controls.position.x;
    const playerZ = this.controls.position.z;
    for (const car of this.traffic) {
      const x = this.laneX + car.lane * laneOffset;
      const nearPlayer = Math.hypot(playerX - x, playerZ - car.z) < 12;
      const sameLane = Math.abs(playerX - x) < 3.2;
      const slow = nearPlayer && sameLane ? 0.38 : 1;
      car.z += car.dir * car.speed * slow * dt;
      if (car.dir < 0 && car.z < minZ) car.z = maxZ;
      if (car.dir > 0 && car.z > maxZ) car.z = minZ;

      car.mesh.position.set(x, 0.4, car.z);
      car.mesh.rotation.y = car.dir < 0 ? 0 : Math.PI;
      car.blocker.minX = x - 1.15;
      car.blocker.maxX = x + 1.15;
      car.blocker.minZ = car.z - car.halfZ;
      car.blocker.maxZ = car.z + car.halfZ;
    }
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(dt: number, fuelEmpty = false) {
    this.controls.update(dt, fuelEmpty);
    this.controls.position.x = THREE.MathUtils.clamp(
      this.controls.position.x,
      this.laneX - 95,
      this.laneX + 95,
    );
    this.updateTraffic(dt);
    this.controls.applyTo(this.camera);
    this.carMesh.position.copy(this.controls.position);
    this.carMesh.position.y -= 0.15;
    this.carMesh.rotation.y = this.controls.yaw;

    const span = Math.max(1, this.startZ - this.endZ);
    this.progress = Math.max(0, Math.min(1, (this.startZ - this.controls.position.z) / span));
    if (this.toward === "dustfall") {
      if (this.progress >= 0.9) this.arrived = true;
    } else if (this.progress <= 0.1) {
      this.arrived = true;
    }

    const desert =
      this.toward === "riverside"
        ? Math.max(0, (this.progress - 0.12) / 0.55)
        : Math.max(0, (this.progress - 0.28) / 0.55);
    const sky = new THREE.Color().lerpColors(new THREE.Color("#7eb3e0"), new THREE.Color("#e8b86a"), desert);
    this.scene.background = sky;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(sky);
    }
    this.renderer.render(this.scene, this.camera);
  }

  getProgress() {
    // UI: 0 → just left origin, 1 → arrived at destination.
    return this.toward === "riverside" ? 1 - this.progress : this.progress;
  }

  hasArrived() {
    return this.arrived;
  }

  /** Reverse past the entrance for the active trip direction. */
  wantsAbortTrip() {
    if (this.toward === "dustfall") {
      return this.controls.position.z > this.startZ - 2.5;
    }
    return this.controls.position.z < this.endZ + 12;
  }

  /** @deprecated use wantsAbortTrip */
  wantsReturnToRiverside() {
    return this.toward === "dustfall" && this.wantsAbortTrip();
  }

  wantsExitVehicle() {
    return this.exitRequested;
  }

  requestExitVehicle() {
    this.exitRequested = true;
  }

  mph() {
    return this.controls.mph();
  }

  /** Player / vehicle position in tile coordinates, for the minimap. */
  get tilePosition() {
    return {
      x: this.controls.position.x / TILE,
      y: this.controls.position.z / TILE,
      yaw: this.controls.yaw,
    };
  }

  look(dx: number, dy: number) {
    this.controls.look(dx, dy);
  }

  dispose() {
    this.renderer.dispose();
    this.scene.clear();
  }
}

function makeSimpleCar(color: string, kind: "car" | "truck" = "car") {
  const g = new THREE.Group();
  const bodyLen = kind === "truck" ? 5.6 : 4.2;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, kind === "truck" ? 0.7 : 0.55, bodyLen),
    new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.42 }),
  );
  body.position.y = kind === "truck" ? 0.7 : 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 0.5, kind === "truck" ? 1.6 : 2),
    new THREE.MeshStandardMaterial({ color: "#9ec5e8", transparent: true, opacity: 0.5 }),
  );
  cabin.position.set(0, kind === "truck" ? 1.25 : 1.0, kind === "truck" ? bodyLen * 0.22 : -0.1);
  g.add(cabin);
  if (kind === "truck") {
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.9, 2.8),
      new THREE.MeshStandardMaterial({ color: "#3a3d42", roughness: 0.9 }),
    );
    bed.position.set(0, 1.15, -1.1);
    g.add(bed);
  }
  return g;
}

type HighwayTrafficCar = {
  mesh: THREE.Group;
  z: number;
  lane: number;
  speed: number;
  dir: 1 | -1;
  blocker: Blocker;
  halfZ: number;
};

function makeHighwaySign() {
  const g = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(11, 3.4, 0.4),
    new THREE.MeshStandardMaterial({ color: "#1f6b3a", roughness: 0.65 }),
  );
  g.add(board);
  const postL = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 8, 0.35),
    new THREE.MeshStandardMaterial({ color: "#c5c9ce" }),
  );
  postL.position.set(-4, -5.5, 0);
  const postR = postL.clone();
  postR.position.x = 4;
  g.add(postL, postR);
  return g;
}
