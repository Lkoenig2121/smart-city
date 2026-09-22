"use client";

import {
  FURNISH_STORES,
  HOME_LISTINGS,
  buyFurnishing,
  buyHome,
  equipFurnishing,
  furnishingsInStore,
  type FurnishStore,
} from "@/lib/city/furnishings";
import { formatDollars, type PlayerState } from "@/lib/city/player";
import type { CityClock } from "@/lib/city/types";
import { useMemo, useState } from "react";

interface Props {
  store: FurnishStore;
  player: PlayerState;
  clock: CityClock;
  onPlayer: (player: PlayerState) => void;
  onClose: () => void;
  /** Opens an owned home interior after purchase / visit. */
  onVisitHome?: (homeId: string) => void;
}

export function FurnitureShop({ store, player, clock, onPlayer, onClose, onVisitHome }: Props) {
  const info = FURNISH_STORES.find((item) => item.id === store);
  const isEstate = store === "estate";
  const catalog = useMemo(() => furnishingsInStore(store), [store]);
  const [picked, setPicked] = useState(isEstate ? HOME_LISTINGS[0]?.id ?? "" : catalog[0]?.id ?? "");
  const [note, setNote] = useState<string | null>(null);

  const apply = (result: PlayerState | string, ok: string) => {
    if (typeof result === "string") {
      setNote(result);
      return;
    }
    onPlayer(result);
    setNote(ok);
  };

  if (isEstate) {
    const listing = HOME_LISTINGS.find((item) => item.id === picked) ?? HOME_LISTINGS[0];
    if (!listing) return null;
    const owned = player.ownedHomes.find((home) => home.listingId === listing.id);
    return (
      <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="flex max-h-[min(44rem,calc(100vh-2rem))] w-[min(48rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-[#10141c]/95 shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-3">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">{info?.name}</p>
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
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 md:grid-cols-[minmax(0,16rem)_1fr]">
            <div className="min-h-0 space-y-1.5 overflow-y-auto">
              {HOME_LISTINGS.map((item) => {
                const have = player.ownedHomes.some((home) => home.listingId === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPicked(item.id);
                      setNote(null);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      item.id === listing.id
                        ? "border-amber-300/50 bg-amber-400/15"
                        : "border-white/10 bg-black/25 hover:border-white/25"
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="text-[0.65rem] text-slate-400">
                      {have ? "Owned" : formatDollars(item.price)} · {item.kind}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              <p className="text-xl font-semibold text-white">{listing.name}</p>
              <p className="text-sm text-slate-300">{listing.description}</p>
              <p className="text-xs uppercase tracking-wider text-slate-500">{listing.blurb}</p>
              <p className="text-lg font-semibold text-amber-200">{formatDollars(listing.price)}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(owned) || player.wallet < listing.price}
                  onClick={() => apply(buyHome(listing.id, clock), `Deed recorded for ${listing.name}.`)}
                  className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206] disabled:opacity-40"
                >
                  {owned ? "Owned" : "Buy property"}
                </button>
                {owned && onVisitHome ? (
                  <button
                    type="button"
                    onClick={() => onVisitHome(owned.id)}
                    className="rounded-xl bg-sky-400/90 px-4 py-2.5 text-sm font-semibold text-[#0a1a22]"
                  >
                    Visit home
                  </button>
                ) : null}
              </div>
              {player.ownedHomes.length ? (
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">Your deeds</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {player.ownedHomes.map((home) => (
                      <li key={home.id} className="flex items-center justify-between gap-2">
                        <span>
                          {home.name} · {home.kind}
                        </span>
                        {onVisitHome ? (
                          <button
                            type="button"
                            onClick={() => onVisitHome(home.id)}
                            className="rounded-lg bg-white/10 px-2 py-1 text-[0.65rem] text-white/80 hover:bg-white/15"
                          >
                            Visit
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {note ? <p className="text-sm text-amber-200">{note}</p> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const item = catalog.find((piece) => piece.id === picked) ?? catalog[0];
  if (!item) return null;
  const owned = player.ownedFurnishings.includes(item.id);
  const equipped =
    (item.slot === "tv" && player.equippedFurnish.tvId === item.id) ||
    (item.slot === "console" && player.equippedFurnish.consoleId === item.id) ||
    (item.slot === "floor" && player.equippedFurnish.floorId === item.id) ||
    (item.slot === "bed" && player.equippedFurnish.bedId === item.id);

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(44rem,calc(100vh-2rem))] w-[min(48rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-[#10141c]/95 shadow-2xl">
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
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 md:grid-cols-[minmax(0,16rem)_1fr]">
          <div className="min-h-0 space-y-1.5 overflow-y-auto">
            {catalog.map((piece) => {
              const have = player.ownedFurnishings.includes(piece.id);
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
                    {have ? "Owned" : formatDollars(piece.price)} · {piece.slot}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="space-y-3">
            <div
              className="grid h-36 place-items-center rounded-2xl border border-white/10"
              style={{
                background:
                  item.slot === "floor"
                    ? item.floorColor ?? "#c4a882"
                    : item.slot === "bed"
                      ? item.bedColor ?? "#f4f1ea"
                      : "linear-gradient(160deg, #1a2434, #0c121c)",
              }}
            >
              {item.slot === "tv" ? (
                <div
                  className="rounded-md border border-white/20 bg-[#0a0c10] shadow-lg"
                  style={{
                    width: `${7.2 * (item.tvScale ?? 1)}rem`,
                    height: `${4 * (item.tvScale ?? 1)}rem`,
                  }}
                />
              ) : item.slot === "console" ? (
                <div className="rounded-lg bg-[#1a1a1e] px-6 py-3 text-center text-xs font-semibold text-sky-200">
                  PS4 · Nuketown
                </div>
              ) : item.slot === "bed" ? (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="h-3 w-28 rounded-sm border border-black/20"
                    style={{ background: item.bedFrameColor ?? "#5a3d28" }}
                  />
                  <p className="rounded-lg bg-black/35 px-3 py-1 text-xs font-semibold text-white/90">
                    Bed sample
                  </p>
                </div>
              ) : (
                <p className="rounded-lg bg-black/35 px-3 py-1 text-xs font-semibold text-white/90">Floor sample</p>
              )}
            </div>
            <p className="text-xl font-semibold text-white">{item.name}</p>
            <p className="text-sm text-slate-300">{item.description}</p>
            <p className="text-xs uppercase tracking-wider text-slate-500">{item.slot}</p>
            <p className="text-lg font-semibold text-amber-200">{formatDollars(item.price)}</p>
            <p className="text-xs text-slate-400">
              Buys equip into your hotel room and owned homes right away.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={owned || player.wallet < item.price}
                onClick={() => apply(buyFurnishing(item.id, clock), `Purchased ${item.name}.`)}
                className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206] disabled:opacity-40"
              >
                {owned ? "Owned" : "Buy"}
              </button>
              <button
                type="button"
                disabled={!owned || equipped}
                onClick={() => apply(equipFurnishing(item.id), `Equipped ${item.name}.`)}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {equipped ? "In your room" : "Use in room"}
              </button>
            </div>
            {note ? <p className="text-sm text-amber-200">{note}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
