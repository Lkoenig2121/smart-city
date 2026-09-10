"use client";

import {
  buyShares,
  formatPrice,
  readPortfolio,
  sellShares,
  type Portfolio,
  type StockQuote,
} from "@/lib/city/brokerage";
import { useEffect, useState, type FormEvent } from "react";

interface Props {
  minuteOfDay: number;
  onClose: () => void;
}

type Tab = "web" | "stocks";

interface SearchHit {
  title: string;
  snippet: string;
  url: string;
  image?: string;
}

export function RoomComputer({ minuteOfDay, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("web");

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-black/55 p-3"
      onClick={onClose}
    >
      <div
        className="flex h-[min(40rem,calc(100vh-2rem))] w-[min(52rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-500/40 bg-[#0d1117] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-2.5">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-sky-300">Riverside OS</p>
          <div className="flex gap-1 rounded-lg bg-black/40 p-0.5">
            <TabButton active={tab === "web"} onClick={() => setTab("web")} label="Web" />
            <TabButton active={tab === "stocks"} onClick={() => setTab("stocks")} label="Stocks" />
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            Sleep
          </button>
        </div>
        {tab === "web" ? <WebApp minuteOfDay={minuteOfDay} /> : <StockApp minuteOfDay={minuteOfDay} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-semibold ${
        active ? "bg-sky-400 text-[#082032]" : "text-slate-300 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function cityNews(minuteOfDay: number): NewsStory[] {
  const hour = Math.floor(minuteOfDay / 60);
  const stories: NewsStory[] = [
    {
      title: "Ravens set for a packed night at the ballpark",
      snippet: "Downtown hotels report a bump in walk-ins as fans fill the streets around Ravens Ballpark.",
      url: "",
      source: "Riverside Gazette",
      topic: "Baseball park",
    },
    {
      title: "Harbor House listings stay tight",
      snippet: "Residences along the river say the roof deck is the amenity renters ask for first.",
      url: "",
      source: "Riverside Gazette",
      topic: "Apartment",
    },
    {
      title: "Helio Grand front desk sees late check-ins",
      snippet: "The concierge says city-view suites are booked through the weekend.",
      url: "",
      source: "Riverside Gazette",
      topic: "Hotel",
    },
  ];
  if (hour < 7 || hour >= 19) {
    stories.unshift({
      title: "Night markets stay open along the river",
      snippet: "Plaza stalls keep serving while the towers across the water go dark floor by floor.",
      url: "",
      source: "Riverside Gazette",
      topic: "Night market",
    });
  }
  return stories;
}

interface NewsStory {
  title: string;
  snippet: string;
  url: string;
  source: string;
  image?: string;
  topic?: string;
}

function WebApp({ minuteOfDay }: { minuteOfDay: number }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [news, setNews] = useState<NewsStory[]>(() => cityNews(minuteOfDay));
  const [article, setArticle] = useState<{ title: string; extract: string; url: string; image: string } | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch("/api/news");
        const data = (await res.json()) as { items?: NewsStory[] };
        if (!live || !data.items?.length) return;
        setNews([...cityNews(minuteOfDay), ...data.items]);
      } catch {
        if (live) setNews(cityNews(minuteOfDay));
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [minuteOfDay]);

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    setError(null);
    setArticle(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { error?: string; answer?: string; results?: SearchHit[] };
      if (!res.ok) throw new Error(data.error ?? "Search failed.");
      setAnswer(data.answer ?? "");
      setHits(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setHits([]);
    } finally {
      setLoading(false);
    }
  };

  const openHit = async (hit: SearchHit & { topic?: string; keepTitle?: boolean; keepExtract?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const lookup = hit.topic ?? hit.title;
      const res = await fetch(`/api/search/page?title=${encodeURIComponent(lookup)}`);
      const data = (await res.json()) as {
        error?: string;
        title?: string;
        extract?: string;
        url?: string;
        image?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not open that page.");
      setArticle({
        title: hit.keepTitle ? hit.title : (data.title ?? hit.title),
        extract: hit.keepExtract ? hit.snippet : (data.extract ?? hit.snippet),
        url: data.url ?? hit.url,
        image: data.image ?? hit.image ?? "",
      });
    } catch (err) {
      setArticle({ title: hit.title, extract: hit.snippet, url: hit.url, image: hit.image ?? "" });
      setError(err instanceof Error ? err.message : null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={search} className="flex gap-2 border-b border-white/10 px-4 py-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the web"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-sky-400 px-3.5 py-2 text-sm font-semibold text-[#082032] disabled:opacity-60"
        >
          {loading ? "…" : "Search"}
        </button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}
        {article ? (
          <article>
            <button onClick={() => setArticle(null)} className="text-xs font-semibold text-sky-300">
              ← {searched ? "Results" : "News"}
            </button>
            <h2 className="mt-2 text-lg font-semibold text-white">{article.title}</h2>
            {article.image ? (
              <img
                src={article.image}
                alt=""
                referrerPolicy="no-referrer"
                className="mt-3 h-48 w-full rounded-xl object-cover"
              />
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{article.extract}</p>
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-semibold text-sky-300 hover:underline"
              >
                Open full page
              </a>
            ) : null}
          </article>
        ) : (
          <>
            {searched ? (
              <>
                <button
                  onClick={() => {
                    setSearched(false);
                    setHits([]);
                    setAnswer("");
                    setError(null);
                  }}
                  className="mb-3 text-xs font-semibold text-sky-300"
                >
                  ← News
                </button>
                {answer ? <p className="mb-3 text-sm text-slate-200">{answer}</p> : null}
                {hits.length === 0 && !loading ? (
                  <p className="text-sm text-slate-500">No results. Try another search.</p>
                ) : null}
                <ul className="space-y-2">
                  {hits.map((hit) => (
                    <li key={`${hit.title}-${hit.url}`}>
                      <button
                        onClick={() => void openHit(hit)}
                        className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-left hover:bg-white/10"
                      >
                        <span className="block text-sm font-semibold text-sky-200">{hit.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{hit.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <NewsPage
                stories={news}
                loading={loading}
                onOpen={(story) => {
                  void openHit({
                    ...story,
                    keepTitle: !story.url,
                    keepExtract: !story.url,
                    topic: story.topic ?? story.title,
                  });
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NewsPage({
  stories,
  loading,
  onOpen,
}: {
  stories: NewsStory[];
  loading: boolean;
  onOpen: (story: NewsStory) => void;
}) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">Today’s news</p>
      <p className="mt-1 text-sm text-slate-300">Riverside Gazette and the wider web.</p>
      {loading && stories.length === 0 ? <p className="mt-3 text-sm text-slate-500">Loading headlines…</p> : null}
      <ul className="mt-3 space-y-2">
        {stories.map((story) => (
          <li key={`${story.source}-${story.title}`}>
            <button
              onClick={() => onOpen(story)}
              className="flex w-full gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-left hover:bg-white/10"
            >
              {story.image ? (
                <img src={story.image} alt="" referrerPolicy="no-referrer" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
              ) : null}
              <span className="min-w-0">
                <span className="block text-[0.6rem] uppercase tracking-[0.16em] text-amber-300/80">{story.source}</span>
                <span className="mt-0.5 block text-sm font-semibold text-sky-200">{story.title}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{story.snippet}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StockApp({ minuteOfDay }: { minuteOfDay: number }) {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio>(() => readPortfolio());
  const [shares, setShares] = useState(1);
  const [picked, setPicked] = useState<string>("AAPL");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/stocks?minute=${Math.floor(minuteOfDay)}`);
        const data = (await res.json()) as { quotes?: StockQuote[] };
        if (!live) return;
        setQuotes(data.quotes ?? []);
      } catch {
        if (live) setMessage("Quotes are delayed. Try again in a moment.");
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [minuteOfDay]);

  const quote = quotes.find((item) => item.symbol === picked);
  const trade = (side: "buy" | "sell") => {
    if (!quote) return;
    const next = side === "buy" ? buyShares(quote.symbol, shares, quote.price) : sellShares(quote.symbol, shares, quote.price);
    if (typeof next === "string") {
      setMessage(next);
      return;
    }
    setPortfolio(next);
    setMessage(side === "buy" ? `Bought ${Math.floor(shares)} ${quote.symbol}` : `Sold ${Math.floor(shares)} ${quote.symbol}`);
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_15rem]">
      <div className="min-h-0 overflow-y-auto border-b border-white/10 px-4 py-3 md:border-b-0 md:border-r">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">Riverside Brokerage</p>
            <p className="text-sm text-slate-300">Live listings · city issues included</p>
          </div>
          <label className="text-xs text-slate-400">
            Shares
            <input
              type="number"
              min={1}
              value={shares}
              onChange={(event) => setShares(Number(event.target.value))}
              className="ml-2 w-16 rounded-md border border-white/10 bg-[#0b1220] px-2 py-1 text-white"
            />
          </label>
        </div>
        {loading ? <p className="text-sm text-slate-500">Loading quotes…</p> : null}
        <div className="space-y-1.5">
          {quotes.map((item) => {
            const up = item.change >= 0;
            return (
              <button
                key={item.symbol}
                onClick={() => setPicked(item.symbol)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                  picked === item.symbol ? "bg-sky-400/15 ring-1 ring-sky-400/40" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold text-white">
                    {item.symbol}
                    {item.city ? <span className="ml-1.5 text-[0.6rem] font-medium text-amber-300">CITY</span> : null}
                  </span>
                  <span className="text-xs text-slate-400">{item.name}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold text-white">{formatPrice(item.price)}</span>
                  <span className={`text-xs ${up ? "text-emerald-300" : "text-rose-300"}`}>
                    {up ? "+" : ""}
                    {formatPrice(item.change)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">Cash</p>
          <p className="text-lg font-semibold text-white">{formatPrice(portfolio.cash)}</p>
        </div>
        {quote ? (
          <div className="flex gap-2">
            <button
              onClick={() => trade("buy")}
              className="flex-1 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-[#082012]"
            >
              Buy {quote.symbol}
            </button>
            <button
              onClick={() => trade("sell")}
              className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Sell
            </button>
          </div>
        ) : null}
        {message ? <p className="text-xs text-sky-200">{message}</p> : null}
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">Holdings</p>
          {Object.keys(portfolio.lots).length === 0 ? (
            <p className="mt-1 text-xs text-slate-500">No positions yet.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {Object.entries(portfolio.lots).map(([symbol, lot]) => {
                const mark = quotes.find((item) => item.symbol === symbol)?.price ?? lot.basis;
                return (
                  <li key={symbol} className="text-xs text-slate-300">
                    <span className="font-semibold text-white">{symbol}</span> · {lot.shares} @ {formatPrice(mark)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
