"use client";

import {
  CITIES,
  CITY_IDS,
  isPlayableCity,
  type CityId,
} from "@/lib/city/world/cities";
import type { PlayerState } from "@/lib/city/player";

/**
 * Region map: all Smart City regions available for travel.
 */
export function WorldMap({
  player,
  currentCityId,
  onTravel,
  onClose,
}: {
  player: PlayerState;
  currentCityId: string;
  onTravel: (cityId: CityId) => void;
  onClose: () => void;
}) {
  const discovered = new Set(player.discoveredCities);

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-[#060a10]/85 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[min(40rem,calc(100vh-2rem))] w-[min(44rem,calc(100%-1rem))] flex-col overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-b from-[#152033] via-[#101826] to-[#0a1018] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.32em] text-sky-300/90">
              Smart City
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight text-white">
              World Map
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Travel between cities
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-white/55 hover:bg-white/10 hover:text-white"
          >
            Close · Esc
          </button>
        </header>

        <div className="relative min-h-[22rem] flex-1 overflow-hidden">
          {/* Soft atmosphere */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% 48%, rgba(56,120,180,0.35), transparent 70%), radial-gradient(ellipse 40% 35% at 18% 48%, rgba(196,140,70,0.28), transparent 65%)",
            }}
          />

          {CITY_IDS.map((id) => {
            const def = CITIES[id];
            const known = discovered.has(id);
            const playable = isPlayableCity(id);
            const here = currentCityId === id;
            const canTravel = known && playable && !here;

            return (
              <div
                key={id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${def.mapX}%`, top: `${def.mapY}%` }}
              >
                <button
                  type="button"
                  disabled={!canTravel}
                  onClick={() => canTravel && onTravel(id)}
                  className={`group flex min-w-[7.5rem] flex-col items-center rounded-2xl border px-3 py-2.5 text-center transition ${
                    here
                      ? "border-amber-300/60 bg-amber-400/20 shadow-[0_0_24px_rgba(251,191,36,0.25)]"
                      : canTravel
                        ? "border-sky-300/40 bg-[#0e1828]/9 hover:border-sky-200/70 hover:bg-sky-500/15"
                        : "border-white/10 bg-black/40 opacity-70"
                  }`}
                >
                  <span
                    className={`text-[0.55rem] uppercase tracking-[0.22em] ${
                      here ? "text-amber-200" : "text-sky-300/80"
                    }`}
                  >
                    {here ? "You are here" : def.environment}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold text-white">{def.name}</span>
                  <span className="mt-0.5 max-w-[9rem] text-[0.65rem] leading-snug text-slate-400">
                    {def.blurb}
                  </span>
                  {canTravel ? (
                    <span className="mt-1.5 rounded-lg bg-sky-400 px-2.5 py-1 text-[0.65rem] font-semibold text-[#0a1220] group-hover:bg-sky-300">
                      Travel
                    </span>
                  ) : null}
                  {here ? (
                    <span className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-amber-100/80">
                      Current
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>

        <p className="border-t border-white/10 px-5 py-2.5 text-center text-[0.65rem] text-slate-500">
          All five regions are open — pick a city and travel.
        </p>
      </div>
    </div>
  );
}
