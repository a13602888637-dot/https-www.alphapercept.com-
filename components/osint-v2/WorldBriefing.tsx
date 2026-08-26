"use client";

import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OsintStory, StorySnapshot } from "@/lib/osint/contracts";

const TOPICS = ["全部", "未来事件", "地缘", "宏观", "能源", "科技"] as const;

function shanghaiDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Math.floor(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) / 86_400_000);
}

function timeLabel(story: OsintStory): { time: string; age: string } {
  const date = new Date(story.scheduledFor || story.publishedAt);
  if (story.eventType === "upcoming") {
    const days = Math.max(0, shanghaiDay(date) - shanghaiDay(new Date()));
    const countdown = days === 0 ? "今天" : days === 1 ? "明天" : `${days}天后`;
    const session = story.scheduledSession === "bmo" ? "美股盘前" : story.scheduledSession === "dmh" ? "美股盘中" : story.scheduledSession === "amc" ? "美股盘后" : null;
    const dateOnly = date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" });
    return {
      time: story.scheduledPrecision === "date" || story.scheduledPrecision === "session"
        ? dateOnly
        : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai", hour12: false }),
      age: session ? `${session} · ${countdown}` : countdown,
    };
  }
  const ageHours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));
  return {
    time: date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }),
    age: ageHours < 1 ? "1小时内" : ageHours < 24 ? `${ageHours}小时前` : `${Math.floor(ageHours / 24)}天前`,
  };
}

function tagList(story: OsintStory): string[] {
  return [
    ...story.tags.topic,
    ...story.tags.region,
    ...story.tags.assets,
    story.tags.direction,
    story.tags.horizon,
    story.tags.verification === "multi-source" ? "双源确认" : story.tags.verification === "official" ? "官方来源" : "单源",
    story.cacheStatus === "cached" ? "缓存" : "",
  ].filter(Boolean).slice(0, 7);
}

export function WorldBriefing() {
  const [snapshot, setSnapshot] = useState<StorySnapshot | null>(null);
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("全部");
  const [source, setSource] = useState("全部");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const snapshotCacheRef = useRef(new Map<string, StorySnapshot>());

  const loadStories = useCallback(async (signal?: AbortSignal) => {
    const cacheKey = `${topic}|${page}`;
    const cachedSnapshot = snapshotCacheRef.current.get(cacheKey);
    if (cachedSnapshot) {
      setSnapshot(cachedSnapshot);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const topicParam = topic === "全部" ? "" : `&topic=${encodeURIComponent(topic)}`;
      const response = await fetch(`/api/osint/v1/stories?page=${page}&pageSize=20${topicParam}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const nextSnapshot = (await response.json()) as StorySnapshot;
      snapshotCacheRef.current.set(cacheKey, nextSnapshot);
      setSnapshot(nextSnapshot);
      setError(null);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "新闻刷新失败");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, topic]);

  useEffect(() => {
    const controller = new AbortController();
    void loadStories(controller.signal);
    const interval = window.setInterval(() => void loadStories(), 300_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadStories]);

  const stories = snapshot?.stories ?? [];
  const sourceNames = useMemo(
    () => ["全部", ...(snapshot?.sources ?? []).filter((item) => item.ok).map((item) => item.name)],
    [snapshot?.sources]
  );
  const visibleStories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stories.filter((story) => {
      if (source === "持久缓存" && story.cacheStatus !== "cached") return false;
      if (source !== "全部" && source !== "持久缓存" && !story.sources.some((item) => item.name === source)) return false;
      if (needle && !`${story.title} ${story.summary} ${tagList(story).join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [query, source, stories]);

  const pagination = snapshot?.pagination ?? { page, pageSize: 20, total: 0, totalPages: 1 };

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#070B12]" aria-label="世界热点">
      <div className="border-b border-[#1F2A3A] px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-[#D6DEE8]">财经热点 · 过去3天新闻 + 未来7天事件</h2>
            <p className="mt-0.5 text-[11px] text-[#718096]">{pagination.total} 条去重事件 · 服务端分类后分页 · 摘要与标签可供 Agent 分析</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <select aria-label="新闻来源" value={source} onChange={(event) => setSource(event.target.value)} className="h-10 w-full rounded-md border border-[#1F2A3A] bg-[#0D1420] px-2 text-sm text-[#D6DEE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] sm:h-9 sm:w-auto sm:text-[11px]">
              {sourceNames.map((name) => <option key={name} value={name}>{name === "全部" ? "来源：全部" : name}</option>)}
            </select>
            <label className="flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-[#1F2A3A] bg-[#0D1420] px-3 focus-within:ring-2 focus-within:ring-[#2EC4C7] sm:h-9 sm:min-w-44 sm:flex-1">
              <Search className="h-3.5 w-3.5 text-[#718096]" /><span className="sr-only">搜索热点</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索事件、资产、标签" className="min-w-0 flex-1 bg-transparent text-sm text-[#D6DEE8] outline-none placeholder:text-[#4b586b] sm:text-[11px]" />
            </label>
            <button type="button" onClick={() => void loadStories()} disabled={loading} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-[#1F2A3A] bg-[#0D1420] px-3 text-xs text-[#718096] hover:text-[#D6DEE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] disabled:opacity-50 sm:h-9 sm:w-auto sm:text-[10px]">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />刷新新闻
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="热点分类">
          {TOPICS.map((item) => (
            <button key={item} type="button" aria-pressed={topic === item} onClick={() => { setTopic(item); setPage(1); setSource("全部"); }} className={`min-h-8 rounded-md border px-3 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] ${topic === item ? "border-[#2EC4C7]/50 bg-[#2EC4C7]/15 text-[#9DE7E8]" : "border-[#1F2A3A] bg-[#0D1420] text-[#718096] hover:text-[#D6DEE8]"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="border-b border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-[11px] text-red-300">本次新闻刷新失败（{error}），继续显示最近成功数据。</div>}

      <div className="mx-4 mt-3 flex flex-col items-start gap-2 rounded-md border border-[#F2B84B]/35 bg-[#F2B84B]/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm font-medium leading-6 text-[#F6C968] sm:text-xs sm:leading-5">今日建议：{snapshot?.advice.text || "等待足够数据后再判断。"}</p>
        <span className="shrink-0 font-mono text-[10px] text-[#9f8656]">DeepSeek · {snapshot?.advice.generatedAt ? new Date(snapshot.advice.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }) : "规则摘要"}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {loading && !snapshot ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-md border border-[#1F2A3A] bg-[#0D1420]" />)}</div>
        ) : visibleStories.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-xs text-[#718096]"><span>{topic === "未来事件" ? "未来7天暂无已确认事件" : `过去3天暂无“${topic}”分类新闻`}</span><span className="text-[10px] text-[#4b586b]">可切换分类、来源或清空搜索</span></div>
        ) : (
          <div className="relative space-y-2 before:absolute before:bottom-0 before:left-[51px] before:top-0 before:w-px before:bg-[#263348] sm:before:left-[61px]">
            {visibleStories.map((story) => {
              const published = timeLabel(story);
              const upcoming = story.eventType === "upcoming";
              return (
                <article key={story.id} className="relative grid grid-cols-[58px_minmax(0,1fr)] gap-3 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-4">
                  <div className="pt-3 text-right font-mono"><div className="text-xs text-[#AAB5C4] sm:text-[11px]">{published.time}</div><div className="text-[10px] text-[#536177] sm:text-[9px]">{published.age}</div></div>
                  <div className={`relative min-w-0 rounded-md border px-3 py-3 transition-colors sm:px-4 ${upcoming ? "border-[#F59E32]/45 bg-[#F59E32]/[0.08] hover:border-[#F59E32]/70" : "border-[#1F2A3A] bg-[#0D1420] hover:border-[#314158] hover:bg-[#101927]"}`}>
                    <span className={`absolute -left-[17px] top-4 h-2.5 w-2.5 rounded-full border-2 border-[#070B12] sm:-left-[21px] ${upcoming ? "bg-[#F59E32]" : "bg-[#2EC4C7]"}`} />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0"><h3 className="text-sm font-medium leading-5 text-[#D6DEE8] sm:text-[13px]">{story.title}</h3>{story.translationStatus === "translated" && story.originalTitle !== story.title && <p className="mt-0.5 truncate text-[10px] text-[#536177] sm:text-[9px]" title={story.originalTitle}>{story.originalTitle}</p>}<p className="mt-1 text-sm leading-6 text-[#8B98AA] sm:text-[11px] sm:leading-5">{story.summary}</p></div>
                      <div className="flex shrink-0 flex-col items-end gap-1">{upcoming && <span className="rounded-full bg-[#F59E32]/15 px-2 py-0.5 text-[9px] text-[#FFC66D]">未来事件</span>}{story.cacheStatus === "cached" && <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[9px] text-slate-300">缓存回退</span>}<span className="font-mono text-[10px] text-[#F2B84B]">重要度 {story.importance.toFixed(1)}/10</span></div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">{tagList(story).map((tag) => <span key={tag} className="rounded border border-[#2b3a50] bg-[#111b2a] px-1.5 py-0.5 text-[9px] text-[#91A1B7]">{tag}</span>)}</div>
                      <div className="flex flex-wrap items-center justify-end gap-2">{story.sources.slice(0, 2).map((item) => <a key={`${item.name}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="inline-flex min-h-7 items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-2 text-[9px] text-emerald-300 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7]">{item.name}<ExternalLink className="h-2.5 w-2.5" /></a>)}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex min-h-11 items-center justify-between border-t border-[#1F2A3A] px-4 text-[10px] text-[#718096]">
        <span>第 {pagination.page} / {pagination.totalPages} 页 · 共 {pagination.total} 条</span>
        <div className="flex gap-2">
          <button type="button" disabled={loading || pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-8 rounded border border-[#1F2A3A] px-3 disabled:opacity-35">上一页</button>
          <button type="button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="min-h-8 rounded border border-[#1F2A3A] px-3 disabled:opacity-35">下一页</button>
        </div>
      </div>
    </section>
  );
}
