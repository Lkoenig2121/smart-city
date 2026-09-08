"use client";

import { ageDef, AGES } from "@/lib/progression/ages";
import { formatCoins } from "@/lib/simulation/buildings/buildings";
import type { EvolveCheck } from "@/lib/simulation/city/cityEngine";
import type { AgeId } from "@/lib/city/types";

interface Props {
  age: AgeId;
  check: EvolveCheck;
  onEvolve: () => void;
  onClose: () => void;
}

function Requirement({
  label,
  have,
  need,
  ok,
}: {
  label: string;
  have: number;
  need: number;
  ok: boolean;
}) {
  const ratio = need > 0 ? Math.min(1, have / need) : 1;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className={ok ? "text-emerald-300" : "text-slate-300"}>
          {ok ? "✓" : "○"} {label}
        </span>
        <span className="tabular-nums text-slate-400">
          {formatCoins(have)} / {formatCoins(need)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${ok ? "bg-emerald-400" : "bg-amber-400"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export function EvolvePanel({ age, check, onEvolve, onClose }: Props) {
  const current = ageDef(age);
  const next = check.next;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-20 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0e1726]/95 p-5 text-slate-100 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
            Advance your civilization
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {current.name} → {next ? next.name : "the end of history"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      {next ? (
        <>
          <p className="mt-2 text-sm text-slate-300">{next.tagline}</p>

          <div className="mt-4 space-y-3">
            <Requirement label="Coins" {...check.coins} />
            <Requirement label="Civilization points" {...check.xp} />
            <Requirement label="Population" {...check.population} />
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
              What changes
            </p>
            <p className="mt-1.5 text-sm text-slate-300">
              New construction unlocks, your existing buildings become eligible for
              upgrades, and the explorable map widens to {next.revealRadius} tiles.
              Nothing is demolished — anything you keep stays exactly where you built it.
            </p>
          </div>

          <button
            onClick={onEvolve}
            disabled={!check.ready}
            className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-[#1a1206] transition enabled:hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
          >
            {check.ready
              ? `Evolve into the ${next.name}`
              : "Requirements not yet met"}
          </button>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-300">
          Your civilization has reached the final age.
        </p>
      )}

      <div className="mt-5">
        <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400">
          The road ahead
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {AGES.map((a) => {
            const state =
              a.index < current.index
                ? "past"
                : a.index === current.index
                  ? "now"
                  : "future";
            return (
              <span
                key={a.id}
                title={a.tagline}
                className={`rounded-full px-2.5 py-1 text-[0.68rem] ${
                  state === "now"
                    ? "bg-amber-400 font-semibold text-[#1a1206]"
                    : state === "past"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-white/5 text-slate-500"
                }`}
              >
                {a.name.replace(" Age", "")}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
