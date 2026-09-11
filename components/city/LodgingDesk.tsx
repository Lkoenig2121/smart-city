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
  currentRoomId?: string | null;
  onEnterRoom: (room: LodgingRoom) => void;
  onPool: () => void;
  onClose?: () => void;
}

type Pane = "menu" | "levels" | "rooms";

export function LodgingDesk({
  building,
  hasKey,
  currentRoomId = null,
  onEnterRoom,
  onPool,
  onClose,
}: Props) {
  const hotel = lodgingUse(building) === "hotel";
  const levels = useMemo(
    () => lodgingLevels(building),
    [building, currentRoomId],
  );
  const startLevel = currentRoomId
    ? (levels.find((item) =>
        item.rooms.some((room) => room.id === currentRoomId),
      ) ?? null)
    : null;
  const [pane, setPane] = useState<Pane>(
    onClose ? (startLevel ? "rooms" : "levels") : "menu",
  );
  const [level, setLevel] = useState<LodgingLevel | null>(startLevel);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2">
      <div className="max-h-[min(40rem,calc(100vh-2rem))] overflow-y-auto rounded-2xl border border-amber-300/35 bg-[#14110c]/92 p-5 shadow-2xl backdrop-blur">
        <p className="text-center text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
          {onClose ? "Change rooms" : "Front desk"}
        </p>
        <p className="mt-1 text-center text-lg font-semibold text-white">
          {building.name}
        </p>

        {pane === "menu" ? (
          <DeskMenu
            hotel={hotel}
            hasKey={hasKey}
            currentRoomId={currentRoomId}
            onLevels={() => setPane("levels")}
            onPool={hasKey || !hotel ? onPool : undefined}
          />
        ) : pane === "levels" ? (
          <LevelPicker
            hotel={hotel}
            hasKey={hasKey}
            levels={levels}
            currentRoomId={currentRoomId}
            onBack={() => (onClose ? onClose() : setPane("menu"))}
            onPick={(next) => {
              setLevel(next);
              setPane("rooms");
            }}
            backLabel={onClose ? "Stay here" : "← Front desk"}
          />
        ) : level ? (
          <RoomPicker
            buildingId={building.id}
            hotel={hotel}
            hasKey={hasKey}
            level={level}
            currentRoomId={currentRoomId}
            onBack={() => {
              setPane("levels");
              setLevel(null);
            }}
            onEnterRoom={onEnterRoom}
          />
        ) : null}

        <p className="mt-3 text-center text-[0.65rem] text-slate-500">
          {onClose
            ? "Occupied rooms stay locked"
            : "Walk back to the doors and press E to leave"}
        </p>
      </div>
    </div>
  );
}

function DeskMenu({
  hotel,
  hasKey,
  currentRoomId,
  onLevels,
  onPool,
}: {
  hotel: boolean;
  hasKey: boolean;
  currentRoomId?: string | null;
  onLevels: () => void;
  onPool?: () => void;
}) {
  return (
    <>
      <p className="mt-2 text-center text-sm text-slate-300">
        {hotel
          ? hasKey
            ? "Switch to any available room. Occupied rooms stay locked."
            : "A night in a city-view suite is $189. Pick any available room — you can change later."
          : "Welcome home. You can visit vacant apartments on other floors."}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={onLevels}
          className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206]"
        >
          {hotel && !hasKey
            ? "Rent a room"
            : currentRoomId
              ? "Vist room"
              : "Choose a room"}
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
  currentRoomId,
  onBack,
  onPick,
  backLabel,
}: {
  hotel: boolean;
  hasKey: boolean;
  levels: LodgingLevel[];
  currentRoomId?: string | null;
  onBack: () => void;
  onPick: (level: LodgingLevel) => void;
  backLabel: string;
}) {
  return (
    <>
      <button
        onClick={onBack}
        className="mt-3 text-xs font-semibold text-amber-300 hover:text-amber-200"
      >
        {backLabel}
      </button>
      <p className="mt-1 text-center text-base font-semibold text-white">
        Go to a level
      </p>
      <p className="mt-1 text-center text-xs text-slate-400">
        {hotel
          ? hasKey
            ? "Pick a floor, then any open room."
            : "Select a floor. You can rent any available room."
          : "Select a floor. Vacant apartments will open."}
      </p>
      <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-2">
        <div className="grid grid-cols-4 gap-1.5">
          {levels.map((item) => {
            const yours = item.rooms.some(
              (room) => room.id === currentRoomId || room.status === "yours",
            );
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
                  <span className="block text-[0.55rem] font-medium opacity-80">
                    Here
                  </span>
                ) : item.club ? (
                  <span className="block text-[0.55rem] font-medium opacity-80">
                    Club
                  </span>
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
  currentRoomId,
  onBack,
  onEnterRoom,
}: {
  buildingId: string;
  hotel: boolean;
  hasKey: boolean;
  level: LodgingLevel;
  currentRoomId?: string | null;
  onBack: () => void;
  onEnterRoom: (room: LodgingRoom) => void;
}) {
  return (
    <>
      <button
        onClick={onBack}
        className="mt-3 text-xs font-semibold text-amber-300 hover:text-amber-200"
      >
        ← Levels
      </button>
      <p className="mt-1 text-center text-base font-semibold text-white">
        {level.label}
        {level.club ? (
          <span className="ml-2 text-xs font-medium text-amber-300">Club</span>
        ) : null}
      </p>
      <p className="mt-1 text-center text-xs text-slate-400">
        {hotel
          ? `${level.rooms.length} rooms · occupied stays locked`
          : `${level.rooms.length} apartments · occupied stays locked`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {level.rooms.map((room) => {
          const here = room.id === currentRoomId;
          const open =
            !here && canEnterLodgingRoom(buildingId, room, hotel, hasKey);
          return (
            <button
              key={room.id}
              disabled={!open && !here}
              onClick={() => onEnterRoom(room)}
              className={`rounded-xl px-3 py-2 text-left transition ${
                here || room.status === "yours"
                  ? "bg-amber-400 text-[#1a1206]"
                  : open
                    ? "bg-white/10 text-white hover:bg-white/20"
                    : "cursor-not-allowed bg-white/5 text-slate-500"
              }`}
            >
              <span className="block text-sm font-semibold">
                {hotel ? `Room ${room.label}` : `Apt ${room.label}`}
              </span>
              <span
                className={`block text-[0.65rem] ${here || room.status === "yours" ? "text-[#5a3d10]" : "text-slate-400"}`}
              >
                {roomStatusLabel(hotel, room, here, open, hasKey)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function roomStatusLabel(
  hotel: boolean,
  room: LodgingRoom,
  here: boolean,
  open: boolean,
  hasKey: boolean,
) {
  if (here) return hotel ? "You're in this room" : "You're in this apartment";
  if (room.status === "yours") return hotel ? "Your room" : "Your apartment";
  if (open) {
    if (hotel) return hasKey ? "Available · switch" : "Available to rent";
    return "Vacant · enter";
  }
  if (room.status === "open") return hotel ? "Unavailable" : "Vacant";
  return hotel ? "Occupied" : "Resident";
}
