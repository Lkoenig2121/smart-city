import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ error: "Enter a longer search." }, { status: 400 });
  }

  const wikiUrl = new URL("https://en.wikipedia.org/w/api.php");
  wikiUrl.searchParams.set("action", "opensearch");
  wikiUrl.searchParams.set("search", query);
  wikiUrl.searchParams.set("limit", "8");
  wikiUrl.searchParams.set("namespace", "0");
  wikiUrl.searchParams.set("format", "json");

  const ddgUrl = new URL("https://api.duckduckgo.com/");
  ddgUrl.searchParams.set("q", query);
  ddgUrl.searchParams.set("format", "json");
  ddgUrl.searchParams.set("no_html", "1");
  ddgUrl.searchParams.set("skip_disambig", "1");

  const headers = { "User-Agent": "SmartCity/0.1 (city sim room computer)" };

  const [wikiRes, ddgRes] = await Promise.allSettled([
    fetch(wikiUrl, { headers, next: { revalidate: 120 } }),
    fetch(ddgUrl, { headers, next: { revalidate: 120 } }),
  ]);

  const results: Array<{ title: string; snippet: string; url: string }> = [];
  let answer = "";

  if (wikiRes.status === "fulfilled" && wikiRes.value.ok) {
    const data = (await wikiRes.value.json()) as [string, string[], string[], string[]];
    const titles = data[1] ?? [];
    const snippets = data[2] ?? [];
    const urls = data[3] ?? [];
    for (let i = 0; i < titles.length; i++) {
      results.push({
        title: titles[i] ?? "Result",
        snippet: snippets[i] || "Wikipedia article",
        url: urls[i] ?? "",
      });
    }
  }

  if (ddgRes.status === "fulfilled" && ddgRes.value.ok) {
    const data = (await ddgRes.value.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    if (data.AbstractText) {
      answer = data.AbstractText;
      if (data.Heading && data.AbstractURL) {
        results.unshift({
          title: data.Heading,
          snippet: data.AbstractText,
          url: data.AbstractURL,
        });
      }
    }
    for (const topic of data.RelatedTopics ?? []) {
      if (!topic.Text || !topic.FirstURL) continue;
      if (results.length >= 10) break;
      results.push({
        title: topic.Text.split(" - ")[0] ?? topic.Text,
        snippet: topic.Text,
        url: topic.FirstURL,
      });
    }
  }

  return NextResponse.json({ query, answer, results });
}
