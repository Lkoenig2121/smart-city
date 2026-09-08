"use client";

import type { DiscoveryAward } from "@/lib/progression/discoveries";

export function DiscoveryToasts({ items }: { items: DiscoveryAward[] }) {
  if (!items.length) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-24 z-20 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
      {items.map((d) => (
        <div
          key={d.id}
          className="animate-[fadeIn_200ms_ease-out] rounded-xl border border-amber-300/30 bg-[#1a1408]/95 px-4 py-3 shadow-xl backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none">{d.icon}</span>
            <div className="min-w-0">
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-amber-300/80">
                Civilization achievement
              </p>
              <p className="text-sm font-semibold text-amber-100">{d.name}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-200/60">{d.blurb}</p>
              <p className="mt-1 text-xs font-medium tabular-nums text-emerald-300">
                +{d.coins.toLocaleString()} coins · +{d.xp.toLocaleString()} civilization
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
