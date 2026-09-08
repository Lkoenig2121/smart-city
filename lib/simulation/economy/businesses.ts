import type { Building } from "@/lib/city/types";

export function isBusiness(building: Building) {
  return (
    building.kind === "shop" ||
    building.kind === "office" ||
    building.kind === "skyscraper" ||
    building.kind === "tower"
  );
}
