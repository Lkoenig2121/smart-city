export type CityEventKind = "fire" | "crime" | "festival";

export interface CityEvent {
  id: string;
  kind: CityEventKind;
  x: number;
  y: number;
  remaining: number;
}
