import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// In-memory cache (4-hour TTL)
// ---------------------------------------------------------------------------
let scanCache: { candidates: any[]; scanTime: string } | null = null;
let cacheTs = 0;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

const MOCK_CANDIDATES = [
  { code: "600519", name: "贵州茅台", entryRange: [1680, 1720], stopLoss: 1620, target: 1850, confidence: 82, rationale: "消费复苏+估值回归，量价齐升确认趋势" },
  { code: "300750", name: "宁德时代", entryRange: [195, 205], stopLoss: 185, target: 240, confidence: 75, rationale: "储能订单爆发，技术面突破前高" },
  { code: "002594", name: "比亚迪", entryRange: [265, 278], stopLoss: 250, target: 320, confidence: 71, rationale: "出海加速+智驾落地，月销创新高" },
];

// ---------------------------------------------------------------------------
// GET – return cached results
// ---------------------------------------------------------------------------
export async function GET() {
  if (scanCache && Date.now() - cacheTs < CACHE_TTL) {
    return NextResponse.json({ success: true, ...scanCache });
  }
  return NextResponse.json({ success: true, candidates: [], scanTime: null });
}

// ---------------------------------------------------------------------------
// POST – trigger a new scan
// ---------------------------------------------------------------------------
export async function POST() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

    if (!process.env.DEEPSEEK_API_KEY) {
      scanCache = { candidates: MOCK_CANDIDATES, scanTime: new Date().toISOString() };
      cacheTs = Date.now();
      return NextResponse.json({ success: true, ...scanCache, mock: true });
    }

    // Fetch hot stocks + macro data in parallel
    const [hotRes, macroRes] = await Promise.all([
      fetch(new URL("/api/stocks/hot", baseUrl)).catch(() => null),
      fetch(new URL("/api/global-macro", baseUrl)).catch(() => null),
    ]);

    const hotData = hotRes?.ok ? await hotRes.json().catch(() => []) : [];
    const macroData = macroRes?.ok ? await macroRes.json().catch(() => {}) : {};

    const prompt = `你是一位专业的A股量化分析师。基于以下市场环境数据，推荐3-5只具有高胜率的A股标的。

当前宏观环境：
${JSON.stringify(macroData)}

热门股票参考：
${JSON.stringify(hotData)}

请严格按以下JSON格式返回（不要包含任何其他文字）：
{
  "candidates": [
    {
      "code": "股票代码",
      "name": "股票名称",
      "entryRange": [入场价下限, 入场价上限],
      "stopLoss": 止损价,
      "target": 目标价,
      "confidence": 信心分数0-100,
      "rationale": "一句话核心逻辑"
    }
  ]
}`;

    const aiRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`DeepSeek API error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];

    scanCache = { candidates, scanTime: new Date().toISOString() };
    cacheTs = Date.now();

    return NextResponse.json({ success: true, ...scanCache });
  } catch (error) {
    console.error("Stock scanner error:", error);
    // Fallback to mock on error
    scanCache = { candidates: MOCK_CANDIDATES, scanTime: new Date().toISOString() };
    cacheTs = Date.now();
    return NextResponse.json({ success: true, ...scanCache, mock: true });
  }
}
