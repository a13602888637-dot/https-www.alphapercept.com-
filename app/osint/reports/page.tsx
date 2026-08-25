import type { Metadata } from "next";
import { DailyReportCenter } from "@/components/osint-reports";

export const metadata: Metadata = {
  title: "每日复盘中心 | AlphaPercept",
  description: "OSINT 行情、热点与龙虎榜的每日归档快照。",
  robots: { index: false, follow: false, noarchive: true },
};

export default function OsintReportsPage() {
  return <DailyReportCenter />;
}
