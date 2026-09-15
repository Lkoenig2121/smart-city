import type { SkillPath } from "./skills";

export type ClothSlot = "head" | "upper" | "lower" | "feet" | "accessory";
export type ClothStore = "fashion" | "sneaker" | "luxury" | "department";
export type ClothCollection =
  | "everyday"
  | "athletic"
  | "professional"
  | "luxury"
  | "exclusive"
  | "legendary";

export interface ClothingItem {
  id: string;
  name: string;
  description: string;
  price: number;
  slot: ClothSlot;
  category: "clothing" | "accessories";
  store: ClothStore;
  collection: ClothCollection;
  level: number;
  skill?: { path: SkillPath; level: number };
  color: string;
  accent: string;
  bonus?: { stat: import("./skills").StatId; amount: number };
}

export const COLLECTIONS: { id: ClothCollection; name: string; level: number }[] = [
  { id: "everyday", name: "Everyday", level: 1 },
  { id: "athletic", name: "Athletic", level: 10 },
  { id: "professional", name: "Professional", level: 25 },
  { id: "luxury", name: "Luxury", level: 50 },
  { id: "exclusive", name: "Exclusive", level: 75 },
  { id: "legendary", name: "Legendary", level: 100 },
];

export const STORES: { id: ClothStore; name: string; blurb: string }[] = [
  { id: "fashion", name: "Fashion Avenue", blurb: "Jackets, shirts, and trousers." },
  { id: "sneaker", name: "Sneaker District", blurb: "Kicks and athletic wear." },
  { id: "luxury", name: "Luxury Boutique", blurb: "Premium cuts and accessories." },
  { id: "department", name: "Department Store", blurb: "Bags, basics, and useful layers." },
];

export const CLOTHING: ClothingItem[] = [
  { id: "tee-harbor", name: "Harbor Tee", description: "Soft cotton with a river print.", price: 45, slot: "upper", category: "clothing", store: "fashion", collection: "everyday", level: 1, color: "#d8c4a8", accent: "#2f5d4a" },
  { id: "shirt-oxford", name: "Oxford Shirt", description: "A weekday button-down.", price: 85, slot: "upper", category: "clothing", store: "fashion", collection: "everyday", level: 1, color: "#eef3f8", accent: "#3d5a80" },
  { id: "jacket-denim", name: "Denim Jacket", description: "Washed indigo, brass buttons.", price: 140, slot: "upper", category: "clothing", store: "fashion", collection: "everyday", level: 3, color: "#3d5a80", accent: "#c9a44c", bonus: { stat: "walk", amount: 0.01 } },
  { id: "jeans-indigo", name: "Indigo Jeans", description: "Straight leg, city durable.", price: 90, slot: "lower", category: "clothing", store: "fashion", collection: "everyday", level: 1, color: "#243656", accent: "#c9a44c" },
  { id: "chinos-sand", name: "Sand Chinos", description: "Light trousers for warm days.", price: 80, slot: "lower", category: "clothing", store: "fashion", collection: "everyday", level: 2, color: "#c4a882", accent: "#6a3a32" },
  { id: "cap-river", name: "River Cap", description: "A low brim with the city mark.", price: 28, slot: "head", category: "accessories", store: "department", collection: "everyday", level: 1, color: "#2f5d4a", accent: "#e8dcc8" },
  { id: "kicks-river", name: "River Runners", description: "Everyday sneakers.", price: 70, slot: "feet", category: "clothing", store: "sneaker", collection: "everyday", level: 1, color: "#ece8e0", accent: "#2aa3a0" },
  { id: "bag-day", name: "Daypack", description: "A small pack for errands.", price: 55, slot: "accessory", category: "accessories", store: "department", collection: "everyday", level: 2, color: "#6a5640", accent: "#c9a44c" },

  { id: "tee-track", name: "Track Tee", description: "Breathable knit for laps.", price: 60, slot: "upper", category: "clothing", store: "sneaker", collection: "athletic", level: 10, skill: { path: "athletics", level: 3 }, color: "#2aa3a0", accent: "#1a1206", bonus: { stat: "run", amount: 0.02 } },
  { id: "jacket-wind", name: "Wind Shell", description: "Light shell for the promenade.", price: 160, slot: "upper", category: "clothing", store: "sneaker", collection: "athletic", level: 10, color: "#1d2d4f", accent: "#7eb3e0", bonus: { stat: "run", amount: 0.03 } },
  { id: "shorts-court", name: "Court Shorts", description: "Athletic shorts with pockets.", price: 55, slot: "lower", category: "clothing", store: "sneaker", collection: "athletic", level: 10, color: "#2c3036", accent: "#c9a44c" },
  { id: "kicks-court", name: "Court Lows", description: "Grippy indoor-outdoor shoes.", price: 120, slot: "feet", category: "clothing", store: "sneaker", collection: "athletic", level: 10, skill: { path: "athletics", level: 2 }, color: "#f4f1ea", accent: "#c0392b", bonus: { stat: "jump", amount: 0.04 } },
  { id: "band-sweat", name: "Sweat Band", description: "Keeps hair and rain off.", price: 18, slot: "head", category: "accessories", store: "sneaker", collection: "athletic", level: 10, color: "#c0392b", accent: "#f4f1ea" },

  { id: "blazer-navy", name: "Navy Blazer", description: "Office-ready wool blend.", price: 320, slot: "upper", category: "clothing", store: "fashion", collection: "professional", level: 25, skill: { path: "career", level: 4 }, color: "#1d2d4f", accent: "#c9a44c", bonus: { stat: "salary", amount: 0.03 } },
  { id: "shirt-poplin", name: "Poplin Shirt", description: "Crisp white for the tower.", price: 110, slot: "upper", category: "clothing", store: "department", collection: "professional", level: 25, color: "#f7f4ea", accent: "#3d5a80" },
  { id: "trouser-char", name: "Charcoal Trousers", description: "Tapered office trousers.", price: 160, slot: "lower", category: "clothing", store: "fashion", collection: "professional", level: 25, color: "#2c3036", accent: "#c9a44c" },
  { id: "oxford-town", name: "Town Oxfords", description: "Leather shoes for the office.", price: 180, slot: "feet", category: "clothing", store: "department", collection: "professional", level: 25, color: "#3a2418", accent: "#c9a44c" },
  { id: "watch-commute", name: "Commute Watch", description: "A quiet steel watch.", price: 210, slot: "accessory", category: "accessories", store: "luxury", collection: "professional", level: 25, skill: { path: "career", level: 3 }, color: "#c9a44c", accent: "#1a1206", bonus: { stat: "taskPay", amount: 0.02 } },

  { id: "coat-camel", name: "Camel Coat", description: "Long wool for the plaza.", price: 680, slot: "upper", category: "clothing", store: "luxury", collection: "luxury", level: 50, color: "#c4a882", accent: "#3a2418", bonus: { stat: "hotel", amount: 0.04 } },
  { id: "silk-blouse", name: "Silk Blouse", description: "Soft sheen, city evening.", price: 420, slot: "upper", category: "clothing", store: "luxury", collection: "luxury", level: 50, color: "#e8dcc8", accent: "#8a5a3a" },
  { id: "trouser-crepe", name: "Crepe Trousers", description: "Draped luxury wool.", price: 390, slot: "lower", category: "clothing", store: "luxury", collection: "luxury", level: 50, color: "#1a1206", accent: "#c9a44c" },
  { id: "heel-plaza", name: "Plaza Heels", description: "Evening shoes.", price: 360, slot: "feet", category: "clothing", store: "luxury", collection: "luxury", level: 50, color: "#1a1206", accent: "#c9a44c" },
  { id: "scarf-gold", name: "Gold Scarf", description: "A light evening wrap.", price: 240, slot: "accessory", category: "accessories", store: "luxury", collection: "luxury", level: 50, skill: { path: "fashion", level: 8 }, color: "#c9a44c", accent: "#f4f1ea", bonus: { stat: "discount", amount: 0.02 } },

  { id: "jacket-night", name: "Nightline Jacket", description: "Exclusive runway black.", price: 980, slot: "upper", category: "clothing", store: "luxury", collection: "exclusive", level: 75, skill: { path: "fashion", level: 12 }, color: "#101826", accent: "#c9a44c", bonus: { stat: "discount", amount: 0.03 } },
  { id: "pant-night", name: "Nightline Pants", description: "Matched evening trousers.", price: 640, slot: "lower", category: "clothing", store: "luxury", collection: "exclusive", level: 75, color: "#101826", accent: "#e8dcc8" },
  { id: "boot-night", name: "Nightline Boots", description: "Soft leather, quiet sole.", price: 720, slot: "feet", category: "clothing", store: "luxury", collection: "exclusive", level: 75, color: "#1a1206", accent: "#c9a44c", bonus: { stat: "walk", amount: 0.02 } },
  { id: "hat-night", name: "Nightline Hat", description: "A low exclusive brim.", price: 310, slot: "head", category: "accessories", store: "luxury", collection: "exclusive", level: 75, color: "#1a1206", accent: "#c9a44c" },

  { id: "cloak-legend", name: "Riverside Legend Coat", description: "The city's highest cut.", price: 2500, slot: "upper", category: "clothing", store: "luxury", collection: "legendary", level: 100, color: "#c9a44c", accent: "#1a1206", bonus: { stat: "xpGain", amount: 0.05 } },
  { id: "boot-legend", name: "Legend Boots", description: "Walk the whole map in them.", price: 1800, slot: "feet", category: "clothing", store: "luxury", collection: "legendary", level: 100, color: "#1a1206", accent: "#c9a44c", bonus: { stat: "walk", amount: 0.05 } },
  { id: "pin-legend", name: "Founder's Pin", description: "A tiny gold river.", price: 900, slot: "accessory", category: "accessories", store: "luxury", collection: "legendary", level: 100, color: "#c9a44c", accent: "#f4f1ea", bonus: { stat: "salary", amount: 0.05 } },
];

export const STARTER_CLOTHING = ["tee-harbor", "jeans-indigo", "kicks-river"];

export function clothingById(id: string) {
  return CLOTHING.find((item) => item.id === id) ?? null;
}

export function clothingInStore(store: ClothStore) {
  return CLOTHING.filter((item) => item.store === store);
}

export const EMPTY_SLOTS: Record<ClothSlot, string | null> = {
  head: null,
  upper: null,
  lower: null,
  feet: null,
  accessory: null,
};

export type OutfitSlots = Record<ClothSlot, string | null>;

/** Worn slots after an optional shop/menu preview override. */
export function wornSlots(slots: OutfitSlots, previewId?: string | null): OutfitSlots {
  const worn = { ...slots };
  if (previewId) {
    const item = clothingById(previewId);
    if (item) worn[item.slot] = item.id;
  }
  return worn;
}

/** A short readable description of the character's current look. */
export function outfitLook(slots: OutfitSlots, previewId?: string | null) {
  const worn = wornSlots(slots, previewId);
  const head = clothingById(worn.head ?? "");
  const upper = clothingById(worn.upper ?? "");
  const lower = clothingById(worn.lower ?? "");
  const feet = clothingById(worn.feet ?? "");
  const accessory = clothingById(worn.accessory ?? "");
  const clothes = [upper, lower, feet].filter(Boolean) as { name: string; description: string }[];
  const body =
    clothes.length === 0
      ? "standing in street clothes that have not been equipped yet"
      : clothes.length === 1
        ? `wearing ${clothes[0].name}`
        : clothes.length === 2
          ? `wearing ${clothes[0].name} and ${clothes[1].name}`
          : `wearing ${clothes[0].name}, ${clothes[1].name}, and ${clothes[2].name}`;
  const extras: string[] = [];
  extras.push(head ? head.name.toLowerCase() : "no hat");
  extras.push(accessory ? accessory.name.toLowerCase() : "no bag or jewelry");
  const detail = [upper?.description, lower?.description].filter(Boolean).join(" ");
  return {
    headline: `A Riverside walker ${body}.`,
    extras: extras.join(" · "),
    detail: detail || "Change a slot on the right to restyle this look.",
  };
}

export interface SavedOutfit {
  id: string;
  name: string;
  slots: OutfitSlots;
}
