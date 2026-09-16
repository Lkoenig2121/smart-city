export type ConsumableKind = "drink" | "food";

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
