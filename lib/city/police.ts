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
import type { OwnedVehicle } from "./vehicles";
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
  /** Has to be worked from the department cruiser (C while on duty). */
  needsCruiser?: boolean;
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

const VIP_NAMES = ["Mayor Alvarez", "Councilmember Okafor", "Judge Whitfield", "Senator Lindqvist"] as const;
const SUSPECT_CARS = [
  { model: "Dark sedan", color: "#2b2f36", category: "sedan" },
  { model: "Red hatchback", color: "#b8322a", category: "compact" },
  { model: "Silver SUV", color: "#aeb4bb", category: "suv" },
  { model: "Yellow coupe", color: "#e1b530", category: "sports" },
  { model: "Green wagon", color: "#2f6b48", category: "sedan" },
] as const;

/** Missions in rank order. Driving missions pick live road tiles when accepted. */
export const POLICE_CALL_CATALOG: PoliceCallDef[] = [
  {
    kind: "patrol",
    title: "Patrol Neighborhood",
    blurb: "Drive the cruiser through four checkpoints and keep the streets calm.",
    locationLabel: "Patrol route",
    tileX: 0,
    tileY: 0,
    reward: 120,
    xp: 30,
    minRank: "cadet",
    needsCruiser: true,
  },
  {
    kind: "traffic_stop",
    title: "Traffic Stop",
    blurb: "A speeder was clocked nearby. Catch up, hit your lights, and pull them over.",
    locationLabel: "Speeding report",
    tileX: 0,
    tileY: 0,
    reward: 140,
    xp: 35,
    minRank: "cadet",
    needsCruiser: true,
  },
  {
    kind: "traffic_incident",
    title: "Respond to Accident",
    blurb: "A fender-bender has blocked the plaza edge by the avenue. Secure the scene.",
    locationLabel: "Downtown Plaza",
    tileX: TRAFFIC_INCIDENT_SITE.x,
    tileY: TRAFFIC_INCIDENT_SITE.y,
    reward: 100,
    xp: 25,
    minRank: "cadet",
  },
  {
    kind: "suspicious_activity",
    title: "Respond to Disturbance",
    blurb: "Shouting reported in the park square by the mall. Talk to the caller and check it out.",
    locationLabel: "Park Square",
    tileX: SUSPICIOUS_ACTIVITY_SITE.x,
    tileY: SUSPICIOUS_ACTIVITY_SITE.y,
    reward: 150,
    xp: 35,
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
    kind: "stolen_vehicle",
    title: "Find Stolen Vehicle",
    blurb: "A car was reported stolen. Search near the last sighting and recover it.",
    locationLabel: "Last sighting",
    tileX: 0,
    tileY: 0,
    reward: 220,
    xp: 45,
    minRank: "patrol",
  },
  {
    kind: "vip_escort",
    title: "Escort VIP",
    blurb: "Pick up a VIP motorcade and lead it across town. Don't lose the limo.",
    locationLabel: "Motorcade pickup",
    tileX: 0,
    tileY: 0,
    reward: 300,
    xp: 60,
    minRank: "patrol",
    needsCruiser: true,
  },
  {
    kind: "pursuit",
    title: "Pursuit",
    blurb: "Armed robbery suspect fleeing by car. Chase them down and box them in.",
    locationLabel: "Robbery in progress",
    tileX: 0,
    tileY: 0,
    reward: 400,
    xp: 80,
    minRank: "senior",
    needsCruiser: true,
  },
];

/** Missions worked from the street scene (NPC cars / checkpoints), not tile arrival. */
export const SCENE_DRIVEN_CALLS: readonly PoliceCallKind[] = [
  "traffic_stop",
  "stolen_vehicle",
  "vip_escort",
  "patrol",
  "pursuit",
];

export const POLICE_CRUISER_ID = "police-cruiser";

/** Department car issued at clock-in. Patrol Officers and up get the interceptor tune. */
export function policeCruiser(player: PlayerState): OwnedVehicle {
  const rank = policeRank(player.policeCareer?.xp ?? 0);
  const interceptor = rank.id !== "cadet";
  return {
    id: POLICE_CRUISER_ID,
    catalogId: interceptor ? "police-interceptor" : "police-cruiser",
    model: interceptor ? "Police Interceptor" : "Police Cruiser",
    category: "sedan",
    purchasePrice: 0,
    currentValue: 0,
    color: "#f4f4f2",
    mileage: 0,
    fuel: 100,
    condition: 100,
    licensePlate: "RPD-01",
    garageLocation: "police",
    upgrades: { performance: 0 },
    wheels: "stock",
    interior: "cloth",
    accessories: [],
    owned: true,
    parkX: 0,
    parkY: 0,
    parkYaw: 0,
  };
}

export function isPoliceCruiser(id: string | null | undefined) {
  return id === POLICE_CRUISER_ID;
}

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

export function policeRankLabel(id: PoliceRankId) {
  return POLICE_RANKS.find((rank) => rank.id === id)?.label ?? id;
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

function rankIndex(id: PoliceRankId) {
  return POLICE_RANKS.findIndex((r) => r.id === id);
}

export function availablePoliceCalls(player: PlayerState): PoliceCallDef[] {
  const career = player.policeCareer ?? emptyPoliceCareer();
  const current = rankIndex(policeRank(career.xp).id);
  return POLICE_CALL_CATALOG.filter((call) => rankIndex(call.minRank) <= current).map((call) => ({
    ...call,
    reward: policeCallPay(call.reward, career.xp),
  }));
}

/** Missions still behind a promotion — shown greyed out so there's something to work toward. */
export function lockedPoliceCalls(player: PlayerState): PoliceCallDef[] {
  const current = rankIndex(policeRank(player.policeCareer?.xp ?? 0).id);
  return POLICE_CALL_CATALOG.filter((call) => rankIndex(call.minRank) > current);
}

export function startPoliceShift(building: Building, state: CityState): PlayerState | string {
  if (!isPoliceStation(building)) return "Start your shift at a police station.";
  const player = readPlayer();
  if (player.shift) return "Clock out of your office job first.";
  if (player.doctorShift) return "Clock out of the hospital first.";
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

// ── Mission placement on the live road grid ─────────────────────────────

type Tile = { x: number; y: number };

function isDrivable(state: CityState, x: number, y: number) {
  const tile = state.tiles[y]?.[x];
  return Boolean(tile?.road && !tile.bridge);
}

function stationTile(state: CityState, player: PlayerState): Tile {
  const station = player.policeShift ? state.buildings.get(player.policeShift.stationId) : null;
  if (station) {
    return {
      x: Math.floor(station.origin.x + station.width / 2),
      y: Math.floor(station.origin.y + station.depth / 2),
    };
  }
  return { x: Math.floor(state.size / 2), y: Math.floor(state.size / 2) };
}

/** Random road tile `min..max` tiles (Manhattan) from `from`. Falls back to the nearest road. */
function roadTileAround(state: CityState, from: Tile, min: number, max: number, avoid: Tile[] = []): Tile {
  const picks: Tile[] = [];
  for (let y = Math.max(0, from.y - max); y <= Math.min(state.size - 1, from.y + max); y++) {
    for (let x = Math.max(0, from.x - max); x <= Math.min(state.size - 1, from.x + max); x++) {
      const d = Math.abs(x - from.x) + Math.abs(y - from.y);
      if (d < min || d > max || !isDrivable(state, x, y)) continue;
      if (avoid.some((a) => Math.abs(a.x - x) + Math.abs(a.y - y) < 4)) continue;
      picks.push({ x, y });
    }
  }
  if (picks.length) return picks[Math.floor(Math.random() * picks.length)];
  for (let r = 0; r < state.size; r++) {
    for (let y = from.y - r; y <= from.y + r; y++) {
      for (let x = from.x - r; x <= from.x + r; x++) {
        if (isDrivable(state, x, y)) return { x, y };
      }
    }
  }
  return from;
}

function roadBeside(state: CityState, building: Building | undefined): Tile | null {
  if (!building) return null;
  const cx = Math.floor(building.origin.x + building.width / 2);
  const cy = Math.floor(building.origin.y + building.depth / 2);
  let best: Tile | null = null;
  let bestD = Infinity;
  for (let y = building.origin.y - 2; y <= building.origin.y + building.depth + 1; y++) {
    for (let x = building.origin.x - 2; x <= building.origin.x + building.width + 1; x++) {
      if (!isDrivable(state, x, y)) continue;
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}

function findBuilding(state: CityState, test: (b: Building) => boolean) {
  for (const building of state.buildings.values()) if (test(building)) return building;
  return undefined;
}

function plate() {
  const letters = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const pick = () => letters[Math.floor(Math.random() * letters.length)];
  return `${pick()}${pick()}${pick()}-${Math.floor(100 + Math.random() * 900)}`;
}

function pickOne<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function planCall(def: PoliceCallDef, state: CityState | undefined, player: PlayerState): Partial<PoliceCall> | string {
  if (!SCENE_DRIVEN_CALLS.includes(def.kind)) {
    if (def.kind === "lost_resident") {
      return {
        residentName: pickOne(LOST_RESIDENT_NAMES),
        destTileX: LOST_RESIDENT_HOME.x,
        destTileY: LOST_RESIDENT_HOME.y,
      };
    }
    return {};
  }
  if (!state) return "Dispatch needs the city map — open it from the street.";
  const home = stationTile(state, player);
  const car = pickOne(SUSPECT_CARS);

  switch (def.kind) {
    case "patrol": {
      const hub = roadTileAround(state, home, 4, 9);
      const checkpoints: Tile[] = [];
      for (let i = 0; i < 4; i++) checkpoints.push(roadTileAround(state, hub, 3, 7, checkpoints));
      return { tileX: checkpoints[0].x, tileY: checkpoints[0].y, checkpoints, checkpoint: 0 };
    }
    case "traffic_stop": {
      const spot = roadTileAround(state, home, 5, 10);
      return { tileX: spot.x, tileY: spot.y, plate: plate(), vehicleColor: car.color, vehicleModel: car.model };
    }
    case "stolen_vehicle": {
      const target = roadTileAround(state, home, 7, 14);
      const sighting = roadTileAround(state, target, 1, 3);
      return {
        tileX: sighting.x,
        tileY: sighting.y,
        targetTileX: target.x,
        targetTileY: target.y,
        plate: plate(),
        vehicleColor: car.color,
        vehicleModel: car.model,
      };
    }
    case "vip_escort": {
      const hall = findBuilding(state, (b) => b.kind === "city_hall" || venueRole(b) === "city_hall");
      const pickup = roadBeside(state, hall) ?? roadTileAround(state, home, 4, 8);
      const venues = [...state.buildings.values()].filter(
        (b) => b.kind === "baseball_stadium" || Boolean(b.stats.extra?.lodging) || venueRole(b) === "mall",
      );
      const far = venues
        .map((b) => ({ b, tile: roadBeside(state, b) }))
        .filter((v): v is { b: Building; tile: Tile } => Boolean(v.tile))
        .filter((v) => Math.abs(v.tile.x - pickup.x) + Math.abs(v.tile.y - pickup.y) >= 6);
      const dest = far.length ? pickOne(far) : null;
      const drop = dest?.tile ?? roadTileAround(state, pickup, 8, 14);
      return {
        tileX: pickup.x,
        tileY: pickup.y,
        destTileX: drop.x,
        destTileY: drop.y,
        destLabel: dest?.b.name || "the drop-off",
        vipName: pickOne(VIP_NAMES),
        locationLabel: hall?.name || "Motorcade pickup",
      };
    }
    case "pursuit": {
      const spot = roadTileAround(state, home, 5, 10);
      return { tileX: spot.x, tileY: spot.y, plate: plate(), vehicleColor: car.color, vehicleModel: car.model };
    }
    default:
      return {};
  }
}

function waypointFor(call: PoliceCall) {
  switch (call.kind) {
    case "patrol":
      return { x: call.tileX, y: call.tileY, label: `Patrol checkpoint ${(call.checkpoint ?? 0) + 1}/4` };
    case "traffic_stop":
      return { x: call.tileX, y: call.tileY, label: `Speeder · ${call.vehicleModel ?? "vehicle"}` };
    case "stolen_vehicle":
      return { x: call.tileX, y: call.tileY, label: `Last seen · ${call.plate ?? "stolen car"}` };
    case "vip_escort":
      return { x: call.tileX, y: call.tileY, label: `Pick up ${call.vipName ?? "the VIP"}` };
    case "pursuit":
      return { x: call.tileX, y: call.tileY, label: "Robbery in progress" };
    case "lost_resident":
      return { x: call.tileX, y: call.tileY, label: `${call.residentName ?? "Resident"} · ${call.title}` };
    default:
      return { x: call.tileX, y: call.tileY, label: call.title };
  }
}

export function acceptPoliceCall(kind: PoliceCallKind, state?: CityState): PlayerState | string {
  const player = readPlayer();
  if (!player.policeShift) return "Start a police shift first.";
  if (player.policeCall) return "Finish your current call first.";
  const def = availablePoliceCalls(player).find((call) => call.kind === kind);
  if (!def) return "That call is not available at your rank yet.";
  const plan = planCall(def, state, player);
  if (typeof plan === "string") return plan;

  const call: PoliceCall = {
    id: `call-${kind}-${Date.now()}`,
    kind: def.kind,
    phase: "accepted",
    title: def.title,
    locationLabel: def.locationLabel,
    tileX: def.tileX,
    tileY: def.tileY,
    // `def.reward` is already rank-scaled via availablePoliceCalls.
    reward: def.reward,
    xp: def.xp,
    acceptedAt: Date.now(),
    ...plan,
  };
  player.policeCall = call;
  writePlayer(player);
  setPhoneWaypoint(waypointFor(call));
  return player;
}

/** Desk / radio dispatch: hand out a random mission open at this rank. */
export function receivePoliceMission(state: CityState): PlayerState | string {
  const player = readPlayer();
  const calls = availablePoliceCalls(player);
  if (!calls.length) return "Dispatch is quiet.";
  // Lean toward the newest unlocks so promotions actually change the work.
  const weighted = calls.flatMap((call) => Array(1 + rankIndex(call.minRank) * 2 + (call.needsCruiser ? 1 : 0)).fill(call));
  return acceptPoliceCall(pickOne(weighted).kind, state);
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
  if (SCENE_DRIVEN_CALLS.includes(call.kind)) return null;

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

/** Phases where the officer is on foot at the scene and E steps the call forward. */
export const POLICE_PROMPT_PHASES: readonly PoliceCallPhase[] = [
  "arrived",
  "inspecting",
  "placing_cones",
  "clearing",
  "resolving",
  "stopped",
];

export function policeCallPrompt(
  call: PoliceCall,
  playerTile?: { x: number; y: number },
): { label: string; next: PoliceCallPhase } | null {
  switch (call.kind) {
    case "traffic_incident":
      if (call.phase === "arrived") return { label: "Check on the drivers", next: "inspecting" };
      if (call.phase === "inspecting") return { label: "Place warning cones", next: "placing_cones" };
      if (call.phase === "placing_cones") return { label: "Clear the wreck", next: "clearing" };
      if (call.phase === "clearing") return { label: "Reopen the road", next: "completed" };
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
      if (call.phase === "arrived") return { label: "Talk to the caller", next: "inspecting" };
      if (call.phase === "inspecting") return { label: "Calm the crowd down", next: "resolving" };
      if (call.phase === "resolving") return { label: "Write up the report", next: "completed" };
      return null;
    case "traffic_stop":
      if (call.phase === "stopped") return { label: "Talk to the driver", next: "inspecting" };
      if (call.phase === "inspecting") return { label: "Check license & registration", next: "resolving" };
      if (call.phase === "resolving") return { label: "Issue the citation", next: "completed" };
      return null;
    case "stolen_vehicle":
      if (call.phase === "arrived") return { label: `Run plate ${call.plate ?? ""}`.trim(), next: "inspecting" };
      if (call.phase === "inspecting") return { label: "Radio for a tow truck", next: "resolving" };
      if (call.phase === "resolving") return { label: "Hand the car to the tow crew", next: "completed" };
      return null;
    case "pursuit":
      if (call.phase === "stopped") return { label: "Order the suspect out", next: "inspecting" };
      if (call.phase === "inspecting") return { label: "Make the arrest", next: "resolving" };
      if (call.phase === "resolving") return { label: "Read them their rights", next: "completed" };
      return null;
    case "vip_escort":
    case "patrol":
      return null;
  }
}

export interface PoliceObjectiveContext {
  inCruiser: boolean;
  driving: boolean;
  lights: boolean;
  /** Extra hint from the street scene (VIP distance, suspect distance…). */
  sceneNote?: string | null;
}

/** One line telling the officer what to do next — shown on the duty HUD. */
export function policeObjective(call: PoliceCall | null, ctx: PoliceObjectiveContext): string {
  if (!call) return "Open dispatch on the phone (M) or take a mission at the station desk.";
  if (call.phase === "completed") return "Field work done — drive back to the station desk to get paid.";
  const def = POLICE_CALL_CATALOG.find((d) => d.kind === call.kind);
  const needCar = def?.needsCruiser && !ctx.inCruiser && !POLICE_PROMPT_PHASES.includes(call.phase);
  if (needCar) return ctx.driving ? "Swap into the department cruiser — press E, then C." : "Press C to take the department cruiser.";
  const note = ctx.sceneNote ? ` · ${ctx.sceneNote}` : "";
  switch (call.kind) {
    case "patrol":
      return `Drive through checkpoint ${(call.checkpoint ?? 0) + 1} of ${call.checkpoints?.length ?? 4}${note}`;
    case "traffic_stop":
      if (call.phase === "pursuing") {
        return ctx.lights
          ? `Stay right behind the ${call.vehicleModel ?? "speeder"} until they pull over${note}`
          : `Catch the ${call.vehicleModel ?? "speeder"} and hit your lights (L)${note}`;
      }
      if (call.phase === "stopped") return "Step out (E) and walk up to the driver's window.";
      if (POLICE_PROMPT_PHASES.includes(call.phase)) return "Finish the stop at the driver's window (E).";
      return "Follow the GPS to the speeding report.";
    case "stolen_vehicle":
      if (call.phase === "arrived" || call.phase === "inspecting" || call.phase === "resolving") {
        return `Recover the ${call.vehicleModel ?? "car"} — press E beside it.`;
      }
      return `Search near the last sighting for a ${call.vehicleModel?.toLowerCase() ?? "car"}, plate ${call.plate ?? "?"}. Look for hazard lights${note}`;
    case "vip_escort":
      if (call.phase === "escorting") return `Lead ${call.vipName ?? "the VIP"} to ${call.destLabel ?? "the drop-off"}${note}`;
      return `Drive to the pickup to meet ${call.vipName ?? "the VIP"}'s limo.`;
    case "pursuit":
      if (call.phase === "pursuing") {
        return `Chase the ${call.vehicleModel ?? "suspect"} (${call.plate ?? "?"}) — stay on their bumper to box them in${note}`;
      }
      if (call.phase === "stopped") return "Suspect boxed in — step out (E) and make the arrest.";
      if (POLICE_PROMPT_PHASES.includes(call.phase)) return "Finish the arrest (E).";
      return "Lights on (L) and follow the GPS to the robbery.";
    default:
      if (POLICE_PROMPT_PHASES.includes(call.phase)) return "Work the scene — press E at the marker.";
      return `Follow the GPS to ${call.locationLabel}.`;
  }
}

// ── Street-scene events (NPC cars, checkpoints) ─────────────────────────

export type PoliceSceneEvent =
  | { type: "checkpoint" }
  | { type: "spotted" }
  | { type: "stopped"; x: number; y: number }
  | { type: "found"; x: number; y: number }
  | { type: "vip_ready" }
  | { type: "vip_delivered" }
  | { type: "escaped" };

export interface PoliceSceneResult {
  player: PlayerState;
  note: string;
  /** The call ended without pay (suspect got away). */
  failed?: boolean;
}

/** Applies something that happened on the street to the active call. */
export function applyPoliceSceneEvent(state: CityState, event: PoliceSceneEvent): PoliceSceneResult | null {
  const player = readPlayer();
  const call = player.policeCall;
  if (!call || call.phase === "completed") return null;

  switch (event.type) {
    case "checkpoint": {
      if (call.kind !== "patrol" || !call.checkpoints) return null;
      const done = (call.checkpoint ?? 0) + 1;
      if (done >= call.checkpoints.length) {
        markFieldWorkDone(state, player);
        return { player: readPlayer(), note: "Patrol complete · all quiet. Head back to the station." };
      }
      call.checkpoint = done;
      call.phase = "patrolling";
      call.tileX = call.checkpoints[done].x;
      call.tileY = call.checkpoints[done].y;
      writePlayer(player);
      setPhoneWaypoint(waypointFor(call));
      return { player, note: `Checkpoint ${done}/${call.checkpoints.length} clear.` };
    }
    case "spotted": {
      if (call.phase === "pursuing") return null;
      call.phase = "pursuing";
      writePlayer(player);
      return {
        player,
        note: call.kind === "pursuit" ? "Suspect spotted — they're running!" : `There's the ${call.vehicleModel ?? "speeder"}.`,
      };
    }
    case "stopped": {
      call.phase = "stopped";
      // nearPoliceCallObjective adds 0.5 to recentre on the tile.
      call.tileX = event.x - 0.5;
      call.tileY = event.y - 0.5;
      writePlayer(player);
      setPhoneWaypoint({ x: Math.floor(event.x), y: Math.floor(event.y), label: call.kind === "pursuit" ? "Suspect" : "Pulled-over car" });
      return {
        player,
        note: call.kind === "pursuit" ? "Suspect boxed in!" : "The driver pulled over.",
      };
    }
    case "found": {
      call.phase = "arrived";
      call.tileX = event.x - 0.5;
      call.tileY = event.y - 0.5;
      writePlayer(player);
      setPhoneWaypoint({ x: Math.floor(event.x), y: Math.floor(event.y), label: `Stolen car · ${call.plate ?? ""}` });
      return { player, note: `Found it — plate ${call.plate ?? "matches"}.` };
    }
    case "vip_ready": {
      if (call.kind !== "vip_escort" || call.phase === "escorting") return null;
      call.phase = "escorting";
      writePlayer(player);
      if (call.destTileX != null && call.destTileY != null) {
        setPhoneWaypoint({ x: call.destTileX, y: call.destTileY, label: `Escort · ${call.destLabel ?? "drop-off"}` });
      }
      return { player, note: `${call.vipName ?? "The VIP"} is behind you. Drive steady.` };
    }
    case "vip_delivered": {
      markFieldWorkDone(state, player);
      return { player: readPlayer(), note: `${call.vipName ?? "The VIP"} arrived safely.` };
    }
    case "escaped": {
      player.policeCall = null;
      writePlayer(player);
      setPhoneWaypoint(null);
      return { player, note: "The suspect got away. Dispatch has other calls.", failed: true };
    }
  }
}

function markFieldWorkDone(state: CityState, player: PlayerState) {
  const call = player.policeCall;
  if (!call || !player.policeShift) return;
  call.phase = "completed";
  writePlayer(player);
  setStationFinishWaypoint(state, player.policeShift.stationId, call);
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

  markFieldWorkDone(state, player);
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
  if (rank.id !== "cadet" && !player.policeCareer.unlockedVehicles.includes("police_interceptor")) {
    player.policeCareer.unlockedVehicles.push("police_interceptor");
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
