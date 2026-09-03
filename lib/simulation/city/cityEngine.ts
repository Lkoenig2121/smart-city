import { createBuilding, footprintFor } from "@/lib/simulation/buildings/buildings";
import type { BuildingKind, CityState, Tool } from "@/lib/city/types";
import { createInitialCity, getBuildingAt, recountPopulation } from "./cityState";
import { tickCity } from "./cityTick";

export class CityEngine {
  state: CityState;
  tool: Tool = "inspect";
  selectedId: string | null = null;
  hover: { x: number; y: number } | null = null;
  private seed: number;

  constructor(seed = 20260903) {
    this.seed = seed;
    this.state = createInitialCity(seed);
  }

  tick(dt: number) {
    tickCity(this.state, dt);
  }

  selectAt(x: number, y: number) {
    const building = getBuildingAt(this.state, x, y);
    this.selectedId = building?.id ?? null;
    return building ?? null;
  }

  setTool(tool: Tool) {
    this.tool = tool;
  }

  applyTool(x: number, y: number) {
    const tile = this.state.tiles[y]?.[x];
    if (!tile) return false;

    if (this.tool === "inspect") {
      this.selectAt(x, y);
      return true;
    }

    if (this.tool === "bulldoze") {
      if (tile.road) {
        tile.road = null;
        this.reconnectRoads();
        return true;
      }
      if (tile.buildingId) {
        this.removeBuilding(tile.buildingId);
        return true;
      }
      if (tile.tree) {
        tile.tree = null;
        return true;
      }
      return false;
    }

    if (this.tool === "road") {
      if (tile.terrain === "water" || tile.buildingId) return false;
      tile.road = { north: false, east: false, south: false, west: false };
      tile.tree = null;
      this.reconnectRoads();
      return true;
    }

    if (this.tool === "tree") {
      if (tile.road || tile.buildingId || tile.terrain === "water") return false;
      tile.tree = { variant: Math.floor(Math.random() * 6), scale: 0.9 + Math.random() * 0.3 };
      return true;
    }

    if (this.tool === "park") {
      if (tile.road || tile.buildingId || tile.terrain === "water") return false;
      tile.terrain = "park";
      if (!tile.tree) tile.tree = { variant: 2, scale: 1 };
      return true;
    }

    const kind = toolToKind(this.tool);
    if (!kind) return false;
    return this.placeBuilding(kind, x, y);
  }

  placeBuilding(kind: BuildingKind, x: number, y: number) {
    const fp = footprintFor(kind);
    for (let dy = 0; dy < fp.d; dy++) {
      for (let dx = 0; dx < fp.w; dx++) {
        const tile = this.state.tiles[y + dy]?.[x + dx];
        if (!tile || tile.road || tile.buildingId || tile.terrain === "water") return false;
      }
    }
    const id = `b${this.state.buildings.size + 40}-${x}-${y}`;
    const building = createBuilding(id, kind, x, y, Math.random, this.state.buildings.size);
    this.state.buildings.set(id, building);
    for (let dy = 0; dy < building.depth; dy++) {
      for (let dx = 0; dx < building.width; dx++) {
        const tile = this.state.tiles[y + dy][x + dx];
        tile.buildingId = id;
        tile.tree = null;
      }
    }
    recountPopulation(this.state);
    this.selectedId = id;
    return true;
  }

  removeBuilding(id: string) {
    const building = this.state.buildings.get(id);
    if (!building) return;
    for (let dy = 0; dy < building.depth; dy++) {
      for (let dx = 0; dx < building.width; dx++) {
        const tile = this.state.tiles[building.origin.y + dy]?.[building.origin.x + dx];
        if (tile?.buildingId === id) tile.buildingId = null;
      }
    }
    this.state.buildings.delete(id);
    if (this.selectedId === id) this.selectedId = null;
    recountPopulation(this.state);
  }

  reconnectRoads() {
    const { tiles, size } = this.state;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tile = tiles[y][x];
        if (!tile.road) continue;
        tile.road = {
          north: Boolean(tiles[y - 1]?.[x]?.road),
          east: Boolean(tiles[y][x + 1]?.road),
          south: Boolean(tiles[y + 1]?.[x]?.road),
          west: Boolean(tiles[y][x - 1]?.road),
        };
      }
    }
  }
}

function toolToKind(tool: Tool): BuildingKind | null {
  switch (tool) {
    case "house":
      return "house";
    case "apartment":
      return "apartment";
    case "shop":
      return "shop";
    case "office":
      return "office";
    default:
      return null;
  }
}
