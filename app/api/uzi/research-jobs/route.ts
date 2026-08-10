import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import {
  ACTIVE_RESEARCH_STATUSES,
  ensureResearchUser,
  getWorkerSummary,
  isAStockCode,
  normalizeAStockCode,
  serializeResearchJob,
  shanghaiTradeDate,
  toUziTicker,
} from "@/lib/uzi/research-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  const [jobs, worker] = await Promise.all([
    user
      ? prisma.uziResearchJob.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
    getWorkerSummary(),
  ]);

  return NextResponse.json({
    success: true,
    jobs: jobs.map(serializeResearchJob),
    worker,
  });
}

export async function POST(request: Request) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: "请先登录后提交深研" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const stockCode = normalizeAStockCode(String(body.stockCode || ""));
  const requestedStockName = String(body.stockName || stockCode).trim().slice(0, 40) || stockCode;
  if (!isAStockCode(stockCode)) {
    return NextResponse.json({ success: false, error: "请输入 6 位 A 股代码" }, { status: 400 });
  }

  const user = await ensureResearchUser(clerkUserId);
  const tradeDate = shanghaiTradeDate();
  const idempotencyKey = `${user.id}:${stockCode}:${tradeDate}:deep-v1`;

  const existing = await prisma.uziResearchJob.findFirst({
    where: {
      userId: user.id,
      stockCode,
      OR: [
        { status: { in: [...ACTIVE_RESEARCH_STATUSES] } },
        { idempotencyKey },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    if (existing.status === "FAILED") {
      const retried = await prisma.uziResearchJob.update({
        where: { id: existing.id },
        data: {
          status: "QUEUED",
          stage: "QUEUED",
          stageMessage: "已人工重新排队，等待本机 Codex Worker",
          attempt: 0,
          workerId: null,
          claimToken: null,
          leaseExpiresAt: null,
          errorCode: null,
          errorMessage: null,
          completedAt: null,
        },
      });
      return NextResponse.json({ success: true, reused: true, retried: true, job: serializeResearchJob(retried) });
    }
    return NextResponse.json({ success: true, reused: true, job: serializeResearchJob(existing) });
  }

  const dailyCount = await prisma.uziResearchJob.count({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (dailyCount >= 3) {
    return NextResponse.json(
      { success: false, error: "今天已提交 3 份深研。为控制 Codex 套餐用量，请明天再提交。" },
      { status: 429 }
    );
  }

  const [position, watchlist] = await Promise.all([
    prisma.portfolio.findUnique({
      where: { userId_stockCode: { userId: user.id, stockCode } },
    }),
    prisma.watchlist.findUnique({
      where: { userId_stockCode: { userId: user.id, stockCode } },
    }),
  ]);

  const inputContext = {
    position: position
      ? {
          quantity: position.quantity,
          avgCost: Number(position.avgCost),
          tradeStatus: position.tradeStatus,
          status: position.status,
        }
      : null,
    riskPlan: watchlist
      ? {
          buyPrice: watchlist.buyPrice ? Number(watchlist.buyPrice) : null,
          stopLossPrice: watchlist.stopLossPrice ? Number(watchlist.stopLossPrice) : null,
          targetPrice: watchlist.targetPrice ? Number(watchlist.targetPrice) : null,
          stopLossMethod: watchlist.stopLossMethod,
          takeProfitMethod: watchlist.takeProfitMethod,
        }
      : null,
  };
  const stockName = position?.stockName || watchlist?.stockName || requestedStockName;

  const job = await prisma.uziResearchJob.create({
    data: {
      userId: user.id,
      stockCode,
      stockName,
      ticker: toUziTicker(stockCode),
      idempotencyKey,
      inputContext,
      stageMessage: "等待本机 Codex Worker 领取",
    },
  });

  return NextResponse.json({ success: true, reused: false, job: serializeResearchJob(job) }, { status: 201 });
}
