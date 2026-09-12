import { TILE_H, diamondPoints } from "@/lib/city/iso";
import type { CityState } from "@/lib/city/types";
import type { CityEngine } from "@/lib/simulation/city/cityEngine";
import { drawBridge } from "./drawBridges";
import { drawBuilding } from "./drawBuildings";
import { drawCitizen } from "./drawCitizens";
import { drawFountain, drawTree } from "./drawVegetation";
import { drawRoadTile } from "./drawRoads";
import { drawTerrainTile } from "./drawTerrain";
import { drawWaterfrontDecor } from "./drawWaterfront";
import { drawVehicle } from "./drawVehicles";
import { drawEventMarkers } from "./drawEvents";
import { drawWeatherOverlay } from "./drawWeather";
import { CityCamera, tileVisible } from "./camera";
import { alpha, lightingFor, lit } from "./palette";
import { drawDiamond } from "./drawIso";

export class CityRenderer {
  readonly camera = new CityCamera();
  width = 1;
  height = 1;
  time = 0;
  dpr = 1;

  resize(width: number, height: number, dpr = 1) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
  }

  render(engine: CityEngine, dt: number) {
    this.time += dt;
    this.camera.update(dt);
    const state = engine.state;
    const light = lightingFor(state);
    const canvas = this.ctx;
    if (!canvas) return;
    const ctx = canvas;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, light.skyTop);
    sky.addColorStop(1, light.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawDistantHills(ctx, light.skyBottom);

    this.camera.apply(ctx, this.dpr);

    const size = state.size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!tileVisible(x, y, this.camera, this.width, this.height)) continue;
        const tile = state.tiles[y][x];
        drawTerrainTile(ctx, x, y, tile.terrain, light, this.time, tile.graffiti, state.weather?.kind);
        // Bridge decks are elevated, so they draw with the structures below.
        if (tile.road && !tile.bridge) drawRoadTile(ctx, x, y, tile.road, light);
      }
    }

    if (engine.hover && inCity(state, engine.hover.x, engine.hover.y)) {
      drawDiamond(ctx, engine.hover.x, engine.hover.y, alpha("#f4d03f", 0.16), alpha("#f4d03f", 0.7));
    }

    // Bucket vehicles and citizens by their depth row (x+y) for correct
    // draw ordering — things further north/west draw first, so buildings
    // in front correctly occlude cars behind them.
    const vehiclesByRow = new Map<number, typeof state.vehicles>();
    for (const v of state.vehicles) {
      if (!tileVisible(v.x, v.y, this.camera, this.width, this.height)) continue;
      const row = Math.floor(v.x) + Math.floor(v.y);
      let bucket = vehiclesByRow.get(row);
      if (!bucket) { bucket = []; vehiclesByRow.set(row, bucket); }
      bucket.push(v);
    }
    const citizensByRow = new Map<number, typeof state.citizens>();
    for (const c of state.citizens) {
      if (!tileVisible(c.x, c.y, this.camera, this.width, this.height)) continue;
      const row = Math.floor(c.x) + Math.floor(c.y);
      let bucket = citizensByRow.get(row);
      if (!bucket) { bucket = []; citizensByRow.set(row, bucket); }
      bucket.push(c);
    }

    const drawn = new Set<string>();
    for (let sum = 0; sum <= size * 2; sum++) {
      // Draw buildings, bridges and trees at this depth row
      for (let x = 0; x < size; x++) {
        const y = sum - x;
        if (y < 0 || y >= size) continue;
        if (!tileVisible(x, y, this.camera, this.width, this.height, 800)) continue;
        const tile = state.tiles[y][x];
        if (tile.bridge) {
          drawBridge(ctx, x, y, tile.bridge, light, this.time);
        }
        if (tile.buildingId && !drawn.has(tile.buildingId)) {
          const building = state.buildings.get(tile.buildingId);
          if (building && building.origin.x === x && building.origin.y === y) {
            drawn.add(building.id);
            drawBuilding(ctx, building, light, engine.selectedId === building.id);
          }
        }
        if (tile.tree && !tile.buildingId) {
          drawTree(ctx, x, y, tile.tree, light);
        }
        if (x === 20 && y === 26 && tile.terrain === "park") {
          drawFountain(ctx, x, y, light, this.time);
        }
        drawWaterfrontDecor(ctx, x, y, tile, light, this.time);
      }

      // Draw vehicles and citizens at this depth row (after buildings at
      // the same row, so they appear on the road surface; but before
      // buildings at deeper rows, so they go behind them).
      const rowVehicles = vehiclesByRow.get(sum);
      if (rowVehicles) {
        for (const v of rowVehicles) {
          drawVehicle(ctx, v, light, deckLift(state, v.x, v.y), state);
        }
      }
      const rowCitizens = citizensByRow.get(sum);
      if (rowCitizens) {
        for (const c of rowCitizens) {
          drawCitizen(ctx, c, light, deckLift(state, c.x, c.y), state);
        }
      }
    }

    drawEventMarkers(ctx, state, this.time);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (light.phase === "night") {
      ctx.fillStyle = "rgba(8, 12, 28, 0.08)";
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (light.phase === "dusk") {
      ctx.fillStyle = "rgba(80, 30, 10, 0.08)";
      ctx.fillRect(0, 0, this.width, this.height);
    }

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
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, this.width, this.height);
    drawWeatherOverlay(ctx, state, this.width, this.height, this.time);
  }

  private ctx: CanvasRenderingContext2D | null = null;

  attach(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
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

  // Blend across the approach tile based on how close we are to the deck.
  const dx = Math.abs(x - approach.x);
  const dy = Math.abs(y - approach.y);
  const distance = Math.min(1, Math.max(dx, dy));
  return approach.bridge.deck * (1 - distance);
}

void TILE_H;
void diamondPoints;
