"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  FileChartColumnIncreasing,
  MessageSquareText,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  getUziReportViewerPath,
  type UziReport,
  type UziSchoolScore,
} from "@/lib/uzi-reports";

function scoreTone(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 65) return "text-cyan-300";
  if (score >= 50) return "text-amber-300";
  return "text-rose-300";
}

function barTone(score: number | null): string {
  if (score === null) return "bg-slate-700";
  if (score >= 65) return "bg-cyan-400";
  if (score >= 45) return "bg-amber-400";
  return "bg-rose-400";
}

function SchoolPulse({ school }: { school: UziSchoolScore }) {
  const score = school.consensus ?? 0;
  return (
    <div
      className={`min-w-0 rounded-md border px-2 py-2 ${
        school.id === "F"
          ? "border-fuchsia-400/30 bg-fuchsia-400/[0.05]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
      title={`${school.label}：${school.consensus ?? "—"} 分，${school.verdict}`}
    >
      <div className="flex items-center justify-between gap-1 text-[9px] font-mono">
        <span className="truncate text-slate-500">{school.id}</span>
        <span className="tabular-nums text-slate-300">
          {school.consensus?.toFixed(0) ?? "—"}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full ${barTone(school.consensus)}`}
          style={{ width: `${Math.max(2, Math.min(score, 100))}%` }}
        />
      </div>
    </div>
  );
}

function QualityBadge({ report }: { report: UziReport }) {
  if (report.agentReviewed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300">
        <ShieldCheck className="h-3 w-3" /> 分析师复核
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200">
      <Bot className="h-3 w-3" /> 机械评审
    </span>
  );
}

function ReportCard({ report }: { report: UziReport }) {
  const youzi = report.schools.find((school) => school.id === "F");
  const warningCount = report.quality.selfReview?.warningCount ?? 0;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b111d] shadow-[0_18px_60px_rgba(0,0,0,0.18)] transition-colors hover:border-cyan-400/25">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent opacity-40" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-white">
                {report.name}
              </h2>
              <span className="font-mono text-[10px] tracking-wide text-slate-500">
                {report.ticker}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {report.verdict}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div className={`font-mono text-4xl font-black tabular-nums ${scoreTone(report.overallScore)}`}>
              {report.overallScore?.toFixed(1) ?? "—"}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-slate-600">
              Uzi Score
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-white/[0.05] bg-black/10 p-3">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-600">价格基准</p>
            <p className="mt-1 font-mono text-sm text-slate-200">
              {report.price === null ? "—" : `¥${report.price.toFixed(2)}`}
            </p>
            <p className="mt-0.5 text-[9px] text-slate-600">{report.priceAsOf ?? "无日期"}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-600">趋势阶段</p>
            <p className="mt-1 truncate text-xs text-slate-200">{report.trend}</p>
            <p className="mt-0.5 text-[9px] text-slate-600">报告生成时</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-600">游资共识</p>
            <p className="mt-1 font-mono text-sm text-fuchsia-300">
              {youzi?.consensus?.toFixed(1) ?? "—"}
            </p>
            <p className="mt-0.5 truncate text-[9px] text-slate-600">{youzi?.verdict ?? "无数据"}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
              九派共识脉冲
            </span>
            <span className="font-mono text-[9px] text-slate-600">
              {report.signals.bullish} 多 / {report.signals.neutral} 中 / {report.signals.bearish} 空
            </span>
          </div>
          <div className="grid grid-cols-9 gap-1">
            {report.schools.map((school) => (
              <SchoolPulse key={school.id} school={school} />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <QualityBadge report={report} />
          <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400">
            {report.quality.status === "pass" ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-400" />
            )}
            自检 {warningCount} 警告
          </span>
          <span className="font-mono text-[9px] text-slate-600">
            {report.validation.seats} 评委 · {report.quality.dimensions.full}/{report.quality.dimensions.total} 维完整
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-white/[0.06] bg-black/10">
        <Link
          href={getUziReportViewerPath(report)}
          className="flex items-center justify-center gap-1.5 border-r border-white/[0.06] px-2 py-3 text-[11px] font-medium text-cyan-300 transition-colors hover:bg-cyan-400/[0.06]"
        >
          <FileChartColumnIncreasing className="h-3.5 w-3.5" /> 完整报告
        </Link>
        <Link
          href={getUziReportViewerPath(report, "jury")}
          className="flex items-center justify-center gap-1.5 border-r border-white/[0.06] px-2 py-3 text-[11px] text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <Users className="h-3.5 w-3.5" /> 大佬评分
        </Link>
        <Link
          href={getUziReportViewerPath(report, "chat")}
          className="flex items-center justify-center gap-1.5 px-2 py-3 text-[11px] text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <MessageSquareText className="h-3.5 w-3.5" /> 大佬群聊
        </Link>
      </div>
    </article>
  );
}

export function UziReportRegistry({ reports }: { reports: UziReport[] }) {
  const [query, setQuery] = useState("");
  const filteredReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reports;
    return reports.filter((report) =>
      [report.name, report.stockCode, report.ticker, report.verdict]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, reports]);

  const reviewedCount = reports.filter((report) => report.agentReviewed).length;
  const latestDate = reports[0]?.reportDate ?? "—";

  return (
    <main className="min-h-full bg-[#060a12] text-slate-100">
      <section className="border-b border-white/[0.06] bg-[radial-gradient(circle_at_78%_20%,rgba(34,211,238,0.10),transparent_34%),linear-gradient(180deg,#08111d_0%,#060a12_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid gap-7 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-400/80">
                <span className="h-px w-8 bg-cyan-400/60" />
                Registered Research
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                Uzi 深度研判库
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                不从行情大屏开始，先从你持有的股票开始。先看结论与风险，再看九派分歧，最后进入 66 位评委和游资聊天室核对逻辑。
              </p>
            </div>

            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/[0.08] bg-black/15">
              <div className="px-3 py-4 text-center">
                <p className="font-mono text-xl font-bold text-white">{reports.length}</p>
                <p className="mt-1 text-[9px] text-slate-600">已注册</p>
              </div>
              <div className="border-x border-white/[0.06] px-3 py-4 text-center">
                <p className="font-mono text-xl font-bold text-white">{reviewedCount}</p>
                <p className="mt-1 text-[9px] text-slate-600">分析师复核</p>
              </div>
              <div className="px-3 py-4 text-center">
                <p className="font-mono text-xs font-bold text-white">{latestDate.slice(5)}</p>
                <p className="mt-2 text-[9px] text-slate-600">最新报告</p>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            {[
              ["01", "搜持仓", "输入股票代码或名称"],
              ["02", "先看结论", "评分、趋势与风险警告"],
              ["03", "再查分歧", "游资、大佬与九派共识"],
            ].map(([step, title, detail]) => (
              <div key={step} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <span className="font-mono text-[10px] text-cyan-500">{step}</span>
                <div>
                  <p className="text-xs font-medium text-slate-200">{title}</p>
                  <p className="mt-0.5 text-[10px] text-slate-600">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">已注册报告</h2>
            <p className="mt-1 text-[10px] text-slate-600">
              价格按报告生成时点展示，不替代实时行情；交易结论仅作研究参考。
            </p>
          </div>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">搜索 Uzi 报告</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="股票代码 / 名称 / 结论"
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#0b111d] pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-700 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
            />
          </label>
        </div>

        {filteredReports.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredReports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/[0.1] px-6 py-16 text-center">
            <p className="text-sm text-slate-400">没有匹配的 Uzi 报告</p>
            <p className="mt-2 text-xs text-slate-600">先运行 Uzi 扫描，再执行报告同步。</p>
          </div>
        )}

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-4 py-3 text-xs leading-5 text-amber-100/70">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p>
            “机械评审”表示报告由规则引擎自动生成，尚未经过分析师逐条复核。自检警告、缺失维度和时间基准均保留展示，避免把自动评分误当成确定性建议。
          </p>
          <ArrowUpRight className="ml-auto hidden h-4 w-4 shrink-0 text-amber-300/40 sm:block" />
        </div>
      </section>
    </main>
  );
}
