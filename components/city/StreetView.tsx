"use client";

import type { Building, CityState } from "@/lib/city/types";
import { findStadium, isGameNight, stadiumGateTile } from "@/lib/city/stadium";
import {
  canEnterLodgingRoom,
  findLodging,
  findLodgingRoom,
  grantLodgingKey,
  hasLodgingKey,
  lodgingGateTile,
  lodgingUse,
  type LodgingRoom,
  type LodgingZone,
} from "@/lib/city/lodging";
import {
  findSubwayStation,
  stationDef,
  subwayGateFromId,
  subwayStationId,
} from "@/lib/city/subway";
import {
  findVenue,
  venueGateTile,
  venueLabel,
  venueRole,
} from "@/lib/city/venues";
import { readPlayer, type PlayerState } from "@/lib/city/player";
import type { MoveMode } from "@/lib/street/controls";
import { StreetWorld } from "@/lib/street/StreetWorld";
import { StadiumWorld } from "@/lib/street/StadiumWorld";
import { LodgingWorld } from "@/lib/street/LodgingWorld";
import { SubwayWorld } from "@/lib/street/SubwayWorld";
import { VenueWorld } from "@/lib/street/VenueWorld";
import { attachPointerInput } from "@/lib/street/keys";
import { canSleepNow, formatClock, sleepUntilMorning } from "@/lib/simulation/city/cityTick";
import { weatherEmoji } from "@/lib/simulation/weather/weather";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { LodgingDesk } from "./LodgingDesk";
import { OfficeComputer } from "./OfficeComputer";
import { PlayerStatus } from "./PlayerStatus";
import { RoomComputer } from "./RoomComputer";
import { StreetMinimap } from "./StreetMinimap";
import { SubwayBoard } from "./SubwayBoard";
import { VenueDesk } from "./VenueDesk";

type Interior =
  | { kind: "stadium" }
  | { kind: "lodging"; buildingId: string; zone: LodgingZone; roomId?: string }
  | { kind: "subway"; stationId: string; arrived?: boolean }
  | { kind: "venue"; buildingId: string };

interface Props {
  state: CityState;
  entry: { x: number; y: number };
  startInterior?: Interior | null;
  /** False while the overlay is hiding so the isometric view can paint first. */
  active?: boolean;
  onTick: (dt: number) => void;
  onExit: () => void;
}

export function StreetView({
  state,
  entry,
  startInterior = null,
  active = true,
  onTick,
  onExit,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const outdoorCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<StreetWorld | null>(null);
  const stadiumRef = useRef<StadiumWorld | null>(null);
  const lodgingRef = useRef<LodgingWorld | null>(null);
  const subwayRef = useRef<SubwayWorld | null>(null);
  const venueRef = useRef<VenueWorld | null>(null);
  const positionRef = useRef<{ x: number; y: number; yaw: number } | null>(null);
  const atGateRef = useRef(false);
  const lodgingDoorRef = useRef<Building | null>(null);
  const subwayDoorRef = useRef<Building | null>(null);
  const venueDoorRef = useRef<Building | null>(null);
  const atDeskRef = useRef(false);
  const atComputerRef = useRef(false);
  const atOfficeComputerRef = useRef(false);
  const sleepingRef = useRef(false);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  const [locked, setLocked] = useState(false);
  const [clock, setClock] = useState(() => formatClock(state));
  const [failed, setFailed] = useState<string | null>(null);
  const [mode, setMode] = useState<MoveMode>("hop");
  const [interior, setInterior] = useState<Interior | null>(startInterior);
  const [atGate, setAtGate] = useState(false);
  const [lodgingDoor, setLodgingDoor] = useState<Building | null>(null);
  const [subwayDoor, setSubwayDoor] = useState<Building | null>(null);
  const [atDesk, setAtDesk] = useState(false);
  const [atSubwayExit, setAtSubwayExit] = useState(false);
  const [atTrain, setAtTrain] = useState(false);
  const [pickingStop, setPickingStop] = useState(false);
  const [riding, setRiding] = useState(false);
  const [atComputer, setAtComputer] = useState(false);
  const [aimComputer, setAimComputer] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [pickingRoom, setPickingRoom] = useState(false);
  const [atBed, setAtBed] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [sleepPhase, setSleepPhase] = useState<"night" | "morning">("night");
  const [spawn, setSpawn] = useState(entry);
  const [venueDoor, setVenueDoor] = useState<Building | null>(null);
  const [atOfficeComputer, setAtOfficeComputer] = useState(false);
  const [player, setPlayer] = useState<PlayerState>(() => readPlayer());

  const inside = interior !== null;
  const lodgingBuilding =
    interior?.kind === "lodging" ? findLodging(state, interior.buildingId) : null;
  const subwayBuilding =
    interior?.kind === "subway" ? findSubwayStation(state, interior.stationId) : null;
  const venueBuilding =
    interior?.kind === "venue" ? findVenue(state, interior.buildingId) : null;

  useEffect(() => {
    const canvas = outdoorCanvasRef.current;
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
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      world.resize(rect.width, rect.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      world.dispose();
      worldRef.current = null;
    };
  }, [state]);

  useEffect(() => {
    if (!active || interior) return;
    const canvas = outdoorCanvasRef.current;
    const wrap = wrapRef.current;
    const world = worldRef.current;
    if (!canvas || !wrap || !world) return;

    world.spawnNear(spawn.x, spawn.y);
    world.setMoveMode(mode);
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      world.resize(rect.width, rect.height);
    };
    resize();

    const detachInput = attachPointerInput(canvas, world.controls, {
      setLocked,
      consumeKey: (event) => {
        if (event.code !== "KeyE") return false;
        event.preventDefault();
        if (atGateRef.current) {
          setInterior({ kind: "stadium" });
          return true;
        }
        const door = lodgingDoorRef.current;
        if (door) {
          setInterior({ kind: "lodging", buildingId: door.id, zone: "lobby" });
          return true;
        }
        const subway = subwayDoorRef.current;
        if (subway) {
          const id = subwayStationId(subway);
          if (id) setInterior({ kind: "subway", stationId: id });
          return true;
        }
        const venue = venueDoorRef.current;
        if (venue) {
          setInterior({ kind: "venue", buildingId: venue.id });
          return true;
        }
        return false;
      },
    });

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
      const subway = world.nearSubwayEntrance();
      subwayDoorRef.current = subway;
      setSubwayDoor((prev) => (prev?.id === subway?.id ? prev : subway));
      const venue = world.nearVenueEntrance();
      venueDoorRef.current = venue;
      setVenueDoor((prev) => (prev?.id === venue?.id ? prev : venue));
      clockAcc += dt;
      if (clockAcc > 0.25) {
        clockAcc = 0;
        setClock(formatClock(state));
        setPlayer(readPlayer());
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      detachInput();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [active, interior, spawn.x, spawn.y, state]);

  useEffect(() => {
    if (!active || interior?.kind !== "stadium") return;
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
    const detachInput = attachPointerInput(canvas, world.controls, {
      setLocked,
      consumeKey: (event) => {
        if (event.code !== "KeyE") return false;
        event.preventDefault();
        leave();
        return true;
      },
    });

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
      detachInput();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      world.dispose();
      stadiumRef.current = null;
    };
  }, [active, interior, state]);

  useEffect(() => {
    if (!active || interior?.kind !== "lodging") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const building = findLodging(state, interior.buildingId);
    if (!canvas || !wrap || !building) return;

    const street = worldRef.current;
    const city = interior.zone === "room" ? street?.borrowCity() ?? null : null;
    let world: LodgingWorld;
    try {
      world = new LodgingWorld(canvas, state, building, interior.zone, interior.roomId);
      if (city) {
        world.attachCity(city, findLodgingRoom(building, interior.roomId)?.floor ?? 8);
      }
    } catch (error) {
      if (city) street?.returnCity(city);
      setFailed(error instanceof Error ? error.message : "WebGL is unavailable in this browser.");
      setInterior(null);
      return;
    }
    lodgingRef.current = world;
    setHasKey(hasLodgingKey(building.id) || lodgingUse(building) === "residences");
    setAtDesk(false);
    setAtComputer(false);
    setAimComputer(false);
    setPickingRoom(false);
    setAtBed(false);
    setSleeping(false);
    setSleepPhase("night");
    atComputerRef.current = false;
    sleepingRef.current = false;

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
    const timers: number[] = [];
    const beginSleep = () => {
      if (sleepingRef.current || interior.zone !== "room" || !canSleepNow(state)) return;
      sleepingRef.current = true;
      setSleeping(true);
      setSleepPhase("night");
      world.controls.enabled = false;
      world.controls.clearKeys();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      timers.push(
        window.setTimeout(() => {
          sleepUntilMorning(state);
          setClock(formatClock(state));
          setPlayer(readPlayer());
          setSleepPhase("morning");
          timers.push(
            window.setTimeout(() => {
              world.controls.enabled = true;
              sleepingRef.current = false;
              setSleeping(false);
              setSleepPhase("night");
            }, 1600),
          );
        }, 900),
      );
    };
    const detachInput = attachPointerInput(canvas, world.controls, {
      setLocked,
      consumeKey: (event) => {
        if (event.code !== "KeyE") return false;
        event.preventDefault();
        if (sleepingRef.current) return true;
        if (atComputerRef.current) {
          setAtComputer(false);
          return true;
        }
        if (interior.zone === "room" && world.nearBed() && canSleepNow(state)) {
          beginSleep();
          return true;
        }
        if (interior.zone !== "lobby") {
          setInterior({ kind: "lodging", buildingId: building.id, zone: "lobby" });
          return true;
        }
        if (world.nearExit()) leaveStreet();
        return true;
      },
    });

    let frame = 0;
    let last = performance.now();
    let clockAcc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!sleepingRef.current) tickRef.current(dt);
      world.render(dt);
      const desk = interior.zone === "lobby" && world.nearDesk();
      atDeskRef.current = desk;
      setAtDesk((prev) => (prev === desk ? prev : desk));
      if (desk && document.pointerLockElement === canvas) document.exitPointerLock();
      const bed = interior.zone === "room" && !atComputerRef.current && world.nearBed();
      setAtBed((prev) => (prev === bed ? prev : bed));
      const aiming = interior.zone === "room" && !atComputerRef.current && !sleepingRef.current && world.aimedAtComputer();
      setAimComputer((prev) => (prev === aiming ? prev : aiming));
      clockAcc += dt;
      if (clockAcc > 0.25) {
        clockAcc = 0;
        setClock(formatClock(state));
        setPlayer(readPlayer());
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      for (const id of timers) window.clearTimeout(id);
      ro.disconnect();
      detachInput();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      world.controls.enabled = true;
      sleepingRef.current = false;
      const borrowed = world.detachCity();
      if (borrowed) worldRef.current?.returnCity(borrowed);
      world.dispose();
      lodgingRef.current = null;
    };
  }, [active, interior, state]);

  useEffect(() => {
    if (!active || interior?.kind !== "venue") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const building = findVenue(state, interior.buildingId);
    if (!canvas || !wrap || !building) {
      setInterior(null);
      return;
    }

    let world: VenueWorld;
    try {
      world = new VenueWorld(canvas, state, building);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "WebGL is unavailable in this browser.");
      setInterior(null);
      return;
    }
    venueRef.current = world;
    setAtDesk(false);
    setAtOfficeComputer(false);
    atOfficeComputerRef.current = false;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      world.resize(rect.width, rect.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const leaveStreet = () => {
      setSpawn(venueGateTile(building));
      setInterior(null);
      setAtDesk(false);
      setAtOfficeComputer(false);
    };
    const detachInput = attachPointerInput(canvas, world.controls, {
      setLocked,
      consumeKey: (event) => {
        if (event.code !== "KeyE") return false;
        event.preventDefault();
        if (atOfficeComputerRef.current) {
          atOfficeComputerRef.current = false;
          setAtOfficeComputer(false);
          return true;
        }
        if (world.nearExit()) leaveStreet();
        return true;
      },
    });

    let frame = 0;
    let last = performance.now();
    let clockAcc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tickRef.current(dt);
      world.render(dt);
      const desk = world.nearDesk();
      atDeskRef.current = desk;
      setAtDesk((prev) => (prev === desk ? prev : desk));
      if (desk && document.pointerLockElement === canvas) document.exitPointerLock();
      clockAcc += dt;
      if (clockAcc > 0.25) {
        clockAcc = 0;
        setClock(formatClock(state));
        setPlayer(readPlayer());
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      detachInput();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      world.dispose();
      venueRef.current = null;
    };
  }, [active, interior, state]);

  useEffect(() => {
    if (!active || interior?.kind !== "subway") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let world: SubwayWorld;
    try {
      world = new SubwayWorld(canvas, state, interior.stationId, Boolean(interior.arrived));
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "WebGL is unavailable in this browser.");
      setInterior(null);
      return;
    }
    subwayRef.current = world;
    setAtSubwayExit(false);
    setAtTrain(false);
    setPickingStop(false);
    setRiding(false);
    world.setArriveHandler((id) => {
      setRiding(false);
      setPickingStop(false);
      setInterior({ kind: "subway", stationId: id, arrived: true });
    });

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      world.resize(rect.width, rect.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const leaveStreet = () => {
      const dest = world.rideDestination() ?? interior.stationId;
      setSpawn(subwayGateFromId(state, dest));
      setRiding(false);
      setPickingStop(false);
      setAtTrain(false);
      setAtSubwayExit(false);
      setInterior(null);
    };
    const detachInput = attachPointerInput(canvas, world.controls, {
      setLocked,
      consumeKey: (event) => {
        if (event.code !== "KeyE") return false;
        event.preventDefault();
        if (world.isRiding()) return true;
        if (world.nearTrain()) {
          setPickingStop(true);
          if (document.pointerLockElement === canvas) document.exitPointerLock();
          return true;
        }
        if (world.nearExit()) leaveStreet();
        return true;
      },
    });

    let frame = 0;
    let last = performance.now();
    let clockAcc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tickRef.current(dt);
      world.render(dt);
      const exit = world.nearExit();
      setAtSubwayExit((prev) => (prev === exit ? prev : exit));
      const train = world.nearTrain();
      setAtTrain((prev) => (prev === train ? prev : train));
      const onTrain = world.isRiding();
      setRiding((prev) => (prev === onTrain ? prev : onTrain));
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
      detachInput();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      world.dispose();
      subwayRef.current = null;
    };
  }, [active, interior, state]);

  const requestLock = () => {
    if (atDesk || atComputer || pickingStop || riding || pickingRoom || sleeping || atOfficeComputer) return;
    const canvas = inside ? canvasRef.current : outdoorCanvasRef.current;
    if (!canvas) return;
    void canvas.requestPointerLock();
  };

  const onCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (atDesk || atComputer || pickingStop || riding || pickingRoom || sleeping || atOfficeComputer) return;
    const canvas = canvasRef.current;
    const world = lodgingRef.current;
    if (canvas && world && interior?.kind === "lodging" && interior.zone === "room") {
      const rect = canvas.getBoundingClientRect();
      const lockedNow = document.pointerLockElement === canvas;
      const ndcX = lockedNow ? 0 : ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = lockedNow ? 0 : -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      if (world.aimedAtComputer(ndcX, ndcY)) {
        atComputerRef.current = true;
        setAtComputer(true);
        if (lockedNow) document.exitPointerLock();
        return;
      }
    }
    requestLock();
  };

  const chooseMode = (next: MoveMode) => {
    setMode(next);
    worldRef.current?.setMoveMode(next);
  };

  const goLodgingZone = (zone: LodgingZone) => {
    if (interior?.kind !== "lodging") return;
    setPickingRoom(false);
    setInterior({
      kind: "lodging",
      buildingId: interior.buildingId,
      zone,
      roomId: zone === "room" ? interior.roomId : undefined,
    });
  };

  const enterLodgingRoom = (room: LodgingRoom) => {
    if (!lodgingBuilding) return;
    const hotelStay = lodgingUse(lodgingBuilding) === "hotel";
    if (!canEnterLodgingRoom(lodgingBuilding.id, room, hotelStay, hasKey)) return;
    if (interior?.kind === "lodging" && interior.zone === "room" && interior.roomId === room.id) {
      setPickingRoom(false);
      return;
    }
    grantLodgingKey(lodgingBuilding.id, room.id);
    setHasKey(true);
    setPickingRoom(false);
    setInterior({ kind: "lodging", buildingId: lodgingBuilding.id, zone: "room", roomId: room.id });
  };

  const currentRoom =
    lodgingBuilding && interior?.kind === "lodging" && interior.zone === "room"
      ? findLodgingRoom(lodgingBuilding, interior.roomId)
      : null;

  const placeName = interior?.kind === "stadium"
    ? "Ravens Ballpark"
    : lodgingBuilding
      ? currentRoom
        ? `${lodgingBuilding.name} · ${lodgingUse(lodgingBuilding) === "hotel" ? "Room" : "Apt"} ${currentRoom.label}`
        : lodgingBuilding.name
      : venueBuilding
        ? venueBuilding.name
        : subwayBuilding?.name
          ?? (interior?.kind === "subway" ? stationDef(interior.stationId).name : "Street level");

  return (
    <div ref={wrapRef} className="absolute inset-0 z-30 bg-[#0b1420]">
      <canvas
        ref={outdoorCanvasRef}
        className={`absolute inset-0 h-full w-full ${inside ? "invisible pointer-events-none" : ""}`}
        onClick={onCanvasClick}
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${inside ? "" : "invisible pointer-events-none"}`}
        onClick={onCanvasClick}
      />

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
        <div className="flex flex-col gap-2">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/45 px-3.5 py-2 backdrop-blur">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-amber-300/80">
            {inside ? placeName : "Street level"}
          </p>
          <p className="text-sm font-medium text-white">
            {clock.day} · {clock.date} · {clock.time}
          </p>
          <p className="text-[0.7rem] text-sky-100/80">
            {weatherEmoji(state.weather.kind)} {state.weather.tempF}° {state.weather.label}
            {state.events[0] ? ` · ${state.events[0].icon} ${state.events[0].headline}` : ""}
          </p>
        </div>
        <div className="pointer-events-auto">
          <PlayerStatus player={player} />
        </div>
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
            <>
            <button
              onClick={() => {
                if (interior?.kind === "stadium") {
                  const stadium = findStadium(state);
                  if (stadium) setSpawn(stadiumGateTile(stadium));
                } else if (lodgingBuilding) {
                  setSpawn(lodgingGateTile(lodgingBuilding));
                } else if (venueBuilding) {
                  setSpawn(venueGateTile(venueBuilding));
                } else if (interior?.kind === "subway") {
                  const dest = subwayRef.current?.rideDestination() ?? interior.stationId;
                  setSpawn(subwayGateFromId(state, dest));
                }
                setRiding(false);
                setPickingStop(false);
                setPickingRoom(false);
                setAtOfficeComputer(false);
                atOfficeComputerRef.current = false;
                setAtDesk(false);
                setInterior(null);
              }}
              className="rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-semibold text-[#1a1206] backdrop-blur"
            >
              {interior?.kind === "stadium" ? "Leave stadium" : "Leave building"}
            </button>
            {interior?.kind === "lodging" && interior.zone === "room" ? (
              <button
                onClick={() => {
                  setPickingRoom(true);
                  if (document.pointerLockElement) document.exitPointerLock();
                }}
                className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Switch rooms
              </button>
            ) : null}
            </>
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

      {!locked && !failed && !atDesk && !atComputer && !pickingStop && !riding && !pickingRoom && !sleeping && !atOfficeComputer ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
          <div className="max-w-xs rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-center backdrop-blur">
            <p className="text-xs font-semibold text-white">Click to look around</p>
            {mode === "hop" && !inside ? (
              <p className="mt-0.5 text-[0.65rem] leading-snug text-slate-300">
                <span className="font-medium text-white">W</span>/
                <span className="font-medium text-white">S</span> hop ·{" "}
                <span className="font-medium text-white">A</span>/
                <span className="font-medium text-white">D</span> turn ·{" "}
                <span className="font-medium text-white">Shift</span> run ·{" "}
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
              <span className="font-semibold text-white">Shift</span> run ·{" "}
              <span className="font-semibold text-white">A</span>/
              <span className="font-semibold text-white">D</span> turn ·{" "}
              <span className="font-semibold text-white">Space</span> jump
            </>
          ) : (
            <>
              <span className="font-semibold text-white">WASD</span> walk ·{" "}
              <span className="font-semibold text-white">Shift</span> run ·{" "}
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

      {venueDoor && !lodgingDoor && !subwayDoor && !atGate && !inside && !failed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-2xl border border-amber-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
              {(() => {
                const role = venueRole(venueDoor);
                return role ? venueLabel(role) : "Building";
              })()}
            </p>
            <p className="mt-1 text-xl font-semibold text-white">{venueDoor.name}</p>
            <p className="mt-1 text-sm text-slate-300">
              Press <span className="font-semibold text-white">E</span> to enter
              {venueRole(venueDoor) === "office" ? " · start work at the desk" : ""}
            </p>
          </div>
        </div>
      ) : null}

      {subwayDoor && !lodgingDoor && !atGate && !inside && !failed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-2xl border border-amber-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">Subway</p>
            <p className="mt-1 text-xl font-semibold text-white">{subwayDoor.name}</p>
            <p className="mt-1 text-sm text-slate-300">
              Press <span className="font-semibold text-white">E</span> to go underground
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

      {atTrain && !pickingStop && !riding && interior?.kind === "subway" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-amber-300/40 bg-black/70 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Doors open · press <span className="font-semibold text-white">E</span> to board
            </p>
          </div>
        </div>
      ) : null}

      {atSubwayExit && !atTrain && !pickingStop && !riding && interior?.kind === "subway" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Press <span className="font-semibold text-white">E</span> to leave the station
            </p>
          </div>
        </div>
      ) : null}

      {interior?.kind === "subway" && !atTrain && !atSubwayExit && !pickingStop && !riding ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Walk down the stairs to the platform · wait for the train
            </p>
          </div>
        </div>
      ) : null}

      {riding ? (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-white/10 bg-black/55 px-4 py-2 text-center backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-amber-300">Riverside Line</p>
            <p className="text-sm text-white">Through the tunnel</p>
          </div>
        </div>
      ) : null}

      {pickingStop && interior?.kind === "subway" ? (
        <SubwayBoard
          stationId={interior.stationId}
          onRide={(id) => {
            setPickingStop(false);
            subwayRef.current?.beginRide(id);
            setRiding(true);
          }}
          onClose={() => setPickingStop(false)}
        />
      ) : null}

      {atDesk && venueBuilding && interior?.kind === "venue" && !atOfficeComputer ? (
        <VenueDesk
          building={venueBuilding}
          state={state}
          onPlayerChange={setPlayer}
          onOpenWorkstation={() => {
            atOfficeComputerRef.current = true;
            setAtOfficeComputer(true);
            setAtDesk(false);
          }}
        />
      ) : null}

      {atOfficeComputer && venueBuilding && interior?.kind === "venue" ? (
        <OfficeComputer
          state={state}
          onClose={() => {
            atOfficeComputerRef.current = false;
            setAtOfficeComputer(false);
            setPlayer(readPlayer());
          }}
          onPlayerChange={setPlayer}
        />
      ) : null}

      {(atDesk || pickingRoom) && lodgingBuilding && interior?.kind === "lodging" ? (
        <LodgingDesk
          building={lodgingBuilding}
          hasKey={hasKey}
          currentRoomId={
            interior.zone === "room"
              ? (interior.roomId ?? currentRoom?.id)
              : findLodgingRoom(lodgingBuilding)?.id
          }
          onEnterRoom={enterLodgingRoom}
          onPool={() => goLodgingZone("pool")}
          onClose={pickingRoom ? () => setPickingRoom(false) : undefined}
        />
      ) : null}

      {atComputer && interior?.kind === "lodging" && interior.zone === "room" ? (
        <RoomComputer
          minuteOfDay={state.clock.minuteOfDay}
          onClose={() => {
            atComputerRef.current = false;
            setAtComputer(false);
          }}
        />
      ) : null}

      {aimComputer && !atComputer && interior?.kind === "lodging" && interior.zone === "room" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-sky-300/40 bg-black/70 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              <span className="font-semibold text-white">Click</span> to use the computer
            </p>
          </div>
        </div>
      ) : null}

      {atBed && !sleeping && !atComputer && interior?.kind === "lodging" && interior.zone === "room" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-amber-300/40 bg-black/70 px-4 py-2 text-center backdrop-blur">
            {canSleepNow(state) ? (
              <p className="text-xs text-slate-200">
                Press <span className="font-semibold text-white">E</span> to sleep until 8:00 AM
              </p>
            ) : (
              <p className="text-xs text-slate-200">You can turn in after 10:00 PM</p>
            )}
          </div>
        </div>
      ) : null}

      {interior?.kind === "venue" && !atDesk && !atOfficeComputer ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Walk to the desk · press <span className="font-semibold text-white">E</span> at the doors to leave
            </p>
          </div>
        </div>
      ) : null}

      {interior?.kind === "lodging" && interior.zone !== "lobby" && !atComputer && !aimComputer && !pickingRoom && !sleeping && !atBed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Press <span className="font-semibold text-white">E</span> to return to the lobby
            </p>
          </div>
        </div>
      ) : null}

      {sleeping ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black">
          <div className="text-center">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300/80">
              {sleepPhase === "morning" ? "Good morning" : "Good night"}
            </p>
            {sleepPhase === "morning" ? (
              <>
                <p className="mt-2 text-xl font-semibold text-white">
                  {clock.day} · {clock.date} · {clock.time}
                </p>
                <p className="mt-1 text-sm text-slate-400">8:00 AM wake-up</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Sleeping until 8:00 AM</p>
            )}
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
