import {
  formatDuration,
  parseIsoDuration,
  shuffleVideos,
  videoIdFromUrl,
  videoThumb,
  type YtVideo,
} from "@/lib/city/youtube";
import { NextRequest, NextResponse } from "next/server";

const HEADERS = { "User-Agent": "SmartCity/0.1 (city sim room computer)" };
const PIPED = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
];
const INVIDIOUS = ["https://inv.nadeko.net", "https://yewtu.be", "https://invidious.fdn.fr"];

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const seed = Number(request.nextUrl.searchParams.get("seed") ?? Date.now());
  const searching = query.length >= 2;

  if (query.length > 0 && query.length < 2) {
    return NextResponse.json({ error: "Enter a longer search." }, { status: 400 });
  }

  const videos = searching ? await searchVideos(query) : await popularVideos();
  const items = searching ? videos : shuffleVideos(videos, seed).slice(0, 16);
  return NextResponse.json({ items, query: searching ? query : "" });
}

async function popularVideos() {
  const fromGoogle = await googlePopular();
  if (fromGoogle.length) return fromGoogle;
  const fromPiped = await firstOk(PIPED.map((host) => () => pipedList(`${host}/trending?region=US`)));
  if (fromPiped.length) return fromPiped;
  const fromInv = await firstOk(INVIDIOUS.map((host) => () => invidiousList(`${host}/api/v1/popular`)));
  if (fromInv.length) return fromInv;
  return fallbackVideos();
}

async function searchVideos(query: string) {
  const fromGoogle = await googleSearch(query);
  if (fromGoogle.length) return fromGoogle;
  const q = encodeURIComponent(query);
  const fromPiped = await firstOk(PIPED.map((host) => () => pipedList(`${host}/search?q=${q}&filter=videos`)));
  if (fromPiped.length) return fromPiped;
  const fromInv = await firstOk(INVIDIOUS.map((host) => () => invidiousList(`${host}/api/v1/search?q=${q}&type=video`)));
  if (fromInv.length) return fromInv;
  return [];
}

async function googlePopular() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("regionCode", "US");
  url.searchParams.set("maxResults", "24");
  url.searchParams.set("key", key);
  return googleItems(url);
}

async function googleSearch(query: string) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "16");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("key", key);
  const data = await getJson<{ items?: GoogleSearchItem[] }>(searchUrl);
  const ids = (data?.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  const detailUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  detailUrl.searchParams.set("part", "snippet,statistics,contentDetails");
  detailUrl.searchParams.set("id", ids.join(","));
  detailUrl.searchParams.set("key", key);
  return googleItems(detailUrl);
}

async function googleItems(url: URL) {
  const data = await getJson<{ items?: GoogleVideoItem[] }>(url);
  const videos: YtVideo[] = [];
  for (const item of data?.items ?? []) {
    const id = typeof item.id === "string" ? item.id : item.id?.videoId;
    if (!id || !item.snippet?.title) continue;
    videos.push({
      id,
      title: item.snippet.title,
      channel: item.snippet.channelTitle ?? "YouTube",
      thumbnail: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? videoThumb(id),
      views: Number(item.statistics?.viewCount ?? 0),
      duration: formatDuration(parseIsoDuration(item.contentDetails?.duration ?? "")),
    });
  }
  return videos;
}

async function pipedList(url: string) {
  const data = await getJson<PipedItem[] | { items?: PipedItem[] }>(url);
  const rows = Array.isArray(data) ? data : (data?.items ?? []);
  const videos: YtVideo[] = [];
  for (const item of rows) {
    if (item.type && item.type !== "stream" && item.type !== "video") continue;
    const id = videoIdFromUrl(item.url ?? item.id ?? "");
    if (!id || !item.title) continue;
    videos.push({
      id,
      title: item.title,
      channel: item.uploaderName ?? item.uploader ?? "YouTube",
      thumbnail: item.thumbnail ?? videoThumb(id),
      views: Number(item.views ?? 0),
      duration: formatDuration(Number(item.duration ?? 0)),
    });
  }
  return videos;
}

async function invidiousList(url: string) {
  const data = await getJson<InvidiousItem[]>(url);
  const videos: YtVideo[] = [];
  for (const item of data ?? []) {
    const id = item.videoId ?? videoIdFromUrl(item.videoThumbnails?.[0]?.url ?? "");
    if (!id || !item.title) continue;
    const thumb = item.videoThumbnails?.find((t) => t.quality === "medium")?.url ?? item.videoThumbnails?.[0]?.url;
    videos.push({
      id,
      title: item.title,
      channel: item.author ?? "YouTube",
      thumbnail: thumb || videoThumb(id),
      views: Number(item.viewCount ?? 0),
      duration: formatDuration(Number(item.lengthSeconds ?? 0)),
    });
  }
  return videos;
}

async function firstOk(jobs: Array<() => Promise<YtVideo[]>>) {
  for (const job of jobs) {
    try {
      const items = await job();
      if (items.length) return items;
    } catch {
      // Try the next public instance.
    }
  }
  return [];
}

async function getJson<T>(url: URL | string) {
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(7000),
    next: { revalidate: 180 },
  });
  if (!res.ok) throw new Error(`youtube ${res.status}`);
  return (await res.json()) as T;
}

function fallbackVideos(): YtVideo[] {
  const ids = [
    ["jNQXAC9IVRw", "Me at the zoo", "jawed"],
    ["kJQP7kiw5Fk", "Luis Fonsi - Despacito ft. Daddy Yankee", "Luis Fonsi"],
    ["9bZkp7q19f0", "PSY - GANGNAM STYLE", "officialpsy"],
    ["OPf0YbXqDm0", "Mark Ronson - Uptown Funk ft. Bruno Mars", "Mark Ronson"],
    ["fJ9rUzIMcZQ", "Queen – Bohemian Rhapsody (Official Video)", "Queen Official"],
    ["hTWKbfoikeg", "Nirvana - Smells Like Teen Spirit", "Nirvana"],
    ["YlUKcNNmywk", "Red Hot Chili Peppers - Californication", "Red Hot Chili Peppers"],
    ["3AtDnEC4zak", "Charlie Puth - We Don't Talk Anymore", "Charlie Puth"],
    ["JGwWNGJdvx8", "Ed Sheeran - Shape of You", "Ed Sheeran"],
    ["CevxZvSJLk8", "Katy Perry - Roar", "Katy Perry"],
    ["09R8_2nJtjg", "Maroon 5 - Sugar", "Maroon 5"],
    ["2Vv-BfVoq4g", "Ed Sheeran - Perfect", "Ed Sheeran"],
  ] as const;
  return ids.map(([id, title, channel]) => ({
    id,
    title,
    channel,
    thumbnail: videoThumb(id),
    views: 0,
    duration: "",
  }));
}

interface GoogleSearchItem {
  id?: { videoId?: string };
}

interface GoogleVideoItem {
  id?: string | { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
  };
  statistics?: { viewCount?: string };
  contentDetails?: { duration?: string };
}

interface PipedItem {
  type?: string;
  url?: string;
  id?: string;
  title?: string;
  thumbnail?: string;
  uploaderName?: string;
  uploader?: string;
  views?: number;
  duration?: number;
}

interface InvidiousItem {
  videoId?: string;
  title?: string;
  author?: string;
  viewCount?: number;
  lengthSeconds?: number;
  videoThumbnails?: Array<{ quality?: string; url?: string }>;
}
