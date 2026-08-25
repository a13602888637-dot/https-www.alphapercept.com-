"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LhbDashboardSnapshot, LhbHotMoneyFlow, LhbStockRank } from "@/lib/lhb/contracts";

type ViewMode = "stocks" | "seats";

function formatAmount(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
  return `${(value / 10_000).toFixed(0)}万`;
}

function amountClass(value: number): string {
  return value > 0 ? "text-[#F35A5A]" : value < 0 ? "text-[#36C878]" : "text-[#718096]";
}

export function LhbBoard() {
  const [snapshot, setSnapshot] = useState<LhbDashboardSnapshot | null>(null);
  const [mode, setMode] = useState<ViewMode>("stocks");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/osint/v1/lhb?view=dashboard");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSnapshot((await response.json()) as LhbDashboardSnapshot);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "龙虎榜数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const netSellStocks = useMemo(
    () => [...(snapshot?.stocks ?? [])].sort((left, right) => left.netAmount - right.netAmount),
    [snapshot?.stocks]
  );

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#070B12]" aria-label="资金龙虎榜">
      <div className="border-b border-[#1F2A3A] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-[#D6DEE8]">资金龙虎榜</h2>
            <p className="mt-0.5 text-[11px] text-[#718096]">
              {snapshot?.tradeDate || "最近交易日"} · {snapshot?.stockCount ?? 0} 只股票 · {snapshot?.hotMoneyFlows.length ?? 0} 组游资观察席
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded border px-2 py-1 text-[9px] ${snapshot?.status === "degraded" ? "border-amber-500/20 bg-amber-500/[0.06] text-amber-300" : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300"}`}>
              东方财富盘后公开数据{snapshot?.status === "degraded" ? " · 部分席位暂不可用" : ""}
            </span>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-8 items-center gap-1.5 rounded border border-[#1F2A3A] px-2.5 text-[10px] text-[#718096] hover:bg-[#101927] hover:text-[#D6DEE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />刷新
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5" role="group" aria-label="龙虎榜视图">
          {(["stocks", "seats"] as const).map((item) => (
            <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)} className={`min-h-8 rounded-md border px-3 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] ${mode === item ? "border-[#2EC4C7]/50 bg-[#2EC4C7]/15 text-[#9DE7E8]" : "border-[#1F2A3A] bg-[#0D1420] text-[#718096]"}`}>
              {item === "stocks" ? "个股资金榜" : "席位资金榜"}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="border-b border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-[11px] text-red-300">本次刷新失败（{error}），继续显示最近成功数据。</div>}

      <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
        {loading && !snapshot ? (
          <div className="grid gap-2 md:grid-cols-2">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded bg-[#0D1420]" />)}</div>
        ) : !snapshot || snapshot.stocks.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-[#718096]">最近交易日暂无龙虎榜数据</div>
        ) : mode === "stocks" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <StockRank title="个股净买入榜" stocks={snapshot.stocks.slice(0, 20)} />
            <StockRank title="个股净卖出榜" stocks={netSellStocks.slice(0, 20)} />
          </div>
        ) : snapshot.hotMoneyFlows.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-xs text-[#718096]">
            <span>本交易日暂未识别到游资观察席买入</span>
            <span className="text-[10px] text-[#4b586b]">普通营业部不会回退到本榜单</span>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {snapshot.hotMoneyFlows.map((flow) => <HotMoneyCard key={flow.flowId} flow={flow} />)}
          </div>
        )}
      </div>

      <div className="border-t border-[#1F2A3A] px-4 py-2 text-[9px] text-[#536177]">{snapshot?.disclaimer ?? "龙虎榜为盘后披露数据，不构成投资建议。"}</div>
    </section>
  );
}

function StockRank({ title, stocks }: { title: string; stocks: LhbStockRank[] }) {
  return (
    <div className="min-w-0 rounded-md border border-[#1F2A3A] bg-[#0D1420] p-2">
      <h3 className="px-1 pb-2 text-[10px] font-medium tracking-wide text-[#718096]">{title}</h3>
      <div className="space-y-0.5">
        {stocks.map((stock, index) => (
          <div key={`${title}-${stock.tradeId}`} className="grid min-h-10 grid-cols-[24px_1fr_auto] items-center gap-2 rounded px-2 hover:bg-[#101927]">
            <span className="font-mono text-[9px] text-[#536177]">{index + 1}</span>
            <div className="min-w-0"><div className="truncate text-[11px] text-[#C7D0DD]">{stock.name} <span className="font-mono text-[9px] text-[#536177]">{stock.code}</span></div><div className="truncate text-[9px] text-[#536177]">{stock.reasons.join(" / ")}</div></div>
            <span className={`font-mono text-[11px] ${amountClass(stock.netAmount)}`}>{formatAmount(stock.netAmount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HotMoneyCard({ flow }: { flow: LhbHotMoneyFlow }) {
  return (
    <article className="overflow-hidden rounded-md border border-[#1F2A3A] bg-[#0D1420]">
      <div className="border-b border-[#1F2A3A] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="text-[13px] font-semibold text-[#D6DEE8]">{flow.label}</h3><p className="mt-1 truncate text-[9px] text-[#536177]" title={flow.departmentNames.join(" / ")}>{flow.departmentNames.join(" / ")}</p></div>
          <span className="shrink-0 rounded border border-[#2EC4C7]/30 bg-[#2EC4C7]/10 px-2 py-1 font-mono text-[9px] text-[#9DE7E8]">
            {flow.kind === "known" ? `观察可信度 ${flow.confidence ?? "C"}` : "活跃席位"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-right font-mono text-[10px]">
          <div><span className="block text-[9px] text-[#536177]">买入</span><span className="text-[#F35A5A]">{formatAmount(flow.totalBuyAmount)}</span></div>
          <div><span className="block text-[9px] text-[#536177]">卖出</span><span className="text-[#36C878]">{formatAmount(flow.totalSellAmount)}</span></div>
          <div><span className="block text-[9px] text-[#536177]">净额</span><span className={amountClass(flow.totalNetAmount)}>{formatAmount(flow.totalNetAmount)}</span></div>
        </div>
      </div>
      <div className="px-3 py-2">
        <h4 className="pb-2 text-[9px] font-medium tracking-wide text-[#718096]">游资买入股票</h4>
        <div className="space-y-1">
          {flow.stocks.map((stock) => (
            <div key={`${flow.label}-${stock.code}`} className="grid grid-cols-[1fr_auto] gap-3 rounded border border-[#1A2535] bg-[#0A111C] px-2.5 py-2">
              <div className="min-w-0"><div className="text-[11px] text-[#C7D0DD]">{stock.name} <span className="font-mono text-[9px] text-[#536177]">{stock.code}</span></div><div className="mt-0.5 truncate text-[9px] text-[#536177]" title={stock.reasons.join(" / ")}>{stock.reasons.join(" / ")}</div></div>
              <div className="text-right font-mono text-[9px]"><div className="text-[#F35A5A]">买 {formatAmount(stock.buyAmount)}</div><div className="text-[#36C878]">卖 {formatAmount(stock.sellAmount)}</div></div>
            </div>
          ))}
        </div>
        {flow.stockCount > flow.stocks.length && <p className="pt-2 text-right text-[9px] text-[#536177]">另有 {flow.stockCount - flow.stocks.length} 只买入股票</p>}
      </div>
    </article>
  );
}
