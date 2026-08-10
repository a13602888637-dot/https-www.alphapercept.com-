import { prisma } from "@/lib/db";

export const ACTIVE_RESEARCH_STATUSES = ["QUEUED", "RUNNING", "PUBLISHING"] as const;

export const RESEARCH_STAGES = [
  "QUEUED",
  "DATA_COLLECTION",
  "CROSS_CHECK",
  "AGENT_REVIEW",
  "SYNTHESIS",
  "PUBLISHING",
  "COMPLETED",
] as const;

export type ResearchStage = (typeof RESEARCH_STAGES)[number];

export function isAStockCode(value: unknown): value is string {
  return typeof value === "string" && /^[034689]\d{5}$/.test(value.trim());
}

export function normalizeAStockCode(value: string): string {
  return value.trim().toUpperCase().replace(/^(SH|SZ|BJ)/, "").split(".")[0];
}

export function toUziTicker(stockCode: string): string {
  if (/^[69]/.test(stockCode)) return `${stockCode}.SH`;
  if (/^[03]/.test(stockCode)) return `${stockCode}.SZ`;
  return `${stockCode}.BJ`;
}

export function shanghaiTradeDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function serializeResearchJob(job: {
  id: string;
  stockCode: string;
  stockName: string;
  ticker: string;
  status: string;
  stage: string;
  stageMessage: string | null;
  attempt: number;
  publicReportId: string | null;
  publicReportPath: string | null;
  privateBrief: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    stockCode: job.stockCode,
    stockName: job.stockName,
    ticker: job.ticker,
    status: job.status,
    stage: job.stage,
    stageMessage: job.stageMessage,
    attempt: job.attempt,
    publicReportId: job.publicReportId,
    publicReportPath: job.publicReportPath,
    privateBrief: job.privateBrief,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export async function ensureResearchUser(clerkUserId: string) {
  return prisma.user.upsert({
    where: { clerkUserId },
    update: {},
    create: {
      clerkUserId,
      metadata: { createdVia: "uzi_research_api" },
      settings: { language: "zh-CN", theme: "dark" },
    },
  });
}

export async function getWorkerSummary() {
  const worker = await prisma.uziResearchWorker.findFirst({
    orderBy: { lastSeenAt: "desc" },
  });
  if (!worker) {
    return { online: false, status: "OFFLINE", lastSeenAt: null };
  }

  const online = Date.now() - worker.lastSeenAt.getTime() < 90_000;
  return {
    online,
    status: online ? worker.status : "OFFLINE",
    lastSeenAt: worker.lastSeenAt.toISOString(),
  };
}
