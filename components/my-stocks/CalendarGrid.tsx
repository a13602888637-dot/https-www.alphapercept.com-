"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  content?: string;
  effectiveDate: string;
  status: "active" | "completed";
  priority: number;
  stockCode?: string;
  metadata?: {
    eventType: "action" | "watch" | "earnings" | "review" | "trigger";
    stockName?: string;
    actionIfBeat?: string;
    actionIfMiss?: string;
    indicators?: string[];
  };
}

interface CalendarGridProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onNavigateMonth: (direction: -1 | 1) => void;
}

const EVENT_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  action:   { bg: "bg-red-500/10",    dot: "bg-red-500",    text: "text-red-400" },
  watch:    { bg: "bg-amber-500/10",  dot: "bg-amber-500",  text: "text-amber-400" },
  earnings: { bg: "bg-purple-500/10", dot: "bg-purple-500", text: "text-purple-400" },
  review:   { bg: "bg-blue-500/10",   dot: "bg-blue-500",   text: "text-blue-400" },
  trigger:  { bg: "bg-green-500/10",  dot: "bg-green-500",  text: "text-green-400" },
};

const DAY_HEADERS = ["一", "二", "三", "四", "五", "六", "日"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDateString(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function getTodayString(): string {
  const now = new Date();
  return toDateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

interface DayCell {
  day: number;
  dateStr: string;
  inMonth: boolean;
  isWeekend: boolean;
}

function buildCalendarCells(year: number, month: number): DayCell[] {
  const firstDay = new Date(year, month - 1, 1);
  let startDow = firstDay.getDay();
  if (startDow === 0) startDow = 7;

  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const cells: DayCell[] = [];

  for (let i = startDow - 1; i >= 1; i--) {
    const d = prevMonthDays - i + 1;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const dow = (cells.length % 7) + 1;
    cells.push({
      day: d,
      dateStr: toDateString(prevYear, prevMonth, d),
      inMonth: false,
      isWeekend: dow >= 6,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (cells.length % 7) + 1;
    cells.push({
      day: d,
      dateStr: toDateString(year, month, d),
      inMonth: true,
      isWeekend: dow >= 6,
    });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    for (let d = 1; d <= remaining; d++) {
      const dow = (cells.length % 7) + 1;
      cells.push({
        day: d,
        dateStr: toDateString(nextYear, nextMonth, d),
        inMonth: false,
        isWeekend: dow >= 6,
      });
    }
  }

  return cells;
}

export function CalendarGrid({
  year,
  month,
  events,
  selectedDate,
  onSelectDate,
  onNavigateMonth,
}: CalendarGridProps) {
  const today = getTodayString();
  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const dateKey = ev.effectiveDate.slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(ev);
    }
    return map;
  }, [events]);

  const legendTypes = [
    { key: "action", label: "操作" },
    { key: "watch", label: "观察" },
    { key: "earnings", label: "财报" },
    { key: "review", label: "复盘" },
    { key: "trigger", label: "触发" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon-sm" onClick={() => onNavigateMonth(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold text-white">
          {year}年{month}月
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => onNavigateMonth(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "text-center text-xs py-1.5 font-medium",
              i >= 5 ? "text-gray-600" : "text-gray-400"
            )}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell) => {
          const dayEvents = eventsByDate[cell.dateStr] || [];
          const isToday = cell.dateStr === today;
          const isSelected = cell.dateStr === selectedDate;
          const firstEvent = dayEvents[0];
          const eventType = firstEvent?.metadata?.eventType || "watch";
          const eventColor = EVENT_COLORS[eventType] || EVENT_COLORS.watch;

          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => cell.inMonth && onSelectDate(cell.dateStr)}
              className={cn(
                "relative flex flex-col items-center rounded-md py-1.5 px-0.5 min-h-[52px] transition-colors",
                cell.inMonth
                  ? "hover:bg-[#1a2035]/60 cursor-pointer"
                  : "opacity-20 cursor-default",
                isToday && "ring-1 ring-amber-500/60",
                isSelected && cell.inMonth && "bg-blue-500/15",
                cell.isWeekend && cell.inMonth && !isSelected && "text-gray-500"
              )}
            >
              <span
                className={cn(
                  "text-xs font-mono leading-none",
                  cell.inMonth
                    ? isSelected
                      ? "text-blue-400 font-semibold"
                      : isToday
                        ? "text-amber-400 font-semibold"
                        : cell.isWeekend
                          ? "text-gray-500"
                          : "text-gray-300"
                    : "text-gray-700"
                )}
              >
                {cell.day}
              </span>

              {dayEvents.length > 0 && cell.inMonth && (
                <div className="mt-1 flex flex-col items-center gap-0.5 w-full">
                  <div className="flex items-center gap-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const et = ev.metadata?.eventType || "watch";
                      const ec = EVENT_COLORS[et] || EVENT_COLORS.watch;
                      return (
                        <span
                          key={ev.id}
                          className={cn("size-1.5 rounded-full shrink-0", ec.dot)}
                        />
                      );
                    })}
                  </div>
                  <span
                    className={cn(
                      "text-[8px] leading-tight truncate max-w-full px-0.5",
                      eventColor.text
                    )}
                  >
                    {firstEvent.title}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1a2035]">
        {legendTypes.map(({ key, label }) => {
          const c = EVENT_COLORS[key];
          return (
            <div key={key} className="flex items-center gap-1">
              <span className={cn("size-2 rounded-full", c.dot)} />
              <span className="text-[10px] text-gray-500">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { CalendarEvent };
export { EVENT_COLORS };
