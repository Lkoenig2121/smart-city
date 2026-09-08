"use client";

import type { CityState } from "@/lib/city/types";
import { useEffect, useRef } from "react";

const SIZE = 168;

/**
 * Top-down plan of the city with the walker's position and facing. The static
 * plan is painted once to an offscreen canvas; only the marker redraws.
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

  // Paint the unchanging plan: water, parks, roads, building footprints.
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

    baseRef.current = base;
  }, [state]);

  // Redraw the marker every frame.
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

            // View cone. Yaw 0 faces -z, which is up on the plan.
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
    </div>
  );
}
