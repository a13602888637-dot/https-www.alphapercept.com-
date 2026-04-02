"use client"

import * as React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Send,
  Copy,
  RefreshCw,
  Trash2,
  Download,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isThinking?: boolean
  feedback?: "positive" | "negative" | null
}

export type AIModel = "deepseek-chat" | "deepseek-reasoner" | "claude-3-5-sonnet" | "claude-3-haiku"

const MODEL_LABELS: Record<AIModel, string> = {
  "deepseek-chat": "DeepSeek-V3",
  "deepseek-reasoner": "DeepSeek-R1",
  "claude-3-5-sonnet": "Claude 3.5 Sonnet",
  "claude-3-haiku": "Claude 3 Haiku",
}

export interface DashboardContext {
  watchlist?: Array<{
    stockCode: string
    stockName: string
    price: number
    changePercent: number
    buyPrice?: number | null
    stopLossPrice?: number | null
    targetPrice?: number | null
    isSelected?: boolean
  }>
  indices?: Array<{
    label: string
    value: number
    deltaPercent: number
  }>
  newsHeadlines?: string[]
}

interface QAChatProps {
  className?: string
  initialMessages?: ChatMessage[]
  dashboardContext?: DashboardContext
}

// ---------------------------------------------------------------------------
// Quick question chips
// ---------------------------------------------------------------------------

const QUICK_QUESTIONS = [
  "大盘趋势",
  "自选股诊断",
  "风险评估",
  "仓位建议",
  "热点板块",
  "技术面解读",
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QAChat({ className, initialMessages, dashboardContext }: QAChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages || [
      {
        id: "welcome",
        role: "assistant",
        content: "SYSTEM ONLINE. Alpha-Quant-Copilot ready.\nAwaiting query...",
        timestamp: new Date(),
      },
    ]
  )
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<AIModel>("deepseek-chat")
  const [showModelMenu, setShowModelMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamContentRef = useRef("")
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)

  // Close model menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
      }
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // -----------------------------------------------------------------------
  // Build context string for system prompt injection
  // -----------------------------------------------------------------------
  const buildContextPayload = useCallback((): string | undefined => {
    if (!dashboardContext) return undefined

    const parts: string[] = []

    if (dashboardContext.indices && dashboardContext.indices.length > 0) {
      parts.push("## 大盘指数")
      dashboardContext.indices.forEach((idx) => {
        const sign = idx.deltaPercent >= 0 ? "+" : ""
        parts.push(`- ${idx.label}: ${idx.value.toFixed(2)} (${sign}${idx.deltaPercent.toFixed(2)}%)`)
      })
    }

    if (dashboardContext.watchlist && dashboardContext.watchlist.length > 0) {
      parts.push("\n## 用户自选股")
      dashboardContext.watchlist.forEach((s) => {
        const sign = s.changePercent >= 0 ? "+" : ""
        const prefix = s.isSelected ? "**[当前关注]** " : ""
        let line = `- ${prefix}${s.stockCode} ${s.stockName}: ¥${s.price.toFixed(2)} (${sign}${s.changePercent.toFixed(2)}%)`
        if (s.buyPrice) line += ` | 买入价:¥${s.buyPrice.toFixed(2)}`
        if (s.stopLossPrice) line += ` | 止损:¥${s.stopLossPrice.toFixed(2)}`
        if (s.targetPrice) line += ` | 目标:¥${s.targetPrice.toFixed(2)}`
        parts.push(line)
      })
    }

    if (dashboardContext.newsHeadlines && dashboardContext.newsHeadlines.length > 0) {
      parts.push("\n## 最新新闻")
      dashboardContext.newsHeadlines.slice(0, 5).forEach((h, i) => {
        parts.push(`${i + 1}. ${h}`)
      })
    }

    return parts.length > 0 ? parts.join("\n") : undefined
  }, [dashboardContext])

  // -----------------------------------------------------------------------
  // Send message
  // -----------------------------------------------------------------------
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    const currentInput = input
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    streamContentRef.current = ""

    const aiMessageId = `ai-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: aiMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isThinking: true,
      },
    ])

    try {
      const historyMessages = messages
        .filter((m) => !m.isThinking && m.id !== "welcome")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))
      historyMessages.push({ role: "user", content: currentInput })

      const contextPayload = buildContextPayload()

      abortControllerRef.current = new AbortController()
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyMessages,
          model: selectedModel,
          dashboardContext: contextPayload,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("Cannot read response stream")

      const decoder = new TextDecoder()

      const flushUpdate = () => {
        const content = streamContentRef.current
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content, isThinking: false }
              : msg
          )
        )
        scrollToBottom()
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") break

          try {
            const parsed = JSON.parse(data)
            if (parsed.delta) {
              streamContentRef.current += parsed.delta
              if (!updateTimerRef.current) {
                updateTimerRef.current = setTimeout(() => {
                  flushUpdate()
                  updateTimerRef.current = null
                }, 100)
              }
            } else if (parsed.error) {
              streamContentRef.current += `\n\n**Error**: ${parsed.error}`
            }
          } catch {
            continue
          }
        }
      }

      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current)
        updateTimerRef.current = null
      }
      flushUpdate()
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, content: `[SYS_ERR] AI service unavailable: ${errorMsg}`, isThinking: false }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleQuickQuestion = (question: string) => {
    setInput(question)
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "SYSTEM RESET. Awaiting query...",
        timestamp: new Date(),
      },
    ])
  }

  const handleExportChat = () => {
    const chatData = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    }))

    const dataStr = JSON.stringify(chatData, null, 2)
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`
    const link = document.createElement("a")
    link.setAttribute("href", dataUri)
    link.setAttribute("download", `chat-${new Date().toISOString().split("T")[0]}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className={cn("flex flex-col h-full bg-[#050505]", className)}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-[#1a1a2e]">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-[10px] font-mono font-semibold text-cyan-500/90 uppercase tracking-widest">
            AI Command
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Model selector */}
          <div className="relative" ref={modelMenuRef}>
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center gap-1 text-[10px] font-mono text-[#4a5568] hover:text-cyan-400 px-1.5 py-0.5 rounded border border-[#1a1a2e] hover:border-cyan-900/50 transition-colors"
            >
              {MODEL_LABELS[selectedModel]}
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {showModelMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#0a0a0f] border border-[#1a1a2e] rounded shadow-xl min-w-[160px]">
                {(Object.keys(MODEL_LABELS) as AIModel[]).map((model) => (
                  <button
                    key={model}
                    onClick={() => {
                      setSelectedModel(model)
                      setShowModelMenu(false)
                    }}
                    className={cn(
                      "w-full text-left text-[10px] font-mono px-3 py-1.5 hover:bg-[#111125] transition-colors",
                      selectedModel === model
                        ? "text-cyan-400"
                        : "text-[#4a5568]"
                    )}
                  >
                    {MODEL_LABELS[model]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleExportChat}
            className="text-[#2a3040] hover:text-[#4a5568] p-1 transition-colors"
            title="Export"
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            onClick={handleClearChat}
            className="text-[#2a3040] hover:text-red-500/60 p-1 transition-colors"
            title="Clear"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── Quick question chips ────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-[#0d0d18] overflow-x-auto scrollbar-none">
        {QUICK_QUESTIONS.map((q, i) => (
          <button
            key={i}
            onClick={() => handleQuickQuestion(q)}
            className="flex-shrink-0 text-[9px] font-mono text-[#3a4560] hover:text-cyan-400 px-2 py-0.5 rounded border border-[#151525] hover:border-cyan-900/40 transition-colors whitespace-nowrap"
          >
            {q}
          </button>
        ))}
      </div>

      {/* ── Chat log ────────────────────────────────────────────────── */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-[#1a1a2e] scrollbar-track-transparent"
      >
        {messages.map((message) => (
          <div key={message.id} className="group">
            {message.role === "user" ? (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] font-mono text-emerald-600 flex-shrink-0 select-none leading-[18px]">
                  {">"} USER:
                </span>
                <span className="text-[11px] font-mono text-white/90 leading-[18px] break-all">
                  {message.content}
                </span>
              </div>
            ) : message.isThinking ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-cyan-700 flex-shrink-0 select-none">
                  [SYS_AI]:
                </span>
                <RefreshCw className="h-2.5 w-2.5 text-cyan-700 animate-spin" />
                <span className="text-[10px] font-mono text-cyan-700 animate-pulse">
                  processing...
                </span>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-start gap-1.5">
                  <span className="text-[10px] font-mono text-cyan-700 flex-shrink-0 select-none leading-[18px]">
                    [SYS_AI]:
                  </span>
                  <div className="text-[11px] font-mono text-white/85 leading-[18px] prose-terminal max-w-full overflow-hidden">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="text-cyan-400 font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="text-amber-400/80 not-italic">{children}</em>,
                        li: ({ children }) => <li className="ml-3 list-disc text-white/80">{children}</li>,
                        code: ({ children }) => (
                          <code className="bg-[#111125] text-cyan-300 px-1 rounded text-[10px]">{children}</code>
                        ),
                        h1: ({ children }) => <div className="text-cyan-400 font-bold text-[12px] mt-2 mb-1">{children}</div>,
                        h2: ({ children }) => <div className="text-cyan-400/80 font-bold text-[11px] mt-1.5 mb-0.5">{children}</div>,
                        h3: ({ children }) => <div className="text-cyan-400/60 font-semibold text-[11px] mt-1 mb-0.5">{children}</div>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
                {/* Hover actions */}
                <div className="absolute -right-1 top-0 hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={() => handleCopy(message.content)}
                    className="text-[#2a3040] hover:text-cyan-500 p-0.5 transition-colors"
                    title="Copy"
                  >
                    <Copy className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[#1a1a2e] px-3 py-2">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              placeholder="Enter query..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
              className="w-full bg-transparent border border-[#1a1a2e] focus:border-cyan-900/50 rounded px-2.5 py-1.5 text-[11px] font-mono text-white/90 placeholder:text-[#2a3040] focus:outline-none resize-none leading-[18px]"
              style={{ minHeight: "32px", maxHeight: "80px" }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 80) + "px"
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded border border-[#1a1a2e] text-[#2a3040] hover:text-cyan-400 hover:border-cyan-900/50 disabled:opacity-30 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Context indicator */}
        {dashboardContext && (
          <div className="mt-1 flex items-center gap-1">
            <div className="h-1 w-1 rounded-full bg-emerald-600" />
            <span className="text-[8px] font-mono text-[#2a3040] uppercase tracking-wider">
              ctx: live data linked
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
