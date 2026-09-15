"use client";

import { buyConsumable } from "@/lib/city/bag";
import { CONSUMABLES, type ConsumableItem } from "@/lib/city/consumables";
import { formatDollars, type PlayerState } from "@/lib/city/player";
import type { CityClock } from "@/lib/city/types";
import { useState } from "react";

const DRINKS = CONSUMABLES.filter((item) => item.kind === "drink");
const FOOD = CONSUMABLES.filter((item) => item.kind === "food");

interface Props {
  clock: CityClock;
  player: PlayerState;
  onPlayerChange: (player: PlayerState) => void;
  onClose?: () => void;
  onInventory?: () => void;
}

export function PoolBar({ clock, player, onPlayerChange, onClose, onInventory }: Props) {
  const [note, setNote] = useState<string | null>(null);

  const buy = (item: ConsumableItem) => {
    const result = buyConsumable(item.id, clock);
    if (typeof result === "string") {
      setNote(result);
      return;
    }
    onPlayerChange(result);
    setNote(`They hand you ${item.name.toLowerCase()}.`);
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 grid place-items-center p-4"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose?.();
      }}
    >
      <div
        className="w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-teal-300/35 bg-[#10201f]/94 p-5 shadow-2xl backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-center text-[0.65rem] uppercase tracking-[0.28em] text-teal-200">Roof deck</p>
        <p className="mt-1 text-center text-lg font-semibold text-white">Cabana bar</p>
        <p className="mt-1 text-center text-sm text-slate-300">Food and drinks at the pool. Wallet {formatDollars(player.wallet)}</p>

        <Section title="Drinks" items={DRINKS} wallet={player.wallet} bag={player.life.bag ?? {}} onBuy={buy} />
        <Section title="Food" items={FOOD} wallet={player.wallet} bag={player.life.bag ?? {}} onBuy={buy} />

        {note ? <p className="mt-3 text-center text-sm text-teal-100">{note}</p> : null}
        <div className="mt-3 flex items-center justify-center gap-2">
          {onInventory ? (
            <button
              type="button"
              onClick={onInventory}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              Inventory
            </button>
          ) : null}
          <p className="text-[0.65rem] text-slate-500">P or Esc to close</p>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  wallet,
  bag,
  onBuy,
}: {
  title: string;
  items: ConsumableItem[];
  wallet: number;
  bag: Record<string, number>;
  onBuy: (item: ConsumableItem) => void;
}) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-teal-200/80">{title}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => {
          const short = wallet < item.price;
          const have = bag[item.id] ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              disabled={short}
              onClick={() => onBuy(item)}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>
                <span className="block text-sm font-medium text-white">{item.name}</span>
                <span className="block text-[0.7rem] text-slate-400">
                  {item.detail}
                  {have ? ` · ${have} in bag` : ""}
                </span>
              </span>
              <span className="text-sm font-semibold text-amber-200">{formatDollars(item.price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
