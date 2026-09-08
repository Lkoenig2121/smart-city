"use client";

import { buildingDef } from "@/lib/buildings/catalog";
import { upgradeCost } from "@/lib/buildings/placement";
import { ageDef, ageIndex } from "@/lib/progression/ages";
import { formatCoins, occupancyHint } from "@/lib/simulation/buildings/buildings";
import type { AgeId, Building } from "@/lib/city/types";

interface Props {
  building: Building;
  age: AgeId;
  coins: number;
  onUpgrade: () => void;
  onPreserve: () => void;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2.5 py-1.5">
      <p className="text-[0.62rem] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-medium tabular-nums text-slate-100">{value}</p>
    </div>
  );
}

export function BuildingPanel({
  building,
  age,
  coins,
  onUpgrade,
  onPreserve,
  onClose,
}: Props) {
  const def = buildingDef(building.kind);
  const target = def.upgradesTo ? buildingDef(def.upgradesTo) : null;
  const cost = upgradeCost(building.kind);
  const targetUnlocked = target ? ageIndex(target.age) <= ageIndex(age) : false;
  const canAfford = cost !== null && coins >= cost;
  const drift = ageIndex(age) - ageIndex(building.builtIn);
  const efficiency = Math.min(1, Math.max(0.3, 1 - drift * 0.12));
  const occupancy = occupancyHint(building);

  return (
    <div className="pointer-events-auto absolute bottom-28 right-4 w-72 rounded-2xl border border-white/10 bg-[#0e1726]/95 p-4 text-slate-100 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.66rem] uppercase tracking-[0.16em] text-slate-400">
            {def.label}
          </p>
          <h3 className="text-base font-semibold leading-tight">{building.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-0.5 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">{def.description}</p>

      <p className="mt-2 text-[0.68rem] text-slate-500">
        Raised in the {ageDef(building.builtIn).name}
        {building.preserved ? " · protected monument" : ""}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {occupancy ? <Stat label="Occupancy" value={occupancy} /> : null}
        {def.coins > 0 ? (
          <Stat label="Income" value={`${(def.coins * efficiency).toFixed(2)}/s`} />
        ) : null}
        {def.xp > 0 ? (
          <Stat label="Insight" value={`${(def.xp * efficiency).toFixed(2)}/s`} />
        ) : null}
        {def.happiness > 0 ? (
          <Stat label="Happiness" value={`+${def.happiness}`} />
        ) : null}
        {drift > 0 && !building.preserved ? (
          <Stat label="Condition" value={`${Math.round(efficiency * 100)}%`} />
        ) : null}
      </div>

      {drift > 0 && !building.preserved ? (
        <p className="mt-2 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[0.68rem] leading-relaxed text-amber-200">
          This structure is {drift} {drift === 1 ? "age" : "ages"} old and producing at{" "}
          {Math.round(efficiency * 100)}%. Upgrade it, or protect it as a monument.
        </p>
      ) : null}

      <div className="mt-3 space-y-1.5">
        {target ? (
          <button
            onClick={onUpgrade}
            disabled={!targetUnlocked || !canAfford || building.preserved}
            className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#04160f] transition enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
          >
            {building.preserved
              ? "Monuments cannot be redeveloped"
              : !targetUnlocked
                ? `${target.name} unlocks in the ${ageDef(target.age).name}`
                : `Upgrade to ${target.name} · ${formatCoins(cost ?? 0)}`}
          </button>
        ) : null}

        <button
          onClick={onPreserve}
          className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
            building.preserved
              ? "bg-amber-400 text-[#1a1206] hover:bg-amber-300"
              : "bg-white/10 text-slate-200 hover:bg-white/20"
          }`}
        >
          {building.preserved ? "Release monument status" : "Protect as a monument"}
        </button>
      </div>

      <p className="mt-2 text-[0.64rem] leading-relaxed text-slate-500">
        Monuments stop producing but can never be demolished, and they keep lifting
        happiness as your city grows around them.
      </p>
    </div>
  );
}
