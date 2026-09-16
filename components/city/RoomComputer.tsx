"use client";

import {
  buyShares,
  formatPrice,
  readPortfolio,
  sellShares,
  type Portfolio,
  type StockQuote,
} from "@/lib/city/brokerage";
import { YoutubeApp } from "./YoutubeApp";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";

interface Props {
  minuteOfDay: number;
  onClose: () => void;
}

type AppId = "desktop" | "web" | "stocks" | "youtube";

interface SearchHit {
  title: string;
  snippet: string;
  url: string;
  image?: string;
}

export function RoomComputer({ minuteOfDay, onClose }: Props) {
  const [app, setApp] = useState<AppId>("desktop");
  const clock = formatMinutes(minuteOfDay);

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-[#071018]/70 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex h-[min(42rem,calc(100vh-2rem))] w-[min(54rem,calc(100%-1.5rem))] flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col rounded-[1.85rem] bg-gradient-to-b from-[#4a4e55] via-[#2a2d32] to-[#141618] p-[13px] pb-4 pt-3 shadow-[0_28px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/20">
          <div className="mb-2 flex items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6b7078] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.05rem] bg-[#101826] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0b1422] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 pl-1">
                  <button
                    type="button"
                    aria-label="Close laptop"
                    onClick={onClose}
                    className="-m-1 flex h-4 w-4 items-center justify-center"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]" />
                  </button>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </span>
                {app === "desktop" ? (
                  <p className="ml-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-sky-200/80">
                    Riverside OS
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setApp("desktop")}
                    className="ml-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-sky-200/80 hover:text-white"
                  >
                    ← Apps
                  </button>
                )}
              </div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {app === "youtube" ? "YouTube" : app === "stocks" ? "Stocks" : app === "web" ? "Web" : "Home"}
              </p>
              <div className="flex items-center gap-3">
                <p className="text-[0.65rem] tabular-nums text-amber-200/90">{clock}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  Sleep
                </button>
              </div>
            </div>
            {app === "desktop" ? (
              <Desktop onOpen={setApp} />
            ) : app === "web" ? (
              <WebApp minuteOfDay={minuteOfDay} />
            ) : app === "stocks" ? (
              <StockApp minuteOfDay={minuteOfDay} />
            ) : (
              <YoutubeApp minuteOfDay={minuteOfDay} />
            )}
          </div>
          <p className="mt-2.5 text-center text-[0.58rem] font-semibold tracking-[0.42em] text-zinc-400">
            RIVERSIDE
          </p>
        </div>
      </div>
    </div>
  );
}

function formatMinutes(minuteOfDay: number) {
  const hour24 = Math.floor(minuteOfDay / 60);
  const minute = Math.floor(minuteOfDay % 60);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

function Desktop({ onOpen }: { onOpen: (app: AppId) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,_#1b3350,_#0b1422_58%)] px-6 py-8">
      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-sky-200/70">Applications</p>
      <p className="mt-1 text-sm text-slate-300">Open an app on this laptop.</p>
      <div className="mt-8 grid grid-cols-3 gap-4">
        <AppIcon
          label="Web"
          hint="News & search"
          onClick={() => onOpen("web")}
          icon={
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-300 to-emerald-400 text-lg font-bold text-[#0a1a22]">
              W
            </span>
          }
        />
        <AppIcon
          label="Stocks"
          hint="Riverside Brokerage"
          onClick={() => onOpen("stocks")}
          icon={
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/90 text-lg font-bold text-[#082012]">
              $
            </span>
          }
        />
        <AppIcon
          label="YouTube"
          hint="Watch & search"
          onClick={() => onOpen("youtube")}
          icon={
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff0000]">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden>
                <path d="M8 5.14v13.72L19.5 12 8 5.14z" />
              </svg>
            </span>
          }
        />
      </div>
    </div>
  );
}

function AppIcon({
  label,
  hint,
  icon,
  onClick,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 px-3 py-4 hover:bg-white/10"
    >
      {icon}
      <span className="text-sm font-semibold text-white">{label}</span>
      <span className="text-[0.65rem] text-slate-400">{hint}</span>
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
      <form onSubmit={search} className="flex gap-2 border-b border-white/10 bg-[#0d1828] px-4 py-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the web"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#071018] px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-gradient-to-br from-sky-300 to-emerald-400 px-4 py-2 text-sm font-semibold text-[#0a1a22] disabled:opacity-60"
        >
          {loading ? "…" : "Search"}
        </button>
      </form>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
        {error ? <p className="mb-2 shrink-0 text-xs text-rose-300">{error}</p> : null}
        {article ? (
          <article className="min-h-0 flex-1 overflow-y-auto">
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
        ) : searched ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
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
          </div>
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
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 32 });

  const syncThumb = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const visible = Math.max(clientHeight, 1);
    const total = Math.max(scrollHeight, 1);
    const height = Math.max(32, (visible / total) * visible);
    const maxTop = Math.max(0, visible - height);
    const top = total <= visible ? 0 : (scrollTop / (total - visible)) * maxTop;
    setThumb({ top, height });
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncThumb();
    el.addEventListener("scroll", syncThumb, { passive: true });
    const ro = new ResizeObserver(syncThumb);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncThumb);
      ro.disconnect();
    };
  }, [stories.length]);

  const dragThumb = (event: PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    event.preventDefault();
    const track = event.currentTarget.parentElement;
    if (!track) return;
    const startY = event.clientY;
    const startTop = thumb.top;
    const move = (next: globalThis.PointerEvent) => {
      const maxTop = Math.max(0, track.clientHeight - thumb.height);
      const nextTop = Math.min(maxTop, Math.max(0, startTop + (next.clientY - startY)));
      const range = el.scrollHeight - el.clientHeight;
      el.scrollTop = maxTop <= 0 ? 0 : (nextTop / maxTop) * range;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col">
      <p className="shrink-0 text-[0.65rem] uppercase tracking-[0.18em] text-sky-200/70">Today’s news</p>
      <p className="mt-1 shrink-0 text-sm text-slate-300">Riverside Gazette and the wider web.</p>
      {loading && stories.length === 0 ? <p className="mt-3 shrink-0 text-sm text-slate-500">Loading headlines…</p> : null}
      <div className="mt-3 flex h-0 min-h-0 flex-1 gap-2">
        <ul ref={scrollerRef} className="room-news-scroll min-h-0 flex-1 space-y-2 pr-1">
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
        <div className="relative w-2.5 shrink-0 rounded-full bg-[#3a424d]">
          <div
            className="absolute inset-x-0 cursor-pointer rounded-full bg-[#9aa3ad]"
            style={{ top: thumb.top, height: thumb.height }}
            onPointerDown={dragThumb}
          />
        </div>
      </div>
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
