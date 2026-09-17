"use client";

import type { CityState } from "@/lib/city/types";
import type { PhoneWaypoint } from "@/lib/city/phone";
import { BUS_STOPS, isTramTile } from "@/lib/city/transit";
import { POI_LEGEND, drawPoiMark, poiKind } from "@/lib/city/minimapPois";
import { readPlayer } from "@/lib/city/player";
import { isPromenadeTile, waterfrontPois } from "@/lib/city/waterfront";
import { useEffect, useRef } from "react";

/**
 * Top-down plan of the city with the walker's position, facing, and landmark
 * marks — subway, hotels, civic buildings, and transit.
 */
export function StreetMinimap({
  state,
  positionRef,
  waypoint = null,
}: {
  state: CityState;
  positionRef: React.RefObject<{ x: number; y: number; yaw: number } | null>;
  waypoint?: PhoneWaypoint | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef(240);
  const waypointRef = useRef(waypoint);
  waypointRef.current = waypoint;

  const paintBase = (size: number) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const base = document.createElement("canvas");
    base.width = size * dpr;
    base.height = size * dpr;
    const ctx = base.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cell = size / state.size;
    ctx.fillStyle = "#25301f";
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        const tile = state.tiles[y][x];
        let color: string | null = null;
        if (tile.terrain === "water") color = "#1d4f70";
        else if (tile.terrain === "park" || tile.terrain === "playground") color = "#2f6b34";
        else if (tile.terrain === "sand") color = "#8a7b52";
        else if (tile.terrain === "plaza" || tile.terrain === "lot") color = "#4a4a45";
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
        }
        if (tile.road) {
          ctx.fillStyle = tile.bridge ? "#8d8a80" : isPromenadeTile(x, y) ? "#8a7354" : "#6a6c72";
          ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
        }
        if (isTramTile(x, y)) {
          ctx.fillStyle = "#c5ccd3";
          ctx.fillRect(x * cell + cell * 0.38, y * cell, cell * 0.24, cell + 0.5);
        }
      }
    }

    for (const building of state.buildings.values()) {
      ctx.fillStyle = building.floors > 14 ? "#d8dde2" : "#a9a196";
      ctx.fillRect(
        building.origin.x * cell,
        building.origin.y * cell,
        building.width * cell,
        building.depth * cell,
      );
    }

    const mark = Math.max(4.2, cell * 1.15);
    for (const stop of BUS_STOPS) {
      drawPoiMark(ctx, (stop.x + 0.5) * cell, (stop.y + 0.5) * cell, "bus", mark * 0.85);
    }
    for (const building of state.buildings.values()) {
      const kind = poiKind(building);
      if (!kind) continue;
      drawPoiMark(
        ctx,
        (building.origin.x + building.width / 2) * cell,
        (building.origin.y + building.depth / 2) * cell,
        kind,
        kind === "stadium" ? mark * 1.2 : mark,
      );
    }
    for (const poi of waterfrontPois()) {
      drawPoiMark(ctx, poi.x * cell, poi.y * cell, poi.kind, mark);
    }

    baseRef.current = base;
    sizeRef.current = size;
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const resize = () => {
      const width = Math.max(160, Math.round(wrap.clientWidth));
      paintBase(width);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [state]);

  useEffect(() => {
    let frame = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      const base = baseRef.current;
      const position = positionRef.current;
      const size = sizeRef.current;
      if (canvas && base) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const height = Math.round(size * 0.8);
          const offsetY = (height - size) / 2;
          if (canvas.width !== size * dpr || canvas.height !== height * dpr) {
            canvas.width = size * dpr;
            canvas.height = height * dpr;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, size, height);
          ctx.drawImage(base, 0, offsetY, size, size);

          const cell = size / state.size;
          const employerId = readPlayer().career?.employerId;
          const workplace = employerId ? state.buildings.get(employerId) : null;
          if (workplace) {
            const wx = (workplace.origin.x + workplace.width / 2) * cell;
            const wy = (workplace.origin.y + workplace.depth / 2) * cell + offsetY;
            if (!poiKind(workplace)) {
              drawPoiMark(ctx, wx, wy, "office", Math.max(4.2, cell * 1.15));
            }
            ctx.beginPath();
            ctx.arc(wx, wy, Math.max(6.2, cell * 1.55), 0, Math.PI * 2);
            ctx.strokeStyle = "#f4d03f";
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }

          const pin = waypointRef.current;
          if (pin) {
            const wx = pin.x * cell;
            const wy = pin.y * cell + offsetY;
            if (position) {
              ctx.beginPath();
              ctx.moveTo(position.x * cell, position.y * cell + offsetY);
              ctx.lineTo(wx, wy);
              ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
              ctx.setLineDash([4, 3]);
              ctx.lineWidth = 1.4;
              ctx.stroke();
              ctx.setLineDash([]);
            }
            ctx.beginPath();
            ctx.arc(wx, wy, Math.max(4.4, cell * 1.2), 0, Math.PI * 2);
            ctx.fillStyle = "#38bdf8";
            ctx.fill();
            ctx.strokeStyle = "rgba(8, 20, 32, 0.8)";
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }

          if (position) {
            const px = position.x * cell;
            const py = position.y * cell + offsetY;
            const heading = position.yaw + Math.PI / 2;
            const spread = 0.5;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.arc(px, py, Math.max(22, cell * 6), -heading - spread, -heading + spread);
            ctx.closePath();
            ctx.fillStyle = "rgba(244, 208, 63, 0.28)";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(px, py, 3.6, 0, Math.PI * 2);
            ctx.fillStyle = "#f4d03f";
            ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [positionRef, state.size]);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute bottom-4 right-4 flex w-64 flex-col overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-2xl backdrop-blur"
    >
      <canvas ref={canvasRef} className="block w-full aspect-[5/4]" />
      <div className="border-t border-white/10 px-2 py-1 text-center text-[0.58rem] uppercase tracking-wider text-slate-300">
        {waypoint ? `Waypoint · ${waypoint.label}` : state.name}
      </div>
      <div className="grid grid-cols-5 gap-x-1 gap-y-0.5 border-t border-white/10 px-2 py-1.5">
        {POI_LEGEND.map((item) => (
          <div key={item.kind} className="flex items-center gap-0.5 text-[0.52rem] text-slate-300">
            <LegendDot kind={item.kind} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendDot({ kind }: { kind: (typeof POI_LEGEND)[number]["kind"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 12, 12);
    drawPoiMark(ctx, 6, 6, kind, 5);
  }, [kind]);
  return <canvas ref={canvasRef} width={12} height={12} className="h-3 w-3 shrink-0" />;
}
