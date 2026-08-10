import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RESEARCH_STAGES } from "@/lib/uzi/research-jobs";
import { isAuthorizedUziWorker, safeWorkerId } from "@/lib/uzi/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  if (!isAuthorizedUziWorker(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const workerId = safeWorkerId(body.workerId);
  const claimToken = cleanText(body.claimToken, 64);
  const event = String(body.event || "heartbeat");
  const now = new Date();
  const job = await prisma.uziResearchJob.findUnique({ where: { id: jobId } });
  if (!job || job.workerId !== workerId || !claimToken || job.claimToken !== claimToken) {
    return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
  }
  if (!["RUNNING", "PUBLISHING"].includes(job.status)) {
    return NextResponse.json({ success: false, error: "Job is already terminal" }, { status: 409 });
  }

  let transitionCount = 0;
  const expected = {
    id: jobId,
    workerId,
    claimToken,
    attempt: job.attempt,
    status: job.status,
    stage: job.stage,
  };

  if (event === "heartbeat") {
    const updated = await prisma.uziResearchJob.updateMany({
      where: expected,
      data: { leaseExpiresAt: new Date(now.getTime() + 5 * 60 * 1000) },
    });
    transitionCount = updated.count;
  } else if (event === "stage") {
    const stage = String(body.stage || "");
    if (!RESEARCH_STAGES.includes(stage as (typeof RESEARCH_STAGES)[number]) || stage === "COMPLETED") {
      return NextResponse.json({ success: false, error: "Invalid stage" }, { status: 400 });
    }
    const currentStageIndex = RESEARCH_STAGES.indexOf(job.stage as (typeof RESEARCH_STAGES)[number]);
    const nextStageIndex = RESEARCH_STAGES.indexOf(stage as (typeof RESEARCH_STAGES)[number]);
    if (nextStageIndex < currentStageIndex) {
      return NextResponse.json({ success: false, error: "Stage cannot move backwards" }, { status: 409 });
    }
    const updated = await prisma.uziResearchJob.updateMany({
      where: expected,
      data: {
        status: stage === "PUBLISHING" ? "PUBLISHING" : "RUNNING",
        stage,
        stageMessage: cleanText(body.message, 160),
        leaseExpiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      },
    });
    transitionCount = updated.count;
  } else if (event === "complete") {
    if (job.status !== "PUBLISHING" || job.stage !== "PUBLISHING") {
      return NextResponse.json({ success: false, error: "Job is not ready to complete" }, { status: 409 });
    }
    const reportId = cleanText(body.publicReportId, 100);
    const reportPath = cleanText(body.publicReportPath, 180);
    if (!reportId || !/^[A-Za-z0-9.^=_-]+$/.test(reportId) || !reportPath?.startsWith("/uzi-assets/reports/")) {
      return NextResponse.json({ success: false, error: "Invalid report artifact" }, { status: 400 });
    }
    const updated = await prisma.uziResearchJob.updateMany({
      where: expected,
      data: {
        status: "SUCCEEDED",
        stage: "COMPLETED",
        stageMessage: "深研已发布",
        publicReportId: reportId,
        publicReportPath: reportPath,
        publicManifest: body.publicManifest ?? undefined,
        privateBrief: body.privateBrief ?? undefined,
        commitSha: cleanText(body.commitSha, 64),
        completedAt: now,
        claimToken: null,
        leaseExpiresAt: null,
      },
    });
    transitionCount = updated.count;
  } else if (event === "fail") {
    const shouldRetry = job.attempt < job.maxAttempts;
    const updated = await prisma.uziResearchJob.updateMany({
      where: expected,
      data: {
        status: shouldRetry ? "QUEUED" : "FAILED",
        stage: shouldRetry ? "QUEUED" : job.stage,
        stageMessage: shouldRetry ? "本次未完成，等待自动重试" : "深研未完成",
        errorCode: cleanText(body.errorCode, 60) ?? "WORKER_FAILED",
        errorMessage: cleanText(body.errorMessage, 500) ?? "本机深研执行失败",
        completedAt: shouldRetry ? null : now,
        workerId: shouldRetry ? null : workerId,
        claimToken: null,
        leaseExpiresAt: null,
      },
    });
    transitionCount = updated.count;
  } else {
    return NextResponse.json({ success: false, error: "Invalid event" }, { status: 400 });
  }

  if (transitionCount !== 1) {
    return NextResponse.json({ success: false, error: "Job state changed; callback rejected" }, { status: 409 });
  }

  const terminal = event === "complete" || event === "fail";
  await prisma.uziResearchWorker.upsert({
    where: { id: workerId },
    update: {
      status: terminal ? "IDLE" : "BUSY",
      currentJobId: terminal ? null : jobId,
      lastSeenAt: now,
    },
    create: {
      id: workerId,
      status: terminal ? "IDLE" : "BUSY",
      currentJobId: terminal ? null : jobId,
      lastSeenAt: now,
    },
  });

  return NextResponse.json({ success: true });
}
