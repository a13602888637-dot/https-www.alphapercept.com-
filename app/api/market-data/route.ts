import { NextResponse } from "next/server";
import { fetchMultipleStocks } from "../../../skills/data_crawler";

// Disable caching for real-time market data
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// 大盘指数符号映射（带交易所前缀）
const MARKET_INDEX_SYMBOLS = {
  SHANGHAI: 'sh000001',      // 上证指数
  SHENZHEN: 'sz399001',      // 深证成指
  CHUANGYE: 'sz399006',      // 创业板指
};

export async function GET() {
  try {
    const symbols = [
      MARKET_INDEX_SYMBOLS.SHANGHAI,
      MARKET_INDEX_SYMBOLS.SHENZHEN,
      MARKET_INDEX_SYMBOLS.CHUANGYE,
    ];

    // 获取实时指数数据
    const marketDataList = await fetchMultipleStocks(symbols, 2);

    // 格式化响应
    const indices = marketDataList.map((data, index) => {
      let name = '';
      switch (data.symbol) {
        case MARKET_INDEX_SYMBOLS.SHANGHAI:
          name = '上证指数';
          break;
        case MARKET_INDEX_SYMBOLS.SHENZHEN:
          name = '深证成指';
          break;
        case MARKET_INDEX_SYMBOLS.CHUANGYE:
          name = '创业板指';
          break;
        default:
          name = data.name;
      }

      return {
        symbol: data.symbol,
        name,
        price: data.currentPrice,
        change: data.change,
        changePercent: data.changePercent,
        high: data.highPrice,
        low: data.lowPrice,
        lastUpdate: data.lastUpdateTime,
      };
    });

    return NextResponse.json({
      success: true,
      data: indices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching market indices:", error);

    // 不再静默返回模拟数据，而是返回明确的错误信息
    return NextResponse.json({
      success: false,
      data: [],
      error: "Failed to fetch market indices from external APIs",
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      isFallback: false,
      source: 'error',
    }, { status: 500 }); // 返回500错误状态码
  }
}