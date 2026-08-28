import { NextRequest, NextResponse } from "next/server";
import {
  buildDailyReportPng,
  type DailyReportImageSection,
} from "@/lib/osint/daily-report/image-export";
import { DAILY_REPORT_IMAGE_LAYOUT_VERSION } from "@/lib/osint/daily-report/image-contract";
import { sharePosterDate } from "@/lib/osint/daily-report/image-copy";
import { getDailyReport } from "@/lib/osint/daily-report/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SECTIONS = new Set<DailyReportImageSection>(["stories", "hotlist"]);
const imagePromiseCache = new Map<string, Promise<Buffer>>();

function cachedImage(key: string, build: () => Promise<Buffer>): Promise<Buffer> {
  const cached = imagePromiseCache.get(key);
  if (cached) return cached;
  const pending = build().catch((error) => {
    imagePromiseCache.delete(key);
    throw error;
  });
  imagePromiseCache.set(key, pending);
  if (imagePromiseCache.size > 32) {
    const oldest = imagePromiseCache.keys().next().value;
    if (oldest && oldest !== key) imagePromiseCache.delete(oldest);
  }
  return pending;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const requestedSection = request.nextUrl.searchParams.get("section") ?? "stories";
  if (!SECTIONS.has(requestedSection as DailyReportImageSection)) {
    return NextResponse.json({ error: "不支持的图片类型" }, { status: 400 });
  }

  const { reportId } = await params;
  const report = await getDailyReport(decodeURIComponent(reportId));
  if (!report) {
    return NextResponse.json({ error: "报告不存在" }, { status: 404 });
  }

  try {
    const png = await cachedImage(
      `${report.id}:${requestedSection}:${DAILY_REPORT_IMAGE_LAYOUT_VERSION}`,
      () => buildDailyReportPng(report.snapshot, requestedSection as DailyReportImageSection)
    );
    const label = requestedSection === "stories" ? "morning-hotspots" : "stock-hotlist";
    const posterDate = sharePosterDate(requestedSection as DailyReportImageSection, {
      reportDate: report.reportDate,
      generatedAt: report.generatedAt,
      tradeDate: report.snapshot.lhb.tradeDate,
    });
    const filename = `alphapercept-${posterDate}-${label}-${DAILY_REPORT_IMAGE_LAYOUT_VERSION}.png`;
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
        "CDN-Cache-Control": "public, s-maxage=31536000, immutable",
        "Vercel-CDN-Cache-Control": "public, s-maxage=31536000, immutable",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(png.length),
        "X-Content-Type-Options": "nosniff",
        "ETag": `"${report.id}-${requestedSection}-${DAILY_REPORT_IMAGE_LAYOUT_VERSION}"`,
      },
    });
  } catch (error) {
    console.error("[osint reports] image export failed", error);
    return NextResponse.json({ error: "图片生成失败，请稍后重试" }, { status: 500 });
  }
}
