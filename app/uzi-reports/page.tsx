import type { Metadata } from "next";
import { Suspense } from "react";
import { UziResearchWorkbench } from "@/components/uzi/UziResearchWorkbench";
import { getOwnedUziReports, requireResearchUserId } from "@/lib/uzi/report-access";

export const metadata: Metadata = {
  title: "Uzi 深度研判 | AlphaPercept",
  description: "由本机 Codex 执行、经过多 Agent 复核的个人持仓深度研判。",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function UziReportsPage() {
  const clerkUserId = await requireResearchUserId();
  const reports = await getOwnedUziReports(clerkUserId);
  return (
    <Suspense fallback={<div className="min-h-[calc(100dvh-40px)] bg-[#080b10]" />}>
      <UziResearchWorkbench reports={reports} />
    </Suspense>
  );
}
