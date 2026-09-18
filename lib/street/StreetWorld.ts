import * as THREE from "three";
import type { Building, CityState } from "@/lib/city/types";
import { findStadium, stadiumIsOpen } from "@/lib/city/stadium";
import { stadiumFireworksOn } from "@/lib/city/fireworks";
import { lodgingUse } from "@/lib/city/lodging";
import { isEnterableVenue } from "@/lib/city/venues";
import { lightingFor, type Lighting } from "@/lib/renderer/palette";
import { AgentLayer } from "./agents";
import { buildCity, TILE, updateTrafficSignals, type CityMeshes } from "./buildCity";
import { BuildingGlow } from "./buildingGlow";
import { FLOOR_H } from "./textures";
import { StreetControls, type MoveMode } from "./controls";
import { skyTexture } from "./textures";
import { StreetWeatherFx } from "./weatherFx";
import { StreetFireworks } from "./streetFireworks";
import { HeldItemView } from "./heldItem";
import type { PhoneWaypoint } from "@/lib/city/phone";
import type { OwnedVehicle } from "@/lib/city/vehicles";
import { DUSTFALL_RETURN_BRIDGE, DUSTFALL_RETURN_PORTAL_Y, HIGHWAY_PORTAL_Y, HIGHWAY_RAMP, driveStats } from "@/lib/city/vehicles";
import { findPath, nearestRoad } from "@/lib/simulation/traffic/pathfinding";
import { DriveControls } from "./driveControls";
import { makePlayerCarMesh, placeCarMesh } from "./playerCar";

/** Field of view at rest, and how far it narrows mid-hop. */
const BASE_FOV = 72;
const HOP_ZOOM = 7;

/** How many lamps get a real point light at once. */
const LIVE_LAMPS = 16;
const NAV_ARROWS = 14;
const NAV_SPACING = 4.6;

/**
 * Owns the Three.js scene for the walkable view: static city geometry, the
 * moving agents, the sun and street lighting, and the first-person camera.
 * Lighting is driven by the same `lightingFor` model the isometric renderer
 * uses, so the two views share one time of day.
 */
export class StreetWorld {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: StreetControls;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private city: CityMeshes;
  private agents: AgentLayer;

  private sun = new THREE.DirectionalLight(0xffffff, 2.2);
  private hemi = new THREE.HemisphereLight(0xbfd8ea, 0x3d4a3a, 1);
  /** Warm fill so the pavement underfoot never drops to black between lamps. */
  private streetFill = new THREE.PointLight(0xffd6a8, 0, 16, 1.6);
  private lampLights: THREE.PointLight[] = [];
  private sky: THREE.Texture | null = null;
  private skyKey = "";
  private time = 0;
  private weatherFx = new StreetWeatherFx();
  private fireworks = new StreetFireworks();
  private fireworkOrigin = new THREE.Vector3();
  private heldView = new HeldItemView();
  private glow = new BuildingGlow();
  private pinnedId: string | null = null;
  private aimedId: string | null = null;
  private aimRay = new THREE.Ray();
  private aimDir = new THREE.Vector3();
  private aimHit = new THREE.Vector3();
  private windowRT: THREE.WebGLRenderTarget | null = null;
  private windowCam = new THREE.PerspectiveCamera(48, 1.6, 0.35, 700);
  private windowBuf: Uint8Array | null = null;
  private navTarget: PhoneWaypoint | null = null;
  private navArrows: THREE.InstancedMesh;
  private navDummy = new THREE.Object3D();
  private navMat: THREE.MeshStandardMaterial;
  private navPath: Array<{ x: number; z: number }> = [];
  private navPathKey = "";
  private drive: DriveControls | null = null;
  private drivingId: string | null = null;
  private ownedCarMeshes = new Map<string, THREE.Group>();
  private ownedCarRoot = new THREE.Group();

  constructor(
    canvas: HTMLCanvasElement,
    private state: CityState,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 1400);
    this.scene.add(this.camera);
    this.heldView.attach(this.camera);

    this.city = buildCity(state);
    this.scene.add(this.city.group);
    this.scene.add(this.glow.group);

    this.controls = new StreetControls(state, this.city.blockers);
    this.agents = new AgentLayer(state, (x, z) => this.controls.groundAt(x, z));
    this.scene.add(this.agents.group);
    this.scene.add(this.weatherFx.group);
    this.city.group.add(this.fireworks.group);

    // The sun casts across a moving box centred on the player.
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.add(this.hemi);
    this.streetFill.position.set(0, -100, 0);
    this.scene.add(this.streetFill);

    for (let i = 0; i < LIVE_LAMPS; i++) {
      const light = new THREE.PointLight(0xffc98a, 0, 38, 1.55);
      light.position.set(0, -100, 0);
      this.lampLights.push(light);
      this.scene.add(light);
    }

    this.scene.fog = new THREE.Fog(0xc9d8e4, 60, 620);

    this.navMat = new THREE.MeshStandardMaterial({
      color: "#39ff6a",
      emissive: new THREE.Color("#22ff66"),
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.92,
      roughness: 0.35,
      metalness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.navArrows = new THREE.InstancedMesh(makeNavArrowGeometry(), this.navMat, NAV_ARROWS);
    this.navArrows.frustumCulled = false;
    this.navArrows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.navArrows.renderOrder = 3;
    this.navArrows.visible = false;
    this.scene.add(this.navArrows);
    this.ownedCarRoot.name = "owned-cars";
    this.scene.add(this.ownedCarRoot);
    if (state.id === "dustfall") this.placeRiversideReturnBridge();
    else this.placeHighway93Props();
  }

  private placeRiversideReturnBridge() {
    const x = DUSTFALL_RETURN_BRIDGE.x * TILE + TILE / 2;
    const z = 33.5 * TILE;
    const sign = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 3.2, 0.35),
      new THREE.MeshStandardMaterial({ color: "#1f6b3a", roughness: 0.7 }),
    );
    board.position.y = 7.4;
    sign.add(board);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 7.6, 0.32),
      new THREE.MeshStandardMaterial({ color: "#c5c9ce" }),
    );
    post.position.set(-4, 3.3, 0);
    const post2 = post.clone();
    post2.position.x = 4;
    sign.add(post, post2);
    sign.position.set(x - 8.5, 0, 31.2 * TILE);
    this.scene.add(sign);

    // Simple deck rails along the wash crossing.
    for (const side of [-1, 1] as const) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 1.1, TILE * 2.2),
        new THREE.MeshStandardMaterial({ color: "#8a7a5c", roughness: 0.85 }),
      );
      rail.position.set(x + side * 4.2, 1.15, z);
      this.scene.add(rail);
    }

    const warn = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 0.12),
      new THREE.MeshStandardMaterial({ color: "#f4d03f" }),
    );
    warn.position.set(x + 5.2, 2.2, 32.2 * TILE);
    warn.rotation.y = Math.PI / 4;
    this.scene.add(warn);
  }

  private placeHighway93Props() {
    const x = HIGHWAY_RAMP.x * TILE + TILE / 2;
    const z = 2.5 * TILE;
    const sign = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 3.1, 0.35),
      new THREE.MeshStandardMaterial({ color: "#1f6b3a", roughness: 0.7 }),
    );
    board.position.y = 7.2;
    sign.add(board);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 7.4, 0.32),
      new THREE.MeshStandardMaterial({ color: "#c5c9ce" }),
    );
    post.position.set(-3.6, 3.2, 0);
    const post2 = post.clone();
    post2.position.x = 3.6;
    sign.add(post, post2);
    sign.position.set(x - 7.5, 0, z);
    this.scene.add(sign);

    const warn = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 0.12),
      new THREE.MeshStandardMaterial({ color: "#f4d03f" }),
    );
    warn.position.set(x + 5.5, 2.2, 4.2 * TILE);
    warn.rotation.y = Math.PI / 4;
    this.scene.add(warn);

    for (const zz of [1.2, 2.8, 4.0]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 11, 6),
        new THREE.MeshStandardMaterial({ color: "#1a1c20" }),
      );
      pole.position.set(x + 6.2, 5.5, zz * TILE);
      this.scene.add(pole);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 8, 8),
        new THREE.MeshStandardMaterial({ color: "#d8dde2", emissive: "#f0f4f8", emissiveIntensity: 0.35 }),
      );
      head.position.set(x + 6.2, 11.1, zz * TILE);
      this.scene.add(head);
    }
  }

  get isDriving() {
    return Boolean(this.drivingId && this.drive);
  }

  get driveControls() {
    return this.drive;
  }

  get drivingVehicleId() {
    return this.drivingId;
  }

  syncOwnedCars(cars: OwnedVehicle[], hideId: string | null = null) {
    const seen = new Set<string>();
    for (const car of cars) {
      seen.add(car.id);
      let mesh = this.ownedCarMeshes.get(car.id);
      if (!mesh) {
        mesh = makePlayerCarMesh(car);
        this.ownedCarMeshes.set(car.id, mesh);
        this.ownedCarRoot.add(mesh);
      }
      const body = mesh.children[0] as THREE.Mesh | undefined;
      if (body && body.material instanceof THREE.MeshStandardMaterial) {
        body.material.color.set(car.color);
      }
      if (car.id === hideId) {
        mesh.visible = false;
        continue;
      }
      const ground = this.controls.groundAt(car.parkX * TILE, car.parkY * TILE);
      placeCarMesh(mesh, car, ground);
    }
    for (const [id, mesh] of this.ownedCarMeshes) {
      if (seen.has(id)) continue;
      mesh.removeFromParent();
      this.ownedCarMeshes.delete(id);
    }
  }

  nearOwnedCar(cars: OwnedVehicle[]) {
    if (this.isDriving) return null;
    const px = this.controls.position.x;
    const pz = this.controls.position.z;
    let best: OwnedVehicle | null = null;
    let bestD = TILE * 2.4;
    for (const car of cars) {
      const dx = px - car.parkX * TILE;
      const dz = pz - car.parkY * TILE;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  nearHighwayRamp() {
    if (this.state.id === "dustfall") return this.nearReturnBridge();
    const pos = this.drive?.position ?? this.controls.position;
    const tx = pos.x / TILE;
    const ty = pos.z / TILE;
    return Math.abs(tx - HIGHWAY_RAMP.x) < 1.6 && ty <= HIGHWAY_RAMP.yMax + 0.8 && ty >= -0.2;
  }

  atHighwayPortal() {
    if (this.state.id === "dustfall") return this.atReturnPortal();
    if (!this.isDriving || !this.drive) return false;
    const tx = this.drive.position.x / TILE;
    const ty = this.drive.position.z / TILE;
    return Math.abs(tx - HIGHWAY_RAMP.x) < 2.2 && ty <= HIGHWAY_PORTAL_Y;
  }

  nearReturnBridge() {
    const pos = this.drive?.position ?? this.controls.position;
    const tx = pos.x / TILE;
    const ty = pos.z / TILE;
    return (
      Math.abs(tx - DUSTFALL_RETURN_BRIDGE.x) < 1.8 &&
      ty >= DUSTFALL_RETURN_BRIDGE.yMin - 0.4 &&
      ty <= DUSTFALL_RETURN_BRIDGE.yMax + 0.6
    );
  }

  atReturnPortal() {
    if (!this.isDriving || !this.drive) return false;
    const tx = this.drive.position.x / TILE;
    const ty = this.drive.position.z / TILE;
    return Math.abs(tx - DUSTFALL_RETURN_BRIDGE.x) < 2.2 && ty >= DUSTFALL_RETURN_PORTAL_Y;
  }

  startDriving(car: OwnedVehicle) {
    const stats = driveStats(car);
    this.drive = new DriveControls(this.state, this.city.blockers);
    this.drive.topSpeed = stats.topSpeed;
    this.drive.accel = stats.accel;
    this.drive.spawnAt(car.parkX * TILE, car.parkY * TILE, car.parkYaw);
    this.drivingId = car.id;
    this.controls.enabled = false;
    this.controls.clearKeys();
    const mesh = this.ownedCarMeshes.get(car.id);
    if (mesh) mesh.visible = false;
  }

  private driveFuelEmpty = false;

  setDriveFuelEmpty(empty: boolean) {
    this.driveFuelEmpty = empty;
  }

  /** Routes pointer / keyboard into walk or drive controls. */
  get inputTarget() {
    return this.drive ?? this.controls;
  }

  stopDriving(): { x: number; y: number; yaw: number } | null {
    if (!this.drive || !this.drivingId) return null;
    const x = this.drive.position.x / TILE;
    const y = this.drive.position.z / TILE;
    const yaw = this.drive.yaw;
    this.controls.spawnAt(x, y, yaw);
    this.controls.enabled = true;
    this.drive = null;
    const id = this.drivingId;
    this.drivingId = null;
    const mesh = this.ownedCarMeshes.get(id);
    if (mesh) mesh.visible = true;
    return { x, y, yaw };
  }

  driveMph() {
    return this.drive?.mph() ?? 0;
  }

  /** Lets a hotel room parent the live city mesh so the window is a real opening. */
  borrowCity() {
    this.scene.remove(this.city.group);
    return this.city.group;
  }

  returnCity(group: THREE.Group) {
    if (group.parent) group.parent.remove(group);
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    group.traverse((obj) => {
      if (obj.userData.mallShell) obj.visible = true;
    });
    this.scene.add(group);
  }

  /** Drops the walker onto the road tile closest to a target tile. */
  spawnNear(tileX: number, tileY: number) {
    const spot = this.nearestJunction(tileX, tileY) ?? this.nearestRoad(tileX, tileY) ?? { x: tileX, y: tileY };
    // Face along whichever street axis is open.
    const tile = this.state.tiles[spot.y]?.[spot.x];
    let yaw = 0;
    if (tile?.road) {
      if (tile.road.north) yaw = Math.PI;
      else if (tile.road.south) yaw = 0;
      else if (tile.road.east) yaw = -Math.PI / 2;
      else if (tile.road.west) yaw = Math.PI / 2;
    }
    this.controls.spawnAt(spot.x, spot.y, yaw);
  }

  /** True when the walker is close enough to step into the ballpark. */
  nearStadiumGate() {
    const stadium = findStadium(this.state);
    if (!stadium || !stadiumIsOpen(stadium)) return false;
    return this.aimedWithin(stadium, TILE * 4.2);
  }

  nearLodgingEntrance() {
    const building = this.aimedBuilding();
    if (!building || !lodgingUse(building)) return null;
    return this.aimedWithin(building, TILE * 2.2) ? building : null;
  }

  nearSubwayEntrance() {
    const building = this.aimedBuilding();
    if (!building || building.kind !== "subway_station") return null;
    return this.aimedWithin(building, TILE * 2.2) ? building : null;
  }

  nearVenueEntrance() {
    const building = this.aimedBuilding();
    if (!building || lodgingUse(building) || !isEnterableVenue(building)) return null;
    return this.aimedWithin(building, TILE * 2.2) ? building : null;
  }

  aimedBuilding() {
    return this.aimedId ? (this.state.buildings.get(this.aimedId) ?? null) : null;
  }

  private aimedWithin(building: Building, range: number) {
    return this.distanceToBuilding(building, this.controls.position.x, this.controls.position.z) < range;
  }

  private distanceToBuilding(building: Building, x: number, z: number) {
    const minX = building.origin.x * TILE;
    const maxX = (building.origin.x + building.width) * TILE;
    const minZ = building.origin.y * TILE;
    const maxZ = (building.origin.y + building.depth) * TILE;
    const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
    const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
    return Math.hypot(dx, dz);
  }

  private nearestJunction(tileX: number, tileY: number) {
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (let y = 0; y < this.state.size; y++) {
      for (let x = 0; x < this.state.size; x++) {
        if (!this.isJunction(x, y)) continue;
        const distance = (x - tileX) ** 2 + (y - tileY) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }
    return best;
  }

  private isStreet(x: number, y: number) {
    const tile = this.state.tiles[y]?.[x];
    return Boolean(tile?.road || tile?.bridge);
  }

  private isJunction(x: number, y: number) {
    if (!this.isStreet(x, y)) return false;
    const north = this.isStreet(x, y - 1);
    const south = this.isStreet(x, y + 1);
    const east = this.isStreet(x + 1, y);
    const west = this.isStreet(x - 1, y);
    const arms = Number(north) + Number(south) + Number(east) + Number(west);
    if (arms !== 2) return true;
    return !((north && south && !east && !west) || (east && west && !north && !south));
  }

  private nearestRoad(tileX: number, tileY: number) {
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (let y = 0; y < this.state.size; y++) {
      for (let x = 0; x < this.state.size; x++) {
        const tile = this.state.tiles[y][x];
        if (!tile.road || tile.bridge) continue;
        const distance = (x - tileX) ** 2 + (y - tileY) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }
    return best;
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private applyLighting(light: Lighting) {
    // Sun arc: east at dawn, overhead at noon, west at dusk.
    const t = this.state.clock.minuteOfDay / (24 * 60);
    const angle = (t - 0.25) * Math.PI * 2;
    const elevation = Math.max(-0.25, Math.sin(angle + Math.PI / 2) * 0.9);

    const target = this.controls.position;
    this.sun.target.position.copy(target);
    this.sun.position.set(
      target.x + Math.cos(angle) * 120,
      target.y + Math.max(6, elevation * 150),
      target.z + Math.sin(angle) * 80,
    );

    const night = light.phase === "night";
    const lampsOn = night || light.phase === "dusk";
    this.sun.intensity = night ? 0.55 : light.sun * 2.6;
    this.sun.color.set(
      light.phase === "dawn" || light.phase === "dusk" ? "#ffb27a" : night ? "#b7cce8" : "#fff6e8",
    );

    this.hemi.intensity = night ? 1.05 : light.ambient * 1.05;
    this.hemi.color.set(night ? "#8aa4c8" : light.skyTop);
    this.hemi.groundColor.set(night ? "#2c3a4c" : "#4a5340");
    this.renderer.toneMappingExposure = night ? 1.32 : 1.05;

    // Facade windows glow with the same curve the isometric view uses.
    for (const material of this.city.emissiveMaterials) {
      material.emissiveIntensity = light.windowLit * (night ? 2.1 : 1.5);
    }
    if (this.city.lampGlow) {
      this.city.lampGlow.emissiveIntensity = lampsOn ? 3.4 : 0.04;
    }

    const here = this.controls.position;
    this.streetFill.position.set(here.x, here.y + 2.2, here.z);
    this.streetFill.intensity = night ? 14 : lampsOn ? 6 : 0;

    // Sky and fog follow the horizon colour.
    const key = `${light.skyTop}|${light.skyBottom}`;
    if (key !== this.skyKey) {
      this.sky?.dispose();
      this.sky = skyTexture(light.skyTop, light.skyBottom);
      this.scene.background = this.sky;
      this.skyKey = key;
    }
    if (this.scene.fog instanceof THREE.Fog) {
      const wet = this.state.weather?.wet;
      this.scene.fog.color.set(night ? "#243656" : light.skyBottom);
      this.scene.fog.near = wet ? 28 : night ? 90 : 70;
      this.scene.fog.far = wet ? 220 : night ? 520 : 640;
    }

    this.updateLamps(lampsOn);
  }

  /** Moves the small pool of point lights onto the closest lamp posts. */
  private updateLamps(on: boolean) {
    if (!on) {
      for (const light of this.lampLights) light.intensity = 0;
      return;
    }

    const here = this.controls.position;
    const nearby = this.city.lamps
      .map((position) => ({ position, distance: position.distanceToSquared(here) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, this.lampLights.length);

    for (let i = 0; i < this.lampLights.length; i++) {
      const light = this.lampLights[i];
      const lamp = nearby[i];
      if (!lamp) {
        light.intensity = 0;
        continue;
      }
      light.position.copy(lamp.position);
      // Fade the furthest ones out so they do not pop in and out.
      const fade = 1 - Math.min(1, Math.sqrt(lamp.distance) / 58);
      light.intensity = 90 * fade;
    }
  }

  setPinnedSelection(id: string | null) {
    this.pinnedId = id;
  }

  setMoveMode(mode: MoveMode) {
    this.controls.setMode(mode);
  }

  setHeld(id: string | null, sips = 0) {
    this.heldView.setHeld(id, sips);
  }

  playSip() {
    this.heldView.playSip();
  }

  /** Phone Maps waypoint in tile coordinates; arrows glow toward it on the ground. */
  setWaypoint(target: PhoneWaypoint | null) {
    this.navTarget = target;
    if (!target) {
      this.navPath = [];
      this.navPathKey = "";
      this.navArrows.visible = false;
    }
  }

  /** True when the walker is on (or beside) the road approach to the current waypoint. */
  arrivedAtWaypoint() {
    const target = this.navTarget;
    if (!target) return false;
    const px = this.controls.position.x / TILE;
    const pz = this.controls.position.z / TILE;
    const goal =
      nearestRoad(this.state, Math.round(target.x), Math.round(target.y)) ??
      this.nearestRoad(Math.round(target.x), Math.round(target.y));
    if (!goal) {
      const dx = px - target.x;
      const dy = pz - target.y;
      return dx * dx + dy * dy <= 4;
    }
    const dx = px - (goal.x + 0.5);
    const dy = pz - (goal.y + 0.5);
    return dx * dx + dy * dy <= 2.25;
  }

  render(dt: number) {
    this.time += dt;
    if (this.drive && this.drivingId) {
      this.drive.update(dt, this.driveFuelEmpty);
      this.drive.applyTo(this.camera);
      const mesh = this.ownedCarMeshes.get(this.drivingId);
      if (mesh) {
        mesh.visible = true;
        mesh.position.copy(this.drive.position);
        mesh.position.y -= 0.15;
        mesh.rotation.y = this.drive.yaw;
      }
    } else {
      this.controls.update(dt);
      this.controls.applyTo(this.camera);
    }
    this.heldView.update(dt);

    // Narrow the lens slightly as a hop travels, the way Street View pushes in
    // between panoramas. Skipped in free-walk mode, where it would feel odd.
    const zoom = !this.drive && this.controls.mode === "hop" ? this.controls.hopEase * HOP_ZOOM : 0;
    const fov = BASE_FOV - zoom;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    const light = lightingFor(this.state);
    this.applyLighting(light);
    this.agents.update(dt);
    updateTrafficSignals(this.city.signals, this.state);

    // Drift the river surface so it never looks like a frozen sheet.
    const water = this.city.water;
    if (water) {
      const material = water.material as THREE.MeshStandardMaterial;
      if (material.normalMap) {
        material.normalMap.offset.set(this.time * 0.014, this.time * 0.03);
      }
    }

    const boats = this.city.boats;
    if (boats) {
      for (const child of boats.children) {
        const phase = typeof child.userData.bob === "number" ? child.userData.bob : 0;
        child.position.y = Math.sin(this.time * 1.35 + phase) * 0.14;
      }
    }
    const wheel = this.city.ferrisWheel;
    if (wheel) {
      wheel.rotation.x = this.time * 0.18;
      const gondolas = wheel.userData.gondolas as THREE.Mesh[] | undefined;
      if (gondolas) {
        for (const gondola of gondolas) {
          gondola.rotation.x = -wheel.rotation.x;
        }
      }
    }

    this.weatherFx.update(dt, this.camera, this.state.weather?.kind ?? "clear");
    this.updateFireworks(dt);
    this.updateGlow(dt);
    this.updateNavArrows();
    this.renderer.render(this.scene, this.camera);
  }

  /** Keep bursts moving while the city mesh is borrowed by a hotel room. */
  tickFireworks(dt: number) {
    this.updateFireworks(dt);
  }

  private updateNavArrows() {
    const target = this.navTarget;
    if (!target) {
      this.navArrows.visible = false;
      return;
    }

    const px = this.controls.position.x;
    const pz = this.controls.position.z;
    const startTile =
      nearestRoad(this.state, Math.floor(px / TILE), Math.floor(pz / TILE)) ??
      this.nearestRoad(Math.floor(px / TILE), Math.floor(pz / TILE));
    const goalTile =
      nearestRoad(this.state, Math.round(target.x), Math.round(target.y)) ??
      this.nearestRoad(Math.round(target.x), Math.round(target.y));
    if (!startTile || !goalTile) {
      this.navArrows.visible = false;
      return;
    }

    const key = `${startTile.x},${startTile.y}->${goalTile.x},${goalTile.y}`;
    if (key !== this.navPathKey) {
      this.navPathKey = key;
      const tiles = findPath(this.state, startTile, goalTile);
      this.navPath = tiles.map((tile) => ({
        x: tile.x * TILE + TILE / 2,
        z: tile.y * TILE + TILE / 2,
      }));
    }

    if (this.navPath.length < 2) {
      this.navArrows.visible = false;
      return;
    }

    const samples = sampleRoadPath(this.navPath, px, pz, NAV_SPACING, NAV_ARROWS);
    if (samples.length === 0) {
      this.navArrows.visible = false;
      return;
    }

    this.navArrows.visible = true;
    const pulse = 0.85 + Math.sin(this.time * 4.2) * 0.15;
    this.navMat.emissiveIntensity = 1.8 + Math.sin(this.time * 5.5) * 0.9;
    this.navMat.opacity = 0.72 + Math.sin(this.time * 3.4) * 0.18;

    for (let i = 0; i < NAV_ARROWS; i++) {
      const sample = samples[i];
      if (!sample) {
        this.navDummy.position.set(0, -40, 0);
        this.navDummy.scale.set(0.001, 0.001, 0.001);
        this.navDummy.updateMatrix();
        this.navArrows.setMatrixAt(i, this.navDummy.matrix);
        continue;
      }
      const ground = this.controls.groundAt(sample.x, sample.z);
      const scale = 0.9 + pulse * 0.18;
      this.navDummy.position.set(sample.x, ground + 0.08, sample.z);
      this.navDummy.rotation.set(0, sample.yaw, 0);
      this.navDummy.scale.set(scale, 1, scale);
      this.navDummy.updateMatrix();
      this.navArrows.setMatrixAt(i, this.navDummy.matrix);
    }
    this.navArrows.instanceMatrix.needsUpdate = true;
  }

  private updateFireworks(dt: number) {
    const stadium = findStadium(this.state);
    if (!stadium) {
      this.fireworks.update(dt, false, this.fireworkOrigin);
      return;
    }
    this.fireworkOrigin.set(
      (stadium.origin.x + stadium.width / 2) * TILE,
      0,
      (stadium.origin.y + stadium.depth / 2) * TILE,
    );
    this.fireworks.update(dt, stadiumFireworksOn(this.state), this.fireworkOrigin);
  }

  private updateGlow(dt: number) {
    if (this.city.group.parent !== this.scene) {
      this.aimedId = null;
      this.glow.hide();
      return;
    }
    this.camera.getWorldDirection(this.aimDir);
    this.aimRay.set(this.camera.position, this.aimDir);
    const aimed = this.glow.pick(this.aimRay, this.city.volumes, this.aimHit);
    this.aimedId = aimed?.id ?? null;
    const pinned = aimed
      ? null
      : (this.city.volumes.find((volume) => volume.id === this.pinnedId) ?? null);
    this.glow.show(aimed ?? pinned ?? null, dt);
  }

  /**
   * Draws the live city from a hotel floor into `dest`, so room windows can
   * show the real streets, trees, and buildings outside.
   */
  renderWindowView(building: Building, floor: number, dest: HTMLCanvasElement, peekX = 0) {
    const pose = windowPose(this.state, building, floor, peekX);
    this.captureView(pose.x, pose.y, pose.z, pose.lookX, pose.lookY, pose.lookZ, dest, 48);
  }

  private captureView(
    x: number,
    y: number,
    z: number,
    lookX: number,
    lookY: number,
    lookZ: number,
    dest: HTMLCanvasElement,
    fov: number,
  ) {
    const width = dest.width;
    const height = dest.height;
    if (!this.windowRT || this.windowRT.width !== width || this.windowRT.height !== height) {
      this.windowRT?.dispose();
      this.windowRT = new THREE.WebGLRenderTarget(width, height);
      this.windowBuf = new Uint8Array(width * height * 4);
    }
    this.windowCam.fov = fov;
    this.windowCam.aspect = width / Math.max(1, height);
    this.windowCam.position.set(x, y, z);
    this.windowCam.lookAt(lookX, lookY, lookZ);
    this.windowCam.updateProjectionMatrix();

    const saved = this.controls.position.clone();
    this.controls.position.set(x, y, z);
    this.applyLighting(lightingFor(this.state));
    this.controls.position.copy(saved);

    const prevShadow = this.renderer.shadowMap.enabled;
    const glowWasVisible = this.glow.group.visible;
    this.glow.hide();
    this.renderer.shadowMap.enabled = false;
    this.renderer.setRenderTarget(this.windowRT);
    this.renderer.render(this.scene, this.windowCam);
    this.renderer.readRenderTargetPixels(this.windowRT, 0, 0, width, height, this.windowBuf!);
    this.renderer.setRenderTarget(null);
    this.renderer.shadowMap.enabled = prevShadow;
    this.glow.group.visible = glowWasVisible;

    const ctx = dest.getContext("2d");
    const buf = this.windowBuf;
    if (!ctx || !buf) return;
    const image = ctx.createImageData(width, height);
    for (let row = 0; row < height; row++) {
      const src = (height - 1 - row) * width * 4;
      image.data.set(buf.subarray(src, src + width * 4), row * width * 4);
    }
    ctx.putImageData(image, 0, 0);
  }

  /** Player / vehicle position in tile coordinates, for the minimap. */
  get tilePosition() {
    const pos = this.drive?.position ?? this.controls.position;
    const yaw = this.drive?.yaw ?? this.controls.yaw;
    return {
      x: pos.x / TILE,
      y: pos.z / TILE,
      yaw,
    };
  }

  dispose() {
    this.heldView.dispose();
    this.agents.dispose();
    this.glow.dispose();
    this.weatherFx.dispose();
    this.fireworks.group.removeFromParent();
    this.fireworks.dispose();
    this.navArrows.geometry.dispose();
    this.navMat.dispose();
    this.city.dispose();
    this.sky?.dispose();
    this.windowRT?.dispose();
    this.renderer.dispose();
  }
}

function windowPose(state: CityState, building: Building, floor: number, peekX: number) {
  const midX = (building.origin.x + building.width / 2) * TILE;
  const midZ = (building.origin.y + building.depth / 2) * TILE;
  const dir = lodgingWindowDir(state, building);
  const storeys = Math.max(1, floor);
  const y = Math.max(2.4, (storeys - 0.35) * FLOOR_H);
  const face = nearestFacade(state, building, dir);
  // Look straight into a neighboring wall at this floor so sky stays out of frame.
  const reach = face ? Math.min(26, Math.max(11, face.dist - 4)) : 16;
  const lookY = face ? Math.min(y, Math.max(y - FLOOR_H * 0.4, face.roof - FLOOR_H)) : y;
  const peek = peekX * 0.35;
  const x = midX + dir.sx * ((building.width * TILE) / 2 + 1.6);
  const z = midZ + dir.sz * ((building.depth * TILE) / 2 + 1.6);
  return {
    x: x + dir.sz * peek,
    y,
    z: z + dir.sx * peek,
    lookX: x + dir.sx * reach + dir.sz * peek * 1.4,
    lookY,
    lookZ: z + dir.sz * reach + dir.sx * peek * 1.4,
  };
}

export function lodgingWindowDir(state: CityState, building: Building) {
  const dirs = [
    { sx: 1, sz: 0 },
    { sx: -1, sz: 0 },
    { sx: 0, sz: 1 },
    { sx: 0, sz: -1 },
  ];
  const ox = building.origin.x + building.width / 2;
  const oy = building.origin.y + building.depth / 2;
  let best = dirs[0];
  let bestScore = -1;
  for (const dir of dirs) {
    let score = 0;
    for (const other of state.buildings.values()) {
      if (other.id === building.id) continue;
      const cx = other.origin.x + other.width / 2 - ox;
      const cz = other.origin.y + other.depth / 2 - oy;
      const along = cx * dir.sx + cz * dir.sz;
      const side = Math.abs(cx * dir.sz - cz * dir.sx);
      if (along < 0.8 || along > 16 || side > 7) continue;
      score += other.floors / (1 + along * 0.12);
    }
    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best;
}

function nearestFacade(
  state: CityState,
  building: Building,
  dir: { sx: number; sz: number },
) {
  const ox = building.origin.x + building.width / 2;
  const oy = building.origin.y + building.depth / 2;
  let best: { dist: number; roof: number } | null = null;
  for (const other of state.buildings.values()) {
    if (other.id === building.id) continue;
    const cx = other.origin.x + other.width / 2 - ox;
    const cz = other.origin.y + other.depth / 2 - oy;
    const along = cx * dir.sx + cz * dir.sz;
    const side = Math.abs(cx * dir.sz - cz * dir.sx);
    if (along < 0.8 || along > 14 || side > 5) continue;
    const dist = along * TILE;
    if (!best || dist < best.dist) {
      best = { dist, roof: other.floors * FLOOR_H };
    }
  }
  return best;
}

function makeNavArrowGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.05);
  shape.lineTo(0.62, -0.08);
  shape.lineTo(0.26, -0.08);
  shape.lineTo(0.26, -0.78);
  shape.lineTo(-0.26, -0.78);
  shape.lineTo(-0.26, -0.08);
  shape.lineTo(-0.62, -0.08);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI);
  geo.translate(0, 0.02, 0);
  return geo;
}

/** Walk the road polyline and drop arrow samples ahead of the player. */
function sampleRoadPath(
  path: Array<{ x: number; z: number }>,
  px: number,
  pz: number,
  spacing: number,
  count: number,
) {
  const samples: Array<{ x: number; z: number; yaw: number }> = [];
  if (path.length < 2) return samples;

  let bestSeg = 0;
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
    const qx = a.x + dx * t;
    const qz = a.z + dz * t;
    const d = Math.hypot(px - qx, pz - qz);
    if (d < bestD) {
      bestD = d;
      bestSeg = i;
      bestT = t;
    }
  }

  const cum = [0];
  for (let i = 0; i < path.length - 1; i++) {
    cum.push(cum[i] + Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z));
  }
  const total = cum[cum.length - 1];
  const from =
    cum[bestSeg] +
    bestT * Math.hypot(path[bestSeg + 1].x - path[bestSeg].x, path[bestSeg + 1].z - path[bestSeg].z);

  for (let n = 0; n < count; n++) {
    const d = from + 2.8 + n * spacing;
    if (d >= total - 1.2) break;
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1] < d) i += 1;
    const segLen = cum[i + 1] - cum[i];
    const u = segLen < 1e-6 ? 0 : (d - cum[i]) / segLen;
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    samples.push({
      x: a.x + dx * u,
      z: a.z + dz * u,
      yaw: Math.atan2(dx, dz),
    });
  }
  return samples;
}
