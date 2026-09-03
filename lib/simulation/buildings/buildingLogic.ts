import type { Building } from "@/lib/city/types";

export function isResidential(building: Building) {
  return building.kind === "house" || building.kind === "apartment";
}
