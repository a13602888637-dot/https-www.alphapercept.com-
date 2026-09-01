import { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/osint/http";
import { getStorySnapshot } from "@/lib/osint/story-service";
import { parseStoryRequest } from "@/lib/osint/story-query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { page, pageSize, topic } = parseStoryRequest(request.nextUrl.searchParams);
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const snapshot = await getStorySnapshot({ window: "72h", page, pageSize, topic, forceRefresh });
  const cacheControl = forceRefresh
    ? "private, no-store"
    : "private, max-age=0, must-revalidate";
  return jsonWithEtag(request, snapshot, cacheControl);
}
