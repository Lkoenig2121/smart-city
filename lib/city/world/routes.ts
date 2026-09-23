import type { CityId } from "./cities";

export type RouteStatus = "open" | "locked";

export interface WorldRoute {
  from: CityId;
  to: CityId;
  status: RouteStatus;
}

/** Informational edges for the World Map. All regions are open for travel. */
export const WORLD_ROUTES: WorldRoute[] = [
  { from: "riverside", to: "dustfall", status: "open" },
  { from: "riverside", to: "mountain", status: "open" },
  { from: "riverside", to: "coastal", status: "open" },
  { from: "riverside", to: "future", status: "open" },
];
