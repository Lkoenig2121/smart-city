import type { CityClock } from "@/lib/city/types";
import type { PlayerState } from "./player";

export type VehicleCategory = "compact" | "sedan" | "suv" | "sports" | "luxury" | "supercar";

export interface VehicleCatalogItem {
  id: string;
  name: string;
  category: VehicleCategory;
  /** Progression rung: buying tier N needs a car of tier N-1 or higher. */
  tier: number;
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
  wheels: WheelId;
  interior: InteriorId;
  accessories: AccessoryId[];
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
    tier: 1,
    price: 2500,
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
    tier: 2,
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
    tier: 2,
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
    tier: 3,
    price: 20000,
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
    tier: 4,
    price: 50000,
    seats: 4,
    description: "Leather, hush, and a presence that opens doors.",
    colors: ["#1a1206", "#d8c4a8", "#2a2420", "#c9a44c"],
    topSpeed: 42,
    accel: 28,
  },
  {
    id: "riv-super",
    name: "Vantor Apex",
    category: "supercar",
    tier: 5,
    price: 100000,
    seats: 2,
    description: "Carbon tub, scissor doors, and a top speed the city can't legally use.",
    colors: ["#f4d03f", "#e8e8ec", "#0f0f12", "#2ecc71"],
    topSpeed: 60,
    accel: 46,
  },
];

export const TIER_NAMES = ["", "Starter Car", "Sedan", "Sports Car", "Luxury Car", "Supercar"];

export function highestOwnedTier(player: PlayerState) {
  let tier = 0;
  for (const car of player.ownedVehicles) tier = Math.max(tier, vehicleById(car.catalogId)?.tier ?? 0);
  return tier;
}

/** Null when the player may buy this model; otherwise the reason it's locked. */
export function vehicleLockReason(player: PlayerState, catalogId: string): string | null {
  const item = vehicleById(catalogId);
  if (!item) return "That model is not on the lot.";
  if (item.tier <= highestOwnedTier(player) + 1) return null;
  return `Own a ${TIER_NAMES[item.tier - 1]} first`;
}

// ── Mike's Foreign Car Repair: customization catalog ─────────────────────────

export type WheelId = "stock" | "alloy" | "chrome" | "carbon" | "gold";
export type InteriorId = "cloth" | "leather" | "racing" | "diamond";
export type AccessoryId = "spoiler" | "rack" | "underglow" | "tint" | "stripes";

export interface ModOption<T extends string> {
  id: T;
  name: string;
  price: number;
  color: string;
  blurb: string;
}

export const PAINTS: ModOption<string>[] = [
  { id: "#c0392b", name: "Rosso Red", price: 400, color: "#c0392b", blurb: "Classic gloss." },
  { id: "#1f4d8c", name: "Harbor Blue", price: 400, color: "#1f4d8c", blurb: "Classic gloss." },
  { id: "#f4f1ea", name: "Chalk White", price: 400, color: "#f4f1ea", blurb: "Classic gloss." },
  { id: "#1a1c20", name: "Midnight Black", price: 400, color: "#1a1c20", blurb: "Classic gloss." },
  { id: "#2f5d4a", name: "Racing Green", price: 400, color: "#2f5d4a", blurb: "Classic gloss." },
  { id: "#e67e22", name: "Sunset Orange", price: 600, color: "#e67e22", blurb: "Bright metallic." },
  { id: "#f4d03f", name: "Taxi Yellow", price: 600, color: "#f4d03f", blurb: "Bright metallic." },
  { id: "#8e44ad", name: "Candy Purple", price: 1500, color: "#8e44ad", blurb: "Premium candy coat." },
  { id: "#2aa3a0", name: "Lagoon Pearl", price: 1500, color: "#2aa3a0", blurb: "Premium pearl coat." },
  { id: "#c9a44c", name: "Champagne Gold", price: 2500, color: "#c9a44c", blurb: "Premium metal flake." },
];

export const WHEELS: ModOption<WheelId>[] = [
  { id: "stock", name: "Stock Steel", price: 0, color: "#1a1c20", blurb: "Factory wheels." },
  { id: "alloy", name: "Sport Alloys", price: 800, color: "#b8bec6", blurb: "+3% acceleration." },
  { id: "chrome", name: "Chrome Spinners", price: 2000, color: "#e8edf2", blurb: "+6% acceleration." },
  { id: "carbon", name: "Carbon Racing", price: 4500, color: "#2c2f33", blurb: "+9% acceleration." },
  { id: "gold", name: "Gold Mesh", price: 6000, color: "#d4af37", blurb: "+12% acceleration." },
];

export const INTERIORS: ModOption<InteriorId>[] = [
  { id: "cloth", name: "Factory Cloth", price: 0, color: "#4a4d52", blurb: "Hard-wearing grey cloth." },
  { id: "leather", name: "Tan Leather", price: 1200, color: "#a0703f", blurb: "Soft hides, heated seats." },
  { id: "racing", name: "Racing Buckets", price: 2500, color: "#b3262e", blurb: "Harness-ready bucket seats." },
  { id: "diamond", name: "Diamond Stitch", price: 5000, color: "#f1e7d0", blurb: "Quilted ivory with gold piping." },
];

export const ACCESSORIES: ModOption<AccessoryId>[] = [
  { id: "spoiler", name: "Rear Spoiler", price: 900, color: "#1a1c20", blurb: "+4% top speed." },
  { id: "rack", name: "Roof Rack", price: 400, color: "#2c2f33", blurb: "Weekend-ready storage." },
  { id: "underglow", name: "Neon Underglow", price: 1200, color: "#38e1ff", blurb: "Glows beneath the chassis." },
  { id: "tint", name: "Window Tint", price: 600, color: "#1b2530", blurb: "Dark privacy glass." },
  { id: "stripes", name: "Racing Stripes", price: 700, color: "#f4f1ea", blurb: "Twin stripes nose to tail." },
];

/** Price of each performance stage (index 1–3). */
export const PERFORMANCE_STAGES = [0, 1500, 4000, 9000];
export const PLATE_PRICE = 250;

/** Higher-tier cars cost more to modify. */
export function tierMultiplier(car: OwnedVehicle) {
  const tier = vehicleById(car.catalogId)?.tier ?? 1;
  return [1, 1, 1.4, 1.9, 2.6, 3.5][tier] ?? 1;
}

export function modPrice(car: OwnedVehicle, base: number) {
  return Math.round((base * tierMultiplier(car)) / 50) * 50;
}

/** Cost to restore a car to 100% condition at Mike's. */
export function repairPrice(car: OwnedVehicle) {
  return modPrice(car, Math.max(0, 100 - car.condition) * 30);
}

export type GarageOrder =
  | { kind: "paint"; color: string }
  | { kind: "wheels"; id: WheelId }
  | { kind: "interior"; id: InteriorId }
  | { kind: "performance"; stage: number }
  | { kind: "plate"; plate: string }
  | { kind: "accessory"; id: AccessoryId }
  | { kind: "repair" };

/** Price for an order, or a reason it can't be done. */
export function garageQuote(car: OwnedVehicle, order: GarageOrder): number | string {
  switch (order.kind) {
    case "paint": {
      const paint = PAINTS.find((p) => p.id === order.color);
      if (!paint) return "Unknown paint.";
      if (car.color === paint.id) return "Already painted that color.";
      return modPrice(car, paint.price);
    }
    case "wheels": {
      const wheel = WHEELS.find((w) => w.id === order.id);
      if (!wheel) return "Unknown wheels.";
      if (car.wheels === wheel.id) return "Already fitted.";
      return modPrice(car, wheel.price);
    }
    case "interior": {
      const trim = INTERIORS.find((i) => i.id === order.id);
      if (!trim) return "Unknown interior.";
      if (car.interior === trim.id) return "Already installed.";
      return modPrice(car, trim.price);
    }
    case "performance": {
      if (order.stage !== car.upgrades.performance + 1) return "Stages install in order.";
      const base = PERFORMANCE_STAGES[order.stage];
      if (base == null) return "Fully tuned.";
      return modPrice(car, base);
    }
    case "plate": {
      const plate = order.plate.trim().toUpperCase().replace(/[^A-Z0-9 -]/g, "");
      if (plate.length < 3 || plate.length > 8) return "Plates are 3–8 letters or numbers.";
      if (plate === car.licensePlate) return "That's already your plate.";
      return PLATE_PRICE;
    }
    case "accessory": {
      const acc = ACCESSORIES.find((a) => a.id === order.id);
      if (!acc) return "Unknown accessory.";
      if (car.accessories.includes(acc.id)) return 0;
      return modPrice(car, acc.price);
    }
    case "repair": {
      const price = repairPrice(car);
      return price > 0 ? price : "Already in perfect shape.";
    }
  }
}

/** A copy of `car` as it would look after `order`, for try-before-you-buy. */
export function previewGarageOrder(car: OwnedVehicle, order: GarageOrder | null): OwnedVehicle {
  if (!order) return car;
  const next: OwnedVehicle = { ...car, upgrades: { ...car.upgrades }, accessories: [...car.accessories] };
  switch (order.kind) {
    case "paint":
      next.color = order.color;
      break;
    case "wheels":
      next.wheels = order.id;
      break;
    case "interior":
      next.interior = order.id;
      break;
    case "performance":
      next.upgrades.performance = Math.max(next.upgrades.performance, order.stage);
      break;
    case "plate": {
      const plate = order.plate.trim().toUpperCase().replace(/[^A-Z0-9 -]/g, "");
      if (plate) next.licensePlate = plate;
      break;
    }
    case "accessory":
      next.accessories = next.accessories.includes(order.id)
        ? next.accessories.filter((id) => id !== order.id)
        : [...next.accessories, order.id];
      break;
    case "repair":
      next.condition = 100;
      break;
  }
  return next;
}

/** Apply a paid garage order. Removing an accessory is free and not refunded. */
export function applyGarageOrder(player: PlayerState, vehicleId: string, order: GarageOrder, paid: number) {
  const car = ownedVehicleById(player, vehicleId);
  if (!car) return "You do not own that vehicle.";
  switch (order.kind) {
    case "paint":
      car.color = order.color;
      break;
    case "wheels":
      car.wheels = order.id;
      break;
    case "interior":
      car.interior = order.id;
      break;
    case "performance":
      car.upgrades.performance = order.stage;
      break;
    case "plate":
      car.licensePlate = order.plate.trim().toUpperCase().replace(/[^A-Z0-9 -]/g, "");
      break;
    case "accessory":
      car.accessories = car.accessories.includes(order.id)
        ? car.accessories.filter((id) => id !== order.id)
        : [...car.accessories, order.id];
      break;
    case "repair":
      car.condition = 100;
      break;
  }
  if (order.kind !== "repair") car.currentValue += Math.round(paid * 0.5);
  return player;
}

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
    wheels: "stock",
    interior: "cloth",
    accessories: [],
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
  const grip = 1 + Math.max(0, WHEELS.findIndex((w) => w.id === car.wheels)) * 0.03;
  const aero = car.accessories.includes("spoiler") ? 1.04 : 1;
  const condition = Math.max(0.55, car.condition / 100);
  return {
    topSpeed: (catalog?.topSpeed ?? 30) * boost * aero * condition,
    accel: (catalog?.accel ?? 18) * boost * grip * condition,
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
      wheels: WHEELS.find((w) => w.id === item.wheels)?.id ?? "stock",
      interior: INTERIORS.find((i) => i.id === item.interior)?.id ?? "cloth",
      accessories: Array.isArray(item.accessories)
        ? ACCESSORIES.filter((a) => (item.accessories as unknown[]).includes(a.id)).map((a) => a.id)
        : [],
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
    case "supercar":
      return "Supercar";
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
