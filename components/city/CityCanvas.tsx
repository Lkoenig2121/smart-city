"use client";

import { CityEngine } from "@/lib/simulation/city/cityEngine";
import { formatClock, dayPhase } from "@/lib/simulation/city/cityTick";
import { CityRenderer } from "@/lib/renderer/CityRenderer";
import { getBuildingAt } from "@/lib/simulation/city/cityState";
import { pickBuildingAt } from "@/lib/renderer/pickBuilding";
import { subwayGateTile, subwayStationId } from "@/lib/city/subway";
import { citizenIsOutdoors } from "@/lib/simulation/citizens/citizenBehavior";
import type {
  Building,
  CityEvent,
  CityState,
  CityWeather,
  Tool,
} from "@/lib/city/types";
import { officeRank, readPlayer, totalBalance } from "@/lib/city/player";
import { findMall } from "@/lib/city/venues";
import {
  parkingFill,
  trafficFlowScore,
} from "@/lib/simulation/traffic/roadNetwork";
import { useCallback, useEffect, useRef, useState } from "react";
import { CityHud } from "./CityHud";
import { StreetView } from "./StreetView";
import { generateDustfall } from "@/lib/city/generateDustfall";
import { markMissionDustfall } from "@/lib/city/missions";
import { syncDustfallUnlock, takeLevelToast } from "@/lib/city/cityProgress";
import { characterProgress } from "@/lib/city/progression";

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
  cityId: string;
  population: number;
  treasury: number;
  day: string;
  date: string;
  time: string;
  phase: string;
  weather: CityWeather;
  events: CityEvent[];
  tool: Tool;
  selected: Building | null;
  hoverLabel: string;
  streetLife: number;
  trafficFlow: number;
  parkingFill: number;
  wallet: number;
  careerLabel: string;
  mallExists: boolean;
  canSwitchCities: boolean;
  level: number;
  levelInto: number;
  levelNeed: number;
  levelPct: number;
  levelToast: string | null;
}

export function CityCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CityEngine | null>(null);
  const rendererRef = useRef<CityRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState<HudSnap | null>(null);
  const [street, setStreet] = useState<{
    state: CityState;
    entry: { x: number; y: number };
    startInterior?: { kind: "subway"; stationId: string };
  } | null>(null);
  const [streetOpen, setStreetOpen] = useState(false);
  /** While the street overlay is visible it owns the simulation clock. */
  const streetActive = useRef(false);
  streetActive.current = streetOpen;
  const dustfallStateRef = useRef<CityState | null>(null);
  const riversideStateRef = useRef<CityState | null>(null);
  const activeCityRef = useRef<"riverside" | "dustfall">("riverside");

  const drag = useRef({
    active: false,
    moved: false,
    lastX: 0,
    lastY: 0,
    pointerId: -1,
  });
  const pickAt = useRef({ t: 0, x: 0, y: 0 });
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const engine = new CityEngine();
    const renderer = new CityRenderer();
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    engineRef.current = engine;
    rendererRef.current = renderer;
    riversideStateRef.current = engine.state;
    renderer.attach(ctx);
    let centered = false;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
      renderer.camera.zoomAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.deltaY > 0 ? 0.9 : 1.11,
      );
    };
    canvas.addEventListener("wheel", wheel, { passive: false });

    const held = new Set<string>();
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

    const keyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      // The street view has its own movement keys.
      if (streetActive.current) return;
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
    let toastHold: { text: string; until: number } | null = null;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Hand the frame over entirely while walking the streets, so the
      // simulation is not advanced twice and we are not drawing two views.
      if (streetActive.current) {
        held.clear();
        frame = requestAnimationFrame(loop);
        return;
      }

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
      selectedIdRef.current = engine.selectedId;
      hudAcc += dt;
      if (hudAcc > 0.12) {
        hudAcc = 0;
        const clock = formatClock(engine.state);
        const life = syncDustfallUnlock(readPlayer());
        const progress = characterProgress(life.life.xp);
        const note = takeLevelToast();
        if (note) toastHold = { text: note, until: now + 4500 };
        const toast =
          toastHold && now < toastHold.until ? toastHold.text : null;
        if (toastHold && now >= toastHold.until) toastHold = null;
        const hover = engine.hoverBuildingId
          ? (engine.state.buildings.get(engine.hoverBuildingId) ?? null)
          : engine.hover
            ? getBuildingAt(engine.state, engine.hover.x, engine.hover.y)
            : null;
        setHud({
          cityName: engine.state.name,
          cityId: engine.state.id,
          population: engine.state.population,
          treasury: engine.state.budget.treasury,
          day: clock.day,
          date: clock.date,
          time: clock.time,
          phase: labelPhase(dayPhase(engine.state)),
          weather: engine.state.weather,
          events: engine.state.events,
          tool: engine.tool,
          selected: engine.selectedId
            ? (engine.state.buildings.get(engine.selectedId) ?? null)
            : null,
          hoverLabel: engine.placementHint
            ? engine.placementHint
            : hover
              ? hover.name
              : engine.hover
                ? `Tile ${engine.hover.x}, ${engine.hover.y}`
                : "",
          streetLife: engine.state.citizens.filter(citizenIsOutdoors).length,
          trafficFlow: trafficFlowScore(engine.state),
          parkingFill: parkingFill(engine.state).pct,
          wallet: totalBalance(life),
          careerLabel: life.career ? officeRank(life.career.xp).label : "",
          mallExists: Boolean(findMall(engine.state)),
          canSwitchCities: Boolean(life.dustfallUnlocked),
          level: progress.level,
          levelInto: progress.into,
          levelNeed: progress.need,
          levelPct: progress.pct,
          levelToast: toast,
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

  /** Drops into first person at whatever the camera is currently centred on. */
  const enterStreet = useCallback(() => {
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    if (!engine || !renderer) return;
    const centre = renderer.camera.pickTile(
      renderer.width / 2,
      renderer.height / 2,
    );
    const clamped = {
      x: Math.max(0, Math.min(engine.state.size - 1, centre.x)),
      y: Math.max(0, Math.min(engine.state.size - 1, centre.y)),
    };
    setStreet({ state: engine.state, entry: clamped });
    selectedIdRef.current = engine.selectedId;
    setStreetOpen(true);
  }, []);

  const enterSelectedStation = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const selected = engine.selectedId
      ? engine.state.buildings.get(engine.selectedId)
      : null;
    if (!selected || selected.kind !== "subway_station") return;
    const id = subwayStationId(selected);
    if (!id) return;
    setStreet({
      state: engine.state,
      entry: subwayGateTile(selected),
      startInterior: { kind: "subway", stationId: id },
    });
    selectedIdRef.current = selected.id;
    setStreetOpen(true);
  }, []);

  const tickFromStreet = useCallback((dt: number) => {
    engineRef.current?.tick(dt);
  }, []);

  const leaveStreet = useCallback(() => {
    setStreetOpen(false);
  }, []);

  const pushHud = useCallback((engine: CityEngine) => {
    const clock = formatClock(engine.state);
    const life = syncDustfallUnlock(readPlayer());
    const progress = characterProgress(life.life.xp);
    setHud({
      cityName: engine.state.name,
      cityId: engine.state.id,
      population: engine.state.population,
      treasury: engine.state.budget.treasury,
      day: clock.day,
      date: clock.date,
      time: clock.time,
      phase: labelPhase(dayPhase(engine.state)),
      weather: engine.state.weather,
      events: engine.state.events,
      tool: engine.tool,
      selected: engine.selectedId
        ? (engine.state.buildings.get(engine.selectedId) ?? null)
        : null,
      hoverLabel: "",
      streetLife: engine.state.citizens.filter(citizenIsOutdoors).length,
      trafficFlow: trafficFlowScore(engine.state),
      parkingFill: parkingFill(engine.state).pct,
      wallet: totalBalance(life),
      careerLabel: life.career ? officeRank(life.career.xp).label : "",
      mallExists: Boolean(findMall(engine.state)),
      canSwitchCities: Boolean(life.dustfallUnlocked),
      level: progress.level,
      levelInto: progress.into,
      levelNeed: progress.need,
      levelPct: progress.pct,
      levelToast: takeLevelToast(),
    });
  }, []);

  /** Swap the isometric overview between Riverside and Dustfall. */
  const switchCity = useCallback(
    (target: "riverside" | "dustfall") => {
      const engine = engineRef.current;
      const renderer = rendererRef.current;
      const wrap = wrapRef.current;
      if (!engine || !renderer || !wrap) return;
      if (engine.state.id === target) return;
      if (target === "dustfall" && !readPlayer().dustfallUnlocked) return;

      const prev = engine.state;
      if (prev.id === "riverside") riversideStateRef.current = prev;
      if (prev.id === "dustfall") dustfallStateRef.current = prev;

      let next: CityState;
      if (target === "dustfall") {
        markMissionDustfall();
        if (!dustfallStateRef.current) dustfallStateRef.current = generateDustfall();
        next = dustfallStateRef.current;
      } else {
        next = riversideStateRef.current ?? engine.state;
        if (next.id !== "riverside") return;
      }

      // Keep clock / weather continuous across the jump.
      next.clock = { ...prev.clock };
      next.weather = prev.weather;

      engine.loadState(next);
      activeCityRef.current = target;
      setStreetOpen(false);
      setStreet(null);

      const rect = wrap.getBoundingClientRect();
      if (target === "dustfall") renderer.camera.centerOn(18, 16, rect.width, rect.height);
      else renderer.camera.centerOn(19, 18, rect.width, rect.height);

      pushHud(engine);
    },
    [pushHud],
  );

  /** Leave street / highway and open the Egypt-styled Dustfall isometric city. */
  const enterDesertCity = useCallback(() => {
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    const wrap = wrapRef.current;
    if (!engine || !renderer || !wrap) return;

    // Arriving via Highway 93 unlocks Dustfall even if the HUD switcher was locked.
    markMissionDustfall();

    const prev = engine.state;
    if (prev.id === "riverside") riversideStateRef.current = prev;
    if (prev.id === "dustfall") dustfallStateRef.current = prev;

    if (prev.id !== "dustfall") {
      if (!dustfallStateRef.current) dustfallStateRef.current = generateDustfall();
      const dustfall = dustfallStateRef.current;
      dustfall.clock = { ...prev.clock };
      dustfall.weather = prev.weather;
      engine.loadState(dustfall);
    }

    activeCityRef.current = "dustfall";
    setStreetOpen(false);
    setStreet(null);

    const rect = wrap.getBoundingClientRect();
    renderer.camera.centerOn(18, 16, rect.width, rect.height);
    pushHud(engine);
  }, [pushHud]);

  useEffect(() => {
    if (streetOpen || !street) return;
    const id = window.setTimeout(() => setStreet(null), 160);
    return () => window.clearTimeout(id);
  }, [streetOpen, street]);

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
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const tile = renderer.camera.pickTile(sx, sy);
    const world = renderer.camera.screenToWorld(sx, sy);
    engine.hover = tile;
    if (engine.tool === "inspect") {
      const now = performance.now();
      const moved = Math.hypot(sx - pickAt.current.x, sy - pickAt.current.y);
      if (now - pickAt.current.t > 50 || moved > 8) {
        pickAt.current = { t: now, x: sx, y: sy };
        engine.hoverBuildingId =
          pickBuildingAt(engine.state, world.x, world.y)?.id ?? null;
      }
    } else {
      engine.hoverBuildingId =
        getBuildingAt(engine.state, tile.x, tile.y)?.id ?? null;
    }

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
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const world = renderer.camera.screenToWorld(sx, sy);
      if (engine.tool === "inspect") {
        engine.inspectWorld(world.x, world.y);
      } else {
        const tile = renderer.camera.pickTile(sx, sy);
        engine.applyTool(tile.x, tile.y);
      }
    }
    drag.current.active = false;
    drag.current.moved = false;
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-[#1a2748]"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        style={{ visibility: streetOpen ? "hidden" : "visible" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (engineRef.current) {
            engineRef.current.hover = null;
            engineRef.current.hoverBuildingId = null;
          }
          drag.current.active = false;
        }}
        onWheel={(event) => event.preventDefault()}
      />
      {hud ? (
        <div className={streetOpen ? "hidden" : undefined}>
          <CityHud
            {...hud}
            onTool={(tool) => {
              const engine = engineRef.current;
              if (!engine) return;
              engine.setTool(tool);
              setHud((prev) =>
                prev
                  ? {
                      ...prev,
                      tool: engine.tool,
                      selected: engine.selectedId
                        ? (engine.state.buildings.get(engine.selectedId) ??
                          null)
                        : prev.selected,
                      hoverLabel: engine.placementHint || prev.hoverLabel,
                      mallExists: Boolean(findMall(engine.state)),
                    }
                  : prev,
              );
            }}
            onClose={() => {
              if (engineRef.current) engineRef.current.selectedId = null;
            }}
            onEnterStreet={enterStreet}
            onEnterStation={enterSelectedStation}
            onSwitchCity={switchCity}
          />
        </div>
      ) : null}

      {street ? (
        <div className={streetOpen ? "absolute inset-0 z-30" : "hidden"}>
          <StreetView
            state={street.state}
            entry={street.entry}
            startInterior={street.startInterior}
            active={streetOpen}
            selectedBuildingId={selectedIdRef}
            onTick={tickFromStreet}
            onExit={leaveStreet}
            onEnterDesertCity={enterDesertCity}
            riversideState={riversideStateRef.current}
          />
        </div>
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
