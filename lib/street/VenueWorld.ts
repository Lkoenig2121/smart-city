import * as THREE from "three";
import type { Building, CityState } from "@/lib/city/types";
import { venueRole } from "@/lib/city/venues";
import { InteriorControls } from "./interiorControls";
import { buildVenueInterior, type VenueInterior } from "./venueInterior";
import { HeldItemView } from "./heldItem";

export class VenueWorld {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: InteriorControls;
  readonly building: Building;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private interior: VenueInterior;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.PointLight;
  private heldView = new HeldItemView();
  private mall: boolean;

  constructor(canvas: HTMLCanvasElement, private state: CityState, building: Building) {
    this.building = building;
    this.mall = venueRole(building) === "mall";
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.mall ? 1.12 : 1.05;
    this.renderer.shadowMap.enabled = true;

    this.camera = new THREE.PerspectiveCamera(74, 1, 0.1, this.mall ? 240 : 80);
    this.scene.add(this.camera);
    this.heldView.attach(this.camera);
    this.interior = buildVenueInterior(building);
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
    this.hemi = new THREE.HemisphereLight(0xfff1d6, 0x3d4a3a, night ? 0.75 : 1.15);
    this.sun = new THREE.DirectionalLight(0xffe7c2, night ? 0.45 : 1.25);
    this.fill = new THREE.PointLight(0xffe0b0, this.mall ? 40 : 22, this.mall ? 90 : 32, 1.5);
    this.sun.position.set(6, this.mall ? 28 : 18, 8);
    this.fill.position.set(0, this.mall ? 12.2 : 4.2, this.mall ? 4 : 2);
    this.scene.add(this.hemi, this.sun, this.fill);
    if (this.mall) {
      const north = new THREE.PointLight(0xe8f4ff, 26, 70, 1.25);
      north.position.set(0, 11.2, -22);
      const south = new THREE.PointLight(0xffe8c8, 28, 70, 1.25);
      south.position.set(0, 10.8, 24);
      const west = new THREE.PointLight(0xffd9c0, 22, 55, 1.3);
      west.position.set(-24, 10.4, 0);
      const east = new THREE.PointLight(0xffd9c0, 22, 55, 1.3);
      east.position.set(24, 10.4, 0);
      const mid = new THREE.PointLight(0xfff1d8, 24, 48, 1.35);
      mid.position.set(0, 6.4, 0);
      this.scene.add(north, south, west, east, mid);
      this.hemi.intensity = night ? 0.95 : 1.28;
      this.sun.intensity = night ? 0.55 : 0.9;
    }
    this.scene.background = new THREE.Color(night ? "#12151a" : this.mall ? "#2a2620" : "#1c1814");
    this.scene.fog = new THREE.Fog(night ? 0x12151a : this.mall ? 0x2a2620 : 0x1c1814, this.mall ? 48 : 16, this.mall ? 165 : 42);
  }

  nearDesk() {
    return this.interior.nearDesk(this.controls.position.x, this.controls.position.z);
  }

  nearExit() {
    return this.interior.nearExit(this.controls.position.x, this.controls.position.z);
  }

  nearStore() {
    return this.interior.nearStore?.(this.controls.position.x, this.controls.position.z) ?? null;
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
    this.interior.update?.(dt);
    const ride = this.interior.rideAt?.(this.controls.position.x, this.controls.position.z);
    if (ride) this.controls.nudge(ride.x * dt, ride.z * dt);
    this.controls.update(dt);
    this.controls.applyTo(this.camera);
    this.heldView.update(dt);
    const night = this.isNight();
    if (this.mall) {
      this.sun.intensity = night ? 0.55 : 0.9;
      this.hemi.intensity = night ? 0.95 : 1.28;
      this.fill.intensity = night ? 32 : 40;
    } else {
      this.sun.intensity = night ? 0.45 : 1.25;
      this.hemi.intensity = night ? 0.75 : 1.15;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private isNight() {
    const hour = this.state.clock.minuteOfDay / 60;
    return hour < 6.5 || hour >= 19.5;
  }

  dispose() {
    this.heldView.dispose();
    this.interior.dispose();
    this.renderer.dispose();
  }
}
