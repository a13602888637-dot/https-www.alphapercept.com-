import { NextRequest, NextResponse } from "next/server";
import iconv from "iconv-lite";

export const dynamic = "force-dynamic";

interface StockResult {
  code: string;
  name: string;
  market: string;
}

// In-memory cache, 5-min TTL
const cache = new Map<string, { data: StockResult[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// Sina type → market label; only keep stock types
const SINA_TYPE_MAP: Record<string, string> = {
  "11": "A股",   // A-share (SH/SZ)
  "12": "B股",
  "31": "港股",
  "41": "美股",
};

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
      headers: {
        Referer: "https://finance.sina.com.cn/",
        "User-Agent": "Mozilla/5.0 (compatible; StockAnalysis/1.0)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    // Sina returns GBK-encoded text — decode properly
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = iconv.decode(buffer, "gbk");

    // Format: var suggestvalue="name,type,code,fullCode,displayName,...;..."
    const match = text.match(/"(.*)"/);
    if (!match?.[1]) return [];

    return match[1]
      .split(";")
      .filter(Boolean)
      .map((item) => {
        const parts = item.split(",");
        if (parts.length < 5) return null;
        const type = parts[1]; // "11"=A股, "31"=港股, "41"=美股
        const code = parts[2]; // pure code: "600026"
        const name = parts[4]; // display name: "中远海能"
        if (!code || !name) return null;
        // Only keep stocks (filter out funds, bonds, etc.)
        const marketLabel = SINA_TYPE_MAP[type];
        if (!marketLabel) return null;
        const market = type === "11" ? getAShareMarket(code) : marketLabel;
        return { code, name, market };
      })
      .filter((r): r is StockResult => r !== null)
      .slice(0, 15);
  } catch (e) {
    console.warn("Sina search error:", e);
    return [];
  }
}

const FINNHUB_KEY =
  process.env.FINNHUB_API_KEY || "d6r5cbpr01qgdhqd7k50d6r5cbpr01qgdhqd7k5g";

async function searchFinnhub(query: string): Promise<StockResult[]> {
  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json.result)) return [];
    return json.result
      .filter(
        (r: { type?: string }) =>
          r.type === "Common Stock" || r.type === "ETP"
      )
      .slice(0, 10)
      .map(
        (r: { displaySymbol: string; description: string; type: string }) => ({
          code: r.displaySymbol || r.displaySymbol,
          name: r.description,
          market: r.type === "ETP" ? "US-ETF" : "US",
        })
      );
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (!query) {
    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      query,
      source: "none",
    });
  }

  // Cache check
  const cached = cache.get(query);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({
      success: true,
      data: cached.data,
      count: cached.data.length,
      query,
      source: "cache",
    });
  }

  // Pure digits → A-share only (Sina). Letters → both sources.
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

  cache.set(query, { data: results, ts: Date.now() });

  // Evict stale cache
  if (cache.size > 500) {
    const now = Date.now();
    for (const [key, val] of cache) {
      if (now - val.ts > CACHE_TTL) cache.delete(key);
    }
  }

  return NextResponse.json({
    success: true,
    data: results,
    count: results.length,
    query,
    source,
  });
}
