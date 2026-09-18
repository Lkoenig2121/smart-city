import {
  awardXp,
  formatDollars,
  readPlayer,
  writePlayer,
  type PlayerState,
} from "@/lib/city/player";
import { hasOwnedVehicle } from "@/lib/city/vehicles";

const STORAGE = "smartcity-missions";

export type MissionId = "beyond-riverside";

export interface MissionSave {
  beyondRiverside: {
    started: boolean;
    boughtCar: boolean;
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

export function syncBeyondRiverside(player: PlayerState = readPlayer()) {
  const save = readMissions();
  const m = save.beyondRiverside;
  if (!m.started) m.started = true;
  if (hasOwnedVehicle(player)) m.boughtCar = true;
  if (player.dustfallUnlocked) {
    m.arrivedDustfall = true;
    m.droveHighway = true;
    m.reachedRamp = true;
  }
  if (m.boughtCar && m.reachedRamp && m.droveHighway && m.arrivedDustfall) {
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

export function markMissionRamp() {
  const save = readMissions();
  save.beyondRiverside.reachedRamp = true;
  writeMissions(save);
  return syncBeyondRiverside();
}

export function markMissionHighway() {
  const save = readMissions();
  save.beyondRiverside.droveHighway = true;
  writeMissions(save);
  return syncBeyondRiverside();
}

export function markMissionDustfall() {
  const player = readPlayer();
  player.dustfallUnlocked = true;
  writePlayer(player);
  const save = readMissions();
  save.beyondRiverside.arrivedDustfall = true;
  save.beyondRiverside.droveHighway = true;
  save.beyondRiverside.reachedRamp = true;
  writeMissions(save);
  return syncBeyondRiverside(player);
}

export function beyondRiversideStatus(player: PlayerState = readPlayer()) {
  const m = syncBeyondRiverside(player).beyondRiverside;
  const steps = [
    { id: "car", label: "Purchase a vehicle at Riverside Motors", done: m.boughtCar },
    { id: "ramp", label: "Drive to the Highway 93 ramp (north)", done: m.reachedRamp },
    { id: "hwy", label: "Follow Highway 93 toward Dustfall", done: m.droveHighway },
    { id: "arrive", label: "Reach Dustfall", done: m.arrivedDustfall },
  ];
  return { ...m, steps, reward: m.rewarded ? `Claimed ${formatDollars(750)} + XP` : `${formatDollars(750)} + XP` };
}
