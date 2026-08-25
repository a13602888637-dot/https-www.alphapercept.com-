import { NextRequest } from "next/server";
import { jsonWithEtag } from "@/lib/osint/http";
import { getMarketSnapshot } from "@/lib/osint/market-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const snapshot = await getMarketSnapshot();
  return jsonWithEtag(request, snapshot, "public, s-maxage=60, stale-while-revalidate=300");
}
