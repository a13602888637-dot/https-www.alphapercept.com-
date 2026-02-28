"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { PROMPT_TEMPLATES, fillPromptTemplate } from "@/lib/ai/prompts";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  stockName: string;
}

export function ChatInput({ onSend, disabled, stockName }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplateClick = (template: string) => {
    const filled = fillPromptTemplate(template, stockName);
    onSend(filled);
  };

  return (
    <div className="space-y-3">
      {/* 预设模板 */}
      <div className="flex flex-wrap gap-2">
        {PROMPT_TEMPLATES.map((template) => (
          <Button
            key={template.label}
            variant="outline"
            size="sm"
            onClick={() => handleTemplateClick(template.prompt)}
            disabled={disabled}
            className="text-xs"
          >
            {template.emoji} {template.label}
          </Button>
        ))}
      </div>

      {/* 输入框 */}
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入您的问题... (Shift+Enter 换行, Enter 发送)"
          disabled={disabled}
          className="min-h-[60px] resize-none"
          rows={2}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          size="icon"
          className="h-[60px] w-[60px]"
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        AI生成内容仅供参考，投资需谨慎
      </p>
    </div>
  );
}
