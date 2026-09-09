import { pick, randInt, randRange } from "@/lib/city/rng";
import { buildingName } from "@/lib/city/names";
import type { Building, BuildingKind, BuildingStats } from "@/lib/city/types";

const HOUSE_WALLS = ["#f3d7b5", "#f0e6d2", "#e8d5c4", "#d9c4a8", "#f7efe4"];
const HOUSE_ROOFS = ["#b5523a", "#8b3d2e", "#6d4c41", "#3f5d4c", "#4d5b75", "#7a2e2e"];
const HOUSE_ACCENTS = ["#2f4a3a", "#4a3728", "#3d5a80", "#6b2d2d"];

const APT_WALLS = ["#d8cfc4", "#c9b8a6", "#e6ddd2", "#b7c3c9"];
const APT_ROOFS = ["#5c5348", "#6e6256", "#4a5560"];

const OFFICE_WALLS = ["#8aa4b8", "#6f8ea3", "#9bb0be", "#5d7384"];
const OFFICE_ROOFS = ["#3a4450", "#2d3640"];

const SHOP_WALLS = ["#f0d3b5", "#e8c9b0", "#f6e6cf", "#dcc4a8"];
const SHOP_ROOFS = ["#6a3a32", "#3f4d5c", "#4d5b3f"];

export function footprintFor(kind: BuildingKind): { w: number; d: number } {
  switch (kind) {
    case "hospital":
      return { w: 3, d: 3 };
    case "school":
      return { w: 3, d: 2 };
    case "city_hall":
      return { w: 2, d: 2 };
    case "skyscraper":
    case "tower":
      return { w: 2, d: 2 };
    case "office":
      return { w: 1, d: 1 };
    case "apartment":
      return { w: 1, d: 1 };
    case "fire":
    case "police":
      return { w: 2, d: 1 };
    case "park_pavilion":
      return { w: 1, d: 1 };
    case "baseball_stadium":
      return { w: 5, d: 4 };
    default:
      return { w: 1, d: 1 };
  }
}

export function defaultStats(kind: BuildingKind, rand: () => number): BuildingStats {
  switch (kind) {
    case "house":
      return {
        residents: randInt(rand, 2, 5),
        capacity: 5,
        employees: 0,
        jobs: 0,
        revenue: 0,
        happiness: randInt(rand, 68, 92),
        propertyValue: randInt(rand, 320000, 680000),
        status: "open",
      };
    case "apartment":
      return {
        residents: randInt(rand, 18, 42),
        capacity: 48,
        employees: 0,
        jobs: 0,
        revenue: 0,
        happiness: randInt(rand, 62, 86),
        propertyValue: randInt(rand, 2400000, 5100000),
        status: "open",
      };
    case "shop":
      return {
        residents: 0,
        capacity: 0,
        employees: randInt(rand, 4, 14),
        jobs: randInt(rand, 8, 18),
        revenue: randInt(rand, 180000, 920000),
        happiness: randInt(rand, 70, 90),
        propertyValue: randInt(rand, 410000, 980000),
        status: "open",
      };
    case "office":
      return {
        residents: 0,
        capacity: 0,
        employees: randInt(rand, 28, 90),
        jobs: randInt(rand, 40, 110),
        revenue: randInt(rand, 1200000, 4800000),
        happiness: randInt(rand, 64, 88),
        propertyValue: randInt(rand, 4200000, 9800000),
        status: "open",
      };
    case "skyscraper":
      return {
        residents: 0,
        capacity: 0,
        employees: randInt(rand, 180, 420),
        jobs: randInt(rand, 240, 520),
        revenue: randInt(rand, 8200000, 24000000),
        happiness: randInt(rand, 70, 91),
        propertyValue: randInt(rand, 48000000, 120000000),
        status: "open",
      };
    case "tower":
      return {
        residents: 0,
        capacity: 0,
        employees: randInt(rand, 620, 1400),
        jobs: randInt(rand, 780, 1700),
        revenue: randInt(rand, 28000000, 74000000),
        happiness: randInt(rand, 72, 93),
        propertyValue: randInt(rand, 180000000, 420000000),
        status: "open",
        extra: { observationDeck: "Open", elevators: randInt(rand, 18, 34) },
      };
    case "hospital":
      return {
        residents: 0,
        capacity: 120,
        employees: 86,
        jobs: 110,
        revenue: 0,
        happiness: 78,
        propertyValue: 32000000,
        status: "open",
        extra: { beds: 120, patients: 41, doctors: 28 },
      };
    case "school":
      return {
        residents: 0,
        capacity: 420,
        employees: 34,
        jobs: 40,
        revenue: 0,
        happiness: 84,
        propertyValue: 14000000,
        status: "open",
        extra: { students: 318, teachers: 28 },
      };
    case "police":
      return {
        residents: 0,
        capacity: 0,
        employees: 22,
        jobs: 28,
        revenue: 0,
        happiness: 74,
        propertyValue: 6200000,
        status: "open",
        extra: { officers: 22, coverage: "Downtown / East" },
      };
    case "fire":
      return {
        residents: 0,
        capacity: 0,
        employees: 16,
        jobs: 18,
        revenue: 0,
        happiness: 80,
        propertyValue: 5400000,
        status: "open",
        extra: { trucks: 3, coverage: "Central / South" },
      };
    case "city_hall":
      return {
        residents: 0,
        capacity: 0,
        employees: 48,
        jobs: 60,
        revenue: 0,
        happiness: 76,
        propertyValue: 18000000,
        status: "open",
      };
    case "park_pavilion":
      return {
        residents: 0,
        capacity: 0,
        employees: 2,
        jobs: 2,
        revenue: 0,
        happiness: 94,
        propertyValue: 420000,
        status: "open",
      };
    case "baseball_stadium":
      return {
        residents: 0,
        capacity: 12_000,
        employees: 180,
        jobs: 220,
        revenue: 15_000,
        happiness: 96,
        propertyValue: 750_000,
        status: "open",
        extra: {
          team: "Riverside Ravens",
          seats: "12,000",
          tourism: "Regional draw",
          traffic: "Game-day surge",
          "daily gate": "$15,000",
          "city happiness": "+1,000",
        },
      };
  }
}

export function createBuilding(
  id: string,
  kind: BuildingKind,
  x: number,
  y: number,
  rand: () => number,
  index: number,
): Building {
  const fp = footprintFor(kind);
  let wallColor = "#d9c4a8";
  let roofColor = "#8b3d2e";
  let accentColor = "#3d5a80";
  let floors = 1;

  switch (kind) {
    case "house":
      wallColor = pick(rand, HOUSE_WALLS);
      roofColor = pick(rand, HOUSE_ROOFS);
      accentColor = pick(rand, HOUSE_ACCENTS);
      floors = 1;
      break;
    case "apartment":
      wallColor = pick(rand, APT_WALLS);
      roofColor = pick(rand, APT_ROOFS);
      accentColor = "#6b4f3a";
      floors = randInt(rand, 4, 7);
      break;
    case "shop":
      wallColor = pick(rand, SHOP_WALLS);
      roofColor = pick(rand, SHOP_ROOFS);
      accentColor = pick(rand, ["#c0392b", "#1e6f5c", "#2c3e6b", "#8e5a2b"]);
      floors = 1;
      break;
    case "office":
      wallColor = pick(rand, OFFICE_WALLS);
      roofColor = pick(rand, OFFICE_ROOFS);
      accentColor = "#d7e6f0";
      floors = randInt(rand, 5, 9);
      break;
    case "skyscraper":
      wallColor = pick(rand, ["#6f8ea3", "#5a7184", "#7f99aa", "#4d6270"]);
      roofColor = "#2a3138";
      accentColor = "#d5e8f4";
      floors = randInt(rand, 22, 34);
      break;
    case "tower":
      wallColor = pick(rand, ["#41566b", "#4d6478", "#38495c", "#5b7285"]);
      roofColor = "#20272e";
      accentColor = "#e2f1fb";
      floors = randInt(rand, 44, 62);
      break;
    case "hospital":
      wallColor = "#f4efe6";
      roofColor = "#d7e4ea";
      accentColor = "#c0392b";
      floors = 4;
      break;
    case "school":
      wallColor = "#d9b48a";
      roofColor = "#6b3a32";
      accentColor = "#2f5d4a";
      floors = 2;
      break;
    case "police":
      wallColor = "#dfe6ee";
      roofColor = "#2c3e6b";
      accentColor = "#1d2d4f";
      floors = 2;
      break;
    case "fire":
      wallColor = "#efe4d8";
      roofColor = "#8f2a22";
      accentColor = "#c0392b";
      floors = 2;
      break;
    case "city_hall":
      wallColor = "#e6d8c4";
      roofColor = "#4a6d7c";
      accentColor = "#c9a44c";
      floors = 3;
      break;
    case "park_pavilion":
      wallColor = "#e8d7b8";
      roofColor = "#6b4a32";
      accentColor = "#3f5d4c";
      floors = 1;
      break;
    case "baseball_stadium":
      wallColor = "#8a5340";
      roofColor = "#2c5a34";
      accentColor = "#1e3f28";
      floors = 3;
      break;
  }

  return {
    id,
    kind,
    name: buildingName(kind, rand, index),
    origin: { x, y },
    width: fp.w,
    depth: fp.d,
    variant: Math.floor(rand() * 8),
    floors,
    wallColor,
    accentColor,
    roofColor,
    stats: defaultStats(kind, rand),
  };
}

export function kindLabel(target: Building | BuildingKind) {
  const kind = typeof target === "string" ? target : target.kind;
  const lodging = typeof target === "string" ? undefined : target.stats.extra?.lodging;
  switch (kind) {
    case "house":
      return "Residence";
    case "apartment":
      return "Apartment";
    case "shop":
      return "Business";
    case "office":
      return "Offices";
    case "skyscraper":
      if (lodging === "hotel") return "Hotel";
      if (lodging === "residences") return "Residences";
      return "High-rise";
    case "tower":
      if (lodging === "hotel") return "Hotel";
      if (lodging === "residences") return "Residences";
      return "Landmark Tower";
    case "hospital":
      return "Hospital";
    case "school":
      return "School";
    case "police":
      return "Police";
    case "fire":
      return "Fire Station";
    case "city_hall":
      return "Government";
    case "park_pavilion":
      return "Park";
    case "baseball_stadium":
      return "Baseball Stadium";
  }
}

export function formatMoney(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export function occupancyHint(building: Building) {
  if (building.kind === "house" || building.kind === "apartment") {
    return `${building.stats.residents} / ${building.stats.capacity} residents`;
  }
  if (building.stats.jobs > 0) {
    return `${building.stats.employees} / ${building.stats.jobs} employees`;
  }
  return null;
}

export function randomWallShift(color: string, rand: () => number) {
  void color;
  return randRange(rand, 0.92, 1.08);
}
