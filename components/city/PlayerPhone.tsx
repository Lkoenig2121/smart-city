"use client";

import type { CityState } from "@/lib/city/types";
import { clothingById } from "@/lib/city/clothing";
import {
  civicBuildings,
  formatPhoneTime,
  formatRange,
  jobListings,
  longClockDate,
  markPhoneRead,
  monthTitle,
  officeHoursLabel,
  phoneCalendar,
  phoneInbox,
  phoneMapPins,
  phoneMonthCells,
  pinColor,
  readPhone,
  replyToPhoneMessage,
  setPhoneMuted,
  setPhoneWaypoint,
  type PhoneApp,
  type PhoneCalendarItem,
  type PhoneChoice,
  type PhoneMessage,
} from "@/lib/city/phone";
import {
  BANK_RATE_LABEL,
  formatDollars,
  officeRank,
  quitJob,
  totalBalance,
  type PlayerState,
} from "@/lib/city/player";
import { characterProgress } from "@/lib/city/progression";
import { forecastFor, weatherEmoji } from "@/lib/simulation/weather/weather";
import { formatClock } from "@/lib/simulation/city/cityTick";
import {
  applyActiveVehicle,
  applyVehicleCustomize,
  categoryLabel,
  vehicleById,
} from "@/lib/city/vehicles";
import { beyondRiversideStatus } from "@/lib/city/missions";
import { writePlayer } from "@/lib/city/player";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

const APPS: { id: PhoneApp; name: string; icon: string; tint: string }[] = [
  { id: "messages", name: "Messages", icon: "💬", tint: "from-lime-300 to-emerald-500" },
  { id: "calendar", name: "Calendar", icon: "📅", tint: "from-rose-400 to-red-600" },
  { id: "maps", name: "Maps", tint: "from-emerald-300 to-teal-600", icon: "🗺️" },
  { id: "bank", name: "Banking", icon: "🏦", tint: "from-amber-200 to-yellow-600" },
  { id: "jobs", name: "Jobs", icon: "💼", tint: "from-sky-300 to-blue-600" },
  { id: "profile", name: "Profile", icon: "👤", tint: "from-violet-300 to-indigo-600" },
  { id: "weather", name: "Weather", icon: "🌤️", tint: "from-sky-200 to-cyan-500" },
  { id: "photos", name: "Photos", icon: "🖼️", tint: "from-orange-300 to-pink-500" },
  { id: "contacts", name: "Contacts", icon: "👥", tint: "from-slate-300 to-slate-600" },
  { id: "city", name: "City 311", icon: "🏛️", tint: "from-teal-200 to-emerald-700" },
  { id: "vehicles", name: "Vehicles", icon: "🚗", tint: "from-sky-400 to-blue-700" },
  { id: "settings", name: "Settings", icon: "⚙️", tint: "from-zinc-400 to-zinc-700" },
];

interface Props {
  state: CityState;
  player: PlayerState;
  onPlayer: (player: PlayerState) => void;
  onClose: () => void;
  onOpenCharacter?: () => void;
  onChanged?: () => void;
  startApp?: PhoneApp;
  startThreadId?: string | null;
}

export function PlayerPhone({
  state,
  player,
  onPlayer,
  onClose,
  onOpenCharacter,
  onChanged,
  startApp = "home",
  startThreadId = null,
}: Props) {
  const clock = formatClock(state);
  const [app, setApp] = useState<PhoneApp>(startThreadId ? "thread" : startApp);
  const [threadId, setThreadId] = useState<string | null>(startThreadId);
  const [note, setNote] = useState<string | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  const save = useMemo(() => readPhone(), [saveTick, app, threadId]);
  const inbox = useMemo(() => phoneInbox(state, player), [state, player, saveTick]);
  const calendar = useMemo(() => phoneCalendar(state, player), [state, player, saveTick]);
  const unread = inbox.filter((item) => item.unread).length;
  const thread = inbox.find((item) => item.id === threadId) ?? null;

  const refresh = () => {
    setSaveTick((n) => n + 1);
    onChanged?.();
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startThreadId) return;
    markPhoneRead(startThreadId);
    refresh();
    // Open the tapped notification once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "ArrowUp" && event.code !== "ArrowDown") return;
      const node = scrollRef.current;
      if (!node) return;
      event.preventDefault();
      node.scrollBy({ top: event.code === "ArrowDown" ? 72 : -72, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app]);

  const openApp = (next: PhoneApp) => {
    setNote(null);
    setApp(next);
    if (next !== "thread") setThreadId(null);
  };

  const openThread = (message: PhoneMessage) => {
    markPhoneRead(message.id);
    setThreadId(message.id);
    setApp("thread");
    refresh();
  };

  const reply = (choice: PhoneChoice) => {
    if (!thread) return;
    const result = replyToPhoneMessage(state, player, thread.id, choice);
    if (typeof result.player !== "string") onPlayer(result.player);
    else setNote(result.player);
    refresh();
  };

  const waypoint = (x: number, y: number, label: string) => {
    setPhoneWaypoint({ x, y, label });
    setNote(`Waypoint set · ${label}`);
    refresh();
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/55 p-3 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div className="flex items-end gap-4" onClick={(event) => event.stopPropagation()} role="presentation">
        <div className="relative h-[min(44rem,calc(100vh-2rem))] w-[min(23rem,calc(100vw-2.5rem))] overflow-hidden rounded-[2.4rem] border-[7px] border-[#1a1c20] bg-black shadow-2xl">
          <div className="absolute left-1/2 top-1.5 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black" />
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-[#1c2333] to-[#0b1018] text-white">
            <header className="flex shrink-0 items-center justify-between px-6 pb-1 pt-3 text-[0.7rem] font-semibold text-white/80">
              <span>{clock.time}</span>
              <span className="tabular-nums">{unread ? `${unread} new` : "5G"}</span>
            </header>
            <div
              ref={app === "maps" ? undefined : scrollRef}
              className={
                app === "maps"
                  ? "flex min-h-0 flex-1 basis-0 flex-col overflow-hidden px-3 pb-2"
                  : "phone-scroll min-h-0 flex-1 basis-0 px-3 pb-2"
              }
            >
              {app === "home" ? (
                <HomeScreen
                  clockTime={clock.time}
                  date={`${clock.day} · ${clock.date}`}
                  unread={unread}
                  onOpen={openApp}
                />
              ) : app === "messages" ? (
                <MessagesList inbox={inbox} onOpen={openThread} />
              ) : app === "thread" && thread ? (
                <ThreadView message={thread} note={note} onReply={reply} onMap={() => thread.location && waypoint(thread.location.x, thread.location.y, thread.location.label)} />
              ) : app === "calendar" ? (
                <CalendarView state={state} items={calendar} onWaypoint={waypoint} />
              ) : app === "maps" ? (
                <MapsView
                  state={state}
                  player={player}
                  waypoint={save.waypoint}
                  onWaypoint={waypoint}
                  scrollRef={scrollRef}
                />
              ) : app === "bank" ? (
                <BankView player={player} />
              ) : app === "jobs" ? (
                <JobsView
                  state={state}
                  player={player}
                  note={note}
                  onPlayer={onPlayer}
                  onNote={setNote}
                  onWaypoint={waypoint}
                />
              ) : app === "profile" ? (
                <ProfileView player={player} onCharacter={onOpenCharacter} />
              ) : app === "weather" ? (
                <WeatherView state={state} />
              ) : app === "photos" ? (
                <PhotosView state={state} player={player} />
              ) : app === "contacts" ? (
                <ContactsView inbox={inbox} onOpen={openThread} />
              ) : app === "city" ? (
                <CityView state={state} onWaypoint={waypoint} />
              ) : app === "vehicles" ? (
                <VehiclesView player={player} onPlayer={onPlayer} onWaypoint={waypoint} onNote={setNote} note={note} />
              ) : (
                <SettingsView muted={save.muted} waypoint={save.waypoint?.label ?? null} onMute={(muted) => { setPhoneMuted(muted); refresh(); }} onClear={() => { setPhoneWaypoint(null); refresh(); }} />
              )}
            </div>
            <nav className="flex shrink-0 items-center justify-between px-5 pb-3 pt-1">
              <button type="button" onClick={() => openApp("home")} className="rounded-full bg-white/10 px-4 py-1.5 text-xs text-white/80">
                Home
              </button>
              <button type="button" onClick={onClose} className="h-1.5 w-28 rounded-full bg-white/35" aria-label="Close phone" />
              <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-4 py-1.5 text-xs text-white/80">
                Lock
              </button>
            </nav>
          </div>
        </div>
        <p className="hidden max-w-[11rem] text-xs text-slate-300 sm:block">
          City time slows while the phone is open. Click outside, or press{" "}
          <span className="font-semibold text-white">M</span> / Esc to put it away.
        </p>
      </div>
    </div>
  );
}

function HomeScreen({
  clockTime,
  date,
  unread,
  onOpen,
}: {
  clockTime: string;
  date: string;
  unread: number;
  onOpen: (app: PhoneApp) => void;
}) {
  return (
    <div className="pt-6">
      <p className="text-center text-5xl font-semibold tracking-tight">{clockTime.replace(" ", "")}</p>
      <p className="mt-1 text-center text-sm text-white/70">{date}</p>
      <div className="mt-6 grid grid-cols-4 gap-3 px-1">
        {APPS.map((item) => (
          <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="flex flex-col items-center gap-1">
            <span className={`relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-xl shadow-lg ${item.tint}`}>
              {item.icon}
              {item.id === "messages" && unread > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[0.55rem] font-bold">
                  {unread}
                </span>
              ) : null}
            </span>
            <span className="text-[0.62rem] text-white/80">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessagesList({ inbox, onOpen }: { inbox: PhoneMessage[]; onOpen: (message: PhoneMessage) => void }) {
  return (
    <div className="pt-2">
      <AppTitle>Messages</AppTitle>
      <div className="mt-2 space-y-1">
        {inbox.length === 0 ? <Empty>Quiet for now. Check back after breakfast.</Empty> : null}
        {inbox.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="flex w-full items-start gap-3 rounded-2xl bg-white/5 px-3 py-2.5 text-left hover:bg-white/10"
          >
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm">
              {item.sender.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{item.sender}</span>
                <span className="text-[0.65rem] text-white/50">{formatPhoneTime({ minuteOfDay: item.timeMin, dayIndex: 0, dayOfYear: 0, year: 0 })}</span>
              </span>
              <span className={`block truncate text-xs ${item.unread ? "text-sky-200" : "text-white/55"}`}>
                {item.body[0]}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreadView({
  message,
  note,
  onReply,
  onMap,
}: {
  message: PhoneMessage;
  note: string | null;
  onReply: (choice: PhoneChoice) => void;
  onMap: () => void;
}) {
  return (
    <div className="pt-2">
      <AppTitle>{message.sender}</AppTitle>
      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/40">{message.handle}</p>
      <div className="mt-3 space-y-2">
        {message.body.map((line) => (
          <p key={line} className="max-w-[90%] rounded-2xl rounded-bl-md bg-[#2b3348] px-3 py-2 text-sm leading-snug">
            {line}
          </p>
        ))}
      </div>
      {message.location ? (
        <button type="button" onClick={onMap} className="mt-3 w-full rounded-xl bg-sky-500/20 px-3 py-2 text-left text-sm text-sky-100">
          Open in Maps · {message.location.label}
        </button>
      ) : null}
      {message.reply ? (
        <p className="mt-3 ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-lime-400/90 px-3 py-2 text-sm font-medium text-[#10210c]">
          {message.choices?.find((item) => item.id === message.reply)?.label ?? "Sent"}
        </p>
      ) : message.choices ? (
        <div className="mt-4 space-y-2">
          {message.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => onReply(choice.id)}
              className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}
      {note ? <p className="mt-2 text-xs text-amber-200">{note}</p> : null}
    </div>
  );
}

function CalendarView({
  state,
  items,
  onWaypoint,
}: {
  state: CityState;
  items: PhoneCalendarItem[];
  onWaypoint: (x: number, y: number, label: string) => void;
}) {
  const month = phoneMonthCells(state.clock);
  const today = items.filter((item) => item.dayOfYear === state.clock.dayOfYear);
  return (
    <div className="pt-2">
      <AppTitle>Calendar</AppTitle>
      <p className="text-xs text-white/55">{month.name} {month.year} · Riverside time</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.6rem] text-white/40">
        {"SMTWTFS".split("").map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
        {month.cells.map((cell, i) => (
          <span
            key={i}
            className={`grid h-7 place-items-center rounded-md ${
              cell?.current ? "bg-rose-500 text-white" : cell ? "bg-white/5 text-white/80" : ""
            }`}
          >
            {cell?.day ?? ""}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm font-semibold">{longClockDate(state.clock)}</p>
      <div className="mt-2 space-y-2">
        {today.length === 0 ? <Empty>Nothing on the books today.</Empty> : null}
        {today.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onWaypoint(item.x, item.y, item.place)}
            className="w-full rounded-2xl bg-white/5 px-3 py-2.5 text-left"
          >
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-white/60">{formatRange(item.startMin, item.endMin)}</p>
            <p className="text-xs text-sky-200">
              {item.place}
              {item.invitation ? " · invitation" : ""}
              {item.source === "invite" ? " · accepted" : ""}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function MapsView({
  state,
  player,
  waypoint,
  onWaypoint,
  scrollRef,
}: {
  state: CityState;
  player: PlayerState;
  waypoint: { x: number; y: number; label: string } | null;
  onWaypoint: (x: number, y: number, label: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pins = phoneMapPins(state, player);
  const groups = [
    { label: "Work & shops", kinds: ["office", "mall", "bank", "dealership"] as const },
    { label: "Go out", kinds: ["stadium", "hotel", "marina", "ferris"] as const },
    { label: "Civic", kinds: ["city_hall", "hospital", "police", "fire", "school", "subway"] as const },
  ];
  const [groupIndex, setGroupIndex] = useState(0);
  const active = groups[groupIndex] ?? groups[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const cell = w / state.size;
    ctx.fillStyle = "#1b2a22";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        const tile = state.tiles[y][x];
        if (tile.terrain === "water") ctx.fillStyle = "#2f3a3c";
        else if (tile.terrain === "park" || tile.terrain === "playground") ctx.fillStyle = "#2f6b34";
        else if (tile.road) ctx.fillStyle = "#5c5f66";
        else continue;
        ctx.fillRect(x * cell, y * cell, cell + 0.4, cell + 0.4);
      }
    }
    for (const pin of pins) {
      ctx.beginPath();
      ctx.arc(pin.x * cell, pin.y * cell, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = pinColor(pin.kind);
      ctx.fill();
    }
    if (waypoint) {
      ctx.beginPath();
      ctx.arc(waypoint.x * cell, waypoint.y * cell, 5, 0, Math.PI * 2);
      ctx.strokeStyle = "#f4d03f";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [pins, state, waypoint]);

  const listed = pins.filter((pin) => (active.kinds as readonly string[]).includes(pin.kind));

  return (
    <div className="flex h-full min-h-0 flex-col pt-2">
      <div className="shrink-0">
        <AppTitle>Maps</AppTitle>
        <nav className="mt-2 flex gap-1 rounded-xl bg-white/5 p-1">
          {groups.map((group, index) => (
            <button
              key={group.label}
              type="button"
              onClick={() => setGroupIndex(index)}
              className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-[0.65rem] font-semibold ${
                index === groupIndex ? "bg-white/15 text-white" : "text-white/55 hover:text-white/80"
              }`}
            >
              {group.label}
            </button>
          ))}
        </nav>
        <canvas ref={canvasRef} width={320} height={150} className="mt-2 w-full rounded-2xl bg-[#1b2a22]" />
        {waypoint ? <p className="mt-2 text-xs text-amber-200">Waypoint · {waypoint.label}</p> : null}
        <p className="mt-2 text-[0.65rem] uppercase tracking-[0.16em] text-white/40">{active.label}</p>
      </div>
      <div ref={scrollRef} className="phone-scroll mt-1 min-h-0 flex-1 basis-0 space-y-1 pr-0.5">
        {listed.length === 0 ? <Empty>No pins in this category.</Empty> : null}
        {listed.map((pin) => (
          <button
            key={`${pin.kind}-${pin.label}-${pin.x}`}
            type="button"
            onClick={() => onWaypoint(pin.x, pin.y, pin.label)}
            className="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm"
          >
            <span>{pin.label}</span>
            <span className="text-[0.65rem] text-sky-200">Waypoint</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BankView({ player }: { player: PlayerState }) {
  return (
    <div className="pt-2">
      <AppTitle>Riverside Bank</AppTitle>
      <p className="text-xs text-white/50">Community checking · {BANK_RATE_LABEL} on savings</p>
      <p className="mt-4 text-[0.65rem] uppercase tracking-[0.2em] text-amber-300">Available</p>
      <p className="text-3xl font-semibold tabular-nums">{formatDollars(totalBalance(player))}</p>
      <p className="mt-1 text-xs text-white/60">
        Wallet {formatDollars(player.wallet)} · Savings {formatDollars(player.bank)}
      </p>
      <p className="mt-5 text-[0.65rem] uppercase tracking-[0.18em] text-white/40">Recent</p>
      <div className="mt-2 space-y-1">
        {player.ledger.length === 0 ? <Empty>No transactions yet.</Empty> : null}
        {player.ledger.slice(0, 12).map((entry) => (
          <div key={entry.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
            <div>
              <p className="text-sm">{entry.description}</p>
              <p className="text-[0.65rem] text-white/45">
                {formatPhoneTime({ minuteOfDay: entry.minuteOfDay, dayIndex: 0, dayOfYear: entry.dayOfYear, year: entry.year })}
              </p>
            </div>
            <p className={`text-sm font-semibold tabular-nums ${entry.kind === "spend" || entry.kind === "deposit" ? "text-rose-200" : "text-lime-300"}`}>
              {entry.kind === "spend" || entry.kind === "deposit" ? "−" : "+"}
              {formatDollars(entry.amount)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[0.7rem] text-white/45">Visit a bank lobby to move cash between wallet and savings.</p>
    </div>
  );
}

function JobsView({
  state,
  player,
  note,
  onPlayer,
  onNote,
  onWaypoint,
}: {
  state: CityState;
  player: PlayerState;
  note: string | null;
  onPlayer: (player: PlayerState) => void;
  onNote: (note: string | null) => void;
  onWaypoint: (x: number, y: number, label: string) => void;
}) {
  const offices = jobListings(state);
  const rank = player.career ? officeRank(player.career.xp) : null;
  return (
    <div className="pt-2">
      <AppTitle>Jobs</AppTitle>
      {player.career ? (
        <div className="mt-2 rounded-2xl bg-white/5 px-3 py-3">
          <p className="text-sm font-semibold">{player.career.employerName}</p>
          <p className="text-xs text-white/60">
            {rank?.label} · {officeHoursLabel()}
          </p>
          <p className="mt-1 text-xs text-sky-200">{player.shift ? "On the clock" : "Off the clock · clock in at the lobby"}</p>
          <button
            type="button"
            onClick={() => {
              const next = quitJob();
              if (typeof next === "string") onNote(next);
              else onPlayer(next);
            }}
            className="mt-2 text-xs text-rose-200"
          >
            Quit this job
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/70">No job yet. Accept a hiring text, or apply from an office lobby.</p>
      )}
      <p className="mt-4 text-[0.65rem] uppercase tracking-[0.16em] text-white/40">Open roles</p>
      <div className="mt-1 space-y-1">
        {offices.map((building) => (
          <button
            key={building.id}
            type="button"
            onClick={() => onWaypoint(building.origin.x + building.width / 2, building.origin.y + building.depth, building.name)}
            className="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-left text-sm"
          >
            <span>{building.name}</span>
            <span className="text-[0.65rem] text-sky-200">Office intern</span>
          </button>
        ))}
      </div>
      {note ? <p className="mt-2 text-xs text-amber-200">{note}</p> : null}
    </div>
  );
}

function ProfileView({ player, onCharacter }: { player: PlayerState; onCharacter?: () => void }) {
  const progress = characterProgress(player.life.xp);
  const slots = ["head", "upper", "lower", "feet", "accessory"] as const;
  return (
    <div className="pt-2">
      <AppTitle>Profile</AppTitle>
      <p className="mt-2 text-3xl font-semibold">Level {progress.level}</p>
      <p className="text-xs text-white/55">
        {progress.need ? `${progress.into} / ${progress.need} XP` : "Max level"}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-amber-400" style={{ width: `${progress.pct}%` }} />
      </div>
      <p className="mt-4 text-sm">
        {formatDollars(totalBalance(player))} · {player.career ? officeRank(player.career.xp).label : "Unemployed"}
      </p>
      <p className="mt-3 text-[0.65rem] uppercase tracking-[0.16em] text-white/40">Wearing</p>
      <div className="mt-1 space-y-1">
        {slots.map((slot) => {
          const id = player.life.equipped[slot];
          return (
            <p key={slot} className="rounded-xl bg-white/5 px-3 py-1.5 text-sm">
              <span className="text-white/45">{slot} · </span>
              {id ? clothingById(id)?.name ?? id : "Empty"}
            </p>
          );
        })}
      </div>
      {onCharacter ? (
        <button type="button" onClick={onCharacter} className="mt-4 w-full rounded-xl bg-amber-400 py-2 text-sm font-semibold text-[#1a1206]">
          Open full character · I
        </button>
      ) : (
        <p className="mt-3 text-xs text-white/50">Press I in street view for outfit, skills, and inventory.</p>
      )}
    </div>
  );
}

function WeatherView({ state }: { state: CityState }) {
  const days = forecastFor(state.clock, 5);
  return (
    <div className="pt-2">
      <AppTitle>Weather</AppTitle>
      <p className="mt-3 text-5xl">{weatherEmoji(state.weather.kind)}</p>
      <p className="text-3xl font-semibold">{state.weather.tempF}°</p>
      <p className="text-sm text-white/60">{state.weather.label} · Harbor</p>
      <div className="mt-4 grid grid-cols-5 gap-1">
        {days.map((day, i) => (
          <div key={i} className="rounded-xl bg-white/5 py-2 text-center">
            <p className="text-[0.6rem] text-white/45">{i === 0 ? "Now" : `+${i}`}</p>
            <p className="text-lg">{weatherEmoji(day.kind)}</p>
            <p className="text-xs">{day.tempF}°</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotosView({ state, player }: { state: CityState; player: PlayerState }) {
  const names = player.life.discovered.map((id) => state.buildings.get(id)?.name ?? (id === "ravens-ballpark" ? "Ravens Ballpark" : id.startsWith("subway:") ? "Subway" : id));
  return (
    <div className="pt-2">
      <AppTitle>Photos</AppTitle>
      <p className="text-xs text-white/50">Places you've actually walked into.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {names.length === 0 ? <Empty>No albums yet. Enter a building.</Empty> : null}
        {names.map((name) => (
          <div key={name} className="rounded-2xl bg-gradient-to-br from-white/15 to-white/5 px-3 py-6 text-sm font-medium">
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactsView({ inbox, onOpen }: { inbox: PhoneMessage[]; onOpen: (message: PhoneMessage) => void }) {
  const people = inbox.filter((item, i, all) => all.findIndex((other) => other.handle === item.handle) === i);
  return (
    <div className="pt-2">
      <AppTitle>Contacts</AppTitle>
      <div className="mt-2 space-y-1">
        {people.map((item) => (
          <button key={item.handle} type="button" onClick={() => onOpen(item)} className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-left">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">{item.sender.slice(0, 1)}</span>
            <span>
              <span className="block text-sm font-semibold">{item.sender}</span>
              <span className="text-xs text-white/45">@{item.handle}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CityView({
  state,
  onWaypoint,
}: {
  state: CityState;
  onWaypoint: (x: number, y: number, label: string) => void;
}) {
  const civic = civicBuildings(state);
  return (
    <div className="pt-2">
      <AppTitle>City 311</AppTitle>
      <p className="text-xs text-white/50">Riverside services · tap for a waypoint</p>
      <div className="mt-2 space-y-1">
        {civic.map((building) => (
          <button
            key={building.id}
            type="button"
            onClick={() => onWaypoint(building.origin.x + building.width / 2, building.origin.y + building.depth, building.name)}
            className="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm"
          >
            <span>{building.name}</span>
            <span className="text-[0.65rem] text-white/45">{venueRole(building)}</span>
          </button>
        ))}
        {state.events.slice(0, 4).map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onWaypoint(event.x, event.y, event.headline)}
            className="w-full rounded-xl bg-white/5 px-3 py-2 text-left text-sm"
          >
            {event.icon} {event.headline}
          </button>
        ))}
      </div>
    </div>
  );
}

function VehiclesView({
  player,
  onPlayer,
  onWaypoint,
  onNote,
  note,
}: {
  player: PlayerState;
  onPlayer: (player: PlayerState) => void;
  onWaypoint: (x: number, y: number, label: string) => void;
  onNote: (note: string | null) => void;
  note: string | null;
}) {
  const [picked, setPicked] = useState(player.activeVehicleId ?? player.ownedVehicles[0]?.id ?? null);
  const car = player.ownedVehicles.find((item) => item.id === picked) ?? player.ownedVehicles[0] ?? null;
  const mission = beyondRiversideStatus(player);
  const catalog = car ? vehicleById(car.catalogId) : null;

  return (
    <div className="pt-2">
      <AppTitle>Vehicles</AppTitle>
      <p className="text-xs text-white/50">Garage · Riverside Motors lot</p>
      {player.ownedVehicles.length === 0 ? (
        <Empty>No cars yet. Visit Riverside Motors north of downtown.</Empty>
      ) : (
        <div className="mt-2 space-y-2">
          {player.ownedVehicles.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPicked(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                item.id === car?.id ? "bg-sky-500/20" : "bg-white/5"
              }`}
            >
              <span className="text-sm font-semibold">{item.model}</span>
              <span className="text-[0.65rem] text-white/50">{item.licensePlate}</span>
            </button>
          ))}
        </div>
      )}
      {car ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-white/5 p-3">
          <p className="text-sm font-semibold">{car.model}</p>
          <p className="text-xs text-white/55">
            {categoryLabel(car.category)} · {Math.round(car.mileage)} mi · Fuel {Math.round(car.fuel)}% · Condition{" "}
            {Math.round(car.condition)}%
          </p>
          <p className="text-xs text-sky-200">Plate {car.licensePlate}</p>
          <div className="flex flex-wrap gap-2">
            {(catalog?.colors ?? [car.color]).map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => {
                  const next = applyVehicleCustomize(player, car.id, { color: swatch });
                  if (typeof next === "string") onNote(next);
                  else {
                    writePlayer(next);
                    onPlayer(next);
                    onNote("Paint updated.");
                  }
                }}
                className={`h-7 w-7 rounded-full border ${car.color === swatch ? "border-white" : "border-transparent"}`}
                style={{ background: swatch }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const next = applyActiveVehicle(player, car.id);
              if (typeof next === "string") onNote(next);
              else {
                writePlayer(next);
                onPlayer(next);
                onNote("Set as active vehicle.");
              }
            }}
            className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm"
          >
            Set as active
          </button>
          <button
            type="button"
            onClick={() => onWaypoint(car.parkX, car.parkY, car.model)}
            className="w-full rounded-xl bg-sky-500/20 px-3 py-2 text-sm text-sky-100"
          >
            Locate vehicle
          </button>
          <button
            type="button"
            onClick={() => {
              const next = applyVehicleCustomize(player, car.id, {
                performance: Math.min(3, car.upgrades.performance + 1),
              });
              if (typeof next === "string") onNote(next);
              else {
                writePlayer(next);
                onPlayer(next);
                onNote(`Performance tune Lv${next.ownedVehicles.find((v) => v.id === car.id)?.upgrades.performance ?? 0}`);
              }
            }}
            className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm"
          >
            Performance upgrade ({car.upgrades.performance}/3)
          </button>
        </div>
      ) : null}
      <div className="mt-4 rounded-2xl bg-amber-400/10 p-3">
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-amber-200">Beyond Riverside</p>
        <ul className="mt-2 space-y-1">
          {mission.steps.map((step) => (
            <li key={step.id} className={`text-xs ${step.done ? "text-emerald-200" : "text-white/55"}`}>
              {step.done ? "✓" : "○"} {step.label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[0.65rem] text-white/40">Reward {mission.reward}</p>
      </div>
      {player.dustfallUnlocked ? (
        <button
          type="button"
          onClick={() => onWaypoint(20, 2, "Highway 93 · Dustfall")}
          className="mt-2 w-full rounded-xl bg-amber-400/20 px-3 py-2 text-sm text-amber-100"
        >
          Waypoint · Dustfall highway
        </button>
      ) : null}
      {note ? <p className="mt-2 text-xs text-amber-200">{note}</p> : null}
    </div>
  );
}

function SettingsView({
  muted,
  waypoint,
  onMute,
  onClear,
}: {
  muted: boolean;
  waypoint: string | null;
  onMute: (muted: boolean) => void;
  onClear: () => void;
}) {
  return (
    <div className="pt-2">
      <AppTitle>Settings</AppTitle>
      <button type="button" onClick={() => onMute(!muted)} className="mt-3 flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-3 text-sm">
        <span>Notifications</span>
        <span className="text-white/60">{muted ? "Off" : "On"}</span>
      </button>
      <button type="button" onClick={onClear} className="mt-2 flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-3 text-sm">
        <span>Clear waypoint</span>
        <span className="text-white/45">{waypoint ?? "None"}</span>
      </button>
      <p className="mt-4 text-xs text-white/40">Riverside OS · personal phone</p>
    </div>
  );
}

function AppTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-semibold tracking-tight">{children}</h2>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-white/5 px-3 py-4 text-sm text-white/55">{children}</p>;
}

function venueRole(building: { stats?: { extra?: { venue?: string } }; kind: string }) {
  return building.stats?.extra?.venue ?? building.kind.replace("_", " ");
}
