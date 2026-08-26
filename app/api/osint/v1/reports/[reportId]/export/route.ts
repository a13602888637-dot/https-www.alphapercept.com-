import { NextRequest, NextResponse } from "next/server";
import { buildDailyReportPdf } from "@/lib/osint/daily-report/pdf-export";
import type { DailyReportExportSection } from "@/lib/osint/daily-report/contracts";
import { getDailyReport } from "@/lib/osint/daily-report/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SECTIONS = new Set<DailyReportExportSection>([
  "full",
  "stories",
  "stocks",
  "lhb",
]);
const pdfPromiseCache = new Map<string, Promise<Buffer>>();

function cachedPdf(key: string, build: () => Promise<Buffer>): Promise<Buffer> {
  const cached = pdfPromiseCache.get(key);
  if (cached) return cached;
  const pending = build().catch((error) => {
    pdfPromiseCache.delete(key);
    throw error;
  });
  pdfPromiseCache.set(key, pending);
  if (pdfPromiseCache.size > 32) {
    const oldest = pdfPromiseCache.keys().next().value;
    if (oldest && oldest !== key) pdfPromiseCache.delete(oldest);
  }
  return pending;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const requestedSection = request.nextUrl.searchParams.get("section") ?? "full";
  if (!SECTIONS.has(requestedSection as DailyReportExportSection)) {
    return NextResponse.json({ error: "不支持的导出范围" }, { status: 400 });
  }

  const { reportId } = await params;
  const report = await getDailyReport(decodeURIComponent(reportId));
  if (!report) {
    return NextResponse.json({ error: "报告不存在" }, { status: 404 });
  }

  try {
    const pdf = await cachedPdf(
      `${report.id}:${requestedSection}`,
      () => buildDailyReportPdf(
        report.snapshot,
        requestedSection as DailyReportExportSection
      )
    );
    const filename = `alphapercept-osint-${report.reportDate}-${report.edition}-v${report.version}-${requestedSection}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
        "CDN-Cache-Control": "public, s-maxage=31536000, immutable",
        "Vercel-CDN-Cache-Control": "public, s-maxage=31536000, immutable",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.length),
        "X-Content-Type-Options": "nosniff",
        "ETag": `"${report.id}-${requestedSection}"`,
      },
    });
  } catch (error) {
    console.error("[osint reports] pdf export failed", error);
    return NextResponse.json(
      { error: "PDF 生成失败，请稍后重试" },
      { status: 500 }
    );
  }
}
