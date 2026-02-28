"use client";

import { useEffect, useRef } from "react";
import { StreamingMessage, TypingIndicator } from "./StreamingMessage";
import { ChatMessage } from "@/lib/ai/chat-history";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare } from "lucide-react";

interface MessageListProps {
  messages: ChatMessage[];
  isTyping?: boolean;
  onClear?: () => void;
}

export function MessageList({ messages, isTyping, onClear }: MessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">开始对话</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          选择下方的预设问题，或输入您自己的问题，AI将基于当前股票数据为您提供专业分析
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 清除按钮 */}
      <div className="flex justify-end mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={messages.length === 0}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          清除对话
        </Button>
      </div>

      {/* 消息列表 */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <StreamingMessage key={message.id} message={message} />
          ))}
          <TypingIndicator show={isTyping || false} />
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
