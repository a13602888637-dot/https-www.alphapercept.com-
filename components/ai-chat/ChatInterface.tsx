"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { ChatMessage, getChatHistory, saveChatHistory, generateMessageId, clearChatHistory } from "@/lib/ai/chat-history";
import { toast } from "sonner";

interface ChatInterfaceProps {
  stockCode: string;
  stockName: string;
  initialContext?: {
    currentPrice?: number;
    changePercent?: number;
    ma60?: number;
    rsi?: number;
    macd?: any;
  };
}

export function ChatInterface({ stockCode, stockName, initialContext }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 加载历史对话
  useEffect(() => {
    const history = getChatHistory(stockCode);
    setMessages(history);
  }, [stockCode]);

  // 保存对话历史
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(stockCode, messages);
    }
  }, [messages, stockCode]);

  // 发送消息并获取AI响应
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content,
        timestamp: new Date(),
        stockCode,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // 创建AI消息占位符
      const assistantMessageId = generateMessageId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        streaming: true,
        stockCode,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // 调用流式API
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              ...messages.filter(m => m.role !== 'system').map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
              { role: "user", content }
            ],
            stockCode,
            stockName,
            context: initialContext,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "API请求失败");
        }

        // 读取SSE流
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法读取响应流");
        }

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

                  // 更新消息内容
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: fullContent }
                        : msg
                    )
                  );
                }
              } catch (e) {
                // 忽略解析错误
                continue;
              }
            } else if (line.startsWith("event: done")) {
              // 流结束
              break;
            } else if (line.startsWith("event: error")) {
              const data = line.split("data: ")[1];
              if (data) {
                const parsed = JSON.parse(data);
                throw new Error(parsed.error || "未知错误");
              }
            }
          }
        }

        // 标记流式传输完成
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, streaming: false, timestamp: new Date() }
              : msg
          )
        );

        if (!fullContent) {
          throw new Error("AI未返回任何内容");
        }
      } catch (error) {
        console.error("Chat error:", error);

        // 移除失败的AI消息
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));

        // 显示错误提示
        const errorMessage = error instanceof Error ? error.message : "发送失败";
        toast.error(`AI对话失败: ${errorMessage}`);

        // 添加错误消息
        const errorMsg: ChatMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: `抱歉，发生了错误：${errorMessage}\n\n请检查：\n1. DeepSeek API密钥是否配置正确\n2. 网络连接是否正常\n3. API服务是否可用`,
          timestamp: new Date(),
          stockCode,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [stockCode, stockName, initialContext, messages, isLoading]
  );

  // 清除对话历史
  const handleClearHistory = useCallback(() => {
    setMessages([]);
    clearChatHistory(stockCode);
    toast.success("对话历史已清除");
  }, [stockCode]);

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>💬 AI投资助手</CardTitle>
        <CardDescription>
          为 {stockName} ({stockCode}) 提供专业投资分析
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 mb-4">
          <MessageList
            messages={messages}
            isTyping={isLoading}
            onClear={handleClearHistory}
          />
        </div>
        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading}
          stockName={stockName}
        />
      </CardContent>
    </Card>
  );
}
