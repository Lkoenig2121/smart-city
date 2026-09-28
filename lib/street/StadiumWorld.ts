import * as THREE from "three";
import type { CityState } from "@/lib/city/types";
import { formatClock } from "@/lib/simulation/city/cityTick";
import {
  GAME_END_MINUTE,
  GAME_START_MINUTE,
  isGameNight,
  stadiumAttendance,
  stadiumClubFor,
  stadiumFinal,
  stadiumGame,
  stadiumSeriesGame,
} from "@/lib/city/stadium";
import { buildBlimp, type Blimp } from "./blimp";
import { createFireworkSparks, FIREWORK_PALETTE, sparkFade, stepFireworks, type FireworkSpark } from "@/lib/city/fireworks";
import { paintRavensScoreboard } from "./ravensScoreboard";
import { InteriorControls } from "./interiorControls";
import { buildStadiumInterior, type StadiumInterior } from "./stadiumInterior";
import { HeldItemView } from "./heldItem";
import { hasGreenMonster } from "./scorpionMonster";

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
const CYCLE = 6.15;
const PITCH_END = 1.48;
const CONTACT_AT = 1.94;
const PLATE = { x: 0.08, y: 1.18, z: 15.92 };

type AtBatKind = "take" | "whiff" | "ground" | "liner" | "fly" | "pop" | "foul" | "homer";

interface AtBatPlay {
  kind: AtBatKind;
  landX: number;
  landZ: number;
  peak: number;
  fielder: number;
}

const AT_BATS: AtBatPlay[] = [
  { kind: "take", landX: 0.25, landZ: 16.2, peak: 0, fielder: 1 },
  { kind: "whiff", landX: -0.2, landZ: 16.25, peak: 0, fielder: 1 },
  { kind: "ground", landX: -5.4, landZ: 4.1, peak: 0.42, fielder: 5 },
  { kind: "ground", landX: -8.2, landZ: 7.4, peak: 0.38, fielder: 4 },
  { kind: "ground", landX: 2.6, landZ: 1.6, peak: 0.4, fielder: 3 },
  { kind: "ground", landX: 8.6, landZ: 6.8, peak: 0.36, fielder: 2 },
  { kind: "ground", landX: 0.4, landZ: 6.2, peak: 0.34, fielder: 0 },
  { kind: "ground", landX: -3.8, landZ: 9.6, peak: 0.28, fielder: 4 },
  { kind: "liner", landX: -11.4, landZ: -3.6, peak: 2.15, fielder: 6 },
  { kind: "liner", landX: 11.8, landZ: -2.8, peak: 1.95, fielder: 8 },
  { kind: "liner", landX: 1.2, landZ: -6.4, peak: 2.35, fielder: 7 },
  { kind: "liner", landX: -7.2, landZ: 0.4, peak: 1.7, fielder: 5 },
  { kind: "fly", landX: 0.3, landZ: -13.4, peak: 8.6, fielder: 7 },
  { kind: "fly", landX: -11.2, landZ: -9.4, peak: 7.4, fielder: 6 },
  { kind: "fly", landX: 12.8, landZ: -8.2, peak: 7.8, fielder: 8 },
  { kind: "fly", landX: -6.4, landZ: -12.2, peak: 8.1, fielder: 6 },
  { kind: "fly", landX: 7.1, landZ: -12.6, peak: 8.3, fielder: 8 },
  { kind: "pop", landX: 4.1, landZ: 12.2, peak: 9.4, fielder: 2 },
  { kind: "pop", landX: -2.6, landZ: 11.4, peak: 10.2, fielder: 0 },
  { kind: "pop", landX: 0.8, landZ: 17.8, peak: 8.8, fielder: 1 },
  { kind: "foul", landX: -17.4, landZ: 18.6, peak: 6.2, fielder: -1 },
  { kind: "foul", landX: 17.8, landZ: 17.4, peak: 5.8, fielder: -1 },
  { kind: "foul", landX: -15.6, landZ: 8.4, peak: 4.4, fielder: -1 },
  { kind: "homer", landX: 1.4, landZ: -24.5, peak: 14.2, fielder: 7 },
  { kind: "homer", landX: -8.6, landZ: -22.8, peak: 13.4, fielder: 6 },
  { kind: "homer", landX: 10.2, landZ: -22.2, peak: 13.8, fielder: 8 },
  // Green Monster shots — left-field wall at Scorpion Field.
  { kind: "homer", landX: -14.2, landZ: -18.6, peak: 12.6, fielder: 6 },
  { kind: "liner", landX: -16.4, landZ: -10.2, peak: 9.8, fielder: 6 },
];

/**
 * First-person walk through the city's ballpark. Lighting and the scoreboard
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
  private sparkLife: FireworkSpark[] = [];
  private heldView = new HeldItemView();
  private blimp: Blimp;
  private neonDummy = new THREE.Object3D();
  private blimpBanner = "";

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
    this.scene.add(this.camera);
    this.heldView.attach(this.camera);
    this.interior = buildStadiumInterior({
      greenMonster: [...this.state.buildings.values()].some(hasGreenMonster),
    });
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
    this.scoreCanvas.width = 1400;
    this.scoreCanvas.height = 860;
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
    this.sparkLife = createFireworkSparks(96);
    for (let i = 0; i < 96; i++) {
      this.sparks.setColorAt(i, sparkColor.set(FIREWORK_PALETTE[i % FIREWORK_PALETTE.length]));
    }
    if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
    this.scene.add(this.sparks);

    this.blimp = buildBlimp();
    this.blimp.group.visible = false;
    this.scene.add(this.blimp.group);
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

  render(rawDt: number) {
    // The first rAF timestamp can precede the loop's performance.now() seed.
    const dt = Number.isFinite(rawDt) ? Math.max(0, rawDt) : 0;
    this.time += dt;
    this.controls.update(dt);
    this.controls.applyTo(this.camera);
    this.heldView.update(dt);

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
    this.flyBlimp(night);
    this.fillCrowd(crowd, dt);
    this.seriesCrowd(crowd.seated);
    this.playFireworks(crowd.fireworks, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private drawScoreboard() {
    const clock = formatClock(this.state);
    paintRavensScoreboard(
      this.scoreCtx,
      this.scoreCanvas.width,
      this.scoreCanvas.height,
      stadiumGame(this.state) ?? stadiumFinal(this.state),
      clock,
      this.time,
      stadiumClubFor(this.state),
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

    const cycle = this.time % CYCLE;
    const atBat = Math.floor(this.time / CYCLE);
    const play = AT_BATS[((atBat % AT_BATS.length) + AT_BATS.length) % AT_BATS.length];
    const pitch = cycle < PITCH_END;
    const inAir = cycle >= PITCH_END && cycle < CONTACT_AT;
    const swung = play.kind !== "take";
    const contact = play.kind !== "take" && play.kind !== "whiff";
    const after = cycle >= CONTACT_AT;
    const flight = after ? Math.min(1, (cycle - CONTACT_AT) / (play.kind === "homer" ? 2.55 : play.kind === "ground" ? 1.35 : 2.05)) : 0;
    const pitchX = ((Math.floor(this.time / CYCLE) % 7) - 3) * 0.11;

    for (let i = 0; i < 9; i++) {
      const spot = DEFENSE[i];
      let x = spot.x;
      let z = spot.z;
      if (i === 0 && pitch) z += Math.sin(cycle * 8) * 0.12;
      if (i === 1 && (play.kind === "take" || play.kind === "whiff") && after) {
        x += pitchX * 0.6;
        z += 0.18;
      }
      if (contact && after && play.fielder === i) {
        const chase = play.kind === "ground" ? 0.92 : play.kind === "homer" ? 0.28 : 0.78;
        const u = Math.min(1, flight * (play.kind === "ground" ? 1.35 : 1.05));
        x += (play.landX - spot.x) * u * chase;
        z += (play.landZ - spot.z) * u * chase;
      }
      dummy.position.set(x, 0.95, z);
      dummy.rotation.set(0, i === 1 || i === 0 ? 0 : Math.atan2(x, 15.5 - z), 0);
      dummy.updateMatrix();
      this.players.setMatrixAt(i, dummy.matrix);
    }

    const swinging = swung && (inAir || (after && flight < 0.18));
    const swing = swinging ? (play.kind === "homer" ? -0.55 : play.kind === "whiff" ? -0.42 : -0.32) : 0;
    dummy.position.set(BATTER.x + (swinging ? -0.08 : 0), 0.95, BATTER.z);
    dummy.rotation.set(0, Math.PI + swing, 0);
    dummy.updateMatrix();
    this.players.setMatrixAt(9, dummy.matrix);
    this.players.instanceMatrix.needsUpdate = true;

    this.ball.visible = game.playing || game.firstPitch;
    if (!this.ball.visible) return;
    if (pitch) {
      const t = cycle / PITCH_END;
      this.ball.position.set(
        0.18 + t * (PLATE.x + pitchX - 0.18),
        1.55 - t * 0.32 + Math.sin(t * Math.PI) * 0.08,
        8.55 + t * (PLATE.z - 8.55),
      );
    } else if (inAir) {
      const t = (cycle - PITCH_END) / (CONTACT_AT - PITCH_END);
      this.ball.position.set(PLATE.x + pitchX * (1 - t * 0.3), PLATE.y + Math.sin(t * Math.PI) * 0.28, PLATE.z - 0.2 + t * 0.35);
    } else if (!contact) {
      this.ball.position.set(play.landX, 1.02, play.landZ);
    } else {
      this.placeHit(play, flight, pitchX);
    }
  }

  /** World Series sell-out: every seat filled and glow sticks waving. */
  private seriesCrowd(seated: number) {
    const crowd = this.interior.seriesCrowd;
    const on = seated >= 0.95 && stadiumSeriesGame(this.state) !== null;
    crowd.extras.visible = on;
    crowd.sticks.visible = on;
    crowd.bands.visible = on;
    if (!on) return;
    const dummy = this.neonDummy;
    const rest = crowd.neonRest;
    for (let i = 0; i < crowd.neonCount; i++) {
      const phase = this.time * 3.2 + i * 0.7;
      dummy.position.set(
        rest[i * 3] + 0.2,
        rest[i * 3 + 1] + 0.3 + Math.abs(Math.sin(phase * 0.75)) * 0.08,
        rest[i * 3 + 2],
      );
      dummy.rotation.set(0, 0, Math.sin(phase) * 0.55);
      dummy.updateMatrix();
      crowd.sticks.setMatrixAt(i, dummy.matrix);
    }
    crowd.sticks.instanceMatrix.needsUpdate = true;
  }

  /** World Series only: one slow pass beyond the outfield through the middle innings. */
  private flyBlimp(night: boolean) {
    const blimp = this.blimp;
    const series = stadiumSeriesGame(this.state);
    const game = series ? stadiumGame(this.state) : null;
    if (!series || !game?.playing) {
      blimp.group.visible = false;
      return;
    }
    const playMinutes = GAME_END_MINUTE - GAME_START_MINUTE - 8;
    const progress = (this.state.clock.minuteOfDay - GAME_START_MINUTE) / playMinutes;
    const t = (progress - 0.38) / 0.24;
    if (t < 0 || t > 1) {
      blimp.group.visible = false;
      return;
    }
    const banner = `WORLD SERIES · GAME ${series.game}`;
    if (banner !== this.blimpBanner) {
      const club = stadiumClubFor(this.state);
      blimp.setBanner(banner, club.accent);
      this.blimpBanner = banner;
    }
    blimp.setNight(night);
    blimp.group.visible = true;
    blimp.group.position.set(-95 + 190 * t, 36 + Math.sin(this.time * 0.6) * 0.6, -48);
    blimp.group.rotation.set(0, 0, Math.sin(this.time * 0.4) * 0.03);
  }

  private placeHit(play: AtBatPlay, t: number, pitchX: number) {
    const x = PLATE.x + pitchX + (play.landX - PLATE.x - pitchX) * t;
    const z = PLATE.z + (play.landZ - PLATE.z) * t;
    let y = 0.16;
    if (play.kind === "ground") {
      y = 0.16 + Math.abs(Math.sin(t * Math.PI * 3.2)) * play.peak * (1 - t);
    } else if (play.kind === "liner") {
      y = 0.9 + Math.sin(t * Math.PI) * play.peak;
    } else {
      y = 1.05 + Math.sin(Math.min(1, t) * Math.PI) * play.peak;
    }
    this.ball.position.set(x, Math.max(0.14, y), z);
  }

  private fillCrowd(crowd: { seated: number; walking: number }, dt: number) {
    const mesh = this.interior.fans;
    const rest = this.interior.rest;
    const dummy = this.playerDummy;
    const seated = this.interior.seatedCount;
    const walking = this.interior.walkingCount;
    const monsterStart = this.interior.monsterFanStart;
    const game = isGameNight(this.state);
    const seatedShown = Math.round(seated * crowd.seated);
    const walkingShown = Math.round(walking * crowd.walking);
    dummy.rotation.set(0, 0, 0);
    for (let i = 0; i < seated; i++) {
      // Monster deck guests use the same capsules, but only during the game.
      const onMonster = i >= monsterStart;
      const show = i < seatedShown && (!onMonster || game);
      if (show) {
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
    stepFireworks(this.sparkLife, on, this.time, dt, {
      spreadX: 22,
      spreadZ: 6,
      z0: -21,
      height0: 18,
      height1: 26,
    });
    const dummy = this.sparkDummy;
    for (let i = 0; i < this.sparkLife.length; i++) {
      const spark = this.sparkLife[i];
      const fade = sparkFade(spark);
      if (!on || fade <= 0) {
        dummy.position.set(0, -30, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
      } else {
        dummy.position.set(spark.x, spark.y, spark.z);
        dummy.scale.setScalar(0.7 + fade * 1.4);
      }
      dummy.updateMatrix();
      this.sparks.setMatrixAt(i, dummy.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.blimp.dispose();
    this.heldView.dispose();
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
