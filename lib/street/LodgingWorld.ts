import * as THREE from "three";
import type { Building, CityState } from "@/lib/city/types";
import { formatClock } from "@/lib/simulation/city/cityTick";
import { findLodgingRoom, lodgingUse, type LodgingZone } from "@/lib/city/lodging";
import { stadiumFireworksOn } from "@/lib/city/fireworks";
import { cityThemeFor } from "@/lib/city/world/cities";
import { TILE, towerStages } from "./buildCity";
import { InteriorControls } from "./interiorControls";
import { buildLodgingInterior, type LodgingInterior } from "./lodgingInterior";
import { lodgingWindowDir } from "./StreetWorld";
import { StreetFireworks } from "./streetFireworks";
import { HeldItemView } from "./heldItem";
import { FLOOR_H } from "./textures";

const POOL_DEPTH = 1;

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
  private fireworks: StreetFireworks | null = null;
  private fireworkOrigin = new THREE.Vector3();
  private heldView = new HeldItemView();

  constructor(
    canvas: HTMLCanvasElement,
    private state: CityState,
    building: Building,
    zone: LodgingZone,
    roomId?: string | null,
    realCity = false,
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

    const roofView = zone === "pool" && realCity;
    const dreamHome = building.stats.extra?.dream === "1" && zone === "lobby";
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.1, dreamHome ? 900 : zone === "lobby" ? 80 : roofView ? 1400 : 900);
    this.scene.add(this.camera);
    this.heldView.attach(this.camera);
    this.interior = buildLodgingInterior(building, zone, state, room, roofView);
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
    this.hemi = new THREE.HemisphereLight(
      dreamHome ? 0xe8f3ff : zone === "pool" ? 0xc9e4ff : 0xfff1d6,
      dreamHome ? 0xc9bba6 : 0x3d4a3a,
      dreamHome ? 1.4 : night ? 0.7 : 1.15,
    );
    this.sun = new THREE.DirectionalLight(zone === "pool" ? 0xfff6e8 : 0xffe7c2, night ? 0.4 : 1.7);
    this.fill = new THREE.PointLight(0xffe0b0, dreamHome ? 4 : zone === "lobby" ? 28 : 16, 36, 1.5);
    this.sun.position.set(8, 28, 10);
    this.fill.position.set(0, 5, 4);
    if (zone === "room" || dreamHome) {
      const windowLight = new THREE.DirectionalLight(night ? 0x8aa4c8 : 0xfff4d6, night ? 0.7 : 1.45);
      windowLight.position.set(0, 5, dreamHome ? -16 : -12);
      windowLight.target.position.set(0, 1.4, 2);
      this.scene.add(windowLight, windowLight.target);
    }
    this.scene.add(this.hemi, this.sun, this.fill);

    if (zone === "room" || zone === "pool") {
      this.fireworks = new StreetFireworks(160);
      this.scene.add(this.fireworks.group);
    }

    if (zone === "pool") {
      const theme = cityThemeFor(state.id);
      const daySky = theme.daySky;
      const nightSky = theme.nightSky;
      this.scene.background = new THREE.Color(night ? nightSky : daySky);
      this.scene.fog = new THREE.Fog(
        night ? theme.fogNight : theme.fogDay,
        roofView ? 160 : 48,
        roofView ? 1100 : 210,
      );
      if (theme.desertAccent) {
        this.hemi.color.set(0xffe6c2);
        this.hemi.groundColor.set(0xc4a574);
        this.sun.color.set(0xffd090);
      }
    } else if (building.stats.extra?.dream === "1" && zone === "lobby") {
      const theme = cityThemeFor(state.id);
      const daySky = theme.daySky;
      this.scene.background = new THREE.Color(night ? theme.nightSky : daySky);
      this.scene.fog = new THREE.Fog(night ? theme.fogNight : theme.fogDay, 70, 720);
    } else if (zone === "room") {
      const theme = cityThemeFor(state.id);
      const daySky = theme.daySky;
      this.scene.background = new THREE.Color(night ? theme.nightSky : daySky);
      this.scene.fog = new THREE.Fog(night ? theme.fogNight : theme.fogDay, 40, 90);
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
    if (this.zone === "pool") {
      this.attachRoofCity(city);
      return;
    }
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
    city.traverse((obj) => {
      if (obj.userData.facadeBalconies) obj.visible = false;
    });
    holder.add(city);
    this.scene.add(holder);
    this.cityHolder = holder;
    this.borrowedCity = city;
  }

  /** Sets the live streets at true scale under the deck, centred on this tower's crown. */
  private attachRoofCity(city: THREE.Group) {
    this.detachCity();
    const stages = towerStages(this.building);
    const crown = stages[stages.length - 1];
    const midX = (crown.x0 + crown.x1) / 2;
    const midZ = (crown.z0 + crown.z1) / 2;
    // Sink the crown just below the pool basin so its roof never shows through the deck.
    city.position.set(-midX, -(crown.top + POOL_DEPTH), -midZ);
    city.rotation.set(0, 0, 0);
    this.scene.add(city);
    this.borrowedCity = city;
  }

  detachCity() {
    const city = this.borrowedCity;
    if (!this.cityHolder && city?.parent === this.scene) this.scene.remove(city);
    if (this.cityHolder && city) this.cityHolder.remove(city);
    if (this.cityHolder) this.scene.remove(this.cityHolder);
    this.cityHolder = null;
    this.borrowedCity = null;
    if (city) {
      city.position.set(0, 0, 0);
      city.rotation.set(0, 0, 0);
      city.traverse((obj) => {
        if (obj.userData.facadeBalconies) obj.visible = true;
      });
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
    const hit = this.interior.nearBed(this.controls.position.x, this.controls.position.z);
    if (!hit) return false;
    if (this.building.stats.extra?.dream === "1" && this.controls.position.y < 4) return false;
    return true;
  }

  nearConsole() {
    return this.interior.nearConsole(this.controls.position.x, this.controls.position.z);
  }

  hasConsole() {
    return Boolean(this.interior.tv?.hasConsole());
  }

  isNuketown() {
    return Boolean(this.interior.tv?.isNuketown());
  }

  toggleNuketown() {
    return this.interior.tv?.toggleNuketown() ?? false;
  }

  nearSlider() {
    return Boolean(this.interior.slider?.near(this.controls.position.x, this.controls.position.z));
  }

  sliderOpen() {
    return this.interior.slider?.open ?? false;
  }

  toggleSlider() {
    const slider = this.interior.slider;
    if (!slider) return false;
    if (slider.open && slider.blockingClose(this.controls.position.x, this.controls.position.z)) {
      return false;
    }
    slider.toggle();
    return true;
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

  setHeld(id: string | null, sips = 0) {
    this.heldView.setHeld(id, sips);
  }

  playSip() {
    this.heldView.playSip();
  }

  render(dt: number) {
    this.controls.update(dt);
    this.controls.applyTo(this.camera);
    this.heldView.update(dt);
    const night = this.isNight();
    this.sun.intensity = this.zone === "pool" ? (night ? 0.35 : 2.0) : night ? 0.55 : 1.35;
    this.hemi.intensity = night ? 0.7 : 1.15;
    if (this.zone === "room" || this.zone === "pool") {
      const theme = cityThemeFor(this.state.id);
      const sky = night ? theme.nightSky : theme.daySky;
      this.scene.background = new THREE.Color(sky);
      if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(sky);
    }
    if (this.deskCtx && this.deskTexture) this.drawDesk();
    this.interior.tv?.update(dt, this.state);
    this.interior.slider?.update(dt);
    this.interior.update?.(dt, {
      fireworks: this.zone === "pool" && stadiumFireworksOn(this.state),
    });
    this.updateFireworks(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateFireworks(dt: number) {
    if (!this.fireworks) return;
    if (this.zone === "pool") this.fireworkOrigin.set(0, 6, 32);
    else this.fireworkOrigin.set(0, 12, -40);
    this.fireworks.update(dt, stadiumFireworksOn(this.state), this.fireworkOrigin, {
      spreadX: 32,
      spreadZ: 18,
      z0: 0,
      height0: 8,
      height1: 24,
      bursts: 2,
      sparksPerBurst: 18,
      rate: 2.5,
    });
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
    this.heldView.dispose();
    this.fireworks?.dispose();
    this.interior.dispose();
    this.deskTexture?.dispose();
    this.renderer.dispose();
  }
}
