import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { fetchMultipleStocks, MarketData } from "../../../../skills/data_crawler";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Core stocks to monitor for intelligence generation
const MONITOR_STOCKS = [
  "600519", "000858", "600036", "601318", "300750",
  "002594", "300059", "600900", "601012", "000333",
  "002415", "600276", "601888", "601899", "000002",
  "600030", "002475", "300760", "688981", "601166",
];

// Thresholds for triggering intelligence generation
const CHANGE_THRESHOLD = 2.5; // |changePercent| > 2.5% triggers analysis
const VOLUME_RATIO_THRESHOLD = 1.8; // volume > 1.8x average triggers analysis

interface StockSignal {
  stock: MarketData;
  reason: string;
}

function identifySignals(stocks: MarketData[]): StockSignal[] {
  const signals: StockSignal[] = [];

  for (const stock of stocks) {
    if (!stock || stock.currentPrice === 0) continue;

    const absChange = Math.abs(stock.changePercent || 0);

    if (absChange >= CHANGE_THRESHOLD) {
      const direction = (stock.changePercent || 0) > 0 ? "大涨" : "大跌";
      signals.push({
        stock,
        reason: `${stock.name}${direction}${absChange.toFixed(2)}%，触发异动信号`,
      });
    }
  }

  // If no signals from threshold, pick top 3 movers
  if (signals.length === 0) {
    const sorted = [...stocks]
      .filter(s => s && s.currentPrice > 0 && s.changePercent !== undefined)
      .sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))
      .slice(0, 3);

    for (const stock of sorted) {
      const direction = (stock.changePercent || 0) >= 0 ? "上涨" : "下跌";
      signals.push({
        stock,
        reason: `${stock.name}${direction}${Math.abs(stock.changePercent || 0).toFixed(2)}%，今日主要变动股`,
      });
    }
  }

  return signals.slice(0, 8); // Max 8 signals per batch
}

function buildAnalysisPrompt(signals: StockSignal[]): string {
  const stockList = signals.map(s => {
    const stock = s.stock;
    return `- ${stock.name}(${stock.symbol}): 现价${stock.currentPrice}, 涨跌幅${(stock.changePercent || 0).toFixed(2)}%, 原因: ${s.reason}`;
  }).join("\n");

  return `你是一位专业的A股投资分析师。请对以下异动股票生成情报分析，每只股票需要包含：

当前异动股票：
${stockList}

请对每只股票输出严格的JSON数组格式，不要输出其他内容：
[
  {
    "stockCode": "代码",
    "stockName": "名称",
    "eventSummary": "简短事件摘要（50字内，描述异动原因和影响）",
    "industryTrend": "所在行业趋势分析（30字内）",
    "trapProbability": 数字(0-100，陷阱概率),
    "actionSignal": "BUY或SELL或HOLD"
  }
]

注意：
- trapProbability: 涨幅过大(>5%)的股票应给高陷阱概率(60-90), 缩量上涨给中等(40-60), 放量突破给低(10-30)
- actionSignal: 基于技术面和基本面综合判断
- 请直接输出JSON数组，不要包含markdown代码块或其他文字`;
}

async function callDeepSeekNonStream(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一位专业的A股量化分析师，精通技术分析和基本面分析。你的输出必须是纯JSON格式。' },
        { role: 'user', content: prompt },
      ],
      stream: false,
      temperature: 0.5,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `DeepSeek API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function POST(req: Request) {
  try {
    // Verify API key for security (use a simple shared secret)
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    // Allow if CRON_SECRET is not set (development) or matches
    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('[Intelligence Generator] Starting intelligence generation...');

    // Step 1: Fetch stock data
    const stockData = await fetchMultipleStocks(MONITOR_STOCKS, 2);
    console.log(`[Intelligence Generator] Fetched ${stockData.length} stocks`);

    // Step 2: Identify signals
    const signals = identifySignals(stockData);
    console.log(`[Intelligence Generator] Found ${signals.length} signals`);

    if (signals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No significant signals detected',
        generated: 0,
      });
    }

    // Step 3: Call AI for analysis
    const prompt = buildAnalysisPrompt(signals);
    const aiResponse = await callDeepSeekNonStream(prompt);
    console.log('[Intelligence Generator] AI response received');

    // Step 4: Parse AI response
    let analyses: any[];
    try {
      // Strip markdown code block if present
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      analyses = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('[Intelligence Generator] Failed to parse AI response:', aiResponse.substring(0, 500));
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI analysis',
        rawResponse: aiResponse.substring(0, 200),
      }, { status: 500 });
    }

    // Step 5: Write to database
    const created = [];
    for (const analysis of analyses) {
      try {
        const item = await prisma.intelligenceFeed.create({
          data: {
            stockCode: analysis.stockCode,
            stockName: analysis.stockName,
            eventSummary: analysis.eventSummary || '市场异动分析',
            industryTrend: analysis.industryTrend || '',
            trapProbability: Math.min(100, Math.max(0, analysis.trapProbability || 0)),
            actionSignal: ['BUY', 'SELL', 'HOLD'].includes(analysis.actionSignal) ? analysis.actionSignal : 'HOLD',
            rawData: {
              generatedAt: new Date().toISOString(),
              source: 'ai-auto-generate',
              stockPrice: signals.find(s => s.stock.symbol === analysis.stockCode)?.stock.currentPrice,
              changePercent: signals.find(s => s.stock.symbol === analysis.stockCode)?.stock.changePercent,
            },
          },
        });
        created.push(item.id);
      } catch (dbError) {
        console.error(`[Intelligence Generator] Failed to save analysis for ${analysis.stockCode}:`, dbError);
      }
    }

    console.log(`[Intelligence Generator] Created ${created.length} intelligence items`);

    return NextResponse.json({
      success: true,
      generated: created.length,
      signals: signals.length,
      items: created,
    });
  } catch (error) {
    console.error('[Intelligence Generator] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// GET handler for Vercel Cron Jobs
export async function GET(req: Request) {
  // Vercel Cron sends GET requests
  return POST(req);
}
