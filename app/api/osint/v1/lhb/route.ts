import { NextRequest, NextResponse } from "next/server";
import { getLhbSnapshot, toLhbDashboardSnapshot } from "@/lib/lhb/service";
import { jsonWithEtag } from "@/lib/osint/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? undefined;
  const view = request.nextUrl.searchParams.get("view");
  const snapshot = await getLhbSnapshot({ date });
  if (snapshot.status === "unavailable") {
    return NextResponse.json(snapshot, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const responseBody = view === "dashboard" ? toLhbDashboardSnapshot(snapshot) : snapshot;
  return jsonWithEtag(request, responseBody, "public, s-maxage=300, stale-while-revalidate=900");
}
