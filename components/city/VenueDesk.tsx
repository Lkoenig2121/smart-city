"use client";

import { formatPrice, readPortfolio } from "@/lib/city/brokerage";
import { venueLabel, venueRole, type VenueRole } from "@/lib/city/venues";
import type { Building, CityState } from "@/lib/city/types";
import { formatMoney } from "@/lib/simulation/buildings/buildings";
import { useState } from "react";

interface Props {
  building: Building;
  state: CityState;
}

export function VenueDesk({ building, state }: Props) {
  const role = venueRole(building) ?? "office";
  const [note, setNote] = useState<string | null>(null);
  const copy = deskCopy(role, building, state);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2">
      <div className="rounded-2xl border border-amber-300/35 bg-[#14110c]/92 p-5 text-center shadow-2xl backdrop-blur">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">{venueLabel(role)}</p>
        <p className="mt-1 text-lg font-semibold text-white">{building.name}</p>
        <p className="mt-2 text-sm text-slate-300">{copy.body}</p>
        {copy.stat ? <p className="mt-2 text-sm font-semibold text-amber-200">{copy.stat}</p> : null}
        <button
          onClick={() => setNote(copy.actionNote)}
          className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206]"
        >
          {copy.action}
        </button>
        {note ? <p className="mt-3 text-sm text-sky-200">{note}</p> : null}
        <p className="mt-3 text-[0.65rem] text-slate-500">Walk back to the doors and press E to leave</p>
      </div>
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
        body: "Badge readers blink at the desks. Someone left a mug on a cubicle wall.",
        stat: null,
        action: "Clock in",
        actionNote: "You log a short shift and the floor hums on without you.",
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
