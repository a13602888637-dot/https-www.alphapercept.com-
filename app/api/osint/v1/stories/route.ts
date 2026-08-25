import { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/osint/http";
import { getStorySnapshot } from "@/lib/osint/story-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const requestedPageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? request.nextUrl.searchParams.get("limit") ?? 20);
  const requestedTopic = request.nextUrl.searchParams.get("topic");
  const allowedTopics = new Set(["地缘", "宏观", "能源", "科技"]);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const pageSize = Number.isFinite(requestedPageSize) ? Math.min(50, Math.max(10, Math.floor(requestedPageSize))) : 20;
  const topic = requestedTopic && allowedTopics.has(requestedTopic) ? requestedTopic : null;
  const snapshot = await getStorySnapshot({ window: "72h", page, pageSize, topic });
  return jsonWithEtag(request, snapshot, "public, s-maxage=300, stale-while-revalidate=900");
}
