"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Briefcase, Calendar, RefreshCw, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

import { AccountSummary } from "@/components/my-stocks/AccountSummary";
import { HealthCheck } from "@/components/my-stocks/HealthCheck";
import { PositionTable } from "@/components/my-stocks/PositionTable";
import { AIDiagnosis } from "@/components/my-stocks/AIDiagnosis";
import { PhaseProgressBar, DEFAULT_PHASES } from "@/components/my-stocks/PhaseProgressBar";
import { CalendarGrid, type CalendarEvent } from "@/components/my-stocks/CalendarGrid";
import { DayDetailPanel } from "@/components/my-stocks/DayDetailPanel";
import { WeeklyTodoList } from "@/components/my-stocks/WeeklyTodoList";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Position {
  stockCode: string;
  stockName: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  profitLossPercent: number;
  weight: number;
}

interface HealthRule {
  id: string;
  name: string;
  pass: boolean;
  value: string;
  message: string;
}

interface TriggerItem {
  id: string;
  stockCode: string;
  stockName: string;
  currentPrice: number;
  triggerLow: number;
  triggerHigh: number;
  triggered: boolean;
  direction: "above" | "below" | "in_range";
  logic: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentPhaseIndex(): number {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  if (month !== 4) return 0;
  if (day <= 6) return 0;
  if (day <= 11) return 1;
  if (day <= 18) return 2;
  return 3;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyStocksPage() {
  const { getToken, isSignedIn } = useAuth();

  // Tab 1 state
  const [positions, setPositions] = useState<Position[]>([]);
  const [healthRules, setHealthRules] = useState<HealthRule[]>([]);
  const [healthScore, setHealthScore] = useState(100);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);
  const [totalPnLPercent, setTotalPnLPercent] = useState(0);
  const [cashRatio, setCashRatio] = useState(0);
  const [maxStockRatio, setMaxStockRatio] = useState(0);
  const [triggers, setTriggers] = useState<TriggerItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);

  // Tab 2 state
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [allNotes, setAllNotes] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  // ─── Data fetchers ────────────────────────────────────────────────────────

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const token = await getToken();
      return fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    [getToken]
  );

  const fetchPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    try {
      const res = await fetchWithAuth("/api/portfolio");
      const data = await res.json();
      if (data.success && data.portfolio) {
        const pos: Position[] = data.portfolio.map((p: Record<string, unknown>) => ({
          stockCode: p.stockCode as string,
          stockName: p.stockName as string,
          quantity: Number(p.quantity),
          avgCost: Number(p.avgCost),
          currentPrice: Number(p.currentPrice),
          marketValue: Number(p.marketValue),
          profitLoss: Number(p.profitLoss),
          profitLossPercent: Number(p.profitLossPercent),
          weight: Number(p.weight),
        }));
        setPositions(pos);

        const summary = data.summary;
        if (summary) {
          setTotalAssets(Number(summary.totalValue || 0));
          setTotalPnL(Number(summary.totalPnL || 0));
          const totalCost = pos.reduce((s, p) => s + p.avgCost * p.quantity, 0);
          setTotalPnLPercent(totalCost > 0 ? ((Number(summary.totalPnL || 0)) / totalCost) * 100 : 0);
        }
      }
    } catch (e) {
      console.error("[my-stocks] portfolio fetch error:", e);
    } finally {
      setPortfolioLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetchWithAuth("/api/portfolio/health-check?cash=594&reverseRepo=10000&monthlyTrades=2");
      const data = await res.json();
      if (data.success) {
        setHealthRules(data.rules || []);
        setHealthScore(data.score || 0);
        if (data.summary) {
          setTotalAssets(data.summary.totalAssets || 0);
          const liquid = (data.summary.cashBalance || 0) + (data.summary.reverseRepo || 0);
          setCashRatio(data.summary.totalAssets > 0 ? (liquid / data.summary.totalAssets) * 100 : 0);
        }
        const singleRule = (data.rules || []).find((r: HealthRule) => r.id === "single_stock_limit");
        if (singleRule) setMaxStockRatio(parseFloat(singleRule.value));
      }
    } catch (e) {
      console.error("[my-stocks] health check error:", e);
    } finally {
      setHealthLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchTriggers = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/personal-notes?type=strategy&status=active");
      const data = await res.json();
      if (data.success && data.notes) {
        const strategies = data.notes as Array<{
          id: string;
          stockCode?: string;
          metadata?: { stockCode?: string; stockName?: string; triggerPrice?: { low: number; high: number }; logic?: string };
        }>;

        const stockCodes = strategies
          .map((s) => s.metadata?.stockCode || s.stockCode)
          .filter(Boolean) as string[];

        let priceMap: Record<string, { price: number }> = {};
        if (stockCodes.length > 0) {
          try {
            const priceRes = await fetch(`/api/stock-prices?symbols=${stockCodes.join(",")}`);
            const priceData = await priceRes.json();
            if (priceData.success && priceData.prices) {
              priceMap = priceData.prices;
            }
          } catch {}
        }

        const items: TriggerItem[] = strategies
          .filter((s) => s.metadata?.triggerPrice)
          .map((s) => {
            const code = s.metadata!.stockCode || s.stockCode || "";
            const price = priceMap[code]?.price || 0;
            const low = s.metadata!.triggerPrice!.low;
            const high = s.metadata!.triggerPrice!.high;
            const triggered = price >= low && price <= high;
            const direction = price > high ? "above" as const : price < low ? "below" as const : "in_range" as const;
            return {
              id: s.id,
              stockCode: code,
              stockName: s.metadata?.stockName || code,
              currentPrice: price,
              triggerLow: low,
              triggerHigh: high,
              triggered,
              direction,
              logic: s.metadata?.logic || "",
            };
          });
        setTriggers(items);
      }
    } catch (e) {
      console.error("[my-stocks] triggers fetch error:", e);
    }
  }, [fetchWithAuth]);

  const fetchCalendarEvents = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const from = `${calYear}-${pad(calMonth)}-01`;
      const lastDay = new Date(calYear, calMonth, 0).getDate();
      const to = `${calYear}-${pad(calMonth)}-${pad(lastDay)}`;
      const res = await fetchWithAuth(`/api/personal-notes?type=calendar&from=${from}&to=${to}`);
      const data = await res.json();
      if (data.success) {
        setCalendarEvents(data.notes || []);
      }

      const allRes = await fetchWithAuth("/api/personal-notes?type=calendar&status=active");
      const allData = await allRes.json();
      if (allData.success) {
        setAllNotes(allData.notes || []);
      }
    } catch (e) {
      console.error("[my-stocks] calendar fetch error:", e);
    } finally {
      setCalendarLoading(false);
    }
  }, [fetchWithAuth, calYear, calMonth]);

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isSignedIn === undefined) return;
    fetchPortfolio();
    fetchHealthCheck();
    fetchTriggers();
  }, [isSignedIn, fetchPortfolio, fetchHealthCheck, fetchTriggers]);

  useEffect(() => {
    if (isSignedIn === undefined) return;
    fetchCalendarEvents();
  }, [isSignedIn, fetchCalendarEvents]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleDeleteTrigger(id: string) {
    try {
      const res = await fetchWithAuth(`/api/personal-notes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setTriggers((prev) => prev.filter((t) => t.id !== id));
        toast.success("已删除监控标的");
      }
    } catch {
      toast.error("删除失败");
    }
  }

  async function handleSaveCalendarEvent(event: Partial<CalendarEvent>) {
    try {
      const res = await fetchWithAuth("/api/personal-notes", {
        method: "POST",
        body: JSON.stringify({
          type: "calendar",
          title: event.title,
          content: event.content,
          effectiveDate: event.effectiveDate,
          stockCode: event.stockCode,
          priority: event.priority,
          metadata: event.metadata,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("事件已添加");
        fetchCalendarEvents();
      }
    } catch {
      toast.error("添加失败");
    }
  }

  async function handleUpdateCalendarEvent(id: string, updates: Partial<CalendarEvent>) {
    try {
      const res = await fetchWithAuth(`/api/personal-notes/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("事件已更新");
        fetchCalendarEvents();
      }
    } catch {
      toast.error("更新失败");
    }
  }

  async function handleDeleteCalendarEvent(id: string) {
    try {
      const res = await fetchWithAuth(`/api/personal-notes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("事件已删除");
        fetchCalendarEvents();
      }
    } catch {
      toast.error("删除失败");
    }
  }

  async function handleToggleTodo(id: string, completed: boolean) {
    try {
      const res = await fetchWithAuth(`/api/personal-notes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: completed ? "completed" : "active" }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCalendarEvents();
      }
    } catch {
      toast.error("更新失败");
    }
  }

  function handleNavigateMonth(dir: -1 | 1) {
    setCalMonth((prev) => {
      let m = prev + dir;
      if (m < 1) { setCalYear((y) => y - 1); m = 12; }
      if (m > 12) { setCalYear((y) => y + 1); m = 1; }
      return m;
    });
    setSelectedDate(null);
  }

  // ─── Build AI context ─────────────────────────────────────────────────────

  const portfolioContext = [
    `== 持仓数据 ==`,
    ...positions.map(
      (p) => `${p.stockName}(${p.stockCode}): ${p.quantity}股, 成本${p.avgCost}, 现价${p.currentPrice}, 盈亏${p.profitLossPercent.toFixed(2)}%, 占比${p.weight.toFixed(1)}%`
    ),
    `== 健康度 ${healthScore}分 ==`,
    ...healthRules.map((r) => `${r.pass ? "✅" : "⚠️"} ${r.name}: ${r.value} — ${r.message}`),
    `== 监控清单 ==`,
    ...triggers.map(
      (t) => `${t.stockName}(${t.stockCode}): 现价${t.currentPrice}, 触发区间${t.triggerLow}-${t.triggerHigh}, ${t.triggered ? "已触发" : "未触发"}`
    ),
  ].join("\n");

  // ─── Selected date events ─────────────────────────────────────────────────

  const selectedDateEvents = selectedDate
    ? calendarEvents.filter((ev) => ev.effectiveDate?.toString().slice(0, 10) === selectedDate)
    : [];

  // ─── Refresh handler ──────────────────────────────────────────────────────

  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchPortfolio(), fetchHealthCheck(), fetchTriggers()]);
    setRefreshing(false);
    toast.success("数据已刷新");
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 bg-[#060a12] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">我的股票</h1>
          <p className="text-sm text-gray-400 mt-1">个人持仓管理与交易策略中心</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-gray-400 hover:text-white"
        >
          {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="portfolio-strategy">
        <TabsList className="bg-[#0d1321] border border-[#1a2035]">
          <TabsTrigger
            value="portfolio-strategy"
            className="data-[state=active]:bg-[#1a2035] data-[state=active]:text-white gap-1.5"
          >
            <Briefcase className="h-4 w-4" />
            持仓策略
          </TabsTrigger>
          <TabsTrigger
            value="trading-calendar"
            className="data-[state=active]:bg-[#1a2035] data-[state=active]:text-white gap-1.5"
          >
            <Calendar className="h-4 w-4" />
            交易日历
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: 持仓策略 ═══ */}
        <TabsContent value="portfolio-strategy">
          <div className="space-y-4 mt-4">
            {/* 账户总览 */}
            <AccountSummary
              totalAssets={totalAssets}
              totalPnL={totalPnL}
              totalPnLPercent={totalPnLPercent}
              cashRatio={cashRatio}
              maxSingleStockRatio={maxStockRatio}
              loading={portfolioLoading && healthLoading}
            />

            {/* 健康度检查 */}
            <HealthCheck rules={healthRules} score={healthScore} loading={healthLoading} />

            {/* 持仓列表 + 监控清单 */}
            <PositionTable
              positions={positions}
              triggers={triggers}
              loading={portfolioLoading}
              onDeleteTrigger={handleDeleteTrigger}
            />

            {/* AI 持仓诊断 */}
            <AIDiagnosis portfolioContext={portfolioContext} />
          </div>
        </TabsContent>

        {/* ═══ Tab 2: 交易日历 ═══ */}
        <TabsContent value="trading-calendar">
          <div className="space-y-4 mt-4">
            {/* 阶段进度条 */}
            <Card className="bg-[#0d1117] border-[#1a2035] p-4">
              <PhaseProgressBar phases={DEFAULT_PHASES} currentPhaseIndex={getCurrentPhaseIndex()} />
            </Card>

            {/* 月历 + 日期详情 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-[#0d1117] border-[#1a2035] p-4 lg:col-span-2">
                {calendarLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="size-6 animate-spin text-gray-500" />
                  </div>
                ) : (
                  <CalendarGrid
                    year={calYear}
                    month={calMonth}
                    events={calendarEvents}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    onNavigateMonth={handleNavigateMonth}
                  />
                )}
              </Card>

              <div className="space-y-4">
                {selectedDate ? (
                  <DayDetailPanel
                    selectedDate={selectedDate}
                    events={selectedDateEvents}
                    onSaveEvent={handleSaveCalendarEvent}
                    onUpdateEvent={handleUpdateCalendarEvent}
                    onDeleteEvent={handleDeleteCalendarEvent}
                  />
                ) : (
                  <Card className="bg-[#0d1117] border-[#1a2035] flex items-center justify-center min-h-[200px]">
                    <span className="text-sm text-gray-500">点击日期查看详情</span>
                  </Card>
                )}

                {/* 本周待办 */}
                <WeeklyTodoList events={allNotes} onToggleComplete={handleToggleTodo} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
