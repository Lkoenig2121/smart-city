import {
  awardXp,
  dayKey,
  earnCash,
  readPlayer,
  writePlayer,
  type PlayerState,
  type PoliceCall,
  type PoliceCallKind,
  type PoliceCallPhase,
  type PoliceCareer,
  type PoliceShift,
} from "./player";
import { setPhoneWaypoint } from "./phone";
import type { Building, CityState } from "./types";
import { venueRole } from "./venues";
import { equipPoliceDutyUniform, restoreStashedOutfit, wardrobeLockedWhileOnDuty } from "./wardrobe";

export type { PoliceCall, PoliceCallKind, PoliceCallPhase, PoliceCareer, PoliceShift };

export const POLICE_RANKS = [
  { id: "cadet", label: "Police Cadet", xp: 0, payMult: 1, unlocks: ["dispatch", "traffic", "lost"] as const },
  { id: "patrol", label: "Patrol Officer", xp: 120, payMult: 1.35, unlocks: ["cruiser"] as const },
  { id: "senior", label: "Senior Officer", xp: 300, payMult: 1.7, unlocks: ["districts"] as const },
  { id: "investigator", label: "Investigator", xp: 520, payMult: 2.15, unlocks: ["investigate"] as const },
  { id: "detective", label: "Detective", xp: 800, payMult: 2.7, unlocks: ["cases"] as const },
  { id: "supervisor", label: "Police Supervisor", xp: 1200, payMult: 3.4, unlocks: ["supervise"] as const },
] as const;

export type PoliceRankId = (typeof POLICE_RANKS)[number]["id"];

export interface PoliceCallDef {
  kind: PoliceCallKind;
  title: string;
  blurb: string;
  locationLabel: string;
  tileX: number;
  tileY: number;
  reward: number;
  xp: number;
  minRank: PoliceRankId;
}

/**
 * Police work always happens inside an open city-block square (plaza / park /
 * playground) you can hop into from the surrounding streets — never mid-road.
 */
export const LOST_RESIDENT_MEETUP = { x: 18, y: 18 };
export const LOST_RESIDENT_HOME = { x: 18, y: 28 };
export const LOST_RESIDENT_NAMES = ["Maya Chen", "Jonah Reed", "Priya Walsh", "Eli Navarro"] as const;
/** Plaza square beside the avenue — incident scene sits inside the block. */
export const TRAFFIC_INCIDENT_SITE = { x: 19, y: 19 };
/** Park square hoppable from the avenue (x=20) — reporting NPC waits here. */
export const SUSPICIOUS_ACTIVITY_SITE = { x: 21, y: 22 };

/** Fixed Riverside call sites for the first vertical slice. */
export const POLICE_CALL_CATALOG: PoliceCallDef[] = [
  {
    kind: "traffic_incident",
    title: "Traffic Incident",
    blurb: "A vehicle has blocked the plaza edge by the avenue.",
    locationLabel: "Downtown Plaza",
    tileX: TRAFFIC_INCIDENT_SITE.x,
    tileY: TRAFFIC_INCIDENT_SITE.y,
    reward: 100,
    xp: 25,
    minRank: "cadet",
  },
  {
    kind: "lost_resident",
    title: "Lost Resident",
    blurb: "A resident needs help finding their way home.",
    locationLabel: "Downtown Plaza",
    tileX: LOST_RESIDENT_MEETUP.x,
    tileY: LOST_RESIDENT_MEETUP.y,
    reward: 50,
    xp: 15,
    minRank: "cadet",
  },
  {
    kind: "suspicious_activity",
    title: "Suspicious Activity",
    blurb: "Investigate a report in the park square by the mall.",
    locationLabel: "Park Square",
    tileX: SUSPICIOUS_ACTIVITY_SITE.x,
    tileY: SUSPICIOUS_ACTIVITY_SITE.y,
    reward: 150,
    xp: 35,
    minRank: "cadet",
  },
];

export function emptyPoliceCareer(): PoliceCareer {
  return {
    xp: 0,
    completedCalls: 0,
    totalEarnings: 0,
    unlockedVehicles: [],
    unlockedDistricts: ["riverside_downtown"],
  };
}

export function policeRank(xp: number) {
  let rank: (typeof POLICE_RANKS)[number] = POLICE_RANKS[0];
  for (const next of POLICE_RANKS) {
    if (xp >= next.xp) rank = next;
  }
  return rank;
}

/** Call cash scales with rank so promotions raise take-home pay. */
export function policeCallPay(baseReward: number, careerXp: number) {
  const mult = policeRank(careerXp).payMult;
  return Math.round(baseReward * mult);
}

export function nextPoliceRank(xp: number) {
  const current = policeRank(xp);
  const index = POLICE_RANKS.findIndex((rank) => rank.id === current.id);
  return POLICE_RANKS[index + 1] ?? null;
}

export function onPoliceDuty(player: PlayerState) {
  return Boolean(player.policeShift);
}

export function isPoliceStation(building: Building) {
  return building.kind === "police" || venueRole(building) === "police";
}

export function availablePoliceCalls(player: PlayerState): PoliceCallDef[] {
  const career = player.policeCareer ?? emptyPoliceCareer();
  const rank = policeRank(career.xp);
  const rankIndex = POLICE_RANKS.findIndex((r) => r.id === rank.id);
  return POLICE_CALL_CATALOG.filter((call) => {
    const need = POLICE_RANKS.findIndex((r) => r.id === call.minRank);
    return need <= rankIndex;
  }).map((call) => ({
    ...call,
    reward: policeCallPay(call.reward, career.xp),
  }));
}

export function startPoliceShift(building: Building, state: CityState): PlayerState | string {
  if (!isPoliceStation(building)) return "Start your shift at a police station.";
  const player = readPlayer();
  if (player.shift) return "Clock out of your office job first.";
  if (player.policeShift) return "You are already on a police shift.";
  if (player.policeCall) return "Clear your active call before starting a new shift.";

  if (!player.policeCareer) player.policeCareer = emptyPoliceCareer();
  writePlayer(player);

  const suited = equipPoliceDutyUniform();
  if (typeof suited === "string") return suited;

  suited.policeShift = {
    stationId: building.id,
    stationName: building.name,
    dayKey: dayKey(state.clock),
    startMinute: state.clock.minuteOfDay,
    callsCompleted: 0,
    earnings: 0,
    xpEarned: 0,
    civilianOutfit: suited.civilianOutfit,
  };
  const { civilianOutfit: _stash, ...clean } = suited;
  void _stash;
  writePlayer(clean);
  return clean;
}

export interface PoliceShiftSummary {
  rankLabel: string;
  callsCompleted: number;
  moneyEarned: number;
  xpEarned: number;
  durationMinutes: number;
}

export function endPoliceShift(
  state: CityState,
): PlayerState | { player: PlayerState; summary: PoliceShiftSummary } | string {
  const player = readPlayer();
  if (!player.policeShift) return "You are not on a police shift.";
  if (player.policeCall) {
    if (player.policeCall.phase === "completed") {
      return "Click Finish on your completed call at the desk to collect pay first.";
    }
    return "Finish or cancel your active call before ending the shift.";
  }

  const shift = player.policeShift;
  const summary: PoliceShiftSummary = {
    rankLabel: policeRank(player.policeCareer?.xp ?? 0).label,
    callsCompleted: shift.callsCompleted,
    moneyEarned: shift.earnings,
    xpEarned: shift.xpEarned,
    durationMinutes: Math.max(0, state.clock.minuteOfDay - shift.startMinute),
  };

  restoreStashedOutfit(shift.civilianOutfit);
  const latest = readPlayer();
  latest.policeShift = null;
  latest.policeCall = null;
  writePlayer(latest);
  setPhoneWaypoint(null);
  return { player: latest, summary };
}

export function cancelPoliceCall(): PlayerState | string {
  const player = readPlayer();
  if (!player.policeCall) return "No active call.";
  player.policeCall = null;
  writePlayer(player);
  setPhoneWaypoint(null);
  return player;
}

export function acceptPoliceCall(kind: PoliceCallKind): PlayerState | string {
  const player = readPlayer();
  if (!player.policeShift) return "Start a police shift first.";
  if (player.policeCall) return "Finish your current call first.";
  const def = availablePoliceCalls(player).find((call) => call.kind === kind);
  if (!def) return "That call is not available yet.";

  const name =
    kind === "lost_resident"
      ? LOST_RESIDENT_NAMES[Math.floor(Math.random() * LOST_RESIDENT_NAMES.length)]
      : undefined;

  player.policeCall = {
    id: `call-${kind}-${Date.now()}`,
    kind: def.kind,
    phase: "accepted",
    title: def.title,
    locationLabel: def.locationLabel,
    tileX: def.tileX,
    tileY: def.tileY,
    destTileX: kind === "lost_resident" ? LOST_RESIDENT_HOME.x : undefined,
    destTileY: kind === "lost_resident" ? LOST_RESIDENT_HOME.y : undefined,
    residentName: name,
    // `def.reward` is already rank-scaled via availablePoliceCalls.
    reward: def.reward,
    xp: def.xp,
    acceptedAt: Date.now(),
  };
  writePlayer(player);
  setPhoneWaypoint({ x: def.tileX, y: def.tileY, label: name ? `${name} · ${def.title}` : def.title });
  return player;
}

export function advancePoliceCall(phase: PoliceCallPhase): PlayerState | string {
  const player = readPlayer();
  if (!player.policeCall) return "No active call.";
  if (player.policeCall.phase === "completed") return player;
  player.policeCall.phase = phase;
  if (
    phase === "resolving" &&
    player.policeCall.kind === "lost_resident" &&
    player.policeCall.destTileX != null &&
    player.policeCall.destTileY != null
  ) {
    const who = player.policeCall.residentName ?? "Resident";
    setPhoneWaypoint({
      x: player.policeCall.destTileX,
      y: player.policeCall.destTileY,
      label: `${who}'s home`,
    });
  }
  writePlayer(player);
  return player;
}

/** Mark arrived when the player is near the call tile (or home while escorting). */
export function syncPoliceCallArrival(tileX: number, tileY: number, radius = 1.35) {
  const player = readPlayer();
  const call = player.policeCall;
  if (!call) return null;

  // Escort in progress — home proximity is handled by the prompt, not a phase flip.
  if (call.kind === "lost_resident" && call.phase === "resolving") return null;

  if (call.phase !== "accepted" && call.phase !== "traveling") return null;
  const dx = tileX - (call.tileX + 0.5);
  const dy = tileY - (call.tileY + 0.5);
  if (dx * dx + dy * dy > radius * radius) {
    if (call.phase === "accepted") {
      call.phase = "traveling";
      writePlayer(player);
      return player;
    }
    return null;
  }
  call.phase = "arrived";
  writePlayer(player);
  return player;
}

export function nearPoliceCallObjective(
  call: PoliceCall,
  tileX: number,
  tileY: number,
  radius = 1.8,
) {
  const tx =
    call.kind === "lost_resident" && call.phase === "resolving" && call.destTileX != null
      ? call.destTileX
      : call.tileX;
  const ty =
    call.kind === "lost_resident" && call.phase === "resolving" && call.destTileY != null
      ? call.destTileY
      : call.tileY;
  const dx = tileX - (tx + 0.5);
  const dy = tileY - (ty + 0.5);
  return dx * dx + dy * dy <= radius * radius;
}

export function policeCallPrompt(
  call: PoliceCall,
  playerTile?: { x: number; y: number },
): { label: string; next: PoliceCallPhase } | null {
  switch (call.kind) {
    case "traffic_incident":
      if (call.phase === "arrived") return { label: "Inspect vehicle", next: "inspecting" };
      if (call.phase === "inspecting") return { label: "Place warning cones", next: "placing_cones" };
      if (call.phase === "placing_cones") return { label: "Clear the road", next: "clearing" };
      if (call.phase === "clearing") return { label: "Confirm road safe", next: "completed" };
      return null;
    case "lost_resident": {
      const who = call.residentName ?? "resident";
      if (call.phase === "arrived") return { label: `Talk to ${who}`, next: "resolving" };
      if (call.phase === "resolving") {
        if (playerTile && nearPoliceCallObjective(call, playerTile.x, playerTile.y)) {
          return { label: `See ${who} inside`, next: "completed" };
        }
        return null;
      }
      return null;
    }
    case "suspicious_activity":
      if (call.phase === "arrived") return { label: "Talk to reporting NPC", next: "inspecting" };
      if (call.phase === "inspecting") return { label: "Inspect the area", next: "resolving" };
      if (call.phase === "resolving") return { label: "Document findings", next: "completed" };
      return null;
  }
}

/**
 * Field work is done — no pay yet. Waypoint returns to the station so the
 * officer can click Finish at the desk and collect the reward.
 */
export function reportPoliceCallDone(state: CityState): PlayerState | string {
  const player = readPlayer();
  const call = player.policeCall;
  if (!call) return "No active call.";
  if (!player.policeShift) return "You are not on a police shift.";
  if (call.phase === "completed") return player;

  const prompt = policeCallPrompt(call);
  if (prompt?.next !== "completed") {
    return "Keep working the call.";
  }

  call.phase = "completed";
  writePlayer(player);
  setStationFinishWaypoint(state, player.policeShift.stationId, call);
  return readPlayer();
}

/** Collect pay for a completed call at the station desk. */
export function finishPoliceCall(state: CityState): PlayerState | string {
  const player = readPlayer();
  const call = player.policeCall;
  if (!call) return "No completed call to finish.";
  if (call.phase !== "completed") return "Finish the field work on this call first.";
  if (!player.policeCareer) player.policeCareer = emptyPoliceCareer();
  if (!player.policeShift) return "You are not on a police shift.";

  const pay = call.reward;
  const xp = call.xp;
  player.policeCareer.xp += xp;
  player.policeCareer.completedCalls += 1;
  player.policeCareer.totalEarnings += pay;
  player.policeShift.callsCompleted += 1;
  player.policeShift.earnings += pay;
  player.policeShift.xpEarned += xp;

  const rank = policeRank(player.policeCareer.xp);
  if (rank.id !== "cadet" && !player.policeCareer.unlockedVehicles.includes("police_cruiser")) {
    player.policeCareer.unlockedVehicles.push("police_cruiser");
  }

  const callId = call.id;
  const callTitle = call.title;
  player.policeCall = null;
  writePlayer(player);

  earnCash(pay, state.clock, `Police · ${callTitle}`);
  awardXp(Math.round(xp * 0.6), `police:${callId}`, "career");
  setPhoneWaypoint(null);
  return readPlayer();
}

/** @deprecated Use reportPoliceCallDone + finishPoliceCall. */
export function completePoliceCall(state: CityState): PlayerState | string {
  return finishPoliceCall(state);
}

function setStationFinishWaypoint(
  state: CityState,
  stationId: string,
  call: PoliceCall,
) {
  const station = state.buildings.get(stationId);
  if (!station) {
    setPhoneWaypoint({
      x: call.tileX,
      y: call.tileY,
      label: `Finish · ${call.title}`,
    });
    return;
  }
  setPhoneWaypoint({
    x: station.origin.x + station.width / 2,
    y: station.origin.y + station.depth / 2,
    label: `Finish · ${station.name}`,
  });
}

export { wardrobeLockedWhileOnDuty };
