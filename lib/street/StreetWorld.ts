import * as THREE from "three";
import type { Building, CityState } from "@/lib/city/types";
import { findStadium, stadiumIsOpen } from "@/lib/city/stadium";
import { stadiumFireworksOn } from "@/lib/city/fireworks";
import { lodgingUse } from "@/lib/city/lodging";
import { GARAGE_NAME, isEnterableVenue, venueRole } from "@/lib/city/venues";
import { GarageDoor } from "./garageDoor";
import { isMountainTerrain } from "@/lib/city/terrainElevation";
import { lightingFor, type Lighting } from "@/lib/renderer/palette";
import { AgentLayer } from "./agents";
import { clearTreesNearBuildings } from "@/lib/city/siteTrees";
import { buildCity, hideStreetTreesNearBuildings, TILE, updateTrafficSignals, type CityMeshes } from "./buildCity";
import { buildDreamHouseGroup, disposeDreamGroup, dreamCollider } from "./dreamHouseMesh";
import { dreamDoorYaw, dreamExitTile, findDreamPlot, type DreamPlot } from "@/lib/city/dreamHome";
import { buildMountainTunnelMouth, nearMountainTunnel } from "./mountainTunnel";
import { BuildingGlow } from "./buildingGlow";
import { FLOOR_H } from "./textures";
import { StreetControls, EYE_HEIGHT, type MoveMode } from "./controls";
import { skyTexture } from "./textures";
import { StreetWeatherFx } from "./weatherFx";
import { StreetFireworks } from "./streetFireworks";
import { ValetLine } from "./valetLine";
import { HeldItemView } from "./heldItem";
import { DutyUniformView } from "./dutyUniform";
import type { PhoneWaypoint } from "@/lib/city/phone";
import type { OwnedVehicle } from "@/lib/city/vehicles";
import { TRAFFIC_INCIDENT_SITE, LOST_RESIDENT_MEETUP, SUSPICIOUS_ACTIVITY_SITE } from "@/lib/city/police";
import { POLICE_CRUISER_ID, type PoliceSceneEvent } from "@/lib/city/police";
import type { PoliceCall, PoliceCallPhase } from "@/lib/city/player";
import { PoliceMissionScene } from "./policeMissionScene";
import { buildStreetPerson, disposeObject3D } from "./streetPerson";
import { driveStats } from "@/lib/city/vehicles";
import { findPath, nearestRoad } from "@/lib/simulation/traffic/pathfinding";
import { DriveControls } from "./driveControls";
import { carLookKey, disposeCarMesh, makePlayerCarMesh, updateDutySiren } from "./playerCar";

function lotExclamation() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#146b38";
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#d8ffe6";
    ctx.stroke();
    ctx.fillStyle = "#f4fff8";
    ctx.font = "bold 88px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", 64, 72);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  sprite.name = "dream-mark";
  sprite.scale.set(2.4, 2.4, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Field of view at rest, and how far it narrows mid-hop. */
const BASE_FOV = 72;
/** Walk-in range while a building is aimed / highlighted (matches glow usability). */
const ENTER_AIM_RANGE = TILE * 5;
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
  private valet: ValetLine;
  private fireworkOrigin = new THREE.Vector3();
  private heldView = new HeldItemView();
  private dutyView = new DutyUniformView();
  private policeIncident: THREE.Group | null = null;
  private policeIncidentPhase: PoliceCallPhase | null = null;
  private suspiciousScene: THREE.Group | null = null;
  private escortNpc: THREE.Group | null = null;
  private escortMode: "waiting" | "following" | null = null;
  private escortBob = 0;
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
  private policeOnDuty = false;
  private policeLightsOn = false;
  private missionScene: PoliceMissionScene;
  private missionCall: PoliceCall | null = null;
  private missionEvents: PoliceSceneEvent[] = [];
  private dreamGroups = new Map<string, THREE.Group>();
  private dreamPreview: THREE.Group | null = null;
  private dreamLot: THREE.Group | null = null;
  private dreamLotKey = "";
  private dreamRise: { group: THREE.Group; t: number } | null = null;

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
    this.dutyView.attach(this.camera);

    clearTreesNearBuildings(state.tiles, state.buildings.values(), 2);
    this.city = buildCity(state);
    if (state.id === "mountain") {
      const mouth = buildMountainTunnelMouth();
      this.city.group.add(mouth.group);
      this.city.blockers.push(...mouth.blockers);
    }
    this.scene.add(this.city.group);
    this.mountDreamHouses();
    this.scene.add(this.glow.group);

    this.controls = new StreetControls(state, this.city.blockers);
    this.agents = new AgentLayer(state, (x, z) => this.controls.groundAt(x, z));
    this.scene.add(this.agents.group);
    this.scene.add(this.weatherFx.group);
    this.city.group.add(this.fireworks.group);
    this.valet = new ValetLine(state, (x, z) => this.controls.groundAt(x, z));
    this.city.group.add(this.valet.group);
    this.missionScene = new PoliceMissionScene(state, (x, z) => this.controls.groundAt(x, z));
    this.scene.add(this.missionScene.group);

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

    const garage = [...state.buildings.values()].find((b) => venueRole(b) === "garage");
    if (garage) {
      this.garageDoor = new GarageDoor(garage, garage.name || GARAGE_NAME, state.tiles);
      this.city.group.add(this.garageDoor.group);
    }
  }

  private garageDoor: GarageDoor | null = null;
  private garageEntered = false;

  /** Nudge the car back out of a service bay. */
  backOutCar() {
    this.drive?.pushReverse(5);
  }

  /** True once per drive-in at Mike's garage door. */
  consumeGarageEntry() {
    const hit = this.garageEntered;
    this.garageEntered = false;
    return hit;
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

  syncOwnedCars(cars: OwnedVehicle[]) {
    const seen = new Set<string>();
    for (const car of cars) {
      seen.add(car.id);
      let mesh = this.ownedCarMeshes.get(car.id);
      if (mesh && mesh.userData.lookKey !== carLookKey(car)) {
        mesh.removeFromParent();
        disposeCarMesh(mesh);
        mesh = undefined;
      }
      if (!mesh) {
        mesh = makePlayerCarMesh(car);
        this.ownedCarMeshes.set(car.id, mesh);
        this.ownedCarRoot.add(mesh);
        updateDutySiren(mesh, this.time, this.policeOnDuty && this.policeLightsOn);
      }
      // Cars only exist while you're in them: C summons one under you and it vanishes on exit.
      if (car.id !== this.drivingId) mesh.visible = false;
    }
    for (const [id, mesh] of this.ownedCarMeshes) {
      if (seen.has(id)) continue;
      mesh.removeFromParent();
      this.ownedCarMeshes.delete(id);
    }
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
    this.refreshDutyPresentation();
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
    if (mesh) mesh.visible = false;
    this.refreshDutyPresentation();
    return { x, y, yaw };
  }

  /** Puts the player behind the wheel of `car` right where they're standing. */
  summonCar(car: OwnedVehicle) {
    this.startDriving({
      ...car,
      parkX: this.controls.position.x / TILE,
      parkY: this.controls.position.z / TILE,
      parkYaw: this.controls.yaw,
    });
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
    return this.aimedWithin(stadium, TILE * 5);
  }

  nearLodgingEntrance() {
    const building = this.aimedBuilding();
    if (!building || !lodgingUse(building)) return null;
    return this.aimedWithin(building, ENTER_AIM_RANGE) ? building : null;
  }

  nearSubwayEntrance() {
    const building = this.aimedBuilding();
    if (!building || building.kind !== "subway_station") return null;
    return this.aimedWithin(building, ENTER_AIM_RANGE) ? building : null;
  }

  nearVenueEntrance() {
    const building = this.aimedBuilding();
    if (!building || lodgingUse(building) || !isEnterableVenue(building)) return null;
    return this.aimedWithin(building, ENTER_AIM_RANGE) ? building : null;
  }

  get hiking() {
    return this.controls.hiking;
  }

  /** Standing next to rock/snow — Space starts a trail hike. */
  nearMountainTrailhead() {
    if (this.isDriving || this.controls.hiking) return false;
    const tx = Math.floor(this.controls.position.x / TILE);
    const tz = Math.floor(this.controls.position.z / TILE);
    const here = this.state.tiles[tz]?.[tx];
    if (!here || isMountainTerrain(here.terrain)) return false;
    return this.adjacentMountain(tx, tz) !== null;
  }

  /** On a trail and next to foothills — Space leaves the mountains. */
  nearMountainTrailExit() {
    if (!this.controls.hiking) return false;
    const tx = Math.floor(this.controls.position.x / TILE);
    const tz = Math.floor(this.controls.position.z / TILE);
    const here = this.state.tiles[tz]?.[tx];
    if (!here || !isMountainTerrain(here.terrain)) return false;
    return this.adjacentFoothill(tx, tz) !== null;
  }

  /** Enter or leave the mountain trail when Space is available. */
  tryToggleHiking() {
    if (this.isDriving) return false;
    if (this.controls.hiking) {
      if (!this.nearMountainTrailExit()) return false;
      this.exitHiking();
      return true;
    }
    if (!this.nearMountainTrailhead()) return false;
    this.enterHiking();
    return true;
  }

  private enterHiking() {
    const tx = Math.floor(this.controls.position.x / TILE);
    const tz = Math.floor(this.controls.position.z / TILE);
    const target = this.adjacentMountain(tx, tz);
    if (!target) return;
    this.controls.hiking = true;
    this.controls.setMode("free");
    this.controls.spawnAt(target.x, target.y, this.controls.yaw);
  }

  private exitHiking() {
    const tx = Math.floor(this.controls.position.x / TILE);
    const tz = Math.floor(this.controls.position.z / TILE);
    const target = this.adjacentFoothill(tx, tz) ?? this.nearestRoadTile(tx, tz);
    this.controls.hiking = false;
    if (target) this.controls.spawnAt(target.x, target.y, this.controls.yaw);
    else {
      this.controls.position.y =
        this.controls.groundAt(this.controls.position.x, this.controls.position.z) + EYE_HEIGHT;
    }
  }

  private adjacentMountain(tx: number, tz: number) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const x = tx + ox;
      const y = tz + oy;
      const tile = this.state.tiles[y]?.[x];
      if (!tile || tile.buildingId || !isMountainTerrain(tile.terrain)) continue;
      const d = Math.abs(ox) + Math.abs(oy);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    return best;
  }

  private adjacentFoothill(tx: number, tz: number) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = tx + ox;
      const y = tz + oy;
      const tile = this.state.tiles[y]?.[x];
      if (!tile || tile.buildingId) continue;
      if (isMountainTerrain(tile.terrain) || tile.terrain === "water") continue;
      const d = Math.abs(ox) + Math.abs(oy);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    return best;
  }

  private nearestRoadTile(tx: number, tz: number) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = 0; y < this.state.size; y++) {
      for (let x = 0; x < this.state.size; x++) {
        if (!this.state.tiles[y][x].road) continue;
        const d = (x - tx) ** 2 + (y - tz) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    return best;
  }

  /**
   * Aimed / highlighted building the player can walk into (click or E).
   * Prefer this over separate door refs when handling a click.
   */
  /** Standing at the unmarked opening in the west ridge. */
  nearMountainTunnel() {
    if (this.state.id !== "mountain" || this.isDriving || this.controls.hiking) return false;
    return nearMountainTunnel(this.controls.position.x, this.controls.position.z);
  }

  enterTarget():
    | { kind: "venue" | "lodging" | "subway"; building: Building }
    | { kind: "stadium" }
    | { kind: "tunnel" }
    | null {
    if (this.isDriving) return null;
    if (this.nearMountainTunnel()) return { kind: "tunnel" };
    if (this.nearStadiumGate()) return { kind: "stadium" };
    const lodging = this.nearLodgingEntrance();
    if (lodging) return { kind: "lodging", building: lodging };
    const subway = this.nearSubwayEntrance();
    if (subway) return { kind: "subway", building: subway };
    const venue = this.nearVenueEntrance();
    if (venue) return { kind: "venue", building: venue };
    return null;
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
    const future = this.state.id === "future";
    this.sun.intensity = night ? (future ? 0.85 : 0.55) : light.sun * (future ? 3.1 : 2.6);
    this.sun.color.set(
      light.phase === "dawn" || light.phase === "dusk"
        ? "#ffb27a"
        : night
          ? future
            ? "#a8b8ff"
            : "#b7cce8"
          : future
            ? "#fff0e0"
            : "#fff6e8",
    );

    this.hemi.intensity = night ? (future ? 1.45 : 1.05) : light.ambient * (future ? 1.35 : 1.05);
    this.hemi.color.set(
      night ? (future ? "#8899e8" : "#8aa4c8") : future ? "#b8d4f8" : light.skyTop,
    );
    this.hemi.groundColor.set(
      night ? (future ? "#2a2048" : "#2c3a4c") : future ? "#6a7888" : "#4a5340",
    );
    this.renderer.toneMappingExposure = future
      ? night
        ? 1.55
        : 1.28
      : night
        ? 1.32
        : 1.05;

    // Facade windows glow with the same curve the isometric view uses.
    const glowBoost = future ? (night ? 3.4 : 2.6) : night ? 2.1 : 1.5;
    for (const material of this.city.emissiveMaterials) {
      material.emissiveIntensity = light.windowLit * glowBoost;
    }
    if (this.city.lampGlow) {
      this.city.lampGlow.emissiveIntensity = lampsOn || future ? (future ? 4.2 : 3.4) : 0.04;
    }

    const here = this.controls.position;
    this.streetFill.position.set(here.x, here.y + 2.2, here.z);
    if (future) {
      this.streetFill.color.set(night ? "#88a0ff" : "#ffc8e0");
      this.streetFill.intensity = night ? 22 : lampsOn ? 14 : 10;
      this.streetFill.distance = 28;
    } else {
      this.streetFill.color.set(0xffd6a8);
      this.streetFill.intensity = night ? 14 : lampsOn ? 6 : 0;
      this.streetFill.distance = 16;
    }

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
      this.scene.fog.color.set(
        night ? (future ? "#2a2858" : "#243656") : future ? light.skyBottom : light.skyBottom,
      );
      this.scene.fog.near = wet ? 28 : night ? 90 : future ? 90 : 70;
      this.scene.fog.far = wet ? 220 : night ? 520 : future ? 720 : 640;
    }

    this.updateLamps(lampsOn || future);
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

  setPoliceDuty(on: boolean) {
    this.policeOnDuty = on;
    if (!on) this.policeLightsOn = false;
    this.refreshDutyPresentation();
  }

  /** Roof light bar toggle — only while on a police shift. */
  setPoliceLights(on: boolean) {
    this.policeLightsOn = on && this.policeOnDuty;
    this.refreshDutyPresentation();
  }

  togglePoliceLights() {
    if (!this.policeOnDuty) return false;
    this.policeLightsOn = !this.policeLightsOn;
    this.refreshDutyPresentation();
    return true;
  }

  get policeLightsEnabled() {
    return this.policeLightsOn;
  }

  /** Suit on foot; roof siren only when lights are switched on. */
  private refreshDutyPresentation() {
    this.dutyView.setOnDuty(this.policeOnDuty && !this.isDriving);
    for (const mesh of this.ownedCarMeshes.values()) {
      updateDutySiren(mesh, this.time, this.policeOnDuty && this.policeLightsOn);
    }
  }

  /** Mirror the active police call into street props (NPC cars, checkpoints). */
  setPoliceMission(call: PoliceCall | null) {
    this.missionCall = call;
    this.missionScene.sync(call);
  }

  /** Street happenings since the last call — apply with `applyPoliceSceneEvent`. */
  consumePoliceEvents() {
    const events = this.missionEvents;
    this.missionEvents = [];
    return events;
  }

  get policeMissionNote() {
    return this.missionScene.note;
  }

  /** Live tile of the pursuit suspect, once the chase car is on the road. */
  get suspectTracker(): { x: number; y: number } | null {
    const call = this.missionCall;
    if (!call || call.kind !== "pursuit") return null;
    if (call.phase === "accepted" || call.phase === "traveling" || call.phase === "completed") return null;
    return this.missionScene.trackedCar();
  }

  get inPoliceCruiser() {
    return this.drivingId === POLICE_CRUISER_ID && Boolean(this.drive);
  }

  /**
   * Spawn or update the traffic-incident prop scene inside the downtown plaza square.
   * Pass null to clear after the call is completed.
   */
  setPoliceIncident(phase: PoliceCallPhase | null) {
    if (!phase || phase === "completed") {
      this.clearPoliceIncident();
      return;
    }
    if (!this.policeIncident) {
      this.policeIncident = buildTrafficIncidentProps();
      this.policeIncident.position.set(
        (TRAFFIC_INCIDENT_SITE.x + 0.5) * TILE,
        0,
        (TRAFFIC_INCIDENT_SITE.y + 0.5) * TILE,
      );
      this.scene.add(this.policeIncident);
    }
    this.policeIncidentPhase = phase;
    const cones = this.policeIncident.getObjectByName("cones");
    if (cones) {
      cones.visible = phase === "placing_cones" || phase === "clearing";
    }
    const car = this.policeIncident.getObjectByName("disabled-car");
    if (car) {
      car.visible = phase !== "clearing";
    }
    const driver = this.policeIncident.getObjectByName("driver");
    if (driver) {
      driver.visible = phase !== "clearing";
    }
  }

  private clearPoliceIncident() {
    if (!this.policeIncident) return;
    this.scene.remove(this.policeIncident);
    disposeObject3D(this.policeIncident);
    this.policeIncident = null;
    this.policeIncidentPhase = null;
  }

  /**
   * Suspicious-activity scene: reporting NPC + clue pile inside the park square.
   * Pass null to clear.
   */
  setSuspiciousActivity(phase: PoliceCallPhase | null) {
    if (!phase || phase === "completed") {
      this.clearSuspiciousActivity();
      return;
    }
    if (!this.suspiciousScene) {
      this.suspiciousScene = buildSuspiciousActivityProps();
      this.suspiciousScene.position.set(
        (SUSPICIOUS_ACTIVITY_SITE.x + 0.5) * TILE,
        0,
        (SUSPICIOUS_ACTIVITY_SITE.y + 0.5) * TILE,
      );
      this.scene.add(this.suspiciousScene);
    }
    const clue = this.suspiciousScene.getObjectByName("clue");
    if (clue) {
      clue.visible = phase === "arrived" || phase === "inspecting" || phase === "resolving";
    }
    const marker = this.suspiciousScene.getObjectByName("square-marker");
    if (marker) {
      marker.visible = true;
    }
  }

  private clearSuspiciousActivity() {
    if (!this.suspiciousScene) return;
    this.scene.remove(this.suspiciousScene);
    disposeObject3D(this.suspiciousScene);
    this.suspiciousScene = null;
  }

  /**
   * Lost-resident escort: NPC waits at the meetup, then follows the player home.
   * Pass null to clear.
   */
  setLostResidentEscort(
    mode: "waiting" | "following" | null,
    opts?: { name?: string; shirt?: string; hair?: string },
  ) {
    if (!mode) {
      this.clearEscortNpc();
      return;
    }
    if (!this.escortNpc) {
      const seed = (opts?.name ?? "resident").length;
      const shirts = ["#c45c4a", "#3d5a80", "#2f5d4a", "#8a4b2f"];
      const hairs = ["#3a2a22", "#1c1410", "#6b4423", "#8a3a28"];
      this.escortNpc = buildStreetPerson({
        shirt: opts?.shirt ?? shirts[seed % shirts.length],
        pants: "#243656",
        hair: opts?.hair ?? hairs[seed % hairs.length],
        skin: "#e2c4a6",
      });
      this.escortNpc.name = "lost-resident";
      this.scene.add(this.escortNpc);
    }
    this.escortMode = mode;
    if (mode === "waiting") {
      const ground = this.controls.groundAt(
        (LOST_RESIDENT_MEETUP.x + 0.5) * TILE,
        (LOST_RESIDENT_MEETUP.y + 0.5) * TILE,
      );
      this.escortNpc.position.set(
        (LOST_RESIDENT_MEETUP.x + 0.5) * TILE,
        ground,
        (LOST_RESIDENT_MEETUP.y + 0.5) * TILE,
      );
      this.escortNpc.rotation.y = Math.PI * 0.15;
    }
  }

  private clearEscortNpc() {
    if (!this.escortNpc) return;
    this.scene.remove(this.escortNpc);
    disposeObject3D(this.escortNpc);
    this.escortNpc = null;
    this.escortMode = null;
  }

  private updateEscortNpc(dt: number) {
    if (!this.escortNpc || !this.escortMode) return;
    this.escortBob += dt;
    if (this.escortMode === "waiting") {
      this.escortNpc.position.y =
        this.controls.groundAt(this.escortNpc.position.x, this.escortNpc.position.z) +
        Math.sin(this.escortBob * 2.1) * 0.02;
      this.escortNpc.rotation.y += Math.sin(this.escortBob * 0.7) * 0.004;
      return;
    }
    // Follow a step behind the player.
    const pos = this.drive?.position ?? this.controls.position;
    const yaw = this.drive?.yaw ?? this.controls.yaw;
    const back = 1.15;
    const side = 0.55;
    const tx = pos.x - Math.sin(yaw) * back + Math.cos(yaw) * side;
    const tz = pos.z - Math.cos(yaw) * back - Math.sin(yaw) * side;
    const npc = this.escortNpc.position;
    npc.x += (tx - npc.x) * Math.min(1, dt * 5.5);
    npc.z += (tz - npc.z) * Math.min(1, dt * 5.5);
    npc.y = this.controls.groundAt(npc.x, npc.z) + Math.sin(this.escortBob * 9) * 0.035;
    const facing = Math.atan2(pos.x - npc.x, pos.z - npc.z);
    let dy = facing - this.escortNpc.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.escortNpc.rotation.y += dy * Math.min(1, dt * 8);
  }

  playSip() {
    this.heldView.playSip();
  }

  /** Phone Maps waypoint in tile coordinates; arrows glow toward it on the ground. */
  setWaypoint(target: PhoneWaypoint | null) {
    this.navTarget = target;
    this.controls.hopFocus = target
      ? { x: Math.round(target.x), z: Math.round(target.y) }
      : null;
    if (!target) {
      this.navPath = [];
      this.navPathKey = "";
      this.navArrows.visible = false;
    }
  }

  /**
   * True when the walker has reached the waypoint itself. Off-street pins
   * (plaza / park police squares) require standing inside the square — not
   * merely on the surrounding ring road.
   */
  arrivedAtWaypoint() {
    const target = this.navTarget;
    if (!target) return false;
    const px = this.controls.position.x / TILE;
    const pz = this.controls.position.z / TILE;
    const tx = Math.round(target.x);
    const ty = Math.round(target.y);
    const tile = this.state.tiles[ty]?.[tx];
    const targetOnStreet = Boolean(tile?.road || tile?.bridge);

    if (!targetOnStreet) {
      const cx = Number.isInteger(target.x) ? target.x + 0.5 : target.x;
      const cy = Number.isInteger(target.y) ? target.y + 0.5 : target.y;
      const dx = px - cx;
      const dy = pz - cy;
      return dx * dx + dy * dy <= 1.65 * 1.65;
    }

    const goal =
      nearestRoad(this.state, tx, ty) ?? this.nearestRoad(tx, ty);
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
    this.tickDreamRise(dt);
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
    const car = this.drive ? { x: this.drive.position.x, z: this.drive.position.z, yaw: this.drive.yaw } : null;
    if (this.garageDoor?.update(dt, car)) {
      this.garageEntered = true;
      this.drive?.halt();
    }
    this.heldView.update(dt);
    this.dutyView.update(dt);
    if (this.policeOnDuty && this.policeLightsOn) {
      for (const mesh of this.ownedCarMeshes.values()) {
        updateDutySiren(mesh, this.time, true);
      }
    }
    this.updateEscortNpc(dt);
    const me = this.drive?.position ?? this.controls.position;
    this.missionEvents.push(
      ...this.missionScene.update(dt, this.missionCall, {
        x: me.x,
        z: me.z,
        yaw: this.drive?.yaw ?? this.controls.yaw,
        driving: this.isDriving,
        inCruiser: this.inPoliceCruiser,
        lights: this.policeOnDuty && this.policeLightsOn,
      }),
    );

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
    this.valet.update(dt);
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
      this.pointNavIntoSquare(target);
      return;
    }

    const samples = sampleRoadPath(this.navPath, px, pz, NAV_SPACING, NAV_ARROWS);
    if (samples.length === 0) {
      this.pointNavIntoSquare(target);
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

  /**
   * When the road path is done but the pin sits inside a plaza / park square,
   * keep one arrow pointing into the block so hop can finish the last step.
   */
  private pointNavIntoSquare(target: PhoneWaypoint) {
    const px = this.controls.position.x;
    const pz = this.controls.position.z;
    const cx = (Number.isInteger(target.x) ? target.x + 0.5 : target.x) * TILE;
    const cz = (Number.isInteger(target.y) ? target.y + 0.5 : target.y) * TILE;
    const dx = cx - px;
    const dz = cz - pz;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.1 || dist > TILE * 5.5) {
      this.navArrows.visible = false;
      return;
    }

    this.navArrows.visible = true;
    const pulse = 0.85 + Math.sin(this.time * 4.2) * 0.15;
    this.navMat.emissiveIntensity = 1.8 + Math.sin(this.time * 5.5) * 0.9;
    this.navMat.opacity = 0.72 + Math.sin(this.time * 3.4) * 0.18;
    const yaw = Math.atan2(dx, dz);
    const step = Math.min(dist * 0.45, TILE * 0.85);
    const ax = px + (dx / dist) * step;
    const az = pz + (dz / dist) * step;
    const ground = this.controls.groundAt(ax, az);
    const scale = 0.95 + pulse * 0.2;
    this.navDummy.position.set(ax, ground + 0.08, az);
    this.navDummy.rotation.set(0, yaw, 0);
    this.navDummy.scale.set(scale, 1, scale);
    this.navDummy.updateMatrix();
    this.navArrows.setMatrixAt(0, this.navDummy.matrix);
    for (let i = 1; i < NAV_ARROWS; i++) {
      this.navDummy.position.set(0, -40, 0);
      this.navDummy.scale.set(0.001, 0.001, 0.001);
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

  /** Grass lot in front of the walker that can hold a house. */
  dreamPlotOffer(): DreamPlot | null {
    if (this.isDriving || this.controls.hiking) return null;
    return findDreamPlot(
      this.state,
      this.controls.position.x,
      this.controls.position.z,
      this.controls.yaw,
    );
  }

  /** True when the lawn is closer than the building under the crosshair. */
  dreamLotInFront(plot: DreamPlot) {
    const aimed = this.aimedBuilding();
    if (!aimed) return true;
    const px = this.controls.position.x;
    const pz = this.controls.position.z;
    const lawn = this.distanceToRect(plot.x, plot.y, plot.w, plot.d, px, pz);
    return lawn <= this.distanceToBuilding(aimed, px, pz) + 1.5;
  }

  showDreamLot(plot: DreamPlot | null) {
    const key = plot ? `${plot.x},${plot.y},${plot.w},${plot.d}` : "";
    if (key === this.dreamLotKey) return;
    this.dreamLotKey = key;
    this.clearDreamLot();
    if (!plot) return;
    const width = plot.w * TILE - 0.4;
    const depth = plot.d * TILE - 0.4;
    const geo = new THREE.PlaneGeometry(width, depth);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3dff7a,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const cx = (plot.x + plot.w / 2) * TILE;
    const cz = (plot.y + plot.d / 2) * TILE;
    const ground = this.controls.groundAt(cx, cz);
    mesh.position.set(cx, ground + 0.2, cz);
    const mark = lotExclamation();
    mark.position.set(cx, ground + 4.2, cz);
    mark.userData.baseY = ground + 4.2;
    const group = new THREE.Group();
    group.add(mesh);
    group.add(mark);
    this.city.group.add(group);
    this.dreamLot = group;
  }

  setDreamPreview(building: Building | null) {
    if (this.dreamPreview) {
      disposeDreamGroup(this.dreamPreview);
      this.dreamPreview = null;
    }
    if (!building) return;
    const group = buildDreamHouseGroup(building, true);
    this.city.group.add(group);
    this.dreamPreview = group;
  }

  /** Drop the ghost house and the green lot after the studio closes. */
  clearDreamStudio() {
    this.setDreamPreview(null);
    this.showDreamLot(null);
  }

  placeDreamHouse(building: Building) {
    this.clearDreamStudio();
    this.removeTreesFor(building);
    if (this.dreamGroups.has(building.id)) return;
    const group = buildDreamHouseGroup(building);
    group.scale.y = 0.04;
    this.city.group.add(group);
    this.dreamGroups.set(building.id, group);
    this.dreamRise = { group, t: 0 };
    const blocker = dreamCollider(building);
    this.city.blockers.push(blocker);
    this.controls.addBlockers([blocker]);
    const height = Math.max(1, building.floors) * FLOOR_H + 2.6;
    this.city.volumes.push({
      id: building.id,
      box: new THREE.Box3(
        new THREE.Vector3(blocker.minX, 0, blocker.minZ),
        new THREE.Vector3(blocker.maxX, height, blocker.maxZ),
      ),
    });
  }

  stepToDreamDoor(building: Building) {
    const tile = dreamExitTile(building);
    this.controls.spawnAt(tile.x, tile.y, dreamDoorYaw(building));
  }

  private mountDreamHouses() {
    for (const building of this.state.buildings.values()) {
      if (building.stats.extra?.dream !== "1") continue;
      this.removeTreesFor(building);
      const group = buildDreamHouseGroup(building);
      this.city.group.add(group);
      this.dreamGroups.set(building.id, group);
    }
  }

  /** Trees on every building site, including the tiles around it. */
  stripBuildingTrees() {
    clearTreesNearBuildings(this.state.tiles, this.state.buildings.values(), 2);
    hideStreetTreesNearBuildings(this.city.group, this.state.buildings.values(), 2);
  }

  private removeTreesFor(building: Building) {
    clearTreesNearBuildings(this.state.tiles, [building], 2);
    hideStreetTreesNearBuildings(this.city.group, [building], 2);
  }

  private tickDreamRise(dt: number) {
    const mark = this.dreamLot?.getObjectByName("dream-mark");
    if (mark) {
      const base = typeof mark.userData.baseY === "number" ? mark.userData.baseY : mark.position.y;
      mark.position.y = base + Math.sin(this.time * 3) * 0.28;
    }
    if (!this.dreamRise) return;
    this.dreamRise.t += dt;
    const u = Math.min(1, this.dreamRise.t / 1.15);
    const eased = 1 - (1 - u) ** 3;
    this.dreamRise.group.scale.y = 0.04 + 0.96 * eased;
    if (u >= 1) this.dreamRise = null;
  }

  private distanceToRect(tileX: number, tileY: number, w: number, d: number, x: number, z: number) {
    const minX = tileX * TILE;
    const maxX = (tileX + w) * TILE;
    const minZ = tileY * TILE;
    const maxZ = (tileY + d) * TILE;
    const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
    const dz = z < minZ ? minZ - z : z > maxZ ? z - maxZ : 0;
    return Math.hypot(dx, dz);
  }

  private clearDreamLot() {
    const group = this.dreamLot;
    this.dreamLot = null;
    if (!group) return;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        const mat = obj.material;
        const materials = Array.isArray(mat) ? mat : [mat];
        for (const item of materials) {
          if (item instanceof THREE.SpriteMaterial && item.map) item.map.dispose();
          item.dispose();
        }
      }
    });
    group.removeFromParent();
  }

  dispose() {
    this.clearDreamStudio();
    for (const group of this.dreamGroups.values()) disposeDreamGroup(group);
    this.dreamGroups.clear();
    this.heldView.dispose();
    this.dutyView.dispose();
    this.clearPoliceIncident();
    this.clearSuspiciousActivity();
    this.clearEscortNpc();
    this.missionScene.dispose();
    this.agents.dispose();
    this.glow.dispose();
    this.weatherFx.dispose();
    this.fireworks.group.removeFromParent();
    this.fireworks.dispose();
    this.valet.dispose();
    this.garageDoor?.dispose();
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

function buildTrafficIncidentProps() {
  const group = new THREE.Group();
  group.name = "police-traffic-incident";

  const bodyMat = new THREE.MeshStandardMaterial({ color: "#6a7180", roughness: 0.55, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.85 });
  const orange = new THREE.MeshStandardMaterial({ color: "#e67e22", roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.65 });
  const skin = new THREE.MeshStandardMaterial({ color: "#c4a484", roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: "#3d5a80", roughness: 0.75 });

  const car = new THREE.Group();
  car.name = "disabled-car";
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.0), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 2.0), dark);
  cabin.position.set(0, 1.0, -0.1);
  car.add(cabin);
  car.rotation.y = 0.55;
  car.position.set(0.4, 0, -0.2);
  group.add(car);

  const driver = new THREE.Group();
  driver.name = "driver";
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 3, 6), shirt);
  torso.position.set(-1.6, 0.95, 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), skin);
  head.position.set(-1.6, 1.55, 0.9);
  driver.add(torso, head);
  group.add(driver);

  const cones = new THREE.Group();
  cones.name = "cones";
  cones.visible = false;
  const coneGeo = new THREE.ConeGeometry(0.22, 0.55, 8);
  for (const [x, z] of [
    [-2.2, 1.6],
    [-1.1, 2.0],
    [0.2, 2.3],
    [1.4, 1.9],
    [2.2, 1.2],
    [-2.0, -1.8],
    [0.0, -2.1],
    [2.0, -1.5],
  ] as const) {
    const cone = new THREE.Mesh(coneGeo, orange);
    cone.position.set(x, 0.28, z);
    cone.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 8), white);
    stripe.position.set(x, 0.22, z);
    cones.add(cone, stripe);
  }
  group.add(cones);

  return group;
}

function buildSuspiciousActivityProps() {
  const group = new THREE.Group();
  group.name = "police-suspicious-activity";

  const reporter = buildStreetPerson({
    shirt: "#8a4b2f",
    pants: "#2a3344",
    hair: "#1c1410",
  });
  reporter.name = "reporter";
  reporter.position.set(-1.1, 0, 0.6);
  reporter.rotation.y = Math.PI * 0.35;
  group.add(reporter);

  const clue = new THREE.Group();
  clue.name = "clue";
  const crateMat = new THREE.MeshStandardMaterial({ color: "#6b5344", roughness: 0.9 });
  const bagMat = new THREE.MeshStandardMaterial({ color: "#3a3f48", roughness: 0.85 });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.7), crateMat);
  crate.position.set(1.2, 0.28, -0.4);
  crate.rotation.y = 0.4;
  crate.castShadow = true;
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.4), bagMat);
  bag.position.set(1.55, 0.2, 0.25);
  bag.rotation.y = -0.5;
  clue.add(crate, bag);
  group.add(clue);

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 1.7, 32),
    new THREE.MeshStandardMaterial({
      color: "#39ff6a",
      emissive: new THREE.Color("#22ff66"),
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  marker.name = "square-marker";
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.04;
  group.add(marker);

  return group;
}
