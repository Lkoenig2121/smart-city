import type { Building, CityState } from "@/lib/city/types";

export interface SubwayStationDef {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  hint: string;
}

/** West-to-east Riverside Line. Origins are 1×1 lots next to major junctions. */
export const SUBWAY_STATIONS: SubwayStationDef[] = [
  { id: "harbor", name: "Harbor Bridge", x: 13, y: 19, color: "#2aa3a0", hint: "West bank · tram transfer" },
  { id: "central", name: "Riverside Central", x: 19, y: 15, color: "#e8c36a", hint: "Downtown plaza" },
  { id: "north", name: "Helio North", x: 19, y: 7, color: "#6f8ea3", hint: "Towers & hotels" },
  { id: "civic", name: "Civic East", x: 30, y: 15, color: "#c0392b", hint: "Hospital · police · fire" },
  { id: "ravens", name: "Ravens Station", x: 32, y: 33, color: "#1f4d8c", hint: "Ballpark" },
];

export const SUBWAY_LINE = "Riverside Line";

/** Geographic connections drawn on the in-car map. */
export const SUBWAY_EDGES: [string, string][] = [
  ["harbor", "central"],
  ["central", "north"],
  ["central", "civic"],
  ["civic", "ravens"],
];

export function isSubwayStation(building: Building) {
  return building.kind === "subway_station";
}

export function subwayStations(state: CityState) {
  return [...state.buildings.values()].filter(isSubwayStation);
}

export function subwayStationId(building: Building) {
  const tagged = building.stats.extra?.station;
  return typeof tagged === "string" ? tagged : null;
}

export function findSubwayStation(state: CityState, id: string) {
  const def = stationDef(id);
  const stations = subwayStations(state);
  return (
    stations.find((building) => subwayStationId(building) === id) ??
    stations.find((building) => building.name === def.name) ??
    stations.find((building) => building.origin.x === def.x && building.origin.y === def.y) ??
    null
  );
}

export function subwayGateFromId(state: CityState, id: string) {
  const building = findSubwayStation(state, id);
  if (building) return subwayGateTile(building);
  const def = stationDef(id);
  return { x: def.x, y: def.y + 1 };
}

export function stationDef(id: string) {
  return SUBWAY_STATIONS.find((station) => station.id === id) ?? SUBWAY_STATIONS[1];
}

export function stationIndex(id: string) {
  const index = SUBWAY_STATIONS.findIndex((station) => station.id === id);
  return index >= 0 ? index : 1;
}

export function subwayGateTile(building: Building) {
  return {
    x: building.origin.x + Math.floor(building.width / 2),
    y: building.origin.y + building.depth,
  };
}

export function markSubwayStation(building: Building, def: SubwayStationDef) {
  building.name = def.name;
  building.accentColor = def.color;
  building.stats.extra = {
    ...building.stats.extra,
    station: def.id,
    line: SUBWAY_LINE,
    connects: def.hint,
  };
}
