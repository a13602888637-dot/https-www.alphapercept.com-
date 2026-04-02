/**
 * AI对话流式API — 支持多模型 + 全局态势上下文注入
 * POST /api/ai/stream
 */

import { NextRequest } from 'next/server';
import { callDeepSeekStream, createSSEEncoder, DeepSeekMessage } from '@/lib/ai/deepseek-stream';
import { buildSystemPrompt } from '@/lib/ai/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupportedModel = 'deepseek-chat' | 'deepseek-reasoner' | 'claude-3-5-sonnet' | 'claude-3-haiku' | 'claude-opus';

interface ModelConfig {
  provider: 'deepseek' | 'anthropic';
  modelId: string;
  apiUrlEnv: string;
  apiKeyEnv: string;
}

const MODEL_CONFIGS: Record<SupportedModel, ModelConfig> = {
  'deepseek-chat': {
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    apiUrlEnv: 'https://api.deepseek.com/v1/chat/completions',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
  'deepseek-reasoner': {
    provider: 'deepseek',
    modelId: 'deepseek-reasoner',
    apiUrlEnv: 'https://api.deepseek.com/v1/chat/completions',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
  'claude-3-5-sonnet': {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    apiUrlEnv: 'https://api.anthropic.com/v1/messages',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    apiUrlEnv: 'https://api.anthropic.com/v1/messages',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
  'claude-opus': {
    provider: 'anthropic',
    modelId: 'claude-opus-4-20250514',
    apiUrlEnv: 'https://api.anthropic.com/v1/messages',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
};

function buildGeneralSystemPrompt(dashboardContext?: string): string {
  let prompt = `你是Alpha-Quant-Copilot AI量化投资助手，精通A股市场技术分析、基本面分析和市场情绪分析。

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

  if (dashboardContext) {
    prompt += `\n\n--- 以下是用户大屏上的实时数据快照，你必须参考这些数据来回答问题 ---\n${dashboardContext}`;
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Anthropic (Claude) streaming
// ---------------------------------------------------------------------------
async function callAnthropicStream(
  config: ModelConfig,
  messages: DeepSeekMessage[],
  temperature: number,
  maxTokens: number,
): Promise<Response> {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${config.apiKeyEnv} is not configured. Please add it to environment variables.`);
  }

  // Separate system from conversation messages
  const systemContent = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const conversationMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  const response = await fetch(config.apiUrlEnv, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.modelId,
      max_tokens: maxTokens,
      temperature,
      system: systemContent || undefined,
      messages: conversationMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as Record<string, Record<string, string>>)?.error?.message ||
      `Anthropic API error: ${response.statusText}`
    );
  }

  return response;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, stockCode, stockName, context, model, dashboardContext } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const selectedModel: SupportedModel = (model && model in MODEL_CONFIGS)
      ? model
      : 'deepseek-chat';
    const config = MODEL_CONFIGS[selectedModel];

    // Build system prompt with optional context
    const systemPrompt = stockCode && stockName
      ? buildSystemPrompt(stockCode, stockName, context)
      : buildGeneralSystemPrompt(dashboardContext);

    const fullMessages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    const encoder = createSSEEncoder();

    if (config.provider === 'anthropic') {
      // Claude streaming path
      const anthropicResponse = await callAnthropicStream(config, fullMessages, 0.7, 2000);

      const stream = new ReadableStream({
        async start(controller) {
          const reader = anthropicResponse.body?.getReader();
          if (!reader) {
            controller.enqueue(encoder.encodeError('Failed to read Anthropic response'));
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
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (!data || data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);

                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    controller.enqueue(encoder.encode({ delta: parsed.delta.text }));
                  } else if (parsed.type === 'message_stop') {
                    break;
                  }
                } catch {
                  continue;
                }
              }
            }
          } catch (error) {
            console.error('Anthropic stream error:', error);
            controller.enqueue(encoder.encodeError(
              error instanceof Error ? error.message : 'Unknown error'
            ));
          } finally {
            reader.releaseLock();
            controller.enqueue(encoder.encodeDone());
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
    }

    // DeepSeek streaming path (default)
    const deepseekResponse = await callDeepSeekStream({
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 2000,
      model: config.modelId,
    });

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

                if (data === '[DONE]') {
                  controller.enqueue(encoder.encodeDone());
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;

                  if (content) {
                    controller.enqueue(encoder.encode({ delta: content }));
                  }
                } catch {
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
