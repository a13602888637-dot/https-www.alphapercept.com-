"use client";

import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OsintStory, StorySnapshot } from "@/lib/osint/contracts";

const TOPICS = ["全部", "地缘", "宏观", "能源", "科技"] as const;

function timeLabel(publishedAt: string): { time: string; age: string } {
  const date = new Date(publishedAt);
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

  const loadStories = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const topicParam = topic === "全部" ? "" : `&topic=${encodeURIComponent(topic)}`;
      const response = await fetch(`/api/osint/v1/stories?page=${page}&pageSize=20${topicParam}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSnapshot((await response.json()) as StorySnapshot);
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
      if (source !== "全部" && !story.sources.some((item) => item.name === source)) return false;
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
            <h2 className="text-sm font-semibold tracking-wide text-[#D6DEE8]">财经热点 · 过去3天</h2>
            <p className="mt-0.5 text-[11px] text-[#718096]">{pagination.total} 条去重事件 · 服务端分类后分页 · 摘要与标签可供 Agent 分析</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="新闻来源" value={source} onChange={(event) => setSource(event.target.value)} className="h-9 rounded-md border border-[#1F2A3A] bg-[#0D1420] px-2 text-[11px] text-[#D6DEE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7]">
              {sourceNames.map((name) => <option key={name} value={name}>{name === "全部" ? "来源：全部" : name}</option>)}
            </select>
            <label className="flex h-9 min-w-44 items-center gap-2 rounded-md border border-[#1F2A3A] bg-[#0D1420] px-3 focus-within:ring-2 focus-within:ring-[#2EC4C7]">
              <Search className="h-3.5 w-3.5 text-[#718096]" /><span className="sr-only">搜索热点</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索事件、资产、标签" className="min-w-0 flex-1 bg-transparent text-[11px] text-[#D6DEE8] outline-none placeholder:text-[#4b586b]" />
            </label>
            <button type="button" onClick={() => void loadStories()} disabled={loading} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#1F2A3A] bg-[#0D1420] px-3 text-[10px] text-[#718096] hover:text-[#D6DEE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2EC4C7] disabled:opacity-50">
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

      <div className="mx-4 mt-3 flex items-center justify-between gap-4 rounded-md border border-[#F2B84B]/35 bg-[#F2B84B]/[0.07] px-4 py-3">
        <p className="text-xs font-medium text-[#F6C968]">今日建议：{snapshot?.advice.text || "等待足够数据后再判断。"}</p>
        <span className="shrink-0 font-mono text-[10px] text-[#9f8656]">DeepSeek · {snapshot?.advice.generatedAt ? new Date(snapshot.advice.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }) : "规则摘要"}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {loading && !snapshot ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-md border border-[#1F2A3A] bg-[#0D1420]" />)}</div>
        ) : visibleStories.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-xs text-[#718096]"><span>过去3天暂无“{topic}”分类新闻</span><span className="text-[10px] text-[#4b586b]">可切换分类、来源或清空搜索</span></div>
        ) : (
          <div className="relative space-y-2 before:absolute before:bottom-0 before:left-[61px] before:top-0 before:w-px before:bg-[#263348]">
            {visibleStories.map((story) => {
              const published = timeLabel(story.publishedAt);
              return (
                <article key={story.id} className="relative grid grid-cols-[52px_1fr] gap-4">
                  <div className="pt-3 text-right font-mono"><div className="text-[11px] text-[#AAB5C4]">{published.time}</div><div className="text-[9px] text-[#536177]">{published.age}</div></div>
                  <div className="relative rounded-md border border-[#1F2A3A] bg-[#0D1420] px-4 py-3 transition-colors hover:border-[#314158] hover:bg-[#101927]">
                    <span className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full border-2 border-[#070B12] bg-[#2EC4C7]" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0"><h3 className="text-[13px] font-medium leading-5 text-[#D6DEE8]">{story.title}</h3>{story.translationStatus === "translated" && story.originalTitle !== story.title && <p className="mt-0.5 truncate text-[9px] text-[#536177]" title={story.originalTitle}>{story.originalTitle}</p>}<p className="mt-1 text-[11px] leading-5 text-[#8B98AA]">{story.summary}</p></div>
                      <span className="shrink-0 font-mono text-[10px] text-[#F2B84B]">重要度 {story.importance.toFixed(1)}/10</span>
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
