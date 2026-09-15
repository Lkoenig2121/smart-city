import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { formatClock } from "@/lib/simulation/city/cityTick";
import { GAME_HOURS_LABEL, isGameNight, stadiumAttendance, stadiumGame } from "@/lib/city/stadium";
import { InteriorControls } from "./interiorControls";
import { buildStadiumInterior } from "./stadiumInterior";

const DEFENSE: { x: number; z: number }[] = [
  { x: 0, z: 8.7 },
  { x: 0.15, z: 16.35 },
  { x: 7.85, z: 9.05 },
  { x: 1.15, z: 2.15 },
  { x: -7.85, z: 9.05 },
  { x: -3.35, z: 3.55 },
  { x: -12.6, z: -8.2 },
  { x: 0, z: -13.2 },
  { x: 12.6, z: -8.2 },
];
const BATTER = { x: -0.62, z: 15.52 };
const DUGOUT_HOME = { x: -14.7, z: 8.2 };
const DUGOUT_AWAY = { x: 14.7, z: 8.2 };

/**
 * First-person walk through Ravens Ballpark. Lighting and the scoreboard
 * follow the live city clock so a 6 PM start actually looks like a night game.
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
  private players: THREE.InstancedMesh;
  private ball: THREE.Mesh;
  private playerDummy = new THREE.Object3D();
  private flood: THREE.SpotLight[] = [];
  private floodFill: THREE.PointLight[] = [];
  private sparks: THREE.InstancedMesh;
  private sparkDummy = new THREE.Object3D();
  private sparkLife: { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number }[] = [];

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
    this.fill.position.set(0, 6, 36);
    this.fill.intensity = 24;
    this.scene.add(this.fill);
    const bowlLight = new THREE.PointLight(0xfff0d2, 32, 55, 1.4);
    bowlLight.position.set(0, 12, 8);
    this.scene.add(bowlLight);
    const underLight = new THREE.PointLight(0xffd9a0, 28, 22, 1.8);
    underLight.position.set(0, 2.2, 23.5);
    this.scene.add(underLight);
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

    const body = new THREE.CapsuleGeometry(0.28, 0.92, 4, 8);
    const kit = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.players = new THREE.InstancedMesh(body, kit, 10);
    this.players.frustumCulled = false;
    this.players.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.Color();
    for (let i = 0; i < 10; i++) {
      this.players.setColorAt(i, color.set(i === 9 ? "#e8ece8" : "#1f4d8c"));
    }
    if (this.players.instanceColor) this.players.instanceColor.needsUpdate = true;
    this.scene.add(this.players);
    const ballGeo = new THREE.SphereGeometry(0.12, 12, 10);
    const ballMat = new THREE.MeshLambertMaterial({ color: "#f4f1ea" });
    this.ball = new THREE.Mesh(ballGeo, ballMat);
    this.ball.visible = false;
    this.scene.add(this.ball);

    const towers = [
      { x: -22.15, z: 13.85, aimX: -4, aimZ: 6 },
      { x: 21.85, z: 13.85, aimX: 4, aimZ: 6 },
      { x: -22.95, z: -16.15, aimX: -3, aimZ: -2 },
      { x: 22.65, z: -16.15, aimX: 3, aimZ: -2 },
    ];
    for (const tower of towers) {
      const spot = new THREE.SpotLight(0xfff1c8, 0, 90, 0.55, 0.35, 1.15);
      spot.position.set(tower.x, 16.4, tower.z);
      spot.target.position.set(tower.aimX, 0.2, tower.aimZ);
      this.scene.add(spot, spot.target);
      this.flood.push(spot);
      const fill = new THREE.PointLight(0xffe7b0, 0, 42, 1.4);
      fill.position.set(tower.x, 16.2, tower.z);
      this.scene.add(fill);
      this.floodFill.push(fill);
    }

    const sparkGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const sparkMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    this.sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, 96);
    this.sparks.frustumCulled = false;
    this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const sparkColor = new THREE.Color();
    const burst = ["#ffd36a", "#ff6b5a", "#7ec8ff", "#f4f1ea", "#c9a44c", "#ff8ad4"];
    for (let i = 0; i < 96; i++) {
      this.sparks.setColorAt(i, sparkColor.set(burst[i % burst.length]));
      this.sparkLife.push({ x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, age: 99, life: 1 });
    }
    if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
    this.scene.add(this.sparks);
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
    const game = isGameNight(this.state);
    const crowd = stadiumAttendance(this.state);
    const night = hour < 6.5 || hour >= 19.5 || game || crowd.lights > 0.4;
    this.sun.intensity = night ? 0.28 : 2.1;
    this.hemi.intensity = night ? 0.7 : 1.35;
    this.fill.intensity = 18 + crowd.lights * 28;
    this.renderer.toneMappingExposure = night ? 1.18 : 1.12;
    this.scene.background = new THREE.Color(night ? "#10182c" : "#7eb3e0");
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.set(night ? "#10182c" : "#7eb3e0");
    }
    for (const light of this.flood) light.intensity = crowd.lights * 3.6;
    for (const light of this.floodFill) light.intensity = crowd.lights * 26;

    this.drawScoreboard();
    this.playField();
    this.fillCrowd(crowd, dt);
    this.playFireworks(crowd.fireworks, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private drawScoreboard() {
    const ctx = this.scoreCtx;
    const w = this.scoreCanvas.width;
    const h = this.scoreCanvas.height;
    const clock = formatClock(this.state);
    const game = stadiumGame(this.state);

    ctx.fillStyle = "#07140a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1f4d8c";
    ctx.fillRect(0, 0, w, 72);
    ctx.fillStyle = "#e8c36a";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚾  RIVERSIDE RAVENS", w / 2, 50);

    ctx.fillStyle = "#f4f7fb";
    ctx.font = "bold 52px sans-serif";
    if (!game) {
      ctx.fillText("OPEN HOUSE", w / 2, 150);
      ctx.font = "bold 36px sans-serif";
      ctx.fillStyle = "#9fe8a8";
      ctx.fillText(`First pitch tonight — ${GAME_HOURS_LABEL}`, w / 2, 210);
    } else if (game.firstPitch) {
      ctx.fillText("FIRST PITCH", w / 2, 150);
      ctx.font = "bold 36px sans-serif";
      ctx.fillStyle = "#9fe8a8";
      ctx.fillText("Ravens vs. Bayville Bears", w / 2, 210);
    } else if (!game.playing) {
      ctx.fillText("FINAL", w / 2, 150);
      ctx.font = "bold 36px sans-serif";
      ctx.fillStyle = "#9fe8a8";
      ctx.fillText(`${GAME_HOURS_LABEL}  ·  ballgame over`, w / 2, 210);
    } else {
      ctx.fillText(game.top ? `TOP ${game.inning}` : `BOT ${game.inning}`, w / 2, 150);
      ctx.font = "bold 32px sans-serif";
      ctx.fillStyle = "#9fe8a8";
      ctx.fillText(`${game.outs} out  ·  ${GAME_HOURS_LABEL}`, w / 2, 210);
    }

    ctx.font = "32px sans-serif";
    ctx.fillStyle = "#d7e6f0";
    ctx.fillText(`${clock.day}  ·  ${clock.time}`, w / 2, 268);

    ctx.font = "bold 48px sans-serif";
    ctx.fillStyle = "#c0392b";
    const ravens = game?.ravens ?? 0;
    const visitors = game?.visitors ?? 0;
    ctx.fillText(`RAVENS  ${ravens}     BEARS  ${visitors}`, w / 2, 348);
    ctx.font = "28px sans-serif";
    ctx.fillStyle = "#9fe8a8";
    ctx.fillText(
      game?.playing ? "Play ball" : game ? "Thanks for coming out" : "Tours through the concourse",
      w / 2,
      408,
    );

    this.scoreTexture.needsUpdate = true;
  }

  private playField() {
    const game = stadiumGame(this.state);
    const dummy = this.playerDummy;
    dummy.scale.set(1, 1, 1);
    if (!game) {
      this.ball.visible = false;
      for (let i = 0; i < 10; i++) {
        const dug = i < 5 ? DUGOUT_HOME : DUGOUT_AWAY;
        dummy.position.set(dug.x + (i % 5) * 0.55, 0.95, dug.z);
        dummy.rotation.set(0, i < 5 ? Math.PI / 2 : -Math.PI / 2, 0);
        dummy.updateMatrix();
        this.players.setMatrixAt(i, dummy.matrix);
      }
      this.players.instanceMatrix.needsUpdate = true;
      return;
    }

    const cycle = this.time % 5.6;
    const pitch = cycle < 1.45;
    const inAir = cycle >= 1.45 && cycle < 1.92;
    const contact = Math.floor(this.time / 5.6) % 3 === 1;
    const fly = inAir && contact ? 0 : contact && cycle >= 1.92 ? Math.min(1, (cycle - 1.92) / 2.1) : 0;

    for (let i = 0; i < 9; i++) {
      const spot = DEFENSE[i];
      let x = spot.x;
      let z = spot.z;
      if (i === 0 && pitch) z += Math.sin(cycle * 8) * 0.12;
      if (fly > 0 && i === 7) {
        x += fly * 4.2;
        z += fly * 3.5;
      }
      dummy.position.set(x, 0.95, z);
      dummy.rotation.set(0, i === 1 || i === 0 ? 0 : Math.atan2(spot.x, 15.5 - spot.z), 0);
      dummy.updateMatrix();
      this.players.setMatrixAt(i, dummy.matrix);
    }

    const swing = inAir && contact ? -0.35 : 0;
    dummy.position.set(BATTER.x, 0.95, BATTER.z);
    dummy.rotation.set(0, Math.PI + swing, 0);
    dummy.updateMatrix();
    this.players.setMatrixAt(9, dummy.matrix);
    this.players.instanceMatrix.needsUpdate = true;

    this.ball.visible = game.playing || game.firstPitch;
    if (!this.ball.visible) return;
    if (cycle < 1.45) {
      this.ball.position.set(0.2, 1.35 + Math.max(0, 1.2 - cycle) * 0.4, 8.55);
    } else if (cycle < 1.92) {
      const t = (cycle - 1.45) / 0.47;
      this.ball.position.set(0.05, 1.25 + Math.sin(t * Math.PI) * 0.55, 8.55 + t * 7.5);
    } else if (contact) {
      const t = Math.min(1, (cycle - 1.92) / 2.2);
      this.ball.position.set(t * 11.5, 1.4 + Math.sin(t * Math.PI) * 4.8, 15.4 - t * 22);
    } else {
      this.ball.position.set(0.2, 1.05, 16.15);
    }
  }

  private fillCrowd(crowd: { seated: number; walking: number }, dt: number) {
    const mesh = this.interior.fans;
    const rest = this.interior.rest;
    const dummy = this.playerDummy;
    const seated = this.interior.seatedCount;
    const walking = this.interior.walkingCount;
    const seatedShown = Math.round(seated * crowd.seated);
    const walkingShown = Math.round(walking * crowd.walking);
    dummy.rotation.set(0, 0, 0);
    for (let i = 0; i < seated; i++) {
      if (i < seatedShown) {
        dummy.position.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
        dummy.scale.set(1, 1, 1);
      } else {
        dummy.position.set(0, -8, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    dummy.scale.set(1, 1, 1);
    for (let n = 0; n < walking; n++) {
      const id = seated + n;
      if (n >= walkingShown) {
        dummy.position.set(0, -8, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
        dummy.updateMatrix();
        mesh.setMatrixAt(id, dummy.matrix);
        dummy.scale.set(1, 1, 1);
        continue;
      }
      const t = this.time * 0.48 + n * 1.12;
      dummy.position.set(-18 + ((t * 5.2 + n * 2.8) % 36), 0.97, 41.4 + Math.sin(t * 1.15 + n) * 0.85);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(id, dummy.matrix);
    }
    dummy.rotation.set(0, 0, 0);
    mesh.instanceMatrix.needsUpdate = true;
    void dt;
  }

  private playFireworks(on: boolean, dt: number) {
    const dummy = this.sparkDummy;
    if (on && Math.floor(this.time * 2.2) !== Math.floor((this.time - dt) * 2.2)) {
      const ox = (Math.random() - 0.5) * 22;
      const oz = -24 + Math.random() * 6;
      const oy = 18 + Math.random() * 8;
      const hue = Math.floor(Math.random() * 96);
      for (let i = 0; i < 16; i++) {
        const spark = this.sparkLife[(hue + i) % this.sparkLife.length];
        const a = (i / 16) * Math.PI * 2;
        const s = 4.5 + Math.random() * 3.5;
        spark.x = ox;
        spark.y = oy;
        spark.z = oz;
        spark.vx = Math.cos(a) * s * (0.4 + Math.random());
        spark.vy = Math.sin(a * 1.7) * s * 0.55 + 1.2;
        spark.vz = Math.sin(a) * s * (0.4 + Math.random());
        spark.age = 0;
        spark.life = 1.15 + Math.random() * 0.5;
      }
    }
    for (let i = 0; i < this.sparkLife.length; i++) {
      const spark = this.sparkLife[i];
      spark.age += dt;
      if (!on || spark.age > spark.life) {
        dummy.position.set(0, -30, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
      } else {
        spark.vy -= 7.5 * dt;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.z += spark.vz * dt;
        const fade = 1 - spark.age / spark.life;
        dummy.position.set(spark.x, spark.y, spark.z);
        dummy.scale.setScalar(0.7 + fade * 1.4);
      }
      dummy.updateMatrix();
      this.sparks.setMatrixAt(i, dummy.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.interior.dispose();
    this.scoreTexture.dispose();
    this.players.geometry.dispose();
    (this.players.material as THREE.Material).dispose();
    this.ball.geometry.dispose();
    (this.ball.material as THREE.Material).dispose();
    this.sparks.geometry.dispose();
    (this.sparks.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
