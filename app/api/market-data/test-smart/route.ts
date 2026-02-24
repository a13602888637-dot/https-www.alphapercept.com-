import { NextRequest, NextResponse } from "next/server";
import { fetchStockDataSmart } from "../../../../skills/data_crawler";

// Disable caching for test endpoints
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "000001";

    // 使用智能数据源选择器获取数据
    const marketData = await fetchStockDataSmart(symbol, 2);

    return NextResponse.json({
      success: true,
      symbol,
      price: marketData.currentPrice,
      name: marketData.name,
      change: marketData.change,
      changePercent: marketData.changePercent,
      high: marketData.highPrice,
      low: marketData.lowPrice,
      lastUpdate: marketData.lastUpdateTime,
      source: "smart-selector",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Smart selector test API error:", error);

    return NextResponse.json({
      success: false,
      error: "Failed to fetch data using smart selector",
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}