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
      where: { tradeType: "LIMIT_UP_PAPER", tradeStatus: "TRADABLE" },
    });

    if (positions.length === 0) {
      return NextResponse.json({ success: true, alerts: [] });
    }

    const stockCodes = positions.map((p) => p.stockCode);
    const marketData = await fetchMultipleStocks(stockCodes, 2);

    const alerts: Array<{
      stockCode: string;
      stockName: string;
      openChangePercent: number;
    }> = [];

    for (const position of positions) {
      const stock = marketData.find((m) => m.symbol === position.stockCode);
      if (!stock || stock.openPrice == null) continue;

      const avgCost = Number(position.avgCost);
      if (avgCost <= 0) continue;

      const openChangePercent =
        ((stock.openPrice - avgCost) / avgCost) * 100;

      if (openChangePercent < 2) {
        const stockName = position.stockName || stock.name || position.stockCode;
        await sendNotification({
          title: "\u3010\u6838\u6309\u94AE\u8B66\u62A5\u3011",
          body: `${stockName} \u7ADE\u4EF7\u4E0D\u53CA\u9884\u671F(${openChangePercent.toFixed(1)}%)\uFF0C\u7ACB\u5373\u5E02\u4EF7\u6E05\u4ED3`,
          level: "critical",
          stockCode: position.stockCode,
        });
        alerts.push({
          stockCode: position.stockCode,
          stockName,
          openChangePercent,
        });
      }
    }

    console.log(
      `[Morning Auction] Checked ${positions.length} positions, ${alerts.length} alerts`
    );

    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    console.error("[Morning Auction] Error:", error);
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
