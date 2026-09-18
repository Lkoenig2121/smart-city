"use client";

import {
  VEHICLE_CATALOG,
  categoryLabel,
  grantOwnedVehicle,
  vehicleById,
  vehiclePurchaseDescription,
  type VehicleCatalogItem,
} from "@/lib/city/vehicles";
import { awardXp, formatDollars, spendWallet, writePlayer, type PlayerState } from "@/lib/city/player";
import type { CityClock } from "@/lib/city/types";
import { useMemo, useState } from "react";

interface Props {
  player: PlayerState;
  clock: CityClock;
  onPlayer: (player: PlayerState) => void;
  onClose: () => void;
}

export function MotorsShowroom({ player, clock, onPlayer, onClose }: Props) {
  const catalog = useMemo(() => VEHICLE_CATALOG, []);
  const [picked, setPicked] = useState(catalog[0]?.id ?? "riv-sedan");
  const [color, setColor] = useState(catalog[0]?.colors[0] ?? "#1f4d8c");
  const [note, setNote] = useState<string | null>(null);
  const item = catalog.find((piece) => piece.id === picked) ?? catalog[0];
  if (!item) return null;

  const ownedCount = player.ownedVehicles.filter((car) => car.catalogId === item.id).length;
  const canAfford = player.wallet >= item.price;

  const select = (next: VehicleCatalogItem) => {
    setPicked(next.id);
    setColor(next.colors[0]);
    setNote(null);
  };

  const purchase = () => {
    const spent = spendWallet(item.price, clock, vehiclePurchaseDescription(item.id, clock));
    if (typeof spent === "string") {
      setNote(spent);
      return;
    }
    const granted = grantOwnedVehicle(spent, item.id, color);
    if (typeof granted === "string") {
      setNote(granted);
      return;
    }
    writePlayer(granted);
    awardXp(80, `buy-car:${item.id}`, "exploration");
    onPlayer(granted);
    setNote(`${item.name} is yours — it's waiting on the lot outside.`);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(44rem,calc(100vh-2rem))] w-[min(52rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-sky-300/30 bg-[#10141c]/95 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-sky-300">Riverside Motors</p>
            <p className="text-lg font-semibold text-white">New &amp; ready to drive</p>
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
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 md:grid-cols-[minmax(0,14rem)_1fr]">
          <div className="min-h-0 space-y-1.5 overflow-y-auto">
            {catalog.map((piece) => (
              <button
                key={piece.id}
                type="button"
                onClick={() => select(piece)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${
                  piece.id === item.id
                    ? "border-sky-300/50 bg-sky-400/15"
                    : "border-white/10 bg-black/25 hover:border-white/25"
                }`}
              >
                <p className="text-sm font-semibold text-white">{piece.name}</p>
                <p className="text-[0.65rem] text-slate-400">
                  {categoryLabel(piece.category)} · {formatDollars(piece.price)}
                </p>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div
              className="relative h-40 overflow-hidden rounded-2xl border border-white/10"
              style={{ background: `linear-gradient(160deg, #1a2230, ${item.colors[0]}55)` }}
            >
              <div
                className="absolute bottom-6 left-1/2 h-16 w-36 -translate-x-1/2 rounded-xl shadow-xl"
                style={{ background: color }}
              />
              <div className="absolute bottom-4 left-1/2 h-3 w-28 -translate-x-1/2 rounded-full bg-black/50" />
              <p className="absolute left-3 top-3 text-[0.65rem] uppercase tracking-[0.2em] text-white/70">
                Showroom
              </p>
            </div>
            <p className="text-xl font-semibold text-white">{item.name}</p>
            <p className="text-sm text-slate-300">{item.description}</p>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              {categoryLabel(item.category)} · {item.seats} seats · top {(vehicleById(item.id)?.topSpeed ?? 0) * 2} mph feel
            </p>
            <div className="flex flex-wrap gap-2">
              {item.colors.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  className={`h-8 w-8 rounded-full border-2 ${
                    color === swatch ? "border-white" : "border-transparent"
                  }`}
                  style={{ background: swatch }}
                  aria-label={`Paint ${swatch}`}
                />
              ))}
            </div>
            <p className="text-lg font-semibold text-amber-200">{formatDollars(item.price)}</p>
            <button
              type="button"
              disabled={!canAfford}
              onClick={purchase}
              className="rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-semibold text-[#0b1420] disabled:opacity-40"
            >
              {canAfford ? "Purchase" : "Not enough cash"}
            </button>
            {ownedCount > 0 ? (
              <p className="text-xs text-emerald-200">You already own {ownedCount} of this model.</p>
            ) : null}
            {note ? <p className="text-sm text-sky-200">{note}</p> : null}
            <p className="text-[0.65rem] text-slate-500">
              Purchased cars park on the Motors lot. Press E beside yours to drive.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
