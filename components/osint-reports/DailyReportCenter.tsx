"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Loader2, Plus, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { OsintDailyReportSummary } from "@/lib/osint/daily-report/contracts";

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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const response = await fetch("/api/osint/v1/reports?limit=31", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      setReports(Array.isArray(payload.reports) ? payload.reports : []);
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

  async function generateReport() {
    setGenerating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/osint/v1/reports/generate", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          response.status === 401 ? "请先登录后生成日报" : payload.error || "日报生成失败"
        );
      }
      setMessage("今日复盘已归档；同一天重复生成会更新快照。 ");
      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "日报生成失败");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto bg-[#070B12] text-base text-[#D6DEE8]">
      <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
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
            <button type="button" disabled={generating} onClick={generateReport} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#2EC4C7] px-5 font-medium text-[#071018] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              生成今日复盘
            </button>
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
          <section className="rounded-xl border border-dashed border-[#2A394E] bg-[#0D1420] px-5 py-12 text-center">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-[#536177]" />
            <h2 className="font-medium text-white">还没有日报</h2>
            <p className="mt-2 text-base text-[#718096]">生成后会按上海自然日归档，便于后续 Agent 读取与复盘。</p>
          </section>
        ) : (
          <section className="space-y-3" aria-label="日报归档">
            {reports.map((report) => (
              <Link key={report.id} href={`/osint/reports/${encodeURIComponent(report.id)}`} className="block rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 transition-colors hover:border-[#2EC4C7]/40 hover:bg-[#101A29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-white">{report.title}</h2>
                    <p className="mt-1 text-sm text-[#718096]">截至 {new Date(report.asOf).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#2A394E] px-2 py-1 text-xs text-[#8B98AA]"><ShieldCheck className="h-3 w-3" />{STATUS_LABELS[report.status]}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <span className="rounded-lg bg-[#111B2A] px-2 py-2">行情 {report.marketAvailable}/{report.marketTotal}</span>
                  <span className="rounded-lg bg-[#111B2A] px-2 py-2">热点 {report.storyCount}</span>
                  <span className="rounded-lg bg-[#111B2A] px-2 py-2">龙虎榜 {report.lhbStockCount}</span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
