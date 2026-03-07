import { NextResponse } from "next/server";
import { fetchMultipleStocks, MarketData } from "../../../skills/data_crawler";
import { prisma } from "../../../lib/db";

// Disable caching for real-time stock prices
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// 股票名称映射（fallback时使用真实名称）
const STOCK_NAME_MAP: Record<string, string> = {
  "000001": "平安银行", "000002": "万科A", "000063": "中兴通讯", "000333": "美的集团",
  "000338": "潍柴动力", "000538": "云南白药", "000568": "泸州老窖", "000625": "长安汽车",
  "000651": "格力电器", "000725": "京东方A", "000776": "广发证券", "000858": "五粮液",
  "000895": "双汇发展", "000977": "浪潮信息", "002142": "宁波银行", "002230": "科大讯飞",
  "002304": "洋河股份", "002352": "顺丰控股", "002415": "海康威视", "002475": "立讯精密",
  "002594": "比亚迪", "002714": "牧原股份", "300015": "爱尔眼科", "300059": "东方财富",
  "300122": "智飞生物", "300750": "宁德时代", "300760": "迈瑞医疗",
  "600000": "浦发银行", "600009": "上海机场", "600016": "民生银行",
  "600026": "中远海能", "600028": "中国石化", "600030": "中信证券", "600031": "三一重工",
  "600036": "招商银行", "600048": "保利发展", "600050": "中国联通", "600104": "上汽集团",
  "600276": "恒瑞医药", "600309": "万华化学", "600436": "片仔癀", "600519": "贵州茅台",
  "600585": "海螺水泥", "600690": "海尔智家", "600809": "山西汾酒", "600887": "伊利股份",
  "600900": "长江电力", "601006": "大秦铁路", "601012": "隆基绿能", "601088": "中国神华",
  "601166": "兴业银行", "601211": "国泰君安", "601288": "农业银行", "601318": "中国平安",
  "601328": "交通银行", "601398": "工商银行", "601601": "中国太保", "601628": "中国人寿",
  "601668": "中国建筑", "601688": "华泰证券", "601766": "中国中车", "601800": "中国交建",
  "601857": "中国石油", "601888": "中国中免", "601899": "紫金矿业", "601919": "中远海控",
  "601939": "建设银行", "601985": "中国核电", "601988": "中国银行",
  "603259": "药明康德", "603288": "海天味业", "688981": "中芯国际",
  // 指数
  "000300": "沪深300", "000905": "中证500", "399001": "深证成指", "399006": "创业板指",
};

/**
 * 尝试用腾讯财经API获取实时行情（对境外IP限制较松）
 */
async function fetchFromTencent(symbols: string[]): Promise<MarketData[]> {
  // 构造腾讯API的股票代码（sh/sz前缀）
  // 注意：指数检查必须在通用前缀检查之前
  const tencentSymbols = symbols.map(s => {
    // 指数优先判断
    if (s === '000300' || s === '000905') return `sh${s}`;
    if (s.startsWith('399')) return `sz${s}`;
    // 普通股票
    if (s.startsWith('6') || s.startsWith('9')) return `sh${s}`;
    if (s.startsWith('0') || s.startsWith('3')) return `sz${s}`;
    return `sh${s}`;
  });

  const url = `https://qt.gtimg.cn/q=${tencentSymbols.join(',')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://finance.qq.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Tencent API error: ${response.status}`);

    const text = await response.text();
    const results: MarketData[] = [];

    // 解析腾讯API响应: v_sh600519="1~贵州茅台~600519~1800.00~1790.00~...";
    const lines = text.split(';').filter(l => l.trim());
    for (const line of lines) {
      try {
        const match = line.match(/v_\w+="(.+)"/);
        if (!match) continue;
        const parts = match[1].split('~');
        if (parts.length < 40) continue;

        const symbol = parts[2]; // 股票代码
        const name = parts[1];   // 股票名称
        const currentPrice = parseFloat(parts[3]);
        const prevClose = parseFloat(parts[4]);
        const change = parseFloat((currentPrice - prevClose).toFixed(2));
        const changePercent = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;

        if (currentPrice > 0) {
          const highPrice = parseFloat(parts[33]) || currentPrice;
          const lowPrice = parseFloat(parts[34]) || currentPrice;
          const openPrice = parseFloat(parts[5]) || prevClose;

          // 委比计算：(委买量总和 - 委卖量总和) / (委买量总和 + 委卖量总和) × 100
          const buyVol = [10, 11, 12, 13, 14].reduce((sum, i) => sum + (parseInt(parts[i]) || 0), 0);
          const sellVol = [20, 21, 22, 23, 24].reduce((sum, i) => sum + (parseInt(parts[i]) || 0), 0);
          const totalOrderVol = buyVol + sellVol;
          const bidRatio = totalOrderVol > 0
            ? parseFloat(((buyVol - sellVol) / totalOrderVol * 100).toFixed(2))
            : 0;

          results.push({
            symbol,
            name,
            currentPrice,
            highPrice,
            lowPrice,
            openPrice,
            prevClose,
            lastUpdateTime: new Date().toISOString(),
            change,
            changePercent,
            volume: parseInt(parts[6]) || 0,
            turnover: parseFloat(parts[37]) || 0,
            turnoverRate: parseFloat(parts[38]) || 0,
            peRatio: parseFloat(parts[39]) || 0,
            amplitude: parseFloat(parts[43]) || (prevClose > 0 ? parseFloat(((highPrice - lowPrice) / prevClose * 100).toFixed(2)) : 0),
            circulatingMarketCap: parseFloat(parts[44]) || 0,
            marketCap: parseFloat(parts[45]) || 0,
            pbRatio: parseFloat(parts[46]) || 0,
            volumeRatio: parseFloat(parts[49]) || 0,
            limitUp: parseFloat(parts[47]) || 0,
            limitDown: parseFloat(parts[48]) || 0,
            outerVolume: parseInt(parts[7]) || 0,
            innerVolume: parseInt(parts[8]) || 0,
            bidRatio,
          });
        }
      } catch {
        continue;
      }
    }

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

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

    let marketData: MarketData[] = [];
    let isFallback = false;
    let source = 'unknown';

    // 策略1: 尝试 Sina API（原有逻辑）
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 4000);
      });
      marketData = await Promise.race([
        fetchMultipleStocks(symbolList, 1),
        timeoutPromise,
      ]);
      source = 'sina';
    } catch {
      // 策略2: 尝试腾讯API
      try {
        marketData = await fetchFromTencent(symbolList);
        if (marketData.length > 0) {
          source = 'tencent';
        }
      } catch (tencentError) {
        console.warn('Tencent API also failed:', tencentError);
      }
    }

    // 策略3: 数据库历史数据降级
    if (marketData.length === 0) {
      try {
        const dbResults = await Promise.all(
          symbolList.map(async (symbol) => {
            const record = await prisma.stockPriceHistory.findFirst({
              where: { stockCode: symbol },
              orderBy: { timestamp: 'desc' },
            });
            if (record) {
              return {
                symbol,
                name: STOCK_NAME_MAP[symbol] || symbol,
                currentPrice: Number(record.price),
                highPrice: Number(record.highPrice || record.price),
                lowPrice: Number(record.lowPrice || record.price),
                lastUpdateTime: record.timestamp.toISOString(),
                change: Number(record.change || 0),
                changePercent: Number(record.changePercent || 0),
                volume: record.volume || 0,
                turnover: record.turnover || 0,
              };
            }
            return null;
          })
        );
        const validResults = dbResults.filter((r): r is MarketData => r !== null);
        if (validResults.length > 0) {
          marketData = validResults;
          source = 'database';
          isFallback = true;
        }
      } catch (dbError) {
        console.warn('Database fallback failed:', dbError);
      }
    }

    // 策略4: 最后降级 — 使用名称映射但标明无数据
    if (marketData.length === 0) {
      isFallback = true;
      source = 'unavailable';
      marketData = symbolList.map(symbol => ({
        symbol,
        name: STOCK_NAME_MAP[symbol] || symbol,
        currentPrice: 0,
        highPrice: 0,
        lowPrice: 0,
        lastUpdateTime: new Date().toISOString(),
        change: 0,
        changePercent: 0,
        volume: 0,
        turnover: 0,
      }));
    }

    // 只有真实数据才存储到数据库
    if (!isFallback) {
      await storePriceHistory(marketData);
    }

    // Format response
    const priceData = marketData.reduce((acc, data) => {
      acc[data.symbol] = {
        price: data.currentPrice,
        change: data.change,
        changePercent: data.changePercent,
        high: data.highPrice,
        low: data.lowPrice,
        open: data.openPrice,
        prevClose: data.prevClose,
        volume: data.volume,
        turnover: data.turnover,
        lastUpdate: data.lastUpdateTime,
        name: data.name,
        // 扩展指标
        turnoverRate: data.turnoverRate,
        volumeRatio: data.volumeRatio,
        amplitude: data.amplitude,
        bidRatio: data.bidRatio,
        peRatio: data.peRatio,
        pbRatio: data.pbRatio,
        marketCap: data.marketCap,
        circulatingMarketCap: data.circulatingMarketCap,
        limitUp: data.limitUp,
        limitDown: data.limitDown,
        outerVolume: data.outerVolume,
        innerVolume: data.innerVolume,
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