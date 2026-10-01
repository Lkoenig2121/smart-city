import type { SkillPath } from "./skills";
import { BALLCLUBS } from "./stadium";

export type ClothSlot = "head" | "upper" | "lower" | "feet" | "accessory";
export type ClothStore =
  | "fashion"
  | "sneaker"
  | "luxury"
  | "department"
  | "jewelry"
  | "kids"
  | "gifts"
  | "home"
  | "outdoor"
  | "gallery"
  | "books"
  | "beauty"
  | "tech"
  | "music"
  | "sport"
  | "toys"
  | "ballpark"
  | "denim"
  | "hats"
  | "optics"
  | "bags"
  | "shoes"
  | "suits"
  | "swim"
  | "vintage"
  | "knit"
  | "street"
  | "yoga"
  | "rain"
  | "watch"
  | "formal"
  | "skate"
  | "western";
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
  /** Ballclub city id for team merch; only that club's park stocks it. */
  club?: string;
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
  { id: "jewelry", name: "Harbor Jewels", blurb: "Watches, rings, and evening pieces." },
  { id: "kids", name: "Little Harbor", blurb: "Small tees, caps, and sneakers." },
  { id: "gifts", name: "Atrium Gifts", blurb: "Wraps, pins, and take-home extras." },
  { id: "home", name: "Nest & Linen", blurb: "Soft loungewear for the apartment." },
  { id: "outdoor", name: "River Trail", blurb: "Shells and trail layers." },
  { id: "books", name: "Gallery Books", blurb: "Totes, readers, and quiet knits." },
  { id: "beauty", name: "Harbor Beauty", blurb: "Scarves, shades, and soft layers." },
  { id: "gallery", name: "North Gallery", blurb: "Runway and legendary cuts." },
  { id: "tech", name: "Harbor Tech", blurb: "Phones, buds, and night-walk kits." },
  { id: "music", name: "Atrium Records", blurb: "Headphones, caps, and band tees." },
  { id: "sport", name: "Court Sport", blurb: "Jerseys, shorts, and court shoes." },
  { id: "toys", name: "Sky Toys", blurb: "Kids packs, caps, and play layers." },
  { id: "ballpark", name: "Team Store", blurb: "Caps, jerseys, and game-day gear." },
  { id: "denim", name: "Indigo & Co", blurb: "Jeans, jackets, and denim caps." },
  { id: "hats", name: "Cap & Crown", blurb: "Fedoras, flat caps, and bucket hats." },
  { id: "optics", name: "Clear View Optics", blurb: "Frames and sunglasses." },
  { id: "bags", name: "Carry Goods", blurb: "Messengers, totes, and duffels." },
  { id: "shoes", name: "Step Shoe Co", blurb: "Boots, loafers, and slip-ons." },
  { id: "suits", name: "Tailor Row", blurb: "Suits, trousers, and ties." },
  { id: "swim", name: "Harbor Surf", blurb: "Board shorts and beach gear." },
  { id: "vintage", name: "Second Spin Vintage", blurb: "Retro finds and thrift classics." },
  { id: "knit", name: "Wool & Loom", blurb: "Sweaters, scarves, and gloves." },
  { id: "street", name: "Block Streetwear", blurb: "Hoodies, joggers, and high-tops." },
  { id: "yoga", name: "Flow Studio", blurb: "Yoga and lounge layers." },
  { id: "rain", name: "Drizzle Rainwear", blurb: "Slickers, rain hats, and boots." },
  { id: "watch", name: "Tick Tock Watches", blurb: "Dive, field, and smart watches." },
  { id: "formal", name: "Evening Hall", blurb: "Tuxedos, gowns, and patent shoes." },
  { id: "skate", name: "Ramp Skate Shop", blurb: "Skate tees, shorts, and shoes." },
  { id: "western", name: "Dustfall Outfitters", blurb: "Cowboy hats, pearl snaps, and boots." },
];

type Piece = [id: string, name: string, description: string, price: number, slot: ClothSlot, color: string, accent: string];

const MALL_PIECES: Partial<Record<ClothStore, Piece[]>> = {
  denim: [
    ["jeans-selvedge", "Selvedge Jeans", "Raw indigo that fades to you.", 120, "lower", "#22345a", "#c9a44c"],
    ["jacket-trucker", "Trucker Jacket", "A classic denim layer.", 150, "upper", "#3d5a80", "#e8dcc8"],
    ["cap-denim", "Denim Cap", "Washed indigo six-panel.", 30, "head", "#3d5a80", "#f4f1ea"],
  ],
  hats: [
    ["hat-fedora", "Wool Fedora", "A pinched crown for the plaza.", 85, "head", "#4a3a2e", "#1a1206"],
    ["hat-flat", "Flat Cap", "Tweed for the morning commute.", 45, "head", "#7a6a52", "#3a2418"],
    ["hat-bucket", "Bucket Hat", "Soft brim for sunny docks.", 32, "head", "#e8dcc8", "#2f5d4a"],
  ],
  optics: [
    ["shades-aviator", "Aviator Shades", "Gold rims, smoked lenses.", 95, "head", "#c9a44c", "#1a1206"],
    ["specs-round", "Round Frames", "Tortoiseshell readers.", 70, "head", "#6a3a22", "#e8dcc8"],
    ["shades-sport", "Sport Wraps", "Mirrored lenses for running.", 60, "head", "#1a1206", "#2aa3a0"],
  ],
  bags: [
    ["bag-messenger", "Leather Messenger", "Holds a laptop and lunch.", 140, "accessory", "#6a4a2a", "#c9a44c"],
    ["tote-canvas", "Canvas Tote", "Market-day essential.", 35, "accessory", "#e8dcc8", "#2f5d4a"],
    ["bag-duffel", "Weekender Duffel", "Packs for a hotel stay.", 110, "accessory", "#2f3a4a", "#c9a44c"],
  ],
  shoes: [
    ["boot-chelsea", "Chelsea Boots", "Elastic sides, suede finish.", 160, "feet", "#5a3a22", "#1a1206"],
    ["shoe-loafer", "Penny Loafers", "Polished slip-ons for the office.", 130, "feet", "#3a2418", "#c9a44c"],
    ["shoe-slipon", "Canvas Slip-ons", "Checkerboard weekend shoes.", 45, "feet", "#f4f1ea", "#1a1206"],
  ],
  suits: [
    ["suit-jacket", "Grey Suit Jacket", "Two buttons, notch lapel.", 380, "upper", "#5a6070", "#1a1206"],
    ["suit-trouser", "Suit Trousers", "Matching grey wool.", 180, "lower", "#5a6070", "#c9a44c"],
    ["tie-silk", "Silk Tie", "A deep burgundy knot.", 60, "accessory", "#7a2f3a", "#c9a44c"],
  ],
  swim: [
    ["short-board", "Board Shorts", "Quick-dry with a palm print.", 48, "lower", "#2aa3a0", "#f4f1ea"],
    ["top-rash", "Rash Guard", "Sun-proof long sleeves.", 55, "upper", "#1d2d4f", "#2aa3a0"],
    ["sandal-flip", "Flip Flops", "Boardwalk ready.", 18, "feet", "#e67e22", "#1a1206"],
  ],
  vintage: [
    ["jacket-retro", "Retro Windbreaker", "Color-blocked nineties shell.", 68, "upper", "#7a2f8a", "#2aa3a0"],
    ["pant-cord", "Corduroy Pants", "Wide wale, rust brown.", 52, "lower", "#8a4a22", "#e8dcc8"],
    ["shoe-bowling", "Bowling Shoes", "Two-tone and a little worn.", 58, "feet", "#c0392b", "#f4f1ea"],
  ],
  knit: [
    ["sweater-cable", "Cable Sweater", "Chunky cream wool.", 95, "upper", "#e8dcc8", "#8a6a4a"],
    ["scarf-plaid", "Plaid Scarf", "Red tartan for windy days.", 40, "accessory", "#a8322a", "#1d2d4f"],
    ["gloves-knit", "Knit Gloves", "Touchscreen fingertips.", 28, "accessory", "#3d5a80", "#e8dcc8"],
  ],
  street: [
    ["hoodie-graphic", "Graphic Hoodie", "Oversized with a city print.", 78, "upper", "#1a1206", "#e67e22"],
    ["jogger-cargo", "Cargo Joggers", "Pockets on pockets.", 70, "lower", "#4a5040", "#1a1206"],
    ["kicks-hightop", "High-top Sneakers", "Padded collars, bold laces.", 110, "feet", "#f4f1ea", "#c0392b"],
  ],
  yoga: [
    ["legging-studio", "Studio Leggings", "Four-way stretch.", 65, "lower", "#2c3036", "#7eb3e0"],
    ["tank-train", "Training Tank", "Breathable mesh back.", 38, "upper", "#7eb3e0", "#f4f1ea"],
    ["slide-studio", "Studio Slides", "Soft foam after class.", 30, "feet", "#e8c4d0", "#2c3036"],
  ],
  rain: [
    ["coat-slicker", "Rain Slicker", "Bright yellow and fully sealed.", 110, "upper", "#e8c32a", "#1a1206"],
    ["boot-rain", "Rain Boots", "Puddle-proof rubber.", 75, "feet", "#2f5d4a", "#e8c32a"],
    ["hat-rain", "Rain Hat", "A sou'wester brim.", 28, "head", "#e8c32a", "#1a1206"],
  ],
  watch: [
    ["watch-dive", "Dive Watch", "Rotating bezel, 200 m rated.", 260, "accessory", "#1d2d4f", "#c9cfd6"],
    ["watch-field", "Field Watch", "Canvas strap, easy-read dial.", 140, "accessory", "#4a5040", "#e8dcc8"],
    ["watch-smart", "Smart Watch", "Steps, calls, and the time.", 90, "accessory", "#1a1206", "#2aa3a0"],
  ],
  formal: [
    ["tux-velvet", "Velvet Tux Jacket", "Midnight velvet, satin lapels.", 520, "upper", "#1a1f3a", "#c9a44c"],
    ["gown-satin", "Satin Gown", "Floor-length emerald satin.", 480, "upper", "#1f6b4a", "#c9a44c"],
    ["shoe-patent", "Patent Shoes", "Mirror-shine evening shoes.", 220, "feet", "#0f0f12", "#c9a44c"],
  ],
  skate: [
    ["tee-skate", "Skate Tee", "Faded deck-logo print.", 30, "upper", "#c45c4a", "#f4f1ea"],
    ["short-skate", "Skate Shorts", "Loose fit, reinforced seat.", 40, "lower", "#4a5160", "#e8dcc8"],
    ["shoe-skate", "Skate Shoes", "Suede toe caps for ollies.", 80, "feet", "#2c3036", "#e8dcc8"],
  ],
  western: [
    ["hat-cowboy", "Cowboy Hat", "Felt crown, desert ready.", 90, "head", "#8a6a4a", "#3a2418"],
    ["shirt-snap", "Pearl Snap Shirt", "Western yokes and pearl buttons.", 70, "upper", "#b8d0e0", "#f4f1ea"],
    ["boot-western", "Western Boots", "Stitched leather with a riding heel.", 190, "feet", "#6a3a22", "#c9a44c"],
  ],
};

const MALL_ADDITIONS: ClothingItem[] = (Object.entries(MALL_PIECES) as Array<[ClothStore, Piece[]]>).flatMap(
  ([store, pieces]) =>
    pieces.map(([id, name, description, price, slot, color, accent]) => ({
      id,
      name,
      description,
      price,
      slot,
      category: slot === "head" || slot === "accessory" ? ("accessories" as const) : ("clothing" as const),
      store,
      collection: "everyday" as const,
      level: 1,
      color,
      accent,
    })),
);

const CREAM = "#f4f1ea";

/** Every club's merch table, sold only at that club's ballpark. */
const TEAM_MERCH: ClothingItem[] = Object.entries(BALLCLUBS).flatMap(([cityId, club]) => {
  const base = { store: "ballpark" as const, collection: "everyday" as const, level: 1, club: cityId };
  return [
    { ...base, id: `${cityId}-cap`, name: `${club.shortName} Cap`, description: `The fitted home cap from ${club.parkName}.`, price: 35, slot: "head" as const, category: "accessories" as const, color: club.accent, accent: CREAM },
    { ...base, id: `${cityId}-jersey`, name: `${club.shortName} Home Jersey`, description: `Pinstriped home whites with ${club.abbrev} across the chest.`, price: 120, slot: "upper" as const, category: "clothing" as const, color: CREAM, accent: club.accent },
    { ...base, id: `${cityId}-road-jersey`, name: `${club.shortName} Road Jersey`, description: `Away colors, as worn on the road.`, price: 120, slot: "upper" as const, category: "clothing" as const, color: club.accent, accent: CREAM },
    { ...base, id: `${cityId}-hoodie`, name: `${club.fullName} Hoodie`, description: "Heavy fleece for cool night games.", price: 85, slot: "upper" as const, category: "clothing" as const, color: club.accent, accent: CREAM },
    { ...base, id: `${cityId}-finger`, name: `${club.shortName} Foam Finger`, description: "We're number one. Loudly.", price: 20, slot: "accessory" as const, category: "accessories" as const, color: club.accent, accent: CREAM },
    { ...base, id: `${cityId}-pennant`, name: `${club.shortName} Pennant`, description: `A felt ${club.abbrev} pennant on a wooden stick.`, price: 15, slot: "accessory" as const, category: "accessories" as const, color: CREAM, accent: club.accent },
  ];
});

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

  // Career: Riverside / Dustfall police duty kit (granted on shift, not sold).
  { id: "police-shirt", name: "Police Shirt", description: "Navy duty shirt with shoulder patches.", price: 0, slot: "upper", category: "clothing", store: "department", collection: "professional", level: 1, color: "#1f4d8c", accent: "#c9a44c" },
  { id: "police-pants", name: "Police Pants", description: "Dark duty trousers with a reinforced seat.", price: 0, slot: "lower", category: "clothing", store: "department", collection: "professional", level: 1, color: "#1a2433", accent: "#c9a44c" },
  { id: "police-boots", name: "Police Boots", description: "Black duty boots.", price: 0, slot: "feet", category: "clothing", store: "department", collection: "professional", level: 1, color: "#12151a", accent: "#3a3a3a" },
  { id: "police-badge", name: "Police Badge", description: "Shield badge and radio mic.", price: 0, slot: "accessory", category: "accessories", store: "department", collection: "professional", level: 1, color: "#c9a44c", accent: "#1f4d8c" },

  { id: "blazer-navy", name: "Navy Blazer", description: "Office-ready wool blend.", price: 320, slot: "upper", category: "clothing", store: "fashion", collection: "professional", level: 25, skill: { path: "career", level: 4 }, color: "#1d2d4f", accent: "#c9a44c", bonus: { stat: "salary", amount: 0.03 } },
  { id: "shirt-poplin", name: "Poplin Shirt", description: "Crisp white for the tower.", price: 110, slot: "upper", category: "clothing", store: "department", collection: "professional", level: 25, color: "#f7f4ea", accent: "#3d5a80" },
  { id: "trouser-char", name: "Charcoal Trousers", description: "Tapered office trousers.", price: 160, slot: "lower", category: "clothing", store: "fashion", collection: "professional", level: 25, color: "#2c3036", accent: "#c9a44c" },
  { id: "oxford-town", name: "Town Oxfords", description: "Leather shoes for the office.", price: 180, slot: "feet", category: "clothing", store: "department", collection: "professional", level: 25, color: "#3a2418", accent: "#c9a44c" },
  { id: "watch-commute", name: "Commute Watch", description: "A quiet steel watch.", price: 210, slot: "accessory", category: "accessories", store: "jewelry", collection: "professional", level: 25, color: "#c9a44c", accent: "#1a1206", bonus: { stat: "taskPay", amount: 0.02 } },
  { id: "ring-harbor", name: "Harbor Band", description: "A slim river-gold ring.", price: 160, slot: "accessory", category: "accessories", store: "jewelry", collection: "everyday", level: 1, color: "#c9a44c", accent: "#e8dcc8" },
  { id: "studs-pearl", name: "Pearl Studs", description: "Small evening earrings.", price: 95, slot: "accessory", category: "accessories", store: "jewelry", collection: "everyday", level: 1, color: "#f4f1ea", accent: "#c9a44c" },

  { id: "tee-little", name: "Little Harbor Tee", description: "A soft kid-size river tee.", price: 28, slot: "upper", category: "clothing", store: "kids", collection: "everyday", level: 1, color: "#7eb3e0", accent: "#2f5d4a" },
  { id: "cap-little", name: "Little River Cap", description: "A small brim for sunny blocks.", price: 18, slot: "head", category: "accessories", store: "kids", collection: "everyday", level: 1, color: "#2aa3a0", accent: "#f4f1ea" },
  { id: "kicks-little", name: "Little Runners", description: "Bright sneakers that stay on.", price: 36, slot: "feet", category: "clothing", store: "kids", collection: "everyday", level: 1, color: "#e8dcc8", accent: "#c0392b" },

  { id: "wrap-market", name: "Market Wrap", description: "A light gift-shop shawl.", price: 48, slot: "accessory", category: "accessories", store: "gifts", collection: "everyday", level: 1, color: "#c45c4a", accent: "#f4f1ea" },
  { id: "beanie-harbor", name: "Harbor Beanie", description: "A take-home knit cap.", price: 22, slot: "head", category: "accessories", store: "gifts", collection: "everyday", level: 1, color: "#3d5a80", accent: "#c9a44c" },
  { id: "pin-mall", name: "Mall Pin", description: "A tiny atrium souvenir.", price: 12, slot: "accessory", category: "accessories", store: "gifts", collection: "everyday", level: 1, color: "#c9a44c", accent: "#1a1206" },

  { id: "robe-linen", name: "Linen Robe", description: "Apartment-soft lounge robe.", price: 120, slot: "upper", category: "clothing", store: "home", collection: "everyday", level: 1, color: "#e8dcc8", accent: "#6a3a32" },
  { id: "pant-lounge", name: "Lounge Pants", description: "Easy cotton for the sofa.", price: 70, slot: "lower", category: "clothing", store: "home", collection: "everyday", level: 1, color: "#cfc6b8", accent: "#3a2418" },
  { id: "slipper-nest", name: "Nest Slippers", description: "Quiet indoor shoes.", price: 40, slot: "feet", category: "clothing", store: "home", collection: "everyday", level: 1, color: "#6a5640", accent: "#e8dcc8" },

  { id: "shell-trail", name: "Trail Shell", description: "A packable rain layer.", price: 150, slot: "upper", category: "clothing", store: "outdoor", collection: "athletic", level: 1, color: "#3e8244", accent: "#1a1206", bonus: { stat: "run", amount: 0.02 } },
  { id: "pant-trail", name: "Trail Pants", description: "Light hiking trousers.", price: 95, slot: "lower", category: "clothing", store: "outdoor", collection: "athletic", level: 1, color: "#3f4d5c", accent: "#c9a44c" },
  { id: "boot-trail", name: "Trail Boots", description: "Grippy soles for the river path.", price: 140, slot: "feet", category: "clothing", store: "outdoor", collection: "athletic", level: 1, color: "#3a2418", accent: "#c9a44c", bonus: { stat: "walk", amount: 0.02 } },

  { id: "tote-gallery", name: "Gallery Tote", description: "A canvas bag from the second floor.", price: 32, slot: "accessory", category: "accessories", store: "books", collection: "everyday", level: 1, color: "#6a5640", accent: "#e8dcc8" },
  { id: "specs-read", name: "Reading Specs", description: "Clear frames for the bookshop.", price: 45, slot: "head", category: "accessories", store: "books", collection: "everyday", level: 1, color: "#1a1206", accent: "#c9a44c" },
  { id: "cardigan-stack", name: "Stack Cardigan", description: "A quiet knit for browsing.", price: 88, slot: "upper", category: "clothing", store: "books", collection: "everyday", level: 1, color: "#8a6a4a", accent: "#e8dcc8" },

  { id: "scarf-bloom", name: "Bloom Scarf", description: "A light wrap from the beauty counter.", price: 54, slot: "accessory", category: "accessories", store: "beauty", collection: "everyday", level: 1, color: "#d48aa0", accent: "#f4f1ea" },
  { id: "shades-atrium", name: "Atrium Shades", description: "Tinted lenses for the skylight.", price: 70, slot: "head", category: "accessories", store: "beauty", collection: "everyday", level: 1, color: "#1a1206", accent: "#c9a44c" },
  { id: "wrap-silk", name: "Silk Wrap Top", description: "A soft second-floor blouse.", price: 110, slot: "upper", category: "clothing", store: "beauty", collection: "everyday", level: 1, color: "#e8c4d0", accent: "#6a3a32" },

  { id: "buds-harbor", name: "Harbor Buds", description: "Wireless buds for the concourse.", price: 85, slot: "accessory", category: "accessories", store: "tech", collection: "everyday", level: 1, color: "#ece8e0", accent: "#2aa3a0" },
  { id: "band-pulse", name: "Pulse Band", description: "A slim wrist tracker.", price: 64, slot: "accessory", category: "accessories", store: "tech", collection: "everyday", level: 1, color: "#1a1206", accent: "#7eb3e0" },
  { id: "hoodie-nightwalk", name: "Nightwalk Hoodie", description: "Soft knit for late mall hours.", price: 92, slot: "upper", category: "clothing", store: "tech", collection: "everyday", level: 1, color: "#243656", accent: "#c9a44c" },

  { id: "tee-setlist", name: "Setlist Tee", description: "A faded atrium tour shirt.", price: 38, slot: "upper", category: "clothing", store: "music", collection: "everyday", level: 1, color: "#c45c4a", accent: "#f4f1ea" },
  { id: "cap-encore", name: "Encore Cap", description: "A low brim from the record shop.", price: 26, slot: "head", category: "accessories", store: "music", collection: "everyday", level: 1, color: "#1a1206", accent: "#c9a44c" },
  { id: "cans-studio", name: "Studio Cans", description: "Over-ear headphones on a headband.", price: 110, slot: "head", category: "accessories", store: "music", collection: "everyday", level: 1, color: "#2c3036", accent: "#c9a44c" },

  { id: "jersey-harbor", name: "Harbor Jersey", description: "Home colors for the court.", price: 72, slot: "upper", category: "clothing", store: "sport", collection: "athletic", level: 1, color: "#2aa3a0", accent: "#1a1206", bonus: { stat: "run", amount: 0.01 } },
  { id: "short-court", name: "Sky Court Shorts", description: "Light shorts for the third floor.", price: 42, slot: "lower", category: "clothing", store: "sport", collection: "athletic", level: 1, color: "#1d2d4f", accent: "#c9a44c" },
  { id: "kicks-sky", name: "Sky Court Shoes", description: "Grippy soles for the concourse.", price: 95, slot: "feet", category: "clothing", store: "sport", collection: "athletic", level: 1, color: "#ece8e0", accent: "#c0392b", bonus: { stat: "jump", amount: 0.03 } },

  { id: "pack-play", name: "Play Pack", description: "A tiny backpack from Sky Toys.", price: 24, slot: "accessory", category: "accessories", store: "toys", collection: "everyday", level: 1, color: "#e67e22", accent: "#f4f1ea" },
  { id: "cap-star", name: "Star Cap", description: "A bright kid brim.", price: 16, slot: "head", category: "accessories", store: "toys", collection: "everyday", level: 1, color: "#7eb3e0", accent: "#c9a44c" },
  { id: "tee-rocket", name: "Rocket Tee", description: "A small third-floor print.", price: 22, slot: "upper", category: "clothing", store: "toys", collection: "everyday", level: 1, color: "#c0392b", accent: "#f4f1ea" },

  { id: "coat-camel", name: "Camel Coat", description: "Long wool for the plaza.", price: 680, slot: "upper", category: "clothing", store: "luxury", collection: "luxury", level: 50, color: "#c4a882", accent: "#3a2418", bonus: { stat: "hotel", amount: 0.04 } },
  { id: "silk-blouse", name: "Silk Blouse", description: "Soft sheen, city evening.", price: 420, slot: "upper", category: "clothing", store: "luxury", collection: "luxury", level: 50, color: "#e8dcc8", accent: "#8a5a3a" },
  { id: "trouser-crepe", name: "Crepe Trousers", description: "Draped luxury wool.", price: 390, slot: "lower", category: "clothing", store: "luxury", collection: "luxury", level: 50, color: "#1a1206", accent: "#c9a44c" },
  { id: "heel-plaza", name: "Plaza Heels", description: "Evening shoes.", price: 360, slot: "feet", category: "clothing", store: "luxury", collection: "luxury", level: 50, color: "#1a1206", accent: "#c9a44c" },
  { id: "scarf-gold", name: "Gold Scarf", description: "A light evening wrap.", price: 240, slot: "accessory", category: "accessories", store: "luxury", collection: "luxury", level: 50, skill: { path: "fashion", level: 8 }, color: "#c9a44c", accent: "#f4f1ea", bonus: { stat: "discount", amount: 0.02 } },

  { id: "jacket-night", name: "Nightline Jacket", description: "Exclusive runway black.", price: 980, slot: "upper", category: "clothing", store: "gallery", collection: "exclusive", level: 75, color: "#101826", accent: "#c9a44c", bonus: { stat: "discount", amount: 0.03 } },
  { id: "pant-night", name: "Nightline Pants", description: "Matched evening trousers.", price: 640, slot: "lower", category: "clothing", store: "gallery", collection: "exclusive", level: 75, color: "#101826", accent: "#e8dcc8" },
  { id: "boot-night", name: "Nightline Boots", description: "Soft leather, quiet sole.", price: 720, slot: "feet", category: "clothing", store: "gallery", collection: "exclusive", level: 75, color: "#1a1206", accent: "#c9a44c", bonus: { stat: "walk", amount: 0.02 } },
  { id: "hat-night", name: "Nightline Hat", description: "A low exclusive brim.", price: 310, slot: "head", category: "accessories", store: "gallery", collection: "exclusive", level: 75, color: "#1a1206", accent: "#c9a44c" },

  { id: "cloak-legend", name: "Riverside Legend Coat", description: "The city's highest cut.", price: 2500, slot: "upper", category: "clothing", store: "gallery", collection: "legendary", level: 100, color: "#c9a44c", accent: "#1a1206", bonus: { stat: "xpGain", amount: 0.05 } },
  { id: "boot-legend", name: "Legend Boots", description: "Walk the whole map in them.", price: 1800, slot: "feet", category: "clothing", store: "gallery", collection: "legendary", level: 100, color: "#1a1206", accent: "#c9a44c", bonus: { stat: "walk", amount: 0.05 } },
  { id: "pin-legend", name: "Founder's Pin", description: "A tiny gold river.", price: 900, slot: "accessory", category: "accessories", store: "gallery", collection: "legendary", level: 100, color: "#c9a44c", accent: "#f4f1ea", bonus: { stat: "salary", amount: 0.05 } },

  ...TEAM_MERCH,
  ...MALL_ADDITIONS,
];

export const STARTER_CLOTHING = ["tee-harbor", "jeans-indigo", "kicks-river"];

/** Multi-slot duty look granted when a police shift starts. */
export const POLICE_UNIFORM_IDS = ["police-shirt", "police-pants", "police-boots", "police-badge"] as const;

export function clothingById(id: string) {
  return CLOTHING.find((item) => item.id === id) ?? null;
}

export function clothingInStore(store: ClothStore, club?: string) {
  return CLOTHING.filter(
    (item) => item.store === store && item.price > 0 && (item.club === undefined || item.club === club),
  );
}

export const EMPTY_SLOTS: Record<ClothSlot, string | null> = {
  head: null,
  upper: null,
  lower: null,
  feet: null,
  accessory: null,
};

export type OutfitSlots = Record<ClothSlot, string | null>;

export const POLICE_UNIFORM_SLOTS: OutfitSlots = {
  head: null,
  upper: "police-shirt",
  lower: "police-pants",
  feet: "police-boots",
  accessory: "police-badge",
};

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
