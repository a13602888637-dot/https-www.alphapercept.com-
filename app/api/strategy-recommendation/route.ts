import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

// GET: Generate AI strategy recommendations based on user's watchlist and market context
export async function GET(req: Request) {
  try {
    let clerkUserId: string | null = null
    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch {
      // Continue without auth
    }

    let watchlistStocks: string[] = []
    let userSettings: any = {}

    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        include: { watchlists: true },
      })
      if (user) {
        watchlistStocks = user.watchlists.map(w => `${w.stockCode} ${w.stockName}`)
        userSettings = user.settings || {}
      }
    }

    // Get recent intelligence feeds for market context
    const recentFeeds = await prisma.intelligenceFeed.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const marketContext = recentFeeds.map(f =>
      `${f.stockName}(${f.stockCode}): ${f.eventSummary} [${f.actionSignal}, 陷阱概率${f.trapProbability}%]`
    ).join('\n')

    const watchlistContext = watchlistStocks.length > 0
      ? `用户自选股: ${watchlistStocks.join(', ')}`
      : '用户暂无自选股'

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
    }

    const systemPrompt = `你是Alpha-Quant-Copilot AI量化投资策略生成引擎。基于三流融合决策框架生成策略推荐。

三流融合框架:
1. 宏观对冲（找预期差）- 经济周期定位、政策预期差、流动性拐点
2. 价值防守（拒绝泡沫）- ROE>12%, 毛利率>25%, 负债率<60%, 安全边际
3. 中国一线游资（情绪感知）- 涨停数量、连板高度、资金净流入

硬性纪律:
- MA60破位止损: 收盘价低于60日均线立即止损
- MD60趋势跟踪: 顺势而为，动量优先
- 单股仓位不超过20%

请生成5个策略推荐，必须返回严格的JSON数组格式:
[
  {
    "id": "1",
    "name": "策略名称",
    "description": "策略描述",
    "confidence": 85,
    "riskLevel": "低|中等|高",
    "expectedReturn": "10-20%",
    "timeHorizon": "3-6个月",
    "recommendedStocks": ["600519", "000858"],
    "keyFactors": ["因素1", "因素2", "因素3"],
    "lastUpdated": "${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}"
  }
]

只返回JSON数组，不要包含其他文本。`

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `当前市场环境:\n${marketContext || '暂无最新市场情报'}\n\n${watchlistContext}\n\n用户偏好: ${JSON.stringify(userSettings.preferences || {})}\n\n请基于以上信息生成5个策略推荐。` },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`)
    }

    const aiData = await response.json()
    const content = aiData.choices?.[0]?.message?.content || '[]'

    // Parse the JSON response
    let strategies
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      strategies = JSON.parse(jsonMatch ? jsonMatch[0] : content)
    } catch {
      // Fallback strategies if AI response parsing fails
      strategies = [
        { id: "1", name: "宏观对冲策略", description: "基于经济周期与政策预期差分析", confidence: 85, riskLevel: "中等", expectedReturn: "15-25%", timeHorizon: "6-12个月", recommendedStocks: [], keyFactors: ["PMI数据", "利率政策", "通胀预期"], lastUpdated: new Date().toISOString() },
        { id: "2", name: "价值防守策略", description: "安全边际优先，筛选财务健康的优质公司", confidence: 88, riskLevel: "低", expectedReturn: "10-18%", timeHorizon: "12-24个月", recommendedStocks: [], keyFactors: ["ROE>12%", "毛利率>25%", "负债率<60%"], lastUpdated: new Date().toISOString() },
        { id: "3", name: "情绪接力策略", description: "感知市场情绪周期，参与强势板块接力", confidence: 78, riskLevel: "高", expectedReturn: "20-40%", timeHorizon: "1-3个月", recommendedStocks: [], keyFactors: ["涨停数量", "连板高度", "资金净流入"], lastUpdated: new Date().toISOString() },
        { id: "4", name: "事件驱动策略", description: "捕捉突发事件的预期差，快速响应", confidence: 82, riskLevel: "中等", expectedReturn: "12-22%", timeHorizon: "1-6个月", recommendedStocks: [], keyFactors: ["政策发布", "技术突破", "供需变化"], lastUpdated: new Date().toISOString() },
        { id: "5", name: "反人性破解策略", description: "识别诱多、洗盘、龙头衰竭模式", confidence: 80, riskLevel: "高", expectedReturn: "18-35%", timeHorizon: "3-9个月", recommendedStocks: [], keyFactors: ["诱多识别", "洗盘识别", "衰竭预警"], lastUpdated: new Date().toISOString() },
      ]
    }

    return NextResponse.json({
      success: true,
      strategies,
      userPreferences: userSettings.preferences || {
        riskTolerance: "中等",
        investmentHorizon: "6-12个月",
        preferredStrategies: ["价值防守", "宏观对冲"],
        excludedIndustries: [],
        maxPositionSize: "20%",
      },
    })
  } catch (error) {
    console.error('Strategy recommendation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate strategies' },
      { status: 500 }
    )
  }
}

// POST: Apply a strategy (save to user settings)
export async function POST(req: Request) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { strategyId, strategyName } = body

    const user = await prisma.user.findUnique({
      where: { clerkUserId: authResult.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentSettings = (user.settings as any) || {}
    const updatedSettings = {
      ...currentSettings,
      appliedStrategy: {
        id: strategyId,
        name: strategyName,
        appliedAt: new Date().toISOString(),
      },
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { settings: updatedSettings },
    })

    return NextResponse.json({ success: true, message: `策略 "${strategyName}" 已应用` })
  } catch (error) {
    console.error('Apply strategy error:', error)
    return NextResponse.json({ error: 'Failed to apply strategy' }, { status: 500 })
  }
}
