import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { stationIndex } from "@/lib/city/subway";
import { EYE_HEIGHT, InteriorControls } from "./interiorControls";
import { TRACK_Z, buildSubwayInterior, type SubwayInterior } from "./subwayInterior";
import { HeldItemView } from "./heldItem";

type Phase = "away" | "arriving" | "dwell" | "departing" | "riding";

export class SubwayWorld {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: InteriorControls;
  readonly stationId: string;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private interior: SubwayInterior;
  private hemi: THREE.HemisphereLight;
  private fill: THREE.PointLight;
  private head: THREE.SpotLight;
  private tunnelGlow: THREE.PointLight;
  private phase: Phase;
  private phaseT = 0;
  private trainX = -72;
  private rideDir = 1;
  private rideDest: string | null = null;
  private onArrive: ((id: string) => void) | null = null;
  private arrived: boolean;
  private heldView = new HeldItemView();

  constructor(
    canvas: HTMLCanvasElement,
    private state: CityState,
    stationId: string,
    arrived = false,
  ) {
    this.stationId = stationId;
    this.arrived = arrived;
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

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.12, 180);
    this.scene.add(this.camera);
    this.heldView.attach(this.camera);
    this.interior = buildSubwayInterior(stationId);
    this.scene.add(this.interior.group);

    this.controls = new InteriorControls(
      this.interior.blockers,
      this.interior.groundAt,
      this.interior.bounds,
    );
    const spawn = arrived ? this.interior.platformSpawn : this.interior.spawn;
    this.controls.spawn(spawn.x, spawn.z, spawn.yaw, spawn.pitch);

    this.hemi = new THREE.HemisphereLight(0xe8eef4, 0x3a3228, 1.15);
    this.fill = new THREE.PointLight(0xffe7c2, 42, 36, 1.35);
    this.fill.position.set(0, 6.2, 13.2);
    const platformFill = new THREE.PointLight(0xfff0d2, 38, 32, 1.4);
    platformFill.position.set(0, 4.6, 4.4);
    const leftFill = new THREE.PointLight(0xffd9a0, 22, 24, 1.5);
    leftFill.position.set(-12, 4.2, 4.0);
    const rightFill = new THREE.PointLight(0xffd9a0, 22, 24, 1.5);
    rightFill.position.set(12, 4.2, 4.0);
    this.head = new THREE.SpotLight(0xfff2c4, 26, 56, 0.5, 0.4, 1.15);
    this.head.position.set(0, 1.4, TRACK_Z);
    this.tunnelGlow = new THREE.PointLight(0xffc37a, 20, 40, 1.3);
    this.tunnelGlow.position.set(-18, 2.6, -3.2);
    this.scene.add(
      this.hemi,
      this.fill,
      platformFill,
      leftFill,
      rightFill,
      this.head,
      this.head.target,
      this.tunnelGlow,
    );
    this.scene.background = new THREE.Color("#151820");
    this.scene.fog = new THREE.Fog(0x151820, 36, 120);
    this.renderer.toneMappingExposure = 1.22;

    if (arrived) {
      this.phase = "dwell";
      this.trainX = 0;
    } else {
      this.phase = "arriving";
      this.trainX = -36;
      this.phaseT = 2.4;
    }
    this.interior.train.position.x = this.trainX;
  }

  setArriveHandler(handler: (id: string) => void) {
    this.onArrive = handler;
  }

  nearExit() {
    return !this.isRiding() && this.interior.nearExit(this.controls.position.x, this.controls.position.z);
  }

  nearTrain() {
    if (this.phase !== "dwell" || this.isRiding()) return false;
    const dx = Math.abs(this.controls.position.x - this.trainX);
    return this.interior.nearPlatform(this.controls.position.x, this.controls.position.z) && dx < 10;
  }

  doorsOpen() {
    return this.phase === "dwell";
  }

  isRiding() {
    return this.phase === "riding";
  }

  rideDestination() {
    return this.rideDest;
  }

  beginRide(destinationId: string) {
    if (destinationId === this.stationId) return;
    this.rideDest = destinationId;
    this.rideDir = stationIndex(destinationId) >= stationIndex(this.stationId) ? 1 : -1;
    this.phase = "riding";
    this.phaseT = 0;
    this.controls.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
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
    this.stepTrain(dt);
    this.interior.train.position.x = this.trainX;
    this.head.position.set(this.trainX + this.rideDir * 20.4, 1.55, TRACK_Z);
    this.head.target.position.set(this.trainX + this.rideDir * 36, 1.2, TRACK_Z);
    this.tunnelGlow.position.set(this.trainX - this.rideDir * 8, 2.4, -3.1);

    if (this.phase === "riding") {
      this.applyRideCamera();
    } else {
      this.controls.update(dt);
      this.controls.applyTo(this.camera);
      if (this.phase === "arriving") {
        const rumble = (1 - this.phaseT / 5.2) * 0.028;
        this.camera.position.y += Math.sin(this.phaseT * 28) * rumble;
      }
    }

    this.heldView.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private stepTrain(dt: number) {
    this.phaseT += dt;
    if (this.phase === "away") {
      this.trainX = -72;
      if (this.phaseT > 3.2) this.setPhase("arriving");
    } else if (this.phase === "arriving") {
      const t = Math.min(1, this.phaseT / 5.2);
      this.trainX = THREE.MathUtils.lerp(-72, 0, easeOut(t));
      if (t >= 1) this.setPhase("dwell");
    } else if (this.phase === "dwell") {
      this.trainX = 0;
      if (this.phaseT > 14) this.setPhase("departing");
    } else if (this.phase === "departing") {
      const t = Math.min(1, this.phaseT / 4.4);
      this.trainX = THREE.MathUtils.lerp(0, 78, easeIn(t));
      if (t >= 1) {
        this.trainX = -72;
        this.setPhase("away");
      }
    } else if (this.phase === "riding") {
      const t = Math.min(1, this.phaseT / 5.2);
      this.trainX = this.rideDir * easeIn(t) * 42;
      if (t >= 1) this.finishRide();
    }
  }

  private finishRide() {
    const dest = this.rideDest;
    if (!dest) return;
    this.rideDest = null;
    this.onArrive?.(dest);
  }

  private applyRideCamera() {
    const sway = Math.sin(this.phaseT * 16) * 0.04;
    const bob = Math.sin(this.phaseT * 20) * 0.025;
    const x = THREE.MathUtils.clamp(this.trainX * 0.35, -28, 28);
    this.camera.position.set(x, 1.72 + bob, 3.15 + sway);
    this.camera.lookAt(x + this.rideDir * 22, 1.15, TRACK_Z);
  }

  private setPhase(next: Phase) {
    this.phase = next;
    this.phaseT = 0;
  }

  dispose() {
    this.heldView.dispose();
    this.interior.dispose();
    this.renderer.dispose();
  }
}

function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}

function easeIn(t: number) {
  return t * t;
}
