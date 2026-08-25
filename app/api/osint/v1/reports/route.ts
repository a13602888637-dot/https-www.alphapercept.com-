import { NextRequest, NextResponse } from "next/server";
import { listDailyReports } from "@/lib/osint/daily-report/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 31);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 31;
    const reports = await listDailyReports(limit);
    return NextResponse.json({ schemaVersion: "1.0", reports });
  } catch (error) {
    console.error("[osint reports] list failed", error);
    return NextResponse.json(
      { schemaVersion: "1.0", reports: [], error: "复盘归档暂不可用" },
      { status: 503 }
    );
  }
}
