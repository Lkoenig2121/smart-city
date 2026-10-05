export type ConsumableKind = "drink" | "food" | "goods";

export interface ConsumableItem {
  id: string;
  name: string;
  detail: string;
  price: number;
  kind: ConsumableKind;
  color: string;
  accent: string;
}

export const CONSUMABLES: ConsumableItem[] = [
  { id: "drink-water", name: "Sparkling water", detail: "Lime wedge", price: 3, kind: "drink", color: "#d7eef8", accent: "#6b8f3a" },
  { id: "drink-tea", name: "Iced tea", detail: "Unsweetened", price: 4, kind: "drink", color: "#8b5a2b", accent: "#e8c36a" },
  { id: "drink-lemonade", name: "Lemonade", detail: "House squeeze", price: 4, kind: "drink", color: "#f2e27a", accent: "#f4f1ea" },
  { id: "drink-espresso", name: "Espresso", detail: "Short and cold", price: 5, kind: "drink", color: "#3d2918", accent: "#f4f1ea" },
  { id: "drink-punch", name: "Poolside punch", detail: "Pineapple · soda", price: 8, kind: "drink", color: "#e67e22", accent: "#f4f1ea" },
  { id: "drink-soda", name: "Fountain soda", detail: "Crushed ice", price: 3, kind: "drink", color: "#c0392b", accent: "#f4f1ea" },
  { id: "food-ice-cream", name: "Ice cream", detail: "Soft serve", price: 6, kind: "food", color: "#f4f1ea", accent: "#d48aa8" },
  { id: "food-fruit", name: "Fruit cup", detail: "Melon · berries", price: 7, kind: "food", color: "#e67e22", accent: "#c0392b" },
  { id: "food-nachos", name: "Nachos", detail: "Cheese · salsa", price: 9, kind: "food", color: "#e8c36a", accent: "#c0392b" },
  { id: "food-pretzel", name: "Soft pretzel", detail: "Salted twist", price: 5, kind: "food", color: "#c45c4a", accent: "#e8c36a" },
  { id: "food-cookie", name: "Mall cookie", detail: "Warm chocolate chip", price: 4, kind: "food", color: "#6a3a32", accent: "#c9a44c" },
  { id: "food-club", name: "Club sandwich", detail: "Fries on the side", price: 13, kind: "food", color: "#e8dcc8", accent: "#6b4a32" },
  { id: "food-catch", name: "Grilled catch", detail: "Today's fish", price: 16, kind: "food", color: "#d4c4a8", accent: "#2f7a3e" },
  { id: "food-pizza", name: "Slice pizza", detail: "Cheese · hot", price: 6, kind: "food", color: "#e8c36a", accent: "#c0392b" },
  { id: "food-burger", name: "Hamburger", detail: "Pickle · fries", price: 11, kind: "food", color: "#6a3a32", accent: "#e8c36a" },
  { id: "food-hotdog", name: "Hot dog", detail: "Mustard · bun", price: 7, kind: "food", color: "#c45c4a", accent: "#e8c36a" },
  { id: "food-fries", name: "Fries", detail: "Salted, in a cup", price: 4, kind: "food", color: "#e8c36a", accent: "#c45c4a" },
  { id: "food-noodles", name: "Wok noodles", detail: "Garlic · greens", price: 10, kind: "food", color: "#c45c4a", accent: "#f4f1ea" },
  { id: "drink-smoothie", name: "Berry smoothie", detail: "Iced blend", price: 6, kind: "drink", color: "#d48aa0", accent: "#f4f1ea" },
  // Ballpark concessions
  { id: "food-nachos-loaded", name: "Loaded nachos", detail: "Jalapeños · extra cheese", price: 11, kind: "food", color: "#e8c36a", accent: "#3d7a3a" },
  { id: "food-chili-dog", name: "Chili dog", detail: "Chili · onions", price: 9, kind: "food", color: "#8b3a22", accent: "#e8c36a" },
  { id: "food-relish-dog", name: "Relish dog", detail: "Sweet relish · mustard", price: 8, kind: "food", color: "#c45c4a", accent: "#6b8f3a" },
  { id: "food-pretzel-cheese", name: "Pretzel & cheese dip", detail: "Warm cheddar cup", price: 7, kind: "food", color: "#c47a2c", accent: "#e8c36a" },
  { id: "food-cheeseburger", name: "Cheeseburger", detail: "American cheese · pickles", price: 12, kind: "food", color: "#8b5a2b", accent: "#e8c36a" },
  { id: "food-sundae", name: "Sundae", detail: "Fudge · cherry", price: 8, kind: "food", color: "#f4f1ea", accent: "#6a3a32" },
  { id: "food-cotton-candy", name: "Cotton candy", detail: "Pink swirl", price: 5, kind: "food", color: "#e8a0d0", accent: "#f4f1ea" },
  { id: "food-popcorn", name: "Popcorn", detail: "Buttered bucket", price: 6, kind: "food", color: "#f4e7b0", accent: "#c0392b" },
  // Pizza
  { id: "food-pizza-pepperoni", name: "Pepperoni slice", detail: "Crispy cups", price: 7, kind: "food", color: "#e8c36a", accent: "#b83218" },
  { id: "food-pizza-extra", name: "Extra cheese slice", detail: "Double mozzarella", price: 7, kind: "food", color: "#f2dc8a", accent: "#e8c36a" },
  { id: "food-pizza-margherita", name: "Margherita pie", detail: "Basil · fresh mozz", price: 18, kind: "food", color: "#e8c36a", accent: "#3d7a3a" },
  { id: "food-pizza-supreme", name: "Supreme pie", detail: "Sausage · peppers · olives", price: 22, kind: "food", color: "#d8a85a", accent: "#2f5d3a" },
  { id: "food-calzone", name: "Calzone", detail: "Ricotta · marinara", price: 12, kind: "food", color: "#d8a85a", accent: "#c0392b" },
  { id: "food-garlic-knots", name: "Garlic knots", detail: "Parmesan · parsley", price: 6, kind: "food", color: "#e8d09a", accent: "#6b8f3a" },
  { id: "food-cannoli", name: "Cannoli", detail: "Sweet ricotta", price: 5, kind: "food", color: "#f0e2c0", accent: "#6a3a32" },
  { id: "drink-italian-soda", name: "Italian soda", detail: "Blood orange", price: 4, kind: "drink", color: "#e0602a", accent: "#f4f1ea" },
  { id: "food-chips-salt", name: "Salted chips", detail: "Crispy bag", price: 2, kind: "food", color: "#f2c200", accent: "#c0392b" },
  { id: "food-chips-bbq", name: "BBQ chips", detail: "Smoky bag", price: 2, kind: "food", color: "#c45c26", accent: "#f2c200" },
  { id: "food-chips-onion", name: "Onion chips", detail: "Sour cream", price: 2, kind: "food", color: "#7ec86a", accent: "#f4f1ea" },
  { id: "food-puffs", name: "Cheese puffs", detail: "Orange curls", price: 2, kind: "food", color: "#f0a020", accent: "#e23b2f" },
  { id: "food-pretzel-bag", name: "Pretzel twists", detail: "Salted bag", price: 2, kind: "food", color: "#e8c36a", accent: "#6b4a32" },
  { id: "food-tortilla", name: "Tortilla chips", detail: "Corn bag", price: 2, kind: "food", color: "#e8a317", accent: "#c0392b" },
  { id: "food-chocolate", name: "Chocolate bar", detail: "Milk chocolate", price: 2, kind: "food", color: "#6a3a32", accent: "#e8c36a" },
  { id: "food-cookie-pack", name: "Cookie pack", detail: "Chocolate chip", price: 2, kind: "food", color: "#c47a3a", accent: "#f4f1ea" },
  { id: "food-candy", name: "Gummy candy", detail: "Fruit bag", price: 2, kind: "food", color: "#e23b6a", accent: "#f2c200" },
  { id: "drink-cola", name: "Cola", detail: "Cold can", price: 2, kind: "drink", color: "#c0392b", accent: "#1a1a1a" },
  { id: "drink-juice", name: "Orange juice", detail: "Bottle", price: 3, kind: "drink", color: "#f0a020", accent: "#f4f1ea" },
];

export type VendFace =
  | "chips"
  | "bbq"
  | "onion"
  | "puffs"
  | "pretzel"
  | "tortilla"
  | "chocolate"
  | "cookie"
  | "candy"
  | "cola"
  | "water"
  | "juice";

/** Glass-case layout for the hospital vending machines. */
export const VENDING_ROWS: Array<Array<{ id: string; face: VendFace }>> = [
  [
    { id: "food-chips-salt", face: "chips" },
    { id: "food-chips-bbq", face: "bbq" },
    { id: "food-chips-onion", face: "onion" },
  ],
  [
    { id: "food-puffs", face: "puffs" },
    { id: "food-pretzel-bag", face: "pretzel" },
    { id: "food-tortilla", face: "tortilla" },
  ],
  [
    { id: "food-chocolate", face: "chocolate" },
    { id: "food-cookie-pack", face: "cookie" },
    { id: "food-candy", face: "candy" },
  ],
  [
    { id: "drink-cola", face: "cola" },
    { id: "drink-water", face: "water" },
    { id: "drink-juice", face: "juice" },
  ],
];

/** What each ballpark stand actually sells — matches the sign over the counter. */
export const STADIUM_STAND_MENUS: Record<string, string[]> = {
  NACHOS: ["food-nachos", "food-nachos-loaded", "drink-soda"],
  "HOT DOGS": ["food-hotdog", "food-relish-dog", "food-chili-dog", "drink-soda"],
  PRETZELS: ["food-pretzel", "food-pretzel-cheese", "drink-lemonade"],
  BURGERS: ["food-cheeseburger", "food-fries", "drink-soda"],
  DRINKS: ["drink-soda", "drink-lemonade", "drink-water"],
  "ICE CREAM": ["food-ice-cream", "food-sundae"],
  PIZZA: ["food-pizza-pepperoni", "food-pizza-extra", "drink-soda"],
  PIZZERIA: ["food-pizza-margherita", "food-pizza-supreme", "food-calzone", "food-garlic-knots", "drink-italian-soda"],
  SWEETS: ["food-cotton-candy", "food-popcorn", "drink-lemonade"],
};

/** That's Amore, Riverside. */
export const PIZZERIA_MENU = [
  "food-pizza-margherita",
  "food-pizza-supreme",
  "food-pizza-pepperoni",
  "food-pizza",
  "food-calzone",
  "food-garlic-knots",
  "food-cannoli",
  "drink-italian-soda",
  "drink-lemonade",
  "drink-espresso",
];

export const FOOD_COURT_MENU = [
  "food-burger",
  "food-hotdog",
  "food-nachos",
  "food-pizza",
  "food-fries",
  "drink-soda",
  "drink-lemonade",
  "drink-smoothie",
  "drink-water",
] as const;

export function consumableById(id: string) {
  return CONSUMABLES.find((item) => item.id === id) ?? null;
}

export function bagCount(bag: Record<string, number>, id: string) {
  return Math.max(0, Math.floor(bag[id] ?? 0));
}

export function bagList(bag: Record<string, number>) {
  return CONSUMABLES.filter((item) => bagCount(bag, item.id) > 0);
}

export const CONSUME_BITES = 3;
export const DRINK_SIPS = CONSUME_BITES;
