"use client";

import type { ReactNode } from "react";
import {
  CITIES,
  CITY_IDS,
  isPlayableCity,
  type CityId,
} from "@/lib/city/world/cities";
import type { PlayerState } from "@/lib/city/player";

const VIEW_W = 1000;
const VIEW_H = 625;

interface Island {
  x: number;
  y: number;
  rx: number;
  ry: number;
  seed: number;
  land: string;
  landShade: string;
  beach: string;
  shallows: string;
}

/** Illustrated layout in SVG viewBox units — independent of the city defs' legacy card positions. */
const ISLANDS: Record<CityId, Island> = {
  riverside: {
    x: 480,
    y: 320,
    rx: 125,
    ry: 88,
    seed: 1.3,
    land: "#7cc95a",
    landShade: "#5aa843",
    beach: "#f1dfa4",
    shallows: "#8fe3ea",
  },
  dustfall: {
    x: 175,
    y: 345,
    rx: 115,
    ry: 82,
    seed: 4.1,
    land: "#eac77c",
    landShade: "#d6a75a",
    beach: "#f6e3b0",
    shallows: "#9fe6e2",
  },
  mountain: {
    x: 470,
    y: 118,
    rx: 120,
    ry: 78,
    seed: 2.7,
    land: "#8fbf6a",
    landShade: "#6f9c52",
    beach: "#e8dcb0",
    shallows: "#8fe0ea",
  },
  coastal: {
    x: 815,
    y: 250,
    rx: 110,
    ry: 84,
    seed: 5.6,
    land: "#86d06a",
    landShade: "#62ae4e",
    beach: "#f8e6b0",
    shallows: "#a2f0ee",
  },
  future: {
    x: 770,
    y: 480,
    rx: 118,
    ry: 70,
    seed: 3.3,
    land: "#3a2f78",
    landShade: "#261f58",
    beach: "#6b58b8",
    shallows: "#c77dff",
  },
};

function blobPath(cx: number, cy: number, rx: number, ry: number, seed: number, n = 16) {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.11 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5 + seed * 2.3);
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  let d = `M${start[0].toFixed(1)},${start[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % n]);
    d += ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

function Tree({ x, y, s = 1, color = "#2f8f3a" }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={2} cy={9} rx={9} ry={3} fill="#000" opacity={0.15} />
      <rect x={-1.5} y={2} width={3} height={7} fill="#7a5230" />
      <circle r={9} fill={color} />
      <circle cx={-3} cy={-3} r={4} fill="#fff" opacity={0.18} />
    </g>
  );
}

function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={2} cy={12} rx={7} ry={2.5} fill="#000" opacity={0.15} />
      <polygon points="0,-14 9,2 -9,2" fill="#2e6b3c" />
      <polygon points="0,-6 11,10 -11,10" fill="#275c33" />
      <rect x={-1.5} y={10} width={3} height={4} fill="#6b4526" />
    </g>
  );
}

function House({ x, y, wall = "#fff6e6", roof = "#e0573f", s = 1 }: { x: number; y: number; wall?: string; roof?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={3} cy={8} rx={12} ry={3} fill="#000" opacity={0.15} />
      <rect x={-9} y={-4} width={18} height={12} fill={wall} stroke="#00000022" />
      <polygon points="-11,-4 0,-13 11,-4" fill={roof} />
      <rect x={-2} y={2} width={4} height={6} fill="#6b4a2e" />
    </g>
  );
}

function Tower({ x, y, h, color, s = 1 }: { x: number; y: number; h: number; color: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={3} cy={2} rx={10} ry={3} fill="#000" opacity={0.18} />
      <rect x={-7} y={-h} width={14} height={h} fill={color} stroke="#00000022" />
      <rect x={-7} y={-h} width={5} height={h} fill="#fff" opacity={0.2} />
      {Array.from({ length: Math.floor(h / 8) }, (_, i) => (
        <rect key={i} x={-4} y={-h + 4 + i * 8} width={8} height={2.5} fill="#fff" opacity={0.55} />
      ))}
    </g>
  );
}

function Pyramid({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={8} cy={2} rx={26} ry={5} fill="#000" opacity={0.15} />
      <polygon points="0,-30 -24,0 4,2" fill="#f2d28a" />
      <polygon points="0,-30 4,2 24,-2" fill="#c99a4c" />
    </g>
  );
}

function Cactus({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="#4f9a4a">
      <rect x={-2} y={-14} width={4} height={14} rx={2} />
      <rect x={-7} y={-10} width={3} height={6} rx={1.5} />
      <rect x={4} y={-12} width={3} height={7} rx={1.5} />
    </g>
  );
}

function Peak({ x, y, h, w, snow = true }: { x: number; y: number; h: number; w: number; snow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={6} cy={2} rx={w * 0.9} ry={5} fill="#000" opacity={0.15} />
      <polygon points={`0,${-h} ${-w},0 ${w * 0.15},2`} fill="#9aa3ad" />
      <polygon points={`0,${-h} ${w * 0.15},2 ${w},0`} fill="#6c7580" />
      {snow ? (
        <polygon
          points={`0,${-h} ${-w * 0.35},${-h * 0.62} ${-w * 0.1},${-h * 0.55} ${w * 0.08},${-h * 0.66} ${w * 0.35},${-h * 0.6}`}
          fill="#f5f8fb"
        />
      ) : null}
    </g>
  );
}

function Palm({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  const f = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${f} 1)`}>
      <ellipse cx={4} cy={1} rx={8} ry={2.5} fill="#000" opacity={0.15} />
      <path d="M0,0 Q3,-12 6,-22" stroke="#8a5a32" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {[-60, -20, 20, 60, 110].map((deg) => (
        <path
          key={deg}
          d="M6,-22 q8,-4 14,3"
          stroke="#2f9a45"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(${deg} 6 -22)`}
        />
      ))}
    </g>
  );
}

function NeonTower({ x, y, h, neon }: { x: number; y: number; h: number; neon: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-7} y={-h} width={14} height={h} fill="#1a1440" stroke={neon} strokeWidth={1.6} filter="url(#wm-glow)" />
      {Array.from({ length: Math.floor(h / 7) }, (_, i) => (
        <rect key={i} x={-4} y={-h + 4 + i * 7} width={8} height={2} fill={neon} opacity={0.8} />
      ))}
      <rect x={-1} y={-h - 6} width={2} height={6} fill={neon} />
    </g>
  );
}

function decorations(id: CityId, c: Island): ReactNode {
  const { x, y } = c;
  switch (id) {
    case "riverside":
      return (
        <>
          <path
            d={`M${x - 20},${y - 85} C${x - 5},${y - 30} ${x - 40},${y + 10} ${x - 10},${y + 85}`}
            stroke="#4fb4e0"
            strokeWidth={12}
            fill="none"
            strokeLinecap="round"
          />
          <Tower x={x + 30} y={y + 5} h={42} color="#d9e4ef" />
          <Tower x={x + 50} y={y + 14} h={30} color="#f0e2c8" />
          <Tower x={x + 12} y={y + 18} h={24} color="#c8dbe8" />
          <House x={x + 70} y={y - 20} />
          <House x={x - 65} y={y + 10} roof="#3d7fc0" />
          <House x={x - 55} y={y - 30} />
          <Tree x={x - 85} y={y - 5} />
          <Tree x={x + 85} y={y + 25} />
          <Tree x={x + 60} y={y - 45} s={0.9} />
          <Tree x={x - 40} y={y + 45} s={0.9} />
          <Tree x={x + 30} y={y - 50} s={0.8} />
        </>
      );
    case "dustfall":
      return (
        <>
          <path
            d={`M${x + 5},${y - 80} C${x - 20},${y - 20} ${x + 20},${y + 20} ${x - 5},${y + 78}`}
            stroke="#4fb4e0"
            strokeWidth={9}
            fill="none"
            strokeLinecap="round"
          />
          <Pyramid x={x - 50} y={y + 10} s={1.1} />
          <Pyramid x={x - 72} y={y + 32} s={0.7} />
          <Tower x={x + 45} y={y + 10} h={36} color="#f2dcae" />
          <House x={x + 70} y={y - 20} wall="#f6e7c4" roof="#c9783a" />
          <House x={x + 25} y={y + 38} wall="#f6e7c4" roof="#c9783a" />
          <Cactus x={x - 30} y={y - 35} />
          <Cactus x={x + 80} y={y + 30} />
          <Tree x={x + 10} y={y - 45} s={0.8} color="#4f9a4a" />
        </>
      );
    case "mountain":
      return (
        <>
          <Peak x={x - 30} y={y + 5} h={78} w={48} />
          <Peak x={x + 30} y={y + 15} h={62} w={42} />
          <Peak x={x - 78} y={y + 20} h={44} w={30} snow={false} />
          <Peak x={x + 78} y={y + 28} h={40} w={28} snow={false} />
          <Pine x={x - 55} y={y + 40} />
          <Pine x={x - 10} y={y + 42} s={0.9} />
          <Pine x={x + 55} y={y + 45} />
          <Pine x={x + 95} y={y + 5} s={0.8} />
          <House x={x + 15} y={y + 50} wall="#e9dcc4" roof="#6b3f24" s={0.9} />
        </>
      );
    case "coastal":
      return (
        <>
          <path
            d={`M${x + 55},${y - 70} Q${x + 80},${y} ${x + 50},${y + 72}`}
            stroke="#a8713f"
            strokeWidth={6}
            fill="none"
            strokeDasharray="3 2"
          />
          <g transform={`translate(${x - 70} ${y - 30})`}>
            <rect x={-5} y={-30} width={10} height={30} fill="#fff" />
            <rect x={-5} y={-22} width={10} height={6} fill="#e0473f" />
            <rect x={-5} y={-10} width={10} height={6} fill="#e0473f" />
            <polygon points="-7,-30 0,-38 7,-30" fill="#e0473f" />
            <circle cy={-33} r={2.5} fill="#ffe37a" />
          </g>
          <House x={x - 20} y={y - 10} wall="#fff" roof="#3a9ad0" />
          <House x={x + 10} y={y + 20} wall="#ffe9d6" roof="#e8743b" />
          <House x={x - 35} y={y + 30} wall="#e6f6ff" roof="#3a9ad0" />
          <Palm x={x + 35} y={y - 40} />
          <Palm x={x + 40} y={y + 45} flip />
          <Palm x={x - 60} y={y + 15} />
          <Tree x={x - 5} y={y - 50} s={0.8} />
        </>
      );
    case "future":
      return (
        <>
          <NeonTower x={x - 40} y={y + 15} h={58} neon="#00e8ff" />
          <NeonTower x={x - 15} y={y + 25} h={74} neon="#ff2d95" />
          <NeonTower x={x + 12} y={y + 18} h={50} neon="#39ff14" />
          <NeonTower x={x + 40} y={y + 28} h={64} neon="#c44dff" />
          <NeonTower x={x - 68} y={y + 30} h={36} neon="#ffe14a" />
          <NeonTower x={x + 70} y={y + 34} h={40} neon="#00e8ff" />
          <ellipse cx={x} cy={y + 42} rx={60} ry={8} fill="#ff2d95" opacity={0.35} filter="url(#wm-glow)" />
        </>
      );
  }
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity={0.85}>
      <ellipse cx={0} cy={0} rx={34} ry={14} />
      <ellipse cx={-18} cy={-8} rx={18} ry={14} />
      <ellipse cx={12} cy={-12} rx={20} ry={16} />
    </g>
  );
}

const ROCKS: [number, number, number][] = [
  [320, 200, 1],
  [640, 150, 0.8],
  [620, 380, 1.1],
  [300, 520, 0.9],
  [90, 520, 0.7],
  [930, 400, 0.8],
  [560, 580, 0.7],
];

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
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-[#060a10]/80 p-4 backdrop-blur-sm">
      <div
        className="relative overflow-hidden rounded-4xl border-4 border-[#f4e3b8] shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        style={{
          width: "min(64rem, calc(100vw - 2rem), calc((100vh - 2rem) * 1.6))",
          aspectRatio: `${VIEW_W} / ${VIEW_H}`,
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Illustrated world map"
        >
          <defs>
            <radialGradient id="wm-ocean" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="#4cc7e6" />
              <stop offset="60%" stopColor="#2a9fd0" />
              <stop offset="100%" stopColor="#1a6fa8" />
            </radialGradient>
            <pattern id="wm-waves" width="80" height="50" patternUnits="userSpaceOnUse">
              <path d="M8,18 q6,-5 12,0 t12,0" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={2} fill="none" strokeLinecap="round" />
              <path d="M48,40 q6,-5 12,0 t12,0" stroke="#ffffff" strokeOpacity={0.2} strokeWidth={2} fill="none" strokeLinecap="round" />
            </pattern>
            <filter id="wm-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="wm-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill="url(#wm-ocean)" />
          <rect width={VIEW_W} height={VIEW_H} fill="url(#wm-waves)" />

          {ROCKS.map(([rx, ry, s], i) => (
            <g key={i} transform={`translate(${rx} ${ry}) scale(${s})`}>
              <ellipse cx={0} cy={6} rx={20} ry={7} fill="#8fe3ea" opacity={0.6} />
              <path d="M-14,6 L-8,-8 L2,-12 L12,-4 L14,6 Z" fill="#8a929c" />
              <path d="M2,-12 L12,-4 L14,6 L4,6 Z" fill="#6b727c" />
            </g>
          ))}

          {CITY_IDS.map((id) => {
            const c = ISLANDS[id];
            const known = discovered.has(id);
            const playable = isPlayableCity(id);
            const here = currentCityId === id;
            const canTravel = known && playable && !here;
            return (
              <g
                key={id}
                onClick={() => canTravel && onTravel(id)}
                className={canTravel ? "cursor-pointer transition-transform duration-200 hover:scale-[1.04]" : ""}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                <path
                  d={blobPath(c.x + 6, c.y + 14, c.rx * 1.05, c.ry * 1.05, c.seed)}
                  fill="#0a3a5c"
                  opacity={0.35}
                  filter="url(#wm-soft)"
                />
                <path d={blobPath(c.x, c.y, c.rx * 1.28, c.ry * 1.3, c.seed)} fill={c.shallows} opacity={id === "future" ? 0.45 : 0.75} />
                <path d={blobPath(c.x, c.y, c.rx * 1.08, c.ry * 1.1, c.seed)} fill={c.beach} />
                <path d={blobPath(c.x, c.y + 4, c.rx * 0.96, c.ry * 0.94, c.seed)} fill={c.landShade} />
                <path d={blobPath(c.x, c.y, c.rx * 0.94, c.ry * 0.9, c.seed)} fill={c.land} />
                {decorations(id, c)}
                {here ? (
                  <g transform={`translate(${c.x} ${c.y - c.ry - 24})`}>
                    <path d="M0,18 C-12,4 -12,-10 0,-10 C12,-10 12,4 0,18 Z" fill="#ffb81c" stroke="#fff" strokeWidth={2.5} />
                    <circle cy={-1} r={4} fill="#fff" />
                  </g>
                ) : null}
              </g>
            );
          })}

          <Cloud x={70} y={70} s={1.2} />
          <Cloud x={940} y={80} />
          <Cloud x={930} y={590} s={1.1} />
          <Cloud x={60} y={600} s={0.9} />

          <g transform="translate(930 150)" opacity={0.9}>
            <circle r={26} fill="#f4e3b8" stroke="#8a6a3a" strokeWidth={2} />
            <polygon points="0,-22 5,0 0,22 -5,0" fill="#8a6a3a" />
            <polygon points="0,-22 5,0 -5,0" fill="#e0473f" />
            <text y={-28} textAnchor="middle" fontSize={11} fontWeight={700} fill="#f4e3b8">
              N
            </text>
          </g>
        </svg>

        <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border-2 border-[#8a6a3a]/40 bg-[#f4e3b8] px-4 py-2 shadow-lg">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#8a6a3a]">Smart City</p>
          <p className="text-xl font-extrabold tracking-tight text-[#4a3418]">World Map</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border-2 border-[#8a6a3a]/40 bg-[#f4e3b8] px-3 py-1.5 text-xs font-bold text-[#4a3418] shadow-lg hover:bg-white"
        >
          Close · Esc
        </button>

        {CITY_IDS.map((id) => {
          const def = CITIES[id];
          const c = ISLANDS[id];
          const known = discovered.has(id);
          const playable = isPlayableCity(id);
          const here = currentCityId === id;
          const canTravel = known && playable && !here;
          const labelY = c.y + c.ry * 1.05 + 6;
          return (
            <div
              key={id}
              className="absolute -translate-x-1/2"
              style={{ left: `${(c.x / VIEW_W) * 100}%`, top: `${(labelY / VIEW_H) * 100}%` }}
            >
              <button
                type="button"
                disabled={!canTravel}
                onClick={() => canTravel && onTravel(id)}
                title={def.blurb}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border-2 py-1 pl-3 pr-1 text-sm font-extrabold shadow-[0_3px_0_rgba(0,0,0,0.25)] transition ${
                  here
                    ? "border-white bg-amber-400 text-[#4a2a00]"
                    : id === "future"
                      ? "border-fuchsia-300 bg-[#241a52] text-white hover:bg-[#33257a]"
                      : "border-white bg-[#fff8e6] text-[#3a2a14] hover:bg-white"
                } ${!canTravel && !here ? "opacity-70" : ""}`}
              >
                {def.name}
                {here ? (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider">Here</span>
                ) : canTravel ? (
                  <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[0.65rem] text-white">Travel</span>
                ) : (
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-[0.6rem]">Locked</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
