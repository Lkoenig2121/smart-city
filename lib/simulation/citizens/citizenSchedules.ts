export type DayPart = "morning" | "work" | "evening" | "night";

export function dayPartFromHour(hour: number): DayPart {
  if (hour < 6) return "night";
  if (hour < 8) return "morning";
  if (hour < 17) return "work";
  if (hour < 21) return "evening";
  return "night";
}
