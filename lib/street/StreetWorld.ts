import * as THREE from "three";
import type { Building, CityState } from "@/lib/city/types";
import { findStadium, stadiumIsOpen } from "@/lib/city/stadium";
import { lodgingBuildings } from "@/lib/city/lodging";
import { lightingFor, type Lighting } from "@/lib/renderer/palette";
import { AgentLayer } from "./agents";
import { buildCity, TILE, type CityMeshes } from "./buildCity";
import { StreetControls, type MoveMode } from "./controls";
import { skyTexture } from "./textures";

/** Field of view at rest, and how far it narrows mid-hop. */
const BASE_FOV = 72;
const HOP_ZOOM = 7;

/** How many lamps get a real point light at once. */
const LIVE_LAMPS = 16;

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

    this.city = buildCity(state);
    this.scene.add(this.city.group);

    this.controls = new StreetControls(state, this.city.blockers);
    this.agents = new AgentLayer(state, (x, z) => this.controls.groundAt(x, z));
    this.scene.add(this.agents.group);

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
    const range = TILE * 3.5;
    if (this.distanceToBuilding(stadium, this.controls.position.x, this.controls.position.z) < range) {
      return true;
    }
    const hop = this.controls.hopEnds;
    if (!hop) return false;
    return (
      this.distanceToBuilding(stadium, hop.from.x, hop.from.z) < range ||
      this.distanceToBuilding(stadium, hop.to.x, hop.to.z) < range
    );
  }

  nearLodgingEntrance() {
    const range = TILE * 3.5;
    let best: Building | null = null;
    let bestDist = range;
    for (const building of lodgingBuildings(this.state)) {
      const here = this.distanceToBuilding(building, this.controls.position.x, this.controls.position.z);
      const hop = this.controls.hopEnds;
      const hopDist = hop
        ? Math.min(
            this.distanceToBuilding(building, hop.from.x, hop.from.z),
            this.distanceToBuilding(building, hop.to.x, hop.to.z),
          )
        : Infinity;
      const dist = Math.min(here, hopDist);
      if (dist < bestDist) {
        bestDist = dist;
        best = building;
      }
    }
    return best;
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
    this.sun.intensity = night ? 0.55 : light.sun * 2.6;
    this.sun.color.set(
      light.phase === "dawn" || light.phase === "dusk" ? "#ffb27a" : night ? "#b7cce8" : "#fff6e8",
    );

    this.hemi.intensity = night ? 1.05 : light.ambient * 1.05;
    this.hemi.color.set(night ? "#8aa4c8" : light.skyTop);
    this.hemi.groundColor.set(night ? "#2c3a4c" : "#4a5340");
    this.renderer.toneMappingExposure = night ? 1.32 : 1.05;

    // Facade windows glow with the same curve the isometric view uses.
    for (const material of this.city.emissiveMaterials) {
      material.emissiveIntensity = light.windowLit * (night ? 2.1 : 1.5);
    }
    if (this.city.lampGlow) {
      this.city.lampGlow.emissiveIntensity = lampsOn ? 3.4 : 0.04;
    }

    const here = this.controls.position;
    this.streetFill.position.set(here.x, here.y + 2.2, here.z);
    this.streetFill.intensity = night ? 14 : lampsOn ? 6 : 0;

    // Sky and fog follow the horizon colour.
    const key = `${light.skyTop}|${light.skyBottom}`;
    if (key !== this.skyKey) {
      this.sky?.dispose();
      this.sky = skyTexture(light.skyTop, light.skyBottom);
      this.scene.background = this.sky;
      this.skyKey = key;
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.set(night ? "#243656" : light.skyBottom);
      this.scene.fog.near = night ? 90 : 70;
      this.scene.fog.far = night ? 520 : 640;
    }

    this.updateLamps(lampsOn);
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

  setMoveMode(mode: MoveMode) {
    this.controls.setMode(mode);
  }

  render(dt: number) {
    this.time += dt;
    this.controls.update(dt);
    this.controls.applyTo(this.camera);

    // Narrow the lens slightly as a hop travels, the way Street View pushes in
    // between panoramas. Skipped in free-walk mode, where it would feel odd.
    const zoom = this.controls.mode === "hop" ? this.controls.hopEase * HOP_ZOOM : 0;
    const fov = BASE_FOV - zoom;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    const light = lightingFor(this.state);
    this.applyLighting(light);
    this.agents.update(dt);

    // Drift the river surface so it never looks like a frozen sheet.
    const water = this.city.water;
    if (water) {
      const material = water.material as THREE.MeshStandardMaterial;
      if (material.normalMap) {
        material.normalMap.offset.set(this.time * 0.014, this.time * 0.03);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  /** Player position in tile coordinates, for the minimap. */
  get tilePosition() {
    return {
      x: this.controls.position.x / TILE,
      y: this.controls.position.z / TILE,
      yaw: this.controls.yaw,
    };
  }

  dispose() {
    this.agents.dispose();
    this.city.dispose();
    this.sky?.dispose();
    this.renderer.dispose();
  }
}
