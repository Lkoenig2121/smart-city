"use client";

import { formatViews, type YtVideo } from "@/lib/city/youtube";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";

export function YoutubeApp({ minuteOfDay }: { minuteOfDay: number }) {
  const seed = useRef(Math.floor(minuteOfDay) + 17);
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<YtVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState<YtVideo | null>(null);

  const load = async (nextQuery = "") => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextQuery) params.set("q", nextQuery);
      else params.set("seed", String(seed.current));
      const res = await fetch(`/api/youtube?${params.toString()}`);
      const data = (await res.json()) as { error?: string; items?: YtVideo[] };
      if (!res.ok) throw new Error(data.error ?? "Could not load YouTube.");
      setVideos(data.items ?? []);
      if (!nextQuery && !(data.items ?? []).length) throw new Error("No videos loaded.");
    } catch (err) {
      setVideos([]);
      setError(err instanceof Error ? err.message : "Could not load YouTube.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const search = (event?: FormEvent) => {
    event?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearched(true);
    setActive(null);
    void load(q);
  };

  const goHome = () => {
    setQuery("");
    setSearched(false);
    setActive(null);
    void load();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0f0f0f]">
      <form onSubmit={search} className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <button type="button" onClick={goHome} className="flex items-center gap-1.5 shrink-0" aria-label="YouTube home">
          <span className="flex h-7 w-10 items-center justify-center rounded-lg bg-[#ff0000]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white" aria-hidden>
              <path d="M8 5.14v13.72L19.5 12 8 5.14z" />
            </svg>
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-white sm:inline">YouTube</span>
        </button>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-[#121212] px-4 py-1.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/40"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
        >
          {loading ? "…" : "Search"}
        </button>
      </form>

      {active ? (
        <WatchView video={active} onBack={() => setActive(null)} searched={searched} />
      ) : (
        <div className="flex h-0 min-h-0 flex-1 flex-col px-4 py-3">
          {error ? <p className="mb-3 shrink-0 text-xs text-rose-300">{error}</p> : null}
          <p className="mb-3 shrink-0 text-[0.65rem] uppercase tracking-[0.18em] text-zinc-500">
            {searched ? `Results for “${query.trim()}”` : "Trending on YouTube"}
          </p>
          {loading && videos.length === 0 ? <p className="mb-3 shrink-0 text-sm text-zinc-500">Loading videos…</p> : null}
          {!loading && videos.length === 0 ? (
            <p className="mb-3 shrink-0 text-sm text-zinc-500">No videos. Try another search.</p>
          ) : null}
          <ScrollPane className="min-h-0 flex-1" deps={videos.length}>
            <ul className="grid grid-cols-1 gap-3 pr-1 sm:grid-cols-2">
              {videos.map((video) => (
                <li key={video.id}>
                  <button
                    type="button"
                    onClick={() => setActive(video)}
                    className="w-full rounded-xl text-left hover:bg-white/5"
                  >
                    <span className="relative block overflow-hidden rounded-xl bg-black">
                      <img
                        src={video.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="aspect-video w-full object-cover"
                      />
                      {video.duration ? (
                        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
                          {video.duration}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-2 block px-0.5 text-sm font-semibold leading-snug text-white">{video.title}</span>
                    <span className="mt-0.5 block px-0.5 text-xs text-zinc-400">
                      {video.channel}
                      {video.views ? ` · ${formatViews(video.views)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollPane>
        </div>
      )}
    </div>
  );
}

function WatchView({
  video,
  onBack,
  searched,
}: {
  video: YtVideo;
  onBack: () => void;
  searched: boolean;
}) {
  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col px-4 py-3">
      <ScrollPane className="min-h-0 flex-1" deps={video.id}>
        <button type="button" onClick={onBack} className="text-xs font-semibold text-sky-300">
          ← {searched ? "Results" : "Home"}
        </button>
        <div className="mt-3 overflow-hidden rounded-xl bg-black">
          <iframe
            title={video.title}
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="aspect-video w-full border-0"
          />
        </div>
        <h2 className="mt-3 text-base font-semibold text-white">{video.title}</h2>
        <p className="mt-1 pb-2 text-sm text-zinc-400">
          {video.channel}
          {video.views ? ` · ${formatViews(video.views)}` : ""}
        </p>
      </ScrollPane>
    </div>
  );
}

function ScrollPane({
  children,
  className = "",
  deps,
}: {
  children: ReactNode;
  className?: string;
  deps: string | number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
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
  }, [deps]);

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
    <div className={`flex min-h-0 gap-2 ${className}`}>
      <div ref={scrollerRef} className="room-news-scroll min-h-0 flex-1">
        {children}
      </div>
      <div className="relative w-2.5 shrink-0 rounded-full bg-[#2f2f2f]">
        <div
          className="absolute inset-x-0 cursor-pointer rounded-full bg-[#9a9a9a]"
          style={{ top: thumb.top, height: thumb.height }}
          onPointerDown={dragThumb}
        />
      </div>
    </div>
  );
}
