import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth-helpers";
import { getOwnedUziReport } from "@/lib/uzi/report-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ reportId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const clerkUserId = await getAuthUserId(request);
  if (!clerkUserId) {
    return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
  }

  const { reportId } = await params;
  const report = await getOwnedUziReport(clerkUserId, decodeURIComponent(reportId));
  if (!report || !report.reportPath.startsWith("/uzi-assets/reports/")) {
    return NextResponse.json({ success: false, error: "报告不存在" }, { status: 404 });
  }

  const reportRoot = resolve(process.cwd(), "public", "uzi-assets", "reports");
  const reportFile = resolve(process.cwd(), "public", `.${report.reportPath}`);
  if (!reportFile.startsWith(`${reportRoot}${sep}`)) {
    return NextResponse.json({ success: false, error: "报告路径无效" }, { status: 400 });
  }

  try {
    const html = await readFile(reportFile, "utf8");
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "sandbox allow-scripts allow-popups; default-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "报告文件不可用" }, { status: 404 });
  }
}
