import type { Building, CityState } from "@/lib/city/types";

const KEY = "city-evolution:save:v1";
const VERSION = 1;

interface SavePayload {
  version: number;
  savedAt: number;
  state: Omit<CityState, "buildings"> & { buildings: Building[] };
}

export function serializeCity(state: CityState): string {
  const payload: SavePayload = {
    version: VERSION,
    savedAt: Date.now(),
    state: { ...state, buildings: [...state.buildings.values()] },
  };
  return JSON.stringify(payload);
}

export function deserializeCity(raw: string): CityState | null {
  try {
    const payload = JSON.parse(raw) as SavePayload;
    if (payload.version !== VERSION) return null;
    const { buildings, ...rest } = payload.state;
    return {
      ...rest,
      buildings: new Map(buildings.map((b) => [b.id, b])),
    } as CityState;
  } catch {
    return null;
  }
}

export function saveCity(state: CityState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, serializeCity(state));
  } catch {
    // Quota exceeded or storage disabled — the game keeps running either way.
  }
}

export function loadCity(): CityState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  return raw ? deserializeCity(raw) : null;
}

export function clearSave() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function hasSave() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) !== null;
}
