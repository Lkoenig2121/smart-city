export interface ListedStock {
  symbol: string;
  name: string;
  city: boolean;
  base: number;
}

export interface StockQuote extends ListedStock {
  price: number;
  change: number;
}

export interface PortfolioLot {
  shares: number;
  basis: number;
}

export interface Portfolio {
  cash: number;
  lots: Record<string, PortfolioLot>;
}

const STORAGE = "smartcity-brokerage";
const STARTING_CASH = 25_000;

export const LISTED_STOCKS: ListedStock[] = [
  { symbol: "AAPL", name: "Apple", city: false, base: 228 },
  { symbol: "MSFT", name: "Microsoft", city: false, base: 418 },
  { symbol: "GOOGL", name: "Alphabet", city: false, base: 172 },
  { symbol: "AMZN", name: "Amazon", city: false, base: 186 },
  { symbol: "NVDA", name: "NVIDIA", city: false, base: 124 },
  { symbol: "TSLA", name: "Tesla", city: false, base: 248 },
  { symbol: "JPM", name: "JPMorgan", city: false, base: 212 },
  { symbol: "XOM", name: "Exxon Mobil", city: false, base: 118 },
  { symbol: "RVNS", name: "Riverside Ravens", city: true, base: 41 },
  { symbol: "HELI", name: "Helio Hospitality", city: true, base: 67 },
  { symbol: "RIVR", name: "Riverside Holdings", city: true, base: 54 },
  { symbol: "HARB", name: "Harbor House REIT", city: true, base: 33 },
];

export function syntheticQuote(stock: ListedStock, minuteOfDay: number): StockQuote {
  const wave = Math.sin(minuteOfDay / 37 + stock.base) * 0.035;
  const wobble = Math.sin(minuteOfDay / 11 + stock.symbol.length) * 0.012;
  const price = Math.max(1.5, stock.base * (1 + wave + wobble));
  const prev = Math.max(1.5, stock.base * (1 + Math.sin((minuteOfDay - 30) / 37 + stock.base) * 0.035));
  return { ...stock, price, change: price - prev };
}

export function readPortfolio(): Portfolio {
  if (typeof window === "undefined") return { cash: STARTING_CASH, lots: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object") return { cash: STARTING_CASH, lots: {} };
    const cash = Number((parsed as { cash?: unknown }).cash);
    const lotsRaw = (parsed as { lots?: unknown }).lots;
    const lots: Record<string, PortfolioLot> = {};
    if (lotsRaw && typeof lotsRaw === "object") {
      for (const [symbol, lot] of Object.entries(lotsRaw as Record<string, unknown>)) {
        if (!lot || typeof lot !== "object") continue;
        const shares = Number((lot as { shares?: unknown }).shares);
        const basis = Number((lot as { basis?: unknown }).basis);
        if (shares > 0 && Number.isFinite(basis)) lots[symbol] = { shares, basis };
      }
    }
    return { cash: Number.isFinite(cash) ? cash : STARTING_CASH, lots };
  } catch {
    return { cash: STARTING_CASH, lots: {} };
  }
}

function writePortfolio(portfolio: Portfolio) {
  window.localStorage.setItem(STORAGE, JSON.stringify(portfolio));
}

export function buyShares(symbol: string, shares: number, price: number): Portfolio | string {
  const qty = Math.floor(shares);
  if (qty < 1) return "Buy at least one share.";
  const cost = qty * price;
  const next = readPortfolio();
  if (next.cash < cost) return "Not enough cash in the account.";
  const lot = next.lots[symbol] ?? { shares: 0, basis: 0 };
  const total = lot.shares + qty;
  lot.basis = (lot.basis * lot.shares + cost) / total;
  lot.shares = total;
  next.lots[symbol] = lot;
  next.cash -= cost;
  writePortfolio(next);
  return next;
}

export function sellShares(symbol: string, shares: number, price: number): Portfolio | string {
  const qty = Math.floor(shares);
  if (qty < 1) return "Sell at least one share.";
  const next = readPortfolio();
  const lot = next.lots[symbol];
  if (!lot || lot.shares < qty) return "You do not own that many shares.";
  lot.shares -= qty;
  next.cash += qty * price;
  if (lot.shares <= 0) delete next.lots[symbol];
  else next.lots[symbol] = lot;
  writePortfolio(next);
  return next;
}

export function formatPrice(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
