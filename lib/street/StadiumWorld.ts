import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { formatClock } from "@/lib/simulation/city/cityTick";
import { isGameNight } from "@/lib/city/stadium";
import { InteriorControls } from "./interiorControls";
import { buildStadiumInterior, type StadiumInterior } from "./stadiumInterior";

/**
 * First-person walk through Ravens Ballpark. Lighting and the scoreboard
 * follow the live city clock so a 7 PM start actually looks like night game.
 */
export class StadiumWorld {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: InteriorControls;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private interior: StadiumInterior;
  private hemi = new THREE.HemisphereLight(0xc9e4ff, 0x3d4a3a, 1);
  private sun = new THREE.DirectionalLight(0xfff6e8, 1.6);
  private fill = new THREE.PointLight(0xffe0b0, 18, 40, 1.6);
  private scoreCanvas: HTMLCanvasElement;
  private scoreCtx: CanvasRenderingContext2D;
  private scoreTexture: THREE.CanvasTexture;
  private time = 0;

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
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;

    this.camera = new THREE.PerspectiveCamera(78, 1, 0.1, 400);
    this.interior = buildStadiumInterior();
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

    this.sun.position.set(8, 40, 12);
    this.sun.target.position.set(0, 0, 4);
    this.scene.add(this.sun.target);
    this.sun.castShadow = false;
    this.scene.add(this.sun);
    this.hemi.intensity = 1.25;
    this.scene.add(this.hemi);
    this.fill.position.set(0, 6, 30);
    this.fill.intensity = 24;
    this.scene.add(this.fill);
    const bowlLight = new THREE.PointLight(0xfff0d2, 32, 55, 1.4);
    bowlLight.position.set(0, 12, 8);
    this.scene.add(bowlLight);
    this.scene.background = new THREE.Color("#7eb3e0");
    this.scene.fog = new THREE.Fog(0x7eb3e0, 70, 180);

    this.scoreCanvas = document.createElement("canvas");
    this.scoreCanvas.width = 1024;
    this.scoreCanvas.height = 448;
    const ctx = this.scoreCanvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.scoreCtx = ctx;
    this.scoreTexture = new THREE.CanvasTexture(this.scoreCanvas);
    this.interior.scoreboard.map = this.scoreTexture;
    this.interior.scoreboard.emissiveMap = this.scoreTexture;
    this.interior.scoreboard.needsUpdate = true;
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(dt: number) {
    this.time += dt;
    this.controls.update(dt);
    this.controls.applyTo(this.camera);

    const hour = this.state.clock.minuteOfDay / 60;
    const night = hour < 6.5 || hour >= 19.5;
    this.sun.intensity = night ? 0.35 : 2.1;
    this.hemi.intensity = night ? 0.85 : 1.35;
    this.fill.intensity = night ? 36 : 22;
    this.renderer.toneMappingExposure = night ? 1.25 : 1.12;
    this.scene.background = new THREE.Color(night ? "#10182c" : "#7eb3e0");
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.set(night ? "#10182c" : "#7eb3e0");
    }

    this.drawScoreboard();
    this.walkFans(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private drawScoreboard() {
    const ctx = this.scoreCtx;
    const w = this.scoreCanvas.width;
    const h = this.scoreCanvas.height;
    const clock = formatClock(this.state);
    const game = isGameNight(this.state);

    ctx.fillStyle = "#07140a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1f4d8c";
    ctx.fillRect(0, 0, w, 72);
    ctx.fillStyle = "#e8c36a";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚾  RIVERSIDE RAVENS", w / 2, 50);

    ctx.fillStyle = "#f4f7fb";
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(game ? "HOME GAME" : "OPEN HOUSE", w / 2, 160);
    ctx.font = "bold 40px sans-serif";
    ctx.fillStyle = "#9fe8a8";
    ctx.fillText(game ? "First pitch — 7:00 PM" : "Next home game — 7:00 PM", w / 2, 220);

    ctx.font = "32px sans-serif";
    ctx.fillStyle = "#d7e6f0";
    ctx.fillText(`${clock.day}  ·  ${clock.time}`, w / 2, 280);

    ctx.font = "bold 48px sans-serif";
    ctx.fillStyle = "#c0392b";
    ctx.fillText("RAVENS  0   VISITORS  0", w / 2, 360);
    ctx.font = "28px sans-serif";
    ctx.fillStyle = "#9fe8a8";
    ctx.fillText(game ? "Warmups on the field" : "Tours through the concourse", w / 2, 410);

    this.scoreTexture.needsUpdate = true;
  }

  private walkFans(dt: number) {
    const mesh = this.interior.fans;
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const walking = 24;
    for (let i = 0; i < walking; i++) {
      const id = 36 + i;
      mesh.getMatrixAt(id, matrix);
      matrix.decompose(pos, quat, scale);
      const t = this.time * 0.55 + i * 1.15;
      pos.x = -16 + ((t * 5.5 + i * 3.2) % 32);
      pos.z = 32.8 + Math.sin(t * 1.3 + i) * 0.7;
      pos.y = 0.97;
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      matrix.compose(pos, quat, scale);
      mesh.setMatrixAt(id, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    void dt;
  }

  dispose() {
    this.interior.dispose();
    this.scoreTexture.dispose();
    this.renderer.dispose();
  }
}
