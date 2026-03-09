"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Shield, TrendingUp, Newspaper, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface IntelItem {
  id: string;
  stockCode: string;
  stockName: string;
  eventSummary: string;
  trapProbability: number;
  actionSignal: string;
}

interface NewsItem {
  title: string;
  summary: string;
  impact: string;
  sectors: string[];
}

interface IntelligencePanelProps {
  intelligence: IntelItem[];
  news: NewsItem[];
}

const TABS = [
  { key: "all", label: "全部", icon: Shield },
  { key: "high_risk", label: "高风险", icon: AlertTriangle },
  { key: "buy", label: "买入", icon: TrendingUp },
  { key: "news", label: "新闻", icon: Newspaper },
] as const;

type TabKey = typeof TABS[number]["key"];

const SIGNAL_COLORS: Record<string, string> = {
  BUY: "bg-red-500/20 text-red-400 border-red-500/30",
  SELL: "bg-green-500/20 text-green-400 border-green-500/30",
  HOLD: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const IMPACT_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-amber-500/20 text-amber-400",
  low: "bg-slate-500/20 text-slate-400",
};

export function IntelligencePanel({ intelligence, news }: IntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const filteredIntel = intelligence.filter(item => {
    if (activeTab === "high_risk") return item.trapProbability >= 60;
    if (activeTab === "buy") return item.actionSignal === "BUY";
    return true;
  });

  return (
    <div className="h-full flex flex-col rounded-lg bg-slate-800/40 border border-slate-700/50">
      {/* Tab bar */}
      <div className="flex border-b border-slate-700/50 px-2 pt-2 gap-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-t text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-slate-700/60 text-white"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-2"
          >
            {activeTab === "news" ? (
              news.length > 0 ? (
                news.map((item, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-700/30 border border-slate-700/40">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-medium text-white leading-snug line-clamp-2">{item.title}</h4>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0 px-1.5 py-0 border-0", IMPACT_COLORS[item.impact] || IMPACT_COLORS.medium)}>
                        {item.impact === "high" ? "高" : item.impact === "medium" ? "中" : "低"}
                      </Badge>
                    </div>
                    {item.summary && <p className="text-[11px] text-slate-400 mt-1">{item.summary}</p>}
                    {item.sectors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.sectors.map((s, j) => (
                          <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">暂无新闻</div>
              )
            ) : (
              filteredIntel.length > 0 ? (
                filteredIntel.map(item => (
                  <div key={item.id} className="p-2.5 rounded-lg bg-slate-700/30 border border-slate-700/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white">
                        {item.stockName}
                        <span className="text-slate-500 ml-1">{item.stockCode}</span>
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", SIGNAL_COLORS[item.actionSignal] || SIGNAL_COLORS.HOLD)}>
                        {item.actionSignal}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{item.eventSummary}</p>
                    {/* Trap probability bar */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">陷阱</span>
                      <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            item.trapProbability >= 60 ? "bg-red-500" : item.trapProbability >= 30 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${item.trapProbability}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{item.trapProbability}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">暂无情报</div>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
