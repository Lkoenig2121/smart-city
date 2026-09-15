"use client";

import { CharacterPreview } from "./CharacterPreview";
import { CLOTHING, STORES, clothingInStore, type ClothStore } from "@/lib/city/clothing";
import { formatDollars, type PlayerState } from "@/lib/city/player";
import type { CityClock } from "@/lib/city/types";
import { buyClothing, clothingPrice, equipOwned, itemLocked } from "@/lib/city/wardrobe";
import { useMemo, useState } from "react";

interface Props {
  store: ClothStore;
  player: PlayerState;
  clock: CityClock;
  onPlayer: (player: PlayerState) => void;
  onClose: () => void;
}

export function ClothingShop({ store, player, clock, onPlayer, onClose }: Props) {
  const info = STORES.find((item) => item.id === store);
  const catalog = useMemo(() => clothingInStore(store), [store]);
  const [picked, setPicked] = useState(catalog[0]?.id ?? CLOTHING[0].id);
  const [note, setNote] = useState<string | null>(null);
  const item = catalog.find((piece) => piece.id === picked) ?? catalog[0];
  if (!item) return null;
  const owned = player.life.owned.includes(item.id);
  const lock = itemLocked(player.life, item.id);
  const price = clothingPrice(player.life, item.id);
  const equipped = player.life.equipped[item.slot] === item.id;

  const apply = (result: PlayerState | string, ok: string) => {
    if (typeof result === "string") {
      setNote(result);
      return;
    }
    onPlayer(result);
    setNote(ok);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(44rem,calc(100vh-2rem))] w-[min(52rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-[#10141c]/95 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">{info?.name ?? "Store"}</p>
            <p className="text-lg font-semibold text-white">{info?.blurb}</p>
            <p className="text-sm text-sky-100/80">Wallet {formatDollars(player.wallet)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            Close · Esc
          </button>
        </header>
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 md:grid-cols-[minmax(0,14rem)_minmax(0,16rem)_1fr]">
          <div className="min-h-0 space-y-1.5 overflow-y-auto">
            {catalog.map((piece) => {
              const have = player.life.owned.includes(piece.id);
              const blocked = itemLocked(player.life, piece.id);
              return (
                <button
                  key={piece.id}
                  type="button"
                  onClick={() => {
                    setPicked(piece.id);
                    setNote(null);
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    piece.id === item.id
                      ? "border-amber-300/50 bg-amber-400/15"
                      : "border-white/10 bg-black/25 hover:border-white/25"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{piece.name}</p>
                  <p className="text-[0.65rem] text-slate-400">
                    {have ? "Owned" : blocked ? "Locked" : formatDollars(clothingPrice(player.life, piece.id))}
                  </p>
                </button>
              );
            })}
          </div>
          <CharacterPreview slots={player.life.equipped} previewId={item.id} />
          <div className="space-y-3">
            <p className="text-xl font-semibold text-white">{item.name}</p>
            <p className="text-sm text-slate-300">{item.description}</p>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              {item.slot} · {item.category} · {item.collection} · level {item.level}
            </p>
            {item.skill ? (
              <p className="text-xs text-slate-400">
                Needs {item.skill.path} skill {item.skill.level}
              </p>
            ) : null}
            {item.bonus ? (
              <p className="text-xs text-amber-200/90">
                Optional bonus: {item.bonus.stat} +{Math.round(item.bonus.amount * 100)}%
              </p>
            ) : null}
            <p className="text-lg font-semibold text-amber-200">{formatDollars(price)}</p>
            {lock ? <p className="text-sm text-rose-200">{lock}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={owned || Boolean(lock) || player.wallet < price}
                onClick={() => apply(buyClothing(item.id, clock), `Purchased ${item.name}.`)}
                className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206] disabled:opacity-40"
              >
                {owned ? "Owned" : "Buy"}
              </button>
              <button
                type="button"
                disabled={!owned || equipped}
                onClick={() => apply(equipOwned(item.id), `Wearing ${item.name}.`)}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-40"
              >
                {equipped ? "Equipped" : "Equip"}
              </button>
            </div>
            {note ? <p className="text-sm text-sky-200">{note}</p> : null}
            <p className="text-[0.65rem] text-slate-500">
              Unlocking a collection does not buy the clothes. Preview is the live character doll.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
