import { NextRequest, NextResponse } from "next/server";
import { isInstitutionalSeat, matchYouziSeat } from "@/lib/youzi-seats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EAST_MONEY_ENDPOINT = "https://datacenter-web.eastmoney.com/api/data/v1/get";
const LOOKBACK_DAYS = 30;

type EastMoneyRow = Record<string, string | number | null>;

interface NormalizedSeatRow {
  tradeDate: string;
  seatCode: string;
  seatName: string;
  reason: string;
  closePrice: number | null;
  buy: number;
  sell: number;
  net: number;
  knownYouzi: string[];
  institutional: boolean;
}

function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function cutoffDate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function fetchEastMoney(params: Record<string, string>): Promise<EastMoneyRow[]> {
  const url = new URL(EAST_MONEY_ENDPOINT);
  url.search = new URLSearchParams({
    pageNumber: "1",
    pageSize: "50",
    source: "WEB",
    client: "WEB",
    ...params,
  }).toString();

  const response = await fetch(url, {
    headers: {
      Referer: "https://data.eastmoney.com/",
      "User-Agent": "Mozilla/5.0 (compatible; AlphaPercept/1.0)",
    },
    signal: AbortSignal.timeout(6500),
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    throw new Error(`东方财富龙虎榜接口返回 ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.success) {
    throw new Error(payload?.message || "东方财富龙虎榜接口无有效响应");
  }

  return Array.isArray(payload.result?.data) ? payload.result.data : [];
}

async function fetchDetailRows(stockCode: string, tradeDate: string): Promise<EastMoneyRow[]> {
  const filter = `(TRADE_DATE='${tradeDate}')(SECURITY_CODE="${stockCode}")`;
  const [buyResult, sellResult] = await Promise.allSettled([
    fetchEastMoney({
      reportName: "RPT_BILLBOARD_DAILYDETAILSBUY",
      columns: "ALL",
      filter,
      sortTypes: "-1",
      sortColumns: "BUY",
    }),
    fetchEastMoney({
      reportName: "RPT_BILLBOARD_DAILYDETAILSSELL",
      columns: "ALL",
      filter,
      sortTypes: "-1",
      sortColumns: "SELL",
    }),
  ]);

  const merged = new Map<string, EastMoneyRow>();
  for (const result of [buyResult, sellResult]) {
    if (result.status !== "fulfilled") continue;
    for (const row of result.value) {
      // OPERATEDEPT_CODE is "0" for every institutional row, so the code or
      // seat name alone would collapse multiple independent 机构专用 entries.
      // Buy/sell tables expose the same full row; the amount signature removes
      // that overlap while preserving distinct institutional seats.
      const key = [
        dateOnly(row.TRADE_DATE),
        String(row.OPERATEDEPT_CODE || ""),
        String(row.OPERATEDEPT_NAME || ""),
        amount(row.BUY),
        amount(row.SELL),
        amount(row.NET),
        String(row.EXPLANATION || ""),
      ].join(":");
      if (!merged.has(key)) merged.set(key, row);
    }
  }

  if (merged.size === 0 && buyResult.status === "rejected" && sellResult.status === "rejected") {
    throw new Error("龙虎榜买卖席位明细暂不可用");
  }

  return [...merged.values()];
}

function normalizeRow(row: EastMoneyRow): NormalizedSeatRow {
  const seatName = String(row.OPERATEDEPT_NAME || "未知席位");
  const close = Number(row.CLOSE_PRICE);
  return {
    tradeDate: dateOnly(row.TRADE_DATE),
    seatCode: String(row.OPERATEDEPT_CODE || ""),
    seatName,
    reason: String(row.EXPLANATION || ""),
    closePrice: Number.isFinite(close) && close > 0 ? close : null,
    buy: amount(row.BUY),
    sell: amount(row.SELL),
    net: amount(row.NET),
    knownYouzi: matchYouziSeat(seatName).map((profile) => profile.name),
    institutional: isInstitutionalSeat(seatName),
  };
}

export async function GET(request: NextRequest) {
  const stockCode = (request.nextUrl.searchParams.get("symbol") || "").trim();
  const displayName = (request.nextUrl.searchParams.get("name") || "").trim().slice(0, 30);

  if (!/^[034689]\d{5}$/.test(stockCode)) {
    return NextResponse.json(
      { success: false, error: "请输入 6 位 A 股代码" },
      { status: 400 }
    );
  }

  try {
    const dateRows = await fetchEastMoney({
      reportName: "RPT_LHB_BOARDDATE",
      columns: "ALL",
      filter: `(SECURITY_CODE="${stockCode}")`,
      sortTypes: "-1",
      sortColumns: "TRADE_DATE",
    });

    const cutoff = cutoffDate(LOOKBACK_DAYS);
    const lhbDates = [...new Set(
      dateRows
        .map((row) => dateOnly(row.TRADE_DATE))
        .filter((date) => date && date >= cutoff)
    )];
    if (lhbDates.length === 0) {
      return NextResponse.json({
        success: true,
        report: {
          stockCode,
          stockName: displayName || stockCode,
          periodDays: LOOKBACK_DAYS,
          generatedAt: new Date().toISOString(),
          source: "东方财富龙虎榜",
          sourceUrl: `https://data.eastmoney.com/stock/lhb/${stockCode}.html`,
          status: "no_lhb",
          signal: "近 30 日未上龙虎榜",
          lhbDates: [],
          detailDateCount: 0,
          partial: false,
          eventDate: null,
          eventReason: null,
          excludedSameDayEventCount: 0,
          totals: { buy: 0, sell: 0, net: 0 },
          institutional: { buy: 0, sell: 0, net: 0 },
          brokerage: { buy: 0, sell: 0, net: 0 },
          knownYouzi: { buy: 0, sell: 0, net: 0, matches: [] },
          recentSeats: [],
        },
      }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
    }

    const latestDate = lhbDates[0];
    const rawRows = await fetchDetailRows(stockCode, latestDate);
    const eventGroups = new Map<string, EastMoneyRow[]>();
    for (const row of rawRows) {
      const eventKey = String(row.EXPLANATION || row.CHANGE_TYPE || "未注明上榜原因");
      const group = eventGroups.get(eventKey) || [];
      group.push(row);
      eventGroups.set(eventKey, group);
    }
    const [selectedEventReason, selectedEventRows] = [...eventGroups.entries()]
      .sort(([, rowsA], [, rowsB]) => {
        if (rowsB.length !== rowsA.length) return rowsB.length - rowsA.length;
        const activityA = rowsA.reduce((sum, row) => sum + amount(row.BUY) + amount(row.SELL), 0);
        const activityB = rowsB.reduce((sum, row) => sum + amount(row.BUY) + amount(row.SELL), 0);
        return activityB - activityA;
      })[0] || ["未注明上榜原因", []];
    const rows = selectedEventRows.map(normalizeRow);

    if (rows.length === 0) {
      throw new Error("已找到龙虎榜日期，但最新榜单席位明细暂不可用");
    }

    const total = rows.reduce(
      (sum, row) => ({ buy: sum.buy + row.buy, sell: sum.sell + row.sell, net: sum.net + row.net }),
      { buy: 0, sell: 0, net: 0 }
    );
    const institutional = rows.filter((row) => row.institutional).reduce(
      (sum, row) => ({ buy: sum.buy + row.buy, sell: sum.sell + row.sell, net: sum.net + row.net }),
      { buy: 0, sell: 0, net: 0 }
    );
    const brokerage = rows.filter((row) => !row.institutional).reduce(
      (sum, row) => ({ buy: sum.buy + row.buy, sell: sum.sell + row.sell, net: sum.net + row.net }),
      { buy: 0, sell: 0, net: 0 }
    );
    const knownRows = rows.filter((row) => row.knownYouzi.length > 0);
    const knownTotals = knownRows.reduce(
      (sum, row) => ({ buy: sum.buy + row.buy, sell: sum.sell + row.sell, net: sum.net + row.net }),
      { buy: 0, sell: 0, net: 0 }
    );

    const matches = new Map<string, {
      name: string;
      tier: string;
      style: string;
      appearances: number;
      net: number;
      lastDate: string;
      seats: Set<string>;
    }>();
    for (const row of knownRows) {
      for (const profile of matchYouziSeat(row.seatName)) {
        const current = matches.get(profile.name) || {
          name: profile.name,
          tier: profile.tier,
          style: profile.style,
          appearances: 0,
          net: 0,
          lastDate: row.tradeDate,
          seats: new Set<string>(),
        };
        current.appearances += 1;
        current.net += row.net;
        current.lastDate = current.lastDate > row.tradeDate ? current.lastDate : row.tradeDate;
        current.seats.add(row.seatName);
        matches.set(profile.name, current);
      }
    }

    const matchList = [...matches.values()]
      .map((match) => ({ ...match, seats: [...match.seats] }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    const signal = matchList.length === 0
      ? "未匹配已登记知名席位"
      : knownTotals.net > 0
        ? "最新榜单知名席位净流入"
        : knownTotals.net < 0
          ? "最新榜单知名席位净流出"
          : "最新榜单知名席位多空平衡";

    const recentSeats = rows
      .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate) || Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      report: {
        stockCode,
        stockName: displayName || stockCode,
        periodDays: LOOKBACK_DAYS,
        generatedAt: new Date().toISOString(),
        source: "东方财富龙虎榜",
        sourceUrl: `https://data.eastmoney.com/stock/lhb/${stockCode}.html`,
        status: "ready",
        signal,
        lhbDates,
        detailDateCount: 1,
        partial: false,
        eventDate: latestDate,
        eventReason: selectedEventReason,
        excludedSameDayEventCount: Math.max(0, eventGroups.size - 1),
        totals: total,
        institutional,
        brokerage,
        knownYouzi: { ...knownTotals, matches: matchList },
        recentSeats,
      },
    }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } });
  } catch (error) {
    console.error("Youzi quick report failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "游资快报生成失败",
      },
      { status: 502 }
    );
  }
}
