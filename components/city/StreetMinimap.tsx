"use client";

import type { CityState } from "@/lib/city/types";
import { BUS_STOPS, isTramTile } from "@/lib/city/transit";
import { POI_LEGEND, drawPoiMark, poiKind } from "@/lib/city/minimapPois";
import { useEffect, useRef } from "react";

const SIZE = 176;

/**
 * Top-down plan of the city with the walker's position, facing, and landmark
 * marks — subway, hotels, civic buildings, and transit.
 */
export function StreetMinimap({
  state,
  positionRef,
}: {
  state: CityState;
  positionRef: React.RefObject<{ x: number; y: number; yaw: number } | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const base = document.createElement("canvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    base.width = SIZE * dpr;
    base.height = SIZE * dpr;
    const ctx = base.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cell = SIZE / state.size;

    ctx.fillStyle = "#25301f";
    ctx.fillRect(0, 0, SIZE, SIZE);

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
          ctx.fillStyle = tile.bridge ? "#8d8a80" : "#6a6c72";
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

    for (const stop of BUS_STOPS) {
      drawPoiMark(ctx, (stop.x + 0.5) * cell, (stop.y + 0.5) * cell, "bus", 3.6);
    }

    for (const building of state.buildings.values()) {
      const kind = poiKind(building);
      if (!kind) continue;
      const cx = (building.origin.x + building.width / 2) * cell;
      const cy = (building.origin.y + building.depth / 2) * cell;
      drawPoiMark(ctx, cx, cy, kind, kind === "stadium" ? 5.2 : 4.3);
    }

    baseRef.current = base;
  }, [state]);

  useEffect(() => {
    let frame = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      const base = baseRef.current;
      const position = positionRef.current;
      if (canvas && base) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          if (canvas.width !== SIZE * dpr) {
            canvas.width = SIZE * dpr;
            canvas.height = SIZE * dpr;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, SIZE, SIZE);
          ctx.drawImage(base, 0, 0, SIZE, SIZE);

          if (position) {
            const cell = SIZE / state.size;
            const px = position.x * cell;
            const py = position.y * cell;

            const heading = position.yaw + Math.PI / 2;
            const spread = 0.5;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.arc(px, py, 26, -heading - spread, -heading + spread);
            ctx.closePath();
            ctx.fillStyle = "rgba(244, 208, 63, 0.28)";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(px, py, 3.4, 0, Math.PI * 2);
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
    <div className="pointer-events-none absolute bottom-4 right-4 overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-2xl backdrop-blur">
      <canvas
        ref={canvasRef}
        style={{ width: SIZE, height: SIZE }}
        className="block"
      />
      <div className="border-t border-white/10 px-2 py-1 text-center text-[0.58rem] uppercase tracking-wider text-slate-300">
        {state.name}
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
