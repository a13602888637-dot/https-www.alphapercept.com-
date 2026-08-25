import { NextRequest } from "next/server";
import { getLhbSnapshot } from "@/lib/lhb/service";
import { jsonWithEtag } from "@/lib/osint/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? undefined;
  const snapshot = await getLhbSnapshot({ date });
  return jsonWithEtag(request, snapshot, "public, s-maxage=300, stale-while-revalidate=900");
}
