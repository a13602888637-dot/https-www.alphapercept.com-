"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Save, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AIDiagnosisProps {
  portfolioContext: string;
}

export function AIDiagnosis({ portfolioContext }: AIDiagnosisProps) {
  const { getToken, isSignedIn } = useAuth();

  const [result, setResult] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ------------------------------------------------------------------
  // Stream AI diagnosis
  // ------------------------------------------------------------------
  const runDiagnosis = useCallback(async () => {
    if (streaming) return;

    if (!isSignedIn) {
      toast.error("请先登录后使用 AI 诊断");
      return;
    }

    setResult("");
    setStreaming(true);
    setSaved(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getToken();
      if (!token) {
        toast.error("获取认证令牌失败，请刷新页面重试");
        setStreaming(false);
        return;
      }

      const prompt = `请基于以下持仓数据进行诊断分析。给出：
1. 整体风险评估（仓位结构、集中度）
2. 个股诊断（每只持仓的关键问题）
3. 操作建议（优先级排序，包含具体价格参考）
4. 下一步行动清单（明确、可执行）

持仓数据：
${portfolioContext}`;

      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: "deepseek-chat",
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as Record<string, string>).error || `API 错误 (${res.status})`
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              if (parsed.delta) {
                fullContent += parsed.delta;
                setResult(fullContent);
              }
            } catch {
              // ignore parse errors on partial chunks
            }
          } else if (line.startsWith("event: done")) {
            break;
          } else if (line.startsWith("event: error")) {
            const errLine = lines.find((l) => l.startsWith("data: "));
            if (errLine) {
              const parsed = JSON.parse(errLine.slice(6));
              throw new Error(parsed.error || "流式传输错误");
            }
          }
        }
      }

      if (!fullContent) {
        throw new Error("AI 未返回任何内容");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // user cancelled
        return;
      }
      console.error("[AIDiagnosis] Error:", err);
      const msg = err instanceof Error ? err.message : "分析失败";
      toast.error(`AI 诊断失败: ${msg}`);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, isSignedIn, getToken, portfolioContext]);

  // ------------------------------------------------------------------
  // Save to personal notes
  // ------------------------------------------------------------------
  const saveNote = useCallback(async () => {
    if (!result || saving) return;

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("认证失败，请刷新重试");
        return;
      }

      const res = await fetch("/api/personal-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "review",
          title: `AI 持仓诊断 ${new Date().toLocaleDateString("zh-CN")}`,
          content: result,
        }),
      });

      if (!res.ok) {
        throw new Error("保存失败");
      }

      setSaved(true);
      toast.success("分析报告已保存到个人笔记");
    } catch (err) {
      console.error("[AIDiagnosis] Save error:", err);
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }, [result, saving, getToken]);

  // ------------------------------------------------------------------
  // Cancel streaming
  // ------------------------------------------------------------------
  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Card className="bg-[#0d1117] border-[#1a2035] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-400" />
            <CardTitle className="text-base font-semibold text-white">
              AI 持仓诊断
            </CardTitle>
            <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30 text-[10px] px-1.5">
              Claude Opus
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Save button — only after streaming completes */}
            {result && !streaming && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
                onClick={saveNote}
                disabled={saving || saved}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span className="ml-1 text-xs">
                  {saved ? "已保存" : "保存分析"}
                </span>
              </Button>
            )}

            {/* Analyse / Stop button */}
            {streaming ? (
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={cancelStream}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="ml-1 text-xs">停止</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
                onClick={runDiagnosis}
                disabled={!portfolioContext}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="ml-1 text-xs">
                  {result ? "重新分析" : "分析持仓"}
                </span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Streaming indicator */}
        {streaming && !result && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-sm text-violet-400/80">
              Claude Opus 分析中...
            </span>
          </div>
        )}

        {/* Result display */}
        {result && (
          <div className="relative">
            {/* Streaming cursor */}
            {streaming && (
              <div className="absolute top-2 right-2">
                <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse rounded-sm" />
              </div>
            )}

            <div
              className="prose prose-invert prose-sm max-w-none
                text-gray-300 leading-relaxed
                [&_h1]:text-white [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                [&_h2]:text-white [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5
                [&_h3]:text-gray-200 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                [&_strong]:text-white
                [&_ul]:pl-4 [&_ul]:my-1
                [&_ol]:pl-4 [&_ol]:my-1
                [&_li]:my-0.5 [&_li]:text-gray-300
                [&_code]:bg-[#1a2035] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-cyan-300 [&_code]:text-xs
                [&_blockquote]:border-l-2 [&_blockquote]:border-violet-500/50 [&_blockquote]:pl-3 [&_blockquote]:text-gray-400 [&_blockquote]:italic
                [&_hr]:border-[#1a2035] [&_hr]:my-3
                overflow-y-auto max-h-[480px] scrollbar-thin scrollbar-thumb-[#1a2035] scrollbar-track-transparent
              "
              style={{ whiteSpace: "pre-wrap" }}
            >
              {result}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !streaming && (
          <div className="flex flex-col items-center py-8 text-center">
            <Brain className="h-10 w-10 text-gray-700 mb-3" />
            <p className="text-sm text-gray-500">
              基于持仓数据，AI 将分析风险暴露、仓位结构并给出操作建议
            </p>
            <p className="text-xs text-gray-600 mt-1">
              点击「分析持仓」开始诊断
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
