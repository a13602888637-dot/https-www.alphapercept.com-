import type { Metadata } from "next";
import { DailyReportView } from "@/components/osint-reports";

export const metadata: Metadata = {
  title: "OSINT 日报 | AlphaPercept",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function OsintDailyReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  return <DailyReportView reportId={decodeURIComponent(reportId)} />;
}
