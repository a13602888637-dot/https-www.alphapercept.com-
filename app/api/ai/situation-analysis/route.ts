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
}

interface SituationResponse {
  assessment: string;
  risks: string[];
  confidence: "high" | "medium" | "low";
  timestamp: string;
}

// Simple in-memory cache
let cachedResponse: SituationResponse | null = null;
let cacheTimestamp = 0;

const SYSTEM_PROMPT = `你是一位全球宏观态势分析师。基于以下实时数据，输出简洁的态势评估。
输出JSON格式：{"assessment":"2-3句话的宏观态势判断","risks":["风险信号1","风险信号2"],"confidence":"high/medium/low","timestamp":"ISO"}
只输出JSON，不要输出其他内容。`;

export async function POST(request: NextRequest) {
  try {
    const body: SituationRequest = await request.json();

    // Return cached response if still fresh
    const now = Date.now();
    if (cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
      return Response.json(cachedResponse);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;

    // If no API key, return mock response
    if (!apiKey) {
      const mockResponse: SituationResponse = {
        assessment: "AI引擎未配置，无法生成态势分析",
        risks: [],
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
    ].join("\n");

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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: false,
        temperature: 0.5,
        max_tokens: 500,
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
      const jsonStr = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(jsonStr);
      // Ensure timestamp is present
      if (!parsed.timestamp) {
        parsed.timestamp = new Date().toISOString();
      }
    } catch {
      // If parsing fails, construct a response from raw text
      parsed = {
        assessment: content.slice(0, 200) || "态势分析解析失败",
        risks: [],
        confidence: "low",
        timestamp: new Date().toISOString(),
      };
    }

    // Cache the response
    cachedResponse = parsed;
    cacheTimestamp = Date.now();

    return Response.json(parsed);
  } catch (error) {
    console.error("Situation analysis error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
