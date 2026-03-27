import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchMultipleStocks } from "@/skills/data_crawler";
import { sendNotification } from "@/lib/api/notification-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const positions = await prisma.portfolio.findMany({
      where: { tradeStatus: "TRADABLE" },
    });

    if (positions.length === 0) {
      return NextResponse.json({ success: true, alerts: [] });
    }

    const stockCodes = positions.map((p) => p.stockCode);
    const marketData = await fetchMultipleStocks(stockCodes, 2);

    const alerts: Array<{
      stockCode: string;
      stockName: string;
      lossPercent: number;
    }> = [];

    for (const position of positions) {
      const stock = marketData.find((m) => m.symbol === position.stockCode);
      if (!stock || stock.currentPrice == null) continue;

      const avgCost = Number(position.avgCost);
      if (avgCost <= 0) continue;

      const lossPercent =
        ((stock.currentPrice - avgCost) / avgCost) * 100;

      if (lossPercent <= -5) {
        const stockName = position.stockName || stock.name || position.stockCode;
        await sendNotification({
          title: "\u3010\u786C\u6B62\u635F\u8B66\u62A5\u3011",
          body: `${stockName} \u8DCC\u5E45${lossPercent.toFixed(1)}%\u5DF2\u89E6\u53CA-5%\u7EA2\u7EBF\uFF0C\u7ACB\u5373\u6B62\u635F`,
          level: "critical",
          stockCode: position.stockCode,
        });
        alerts.push({
          stockCode: position.stockCode,
          stockName,
          lossPercent,
        });
      }
    }

    console.log(
      `[Intraday Alert] Checked ${positions.length} positions, ${alerts.length} alerts`
    );

    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    console.error("[Intraday Alert] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
