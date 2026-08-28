import { NextResponse } from "next/server";
import { uziReportManifest } from "@/lib/uzi-reports";
import { isAuthorizedUziWorker } from "@/lib/uzi/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedUziWorker(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ success: true, manifest: uziReportManifest });
}
