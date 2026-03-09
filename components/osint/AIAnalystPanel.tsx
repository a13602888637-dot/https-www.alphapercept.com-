"use client";

import { useState, useRef, useCallback } from "react";
import { Brain, Send, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIAnalystPanelProps {
  marketContext?: string;
}

const QUICK_PROMPTS = ["今日市场总结", "风险预警", "仓位建议", "板块轮动分析"];

export function AIAnalystPanel({ marketContext }: AIAnalystPanelProps) {
  const [briefing, setBriefing] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState("");
  const streamContentRef = useRef("");
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const streamAI = useCallback(async (prompt: string) => {
    if (isStreaming) return;
    setIsStreaming(true);
    streamContentRef.current = "";
    setBriefing("");

    const systemPrompt = `你是OSINT态势感知大屏的AI分析师。请基于全球市场数据给出简洁专业的分析。
${marketContext ? `\n当前市场数据:\n${marketContext}` : ""}
回答要求：简洁（200字内）、专业、有数据支撑、明确风险提示。`;

    try {
      abortRef.current = new AbortController();
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`API错误: ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      const flush = () => {
        setBriefing(streamContentRef.current);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.delta) {
              streamContentRef.current += parsed.delta;
              if (!updateTimerRef.current) {
                updateTimerRef.current = setTimeout(() => {
                  flush();
                  updateTimerRef.current = null;
                }, 80);
              }
            }
          } catch { continue; }
        }
      }

      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      flush();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setBriefing("AI分析暂时不可用，请稍后重试。");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, marketContext]);

  const handleQuickPrompt = (prompt: string) => {
    setInput("");
    streamAI(prompt);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const q = input.trim();
    setInput("");
    streamAI(q);
  };

  return (
    <Card className="bg-slate-800/40 border-slate-700/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">AI 分析师</h3>
          {isStreaming && <RefreshCw className="h-3 w-3 text-purple-400 animate-spin" />}
        </div>

        {/* Quick prompts */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => handleQuickPrompt(p)}
              disabled={isStreaming}
              className="text-[11px] px-2 py-1 rounded-full bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-2.5 w-2.5 inline mr-0.5" />
              {p}
            </button>
          ))}
        </div>

        {/* AI Output */}
        <div className="min-h-[80px] max-h-[200px] overflow-y-auto mb-3 rounded-lg bg-slate-900/50 p-3">
          {briefing ? (
            <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {isStreaming ? "AI正在分析..." : "点击上方快捷问题或输入自定义问题获取AI分析"}
            </p>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="输入问题..."
            disabled={isStreaming}
            className="flex-1 text-xs bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="bg-purple-600 hover:bg-purple-700 h-8 px-3"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
