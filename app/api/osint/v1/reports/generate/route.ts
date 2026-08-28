import { NextRequest, NextResponse } from "next/server";
import type { DailyReportEdition } from "@/lib/osint/daily-report/contracts";
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
  try {
    const report = await generateAndSaveDailyReport({
      edition,
      status: "final",
    });
    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error) {
    console.error("[osint reports] generation failed", error);
    return NextResponse.json(
      { success: false, error: "日报生成失败，请稍后重试" },
      { status: 503 }
    );
  }
}
