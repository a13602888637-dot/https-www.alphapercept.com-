"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_COLORS: Record<string, { bg: string; dot: string; text: string; label: string }> = {
  action:   { bg: "bg-red-500/10",    dot: "bg-red-500",    text: "text-red-400",    label: "操作日" },
  watch:    { bg: "bg-amber-500/10",  dot: "bg-amber-500",  text: "text-amber-400",  label: "观察日" },
  earnings: { bg: "bg-purple-500/10", dot: "bg-purple-500", text: "text-purple-400", label: "财报日" },
  review:   { bg: "bg-blue-500/10",   dot: "bg-blue-500",   text: "text-blue-400",   label: "复盘日" },
  trigger:  { bg: "bg-green-500/10",  dot: "bg-green-500",  text: "text-green-400",  label: "择机窗口" },
};

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

interface DayDetailPanelProps {
  selectedDate: string;
  events: CalendarEvent[];
  onSaveEvent: (event: Partial<CalendarEvent>) => Promise<void>;
  onUpdateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

interface EventFormData {
  eventType: string;
  title: string;
  content: string;
  stockCode: string;
  priority: number;
  actionIfBeat: string;
  actionIfMiss: string;
  indicators: string;
}

const INITIAL_FORM: EventFormData = {
  eventType: "watch",
  title: "",
  content: "",
  stockCode: "",
  priority: 0,
  actionIfBeat: "",
  actionIfMiss: "",
  indicators: "",
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${weekdays[d.getDay()]}`;
}

export function DayDetailPanel({
  selectedDate,
  events,
  onSaveEvent,
  onUpdateEvent,
  onDeleteEvent,
}: DayDetailPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  function openCreateForm() {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  }

  function openEditForm(ev: CalendarEvent) {
    setEditingId(ev.id);
    setForm({
      eventType: ev.metadata?.eventType || "watch",
      title: ev.title,
      content: ev.content || "",
      stockCode: ev.stockCode || "",
      priority: ev.priority,
      actionIfBeat: ev.metadata?.actionIfBeat || "",
      actionIfMiss: ev.metadata?.actionIfMiss || "",
      indicators: ev.metadata?.indicators?.join(", ") || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const metadata: Record<string, unknown> = { eventType: form.eventType };
      if (form.eventType === "earnings") {
        if (form.actionIfBeat) metadata.actionIfBeat = form.actionIfBeat;
        if (form.actionIfMiss) metadata.actionIfMiss = form.actionIfMiss;
        if (form.indicators) metadata.indicators = form.indicators.split(",").map((s) => s.trim()).filter(Boolean);
      }

      const payload: Partial<CalendarEvent> = {
        title: form.title.trim(),
        content: form.content.trim() || undefined,
        effectiveDate: selectedDate,
        stockCode: form.stockCode.trim() || undefined,
        priority: form.priority,
        metadata: metadata as CalendarEvent["metadata"],
      };

      if (editingId) {
        await onUpdateEvent(editingId, payload);
      } else {
        await onSaveEvent(payload);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-[#0d1117] border-[#1a2035]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <CalendarDays className="size-4 text-blue-400" />
            {formatDateLabel(selectedDate)}
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-400 hover:text-blue-300"
                onClick={openCreateForm}
              >
                <Plus className="size-3 mr-1" />
                添加事件
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d1117] border-[#1a2035] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white text-sm">
                  {editingId ? "编辑事件" : "添加事件"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
                  <SelectTrigger className="bg-[#060a12] border-[#1a2035] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1117] border-[#1a2035]">
                    {Object.entries(EVENT_COLORS).map(([key, c]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", c.dot)} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="事件标题"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-[#060a12] border-[#1a2035] text-sm"
                />

                <Textarea
                  placeholder="详细说明（可选）"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="bg-[#060a12] border-[#1a2035] text-sm min-h-[60px]"
                />

                <Input
                  placeholder="关联股票代码（可选）"
                  value={form.stockCode}
                  onChange={(e) => setForm({ ...form, stockCode: e.target.value })}
                  className="bg-[#060a12] border-[#1a2035] text-sm"
                />

                <Select value={String(form.priority)} onValueChange={(v) => setForm({ ...form, priority: Number(v) })}>
                  <SelectTrigger className="bg-[#060a12] border-[#1a2035] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1117] border-[#1a2035]">
                    <SelectItem value="0">普通</SelectItem>
                    <SelectItem value="1">重要</SelectItem>
                    <SelectItem value="2">紧急</SelectItem>
                  </SelectContent>
                </Select>

                {form.eventType === "earnings" && (
                  <div className="space-y-2 border-t border-[#1a2035] pt-3">
                    <Input
                      placeholder="超预期操作（如：持有/加仓）"
                      value={form.actionIfBeat}
                      onChange={(e) => setForm({ ...form, actionIfBeat: e.target.value })}
                      className="bg-[#060a12] border-[#1a2035] text-sm"
                    />
                    <Input
                      placeholder="低于预期操作（如：减仓/清仓）"
                      value={form.actionIfMiss}
                      onChange={(e) => setForm({ ...form, actionIfMiss: e.target.value })}
                      className="bg-[#060a12] border-[#1a2035] text-sm"
                    />
                    <Input
                      placeholder="关注指标（逗号分隔）"
                      value={form.indicators}
                      onChange={(e) => setForm({ ...form, indicators: e.target.value })}
                      className="bg-[#060a12] border-[#1a2035] text-sm"
                    />
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm"
                >
                  {saving ? "保存中..." : editingId ? "更新" : "添加"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {events.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            当日无事件
          </div>
        ) : (
          events.map((ev) => {
            const eventType = ev.metadata?.eventType || "watch";
            const colors = EVENT_COLORS[eventType] || EVENT_COLORS.watch;
            return (
              <div
                key={ev.id}
                className={cn("rounded-lg border border-[#1a2035] p-3", colors.bg)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border-0", colors.bg, colors.text)}>
                        {colors.label}
                      </Badge>
                      {ev.stockCode && (
                        <span className="text-[10px] font-mono text-gray-500">
                          {ev.metadata?.stockName || ev.stockCode}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-white">{ev.title}</div>
                    {ev.content && (
                      <div className="text-xs text-gray-400 mt-1">{ev.content}</div>
                    )}
                    {ev.metadata?.indicators && ev.metadata.indicators.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ev.metadata.indicators.map((ind) => (
                          <span key={ind} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2035] text-gray-400">
                            {ind}
                          </span>
                        ))}
                      </div>
                    )}
                    {(ev.metadata?.actionIfBeat || ev.metadata?.actionIfMiss) && (
                      <div className="mt-2 space-y-1 text-xs">
                        {ev.metadata.actionIfBeat && (
                          <div className="text-green-400">超预期 → {ev.metadata.actionIfBeat}</div>
                        )}
                        {ev.metadata.actionIfMiss && (
                          <div className="text-red-400">低于预期 → {ev.metadata.actionIfMiss}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-500 hover:text-white" onClick={() => openEditForm(ev)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-500 hover:text-red-400" onClick={() => onDeleteEvent(ev.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
