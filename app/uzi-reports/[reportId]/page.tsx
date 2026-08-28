import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CalendarClock,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { getOwnedUziReport, requireResearchUserId } from "@/lib/uzi/report-access";

interface PageProps {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ section?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await params;
  return {
    title: "深度研究报告 | AlphaPercept",
    description: "仅当前账号可访问的 AlphaPercept 深度研究报告。",
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function UziReportViewerPage({
  params,
  searchParams,
}: PageProps) {
  const [{ reportId }, query] = await Promise.all([params, searchParams]);
  const clerkUserId = await requireResearchUserId(`/uzi-reports/${encodeURIComponent(reportId)}`);
  const decodedReportId = decodeURIComponent(reportId);
  const report = await getOwnedUziReport(clerkUserId, decodedReportId);
  if (!report) notFound();

  const sectionHash =
    query.section === "jury"
      ? "#section-jury"
      : query.section === "chat"
        ? "#section-chat"
        : "";
  const contentPath = `/api/uzi/reports/${encodeURIComponent(report.id)}/content`;
  const frameSrc = `${contentPath}${sectionHash}`;

  return (
    <main className="flex h-full min-h-[calc(100dvh-2.5rem)] flex-col bg-[#060a12] text-slate-100">
      <header className="flex shrink-0 flex-col gap-3 border-b border-white/[0.07] bg-[#08101b] px-3 py-3 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/uzi-reports"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-slate-500 transition-colors hover:border-white/15 hover:text-white"
            aria-label="返回 Uzi 报告库"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="truncate text-sm font-semibold text-white">{report.name}</h1>
              <span className="font-mono text-[10px] text-slate-500">{report.ticker}</span>
              <span className="font-mono text-xs font-bold text-cyan-300">
                {report.overallScore?.toFixed(1) ?? "—"} 分
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">{report.verdict}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-0">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] px-2 py-1 text-[9px] text-slate-500">
            <CalendarClock className="h-3 w-3" /> {report.reportDate}
          </span>
          {report.agentReviewed ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[9px] text-emerald-300">
              <ShieldCheck className="h-3 w-3" /> AI Agent 深度复核
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[9px] text-amber-200">
              <Bot className="h-3 w-3" /> 规则机械生成
            </span>
          )}
          <a
            href={frameSrc}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1 text-[9px] text-slate-400 transition-colors hover:text-white"
          >
            独立打开 <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      {(report.quality.status !== "pass" || report.quality.consistencyWarnings.length > 0) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-400/10 bg-amber-400/[0.04] px-4 py-1.5 text-[9px] text-amber-200/70">
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-300" />
          报告自检有 {report.quality.selfReview?.warningCount ?? 0} 项警告
          {report.quality.consistencyWarnings.length > 0 ? "，且评分正文不一致" : ""}；价格基准为 {report.priceAsOf ?? "未知日期"}，不是实时行情。
        </div>
      )}

      <iframe
        title={`${report.name} Uzi 深度报告`}
        src={frameSrc}
        className="min-h-0 flex-1 border-0 bg-[#060a12]"
        sandbox="allow-scripts allow-popups"
        referrerPolicy="no-referrer"
      />
    </main>
  );
}
