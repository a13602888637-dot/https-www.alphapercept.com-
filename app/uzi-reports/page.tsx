import type { Metadata } from "next";
import { UziReportRegistry } from "@/components/uzi/UziReportRegistry";
import { uziReports } from "@/lib/uzi-reports";

export const metadata: Metadata = {
  title: "Uzi 深度研判库 | Alpha-Quant-Copilot",
  description: "已注册的 Uzi 深度报告、九派评分、游资共识与大佬评审。",
  robots: { index: false, follow: false, archive: false },
};

export default function UziReportsPage() {
  return <UziReportRegistry reports={uziReports} />;
}
