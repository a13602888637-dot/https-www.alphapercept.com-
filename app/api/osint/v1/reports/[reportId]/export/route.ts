import { NextRequest, NextResponse } from "next/server";
import {
  buildDailyReportHtml,
  hasRequiredExportNotices,
} from "@/lib/osint/daily-report/export-html";
import type { DailyReportExportSection } from "@/lib/osint/daily-report/contracts";
import { getDailyReport } from "@/lib/osint/daily-report/repository";

export const dynamic = "force-dynamic";

const SECTIONS = new Set<DailyReportExportSection>([
  "full",
  "markets",
  "stories",
  "lhb",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const requestedSection = request.nextUrl.searchParams.get("section") ?? "full";
  if (!SECTIONS.has(requestedSection as DailyReportExportSection)) {
    return NextResponse.json({ error: "不支持的导出范围" }, { status: 400 });
  }

  const { reportId } = await params;
  const report = await getDailyReport(decodeURIComponent(reportId));
  if (!report) {
    return NextResponse.json({ error: "报告不存在" }, { status: 404 });
  }

  const html = buildDailyReportHtml(
    report.snapshot,
    requestedSection as DailyReportExportSection,
    { autoPrint: request.nextUrl.searchParams.get("print") !== "0" }
  );
  if (!hasRequiredExportNotices(html)) {
    return NextResponse.json(
      { error: "导出保护信息不完整，已阻止导出" },
      { status: 500 }
    );
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="osint-${report.reportDate}-${report.edition}-v${report.version}-${requestedSection}.html"`,
    },
  });
}
