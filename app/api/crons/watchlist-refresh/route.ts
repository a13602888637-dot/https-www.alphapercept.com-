import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateStopLoss,
  calculateTakeProfit,
  type OHLC,
  type StopLossMethod,
  type TakeProfitMethod,
} from "@/lib/trading";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron: 每日刷新全部自选股的止盈止损价格
 * 收盘后用最新K线数据重新计算 ATR/Chandelier/MA/Trailing 等动态止盈止损
 *
 * 建议 schedule: 每个交易日 15:45 CST (收盘后，board-track cron 之后)
 */

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
      const now = new Date();
      let days: number;
      switch (klt) {
        case 101: days = Math.ceil(limit * 1.5); break;
        case 102: days = limit * 7 + 14; break;
        case 103: days = limit * 31 + 31; break;
        default:  days = limit * 2;
      }
      const beg = new Date(now.getTime() - days * 86400000);
      const begStr = `${beg.getFullYear()}${String(beg.getMonth() + 1).padStart(2, "0")}${String(beg.getDate()).padStart(2, "0")}`;

      const url =
        `https://push2his.eastmoney.com/api/qt/stock/kline/get` +
        `?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b` +
        `&fields1=f1,f2,f3,f4,f5,f6` +
        `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
        `&klt=${klt}&fqt=1&beg=${begStr}&end=20991231&lmt=${limit}`;

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
    } catch {
      // continue to next frequency
    }
  }
  return null;
}

/**
 * 批量获取实时报价
 */
async function fetchRealtimeQuotes(codes: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  for (let i = 0; i < codes.length; i += 50) {
    const batch = codes.slice(i, i + 50);
    const secids = batch.map((code) => {
      const secid = toSecid(code);
      return secid || `1.${code}`;
    });
    try {
      const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=${secids.join(",")}&fields=f2,f12`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://data.eastmoney.com/" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json();
        const diff = json?.data?.diff;
        if (Array.isArray(diff)) {
          for (const item of diff) {
            const code = String(item.f12 ?? "");
            if (code && typeof item.f2 === "number" && item.f2 > 0) {
              priceMap.set(code, Number(item.f2));
            }
          }
        }
      }
    } catch { /* ignore quote errors */ }
  }
  return priceMap;
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 查找所有有买入价的自选股（不限是否已配止盈止损方法）
    const items = await prisma.watchlist.findMany({
      where: { buyPrice: { not: null } },
    });

    if (items.length === 0) {
      return NextResponse.json({ success: true, message: "No items to refresh", refreshed: 0 });
    }

    // 批量获取实时报价
    const aCodes = items
      .map((it) => it.stockCode.trim())
      .filter((c) => !/^[A-Za-z]/.test(c));
    const realtimePrices = await fetchRealtimeQuotes(aCodes);

    let refreshed = 0;
    let skipped = 0;
    let failed = 0;
    let autoConfigured = 0;

    for (const item of items) {
      const buyPrice = item.buyPrice ? item.buyPrice.toNumber() : null;
      if (!buyPrice) { skipped++; continue; }

      // 跳过美股
      if (/^[A-Za-z]/.test(item.stockCode.trim())) {
        skipped++;
        continue;
      }

      // 自动为没有止盈止损方法的项目配置默认值
      let slMethod = (item.stopLossMethod as StopLossMethod) || null;
      let tpMethod = (item.takeProfitMethod as TakeProfitMethod) || null;
      let slParams = (item.stopLossParams as Record<string, number>) || {};
      let tpParams = (item.takeProfitParams as Record<string, number>) || {};

      if (!slMethod && !tpMethod) {
        slMethod = "atr";
        slParams = { atrMultiplier: 3, atrPeriod: 14 };
        tpMethod = "trailing";
        tpParams = { trailPercent: 5 };
        try {
          await prisma.watchlist.update({
            where: { id: item.id },
            data: {
              stopLossMethod: slMethod,
              stopLossParams: slParams,
              takeProfitMethod: tpMethod,
              takeProfitParams: tpParams,
              highWaterMark: item.highWaterMark ?? buyPrice,
            },
          });
          autoConfigured++;
        } catch {
          failed++;
          continue;
        }
      }

      const maxPeriod = Math.max(
        slParams.atrPeriod ?? 14, slParams.maPeriod ?? 20,
        slParams.period ?? 22, tpParams.atrPeriod ?? 14, 30
      );

      try {
        const ohlcResult = await fetchOHLC(item.stockCode, maxPeriod + 1);
        const ohlcData = ohlcResult?.ohlcData ?? [];
        const frequency = ohlcResult?.frequency ?? "daily";
        // 优先用实时报价，降级到K线收盘，再降级到买入价
        const realtimePrice = realtimePrices.get(item.stockCode.trim());
        const klineClose = ohlcResult?.currentPrice;
        const currentPrice = realtimePrice ?? klineClose ?? buyPrice;
        const cachedAtr = item.cachedAtr ? item.cachedAtr.toNumber() : undefined;
        const existingHWM = item.highWaterMark ? item.highWaterMark.toNumber() : buyPrice;

        let newSL = item.stopLossPrice ? item.stopLossPrice.toNumber() : null;
        let newTP = item.targetPrice ? item.targetPrice.toNumber() : null;
        let computeStatus = "live";
        let newAtr: number | undefined;
        let newHWM = existingHWM;
        let newFreq = frequency;

        if (slMethod) {
          const slResult = calculateStopLoss({
            method: slMethod, buyPrice, currentPrice,
            params: slParams, ohlcData, frequency, cachedAtr,
          });
          newSL = slResult.stopLossPrice;
          computeStatus = slResult.computeStatus;
          newAtr = slResult.atrValue;
          newFreq = slResult.dataFrequency;
        }

        if (tpMethod) {
          const tpResult = calculateTakeProfit({
            method: tpMethod, buyPrice, currentPrice,
            highWaterMark: existingHWM, params: tpParams,
            ohlcData: ohlcData.length > 0 ? ohlcData : undefined,
            frequency, cachedAtr,
          });
          newTP = tpResult.takeProfitPrice;
          newHWM = tpResult.newHighWaterMark;
          if (tpResult.computeStatus !== "live") computeStatus = tpResult.computeStatus;
        }

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

        refreshed++;
      } catch (err) {
        console.error(`[watchlist-refresh] Failed for ${item.stockCode}:`, err instanceof Error ? err.message : String(err));
        failed++;
      }
    }

    console.log(`[Watchlist Refresh Cron] Refreshed: ${refreshed}, AutoConfigured: ${autoConfigured}, Skipped: ${skipped}, Failed: ${failed}, Total: ${items.length}`);

    return NextResponse.json({
      success: true,
      refreshed,
      autoConfigured,
      skipped,
      failed,
      total: items.length,
    });
  } catch (error) {
    console.error("[Watchlist Refresh Cron] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
