import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUziReportById, uziReports, type UziReport } from "@/lib/uzi-reports";

export async function requireResearchUserId(returnBackUrl = "/uzi-reports"): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnBackUrl)}`);
  }
  return userId;
}

export async function getOwnedUziReports(clerkUserId: string): Promise<UziReport[]> {
  const jobs = await prisma.uziResearchJob.findMany({
    where: {
      user: { clerkUserId },
      status: "SUCCEEDED",
      publicReportId: { not: null },
    },
    select: { publicReportId: true },
    orderBy: { completedAt: "desc" },
  });
  const ownedReportIds = new Set(
    jobs.flatMap((job) => (job.publicReportId ? [job.publicReportId] : []))
  );
  return uziReports.filter((report) => ownedReportIds.has(report.id));
}

export async function getOwnedUziReport(
  clerkUserId: string,
  reportId: string
): Promise<UziReport | null> {
  const ownedJob = await prisma.uziResearchJob.findFirst({
    where: {
      user: { clerkUserId },
      status: "SUCCEEDED",
      publicReportId: reportId,
    },
    select: { id: true },
  });
  return ownedJob ? getUziReportById(reportId) : null;
}
