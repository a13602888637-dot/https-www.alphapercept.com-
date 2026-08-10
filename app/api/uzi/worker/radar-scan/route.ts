import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectRadarTriggers } from "@/lib/portfolio-radar/detect-triggers";
import { isAuthorizedUziWorker, safeWorkerId } from "@/lib/uzi/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PricePayload {
  success?: boolean;
  source?: string;
  timestamp?: string | null;
  prices?: Record<string, {
    price?: number;
    changePercent?: number;
    lastUpdate?: string | null;
    source?: string;
  }>;
}

export async function POST(request: Request) {
  if (!isAuthorizedUziWorker(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workerId = safeWorkerId(body.workerId);
  const positions = await prisma.portfolio.findMany({
    where: { tradeStatus: "TRADABLE" },
  });
  const positionKeys = new Set(positions.map((position) => `${position.userId}:${position.stockCode}`));
  const activeEvents = await prisma.portfolioRadarEvent.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, userId: true, stockCode: true },
  });
  const orphanEventIds = activeEvents
    .filter((event) => !positionKeys.has(`${event.userId}:${event.stockCode}`))
    .map((event) => event.id);
  if (orphanEventIds.length > 0) {
    await prisma.portfolioRadarEvent.updateMany({
      where: { id: { in: orphanEventIds }, status: "ACTIVE" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }
  const codes = [...new Set(positions.map((position) => position.stockCode))];
  if (codes.length === 0) {
    await updateWorkerScan(workerId, 0, 0);
    return NextResponse.json({ success: true, checked: 0, active: 0 });
  }

  const quoteResponse = await fetch(
    `${new URL(request.url).origin}/api/stock-prices?symbols=${encodeURIComponent(codes.join(","))}`,
    { cache: "no-store", signal: AbortSignal.timeout(12_000) }
  );
  const quotes = (quoteResponse.ok ? await quoteResponse.json() : {}) as PricePayload;
  const source = quotes.source || "unavailable";
  const watchlists = await prisma.watchlist.findMany({
    where: {
      OR: positions.map((position) => ({ userId: position.userId, stockCode: position.stockCode })),
    },
  });
  const watchlistByPosition = new Map(
    watchlists.map((item) => [`${item.userId}:${item.stockCode}`, item])
  );

  let activeCount = 0;
  for (const position of positions) {
    const quote = quotes.prices?.[position.stockCode];
    const watchlist = watchlistByPosition.get(`${position.userId}:${position.stockCode}`);
    const rawPrice = Number(quote?.price);
    const rawChangePercent = Number(quote?.changePercent);
    const quoteSource = quote?.source || "unavailable";
    const quoteTimestamp = quote?.lastUpdate || quotes.timestamp || null;
    const quoteAge = quoteTimestamp ? Date.now() - Date.parse(quoteTimestamp) : Number.POSITIVE_INFINITY;
    const sourceIsLive = (quoteSource === "sina" || quoteSource === "tencent") && quoteAge >= 0 && quoteAge <= 10 * 60 * 1000;
    const triggers = detectRadarTriggers({
      userId: position.userId,
      stockCode: position.stockCode,
      stockName: position.stockName,
      avgCost: Number(position.avgCost),
      currentPrice: sourceIsLive && Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null,
      changePercent: sourceIsLive && Number.isFinite(rawChangePercent) ? rawChangePercent : null,
      priceSource: sourceIsLive ? quoteSource : "unavailable",
      priceAsOf: sourceIsLive ? quoteTimestamp : null,
      stopLossPrice: watchlist?.stopLossPrice ? Number(watchlist.stopLossPrice) : null,
      targetPrice: watchlist?.targetPrice ? Number(watchlist.targetPrice) : null,
    });

    const activeKeys = triggers.map((trigger) => trigger.triggerKey);
    if (sourceIsLive) {
      await prisma.portfolioRadarEvent.updateMany({
        where: {
          userId: position.userId,
          stockCode: position.stockCode,
          status: "ACTIVE",
          ...(activeKeys.length > 0 ? { triggerKey: { notIn: activeKeys } } : {}),
        },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
    }

    for (const trigger of triggers) {
      activeCount += 1;
      await prisma.portfolioRadarEvent.upsert({
        where: {
          userId_triggerKey: {
            userId: position.userId,
            triggerKey: trigger.triggerKey,
          },
        },
        update: {
          stockName: position.stockName,
          type: trigger.type,
          severity: trigger.severity,
          status: "ACTIVE",
          title: trigger.title,
          summary: trigger.summary,
          evidence: trigger.evidence,
          lastSeenAt: new Date(),
          resolvedAt: null,
        },
        create: {
          userId: position.userId,
          stockCode: position.stockCode,
          stockName: position.stockName,
          triggerKey: trigger.triggerKey,
          type: trigger.type,
          severity: trigger.severity,
          title: trigger.title,
          summary: trigger.summary,
          evidence: trigger.evidence,
        },
      });
    }
  }

  await updateWorkerScan(workerId, positions.length, activeCount);
  return NextResponse.json({
    success: true,
    checked: positions.length,
    active: activeCount,
    priceSource: source,
    priceAsOf: quotes.timestamp || null,
  });
}

async function updateWorkerScan(workerId: string, checked: number, active: number) {
  const now = new Date();
  const metadata = { lastRadarScanAt: now.toISOString(), checked, active };
  await prisma.uziResearchWorker.upsert({
    where: { id: workerId },
    update: { lastSeenAt: now, metadata },
    create: { id: workerId, status: "IDLE", lastSeenAt: now, metadata },
  });
}
