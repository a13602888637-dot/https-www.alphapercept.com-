"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { OsintDailyReportRecord } from "@/lib/osint/daily-report/contracts";
import { DAILY_REPORT_DISCLAIMER } from "@/lib/osint/daily-report/export-html";
import { PrintActions } from "./PrintActions";

const VIEW_MODES = [
  { value: "full", label: "综合" },
  { value: "markets", label: "行情" },
  { value: "stories", label: "热点" },
  { value: "lhb", label: "游资" },
] as const;
type ViewMode = (typeof VIEW_MODES)[number]["value"];

function amount(value: number): string {
  return `${(value / 10_000).toLocaleString("zh-CN", { maximumFractionDigits: 0 })} 万`;
}

export function DailyReportView({ reportId, embedded = false }: { reportId: string; embedded?: boolean }) {
  const [report, setReport] = useState<OsintDailyReportRecord | null>(null);
  const [exportReady, setExportReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("full");

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

  if (error) return <div className={`${embedded ? "min-h-48 rounded-xl border border-amber-400/20 bg-[#0D1420]" : "h-full bg-[#070B12]"} p-6 text-base text-amber-200`}>{error}</div>;
  if (!report) return <div className={`flex ${embedded ? "min-h-48 rounded-xl border border-[#1F2A3A] bg-[#0D1420]" : "h-full bg-[#070B12]"} items-center justify-center text-base text-[#718096]`}><Loader2 className="mr-2 h-5 w-5 animate-spin" />读取日报</div>;

  const snapshot = report.snapshot;
  return (
    <div className={`${embedded ? "rounded-xl border border-[#1F2A3A] bg-[#090F18]" : "h-full overflow-y-auto bg-[#070B12]"} text-base leading-7 text-[#D6DEE8]`}>
      <div className={`w-full space-y-4 px-4 py-5 pb-28 sm:px-6 sm:py-8 sm:pb-8 ${embedded ? "max-w-none" : "mx-auto max-w-6xl"}`}>
        {!embedded && <Link href="/osint/reports" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#8B98AA] hover:text-white"><ArrowLeft className="h-4 w-4" />返回每日复盘</Link>}
        <header className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-5">
          <p className="text-sm tracking-[0.14em] text-[#2EC4C7]">DAILY SNAPSHOT</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{snapshot.title}</h1>
          <p className="mt-2 text-sm text-[#718096]">{report.edition === "global" ? "全球终版" : "收盘版"} · v{report.version} · 数据截至 {new Date(snapshot.asOf).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} · 归档后不随实时行情变化</p>
          <div className="mt-4"><PrintActions reportId={report.id} exportReady={exportReady} /></div>
        </header>

        <nav className="sticky top-0 z-20 grid grid-cols-4 gap-1 rounded-xl border border-[#1F2A3A] bg-[#070B12]/95 p-1 backdrop-blur" aria-label="复盘内容">
          {VIEW_MODES.map((item) => <button key={item.value} type="button" aria-pressed={viewMode === item.value} onClick={() => setViewMode(item.value)} className={`min-h-11 rounded-lg text-sm ${viewMode === item.value ? "bg-[#173044] text-[#9DE7E8]" : "text-[#718096]"}`}>{item.label}</button>)}
        </nav>

        {(viewMode === "full" || viewMode === "markets") && <section className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-white">全球行情</h2>
          <p className="mt-1 text-sm text-[#718096]">覆盖 {snapshot.markets.coverage.available}/{snapshot.markets.coverage.total} · 陈旧 {snapshot.markets.coverage.stale}</p>
          <div className="mt-4 divide-y divide-[#1F2A3A]">
            {snapshot.markets.markets.map((market) => (
              <div key={market.symbol} className="grid grid-cols-[1fr_auto] gap-3 py-3">
                <div><p className="text-white">{market.name}</p><p className="font-mono text-xs text-[#718096]">{market.symbol} · {market.source} · {market.status}</p></div>
                <div className="text-right font-mono"><p>{market.value === null ? "—" : market.value.toLocaleString("zh-CN")}{market.instrumentType === "yield" && market.value !== null ? "%" : ""}</p><p className={`text-sm ${(market.changePercent ?? 0) >= 0 ? "text-[#F35A5A]" : "text-[#36C878]"}`}>{market.changePercent === null ? "—" : `${market.changePercent >= 0 ? "+" : ""}${market.changePercent.toFixed(2)}%`}</p></div>
              </div>
            ))}
          </div>
        </section>}

        {(viewMode === "full" || viewMode === "stories") && <section className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-white">世界热点</h2>
          <p className="mt-2 rounded-lg border-l-4 border-[#F2B84B] bg-[#F2B84B]/[0.07] px-3 py-2 text-[#F6C968]">一句建议：{snapshot.stories.advice.text}</p>
          <div className="mt-3 divide-y divide-[#1F2A3A]">
            {snapshot.stories.stories.map((story) => (
              <article key={story.id} className="py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-medium text-white">{story.title}</h3><time className="mt-1 block text-xs text-[#718096]">{new Date(story.publishedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</time></div><span className="shrink-0 text-xs text-[#F2B84B]">{story.importance.toFixed(1)}/10</span></div><p className="mt-2 text-[#AAB5C4]">{story.summary}</p><div className="mt-2 flex flex-wrap gap-1.5">{[...story.tags.topic, ...story.tags.region, ...story.tags.assets].slice(0, 7).map((tag) => <span key={tag} className="rounded-full border border-[#2A394E] px-2 py-0.5 text-xs text-[#8B98AA]">{tag}</span>)}</div></article>
            ))}
            {snapshot.stories.stories.length === 0 && <p className="py-8 text-center text-[#718096]">该快照暂无热点</p>}
          </div>
        </section>}

        {(viewMode === "full" || viewMode === "lhb") && <section className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-white">资金龙虎榜</h2>
          <p className="mt-1 text-sm text-[#718096]">交易日 {snapshot.lhb.tradeDate || "暂无"} · {snapshot.lhb.hotMoneyFlows.length} 组游资/活跃席位 · {snapshot.lhb.status}</p>
          <div className="mt-3 space-y-3">
            {snapshot.lhb.hotMoneyFlows.slice(0, 30).map((flow) => (
              <article key={flow.flowId} className="rounded-lg border border-[#1F2A3A] bg-[#0A111C] p-3">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium text-white">{flow.label}</h3><p className="mt-1 text-xs text-[#718096]">{flow.departmentNames.join(" / ")}</p></div><span className="shrink-0 rounded-full border border-[#2EC4C7]/30 px-2 py-0.5 text-xs text-[#9DE7E8]">{flow.kind === "known" ? `观察可信度 ${flow.confidence ?? "C"}` : "活跃席位"}</span></div>
                <p className="mt-3 font-mono text-sm"><span className="text-[#F35A5A]">买 {amount(flow.totalBuyAmount)}</span><span className="ml-3 text-[#36C878]">卖 {amount(flow.totalSellAmount)}</span><span className="ml-3 text-[#AAB5C4]">净 {amount(flow.totalNetAmount)}</span></p>
                <div className="mt-2 divide-y divide-[#1F2A3A]">{flow.stocks.slice(0, 3).map((stock) => <div key={`${flow.flowId}-${stock.code}`} className="grid grid-cols-[1fr_auto] gap-2 py-2"><div><p className="text-white">{stock.name} <span className="font-mono text-xs text-[#718096]">{stock.code}</span></p><p className="truncate text-xs text-[#718096]">{stock.reasons.join(" / ")}</p></div><p className="font-mono text-xs text-[#F35A5A]">买 {amount(stock.buyAmount)}</p></div>)}</div>
                {flow.stockCount > flow.stocks.length && <p className="pt-2 text-right text-xs text-[#536177]">另有 {flow.stockCount - flow.stocks.length} 只买入股票</p>}
              </article>
            ))}
            {snapshot.lhb.hotMoneyFlows.length === 0 && <p className="py-8 text-center text-[#718096]">该快照暂无游资或活跃席位</p>}
          </div>
        </section>}

        <footer className="rounded-xl border border-[#2A394E] bg-[#0A111C] p-4 text-sm leading-6 text-[#8B98AA]">{DAILY_REPORT_DISCLAIMER}</footer>
      </div>
    </div>
  );
}
