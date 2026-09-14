import { BRIDGE_DECK } from "@/lib/city/generateCity";
import { createBuilding, footprintFor } from "@/lib/simulation/buildings/buildings";
import {
  STADIUM_BUILD_SECONDS,
  STADIUM_COST,
  stadiumPlacementError,
} from "@/lib/city/stadium";
import type { Building, BuildingKind, CityState, Tool } from "@/lib/city/types";
import { pickBuildingAt } from "@/lib/renderer/pickBuilding";
import {
  HOTEL_BUILD_SECONDS,
  HOTEL_COST,
  HOTEL_MAX_FLOORS,
  HOTEL_STACK_COST,
  HOTEL_STACK_FLOORS,
  lodgingUse,
  markLodging,
  nextHotelName,
} from "@/lib/city/lodging";
import { announceConstruction } from "@/lib/simulation/events/cityEvents";
import { createInitialCity, getBuildingAt, recountPopulation } from "./cityState";
import { tickCity } from "./cityTick";

export class CityEngine {
  state: CityState;
  tool: Tool = "inspect";
  selectedId: string | null = null;
  hover: { x: number; y: number } | null = null;
  hoverBuildingId: string | null = null;
  /** Last reason a tool click did nothing, shown in the HUD. */
  placementHint = "";
  /** Bumps when tiles or buildings change so the iso renderer can recache. */
  mapRev = 0;
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

  /** Inspect the building volume under a world-space click, not just its footprint. */
  inspectWorld(worldX: number, worldY: number) {
    const building = pickBuildingAt(this.state, worldX, worldY);
    this.selectedId = building?.id ?? null;
    return building ?? null;
  }

  setTool(tool: Tool) {
    this.tool = tool;
  }

  applyTool(x: number, y: number) {
    this.placementHint = "";
    const tile = this.state.tiles[y]?.[x];
    if (!tile) return false;

    if (this.tool === "inspect") {
      this.selectAt(x, y);
      return true;
    }

    if (this.tool === "bulldoze") {
      if (tile.road) {
        tile.road = null;
        tile.bridge = null;
        this.reconnectRoads();
        this.mapRev += 1;
        return true;
      }
      if (tile.buildingId) {
        this.removeBuilding(tile.buildingId);
        return true;
      }
      if (tile.tree) {
        tile.tree = null;
        this.mapRev += 1;
        return true;
      }
      return false;
    }

    if (this.tool === "road") {
      if (tile.buildingId) return false;
      tile.road = { north: false, east: false, south: false, west: false };
      tile.tree = null;
      // Roads laid over water become a bridge span.
      if (tile.terrain === "water") {
        tile.bridge = {
          axis: this.spanAxis(x, y),
          deck: BRIDGE_DECK,
          pier: (x + y) % 2 === 0,
          pylon: false,
          abutment: null,
          graffiti:
            Math.random() < 0.6
              ? { variant: Math.floor(Math.random() * 6), hue: Math.floor(Math.random() * 360) }
              : null,
        };
      }
      this.reconnectRoads();
      this.mapRev += 1;
      return true;
    }

    if (this.tool === "tree") {
      if (tile.road || tile.buildingId || tile.terrain === "water") return false;
      tile.tree = { variant: Math.floor(Math.random() * 6), scale: 0.9 + Math.random() * 0.3 };
      this.mapRev += 1;
      return true;
    }

    if (this.tool === "park") {
      if (tile.road || tile.buildingId || tile.terrain === "water") return false;
      tile.terrain = "park";
      if (!tile.tree) tile.tree = { variant: 2, scale: 1 };
      this.mapRev += 1;
      return true;
    }

    if (this.tool === "parking") {
      if (tile.road || tile.buildingId || tile.terrain === "water") return false;
      tile.terrain = "lot";
      tile.tree = null;
      this.mapRev += 1;
      return true;
    }

    if (this.tool === "sand") {
      if (tile.road || tile.buildingId || tile.terrain === "water") return false;
      tile.terrain = "sand";
      tile.tree = null;
      this.mapRev += 1;
      return true;
    }

    if (this.tool === "hotel") return this.placeHotel(x, y);

    const kind = toolToKind(this.tool);
    if (!kind) return false;
    if (kind === "baseball_stadium") {
      const error = stadiumPlacementError(this.state, x, y);
      if (error) {
        this.placementHint = error;
        return false;
      }
    }
    return this.placeBuilding(kind, x, y);
  }

  placeHotel(x: number, y: number) {
    const existing = getBuildingAt(this.state, x, y);
    if (existing && lodgingUse(existing) === "hotel") return this.raiseHotel(existing);

    if (this.state.budget.treasury < HOTEL_COST) {
      this.placementHint = `Costs $${(HOTEL_COST / 1000).toFixed(0)}K — treasury is short`;
      return false;
    }
    const placed = this.placeBuilding("skyscraper", x, y, false);
    if (!placed) {
      this.placementHint = "Needs a clear 2×2 lot";
      return false;
    }
    const building = this.selectedId ? this.state.buildings.get(this.selectedId) : null;
    if (!building) return false;
    markLodging(building, "hotel", nextHotelName(this.state));
    building.floors = 14;
    building.stats.residents = 0;
    building.stats.capacity = 0;
    building.stats.jobs = 110;
    building.stats.employees = 86;
    building.stats.revenue = 24000;
    building.stats.propertyValue = 18_500_000;
    building.constructionLeft = HOTEL_BUILD_SECONDS;
    building.stats.status = "closed";
    this.state.budget.treasury -= HOTEL_COST;
    this.mapRev += 1;
    announceConstruction(this.state, building);
    return true;
  }

  raiseHotel(building: Building) {
    if (building.floors >= HOTEL_MAX_FLOORS) {
      this.placementHint = "This hotel is as tall as it can go";
      return false;
    }
    if (this.state.budget.treasury < HOTEL_STACK_COST) {
      this.placementHint = `Adding floors costs $${(HOTEL_STACK_COST / 1000).toFixed(0)}K — treasury is short`;
      return false;
    }
    building.floors = Math.min(HOTEL_MAX_FLOORS, building.floors + HOTEL_STACK_FLOORS);
    building.stats.extra = {
      ...building.stats.extra,
      rooms: Math.round(building.floors * 18),
      nightly: building.stats.extra?.nightly ?? "$189",
    };
    building.stats.jobs = Math.min(240, building.stats.jobs + 18);
    building.stats.employees = Math.min(building.stats.jobs, building.stats.employees + 12);
    building.stats.revenue += 4200;
    building.stats.propertyValue += 2_400_000;
    this.state.budget.treasury -= HOTEL_STACK_COST;
    this.selectedId = building.id;
    this.placementHint = `${building.name} is now ${building.floors} floors`;
    this.mapRev += 1;
    return true;
  }

  placeBuilding(kind: BuildingKind, x: number, y: number, finish = true) {
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
    this.mapRev += 1;
    if (!finish) return true;
    if (kind === "baseball_stadium") {
      this.state.budget.treasury -= STADIUM_COST;
      building.constructionLeft = STADIUM_BUILD_SECONDS;
      building.stats.status = "closed";
      announceConstruction(this.state, building);
    } else if (kind === "skyscraper" || kind === "tower") {
      building.constructionLeft = 24;
      building.stats.status = "closed";
      announceConstruction(this.state, building);
    }
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
    this.mapRev += 1;
  }

  /** Guesses which way a hand-built span runs from its neighbouring roads. */
  private spanAxis(x: number, y: number): "ns" | "ew" {
    const { tiles } = this.state;
    const eastWest =
      Number(Boolean(tiles[y]?.[x - 1]?.road)) + Number(Boolean(tiles[y]?.[x + 1]?.road));
    const northSouth =
      Number(Boolean(tiles[y - 1]?.[x]?.road)) + Number(Boolean(tiles[y + 1]?.[x]?.road));
    return northSouth > eastWest ? "ns" : "ew";
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
    case "stadium":
      return "baseball_stadium";
    default:
      return null;
  }
}
