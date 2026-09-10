import type { TransitKind, TransitStop } from "@/lib/simulation/transportation/routes";

export type { TransitKind, TransitStop };

/** Sidewalk bus shelters — street furniture, not interiors. */
export const BUS_STOPS: TransitStop[] = [
  { x: 16, y: 16, name: "Plaza Bus" },
  { x: 24, y: 24, name: "Park Bus" },
  { x: 31, y: 8, name: "Hospital Bus" },
  { x: 2, y: 13, name: "Riverfront Bus" },
];

/** Streetcar rails on arterial 20 through downtown. */
export function isTramTile(x: number, y: number) {
  return x === 20 && y >= 8 && y <= 31;
}
