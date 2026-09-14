import * as THREE from "three";
import type { Building, CityState } from "@/lib/city/types";
import { formatClock } from "@/lib/simulation/city/cityTick";
import { findLodgingRoom, lodgingUse, type LodgingZone } from "@/lib/city/lodging";
import { TILE } from "./buildCity";
import { InteriorControls } from "./interiorControls";
import { buildLodgingInterior, type LodgingInterior } from "./lodgingInterior";
import { lodgingWindowDir } from "./StreetWorld";
import { FLOOR_H } from "./textures";

/**
 * First-person hotel / apartment interiors: lobby with a front-desk screen,
 * a guest room, and the roof-deck pool.
 */
export class LodgingWorld {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: InteriorControls;
  readonly building: Building;
  readonly zone: LodgingZone;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private interior: LodgingInterior;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.PointLight;
  private deskCanvas: HTMLCanvasElement | null = null;
  private deskCtx: CanvasRenderingContext2D | null = null;
  private deskTexture: THREE.CanvasTexture | null = null;
  private cityHolder: THREE.Group | null = null;
  private borrowedCity: THREE.Group | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private state: CityState,
    building: Building,
    zone: LodgingZone,
    roomId?: string | null,
  ) {
    this.building = building;
    this.zone = zone;
    const room = zone === "room" ? findLodgingRoom(building, roomId) : null;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = zone === "pool" ? 1.18 : 1.08;
    this.renderer.shadowMap.enabled = true;

    this.camera = new THREE.PerspectiveCamera(74, 1, 0.1, zone === "lobby" ? 80 : 900);
    this.interior = buildLodgingInterior(building, zone, state, room);
    this.scene.add(this.interior.group);

    this.controls = new InteriorControls(
      this.interior.blockers,
      this.interior.groundAt,
      this.interior.bounds,
    );
    this.controls.spawn(
      this.interior.spawn.x,
      this.interior.spawn.z,
      this.interior.spawn.yaw,
      this.interior.spawn.pitch,
    );

    const night = this.isNight();
    this.hemi = new THREE.HemisphereLight(zone === "pool" ? 0xc9e4ff : 0xfff1d6, 0x3d4a3a, night ? 0.7 : 1.15);
    this.sun = new THREE.DirectionalLight(zone === "pool" ? 0xfff6e8 : 0xffe7c2, night ? 0.4 : 1.7);
    this.fill = new THREE.PointLight(0xffe0b0, zone === "lobby" ? 28 : 16, 36, 1.5);
    this.sun.position.set(8, 28, 10);
    this.fill.position.set(0, 5, 4);
    if (zone === "room") {
      const windowLight = new THREE.DirectionalLight(night ? 0x8aa4c8 : 0xfff4d6, night ? 0.7 : 1.35);
      windowLight.position.set(0, 4, -12);
      windowLight.target.position.set(0, 1.4, 2);
      this.scene.add(windowLight, windowLight.target);
    }
    this.scene.add(this.hemi, this.sun, this.fill);

    if (zone === "pool") {
      this.scene.background = new THREE.Color(night ? "#10182c" : "#7eb3e0");
      this.scene.fog = new THREE.Fog(night ? 0x10182c : 0x7eb3e0, 48, 210);
    } else if (zone === "room") {
      this.scene.background = new THREE.Color(night ? "#10182c" : "#7eb3e0");
      this.scene.fog = new THREE.Fog(night ? 0x10182c : 0x7eb3e0, 90, 640);
    } else {
      this.scene.background = new THREE.Color("#1c1814");
      this.scene.fog = new THREE.Fog(0x1c1814, 18, 48);
    }

    if (this.interior.deskMat) {
      this.deskCanvas = document.createElement("canvas");
      this.deskCanvas.width = 1024;
      this.deskCanvas.height = 320;
      const ctx = this.deskCanvas.getContext("2d");
      if (ctx) {
        this.deskCtx = ctx;
        this.deskTexture = new THREE.CanvasTexture(this.deskCanvas);
        this.interior.deskMat.map = this.deskTexture;
        this.interior.deskMat.emissiveMap = this.deskTexture;
        this.interior.deskMat.needsUpdate = true;
      }
    }
  }

  attachCity(city: THREE.Group, floor: number) {
    const anchor = this.interior.windowAnchor;
    if (!anchor) return;
    this.detachCity();
    const dir = lodgingWindowDir(this.state, this.building);
    const midX = (this.building.origin.x + this.building.width / 2) * TILE;
    const midZ = (this.building.origin.y + this.building.depth / 2) * TILE;
    const fx = midX + dir.sx * ((this.building.width * TILE) / 2 + 0.45);
    const fy = Math.max(2.2, (Math.max(1, floor) - 0.45) * FLOOR_H);
    const fz = midZ + dir.sz * ((this.building.depth * TILE) / 2 + 0.45);
    const holder = new THREE.Group();
    holder.position.set(anchor.x, anchor.y, anchor.z);
    holder.rotation.y = Math.atan2(dir.sx, -dir.sz);
    city.position.set(-fx, -fy, -fz);
    city.rotation.set(0, 0, 0);
    holder.add(city);
    this.scene.add(holder);
    this.cityHolder = holder;
    this.borrowedCity = city;
  }

  detachCity() {
    const city = this.borrowedCity;
    if (this.cityHolder && city) this.cityHolder.remove(city);
    if (this.cityHolder) this.scene.remove(this.cityHolder);
    this.cityHolder = null;
    this.borrowedCity = null;
    if (city) {
      city.position.set(0, 0, 0);
      city.rotation.set(0, 0, 0);
    }
    return city;
  }

  nearDesk() {
    return this.interior.nearDesk(this.controls.position.x, this.controls.position.z);
  }

  nearComputer() {
    return this.interior.nearComputer(this.controls.position.x, this.controls.position.z);
  }

  nearBed() {
    return this.interior.nearBed(this.controls.position.x, this.controls.position.z);
  }

  aimedAtComputer(ndcX = 0, ndcY = 0) {
    const target = this.interior.computerHit;
    if (!target || this.zone !== "room") return false;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hits = raycaster.intersectObject(target, true);
    return Boolean(hits[0] && hits[0].distance < 5.8);
  }

  nearExit() {
    return this.interior.nearExit(this.controls.position.x, this.controls.position.z);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(dt: number) {
    this.controls.update(dt);
    this.controls.applyTo(this.camera);
    const night = this.isNight();
    this.sun.intensity = this.zone === "pool" ? (night ? 0.35 : 2.0) : night ? 0.55 : 1.35;
    this.hemi.intensity = night ? 0.7 : 1.15;
    if (this.zone === "room" || this.zone === "pool") {
      const sky = night ? "#10182c" : "#7eb3e0";
      this.scene.background = new THREE.Color(sky);
      if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(sky);
    }
    if (this.deskCtx && this.deskTexture) this.drawDesk();
    this.interior.tv?.update(dt, this.state);
    this.renderer.render(this.scene, this.camera);
  }

  private isNight() {
    const hour = this.state.clock.minuteOfDay / 60;
    return hour < 6.5 || hour >= 19.5;
  }

  private drawDesk() {
    const ctx = this.deskCtx;
    const tex = this.deskTexture;
    if (!ctx || !tex || !this.deskCanvas) return;
    const w = this.deskCanvas.width;
    const h = this.deskCanvas.height;
    const clock = formatClock(this.state);
    const hotel = lodgingUse(this.building) === "hotel";
    ctx.fillStyle = "#14110c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c9a44c";
    ctx.fillRect(0, 0, w, 18);
    ctx.fillRect(0, h - 18, w, 18);
    ctx.fillStyle = "#f4e6c0";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.building.name.toUpperCase(), w / 2, 90);
    ctx.font = "28px sans-serif";
    ctx.fillStyle = "#e8dcc8";
    ctx.fillText(hotel ? "Front desk  ·  Welcome" : "Concierge  ·  Residents welcome", w / 2, 150);
    ctx.font = "22px sans-serif";
    ctx.fillStyle = "#c9a44c";
    ctx.fillText(hotel ? "Choose a room  ·  Switch anytime" : "Choose a home  ·  Roof deck open", w / 2, 210);
    ctx.fillStyle = "#9aa4ae";
    ctx.fillText(`${clock.day}  ·  ${clock.time}`, w / 2, 262);
    tex.needsUpdate = true;
  }

  dispose() {
    this.detachCity();
    this.interior.dispose();
    this.deskTexture?.dispose();
    this.renderer.dispose();
  }
}
