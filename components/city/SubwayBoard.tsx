"use client";

import { SUBWAY_LINE, SUBWAY_STATIONS, stationDef } from "@/lib/city/subway";

interface Props {
  stationId: string;
  onRide: (destinationId: string) => void;
  onClose: () => void;
}

export function SubwayBoard({ stationId, onRide, onClose }: Props) {
  const here = stationDef(stationId);
  const others = SUBWAY_STATIONS.filter((station) => station.id !== stationId);

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-black/45">
      <div
        className="w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-amber-300/35 bg-[#10141a]/94 p-5 shadow-2xl backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">{SUBWAY_LINE}</p>
        <p className="mt-1 text-lg font-semibold text-white">{here.name}</p>
        <p className="mt-1 text-sm text-slate-400">Doors are open. Choose a stop.</p>
        <div className="mt-4 space-y-2">
          {others.map((station) => (
            <button
              key={station.id}
              onClick={() => onRide(station.id)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10"
            >
              <span>
                <span className="block text-sm font-semibold text-white">{station.name}</span>
                <span className="block text-[0.7rem] text-slate-400">{station.hint}</span>
              </span>
              <span className="h-3 w-3 rounded-full" style={{ background: station.color }} />
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-white"
        >
          Stay on the platform
        </button>
      </div>
    </div>
  );
}
