"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
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
  // Shield, // 未使用
  // Zap, // 未使用
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input" // 未使用
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

// AI模拟响应
const generateAIResponse = (question: string): string => {
  const responses = [
    `基于您的问题"${question}"，我分析了当前市场情况：

## 市场分析
- **大盘趋势**: 上证指数在3200点附近震荡，短期支撑位3150，阻力位3250
- **资金流向**: 北向资金净流入15.2亿元，主要流入新能源和芯片板块
- **市场情绪**: 投资者情绪偏谨慎，成交量略有萎缩

## 投资建议
1. **价值投资**: 关注低估值蓝筹股，如银行、保险板块
2. **成长投资**: 新能源、人工智能等科技板块仍有成长空间
3. **风险控制**: 建议仓位控制在60-70%，关注MA60支撑

## 重点关注
- 000001.SZ 平安银行：估值修复机会
- 300750.SZ 宁德时代：新能源龙头
- 600519.SH 贵州茅台：消费升级受益`,

    `关于"${question}"，我的分析如下：

## 技术分析
- **MA60指标**: 当前有3只股票出现MA60破位，需要警惕风险
- **MACD指标**: 多数股票MACD金叉，短期有反弹机会
- **RSI指标**: 部分热门股RSI超买，注意回调风险

## 策略建议
1. **短线交易**: 关注突破关键阻力位的个股
2. **中线布局**: 选择基本面良好、技术面突破的标的
3. **长线投资**: 聚焦行业龙头和成长确定性高的公司

## 风险提示
- 市场波动可能加大，注意仓位管理
- 关注政策面变化对相关行业的影响
- 设置止损位，控制单笔交易风险`,

    `针对"${question}"，我结合五大投资流派给出建议：

## 桥水原则（宏观对冲）
- 经济周期: 复苏中期，建议股票60%/债券30%/商品10%
- 风险平价: 确保各资产风险贡献均衡

## 巴菲特原则（价值投资）
- 安全边际: 寻找内在价值被低估的标的
- 护城河: 关注品牌、成本、网络效应强的公司

## 索罗斯原则（反身性）
- 市场偏见: 识别过度乐观或悲观的情绪
- 趋势跟踪: 使用ADX指标判断趋势强度

## 具体操作
- 买入信号: 安全边际 > 30%，技术面突破
- 卖出信号: 安全边际 < -20%，MA60破位
- 持仓纪律: 严格遵守MA60止损规则`
  ]

  return responses[Math.floor(Math.random() * responses.length)]
}

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

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    // 添加用户消息
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // 模拟AI思考
    const thinkingMessage: ChatMessage = {
      id: `thinking-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isThinking: true,
    }

    setMessages((prev) => [...prev, thinkingMessage])

    // 模拟AI响应延迟
    setTimeout(() => {
      const aiResponse = generateAIResponse(input)

      // 移除思考消息，添加AI响应
      setMessages((prev) => {
        const filtered = prev.filter(msg => !msg.isThinking)
        return [
          ...filtered,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content: aiResponse,
            timestamp: new Date(),
          },
        ]
      })

      setIsLoading(false)
    }, 1500)
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