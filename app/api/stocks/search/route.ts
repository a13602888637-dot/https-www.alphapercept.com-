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
    console.error('Sina suggest API error (returning empty array for fallback):', error);
    // 返回空数组，让上层函数使用本地降级数据
    return [];
  }
}

// 本地缓存映射（仅作降级备用） - 沪深300核心标的
const fallbackStocks: StockResult[] = [
  // 深圳交易所
  { code: "000001", name: "平安银行", market: "SZ" },
  { code: "000002", name: "万科A", market: "SZ" },
  { code: "000858", name: "五粮液", market: "SZ" },
  { code: "000333", name: "美的集团", market: "SZ" },
  { code: "000651", name: "格力电器", market: "SZ" },
  { code: "000725", name: "京东方A", market: "SZ" },
  { code: "000063", name: "中兴通讯", market: "SZ" },
  { code: "000100", name: "TCL科技", market: "SZ" },
  { code: "000166", name: "申万宏源", market: "SZ" },
  { code: "000338", name: "潍柴动力", market: "SZ" },
  { code: "000568", name: "泸州老窖", market: "SZ" },
  { code: "000625", name: "长安汽车", market: "SZ" },
  { code: "000661", name: "长春高新", market: "SZ" },
  { code: "000776", name: "广发证券", market: "SZ" },
  { code: "000876", name: "新希望", market: "SZ" },
  { code: "000977", name: "浪潮信息", market: "SZ" },
  { code: "002024", name: "苏宁易购", market: "SZ" },
  { code: "002142", name: "宁波银行", market: "SZ" },
  { code: "002153", name: "石基信息", market: "SZ" },
  { code: "002230", name: "科大讯飞", market: "SZ" },
  { code: "002236", name: "大华股份", market: "SZ" },
  { code: "002241", name: "歌尔股份", market: "SZ" },
  { code: "002304", name: "洋河股份", market: "SZ" },
  { code: "002352", name: "顺丰控股", market: "SZ" },
  { code: "002415", name: "海康威视", market: "SZ" },
  { code: "002475", name: "立讯精密", market: "SZ" },
  { code: "002594", name: "比亚迪", market: "SZ" },
  { code: "300015", name: "爱尔眼科", market: "SZ" },
  { code: "300059", name: "东方财富", market: "SZ" },
  { code: "300122", name: "智飞生物", market: "SZ" },
  { code: "300142", name: "沃森生物", market: "SZ" },
  { code: "300347", name: "泰格医药", market: "SZ" },
  { code: "300750", name: "宁德时代", market: "SZ" },
  // 上海交易所
  { code: "600000", name: "浦发银行", market: "SH" },
  { code: "600009", name: "上海机场", market: "SH" },
  { code: "600010", name: "包钢股份", market: "SH" },
  { code: "600016", name: "民生银行", market: "SH" },
  { code: "600028", name: "中国石化", market: "SH" },
  { code: "600030", name: "中信证券", market: "SH" },
  { code: "600036", name: "招商银行", market: "SH" },
  { code: "600048", name: "保利发展", market: "SH" },
  { code: "600050", name: "中国联通", market: "SH" },
  { code: "600104", name: "上汽集团", market: "SH" },
  { code: "600276", name: "恒瑞医药", market: "SH" },
  { code: "600309", name: "万华化学", market: "SH" },
  { code: "600436", name: "片仔癀", market: "SH" },
  { code: "600519", name: "贵州茅台", market: "SH" },
  { code: "600547", name: "山东黄金", market: "SH" },
  { code: "600585", name: "海螺水泥", market: "SH" },
  { code: "600588", name: "用友网络", market: "SH" },
  { code: "600690", name: "海尔智家", market: "SH" },
  { code: "600703", name: "三安光电", market: "SH" },
  { code: "600745", name: "闻泰科技", market: "SH" },
  { code: "600795", name: "国电电力", market: "SH" },
  { code: "600837", name: "海通证券", market: "SH" },
  { code: "600887", name: "伊利股份", market: "SH" },
  { code: "600900", name: "长江电力", market: "SH" },
  { code: "600919", name: "江苏银行", market: "SH" },
  { code: "600958", name: "东方证券", market: "SH" },
  { code: "600999", name: "招商证券", market: "SH" },
  { code: "601006", name: "大秦铁路", market: "SH" },
  { code: "601012", name: "隆基绿能", market: "SH" },
  { code: "601066", name: "中信建投", market: "SH" },
  { code: "601088", name: "中国神华", market: "SH" },
  { code: "601138", name: "工业富联", market: "SH" },
  { code: "601166", name: "兴业银行", market: "SH" },
  { code: "601169", name: "北京银行", market: "SH" },
  { code: "601186", name: "中国铁建", market: "SH" },
  { code: "601198", name: "东兴证券", market: "SH" },
  { code: "601211", name: "国泰君安", market: "SH" },
  { code: "601216", name: "君正集团", market: "SH" },
  { code: "601229", name: "上海银行", market: "SH" },
  { code: "601288", name: "农业银行", market: "SH" },
  { code: "601318", name: "中国平安", market: "SH" },
  { code: "601328", name: "交通银行", market: "SH" },
  { code: "601336", name: "新华保险", market: "SH" },
  { code: "601398", name: "工商银行", market: "SH" },
  { code: "601601", name: "中国太保", market: "SH" },
  { code: "601628", name: "中国人寿", market: "SH" },
  { code: "601668", name: "中国建筑", market: "SH" },
  { code: "601688", name: "华泰证券", market: "SH" },
  { code: "601766", name: "中国中车", market: "SH" },
  { code: "601788", name: "光大证券", market: "SH" },
  { code: "601800", name: "中国交建", market: "SH" },
  { code: "601818", name: "光大银行", market: "SH" },
  { code: "601857", name: "中国石油", market: "SH" },
  { code: "601878", name: "浙商证券", market: "SH" },
  { code: "601888", name: "中国中免", market: "SH" },
  { code: "601899", name: "紫金矿业", market: "SH" },
  { code: "601919", name: "中远海控", market: "SH" },
  { code: "601939", name: "建设银行", market: "SH" },
  { code: "601988", name: "中国银行", market: "SH" },
  { code: "601998", name: "中信银行", market: "SH" },
  { code: "603259", name: "药明康德", market: "SH" },
  { code: "603288", name: "海天味业", market: "SH" },
  { code: "603501", name: "韦尔股份", market: "SH" },
  { code: "603986", name: "兆易创新", market: "SH" },
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
    console.error("股票搜索API错误 (returning fallback stocks):", error);

    // 返回沪深300核心标的静态列表，确保海外网络下搜索框能工作
    const lowercaseQuery = query.toLowerCase();

    // 优先精确匹配股票代码
    const exactCodeMatches = fallbackStocks.filter(stock =>
      stock.code === query
    );
    if (exactCodeMatches.length > 0) {
      return NextResponse.json({
        success: true,
        data: exactCodeMatches,
        count: exactCodeMatches.length,
        query,
        source: 'fallback',
      });
    }

    // 其次精确匹配股票名称
    const exactNameMatches = fallbackStocks.filter(stock =>
      stock.name.toLowerCase() === lowercaseQuery
    );
    if (exactNameMatches.length > 0) {
      return NextResponse.json({
        success: true,
        data: exactNameMatches,
        count: exactNameMatches.length,
        query,
        source: 'fallback',
      });
    }

    // 最后进行模糊匹配
    const fuzzyMatches = fallbackStocks.filter(stock =>
      stock.code.includes(query) ||
      stock.name.toLowerCase().includes(lowercaseQuery) ||
      stock.market.toLowerCase().includes(lowercaseQuery)
    ).slice(0, 10);

    return NextResponse.json({
      success: true,
      data: fuzzyMatches,
      count: fuzzyMatches.length,
      query,
      source: 'fallback',
    });
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