export const dynamic = "force-dynamic";

interface BlueskyPost {
  uri: string;
  text: string;
  author: string;
  createdAt: string;
  sentiment: "bullish" | "bearish" | "neutral";
}

interface SentimentAggregate {
  bullish: number;
  bearish: number;
  neutral: number;
  score: number; // -1 to 1
}

let cache: { posts: BlueskyPost[]; aggregateSentiment: SentimentAggregate } | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const BULLISH_KEYWORDS = ["bull", "rally", "green", "surge", "buy", "moon", "breakout", "bullish", "soar", "gain"];
const BEARISH_KEYWORDS = ["crash", "recession", "bear", "dump", "sell", "panic", "fear", "bearish", "plunge", "collapse", "crisis"];

function scoreSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  let bullCount = 0;
  let bearCount = 0;

  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw)) bullCount++;
  }
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw)) bearCount++;
  }

  if (bullCount > bearCount) return "bullish";
  if (bearCount > bullCount) return "bearish";
  return "neutral";
}

function computeAggregate(posts: BlueskyPost[]): SentimentAggregate {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;

  for (const p of posts) {
    if (p.sentiment === "bullish") bullish++;
    else if (p.sentiment === "bearish") bearish++;
    else neutral++;
  }

  const total = posts.length || 1;
  const score = parseFloat(((bullish - bearish) / total).toFixed(3));

  return { bullish, bearish, neutral, score };
}

function getMockData(): { posts: BlueskyPost[]; aggregateSentiment: SentimentAggregate } {
  const posts: BlueskyPost[] = [
    {
      uri: "at://mock/1",
      text: "Markets looking green today! Bull rally continues with strong earnings.",
      author: "trader.bsky.social",
      createdAt: new Date().toISOString(),
      sentiment: "bullish",
    },
    {
      uri: "at://mock/2",
      text: "Recession fears growing as yield curve inverts further. Panic selling ahead?",
      author: "analyst.bsky.social",
      createdAt: new Date().toISOString(),
      sentiment: "bearish",
    },
    {
      uri: "at://mock/3",
      text: "Fed decision coming next week. Markets hold steady awaiting guidance.",
      author: "finance.bsky.social",
      createdAt: new Date().toISOString(),
      sentiment: "neutral",
    },
    {
      uri: "at://mock/4",
      text: "Tech stocks surge on AI hype. Buy the dip strategy working well.",
      author: "techbull.bsky.social",
      createdAt: new Date().toISOString(),
      sentiment: "bullish",
    },
    {
      uri: "at://mock/5",
      text: "Market crash incoming? Bear market signals flashing red everywhere.",
      author: "bearwatch.bsky.social",
      createdAt: new Date().toISOString(),
      sentiment: "bearish",
    },
  ];
  return { posts, aggregateSentiment: computeAggregate(posts) };
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_DURATION) {
      return Response.json({
        success: true,
        posts: cache.posts,
        aggregateSentiment: cache.aggregateSentiment,
      });
    }

    const searchQuery = encodeURIComponent(
      "stock market crash OR recession OR bull market"
    );
    const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${searchQuery}&limit=25&sort=latest`;

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch {
      const mock = getMockData();
      return Response.json({ success: true, ...mock, source: "mock" });
    }

    if (!res.ok) {
      const mock = getMockData();
      return Response.json({ success: true, ...mock, source: "mock" });
    }

    const json = await res.json();
    const rawPosts = json.posts ?? [];

    const posts: BlueskyPost[] = rawPosts.map(
      (p: {
        uri: string;
        record?: { text?: string; createdAt?: string };
        author?: { handle?: string };
      }) => {
        const text = p.record?.text ?? "";
        return {
          uri: p.uri ?? "",
          text: text.slice(0, 500),
          author: p.author?.handle ?? "unknown",
          createdAt: p.record?.createdAt ?? new Date().toISOString(),
          sentiment: scoreSentiment(text),
        };
      }
    );

    const aggregateSentiment = computeAggregate(posts);

    cache = { posts, aggregateSentiment };
    cacheTime = now;

    return Response.json({ success: true, posts, aggregateSentiment });
  } catch (error) {
    console.error("Bluesky API error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch Bluesky data" },
      { status: 500 }
    );
  }
}
