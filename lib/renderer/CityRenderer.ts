import { TILE_H, diamondPoints } from "@/lib/city/iso";
import type { CityState } from "@/lib/city/types";
import type { CityEngine } from "@/lib/simulation/city/cityEngine";
import { drawBuilding } from "./drawBuildings";
import { drawCitizen } from "./drawCitizens";
import { drawFountain, drawTree } from "./drawVegetation";
import { drawRoadTile } from "./drawRoads";
import { drawTerrainTile } from "./drawTerrain";
import { drawVehicle } from "./drawVehicles";
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
        drawTerrainTile(ctx, x, y, tile.terrain, light, this.time);
        if (tile.road) drawRoadTile(ctx, x, y, tile.road, light);
      }
    }

    if (engine.hover && inCity(state, engine.hover.x, engine.hover.y)) {
      drawDiamond(ctx, engine.hover.x, engine.hover.y, alpha("#f4d03f", 0.16), alpha("#f4d03f", 0.7));
    }

    const drawn = new Set<string>();
    for (let sum = 0; sum <= size * 2; sum++) {
      for (let x = 0; x < size; x++) {
        const y = sum - x;
        if (y < 0 || y >= size) continue;
        if (!tileVisible(x, y, this.camera, this.width, this.height, 220)) continue;
        const tile = state.tiles[y][x];
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
      }
    }

    for (const vehicle of state.vehicles) {
      if (!tileVisible(vehicle.x, vehicle.y, this.camera, this.width, this.height)) continue;
      drawVehicle(ctx, vehicle, light);
    }
    for (const citizen of state.citizens) {
      if (!tileVisible(citizen.x, citizen.y, this.camera, this.width, this.height)) continue;
      drawCitizen(ctx, citizen, light);
    }

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

void TILE_H;
void diamondPoints;
