import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

interface StockResult {
  code: string;
  name: string;
  market: string;
}

// In-memory cache with 5-minute TTL
const cache = new Map<string, { data: StockResult[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getAShareMarket(code: string): string {
  if (code.startsWith("688")) return "科创板";
  if (code.startsWith("6")) return "上海";
  if (code.startsWith("0") || code.startsWith("3")) return "深圳";
  if (code.startsWith("8") || code.startsWith("4")) return "北交所";
  return "A股";
}

async function searchSina(query: string): Promise<StockResult[]> {
  try {
    const url = `https://suggest3.sinajs.cn/suggest/type=&key=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { Referer: "https://finance.sina.com.cn" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    // Format: var suggestvalue="11,600026,sh600026,中远海能,zyhln;..."
    const match = text.match(/"(.*)"/);
    if (!match || !match[1]) return [];
    return match[1]
      .split(";")
      .filter(Boolean)
      .map((item) => {
        const parts = item.split(",");
        if (parts.length < 4) return null;
        const [, code, , name] = parts;
        if (!code || !name) return null;
        return { code, name, market: getAShareMarket(code) };
      })
      .filter((r): r is StockResult => r !== null);
  } catch {
    return [];
  }
}

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "d6r5cbpr01qgdhqd7k50d6r5cbpr01qgdhqd7k5g";

async function searchFinnhub(query: string): Promise<StockResult[]> {
  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.result || !Array.isArray(json.result)) return [];
    return json.result
      .filter((r: { type?: string }) => r.type === "Common Stock" || r.type === "ETP")
      .slice(0, 10)
      .map((r: { symbol: string; description: string; type: string }) => ({
        code: r.symbol,
        name: r.description,
        market: r.type === "ETP" ? "US-ETF" : "US",
      }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (!query) {
    return NextResponse.json({ success: false, data: [], count: 0, query, source: "none" });
  }

  // Check cache
  const cached = cache.get(query);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({
      success: true, data: cached.data, count: cached.data.length, query, source: "cache",
    });
  }

  const isPureDigits = /^\d+$/.test(query);
  let results: StockResult[];
  let source: string;

  if (isPureDigits) {
    results = await searchSina(query);
    source = "sina";
  } else {
    const [sinaResults, finnhubResults] = await Promise.all([
      searchSina(query),
      searchFinnhub(query),
    ]);
    results = [...sinaResults, ...finnhubResults];
    source = "sina+finnhub";
  }

  // Deduplicate by code
  const seen = new Set<string>();
  results = results.filter((r) => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });

  // Update cache
  cache.set(query, { data: results, ts: Date.now() });

  // Evict old entries periodically
  if (cache.size > 500) {
    const now = Date.now();
    for (const [key, val] of cache) {
      if (now - val.ts > CACHE_TTL) cache.delete(key);
    }
  }

  return NextResponse.json({
    success: true, data: results, count: results.length, query, source,
  });
}
