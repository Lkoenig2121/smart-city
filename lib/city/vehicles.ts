import type { CityClock } from "@/lib/city/types";
import type { PlayerState } from "./player";

export type VehicleCategory = "compact" | "sedan" | "suv" | "sports" | "luxury";

export interface VehicleCatalogItem {
  id: string;
  name: string;
  category: VehicleCategory;
  price: number;
  seats: number;
  description: string;
  colors: string[];
  topSpeed: number;
  accel: number;
}

export interface OwnedVehicle {
  id: string;
  catalogId: string;
  model: string;
  category: VehicleCategory;
  purchasePrice: number;
  currentValue: number;
  color: string;
  mileage: number;
  fuel: number;
  condition: number;
  licensePlate: string;
  garageLocation: string;
  upgrades: { performance: number };
  owned: true;
  /** World tile where the car is parked (Riverside grid). */
  parkX: number;
  parkY: number;
  parkYaw: number;
}

/** Dealership lot — center of arterial x=20. */
export const MOTORS_LOT = { x: 20.5, y: 8.5, yaw: 0 };
export const MOTORS_GATE = { x: 20, y: 9 };

export const VEHICLE_CATALOG: VehicleCatalogItem[] = [
  {
    id: "riv-compact",
    name: "Riverside Hatch",
    category: "compact",
    price: 3500,
    seats: 4,
    description: "A tidy city hatch — enough for groceries and a weekend bag.",
    colors: ["#3d7ea6", "#c0392b", "#2f5d4a", "#d6d0c4"],
    topSpeed: 28,
    accel: 18,
  },
  {
    id: "riv-sedan",
    name: "Riverside Sedan",
    category: "sedan",
    price: 8000,
    seats: 4,
    description: "The daily driver. Quiet cabin, honest mileage, room for four.",
    colors: ["#1f4d8c", "#5c5f66", "#c9a44c", "#1a1206"],
    topSpeed: 34,
    accel: 22,
  },
  {
    id: "riv-suv",
    name: "Harbor Trail SUV",
    category: "suv",
    price: 15000,
    seats: 5,
    description: "Higher ride, bigger cargo — ready when the pavement ends.",
    colors: ["#8a5a3a", "#2aa3a0", "#243656", "#f4f1ea"],
    topSpeed: 30,
    accel: 16,
  },
  {
    id: "riv-sports",
    name: "Meridian GT",
    category: "sports",
    price: 32000,
    seats: 2,
    description: "Low, loud, and late to every quiet appointment.",
    colors: ["#c0392b", "#1a1206", "#f4d03f", "#3d9ad1"],
    topSpeed: 48,
    accel: 36,
  },
  {
    id: "riv-luxury",
    name: "Helio Executive",
    category: "luxury",
    price: 55000,
    seats: 4,
    description: "Leather, hush, and a presence that opens doors.",
    colors: ["#1a1206", "#d8c4a8", "#2a2420", "#c9a44c"],
    topSpeed: 42,
    accel: 28,
  },
];

export function vehicleById(id: string) {
  return VEHICLE_CATALOG.find((item) => item.id === id) ?? null;
}

export function ownedVehicleById(player: PlayerState, id: string) {
  return player.ownedVehicles.find((item) => item.id === id) ?? null;
}

export function activeOwnedVehicle(player: PlayerState) {
  if (!player.activeVehicleId) return player.ownedVehicles[0] ?? null;
  return ownedVehicleById(player, player.activeVehicleId) ?? player.ownedVehicles[0] ?? null;
}

export function hasOwnedVehicle(player: PlayerState) {
  return player.ownedVehicles.length > 0;
}

function makePlate() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `RIV-${n}`;
}

function makeVehicleId() {
  return `veh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Attach a newly purchased car after wallet debit succeeds. */
export function grantOwnedVehicle(
  player: PlayerState,
  catalogId: string,
  color: string,
): PlayerState | string {
  const catalog = vehicleById(catalogId);
  if (!catalog) return "That model is not on the lot.";
  const paint = catalog.colors.includes(color) ? color : catalog.colors[0];
  const owned: OwnedVehicle = {
    id: makeVehicleId(),
    catalogId: catalog.id,
    model: catalog.name,
    category: catalog.category,
    purchasePrice: catalog.price,
    currentValue: Math.round(catalog.price * 0.92),
    color: paint,
    mileage: Math.round(12 + Math.random() * 40),
    fuel: 100,
    condition: 100,
    licensePlate: makePlate(),
    garageLocation: "personal",
    upgrades: { performance: 0 },
    owned: true,
    parkX: MOTORS_LOT.x,
    parkY: MOTORS_LOT.y,
    parkYaw: MOTORS_LOT.yaw,
  };
  player.ownedVehicles.push(owned);
  player.activeVehicleId = owned.id;
  return player;
}

export function applyActiveVehicle(player: PlayerState, vehicleId: string): PlayerState | string {
  if (!ownedVehicleById(player, vehicleId)) return "You do not own that vehicle.";
  player.activeVehicleId = vehicleId;
  return player;
}

export function applyVehicleCustomize(
  player: PlayerState,
  vehicleId: string,
  patch: Partial<Pick<OwnedVehicle, "color" | "licensePlate">> & { performance?: number },
): PlayerState | string {
  const car = ownedVehicleById(player, vehicleId);
  if (!car) return "You do not own that vehicle.";
  if (patch.color) car.color = patch.color;
  if (patch.licensePlate) {
    const plate = patch.licensePlate.trim().toUpperCase().slice(0, 8);
    if (plate.length < 3) return "Plate needs at least 3 characters.";
    car.licensePlate = plate;
  }
  if (typeof patch.performance === "number") {
    car.upgrades.performance = Math.max(0, Math.min(3, Math.round(patch.performance)));
  }
  return player;
}

export function applyParkVehicle(
  player: PlayerState,
  vehicleId: string,
  x: number,
  y: number,
  yaw: number,
): PlayerState {
  const car = ownedVehicleById(player, vehicleId);
  if (!car) return player;
  car.parkX = x;
  car.parkY = y;
  car.parkYaw = yaw;
  return player;
}

export function applyDriveTick(
  player: PlayerState,
  vehicleId: string,
  dt: number,
  speed: number,
  pos?: { x: number; y: number; yaw: number },
): PlayerState {
  const car = ownedVehicleById(player, vehicleId);
  if (!car) return player;
  const miles = (Math.abs(speed) * dt) / 160;
  car.mileage += miles;
  if (Math.abs(speed) > 1) car.condition = Math.max(35, car.condition - miles * 0.02);
  if (pos) {
    car.parkX = pos.x;
    car.parkY = pos.y;
    car.parkYaw = pos.yaw;
  }
  return player;
}

export function driveStats(car: OwnedVehicle) {
  const catalog = vehicleById(car.catalogId);
  const boost = 1 + car.upgrades.performance * 0.12;
  const condition = Math.max(0.55, car.condition / 100);
  return {
    topSpeed: (catalog?.topSpeed ?? 30) * boost * condition,
    accel: (catalog?.accel ?? 18) * boost * condition,
    empty: false,
  };
}

export function parseOwnedVehicles(value: unknown): OwnedVehicle[] {
  if (!Array.isArray(value)) return [];
  const list: OwnedVehicle[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const catalogId = typeof item.catalogId === "string" ? item.catalogId : "";
    const catalog = vehicleById(catalogId);
    if (!catalog) continue;
    list.push({
      id: typeof item.id === "string" ? item.id : makeVehicleId(),
      catalogId,
      model: typeof item.model === "string" ? item.model : catalog.name,
      category: catalog.category,
      purchasePrice: Number(item.purchasePrice) || catalog.price,
      currentValue: Number(item.currentValue) || catalog.price,
      color: typeof item.color === "string" ? item.color : catalog.colors[0],
      mileage: Math.max(0, Number(item.mileage) || 0),
      fuel: Math.max(0, Math.min(100, Number(item.fuel) || 100)),
      condition: Math.max(1, Math.min(100, Number(item.condition) || 100)),
      licensePlate: typeof item.licensePlate === "string" ? item.licensePlate : makePlate(),
      garageLocation: typeof item.garageLocation === "string" ? item.garageLocation : "personal",
      upgrades: {
        performance: Math.max(
          0,
          Math.min(3, Number((item.upgrades as { performance?: number } | undefined)?.performance) || 0),
        ),
      },
      owned: true,
      parkX: Number(item.parkX) || MOTORS_LOT.x,
      parkY: Number(item.parkY) || MOTORS_LOT.y,
      parkYaw: Number(item.parkYaw) || MOTORS_LOT.yaw,
    });
  }
  return list;
}

export function categoryLabel(category: VehicleCategory) {
  switch (category) {
    case "compact":
      return "Compact";
    case "sedan":
      return "Sedan";
    case "suv":
      return "SUV";
    case "sports":
      return "Sports";
    case "luxury":
      return "Luxury";
  }
}

/** Pure clock stamp kept for API symmetry with shop flows. */
export function vehiclePurchaseDescription(catalogId: string, _clock: CityClock) {
  const catalog = vehicleById(catalogId);
  return catalog ? `Purchased ${catalog.name}` : "Purchased vehicle";
}

/** Keep dealership cars on the arterial facing north toward Highway 93. */
export function snapFleetToMotorsApproach(player: PlayerState): PlayerState {
  for (const car of player.ownedVehicles) {
    const nearLot = car.parkX >= 19 && car.parkX <= 24 && car.parkY >= 6 && car.parkY <= 11;
    if (!nearLot) continue;
    car.parkX = MOTORS_LOT.x;
    car.parkY = MOTORS_LOT.y;
    car.parkYaw = MOTORS_LOT.yaw;
  }
  return player;
}
