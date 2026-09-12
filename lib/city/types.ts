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
  | "tower"
  | "hospital"
  | "school"
  | "police"
  | "fire"
  | "city_hall"
  | "park_pavilion"
  | "baseball_stadium"
  | "subway_station";

export type VehicleKind = "car" | "bus" | "truck" | "taxi" | "ambulance" | "firetruck";

export type Tool =
  | "inspect"
  | "road"
  | "house"
  | "apartment"
  | "shop"
  | "office"
  | "park"
  | "parking"
  | "sand"
  | "tree"
  | "stadium"
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

/** A spray-painted tag rendered on a pier, abutment, or low wall. */
export interface Graffiti {
  variant: number;
  hue: number;
}

export interface BridgeCell {
  axis: "ns" | "ew";
  /** Height of the deck above the water surface, in screen pixels. */
  deck: number;
  /** Support column reaching down into the water. */
  pier: boolean;
  /** Cable-stay pylon rising above the deck. */
  pylon: boolean;
  /** Which side touches land, if any — used to draw the abutment. */
  abutment: "start" | "end" | null;
  graffiti: Graffiti | null;
}

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  road: RoadCell | null;
  bridge: BridgeCell | null;
  buildingId: string | null;
  tree: Tree | null;
  graffiti: Graffiti | null;
}

export interface BuildingStats {
  residents: number;
  capacity: number;
  employees: number;
  jobs: number;
  /** Daily economic output in dollars. */
  revenue: number;
  happiness: number;
  propertyValue: number;
  /** Grid load, 0–100. */
  energy: number;
  /** Nearby parking vs demand, 0–100. */
  parking: number;
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
  /** Seconds remaining before the building opens. Zero means finished. */
  constructionLeft?: number;
}

export type CitizenRole = "worker" | "family" | "shopper" | "student" | "tourist";

export type CitizenActivity =
  | "home"
  | "work"
  | "school"
  | "shop"
  | "restaurant"
  | "park"
  | "library"
  | "hotel"
  | "stadium"
  | "sleep";

export interface Citizen {
  id: string;
  name: string;
  age: number;
  role: CitizenRole;
  homeId: string | null;
  workplaceId: string | null;
  schoolId: string | null;
  shopId: string | null;
  restaurantId: string | null;
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
  activity: CitizenActivity;
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

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow";

export interface CityWeather {
  kind: WeatherKind;
  label: string;
  tempF: number;
  wet: boolean;
}

export type CityEventKind =
  | "accident"
  | "fire"
  | "storm"
  | "concert"
  | "baseball"
  | "festival"
  | "construction";

export interface CityEvent {
  id: string;
  kind: CityEventKind;
  headline: string;
  detail: string;
  icon: string;
  x: number;
  y: number;
  buildingId?: string;
  remaining: number;
}

export interface CityClock {
  dayIndex: number;
  minuteOfDay: number;
  dayOfYear: number;
  year: number;
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
  weather: CityWeather;
  events: CityEvent[];
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
