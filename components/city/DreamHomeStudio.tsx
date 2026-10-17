"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DREAM_ACCENTS,
  DREAM_ROOFS,
  DREAM_STYLES,
  DREAM_WALLS,
  dreamCityName,
  dreamStyle,
  previewDreamBuilding,
  quoteDreamHome,
  styleFits,
  type DreamChoice,
  type DreamPlot,
  type DreamRoof,
} from "@/lib/city/dreamHome";
import { FURNISHINGS } from "@/lib/city/furnishings";
import { DREAM_MESH_REV } from "@/lib/street/dreamHouseMesh";
import { formatDollars, type PlayerState } from "@/lib/city/player";
import type { Building } from "@/lib/city/types";

interface Props {
  plot: DreamPlot;
  player: PlayerState;
  onPreview: (building: Building) => void;
  /** Returns an error string, or null when the house is placed. */
  onConfirm: (choice: DreamChoice) => string | null;
  onClose: () => void;
}

const ROOF_LABEL: Record<DreamRoof, string> = {
  gable: "Gable",
  hip: "Hip",
  flat: "Flat",
};

export function DreamHomeStudio({ plot, player, onPreview, onConfirm, onClose }: Props) {
  const first = DREAM_STYLES.find((style) => styleFits(plot, style)) ?? DREAM_STYLES[0];
  const [choice, setChoice] = useState<DreamChoice>({
    styleId: first.id,
    stories: first.minStories,
    wall: first.wall,
    roofColor: first.roofColor,
    accent: first.accent,
    roof: first.roof,
    floorId: null,
  });
  const [note, setNote] = useState<string | null>(null);
  const previewRef = useRef(onPreview);
  const closeRef = useRef(onClose);
  previewRef.current = onPreview;
  closeRef.current = onClose;

  useEffect(() => {
    previewRef.current(previewDreamBuilding(plot, choice));
  }, [plot, choice, DREAM_MESH_REV]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Escape") return;
      event.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const style = dreamStyle(choice.styleId);
  const quote = useMemo(() => quoteDreamHome(plot, choice, player), [plot, choice, player]);
  const floors = FURNISHINGS.filter((item) => item.slot === "floor");
  const stories = [];
  for (let n = style.minStories; n <= style.maxStories; n++) stories.push(n);

  const pickStyle = (id: string) => {
    const next = dreamStyle(id);
    setChoice((prev) => ({
      ...prev,
      styleId: next.id,
      stories: Math.min(next.maxStories, Math.max(next.minStories, prev.stories)),
      wall: next.wall,
      roofColor: next.roofColor,
      accent: next.accent,
      roof: next.roof,
    }));
    setNote(null);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(46rem,calc(100vh-2rem))] w-[min(56rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-emerald-300/30 bg-[#10141c]/95 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-emerald-300">
              {dreamCityName(plot.cityId)} · {plot.w}×{plot.d} lot
            </p>
            <p className="text-lg font-semibold text-white">Build your dream home</p>
            <p className="text-sm text-sky-100/80">
              Wallet {formatDollars(player.wallet)} · Bank {formatDollars(player.bank)}
            </p>
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
            {DREAM_STYLES.map((item) => {
              const fits = styleFits(plot, item);
              const selected = item.id === choice.styleId;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!fits}
                  onClick={() => pickStyle(item.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    selected
                      ? "border-emerald-300/50 bg-emerald-400/15"
                      : "border-white/10 bg-black/25 hover:border-white/25"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <span className="block text-sm font-semibold text-white">{item.name}</span>
                  <span className="block text-xs text-slate-400">
                    {fits ? formatDollars(item.price) : "Lot too small"} · {item.minStories}–{item.maxStories}{" "}
                    stories
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div>
              <p className="text-sm font-semibold text-white">{style.name}</p>
              <p className="text-sm text-slate-300">{style.description}</p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">Stories</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {stories.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setChoice((prev) => ({ ...prev, stories: count }))}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      choice.stories === count ? "bg-emerald-400 text-[#0a1a22]" : "bg-white/10 text-white"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <Swatches
              label="Walls"
              colors={DREAM_WALLS}
              value={choice.wall}
              onPick={(wall) => setChoice((prev) => ({ ...prev, wall }))}
            />
            <Swatches
              label="Roof color"
              colors={DREAM_ROOFS}
              value={choice.roofColor}
              onPick={(roofColor) => setChoice((prev) => ({ ...prev, roofColor }))}
            />
            <Swatches
              label="Trim"
              colors={DREAM_ACCENTS}
              value={choice.accent}
              onPick={(accent) => setChoice((prev) => ({ ...prev, accent }))}
            />
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">Roof shape</p>
              <div className="mt-2 flex gap-2">
                {(["gable", "hip", "flat"] as const).map((roof) => (
                  <button
                    key={roof}
                    type="button"
                    onClick={() => setChoice((prev) => ({ ...prev, roof }))}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      choice.roof === roof ? "bg-emerald-400 text-[#0a1a22]" : "bg-white/10 text-white"
                    }`}
                  >
                    {ROOF_LABEL[roof]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">Flooring</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setChoice((prev) => ({ ...prev, floorId: null }))}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    choice.floorId === null ? "bg-emerald-400 font-semibold text-[#0a1a22]" : "bg-white/10 text-white"
                  }`}
                >
                  Unfinished
                </button>
                {floors.map((item) => {
                  const owned = player.ownedFurnishings.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setChoice((prev) => ({ ...prev, floorId: item.id }))}
                      className={`rounded-lg px-3 py-1.5 text-sm ${
                        choice.floorId === item.id
                          ? "bg-emerald-400 font-semibold text-[#0a1a22]"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {item.name}
                      {owned ? "" : ` · ${formatDollars(item.price)}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="shrink-0 space-y-2 border-t border-white/10 pt-3">
            <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-slate-200">
              <Row label="Land" value={quote.land} />
              <Row label="House" value={quote.base} />
              <Row label="Extra stories" value={quote.stories} />
              <Row label="Flooring" value={quote.floor} />
              <p className="mt-2 flex justify-between font-semibold text-white">
                <span>Total</span>
                <span>{formatDollars(quote.total)}</span>
              </p>
              {quote.shortfall > 0 ? (
                <p className="mt-1 text-amber-200">Short {formatDollars(quote.shortfall)} in your wallet.</p>
              ) : null}
              {!quote.fits ? <p className="mt-1 text-amber-200">That design does not fit this lot.</p> : null}
              {note ? <p className="mt-1 text-amber-200">{note}</p> : null}
            </div>
            <button
              type="button"
              disabled={!quote.fits || quote.shortfall > 0}
              onClick={() => {
                const error = onConfirm(choice);
                setNote(error);
              }}
              className="w-full rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#0a1a22] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Build for {formatDollars(quote.total)}
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <p className="flex justify-between text-slate-300">
      <span>{label}</span>
      <span>{formatDollars(value)}</span>
    </p>
  );
}

function Swatches({
  label,
  colors,
  value,
  onPick,
}: {
  label: string;
  colors: string[];
  value: string;
  onPick: (color: string) => void;
}) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => onPick(color)}
            className={`h-7 w-7 rounded-full border-2 ${value === color ? "border-white" : "border-white/20"}`}
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}
