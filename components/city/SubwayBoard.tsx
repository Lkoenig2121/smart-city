"use client";

import { SUBWAY_EDGES, SUBWAY_LINE, SUBWAY_STATIONS, stationDef } from "@/lib/city/subway";

interface Props {
  stationId: string;
  onRide: (destinationId: string) => void;
  onClose: () => void;
}

export function SubwayBoard({ stationId, onRide, onClose }: Props) {
  const here = stationDef(stationId);
  const others = SUBWAY_STATIONS.filter((station) => station.id !== stationId);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-black/45"
      onClick={onClose}
    >
      <div
        className="w-[min(34rem,calc(100%-2rem))] rounded-2xl border border-amber-300/35 bg-[#10141a]/94 p-5 shadow-2xl backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">{SUBWAY_LINE}</p>
        <p className="mt-1 text-lg font-semibold text-white">{here.name}</p>
        <p className="mt-1 text-sm text-slate-400">Doors are open. Choose a stop on the map or the list.</p>

        <SubwayLineMap stationId={stationId} onRide={onRide} />

        <div className="mt-3 space-y-2">
          {others.map((station) => (
            <button
              key={station.id}
              type="button"
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
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-white"
        >
          Stay on the platform
        </button>
      </div>
    </div>
  );
}

const MAP_W = 360;
const MAP_H = 236;
const MAP_PAD = 42;

function SubwayLineMap({
  stationId,
  onRide,
}: {
  stationId: string;
  onRide: (id: string) => void;
}) {
  const xs = SUBWAY_STATIONS.map((station) => station.x);
  const ys = SUBWAY_STATIONS.map((station) => station.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const innerW = MAP_W - MAP_PAD * 2;
  const innerH = MAP_H - MAP_PAD * 2;

  const px = (x: number) => MAP_PAD + ((x - minX) / spanX) * innerW;
  const py = (y: number) => MAP_PAD + ((y - minY) / spanY) * innerH;
  const point = (id: string) => {
    const station = stationDef(id);
    return { x: px(station.x), y: py(station.y) };
  };

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0b1016]">
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block h-auto w-full" role="img" aria-label={`${SUBWAY_LINE} map`}>
        <rect width={MAP_W} height={MAP_H} fill="#0b1016" />
        {SUBWAY_EDGES.map(([a, b]) => {
          const from = point(a);
          const to = point(b);
          return (
            <line
              key={`${a}-${b}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#e8c36a"
              strokeWidth="4"
              strokeLinecap="round"
            />
          );
        })}
        {SUBWAY_STATIONS.map((station) => {
          const here = station.id === stationId;
          const { x, y } = point(station.id);
          const label = LABEL_OFFSET[station.id] ?? { dx: 10, dy: 4, anchor: "start" as const };
          return (
            <g
              key={station.id}
              className={here ? undefined : "cursor-pointer"}
              onClick={here ? undefined : () => onRide(station.id)}
            >
              {here ? (
                <circle cx={x} cy={y} r="11" fill="none" stroke="white" strokeWidth="2" />
              ) : (
                <circle cx={x} cy={y} r="16" fill="transparent" />
              )}
              <circle cx={x} cy={y} r={here ? 7 : 6} fill={station.color} stroke="#0b1016" strokeWidth="2" />
              <text
                x={x + label.dx}
                y={y + label.dy}
                textAnchor={label.anchor}
                fill={here ? "#fff6d8" : "#e8eef4"}
                fontSize="11"
                fontWeight={here ? 700 : 600}
                style={{ pointerEvents: "none" }}
              >
                {SHORT_NAME[station.id] ?? station.name}
              </text>
              {here ? (
                <text
                  x={x + label.dx}
                  y={y + label.dy + 12}
                  textAnchor={label.anchor}
                  fill="#e8c36a"
                  fontSize="8"
                  fontWeight="700"
                  style={{ pointerEvents: "none" }}
                >
                  You are here
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const SHORT_NAME: Record<string, string> = {
  harbor: "Harbor Bridge",
  central: "Central",
  north: "Helio North",
  civic: "Civic East",
  ravens: "Ravens",
};

const LABEL_OFFSET: Record<string, { dx: number; dy: number; anchor: "start" | "end" | "middle" }> = {
  harbor: { dx: -12, dy: 4, anchor: "end" },
  central: { dx: 12, dy: -8, anchor: "start" },
  north: { dx: 0, dy: -16, anchor: "middle" },
  civic: { dx: 12, dy: 4, anchor: "start" },
  ravens: { dx: 0, dy: 20, anchor: "middle" },
};
