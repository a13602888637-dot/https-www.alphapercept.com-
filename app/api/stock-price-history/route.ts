import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

// Disable caching for historical data
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// GET: Get stock price history for trend analysis
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const stockCode = searchParams.get("stockCode");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const interval = searchParams.get("interval") || "day"; // day, hour, minute
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!stockCode) {
      return NextResponse.json(
        { error: "Stock code parameter is required" },
        { status: 400 }
      );
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    // Validate date range
    if (start > end) {
      return NextResponse.json(
        { error: "Start date must be before end date" },
        { status: 400 }
      );
    }

    // Calculate interval based on requested granularity
    let groupBy: string;
    let dateFormat: string;

    switch (interval) {
      case "minute":
        groupBy = "DATE_TRUNC('minute', timestamp)";
        dateFormat = "YYYY-MM-DD HH24:MI";
        break;
      case "hour":
        groupBy = "DATE_TRUNC('hour', timestamp)";
        dateFormat = "YYYY-MM-DD HH24";
        break;
      case "day":
      default:
        groupBy = "DATE_TRUNC('day', timestamp)";
        dateFormat = "YYYY-MM-DD";
        break;
    }

    // Use raw SQL query for efficient aggregation
    const priceHistory = await prisma.$queryRaw`
      SELECT
        ${groupBy} as timestamp,
        AVG(price::float) as avg_price,
        MAX(price::float) as high_price,
        MIN(price::float) as low_price,
        SUM(volume::float) as total_volume,
        SUM(turnover::float) as total_turnover,
        COUNT(*) as data_points
      FROM "StockPriceHistory"
      WHERE
        "stockCode" = ${stockCode}
        AND timestamp >= ${start}
        AND timestamp <= ${end}
      GROUP BY ${groupBy}
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    // Calculate additional metrics
    const formattedHistory = (priceHistory as any[]).map((record, index, array) => {
      const prevRecord = array[index + 1];
      const change = prevRecord ? record.avg_price - prevRecord.avg_price : 0;
      const changePercent = prevRecord && prevRecord.avg_price > 0 ? (change / prevRecord.avg_price) * 100 : 0;

      return {
        timestamp: record.timestamp,
        price: parseFloat(record.avg_price.toFixed(2)),
        high: parseFloat(record.high_price.toFixed(2)),
        low: parseFloat(record.low_price.toFixed(2)),
        volume: record.total_volume ? parseFloat(record.total_volume.toFixed(0)) : null,
        turnover: record.total_turnover ? parseFloat(record.total_turnover.toFixed(0)) : null,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        dataPoints: record.data_points
      };
    });

    // Calculate trend indicators
    const trendAnalysis = calculateTrendIndicators(formattedHistory);

    return NextResponse.json({
      success: true,
      stockCode,
      interval,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      data: formattedHistory.reverse(), // Return in chronological order
      analysis: trendAnalysis,
      metadata: {
        totalRecords: formattedHistory.length,
        firstRecord: formattedHistory[0]?.timestamp || null,
        lastRecord: formattedHistory[formattedHistory.length - 1]?.timestamp || null
      }
    });
  } catch (error) {
    console.error("Error fetching stock price history:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch stock price history",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate trend indicators from price history
 */
function calculateTrendIndicators(priceHistory: any[]) {
  if (priceHistory.length < 2) {
    return {
      trend: "insufficient_data",
      strength: 0,
      volatility: 0,
      support: null,
      resistance: null,
      movingAverages: {}
    };
  }

  const prices = priceHistory.map(record => record.price);
  const volumes = priceHistory.map(record => record.volume || 0);

  // Calculate simple moving averages
  const sma5 = calculateSMA(prices, 5);
  const sma10 = calculateSMA(prices, 10);
  const sma20 = calculateSMA(prices, 20);
  const sma60 = calculateSMA(prices, 60);

  // Determine trend direction
  const recentPrices = prices.slice(-10);
  const priceChange = recentPrices[recentPrices.length - 1] - recentPrices[0];
  const trendDirection = priceChange > 0 ? "up" : priceChange < 0 ? "down" : "sideways";

  // Calculate trend strength (R-squared of linear regression)
  const trendStrength = calculateTrendStrength(prices);

  // Calculate volatility (standard deviation of returns)
  const volatility = calculateVolatility(prices);

  // Identify support and resistance levels
  const { support, resistance } = identifySupportResistance(prices);

  // Volume analysis
  const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
  const recentVolume = volumes.slice(-5).reduce((sum, vol) => sum + vol, 0) / 5;
  const volumeTrend = recentVolume > avgVolume * 1.2 ? "increasing" : recentVolume < avgVolume * 0.8 ? "decreasing" : "stable";

  return {
    trend: trendDirection,
    strength: parseFloat(trendStrength.toFixed(2)),
    volatility: parseFloat(volatility.toFixed(4)),
    support: support ? parseFloat(support.toFixed(2)) : null,
    resistance: resistance ? parseFloat(resistance.toFixed(2)) : null,
    movingAverages: {
      sma5: sma5 ? parseFloat(sma5.toFixed(2)) : null,
      sma10: sma10 ? parseFloat(sma10.toFixed(2)) : null,
      sma20: sma20 ? parseFloat(sma20.toFixed(2)) : null,
      sma60: sma60 ? parseFloat(sma60.toFixed(2)) : null
    },
    volumeAnalysis: {
      averageVolume: parseFloat(avgVolume.toFixed(0)),
      recentVolume: parseFloat(recentVolume.toFixed(0)),
      trend: volumeTrend
    },
    priceAction: {
      currentPrice: prices[prices.length - 1],
      high: Math.max(...prices),
      low: Math.min(...prices),
      range: Math.max(...prices) - Math.min(...prices)
    }
  };
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const recentPrices = prices.slice(-period);
  const sum = recentPrices.reduce((total, price) => total + price, 0);
  return sum / period;
}

/**
 * Calculate trend strength using linear regression R-squared
 */
function calculateTrendStrength(prices: number[]): number {
  if (prices.length < 2) return 0;

  const n = prices.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = prices;

  // Calculate means
  const xMean = x.reduce((sum, val) => sum + val, 0) / n;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += Math.pow(x[i] - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Calculate R-squared
  let ssTotal = 0;
  let ssResidual = 0;

  for (let i = 0; i < n; i++) {
    const yPred = slope * x[i] + intercept;
    ssTotal += Math.pow(y[i] - yMean, 2);
    ssResidual += Math.pow(y[i] - yPred, 2);
  }

  const rSquared = ssTotal !== 0 ? 1 - (ssResidual / ssTotal) : 0;
  return Math.max(0, Math.min(1, rSquared)); // Clamp between 0 and 1
}

/**
 * Calculate volatility (standard deviation of returns)
 */
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const returnVal = (prices[i] - prices[i-1]) / prices[i-1];
    returns.push(returnVal);
  }

  const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

/**
 * Identify support and resistance levels
 */
function identifySupportResistance(prices: number[]): { support: number | null; resistance: number | null } {
  if (prices.length < 10) return { support: null, resistance: null };

  // Simple approach: use recent highs and lows
  const recentPrices = prices.slice(-20);
  const currentPrice = prices[prices.length - 1];

  const high = Math.max(...recentPrices);
  const low = Math.min(...recentPrices);

  // Calculate pivot points
  const pivot = (high + low + currentPrice) / 3;
  const resistance1 = 2 * pivot - low;
  const support1 = 2 * pivot - high;

  return {
    support: support1 < currentPrice ? support1 : null,
    resistance: resistance1 > currentPrice ? resistance1 : null
  };
}