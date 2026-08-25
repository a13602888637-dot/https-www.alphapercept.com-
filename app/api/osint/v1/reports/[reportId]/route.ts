import { NextRequest, NextResponse } from "next/server";
import {
  isDailyReportExportReady,
} from "@/lib/osint/daily-report/export-html";
import { getDailyReport } from "@/lib/osint/daily-report/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const report = await getDailyReport(decodeURIComponent(reportId));
    if (!report) {
      return NextResponse.json(
        { success: false, error: "报告不存在" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      report,
      exportReady: isDailyReportExportReady(report.snapshot),
    });
  } catch (error) {
    console.error("[osint reports] detail failed", error);
    return NextResponse.json(
      { success: false, error: "报告读取失败" },
      { status: 503 }
    );
  }
}
