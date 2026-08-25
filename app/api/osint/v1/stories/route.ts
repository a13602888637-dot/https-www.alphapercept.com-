import { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/osint/http";
import { getStorySnapshot } from "@/lib/osint/story-service";

export const dynamic = "force-dynamic";

export function parseStoryRequest(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  topic: string | null;
} {
  const requestedPage = Number(searchParams.get("page") ?? 1);
  const requestedPageSize = Number(searchParams.get("pageSize") ?? searchParams.get("limit") ?? 20);
  const requestedTopic = searchParams.get("topic");
  const allowedTopics = new Set(["地缘", "宏观", "能源", "科技"]);
  return {
    page: Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1,
    pageSize: Number.isFinite(requestedPageSize) ? Math.min(50, Math.max(1, Math.floor(requestedPageSize))) : 20,
    topic: requestedTopic && allowedTopics.has(requestedTopic) ? requestedTopic : null,
  };
}

export async function GET(request: NextRequest) {
  const { page, pageSize, topic } = parseStoryRequest(request.nextUrl.searchParams);
  const snapshot = await getStorySnapshot({ window: "72h", page, pageSize, topic });
  return jsonWithEtag(request, snapshot, "public, s-maxage=300, stale-while-revalidate=900");
}
