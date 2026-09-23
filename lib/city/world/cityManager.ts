import type { CityState } from "@/lib/city/types";
import {
  CITIES,
  isPlayableCity,
  type CityId,
} from "./cities";

/**
 * Lazily holds generated CityState instances and swaps the live engine state.
 * Travel is World Map only — no inter-city highway corridors.
 */
export class CityManager {
  private readonly cache = new Map<CityId, CityState>();

  get(id: CityId): CityState | undefined {
    return this.cache.get(id);
  }

  /** Ensure a playable city exists in the cache and return it. */
  ensure(id: CityId): CityState {
    const existing = this.cache.get(id);
    if (existing) return existing;
    const def = CITIES[id];
    if (!def.generate) {
      throw new Error(`City ${id} is not playable yet.`);
    }
    const state = def.generate();
    this.cache.set(id, state);
    return state;
  }

  /** Drop cached stub maps so travel picks up generator polish. */
  invalidateStubs() {
    for (const id of ["mountain", "coastal", "future"] as const) {
      this.cache.delete(id);
    }
  }

  remember(id: CityId, state: CityState) {
    this.cache.set(id, state);
  }

  /**
   * Prepare travel: stash the outgoing city, load (or reuse) the destination,
   * and sync clock/weather from the previous live state.
   */
  travelTo(
    target: CityId,
    current: CityState,
    opts?: { requireDiscovered?: (id: CityId) => boolean },
  ): CityState {
    if (!isPlayableCity(target)) {
      throw new Error(`City ${target} is locked.`);
    }
    if (opts?.requireDiscovered && !opts.requireDiscovered(target)) {
      throw new Error(`City ${target} is not discovered.`);
    }

    const currentId = current.id as CityId;
    if (isPlayableCity(currentId) || this.cache.has(currentId)) {
      this.cache.set(currentId, current);
    }

    if (target === currentId) return current;

    const next = this.ensure(target);
    next.clock = { ...current.clock };
    next.weather = current.weather;
    return next;
  }
}
