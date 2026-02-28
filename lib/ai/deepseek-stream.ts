/**
 * DeepSeek API 流式调用封装
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekStreamOptions {
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * 调用DeepSeek流式API
 */
export async function callDeepSeekStream(options: DeepSeekStreamOptions): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: options.messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `DeepSeek API error: ${response.statusText}`);
  }

  return response;
}

/**
 * 解析SSE流
 */
export async function parseDeepSeekStream(
  response: Response,
  onChunk: (chunk: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let fullText = '';

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
            break;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch (e) {
            // 忽略JSON解析错误
            continue;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}

/**
 * 创建SSE响应编码器
 */
export function createSSEEncoder() {
  const encoder = new TextEncoder();

  return {
    encode: (data: any) => {
      return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
    },
    encodeDone: () => {
      return encoder.encode('event: done\ndata: {}\n\n');
    },
    encodeError: (error: string) => {
      return encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
    },
  };
}
