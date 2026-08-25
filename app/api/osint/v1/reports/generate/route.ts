import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import type { DailyReportEdition } from "@/lib/osint/daily-report/contracts";
import { generateAndSaveDailyReport } from "@/lib/osint/daily-report/service";

export const dynamic = "force-dynamic";

function hasCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}

function isConfiguredAdmin(userId: string | null): boolean {
  if (!userId) return false;
  const configured = (process.env.OSINT_REPORT_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return configured.includes(userId);
}

function validReportDate(value: unknown): string | undefined {
  const date = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

function validEdition(value: unknown): DailyReportEdition {
  return value === "global" ? "global" : "close";
}

async function runGeneration(request: NextRequest, body: Record<string, unknown> = {}) {
  const session = await auth();
  if (!hasCronSecret(request) && !isConfiguredAdmin(session.userId)) {
    return NextResponse.json(
      { success: false, error: "仅管理员或受信任定时任务可生成共享日报" },
      { status: 403 }
    );
  }
  try {
    const report = await generateAndSaveDailyReport({
      reportDate: validReportDate(body.reportDate),
      edition: validEdition(body.edition),
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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  return runGeneration(request, body);
}

// Reserved for a future Vercel Cron entry. Vercel supplies CRON_SECRET through
// the Authorization header; no cron is added in this change.
export async function GET(request: NextRequest) {
  return runGeneration(request);
}
