"use client";

import type { Building, CityState } from "@/lib/city/types";
import {
  findStadium,
  GAME_HOURS_LABEL,
  ballclubFor,
  isGameNight,
  stadiumFinal,
  stadiumGateTile,
  stadiumWinner,
} from "@/lib/city/stadium";
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
import {
  formatDollars,
  readPlayer,
  awardXp,
  writePlayer,
  type PlayerState,
} from "@/lib/city/player";
import {
  advancePoliceCall,
  completePoliceCall,
  nearPoliceCallObjective,
  onPoliceDuty,
  policeCallPrompt,
  policeRank,
  syncPoliceCallArrival,
} from "@/lib/city/police";
import { consumeHeld } from "@/lib/city/bag";
import { characterStats } from "@/lib/city/character";
import { consumableById } from "@/lib/city/consumables";
import { isTypingTarget } from "@/lib/city/input";
import {
  markPhoneToasted,
  pendingPhoneToast,
  phoneUnreadCount,
  PHONE_TIME_SCALE,
  readPhone,
  setPhoneWaypoint,
  type PhoneApp,
  type PhoneMessage,
  type PhoneWaypoint,
} from "@/lib/city/phone";
import { discoverPlace } from "@/lib/city/wardrobe";
import { STORES, type ClothStore } from "@/lib/city/clothing";
import {
  FURNISH_STORES,
  makeOwnedHomeBuilding,
  type FurnishStore,
} from "@/lib/city/furnishings";
import { FurnitureShop } from "./FurnitureShop";
import type { MoveMode } from "@/lib/street/controls";
import { StreetWorld } from "@/lib/street/StreetWorld";
import { StadiumWorld } from "@/lib/street/StadiumWorld";
import { LodgingWorld } from "@/lib/street/LodgingWorld";
import { SubwayWorld } from "@/lib/street/SubwayWorld";
import { VenueWorld } from "@/lib/street/VenueWorld";
import { attachPointerInput } from "@/lib/street/keys";
import {
  canSleepNow,
  formatClock,
  sleepUntilMorning,
} from "@/lib/simulation/city/cityTick";
import { weatherEmoji } from "@/lib/simulation/weather/weather";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { CharacterMenu, type CharacterTab } from "./CharacterMenu";
import { ClothingShop } from "./ClothingShop";
import { MotorsShowroom } from "./MotorsShowroom";
import { LodgingDesk } from "./LodgingDesk";
import { PoolBar } from "./PoolBar";
import { OfficeComputer } from "./OfficeComputer";
import { PlayerPhone } from "./PlayerPhone";
import { PlayerStatus } from "./PlayerStatus";
import { RoomComputer } from "./RoomComputer";
import { StreetMinimap } from "./StreetMinimap";
import { SubwayBoard } from "./SubwayBoard";
import { VenueDesk } from "./VenueDesk";
import {
  activeOwnedVehicle,
  applyDriveTick,
  applyParkVehicle,
  hasOwnedVehicle,
  snapFleetToMotorsApproach,
  type OwnedVehicle,
} from "@/lib/city/vehicles";
import {
  markMissionDustfall,
  markMissionHighway,
  markMissionRamp,
} from "@/lib/city/missions";
import { DustfallWorld } from "@/lib/street/DustfallWorld";
import {
  DUSTFALL_ARRIVAL,
  generateDustfall,
} from "@/lib/city/generateDustfall";
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
  selectedBuildingId?: RefObject<string | null>;
  onTick: (dt: number) => void;
  onExit: () => void;
  /** Opens the Dustfall isometric city overview (Egypt-styled desert). */
  onEnterDesertCity?: () => void;
  /** Kept so Highway 93 return can restore Riverside after visiting Dustfall. */
  riversideState?: CityState | null;
}

export function StreetView({
  state,
  entry,
  startInterior = null,
  active = true,
  selectedBuildingId,
  onTick,
  onExit,
  onEnterDesertCity,
  riversideState = null,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const outdoorCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<StreetWorld | null>(null);
  const stadiumRef = useRef<StadiumWorld | null>(null);
  const lodgingRef = useRef<LodgingWorld | null>(null);
  const subwayRef = useRef<SubwayWorld | null>(null);
  const venueRef = useRef<VenueWorld | null>(null);
  const positionRef = useRef<{ x: number; y: number; yaw: number } | null>(
    null,
  );
  const atGateRef = useRef(false);
  const lodgingDoorRef = useRef<Building | null>(null);
  const subwayDoorRef = useRef<Building | null>(null);
  const venueDoorRef = useRef<Building | null>(null);
  /** Enter the aimed / door-tagged building; shared by E and click. */
  const tryEnterStreetDoorRef = useRef<() => boolean>(() => false);
  const atDeskRef = useRef(false);
  const deskDismissedRef = useRef(false);
  const atComputerRef = useRef(false);
  const atOfficeComputerRef = useRef(false);
  const sleepingRef = useRef(false);
  const characterMenuRef = useRef<CharacterTab | null>(null);
  const mallShopRef = useRef<ClothStore | null>(null);
  const mallFurnishRef = useRef<FurnishStore | null>(null);
  const mallSnackRef = useRef<{ name: string; items: string[] } | null>(null);
  const ownedHomeBuildingRef = useRef<Building | null>(null);
  const barMenuRef = useRef(false);
  const phoneOpenRef = useRef(false);
  const tickRef = useRef(onTick);
  tickRef.current = (dt: number) => {
    onTick(phoneOpenRef.current ? dt * PHONE_TIME_SCALE : dt);
  };

  const [locked, setLocked] = useState(false);
  const [clock, setClock] = useState(() => formatClock(state));
  const [failed, setFailed] = useState<string | null>(null);
  const [mode, setMode] = useState<MoveMode>("hop");
  const [interior, setInterior] = useState<Interior | null>(startInterior);
  const interiorRef = useRef(interior);
  interiorRef.current = interior;
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
  const [atSlider, setAtSlider] = useState(false);
  const [atConsole, setAtConsole] = useState(false);
  const [nuketownOn, setNuketownOn] = useState(false);
  const [sliderOpen, setSliderOpen] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [sleepPhase, setSleepPhase] = useState<"night" | "morning">("night");
  const [sleepInterest, setSleepInterest] = useState(0);
  const [spawn, setSpawn] = useState(entry);
  const [venueDoor, setVenueDoor] = useState<Building | null>(null);
  const [atOfficeComputer, setAtOfficeComputer] = useState(false);
  const [player, setPlayer] = useState<PlayerState>(() => readPlayer());
  const heldRef = useRef(player.life.held);
  heldRef.current = player.life.held;
  const sipsRef = useRef(player.life.heldSips ?? 0);
  sipsRef.current = player.life.heldSips ?? 0;
  const sippingRef = useRef(false);
  const sipTimerRef = useRef(0);
  const [characterMenu, setCharacterMenu] = useState<CharacterTab | null>(null);
  const [mallShop, setMallShop] = useState<ClothStore | null>(null);
  const [mallFurnish, setMallFurnish] = useState<FurnishStore | null>(null);
  const [mallStore, setMallStore] = useState<ClothStore | null>(null);
  const [mallFurnishNear, setMallFurnishNear] = useState<FurnishStore | null>(
    null,
  );
  const [mallHut, setMallHut] = useState<string | null>(null);
  const [mallSnack, setMallSnack] = useState<{
    name: string;
    items: string[];
  } | null>(null);
  const [motorsOpen, setMotorsOpen] = useState(false);
  const [driving, setDriving] = useState(false);
  const [nearCar, setNearCar] = useState<OwnedVehicle | null>(null);
  const [highwayHint, setHighwayHint] = useState<string | null>(null);
  const [dustfallTrip, setDustfallTrip] = useState(false);
  const [dustfallProgress, setDustfallProgress] = useState(0);
  const [highwayToward, setHighwayToward] = useState<"dustfall" | "riverside">(
    "dustfall",
  );
  const [inDustfall, setInDustfall] = useState(() => state.id === "dustfall");
  const [playState, setPlayState] = useState(state);
  const dustfallCityRef = useRef<CityState | null>(
    state.id === "dustfall" ? state : null,
  );
  const riversideStateRef = useRef<CityState | null>(
    state.id === "riverside" ? state : null,
  );
  const motorsOpenRef = useRef(false);
  const drivingRef = useRef(false);
  const dustfallRef = useRef<DustfallWorld | null>(null);
  const dustfallCanvasRef = useRef<HTMLCanvasElement>(null);
  const dustfallTripRef = useRef(false);
  dustfallTripRef.current = dustfallTrip;
  /** After Highway 93 remount may recreate StreetWorld — resume drive then. */
  const resumeDriveAfterDustfallRef = useRef(false);
  const [barMenu, setBarMenu] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneStartApp, setPhoneStartApp] = useState<PhoneApp>("home");
  const [phoneToast, setPhoneToast] = useState<PhoneMessage | null>(null);
  const [phoneThread, setPhoneThread] = useState<string | null>(null);
  const [policePrompt, setPolicePrompt] = useState<string | null>(null);
  const [policeNote, setPoliceNote] = useState<string | null>(null);
  const [waypoint, setWaypoint] = useState<PhoneWaypoint | null>(
    () => readPhone().waypoint,
  );
  const [unread, setUnread] = useState(0);
  const waypointRef = useRef(waypoint);
  waypointRef.current = waypoint;

  const clearNavWaypoint = () => {
    if (!waypointRef.current) return;
    setPhoneWaypoint(null);
    waypointRef.current = null;
    setWaypoint(null);
    worldRef.current?.setWaypoint(null);
  };

  const tryPoliceCallAction = () => {
    const live = readPlayer();
    const call = live.policeCall;
    if (!call) return false;
    const pos = worldRef.current?.tilePosition ?? positionRef.current;
    if (!pos) return false;
    if (!nearPoliceCallObjective(call, pos.x, pos.y)) return false;
    const prompt = policeCallPrompt(call, { x: pos.x, y: pos.y });
    if (!prompt) return false;
    if (prompt.next === "completed") {
      const next = completePoliceCall(playState);
      if (typeof next === "string") {
        setPoliceNote(next);
        return true;
      }
      worldRef.current?.setPoliceIncident(null);
      worldRef.current?.setLostResidentEscort(null);
      worldRef.current?.setSuspiciousActivity(null);
      setPlayer(next);
      setPoliceNote(`${call.title} complete · ${formatDollars(call.reward)}`);
      setPolicePrompt(null);
      refreshPhoneChrome(next);
      return true;
    }
    const next = advancePoliceCall(prompt.next);
    if (typeof next === "string") {
      setPoliceNote(next);
      return true;
    }
    if (next.policeCall?.kind === "traffic_incident") {
      worldRef.current?.setPoliceIncident(next.policeCall.phase);
    }
    if (next.policeCall?.kind === "suspicious_activity") {
      worldRef.current?.setSuspiciousActivity(next.policeCall.phase);
    }
    if (next.policeCall?.kind === "lost_resident") {
      if (next.policeCall.phase === "resolving") {
        worldRef.current?.setLostResidentEscort("following", {
          name: next.policeCall.residentName,
        });
        setPoliceNote(
          `${next.policeCall.residentName ?? "Resident"} is following you home.`,
        );
        setWaypoint(readPhone().waypoint);
      } else {
        worldRef.current?.setLostResidentEscort("waiting", {
          name: next.policeCall.residentName,
        });
      }
    }
    setPlayer(next);
    setPoliceNote(prompt.label);
    return true;
  };

  const inside = interior !== null;
  const lodgingBuilding =
    interior?.kind === "lodging"
      ? (findLodging(state, interior.buildingId) ??
        (ownedHomeBuildingRef.current?.id === interior.buildingId
          ? ownedHomeBuildingRef.current
          : null))
      : null;
  const subwayBuilding =
    interior?.kind === "subway"
      ? findSubwayStation(state, interior.stationId)
      : null;
  const venueBuilding =
    interior?.kind === "venue" ? findVenue(state, interior.buildingId) : null;
  const busyUi =
    Boolean(characterMenu) ||
    Boolean(mallShop) ||
    Boolean(mallFurnish) ||
    Boolean(mallSnack) ||
    barMenu ||
    phoneOpen ||
    motorsOpen ||
    dustfallTrip ||
    sleeping ||
    atComputer ||
    atOfficeComputer ||
    pickingStop ||
    pickingRoom ||
    riding;
  /** Highway almost finished toward Dustfall — unlock desert overview exit. */
  const besideDesertCity =
    inDustfall ||
    (dustfallTrip && highwayToward === "dustfall" && dustfallProgress >= 0.88);

  useEffect(() => {
    if (riversideState?.id === "riverside")
      riversideStateRef.current = riversideState;
    if (state.id === "riverside") riversideStateRef.current = state;
    if (state.id === "dustfall") {
      dustfallCityRef.current = state;
      setInDustfall(true);
      setPlayState(state);
    }
  }, [state, riversideState]);

  useEffect(() => {
    if (!interior) return;
    // Hide street arrows indoors, but keep the phone / minimap pin so the
    // green destination is still there when you step back outside.
    worldRef.current?.setWaypoint(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interior]);

  useEffect(() => {
    characterMenuRef.current = characterMenu;
    mallShopRef.current = mallShop;
    mallFurnishRef.current = mallFurnish;
    mallSnackRef.current = mallSnack;
    barMenuRef.current = barMenu;
    phoneOpenRef.current = phoneOpen;
    motorsOpenRef.current = motorsOpen;
    drivingRef.current = driving;
  }, [
    characterMenu,
    mallShop,
    mallFurnish,
    mallSnack,
    barMenu,
    phoneOpen,
    motorsOpen,
    driving,
  ]);

  const openPhone = (threadId: string | null = null, startApp: PhoneApp = "home") => {
    if (sleepingRef.current) return;
    if (atComputerRef.current || atOfficeComputerRef.current) return;
    if (pickingStop || pickingRoom || riding) return;
    if (mallShopRef.current || mallFurnishRef.current || mallSnackRef.current)
      return;
    if (characterMenuRef.current) {
      characterMenuRef.current = null;
      setCharacterMenu(null);
    }
    if (barMenuRef.current) {
      barMenuRef.current = false;
      setBarMenu(false);
      setAtDesk(false);
    }
    setPhoneThread(threadId);
    setPhoneStartApp(threadId ? "thread" : startApp);
    phoneOpenRef.current = true;
    setPhoneOpen(true);
    if (document.pointerLockElement) document.exitPointerLock();
  };

  const closePhone = () => {
    phoneOpenRef.current = false;
    setPhoneOpen(false);
    setPhoneThread(null);
    setWaypoint(readPhone().waypoint);
    setUnread(phoneUnreadCount(state, readPlayer()));
  };

  const refreshPhoneChrome = (nextPlayer = readPlayer()) => {
    setWaypoint(readPhone().waypoint);
    setUnread(phoneUnreadCount(state, nextPlayer));
    const toast = pendingPhoneToast(state, nextPlayer);
    if (toast && !phoneOpenRef.current) setPhoneToast(toast);
    else if (!toast) setPhoneToast(null);
  };

  useEffect(() => {
    if (!active) return;
    setUnread(phoneUnreadCount(state, player));
    setWaypoint(readPhone().waypoint);
    if (phoneOpen) {
      setPhoneToast(null);
      return;
    }
    const toast = pendingPhoneToast(state, player);
    if (toast) {
      markPhoneToasted(toast.id);
      setPhoneToast(toast);
    }
  }, [active, state, player, phoneOpen]);

  useEffect(() => {
    const paused = busyUi;
    const apply = (controls?: { enabled: boolean; clearKeys: () => void }) => {
      if (!controls) return;
      controls.enabled = !paused;
      if (paused) controls.clearKeys();
    };
    apply(worldRef.current?.controls);
    apply(worldRef.current?.driveControls ?? undefined);
    apply(stadiumRef.current?.controls);
    apply(lodgingRef.current?.controls);
    apply(subwayRef.current?.controls);
    apply(venueRef.current?.controls);
    if (paused && document.pointerLockElement) document.exitPointerLock();
  }, [busyUi, interior]);

  useEffect(() => {
    const stats = characterStats(player.life);
    const outdoor = {
      walk: stats.walk,
      run: stats.run,
      jump: stats.jump,
      hop: stats.hop,
    };
    const indoor = { walk: stats.walk, run: stats.run, jump: stats.jump };
    if (worldRef.current) worldRef.current.controls.boost = outdoor;
    if (stadiumRef.current) stadiumRef.current.controls.boost = indoor;
    if (lodgingRef.current) lodgingRef.current.controls.boost = indoor;
    if (subwayRef.current) subwayRef.current.controls.boost = indoor;
    if (venueRef.current) venueRef.current.controls.boost = indoor;
    const held = player.life.held;
    const sips = player.life.heldSips ?? 0;
    if (!sippingRef.current) {
      worldRef.current?.setHeld(held, sips);
      stadiumRef.current?.setHeld(held, sips);
      lodgingRef.current?.setHeld(held, sips);
      subwayRef.current?.setHeld(held, sips);
      venueRef.current?.setHeld(held, sips);
    }
  }, [player, interior]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;
      if (event.code === "Escape") {
        if (motorsOpenRef.current) {
          event.preventDefault();
          motorsOpenRef.current = false;
          setMotorsOpen(false);
          return;
        }
        if (phoneOpenRef.current) {
          event.preventDefault();
          closePhone();
          return;
        }
        if (mallShopRef.current) {
          event.preventDefault();
          mallShopRef.current = null;
          setMallShop(null);
          return;
        }
        if (mallFurnishRef.current) {
          event.preventDefault();
          mallFurnishRef.current = null;
          setMallFurnish(null);
          return;
        }
        if (mallSnackRef.current) {
          event.preventDefault();
          mallSnackRef.current = null;
          setMallSnack(null);
          return;
        }
        if (characterMenuRef.current) {
          event.preventDefault();
          characterMenuRef.current = null;
          setCharacterMenu(null);
          return;
        }
        if (
          barMenuRef.current ||
          (interiorRef.current?.kind === "lodging" &&
            interiorRef.current.zone === "pool" &&
            atDeskRef.current)
        ) {
          event.preventDefault();
          barMenuRef.current = false;
          setBarMenu(false);
          setAtDesk(false);
          deskDismissedRef.current = true;
        }
        return;
      }
      if (event.code === "KeyM") {
        if (sleepingRef.current) return;
        if (atComputerRef.current || atOfficeComputerRef.current) return;
        if (pickingStop || pickingRoom || riding) return;
        if (
          mallShopRef.current ||
          mallFurnishRef.current ||
          mallSnackRef.current
        )
          return;
        event.preventDefault();
        if (phoneOpenRef.current) closePhone();
        else openPhone();
        return;
      }
      if (event.code === "KeyI") {
        if (sleepingRef.current) return;
        if (phoneOpenRef.current) return;
        if (atComputerRef.current || atOfficeComputerRef.current) return;
        if (pickingStop || pickingRoom || riding) return;
        if (
          mallShopRef.current ||
          mallFurnishRef.current ||
          mallSnackRef.current
        )
          return;
        event.preventDefault();
        const next = characterMenuRef.current ? null : "inventory";
        characterMenuRef.current = next;
        setCharacterMenu(next);
        return;
      }
      if (event.code === "KeyP") {
        if (sleepingRef.current) return;
        if (phoneOpenRef.current) return;
        if (atComputerRef.current || atOfficeComputerRef.current) return;
        if (pickingStop || pickingRoom || riding) return;
        if (
          mallShopRef.current ||
          mallFurnishRef.current ||
          mallSnackRef.current
        )
          return;
        const lodging = lodgingRef.current;
        const zone =
          interiorRef.current?.kind === "lodging"
            ? interiorRef.current.zone
            : null;
        // In a guest room: P beside the PlayStation toggles Nuketown on the TV.
        if (zone === "room" && lodging?.nearConsole()) {
          event.preventDefault();
          if (lodging.toggleNuketown()) {
            setNuketownOn(lodging.isNuketown());
          }
          return;
        }
        if (zone !== "pool") return;
        event.preventDefault();
        if (characterMenuRef.current) {
          characterMenuRef.current = null;
          setCharacterMenu(null);
        }
        if (barMenuRef.current || atDeskRef.current) {
          barMenuRef.current = false;
          setBarMenu(false);
          setAtDesk(false);
          deskDismissedRef.current = true;
        } else {
          barMenuRef.current = true;
          setBarMenu(true);
          setAtDesk(true);
          if (document.pointerLockElement) document.exitPointerLock();
        }
        return;
      }
      if (!characterMenuRef.current) return;
      if (event.code === "Digit1") {
        characterMenuRef.current = "outfit";
        setCharacterMenu("outfit");
      } else if (event.code === "Digit2") {
        characterMenuRef.current = "skills";
        setCharacterMenu("skills");
      } else if (event.code === "Digit3") {
        characterMenuRef.current = "inventory";
        setCharacterMenu("inventory");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, atDesk, pickingStop, pickingRoom, riding]);

  useEffect(() => {
    if (!active) return;
    const onDown = (event: globalThis.MouseEvent) => {
      if (event.button !== 0) return;
      if (!document.pointerLockElement) return;
      if (
        sleepingRef.current ||
        characterMenuRef.current ||
        mallShopRef.current ||
        mallFurnishRef.current ||
        mallSnackRef.current ||
        phoneOpenRef.current
      )
        return;
      if (
        atComputerRef.current ||
        atOfficeComputerRef.current ||
        atDeskRef.current
      )
        return;
      const item = consumableById(heldRef.current ?? "");
      if (!item) return;
      if (sippingRef.current) return;
      sippingRef.current = true;
      worldRef.current?.playSip();
      stadiumRef.current?.playSip();
      lodgingRef.current?.playSip();
      subwayRef.current?.playSip();
      venueRef.current?.playSip();
      const result = consumeHeld();
      window.clearTimeout(sipTimerRef.current);
      sipTimerRef.current = window.setTimeout(() => {
        sippingRef.current = false;
        if (typeof result !== "string") setPlayer(result);
      }, 720);
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.clearTimeout(sipTimerRef.current);
    };
  }, [active]);

  useEffect(() => {
    const canvas = outdoorCanvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let world: StreetWorld;
    try {
      world = new StreetWorld(canvas, playState);
    } catch (error) {
      setFailed(
        error instanceof Error
          ? error.message
          : "WebGL is unavailable in this browser.",
      );
      return;
    }

    worldRef.current = world;
    if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);
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
  }, [playState]);

  useEffect(() => {
    if (!active || interior) return;
    const canvas = outdoorCanvasRef.current;
    const wrap = wrapRef.current;
    const world = worldRef.current;
    if (!canvas || !wrap || !world) return;

    world.spawnNear(spawn.x, spawn.y);
    world.setMoveMode(mode);
    if (!inDustfall) {
      const snapped = snapFleetToMotorsApproach(readPlayer());
      writePlayer(snapped);
      setPlayer(snapped);
    }
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      world.resize(rect.width, rect.height);
    };
    resize();

    const inputProxy = {
      look: (dx: number, dy: number) => world.inputTarget.look(dx, dy),
      keyDown: (event: KeyboardEvent) => world.inputTarget.keyDown(event),
      keyUp: (event: KeyboardEvent) => world.inputTarget.keyUp(event),
      // Don't wipe throttle when the cursor unlocks mid-drive.
      clearKeys: () => {
        if (world.isDriving) return;
        world.inputTarget.clearKeys();
      },
    };
    const enterStreetDoor = () => {
      const target = world.enterTarget();
      if (!target) return false;
      if (target.kind === "venue") {
        setInterior({ kind: "venue", buildingId: target.building.id });
        setPlayer(discoverPlace(target.building.id));
        return true;
      }
      if (target.kind === "lodging") {
        setInterior({
          kind: "lodging",
          buildingId: target.building.id,
          zone: "lobby",
        });
        setPlayer(discoverPlace(target.building.id));
        return true;
      }
      if (target.kind === "subway") {
        const id = subwayStationId(target.building);
        if (id) {
          setInterior({ kind: "subway", stationId: id });
          setPlayer(discoverPlace(`subway:${id}`));
        }
        return true;
      }
      if (target.kind === "stadium") {
        setInterior({ kind: "stadium" });
        setPlayer(discoverPlace("ravens-ballpark", 48));
        return true;
      }
      return false;
    };
    tryEnterStreetDoorRef.current = enterStreetDoor;

    const detachInput = attachPointerInput(canvas, inputProxy, {
      setLocked,
      consumeKey: (event) => {
        if (dustfallTripRef.current) return true;
        if (event.code !== "KeyE" && event.code !== "KeyF") return false;
        event.preventDefault();
        if (drivingRef.current) {
          if (event.code !== "KeyE") return false;
          const parked = world.stopDriving();
          const id = activeOwnedVehicle(readPlayer())?.id;
          if (parked && id) {
            const next = applyParkVehicle(
              readPlayer(),
              id,
              parked.x,
              parked.y,
              parked.yaw,
            );
            writePlayer(next);
            setPlayer(next);
          }
          drivingRef.current = false;
          setDriving(false);
          return true;
        }
        const car = world.nearOwnedCar(readPlayer().ownedVehicles);
        const doorNearby = Boolean(world.enterTarget());

        // F = drive when a car is in range (also when a building door competes for E).
        if (event.code === "KeyF") {
          if (!car) return false;
          world.startDriving(car);
          drivingRef.current = true;
          setDriving(true);
          setNearCar(null);
          return true;
        }

        // E = enter building when both are nearby; otherwise enter the car.
        if (car && !doorNearby) {
          world.startDriving(car);
          drivingRef.current = true;
          setDriving(true);
          setNearCar(null);
          return true;
        }
        if (
          world.nearHighwayRamp() &&
          !hasOwnedVehicle(readPlayer()) &&
          !drivingRef.current
        ) {
          setHighwayHint(
            "Too far to travel on foot. You'll need a car to continue.",
          );
          markMissionRamp();
          return true;
        }
        if (tryPoliceCallAction()) return true;
        return enterStreetDoor();
      },
    });

    let frame = 0;
    let last = performance.now();
    let clockAcc = 0;
    const loop = (now: number) => {
      if (dustfallTripRef.current) {
        frame = requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tickRef.current(dt);
      world.setPinnedSelection(selectedBuildingId?.current ?? null);
      world.setWaypoint(waypointRef.current);
      const live = readPlayer();
      const activeCar = activeOwnedVehicle(live);
      if (
        resumeDriveAfterDustfallRef.current &&
        activeCar &&
        !world.isDriving
      ) {
        resumeDriveAfterDustfallRef.current = false;
        world.startDriving(activeCar);
        drivingRef.current = true;
        setDriving(true);
      }
      world.syncOwnedCars(live.ownedVehicles, world.drivingVehicleId);
      if (world.isDriving && activeCar) {
        world.setDriveFuelEmpty(false);
        if (world.nearHighwayRamp()) markMissionRamp();
        if (
          !inDustfall &&
          world.atHighwayPortal() &&
          !dustfallTripRef.current
        ) {
          markMissionHighway();
          setHighwayToward("dustfall");
          dustfallTripRef.current = true;
          setDustfallTrip(true);
        } else if (
          inDustfall &&
          world.atReturnPortal() &&
          !dustfallTripRef.current
        ) {
          setHighwayToward("riverside");
          dustfallTripRef.current = true;
          setDustfallTrip(true);
        } else if (!inDustfall && world.nearHighwayRamp()) {
          setHighwayHint(
            "Highway 93 · keep driving north onto the ramp for Dustfall",
          );
        } else if (inDustfall && world.nearReturnBridge()) {
          setHighwayHint(
            "Riverside Bridge · keep driving south for Highway 93 back to Riverside",
          );
        } else {
          setHighwayHint(null);
        }
      } else {
        world.setDriveFuelEmpty(false);
      }
      if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);
      world.setPoliceDuty(Boolean(live.policeShift));
      if (live.policeCall && live.policeCall.kind === "traffic_incident") {
        world.setPoliceIncident(live.policeCall.phase);
      } else {
        world.setPoliceIncident(null);
      }
      if (live.policeCall && live.policeCall.kind === "suspicious_activity") {
        world.setSuspiciousActivity(live.policeCall.phase);
      } else {
        world.setSuspiciousActivity(null);
      }
      if (live.policeCall && live.policeCall.kind === "lost_resident") {
        const phase = live.policeCall.phase;
        if (phase === "accepted" || phase === "traveling" || phase === "arrived") {
          world.setLostResidentEscort("waiting", {
            name: live.policeCall.residentName,
          });
        } else if (phase === "resolving") {
          world.setLostResidentEscort("following", {
            name: live.policeCall.residentName,
          });
        } else {
          world.setLostResidentEscort(null);
        }
      } else {
        world.setLostResidentEscort(null);
      }
      {
        const pos = world.tilePosition;
        const arrived = syncPoliceCallArrival(pos.x, pos.y);
        if (arrived) setPlayer(arrived);
        const callNow = readPlayer().policeCall;
        const prompt = callNow ? policeCallPrompt(callNow, { x: pos.x, y: pos.y }) : null;
        const near =
          callNow &&
          nearPoliceCallObjective(callNow, pos.x, pos.y) &&
          (callNow.phase === "arrived" ||
            callNow.phase === "inspecting" ||
            callNow.phase === "placing_cones" ||
            callNow.phase === "clearing" ||
            callNow.phase === "resolving");
        setPolicePrompt(near && prompt ? prompt.label : null);
      }
      world.render(dt);
      positionRef.current = world.tilePosition;
      if (world.isDriving && activeCar) {
        const sped = world.driveMph();
        const next = applyDriveTick(
          live,
          activeCar.id,
          dt,
          sped / 2.15,
          world.tilePosition,
        );
        writePlayer(next);
        if (Math.random() < 0.02) setPlayer(next);
      }
      if (!world.isDriving) {
        const car = world.nearOwnedCar(live.ownedVehicles);
        setNearCar((prev) => (prev?.id === car?.id ? prev : car));
        if (world.nearHighwayRamp() && !hasOwnedVehicle(live)) {
          setHighwayHint(
            inDustfall
              ? "Too far to travel on foot. You'll need a car for the Riverside Bridge."
              : "Too far to travel on foot. You'll need a car to continue.",
          );
        } else if (!world.nearHighwayRamp()) {
          setHighwayHint(null);
        }
      }
      const pin = waypointRef.current;
      // Police dispatch pins stay on the minimap for the whole call; only
      // ground arrows fade once you reach the approach. Other waypoints clear.
      if (pin && world.arrivedAtWaypoint() && !live.policeCall) {
        clearNavWaypoint();
      }
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
        setClock(formatClock(playState));
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
  }, [active, interior, spawn.x, spawn.y, playState, inDustfall]);

  useEffect(() => {
    if (!active || !dustfallTrip) return;
    const canvas = dustfallCanvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const car = activeOwnedVehicle(readPlayer());
    const toward = highwayToward;
    let world: DustfallWorld;
    try {
      world = new DustfallWorld(canvas, car?.color ?? "#1f4d8c", toward);
    } catch (error) {
      setFailed(
        error instanceof Error
          ? error.message
          : "WebGL is unavailable in this browser.",
      );
      setDustfallTrip(false);
      return;
    }
    dustfallRef.current = world;
    worldRef.current?.stopDriving();
    setDriving(false);
    drivingRef.current = false;
    if (document.pointerLockElement) document.exitPointerLock();

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      world.resize(rect.width, rect.height);
    };
    resize();

    const detachInput = attachPointerInput(
      canvas,
      {
        look: (dx, dy) => world.look(dx, dy),
        keyDown: (event) => world.controls.keyDown(event),
        keyUp: (event) => world.controls.keyUp(event),
        clearKeys: () => world.controls.clearKeys(),
      },
      {
        setLocked,
        consumeKey: (event) => {
          if (event.code !== "KeyE") return false;
          event.preventDefault();
          world.requestExitVehicle();
          return true;
        },
      },
    );

    const landInRiverside = (opts: { keepDriving: boolean }) => {
      const live = readPlayer();
      const activeCar = activeOwnedVehicle(live);
      const rampX = 20;
      const rampY = 3.2;
      if (activeCar) {
        const parked = applyParkVehicle(live, activeCar.id, rampX, rampY, 0);
        writePlayer(parked);
        setPlayer(parked);
      }
      const riverside =
        riversideStateRef.current ?? (state.id === "riverside" ? state : null);
      resumeDriveAfterDustfallRef.current = opts.keepDriving;
      drivingRef.current = false;
      setDriving(false);
      setInDustfall(false);
      if (riverside) setPlayState(riverside);
      setDustfallTrip(false);
      dustfallTripRef.current = false;
      setSpawn({ x: rampX, y: rampY + (opts.keepDriving ? 0 : 0.8) });
      setHighwayHint(
        "Back in Riverside — Highway 93 is north if you want Dustfall again.",
      );
    };

    const landInDustfall = (opts: { keepDriving: boolean }) => {
      markMissionDustfall();
      if (!dustfallCityRef.current)
        dustfallCityRef.current = generateDustfall();
      const df = dustfallCityRef.current;
      const live = readPlayer();
      const activeCar = activeOwnedVehicle(live);
      if (activeCar) {
        const parked = applyParkVehicle(
          live,
          activeCar.id,
          DUSTFALL_ARRIVAL.x,
          DUSTFALL_ARRIVAL.y,
          DUSTFALL_ARRIVAL.yaw,
        );
        writePlayer(parked);
        setPlayer(parked);
      } else {
        setPlayer(readPlayer());
      }
      resumeDriveAfterDustfallRef.current = opts.keepDriving;
      drivingRef.current = false;
      setDriving(false);
      setInDustfall(true);
      setPlayState(df);
      setDustfallTrip(false);
      dustfallTripRef.current = false;
      setSpawn({ x: DUSTFALL_ARRIVAL.x, y: DUSTFALL_ARRIVAL.y });
      setHighwayHint(
        opts.keepDriving
          ? "Back in Dustfall — the Riverside Bridge is south."
          : "Welcome to Dustfall — the Riverside Bridge is south if you want to drive home.",
      );
      setClock(formatClock(df));
    };

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tickRef.current(dt * 0.35);
      const live = readPlayer();
      const activeCar = activeOwnedVehicle(live);
      world.render(dt);
      positionRef.current = world.tilePosition;
      if (activeCar) {
        writePlayer(applyDriveTick(live, activeCar.id, dt, world.mph() / 2.15));
      }
      setDustfallProgress(world.getProgress());

      if (world.wantsExitVehicle()) {
        if (toward === "riverside") landInDustfall({ keepDriving: false });
        else landInRiverside({ keepDriving: false });
        return;
      }
      if (world.wantsAbortTrip()) {
        if (toward === "riverside") landInDustfall({ keepDriving: true });
        else landInRiverside({ keepDriving: true });
        return;
      }
      if (world.hasArrived()) {
        if (toward === "riverside") landInRiverside({ keepDriving: true });
        else landInDustfall({ keepDriving: true });
        return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      detachInput();
      dustfallRef.current = null;
      world.dispose();
    };
  }, [active, dustfallTrip, highwayToward, state]);

  useEffect(() => {
    if (!active || interior?.kind !== "stadium") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let world: StadiumWorld;
    try {
      world = new StadiumWorld(canvas, state);
    } catch (error) {
      setFailed(
        error instanceof Error
          ? error.message
          : "WebGL is unavailable in this browser.",
      );
      setInterior(null);
      return;
    }
    stadiumRef.current = world;
    if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);

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
    setPlayer(discoverPlace("ravens-ballpark", 48));
    if (isGameNight(state)) {
      awardXp(
        28,
        `game:${state.clock.year}-${state.clock.dayOfYear}`,
        "exploration",
      );
      setPlayer(readPlayer());
    }
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
      if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);
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
    const city =
      interior.zone === "room" ? (street?.borrowCity() ?? null) : null;
    let world: LodgingWorld;
    try {
      world = new LodgingWorld(
        canvas,
        state,
        building,
        interior.zone,
        interior.roomId,
      );
      if (city) {
        world.attachCity(
          city,
          findLodgingRoom(building, interior.roomId)?.floor ?? 8,
        );
      }
    } catch (error) {
      if (city) street?.returnCity(city);
      setFailed(
        error instanceof Error
          ? error.message
          : "WebGL is unavailable in this browser.",
      );
      setInterior(null);
      return;
    }
    lodgingRef.current = world;
    if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);
    setHasKey(
      hasLodgingKey(building.id) || lodgingUse(building) === "residences",
    );
    setPlayer(discoverPlace(building.id, 40));
    barMenuRef.current = false;
    setBarMenu(false);
    setAtDesk(false);
    setAtComputer(false);
    setAimComputer(false);
    setPickingRoom(false);
    setAtBed(false);
    setAtSlider(false);
    setAtConsole(false);
    setNuketownOn(false);
    setSliderOpen(false);
    setSleeping(false);
    setSleepPhase("night");
    setSleepInterest(0);
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
      if (ownedHomeBuildingRef.current?.id === building.id) {
        ownedHomeBuildingRef.current = null;
        const mall = [...state.buildings.values()].find(
          (b) => venueRole(b) === "mall",
        );
        setSpawn(mall ? venueGateTile(mall) : entry);
      } else {
        setSpawn(lodgingGateTile(building));
      }
      setInterior(null);
      setAtDesk(false);
    };
    const timers: number[] = [];
    const beginSleep = () => {
      if (
        sleepingRef.current ||
        interior.zone !== "room" ||
        !canSleepNow(state)
      )
        return;
      sleepingRef.current = true;
      setSleeping(true);
      setSleepPhase("night");
      world.controls.enabled = false;
      world.controls.clearKeys();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      timers.push(
        window.setTimeout(() => {
          const night = sleepUntilMorning(state);
          setClock(formatClock(state));
          setPlayer(night.player ?? readPlayer());
          setSleepInterest(night.interest);
          awardXp(
            20,
            `sleep:${state.clock.year}-${state.clock.dayOfYear}`,
            "athletics",
          );
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
        if (atComputerRef.current) return true;
        if (event.code !== "KeyE") return false;
        event.preventDefault();
        if (sleepingRef.current) return true;
        if (interior.zone === "room" && world.nearSlider()) {
          world.toggleSlider();
          setSliderOpen(world.sliderOpen());
          return true;
        }
        if (interior.zone === "room" && world.nearBed() && canSleepNow(state)) {
          beginSleep();
          return true;
        }
        if (
          interior.zone === "room" &&
          (world.aimedAtComputer() || world.nearComputer())
        ) {
          atComputerRef.current = true;
          setAtComputer(true);
          if (document.pointerLockElement === canvas)
            document.exitPointerLock();
          return true;
        }
        if (interior.zone === "pool" && world.nearDesk()) {
          return true;
        }
        if (interior.zone !== "lobby") {
          setInterior({
            kind: "lodging",
            buildingId: building.id,
            zone: "lobby",
            roomId: interior.roomId,
          });
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
      if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);
      world.render(dt);
      worldRef.current?.tickFireworks(dt);
      const desk =
        interior.zone === "lobby"
          ? world.nearDesk()
          : interior.zone === "pool"
            ? barMenuRef.current ||
              (world.nearDesk() && !deskDismissedRef.current)
            : false;
      if (interior.zone === "pool" && !world.nearDesk())
        deskDismissedRef.current = false;
      atDeskRef.current = desk;
      setAtDesk((prev) => (prev === desk ? prev : desk));
      if (desk && document.pointerLockElement === canvas)
        document.exitPointerLock();
      const bed =
        interior.zone === "room" && !atComputerRef.current && world.nearBed();
      setAtBed((prev) => (prev === bed ? prev : bed));
      const slider =
        interior.zone === "room" &&
        !atComputerRef.current &&
        world.nearSlider();
      setAtSlider((prev) => (prev === slider ? prev : slider));
      setSliderOpen(world.sliderOpen());
      const consoleNear =
        interior.zone === "room" &&
        !atComputerRef.current &&
        world.nearConsole();
      setAtConsole((prev) => (prev === consoleNear ? prev : consoleNear));
      setNuketownOn(world.isNuketown());
      const aiming =
        interior.zone === "room" &&
        !atComputerRef.current &&
        !sleepingRef.current &&
        world.aimedAtComputer();
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

    const street = worldRef.current;
    const city =
      venueRole(building) === "mall" ? (street?.borrowCity() ?? null) : null;
    let world: VenueWorld;
    try {
      world = new VenueWorld(canvas, state, building);
      if (city) world.attachCity(city);
    } catch (error) {
      if (city) street?.returnCity(city);
      setFailed(
        error instanceof Error
          ? error.message
          : "WebGL is unavailable in this browser.",
      );
      setInterior(null);
      return;
    }
    venueRef.current = world;
    if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);
    setAtDesk(false);
    deskDismissedRef.current = false;
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
      mallShopRef.current = null;
      mallFurnishRef.current = null;
      mallSnackRef.current = null;
      setMallShop(null);
      setMallFurnish(null);
      setMallStore(null);
      setMallFurnishNear(null);
      setMallHut(null);
      setMallSnack(null);
    };
    setPlayer(
      discoverPlace(building.id, venueRole(building) === "mall" ? 52 : 36),
    );
    const detachInput = attachPointerInput(canvas, world.controls, {
      setLocked,
      consumeKey: (event) => {
        if (atOfficeComputerRef.current) return true;
        if (event.code !== "KeyE") return false;
        event.preventDefault();
        if (
          characterMenuRef.current ||
          mallShopRef.current ||
          mallFurnishRef.current ||
          mallSnackRef.current
        )
          return true;
        if (world.nearExit()) leaveStreet();
        else {
          const hut = world.nearSnack();
          if (hut) {
            const menu = { name: hut.name, items: hut.items };
            mallSnackRef.current = menu;
            setMallSnack(menu);
            if (document.pointerLockElement === canvas)
              document.exitPointerLock();
          } else {
            const furnish = world.nearFurnish();
            if (furnish) {
              mallFurnishRef.current = furnish;
              setMallFurnish(furnish);
              if (document.pointerLockElement === canvas)
                document.exitPointerLock();
            } else {
              const store = world.nearStore();
              if (store) {
                mallShopRef.current = store;
                setMallShop(store);
                if (document.pointerLockElement === canvas)
                  document.exitPointerLock();
              }
            }
          }
        }
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
      if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);
      world.setPoliceDuty(Boolean(readPlayer().policeShift));
      world.render(dt);
      const desk = world.nearDesk();
      if (!desk) deskDismissedRef.current = false;
      const showDesk =
        desk &&
        !deskDismissedRef.current &&
        !mallShopRef.current &&
        !mallFurnishRef.current &&
        !mallSnackRef.current &&
        !characterMenuRef.current;
      atDeskRef.current = showDesk;
      setAtDesk((prev) => (prev === showDesk ? prev : showDesk));
      if (showDesk && document.pointerLockElement === canvas)
        document.exitPointerLock();
      const store = world.nearStore();
      setMallStore((prev) => (prev === store ? prev : store));
      const furnish = world.nearFurnish();
      setMallFurnishNear((prev) => (prev === furnish ? prev : furnish));
      const hut = world.nearSnack();
      setMallHut((prev) =>
        prev === (hut?.name ?? null) ? prev : (hut?.name ?? null),
      );
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
      const borrowed = world.detachCity();
      if (borrowed) worldRef.current?.returnCity(borrowed);
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
      world = new SubwayWorld(
        canvas,
        state,
        interior.stationId,
        Boolean(interior.arrived),
      );
    } catch (error) {
      setFailed(
        error instanceof Error
          ? error.message
          : "WebGL is unavailable in this browser.",
      );
      setInterior(null);
      return;
    }
    subwayRef.current = world;
    if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);
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
          if (document.pointerLockElement === canvas)
            document.exitPointerLock();
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
      if (!sippingRef.current) world.setHeld(heldRef.current, sipsRef.current);
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
    if (
      atDesk ||
      atComputer ||
      pickingStop ||
      riding ||
      pickingRoom ||
      sleeping ||
      atOfficeComputer ||
      characterMenu ||
      mallShop ||
      mallFurnish ||
      mallSnack ||
      phoneOpen
    )
      return;
    const canvas = inside ? canvasRef.current : outdoorCanvasRef.current;
    if (!canvas) return;
    void canvas.requestPointerLock();
  };

  const onCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (
      atDesk ||
      atComputer ||
      pickingStop ||
      riding ||
      pickingRoom ||
      sleeping ||
      atOfficeComputer ||
      characterMenu ||
      mallShop ||
      mallFurnish ||
      mallSnack ||
      phoneOpen
    )
      return;

    // Outdoor street: click the white-highlighted building to walk in.
    if (!inside && !dustfallTrip && !driving) {
      const outdoor = outdoorCanvasRef.current;
      if (outdoor && document.pointerLockElement === outdoor) {
        if (tryEnterStreetDoorRef.current()) return;
      }
    }

    const canvas = canvasRef.current;
    const world = lodgingRef.current;
    if (
      canvas &&
      world &&
      interior?.kind === "lodging" &&
      interior.zone === "room"
    ) {
      const rect = canvas.getBoundingClientRect();
      const lockedNow = document.pointerLockElement === canvas;
      const ndcX = lockedNow
        ? 0
        : ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = lockedNow
        ? 0
        : -(((event.clientY - rect.top) / rect.height) * 2 - 1);
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

  const stayRoomId =
    interior?.kind === "lodging"
      ? (interior.roomId ??
        (lodgingBuilding ? findLodgingRoom(lodgingBuilding)?.id : null) ??
        null)
      : null;
  const stayRoom = lodgingBuilding
    ? findLodgingRoom(lodgingBuilding, stayRoomId)
    : null;
  const hotelStay = lodgingBuilding
    ? lodgingUse(lodgingBuilding) === "hotel"
    : false;
  const stayLabel = stayRoom
    ? `${hotelStay ? "Room" : "Apt"} ${stayRoom.label}`
    : hotelStay
      ? "your room"
      : "your apartment";

  const goLodgingZone = (
    zone: LodgingZone,
    roomId: string | null = stayRoomId,
  ) => {
    if (interior?.kind !== "lodging") return;
    if (zone === "room" && !roomId) {
      setPickingRoom(true);
      return;
    }
    setPickingRoom(false);
    if (document.pointerLockElement) document.exitPointerLock();
    setInterior({
      kind: "lodging",
      buildingId: interior.buildingId,
      zone,
      roomId: roomId ?? undefined,
    });
  };

  const enterLodgingRoom = (room: LodgingRoom) => {
    if (!lodgingBuilding) return;
    const hotelStay = lodgingUse(lodgingBuilding) === "hotel";
    if (!canEnterLodgingRoom(lodgingBuilding.id, room, hotelStay, hasKey))
      return;
    if (
      interior?.kind === "lodging" &&
      interior.zone === "room" &&
      interior.roomId === room.id
    ) {
      setPickingRoom(false);
      return;
    }
    grantLodgingKey(lodgingBuilding.id, room.id);
    setHasKey(true);
    setPickingRoom(false);
    setInterior({
      kind: "lodging",
      buildingId: lodgingBuilding.id,
      zone: "room",
      roomId: room.id,
    });
  };

  const currentRoom =
    lodgingBuilding && interior?.kind === "lodging" && interior.zone === "room"
      ? findLodgingRoom(lodgingBuilding, interior.roomId)
      : null;

  const ballclub = ballclubFor(state);
  const stadiumBuilding = findStadium(state);
  const doorNearby = Boolean(venueDoor || lodgingDoor || subwayDoor || atGate);
  const carAndDoorChoice = Boolean(
    nearCar && doorNearby && !driving && !inside && !failed && !dustfallTrip,
  );
  const doorChoiceLabel = lodgingDoor
    ? lodgingDoor.name
    : subwayDoor
      ? subwayDoor.name
      : atGate
        ? (stadiumBuilding?.name ?? ballclub.parkName)
        : venueDoor
          ? venueDoor.name
          : "Building";
  const doorChoiceKind = lodgingDoor
    ? lodgingUse(lodgingDoor) === "hotel"
      ? "Hotel"
      : "Residences"
    : subwayDoor
      ? "Subway"
      : atGate
        ? "Stadium"
        : venueDoor
          ? (() => {
              const role = venueRole(venueDoor);
              return role ? venueLabel(role) : "Building";
            })()
          : "Enter";

  const placeName =
    interior?.kind === "stadium"
      ? (stadiumBuilding?.name ?? ballclub.parkName)
      : lodgingBuilding
        ? interior?.kind === "lodging" && interior.zone === "pool"
          ? `${lodgingBuilding.name} · Pool`
          : currentRoom
            ? `${lodgingBuilding.name} · ${hotelStay ? "Room" : "Apt"} ${currentRoom.label}`
            : lodgingBuilding.name
        : venueBuilding
          ? venueBuilding.name
          : (subwayBuilding?.name ??
            (interior?.kind === "subway"
              ? stationDef(interior.stationId).name
              : "Street level"));

  const lastFinal =
    interior?.kind === "stadium" || atGate ? stadiumFinal(state) : null;
  const lastWinner = lastFinal ? stadiumWinner(lastFinal, ballclub) : null;

  return (
    <div ref={wrapRef} className="absolute inset-0 z-30 bg-[#0b1420]">
      <canvas
        ref={outdoorCanvasRef}
        className={`absolute inset-0 h-full w-full ${inside || dustfallTrip ? "invisible pointer-events-none" : ""}`}
        onClick={onCanvasClick}
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${inside && !dustfallTrip ? "" : "invisible pointer-events-none"}`}
        onClick={onCanvasClick}
      />
      <canvas
        ref={dustfallCanvasRef}
        className={`absolute inset-0 h-full w-full ${dustfallTrip ? "" : "invisible pointer-events-none"}`}
        onClick={(event) => {
          const canvas = dustfallCanvasRef.current;
          if (!canvas) return;
          if (document.pointerLockElement !== canvas)
            canvas.requestPointerLock();
          event.preventDefault();
        }}
      />

      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-[#0b1420] p-6 text-center">
          <div className="max-w-sm">
            <p className="text-lg font-semibold text-white">
              Street view unavailable
            </p>
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
              {inside ? placeName : inDustfall ? "Dustfall" : "Street level"}
            </p>
            <p className="text-sm font-medium text-white">
              {clock.day} · {clock.date} · {clock.time}
            </p>
            <p className="text-[0.7rem] text-sky-100/80">
              {weatherEmoji(playState.weather.kind)} {playState.weather.tempF}°{" "}
              {playState.weather.label}
              {playState.events[0]
                ? ` · ${playState.events[0].icon} ${playState.events[0].headline}`
                : ""}
            </p>
          </div>
          <div className="pointer-events-auto">
            <PlayerStatus player={player} />
          </div>
          {onPoliceDuty(player) ? (
            <div className="pointer-events-auto rounded-xl border border-sky-400/30 bg-[#0e1520]/9 px-3.5 py-2 text-sky-50 backdrop-blur">
              <p className="text-[0.6rem] uppercase tracking-[0.2em] text-sky-300">
                {playState.id === "dustfall" ? "Dustfall Police" : "Riverside Police"}
              </p>
              <p className="text-sm font-semibold">
                {policeRank(player.policeCareer?.xp ?? 0).label}
              </p>
              <p className="text-[0.7rem] text-sky-100/85">
                Calls {player.policeShift?.callsCompleted ?? 0} · Earnings{" "}
                {formatDollars(player.policeShift?.earnings ?? 0)}
              </p>
              {player.policeCall ? (
                <p className="mt-1 text-[0.7rem] text-amber-100">
                  Active · {player.policeCall.title} ·{" "}
                  {player.policeCall.phase.replaceAll("_", " ")}
                </p>
              ) : (
                <p className="mt-1 text-[0.7rem] text-white/55">No active call · open Police on phone</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {!inside && !driving && !dustfallTrip ? (
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
          ) : driving || dustfallTrip ? (
            <div className="rounded-xl border border-sky-300/30 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 backdrop-blur">
              Driving
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
                    const dest =
                      subwayRef.current?.rideDestination() ??
                      interior.stationId;
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
                {interior?.kind === "stadium"
                  ? "Leave stadium"
                  : "Leave building"}
              </button>
              {interior?.kind === "lodging" && interior.zone === "room" ? (
                <>
                  <button
                    onClick={() => goLodgingZone("pool")}
                    className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    Roof deck pool
                  </button>
                  <button
                    onClick={() => {
                      setPickingRoom(true);
                      if (document.pointerLockElement)
                        document.exitPointerLock();
                    }}
                    className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    Switch rooms
                  </button>
                </>
              ) : null}
              {interior?.kind === "lodging" &&
              interior.zone === "pool" &&
              stayRoom ? (
                <button
                  onClick={() => goLodgingZone("room", stayRoom.id)}
                  className="rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-semibold text-[#1a1206] backdrop-blur"
                >
                  Back to {stayLabel}
                </button>
              ) : null}
            </>
          )}

          <button
            onClick={() => {
              if (besideDesertCity && onEnterDesertCity) onEnterDesertCity();
              else onExit();
            }}
            className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            {besideDesertCity ? "✕ Exit to desert city" : "✕ Exit to city view"}
          </button>
        </div>
      </div>

      {locked && !failed ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-1.5 w-1.5 rounded-full bg-white/70 shadow" />
        </div>
      ) : null}

      {!locked &&
      !failed &&
      !atDesk &&
      !atComputer &&
      !pickingStop &&
      !riding &&
      !pickingRoom &&
      !sleeping &&
      !atOfficeComputer &&
      !characterMenu &&
      !mallShop &&
      !mallFurnish &&
      !mallSnack &&
      !phoneOpen &&
      !motorsOpen ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
          <div className="max-w-xs rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-center backdrop-blur">
            {driving || dustfallTrip ? (
              <>
                <p className="text-xs font-semibold text-white">
                  Click the view, then drive
                </p>
                <p className="mt-0.5 text-[0.65rem] leading-snug text-slate-300">
                  <span className="font-medium text-white">W</span> gas ·{" "}
                  <span className="font-medium text-white">S</span> brake /
                  reverse · <span className="font-medium text-white">A</span>/
                  <span className="font-medium text-white">D</span> steer ·{" "}
                  <span className="font-medium text-white">Space</span>{" "}
                  handbrake ·{" "}
                  <span className="font-medium text-white">Mouse</span> look ·{" "}
                  <span className="font-medium text-white">E</span> exit
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-white">
                  Click to look around
                </p>
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
                <p className="mt-0.5 text-[0.6rem] text-slate-400">
                  Esc releases the cursor · I inventory · M phone
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}

      {locked && !failed ? (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[0.68rem] leading-relaxed text-slate-300 backdrop-blur">
          {driving || dustfallTrip ? (
            <>
              <span className="font-semibold text-white">W</span> gas ·{" "}
              <span className="font-semibold text-white">S</span> brake/reverse
              · <span className="font-semibold text-white">A</span>/
              <span className="font-semibold text-white">D</span> steer ·{" "}
              <span className="font-semibold text-white">Space</span> handbrake
              · <span className="font-semibold text-white">E</span> exit
            </>
          ) : mode === "hop" && !inside ? (
            <>
              <span className="font-semibold text-white">W</span>/
              <span className="font-semibold text-white">S</span> next
              intersection ·{" "}
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
              <span className="font-semibold text-white">E</span>/
              <span className="font-semibold text-white">Click</span>{" "}
              {inside ? "leave" : "enter"} ·{" "}
              <span className="font-semibold text-white">I</span> inventory ·{" "}
              <span className="font-semibold text-white">M</span> phone
            </>
          )}
        </div>
      ) : null}

      {driving && !dustfallTrip && !failed ? (
        <div className="pointer-events-none absolute left-4 top-24 z-10">
          <div className="min-w-[12rem] rounded-xl border border-white/15 bg-black/55 px-3 py-2 backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-sky-200">
              {activeOwnedVehicle(player)?.model ?? "Vehicle"}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {worldRef.current?.driveMph() ?? 0}{" "}
              <span className="text-sm font-medium text-white/50">MPH</span>
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Condition {Math.round(activeOwnedVehicle(player)?.condition ?? 0)}
              %
            </p>
            <p className="mt-1 text-[0.65rem] text-slate-400">
              W gas · S brake · A/D steer · Space handbrake · Shift boost
            </p>
            <p className="mt-0.5 text-[0.65rem] text-slate-500">
              E exit vehicle · Mouse look
            </p>
          </div>
        </div>
      ) : null}

      {dustfallTrip && !failed ? (
        <div className="pointer-events-none absolute left-4 top-24 z-10">
          <div className="min-w-[12rem] rounded-xl border border-amber-300/30 bg-black/55 px-3 py-2 backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-amber-200">
              Highway 93
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {highwayToward === "riverside"
                ? "Toward Riverside"
                : "Toward Dustfall"}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {Math.round(dustfallProgress * 100)}% of the drive
            </p>
            <p className="mt-1 text-[0.65rem] text-slate-400">
              {highwayToward === "riverside"
                ? dustfallProgress >= 0.88
                  ? "Riverside ahead"
                  : "S reverse → Dustfall · E exit"
                : dustfallProgress >= 0.88
                  ? "Dustfall ahead — Exit to desert city"
                  : "S reverse past the sign → Riverside · E exit"}
            </p>
          </div>
        </div>
      ) : null}

      {carAndDoorChoice && nearCar ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="min-w-[16rem] rounded-2xl border border-white/20 bg-black/80 px-5 py-4 shadow-2xl backdrop-blur">
            <p className="text-center text-[0.65rem] uppercase tracking-[0.28em] text-slate-400">
              Choose
            </p>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 py-2">
                <div className="min-w-0 text-left">
                  <p className="text-[0.6rem] uppercase tracking-[0.2em] text-amber-300">
                    {doorChoiceKind}
                  </p>
                  <p className="truncate text-sm font-semibold text-white">
                    {doorChoiceLabel}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-slate-300">
                  <span className="font-semibold text-white">Click</span>/
                  <span className="font-semibold text-white">E</span> enter
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-sky-300/35 bg-sky-400/10 px-3 py-2">
                <div className="min-w-0 text-left">
                  <p className="text-[0.6rem] uppercase tracking-[0.2em] text-sky-300">
                    Your vehicle
                  </p>
                  <p className="truncate text-sm font-semibold text-white">
                    {nearCar.model}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-slate-300">
                  <span className="font-semibold text-white">F</span> drive
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {nearCar &&
      !carAndDoorChoice &&
      !driving &&
      !inside &&
      !failed &&
      !dustfallTrip ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-2xl border border-sky-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-sky-300">
              Your vehicle
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {nearCar.model}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Press <span className="font-semibold text-white">E</span> or{" "}
              <span className="font-semibold text-white">F</span> to drive
            </p>
            <p className="mt-1 text-xs text-amber-200/90">
              {inDustfall
                ? "Drive south → Riverside Bridge → Highway 93 → Riverside"
                : "Drive north on this road → Highway 93 → Dustfall"}
            </p>
          </div>
        </div>
      ) : null}

      {highwayHint && !inside && !failed && !dustfallTrip ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="max-w-sm rounded-2xl border border-amber-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
              Highway 93
            </p>
            <p className="mt-1 text-sm text-slate-200">{highwayHint}</p>
          </div>
        </div>
      ) : null}

      {policePrompt && !inside && !failed && !phoneOpen && !highwayHint ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="max-w-sm rounded-2xl border border-sky-400/40 bg-[#0e1520]/9 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-sky-300">
              Police call
            </p>
            <p className="mt-1 text-sm text-white">
              Press <span className="font-semibold">E</span> · {policePrompt}
            </p>
            {policeNote ? (
              <p className="mt-1 text-xs text-sky-100/80">{policeNote}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {atGate && !carAndDoorChoice && !inside && !failed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-2xl border border-amber-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
              {stadiumBuilding?.name ?? ballclub.parkName}
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              Enter stadium
            </p>
            <p className="mt-1 text-sm text-slate-300">
              <span className="font-semibold text-white">Click</span> or{" "}
              <span className="font-semibold text-white">E</span>
            </p>
          </div>
        </div>
      ) : null}

      {lodgingDoor && !carAndDoorChoice && !inside && !failed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-2xl border border-amber-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
              {lodgingUse(lodgingDoor) === "hotel" ? "Hotel" : "Residences"}
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {lodgingDoor.name}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              <span className="font-semibold text-white">Click</span> or press{" "}
              <span className="font-semibold text-white">E</span> to enter the
              lobby
            </p>
          </div>
        </div>
      ) : null}

      {venueDoor &&
      !carAndDoorChoice &&
      !lodgingDoor &&
      !subwayDoor &&
      !atGate &&
      !inside &&
      !failed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-2xl border border-amber-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
              {(() => {
                const role = venueRole(venueDoor);
                return role ? venueLabel(role) : "Building";
              })()}
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {venueDoor.name}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              <span className="font-semibold text-white">Click</span> or press{" "}
              <span className="font-semibold text-white">E</span> to enter
              {venueRole(venueDoor) === "office"
                ? " · start work at the desk"
                : venueRole(venueDoor) === "mall"
                  ? " · shop the concourse"
                  : ""}
            </p>
          </div>
        </div>
      ) : null}

      {subwayDoor &&
      !carAndDoorChoice &&
      !lodgingDoor &&
      !atGate &&
      !inside &&
      !failed ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-2xl border border-amber-300/40 bg-black/75 px-6 py-4 text-center shadow-2xl backdrop-blur">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-amber-300">
              Subway
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {subwayDoor.name}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              <span className="font-semibold text-white">Click</span> or press{" "}
              <span className="font-semibold text-white">E</span> to go
              underground
            </p>
          </div>
        </div>
      ) : null}

      {interior?.kind === "stadium" || atGate ? (
        <div className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2">
          <div className="overflow-hidden rounded-xl border border-[#16325c] shadow-xl">
            <div
              className="bg-[#1f4d8c] px-5 py-2.5 text-center"
              style={{ backgroundColor: ballclub.accent }}
            >
              <p className="text-sm font-bold tracking-wide text-white">
                ⚾ {ballclub.fullName.toUpperCase()}
              </p>
              {lastFinal ? (
                <div className="mt-1.5 rounded-md bg-[#10233f] px-4 py-1.5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-300">
                    Final
                  </p>
                  <p className="text-sm font-bold text-white">
                    {ballclub.shortName} {lastFinal.ravens} –{" "}
                    {lastFinal.visitors} {ballclub.visitorShort}
                  </p>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-amber-200">
                    {lastWinner ? `${lastWinner} win` : "Game tied"}
                  </p>
                </div>
              ) : (
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-200">
                  {isGameNight(state)
                    ? `Live game · ${GAME_HOURS_LABEL}`
                    : `Open for tours · first pitch 6:00 PM`}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {atTrain && !pickingStop && !riding && interior?.kind === "subway" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-amber-300/40 bg-black/70 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Doors open · press{" "}
              <span className="font-semibold text-white">E</span> to board
            </p>
          </div>
        </div>
      ) : null}

      {atSubwayExit &&
      !atTrain &&
      !pickingStop &&
      !riding &&
      interior?.kind === "subway" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Press <span className="font-semibold text-white">E</span> to leave
              the station
            </p>
          </div>
        </div>
      ) : null}

      {interior?.kind === "subway" &&
      !atTrain &&
      !atSubwayExit &&
      !pickingStop &&
      !riding ? (
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
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-amber-300">
              Riverside Line
            </p>
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

      {atDesk &&
      venueBuilding &&
      interior?.kind === "venue" &&
      !atOfficeComputer ? (
        <VenueDesk
          building={venueBuilding}
          state={state}
          player={player}
          onPlayerChange={(next) => {
            setPlayer(next);
            worldRef.current?.setPoliceDuty(Boolean(next.policeShift));
            venueRef.current?.setPoliceDuty(Boolean(next.policeShift));
          }}
          onClose={() => {
            deskDismissedRef.current = true;
            setAtDesk(false);
          }}
          onOpenWorkstation={() => {
            atOfficeComputerRef.current = true;
            setAtOfficeComputer(true);
            setAtDesk(false);
          }}
          onOpenMotors={() => {
            setMotorsOpen(true);
            setAtDesk(false);
          }}
          onOpenDispatch={() => {
            setAtDesk(false);
            openPhone(null, "police");
          }}
        />
      ) : null}

      {motorsOpen ? (
        <MotorsShowroom
          player={player}
          clock={state.clock}
          onPlayer={(next) => {
            setPlayer(next);
          }}
          onClose={() => {
            motorsOpenRef.current = false;
            setMotorsOpen(false);
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

      {(atDesk || pickingRoom) &&
      lodgingBuilding &&
      interior?.kind === "lodging" &&
      (interior.zone === "lobby" || pickingRoom) ? (
        <LodgingDesk
          building={lodgingBuilding}
          hasKey={hasKey}
          currentRoomId={
            interior.zone === "room"
              ? (interior.roomId ?? currentRoom?.id)
              : findLodgingRoom(lodgingBuilding)?.id
          }
          onEnterRoom={enterLodgingRoom}
          onPool={() => goLodgingZone("pool", stayRoomId)}
          onClose={pickingRoom ? () => setPickingRoom(false) : undefined}
        />
      ) : null}

      {atDesk &&
      lodgingBuilding &&
      interior?.kind === "lodging" &&
      interior.zone === "pool" ? (
        <PoolBar
          clock={state.clock}
          player={player}
          onPlayerChange={setPlayer}
          onClose={() => {
            barMenuRef.current = false;
            setBarMenu(false);
            setAtDesk(false);
            deskDismissedRef.current = true;
          }}
          onInventory={() => {
            barMenuRef.current = false;
            setBarMenu(false);
            setAtDesk(false);
            deskDismissedRef.current = true;
            characterMenuRef.current = "inventory";
            setCharacterMenu("inventory");
          }}
        />
      ) : null}

      {atComputer &&
      interior?.kind === "lodging" &&
      interior.zone === "room" ? (
        <RoomComputer
          minuteOfDay={state.clock.minuteOfDay}
          onClose={() => {
            atComputerRef.current = false;
            setAtComputer(false);
          }}
        />
      ) : null}

      {aimComputer &&
      !atComputer &&
      interior?.kind === "lodging" &&
      interior.zone === "room" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-sky-300/40 bg-black/70 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Press <span className="font-semibold text-white">E</span> to use
              the computer
            </p>
          </div>
        </div>
      ) : null}

      {atConsole &&
      !sleeping &&
      !atComputer &&
      interior?.kind === "lodging" &&
      interior.zone === "room" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-sky-300/40 bg-black/70 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Press <span className="font-semibold text-white">P</span> to{" "}
              {nuketownOn ? "return to TV" : "play Nuketown"}
            </p>
          </div>
        </div>
      ) : null}

      {atSlider &&
      !atBed &&
      !atConsole &&
      !sleeping &&
      !atComputer &&
      interior?.kind === "lodging" &&
      interior.zone === "room" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-sky-300/40 bg-black/70 px-4 py-2 text-center backdrop-blur">
            <p className="text-xs text-slate-200">
              Press <span className="font-semibold text-white">E</span> to{" "}
              {sliderOpen ? "close" : "open"} the door
            </p>
          </div>
        </div>
      ) : null}

      {atBed &&
      !sleeping &&
      !atComputer &&
      interior?.kind === "lodging" &&
      interior.zone === "room" ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-amber-300/40 bg-black/70 px-4 py-2 text-center backdrop-blur">
            {canSleepNow(state) ? (
              <p className="text-xs text-slate-200">
                Press <span className="font-semibold text-white">E</span> to
                sleep until 8:00 AM
              </p>
            ) : (
              <p className="text-xs text-slate-200">
                You can turn in after 10:00 PM
              </p>
            )}
          </div>
        </div>
      ) : null}

      {interior?.kind === "venue" &&
      !atDesk &&
      !atOfficeComputer &&
      !mallShop &&
      !mallFurnish &&
      !mallSnack &&
      !characterMenu ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-2 text-center backdrop-blur">
            {mallHut ? (
              <p className="text-xs text-slate-200">
                {mallHut} · press{" "}
                <span className="font-semibold text-white">E</span> to order
              </p>
            ) : mallFurnishNear ? (
              <p className="text-xs text-slate-200">
                {
                  FURNISH_STORES.find((item) => item.id === mallFurnishNear)
                    ?.name
                }{" "}
                · press <span className="font-semibold text-white">E</span> to
                browse
              </p>
            ) : mallStore ? (
              <p className="text-xs text-slate-200">
                {STORES.find((item) => item.id === mallStore)?.name} · press{" "}
                <span className="font-semibold text-white">E</span> to browse
              </p>
            ) : venueBuilding && venueRole(venueBuilding) === "mall" ? (
              <p className="text-xs text-slate-200">
                Walk the concourse into a store · ride the escalators · press{" "}
                <span className="font-semibold text-white">E</span> at the doors
                to leave
              </p>
            ) : (
              <p className="text-xs text-slate-200">
                Walk to the desk · press{" "}
                <span className="font-semibold text-white">E</span> at the doors
                to leave
              </p>
            )}
          </div>
        </div>
      ) : null}

      {interior?.kind === "lodging" &&
      interior.zone !== "lobby" &&
      !atComputer &&
      !aimComputer &&
      !pickingRoom &&
      !sleeping &&
      !atBed &&
      !atSlider &&
      !atConsole &&
      !atDesk ? (
        <div className="pointer-events-auto absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <div className="flex flex-col items-center gap-2">
            {interior.zone === "room" ? (
              <button
                type="button"
                onClick={() => goLodgingZone("pool")}
                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#1a1206] shadow-2xl"
              >
                Go to the roof deck pool
              </button>
            ) : stayRoom ? (
              <button
                type="button"
                onClick={() => goLodgingZone("room", stayRoom.id)}
                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#1a1206] shadow-2xl"
              >
                Back to {stayLabel}
              </button>
            ) : null}
            <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-2 text-center backdrop-blur">
              <p className="text-xs text-slate-200">
                {interior.zone === "pool" ? (
                  <>
                    {player.life.held
                      ? `Holding ${consumableById(player.life.held)?.name ?? "a snack"}${
                          consumableById(player.life.held)?.kind === "drink"
                            ? " · click to drink"
                            : " · click to eat"
                        } · `
                      : null}
                    press <span className="font-semibold text-white">P</span>{" "}
                    for the cabana ·{" "}
                    <span className="font-semibold text-white">E</span> for the
                    lobby
                  </>
                ) : (
                  <>
                    Press <span className="font-semibold text-white">E</span> to
                    return to the lobby
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {mallSnack && venueBuilding && interior?.kind === "venue" ? (
        <PoolBar
          clock={state.clock}
          player={player}
          onPlayerChange={setPlayer}
          eyebrow="Harbor Mall"
          title={mallSnack.name}
          blurb="Tap an item to buy it. Hamburgers, hot dogs, nachos, pizza, fries, and drinks go in your bag and into your hand."
          source={mallSnack.name}
          itemIds={mallSnack.items}
          closeHint="Esc to close"
          onClose={() => {
            mallSnackRef.current = null;
            setMallSnack(null);
          }}
          onInventory={() => {
            mallSnackRef.current = null;
            setMallSnack(null);
            characterMenuRef.current = "inventory";
            setCharacterMenu("inventory");
          }}
        />
      ) : null}

      {mallShop && venueBuilding && interior?.kind === "venue" ? (
        <ClothingShop
          store={mallShop}
          player={player}
          clock={state.clock}
          onPlayer={setPlayer}
          onClose={() => {
            mallShopRef.current = null;
            setMallShop(null);
          }}
        />
      ) : null}

      {mallFurnish && venueBuilding && interior?.kind === "venue" ? (
        <FurnitureShop
          store={mallFurnish}
          player={player}
          clock={state.clock}
          onPlayer={setPlayer}
          onClose={() => {
            mallFurnishRef.current = null;
            setMallFurnish(null);
          }}
          onVisitHome={(homeId) => {
            const home = player.ownedHomes.find((item) => item.id === homeId);
            if (!home) return;
            const fake = makeOwnedHomeBuilding(home);
            ownedHomeBuildingRef.current = fake;
            mallFurnishRef.current = null;
            setMallFurnish(null);
            setInterior({
              kind: "lodging",
              buildingId: fake.id,
              zone: "room",
              roomId: "2-2A",
            });
          }}
        />
      ) : null}

      {characterMenu ? (
        <CharacterMenu
          player={player}
          tab={characterMenu}
          onTab={(tab) => {
            characterMenuRef.current = tab;
            setCharacterMenu(tab);
          }}
          onPlayer={setPlayer}
          onClose={() => {
            characterMenuRef.current = null;
            setCharacterMenu(null);
          }}
        />
      ) : null}

      {phoneOpen ? (
        <PlayerPhone
          state={state}
          player={player}
          onPlayer={(next) => {
            setPlayer(next);
            worldRef.current?.setPoliceDuty(Boolean(next.policeShift));
            venueRef.current?.setPoliceDuty(Boolean(next.policeShift));
            if (next.policeCall?.kind === "traffic_incident") {
              worldRef.current?.setPoliceIncident(next.policeCall.phase);
            } else if (!next.policeCall) {
              worldRef.current?.setPoliceIncident(null);
              worldRef.current?.setLostResidentEscort(null);
              worldRef.current?.setSuspiciousActivity(null);
            }
            if (next.policeCall?.kind === "suspicious_activity") {
              worldRef.current?.setSuspiciousActivity(next.policeCall.phase);
            }
            if (next.policeCall?.kind === "lost_resident") {
              const phase = next.policeCall.phase;
              if (phase === "resolving") {
                worldRef.current?.setLostResidentEscort("following", {
                  name: next.policeCall.residentName,
                });
              } else if (
                phase === "accepted" ||
                phase === "traveling" ||
                phase === "arrived"
              ) {
                worldRef.current?.setLostResidentEscort("waiting", {
                  name: next.policeCall.residentName,
                });
              }
            }
            refreshPhoneChrome(next);
          }}
          onClose={closePhone}
          onOpenCharacter={() => {
            closePhone();
            characterMenuRef.current = "outfit";
            setCharacterMenu("outfit");
          }}
          onChanged={() => refreshPhoneChrome()}
          startApp={phoneStartApp}
          startThreadId={phoneThread}
        />
      ) : null}

      {phoneToast && !phoneOpen && !failed ? (
        <button
          type="button"
          onClick={() => {
            openPhone(phoneToast.id);
            setPhoneToast(null);
          }}
          className="pointer-events-auto absolute left-1/2 top-16 z-40 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#101826]/95 px-4 py-3 text-left shadow-2xl backdrop-blur"
        >
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-sky-300">
            Messages · now
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {phoneToast.sender}
          </p>
          <p className="truncate text-xs text-slate-300">
            {phoneToast.body[0]}
          </p>
        </button>
      ) : null}

      {!failed && !phoneOpen ? (
        <button
          type="button"
          onClick={() => openPhone()}
          className="pointer-events-auto absolute bottom-24 left-4 z-30 grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/55 text-xl shadow-xl backdrop-blur hover:bg-black/70"
          title="Open phone (M)"
          aria-label="Open phone"
        >
          📱
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold text-white">
              {unread}
            </span>
          ) : null}
        </button>
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
                {sleepInterest > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-amber-300">
                    Bank interest {formatDollars(sleepInterest)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                Sleeping until 8:00 AM
              </p>
            )}
          </div>
        </div>
      ) : null}

      {!failed && !inside ? (
        <StreetMinimap
          state={playState}
          positionRef={positionRef}
          waypoint={waypoint}
          driving={driving || dustfallTrip}
          highway={dustfallTrip}
        />
      ) : null}
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
        active
          ? "bg-amber-400 text-[#1a1206]"
          : "text-slate-300 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
