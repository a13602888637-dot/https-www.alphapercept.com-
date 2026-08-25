import { NextRequest } from "next/server";
import { composePublicContext } from "@/lib/osint/context";
import { jsonWithEtag } from "@/lib/osint/http";
import { getMarketSnapshot } from "@/lib/osint/market-service";
import { getStorySnapshot } from "@/lib/osint/story-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const [markets, stories] = await Promise.all([getMarketSnapshot(), getStorySnapshot({ window: "72h", page: 1, pageSize: 50 })]);
  const context = composePublicContext(markets, stories);
  return jsonWithEtag(request, context, "public, s-maxage=60, stale-while-revalidate=300");
}
