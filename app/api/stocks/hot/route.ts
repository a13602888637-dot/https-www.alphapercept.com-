import { NextResponse } from "next/server";

// 禁用缓存以获取实时数据
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * 热门股票API
 * 返回涨幅榜前10的股票
 */
export async function GET() {
  try {
    // TODO: 实现真实的热门股票数据获取
    // 可以从数据库或外部API获取
    // 这里先返回模拟数据

    const mockHotStocks = [
      {
        code: "600519",
        name: "贵州茅台",
        market: "SH",
        changePercent: 3.52,
        currentPrice: 1680.0,
        volume: 1234567,
        industry: "白酒",
      },
      {
        code: "000858",
        name: "五粮液",
        market: "SZ",
        changePercent: 2.85,
        currentPrice: 142.5,
        volume: 9876543,
        industry: "白酒",
      },
      {
        code: "000333",
        name: "美的集团",
        market: "SZ",
        changePercent: 2.67,
        currentPrice: 65.8,
        volume: 8765432,
        industry: "家电",
      },
      {
        code: "600036",
        name: "招商银行",
        market: "SH",
        changePercent: 2.45,
        currentPrice: 38.5,
        volume: 15678900,
        industry: "银行",
      },
      {
        code: "601318",
        name: "中国平安",
        market: "SH",
        changePercent: 2.23,
        currentPrice: 56.8,
        volume: 12345678,
        industry: "保险",
      },
      {
        code: "000001",
        name: "平安银行",
        market: "SZ",
        changePercent: 2.15,
        currentPrice: 12.5,
        volume: 23456789,
        industry: "银行",
      },
      {
        code: "600887",
        name: "伊利股份",
        market: "SH",
        changePercent: 1.98,
        currentPrice: 32.5,
        volume: 7654321,
        industry: "乳制品",
      },
      {
        code: "000002",
        name: "万科A",
        market: "SZ",
        changePercent: 1.85,
        currentPrice: 18.2,
        volume: 18765432,
        industry: "房地产",
      },
      {
        code: "600030",
        name: "中信证券",
        market: "SH",
        changePercent: 1.76,
        currentPrice: 22.8,
        volume: 11234567,
        industry: "证券",
      },
      {
        code: "601012",
        name: "隆基绿能",
        market: "SH",
        changePercent: 1.65,
        currentPrice: 28.5,
        volume: 14567890,
        industry: "光伏",
      },
    ];

    return NextResponse.json({
      success: true,
      data: mockHotStocks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("获取热门股票失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "获取热门股票失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
