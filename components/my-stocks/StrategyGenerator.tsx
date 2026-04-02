"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Wand2,
  Loader2,
  X,
  Archive,
  Plus,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Target,
  CalendarDays,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedStrategy {
  phases: Array<{
    week: number;
    title: string;
    dateRange: string[];
    focus: string;
  }>;
  calendarEvents: Array<{
    date: string;
    type: string;
    title: string;
    stockCode?: string;
    stockName?: string;
    detail: string;
    priority: number;
    actionIfBeat?: string;
    actionIfMiss?: string;
    indicators?: string[];
  }>;
  strategies: Array<{
    stockCode: string;
    stockName: string;
    triggerLow: number;
    triggerHigh: number;
    maxShares: number;
    maxPositionPct: number;
    stopLossPct: number;
    logic: string;
  }>;
  rules: Array<{
    title: string;
    content: string;
    priority: number;
    threshold?: number;
    unit?: string;
  }>;
  summary: string;
}

interface StrategyGeneratorProps {
  positions: Array<{
    stockCode: string;
    stockName: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    profitLossPercent: number;
    weight: number;
  }>;
  healthRules: Array<{
    id: string;
    name: string;
    pass: boolean;
    value: string;
    message: string;
  }>;
  watchlistCodes: Set<string>;
  totalAssets: number;
  cashBalance: number;
  reverseRepo: number;
  onStrategySaved: () => void;
  targetYear: number;
  targetMonth: number;
}

type ComponentState = "idle" | "previewing" | "saving";
type ModelOption = "deepseek-chat" | "claude-opus";

// ---------------------------------------------------------------------------
// Event type color map (consistent with CalendarGrid / DayDetailPanel)
// ---------------------------------------------------------------------------

const EVENT_COLORS: Record<
  string,
  { bg: string; dot: string; text: string; border: string; label: string }
> = {
  action: {
    bg: "bg-red-500/10",
    dot: "bg-red-500",
    text: "text-red-400",
    border: "border-red-500/30",
    label: "操作",
  },
  watch: {
    bg: "bg-amber-500/10",
    dot: "bg-amber-500",
    text: "text-amber-400",
    border: "border-amber-500/30",
    label: "观察",
  },
  earnings: {
    bg: "bg-purple-500/10",
    dot: "bg-purple-500",
    text: "text-purple-400",
    border: "border-purple-500/30",
    label: "财报",
  },
  review: {
    bg: "bg-blue-500/10",
    dot: "bg-blue-500",
    text: "text-blue-400",
    border: "border-blue-500/30",
    label: "复盘",
  },
  trigger: {
    bg: "bg-green-500/10",
    dot: "bg-green-500",
    text: "text-green-400",
    border: "border-green-500/30",
    label: "择机",
  },
};

const PHASE_COLORS = [
  { bg: "bg-red-500/10", border: "border-red-500", text: "text-red-400" },
  {
    bg: "bg-amber-500/10",
    border: "border-amber-500",
    text: "text-amber-400",
  },
  { bg: "bg-blue-500/10", border: "border-blue-500", text: "text-blue-400" },
  {
    bg: "bg-green-500/10",
    border: "border-green-500",
    text: "text-green-400",
  },
  {
    bg: "bg-purple-500/10",
    border: "border-purple-500",
    text: "text-purple-400",
  },
];

const PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "普通", color: "bg-gray-500/20 text-gray-400" },
  1: { label: "重要", color: "bg-amber-500/20 text-amber-400" },
  2: { label: "紧急", color: "bg-red-500/20 text-red-400" },
};

// ---------------------------------------------------------------------------
// Helper: compute week date ranges for a given month
// ---------------------------------------------------------------------------

function getMonthWeeks(
  year: number,
  month: number
): Array<{ week: number; start: string; end: string }> {
  const weeks: Array<{ week: number; start: string; end: string }> = [];
  const lastDay = new Date(year, month, 0).getDate();
  let weekStart = 1;

  while (weekStart <= lastDay) {
    const d = new Date(year, month - 1, weekStart);
    const dow = d.getDay() || 7; // Monday=1 ... Sunday=7
    const daysUntilSunday = 7 - dow;
    const weekEnd = Math.min(weekStart + daysUntilSunday, lastDay);

    weeks.push({
      week: weeks.length + 1,
      start: `${month}/${weekStart}`,
      end: `${month}/${weekEnd}`,
    });

    weekStart = weekEnd + 1;
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// Helper: build compact AI context (~2000 tokens)
// ---------------------------------------------------------------------------

interface ScopeConfig {
  modules: string[];
  stocks: "all" | string[];
  weeks: "full" | number[];
}

function buildCompactContext(props: StrategyGeneratorProps, scope: ScopeConfig) {
  const healthIssues = props.healthRules
    .filter((r) => !r.pass)
    .map((r) => `${r.name}: ${r.value}`);

  return {
    account: {
      total: Math.round(props.totalAssets),
      cash: Math.round(props.cashBalance),
      reverseRepo: Math.round(props.reverseRepo),
      debtStatus: true,
    },
    positions: props.positions.map((p) => ({
      name: p.stockName,
      code: p.stockCode,
      shares: p.quantity,
      cost: Number(p.avgCost.toFixed(2)),
      current: Number(p.currentPrice.toFixed(2)),
      pnlPct: Number(p.profitLossPercent.toFixed(2)),
      weightPct: Number(p.weight.toFixed(1)),
    })),
    watchlist: Array.from(props.watchlistCodes),
    healthIssues,
    currentDate: new Date().toISOString().slice(0, 10),
    targetMonth: props.targetMonth,
    targetYear: props.targetYear,
    scope,
  };
}

// ---------------------------------------------------------------------------
// Helper: group events by week number within the month
// ---------------------------------------------------------------------------

function groupEventsByWeek(
  events: GeneratedStrategy["calendarEvents"],
  year: number,
  month: number
): Map<number, GeneratedStrategy["calendarEvents"]> {
  const grouped = new Map<number, GeneratedStrategy["calendarEvents"]>();

  for (const ev of events) {
    const d = new Date(ev.date + "T00:00:00");
    // Calculate week of month (1-indexed)
    const firstOfMonth = new Date(year, month - 1, 1);
    const dayOfMonth = d.getDate();
    const startDow = firstOfMonth.getDay() || 7; // Monday = 1
    const weekNum = Math.ceil((dayOfMonth + startDow - 1) / 7);

    if (!grouped.has(weekNum)) grouped.set(weekNum, []);
    grouped.get(weekNum)!.push(ev);
  }

  return new Map([...grouped.entries()].sort((a, b) => a[0] - b[0]));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StrategyGenerator({
  positions,
  healthRules,
  watchlistCodes,
  totalAssets,
  cashBalance,
  reverseRepo,
  onStrategySaved,
  targetYear,
  targetMonth,
}: StrategyGeneratorProps) {
  const { getToken, isSignedIn } = useAuth();

  // Core state
  const [state, setState] = useState<ComponentState>("idle");
  const [selectedModel, setSelectedModel] =
    useState<ModelOption>("deepseek-chat");
  const [generating, setGenerating] = useState(false);

  // Scope controls (advanced options)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enabledModules, setEnabledModules] = useState<Set<string>>(
    new Set(["calendarEvents", "strategies", "rules"])
  );
  const [stockScope, setStockScope] = useState<"all" | "selected">("all");
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [timeScope, setTimeScope] = useState<"full" | "weeks">("full");
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);

  // Preview state — mutable copy of AI output
  const [strategy, setStrategy] = useState<GeneratedStrategy | null>(null);

  // Save state
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveTotal, setSaveTotal] = useState(0);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // ------------------------------------------------------------------
  // Generate strategy via API
  // ------------------------------------------------------------------
  const generate = useCallback(async () => {
    if (!isSignedIn) {
      toast.error("请先登录后使用 AI 策略生成");
      return;
    }

    setGenerating(true);
    setState("idle");
    setStrategy(null);

    try {
      const token = await getToken();
      if (!token) {
        toast.error("获取认证令牌失败，请刷新页面重试");
        return;
      }

      const compactContext = buildCompactContext(
        {
          positions,
          healthRules,
          watchlistCodes,
          totalAssets,
          cashBalance,
          reverseRepo,
          onStrategySaved,
          targetYear,
          targetMonth,
        },
        {
          modules: Array.from(enabledModules),
          stocks: stockScope === "all" ? ("all" as const) : selectedStocks,
          weeks: timeScope === "full" ? ("full" as const) : selectedWeeks,
        }
      );

      const res = await fetch("/api/ai/generate-strategy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ model: selectedModel, context: compactContext }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as Record<string, string>).error ||
            `API 错误 (${res.status})`
        );
      }

      const data = await res.json();
      if (!data.strategy) {
        throw new Error("AI 未返回有效策略数据");
      }

      setStrategy(data.strategy as GeneratedStrategy);
      setState("previewing");
      toast.success("策略生成完成，请预览确认");
    } catch (err) {
      console.error("[StrategyGenerator] Error:", err);
      const msg = err instanceof Error ? err.message : "策略生成失败";
      toast.error(`AI 策略生成失败: ${msg}`);
    } finally {
      setGenerating(false);
    }
  }, [
    isSignedIn,
    getToken,
    positions,
    healthRules,
    watchlistCodes,
    totalAssets,
    cashBalance,
    reverseRepo,
    onStrategySaved,
    targetYear,
    targetMonth,
    selectedModel,
    enabledModules,
    stockScope,
    selectedStocks,
    timeScope,
    selectedWeeks,
  ]);

  // ------------------------------------------------------------------
  // Remove preview items before saving
  // ------------------------------------------------------------------
  const removeEvent = useCallback((index: number) => {
    setStrategy((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next.calendarEvents = [...prev.calendarEvents];
      next.calendarEvents.splice(index, 1);
      return next;
    });
  }, []);

  const removeStrategyItem = useCallback((index: number) => {
    setStrategy((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next.strategies = [...prev.strategies];
      next.strategies.splice(index, 1);
      return next;
    });
  }, []);

  const removeRule = useCallback((index: number) => {
    setStrategy((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next.rules = [...prev.rules];
      next.rules.splice(index, 1);
      return next;
    });
  }, []);

  // ------------------------------------------------------------------
  // Save strategy to DB
  // ------------------------------------------------------------------
  const saveStrategy = useCallback(
    async (mode: "archive" | "append") => {
      if (!strategy) return;

      setArchiveDialogOpen(false);
      setState("saving");

      const totalItems =
        strategy.calendarEvents.length +
        strategy.strategies.length +
        strategy.rules.length;
      setSaveTotal(totalItems);
      setSaveProgress(0);

      let saved = 0;

      try {
        const token = await getToken();
        if (!token) {
          toast.error("认证失败，请刷新重试");
          setState("previewing");
          return;
        }
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        // Step 1: If archive mode, archive old notes
        if (mode === "archive") {
          const oldRes = await fetch("/api/personal-notes?status=active", {
            headers,
          });
          const oldNotes = await oldRes.json();
          if (oldNotes.success && oldNotes.notes) {
            for (const note of oldNotes.notes) {
              await fetch(`/api/personal-notes/${note.id}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({ status: "archived" }),
              });
            }
          }
        }

        // Step 2: Save calendar events
        for (const ev of strategy.calendarEvents) {
          await fetch("/api/personal-notes", {
            method: "POST",
            headers,
            body: JSON.stringify({
              type: "calendar",
              title: ev.title,
              content: ev.detail,
              effectiveDate: ev.date,
              stockCode: ev.stockCode || null,
              priority: ev.priority || 0,
              metadata: {
                eventType: ev.type,
                stockName: ev.stockName || null,
                actionIfBeat: ev.actionIfBeat || null,
                actionIfMiss: ev.actionIfMiss || null,
                indicators: ev.indicators || null,
              },
            }),
          });
          saved++;
          setSaveProgress(saved);
        }

        // Step 3: Save strategies
        for (const s of strategy.strategies) {
          await fetch("/api/personal-notes", {
            method: "POST",
            headers,
            body: JSON.stringify({
              type: "strategy",
              title: `${s.stockName}买入计划`,
              stockCode: s.stockCode,
              metadata: {
                stockCode: s.stockCode,
                stockName: s.stockName,
                triggerPrice: { low: s.triggerLow, high: s.triggerHigh },
                maxShares: s.maxShares,
                maxPositionPct: s.maxPositionPct,
                stopLossPct: s.stopLossPct,
                logic: s.logic,
              },
            }),
          });
          saved++;
          setSaveProgress(saved);
        }

        // Step 4: Save rules
        for (const r of strategy.rules) {
          await fetch("/api/personal-notes", {
            method: "POST",
            headers,
            body: JSON.stringify({
              type: "rule",
              title: r.title,
              content: r.content,
              priority: r.priority || 2,
              metadata: { threshold: r.threshold, unit: r.unit },
            }),
          });
          saved++;
          setSaveProgress(saved);
        }

        toast.success(`策略已保存 (${saved} 条记录)`);
        setState("idle");
        setStrategy(null);
        onStrategySaved();
      } catch (err) {
        console.error("[StrategyGenerator] Save error:", err);
        toast.error("保存失败，请重试");
        setState("previewing");
      }
    },
    [strategy, getToken, onStrategySaved]
  );

  // ------------------------------------------------------------------
  // Initiate save — check for existing notes first
  // ------------------------------------------------------------------
  const handleSaveClick = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error("认证失败");
        return;
      }
      const res = await fetch("/api/personal-notes?status=active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const hasExisting =
        data.success && data.notes && data.notes.length > 0;

      if (hasExisting) {
        setArchiveDialogOpen(true);
      } else {
        // No existing notes — save directly
        await saveStrategy("append");
      }
    } catch {
      // If check fails, just save as append
      await saveStrategy("append");
    }
  }, [getToken, saveStrategy]);

  // ------------------------------------------------------------------
  // Discard preview
  // ------------------------------------------------------------------
  const handleCancel = useCallback(() => {
    setStrategy(null);
    setState("idle");
  }, []);

  // ------------------------------------------------------------------
  // Render: Saving state
  // ------------------------------------------------------------------
  if (state === "saving") {
    const pct = saveTotal > 0 ? Math.round((saveProgress / saveTotal) * 100) : 0;
    return (
      <Card className="bg-[#0d1117] border-[#1a2035] shadow-none">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-white">
                保存中... ({saveProgress}/{saveTotal})
              </p>
              <p className="text-xs text-gray-500 mt-1">
                正在写入日历事件、买入策略与交易铁律
              </p>
            </div>
            <Progress
              value={pct}
              className="w-64 h-2 bg-[#1a2035]"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------------
  // Render: Preview state
  // ------------------------------------------------------------------
  if (state === "previewing" && strategy) {
    const eventsByWeek = groupEventsByWeek(
      strategy.calendarEvents,
      targetYear,
      targetMonth
    );

    return (
      <div className="space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-semibold text-white">
              策略预览
            </h3>
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] px-1.5">
              {targetYear}年{targetMonth}月
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white text-xs"
              onClick={handleCancel}
            >
              取消
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 text-xs"
              onClick={generate}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              <span className="ml-1">重新生成</span>
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-xs"
              onClick={handleSaveClick}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="ml-1">全部保存到日历</span>
            </Button>
          </div>
        </div>

        {/* Section 1: Summary */}
        <Card className="bg-[#0d1117] border-[#1a2035] shadow-none">
          <CardContent className="py-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <div className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-200 leading-relaxed">
                  {strategy.summary}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Phases */}
        {strategy.phases.length > 0 && (
          <Card className="bg-[#0d1117] border-[#1a2035] shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-cyan-400" />
                <CardTitle className="text-sm font-semibold text-white">
                  月度阶段
                </CardTitle>
                <span className="text-xs text-gray-500">
                  {strategy.phases.length} 个阶段
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className={cn(
                  "grid gap-1",
                  strategy.phases.length <= 4
                    ? "grid-cols-4"
                    : strategy.phases.length <= 5
                      ? "grid-cols-5"
                      : "grid-cols-4"
                )}
              >
                {strategy.phases.map((phase, i) => {
                  const colors =
                    PHASE_COLORS[i % PHASE_COLORS.length];
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-md px-3 py-2.5 border-l-[3px] transition-all",
                        colors.bg,
                        colors.border
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={cn(
                            "text-[10px] font-mono",
                            colors.text
                          )}
                        >
                          W{phase.week}
                        </span>
                        <span
                          className={cn(
                            "text-sm font-bold leading-tight",
                            colors.text
                          )}
                        >
                          {phase.title}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-gray-400">
                        {phase.dateRange.join(" ~ ")}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 leading-snug">
                        {phase.focus}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3: Calendar Events */}
        {strategy.calendarEvents.length > 0 && (
          <Card className="bg-[#0d1117] border-[#1a2035] shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-400" />
                <CardTitle className="text-sm font-semibold text-white">
                  日历事件预览
                </CardTitle>
                <span className="text-xs text-gray-500">
                  {strategy.calendarEvents.length} 条
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[360px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#1a2035] scrollbar-track-transparent space-y-4 pr-1">
                {[...eventsByWeek.entries()].map(([weekNum, events]) => (
                  <div key={weekNum}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
                        第{weekNum}周
                      </span>
                      <div className="flex-1 h-px bg-[#1a2035]" />
                    </div>
                    <div className="space-y-1.5">
                      {events.map((ev) => {
                        // Find the original index so removal works
                        const originalIdx =
                          strategy.calendarEvents.indexOf(ev);
                        const colors =
                          EVENT_COLORS[ev.type] || EVENT_COLORS.watch;
                        return (
                          <div
                            key={originalIdx}
                            className={cn(
                              "group flex items-start gap-2.5 rounded-md border px-3 py-2 transition-colors",
                              colors.bg,
                              colors.border
                            )}
                          >
                            {/* Date badge */}
                            <div className="shrink-0 mt-0.5">
                              <span
                                className={cn(
                                  "inline-block text-[10px] font-mono px-1.5 py-0.5 rounded",
                                  colors.bg,
                                  colors.text
                                )}
                              >
                                {ev.date.slice(5)}
                              </span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] px-1 py-0 h-4 border-0 shrink-0",
                                    colors.bg,
                                    colors.text
                                  )}
                                >
                                  {colors.label}
                                </Badge>
                                {ev.stockName && (
                                  <span className="text-[10px] font-mono text-gray-500 truncate">
                                    {ev.stockName}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-medium text-white leading-tight">
                                {ev.title}
                              </div>
                              {ev.detail && (
                                <div className="text-xs text-gray-400 mt-0.5 leading-snug">
                                  {ev.detail}
                                </div>
                              )}
                              {ev.indicators &&
                                ev.indicators.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {ev.indicators.map((ind) => (
                                      <span
                                        key={ind}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2035] text-gray-400"
                                      >
                                        {ind}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </div>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => removeEvent(originalIdx)}
                              className="shrink-0 mt-0.5 p-0.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="移除此事件"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Buy Strategies */}
        {strategy.strategies.length > 0 && (
          <Card className="bg-[#0d1117] border-[#1a2035] shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-400" />
                <CardTitle className="text-sm font-semibold text-white">
                  买入策略
                </CardTitle>
                <span className="text-xs text-gray-500">
                  {strategy.strategies.length} 只标的
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a2035] text-gray-500">
                      <th className="text-left py-2 pr-3 font-medium">
                        股票
                      </th>
                      <th className="text-right py-2 px-2 font-medium">
                        触发区间
                      </th>
                      <th className="text-right py-2 px-2 font-medium">
                        最大股数
                      </th>
                      <th className="text-right py-2 px-2 font-medium">
                        仓位上限
                      </th>
                      <th className="text-right py-2 px-2 font-medium">
                        止损
                      </th>
                      <th className="text-left py-2 pl-2 font-medium">
                        逻辑
                      </th>
                      <th className="py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {strategy.strategies.map((s, i) => (
                      <tr
                        key={i}
                        className="group border-b border-[#1a2035]/50 hover:bg-[#1a2035]/30 transition-colors"
                      >
                        <td className="py-2.5 pr-3">
                          <div className="text-white font-medium">
                            {s.stockName}
                          </div>
                          <div className="text-gray-600 font-mono text-[10px]">
                            {s.stockCode}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-green-400">
                          {s.triggerLow.toFixed(2)} ~{" "}
                          {s.triggerHigh.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-gray-300">
                          {s.maxShares.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-gray-300">
                          {s.maxPositionPct}%
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-red-400">
                          -{s.stopLossPct}%
                        </td>
                        <td className="py-2.5 pl-2 text-gray-400 max-w-[180px]">
                          <span className="line-clamp-2">{s.logic}</span>
                        </td>
                        <td className="py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeStrategyItem(i)}
                            className="p-0.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="移除此策略"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 5: Rules */}
        {strategy.rules.length > 0 && (
          <Card className="bg-[#0d1117] border-[#1a2035] shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                <CardTitle className="text-sm font-semibold text-white">
                  交易铁律
                </CardTitle>
                <span className="text-xs text-gray-500">
                  {strategy.rules.length} 条
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {strategy.rules.map((rule, i) => {
                  const priority =
                    PRIORITY_MAP[rule.priority] || PRIORITY_MAP[0];
                  return (
                    <div
                      key={i}
                      className="group flex items-start gap-3 rounded-md border border-[#1a2035] bg-[#060a12] px-3 py-2.5"
                    >
                      <Badge
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4 shrink-0 mt-0.5 border-0",
                          priority.color
                        )}
                      >
                        {priority.label}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">
                          {rule.title}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {rule.content}
                        </div>
                        {(rule.threshold !== undefined || rule.unit) && (
                          <div className="mt-1 text-[10px] font-mono text-gray-600">
                            {rule.threshold !== undefined && (
                              <span>
                                阈值: {rule.threshold}
                                {rule.unit || ""}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRule(i)}
                        className="shrink-0 mt-0.5 p-0.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="移除此规则"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottom action bar (sticky on scroll) */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 py-3 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17] to-transparent pt-6">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white text-xs"
            onClick={handleCancel}
          >
            取消
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 text-xs"
            onClick={generate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            <span className="ml-1">重新生成</span>
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-xs"
            onClick={handleSaveClick}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="ml-1">全部保存到日历</span>
          </Button>
        </div>

        {/* Archive dialog */}
        <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <DialogContent className="bg-[#0d1117] border-[#1a2035] max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                检测到已有计划
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-xs mt-1">
                当前存在活跃的日历事件和策略，请选择处理方式
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-3">
              <button
                type="button"
                onClick={() => saveStrategy("archive")}
                className="w-full flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-4 py-3 transition-colors text-left"
              >
                <Archive className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-white">
                    归档旧计划并创建新计划
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    推荐 — 旧数据归档保留，新策略替换当前日历
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => saveStrategy("append")}
                className="w-full flex items-start gap-3 rounded-lg border border-[#1a2035] bg-[#060a12] hover:bg-[#1a2035]/50 px-4 py-3 transition-colors text-left"
              >
                <Plus className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-white">
                    追加到现有计划
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    保留旧事件，在此基础上追加新策略
                  </div>
                </div>
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-gray-500 hover:text-gray-300 text-xs mt-1"
                onClick={() => setArchiveDialogOpen(false)}
              >
                取消
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render: Idle state
  // ------------------------------------------------------------------
  return (
    <Card className="bg-[#0d1117] border-[#1a2035] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-400" />
          <CardTitle className="text-base font-semibold text-white">
            AI 策略生成
          </CardTitle>
        </div>
        <CardDescription className="text-gray-500 text-xs">
          基于真实持仓数据，AI 自动生成本月交易计划
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Model selector */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium">
            选择模型
          </label>
          <div className="flex gap-2">
            <ModelRadio
              value="deepseek-chat"
              label="DeepSeek"
              sublabel="快速"
              selected={selectedModel === "deepseek-chat"}
              onSelect={() => setSelectedModel("deepseek-chat")}
              accentColor="cyan"
            />
            <ModelRadio
              value="claude-opus"
              label="Claude Opus"
              sublabel="深度"
              selected={selectedModel === "claude-opus"}
              onSelect={() => setSelectedModel("claude-opus")}
              accentColor="violet"
            />
          </div>
        </div>

        {/* Context preview (collapsed) */}
        <div className="rounded-md border border-[#1a2035] bg-[#060a12] px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span>
              {positions.length} 只持仓 ·{" "}
              {healthRules.filter((r) => !r.pass).length} 项风险 ·{" "}
              {targetYear}年{targetMonth}月
            </span>
          </div>
        </div>

        {/* Advanced options toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
          高级选项
        </button>

        {showAdvanced && (
          <div className="space-y-3 rounded-lg border border-[#1a2035] bg-[#060a12] p-3">
            {/* Section 1: Module toggles */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">生成模块</div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: "calendarEvents", label: "日历事件" },
                  { key: "strategies", label: "买入策略" },
                  { key: "rules", label: "交易铁律" },
                ] as const).map(({ key, label }) => {
                  const active = enabledModules.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setEnabledModules((prev) => {
                          const next = new Set(prev);
                          if (active && next.size > 1) {
                            next.delete(key);
                          } else if (!active) {
                            next.add(key);
                          }
                          return next;
                        });
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        active
                          ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                          : "border-[#1a2035] bg-[#0d1117] text-gray-500 hover:text-gray-300"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Stock scope */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">持仓范围</div>
              <div className="flex gap-1.5 mb-2">
                {([
                  { value: "all" as const, label: "全部持仓" },
                  { value: "selected" as const, label: "指定个股" },
                ]).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setStockScope(value);
                      if (value === "all") setSelectedStocks([]);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      stockScope === value
                        ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                        : "border-[#1a2035] bg-[#0d1117] text-gray-500 hover:text-gray-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {stockScope === "selected" && positions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {positions.map((p) => {
                    const selected = selectedStocks.includes(p.stockCode);
                    return (
                      <button
                        key={p.stockCode}
                        type="button"
                        onClick={() => {
                          setSelectedStocks((prev) =>
                            selected
                              ? prev.filter((c) => c !== p.stockCode)
                              : [...prev, p.stockCode]
                          );
                        }}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] font-mono transition-colors",
                          selected
                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                            : "border-[#1a2035] bg-[#0d1117] text-gray-500 hover:text-gray-300"
                        )}
                      >
                        {p.stockName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Time scope */}
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">时间范围</div>
              <div className="flex gap-1.5 mb-2">
                {([
                  { value: "full" as const, label: "整月" },
                  { value: "weeks" as const, label: "指定周" },
                ]).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setTimeScope(value);
                      if (value === "full") setSelectedWeeks([]);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      timeScope === value
                        ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                        : "border-[#1a2035] bg-[#0d1117] text-gray-500 hover:text-gray-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {timeScope === "weeks" && (
                <div className="flex flex-wrap gap-1.5">
                  {getMonthWeeks(targetYear, targetMonth).map((w) => {
                    const selected = selectedWeeks.includes(w.week);
                    return (
                      <button
                        key={w.week}
                        type="button"
                        onClick={() => {
                          setSelectedWeeks((prev) =>
                            selected
                              ? prev.filter((n) => n !== w.week)
                              : [...prev, w.week]
                          );
                        }}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] font-mono transition-colors",
                          selected
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                            : "border-[#1a2035] bg-[#0d1117] text-gray-500 hover:text-gray-300"
                        )}
                      >
                        W{w.week} {w.start}-{w.end}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generate button */}
        <Button
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium"
          onClick={generate}
          disabled={generating || !isSignedIn || enabledModules.size === 0}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-2">正在分析...</span>
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              <span className="ml-2">生成策略</span>
            </>
          )}
        </Button>

        {/* Generating progress animation */}
        {generating && (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-amber-400/80">
              {selectedModel === "claude-opus"
                ? "Claude Opus 深度分析中..."
                : "DeepSeek 快速分析中..."}
            </span>
          </div>
        )}

        {/* Empty state hint */}
        {!generating && (
          <p className="text-[11px] text-gray-600 text-center">
            AI 将根据持仓结构、健康度评分和市场环境生成阶段化月度计划，
            包括日历事件、买入策略和交易铁律
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Model radio option (no @radix-ui/react-radio-group needed)
// ---------------------------------------------------------------------------

function ModelRadio({
  label,
  sublabel,
  selected,
  onSelect,
  accentColor,
}: {
  value: string;
  label: string;
  sublabel: string;
  selected: boolean;
  onSelect: () => void;
  accentColor: "cyan" | "violet";
}) {
  const colorMap = {
    cyan: {
      ring: "ring-cyan-500/60",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/40",
      text: "text-cyan-400",
      dot: "bg-cyan-500",
    },
    violet: {
      ring: "ring-violet-500/60",
      bg: "bg-violet-500/10",
      border: "border-violet-500/40",
      text: "text-violet-400",
      dot: "bg-violet-500",
    },
  };
  const c = colorMap[accentColor];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex-1 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all cursor-pointer",
        selected
          ? cn(c.border, c.bg, "ring-1", c.ring)
          : "border-[#1a2035] bg-[#060a12] hover:bg-[#1a2035]/50"
      )}
    >
      {/* Custom radio dot */}
      <div
        className={cn(
          "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
          selected ? c.border : "border-gray-600"
        )}
      >
        {selected && (
          <div className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
        )}
      </div>
      <div className="text-left">
        <div
          className={cn(
            "text-sm font-medium",
            selected ? c.text : "text-gray-300"
          )}
        >
          {label}
        </div>
        <div className="text-[10px] text-gray-600">{sublabel}</div>
      </div>
    </button>
  );
}
