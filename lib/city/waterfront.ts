import type { Building } from "./types";
import { markLodging } from "./lodging";
import { markVenue, type VenueRole } from "./venues";

/** Water spans `riverXAt(y)` through `riverXAt(y) + RIVER_W - 1`. */
export const RIVER_W = 4;

export type WaterfrontDistrict = "beach" | "marina" | "promenade" | "park";

export function riverXAt(y: number) {
  return 7 + Math.round(Math.sin(y * 0.18) * 1.2);
}

/** North–south boardwalk just inland of the west sand bank. */
export function promenadeXAt(y: number) {
  return riverXAt(y) - 2;
}

export function isPromenadeTile(x: number, y: number) {
  return y >= 9 && x === riverXAt(y) - 1;
}

export function isWestBank(x: number, y: number) {
  return x < riverXAt(y);
}

/** Westernmost river tile — the shore that faces the HUD-side neighborhood. */
export function isWestShoreWater(x: number, y: number) {
  return x === riverXAt(y);
}

export function waterfrontDistrict(y: number): WaterfrontDistrict {
  if (y <= 7) return "beach";
  if (y <= 15) return "marina";
  if (y <= 25) return "promenade";
  return "park";
}

export const MARINA_DOCK_ROWS = [9, 10, 11, 13, 14];

export function isMarinaDockRow(y: number) {
  return MARINA_DOCK_ROWS.includes(y);
}

/** Ferris sits on a pier over the river, south of the dining strip. */
export const FERRIS_Y = 28;

export function ferrisWorldTile() {
  return { x: riverXAt(FERRIS_Y) + 1.55, y: FERRIS_Y + 0.5 };
}

export interface WaterfrontBoat {
  x: number;
  y: number;
  heading: number;
  color: string;
  cabin: string;
  scale: number;
}

const BOAT_COLORS = ["#c0392b", "#2471a3", "#f4f1ea", "#1e8449", "#2c3e50", "#e67e22"];
const CABIN_COLORS = ["#f7f1e4", "#2a3138", "#d8c4a8", "#4a5560"];

/** Moored craft in the marina basin, plus a couple of river yachts. */
export function waterfrontBoats(): WaterfrontBoat[] {
  const boats: WaterfrontBoat[] = [];
  MARINA_DOCK_ROWS.forEach((row, i) => {
    const river = riverXAt(row);
    boats.push({
      x: river + 1.35,
      y: row + 0.28,
      heading: i % 2 === 0 ? 0 : Math.PI,
      color: BOAT_COLORS[i % BOAT_COLORS.length],
      cabin: CABIN_COLORS[i % CABIN_COLORS.length],
      scale: 0.9,
    });
    boats.push({
      x: river + 2.55,
      y: row + 0.68,
      heading: i % 2 === 0 ? Math.PI : 0,
      color: BOAT_COLORS[(i + 3) % BOAT_COLORS.length],
      cabin: CABIN_COLORS[(i + 1) % CABIN_COLORS.length],
      scale: 0.75,
    });
  });
  boats.push(
    {
      x: riverXAt(18) + 1.7,
      y: 18.4,
      heading: 0.12,
      color: "#f4f1ea",
      cabin: "#2a3138",
      scale: 1.15,
    },
    {
      x: riverXAt(22) + 2.1,
      y: 22.35,
      heading: Math.PI - 0.08,
      color: "#2471a3",
      cabin: "#d8c4a8",
      scale: 1.05,
    },
    {
      x: riverXAt(32) + 1.8,
      y: 32.45,
      heading: 0.05,
      color: "#1e8449",
      cabin: "#f7f1e4",
      scale: 0.95,
    },
  );
  return boats;
}

export interface WaterfrontPlot {
  kind: "shop" | "apartment" | "park_pavilion";
  x: number;
  y: number;
  name: string;
  role?: VenueRole;
  lodging?: "hotel";
  floors?: number;
  district: WaterfrontDistrict;
  hint?: string;
}

/** Curated west-bank lots. Origins sit off the x=2 arterial and the E–W streets. */
export const WATERFRONT_PLOTS: WaterfrontPlot[] = [
  { kind: "shop", x: 1, y: 10, name: "Riverside Marina", role: "shop", district: "marina", hint: "Slips · fuel" },
  { kind: "shop", x: 3, y: 10, name: "Dockside Grill", role: "restaurant", district: "marina" },
  { kind: "shop", x: 1, y: 13, name: "Wharf Kitchen", role: "restaurant", district: "marina" },
  { kind: "shop", x: 3, y: 13, name: "Harbor Mall", role: "mall", district: "marina", hint: "Fashion · sneakers · luxury" },
  { kind: "shop", x: 1, y: 17, name: "The Landing", role: "restaurant", district: "promenade" },
  { kind: "apartment", x: 3, y: 17, name: "Quay Residences", role: "apartment", district: "promenade", floors: 7 },
  { kind: "apartment", x: 1, y: 18, name: "Bankside Flats", role: "apartment", district: "promenade", floors: 6 },
  { kind: "shop", x: 3, y: 19, name: "Sunset Oyster", role: "restaurant", district: "promenade" },
  { kind: "apartment", x: 1, y: 21, name: "Harborview Inn", lodging: "hotel", district: "promenade", floors: 8 },
  { kind: "apartment", x: 3, y: 21, name: "Riverloft", role: "apartment", district: "promenade", floors: 7 },
  { kind: "shop", x: 1, y: 22, name: "Pier Cafe", role: "restaurant", district: "promenade" },
  { kind: "apartment", x: 3, y: 23, name: "Westwater House", role: "apartment", district: "promenade", floors: 6 },
  { kind: "apartment", x: 1, y: 26, name: "Parkview Court", role: "apartment", district: "park", floors: 6 },
  { kind: "apartment", x: 3, y: 26, name: "Esplanade Lofts", role: "apartment", district: "park", floors: 7 },
  { kind: "park_pavilion", x: 1, y: 29, name: "Pier Pavilion", district: "park", hint: "Ferris wheel" },
  { kind: "apartment", x: 3, y: 32, name: "Southbank Residences", role: "apartment", district: "park", floors: 6 },
];

export function markWaterfrontBuilding(building: Building, plot: WaterfrontPlot) {
  building.name = plot.name;
  if (plot.floors) building.floors = plot.floors;
  if (plot.lodging) {
    markLodging(building, plot.lodging);
    building.name = plot.name;
  } else if (plot.role) {
    markVenue(building, plot.role);
    building.name = plot.name;
  }
  building.stats.extra = {
    ...building.stats.extra,
    waterfront: "Riverside",
    district: plot.district,
    ...(plot.hint ? { attraction: plot.hint } : {}),
  };
  if (plot.district === "promenade" && building.kind === "apartment" && !plot.lodging) {
    building.wallColor = "#e6ddd2";
    building.accentColor = "#2f6f96";
  }
}

export function isWaterfrontBuilding(building: Building) {
  return building.stats.extra?.waterfront === "Riverside";
}

export function waterfrontPois(): { x: number; y: number; kind: "marina" | "beach" | "ferris" }[] {
  const ferris = ferrisWorldTile();
  return [
    { x: promenadeXAt(4) + 0.4, y: 4.2, kind: "beach" },
    { x: riverXAt(12) + 0.8, y: 12, kind: "marina" },
    { x: ferris.x, y: ferris.y, kind: "ferris" },
  ];
}

export const WATERFRONT_BOATS = waterfrontBoats();
