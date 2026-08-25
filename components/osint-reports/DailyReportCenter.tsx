"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { OsintDailyReportSummary } from "@/lib/osint/daily-report/contracts";
import { DailyReportView } from "./DailyReportView";

const PERIODS = [
  { label: "日复盘", enabled: true },
  { label: "周复盘", enabled: false },
  { label: "月复盘", enabled: false },
] as const;

const STATUS_LABELS = {
  healthy: "数据完整",
  degraded: "部分数据降级",
  unavailable: "数据不可用",
} as const;

export function DailyReportCenter() {
  const [reports, setReports] = useState<OsintDailyReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const response = await fetch("/api/osint/v1/reports?limit=31", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      const nextReports = Array.isArray(payload.reports) ? payload.reports : [];
      setReports(nextReports);
      setSelectedReportId((current) =>
        current && nextReports.some((report: OsintDailyReportSummary) => report.id === current)
          ? current
          : nextReports[0]?.id ?? null,
      );
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "归档读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  return (
    <main className="h-full overflow-y-auto bg-[#070B12] text-base text-[#D6DEE8]">
      <div className="w-full px-4 py-5 sm:px-6 sm:py-8 xl:px-8">
        <header className="mb-5 space-y-4">
          <Link href="/osint" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#8B98AA] hover:text-white">
            <ArrowLeft className="h-4 w-4" /> 返回 OSINT 情报
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-sm tracking-[0.16em] text-[#2EC4C7]">ALPHAPERCEPT REVIEW</p>
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">每日复盘中心</h1>
              <p className="mt-2 text-base leading-7 text-[#8B98AA]">把行情、世界热点和龙虎榜锁定为可回看的当日快照。</p>
            </div>
            <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#2EC4C7]/30 bg-[#2EC4C7]/10 px-4 text-sm text-[#9DE7E8]"><ShieldCheck className="h-4 w-4" />后台每日自动归档</div>
          </div>
        </header>

        <nav className="mb-5 grid grid-cols-3 gap-2" aria-label="复盘周期">
          {PERIODS.map((period) => (
            <button key={period.label} type="button" disabled={!period.enabled} aria-current={period.enabled ? "page" : undefined} className={`min-h-11 rounded-lg border px-3 text-sm ${period.enabled ? "border-[#2EC4C7]/50 bg-[#2EC4C7]/10 text-[#9DE7E8]" : "border-[#1F2A3A] text-[#536177]"}`}>
              {period.label}{!period.enabled && <span className="ml-1 text-xs">规划</span>}
            </button>
          ))}
        </nav>

        {message && <div className="mb-4 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200">{message}</div>}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-[#718096]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />读取归档</div>
        ) : reports.length === 0 ? (
          <section className="flex min-h-[52vh] w-full items-center justify-center rounded-xl border border-dashed border-[#2A394E] bg-[#0D1420] px-5 py-12 text-center">
            <div>
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-[#536177]" />
            <h2 className="font-medium text-white">还没有日报</h2>
            <p className="mt-2 text-base text-[#718096]">生成后会按上海自然日归档，便于后续 Agent 读取与复盘。</p>
            </div>
          </section>
        ) : (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start" aria-label="日报归档">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">日报归档</h2>
                  <p className="mt-1 text-sm text-[#718096]">选择日期，右侧直接预览</p>
                </div>
                <span className="shrink-0 text-sm text-[#536177]">{reports.length} 份</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 xl:max-h-[calc(100dvh-270px)] xl:flex-col xl:overflow-y-auto xl:pr-1">
                {reports.map((report) => {
                  const selected = report.id === selectedReportId;
                  return (
                    <article key={report.id} className={`min-w-[290px] rounded-xl border bg-[#0D1420] p-3 transition-colors xl:min-w-0 ${selected ? "border-[#2EC4C7]/60 bg-[#10202B]" : "border-[#1F2A3A] hover:border-[#2EC4C7]/35"}`}>
                      <button type="button" onClick={() => setSelectedReportId(report.id)} aria-pressed={selected} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate font-medium text-white">{report.title}</h3>
                            <p className="mt-1 text-xs text-[#718096]">{report.edition === "global" ? "全球终版" : "收盘版"} · v{report.version}</p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#2A394E] px-2 py-1 text-[11px] text-[#8B98AA]"><ShieldCheck className="h-3 w-3" />{STATUS_LABELS[report.status]}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-1 text-center text-xs">
                          <span className="rounded bg-[#111B2A] px-1 py-1.5">行情 {report.marketAvailable}/{report.marketTotal}</span>
                          <span className="rounded bg-[#111B2A] px-1 py-1.5">热点 {report.storyCount}</span>
                          <span className="rounded bg-[#111B2A] px-1 py-1.5">龙虎 {report.lhbStockCount}</span>
                        </div>
                      </button>
                      <Link href={`/osint/reports/${encodeURIComponent(report.id)}`} className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs text-[#8B98AA] hover:text-[#9DE7E8]">独立打开 <ExternalLink className="h-3 w-3" /></Link>
                    </article>
                  );
                })}
              </div>
            </aside>

            <section className="min-w-0" aria-label="报告直接预览">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">报告直接预览</h2>
                  <p className="mt-1 text-sm text-[#718096]">页面内阅读，也可分别导出完整、行情、热点和游资 PDF</p>
                </div>
              </div>
              {selectedReportId && <DailyReportView reportId={selectedReportId} embedded />}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
