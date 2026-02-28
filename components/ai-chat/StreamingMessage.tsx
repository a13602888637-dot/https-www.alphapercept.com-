"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Bot, User, Loader2 } from "lucide-react";
import { ChatMessage } from "@/lib/ai/chat-history";

interface StreamingMessageProps {
  message: ChatMessage;
}

export function StreamingMessage({ message }: StreamingMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.streaming;
  const messageRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [message.content]);

  return (
    <div
      ref={messageRef}
      className={cn(
        "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* 头像 */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* 消息内容 */}
      <div
        className={cn(
          "flex-1 max-w-[80%] rounded-lg px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block ml-1 w-2 h-4 bg-current animate-pulse" />
          )}
        </div>

        {/* 时间戳 */}
        <div
          className={cn(
            "text-xs mt-2 opacity-70",
            isUser ? "text-right" : "text-left"
          )}
        >
          {message.timestamp.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}

interface TypingIndicatorProps {
  show: boolean;
}

export function TypingIndicator({ show }: TypingIndicatorProps) {
  if (!show) return null;

  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 px-4 py-3 bg-muted rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground ml-2">AI正在思考...</span>
      </div>
    </div>
  );
}
