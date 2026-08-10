import type { Metadata } from "next";
import { UziReportRegistry } from "@/components/uzi/UziReportRegistry";
import { uziReports } from "@/lib/uzi-reports";

export const metadata: Metadata = {
  title: "Uzi 游资研判台 | Alpha-Quant-Copilot",
  description: "任意 A 股近 30 日龙虎榜快报，以及已注册的 Uzi 深度报告。",
  robots: { index: false, follow: false, noarchive: true },
};

export default function UziReportsPage() {
  return <UziReportRegistry reports={uziReports} />;
}
