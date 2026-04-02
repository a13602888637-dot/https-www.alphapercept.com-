/**
 * AI Strategy Generation API
 * POST /api/ai/generate-strategy
 *
 * Accepts pre-processed portfolio context from frontend, calls AI (DeepSeek or
 * Claude) to produce a structured monthly trading strategy, validates the JSON
 * output, and returns it for user preview. Does NOT persist to DB — the
 * frontend handles saving after user review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupportedModel = 'deepseek-chat' | 'claude-opus';

interface AccountContext {
  total: number;
  cash: number;
  reverseRepo: number;
  debtStatus: boolean;
}

interface PositionContext {
  name: string;
  code: string;
  shares: number;
  cost: number;
  current: number;
  pnlPct: number;
  weightPct: number;
}

interface WatchlistContext {
  name: string;
  code: string;
  current: number;
}

interface ScopeConfig {
  modules: string[];       // subset of ["calendarEvents", "strategies", "rules"]
  stocks: 'all' | string[]; // "all" or array of stock codes
  weeks: 'full' | number[]; // "full" or array of week numbers (1-based)
}

interface GenerateStrategyRequest {
  model: SupportedModel;
  context: {
    account: AccountContext;
    positions: PositionContext[];
    watchlist: WatchlistContext[];
    healthIssues: string[];
    currentDate: string;
    targetMonth: number;
    targetYear: number;
    scope?: ScopeConfig;
  };
}

// Strategy output sub-types
interface StrategyPhase {
  week: number;
  title: string;
  dateRange: [string, string];
  focus: string;
}

interface CalendarEvent {
  date: string;
  type: 'action' | 'watch' | 'earnings' | 'review' | 'trigger';
  title: string;
  stockCode: string | null;
  stockName: string | null;
  detail: string;
  priority: number;
  actionIfBeat: string | null;
  actionIfMiss: string | null;
  indicators: string[];
}

interface StockStrategy {
  stockCode: string;
  stockName: string;
  triggerLow: number;
  triggerHigh: number;
  maxShares: number;
  maxPositionPct: number;
  stopLossPct: number;
  logic: string;
}

interface StrategyRule {
  title: string;
  content: string;
  priority: number;
  threshold: number | null;
  unit: string | null;
}

interface GeneratedStrategy {
  phases: StrategyPhase[];
  calendarEvents: CalendarEvent[];
  strategies: StockStrategy[];
  rules: StrategyRule[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STRATEGY_SCHEMA = `{
  "phases": [
    { "week": 1, "title": "string", "dateRange": ["YYYY-MM-DD","YYYY-MM-DD"], "focus": "string" }
  ],
  "calendarEvents": [
    { "date": "YYYY-MM-DD", "type": "action|watch|earnings|review|trigger", "title": "string",
      "stockCode": "string|null", "stockName": "string|null", "detail": "string",
      "priority": 0|1|2,
      "actionIfBeat": "string|null", "actionIfMiss": "string|null",
      "indicators": ["string"] }
  ],
  "strategies": [
    { "stockCode": "string", "stockName": "string",
      "triggerLow": number, "triggerHigh": number, "maxShares": number,
      "maxPositionPct": number, "stopLossPct": number, "logic": "string" }
  ],
  "rules": [
    { "title": "string", "content": "string", "priority": 0|1|2,
      "threshold": number|null, "unit": "string|null" }
  ],
  "summary": "string"
}`;

const REQUIRED_TOP_KEYS: (keyof GeneratedStrategy)[] = [
  'phases',
  'calendarEvents',
  'strategies',
  'rules',
  'summary',
];

const MODEL_CONFIGS: Record<SupportedModel, {
  provider: 'deepseek' | 'anthropic';
  modelId: string;
  apiUrl: string;
  apiKeyEnv: string;
}> = {
  'deepseek-chat': {
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
  'claude-opus': {
    provider: 'anthropic',
    modelId: 'claude-opus-4-20250514',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate trading days (weekdays) for a given month.
 * Returns formatted strings like "4/1(一)", "4/2(二)" etc.
 */
function getTradingDays(year: number, month: number): { label: string; date: string; weekNum: number }[] {
  const days: { label: string; date: string; weekNum: number }[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
  let currentWeek = 1;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (dow === 1 && d > 1) currentWeek++; // new week on Monday
    if (dow >= 1 && dow <= 5) {
      const mm = String(month).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      days.push({
        label: `${month}/${d}(${weekdayNames[dow]})`,
        date: `${year}-${mm}-${dd}`,
        weekNum: currentWeek,
      });
    }
  }
  return days;
}

/** Build system prompt with user-specific context injected. */
function buildSystemPrompt(ctx: GenerateStrategyRequest['context'], scope: ScopeConfig): string {
  const { account, positions, watchlist, healthIssues, targetYear, targetMonth } = ctx;

  // --- Scope-aware position filtering ---
  const filteredPositions = scope.stocks === 'all'
    ? positions
    : positions.filter(p => (scope.stocks as string[]).includes(p.code));

  const positionsSummary = filteredPositions.length > 0
    ? filteredPositions.map(p =>
        `${p.name}(${p.code}): ${p.shares}股, 成本${p.cost.toFixed(2)}, 现价${p.current.toFixed(2)}, 盈亏${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}%, 仓位${p.weightPct.toFixed(1)}%`
      ).join('\n')
    : '空仓';

  const watchlistSummary = watchlist.length > 0
    ? watchlist.map(w => `${w.name}(${w.code}): 现价${w.current.toFixed(2)}`).join('\n')
    : '无自选股';

  const healthSummary = healthIssues.length > 0
    ? healthIssues.join('；')
    : '无异常';

  // --- Trading days enumeration ---
  const allTradingDays = getTradingDays(targetYear, targetMonth);
  const tradingDays = scope.weeks === 'full'
    ? allTradingDays
    : allTradingDays.filter(td => (scope.weeks as number[]).includes(td.weekNum));

  // --- Scope-aware prompt sections ---
  const moduleLabels: Record<string, string> = {
    calendarEvents: '日历事件',
    strategies: '买入策略',
    rules: '交易铁律',
  };

  let scopeInstructions = '';
  const allModules = ['calendarEvents', 'strategies', 'rules'];
  if (scope.modules.length < allModules.length) {
    const selectedLabels = scope.modules.map(m => moduleLabels[m] || m).join('、');
    scopeInstructions += `\n本次只需生成以下模块：${selectedLabels}\n未选中的模块请返回空数组。\n`;
  }

  if (scope.stocks !== 'all') {
    const stockNames = filteredPositions.map(p => `${p.name}(${p.code})`);
    if (stockNames.length > 0) {
      scopeInstructions += `\n本次仅分析以下标的：${stockNames.join('、')}，其余持仓不做规划。\n`;
    }
  }

  if (scope.weeks !== 'full') {
    scopeInstructions += `\n本次仅规划第${(scope.weeks as number[]).join('、')}周的交易日，其余时间不做规划。\n`;
  }

  return `你是一个专业的量化投资策略分析师。基于用户的真实持仓数据、账户状态和市场环境，生成一份结构化的月度交易策略计划。

用户情况：
- 负债炒股状态：${account.debtStatus ? '是（高风险）' : '否'}
- 总资产：¥${account.total.toFixed(2)}，其中现金¥${account.cash.toFixed(2)}，国债逆回购¥${account.reverseRepo.toFixed(2)}
- 持仓：
${positionsSummary}
- 自选股：
${watchlistSummary}
- 健康度问题：${healthSummary}
- 目标月份：${targetYear}年${targetMonth}月

本月交易日（共${tradingDays.length}个）：
${tradingDays.map(td => td.label).join(', ')}
${scopeInstructions}
请严格按以下JSON格式返回，不要添加任何前言、后语或markdown标记：
${STRATEGY_SCHEMA}

要求：
1. phases 必须包含3-4个阶段，每阶段有明确的日期范围和操作重点
2. calendarEvents 必须覆盖本月每一个交易日（共${tradingDays.length}天，不含周末），具体要求：
   - 关键操作日（财报公布、除权除息、重要经济数据、技术面关键位突破）：type="action"或"earnings"，detail必须包含具体价格条件和操作指令
   - 择机窗口（触发价位附近的观察期）：type="trigger"，detail标注具体价格区间和量能条件
   - 定期复盘日（每周五）：type="review"，detail列出本周需回顾的持仓表现和下周计划
   - 其余交易日：type="watch"，title格式如"持仓观察·关注信立泰放量"，detail必须具体到某只股票的某个技术指标
   - 严禁出现"关注市场动态""观察盘面变化"等笼统描述
   - 每条event的detail字段至少包含：①关注的股票 ②具体价格或指标条件 ③达到条件后的操作建议
   - calendarEvents数组长度必须≥${tradingDays.length}条（每个交易日至少1条）
3. strategies 只包含你认为值得关注的股票买入计划（必须有具体的触发价位）
4. rules 基于用户当前仓位风险给出3-6条纪律性约束
5. summary 用1-2句话总结本月核心策略方向
6. 所有建议必须基于用户的真实数据，不要编造持仓或价格
7. 考虑用户负债状态，策略必须偏保守，控制风险优先`;
}

/**
 * Extract the first complete JSON object from a raw AI response.
 * Follows the project convention (indexOf/lastIndexOf) per CLAUDE.md.
 */
function extractJSON(raw: string): Record<string, unknown> | null {
  // Strip markdown fences if present
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Coerce a value to a number, returning fallback if impossible. */
function toNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/** Coerce to a string or null. */
function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

/** Coerce to string array. */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return arr.map(String);
    } catch { /* ignore */ }
    return v.trim() ? [v] : [];
  }
  return [];
}

/** Clamp priority to 0|1|2. */
function clampPriority(v: unknown): number {
  const n = toNumber(v, 1);
  return Math.max(0, Math.min(2, Math.round(n)));
}

const VALID_EVENT_TYPES = new Set(['action', 'watch', 'earnings', 'review', 'trigger']);

/**
 * Validate and normalise the raw parsed JSON into a strongly-typed strategy.
 * Returns null if required top-level keys are missing.
 * If enabledModules is provided, only those modules + 'summary' + 'phases' are required.
 */
function normalizeStrategy(raw: Record<string, unknown>, enabledModules?: string[]): GeneratedStrategy | null {
  // Check required keys — if scope provided, only require enabled modules + summary + phases
  const requiredKeys = enabledModules
    ? [...new Set([...enabledModules, 'summary', 'phases'])] as (keyof GeneratedStrategy)[]
    : REQUIRED_TOP_KEYS;

  for (const key of requiredKeys) {
    if (!(key in raw)) {
      console.error(`[generate-strategy] Missing required key: ${key}`);
      return null;
    }
  }

  // --- phases ---
  const rawPhases = Array.isArray(raw.phases) ? raw.phases : [];
  const phases: StrategyPhase[] = rawPhases.map((p: Record<string, unknown>) => ({
    week: toNumber(p?.week, 1),
    title: String(p?.title ?? ''),
    dateRange: Array.isArray(p?.dateRange) && p.dateRange.length >= 2
      ? [String(p.dateRange[0]), String(p.dateRange[1])] as [string, string]
      : ['', ''],
    focus: String(p?.focus ?? ''),
  }));

  // --- calendarEvents ---
  const rawEvents = Array.isArray(raw.calendarEvents) ? raw.calendarEvents : [];
  const calendarEvents: CalendarEvent[] = rawEvents.map((e: Record<string, unknown>) => {
    const rawType = String(e?.type ?? 'watch');
    return {
      date: String(e?.date ?? ''),
      type: (VALID_EVENT_TYPES.has(rawType) ? rawType : 'watch') as CalendarEvent['type'],
      title: String(e?.title ?? ''),
      stockCode: toStringOrNull(e?.stockCode),
      stockName: toStringOrNull(e?.stockName),
      detail: String(e?.detail ?? ''),
      priority: clampPriority(e?.priority),
      actionIfBeat: toStringOrNull(e?.actionIfBeat),
      actionIfMiss: toStringOrNull(e?.actionIfMiss),
      indicators: toStringArray(e?.indicators),
    };
  });

  // --- strategies ---
  const rawStrategies = Array.isArray(raw.strategies) ? raw.strategies : [];
  const strategies: StockStrategy[] = rawStrategies.map((s: Record<string, unknown>) => ({
    stockCode: String(s?.stockCode ?? ''),
    stockName: String(s?.stockName ?? ''),
    triggerLow: toNumber(s?.triggerLow, 0),
    triggerHigh: toNumber(s?.triggerHigh, 0),
    maxShares: toNumber(s?.maxShares, 0),
    maxPositionPct: toNumber(s?.maxPositionPct, 0),
    stopLossPct: toNumber(s?.stopLossPct, 0),
    logic: String(s?.logic ?? ''),
  }));

  // --- rules ---
  const rawRules = Array.isArray(raw.rules) ? raw.rules : [];
  const rules: StrategyRule[] = rawRules.map((r: Record<string, unknown>) => ({
    title: String(r?.title ?? ''),
    content: String(r?.content ?? ''),
    priority: clampPriority(r?.priority),
    threshold: r?.threshold != null ? toNumber(r.threshold, 0) : null,
    unit: toStringOrNull(r?.unit),
  }));

  // --- summary ---
  const summary = String(raw.summary ?? '');

  return { phases, calendarEvents, strategies, rules, summary };
}

// ---------------------------------------------------------------------------
// AI Provider Callers
// ---------------------------------------------------------------------------

async function callDeepSeek(systemPrompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '请根据以上用户情况，生成本月交易策略计划。' },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error('[generate-strategy] DeepSeek API error:', errData);
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callClaude(systemPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-20250514',
      max_tokens: 6000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        { role: 'user', content: '请根据以上用户情况，生成本月交易策略计划。' },
      ],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error('[generate-strategy] Anthropic API error:', errData);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ---------------------------------------------------------------------------
// Request Validation
// ---------------------------------------------------------------------------

type ValidationResult =
  | { valid: true; data: GenerateStrategyRequest }
  | { valid: false; error: string };

function validateRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: '请求体不能为空' };
  }

  const req = body as Record<string, unknown>;

  // model
  const model = req.model;
  if (!model || !Object.keys(MODEL_CONFIGS).includes(model as string)) {
    return { valid: false, error: `不支持的模型: ${String(model)}，可选: ${Object.keys(MODEL_CONFIGS).join(', ')}` };
  }

  // context
  const ctx = req.context as Record<string, unknown> | undefined;
  if (!ctx || typeof ctx !== 'object') {
    return { valid: false, error: '缺少 context 对象' };
  }

  // account
  const account = ctx.account as Record<string, unknown> | undefined;
  if (!account || typeof account !== 'object') {
    return { valid: false, error: '缺少 context.account' };
  }
  if (typeof account.total !== 'number' || typeof account.cash !== 'number') {
    return { valid: false, error: 'account.total 和 account.cash 必须为数字' };
  }

  // positions & watchlist
  if (!Array.isArray(ctx.positions)) {
    return { valid: false, error: 'context.positions 必须为数组' };
  }
  if (!Array.isArray(ctx.watchlist)) {
    return { valid: false, error: 'context.watchlist 必须为数组' };
  }

  // targetMonth / targetYear
  if (typeof ctx.targetMonth !== 'number' || ctx.targetMonth < 1 || ctx.targetMonth > 12) {
    return { valid: false, error: 'context.targetMonth 必须为 1-12' };
  }
  if (typeof ctx.targetYear !== 'number' || ctx.targetYear < 2020) {
    return { valid: false, error: 'context.targetYear 无效' };
  }

  return {
    valid: true,
    data: {
      model: model as SupportedModel,
      context: {
        account: {
          total: Number(account.total),
          cash: Number(account.cash),
          reverseRepo: toNumber(account.reverseRepo, 0),
          debtStatus: Boolean(account.debtStatus),
        },
        positions: (ctx.positions as Record<string, unknown>[]).map(p => ({
          name: String(p.name ?? ''),
          code: String(p.code ?? ''),
          shares: toNumber(p.shares, 0),
          cost: toNumber(p.cost, 0),
          current: toNumber(p.current, 0),
          pnlPct: toNumber(p.pnlPct, 0),
          weightPct: toNumber(p.weightPct, 0),
        })),
        watchlist: (ctx.watchlist as Record<string, unknown>[]).map(w => ({
          name: String(w.name ?? ''),
          code: String(w.code ?? ''),
          current: toNumber(w.current, 0),
        })),
        healthIssues: Array.isArray(ctx.healthIssues) ? ctx.healthIssues.map(String) : [],
        currentDate: String(ctx.currentDate ?? new Date().toISOString().slice(0, 10)),
        targetMonth: ctx.targetMonth as number,
        targetYear: ctx.targetYear as number,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未登录，请先登录' },
        { status: 401 },
      );
    }

    // 2. Parse & validate request
    const body = await request.json().catch(() => null);
    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 },
      );
    }
    const { model, context } = validation.data;

    // 2b. Extract scope (with backwards-compatible defaults)
    const scope: ScopeConfig = context.scope || {
      modules: ['calendarEvents', 'strategies', 'rules'],
      stocks: 'all',
      weeks: 'full',
    };

    // 3. Build system prompt
    const systemPrompt = buildSystemPrompt(context, scope);

    // 4. Call AI
    const config = MODEL_CONFIGS[model];
    let rawContent: string;

    try {
      if (config.provider === 'deepseek') {
        rawContent = await callDeepSeek(systemPrompt);
      } else {
        rawContent = await callClaude(systemPrompt);
      }
    } catch (aiError) {
      console.error('[generate-strategy] AI call failed:', aiError);
      const apiKeyMissing = aiError instanceof Error && aiError.message.includes('not configured');
      return NextResponse.json(
        {
          success: false,
          error: apiKeyMissing
            ? `${config.apiKeyEnv} 未配置，请在环境变量中添加`
            : 'AI 生成策略失败，请重试',
          rawContent: undefined,
        },
        { status: apiKeyMissing ? 503 : 502 },
      );
    }

    if (!rawContent.trim()) {
      return NextResponse.json(
        { success: false, error: 'AI 返回空响应，请重试' },
        { status: 502 },
      );
    }

    // 5. Extract JSON
    const parsed = extractJSON(rawContent);
    if (!parsed) {
      console.error('[generate-strategy] JSON extraction failed, raw:', rawContent.slice(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: 'AI 响应格式异常，无法解析 JSON，请重试',
          rawContent: rawContent.slice(0, 2000),
        },
        { status: 422 },
      );
    }

    // 6. Validate & normalize
    const strategy = normalizeStrategy(parsed, scope.modules);
    if (!strategy) {
      console.error('[generate-strategy] Validation failed, keys present:', Object.keys(parsed));
      return NextResponse.json(
        {
          success: false,
          error: `AI 响应缺少必要字段 (${REQUIRED_TOP_KEYS.join(', ')})，请重试`,
          rawContent: rawContent.slice(0, 2000),
        },
        { status: 422 },
      );
    }

    // 7. Success
    return NextResponse.json({
      success: true,
      strategy,
      model,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[generate-strategy] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: '服务内部错误，请稍后重试' },
      { status: 500 },
    );
  }
}
