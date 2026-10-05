import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { buildAirfieldInterior, type AirfieldInterior } from "./airfieldInterior";
import { InteriorControls } from "./interiorControls";
import { HeldItemView } from "./heldItem";

/** Grass strip beyond the Mountain City service tunnel. */
export class AirfieldWorld {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: InteriorControls;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private interior: AirfieldInterior;
  private hemi = new THREE.HemisphereLight(0xc5dff5, 0x3d5a32, 1.15);
  private sun = new THREE.DirectionalLight(0xfff4e0, 2);
  private heldView = new HeldItemView();
  private tunnelLights: THREE.PointLight[] = [];

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
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;

    this.camera = new THREE.PerspectiveCamera(74, 1, 0.1, 420);
    this.scene.add(this.camera);
    this.heldView.attach(this.camera);

    this.interior = buildAirfieldInterior();
    this.scene.add(this.interior.group);
    this.controls = new InteriorControls(this.interior.blockers, this.interior.groundAt, this.interior.bounds);
    this.controls.spawn(this.interior.spawn.x, this.interior.spawn.z, this.interior.spawn.yaw, this.interior.spawn.pitch);

    this.sun.position.set(-30, 48, 20);
    this.sun.target.position.set(0, 0, -30);
    this.scene.add(this.sun.target);
    this.scene.add(this.sun);
    this.scene.add(this.hemi);
    for (const z of [12, 20, 28]) {
      const lamp = new THREE.PointLight(0xffe7b0, 8, 14, 1.6);
      lamp.position.set(0, 3.4, z);
      this.tunnelLights.push(lamp);
      this.scene.add(lamp);
    }
    this.scene.background = new THREE.Color("#8ec6ef");
    this.scene.fog = new THREE.Fog(0xb7d0c4, 80, 220);
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

  nearCityMouth() {
    return this.interior.nearCityMouth(this.controls.position.x, this.controls.position.z);
  }

  onField() {
    return this.interior.onField(this.controls.position.x, this.controls.position.z);
  }

  render(rawDt: number) {
    const dt = Number.isFinite(rawDt) ? Math.max(0, rawDt) : 0;
    this.controls.update(dt);
    this.controls.applyTo(this.camera);
    this.heldView.update(dt);
    const hour = this.state.clock.minuteOfDay / 60;
    const night = hour < 6 || hour >= 19.5;
    this.sun.intensity = night ? 0.22 : 2.05;
    this.hemi.intensity = night ? 0.45 : 1.2;
    this.renderer.toneMappingExposure = night ? 0.85 : 1.08;
    const sky = night ? "#141c2e" : "#8ec6ef";
    this.scene.background = new THREE.Color(sky);
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(night ? "#141c2e" : "#b7d0c4");
    for (const lamp of this.tunnelLights) lamp.intensity = night ? 14 : 6;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.interior.dispose();
    this.heldView.dispose();
    this.renderer.dispose();
  }
}
