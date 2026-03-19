import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { getUserIdFromRequest } from "../../../../lib/auth-helpers";
import {
  calculateStopLoss,
  calculateTakeProfit,
  type OHLC,
  type StopLossMethod,
  type TakeProfitMethod,
} from "../../../../lib/trading";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// secid mapping — same logic as app/api/stock-price-history/route.ts
// ---------------------------------------------------------------------------
function toSecid(code: string): string | null {
  const c = code.trim();
  if (/^[A-Za-z]/.test(c)) return null;
  const shanghaiIndices = new Set(["000001", "000300", "000905"]);
  if (shanghaiIndices.has(c)) return `1.${c}`;
  if (c.startsWith("399")) return `0.${c}`;
  if (c.startsWith("6") || c.startsWith("9")) return `1.${c}`;
  if (c.startsWith("0") || c.startsWith("3")) return `0.${c}`;
  return `1.${c}`;
}

function calcBegDate(limit: number, klt: number): string {
  const now = new Date();
  let days: number;
  switch (klt) {
    case 101: days = Math.ceil(limit * 1.5); break;
    case 102: days = limit * 7 + 14; break;
    case 103: days = limit * 31 + 31; break;
    default:  days = limit * 2;
  }
  const beg = new Date(now.getTime() - days * 86400000);
  const y = beg.getFullYear();
  const m = String(beg.getMonth() + 1).padStart(2, "0");
  const d = String(beg.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ---------------------------------------------------------------------------
// Fetch OHLC with daily → weekly → monthly fallback
// ---------------------------------------------------------------------------
async function fetchOHLC(
  stockCode: string,
  minBars: number
): Promise<{ ohlcData: OHLC[]; frequency: "daily" | "weekly" | "monthly"; currentPrice: number } | null> {
  const secid = toSecid(stockCode);
  if (!secid) return null;

  const frequencies: Array<{ klt: number; label: "daily" | "weekly" | "monthly" }> = [
    { klt: 101, label: "daily" },
    { klt: 102, label: "weekly" },
    { klt: 103, label: "monthly" },
  ];

  for (const { klt, label } of frequencies) {
    try {
      const limit = Math.max(minBars, 30);
      const beg = calcBegDate(limit, klt);
      const url =
        `https://push2his.eastmoney.com/api/qt/stock/kline/get` +
        `?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b` +
        `&fields1=f1,f2,f3,f4,f5,f6` +
        `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
        `&klt=${klt}&fqt=1&beg=${beg}&end=20991231&lmt=${limit}`;

      const raw = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://finance.eastmoney.com",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!raw.ok) continue;
      const json = await raw.json();
      const klines: string[] | null = json?.data?.klines ?? null;
      if (!klines || klines.length === 0) continue;

      const ohlcData: OHLC[] = klines.map((line: string) => {
        const [, openStr, closeStr, highStr, lowStr] = line.split(",");
        return {
          open: parseFloat(openStr),
          close: parseFloat(closeStr),
          high: parseFloat(highStr),
          low: parseFloat(lowStr),
        };
      });

      const currentPrice = ohlcData[ohlcData.length - 1].close;

      if (ohlcData.length >= minBars || klt >= 102) {
        return { ohlcData, frequency: label, currentPrice };
      }
    } catch (err) {
      console.warn(`[recalculate] K-line fetch failed for ${stockCode} (klt=${klt}):`, err instanceof Error ? err.message : String(err));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/watchlist/recalculate
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const clerkUserId = await getUserIdFromRequest(req);
    if (!clerkUserId) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    let body: { ids?: string[] } = {};
    try { body = await req.json(); } catch { /* empty body ok */ }

    const where: Record<string, unknown> = { userId: user.id };
    if (body.ids?.length) where.id = { in: body.ids };

    const items = await prisma.watchlist.findMany({ where });
    if (items.length === 0) {
      return NextResponse.json({ success: true, recalculated: 0, results: [] });
    }

    const results: Array<Record<string, unknown>> = [];
    const errors: string[] = [];

    for (const item of items) {
      const buyPrice = item.buyPrice ? item.buyPrice.toNumber() : null;
      const slMethod = (item.stopLossMethod as StopLossMethod) || null;
      const tpMethod = (item.takeProfitMethod as TakeProfitMethod) || null;

      // Skip if no buyPrice or no methods configured
      if (!buyPrice || (!slMethod && !tpMethod)) {
        results.push({ id: item.id, stockCode: item.stockCode, computeStatus: "skipped" });
        continue;
      }

      // Skip US stocks
      if (/^[A-Za-z]/.test(item.stockCode.trim())) {
        results.push({ id: item.id, stockCode: item.stockCode, computeStatus: "skipped_us" });
        continue;
      }

      const slParams = (item.stopLossParams as Record<string, number>) || {};
      const tpParams = (item.takeProfitParams as Record<string, number>) || {};
      const maxPeriod = Math.max(slParams.atrPeriod ?? 14, slParams.maPeriod ?? 20, slParams.period ?? 22, tpParams.atrPeriod ?? 14, 30);

      const ohlcResult = await fetchOHLC(item.stockCode, maxPeriod + 1);
      const ohlcData = ohlcResult?.ohlcData ?? [];
      const frequency = ohlcResult?.frequency ?? "daily";
      const currentPrice = ohlcResult?.currentPrice ?? buyPrice;
      const cachedAtr = item.cachedAtr ? item.cachedAtr.toNumber() : undefined;
      const existingHWM = item.highWaterMark ? item.highWaterMark.toNumber() : buyPrice;

      let newSL = item.stopLossPrice ? item.stopLossPrice.toNumber() : null;
      let newTP = item.targetPrice ? item.targetPrice.toNumber() : null;
      let computeStatus = "live";
      let newAtr: number | undefined;
      let newHWM = existingHWM;
      let newFreq = frequency;

      // Calculate stop-loss
      if (slMethod) {
        const slResult = calculateStopLoss({
          method: slMethod,
          buyPrice,
          currentPrice,
          params: slParams,
          ohlcData,
          frequency,
          cachedAtr,
        });
        newSL = slResult.stopLossPrice;
        computeStatus = slResult.computeStatus;
        newAtr = slResult.atrValue;
        newFreq = slResult.dataFrequency;
      }

      // Calculate take-profit
      if (tpMethod) {
        const tpResult = calculateTakeProfit({
          method: tpMethod,
          buyPrice,
          currentPrice,
          highWaterMark: existingHWM,
          params: tpParams,
          ohlcData: ohlcData.length > 0 ? ohlcData : undefined,
          frequency,
          cachedAtr,
        });
        newTP = tpResult.takeProfitPrice;
        newHWM = tpResult.newHighWaterMark;
        if (tpResult.computeStatus !== "live") computeStatus = tpResult.computeStatus;
      }

      // Update DB
      try {
        await prisma.watchlist.update({
          where: { id: item.id },
          data: {
            stopLossPrice: newSL,
            targetPrice: newTP,
            highWaterMark: newHWM,
            computeStatus,
            cachedAtr: newAtr ?? (cachedAtr ?? null),
            dataFrequency: newFreq,
            lastComputedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        errors.push(`${item.stockCode}: DB update failed — ${err instanceof Error ? err.message : String(err)}`);
      }

      results.push({
        id: item.id,
        stockCode: item.stockCode,
        stopLossPrice: newSL,
        targetPrice: newTP,
        stopLossMethod: slMethod,
        takeProfitMethod: tpMethod,
        computeStatus,
        dataFrequency: newFreq,
        highWaterMark: newHWM,
      });
    }

    return NextResponse.json({
      success: true,
      recalculated: results.filter((r) => r.computeStatus !== "skipped" && r.computeStatus !== "skipped_us").length,
      results,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error("[watchlist/recalculate] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
