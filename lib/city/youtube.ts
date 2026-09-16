export interface YtVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  views: number;
  duration: string;
}

export function videoThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function formatViews(views: number) {
  if (!Number.isFinite(views) || views <= 0) return "";
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B views`;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1).replace(/\.0$/, "")}K views`;
  return `${Math.round(views)} views`;
}

export function formatDuration(total: number) {
  if (!Number.isFinite(total) || total <= 0) return "";
  const sec = Math.round(total);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseIsoDuration(value: string) {
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(value);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

export function videoIdFromUrl(value: string) {
  const match = /(?:v=|\/watch\?v=|youtu\.be\/|\/embed\/|\/shorts\/|\/v\/)([A-Za-z0-9_-]{11})/.exec(value);
  if (match?.[1]) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  return "";
}

export function shuffleVideos(items: YtVideo[], seed: number) {
  const copy = items.slice();
  let s = Math.abs(Math.floor(seed)) || 1;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const a = copy[i];
    const b = copy[j];
    if (a && b) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}
