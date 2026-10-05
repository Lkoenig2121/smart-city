"use client";

import { buyConsumable } from "@/lib/city/bag";
import { consumableById, VENDING_ROWS, type ConsumableItem, type VendFace } from "@/lib/city/consumables";
import { formatDollars, type PlayerState } from "@/lib/city/player";
import type { CityClock } from "@/lib/city/types";
import { useState } from "react";

interface Props {
  clock: CityClock;
  player: PlayerState;
  onPlayerChange: (player: PlayerState) => void;
  onClose: () => void;
  onInventory?: () => void;
}

export function VendingMachine({ clock, player, onPlayerChange, onClose, onInventory }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const [bin, setBin] = useState<ConsumableItem | null>(null);
  const [dropKey, setDropKey] = useState(0);

  const take = (id: string) => {
    const item = consumableById(id);
    if (!item) return;
    const result = buyConsumable(id, clock, "Vending machine");
    if (typeof result === "string") {
      setNote(result);
      return;
    }
    onPlayerChange(result);
    setBin(item);
    setDropKey((n) => n + 1);
    setNote(`${item.name} drops into the bin.`);
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/45 p-3"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <style>{`@keyframes vendDrop { from { transform: translateY(-220px); opacity: 0.15 } to { transform: none; opacity: 1 } }`}</style>
      <div
        className="flex h-[min(40rem,calc(100%-1rem))] w-[min(22rem,calc(100%-1rem))] overflow-hidden rounded-md border border-white/80 bg-[#f4f1ea] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 flex-1 flex-col bg-[#121417]">
          <div className="flex items-center justify-between px-3 py-2 text-white">
            <p className="text-[0.6rem] uppercase tracking-[0.22em] text-amber-200">Snacks</p>
            <p className="text-[0.65rem] text-slate-300">{formatDollars(player.wallet)}</p>
          </div>
          <div className="mx-2 flex-1 space-y-1.5 overflow-y-auto rounded-sm border border-white/10 bg-black/40 p-1.5">
            {VENDING_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-3 gap-1.5">
                {row.map((slot) => {
                  const item = consumableById(slot.id);
                  if (!item) return null;
                  const owned = player.life.bag?.[item.id] ?? 0;
                  const short = player.wallet < item.price;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => take(item.id)}
                      className="flex min-h-[5.4rem] flex-col items-center justify-between rounded-sm bg-[#1a1d22] p-1 text-center ring-1 ring-white/10 hover:ring-amber-300/70"
                    >
                      <Face face={slot.face} />
                      <span className="mt-1 w-full truncate text-[0.58rem] font-semibold leading-tight text-white">
                        {item.name}
                      </span>
                      <span className={`text-[0.55rem] ${short ? "text-rose-300" : "text-amber-200"}`}>
                        {formatDollars(item.price)}
                        {owned > 0 ? ` · ${owned}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mx-2 mb-2 mt-1.5 flex h-16 items-center justify-center rounded-sm border border-white/15 bg-[#0c0d10]">
            {bin ? (
              <div key={dropKey} className="flex items-center gap-2" style={{ animation: "vendDrop 0.45s ease-in" }}>
                <Face face={faceFor(bin.id)} small />
                <p className="text-xs font-semibold text-white">{bin.name}</p>
              </div>
            ) : (
              <p className="text-[0.65rem] text-slate-500">Retrieval bin</p>
            )}
          </div>
          {note ? <p className="px-3 pb-1 text-center text-[0.65rem] text-amber-100">{note}</p> : null}
          <div className="flex items-center justify-between px-3 pb-2">
            {onInventory ? (
              <button type="button" onClick={onInventory} className="text-[0.65rem] text-slate-300 underline">
                Inventory
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={onClose} className="text-[0.65rem] text-slate-300 underline">
              Esc to close
            </button>
          </div>
        </div>
        <div className="w-3 bg-[#f7f4ee]" />
      </div>
    </div>
  );
}

function faceFor(id: string): VendFace {
  for (const row of VENDING_ROWS) {
    const slot = row.find((entry) => entry.id === id);
    if (slot) return slot.face;
  }
  return "chips";
}

const SNACK_COLORS: Record<VendFace, string> = {
  chips: "#f2c200",
  bbq: "#c45c26",
  onion: "#6aaa4a",
  puffs: "#f0a020",
  pretzel: "#e0b15a",
  tortilla: "#e8a317",
  chocolate: "#6a3a32",
  cookie: "#c47a3a",
  candy: "#e23b6a",
  cola: "#b42318",
  water: "#d7eef8",
  juice: "#f0a020",
};

function Face({ face, small = false }: { face: VendFace; small?: boolean }) {
  const box = small ? "h-8 w-8" : "h-10 w-full";
  const color = SNACK_COLORS[face];
  if (face === "cola" || face === "juice" || face === "water") {
    return (
      <span className={`${box} grid place-items-center`}>
        <span className="h-8 w-4 rounded-sm" style={{ background: color }} />
      </span>
    );
  }
  if (face === "chocolate" || face === "cookie") {
    return (
      <span className={`${box} grid place-items-center`}>
        <span className="h-4 w-7 rounded-sm" style={{ background: color }} />
      </span>
    );
  }
  return (
    <span className={`${box} grid place-items-center`}>
      <span className="h-8 w-6 rounded-b-md rounded-t-sm" style={{ background: color }} />
    </span>
  );
}
