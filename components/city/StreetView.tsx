"use client";

import type { CityState } from "@/lib/city/types";
import type { MoveMode } from "@/lib/street/controls";
import { StreetWorld } from "@/lib/street/StreetWorld";
import { formatClock } from "@/lib/simulation/city/cityTick";
import { useEffect, useRef, useState } from "react";
import { StreetMinimap } from "./StreetMinimap";

interface Props {
  state: CityState;
  /** Tile to arrive at; the nearest road is used. */
  entry: { x: number; y: number };
  /** Advances the simulation while the street view is open. */
  onTick: (dt: number) => void;
  onExit: () => void;
}

export function StreetView({ state, entry, onTick, onExit }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<StreetWorld | null>(null);
  const positionRef = useRef<{ x: number; y: number; yaw: number } | null>(null);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  const [locked, setLocked] = useState(false);
  const [clock, setClock] = useState(() => formatClock(state));
  const [failed, setFailed] = useState<string | null>(null);
  const [mode, setMode] = useState<MoveMode>("hop");

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let world: StreetWorld;
    try {
      world = new StreetWorld(canvas, state);
    } catch (error) {
      setFailed(
        error instanceof Error
          ? error.message
          : "WebGL is unavailable in this browser.",
      );
      return;
    }

    worldRef.current = world;
    world.spawnNear(entry.x, entry.y);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      world.resize(rect.width, rect.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const onPointerMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      world.controls.look(event.movementX, event.movementY);
    };

    const onLockChange = () => {
      const active = document.pointerLockElement === canvas;
      setLocked(active);
      if (!active) world.controls.clearKeys();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") return;
      // Stop the page scrolling out from under the walker.
      if (event.code.startsWith("Arrow") || event.code === "Space") {
        event.preventDefault();
      }
      world.controls.keyDown(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => world.controls.keyUp(event.code);
    const onBlur = () => world.controls.clearKeys();

    document.addEventListener("mousemove", onPointerMove);
    document.addEventListener("pointerlockchange", onLockChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    let frame = 0;
    let last = performance.now();
    let clockAcc = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      tickRef.current(dt);
      world.render(dt);
      positionRef.current = world.tilePosition;

      clockAcc += dt;
      if (clockAcc > 0.25) {
        clockAcc = 0;
        setClock(formatClock(state));
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      document.removeEventListener("mousemove", onPointerMove);
      document.removeEventListener("pointerlockchange", onLockChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      world.dispose();
      worldRef.current = null;
    };
  }, [state, entry.x, entry.y]);

  const requestLock = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void canvas.requestPointerLock();
  };

  const chooseMode = (next: MoveMode) => {
    setMode(next);
    worldRef.current?.setMoveMode(next);
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 z-30 bg-[#0b1420]">
      <canvas ref={canvasRef} className="block h-full w-full" onClick={requestLock} />

      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-[#0b1420] p-6 text-center">
          <div className="max-w-sm">
            <p className="text-lg font-semibold text-white">Street view unavailable</p>
            <p className="mt-2 text-sm text-slate-400">{failed}</p>
            <button
              onClick={onExit}
              className="mt-4 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#1a1206]"
            >
              Back to the city
            </button>
          </div>
        </div>
      ) : null}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/45 px-3.5 py-2 backdrop-blur">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-amber-300/80">
            Street level
          </p>
          <p className="text-sm font-medium text-white">
            {clock.day} · {clock.time}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/45 p-1 backdrop-blur">
            <ModeButton
              active={mode === "hop"}
              onClick={() => chooseMode("hop")}
              label="Hop"
              title="Jump to the next intersection, then turn onto a cross street"
            />
            <ModeButton
              active={mode === "free"}
              onClick={() => chooseMode("free")}
              label="Walk"
              title="Walk continuously with WASD"
            />
          </div>

          <button
            onClick={onExit}
            className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            ✕ Exit to city view
          </button>
        </div>
      </div>

      {/* Crosshair, only while looking around */}
      {locked && !failed ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-1.5 w-1.5 rounded-full bg-white/70 shadow" />
        </div>
      ) : null}

      {/* Click-to-look prompt */}
      {!locked && !failed ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-white/15 bg-black/60 px-6 py-5 text-center backdrop-blur">
            <p className="text-base font-semibold text-white">Click to look around</p>
            {mode === "hop" ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                <span className="font-medium text-white">W</span> /{" "}
                <span className="font-medium text-white">S</span> jump to the next
                intersection ·{" "}
                <span className="font-medium text-white">A</span> /{" "}
                <span className="font-medium text-white">D</span> to turn ·{" "}
                <span className="font-medium text-white">Space</span> to jump ·{" "}
                <span className="font-medium text-white">Mouse</span> to look
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                <span className="font-medium text-white">W A S D</span> or arrows to walk ·{" "}
                <span className="font-medium text-white">Space</span> to jump ·{" "}
                <span className="font-medium text-white">Shift</span> to run ·{" "}
                <span className="font-medium text-white">Mouse</span> to look
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              Press Escape to release the cursor.
            </p>
          </div>
        </div>
      ) : null}

      {/* Persistent control reminder once the cursor is captured */}
      {locked && !failed ? (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[0.68rem] leading-relaxed text-slate-300 backdrop-blur">
          {mode === "hop" ? (
            <>
              <span className="font-semibold text-white">W</span>/
              <span className="font-semibold text-white">S</span> next intersection ·{" "}
              <span className="font-semibold text-white">A</span>/
              <span className="font-semibold text-white">D</span> turn ·{" "}
              <span className="font-semibold text-white">Space</span> jump
            </>
          ) : (
            <>
              <span className="font-semibold text-white">WASD</span> walk ·{" "}
              <span className="font-semibold text-white">Space</span> jump ·{" "}
              <span className="font-semibold text-white">Shift</span> run
            </>
          )}
        </div>
      ) : null}

      {!failed ? <StreetMinimap state={state} positionRef={positionRef} /> : null}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-amber-400 text-[#1a1206]" : "text-slate-300 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
