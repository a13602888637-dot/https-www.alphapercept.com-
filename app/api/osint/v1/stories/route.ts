import { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/osint/http";
import { getStorySnapshot } from "@/lib/osint/story-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 20;
  const snapshot = await getStorySnapshot({ window: "24h", limit });
  return jsonWithEtag(request, snapshot, "public, s-maxage=300, stale-while-revalidate=900");
}
