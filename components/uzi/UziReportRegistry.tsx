"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  FileChartColumnIncreasing,
  Landmark,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { getUziReportViewerPath, type UziReport } from "@/lib/uzi-reports";

interface StockOption {
  code: string;
  name: string;
}

interface MoneySummary {
  buy: number;
  sell: number;
  net: number;
}

interface QuickReport {
  stockCode: string;
  stockName: string;
  periodDays: number;
  generatedAt: string;
  source: string;
  sourceUrl: string;
  status: "ready" | "no_lhb";
  signal: string;
  lhbDates: string[];
  detailDateCount: number;
  partial: boolean;
  eventDate: string | null;
  eventReason: string | null;
  excludedSameDayEventCount: number;
  totals: MoneySummary;
  institutional: MoneySummary;
  brokerage: MoneySummary;
  knownYouzi: MoneySummary & {
    matches: Array<{
      name: string;
      tier: string;
      style: string;
      appearances: number;
      net: number;
      lastDate: string;
      seats: string[];
    }>;
  };
  recentSeats: Array<{
    tradeDate: string;
    seatCode: string;
    seatName: string;
    reason: string;
    closePrice: number | null;
    buy: number;
    sell: number;
    net: number;
    knownYouzi: string[];
    institutional: boolean;
  }>;
}

function money(value: number): string {
  const absolute = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  if (absolute >= 100_000_000) return `${sign}${(absolute / 100_000_000).toFixed(2)}亿`;
  if (absolute >= 10_000) return `${sign}${(absolute / 10_000).toFixed(0)}万`;
  return `${sign}${absolute.toFixed(0)}`;
}

function moneyTone(value: number): string {
  if (value > 0) return "text-[#ef6a72]";
  if (value < 0) return "text-[#49c78e]";
  return "text-slate-300";
}

function scoreTone(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 65) return "text-cyan-300";
  if (score >= 50) return "text-amber-300";
  return "text-rose-300";
}

function findReport(reports: UziReport[], stockCode: string): UziReport | null {
  return reports.find((report) => report.stockCode === stockCode) ?? null;
}

function Metric({ label, value, tone = "text-white", note }: {
  label: string;
  value: string;
  tone?: string;
  note: string;
}) {
  return (
    <div className="min-w-0 border-l border-white/[0.08] pl-4 first:border-l-0 first:pl-0">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className={`mt-2 font-mono text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] text-slate-600">{note}</p>
    </div>
  );
}

function QuickReportPanel({ report, deepReport }: { report: QuickReport; deepReport: UziReport | null }) {
  const generatedAt = new Date(report.generatedAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <section className="overflow-hidden rounded-xl border border-cyan-300/20 bg-[#0a1018] shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07]">
            <Activity className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{report.stockName}</h2>
              <span className="font-mono text-[11px] text-slate-500">{report.stockCode}</span>
              <span className="rounded border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-0.5 text-[10px] text-cyan-200">
                龙虎榜快报
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{report.signal}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          <span>{report.source}</span>
          <span className="text-slate-700">/</span>
          <span>{generatedAt} 生成</span>
          {report.partial && <span className="text-amber-300">部分日期明细暂缺</span>}
        </div>
      </div>

      {report.status === "no_lhb" ? (
        <div className="grid min-h-[280px] place-items-center px-6 py-12 text-center">
          <div>
            <Landmark className="mx-auto h-8 w-8 text-slate-700" />
            <p className="mt-4 text-base font-medium text-slate-200">近 {report.periodDays} 日没有龙虎榜记录</p>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-500">
              这不是利空，也不代表没有资金交易；只是公开龙虎榜没有出现该股票，无法据此识别游资席位。
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 border-b border-white/[0.07] px-5 py-5 lg:grid-cols-4">
            <Metric label="30 日上榜" value={`${report.lhbDates.length} 次`} note={report.lhbDates.join(" · ")} />
            <Metric label="最新榜单知名席位" value={money(report.knownYouzi.net)} tone={moneyTone(report.knownYouzi.net)} note={`${report.eventDate ?? "--"} · ${report.knownYouzi.matches.length} 个登记别名`} />
            <Metric label="最新榜单机构净额" value={money(report.institutional.net)} tone={moneyTone(report.institutional.net)} note="机构专用席位口径" />
            <Metric label="最新榜单全部净额" value={money(report.totals.net)} tone={moneyTone(report.totals.net)} note={report.eventReason || "未注明上榜原因"} />
          </div>

          <div className="grid lg:grid-cols-[minmax(0,0.78fr)_minmax(560px,1.22fr)]">
            <div className="border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-slate-200">登记游资席位</h3>
                <span className="font-mono text-[10px] text-slate-600">SEAT MATCH</span>
              </div>
              {report.knownYouzi.matches.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {report.knownYouzi.matches.map((match) => (
                    <div key={match.name} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{match.name}</p>
                          <p className="mt-1 text-[10px] text-slate-500">{match.style} · {match.appearances} 次席位记录</p>
                        </div>
                        <span className={`shrink-0 font-mono text-sm font-semibold ${moneyTone(match.net)}`}>{money(match.net)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-600">{match.seats.join(" / ")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-white/[0.09] px-4 py-8 text-center">
                  <p className="text-xs text-slate-400">本期未匹配登记的知名席位</p>
                  <p className="mt-1 text-[10px] text-slate-600">普通营业部成交不能直接等同为游资。</p>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/[0.035] p-3 text-[10px] leading-4 text-amber-100/60">
                席位按公开营业部名称匹配，可能多人共用或发生迁移，不等于本人身份确认。射程与板块龙头性需进入深报复核。
                {report.excludedSameDayEventCount > 0 && ` 同日另有 ${report.excludedSameDayEventCount} 个榜单口径，未与本榜单重复累计。`}
              </div>
            </div>

            <div className="min-w-0 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-slate-200">最新榜单席位明细</h3>
                <span className="max-w-[360px] truncate text-[10px] text-slate-600">{report.eventDate} · {report.eventReason}</span>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[11px]">
                  <thead className="border-b border-white/[0.07] text-[9px] uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="py-2 pr-4 font-medium">日期</th>
                      <th className="py-2 pr-4 font-medium">席位</th>
                      <th className="py-2 pr-4 text-right font-medium">买入</th>
                      <th className="py-2 pr-4 text-right font-medium">卖出</th>
                      <th className="py-2 text-right font-medium">净额</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {report.recentSeats.slice(0, 10).map((seat, index) => (
                      <tr key={`${seat.tradeDate}-${seat.seatCode}-${seat.seatName}-${index}`}>
                        <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-slate-500">{seat.tradeDate.slice(5)}</td>
                        <td className="max-w-[300px] py-2.5 pr-4">
                          <p className="truncate text-slate-300">{seat.seatName}</p>
                          <p className="mt-0.5 truncate text-[9px] text-slate-600">
                            {seat.institutional ? "机构" : seat.knownYouzi.join(" / ") || "营业部"}
                          </p>
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-4 text-right font-mono text-slate-400">{money(seat.buy)}</td>
                        <td className="whitespace-nowrap py-2.5 pr-4 text-right font-mono text-slate-400">{money(-seat.sell)}</td>
                        <td className={`whitespace-nowrap py-2.5 text-right font-mono font-medium ${moneyTone(seat.net)}`}>{money(seat.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 border-t border-white/[0.07] bg-black/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] leading-4 text-slate-600">
          快报只陈列公开龙虎榜事实，不生成买卖建议，也不冒充 Uzi 多 Agent 深度复核。
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/stocks/${report.stockCode}`} className="rounded-md border border-white/[0.09] px-3 py-2 text-[11px] text-slate-300 transition-colors hover:bg-white/[0.05]">
            查看个股
          </Link>
          {deepReport ? (
            <Link href={getUziReportViewerPath(deepReport)} className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-3 py-2 text-[11px] font-semibold text-[#061016] transition-colors hover:bg-cyan-200">
              进入 Uzi 深报 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="rounded-md border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-[10px] text-amber-100/60">深报尚未生成</span>
          )}
        </div>
      </div>
    </section>
  );
}

function ReportRow({ report }: { report: UziReport }) {
  return (
    <article className="group grid gap-3 rounded-lg border border-white/[0.07] bg-white/[0.018] p-4 transition-colors hover:border-cyan-300/20 hover:bg-cyan-300/[0.025] sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-white">{report.name}</h3>
          <span className="font-mono text-[10px] text-slate-600">{report.ticker}</span>
          <span className={`rounded border px-1.5 py-0.5 text-[9px] ${report.agentReviewed ? "border-emerald-300/20 text-emerald-300" : "border-amber-300/15 text-amber-200/70"}`}>
            {report.agentReviewed ? "Agent 已复核" : "机械报告"}
          </span>
        </div>
        <p className="mt-1 truncate text-[11px] text-slate-500">{report.verdict}</p>
      </div>
      <div>
        <p className={`font-mono text-2xl font-bold tabular-nums ${scoreTone(report.overallScore)}`}>{report.overallScore?.toFixed(1) ?? "—"}</p>
        <p className="text-[9px] text-slate-600">Uzi 分 · {report.reportDate.slice(5)}</p>
      </div>
      <Link href={getUziReportViewerPath(report)} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-cyan-300/20 px-3 py-2 text-[11px] text-cyan-200 transition-colors hover:bg-cyan-300/[0.07]">
        查看研判 <ArrowRight className="h-3 w-3" />
      </Link>
    </article>
  );
}

export function UziReportRegistry({ reports }: { reports: UziReport[] }) {
  const { getToken, isSignedIn } = useAuth();
  const [query, setQuery] = useState("");
  const [holdings, setHoldings] = useState<StockOption[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(null);
  const [quickReport, setQuickReport] = useState<QuickReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const initialSymbolHandled = useRef(false);

  useEffect(() => {
    if (isSignedIn !== true) return;
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      const response = await fetch("/api/portfolio", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!cancelled && payload.success && Array.isArray(payload.portfolio)) {
        setHoldings(payload.portfolio.map((item: { stockCode: string; stockName: string }) => ({ code: item.stockCode, name: item.stockName })));
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [getToken, isSignedIn]);

  const deepReport = useMemo(
    () => selectedStock ? findReport(reports, selectedStock.code) : null,
    [reports, selectedStock]
  );

  const scanStock = useCallback(async (stock: StockOption) => {
    setSelectedStock(stock);
    setQuery(stock.name === stock.code ? stock.code : `${stock.name} ${stock.code}`);
    setLoading(true);
    setError("");
    setQuickReport(null);
    try {
      const response = await fetch(`/api/uzi/youzi-report?symbol=${encodeURIComponent(stock.code)}&name=${encodeURIComponent(stock.name)}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "游资快报生成失败");
      setQuickReport(payload.report);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "游资快报生成失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSymbolHandled.current) return;
    const stockCode = new URLSearchParams(window.location.search).get("symbol")?.trim() || "";
    if (!/^\d{6}$/.test(stockCode)) return;
    initialSymbolHandled.current = true;
    const registered = findReport(reports, stockCode);
    if (registered) {
      void scanStock({ code: stockCode, name: registered.name });
      return;
    }
    void fetch(`/api/stocks/search?q=${encodeURIComponent(stockCode)}`)
      .then((response) => response.json())
      .then((payload) => {
        const match = Array.isArray(payload.data)
          ? payload.data.find((item: { code?: string }) => item.code === stockCode)
          : null;
        return scanStock({ code: stockCode, name: match?.name || stockCode });
      })
      .catch(() => scanStock({ code: stockCode, name: stockCode }));
  }, [reports, scanStock]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const needle = query.trim();
    if (!needle) return;
    setLoading(true);
    setError("");
    setQuickReport(null);
    try {
      const matchedReport = reports.find((report) =>
        report.stockCode === needle || report.ticker.toLowerCase() === needle.toLowerCase() || report.name.includes(needle)
      );
      if (matchedReport) {
        await scanStock({ code: matchedReport.stockCode, name: matchedReport.name });
        return;
      }

      const searchResponse = await fetch(`/api/stocks/search?q=${encodeURIComponent(needle)}`);
      const searchPayload = await searchResponse.json();
      const options = Array.isArray(searchPayload.data) ? searchPayload.data as Array<StockOption & { market?: string }> : [];
      const stock = options.find((option) => /^(\d{6})$/.test(option.code) && !["B股", "港股", "美股", "US", "US-ETF"].includes(option.market || ""))
        || (/^\d{6}$/.test(needle) ? { code: needle, name: needle } : null);
      if (!stock) throw new Error("没有找到对应的 A 股，请输入 6 位代码或完整名称");
      await scanStock({ code: stock.code, name: stock.name });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "股票识别失败");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-2.5rem)] bg-[#06090d] text-slate-100">
      <div className="mx-auto w-full max-w-[1920px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
              <Sparkles className="h-3.5 w-3.5" /> Uzi research desk
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">游资研判台</h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">输入任意 A 股，先看近 30 日真实龙虎榜席位；已有深报时再进入多评委研判。</p>
          </div>
          <div className="flex items-center gap-5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-cyan-300" /> 东方财富在线数据</span>
            <span className="h-4 w-px bg-white/[0.08]" />
            <span><strong className="font-mono text-slate-200">{reports.length}</strong> 份深报</span>
          </div>
        </header>

        <section className="py-5">
          <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-[minmax(0,720px)_auto] sm:justify-start">
            <label className="relative block">
              <span className="sr-only">股票代码或名称</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入股票名称或 6 位代码，例如 光迅科技 / 002281"
                className="h-12 w-full rounded-lg border border-white/[0.1] bg-[#0b1118] pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"
              />
            </label>
            <button disabled={loading || !query.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-5 text-sm font-semibold text-[#061016] transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              {loading ? "扫描中" : "扫描游资"}
            </button>
          </form>

          {holdings.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-slate-600">我的持仓</span>
              {holdings.map((holding) => (
                <button key={holding.code} type="button" onClick={() => void scanStock(holding)} disabled={loading} className="rounded border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[10px] text-slate-400 transition-colors hover:border-cyan-300/25 hover:text-cyan-200 disabled:opacity-40">
                  {holding.name} <span className="font-mono text-slate-600">{holding.code}</span>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 flex max-w-3xl items-center gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-4 py-3 text-xs text-rose-200">
              <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
              <button type="button" onClick={() => selectedStock && void scanStock(selectedStock)} className="ml-auto inline-flex items-center gap-1 text-[10px] text-rose-100 underline underline-offset-4">
                <RefreshCw className="h-3 w-3" /> 重试
              </button>
            </div>
          )}
        </section>

        {loading && (
          <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-cyan-300/15 bg-cyan-300/[0.015]">
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-300" />
              <p className="mt-3 text-sm text-slate-300">正在读取近 30 日龙虎榜席位</p>
              <p className="mt-1 text-[10px] text-slate-600">通常需要数秒</p>
            </div>
          </div>
        )}

        {!loading && quickReport && <QuickReportPanel report={quickReport} deepReport={deepReport} />}

        {!loading && !quickReport && !error && (
          <section className="grid min-h-[280px] place-items-center rounded-xl border border-dashed border-white/[0.09] bg-[radial-gradient(circle_at_50%_0%,rgba(43,199,217,0.07),transparent_48%)] px-6 py-12 text-center">
            <div>
              <Activity className="mx-auto h-7 w-7 text-cyan-300/60" />
              <p className="mt-4 text-sm font-medium text-slate-300">查一只股票，先拿到可核对的游资事实</p>
              <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-600">不要求先有 Uzi 深报。没有上榜会明确告诉你，没有匹配席位也不会硬贴“大佬”标签。</p>
            </div>
          </section>
        )}

        <section className="mt-6 border-t border-white/[0.07] pt-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">已生成的 Uzi 深报</h2>
              <p className="mt-1 text-[10px] text-slate-600">机械报告与 Agent 复核报告分开标记；评分不等同于买卖建议。</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-100/60"><AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> 当前 {reports.filter((report) => !report.agentReviewed).length} 份尚未 Agent 逐条复核</span>
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            {reports.map((report) => <ReportRow key={report.id} report={report} />)}
          </div>
        </section>

        <footer className="mt-5 flex items-start gap-3 rounded-lg border border-white/[0.07] bg-white/[0.018] px-4 py-3 text-[10px] leading-4 text-slate-600">
          <FileChartColumnIncreasing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <p>完整 Uzi 深报需要长任务采集、Agent 定性复核与独立审查，不能在一次网页请求里伪造成“即时深报”。本页在线生成的是公开龙虎榜快报。</p>
        </footer>
      </div>
    </main>
  );
}
