"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { OsintDailyReportRecord } from "@/lib/osint/daily-report/contracts";
import { DAILY_REPORT_DISCLAIMER } from "@/lib/osint/daily-report/export-html";
import { curateReportStories, rankReportStocks } from "@/lib/osint/daily-report/story-curation";
import { PrintActions } from "./PrintActions";

const VIEW_MODES = [
  { value: "stories", label: "热点" },
  { value: "stocks", label: "个股资金" },
  { value: "lhb", label: "游资" },
] as const;
type ViewMode = (typeof VIEW_MODES)[number]["value"];

function amount(value: number): string {
  return `${(value / 10_000).toLocaleString("zh-CN", { maximumFractionDigits: 0 })} 万`;
}

function signedAmount(value: number): string {
  return `${value >= 0 ? "+" : ""}${amount(value)}`;
}

export function DailyReportView({
  reportId,
  embedded = false,
}: {
  reportId: string;
  embedded?: boolean;
}) {
  const [report, setReport] = useState<OsintDailyReportRecord | null>(null);
  const [exportReady, setExportReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("stories");

  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setExportReady(false);
    setError(null);
    void fetch(`/api/osint/v1/reports/${encodeURIComponent(reportId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
        setReport(payload.report);
        setExportReady(payload.exportReady === true);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "报告读取失败");
      });
    return () => controller.abort();
  }, [reportId]);

  if (error) {
    return <div className={`${embedded ? "min-h-48 rounded-xl border border-amber-400/20 bg-[#0D1420]" : "h-full bg-[#070B12]"} p-6 text-base text-amber-200`}>{error}</div>;
  }
  if (!report) {
    return <div className={`flex ${embedded ? "min-h-48 rounded-xl border border-[#1F2A3A] bg-[#0D1420]" : "h-full bg-[#070B12]"} items-center justify-center text-base text-[#718096]`}><Loader2 className="mr-2 h-5 w-5 animate-spin" />读取日报</div>;
  }

  const snapshot = report.snapshot;
  const curatedStories = curateReportStories(snapshot.stories.stories);
  const rankedStocks = rankReportStocks(snapshot.lhb.stocks);

  return (
    <div className={`${embedded ? "rounded-xl border border-[#1F2A3A] bg-[#090F18]" : "h-full overflow-y-auto bg-[#070B12]"} text-base leading-7 text-[#D6DEE8]`}>
      <div className={`w-full space-y-4 px-4 py-5 pb-28 sm:px-6 sm:py-8 sm:pb-8 ${embedded ? "max-w-none" : "mx-auto max-w-6xl"}`}>
        {!embedded && <Link href="/osint/reports" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#8B98AA] hover:text-white"><ArrowLeft className="h-4 w-4" />返回每日复盘</Link>}
        <header className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-5">
          <p className="text-sm tracking-[0.14em] text-[#2EC4C7]">DAILY SNAPSHOT</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{snapshot.title}</h1>
          <p className="mt-2 text-sm text-[#718096]">{report.edition === "global" ? "全球终版" : "收盘版"} · v{report.version} · 数据截至 {new Date(snapshot.asOf).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} · 归档后不随实时数据变化</p>
          <div className="mt-4"><PrintActions reportId={report.id} exportReady={exportReady} /></div>
        </header>

        <nav className="sticky top-0 z-20 grid grid-cols-3 gap-1 rounded-xl border border-[#1F2A3A] bg-[#070B12]/95 p-1 backdrop-blur" aria-label="复盘内容">
          {VIEW_MODES.map((item) => (
            <button key={item.value} type="button" aria-pressed={viewMode === item.value} onClick={() => setViewMode(item.value)} className={`min-h-11 rounded-lg text-sm ${viewMode === item.value ? "bg-[#173044] text-[#9DE7E8]" : "text-[#718096]"}`}>{item.label}</button>
          ))}
        </nav>

        {viewMode === "stories" && (
          <section className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-xl font-semibold text-white">热点复盘</h2><p className="mt-1 text-sm text-[#718096]">从 {curatedStories.totalCount} 条事件中精选 {curatedStories.selectedCount} 条 · 分类展示 · 组内最新优先</p></div>
              <span className="text-xs text-[#536177]">低重要度单源杂讯不进入日报</span>
            </div>
            <p className="mt-4 rounded-lg border-l-4 border-[#F2B84B] bg-[#F2B84B]/[0.07] px-3 py-2 text-[#F6C968]">总览建议：{snapshot.stories.advice.text}</p>
            <div className="mt-4 space-y-4">
              {curatedStories.categories.map((category) => (
                <section key={category.key} className="overflow-hidden rounded-xl border border-[#243248] bg-[#0A111C]">
                  <header className="border-b border-[#243248] bg-[#101B2A] px-4 py-3">
                    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-[#9DE7E8]">{category.label}</h3><span className="rounded-full border border-[#2EC4C7]/25 px-2 py-0.5 text-xs text-[#718096]">{category.stories.length} 条</span></div>
                    <p className="mt-1 text-sm leading-6 text-[#AAB5C4]">{category.insight}</p>
                  </header>
                  <div className="divide-y divide-[#1F2A3A] px-4">
                    {category.stories.map((story) => (
                      <article key={story.id} className="py-4">
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-medium text-white">{story.title}</h4><time className="mt-1 block text-xs text-[#718096]">{new Date(story.publishedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</time></div><span className="shrink-0 text-xs text-[#F2B84B]">{story.importance.toFixed(1)}/10</span></div>
                        <p className="mt-2 text-[#AAB5C4]">{story.summary}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">{[...story.tags.topic, ...story.tags.region, ...story.tags.assets].slice(0, 7).map((tag) => <span key={tag} className="rounded-full border border-[#2A394E] px-2 py-0.5 text-xs text-[#8B98AA]">{tag}</span>)}</div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
              {curatedStories.selectedCount === 0 && <p className="py-8 text-center text-[#718096]">该快照暂无达到日报筛选标准的热点</p>}
            </div>
          </section>
        )}

        {viewMode === "stocks" && (
          <section className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
            <h2 className="text-xl font-semibold text-white">个股资金榜</h2>
            <p className="mt-1 text-sm text-[#718096]">交易日 {snapshot.lhb.tradeDate || "暂无"} · 按净买入额排序 · {rankedStocks.length} 只上榜股票</p>
            <div className="mt-4 divide-y divide-[#1F2A3A]">
              {rankedStocks.map((stock, index) => (
                <article key={stock.tradeId} className="grid gap-3 py-3 sm:grid-cols-[36px_minmax(180px,1fr)_repeat(3,minmax(96px,auto))] sm:items-center">
                  <span className="font-mono text-sm text-[#536177]">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0"><h3 className="font-medium text-white">{stock.name} <span className="font-mono text-xs text-[#718096]">{stock.code}</span></h3><p className="mt-1 truncate text-xs text-[#718096]" title={stock.reasons.join(" / ")}>{stock.reasons.join(" / ")}</p></div>
                  <p className="font-mono text-sm text-[#F35A5A]"><span className="mr-1 text-xs text-[#536177]">买</span>{amount(stock.buyAmount)}</p>
                  <p className="font-mono text-sm text-[#36C878]"><span className="mr-1 text-xs text-[#536177]">卖</span>{amount(stock.sellAmount)}</p>
                  <p className={`font-mono text-sm ${stock.netAmount >= 0 ? "text-[#F35A5A]" : "text-[#36C878]"}`}><span className="mr-1 text-xs text-[#536177]">净</span>{signedAmount(stock.netAmount)}</p>
                </article>
              ))}
              {rankedStocks.length === 0 && <p className="py-8 text-center text-[#718096]">该快照暂无个股资金榜</p>}
            </div>
          </section>
        )}

        {viewMode === "lhb" && (
          <section className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
            <h2 className="text-xl font-semibold text-white">游资席位榜</h2>
            <p className="mt-1 text-sm text-[#718096]">交易日 {snapshot.lhb.tradeDate || "暂无"} · {snapshot.lhb.hotMoneyFlows.length} 组游资/活跃席位 · {snapshot.lhb.status}</p>
            <div className="mt-3 space-y-3">
              {snapshot.lhb.hotMoneyFlows.slice(0, 30).map((flow) => (
                <article key={flow.flowId} className="rounded-lg border border-[#1F2A3A] bg-[#0A111C] p-3">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium text-white">{flow.label}</h3><p className="mt-1 text-xs text-[#718096]">{flow.departmentNames.join(" / ")}</p></div><span className="shrink-0 rounded-full border border-[#2EC4C7]/30 px-2 py-0.5 text-xs text-[#9DE7E8]">{flow.kind === "known" ? `观察可信度 ${flow.confidence ?? "C"}` : "活跃席位"}</span></div>
                  <p className="mt-3 font-mono text-sm"><span className="text-[#F35A5A]">买 {amount(flow.totalBuyAmount)}</span><span className="ml-3 text-[#36C878]">卖 {amount(flow.totalSellAmount)}</span><span className="ml-3 text-[#AAB5C4]">净 {signedAmount(flow.totalNetAmount)}</span></p>
                  <div className="mt-2 divide-y divide-[#1F2A3A]">{flow.stocks.slice(0, 3).map((stock) => <div key={`${flow.flowId}-${stock.code}`} className="grid grid-cols-[1fr_auto] gap-2 py-2"><div><p className="text-white">{stock.name} <span className="font-mono text-xs text-[#718096]">{stock.code}</span></p><p className="truncate text-xs text-[#718096]">{stock.reasons.join(" / ")}</p></div><p className="font-mono text-xs text-[#F35A5A]">买 {amount(stock.buyAmount)}</p></div>)}</div>
                  {flow.stockCount > flow.stocks.length && <p className="pt-2 text-right text-xs text-[#536177]">另有 {flow.stockCount - flow.stocks.length} 只买入股票</p>}
                </article>
              ))}
              {snapshot.lhb.hotMoneyFlows.length === 0 && <p className="py-8 text-center text-[#718096]">该快照暂无游资或活跃席位</p>}
            </div>
          </section>
        )}

        <footer className="rounded-xl border border-[#2A394E] bg-[#0A111C] p-4 text-sm leading-6 text-[#8B98AA]">{DAILY_REPORT_DISCLAIMER}</footer>
      </div>
    </div>
  );
}
