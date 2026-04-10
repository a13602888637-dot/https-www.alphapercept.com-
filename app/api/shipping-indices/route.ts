/**
 * Shipping Indices API — BDI + BDTI from East Money datacenter
 *
 * Source: https://datacenter-web.eastmoney.com/api/data/v1/get
 * Report: RPT_INDUSTRY_INDEX
 * Indices:
 *   EMI00107664 — Baltic Dry Index (BDI)
 *   EMI00107668 — Baltic Dirty Tanker Index (BDTI)
 *
 * Data is daily (published once per trading day).
 * Server-side cache: 5 minutes.
 */

import { NextResponse } from "next/server";

const INDICES = [
  { id: "EMI00107664", name: "波罗的海干散货指数(BDI)", key: "BDI" },
  { id: "EMI00107668", name: "原油运输指数(BDTI)", key: "BDTI" },
] as const;

const EASTMONEY_BASE =
  "https://datacenter-web.eastmoney.com/api/data/v1/get";

interface IndexResult {
  key: string;
  name: string;
  value: number;
  previousValue: number;
  changeRate: number;
  reportDate: string;
}

// ─── In-memory cache (5 min) ────────────────────────────────

let cache: { data: IndexResult[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchIndex(
  indicatorId: string,
): Promise<{ value: number; previousValue: number; changeRate: number; reportDate: string } | null> {
  const params = new URLSearchParams({
    reportName: "RPT_INDUSTRY_INDEX",
    columns: "REPORT_DATE,INDICATOR_VALUE,CHANGE_RATE",
    filter: `(INDICATOR_ID="${indicatorId}")`,
    pageSize: "2",
    sortColumns: "REPORT_DATE",
    sortTypes: "-1",
    source: "WEB",
    client: "WEB",
  });

  const res = await fetch(`${EASTMONEY_BASE}?${params}`, {
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const rows = json?.result?.data;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const latest = rows[0];
  const prev = rows[1];

  return {
    value: latest.INDICATOR_VALUE,
    previousValue: prev?.INDICATOR_VALUE ?? latest.INDICATOR_VALUE,
    changeRate: latest.CHANGE_RATE ?? 0,
    reportDate: latest.REPORT_DATE?.split(" ")[0] ?? "",
  };
}

export async function GET() {
  try {
    // Return cache if fresh
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json({ success: true, indices: cache.data });
    }

    const results = await Promise.allSettled(
      INDICES.map(async (idx): Promise<IndexResult | null> => {
        const data = await fetchIndex(idx.id);
        if (!data) return null;
        return {
          key: idx.key,
          name: idx.name,
          ...data,
        };
      }),
    );

    const indices: IndexResult[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        indices.push(r.value);
      }
    }

    cache = { data: indices, ts: Date.now() };

    return NextResponse.json({ success: true, indices });
  } catch (err) {
    console.error("shipping-indices API error:", err);
    return NextResponse.json(
      { success: false, indices: [], error: "Failed to fetch shipping indices" },
      { status: 500 },
    );
  }
}
