import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { isAuthorizedUziWorker, safeWorkerId } from "@/lib/uzi/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedUziWorker(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workerId = safeWorkerId(body.workerId);
  const version = typeof body.version === "string" ? body.version.slice(0, 40) : null;
  const now = new Date();

  const existingWorker = await prisma.uziResearchWorker.findUnique({ where: { id: workerId } });
  if (existingWorker?.status === "BUSY" && existingWorker.currentJobId) {
    const activeJob = await prisma.uziResearchJob.findFirst({
      where: {
        id: existingWorker.currentJobId,
        workerId,
        status: { in: ["RUNNING", "PUBLISHING"] },
        leaseExpiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (activeJob) {
      await prisma.uziResearchWorker.update({
        where: { id: workerId },
        data: { lastSeenAt: now, version },
      });
      return NextResponse.json({ success: true, job: null, busy: true });
    }
  }

  const expiredJobs = await prisma.uziResearchJob.findMany({
    where: {
      status: { in: ["RUNNING", "PUBLISHING"] },
      leaseExpiresAt: { lt: now },
    },
    take: 20,
  });
  for (const expired of expiredJobs) {
    const exhausted = expired.attempt >= expired.maxAttempts;
    await prisma.uziResearchJob.updateMany({
      where: { id: expired.id, status: expired.status, leaseExpiresAt: { lt: now } },
      data: exhausted
        ? {
            status: "FAILED",
            stageMessage: "本机深研连续失联，已停止自动重试",
            errorCode: "MAX_ATTEMPTS",
            errorMessage: "请检查本机 Worker 后在网页重新提交。",
            workerId: null,
            claimToken: null,
            leaseExpiresAt: null,
            completedAt: now,
          }
        : {
            status: "QUEUED",
            stage: "QUEUED",
            stageMessage: "上次执行失联，已重新排队",
            workerId: null,
            claimToken: null,
            leaseExpiresAt: null,
          },
    });
  }

  const job = await prisma.$transaction(async (tx) => {
    const candidates = await tx.uziResearchJob.findMany({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    const queued = candidates.find((candidate) => candidate.attempt < candidate.maxAttempts);
    if (!queued) return null;
    const claimToken = randomBytes(24).toString("hex");

    const claimed = await tx.uziResearchJob.updateMany({
      where: { id: queued.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        stage: "DATA_COLLECTION",
        stageMessage: "Codex 正在采集公开数据",
        workerId,
        claimToken,
        attempt: { increment: 1 },
        startedAt: queued.startedAt ?? now,
        leaseExpiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        errorCode: null,
        errorMessage: null,
      },
    });
    if (claimed.count !== 1) return null;
    return tx.uziResearchJob.findUnique({ where: { id: queued.id } });
  });

  await prisma.uziResearchWorker.upsert({
    where: { id: workerId },
    update: {
      status: job ? "BUSY" : "IDLE",
      version,
      currentJobId: job?.id ?? null,
      lastSeenAt: now,
    },
    create: {
      id: workerId,
      status: job ? "BUSY" : "IDLE",
      version,
      currentJobId: job?.id ?? null,
      lastSeenAt: now,
    },
  });

  return NextResponse.json({ success: true, job });
}
