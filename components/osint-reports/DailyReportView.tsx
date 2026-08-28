"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { OsintStory } from "@/lib/osint/contracts";
import type { OsintDailyReportRecord } from "@/lib/osint/daily-report/contracts";
import { DAILY_REPORT_DISCLAIMER } from "@/lib/osint/daily-report/export-html";
import {
  compactShareHeadline,
  isChineseReadableText,
  isShareHeadlineReady,
  shareSourceKey,
} from "@/lib/osint/daily-report/image-copy";
import {
  curateReportStories,
  plainStockReason,
  plainStoryImpact,
  selectReportHotMoney,
  selectReportStocks,
} from "@/lib/osint/daily-report/story-curation";
import { PrintActions } from "./PrintActions";

const VIEW_MODES = [
  { value: "stories", label: "当日热点" },
  { value: "hotlist", label: "个股热榜" },
] as const;
type ViewMode = (typeof VIEW_MODES)[number]["value"];

function amount(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(absolute / 100_000_000).toFixed(2)} 亿`;
  return `${Math.round(absolute / 10_000).toLocaleString("zh-CN")} 万`;
}

function signedAmount(value: number): string {
  return `${value >= 0 ? "+" : "−"}${amount(value)}`;
}

function dedupeWebStories(stories: OsintStory[]): OsintStory[] {
  const seen = new Set<string>();
  return stories.filter((story) => {
    if (!isShareHeadlineReady(story.title)) return false;
    const key = shareSourceKey(story.sources[0]?.url, story.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const [storyTopic, setStoryTopic] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setExportReady(false);
    setError(null);
    setStoryTopic("all");
    void fetch(`/api/osint/v1/reports/${encodeURIComponent(reportId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
        setReport(payload.report);
        setViewMode(payload.report?.edition === "close" ? "hotlist" : "stories");
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
  const curatedStories = curateReportStories(dedupeWebStories(snapshot.stories.stories), { maxPerCategory: 8 });
  const visibleStoryCategories = storyTopic === "all"
    ? curatedStories.categories
    : curatedStories.categories.filter((category) => category.key === storyTopic);
  const stockGroups = selectReportStocks(snapshot.lhb.stocks);
  const hotMoney = selectReportHotMoney(snapshot.lhb.hotMoneyFlows);

  return (
    <div className={`${embedded ? "rounded-xl border border-[#1F2A3A] bg-[#090F18]" : "h-full overflow-y-auto bg-[#070B12]"} text-base leading-7 text-[#D6DEE8]`}>
      <div className="w-full space-y-4 px-4 py-5 pb-28 sm:px-6 sm:py-8 sm:pb-8">
        {!embedded && <Link href="/osint/reports" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#8B98AA] hover:text-white"><ArrowLeft className="h-4 w-4" />返回每日复盘</Link>}
        <header className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-5">
          <p className="text-sm tracking-[0.14em] text-[#2EC4C7]">ALPHAPERCEPT DAILY</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{snapshot.title}</h1>
          <p className="mt-2 text-sm text-[#718096]">{report.edition === "global" ? "早间版" : "收盘版"} · 数据截至 {new Date(snapshot.asOf).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</p>
          <div className="mt-4"><PrintActions reportId={report.id} exportReady={exportReady} /></div>
        </header>

        <nav className="sticky top-0 z-20 grid grid-cols-2 gap-1 rounded-xl border border-[#1F2A3A] bg-[#070B12]/95 p-1 backdrop-blur" aria-label="复盘内容">
          {VIEW_MODES.map((item) => (
            <button key={item.value} type="button" aria-pressed={viewMode === item.value} onClick={() => setViewMode(item.value)} className={`min-h-12 rounded-lg text-base font-medium ${viewMode === item.value ? "bg-[#173044] text-[#9DE7E8]" : "text-[#718096]"}`}>{item.label}</button>
          ))}
        </nav>

        {viewMode === "stories" && (
          <section className="rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
            <div><h2 className="text-xl font-semibold text-white">当日热点</h2><p className="mt-1 text-sm text-[#718096]">早间发布 · 按主题保留真正值得看的消息</p></div>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="热点主题">
              <button type="button" onClick={() => setStoryTopic("all")} className={`min-h-9 rounded-md border px-3 text-sm ${storyTopic === "all" ? "border-[#2EC4C7]/50 bg-[#173044] text-[#9DE7E8]" : "border-[#1F2A3A] text-[#718096] hover:text-white"}`}>全部</button>
              {curatedStories.categories.map((category) => (
                <button key={category.key} type="button" onClick={() => setStoryTopic(category.key)} className={`min-h-9 rounded-md border px-3 text-sm ${storyTopic === category.key ? "border-[#2EC4C7]/50 bg-[#173044] text-[#9DE7E8]" : "border-[#1F2A3A] text-[#718096] hover:text-white"}`}>{category.label}</button>
              ))}
            </div>
            <div className="mt-4 space-y-5">
              {visibleStoryCategories.map((category) => (
                <section key={category.key} className="overflow-hidden rounded-lg border border-[#243248] bg-[#0A111C]">
                  <header className="flex flex-col gap-1 border-b border-[#243248] bg-[#101B2A] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-base font-semibold text-[#9DE7E8]">{category.label}</h3>
                    <p className="text-sm leading-6 text-[#AAB5C4]">{category.insight}</p>
                  </header>
                  <div className="divide-y divide-[#1F2A3A]">
                    {category.stories.map((story) => {
                      const eventTime = new Date(story.scheduledFor || story.publishedAt);
                      return (
                        <article key={story.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-5">
                          <div className="font-mono text-sm text-[#718096]">
                            <time className="block text-[#AAB5C4]">{eventTime.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit" })}</time>
                            <span className="mt-1 block">{eventTime.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                            {story.eventType === "upcoming" && <span className="mt-2 inline-flex rounded border border-[#9F2336]/35 bg-[#9F2336]/10 px-2 py-0.5 text-xs text-[#F08A98]">未来事件</span>}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-semibold leading-7 text-white">{compactShareHeadline(story.title)}</h4>
                            {isChineseReadableText(story.summary) && <p className="mt-2 text-base leading-7 text-[#AAB5C4]">{story.summary}</p>}
                            <p className="mt-2 text-sm text-[#9DE7E8]">{plainStoryImpact(story)}</p>
                            <p className="mt-2 text-xs text-[#536177]">{story.sources.map((source) => source.name).join(" · ")}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}

        {viewMode === "hotlist" && (
          <section className="space-y-5 rounded-xl border border-[#1F2A3A] bg-[#0D1420] p-4 sm:p-5">
            <div><h2 className="text-xl font-semibold text-white">个股热榜</h2><p className="mt-1 text-sm text-[#718096]">收盘发布 · 个股资金与游资席位合并查看</p></div>

            <section>
              <h3 className="text-lg font-semibold text-white">个股资金榜</h3>
              <div className="mt-3 grid gap-4 xl:grid-cols-2">
                {[
                  { title: "净买入靠前", stocks: stockGroups.inflows, tone: "text-[#F35A5A]" },
                  { title: "净卖出靠前", stocks: stockGroups.outflows, tone: "text-[#36C878]" },
                ].filter((group) => group.stocks.length > 0).map((group) => (
                  <section key={group.title} className="overflow-hidden rounded-xl border border-[#243248] bg-[#0A111C]">
                    <h4 className="bg-[#101B2A] px-4 py-3 text-base font-semibold text-white">{group.title}</h4>
                    <div className="divide-y divide-[#1F2A3A] px-4">
                      {group.stocks.map((stock, index) => (
                        <article key={stock.tradeId} className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="text-base font-semibold text-white">{index + 1}. {stock.name} <span className="font-mono text-sm text-[#718096]">{stock.code}</span></p><p className="mt-1 text-sm text-[#718096]">{plainStockReason(stock.reasons)}</p></div>
                            <p className={`shrink-0 font-mono text-base font-semibold ${group.tone}`}>{signedAmount(stock.netAmount)}</p>
                          </div>
                          <p className="mt-2 text-sm text-[#8B98AA]">买入 {amount(stock.buyAmount)} · 卖出 {amount(stock.sellAmount)}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-white">游资席位榜</h3>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {hotMoney.map((flow) => (
                  <article key={flow.flowId} className="rounded-lg border border-[#1F2A3A] bg-[#0A111C] p-4">
                    <h4 className="whitespace-nowrap text-base font-semibold text-white">{flow.label}</h4>
                    <p className="mt-1 text-sm text-[#718096]">{flow.departmentNames[0] || "席位观察"}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-sm">
                      <span className={`whitespace-nowrap ${flow.totalNetAmount >= 0 ? "text-[#F35A5A]" : "text-[#36C878]"}`}>净额 {signedAmount(flow.totalNetAmount)}</span>
                      <span className="whitespace-nowrap text-[#F35A5A]">买入 {amount(flow.totalBuyAmount)}</span>
                      <span className="whitespace-nowrap text-[#36C878]">卖出 {amount(flow.totalSellAmount)}</span>
                    </div>
                    <div className="mt-2 divide-y divide-[#1F2A3A]">{[...flow.stocks].sort((left, right) => right.buyAmount - left.buyAmount).slice(0, 2).map((stock) => <div key={`${flow.flowId}-${stock.code}`} className="grid grid-cols-[1fr_auto] gap-2 py-2"><p className="text-base text-white">主要买入：{stock.name} <span className="font-mono text-sm text-[#718096]">{stock.code}</span></p><p className="font-mono text-sm text-[#F35A5A]">{amount(stock.buyAmount)}</p></div>)}</div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        <footer className="rounded-xl border border-[#2A394E] bg-[#0A111C] p-4 text-sm leading-6 text-[#8B98AA]">{DAILY_REPORT_DISCLAIMER}</footer>
      </div>
    </div>
  );
}
