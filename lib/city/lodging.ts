import type { Building, CityState } from "@/lib/city/types";
import { mulberry32 } from "./rng";

export type LodgingUse = "hotel" | "residences";
export type LodgingZone = "lobby" | "room" | "pool";

export type LodgingRoomStatus = "yours" | "open" | "taken";

export interface LodgingRoom {
  id: string;
  floor: number;
  label: string;
  status: LodgingRoomStatus;
}

export interface LodgingLevel {
  level: number;
  label: string;
  club: boolean;
  rooms: LodgingRoom[];
}

const KEYS_STORAGE = "smartcity-lodging-keys";
const ROOM_STORAGE = "smartcity-lodging-rooms";

export function lodgingUse(building: Building): LodgingUse | null {
  const value = building.stats.extra?.lodging;
  if (value === "hotel" || value === "residences") return value;
  return null;
}

export function isLodging(building: Building) {
  return lodgingUse(building) !== null;
}

export function lodgingBuildings(state: CityState) {
  return [...state.buildings.values()].filter(isLodging);
}

export function findLodging(state: CityState, id: string) {
  const building = state.buildings.get(id);
  return building && isLodging(building) ? building : null;
}

/** Tile just south of the tower, toward the downtown streets. */
export function lodgingGateTile(building: Building) {
  return {
    x: building.origin.x + Math.floor(building.width / 2),
    y: building.origin.y + building.depth,
  };
}

export function markLodging(building: Building, use: LodgingUse) {
  building.stats.extra = {
    ...building.stats.extra,
    lodging: use,
    ...(use === "hotel"
      ? { rooms: 240, nightly: "$189" }
      : { homes: 186, amenities: "Roof deck" }),
  };
  if (use === "hotel") {
    building.wallColor = "#d8c4a8";
    building.roofColor = "#2a2420";
    building.accentColor = "#c9a44c";
    building.name = building.origin.x === 21 ? "The Helio Grand" : "The Riverside Hotel";
  } else {
    building.wallColor = "#c4b09a";
    building.roofColor = "#3a322c";
    building.accentColor = "#8a5a3a";
    building.name = building.origin.y === 6 ? "Harbor House" : "Plaza Residences";
  }
}

export function lodgingLabel(building: Building) {
  return lodgingUse(building) === "hotel" ? "Hotel" : "Residences";
}

function readKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEYS_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function hasLodgingKey(buildingId: string) {
  return readKeys().includes(buildingId);
}

export function grantLodgingKey(buildingId: string, roomId?: string) {
  if (typeof window === "undefined") return;
  const next = new Set(readKeys());
  next.add(buildingId);
  window.localStorage.setItem(KEYS_STORAGE, JSON.stringify([...next]));
  if (roomId) rememberLodgingRoom(buildingId, roomId);
}

/** One rented room per building — a second claim is ignored. */
export function canEnterLodgingRoom(buildingId: string, room: LodgingRoom, hotel: boolean, hasKey: boolean) {
  const claimed = lodgingRoomChoice(buildingId);
  if (claimed) return claimed === room.id;
  if (hasKey) return room.status === "yours";
  return hotel && room.status === "open";
}

export function lodgingRoomChoice(buildingId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROOM_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const value = (parsed as Record<string, unknown>)[buildingId];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export function rememberLodgingRoom(buildingId: string, roomId: string) {
  if (typeof window === "undefined") return;
  if (lodgingRoomChoice(buildingId)) return;
  let current: Record<string, string> = {};
  try {
    const raw = window.localStorage.getItem(ROOM_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (parsed && typeof parsed === "object") {
      current = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    }
  } catch {
    current = {};
  }
  current[buildingId] = roomId;
  window.localStorage.setItem(ROOM_STORAGE, JSON.stringify(current));
}

/** Guest floors and rooms for the front-desk directory. Lobby and roof are omitted. */
export function lodgingLevels(building: Building): LodgingLevel[] {
  const hotel = lodgingUse(building) === "hotel";
  const top = Math.max(4, building.floors);
  const lastGuest = Math.max(2, top - 1);
  const perFloor = 10;
  const floorNumbers: number[] = [];
  for (let level = 2; level <= lastGuest; level++) {
    if (hotel && level === 13) continue;
    floorNumbers.push(level);
  }

  const seed = hashString(building.id);
  const assignedFloor = floorNumbers[seed % floorNumbers.length] ?? 2;
  const assignedIndex = (seed >>> 8) % perFloor;
  const assignedLabel = hotel
    ? `${assignedFloor}${String(assignedIndex + 1).padStart(2, "0")}`
    : `${assignedFloor}${String.fromCharCode(65 + assignedIndex)}`;
  const stored = lodgingRoomChoice(building.id);
  const yoursId =
    stored ?? (hotel && !hasLodgingKey(building.id) ? null : `${assignedFloor}-${assignedLabel}`);

  const rand = mulberry32(seed ^ 0x51d0f1e);
  return floorNumbers.map((level) => {
    const rooms: LodgingRoom[] = [];
    for (let i = 0; i < perFloor; i++) {
      const label = hotel
        ? `${level}${String(i + 1).padStart(2, "0")}`
        : `${level}${String.fromCharCode(65 + i)}`;
      const id = `${level}-${label}`;
      const taken = rand() < (hotel ? 0.58 : 0.76);
      rooms.push({
        id,
        floor: level,
        label,
        status: yoursId === id ? "yours" : taken ? "taken" : "open",
      });
    }
    return {
      level,
      label: `Level ${level}`,
      club: hotel && level >= lastGuest - 1,
      rooms,
    };
  });
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
