import { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/osint/http";
import { getStorySnapshot } from "@/lib/osint/story-service";
import { parseStoryRequest } from "@/lib/osint/story-query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { page, pageSize, topic } = parseStoryRequest(request.nextUrl.searchParams);
  const snapshot = await getStorySnapshot({ window: "72h", page, pageSize, topic });
  return jsonWithEtag(request, snapshot, "public, s-maxage=300, stale-while-revalidate=900");
}
