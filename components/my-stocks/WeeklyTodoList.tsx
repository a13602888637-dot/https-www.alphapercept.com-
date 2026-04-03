"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_DOT_COLORS: Record<string, string> = {
  action: "bg-red-500",
  watch: "bg-amber-500",
  earnings: "bg-purple-500",
  review: "bg-blue-500",
  trigger: "bg-green-500",
};

// Only actionable event types show as todos
const TODO_EVENT_TYPES = new Set(["action", "earnings", "trigger", "review"]);

interface CalendarEvent {
  id: string;
  title: string;
  effectiveDate: string;
  status: "active" | "completed";
  metadata?: {
    eventType?: string;
  };
}

interface WeeklyTodoListProps {
  events: CalendarEvent[];
  onToggleComplete: (id: string, completed: boolean) => Promise<void>;
}

function getWeekRange(offset: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
  return { start: monday, end: sunday, label: `${fmt(monday)} — ${fmt(sunday)}` };
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
}

function weekLabel(offset: number): string {
  if (offset === 0) return "本周待办";
  if (offset === 1) return "下周待办";
  if (offset === -1) return "上周待办";
  return offset > 0 ? `${offset}周后` : `${-offset}周前`;
}

export function WeeklyTodoList({ events, onToggleComplete }: WeeklyTodoListProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  const weekEvents = useMemo(() => {
    return events
      .filter((ev) => {
        const dateStr = ev.effectiveDate.slice(0, 10);
        const d = new Date(dateStr + "T00:00:00");
        if (d < week.start || d > week.end) return false;
        // Only show actionable events as todos
        const eventType = ev.metadata?.eventType || "watch";
        return TODO_EVENT_TYPES.has(eventType);
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return a.effectiveDate.localeCompare(b.effectiveDate);
      });
  }, [events, week]);

  return (
    <Card className="bg-[#0d1117] border-[#1a2035]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListTodo className="size-4 text-amber-400" />
            {weekLabel(weekOffset)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-0.5 rounded text-gray-500 hover:text-white hover:bg-[#1a2035] transition-colors"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-xs font-mono text-gray-500 font-normal min-w-[100px] text-center">
              {week.label}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-0.5 rounded text-gray-500 hover:text-white hover:bg-[#1a2035] transition-colors"
            >
              <ChevronRight className="size-3.5" />
            </button>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="text-[10px] text-blue-400 hover:text-blue-300 ml-1"
              >
                本周
              </button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {weekEvents.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            {weekLabel(weekOffset).replace("待办", "")}无操作事项
          </div>
        ) : (
          <div className="space-y-1 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#1a2035] scrollbar-track-transparent pr-1">
            {weekEvents.map((ev) => {
              const completed = ev.status === "completed";
              const eventType = ev.metadata?.eventType || "watch";
              const dotColor = EVENT_DOT_COLORS[eventType] || EVENT_DOT_COLORS.watch;

              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onToggleComplete(ev.id, !completed)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                    "hover:bg-[#1a2035]/60"
                  )}
                >
                  <div
                    className={cn(
                      "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      completed
                        ? "bg-green-600 border-green-600"
                        : "border-gray-600 bg-transparent"
                    )}
                  >
                    {completed && (
                      <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  <span className={cn("size-2 rounded-full shrink-0", dotColor)} />

                  <span
                    className={cn(
                      "flex-1 text-sm",
                      completed ? "line-through text-gray-600" : "text-gray-200"
                    )}
                  >
                    {ev.title}
                  </span>

                  <span className="text-xs font-mono text-gray-600 shrink-0">
                    {formatShortDate(ev.effectiveDate)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
