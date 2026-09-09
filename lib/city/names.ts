import { pick, randInt } from "./rng";
import type { BuildingKind } from "./types";

type Rand = () => number;

const FIRST = [
  "Ava",
  "Noah",
  "Mia",
  "Liam",
  "Sofia",
  "Ethan",
  "Isla",
  "Julian",
  "Amara",
  "Theo",
  "Lena",
  "Owen",
  "Nora",
  "Kai",
  "Elena",
  "Marcus",
  "Priya",
  "Hugo",
  "Clara",
  "Jonah",
];

const LAST = [
  "Hale",
  "Okoye",
  "Voss",
  "Nakamura",
  "Reyes",
  "Berg",
  "Ibarra",
  "Cohen",
  "Patel",
  "Nguyen",
  "Keller",
  "Duarte",
  "Singh",
  "Moreau",
  "Walsh",
];

const STREETS = [
  "Maple",
  "Cedar",
  "Harbor",
  "Willow",
  "Oak",
  "Pioneer",
  "Lakeside",
  "Summit",
  "Orchid",
  "Beacon",
];

const FIRMS = [
  "Aether",
  "Northline",
  "Helio",
  "Parcel",
  "Lumen",
  "Cobalt",
  "Meridian",
  "Kite",
  "Harborstack",
  "Vellum",
];

const FIRM_SUFFIX = [
  "Labs",
  "Tower",
  "Plaza",
  "Works",
  "Group",
  "Holdings",
  "Studios",
  "Exchange",
];

const SHOPS = [
  "Corner Market",
  "Harbor Cafe",
  "Night Owl Books",
  "Cedar Bakery",
  "Pixel Repair",
  "Lotus Noodles",
  "The Green Grocer",
  "Riverview Pharmacy",
  "Summit Fitness",
  "Bluebird Florist",
];

export function citizenName(rand: Rand) {
  return `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
}

export function buildingName(kind: BuildingKind, rand: Rand, index: number) {
  switch (kind) {
    case "house":
      return `${randInt(rand, 10, 98)} ${pick(rand, STREETS)} Street`;
    case "apartment":
      return `${pick(rand, STREETS)} Residences`;
    case "shop":
      return pick(rand, SHOPS);
    case "office":
      return `${pick(rand, FIRMS)} ${pick(rand, FIRM_SUFFIX)}`;
    case "skyscraper":
      return `${pick(rand, FIRMS)} Tower`;
    case "tower":
      return `${pick(rand, FIRMS)} ${pick(rand, ["Center", "One", "Spire", "Financial Center"])}`;
    case "hospital":
      return "Riverside General Hospital";
    case "school":
      return "Beacon Elementary";
    case "police":
      return "Central Police Station";
    case "fire":
      return "Station 12 Firehouse";
    case "city_hall":
      return "City Hall";
    case "park_pavilion":
      return "Willow Park Pavilion";
    case "baseball_stadium":
      return "Ravens Ballpark";
    default:
      return `Building ${index}`;
  }
}
