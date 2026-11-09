import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { buildHeavenInterior, type HeavenInterior } from "./heavenInterior";
import { InteriorControls } from "./interiorControls";
import { HeldItemView } from "./heldItem";
import { createGlRenderer, releaseGlRenderer } from "./glRenderer";

/** White cloud stairs, an endless rising escalator, and the heavenly host. */
export class HeavenWorld {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: InteriorControls;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private interior: HeavenInterior;
  private hemi = new THREE.HemisphereLight(0xfff8f0, 0xc8b8a8, 0.85);
  private sun = new THREE.DirectionalLight(0xfff8f0, 1.05);
  private heldView = new HeldItemView();

  constructor(canvas: HTMLCanvasElement, _state: CityState) {
    this.renderer = createGlRenderer(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = false;

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 520);
    this.scene.add(this.camera);
    this.heldView.attach(this.camera);

    this.interior = buildHeavenInterior();
    this.scene.add(this.interior.group);
    this.controls = new InteriorControls(this.interior.blockers, this.interior.groundAt, this.interior.bounds);
    this.controls.spawn(this.interior.spawn.x, this.interior.spawn.z, this.interior.spawn.yaw, this.interior.spawn.pitch);

    this.sun.position.set(18, 40, 10);
    this.scene.add(this.sun);
    this.scene.add(this.hemi);
    this.scene.background = new THREE.Color("#d7ecff");
    this.scene.fog = new THREE.Fog(0xdcedfb, 40, 420);
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

  nearExit() {
    const p = this.controls.position;
    return Math.abs(p.y - 1.7) < 2.4 && this.interior.nearExit(p.x, p.z);
  }

  onEscalator() {
    const p = this.controls.position;
    return this.interior.onEscalator(p.x, p.z);
  }

  nearHost() {
    const p = this.controls.position;
    return Math.abs(p.y - 1.7) < 3.2 && this.interior.nearHost(p.x, p.z);
  }

  render(rawDt: number) {
    const dt = Number.isFinite(rawDt) ? Math.max(0, rawDt) : 0;
    this.ride(dt);
    this.controls.update(dt);
    if (this.controls.position.y < 1.7) this.controls.position.y = 1.7;
    this.controls.applyTo(this.camera);
    this.heldView.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private ride(dt: number) {
    const p = this.controls.position;
    if (!this.interior.onEscalator(p.x, p.z)) return;
    const radius = Math.hypot(p.x, p.z);
    const theta = Math.atan2(p.x, p.z) - this.interior.escalatorOmega * dt;
    p.x = Math.sin(theta) * radius;
    p.z = Math.cos(theta) * radius;
  }

  dispose() {
    this.interior.dispose();
    this.heldView.dispose();
    releaseGlRenderer(this.renderer);
  }
}
