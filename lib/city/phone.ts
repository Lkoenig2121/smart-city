import type { Building, CityClock, CityState } from "@/lib/city/types";
import { MONTH_DAYS, MONTH_NAMES, formatLongDate, monthDayFromDoy, weekdayOf } from "./calendar";
import { isJobBuilding, poiKind, type PoiKind } from "./minimapPois";
import {
  OFFICE_SHIFT_END,
  OFFICE_SHIFT_START,
  applyForOffice,
  dayKey,
  type PlayerState,
} from "./player";
import { GAME_END_MINUTE, GAME_START_MINUTE, findStadium, stadiumGateTile } from "./stadium";
import { lodgingGateTile, lodgingUse } from "./lodging";
import { isSubwayStation, subwayGateTile } from "./subway";
import { findMall, findVenue, venueGateTile, venueRole } from "./venues";
import { formatClockMinutes } from "@/lib/simulation/weather/weather";
import { DUSTFALL_UNLOCK_LEVEL } from "./cityProgress";

const STORAGE = "smartcity-phone";

export type PhoneApp =
  | "home"
  | "messages"
  | "thread"
  | "calendar"
  | "maps"
  | "bank"
  | "jobs"
  | "profile"
  | "weather"
  | "photos"
  | "contacts"
  | "city"
  | "vehicles"
  | "settings";

export type PhoneChoice = "accept" | "maybe" | "decline";

export interface PhoneWaypoint {
  x: number;
  y: number;
  label: string;
}

export interface PhoneAppointment {
  id: string;
  title: string;
  place: string;
  year: number;
  dayOfYear: number;
  startMin: number;
  endMin: number;
  x: number;
  y: number;
}

export interface PhoneSave {
  replies: Record<string, PhoneChoice>;
  read: string[];
  muted: boolean;
  toasted: string[];
  waypoint: PhoneWaypoint | null;
  appointments: PhoneAppointment[];
}

export interface PhoneChoiceOption {
  id: PhoneChoice;
  label: string;
}

export interface PhoneMessage {
  id: string;
  sender: string;
  handle: string;
  timeMin: number;
  unread: boolean;
  reply?: PhoneChoice;
  body: string[];
  choices?: PhoneChoiceOption[];
  location?: PhoneWaypoint;
  jobBuildingId?: string;
}

export interface PhoneCalendarItem {
  id: string;
  title: string;
  place: string;
  startMin: number;
  endMin: number;
  year: number;
  dayOfYear: number;
  x: number;
  y: number;
  source: "work" | "city" | "invite";
  invitation?: boolean;
}

function emptySave(): PhoneSave {
  return { replies: {}, read: [], muted: false, toasted: [], waypoint: null, appointments: [] };
}

export function readPhone(): PhoneSave {
  if (typeof window === "undefined") return emptySave();
  try {
    const raw = window.localStorage.getItem(STORAGE);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as Partial<PhoneSave>;
    return {
      replies: parsed.replies && typeof parsed.replies === "object" ? parsed.replies : {},
      read: Array.isArray(parsed.read) ? parsed.read.filter((id) => typeof id === "string") : [],
      muted: Boolean(parsed.muted),
      toasted: Array.isArray(parsed.toasted) ? parsed.toasted.filter((id) => typeof id === "string") : [],
      waypoint: parseWaypoint(parsed.waypoint),
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments.filter(isAppointment) : [],
    };
  } catch {
    return emptySave();
  }
}

export function writePhone(save: PhoneSave) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE, JSON.stringify(save));
}

export function phoneInbox(state: CityState, player: PlayerState): PhoneMessage[] {
  const save = readPhone();
  const clock = state.clock;
  const today = dayKey(clock);
  const messages: PhoneMessage[] = [];

  const festival = state.events.find((event) => event.kind === "festival");
  if (festival) {
    messages.push(
      makeMessage(save, {
        id: `fest-${today}`,
        sender: "Riverside Festival",
        handle: "events",
        timeMin: 10 * 60 + 15,
        body: [
          "Hey! We're getting everything ready for the Waterfront Festival.",
          "We could really use your help setting up the food stalls and delivering some supplies.",
          "Are you available to help?",
        ],
        choices: inviteChoices(),
        location: { x: festival.x, y: festival.y, label: "Riverside Park" },
      }),
    );
  }

  const baseball = state.events.find((event) => event.kind === "baseball");
  if (baseball) {
    const stadium = baseball.buildingId ? state.buildings.get(baseball.buildingId) : findStadium(state);
    messages.push(
      makeMessage(save, {
        id: `game-${today}`,
        sender: "Maya Chen",
        handle: "maya",
        timeMin: 11 * 60 + 40,
        body: [
          "Ravens vs Bears tonight. First pitch at 6.",
          "I've got an extra seat on the first-base side if you want it.",
        ],
        choices: [
          { id: "accept", label: "Sure, I'll be there!" },
          { id: "maybe", label: "Can I bring a friend?" },
          { id: "decline", label: "Sorry, I'm busy." },
        ],
        location: {
          x: baseball.x,
          y: baseball.y,
          label: stadium?.name ?? "Ravens Ballpark",
        },
      }),
    );
  }

  const concert = state.events.find((event) => event.kind === "concert");
  if (concert) {
    messages.push(
      makeMessage(save, {
        id: `show-${today}`,
        sender: "Harbor Nights",
        handle: "harbor",
        timeMin: 14 * 60,
        body: [
          "The stadium is hosting a concert after dusk.",
          "Want a spot on the concourse? Reply and I'll hold a wristband.",
        ],
        choices: inviteChoices(),
        location: { x: concert.x, y: concert.y, label: "Riverside Stadium" },
      }),
    );
  }

  if (player.career && clock.minuteOfDay >= 8 * 60 && clock.minuteOfDay < OFFICE_SHIFT_START + 90) {
    messages.push(
      makeMessage(save, {
        id: `boss-${today}`,
        sender: player.career.employerName,
        handle: "boss",
        timeMin: 8 * 60 + 28,
        body: [
          `Reminder: your shift at ${player.career.employerName} starts at 9:00 AM.`,
          player.shift ? "You're already on the clock. Nice." : "Clock in at the lobby desk when you arrive.",
        ],
        location: buildingWaypoint(state, player.career.employerId),
      }),
    );
  }

  if (!player.career) {
    const office = firstOffice(state);
    if (office) {
      messages.push(
        makeMessage(save, {
          id: `hire-${office.id}`,
          sender: `${office.name} Hiring`,
          handle: "jobs",
          timeMin: 9 * 60 + 10,
          body: [
            `We're looking for an office intern at ${office.name}.`,
            "You've been helping out around the city, and we'd like to offer you a position.",
            "Accept here and we'll put you on the roster. Clock in at the lobby between 9 and 10.",
          ],
          choices: [
            { id: "accept", label: "I'll take the job." },
            { id: "decline", label: "Not right now." },
          ],
          location: {
            x: office.origin.x + office.width / 2,
            y: office.origin.y + office.depth,
            label: office.name,
          },
          jobBuildingId: office.id,
        }),
      );
    }
  }

  const mall = findMall(state);
  if (mall && clock.minuteOfDay >= 10 * 60) {
    messages.push(
      makeMessage(save, {
        id: `mall-${today}`,
        sender: mall.name,
        handle: "mall",
        timeMin: 10 * 60 + 5,
        body: [
          "New pieces just hit the floor — fashion, sneakers, and the home shop.",
          "Come try them on. No appointment needed.",
        ],
        location: {
          x: venueGateTile(mall).x,
          y: venueGateTile(mall).y,
          label: mall.name,
        },
      }),
    );
  }

  if (!player.dustfallUnlocked && clock.dayIndex >= 0) {
    messages.push(
      makeMessage(save, {
        id: "hwy-tease",
        sender: "City Planning Desk",
        handle: "planning",
        timeMin: 19 * 60 + 12,
        body: [
          `Grow Riverside to Level ${DUSTFALL_UNLOCK_LEVEL} — place homes, shops, and parks, and welcome more residents.`,
          "Hit Level 10 and Dustfall opens on the city map. Highway 93 is still there when you want the scenic route.",
        ],
        location: { x: 20, y: 3, label: "Highway 93 ramp" },
      }),
    );
  }

  for (const event of state.events) {
    if (event.kind !== "accident" && event.kind !== "fire" && event.kind !== "storm") continue;
    messages.push(
      makeMessage(save, {
        id: `alert-${event.id}`,
        sender: "Riverside City Services",
        handle: "311",
        timeMin: clock.minuteOfDay,
        body: [event.headline, event.detail],
        location: { x: event.x, y: event.y, label: event.kind === "fire" ? "Fire" : event.kind === "storm" ? "Storm" : "Incident" },
      }),
    );
  }

  return messages
    .filter(
      (item) =>
        item.id.startsWith("alert-") ||
        clock.minuteOfDay >= item.timeMin ||
        Boolean(save.replies[item.id]) ||
        save.read.includes(item.id),
    )
    .sort((a, b) => b.timeMin - a.timeMin);
}

export function phoneUnreadCount(state: CityState, player: PlayerState) {
  return phoneInbox(state, player).filter((item) => item.unread).length;
}

export function markPhoneRead(id: string) {
  const save = readPhone();
  if (!save.read.includes(id)) {
    save.read.push(id);
    writePhone(save);
  }
}

export function markPhoneToasted(id: string) {
  const save = readPhone();
  if (!save.toasted.includes(id)) {
    save.toasted.push(id);
    writePhone(save);
  }
}

export function pendingPhoneToast(state: CityState, player: PlayerState): PhoneMessage | null {
  const save = readPhone();
  if (save.muted) return null;
  return phoneInbox(state, player).find((item) => item.unread && !save.toasted.includes(item.id)) ?? null;
}

export const PHONE_TIME_SCALE = 0.12;

export function setPhoneMuted(muted: boolean) {
  const save = readPhone();
  save.muted = muted;
  writePhone(save);
}

export function setPhoneWaypoint(waypoint: PhoneWaypoint | null) {
  const save = readPhone();
  save.waypoint = waypoint;
  writePhone(save);
}

export function replyToPhoneMessage(
  state: CityState,
  player: PlayerState,
  messageId: string,
  choice: PhoneChoice,
): { save: PhoneSave; player: PlayerState | string } {
  const save = readPhone();
  save.replies[messageId] = choice;
  if (!save.read.includes(messageId)) save.read.push(messageId);
  const message = phoneInbox(state, player).find((item) => item.id === messageId);
  let nextPlayer: PlayerState | string = player;

  if (message && (choice === "accept" || choice === "maybe") && message.location) {
    if (message.jobBuildingId) {
      const building = findVenue(state, message.jobBuildingId) ?? state.buildings.get(message.jobBuildingId);
      if (building) nextPlayer = applyForOffice(building);
    } else {
      upsertAppointment(save, {
        id: message.id,
        title: appointmentTitle(message),
        place: message.location.label,
        year: state.clock.year,
        dayOfYear: state.clock.dayOfYear,
        startMin: startForMessage(message),
        endMin: endForMessage(message),
        x: message.location.x,
        y: message.location.y,
      });
    }
    save.waypoint = message.location;
  }

  writePhone(save);
  return { save, player: nextPlayer };
}

export function phoneCalendar(state: CityState, player: PlayerState): PhoneCalendarItem[] {
  const save = readPhone();
  const items: PhoneCalendarItem[] = [];
  const clock = state.clock;

  if (player.career && clock.dayIndex < 5) {
    const office = state.buildings.get(player.career.employerId);
    items.push({
      id: `work-${dayKey(clock)}`,
      title: `Shift · ${player.career.employerName}`,
      place: player.career.employerName,
      startMin: OFFICE_SHIFT_START,
      endMin: OFFICE_SHIFT_END,
      year: clock.year,
      dayOfYear: clock.dayOfYear,
      x: office ? office.origin.x + office.width / 2 : 0,
      y: office ? office.origin.y + office.depth : 0,
      source: "work",
    });
  }

  for (const event of state.events) {
    if (event.kind === "baseball") {
      items.push({
        id: `city-${event.id}`,
        title: "Ravens vs Bears",
        place: "Ravens Ballpark",
        startMin: GAME_START_MINUTE,
        endMin: GAME_END_MINUTE,
        year: clock.year,
        dayOfYear: clock.dayOfYear,
        x: event.x,
        y: event.y,
        source: "city",
      });
    } else if (event.kind === "festival") {
      items.push({
        id: `city-${event.id}`,
        title: "Waterfront Festival",
        place: "Riverside Park",
        startMin: 16 * 60,
        endMin: 21 * 60,
        year: clock.year,
        dayOfYear: clock.dayOfYear,
        x: event.x,
        y: event.y,
        source: "city",
        invitation: !save.replies[`fest-${dayKey(clock)}`],
      });
    } else if (event.kind === "concert") {
      items.push({
        id: `city-${event.id}`,
        title: "Stadium concert",
        place: "Riverside Stadium",
        startMin: 19 * 60,
        endMin: 22 * 60,
        year: clock.year,
        dayOfYear: clock.dayOfYear,
        x: event.x,
        y: event.y,
        source: "city",
      });
    }
  }

  for (const item of save.appointments) {
    if (items.some((existing) => existing.id === item.id)) continue;
    items.push({ ...item, source: "invite" });
  }

  return items.sort((a, b) => a.startMin - b.startMin || a.dayOfYear - b.dayOfYear);
}

export function phoneMonthCells(clock: CityClock) {
  const { month } = monthDayFromDoy(clock.dayOfYear);
  const firstDoy = doyForMonthDay(month, 1);
  const startWeekday = weekdayOf(clock.year, firstDoy);
  const count = MONTH_DAYS[month - 1];
  const cells: Array<{ day: number; doy: number; current: boolean } | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= count; day++) {
    const doy = firstDoy + day - 1;
    cells.push({ day, doy, current: doy === clock.dayOfYear });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return {
    month,
    name: MONTH_NAMES[month - 1],
    year: clock.year,
    cells,
  };
}

export function phoneMapPins(state: CityState, player: PlayerState) {
  const pins: Array<{ x: number; y: number; label: string; kind: PoiKind | "event" | "work" | "you" }> = [];
  for (const building of state.buildings.values()) {
    const kind = poiKind(building);
    if (!kind) continue;
    const spot = buildingNavTile(building);
    pins.push({
      x: spot.x,
      y: spot.y,
      label: building.name,
      kind,
    });
  }
  for (const event of state.events) {
    if (event.kind === "accident" || event.kind === "fire") {
      pins.push({ x: event.x, y: event.y, label: event.headline, kind: "event" });
    }
  }
  if (player.career) {
    const office = state.buildings.get(player.career.employerId);
    if (office) {
      const spot = buildingNavTile(office);
      pins.push({
        x: spot.x,
        y: spot.y,
        label: office.name,
        kind: "work",
      });
    }
  }
  return pins;
}

export function jobListings(state: CityState) {
  return [...state.buildings.values()].filter(isJobBuilding);
}

export function civicBuildings(state: CityState) {
  return [...state.buildings.values()].filter((building) => {
    const role = venueRole(building);
    return role === "city_hall" || role === "police" || role === "fire" || role === "hospital" || role === "school";
  });
}

export function monthTitle(clock: CityClock) {
  const { month } = monthDayFromDoy(clock.dayOfYear);
  return `${MONTH_NAMES[month - 1]} ${clock.year}`;
}

export function formatRange(startMin: number, endMin: number) {
  return `${formatClockMinutes(startMin)} – ${formatClockMinutes(endMin)}`;
}

export function formatPhoneTime(clock: CityClock) {
  return formatClockMinutes(clock.minuteOfDay);
}

export function longClockDate(clock: CityClock) {
  return formatLongDate(clock.year, clock.dayOfYear);
}

function makeMessage(
  save: PhoneSave,
  draft: Omit<PhoneMessage, "unread" | "reply">,
): PhoneMessage {
  return {
    ...draft,
    unread: !save.read.includes(draft.id),
    reply: save.replies[draft.id],
  };
}

function inviteChoices(): PhoneChoiceOption[] {
  return [
    { id: "accept", label: "Sure, I'll be there!" },
    { id: "maybe", label: "Can I bring a friend?" },
    { id: "decline", label: "Sorry, I'm busy." },
  ];
}

function firstOffice(state: CityState) {
  return jobListings(state)[0] ?? null;
}

function buildingWaypoint(state: CityState, id: string): PhoneWaypoint | undefined {
  const building = state.buildings.get(id);
  if (!building) return undefined;
  const gate = buildingNavTile(building);
  return { x: gate.x, y: gate.y, label: building.name };
}

/** Street approach for navigation — prefer the enterable gate, not the footprint center. */
function buildingNavTile(building: Building) {
  if (isSubwayStation(building)) return subwayGateTile(building);
  if (building.kind === "baseball_stadium") return stadiumGateTile(building);
  if (lodgingUse(building)) return lodgingGateTile(building);
  if (venueRole(building)) return venueGateTile(building);
  return {
    x: building.origin.x + Math.floor(building.width / 2),
    y: building.origin.y + building.depth,
  };
}

function appointmentTitle(message: PhoneMessage) {
  if (message.id.startsWith("fest-")) return "Waterfront Festival";
  if (message.id.startsWith("game-")) return "Baseball game";
  if (message.id.startsWith("show-")) return "Stadium concert";
  return message.sender;
}

function startForMessage(message: PhoneMessage) {
  if (message.id.startsWith("fest-")) return 16 * 60;
  if (message.id.startsWith("game-")) return GAME_START_MINUTE;
  if (message.id.startsWith("show-")) return 19 * 60;
  return message.timeMin;
}

function endForMessage(message: PhoneMessage) {
  if (message.id.startsWith("fest-")) return 21 * 60;
  if (message.id.startsWith("game-")) return GAME_END_MINUTE;
  if (message.id.startsWith("show-")) return 22 * 60;
  return message.timeMin + 60;
}

function upsertAppointment(save: PhoneSave, item: PhoneAppointment) {
  save.appointments = save.appointments.filter((entry) => entry.id !== item.id);
  save.appointments.push(item);
}

function parseWaypoint(value: unknown): PhoneWaypoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PhoneWaypoint>;
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y) || typeof raw.label !== "string") return null;
  return { x: Number(raw.x), y: Number(raw.y), label: raw.label };
}

function isAppointment(value: unknown): value is PhoneAppointment {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<PhoneAppointment>;
  return (
    typeof raw.id === "string" &&
    typeof raw.title === "string" &&
    typeof raw.place === "string" &&
    Number.isFinite(raw.year) &&
    Number.isFinite(raw.dayOfYear) &&
    Number.isFinite(raw.startMin) &&
    Number.isFinite(raw.endMin) &&
    Number.isFinite(raw.x) &&
    Number.isFinite(raw.y)
  );
}

function doyForMonthDay(month: number, day: number) {
  let n = 0;
  for (let i = 0; i < month - 1; i++) n += MONTH_DAYS[i];
  return n + day - 1;
}

export function officeHoursLabel() {
  return `${formatClockMinutes(OFFICE_SHIFT_START)} – ${formatClockMinutes(OFFICE_SHIFT_END)}`;
}

export function pinColor(kind: PoiKind | "event" | "work" | "you") {
  if (kind === "event") return "#ff6b5a";
  if (kind === "work") return "#f4d03f";
  if (kind === "you") return "#7dd3fc";
  const fill: Record<PoiKind, string> = {
    subway: "#7b3fd4",
    hotel: "#c9a44c",
    residences: "#8a5a3a",
    hospital: "#c0392b",
    police: "#1f4d8c",
    fire: "#d35400",
    school: "#2f5d4a",
    city_hall: "#b8953a",
    stadium: "#1f4d8c",
    bank: "#2f5d4a",
    mall: "#c9a44c",
    dealership: "#ff5c8a",
    office: "#3d9ad1",
    bus: "#5d7384",
    marina: "#1d6a8a",
    beach: "#d6c38a",
    ferris: "#c45c4a",
  };
  return fill[kind];
}
