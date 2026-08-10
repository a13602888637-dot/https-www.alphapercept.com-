import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { getWorkerSummary } from "@/lib/uzi/research-jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  const [events, worker, workerRecord] = await Promise.all([
    user
      ? prisma.portfolioRadarEvent.findMany({
          where: { userId: user.id },
          orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
          take: 40,
        })
      : Promise.resolve([]),
    getWorkerSummary(),
    prisma.uziResearchWorker.findFirst({ orderBy: { lastSeenAt: "desc" } }),
  ]);

  const metadata = workerRecord?.metadata && typeof workerRecord.metadata === "object"
    ? workerRecord.metadata as Record<string, unknown>
    : null;

  return NextResponse.json({
    success: true,
    worker,
    lastScanAt: typeof metadata?.lastRadarScanAt === "string" ? metadata.lastRadarScanAt : null,
    events: events.map((event) => ({
      id: event.id,
      stockCode: event.stockCode,
      stockName: event.stockName,
      type: event.type,
      severity: event.severity,
      status: event.status,
      title: event.title,
      summary: event.summary,
      evidence: event.evidence,
      firstTriggeredAt: event.firstTriggeredAt.toISOString(),
      lastSeenAt: event.lastSeenAt.toISOString(),
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
    })),
  });
}
