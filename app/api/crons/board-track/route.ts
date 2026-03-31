import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron: 跟踪打板次日表现
 * 查找所有 trackStatus="pending" 且 entryDate < 今天 的记录，
 * 从东方财富获取当日行情，更新次日涨跌数据。
 *
 * 建议 schedule: 每个交易日 15:30 CST (收盘后)
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });

    // fix=true: 重置所有脏数据(nextDayChange异常)为pending重新跟踪
    if (searchParams.get("fix") === "true") {
      const corrupted = await prisma.boardTrack.updateMany({
        where: { trackStatus: "tracked" },
        data: { trackStatus: "pending", nextDayPrice: null, nextDayChange: null, nextDayHigh: null, nextDayLow: null, trackedAt: null },
      });
      console.log(`[Board Track Fix] Reset ${corrupted.count} corrupted records to pending`);
    }

    // 找出所有待跟踪的记录（entryDate 早于今天）
    const pending = await prisma.boardTrack.findMany({
      where: {
        trackStatus: "pending",
        entryDate: { lt: today },
      },
    });

    if (pending.length === 0) {
      return NextResponse.json({ success: true, message: "No pending tracks", updated: 0 });
    }

    // 收集所有需要查询的股票代码
    const codes = [...new Set(pending.map((r) => r.stockCode))];

    // 批量获取实时行情（东方财富）
    const priceMap = new Map<string, {
      price: number;
      changePercent: number;
      high: number;
      low: number;
    }>();

    // 每50个一批查询
    for (let i = 0; i < codes.length; i += 50) {
      const batch = codes.slice(i, i + 50);
      const secids = batch.map((code) => {
        const prefix = code.startsWith("6") || code.startsWith("9") ? "1" : "0";
        return `${prefix}.${code}`;
      });

      try {
        const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=${secids.join(",")}&fields=f2,f3,f12,f15,f16`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://data.eastmoney.com/",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const json = await res.json();
          const diff = json?.data?.diff;
          if (Array.isArray(diff)) {
            for (const item of diff) {
              const code = String(item.f12 ?? "");
              if (code && typeof item.f2 === "number") {
                priceMap.set(code, {
                  price: Number(item.f2),
                  changePercent: Number(item.f3 ?? 0),
                  high: Number(item.f15 ?? 0),
                  low: Number(item.f16 ?? 0),
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Board track price fetch error:", e);
      }
    }

    // 更新每条跟踪记录
    let updated = 0;
    let failed = 0;

    for (const record of pending) {
      const quote = priceMap.get(record.stockCode);
      if (quote && quote.price > 0) {
        const entryPrice = Number(record.entryPrice);
        const nextDayChange = entryPrice > 0
          ? Math.round(((quote.price - entryPrice) / entryPrice) * 10000) / 100
          : quote.changePercent;

        await prisma.boardTrack.update({
          where: { id: record.id },
          data: {
            nextDayPrice: quote.price,
            nextDayChange,
            nextDayHigh: quote.high,
            nextDayLow: quote.low,
            trackStatus: "tracked",
            trackedAt: new Date(),
          },
        });
        updated++;
      } else {
        // 如果连续3天获取不到数据，标记为失败
        const daysSinceEntry = Math.floor(
          (new Date(today).getTime() - new Date(record.entryDate).getTime()) / 86400000
        );
        if (daysSinceEntry >= 3) {
          await prisma.boardTrack.update({
            where: { id: record.id },
            data: { trackStatus: "failed" },
          });
          failed++;
        }
      }
    }

    console.log(`[Board Track Cron] Updated: ${updated}, Failed: ${failed}, Pending: ${pending.length - updated - failed}`);

    return NextResponse.json({
      success: true,
      updated,
      failed,
      total: pending.length,
    });
  } catch (error) {
    console.error("[Board Track Cron] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
