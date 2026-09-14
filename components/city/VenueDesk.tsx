"use client";

import { formatPrice, readPortfolio } from "@/lib/city/brokerage";
import {
  applyForOffice,
  dayKey,
  depositToBank,
  endOfficeShift,
  formatDollars,
  inOfficeHours,
  OFFICE_TASK_COUNT,
  officeRank,
  quitJob,
  readPlayer,
  startOfficeShift,
  withdrawFromBank,
  type PlayerState,
} from "@/lib/city/player";
import { venueLabel, venueRole, type VenueRole } from "@/lib/city/venues";
import type { Building, CityState } from "@/lib/city/types";
import { formatMoney } from "@/lib/simulation/buildings/buildings";
import { useState, type ReactNode } from "react";

interface Props {
  building: Building;
  state: CityState;
  onPlayerChange?: (player: PlayerState) => void;
  onOpenWorkstation?: () => void;
  onClose?: () => void;
}

export function VenueDesk({ building, state, onPlayerChange, onOpenWorkstation, onClose }: Props) {
  const role = venueRole(building) ?? "office";
  const body =
    role === "office" ? (
      <OfficeDesk building={building} state={state} onPlayerChange={onPlayerChange} onOpenWorkstation={onOpenWorkstation} />
    ) : role === "bank" ? (
      <BankDesk building={building} state={state} onPlayerChange={onPlayerChange} />
    ) : (
      <FlavorDesk building={building} state={state} role={role} />
    );
  return <DeskFrame onClose={onClose}>{body}</DeskFrame>;
}

function DeskFrame({ onClose, children }: { onClose?: () => void; children: ReactNode }) {
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 grid place-items-center p-4"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose?.();
      }}
    >
      <div className="w-[min(26rem,calc(100%-2rem))]" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function OfficeDesk({
  building,
  state,
  onPlayerChange,
  onOpenWorkstation,
}: {
  building: Building;
  state: CityState;
  onPlayerChange?: (player: PlayerState) => void;
  onOpenWorkstation?: () => void;
}) {
  const [player, setPlayer] = useState(readPlayer);
  const [note, setNote] = useState<string | null>(null);
  const hired = player.career?.id === "office_worker";
  const otherJob = Boolean(player.career && !hired);
  const onShift = Boolean(player.shift);
  const today = dayKey(state.clock);
  const pausedToday = Boolean(player.career?.workDay === today && !onShift);
  const openHours = inOfficeHours(state.clock);

  const applyResult = (result: PlayerState | string) => {
    if (typeof result === "string") {
      setNote(result);
      return;
    }
    setPlayer(result);
    onPlayerChange?.(result);
    setNote(null);
  };

  const startWorking = () => {
    if (!openHours) {
      const result = applyForOffice(building);
      applyResult(result);
      if (typeof result !== "string") setNote("You're hired. Come back between 9:00 AM and 10:00 PM.");
      return;
    }
    const result = startOfficeShift(building, state);
    applyResult(result);
    if (typeof result === "string") return;
    onOpenWorkstation?.();
  };

  return (
      <div className="rounded-2xl border border-amber-300/35 bg-[#14110c]/92 p-5 text-center shadow-2xl backdrop-blur">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">Offices</p>
        <p className="mt-1 text-lg font-semibold text-white">{building.name}</p>
        <p className="mt-2 text-sm text-slate-300">
          {hired
            ? onShift
              ? `You're on the clock. Finish today's ${OFFICE_TASK_COUNT} assignments — each pays ${formatDollars(officeRank(player.career?.xp ?? 0).taskPay)} and takes 30 minutes.`
              : "Any Riverside office works. Clock in anytime from 9:00 AM to 10:00 PM."
            : otherJob
              ? `You already work at ${player.career?.employerName}. Quit before applying here.`
              : "Walk in, start working, and collect a paycheck. Hours are 9:00 AM to 10:00 PM."}
        </p>
        {hired ? (
          <p className="mt-2 text-sm font-semibold text-amber-200">
            {formatDollars(player.wallet)} in wallet
            {onShift ? ` · ${player.shift?.completedTaskIds.length ?? 0}/${OFFICE_TASK_COUNT} tasks` : ""}
          </p>
        ) : null}

        {!onShift && !otherJob ? (
          <button
            type="button"
            disabled={!openHours && hired}
            onClick={startWorking}
            className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206] disabled:opacity-40"
          >
            {openHours
              ? hired
                ? pausedToday
                  ? "Keep working"
                  : "Start working"
                : "Apply and start working"
              : hired
                ? "Closed until 9:00 AM"
                : "Apply for office work"}
          </button>
        ) : null}

        {onShift ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={onOpenWorkstation}
              className="w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206]"
            >
              Open workstation
            </button>
            <button
              type="button"
              onClick={() => {
                const result = endOfficeShift(state);
                applyResult(result);
                if (typeof result !== "string") setNote("Clocked out. You can come back until 10:00 PM.");
              }}
              className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
            >
              Clock out
            </button>
          </div>
        ) : null}

        {player.career ? (
          <button
            type="button"
            onClick={() => {
              const result = quitJob();
              applyResult(result);
              if (typeof result !== "string") setNote("You left the job.");
            }}
            className="mt-2 text-[0.7rem] font-semibold text-slate-400 hover:text-white"
          >
            Quit job
          </button>
        ) : null}

        {note ? <p className="mt-3 text-sm text-sky-200">{note}</p> : null}
        <p className="mt-3 text-[0.65rem] text-slate-500">Walk back to the doors and press E to leave</p>
      </div>
  );
}

function BankDesk({
  building,
  state,
  onPlayerChange,
}: {
  building: Building;
  state: CityState;
  onPlayerChange?: (player: PlayerState) => void;
}) {
  const [player, setPlayer] = useState(readPlayer);
  const [note, setNote] = useState<string | null>(null);
  const move = (result: PlayerState | string, ok: string) => {
    if (typeof result === "string") {
      setNote(result);
      return;
    }
    setPlayer(result);
    onPlayerChange?.(result);
    setNote(ok);
  };
  return (
    <div className="rounded-2xl border border-amber-300/35 bg-[#14110c]/92 p-5 text-center shadow-2xl backdrop-blur">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">Bank</p>
        <p className="mt-1 text-lg font-semibold text-white">{building.name}</p>
        <p className="mt-2 text-sm text-slate-300">Move cash between your wallet and account.</p>
        <p className="mt-2 text-sm font-semibold text-amber-200">
          Wallet {formatDollars(player.wallet)} · Bank {formatDollars(player.bank)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => move(depositToBank(player.wallet, state.clock), "Deposited to the bank.")}
            className="rounded-xl bg-amber-400 px-3 py-2.5 text-sm font-semibold text-[#1a1206]"
          >
            Deposit all
          </button>
          <button
            type="button"
            onClick={() => move(withdrawFromBank(player.bank, state.clock), "Cash is in your wallet.")}
            className="rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
          >
            Withdraw all
          </button>
        </div>
        {note ? <p className="mt-3 text-sm text-sky-200">{note}</p> : null}
        <p className="mt-3 text-[0.65rem] text-slate-500">Walk back to the doors and press E to leave</p>
    </div>
  );
}

function FlavorDesk({ building, state, role }: { building: Building; state: CityState; role: VenueRole }) {
  const [note, setNote] = useState<string | null>(null);
  const copy = deskCopy(role, building, state);
  return (
    <div className="rounded-2xl border border-amber-300/35 bg-[#14110c]/92 p-5 text-center shadow-2xl backdrop-blur">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">{venueLabel(role)}</p>
        <p className="mt-1 text-lg font-semibold text-white">{building.name}</p>
        <p className="mt-2 text-sm text-slate-300">{copy.body}</p>
        {copy.stat ? <p className="mt-2 text-sm font-semibold text-amber-200">{copy.stat}</p> : null}
        <button
          type="button"
          onClick={() => setNote(copy.actionNote)}
          className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206]"
        >
          {copy.action}
        </button>
        {note ? <p className="mt-3 text-sm text-sky-200">{note}</p> : null}
        <p className="mt-3 text-[0.65rem] text-slate-500">Walk back to the doors and press E to leave</p>
    </div>
  );
}

function deskCopy(role: VenueRole, building: Building, state: CityState) {
  const residents = state.citizens.filter((c) => c.homeId === building.id);
  const cash = formatPrice(readPortfolio().cash);
  switch (role) {
    case "hospital":
      return {
        body: "The nurse at the window can see you now. Walk-ins are welcome.",
        stat: null,
        action: "Check in",
        actionNote: "You're on the list. Take a seat — someone will call your name.",
      };
    case "school":
      return {
        body: "Homeroom is in session. The chalkboard still smells like yesterday's lesson.",
        stat: null,
        action: "Sit in on class",
        actionNote: "You catch the last of a civics lecture about Riverside's bridges.",
      };
    case "city_hall":
      return {
        body: "The clerk slides a ledger across the counter. City tools stay on the map view.",
        stat: `Treasury ${formatMoney(state.budget.treasury)}`,
        action: "Review the city",
        actionNote: "The books are in order. Exit to city view to change tools and budgets.",
      };
    case "police":
      return {
        body: "A sergeant nods from behind the glass. The holding cell is empty tonight.",
        stat: null,
        action: "File a report",
        actionNote: "They take your name and thank you. Riverside stays quiet.",
      };
    case "fire":
      return {
        body: "The engine bay smells like diesel and wet canvas. Helmets line the lockers.",
        stat: null,
        action: "Tour the house",
        actionNote: "A firefighter walks you past the rig and back to the door.",
      };
    case "office":
      return {
        body: "Badge readers blink at the desks.",
        stat: null,
        action: "Clock in",
        actionNote: "",
      };
    case "shop":
      return {
        body: "Shelves are stacked to the awning. The clerk waits at the counter.",
        stat: null,
        action: "Browse the store",
        actionNote: "You pick up a few things and leave them for the next visitor.",
      };
    case "restaurant":
      return {
        body: "Tables are set. The kitchen pass clatters behind the bar.",
        stat: null,
        action: "Take a table",
        actionNote: "A plate arrives. Riverside tastes better after a walk.",
      };
    case "bank":
      return {
        body: "The vault door is shut. A teller asks how they can help.",
        stat: `Brokerage cash ${cash}`,
        action: "Check the account",
        actionNote: `Your street-level brokerage still holds ${cash}.`,
      };
    case "house":
      return {
        body: residents[0]
          ? `${residents[0].name} waves you in from the kitchen.`
          : "The porch light is on. Nobody answers, but the door is open.",
        stat: residents.length ? `${residents.length} at home` : null,
        action: "Visit",
        actionNote: "You stay for a cup of coffee and the view of the street.",
      };
    case "apartment":
      return {
        body: residents[0]
          ? `${residents[0].name} buzzes you through to the landing.`
          : "Mail slots line the hall. A neighbor's radio plays down the corridor.",
        stat: residents.length ? `${residents.length} residents in` : null,
        action: "Visit residents",
        actionNote: "You say hello at a doorway and head back toward the stairs.",
      };
  }
}
