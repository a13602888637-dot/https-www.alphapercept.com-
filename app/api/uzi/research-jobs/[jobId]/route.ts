import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { serializeResearchJob } from "@/lib/uzi/research-jobs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const job = await prisma.uziResearchJob.findFirst({
    where: { id: jobId, user: { clerkUserId } },
  });
  if (!job) {
    return NextResponse.json({ success: false, error: "研判任务不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, job: serializeResearchJob(job) });
}
