import { NextResponse } from "next/server";

export interface NewsItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  image: string;
}

interface WikiLink {
  title?: string;
  extract?: string;
  titles?: { normalized?: string };
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

interface WikiFeed {
  news?: { links?: WikiLink[] }[];
  mostread?: { articles?: WikiLink[] };
  tfa?: WikiLink;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function feedUrl(date: Date) {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  return `https://en.wikipedia.org/api/rest_v1/feed/featured/${year}/${month}/${day}`;
}

function itemsFromFeed(data: WikiFeed): NewsItem[] {
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  const add = (title: string, snippet: string, url: string, source: string, image: string) => {
    if (!title || seen.has(title)) return;
    seen.add(title);
    items.push({ title, snippet: snippet || "Open for the full story.", url, source, image });
  };

  for (const story of data.news ?? []) {
    for (const link of story.links ?? []) {
      add(
        link.titles?.normalized ?? link.title ?? "News",
        link.extract ?? "",
        link.content_urls?.desktop?.page ?? "",
        "Wikipedia News",
        link.originalimage?.source ?? link.thumbnail?.source ?? "",
      );
    }
  }
  if (data.tfa) {
    add(
      data.tfa.titles?.normalized ?? data.tfa.title ?? "Featured",
      data.tfa.extract ?? "",
      data.tfa.content_urls?.desktop?.page ?? "",
      "Featured",
      data.tfa.originalimage?.source ?? data.tfa.thumbnail?.source ?? "",
    );
  }
  for (const article of data.mostread?.articles ?? []) {
    add(
      article.titles?.normalized ?? article.title ?? "Story",
      article.extract ?? "",
      article.content_urls?.desktop?.page ?? "",
      "Most read",
      article.originalimage?.source ?? article.thumbnail?.source ?? "",
    );
  }
  return items;
}

export async function GET() {
  const headers = { "User-Agent": "SmartCity/0.1 (city sim room computer)" };
  const days = [new Date(), new Date(Date.now() - 86_400_000)];
  let items: NewsItem[] = [];

  for (const date of days) {
    try {
      const res = await fetch(feedUrl(date), { headers, next: { revalidate: 300 } });
      if (!res.ok) continue;
      items = itemsFromFeed((await res.json()) as WikiFeed);
      if (items.length) break;
    } catch {
      // Try the previous day.
    }
  }

  return NextResponse.json({ items: items.slice(0, 12) });
}
