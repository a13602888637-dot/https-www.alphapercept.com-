"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { OsintDailyReportRecord } from "@/lib/osint/daily-report/contracts";
import { DAILY_REPORT_DISCLAIMER } from "@/lib/osint/daily-report/export-html";
import {
  curateReportStories,
  plainStockReason,
  plainStoryImpact,
  selectReportHotMoney,
  selectReportStocks,
} from "@/lib/osint/daily-report/story-curation";
import { PrintActions } from "./PrintActions";

const VIEW_MODES = [
  { value: "stories", label: "热点" },
  { value: "stocks", label: "个股资金" },
  { value: "lhb", label: "游资" },
] as const;
type ViewMode = (typeof VIEW_MODES)[number]["value"];

function amount(value: number): string {
  return `${(Math.abs(value) / 10_000).toLocaleString("zh-CN", { maximumFractionDigits: 0 })} 万`;
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
  const stockGroups = selectReportStocks(snapshot.lhb.stocks);
  const hotMoney = selectReportHotMoney(snapshot.lhb.hotMoneyFlows);
  const leadStory = curatedStories.categories.flatMap((category) => category.stories)[0];

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
              <div><h2 className="text-xl font-semibold text-white">热点复盘</h2><p className="mt-1 text-sm text-[#718096]">先看今天发生了什么，再看接下来要注意什么</p></div>
            </div>
            {leadStory && <p className="mt-4 rounded-lg border-l-4 border-[#F2B84B] bg-[#F2B84B]/[0.07] px-3 py-2 text-[#F6C968]">今天重点：{leadStory.title}</p>}
            <div className="mt-4 space-y-4">
              {curatedStories.categories.map((category) => (
                <section key={category.key} className="overflow-hidden rounded-xl border border-[#243248] bg-[#0A111C]">
                  <header className="border-b border-[#243248] bg-[#101B2A] px-4 py-3">
                    <h3 className="font-semibold text-[#9DE7E8]">{category.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#AAB5C4]">{category.insight}</p>
                  </header>
                  <div className="divide-y divide-[#1F2A3A] px-4">
                    {category.stories.map((story) => (
                      <article key={story.id} className="py-4">
                        <div className="min-w-0"><h4 className="font-medium text-white">{story.title}</h4><time className="mt-1 block text-xs text-[#718096]">{new Date(story.publishedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</time></div>
                        <p className="mt-2 text-[#AAB5C4]">{story.summary}</p>
                        <p className="mt-2 text-sm text-[#9DE7E8]">{plainStoryImpact(story)}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}

        {viewMode === "stocks" && (
          <section className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
            <h2 className="text-xl font-semibold text-white">个股资金榜</h2>
            <p className="mt-1 text-sm text-[#718096]">交易日 {snapshot.lhb.tradeDate || "--"} · 分开看谁在净买入、谁在净卖出</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {[
                { title: "净买入靠前", stocks: stockGroups.inflows, tone: "text-[#F35A5A]" },
                { title: "净卖出靠前", stocks: stockGroups.outflows, tone: "text-[#36C878]" },
              ].filter((group) => group.stocks.length > 0).map((group) => (
                <section key={group.title} className="overflow-hidden rounded-xl border border-[#243248] bg-[#0A111C]">
                  <h3 className="bg-[#101B2A] px-4 py-3 font-semibold text-white">{group.title}</h3>
                  <div className="divide-y divide-[#1F2A3A] px-4">
                    {group.stocks.map((stock, index) => (
                      <article key={stock.tradeId} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div><p className="font-medium text-white">{index + 1}. {stock.name} <span className="font-mono text-xs text-[#718096]">{stock.code}</span></p><p className="mt-1 text-xs text-[#718096]">{plainStockReason(stock.reasons)}</p></div>
                          <p className={`shrink-0 font-mono ${group.tone}`}>{signedAmount(stock.netAmount)}</p>
                        </div>
                        <p className="mt-2 text-xs text-[#8B98AA]">买入 {amount(stock.buyAmount)} · 卖出 {amount(stock.sellAmount)}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}

        {viewMode === "lhb" && (
          <section className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
            <h2 className="text-xl font-semibold text-white">游资席位榜</h2>
            <p className="mt-1 text-sm text-[#718096]">交易日 {snapshot.lhb.tradeDate || "--"} · 看谁在买、买了什么</p>
            <div className="mt-3 space-y-3">
              {hotMoney.map((flow) => (
                <article key={flow.flowId} className="rounded-lg border border-[#1F2A3A] bg-[#0A111C] p-3">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium text-white">{flow.label}</h3><p className="mt-1 text-xs text-[#718096]">{flow.departmentNames[0] || "席位观察"}</p></div><span className={`shrink-0 font-mono ${flow.totalNetAmount >= 0 ? "text-[#F35A5A]" : "text-[#36C878]"}`}>{flow.totalNetAmount >= 0 ? "净买入" : "净卖出"} {amount(flow.totalNetAmount)}</span></div>
                  <p className="mt-3 font-mono text-sm"><span className="text-[#F35A5A]">买入 {amount(flow.totalBuyAmount)}</span><span className="ml-3 text-[#36C878]">卖出 {amount(flow.totalSellAmount)}</span></p>
                  <div className="mt-2 divide-y divide-[#1F2A3A]">{[...flow.stocks].sort((left, right) => right.buyAmount - left.buyAmount).slice(0, 2).map((stock) => <div key={`${flow.flowId}-${stock.code}`} className="grid grid-cols-[1fr_auto] gap-2 py-2"><p className="text-white">主要买入：{stock.name} <span className="font-mono text-xs text-[#718096]">{stock.code}</span></p><p className="font-mono text-xs text-[#F35A5A]">{amount(stock.buyAmount)}</p></div>)}</div>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer className="rounded-xl border border-[#2A394E] bg-[#0A111C] p-4 text-sm leading-6 text-[#8B98AA]">{DAILY_REPORT_DISCLAIMER}</footer>
      </div>
    </div>
  );
}
