"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_DOT_COLORS: Record<string, string> = {
  action: "bg-red-500",
  watch: "bg-amber-500",
  earnings: "bg-purple-500",
  review: "bg-blue-500",
  trigger: "bg-green-500",
};

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

function getWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
  return { start: monday, end: sunday, label: `${fmt(monday)} — ${fmt(sunday)}` };
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
}

export function WeeklyTodoList({ events, onToggleComplete }: WeeklyTodoListProps) {
  const week = useMemo(() => getWeekRange(), []);

  const weekEvents = useMemo(() => {
    return events
      .filter((ev) => {
        const d = new Date(ev.effectiveDate + "T00:00:00");
        return d >= week.start && d <= week.end;
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
            本周待办
          </span>
          <span className="text-xs font-mono text-gray-500 font-normal">{week.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {weekEvents.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            本周无待办事项
          </div>
        ) : (
          <div className="space-y-1">
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
                      "flex-1 text-sm truncate",
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
