import { NextRequest, NextResponse } from "next/server";
import { shanghaiDateKey } from "@/lib/osint/daily-report/compose";
import type { DailyReportEdition } from "@/lib/osint/daily-report/contracts";
import {
  classifyDailyReportGenerationError,
  ensureDailyReportGenerated,
  isReusableDailyReport,
} from "@/lib/osint/daily-report/generation";
import { isDailyReportImageReady } from "@/lib/osint/daily-report/image-readiness";
import { getLatestFinalDailyReport, summarizeDailyReport } from "@/lib/osint/daily-report/repository";
import { generateAndSaveDailyReport } from "@/lib/osint/daily-report/service";

export const dynamic = "force-dynamic";

function hasCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}

function validEdition(value: unknown): DailyReportEdition {
  return value === "global" ? "global" : "close";
}

export async function GET(request: NextRequest) {
  if (!hasCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: "仅受信任定时任务可生成共享日报" },
      { status: 403 }
    );
  }
  const edition = validEdition(request.nextUrl.searchParams.get("edition"));
  const compact = request.nextUrl.searchParams.get("compact") === "true";
  const reportDate = shanghaiDateKey(new Date());
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  console.log(JSON.stringify({
    level: "info",
    msg: "generation-start",
    route: "/api/osint/v1/reports/generate",
    requestId,
    reportDate,
    edition,
  }));
  try {
    const result = await ensureDailyReportGenerated(
      { reportDate, edition },
      {
        findExisting: getLatestFinalDailyReport,
        isReusable: (report) => isReusableDailyReport(
          report,
          isDailyReportImageReady(report.snapshot)
        ),
        generate: () => generateAndSaveDailyReport({
          reportDate,
          edition,
          status: "final",
        }),
      }
    );
    console.log(JSON.stringify({
      level: "info",
      msg: "generation-complete",
      route: "/api/osint/v1/reports/generate",
      requestId,
      reportDate,
      edition,
      created: result.created,
      reportId: result.report.id,
      durationMs: Date.now() - startedAt,
    }));
    return NextResponse.json(
      {
        success: true,
        created: result.created,
        report: compact ? summarizeDailyReport(result.report) : result.report,
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    const errorCode = classifyDailyReportGenerationError(error);
    console.error(JSON.stringify({
      level: "error",
      msg: "generation-failed",
      route: "/api/osint/v1/reports/generate",
      requestId,
      reportDate,
      edition,
      errorCode,
      errorName: error instanceof Error ? error.name : "UnknownError",
      durationMs: Date.now() - startedAt,
    }));
    if (errorCode === "CLOSE_DATA_NOT_READY") {
      return NextResponse.json(
        { success: false, code: errorCode, error: "收盘数据尚未就绪，请稍后重试" },
        { status: 503, headers: { "Retry-After": "300" } }
      );
    }
    return NextResponse.json(
      { success: false, code: "REPORT_GENERATION_FAILED", error: "日报生成失败，请稍后重试" },
      { status: 500 }
    );
  }
}
