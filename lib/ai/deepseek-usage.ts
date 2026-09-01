export interface DeepSeekUsageRecord {
  context: string;
  model: string;
  requestCount: number;
  promptTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  completionTokens: number;
  totalTokens: number;
}

function tokenCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export function deepSeekUsageRecord(context: string, payload: unknown): DeepSeekUsageRecord {
  const response = payload && typeof payload === "object"
    ? payload as { model?: unknown; usage?: Record<string, unknown> }
    : {};
  const usage = response.usage ?? {};
  return {
    context,
    model: String(response.model ?? "unknown"),
    requestCount: 1,
    promptTokens: tokenCount(usage.prompt_tokens),
    cacheHitTokens: tokenCount(usage.prompt_cache_hit_tokens),
    cacheMissTokens: tokenCount(usage.prompt_cache_miss_tokens),
    completionTokens: tokenCount(usage.completion_tokens),
    totalTokens: tokenCount(usage.total_tokens),
  };
}

export function logDeepSeekUsage(
  context: string,
  payload: unknown,
  logger: (...args: unknown[]) => void = (...args) => console.info(...args),
): void {
  if (!payload || typeof payload !== "object" || !("usage" in payload) || !payload.usage) return;
  logger("[deepseek usage]", deepSeekUsageRecord(context, payload));
}
