import { LISTED_STOCKS, syntheticQuote, type StockQuote } from "@/lib/city/brokerage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const minute = Number(request.nextUrl.searchParams.get("minute") ?? 720);
  const quotes: StockQuote[] = [];

  await Promise.all(
    LISTED_STOCKS.map(async (stock) => {
      if (stock.city) {
        quotes.push(syntheticQuote(stock, minute));
        return;
      }
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(stock.symbol)}?interval=1d&range=5d`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 SmartCity" },
          next: { revalidate: 60 },
        });
        if (!res.ok) throw new Error("quote failed");
        const data = (await res.json()) as {
          chart?: {
            result?: Array<{
              meta?: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number };
            }>;
          };
        };
        const meta = data.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice;
        if (!price || !Number.isFinite(price)) throw new Error("no price");
        const prev = meta?.previousClose ?? meta?.chartPreviousClose ?? price;
        quotes.push({ ...stock, price, change: price - prev });
      } catch {
        quotes.push(syntheticQuote(stock, minute));
      }
    }),
  );

  quotes.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return NextResponse.json({ quotes });
}
