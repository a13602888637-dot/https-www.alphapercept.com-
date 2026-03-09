"use client";

import dynamic from "next/dynamic";

interface MarketItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  region: string;
}

interface WorldMapPanelProps {
  globalMarkets: MarketItem[];
}

const WorldMapInner = dynamic(() => import("./WorldMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[300px] rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
      <div className="text-slate-500 text-sm animate-pulse">加载地图中...</div>
    </div>
  ),
});

export function WorldMapPanel({ globalMarkets }: WorldMapPanelProps) {
  return <WorldMapInner globalMarkets={globalMarkets} />;
}
