/**
 * AI对话流式API
 * POST /api/ai/stream
 */

import { NextRequest } from 'next/server';
import { callDeepSeekStream, createSSEEncoder, DeepSeekMessage } from '@/lib/ai/deepseek-stream';
import { buildSystemPrompt } from '@/lib/ai/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildGeneralSystemPrompt(): string {
  return `你是Alpha-Quant-Copilot AI量化投资助手，精通A股市场技术分析、基本面分析和市场情绪分析。

你的核心能力：
1. 宏观对冲分析：捕捉经济周期与市场预期的错配
2. 价值投资评估：安全边际优先，识别价值陷阱与泡沫
3. 情绪感知：感知市场情绪周期，把握资金流向
4. 技术指标解读：MA60/MD60、MACD、RSI、KDJ等指标分析
5. 事件驱动分析：突发事件的产业链推演和预期差计算

回答规则：
- 使用简洁清晰的中文
- 提供具体的数据和分析依据
- 明确指出风险点
- 给出可操作的建议
- 严格遵守MA60破位止损纪律
- 所有建议仅供参考，投资需谨慎`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, stockCode, stockName, context } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 构建完整的消息列表，包含系统提示词
    const systemPrompt = stockCode && stockName
      ? buildSystemPrompt(stockCode, stockName, context)
      : buildGeneralSystemPrompt();
    const fullMessages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    // 调用DeepSeek API
    const deepseekResponse = await callDeepSeekStream({
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    // 创建SSE流
    const encoder = createSSEEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = deepseekResponse.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encodeError('Failed to read response'));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();

                // 检查是否是结束标记
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encodeDone());
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;

                  if (content) {
                    // 转发到前端
                    controller.enqueue(encoder.encode({ delta: content }));
                  }
                } catch (e) {
                  // 忽略JSON解析错误
                  continue;
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encodeError(
            error instanceof Error ? error.message : 'Unknown error'
          ));
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
