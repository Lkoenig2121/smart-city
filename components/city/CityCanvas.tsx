"use client";

import { CityEngine } from "@/lib/simulation/city/cityEngine";
import { formatClock, dayPhase } from "@/lib/simulation/city/cityTick";
import { CityRenderer } from "@/lib/renderer/CityRenderer";
import { getBuildingAt } from "@/lib/simulation/city/cityState";
import type { Building, Tool } from "@/lib/city/types";
import { useEffect, useRef, useState } from "react";
import { CityHud } from "./CityHud";

const PAN_KEYS: Record<string, string> = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
  shift: "fast",
};

/** Screen pixels per second of camera travel. */
const PAN_SPEED = 900;

interface HudSnap {
  cityName: string;
  population: number;
  treasury: number;
  day: string;
  time: string;
  phase: string;
  tool: Tool;
  selected: Building | null;
  hoverLabel: string;
}

export function CityCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CityEngine | null>(null);
  const rendererRef = useRef<CityRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState<HudSnap | null>(null);
  const drag = useRef({
    active: false,
    moved: false,
    lastX: 0,
    lastY: 0,
    pointerId: -1,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const engine = new CityEngine();
    const renderer = new CityRenderer();
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    engineRef.current = engine;
    rendererRef.current = renderer;
    renderer.attach(ctx);
    let centered = false;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.resize(rect.width, rect.height, dpr);
      if (!centered) {
        renderer.camera.centerOn(19, 18, rect.width, rect.height);
        centered = true;
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      renderer.camera.zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY > 0 ? 0.9 : 1.11);
    };
    canvas.addEventListener("wheel", wheel, { passive: false });

    const held = new Set<string>();
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

    const keyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const key = PAN_KEYS[event.key.toLowerCase()];
      if (!key) return;
      event.preventDefault();
      held.add(key);
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = PAN_KEYS[event.key.toLowerCase()];
      if (key) held.delete(key);
    };
    const blur = () => held.clear();

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);

    let frame = 0;
    let last = performance.now();
    let hudAcc = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (held.size) {
        let dx = (held.has("left") ? 1 : 0) - (held.has("right") ? 1 : 0);
        let dy = (held.has("up") ? 1 : 0) - (held.has("down") ? 1 : 0);
        if (dx || dy) {
          const len = Math.hypot(dx, dy);
          dx /= len;
          dy /= len;
          const speed = PAN_SPEED * (held.has("fast") ? 2.2 : 1) * dt;
          renderer.camera.nudge(dx * speed, dy * speed);
        }
      }

      engine.tick(dt);
      renderer.render(engine, dt);
      hudAcc += dt;
      if (hudAcc > 0.12) {
        hudAcc = 0;
        const clock = formatClock(engine.state);
        const hover = engine.hover
          ? getBuildingAt(engine.state, engine.hover.x, engine.hover.y)
          : null;
        setHud({
          cityName: engine.state.name,
          population: engine.state.population,
          treasury: engine.state.budget.treasury,
          day: clock.day,
          time: clock.time,
          phase: labelPhase(dayPhase(engine.state)),
          tool: engine.tool,
          selected: engine.selectedId
            ? (engine.state.buildings.get(engine.selectedId) ?? null)
            : null,
          hoverLabel: hover
            ? hover.name
            : engine.hover
              ? `Tile ${engine.hover.x}, ${engine.hover.y}`
              : "",
        });
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    setReady(true);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = {
      active: true,
      moved: false,
      lastX: event.clientX,
      lastY: event.clientY,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!engine || !renderer || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tile = renderer.camera.pickTile(event.clientX - rect.left, event.clientY - rect.top);
    engine.hover = tile;

    if (!drag.current.active) return;
    const dx = event.clientX - drag.current.lastX;
    const dy = event.clientY - drag.current.lastY;
    if (Math.hypot(dx, dy) > 3) drag.current.moved = true;
    renderer.camera.panBy(dx, dy);
    drag.current.lastX = event.clientX;
    drag.current.lastY = event.clientY;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!engine || !renderer || !canvas) return;
    if (!drag.current.moved) {
      const rect = canvas.getBoundingClientRect();
      const tile = renderer.camera.pickTile(event.clientX - rect.left, event.clientY - rect.top);
      engine.applyTool(tile.x, tile.y);
    }
    drag.current.active = false;
    drag.current.moved = false;
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#1a2748]">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (engineRef.current) engineRef.current.hover = null;
          drag.current.active = false;
        }}
        onWheel={(event) => event.preventDefault()}
      />
      {hud ? (
        <CityHud
          {...hud}
          onTool={(tool) => {
            if (engineRef.current) engineRef.current.setTool(tool);
            setHud((prev) => (prev ? { ...prev, tool } : prev));
          }}
          onClose={() => {
            if (engineRef.current) engineRef.current.selectedId = null;
          }}
        />
      ) : null}
      {!ready ? (
        <div className="absolute inset-0 grid place-items-center bg-[#122033] text-white">
          Raising the city…
        </div>
      ) : null}
    </div>
  );
}

function labelPhase(phase: ReturnType<typeof dayPhase>) {
  switch (phase) {
    case "dawn":
      return "Dawn";
    case "day":
      return "Day";
    case "dusk":
      return "Dusk";
    case "night":
      return "Night";
  }
}
