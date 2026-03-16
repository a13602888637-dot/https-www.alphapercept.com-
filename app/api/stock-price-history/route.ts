import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// secid mapping: map A-share stock code to East Money secid
// SSE (Shanghai): codes starting with 6 or 9 → prefix 1.
// SZSE (Shenzhen): codes starting with 0 or 3 → prefix 0.
// Special indices:
//   000001 (上证指数) → 1.000001
//   000300, 000905    → 1.xxxxxx
//   399xxx            → 0.xxxxxx
// ---------------------------------------------------------------------------
function toSecid(code: string): string | null {
  const c = code.trim();

  // US stocks (alphabetic) — not supported
  if (/^[A-Za-z]/.test(c)) return null;

  // Known Shanghai-side index codes (treated as prefix 1 even though starting with 0)
  const shanghaiIndices = new Set(["000001", "000300", "000905"]);
  if (shanghaiIndices.has(c)) return `1.${c}`;

  // Shenzhen indices: 399xxx
  if (c.startsWith("399")) return `0.${c}`;

  // Regular stocks
  if (c.startsWith("6") || c.startsWith("9")) return `1.${c}`;
  if (c.startsWith("0") || c.startsWith("3")) return `0.${c}`;

  // Fallback: treat as Shanghai
  return `1.${c}`;
}

// ---------------------------------------------------------------------------
// Map interval param → East Money klt code and calculate beg date
// ---------------------------------------------------------------------------
function intervalToKlt(interval: string): { klt: number } {
  switch (interval) {
    case "30min": return { klt: 30 };
    case "60min": return { klt: 60 };
    case "week":  return { klt: 102 };
    case "month": return { klt: 103 };
    case "day":
    default:      return { klt: 101 };
  }
}

function calcBegDate(limit: number, klt: number): string {
  const now = new Date();
  let days: number;

  switch (klt) {
    case 30:   days = Math.ceil(limit / 8) + 5;  break; // ~8 bars/day
    case 60:   days = Math.ceil(limit / 4) + 5;  break; // ~4 bars/day
    case 101:  days = Math.ceil(limit * 1.5);     break; // account for weekends
    case 102:  days = limit * 7 + 14;             break;
    case 103:  days = limit * 31 + 31;            break;
    default:   days = limit * 2;
  }

  const beg = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const y = beg.getFullYear();
  const m = String(beg.getMonth() + 1).padStart(2, "0");
  const d = String(beg.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ---------------------------------------------------------------------------
// In-memory cache: key = `${stockCode}:${interval}`, value = { ts, body }
// ---------------------------------------------------------------------------
const cache = new Map<string, { ts: number; body: object }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// GET /api/stock-price-history?stockCode=600026&interval=day&limit=200
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stockCode = searchParams.get("stockCode");
  const interval  = searchParams.get("interval") || "day";
  const limit     = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

  if (!stockCode) {
    return NextResponse.json(
      { success: false, error: "stockCode parameter is required" },
      { status: 400 }
    );
  }

  // US stocks not supported
  if (/^[A-Za-z]/.test(stockCode.trim())) {
    return NextResponse.json(
      { success: false, error: "US stocks K-line not yet supported", stockCode },
      { status: 200 }
    );
  }

  const secid = toSecid(stockCode);
  if (!secid) {
    return NextResponse.json(
      { success: false, error: `Cannot map stock code to secid: ${stockCode}` },
      { status: 400 }
    );
  }

  // Cache lookup
  const cacheKey = `${stockCode}:${interval}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const { klt } = intervalToKlt(interval);
    const beg = calcBegDate(limit, klt);

    const url =
      `https://push2his.eastmoney.com/api/qt/stock/kline/get` +
      `?secid=${secid}` +
      `&ut=fa5fd1943c7b386f172d6893dbfba10b` +
      `&fields1=f1,f2,f3,f4,f5,f6` +
      `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
      `&klt=${klt}` +
      `&fqt=1` +
      `&beg=${beg}` +
      `&end=20991231` +
      `&lmt=${limit}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let raw: Response;
    try {
      raw = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://finance.eastmoney.com",
          "Accept": "application/json, text/plain, */*",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!raw.ok) {
      return NextResponse.json(
        { success: false, error: `East Money API error: ${raw.status}` },
        { status: 502 }
      );
    }

    const json = await raw.json();

    const klineStrings: string[] | null = json?.data?.klines ?? null;
    const stockName: string = json?.data?.name ?? stockCode;

    if (!klineStrings || klineStrings.length === 0) {
      const body = {
        success: false,
        stockCode,
        stockName,
        interval,
        error: "No kline data returned from East Money",
        data: [],
        count: 0,
      };
      return NextResponse.json(body);
    }

    // Parse kline strings
    // format: "date,open,close,high,low,volume,amount,amplitude,changePercent,change,turnoverRate"
    const data = klineStrings.map((line) => {
      const [
        timestamp,
        openStr,
        closeStr,
        highStr,
        lowStr,
        volumeStr,
        amountStr,
        amplitudeStr,
        changePercentStr,
        changeStr,
        turnoverRateStr,
      ] = line.split(",");

      return {
        timestamp,
        open:          parseFloat(openStr),
        close:         parseFloat(closeStr),
        high:          parseFloat(highStr),
        low:           parseFloat(lowStr),
        volume:        parseFloat(volumeStr),   // 手 (lots of 100 shares)
        amount:        parseFloat(amountStr),   // 元
        amplitude:     parseFloat(amplitudeStr),
        changePercent: parseFloat(changePercentStr),
        change:        parseFloat(changeStr),
        turnoverRate:  parseFloat(turnoverRateStr),
      };
    });

    const body = {
      success: true,
      stockCode,
      stockName,
      interval,
      data,
      count: data.length,
    };

    cache.set(cacheKey, { ts: Date.now(), body });

    return NextResponse.json(body);
  } catch (err) {
    console.error("[stock-price-history] fetch error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch K-line data",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
