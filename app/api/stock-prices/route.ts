import { NextResponse } from "next/server";
import { fetchMultipleStocks, MarketData } from "../../../skills/data_crawler";
import { prisma } from "../../../lib/db";

// Disable caching for real-time stock prices
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// GET: Get real-time stock prices for multiple symbols
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbols = searchParams.get("symbols");

    if (!symbols) {
      return NextResponse.json(
        { error: "Symbols parameter is required" },
        { status: 400 }
      );
    }

    const symbolList = symbols.split(",").map(s => s.trim()).filter(s => s.length > 0);

    if (symbolList.length === 0) {
      return NextResponse.json(
        { error: "No valid symbols provided" },
        { status: 400 }
      );
    }

    // 设置超时（5秒）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Stock prices request timeout after 5 seconds')), 5000);
    });

    let marketData;
    let isFallback = false;

    try {
      // 尝试获取数据，但最多等待5秒
      marketData = await Promise.race([
        fetchMultipleStocks(symbolList, 1), // 减少重试次数
        timeoutPromise,
      ]);
    } catch (timeoutError) {
      console.warn('Stock prices fetch timeout, using simulated data');
      isFallback = true;

      // 生成模拟数据
      marketData = symbolList.map(symbol => {
        const basePrice = 10 + Math.random() * 100;
        const change = (Math.random() - 0.5) * 5;
        const changePercent = (change / basePrice) * 100;

        return {
          symbol,
          name: symbol,
          currentPrice: parseFloat(basePrice.toFixed(2)),
          highPrice: parseFloat((basePrice + Math.random() * 5).toFixed(2)),
          lowPrice: parseFloat((basePrice - Math.random() * 3).toFixed(2)),
          lastUpdateTime: new Date().toISOString(),
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          volume: Math.floor(Math.random() * 1000000),
          turnover: Math.floor(Math.random() * 10000000),
        };
      });
    }

    // 只有真实数据才存储到数据库
    // 暂时注释掉数据库存储，因为Prisma模型可能有问题
    // if (!isFallback) {
    //   await storePriceHistory(marketData);
    // }

    // Format response
    const priceData = marketData.reduce((acc, data) => {
      acc[data.symbol] = {
        price: data.currentPrice,
        change: data.change,
        changePercent: data.changePercent,
        high: data.highPrice,
        low: data.lowPrice,
        volume: data.volume,
        turnover: data.turnover,
        lastUpdate: data.lastUpdateTime,
        name: data.name
      };
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      success: true,
      prices: priceData,
      timestamp: new Date().toISOString(),
      count: marketData.length,
      totalRequested: symbolList.length,
      isFallback
    });
  } catch (error) {
    console.error("Error fetching stock prices:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch stock prices",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Store price history in database
 * Only store if price has changed significantly (> 0.01%) to avoid duplicate records
 */
async function storePriceHistory(marketData: MarketData[]): Promise<void> {
  try {
    const now = new Date();
    const timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0); // Round to minute

    const createPromises = marketData.map(async (data) => {
      try {
        // Check if we already have a record for this stock at this minute
        const existingRecord = await prisma.stockPriceHistory.findFirst({
          where: {
            stockCode: data.symbol,
            timestamp: {
              gte: new Date(timestamp.getTime() - 60000), // Within last minute
              lte: timestamp
            }
          },
          orderBy: {
            timestamp: 'desc'
          }
        });

        // Only store if price changed significantly (> 0.01%)
        const shouldStore = !existingRecord ||
          Math.abs((data.currentPrice - Number(existingRecord.price)) / Number(existingRecord.price)) > 0.0001;

        if (shouldStore) {
          await prisma.stockPriceHistory.create({
            data: {
              stockCode: data.symbol,
              price: data.currentPrice,
              volume: data.volume,
              turnover: data.turnover,
              highPrice: data.highPrice,
              lowPrice: data.lowPrice,
              change: data.change,
              changePercent: data.changePercent,
              timestamp: timestamp
            }
          });
        }
      } catch (error) {
        console.error(`Error storing price history for ${data.symbol}:`, error);
        // Don't throw, continue with other stocks
      }
    });

    await Promise.all(createPromises);
  } catch (error) {
    console.error("Error in storePriceHistory:", error);
    // Don't throw, just log the error
  }
}