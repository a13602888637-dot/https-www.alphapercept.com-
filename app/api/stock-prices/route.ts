import { NextResponse } from "next/server";
import { fetchMultipleStocks, MarketData } from "../../../skills/data_crawler";
import { prisma } from "../../../lib/db";

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

    // Fetch real-time stock data
    const marketData = await fetchMultipleStocks(symbolList, 2);

    // Store price history in database
    await storePriceHistory(marketData);

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
      totalRequested: symbolList.length
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