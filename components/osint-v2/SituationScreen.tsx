"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Radio } from "lucide-react";
import type { MarketSnapshot, OsintContext, OsintMarket } from "@/lib/osint/contracts";
import { MarketBoard } from "./MarketBoard";
import { LhbBoard } from "./LhbBoard";
import { StatusBar } from "./StatusBar";
import { WorldBriefing } from "./WorldBriefing";

type MobileView = "market" | "stories" | "lhb";
type RightView = "stories" | "lhb";

function pulseValue(market: OsintMarket | undefined): string {
  if (!market || market.value === null) return "—";
  if (market.instrumentType === "yield") return `${market.value.toFixed(2)}%`;
  return market.value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pulseChange(market: OsintMarket | undefined): { text: string; className: string } {
  if (!market) return { text: "暂无", className: "text-slate-600" };
  const value = market.instrumentType === "yield" ? market.change : market.changePercent;
  if (value === null) return { text: market.status === "unavailable" ? "暂无" : "—", className: "text-slate-600" };
  const positive = value >= 0;
  return {
    text: market.instrumentType === "yield" ? `${positive ? "+" : ""}${value.toFixed(2)}pp` : `${positive ? "+" : ""}${value.toFixed(2)}%`,
    className: positive ? "text-[#F35A5A]" : "text-[#36C878]",
  };
}

export function SituationScreen() {
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("stories");
  const [rightView, setRightView] = useState<RightView>("stories");

  const loadMarkets = useCallback(async (signal?: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/osint/v1/markets", { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as MarketSnapshot;
      setMarketSnapshot(payload);
      setError(null);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "数据刷新失败");
    } finally {
      if (!signal?.aborted) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadMarkets(controller.signal);
    const interval = window.setInterval(() => void loadMarkets(), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadMarkets]);

  const pulseMarkets = useMemo(() => {
    const bySymbol = new Map((marketSnapshot?.markets ?? []).map((market) => [market.symbol, market]));
    return ["^VIX", "UST10Y", "DXY", "CL=F", "GC=F"].map((symbol) => bySymbol.get(symbol));
  }, [marketSnapshot?.markets]);

  const isLoading = !marketSnapshot && isRefreshing;
  const statusContext = useMemo<OsintContext | null>(() => {
    if (!marketSnapshot) return null;
    const sourceMap = new Map<string, { name: string; available: number; stale: number }>();
    for (const market of marketSnapshot.markets) {
      const item = sourceMap.get(market.source) ?? { name: market.source, available: 0, stale: 0 };
      if (market.status !== "unavailable") item.available += 1;
      if (market.status === "stale") item.stale += 1;
      sourceMap.set(market.source, item);
    }
    return {
      schemaVersion: "1.0",
      generatedAt: marketSnapshot.generatedAt,
      coverage: marketSnapshot.coverage,
      markets: marketSnapshot.markets,
      stories: [],
      advice: { text: "", confidence: "low", generatedAt: null },
      sourceHealth: { markets: [...sourceMap.values()], stories: [] },
    };
  }, [marketSnapshot]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#070B12] text-[#D6DEE8]">
      <header className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#1F2A3A] bg-[#080E17] px-4 py-2" aria-label="风险脉冲">
        <div className="flex items-center gap-2 border-r border-[#1F2A3A] pr-5">
          <Radio className="h-4 w-4 text-[#2EC4C7]" />
          <span className="text-[11px] font-medium tracking-wide text-[#AAB5C4]">风险脉冲</span>
        </div>
        {pulseMarkets.map((market, index) => {
          const change = pulseChange(market);
          return (
            <div key={market?.symbol ?? index} className="flex items-baseline gap-2 font-mono text-[11px]">
              <span className="text-[#718096]">{market?.name ?? ["VIX", "美债10Y", "美元指数", "WTI", "黄金"][index]}</span>
              <span className="text-[#D6DEE8]">{pulseValue(market)}</span>
              <span className={change.className}>{change.text}</span>
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-[#718096]">
          <span>数据覆盖 {marketSnapshot ? `${marketSnapshot.coverage.available}/${marketSnapshot.coverage.total}` : "—"}</span>
          {marketSnapshot && marketSnapshot.coverage.stale > 0 && <span className="text-amber-300">{marketSnapshot.coverage.stale} 条陈旧</span>}
          <button type="button" onClick={() => void loadMarkets()} disabled={isRefreshing} className="inline-flex min-h-8 items-center gap-1.5 rounded border border-[#1F2A3A] px-2.5 hover:bg-[#101927] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`} />刷新
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/[0.08] px-4 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />本次刷新失败（{error}），继续显示最近成功数据。
        </div>
      )}

      <div className="flex border-b border-[#1F2A3A] bg-[#090f19] p-1 lg:hidden" role="tablist" aria-label="OSINT 视图">
        {(["market", "stories", "lhb"] as const).map((view) => (
          <button key={view} role="tab" aria-selected={mobileView === view} onClick={() => setMobileView(view)} className={`min-h-10 flex-1 rounded text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] ${mobileView === view ? "bg-[#142235] text-[#9DE7E8]" : "text-[#718096]"}`}>{view === "market" ? "行情" : view === "stories" ? "热点" : "龙虎榜"}</button>
        ))}
      </div>

      <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(340px,34%)_1fr]">
        <div className={`${mobileView === "market" ? "block" : "hidden"} min-h-0 border-r border-[#1F2A3A] lg:block`}>
          <MarketBoard markets={marketSnapshot?.markets ?? []} isLoading={isLoading} />
        </div>
        <div className={`${mobileView === "market" ? "hidden" : "block"} min-h-0 lg:block`}>
          <div className="hidden h-full min-h-0 flex-col lg:flex">
            <div className="flex min-h-10 items-center gap-1 border-b border-[#1F2A3A] bg-[#090f19] px-3" role="tablist" aria-label="情报数据视图">
              {(["stories", "lhb"] as const).map((view) => (
                <button key={view} type="button" role="tab" aria-selected={rightView === view} onClick={() => setRightView(view)} className={`min-h-8 rounded px-3 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] ${rightView === view ? "bg-[#142235] text-[#9DE7E8]" : "text-[#718096] hover:text-[#D6DEE8]"}`}>{view === "stories" ? "世界热点" : "资金龙虎榜"}</button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {rightView === "stories" ? <WorldBriefing /> : <LhbBoard />}
            </div>
          </div>
          <div className="h-full min-h-0 lg:hidden">
            {mobileView === "lhb" ? <LhbBoard /> : <WorldBriefing />}
          </div>
        </div>
      </main>

      <StatusBar context={statusContext} isRefreshing={isRefreshing} error={error} />
    </div>
  );
}
