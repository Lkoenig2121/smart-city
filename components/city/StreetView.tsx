"use client";

import type { Building, CityState } from "@/lib/city/types";
import { findStadium, isGameNight, stadiumGateTile } from "@/lib/city/stadium";
import {
  findLodging,
  grantLodgingKey,
  hasLodgingKey,
  lodgingGateTile,
  lodgingUse,
  type LodgingZone,
} from "@/lib/city/lodging";
import type { MoveMode } from "@/lib/street/controls";
import { StreetWorld } from "@/lib/street/StreetWorld";
import { StadiumWorld } from "@/lib/street/StadiumWorld";
import { LodgingWorld } from "@/lib/street/LodgingWorld";
import { formatClock } from "@/lib/simulation/city/cityTick";
import { useEffect, useRef, useState } from "react";
import { StreetMinimap } from "./StreetMinimap";

type Interior =
  | { kind: "stadium" }
  | { kind: "lodging"; buildingId: string; zone: LodgingZone };

interface Props {
  state: CityState;
  entry: { x: number; y: number };
  onTick: (dt: number) => void;
  onExit: () => void;
}

export function StreetView({ state, entry, onTick, onExit }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<StreetWorld | null>(null);
  const stadiumRef = useRef<StadiumWorld | null>(null);
  const lodgingRef = useRef<LodgingWorld | null>(null);
  const positionRef = useRef<{ x: number; y: number; yaw: number } | null>(null);
  const atGateRef = useRef(false);
  const lodgingDoorRef = useRef<Building | null>(null);
  const atDeskRef = useRef(false);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  const [locked, setLocked] = useState(false);
  const [clock, setClock] = useState(() => formatClock(state));
  const [failed, setFailed] = useState<string | null>(null);
  const [mode, setMode] = useState<MoveMode>("hop");
  const [interior, setInterior] = useState<Interior | null>(null);
  const [atGate, setAtGate] = useState(false);
  const [lodgingDoor, setLodgingDoor] = useState<Building | null>(null);
  const [atDesk, setAtDesk] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [spawn, setSpawn] = useState(entry);

  const inside = interior !== null;
  const lodgingBuilding =
    interior?.kind === "lodging" ? findLodging(state, interior.buildingId) : null;

  useEffect(() => {
    if (interior) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let world: StreetWorld;
    try {
      world = new StreetWorld(canvas, state);
    } catch (error) {
      setFailed(
        error instanceof Error ? error.message : "WebGL is unavailable in this browser.",
      );
      return;
    }

    worldRef.current = world;
    world.spawnNear(spawn.x, spawn.y);
    world.setMoveMode(mode);

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
      if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
      if (event.code === "KeyE") {
        event.preventDefault();
        if (atGateRef.current) {
          setInterior({ kind: "stadium" });
          return;
        }
        const door = lodgingDoorRef.current;
        if (door) {
          setInterior({ kind: "lodging", buildingId: door.id, zone: "lobby" });
          return;
        }
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
      const gate = world.nearStadiumGate();
      atGateRef.current = gate;
      setAtGate((prev) => (prev === gate ? prev : gate));
      const door = world.nearLodgingEntrance();
      lodgingDoorRef.current = door;
      setLodgingDoor((prev) => (prev?.id === door?.id ? prev : door));
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
  }, [state, spawn.x, spawn.y, interior]);

  useEffect(() => {
    if (interior?.kind !== "stadium") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let world: StadiumWorld;
    try {
      world = new StadiumWorld(canvas, state);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "WebGL is unavailable in this browser.");
      setInterior(null);
      return;
    }
    stadiumRef.current = world;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      world.resize(rect.width, rect.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const leave = () => {
      const stadium = findStadium(state);
      if (stadium) setSpawn(stadiumGateTile(stadium));
      setInterior(null);
    };
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
      if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
      if (event.code === "KeyE") {
        event.preventDefault();
        leave();
        return;
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
      stadiumRef.current = null;
    };
  }, [interior, state]);

  useEffect(() => {
    if (interior?.kind !== "lodging") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const building = findLodging(state, interior.buildingId);
    if (!canvas || !wrap || !building) return;

    let world: LodgingWorld;
    try {
      world = new LodgingWorld(canvas, state, building, interior.zone);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "WebGL is unavailable in this browser.");
      setInterior(null);
      return;
    }
    lodgingRef.current = world;
    setHasKey(hasLodgingKey(building.id) || lodgingUse(building) === "residences");
    setAtDesk(false);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      world.resize(rect.width, rect.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const leaveStreet = () => {
      setSpawn(lodgingGateTile(building));
      setInterior(null);
      setAtDesk(false);
    };
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
      if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
      if (event.code === "KeyE") {
        event.preventDefault();
        if (interior.zone !== "lobby") {
          setInterior({ kind: "lodging", buildingId: building.id, zone: "lobby" });
          return;
        }
        if (world.nearExit()) leaveStreet();
        return;
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
      const desk = interior.zone === "lobby" && world.nearDesk();
      atDeskRef.current = desk;
      setAtDesk((prev) => (prev === desk ? prev : desk));
      if (desk && document.pointerLockElement === canvas) document.exitPointerLock();
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
      lodgingRef.current = null;
    };
  }, [interior, state]);

  const requestLock = () => {
    if (atDesk) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void canvas.requestPointerLock();
  };

  const chooseMode = (next: MoveMode) => {
    setMode(next);
    worldRef.current?.setMoveMode(next);
  };

  const goLodgingZone = (zone: LodgingZone) => {
    if (interior?.kind !== "lodging") return;
    setInterior({ kind: "lodging", buildingId: interior.buildingId, zone });
  };

  const rentOrVisit = () => {
    if (!lodgingBuilding) return;
    grantLodgingKey(lodgingBuilding.id);
    setHasKey(true);
    goLodgingZone("room");
  };

  const hotel = lodgingBuilding ? lodgingUse(lodgingBuilding) === "hotel" : false;
  const placeName = interior?.kind === "stadium"
    ? "Ravens Ballpark"
    : lodgingBuilding?.name ?? "Street level";

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

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/45 px-3.5 py-2 backdrop-blur">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-amber-300/80">
            {inside ? placeName : "Street level"}
          </p>
          <p className="text-sm font-medium text-white">
            {clock.day} · {clock.time}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {!inside ? (
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
          ) : (
            <button
              onClick={() => {
                if (interior?.kind === "stadium") {
                  const stadium = findStadium(state);
                  if (stadium) setSpawn(stadiumGateTile(stadium));
                } else if (lodgingBuilding) {
                  setSpawn(lodgingGateTile(lodgingBuilding));
                }
                setInterior(null);
              }}
              className="rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-semibold text-[#1a1206] backdrop-blur"
            >
              {interior?.kind === "stadium" ? "Leave stadium" : "Leave building"}
            </button>
          )}

          <button
            onClick={onExit}
            className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            ✕ Exit to city view
          </button>
        </div>
      </div>

      {locked && !failed ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-1.5 w-1.5 rounded-full bg-white/70 shadow" />
        </div>
      ) : null}

      {!locked && !failed && !atDesk ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
          <div className="max-w-xs rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-center backdrop-blur">
            <p className="text-xs font-semibold text-white">Click to look around</p>
            {mode === "hop" && !inside ? (
              <p className="mt-0.5 text-[0.65rem] leading-snug text-slate-300">
                <span className="font-medium text-white">W</span>/
                <span className="font-medium text-white">S</span> hop ·{" "}
                <span className="font-medium text-white">A</span>/
                <span className="font-medium text-white">D</span> turn ·{" "}
                <span className="font-medium text-white">Space</span> jump ·{" "}
                <span className="font-medium text-white">Mouse</span> look
              </p>
            ) : (
              <p className="mt-0.5 text-[0.65rem] leading-snug text-slate-300">
                <span className="font-medium text-white">WASD</span> walk ·{" "}
                <span className="font-medium text-white">Space</span> jump ·{" "}
                <span className="font-medium text-white">Shift</span> run ·{" "}
                <span className="font-medium text-white">Mouse</span> look
              </p>
            )}
            <p className="mt-0.5 text-[0.6rem] text-slate-400">Esc releases the cursor</p>
          </div>
        </div>
      ) : null}

      {locked && !failed ? (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[0.68rem] leading-relaxed text-slate-300 backdrop-blur">
          {mode === "hop" && !inside ? (
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
              <span className="font-semibold text-white">E</span>{" "}
              {inside ? "leave" : "enter"}
            </>
          )}
        </div>
      ) : null}

      {atGate && !inside && !failed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-2xl border border-amber-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
              Ravens Ballpark
            </p>
            <p className="mt-1 text-xl font-semibold text-white">Enter stadium</p>
            <p className="mt-1 text-sm text-slate-300">
              Press <span className="font-semibold text-white">E</span>
            </p>
          </div>
        </div>
      ) : null}

      {lodgingDoor && !inside && !failed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-2xl border border-amber-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
              {lodgingUse(lodgingDoor) === "hotel" ? "Hotel" : "Residences"}
            </p>
            <p className="mt-1 text-xl font-semibold text-white">{lodgingDoor.name}</p>
            <p className="mt-1 text-sm text-slate-300">
              Press <span className="font-semibold text-white">E</span> to enter the lobby
            </p>
          </div>
        </div>
      ) : null}

      {interior?.kind === "stadium" || atGate ? (
        <div className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-white/15 bg-[#1f4d8c]/90 px-5 py-2.5 text-center shadow-xl backdrop-blur">
            <p className="text-sm font-bold tracking-wide text-white">⚾ RIVERSIDE RAVENS</p>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-200">
              {isGameNight(state) ? "Home Game — 7:00 PM" : "Open for tours"}
            </p>
          </div>
        </div>
      ) : null}

      {atDesk && lodgingBuilding && interior?.kind === "lodging" && interior.zone === "lobby" ? (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-2xl border border-amber-300/35 bg-[#14110c]/92 p-5 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">Front desk</p>
            <p className="mt-1 text-lg font-semibold text-white">{lodgingBuilding.name}</p>
            <p className="mt-2 text-sm text-slate-300">
              {hotel
                ? hasKey
                  ? "Your room is ready. Elevators are to the left."
                  : "A night in a city-view suite is $189."
                : "Welcome home. The roof deck is open to residents."}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={rentOrVisit}
                className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#1a1206]"
              >
                {hotel ? (hasKey ? "Go to your room" : "Rent a room") : "Visit your apartment"}
              </button>
              {(hasKey || !hotel) && (
                <button
                  onClick={() => goLodgingZone("pool")}
                  className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
                >
                  Roof deck pool
                </button>
              )}
            </div>
            <p className="mt-3 text-[0.65rem] text-slate-500">Walk back to the doors and press E to leave</p>
          </div>
        </div>
      ) : null}

      {interior?.kind === "lodging" && interior.zone !== "lobby" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Press <span className="font-semibold text-white">E</span> to return to the lobby
            </p>
          </div>
        </div>
      ) : null}

      {!failed && !inside ? <StreetMinimap state={state} positionRef={positionRef} /> : null}
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
