export type Terrain =
  | "grass"
  | "park"
  | "plaza"
  | "water"
  | "sand"
  | "playground"
  | "lot";

export type BuildingKind =
  | "house"
  | "apartment"
  | "shop"
  | "office"
  | "skyscraper"
  | "hospital"
  | "school"
  | "police"
  | "fire"
  | "city_hall"
  | "park_pavilion";

export type VehicleKind = "car" | "bus" | "truck" | "taxi" | "ambulance" | "firetruck";

export type Tool =
  | "inspect"
  | "road"
  | "house"
  | "apartment"
  | "shop"
  | "office"
  | "park"
  | "tree"
  | "bulldoze";

export interface Vec2 {
  x: number;
  y: number;
}

export interface RoadCell {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

export interface Tree {
  variant: number;
  scale: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  road: RoadCell | null;
  buildingId: string | null;
  tree: Tree | null;
}

export interface BuildingStats {
  residents: number;
  capacity: number;
  employees: number;
  jobs: number;
  revenue: number;
  happiness: number;
  propertyValue: number;
  status: "open" | "closed" | "busy";
  extra?: Record<string, string | number>;
}

export interface Building {
  id: string;
  kind: BuildingKind;
  name: string;
  origin: Vec2;
  width: number;
  depth: number;
  variant: number;
  floors: number;
  wallColor: string;
  accentColor: string;
  roofColor: string;
  stats: BuildingStats;
}

export interface Citizen {
  id: string;
  name: string;
  age: number;
  homeId: string | null;
  workplaceId: string | null;
  money: number;
  happiness: number;
  health: number;
  education: number;
  transport: "walk" | "car" | "bus";
  x: number;
  y: number;
  path: Vec2[];
  pathIndex: number;
  speed: number;
  color: string;
  activity: "home" | "commute" | "work" | "shop" | "park" | "sleep";
}

export interface Vehicle {
  id: string;
  kind: VehicleKind;
  color: string;
  x: number;
  y: number;
  path: Vec2[];
  pathIndex: number;
  speed: number;
  ownerId: string | null;
}

export interface CityClock {
  dayIndex: number;
  minuteOfDay: number;
}

export interface CityBudget {
  treasury: number;
  police: number;
  fire: number;
  healthcare: number;
  education: number;
  parks: number;
  roads: number;
}

export interface CityState {
  id: string;
  name: string;
  size: number;
  tiles: Tile[][];
  buildings: Map<string, Building>;
  citizens: Citizen[];
  vehicles: Vehicle[];
  clock: CityClock;
  budget: CityBudget;
  population: number;
}

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
