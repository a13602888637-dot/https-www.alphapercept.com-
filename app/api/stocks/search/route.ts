import { NextRequest, NextResponse } from "next/server"

// Disable caching for search results
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// 股票搜索结果接口
interface StockResult {
  code: string
  name: string
  market: string
}

// 新浪 Suggest API 搜索股票
async function searchStocksFromSina(query: string): Promise<StockResult[]> {
  if (!query.trim() || query.length < 2) {
    return [];
  }

  try {
    const apiUrl = `https://suggest3.sinajs.cn/quotes/v1/sugg?key=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://finance.sina.com.cn',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 新浪API返回GBK编码的文本，格式如：var suggestdata="浦发银行,600000,sh,银行;平安银行,000001,sz,银行;..."
    const responseText = await response.text();

    // 提取数据部分
    const match = responseText.match(/="([^"]+)"/);
    if (!match || !match[1]) {
      return [];
    }

    const dataString = match[1];
    if (!dataString || dataString === '') {
      return [];
    }

    const results: StockResult[] = [];
    const items = dataString.split(';');

    for (const item of items) {
      if (!item.trim()) continue;

      const fields = item.split(',');
      if (fields.length >= 3) {
        const name = fields[0]?.trim();
        const code = fields[1]?.trim();
        const marketCode = fields[2]?.trim().toLowerCase();

        if (name && code && marketCode) {
          // 转换市场代码：sh -> SH, sz -> SZ
          const market = marketCode === 'sh' ? 'SH' : 'SZ';
          results.push({ code, name, market });
        }
      }
    }

    // 限制返回数量
    return results.slice(0, 15);
  } catch (error) {
    console.error('Sina suggest API error:', error);
    // 不再静默返回空数组，而是抛出错误
    throw new Error(`Sina search API failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 本地缓存映射（仅作降级备用）
const fallbackStocks: StockResult[] = [
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
];

// 搜索股票（主API + 降级）
async function searchStocks(query: string): Promise<StockResult[]> {
  if (!query.trim()) {
    return [];
  }

  // 首先尝试新浪API
  const sinaResults = await searchStocksFromSina(query);
  if (sinaResults.length > 0) {
    return sinaResults;
  }

  // 如果新浪API无结果或失败，使用本地降级数据
  const lowercaseQuery = query.toLowerCase();

  // 优先精确匹配股票代码
  const exactCodeMatches = fallbackStocks.filter(stock =>
    stock.code === query
  );
  if (exactCodeMatches.length > 0) {
    return exactCodeMatches;
  }

  // 其次精确匹配股票名称
  const exactNameMatches = fallbackStocks.filter(stock =>
    stock.name.toLowerCase() === lowercaseQuery
  );
  if (exactNameMatches.length > 0) {
    return exactNameMatches;
  }

  // 最后进行模糊匹配
  return fallbackStocks.filter(stock =>
    stock.code.includes(query) ||
    stock.name.toLowerCase().includes(lowercaseQuery) ||
    stock.market.toLowerCase().includes(lowercaseQuery)
  ).slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    // 调用真实搜索API
    const results = await searchStocks(query);

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
      query,
      source: results.length > 0 ? (results[0].code === fallbackStocks[0].code ? 'fallback' : 'sina') : 'none',
    });
  } catch (error) {
    console.error("股票搜索API错误:", error);

    // 不再静默返回降级数据，而是返回明确的错误信息
    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
      query,
      error: "股票搜索API失败",
      details: error instanceof Error ? error.message : String(error),
      source: 'error',
    }, { status: 500 }); // 返回500错误状态码
  }
}

// 纯本地降级搜索（无网络依赖）
function searchStocksFallback(query: string): StockResult[] {
  if (!query.trim()) {
    return [];
  }

  const lowercaseQuery = query.toLowerCase();

  // 优先精确匹配股票代码
  const exactCodeMatches = fallbackStocks.filter(stock =>
    stock.code === query
  );
  if (exactCodeMatches.length > 0) {
    return exactCodeMatches;
  }

  // 其次精确匹配股票名称
  const exactNameMatches = fallbackStocks.filter(stock =>
    stock.name.toLowerCase() === lowercaseQuery
  );
  if (exactNameMatches.length > 0) {
    return exactNameMatches;
  }

  // 最后进行模糊匹配
  return fallbackStocks.filter(stock =>
    stock.code.includes(query) ||
    stock.name.toLowerCase().includes(lowercaseQuery) ||
    stock.market.toLowerCase().includes(lowercaseQuery)
  ).slice(0, 10);
}