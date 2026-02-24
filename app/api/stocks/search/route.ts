import { NextRequest, NextResponse } from "next/server"

// 股票搜索结果接口
interface StockResult {
  code: string
  name: string
  market: string
}

// 模拟股票数据
const mockStocks: StockResult[] = [
  { code: "000001", name: "平安银行", market: "SZ" },
  { code: "000002", name: "万科A", market: "SZ" },
  { code: "000858", name: "五粮液", market: "SZ" },
  { code: "000333", name: "美的集团", market: "SZ" },
  { code: "000651", name: "格力电器", market: "SZ" },
  { code: "600000", name: "浦发银行", market: "SH" },
  { code: "600036", name: "招商银行", market: "SH" },
  { code: "600519", name: "贵州茅台", market: "SH" },
  { code: "601318", name: "中国平安", market: "SH" },
  { code: "601398", name: "工商银行", market: "SH" },
  { code: "300750", name: "宁德时代", market: "SZ" },
  { code: "002415", name: "海康威视", market: "SZ" },
  { code: "002594", name: "比亚迪", market: "SZ" },
  { code: "300059", name: "东方财富", market: "SZ" },
  { code: "000725", name: "京东方A", market: "SZ" },
]

// 搜索股票
function searchStocks(query: string): StockResult[] {
  if (!query.trim()) {
    return []
  }

  const lowercaseQuery = query.toLowerCase()

  // 优先精确匹配股票代码
  const exactCodeMatches = mockStocks.filter(stock =>
    stock.code === query
  )

  if (exactCodeMatches.length > 0) {
    return exactCodeMatches
  }

  // 其次精确匹配股票名称
  const exactNameMatches = mockStocks.filter(stock =>
    stock.name.toLowerCase() === lowercaseQuery
  )

  if (exactNameMatches.length > 0) {
    return exactNameMatches
  }

  // 最后进行模糊匹配
  return mockStocks.filter(stock =>
    stock.code.includes(query) ||
    stock.name.toLowerCase().includes(lowercaseQuery) ||
    stock.market.toLowerCase().includes(lowercaseQuery)
  ).slice(0, 10) // 限制返回10条结果
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q") || ""

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 300))

    const results = searchStocks(query)

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
      query,
    })
  } catch (error) {
    console.error("股票搜索API错误:", error)
    return NextResponse.json(
      {
        success: false,
        error: "搜索失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    )
  }
}