export type TransitKind = "bus" | "tram" | "subway" | "train";

export interface TransitStop {
  x: number;
  y: number;
  name: string;
}
