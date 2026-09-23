import {
  awardXp,
  formatDollars,
  readPlayer,
  writePlayer,
  type PlayerState,
} from "@/lib/city/player";
import { hasDiscoveredCity } from "@/lib/city/cityProgress";
import { hasOwnedVehicle } from "@/lib/city/vehicles";

const STORAGE = "smartcity-missions";

export type MissionId = "beyond-riverside";

export interface MissionSave {
  beyondRiverside: {
    started: boolean;
    boughtCar: boolean;
    /** Legacy fields retained for old saves; no longer required. */
    reachedRamp: boolean;
    droveHighway: boolean;
    arrivedDustfall: boolean;
    completed: boolean;
    rewarded: boolean;
  };
}

function emptySave(): MissionSave {
  return {
    beyondRiverside: {
      started: false,
      boughtCar: false,
      reachedRamp: false,
      droveHighway: false,
      arrivedDustfall: false,
      completed: false,
      rewarded: false,
    },
  };
}

export function readMissions(): MissionSave {
  if (typeof window === "undefined") return emptySave();
  try {
    const raw = window.localStorage.getItem(STORAGE);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as Partial<MissionSave>;
    const base = emptySave();
    return {
      beyondRiverside: { ...base.beyondRiverside, ...parsed.beyondRiverside },
    };
  } catch {
    return emptySave();
  }
}

export function writeMissions(save: MissionSave) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE, JSON.stringify(save));
}

/** Visit Dustfall via the World Map to complete. */
export function syncBeyondRiverside(player: PlayerState = readPlayer()) {
  const save = readMissions();
  const m = save.beyondRiverside;
  if (!m.started) m.started = true;
  if (hasOwnedVehicle(player)) m.boughtCar = true;
  if (hasDiscoveredCity("dustfall", player) && player.currentCityId === "dustfall") {
    m.arrivedDustfall = true;
  }
  if (m.arrivedDustfall) {
    m.completed = true;
  }
  if (m.completed && !m.rewarded) {
    m.rewarded = true;
    player.wallet += 750;
    writePlayer(player);
    awardXp(150, "mission:beyond-riverside", "exploration");
  }
  writeMissions(save);
  return save;
}

export function beyondRiversideStatus(player: PlayerState = readPlayer()) {
  const m = syncBeyondRiverside(player).beyondRiverside;
  const steps = [
    {
      id: "map",
      label: "Open the World Map and travel to Dustfall",
      done: m.arrivedDustfall,
    },
    {
      id: "car",
      label: "Purchase a vehicle at Riverside Motors (optional)",
      done: m.boughtCar,
    },
  ];
  return {
    ...m,
    steps,
    reward: m.rewarded ? `Claimed ${formatDollars(750)} + XP` : `${formatDollars(750)} + XP`,
  };
}
