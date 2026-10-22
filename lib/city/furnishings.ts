import type { CityClock } from "./types";
import { readPlayer, spendWallet, writePlayer, type PlayerState } from "./player";

export type FurnishSlot = "tv" | "console" | "floor" | "bed";
export type FurnishStore = "living" | "cinema" | "floors" | "beds" | "estate";

export interface FurnishItem {
  id: string;
  name: string;
  description: string;
  price: number;
  slot: FurnishSlot;
  store: FurnishStore;
  /** TV screen scale vs the default hotel set (1 = stock). */
  tvScale?: number;
  /** Floor / carpet tint applied in hotel & owned homes. */
  floorColor?: string;
  /** Bedsheet / duvet tint. */
  bedColor?: string;
  /** Optional wood / metal frame tint. */
  bedFrameColor?: string;
  /** Extra TV channel pack when this console is equipped. */
  channels?: "default" | "nuketown";
}

export interface RoomLoadout {
  tvId: string | null;
  consoleId: string | null;
  floorId: string | null;
  bedId: string | null;
}

export type HomeKind = "house" | "mansion";

export interface HomeListing {
  id: string;
  name: string;
  kind: HomeKind;
  price: number;
  description: string;
  blurb: string;
}

export interface DreamHomePlot {
  cityId: string;
  x: number;
  y: number;
  w: number;
  d: number;
  facing: number;
  houseX: number;
  houseY: number;
  houseW: number;
  houseD: number;
  landPrice: number;
  lotId?: string;
  zone?: string;
  marketValue?: number;
  roadAccess?: boolean;
}

export interface DreamHomeDesign {
  styleId: string;
  stories: number;
  wallColor: string;
  roofColor: string;
  accentColor: string;
  roof: "gable" | "hip" | "flat";
  floorId: string | null;
}

export interface OwnedHome {
  id: string;
  listingId: string;
  name: string;
  kind: HomeKind;
  purchasePrice: number;
  /** Set when the home was built on a street lot. */
  plot?: DreamHomePlot;
  design?: DreamHomeDesign;
}

export const FURNISH_STORES: { id: FurnishStore; name: string; blurb: string }[] = [
  { id: "living", name: "Living Room Co", blurb: "Sofas, dressers, and living-room kits." },
  { id: "cinema", name: "Harbor Cinema", blurb: "Bigger TVs and game consoles." },
  { id: "floors", name: "Floor Studio", blurb: "Carpet, hardwood, and tile." },
  { id: "beds", name: "Harbor Beds", blurb: "Colored linens and frames." },
  { id: "estate", name: "Harbor Estate", blurb: "Houses and mansions for sale." },
];

export const FURNISHINGS: FurnishItem[] = [
  {
    id: "tv-stock",
    name: "Harbor Flat",
    description: "The standard hotel dresser set.",
    price: 180,
    slot: "tv",
    store: "cinema",
    tvScale: 1,
  },
  {
    id: "tv-55",
    name: "55″ Harbor Screen",
    description: "A wider living-room panel for game nights.",
    price: 890,
    slot: "tv",
    store: "cinema",
    tvScale: 1.35,
  },
  {
    id: "tv-75",
    name: "75″ Cinema Wall",
    description: "Floor-to-almost-ceiling baseball and Nuketown.",
    price: 2400,
    slot: "tv",
    store: "cinema",
    tvScale: 1.75,
  },
  {
    id: "console-ps4",
    name: "PlayStation 4",
    description: "Boots Nuketown on the room TV during downtime.",
    price: 320,
    slot: "console",
    store: "cinema",
    channels: "nuketown",
  },
  {
    id: "floor-carpet",
    name: "River Carpet",
    description: "Soft hotel pile in warm sand.",
    price: 240,
    slot: "floor",
    store: "floors",
    floorColor: "#c4a882",
  },
  {
    id: "floor-oak",
    name: "Oak Plank",
    description: "Light hardwood for an open loft feel.",
    price: 480,
    slot: "floor",
    store: "floors",
    floorColor: "#b8956a",
  },
  {
    id: "floor-walnut",
    name: "Walnut Board",
    description: "Dark polished wood for club floors.",
    price: 620,
    slot: "floor",
    store: "floors",
    floorColor: "#5a3d28",
  },
  {
    id: "floor-marble",
    name: "Marble Tile",
    description: "Cool stone for mansions and penthouses.",
    price: 980,
    slot: "floor",
    store: "floors",
    floorColor: "#e8e4dc",
  },
  {
    id: "floor-nile",
    name: "Nile Sand Weave",
    description: "Dustfall-inspired woven sand carpet.",
    price: 410,
    slot: "floor",
    store: "living",
    floorColor: "#d4bc86",
  },
  {
    id: "floor-teal",
    name: "Oasis Runner",
    description: "Deep teal carpet with a quiet sheen.",
    price: 360,
    slot: "floor",
    store: "living",
    floorColor: "#2a6b5a",
  },
  {
    id: "bed-ivory",
    name: "Ivory Duvet",
    description: "Soft hotel white with a warm oak frame.",
    price: 280,
    slot: "bed",
    store: "beds",
    bedColor: "#f4f1ea",
    bedFrameColor: "#5a3d28",
  },
  {
    id: "bed-navy",
    name: "Harbor Navy",
    description: "Deep blue linens for a quieter sleep.",
    price: 340,
    slot: "bed",
    store: "beds",
    bedColor: "#1e3a6b",
    bedFrameColor: "#2a2420",
  },
  {
    id: "bed-blush",
    name: "River Blush",
    description: "Soft rose duvet with light maple rails.",
    price: 320,
    slot: "bed",
    store: "beds",
    bedColor: "#d4a0a8",
    bedFrameColor: "#8a6a4a",
  },
  {
    id: "bed-sage",
    name: "Park Sage",
    description: "Muted green bedding and a charcoal frame.",
    price: 360,
    slot: "bed",
    store: "beds",
    bedColor: "#6a8f72",
    bedFrameColor: "#2c2c2c",
  },
  {
    id: "bed-ember",
    name: "Ember Quilt",
    description: "Warm terracotta linens for Dustfall nights.",
    price: 390,
    slot: "bed",
    store: "beds",
    bedColor: "#c45c4a",
    bedFrameColor: "#3a2a1c",
  },
  {
    id: "bed-sky",
    name: "Sky Stripe",
    description: "Light blue sheets with a pale birch frame.",
    price: 310,
    slot: "bed",
    store: "beds",
    bedColor: "#7eb3e0",
    bedFrameColor: "#b8956a",
  },
];

export const HOME_LISTINGS: HomeListing[] = [
  {
    id: "cottage-harbor",
    name: "Harbor Cottage",
    kind: "house",
    price: 85_000,
    description: "A compact riverside house with a living room ready for your furniture.",
    blurb: "2 bed · starter home",
  },
  {
    id: "villa-sand",
    name: "Sandstone Villa",
    kind: "house",
    price: 165_000,
    description: "Warm stone walls and space for a cinema wall TV.",
    blurb: "3 bed · desert tone",
  },
  {
    id: "mansion-promenade",
    name: "Promenade Mansion",
    kind: "mansion",
    price: 420_000,
    description: "Grand foyer energy — marble floors and a 75″ wall look at home here.",
    blurb: "Estate · waterfront",
  },
  {
    id: "mansion-horizon",
    name: "Horizon Manor",
    kind: "mansion",
    price: 680_000,
    description: "The top-tier Dustfall-inspired manor for your full loadout.",
    blurb: "Estate · panoramic",
  },
];

export function emptyRoomLoadout(): RoomLoadout {
  return { tvId: null, consoleId: null, floorId: null, bedId: null };
}

export function furnishById(id: string) {
  return FURNISHINGS.find((item) => item.id === id) ?? null;
}

export function furnishingsInStore(store: FurnishStore) {
  return FURNISHINGS.filter((item) => item.store === store);
}

export function homeListingById(id: string) {
  return HOME_LISTINGS.find((item) => item.id === id) ?? null;
}

export function buyFurnishing(itemId: string, clock: CityClock): PlayerState | string {
  const player = readPlayer();
  const item = furnishById(itemId);
  if (!item) return "That piece is not in the catalog.";
  if (player.ownedFurnishings.includes(itemId)) return "You already own that.";
  const spent = spendWallet(item.price, clock, `Bought ${item.name}`);
  if (typeof spent === "string") return spent;
  const latest = readPlayer();
  latest.ownedFurnishings.push(itemId);
  // Auto-equip into the matching slot so hotel rooms update immediately.
  if (item.slot === "tv") latest.equippedFurnish.tvId = itemId;
  if (item.slot === "console") latest.equippedFurnish.consoleId = itemId;
  if (item.slot === "floor") latest.equippedFurnish.floorId = itemId;
  if (item.slot === "bed") latest.equippedFurnish.bedId = itemId;
  writePlayer(latest);
  return latest;
}

export function equipFurnishing(itemId: string): PlayerState | string {
  const player = readPlayer();
  const item = furnishById(itemId);
  if (!item) return "Unknown furnishing.";
  if (!player.ownedFurnishings.includes(itemId)) return "Buy it first.";
  if (item.slot === "tv") player.equippedFurnish.tvId = itemId;
  if (item.slot === "console") player.equippedFurnish.consoleId = itemId;
  if (item.slot === "floor") player.equippedFurnish.floorId = itemId;
  if (item.slot === "bed") player.equippedFurnish.bedId = itemId;
  writePlayer(player);
  return player;
}

export function clearFurnishSlot(slot: FurnishSlot): PlayerState {
  const player = readPlayer();
  if (slot === "tv") player.equippedFurnish.tvId = null;
  if (slot === "console") player.equippedFurnish.consoleId = null;
  if (slot === "floor") player.equippedFurnish.floorId = null;
  if (slot === "bed") player.equippedFurnish.bedId = null;
  writePlayer(player);
  return player;
}

export function buyHome(listingId: string, clock: CityClock): PlayerState | string {
  const player = readPlayer();
  const listing = homeListingById(listingId);
  if (!listing) return "That listing is gone.";
  if (player.ownedHomes.some((home) => home.listingId === listingId)) {
    return "You already own that property.";
  }
  const spent = spendWallet(listing.price, clock, `Bought ${listing.name}`);
  if (typeof spent === "string") return spent;
  const latest = readPlayer();
  const owned: OwnedHome = {
    id: `home-${listingId}-${Date.now().toString(36)}`,
    listingId: listing.id,
    name: listing.name,
    kind: listing.kind,
    purchasePrice: listing.price,
  };
  latest.ownedHomes.push(owned);
  latest.activeHomeId = owned.id;
  writePlayer(latest);
  return latest;
}

export function setActiveHome(homeId: string): PlayerState | string {
  const player = readPlayer();
  const home = player.ownedHomes.find((item) => item.id === homeId);
  if (!home) return "Home not found.";
  player.activeHomeId = homeId;
  writePlayer(player);
  return player;
}

export function activeOwnedHome(player: PlayerState = readPlayer()) {
  if (!player.activeHomeId) return player.ownedHomes[0] ?? null;
  return player.ownedHomes.find((home) => home.id === player.activeHomeId) ?? player.ownedHomes[0] ?? null;
}

/**
 * Temporary room look while browsing Customize — does not write save data.
 * Keys present in the partial override the equipped loadout for that slot
 * (including `null` to preview stock).
 */
let roomStylePreview: Partial<RoomLoadout> | null = null;

export function setRoomStylePreview(preview: Partial<RoomLoadout> | null) {
  roomStylePreview = preview;
}

export function clearRoomStylePreview() {
  roomStylePreview = null;
}

/** Resolved visuals for the player's current hotel / home loadout. */
export function resolveRoomStyle(player: PlayerState = readPlayer()) {
  const base = player.equippedFurnish;
  const loadout: RoomLoadout = roomStylePreview
    ? {
        tvId: "tvId" in roomStylePreview ? roomStylePreview.tvId ?? null : base.tvId,
        consoleId:
          "consoleId" in roomStylePreview
            ? roomStylePreview.consoleId ?? null
            : base.consoleId,
        floorId:
          "floorId" in roomStylePreview ? roomStylePreview.floorId ?? null : base.floorId,
        bedId: "bedId" in roomStylePreview ? roomStylePreview.bedId ?? null : base.bedId,
      }
    : base;
  const tv = loadout.tvId ? furnishById(loadout.tvId) : null;
  const consoleItem = loadout.consoleId ? furnishById(loadout.consoleId) : null;
  const floor = loadout.floorId ? furnishById(loadout.floorId) : null;
  const bed = loadout.bedId ? furnishById(loadout.bedId) : null;
  return {
    tvScale: tv?.tvScale ?? 1,
    floorColor: floor?.floorColor ?? null,
    bedColor: bed?.bedColor ?? null,
    bedFrameColor: bed?.bedFrameColor ?? null,
    nuketown: consoleItem?.channels === "nuketown",
    tvName: tv?.name ?? null,
    consoleName: consoleItem?.name ?? null,
    bedName: bed?.name ?? null,
  };
}

export function parseOwnedFurnishings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && Boolean(furnishById(id)));
}

export function parseRoomLoadout(value: unknown): RoomLoadout {
  const empty = emptyRoomLoadout();
  if (!value || typeof value !== "object") return empty;
  const raw = value as Partial<RoomLoadout>;
  const tvId = typeof raw.tvId === "string" && furnishById(raw.tvId) ? raw.tvId : null;
  const consoleId = typeof raw.consoleId === "string" && furnishById(raw.consoleId) ? raw.consoleId : null;
  const floorId = typeof raw.floorId === "string" && furnishById(raw.floorId) ? raw.floorId : null;
  const bedId = typeof raw.bedId === "string" && furnishById(raw.bedId) ? raw.bedId : null;
  return { tvId, consoleId, floorId, bedId };
}

export function parseOwnedHomes(value: unknown): OwnedHome[] {
  if (!Array.isArray(value)) return [];
  const list: OwnedHome[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<OwnedHome>;
    const listingId = typeof item.listingId === "string" ? item.listingId : "";
    const listing = homeListingById(listingId);
    const plot = parseDreamPlot(item.plot);
    const design = parseDreamDesign(item.design);
    if (!listing && !(plot && design)) continue;
    list.push({
      id: typeof item.id === "string" ? item.id : `home-${listingId}`,
      listingId: listingId || (design ? `dream:${design.styleId}` : ""),
      name: typeof item.name === "string" ? item.name : (listing?.name ?? "Home"),
      kind: listing?.kind ?? (plot && plot.houseW >= 4 ? "mansion" : "house"),
      purchasePrice: Number(item.purchasePrice) || listing?.price || 0,
      ...(plot && design ? { plot, design } : {}),
    });
  }
  return list;
}

function parseDreamPlot(value: unknown): DreamHomePlot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<DreamHomePlot>;
  const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null);
  const x = num(raw.x);
  const y = num(raw.y);
  const w = num(raw.w);
  const d = num(raw.d);
  const houseX = num(raw.houseX);
  const houseY = num(raw.houseY);
  const houseW = num(raw.houseW);
  const houseD = num(raw.houseD);
  if (x == null || y == null || w == null || d == null || houseX == null || houseY == null || houseW == null || houseD == null) {
    return null;
  }
  if (typeof raw.cityId !== "string") return null;
  return {
    cityId: raw.cityId,
    x, y, w, d,
    facing: num(raw.facing) ?? 0,
    houseX, houseY, houseW, houseD,
    landPrice: num(raw.landPrice) ?? 0,
    ...(typeof raw.lotId === "string" ? { lotId: raw.lotId } : {}),
    ...(typeof raw.zone === "string" ? { zone: raw.zone } : {}),
    ...(num(raw.marketValue) != null ? { marketValue: num(raw.marketValue)! } : {}),
    ...(typeof raw.roadAccess === "boolean" ? { roadAccess: raw.roadAccess } : {}),
  };
}

function parseDreamDesign(value: unknown): DreamHomeDesign | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<DreamHomeDesign>;
  if (typeof raw.styleId !== "string") return null;
  const stories = typeof raw.stories === "number" ? raw.stories : 1;
  const roof = raw.roof === "hip" || raw.roof === "flat" || raw.roof === "gable" ? raw.roof : "gable";
  return {
    styleId: raw.styleId,
    stories,
    wallColor: typeof raw.wallColor === "string" ? raw.wallColor : "#d8c4a8",
    roofColor: typeof raw.roofColor === "string" ? raw.roofColor : "#6a5340",
    accentColor: typeof raw.accentColor === "string" ? raw.accentColor : "#c9a44c",
    roof,
    floorId: typeof raw.floorId === "string" ? raw.floorId : null,
  };
}

/** Synthetic lodging building so owned homes reuse hotel room interiors. */
export function makeOwnedHomeBuilding(home: OwnedHome): import("./types").Building {
  const mansion = home.kind === "mansion";
  const design = home.design;
  const plot = home.plot;
  return {
    id: home.id,
    kind: plot ? "house" : "apartment",
    name: home.name,
    origin: plot ? { x: plot.houseX, y: plot.houseY } : { x: 0, y: 0 },
    width: plot ? plot.houseW : mansion ? 4 : 3,
    depth: plot ? plot.houseD : mansion ? 4 : 3,
    variant: mansion ? 2 : 0,
    floors: design?.stories ?? (mansion ? 6 : 3),
    wallColor: design?.wallColor ?? (mansion ? "#e8dcc8" : "#d8c4a8"),
    roofColor: design?.roofColor ?? (mansion ? "#5a3d28" : "#6a5340"),
    accentColor: design?.accentColor ?? "#c9a44c",
    constructionLeft: 0,
    stats: {
      residents: 0,
      capacity: mansion ? 12 : 4,
      employees: 0,
      jobs: 0,
      revenue: 0,
      energy: 80,
      parking: 80,
      happiness: 90,
      propertyValue: home.purchasePrice,
      status: "open",
      extra: plot
        ? {
            lodging: "residences",
            dream: "1",
            facing: String(plot.facing),
            roof: design?.roof ?? "gable",
            style: design?.styleId ?? "starter",
          }
        : { lodging: "residences" },
    },
  };
}
