"use client";

import {
  ACCESSORIES,
  INTERIORS,
  PAINTS,
  PERFORMANCE_STAGES,
  PLATE_PRICE,
  TIER_NAMES,
  WHEELS,
  activeOwnedVehicle,
  applyGarageOrder,
  driveStats,
  garageQuote,
  modPrice,
  previewGarageOrder,
  repairPrice,
  vehicleById,
  type GarageOrder,
  type OwnedVehicle,
} from "@/lib/city/vehicles";
import { GARAGE_NAME } from "@/lib/city/venues";
import { awardXp, formatDollars, readPlayer, spendWallet, writePlayer, type PlayerState } from "@/lib/city/player";
import type { CityClock } from "@/lib/city/types";
import { useState } from "react";
import { CarTurntable } from "./CarTurntable";

type Tab = "color" | "wheels" | "performance" | "interior" | "plate" | "accessories" | "repair";

const TABS: { id: Tab; label: string }[] = [
  { id: "color", label: "Color" },
  { id: "wheels", label: "Wheels" },
  { id: "performance", label: "Performance" },
  { id: "interior", label: "Interior" },
  { id: "plate", label: "License Plate" },
  { id: "accessories", label: "Accessories" },
  { id: "repair", label: "Repair" },
];

interface Props {
  player: PlayerState;
  clock: CityClock;
  onPlayer: (player: PlayerState) => void;
  onClose: () => void;
  /** Present when you drove into the bay; reverses the car back out. */
  onBackOut?: () => void;
}

export function MikesGarage({ player, clock, onPlayer, onClose, onBackOut }: Props) {
  const [carId, setCarId] = useState(() => activeOwnedVehicle(player)?.id ?? null);
  const [tab, setTab] = useState<Tab>("color");
  const [plate, setPlate] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ order: GarageOrder; label: string } | null>(null);
  const car = player.ownedVehicles.find((item) => item.id === carId) ?? player.ownedVehicles[0] ?? null;
  const shown = car ? previewGarageOrder(car, preview?.order ?? null) : null;
  const previewQuote = car && preview ? garageQuote(car, preview.order) : null;

  const tryOn = (next: GarageOrder, label: string) => {
    setPreview({ order: next, label });
    setNote(null);
  };

  const order = (next: GarageOrder, label: string) => {
    if (!car) return;
    const quote = garageQuote(car, next);
    if (typeof quote === "string") {
      setNote(quote);
      return;
    }
    let paid: PlayerState | string;
    if (quote > 0) paid = spendWallet(quote, clock, `${GARAGE_NAME}: ${label}`);
    else paid = readPlayer();
    if (typeof paid === "string") {
      setNote(paid);
      return;
    }
    const done = applyGarageOrder(paid, car.id, next, quote);
    if (typeof done === "string") {
      setNote(done);
      return;
    }
    writePlayer(done);
    setPreview(null);
    onPlayer(quote > 0 ? awardXp(Math.max(10, Math.round(quote / 100)), null, "exploration").player : done);
    setNote(quote > 0 ? `${label} · ${formatDollars(quote)}. Mike says she's looking sharp.` : `${label}. No charge.`);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(46rem,calc(100vh-2rem))] w-[min(56rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-[#14120e]/95 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">Service bay</p>
            <p className="text-lg font-semibold text-white">{GARAGE_NAME}</p>
            <p className="text-sm text-amber-100/80">Wallet {formatDollars(player.wallet)}</p>
          </div>
          <div className="flex items-center gap-2">
            {onBackOut ? (
              <button
                type="button"
                onClick={onBackOut}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                ← Back out · S
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white"
            >
              Close · Esc
            </button>
          </div>
        </header>

        {!car ? (
          <div className="p-8 text-center text-sm text-slate-300">
            <p className="text-base font-semibold text-white">No car, no service.</p>
            <p className="mt-2">Buy a Starter Car at Riverside Motors, then bring it to Mike.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 md:grid-cols-[minmax(0,15rem)_1fr]">
            <div className="min-h-0 space-y-3 overflow-y-auto">
              <div className="space-y-1.5">
                {player.ownedVehicles.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCarId(item.id);
                      setNote(null);
                      setPreview(null);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      item.id === car.id
                        ? "border-amber-300/50 bg-amber-400/15"
                        : "border-white/10 bg-black/25 hover:border-white/25"
                    }`}
                  >
                    <p className="text-[0.6rem] uppercase tracking-wider text-amber-300/80">
                      {TIER_NAMES[vehicleById(item.catalogId)?.tier ?? 1]}
                    </p>
                    <p className="text-sm font-semibold text-white">{item.model}</p>
                    <p className="text-[0.65rem] text-slate-400">
                      {item.licensePlate} · {Math.round(item.condition)}% condition
                    </p>
                  </button>
                ))}
              </div>
              <CarStats car={shown ?? car} base={car} />
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="relative h-44 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#2a241b] to-[#0f0d0a]">
                <CarTurntable car={shown ?? car} />
                <p className="pointer-events-none absolute left-3 top-2 text-[0.6rem] uppercase tracking-[0.2em] text-white/50">
                  {preview ? "Preview · drag to spin" : "Drag to spin"}
                </p>
              </div>
              {preview ? (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-sm text-amber-100">
                    Previewing <span className="font-semibold text-white">{preview.label}</span>
                    {typeof previewQuote === "number" ? ` · ${previewQuote > 0 ? formatDollars(previewQuote) : "Free"}` : ""}
                  </p>
                  {typeof previewQuote === "number" ? (
                    <button
                      type="button"
                      onClick={() => order(preview.order, preview.label)}
                      className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-[#1a1206]"
                    >
                      Buy
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">{previewQuote}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setNote(null);
                      setPreview(null);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      tab === item.id ? "bg-amber-400 text-[#1a1206]" : "bg-white/10 text-white/80 hover:bg-white/15"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {tab === "color"
                  ? PAINTS.map((paint) => (
                      <OptionRow
                        key={paint.id}
                        swatch={paint.color}
                        name={paint.name}
                        blurb={paint.blurb}
                        price={modPrice(car, paint.price)}
                        current={car.color === paint.id}
                        selected={preview?.order.kind === "paint" && preview.order.color === paint.id}
                        onPreview={() => tryOn({ kind: "paint", color: paint.id }, `${paint.name} paint`)}
                        onBuy={() => order({ kind: "paint", color: paint.id }, `${paint.name} paint`)}
                      />
                    ))
                  : null}
                {tab === "wheels"
                  ? WHEELS.map((wheel) => (
                      <OptionRow
                        key={wheel.id}
                        swatch={wheel.color}
                        name={wheel.name}
                        blurb={wheel.blurb}
                        price={modPrice(car, wheel.price)}
                        current={car.wheels === wheel.id}
                        selected={preview?.order.kind === "wheels" && preview.order.id === wheel.id}
                        onPreview={() => tryOn({ kind: "wheels", id: wheel.id }, wheel.name)}
                        onBuy={() => order({ kind: "wheels", id: wheel.id }, wheel.name)}
                      />
                    ))
                  : null}
                {tab === "interior"
                  ? INTERIORS.map((trim) => (
                      <OptionRow
                        key={trim.id}
                        swatch={trim.color}
                        name={trim.name}
                        blurb={trim.blurb}
                        price={modPrice(car, trim.price)}
                        current={car.interior === trim.id}
                        selected={preview?.order.kind === "interior" && preview.order.id === trim.id}
                        onPreview={() => tryOn({ kind: "interior", id: trim.id }, `${trim.name} interior`)}
                        onBuy={() => order({ kind: "interior", id: trim.id }, `${trim.name} interior`)}
                      />
                    ))
                  : null}
                {tab === "performance"
                  ? [1, 2, 3].map((stage) => {
                      const installed = car.upgrades.performance >= stage;
                      const next = car.upgrades.performance + 1 === stage;
                      return (
                        <OptionRow
                          key={stage}
                          swatch="#e67e22"
                          name={`Stage ${stage} Tune`}
                          blurb={`+12% speed and acceleration${stage > 1 ? ` · needs Stage ${stage - 1}` : ""}`}
                          price={modPrice(car, PERFORMANCE_STAGES[stage])}
                          current={installed}
                          disabled={!next}
                          selected={preview?.order.kind === "performance" && preview.order.stage === stage}
                          onPreview={next ? () => tryOn({ kind: "performance", stage }, `Stage ${stage} tune`) : undefined}
                          onBuy={() => order({ kind: "performance", stage }, `Stage ${stage} tune`)}
                        />
                      );
                    })
                  : null}
                {tab === "plate" ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Current plate</p>
                    <p className="mt-1 inline-block rounded-md border-2 border-[#1f3a5c] bg-[#f4f1ea] px-3 py-1 font-mono text-lg font-bold text-[#1f3a5c]">
                      {car.licensePlate}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <input
                        value={plate}
                        onChange={(event) => {
                          const value = event.target.value.toUpperCase().slice(0, 8);
                          setPlate(value);
                          if (value.trim()) tryOn({ kind: "plate", plate: value }, `Vanity plate ${value.trim()}`);
                          else setPreview(null);
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        placeholder="VANITY"
                        className="w-40 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-white outline-none focus:border-amber-300/60"
                      />
                      <button
                        type="button"
                        onClick={() => order({ kind: "plate", plate }, `Vanity plate ${plate.trim()}`)}
                        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#1a1206]"
                      >
                        Order · {formatDollars(PLATE_PRICE)}
                      </button>
                    </div>
                    <p className="mt-2 text-[0.65rem] text-slate-500">3–8 letters, numbers, spaces or dashes.</p>
                  </div>
                ) : null}
                {tab === "accessories"
                  ? ACCESSORIES.map((acc) => {
                      const fitted = car.accessories.includes(acc.id);
                      return (
                        <OptionRow
                          key={acc.id}
                          swatch={acc.color}
                          name={acc.name}
                          blurb={acc.blurb}
                          price={modPrice(car, acc.price)}
                          current={false}
                          actionLabel={fitted ? "Remove" : undefined}
                          badge={fitted ? "Fitted" : undefined}
                          selected={preview?.order.kind === "accessory" && preview.order.id === acc.id}
                          onPreview={() =>
                            tryOn({ kind: "accessory", id: acc.id }, fitted ? `Removed ${acc.name}` : acc.name)
                          }
                          onBuy={() => order({ kind: "accessory", id: acc.id }, fitted ? `Removed ${acc.name}` : acc.name)}
                        />
                      );
                    })
                  : null}
                {tab === "repair" ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm text-slate-300">
                      Mileage and rough driving wear a car down, which costs it speed. Mike restores it to factory fresh.
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-emerald-400" style={{ width: `${car.condition}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{Math.round(car.condition)}% condition</p>
                    <button
                      type="button"
                      disabled={repairPrice(car) <= 0}
                      onClick={() => order({ kind: "repair" }, "Full service")}
                      className="mt-4 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#0a1a12] disabled:opacity-40"
                    >
                      {repairPrice(car) > 0 ? `Full service · ${formatDollars(repairPrice(car))}` : "In perfect shape"}
                    </button>
                  </div>
                ) : null}
              </div>
              {note ? <p className="mt-3 text-sm text-amber-100">{note}</p> : null}
              <p className="mt-2 text-[0.65rem] text-slate-500">
                Higher-tier cars cost more to modify · mods add half their price to your car&apos;s value.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionRow({
  swatch,
  name,
  blurb,
  price,
  current,
  disabled,
  actionLabel,
  badge,
  selected,
  onPreview,
  onBuy,
}: {
  swatch: string;
  name: string;
  blurb: string;
  price: number;
  current: boolean;
  disabled?: boolean;
  actionLabel?: string;
  badge?: string;
  selected?: boolean;
  onPreview?: () => void;
  onBuy: () => void;
}) {
  return (
    <div
      role={onPreview ? "button" : undefined}
      tabIndex={onPreview ? 0 : undefined}
      onClick={onPreview}
      onKeyDown={(event) => {
        if (onPreview && (event.key === "Enter" || event.key === " ")) onPreview();
      }}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
        selected ? "border-amber-300/60 bg-amber-400/15" : "border-white/10 bg-black/25"
      } ${onPreview && !current ? "cursor-pointer hover:border-white/25" : ""}`}
    >
      <span className="h-8 w-8 shrink-0 rounded-full border border-white/20" style={{ background: swatch }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">
          {name}
          {badge ? <span className="ml-2 text-[0.65rem] font-medium text-emerald-300">{badge}</span> : null}
        </p>
        <p className="text-[0.7rem] text-slate-400">{blurb}</p>
      </div>
      {current ? (
        <span className="text-xs font-semibold text-emerald-300">Installed</span>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onBuy();
          }}
          className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-[#1a1206] disabled:opacity-35"
        >
          {actionLabel ?? (price > 0 ? formatDollars(price) : "Free")}
        </button>
      )}
    </div>
  );
}

function CarStats({ car, base }: { car: OwnedVehicle; base: OwnedVehicle }) {
  const stats = driveStats(car);
  const before = driveStats(base);
  const delta = (next: number, prev: number, scale = 1, digits = 0) => {
    const d = (next - prev) * scale;
    if (Math.abs(d) < 0.05) return null;
    return (
      <span className={`ml-1 ${d > 0 ? "text-emerald-300" : "text-rose-300"}`}>
        {d > 0 ? "+" : ""}
        {d.toFixed(digits)}
      </span>
    );
  };
  return (
    <div className="space-y-0.5 rounded-xl border border-white/10 bg-black/25 p-3 text-[0.7rem] text-slate-300">
      <p>
        Top speed <span className="font-semibold text-white">{Math.round(stats.topSpeed * 2)} mph</span>
        {delta(stats.topSpeed, before.topSpeed, 2)}
      </p>
      <p>
        Acceleration <span className="font-semibold text-white">{stats.accel.toFixed(1)}</span>
        {delta(stats.accel, before.accel, 1, 1)}
      </p>
      <p>
        Tune <span className="font-semibold text-white">Stage {car.upgrades.performance}</span> · Value{" "}
        <span className="font-semibold text-white">{formatDollars(base.currentValue)}</span>
      </p>
    </div>
  );
}
