import { TILE_H, TILE_W, worldBounds } from "@/lib/city/iso";
import type { Building, CityState } from "@/lib/city/types";
import type { CityEngine } from "@/lib/simulation/city/cityEngine";
import { citizenIsOutdoors } from "@/lib/simulation/citizens/citizenBehavior";
import { drawBridge } from "./drawBridges";
import { drawBuilding } from "./drawBuildings";
import { drawCitizen } from "./drawCitizens";
import { drawFountain, drawTree } from "./drawVegetation";
import { drawRoadTile } from "./drawRoads";
import { drawTerrainTile } from "./drawTerrain";
import { drawWaterfrontDecor } from "./drawWaterfront";
import { drawVehicle } from "./drawVehicles";
import { drawEventMarkers, drawJobMarkers } from "./drawEvents";
import { drawParkedCars, drawTrafficOverlay } from "./drawTraffic";
import { drawWeatherOverlay } from "./drawWeather";
import { CityCamera, tileVisible, visibleTileRange } from "./camera";
import { alpha, lightingFor, lit, mix, type Lighting } from "./palette";
import { drawDiamond, isoBoxCorners } from "./drawIso";
import { buildingDrawHeight, isHiddenBehindBuilding, mastHeight } from "./pickBuilding";
import {
  createFireworkSparks,
  drawStadiumFireworks,
  stadiumFireworksOn,
  stepFireworks,
  type FireworkSpark,
} from "@/lib/city/fireworks";
import { findStadium } from "@/lib/city/stadium";

interface GroundCache {
  canvas: HTMLCanvasElement;
  key: string;
  minX: number;
  minY: number;
  worldW: number;
  worldH: number;
}

interface BuildingSprite {
  canvas: HTMLCanvasElement;
  ox: number;
  oy: number;
  key: string;
}

const BAKE_PER_FRAME = 10;

export class CityRenderer {
  readonly camera = new CityCamera();
  width = 1;
  height = 1;
  time = 0;
  dpr = 1;

  private ctx: CanvasRenderingContext2D | null = null;
  private ground: GroundCache | null = null;
  private sprites = new Map<string, BuildingSprite>();
  private bakedThisFrame = 0;
  private skyKey = "";
  private sky: CanvasGradient | null = null;
  private vigKey = "";
  private vig: CanvasGradient | null = null;
  private vehiclesByRow = new Map<number, CityState["vehicles"]>();
  private citizensByRow = new Map<number, CityState["citizens"]>();
  private fireworks: FireworkSpark[] = createFireworkSparks(160);

  resize(width: number, height: number, dpr = 1) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.sky = null;
    this.vig = null;
  }

  attach(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(engine: CityEngine, dt: number) {
    this.time += dt;
    this.camera.update(dt);
    const state = engine.state;
    let light = lightingFor(state);
    if (state.id === "dustfall") {
      light = {
        ...light,
        skyTop: mix(light.skyTop, "#e8a858", 0.42),
        skyBottom: mix(light.skyBottom, "#f5d6a0", 0.48),
        tint: mix(light.tint ?? "#ffffff", "#f0d9a8", 0.25),
        tintAmount: Math.max(light.tintAmount, 0.1),
        ambient: light.ambient * 1.05,
        sun: light.sun * 1.08,
      };
    }
    const ctx = this.ctx;
    if (!ctx) return;

    this.bakedThisFrame = 0;
    const lightKey = cacheLightKey(light, state.weather?.kind ?? "clear");
    this.ensureGround(state, light, lightKey, engine.mapRev);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.fillSky(ctx, light);
    this.drawDistantHills(ctx, light.skyBottom);

    this.camera.apply(ctx, this.dpr);
    if (this.ground) {
      ctx.drawImage(
        this.ground.canvas,
        0,
        0,
        this.ground.canvas.width,
        this.ground.canvas.height,
        this.ground.minX,
        this.ground.minY,
        this.ground.worldW,
        this.ground.worldH,
      );
    }

    if (engine.hover && inCity(state, engine.hover.x, engine.hover.y)) {
      drawDiamond(ctx, engine.hover.x, engine.hover.y, alpha("#f4d03f", 0.16), alpha("#f4d03f", 0.7));
    }

    const view = visibleTileRange(this.camera, this.width, this.height, state.size);
    const showPeople = this.camera.zoom >= 0.62;
    this.bucketMovers(state, showPeople);

    const drawn = new Set<string>();
    const sum0 = view.x0 + view.y0;
    const sum1 = view.x1 + view.y1;
    for (let sum = sum0; sum <= sum1; sum++) {
      for (let x = view.x0; x <= view.x1; x++) {
        const y = sum - x;
        if (y < view.y0 || y > view.y1) continue;
        if (!tileVisible(x, y, this.camera, this.width, this.height, 800)) continue;
        const tile = state.tiles[y][x];
        if (tile.bridge) {
          drawBridge(ctx, x, y, tile.bridge, light, this.time);
        }
        if (tile.buildingId && !drawn.has(tile.buildingId)) {
          const building = state.buildings.get(tile.buildingId);
          const paint = building ? buildingPaintCell(building, view) : null;
          if (building && paint && paint.x === x && paint.y === y) {
            drawn.add(building.id);
            this.drawCachedBuilding(ctx, building, light, lightKey, engine.selectedId === building.id);
          }
        }
        if (tile.tree && !tile.buildingId) {
          drawTree(ctx, x, y, tile.tree, light);
        }
        if (x === 20 && y === 26 && tile.terrain === "park") {
          drawFountain(ctx, x, y, light, this.time);
        }
        drawWaterfrontDecor(ctx, x, y, tile, light, this.time, state.id);
      }

      const rowVehicles = this.vehiclesByRow.get(sum);
      if (rowVehicles) {
        for (const v of rowVehicles) {
          if (isHiddenBehindBuilding(state, v.x, v.y)) continue;
          drawVehicle(ctx, v, light, deckLift(state, v.x, v.y), state);
        }
      }
      const rowCitizens = this.citizensByRow.get(sum);
      if (rowCitizens) {
        for (const c of rowCitizens) {
          if (isHiddenBehindBuilding(state, c.x, c.y)) continue;
          drawCitizen(ctx, c, light, deckLift(state, c.x, c.y), state);
        }
      }
    }

    drawParkedCars(ctx, state, light);
    drawTrafficOverlay(ctx, state, light);
    drawEventMarkers(ctx, state, this.time);
    drawJobMarkers(ctx, state, this.time);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (light.phase === "night") {
      ctx.fillStyle = "rgba(8, 12, 28, 0.08)";
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (light.phase === "dusk") {
      ctx.fillStyle = "rgba(80, 30, 10, 0.08)";
      ctx.fillRect(0, 0, this.width, this.height);
    }

    this.fillVignette(ctx, light);
    drawWeatherOverlay(ctx, state, this.width, this.height, this.time);
    this.camera.apply(ctx, this.dpr);
    this.drawFireworks(ctx, state, dt);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private drawFireworks(ctx: CanvasRenderingContext2D, state: CityState, dt: number) {
    const stadium = findStadium(state);
    const on = stadiumFireworksOn(state);
    stepFireworks(this.fireworks, on, this.time, dt, {
      spreadX: 18,
      spreadZ: 14,
      z0: 0,
      height0: 16,
      height1: 28,
      bursts: 2,
      sparksPerBurst: 18,
      rate: 2.3,
    });
    if (!stadium || !on) return;
    drawStadiumFireworks(ctx, stadium, this.fireworks);
  }

  private bucketMovers(state: CityState, showPeople: boolean) {
    this.vehiclesByRow.clear();
    this.citizensByRow.clear();
    for (const v of state.vehicles) {
      if (!tileVisible(v.x, v.y, this.camera, this.width, this.height)) continue;
      const row = Math.floor(v.x) + Math.floor(v.y);
      let bucket = this.vehiclesByRow.get(row);
      if (!bucket) {
        bucket = [];
        this.vehiclesByRow.set(row, bucket);
      }
      bucket.push(v);
    }
    if (!showPeople) return;
    for (const c of state.citizens) {
      if (!citizenIsOutdoors(c)) continue;
      if (!tileVisible(c.x, c.y, this.camera, this.width, this.height)) continue;
      const row = Math.floor(c.x) + Math.floor(c.y);
      let bucket = this.citizensByRow.get(row);
      if (!bucket) {
        bucket = [];
        this.citizensByRow.set(row, bucket);
      }
      bucket.push(c);
    }
  }

  private drawCachedBuilding(
    ctx: CanvasRenderingContext2D,
    building: Building,
    light: Lighting,
    lightKey: string,
    selected: boolean,
  ) {
    const sprite = this.spriteFor(building, light, lightKey);
    if (sprite) {
      ctx.drawImage(sprite.canvas, sprite.ox, sprite.oy);
    } else {
      drawBuilding(ctx, building, light, false);
    }
    if (selected) {
      const box = isoBoxCorners(building.origin.x, building.origin.y, building.width, building.depth, 0, 4);
      ctx.save();
      ctx.strokeStyle = alpha("#f4d03f", 0.95);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(box.T.x, box.T.y - 8);
      ctx.lineTo(box.R.x + 8, box.R.y);
      ctx.lineTo(box.B.x, box.B.y + 8);
      ctx.lineTo(box.L.x - 8, box.L.y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  private spriteFor(building: Building, light: Lighting, lightKey: string) {
    const key = `${lightKey}|${Math.ceil((building.constructionLeft ?? 0) / 2)}|${building.width}x${building.depth}|${building.floors}|${building.stats.extra?.venue ?? building.kind}`;
    const hit = this.sprites.get(building.id);
    if (hit && hit.key === key) return hit;
    if (this.bakedThisFrame >= BAKE_PER_FRAME) return null;

    const box = spriteBounds(building);
    const w = Math.max(2, Math.ceil(box.maxX - box.minX));
    const h = Math.max(2, Math.ceil(box.maxY - box.minY));
    const canvas = hit?.canvas && hit.canvas.width === w && hit.canvas.height === h
      ? hit.canvas
      : document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const spriteCtx = canvas.getContext("2d");
    if (!spriteCtx) return null;
    spriteCtx.clearRect(0, 0, w, h);
    spriteCtx.setTransform(1, 0, 0, 1, -box.minX, -box.minY);
    drawBuilding(spriteCtx, building, light, false);
    const sprite: BuildingSprite = { canvas, ox: box.minX, oy: box.minY, key };
    this.sprites.set(building.id, sprite);
    this.bakedThisFrame += 1;
    return sprite;
  }

  private ensureGround(state: CityState, light: Lighting, lightKey: string, mapRev: number) {
    const key = `${lightKey}|${mapRev}|${state.size}`;
    if (this.ground?.key === key) return;

    const bounds = worldBounds(state.size);
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;
    const canvas = this.ground?.canvas ?? document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(worldW));
    canvas.height = Math.max(1, Math.ceil(worldH));
    const gctx = canvas.getContext("2d");
    if (!gctx) return;
    gctx.setTransform(1, 0, 0, 1, -bounds.minX, -bounds.minY);
    gctx.clearRect(bounds.minX, bounds.minY, worldW, worldH);

    const weather = state.weather?.kind ?? "clear";
    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        const tile = state.tiles[y][x];
        drawTerrainTile(gctx, x, y, tile.terrain, light, 0, tile.graffiti, weather, true);
        if (tile.road && !tile.bridge) drawRoadTile(gctx, x, y, tile.road, light);
      }
    }

    this.ground = {
      canvas,
      key,
      minX: bounds.minX,
      minY: bounds.minY,
      worldW,
      worldH,
    };

    for (const id of [...this.sprites.keys()]) {
      if (!state.buildings.has(id)) this.sprites.delete(id);
    }
  }

  private fillSky(ctx: CanvasRenderingContext2D, light: Lighting) {
    const key = `${light.skyTop}|${light.skyBottom}|${this.width}|${this.height}`;
    if (!this.sky || this.skyKey !== key) {
      const sky = ctx.createLinearGradient(0, 0, 0, this.height);
      sky.addColorStop(0, light.skyTop);
      sky.addColorStop(1, light.skyBottom);
      this.sky = sky;
      this.skyKey = key;
    }
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private fillVignette(ctx: CanvasRenderingContext2D, light: Lighting) {
    const key = `${light.phase}|${this.width}|${this.height}`;
    if (!this.vig || this.vigKey !== key) {
      const vig = ctx.createRadialGradient(
        this.width * 0.5,
        this.height * 0.45,
        this.width * 0.2,
        this.width * 0.5,
        this.height * 0.5,
        this.width * 0.78,
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, light.phase === "night" ? "rgba(0,0,0,0.2)" : "rgba(10,20,16,0.16)");
      this.vig = vig;
      this.vigKey = key;
    }
    ctx.fillStyle = this.vig;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawDistantHills(ctx: CanvasRenderingContext2D, color: string) {
    ctx.fillStyle = lit(color, lightingForDummy(), "ground");
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.62);
    ctx.quadraticCurveTo(this.width * 0.25, this.height * 0.52, this.width * 0.5, this.height * 0.6);
    ctx.quadraticCurveTo(this.width * 0.75, this.height * 0.68, this.width, this.height * 0.56);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();
  }
}

function cacheLightKey(light: Lighting, weather: string) {
  return [
    light.phase,
    weather,
    Math.round(light.ambient * 8),
    Math.round(light.windowLit * 5),
    Math.round(light.sun * 8),
  ].join("|");
}

/** Last footprint tile in painter order that is still on screen. */
function buildingPaintCell(
  building: Building,
  view: { x0: number; y0: number; x1: number; y1: number },
) {
  const x0 = Math.max(building.origin.x, view.x0);
  const y0 = Math.max(building.origin.y, view.y0);
  const x1 = Math.min(building.origin.x + building.width - 1, view.x1);
  const y1 = Math.min(building.origin.y + building.depth - 1, view.y1);
  if (x0 > x1 || y0 > y1) return null;
  return { x: x1, y: y1 };
}

function spriteBounds(building: Building) {
  const h = buildingDrawHeight(building) + mastHeight(building);
  const { x, y, width, depth } = {
    x: building.origin.x,
    y: building.origin.y,
    width: building.width,
    depth: building.depth,
  };
  const top = { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) };
  const right = { x: (x + width - 1 - y) * (TILE_W / 2), y: (x + width - 1 + y) * (TILE_H / 2) };
  const left = { x: (x - (y + depth - 1)) * (TILE_W / 2), y: (x + y + depth - 1) * (TILE_H / 2) };
  const bottom = {
    x: (x + width - 1 - (y + depth - 1)) * (TILE_W / 2),
    y: (x + width - 1 + y + depth - 1) * (TILE_H / 2),
  };
  return {
    minX: Math.floor(left.x - TILE_W / 2 - 24),
    maxX: Math.ceil(right.x + TILE_W / 2 + 24),
    minY: Math.floor(top.y - h - 88),
    maxY: Math.ceil(bottom.y + TILE_H + 28),
  };
}

function lightingForDummy() {
  return {
    phase: "day" as const,
    ambient: 1,
    sun: 1,
    skyTop: "#79b7ea",
    skyBottom: "#d7edfb",
    tint: "#ffffff",
    tintAmount: 0,
    windowLit: 0,
    waterSparkle: 1,
  };
}

function inCity(state: CityState, x: number, y: number) {
  return x >= 0 && y >= 0 && x < state.size && y < state.size;
}

/**
 * Height to raise anything travelling over a bridge, interpolated so vehicles
 * ramp on and off the deck instead of snapping up at the bank.
 */
function deckLift(state: CityState, x: number, y: number) {
  const gx = Math.floor(x);
  const gy = Math.floor(y);
  const here = state.tiles[gy]?.[gx];
  if (!here) return 0;
  if (here.bridge) return here.bridge.deck;

  const neighbours = [
    state.tiles[gy]?.[gx - 1],
    state.tiles[gy]?.[gx + 1],
    state.tiles[gy - 1]?.[gx],
    state.tiles[gy + 1]?.[gx],
  ];
  const approach = neighbours.find((tile) => tile?.bridge);
  if (!approach?.bridge) return 0;

  const dx = Math.abs(x - approach.x);
  const dy = Math.abs(y - approach.y);
  const distance = Math.min(1, Math.max(dx, dy));
  return approach.bridge.deck * (1 - distance);
}
