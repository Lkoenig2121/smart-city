import type { Building, CityClock, CityState } from "@/lib/city/types";
import { venueRole } from "@/lib/city/venues";

const STORAGE = "smartcity-player";
const STARTING_WALLET = 500;
const LEDGER_LIMIT = 40;

export const OFFICE_SHIFT_START = 9 * 60;
export const OFFICE_SHIFT_END = 22 * 60;
export const OFFICE_TASK_COUNT = 10;
export const OFFICE_TASK_MINUTES = 30;

export const OFFICE_RANKS = [
  { id: "intern", label: "Intern", xp: 0, salary: 500, taskPay: 50 },
  { id: "junior", label: "Junior employee", xp: 400, salary: 600, taskPay: 60 },
  { id: "senior", label: "Senior employee", xp: 1000, salary: 750, taskPay: 75 },
  { id: "manager", label: "Manager", xp: 2000, salary: 950, taskPay: 95 },
  { id: "executive", label: "Executive", xp: 3500, salary: 1200, taskPay: 120 },
] as const;

export type CareerId = "office_worker";
export type LedgerKind = "earn" | "spend" | "deposit" | "withdraw";

export interface LedgerEntry {
  id: string;
  amount: number;
  kind: LedgerKind;
  description: string;
  year: number;
  dayOfYear: number;
  minuteOfDay: number;
}

export interface OfficeCareer {
  id: CareerId;
  employerId: string;
  employerName: string;
  xp: number;
  lastShiftDay: string | null;
}

export interface ActiveShift {
  careerId: CareerId;
  buildingId: string;
  dayKey: string;
  completedTaskIds: string[];
  taskEarnings: number;
}

export interface PlayerState {
  wallet: number;
  bank: number;
  ledger: LedgerEntry[];
  career: OfficeCareer | null;
  shift: ActiveShift | null;
}

export function emptyPlayer(): PlayerState {
  return { wallet: STARTING_WALLET, bank: 0, ledger: [], career: null, shift: null };
}

export function readPlayer(): PlayerState {
  if (typeof window === "undefined") return emptyPlayer();
  try {
    const raw = window.localStorage.getItem(STORAGE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsePlayer(parsed);
  } catch {
    return emptyPlayer();
  }
}

export function totalBalance(player: PlayerState) {
  return player.wallet + player.bank;
}

export function dayKey(clock: CityClock) {
  return `${clock.year}-${clock.dayOfYear}`;
}

export function officeRank(xp: number) {
  let rank: (typeof OFFICE_RANKS)[number] = OFFICE_RANKS[0];
  for (const next of OFFICE_RANKS) {
    if (xp >= next.xp) rank = next;
  }
  return rank;
}

export function nextOfficeRank(xp: number) {
  const current = officeRank(xp);
  const index = OFFICE_RANKS.findIndex((rank) => rank.id === current.id);
  return OFFICE_RANKS[index + 1] ?? null;
}

export function formatDollars(value: number) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString()}`;
}

export function inOfficeHours(clock: CityClock) {
  return clock.minuteOfDay >= OFFICE_SHIFT_START && clock.minuteOfDay <= OFFICE_SHIFT_END;
}

export function worksHere(player: PlayerState, buildingId: string) {
  return player.career?.id === "office_worker" && player.career.employerId === buildingId;
}

export function applyForOffice(building: Building): PlayerState | string {
  if (venueRole(building) !== "office") return "This is not an office.";
  const player = readPlayer();
  if (player.career) {
    if (worksHere(player, building.id)) return "You already work here.";
    return `Quit your job at ${player.career.employerName} first.`;
  }
  player.career = {
    id: "office_worker",
    employerId: building.id,
    employerName: building.name,
    xp: 0,
    lastShiftDay: null,
  };
  writePlayer(player);
  return player;
}

export function quitJob(): PlayerState | string {
  const player = readPlayer();
  if (!player.career) return "You do not have a job.";
  if (player.shift) abandonShift(player);
  player.career = null;
  writePlayer(player);
  return player;
}

export function startOfficeShift(building: Building, state: CityState): PlayerState | string {
  const player = readPlayer();
  if (venueRole(building) !== "office") return "This is not an office.";
  if (player.career && player.career.id !== "office_worker") {
    return `Quit your job at ${player.career.employerName} first.`;
  }
  if (!player.career) {
    const hired = applyForOffice(building);
    if (typeof hired === "string") return hired;
  }
  if (!inOfficeHours(state.clock)) return "Office hours are 9:00 AM to 10:00 PM.";
  const today = dayKey(state.clock);
  const latest = readPlayer();
  if (latest.shift && latest.shift.dayKey === today) return latest;
  if (latest.career?.lastShiftDay === today) return "Your shift for today is already done.";
  latest.shift = {
    careerId: "office_worker",
    buildingId: building.id,
    dayKey: today,
    completedTaskIds: [],
    taskEarnings: 0,
  };
  writePlayer(latest);
  return latest;
}

export function completeShiftTask(
  taskId: string,
  pay: number,
  xp: number,
  description: string,
  state: CityState,
): PlayerState | string {
  const player = readPlayer();
  if (!player.shift) return "You are not on the clock.";
  if (player.shift.completedTaskIds.includes(taskId)) return "That assignment is already done.";
  const earned = Math.max(0, Math.round(pay));
  player.shift.completedTaskIds.push(taskId);
  player.shift.taskEarnings += earned;
  if (player.career) player.career.xp += Math.max(0, Math.round(xp));
  credit(player, earned, description, state.clock);
  writePlayer(player);
  return player;
}

export function endOfficeShift(state: CityState): PlayerState | string {
  const player = readPlayer();
  if (!player.shift) return "You are not on the clock.";
  settleShift(player, state.clock, true);
  writePlayer(player);
  return player;
}

/** Closes an open shift when the workday ends or the player sleeps through it. */
export function syncPlayerShift(state: CityState) {
  const player = readPlayer();
  if (!player.shift) return;
  const today = dayKey(state.clock);
  const closed = player.shift.dayKey !== today || state.clock.minuteOfDay > OFFICE_SHIFT_END;
  if (!closed) return;
  settleShift(player, state.clock, player.shift.dayKey === today && state.clock.minuteOfDay > OFFICE_SHIFT_END);
  writePlayer(player);
}

export function abandonOpenShift() {
  const player = readPlayer();
  if (!player.shift) return;
  abandonShift(player);
  writePlayer(player);
}

export function depositToBank(amount: number, clock: CityClock): PlayerState | string {
  const player = readPlayer();
  const value = Math.round(amount);
  if (value < 1) return "Deposit at least $1.";
  if (player.wallet < value) return "Not enough cash in your wallet.";
  player.wallet -= value;
  player.bank += value;
  pushLedger(player, value, "deposit", `Deposited ${formatDollars(value)}`, clock);
  writePlayer(player);
  return player;
}

export function withdrawFromBank(amount: number, clock: CityClock): PlayerState | string {
  const player = readPlayer();
  const value = Math.round(amount);
  if (value < 1) return "Withdraw at least $1.";
  if (player.bank < value) return "Not enough in the bank.";
  player.bank -= value;
  player.wallet += value;
  pushLedger(player, value, "withdraw", `Withdrew ${formatDollars(value)}`, clock);
  writePlayer(player);
  return player;
}

function settleShift(player: PlayerState, _clock: CityClock, _payRemainder: boolean) {
  const shift = player.shift;
  if (!shift) return;
  if (player.career) player.career.lastShiftDay = shift.dayKey;
  player.shift = null;
}

function abandonShift(player: PlayerState) {
  if (!player.shift) return;
  if (player.career) player.career.lastShiftDay = player.shift.dayKey;
  player.shift = null;
}

function credit(player: PlayerState, amount: number, description: string, clock: CityClock) {
  if (amount <= 0) return;
  player.wallet += amount;
  pushLedger(player, amount, "earn", description, clock);
}

function pushLedger(
  player: PlayerState,
  amount: number,
  kind: LedgerKind,
  description: string,
  clock: CityClock,
) {
  player.ledger.unshift({
    id: `tx-${clock.year}-${clock.dayOfYear}-${clock.minuteOfDay}-${Math.random().toString(36).slice(2, 8)}`,
    amount,
    kind,
    description,
    year: clock.year,
    dayOfYear: clock.dayOfYear,
    minuteOfDay: clock.minuteOfDay,
  });
  if (player.ledger.length > LEDGER_LIMIT) player.ledger.length = LEDGER_LIMIT;
}

function writePlayer(player: PlayerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE, JSON.stringify(player));
}

function parsePlayer(value: unknown): PlayerState {
  const fallback = emptyPlayer();
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<PlayerState>;
  const wallet = Number(raw.wallet);
  const bank = Number(raw.bank);
  return {
    wallet: Number.isFinite(wallet) && wallet >= 0 ? wallet : fallback.wallet,
    bank: Number.isFinite(bank) && bank >= 0 ? bank : 0,
    ledger: Array.isArray(raw.ledger) ? raw.ledger.filter(isLedgerEntry).slice(0, LEDGER_LIMIT) : [],
    career: parseCareer(raw.career),
    shift: parseShift(raw.shift),
  };
}

function isLedgerEntry(value: unknown): value is LedgerEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as LedgerEntry;
  return (
    typeof entry.id === "string" &&
    Number.isFinite(entry.amount) &&
    (entry.kind === "earn" || entry.kind === "spend" || entry.kind === "deposit" || entry.kind === "withdraw") &&
    typeof entry.description === "string"
  );
}

function parseCareer(value: unknown): OfficeCareer | null {
  if (!value || typeof value !== "object") return null;
  const career = value as OfficeCareer;
  if (career.id !== "office_worker") return null;
  if (typeof career.employerId !== "string" || typeof career.employerName !== "string") return null;
  const xp = Number(career.xp);
  return {
    id: "office_worker",
    employerId: career.employerId,
    employerName: career.employerName,
    xp: Number.isFinite(xp) && xp >= 0 ? xp : 0,
    lastShiftDay: typeof career.lastShiftDay === "string" ? career.lastShiftDay : null,
  };
}

function parseShift(value: unknown): ActiveShift | null {
  if (!value || typeof value !== "object") return null;
  const shift = value as ActiveShift;
  if (shift.careerId !== "office_worker") return null;
  if (typeof shift.buildingId !== "string" || typeof shift.dayKey !== "string") return null;
  const taskEarnings = Number(shift.taskEarnings);
  return {
    careerId: "office_worker",
    buildingId: shift.buildingId,
    dayKey: shift.dayKey,
    completedTaskIds: Array.isArray(shift.completedTaskIds)
      ? shift.completedTaskIds.filter((id): id is string => typeof id === "string")
      : [],
    taskEarnings: Number.isFinite(taskEarnings) && taskEarnings >= 0 ? taskEarnings : 0,
  };
}
