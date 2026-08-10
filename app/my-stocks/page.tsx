"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CircleDollarSign,
  FileChartColumnIncreasing,
  Loader2,
  LogIn,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
  Trash2,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { AddEditPositionDialog } from "@/components/my-stocks/AddEditPositionDialog";
import { Button } from "@/components/ui/button";
import { findLatestUziReport, getUziReportViewerPath, type UziReport } from "@/lib/uzi-reports";

interface Position {
  id: string;
  stockCode: string;
  stockName: string;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  priceAvailable: boolean;
  priceSource: string;
  priceAsOf: string | null;
  marketValue: number | null;
  profitLoss: number | null;
  profitLossPercent: number | null;
  weight: number | null;
}

interface WatchlistItem {
  id: string;
  stockCode: string;
  stopLossPrice: number | null;
  targetPrice: number | null;
  stopLossMethod: string | null;
  takeProfitMethod: string | null;
  computeStatus: string | null;
  lastComputedAt: string | null;
}

interface PortfolioSummary {
  totalMarketValue: number;
  totalCost: number;
  pricedCost: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number | null;
  positionCount: number;
  pricedPositionCount: number;
  hasCompletePricing: boolean;
  priceSource: string;
  priceTimestamp: string | null;
}

const EMPTY_SUMMARY: PortfolioSummary = {
  totalMarketValue: 0,
  totalCost: 0,
  pricedCost: 0,
  totalProfitLoss: 0,
  totalProfitLossPercent: null,
  positionCount: 0,
  pricedPositionCount: 0,
  hasCompletePricing: true,
  priceSource: "unavailable",
  priceTimestamp: null,
};

function money(value: number): string {
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(2)}万`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function percent(value: number | null): string {
  if (value === null) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function pnlTone(value: number | null): string {
  if (value === null || value === 0) return "text-slate-300";
  return value > 0 ? "text-[#ef6a72]" : "text-[#49c78e]";
}

function sourceLabel(source: string): string {
  return ({ sina: "新浪", tencent: "腾讯", database: "历史缓存", unavailable: "不可用" } as Record<string, string>)[source] || source;
}

function isLivePrice(position: Position): boolean {
  return position.priceAvailable && (position.priceSource === "sina" || position.priceSource === "tencent");
}

function isRiskLevelActionable(plan: WatchlistItem | undefined, kind: "stop" | "target"): boolean {
  if (!plan) return false;
  const value = kind === "stop" ? plan.stopLossPrice : plan.targetPrice;
  const method = kind === "stop" ? plan.stopLossMethod : plan.takeProfitMethod;
  if (!value || value <= 0) return false;
  // Manually entered/fixed price levels remain valid until the user changes
  // them. Dynamic levels must come from a recent successful calculation.
  if (!method || method === "fixed") return true;
  if (plan.computeStatus !== "live" || !plan.lastComputedAt) return false;
  const computedAt = new Date(plan.lastComputedAt).getTime();
  return Number.isFinite(computedAt) && Date.now() - computedAt <= 96 * 60 * 60 * 1000;
}

function reportAgeDays(report: UziReport): number {
  const time = new Date(`${report.reportDate}T00:00:00+08:00`).getTime();
  return Number.isFinite(time) ? Math.floor((Date.now() - time) / 86_400_000) : 999;
}

function DecisionRail({ positions, watchlistByCode, summary }: {
  positions: Position[];
  watchlistByCode: Map<string, WatchlistItem>;
  summary: PortfolioSummary;
}) {
  const unavailable = positions.filter((position) => !position.priceAvailable).length;
  const cached = positions.filter((position) => position.priceAvailable && !isLivePrice(position)).length;
  const stopHits = positions.filter((position) => {
    const plan = watchlistByCode.get(position.stockCode);
    const stop = plan?.stopLossPrice;
    return isLivePrice(position) && isRiskLevelActionable(plan, "stop") && position.currentPrice !== null && stop !== null && stop !== undefined && position.currentPrice <= stop;
  }).length;
  const targetHits = positions.filter((position) => {
    const plan = watchlistByCode.get(position.stockCode);
    const target = plan?.targetPrice;
    return isLivePrice(position) && isRiskLevelActionable(plan, "target") && position.currentPrice !== null && target !== null && target !== undefined && position.currentPrice >= target;
  }).length;
  const missingRiskPlan = positions.filter((position) => {
    const plan = watchlistByCode.get(position.stockCode);
    return !isRiskLevelActionable(plan, "stop") || !isRiskLevelActionable(plan, "target");
  }).length;
  const staleReports = positions.filter((position) => {
    const report = findLatestUziReport(position.stockCode);
    return report && reportAgeDays(report) > 7;
  }).length;

  const items = [
    {
      label: "行情状态",
      value: unavailable > 0 ? `${unavailable} 只缺价` : cached > 0 ? `${cached} 只用缓存` : "全部在线",
      detail: unavailable > 0 ? "不计算缺价股票盈亏" : cached > 0 ? "缓存价不触发今日风控" : `${sourceLabel(summary.priceSource)} · 同一快照`,
      tone: unavailable > 0 || cached > 0 ? "text-amber-300" : "text-cyan-200",
      icon: unavailable > 0 || cached > 0 ? WifiOff : Activity,
    },
    {
      label: "今日触发",
      value: `${stopHits} 止损 / ${targetHits} 止盈`,
      detail: stopHits + targetHits > 0 ? "请优先核对交易纪律" : "暂无价格触发",
      tone: stopHits > 0 ? "text-rose-300" : targetHits > 0 ? "text-amber-300" : "text-slate-200",
      icon: Target,
    },
    {
      label: "待补齐",
      value: `${missingRiskPlan} 风控 / ${staleReports} 旧报告`,
      detail: missingRiskPlan > 0 ? "先补止损与目标位" : "风控计划已登记",
      tone: missingRiskPlan + staleReports > 0 ? "text-amber-200" : "text-slate-200",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="grid overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b1118] md:grid-cols-3">
      {items.map((item, index) => (
        <div key={item.label} className={`flex items-center gap-4 px-5 py-4 ${index > 0 ? "border-t border-white/[0.07] md:border-l md:border-t-0" : ""}`}>
          <item.icon className="h-5 w-5 shrink-0 text-slate-600" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">{item.label}</p>
            <p className={`mt-1 font-mono text-base font-semibold ${item.tone}`}>{item.value}</p>
            <p className="mt-1 truncate text-[10px] text-slate-600">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskCell({ position, watchlist }: { position: Position; watchlist?: WatchlistItem }) {
  const stop = watchlist?.stopLossPrice ?? null;
  const target = watchlist?.targetPrice ?? null;
  const livePrice = isLivePrice(position);
  const stopActionable = isRiskLevelActionable(watchlist, "stop");
  const targetActionable = isRiskLevelActionable(watchlist, "target");
  const hitStop = livePrice && stopActionable && position.currentPrice !== null && stop !== null && position.currentPrice <= stop;
  const hitTarget = livePrice && targetActionable && position.currentPrice !== null && target !== null && position.currentPrice >= target;

  if (stop === null && target === null) {
    return (
      <Link href="/portfolio" className="inline-flex items-center gap-1 text-[10px] text-amber-200/70 hover:text-amber-200">
        未设置 <ArrowRight className="h-3 w-3" />
      </Link>
    );
  }

  return (
    <div className="min-w-[120px] text-[10px]">
      <div className="flex items-center justify-between gap-3">
        <span className={hitStop ? "font-medium text-rose-300" : "text-slate-500"}>止损</span>
        <span className={hitStop ? "font-mono font-semibold text-rose-300" : "font-mono text-slate-300"}>{stop?.toFixed(2) ?? "--"}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className={hitTarget ? "font-medium text-amber-300" : "text-slate-500"}>目标</span>
        <span className={hitTarget ? "font-mono font-semibold text-amber-300" : "font-mono text-slate-300"}>{target?.toFixed(2) ?? "--"}</span>
      </div>
      {(!stopActionable || !targetActionable) && (
        <Link href="/portfolio" className="mt-1.5 inline-flex items-center gap-1 text-[9px] text-amber-200/70 hover:text-amber-200">
          {watchlist?.computeStatus === "awaiting_data" ? "等待数据" : "风控线待刷新"} <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      )}
    </div>
  );
}

function ResearchCell({ position }: { position: Position }) {
  const report = findLatestUziReport(position.stockCode);
  if (!report) {
    return (
      <Link href={`/uzi-reports?symbol=${position.stockCode}`} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-slate-400 hover:border-cyan-300/20 hover:text-cyan-200">
        查游资 <ArrowRight className="h-3 w-3" />
      </Link>
    );
  }

  return (
    <Link href={getUziReportViewerPath(report)} className="group/report block min-w-[160px]">
      <div className="flex items-center gap-2">
        <span className="font-mono text-lg font-semibold text-cyan-200">{report.overallScore?.toFixed(1) ?? "--"}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[9px] ${report.agentReviewed ? "border-emerald-300/20 text-emerald-300" : "border-amber-300/15 text-amber-200/70"}`}>
          {report.agentReviewed ? "已复核" : "机械"}
        </span>
      </div>
      <p className="mt-1 max-w-[220px] truncate text-[10px] text-slate-500 group-hover/report:text-slate-300">{report.verdict}</p>
    </Link>
  );
}

export default function MyStocksPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    if (!token) throw new Error("登录状态尚未就绪");
    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  }, [getToken]);

  const loadData = useCallback(async (manual = false) => {
    if (isSignedIn !== true) return;
    manual ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      await fetchWithAuth("/api/users/sync", { method: "POST", body: "{}" });
      const [portfolioResponse, watchlistResponse] = await Promise.all([
        fetchWithAuth("/api/portfolio"),
        fetchWithAuth("/api/watchlist"),
      ]);
      const [portfolioPayload, watchlistPayload] = await Promise.all([
        portfolioResponse.json(),
        watchlistResponse.json(),
      ]);
      if (!portfolioResponse.ok || !portfolioPayload.success) {
        throw new Error(portfolioPayload.error || "持仓读取失败");
      }
      setPositions(portfolioPayload.portfolio || []);
      setSummary({ ...EMPTY_SUMMARY, ...(portfolioPayload.summary || {}) });
      setWatchlist(watchlistPayload.success && Array.isArray(watchlistPayload.watchlist) ? watchlistPayload.watchlist : []);
      if (!watchlistResponse.ok) setError("持仓已读取，止盈止损数据暂不可用");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "数据读取失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchWithAuth, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) void loadData();
    else setLoading(false);
  }, [isLoaded, isSignedIn, loadData]);

  const watchlistByCode = useMemo(
    () => new Map(watchlist.map((item) => [item.stockCode, item])),
    [watchlist]
  );
  const pricedPositions = positions.filter((position) => position.priceAvailable && position.marketValue !== null);
  const totalMarketValue = pricedPositions.reduce((sum, position) => sum + (position.marketValue || 0), 0);
  const totalProfitLoss = pricedPositions.reduce((sum, position) => sum + (position.profitLoss || 0), 0);
  const pricedCost = pricedPositions.reduce((sum, position) => sum + position.avgCost * position.quantity, 0);
  const totalProfitPercent = pricedCost > 0 ? totalProfitLoss / pricedCost * 100 : null;

  async function savePosition(data: { stockCode: string; stockName: string; quantity: number; avgCost: number; industry?: string }) {
    const editing = editingPosition !== null;
    const response = await fetchWithAuth("/api/portfolio", {
      method: editing ? "PUT" : "POST",
      body: JSON.stringify(editing ? { id: editingPosition.id, ...data } : data),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || "保存失败");
    toast.success(editing ? "持仓已更新" : `已添加 ${data.stockName}`);
    setEditingPosition(null);
    setShowAddDialog(false);
    await loadData(true);
  }

  async function deletePosition(position: Position) {
    if (!window.confirm(`确认删除 ${position.stockName}（${position.stockCode}）持仓？`)) return;
    try {
      const response = await fetchWithAuth(`/api/portfolio?id=${encodeURIComponent(position.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "删除失败");
      toast.success("持仓已删除");
      await loadData(true);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "删除失败");
    }
  }

  if (!isLoaded || loading) {
    return (
      <main className="grid min-h-[calc(100vh-2.5rem)] place-items-center bg-[#06090d]">
        <div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-300" /><p className="mt-3 text-xs text-slate-500">正在连接持仓与实时行情</p></div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="grid min-h-[calc(100vh-2.5rem)] place-items-center bg-[#06090d] px-6 text-center text-slate-100">
        <div className="max-w-lg">
          <Briefcase className="mx-auto h-9 w-9 text-slate-700" />
          <h1 className="mt-5 text-2xl font-bold text-white">登录后读取真实持仓</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">未登录时不再伪装成“空持仓”。登录后会把数量、成本、实时价、止盈止损和 Uzi 报告合到一张决策表。</p>
          <div className="mt-6 flex justify-center gap-3">
            <SignInButton mode="redirect" forceRedirectUrl="/my-stocks">
              <button className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#061016]"><LogIn className="h-4 w-4" /> 登录同步</button>
            </SignInButton>
            <Link href="/uzi-reports" className="inline-flex items-center gap-2 rounded-md border border-white/[0.1] px-4 py-2.5 text-sm text-slate-300">先查游资</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-2.5rem)] bg-[#06090d] text-slate-100">
      <div className="mx-auto w-full max-w-[1920px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-cyan-300/70"><Briefcase className="h-3.5 w-3.5" /> Position desk</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">今日持仓</h1>
            <p className="mt-2 text-xs text-slate-500">一张表只回答三件事：真实盈亏、是否触发风控、研究是否够新。</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadData(true)} disabled={refreshing} className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.09] px-3 text-[11px] text-slate-400 hover:bg-white/[0.04] hover:text-white disabled:opacity-40">
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} 刷新行情
            </button>
            <button onClick={() => setShowAddDialog(true)} className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-[11px] font-semibold text-[#061016] hover:bg-cyan-200"><Plus className="h-3.5 w-3.5" /> 添加持仓</button>
          </div>
        </header>

        {error && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3 text-xs text-amber-100/70"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" /> {error}</div>
        )}

        {positions.length > 0 && (
          <>
            <section className="grid gap-3 py-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <DecisionRail positions={positions} watchlistByCode={watchlistByCode} summary={summary} />
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b1118]">
                <div className="px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">已定价市值</p>
                  <p className="mt-2 font-mono text-xl font-semibold text-white">¥{money(totalMarketValue)}</p>
                  <p className="mt-1 text-[10px] text-slate-600">{pricedPositions.length}/{positions.length} 只实时价</p>
                </div>
                <div className="border-l border-white/[0.07] px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">已定价盈亏</p>
                  <p className={`mt-2 font-mono text-xl font-semibold ${pnlTone(totalProfitLoss)}`}>{totalProfitLoss > 0 ? "+" : ""}{money(totalProfitLoss)}</p>
                  <p className={`mt-1 font-mono text-[10px] ${pnlTone(totalProfitPercent)}`}>{percent(totalProfitPercent)}</p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b1118]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                <div><h2 className="text-sm font-semibold text-white">持仓决策表</h2><p className="mt-1 text-[10px] text-slate-600">缺失价格一律显示 --，不会用成本价补位。</p></div>
                <span className="font-mono text-[10px] text-slate-600">{summary.priceTimestamp ? new Date(summary.priceTimestamp).toLocaleString("zh-CN", { hour12: false }) : "无行情时间"}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-xs">
                  <thead className="border-b border-white/[0.07] text-[9px] uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">股票</th>
                      <th className="px-4 py-3 text-right font-medium">持仓</th>
                      <th className="px-4 py-3 text-right font-medium">实时价</th>
                      <th className="px-4 py-3 text-right font-medium">持仓盈亏</th>
                      <th className="px-4 py-3 font-medium">止损 / 目标</th>
                      <th className="px-4 py-3 font-medium">Uzi 研判</th>
                      <th className="px-4 py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.055]">
                    {positions.map((position) => (
                      <tr key={position.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-4">
                          <Link href={`/stocks/${position.stockCode}`} className="font-medium text-white hover:text-cyan-200">{position.stockName}</Link>
                          <p className="mt-1 font-mono text-[10px] text-slate-600">{position.stockCode}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="font-mono text-slate-200">{position.quantity.toLocaleString()} 股</p>
                          <p className="mt-1 font-mono text-[10px] text-slate-600">成本 {position.avgCost.toFixed(2)}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {position.priceAvailable && position.currentPrice !== null ? (
                            <><p className="font-mono text-sm font-semibold text-white">{position.currentPrice.toFixed(2)}</p><p className="mt-1 text-[9px] text-slate-600">{sourceLabel(position.priceSource)}</p></>
                          ) : (
                            <><p className="font-mono text-sm text-slate-500">--</p><p className="mt-1 text-[9px] text-amber-300/70">行情不可用</p></>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {position.profitLoss !== null ? (
                            <><p className={`font-mono text-sm font-semibold ${pnlTone(position.profitLoss)}`}>{position.profitLoss > 0 ? "+" : ""}{money(position.profitLoss)}</p><p className={`mt-1 font-mono text-[10px] ${pnlTone(position.profitLossPercent)}`}>{percent(position.profitLossPercent)}</p></>
                          ) : <span className="text-slate-600">--</span>}
                        </td>
                        <td className="px-4 py-4"><RiskCell position={position} watchlist={watchlistByCode.get(position.stockCode)} /></td>
                        <td className="px-4 py-4"><ResearchCell position={position} /></td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon-xs" onClick={() => setEditingPosition(position)} className="text-slate-500 hover:bg-cyan-300/[0.06] hover:text-cyan-200" aria-label={`编辑 ${position.stockName}`}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon-xs" onClick={() => void deletePosition(position)} className="text-slate-600 hover:bg-rose-300/[0.06] hover:text-rose-300" aria-label={`删除 ${position.stockName}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {positions.length === 0 && !error && (
          <section className="mt-5 grid min-h-[420px] place-items-center rounded-xl border border-dashed border-white/[0.09] bg-[radial-gradient(circle_at_50%_0%,rgba(43,199,217,0.07),transparent_48%)] px-6 text-center">
            <div><CircleDollarSign className="mx-auto h-8 w-8 text-slate-700" /><h2 className="mt-4 text-base font-semibold text-white">先录入真实持仓</h2><p className="mt-2 max-w-md text-xs leading-5 text-slate-500">数量和成本只用于你的账户决策表；录入后会立即连接实时行情、风控线和 Uzi 研判。</p><button onClick={() => setShowAddDialog(true)} className="mt-5 inline-flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#061016]"><Plus className="h-4 w-4" /> 添加第一只持仓</button></div>
          </section>
        )}

        <footer className="mt-5 flex flex-col gap-3 rounded-lg border border-white/[0.07] bg-white/[0.018] px-4 py-3 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2"><FileChartColumnIncreasing className="h-3.5 w-3.5" /> Uzi 报告是研究证据，不替代止损纪律。</span>
          <div className="flex gap-3"><Link href="/portfolio" className="text-slate-400 hover:text-white">管理止盈止损</Link><Link href="/uzi-reports" className="text-cyan-200/70 hover:text-cyan-200">扫描游资</Link></div>
        </footer>
      </div>

      <AddEditPositionDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSave={savePosition} />
      {editingPosition && <AddEditPositionDialog open={true} onOpenChange={(open) => { if (!open) setEditingPosition(null); }} editData={editingPosition} onSave={savePosition} />}
    </main>
  );
}
