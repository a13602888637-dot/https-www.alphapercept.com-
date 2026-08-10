import type { Metadata } from "next";
import { Suspense } from "react";
import { UziResearchWorkbench } from "@/components/uzi/UziResearchWorkbench";
import { uziReports } from "@/lib/uzi-reports";

export const metadata: Metadata = {
  title: "Uzi 深度研判 | AlphaPercept",
  description: "由本机 Codex 执行、经过多 Agent 复核的个人持仓深度研判。",
  robots: { index: false, follow: false, noarchive: true },
};

export default function UziReportsPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100dvh-40px)] bg-[#080b10]" />}>
      <UziResearchWorkbench reports={uziReports} />
    </Suspense>
  );
}
