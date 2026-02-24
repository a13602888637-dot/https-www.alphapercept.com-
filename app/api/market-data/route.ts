import { NextResponse } from "next/server";
import { fetchMultipleStocksSmart } from "../../../skills/data_crawler";

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

    // 设置超时（5秒）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Market data request timeout after 5 seconds')), 5000);
    });

    // 尝试获取数据，但最多等待5秒
    let marketDataList;
    try {
      marketDataList = await Promise.race([
        fetchMultipleStocksSmart(symbols, 1), // 减少重试次数
        timeoutPromise,
      ]);
    } catch (timeoutError) {
      console.warn('Market data fetch timeout, using simulated data');
      // 生成模拟数据
      marketDataList = symbols.map(symbol => ({
        symbol,
        name: symbol === MARKET_INDEX_SYMBOLS.SHANGHAI ? '上证指数' :
              symbol === MARKET_INDEX_SYMBOLS.SHENZHEN ? '深证成指' : '创业板指',
        currentPrice: symbol === MARKET_INDEX_SYMBOLS.SHANGHAI ? 4100 + Math.random() * 100 :
                     symbol === MARKET_INDEX_SYMBOLS.SHENZHEN ? 14200 + Math.random() * 200 :
                     3300 + Math.random() * 100,
        change: (Math.random() - 0.5) * 50,
        changePercent: (Math.random() - 0.5) * 2,
        highPrice: 0,
        lowPrice: 0,
        lastUpdateTime: new Date().toISOString(),
        volume: 0,
        turnover: 0,
      }));
    }

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
      isFallback: marketDataList[0]?.volume === 0, // 简单判断是否为模拟数据
    });
  } catch (error) {
    console.error("Error fetching market indices:", error);

    return NextResponse.json({
      success: false,
      data: [],
      error: "Failed to fetch market indices from external APIs",
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      isFallback: false,
      source: 'error',
    }, { status: 500 });
  }
}