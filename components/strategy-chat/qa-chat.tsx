"use client"

import * as React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Send,
  User,
  Bot,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Trash2,
  Download,
  BookOpen,
  BarChart3,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isThinking?: boolean
  feedback?: "positive" | "negative" | null
}

interface QAChatProps {
  className?: string
  initialMessages?: ChatMessage[]
}

// 预定义问题模板
const QUICK_QUESTIONS = [
  "分析当前市场趋势",
  "推荐价值投资标的",
  "MA60破位股票有哪些？",
  "今日热点板块分析",
  "风险评估和仓位建议",
  "技术指标解读",
]

export function QAChat({ className, initialMessages }: QAChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages || [
      {
        id: "welcome",
        role: "assistant",
        content: "您好！我是Alpha-Quant-Copilot AI助手。我可以帮助您分析市场趋势、推荐投资策略、解读技术指标等。请问有什么可以帮您的？",
        timestamp: new Date(),
      },
    ]
  )
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamContentRef = useRef("")
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

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

    // 添加思考中占位消息
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
      // 构建历史消息（最近10条）
      const historyMessages = messages
        .filter((m) => !m.isThinking && m.id !== "welcome")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))
      historyMessages.push({ role: "user", content: currentInput })

      abortControllerRef.current = new AbortController()
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyMessages }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`API错误: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法读取响应流")

      const decoder = new TextDecoder()

      // 节流更新函数（100ms批量更新，防止UI卡顿）
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
              // 节流：100ms最多更新一次
              if (!updateTimerRef.current) {
                updateTimerRef.current = setTimeout(() => {
                  flushUpdate()
                  updateTimerRef.current = null
                }, 100)
              }
            } else if (parsed.error) {
              streamContentRef.current += `\n\n**错误**: ${parsed.error}`
            }
          } catch {
            continue
          }
        }
      }

      // 最终刷新
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current)
        updateTimerRef.current = null
      }
      flushUpdate()
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      const errorMsg = error instanceof Error ? error.message : "未知错误"
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, content: `抱歉，AI服务暂时不可用: ${errorMsg}`, isThinking: false }
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
    setSelectedQuestion(question)
  }

  const handleFeedback = (messageId: string, feedback: "positive" | "negative") => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      )
    )
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "聊天记录已清空。请问有什么可以帮您的？",
        timestamp: new Date(),
      },
    ])
  }

  const handleExportChat = () => {
    const chatData = messages.map(msg => ({
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

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-6 w-6 text-blue-500" />
            <CardTitle className="text-xl font-bold">
              AI量化助手
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
              DeepSeek
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              清空
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        {/* 快速问题 */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-2">快速提问</div>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickQuestion(question)}
                className={cn(
                  "text-xs",
                  selectedQuestion === question && "border-primary"
                )}
              >
                {question}
              </Button>
            ))}
          </div>
        </div>

        {/* 聊天区域 */}
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    "flex-1 space-y-2",
                    message.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-lg px-4 py-3 max-w-[80%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                      message.isThinking && "animate-pulse"
                    )}
                  >
                    {message.isThinking ? (
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>思考中...</span>
                      </div>
                    ) : message.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>

                  {/* 消息操作 */}
                  {!message.isThinking && (
                    <div
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <span className="text-muted-foreground">
                        {message.timestamp.toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {message.role === "assistant" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopy(message.content)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-6 w-6",
                              message.feedback === "positive" && "text-green-500"
                            )}
                            onClick={() => handleFeedback(message.id, "positive")}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-6 w-6",
                              message.feedback === "negative" && "text-red-500"
                            )}
                            onClick={() => handleFeedback(message.id, "negative")}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="pt-4 border-t">
        <div className="flex-1 space-y-3">
          {/* 输入区域 */}
          <div className="relative">
            <Textarea
              placeholder="输入您的问题...（按Enter发送，Shift+Enter换行）"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[80px] pr-12"
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="absolute right-2 bottom-2"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* 底部操作 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="flex items-center">
                <BookOpen className="h-3 w-3 mr-1" />
                <span>支持Markdown</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center">
                <BarChart3 className="h-3 w-3 mr-1" />
                <span>实时数据</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportChat}
              >
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickQuestion("当前市场分析")}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                市场分析
              </Button>
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}