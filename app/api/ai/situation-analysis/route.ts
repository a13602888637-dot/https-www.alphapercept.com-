/**
 * AI Situation Analysis API
 * POST /api/ai/situation-analysis
 *
 * Accepts a summary of live OSINT data and returns a macro situational assessment
 * via DeepSeek API. Responses are cached for 3 minutes.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

interface SituationRequest {
  newsHeadlines: string[];
  conflictCount: number;
  marketSummary: string;
  vesselCount: number;
  economicSummary?: string;
  deltaEventCount?: number;
  weatherAlertCount?: number;
  watchlistSummary?: string;
}

interface SituationResponse {
  assessment: string;
  macroRegime?: string;
  risks: string[];
  portfolioImpact?: string[];
  actionableSignals?: string[];
  confidence: "high" | "medium" | "low";
  timestamp: string;
}

// Simple in-memory cache (macro-only; personalized requests bypass cache)
let cachedResponse: SituationResponse | null = null;
let cacheTimestamp = 0;

const SYSTEM_PROMPT_BASE = `你是一位全球宏观态势分析师。基于以下实时OSINT数据，输出结构化态势评估。

输出JSON格式：
{
  "assessment": "2-3句话的全局态势判断（SITUATION OVERVIEW）",
  "macroRegime": "expansion|peak|contraction|trough",
  "risks": ["按严重度排序的风险信号，每条带交易方向(bullish/bearish)"],
  "actionableSignals": ["明确的看多/看空建议，如'VIX飙升+冲突升级=risk-off，建议减仓'"],
  "confidence": "high/medium/low",
  "timestamp": "ISO"
}

分析维度：
1. 宏观周期：GDP/CPI/失业率/Fed利率→经济周期判断
2. 流动性：收益率曲线/VIX→资金流向
3. 地缘黑天鹅：冲突事件/人道危机→避险情绪
4. 极端气象：飓风/极寒→能源/农产品供应链
5. 综合风险方向：VIX+冲突+高收益利差同时上升=risk-off(bearish)

只输出JSON，不要输出其他内容。`;

const SYSTEM_PROMPT_WITH_PORTFOLIO = `你是一位全球宏观态势分析师。基于以下实时OSINT数据和用户持仓信息，输出结构化态势评估。

输出JSON格式：
{
  "assessment": "2-3句话的全局态势判断（SITUATION OVERVIEW）",
  "macroRegime": "expansion|peak|contraction|trough",
  "risks": ["按严重度排序的风险信号，每条带交易方向(bullish/bearish)"],
  "portfolioImpact": ["针对用户具体持仓的影响分析，如'中东冲突升级利好中国石油(601857)，但需警惕全球衰退预期压制需求'"],
  "actionableSignals": ["明确的看多/看空建议，如'VIX飙升+冲突升级=risk-off，建议减仓'"],
  "confidence": "high/medium/low",
  "timestamp": "ISO"
}

分析维度：
1. 宏观周期：GDP/CPI/失业率/Fed利率→经济周期判断
2. 流动性：收益率曲线/VIX→资金流向
3. 地缘黑天鹅：冲突事件/人道危机→避险情绪
4. 极端气象：飓风/极寒→能源/农产品供应链
5. 综合风险方向：VIX+冲突+高收益利差同时上升=risk-off(bearish)
6. 对用户持仓的影响：结合当前OSINT信号，逐一分析用户自选股/持仓面临的具体风险与机会

只输出JSON，不要输出其他内容。`;

export async function POST(request: NextRequest) {
  try {
    const body: SituationRequest = await request.json();
    const hasWatchlist = !!(body.watchlistSummary && body.watchlistSummary.trim());

    // Return cached response if still fresh (only for non-personalized requests)
    const now = Date.now();
    if (!hasWatchlist && cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
      return Response.json(cachedResponse);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;

    // If no API key, return mock response
    if (!apiKey) {
      const mockResponse: SituationResponse = {
        assessment: "AI引擎未配置，无法生成态势分析",
        risks: [],
        portfolioImpact: hasWatchlist
          ? ["持仓影响分析需要AI引擎支持，请配置DEEPSEEK_API_KEY"]
          : undefined,
        confidence: "low",
        timestamp: new Date().toISOString(),
      };
      return Response.json(mockResponse);
    }

    // Build user message from the data summary
    const userMessage = [
      `新闻头条 (${body.newsHeadlines.length}条):`,
      ...(body.newsHeadlines.slice(0, 10).map((h, i) => `${i + 1}. ${h}`)),
      "",
      `活跃冲突事件: ${body.conflictCount}个`,
      `追踪船舶数量: ${body.vesselCount}艘`,
      "",
      `市场概况: ${body.marketSummary || "暂无数据"}`,
      "",
      body.economicSummary ? `宏观经济指标: ${body.economicSummary}` : "",
      body.deltaEventCount ? `数据变化事件: ${body.deltaEventCount}个` : "",
      body.weatherAlertCount ? `极端气象警报: ${body.weatherAlertCount}个` : "",
      "",
      hasWatchlist ? `用户持仓/自选股: ${body.watchlistSummary}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = hasWatchlist ? SYSTEM_PROMPT_WITH_PORTFOLIO : SYSTEM_PROMPT_BASE;

    // Call DeepSeek (non-streaming)
    const deepseekRes = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: false,
        temperature: 0.5,
        max_tokens: hasWatchlist ? 800 : 500,
      }),
    });

    if (!deepseekRes.ok) {
      const errData = await deepseekRes.json().catch(() => ({}));
      console.error("DeepSeek API error:", errData);
      return Response.json(
        { error: "AI analysis failed" },
        { status: 502 }
      );
    }

    const deepseekData = await deepseekRes.json();
    const content = deepseekData.choices?.[0]?.message?.content ?? "";

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed: SituationResponse;
    try {
      // Strip markdown fences first
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      // Extract JSON object — DeepSeek sometimes adds preamble text before the JSON
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) throw new Error("No JSON object found");
      const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
      const raw = JSON.parse(jsonStr);

      // Normalize fields — DeepSeek sometimes returns strings instead of arrays
      const toStringArray = (v: unknown): string[] => {
        if (Array.isArray(v)) return v.map(String);
        if (typeof v === "string") {
          try { const arr = JSON.parse(v); if (Array.isArray(arr)) return arr.map(String); } catch {}
          return v.trim() ? [v] : [];
        }
        return [];
      };

      parsed = {
        assessment: typeof raw.assessment === "string" ? raw.assessment : JSON.stringify(raw.assessment ?? "态势分析解析失败"),
        macroRegime: raw.macroRegime,
        risks: toStringArray(raw.risks),
        portfolioImpact: raw.portfolioImpact ? toStringArray(raw.portfolioImpact) : undefined,
        actionableSignals: raw.actionableSignals ? toStringArray(raw.actionableSignals) : undefined,
        confidence: ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "low",
        timestamp: raw.timestamp || new Date().toISOString(),
      };
    } catch (e) {
      console.error("[situation-analysis] JSON parse failed:", e instanceof Error ? e.message : e, "raw:", content.slice(0, 300));
      // If parsing fails, construct a response from raw text
      parsed = {
        assessment: content.replace(/[{}\[\]"\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 200) || "态势分析解析失败",
        risks: [],
        confidence: "low",
        timestamp: new Date().toISOString(),
      };
    }

    // Cache only non-personalized (macro-only) responses
    if (!hasWatchlist) {
      cachedResponse = parsed;
      cacheTimestamp = Date.now();
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("Situation analysis error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
