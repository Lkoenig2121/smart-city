import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim() ?? "";
  if (!title) return NextResponse.json({ error: "Missing title." }, { status: 400 });

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SmartCity/0.1 (city sim room computer)" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return NextResponse.json({ error: "Could not open that page." }, { status: 502 });

  const data = (await res.json()) as {
    title?: string;
    extract?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
  };

  return NextResponse.json({
    title: data.title ?? title,
    extract: data.extract ?? "No summary available.",
    url: data.content_urls?.desktop?.page ?? "",
    image: data.originalimage?.source ?? data.thumbnail?.source ?? "",
  });
}
