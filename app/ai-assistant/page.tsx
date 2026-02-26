"use client"

import { useState, useRef, useEffect } from "react"
import { PageLayout } from "@/components/layout/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MessageSquare,
  Brain,
  Zap,
  TrendingUp,
  Shield,
  Target,
  Clock,
  Send,
  User,
  Bot,
  Star,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  HelpCircle
} from "lucide-react"

// 模拟聊天消息
interface ChatMessage {
  id: string
  content: string
  sender: "user" | "assistant"
  timestamp: Date
  type?: "question" | "analysis" | "recommendation" | "warning"
}

// 模拟预设问题
const presetQuestions = [
  {
    id: "1",
    question: "当前市场有哪些高风险陷阱需要警惕？",
    category: "风险预警",
  },
  {
    id: "2",
    question: "推荐一个适合稳健型投资者的策略",
    category: "策略推荐",
  },
  {
    id: "3",
    question: "分析一下贵州茅台(600519)的投资价值",
    category: "个股分析",
  },
  {
    id: "4",
    question: "明天大盘走势如何预测？",
    category: "趋势预测",
  },
  {
    id: "5",
    question: "如何设置合理的止损位？",
    category: "投资教育",
  },
  {
    id: "6",
    question: "当前市场情绪处于什么周期？",
    category: "情绪分析",
  },
]

// 模拟AI能力说明
const aiCapabilities = [
  {
    title: "实时市场分析",
    description: "24/7监控市场动态，识别投资机会与风险",
    icon: BarChart3,
    color: "text-blue-500",
  },
  {
    title: "智能策略推荐",
    description: "基于五大投资流派融合，提供个性化投资策略",
    icon: Brain,
    color: "text-purple-500",
  },
  {
    title: "风险预警系统",
    description: "实时计算陷阱概率，提前预警高风险信号",
    icon: Shield,
    color: "text-red-500",
  },
  {
    title: "趋势预测",
    description: "基于历史数据和市场情绪预测短期走势",
    icon: TrendingUp,
    color: "text-green-500",
  },
]

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      content: "您好！我是Alpha-Quant AI助手，基于五大投资流派融合的智能分析系统。我可以为您提供市场分析、策略推荐、风险预警等服务。请问有什么可以帮助您的？",
      sender: "assistant",
      timestamp: new Date(),
      type: "analysis",
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("chat")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    // 模拟AI回复延迟
    setTimeout(() => {
      const aiResponses = [
        {
          content: "根据我的分析，当前市场存在几个需要关注的风险点：1）部分热门板块估值偏高，存在回调风险；2）政策变化可能影响相关行业；3）国际局势不确定性增加。建议保持谨慎，重点关注价值防守策略。",
          type: "warning" as const,
        },
        {
          content: "对于稳健型投资者，我推荐价值防守策略。该策略筛选财务健康、估值合理的优质公司，远离市场泡沫。具体建议：关注ROE > 12%、毛利率 > 25%、负债率 < 60%的公司，如贵州茅台、中国平安等。",
          type: "recommendation" as const,
        },
        {
          content: "贵州茅台(600519)作为高端白酒龙头，具有强大的品牌护城河和定价权。当前估值处于历史中高位，但考虑到其稳定的盈利增长和稀缺性，长期投资价值依然存在。建议在合理估值区间分批建仓。",
          type: "analysis" as const,
        },
        {
          content: "基于技术分析和市场情绪，预计明天大盘可能呈现震荡上行态势。关键支撑位在3000点附近，阻力位在3050点。建议关注成交量变化和北向资金流向。",
          type: "analysis" as const,
        },
      ]

      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)]

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: randomResponse.content,
        sender: "assistant",
        timestamp: new Date(),
        type: randomResponse.type,
      }
      setMessages(prev => [...prev, aiMessage])
      setIsLoading(false)
    }, 1500)
  }

  const handlePresetQuestion = (question: string) => {
    setInputValue(question)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: "1",
        content: "聊天记录已清空。请问有什么可以帮助您的？",
        sender: "assistant",
        timestamp: new Date(),
        type: "analysis",
      },
    ])
  }

  return (
    <PageLayout title="AI投资助手">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center">
          <MessageSquare className="h-8 w-8 mr-3 text-blue-500" />
          AI智能助手
        </h1>
        <p className="text-muted-foreground mt-2">
          基于五大投资流派融合的智能对话系统，为您提供专业的投资分析和建议
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：AI能力介绍 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="h-5 w-5 mr-2" />
                AI能力说明
              </CardTitle>
              <CardDescription>我可以为您提供以下服务</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiCapabilities.map((capability) => (
                  <div key={capability.title} className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg bg-gray-100 ${capability.color}`}>
                      <capability.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">{capability.title}</h4>
                      <p className="text-sm text-muted-foreground">{capability.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3">投资流派融合</h4>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    桥水宏观对冲
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    巴菲特价值投资
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    索罗斯反身性
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    佩洛西政策前瞻
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    中国游资情绪接力
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 预设问题 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                快速提问
              </CardTitle>
              <CardDescription>点击以下问题快速开始对话</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {presetQuestions.map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-3 text-left"
                    onClick={() => handlePresetQuestion(item.question)}
                  >
                    <div>
                      <div className="font-medium">{item.question}</div>
                      <div className="flex items-center mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {item.category}
                        </Badge>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 中间：聊天界面 */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    智能对话
                  </CardTitle>
                  <CardDescription>
                    基于DeepSeek模型的实时对话分析
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={clearChat}>
                  清空对话
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="chat">对话</TabsTrigger>
                  <TabsTrigger value="history">历史记录</TabsTrigger>
                  <TabsTrigger value="settings">设置</TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="h-[calc(100%-60px)]">
                  {/* 聊天消息区域 */}
                  <div className="h-[400px] overflow-y-auto pr-2 mb-4">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-4 ${
                              message.sender === "user"
                                ? "bg-blue-500 text-white"
                                : message.type === "warning"
                                ? "bg-red-50 border border-red-200"
                                : message.type === "recommendation"
                                ? "bg-green-50 border border-green-200"
                                : "bg-gray-100"
                            }`}
                          >
                            <div className="flex items-center mb-2">
                              {message.sender === "user" ? (
                                <User className="h-4 w-4 mr-2" />
                              ) : (
                                <Bot className="h-4 w-4 mr-2" />
                              )}
                              <span className="text-sm font-medium">
                                {message.sender === "user" ? "您" : "AI助手"}
                              </span>
                              <span className="text-xs text-gray-500 ml-auto">
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                            {message.type && message.sender === "assistant" && (
                              <div className="mt-2">
                                <Badge
                                  variant="outline"
                                  className={
                                    message.type === "warning"
                                      ? "border-red-200 text-red-700"
                                      : message.type === "recommendation"
                                      ? "border-green-200 text-green-700"
                                      : "border-blue-200 text-blue-700"
                                  }
                                >
                                  {message.type === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
                                  {message.type === "recommendation" && <Star className="h-3 w-3 mr-1" />}
                                  {message.type === "analysis" && <BarChart3 className="h-3 w-3 mr-1" />}
                                  {message.type === "question" && <HelpCircle className="h-3 w-3 mr-1" />}
                                  {message.type === "warning" && "风险预警"}
                                  {message.type === "recommendation" && "策略推荐"}
                                  {message.type === "analysis" && "市场分析"}
                                  {message.type === "question" && "问题解答"}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 rounded-lg p-4 max-w-[80%]">
                            <div className="flex items-center">
                              <Bot className="h-4 w-4 mr-2" />
                              <span className="text-sm font-medium">AI助手</span>
                            </div>
                            <div className="flex items-center mt-2">
                              <div className="flex space-x-1">
                                <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" />
                                <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                                <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                              </div>
                              <span className="text-sm text-gray-500 ml-2">正在思考...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* 输入区域 */}
                  <div className="border-t pt-4">
                    <div className="flex space-x-2">
                      <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="输入您的问题，例如：分析一下当前市场风险"
                        className="flex-1"
                      />
                      <Button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()}>
                        <Send className="h-4 w-4 mr-2" />
                        发送
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      提示：您可以询问市场分析、策略推荐、风险预警、个股分析等问题
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history">
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">历史记录功能开发中</h3>
                    <p>我们将很快推出对话历史记录功能，方便您回顾之前的分析和建议。</p>
                  </div>
                </TabsContent>

                <TabsContent value="settings">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">AI模型设置</h4>
                      <div className="text-sm text-muted-foreground">
                        当前使用模型: DeepSeek最新版本
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">回答风格</h4>
                      <div className="text-sm text-muted-foreground">
                        专业严谨，注重风险提示
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">数据更新频率</h4>
                      <div className="text-sm text-muted-foreground">
                        实时更新，确保信息时效性
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 使用提示 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <HelpCircle className="h-5 w-5 mr-2" />
            使用提示
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">最佳提问方式</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 具体明确：提供股票代码或具体问题</li>
                <li>• 上下文完整：说明您的投资目标和风险偏好</li>
                <li>• 聚焦重点：一次询问一个核心问题</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">注意事项</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• AI分析仅供参考，不构成投资建议</li>
                <li>• 投资有风险，决策需谨慎</li>
                <li>• 严格遵守MA60/MD60交易纪律</li>
                <li>• 定期评估策略表现，及时调整</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </PageLayout>
  )
}