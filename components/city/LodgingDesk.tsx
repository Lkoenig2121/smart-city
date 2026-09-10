"use client";

import {
  canEnterLodgingRoom,
  lodgingLevels,
  lodgingUse,
  type LodgingLevel,
  type LodgingRoom,
} from "@/lib/city/lodging";
import type { Building } from "@/lib/city/types";
import { useMemo, useState } from "react";

interface Props {
  building: Building;
  hasKey: boolean;
  onEnterRoom: (room: LodgingRoom) => void;
  onPool: () => void;
}

type Pane = "menu" | "levels" | "rooms";

export function LodgingDesk({ building, hasKey, onEnterRoom, onPool }: Props) {
  const hotel = lodgingUse(building) === "hotel";
  const levels = useMemo(() => lodgingLevels(building), [building]);
  const [pane, setPane] = useState<Pane>("menu");
  const [level, setLevel] = useState<LodgingLevel | null>(null);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2">
      <div className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto rounded-2xl border border-amber-300/35 bg-[#14110c]/92 p-5 shadow-2xl backdrop-blur">
        <p className="text-center text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
          Front desk
        </p>
        <p className="mt-1 text-center text-lg font-semibold text-white">{building.name}</p>

        {pane === "menu" ? (
          <DeskMenu
            hotel={hotel}
            hasKey={hasKey}
            onLevels={() => setPane("levels")}
            onPool={hasKey || !hotel ? onPool : undefined}
          />
        ) : pane === "levels" ? (
          <LevelPicker
            hotel={hotel}
            hasKey={hasKey}
            levels={levels}
            onBack={() => setPane("menu")}
            onPick={(next) => {
              setLevel(next);
              setPane("rooms");
            }}
          />
        ) : level ? (
          <RoomPicker
            buildingId={building.id}
            hotel={hotel}
            hasKey={hasKey}
            level={level}
            onBack={() => {
              setPane("levels");
              setLevel(null);
            }}
            onEnterRoom={onEnterRoom}
          />
        ) : null}

        <p className="mt-3 text-center text-[0.65rem] text-slate-500">
          Walk back to the doors and press E to leave
        </p>
      </div>
    </div>
  );
}

function DeskMenu({
  hotel,
  hasKey,
  onLevels,
  onPool,
}: {
  hotel: boolean;
  hasKey: boolean;
  onLevels: () => void;
  onPool?: () => void;
}) {
  return (
    <>
      <p className="mt-2 text-center text-sm text-slate-300">
        {hotel
          ? hasKey
            ? "You already have a room in this building. Only that room will open."
            : "A night in a city-view suite is $189. You may rent one room."
          : "Welcome home. You have one apartment in this building."}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={onLevels}
          className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206]"
        >
          {hotel && !hasKey ? "Rent a room" : "Go to your room"}
        </button>
        {onPool ? (
          <button
            onClick={onPool}
            className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
          >
            Roof deck pool
          </button>
        ) : null}
      </div>
    </>
  );
}

function LevelPicker({
  hotel,
  hasKey,
  levels,
  onBack,
  onPick,
}: {
  hotel: boolean;
  hasKey: boolean;
  levels: LodgingLevel[];
  onBack: () => void;
  onPick: (level: LodgingLevel) => void;
}) {
  return (
    <>
      <button onClick={onBack} className="mt-3 text-xs font-semibold text-amber-300 hover:text-amber-200">
        ← Front desk
      </button>
      <p className="mt-1 text-center text-base font-semibold text-white">Go to a level</p>
      <p className="mt-1 text-center text-xs text-slate-400">
        {hotel
          ? hasKey
            ? "Your room is the only one that will unlock."
            : "Select a floor. You can rent one available room."
          : "Select a floor. Only your apartment will open."}
      </p>
      <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-2">
        <div className="grid grid-cols-4 gap-1.5">
          {levels.map((item) => {
            const yours = item.rooms.some((room) => room.status === "yours");
            return (
              <button
                key={item.level}
                onClick={() => onPick(item)}
                className={`rounded-lg px-2 py-2 text-sm font-semibold ${
                  yours
                    ? "bg-amber-400 text-[#1a1206]"
                    : "bg-white/10 text-white hover:bg-amber-400 hover:text-[#1a1206]"
                }`}
              >
                {item.level}
                {yours ? (
                  <span className="block text-[0.55rem] font-medium opacity-80">Yours</span>
                ) : item.club ? (
                  <span className="block text-[0.55rem] font-medium opacity-80">Club</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function RoomPicker({
  buildingId,
  hotel,
  hasKey,
  level,
  onBack,
  onEnterRoom,
}: {
  buildingId: string;
  hotel: boolean;
  hasKey: boolean;
  level: LodgingLevel;
  onBack: () => void;
  onEnterRoom: (room: LodgingRoom) => void;
}) {
  return (
    <>
      <button onClick={onBack} className="mt-3 text-xs font-semibold text-amber-300 hover:text-amber-200">
        ← Levels
      </button>
      <p className="mt-1 text-center text-base font-semibold text-white">
        {level.label}
        {level.club ? <span className="ml-2 text-xs font-medium text-amber-300">Club</span> : null}
      </p>
      <p className="mt-1 text-center text-xs text-slate-400">
        {hotel
          ? hasKey
            ? "Only your rented room will open."
            : `${level.rooms.length} rooms · rent one available room`
          : `${level.rooms.length} apartments · only yours will open`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {level.rooms.map((room) => {
          const open = canEnterLodgingRoom(buildingId, room, hotel, hasKey);
          return (
            <button
              key={room.id}
              disabled={!open}
              onClick={() => onEnterRoom(room)}
              className={`rounded-xl px-3 py-2 text-left transition ${
                room.status === "yours"
                  ? "bg-amber-400 text-[#1a1206]"
                  : open
                    ? "bg-white/10 text-white hover:bg-white/20"
                    : "cursor-not-allowed bg-white/5 text-slate-500"
              }`}
            >
              <span className="block text-sm font-semibold">
                {hotel ? `Room ${room.label}` : `Apt ${room.label}`}
              </span>
              <span className={`block text-[0.65rem] ${room.status === "yours" ? "text-[#5a3d10]" : "text-slate-400"}`}>
                {roomStatusLabel(hotel, room.status, open, hasKey)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function roomStatusLabel(hotel: boolean, status: LodgingRoom["status"], open: boolean, hasKey: boolean) {
  if (status === "yours") return hotel ? "Your room" : "Your apartment";
  if (hotel && !hasKey && status === "open" && open) return "Available to rent";
  if (status === "open") return hotel ? "Unavailable" : "Vacant";
  return hotel ? "Occupied" : "Resident";
}
