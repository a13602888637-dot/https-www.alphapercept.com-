/**
 * 股票历史数据缓存API
 * POST /api/stock-data-cache — 批量抓取并缓存A股历史K线到数据库
 * GET /api/stock-data-cache?code=600519 — 查询某只股票的缓存数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 核心A股列表（60+只主要个股 + 指数）
const CORE_STOCKS: string[] = [
  // 指数
  '000300', '000905',
  // 银行
  '600036', '601398', '601288', '601939', '601988', '601328', '601166', '600000', '600016', '000001',
  // 保险
  '601318', '601601', '601628',
  // 券商
  '600030', '601211', '601688', '000776',
  // 白酒/消费
  '600519', '000858', '000568', '600809', '002304', '603288', '600887', '000895',
  // 医药
  '600276', '300015', '300760', '300122', '603259', '000538', '600436',
  // 科技
  '002415', '002475', '300750', '002230', '000977', '688981', '300059',
  // 新能源
  '002594', '601012',
  // 制造/基建
  '000333', '000651', '600031', '000625', '601766', '601800', '601668', '000338',
  // 能源/资源
  '601857', '600028', '601088', '601899', '601985', '600900',
  // 其他
  '000002', '000063', '000725', '002352', '002714', '600009', '600048', '600050',
  '600104', '600309', '600585', '600690', '601006', '601888', '601919', '600026',
];

// 东方财富K线数据获取
async function fetchEastmoneyKline(code: string, limit: number = 250): Promise<Array<{
  date: string; open: number; close: number; high: number; low: number; volume: number; turnover: number;
}>> {
  // 构造secid
  let secid: string;
  if (code === '000300' || code === '000905') {
    secid = `1.${code}`;
  } else if (code.startsWith('399')) {
    secid = `0.${code}`;
  } else if (code.startsWith('6') || code.startsWith('9')) {
    secid = `1.${code}`;
  } else {
    secid = `0.${code}`;
  }

  const params = new URLSearchParams({
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101', // 日K
    fqt: '1',   // 前复权
    end: '20500101',
    lmt: limit.toString(),
  });

  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?${params}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://quote.eastmoney.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Eastmoney API error: ${response.status}`);
    const json = await response.json();

    if (!json.data?.klines || !Array.isArray(json.data.klines)) {
      return [];
    }

    return json.data.klines.map((line: string) => {
      const parts = line.split(',');
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseFloat(parts[5]),
        turnover: parseFloat(parts[6]),
      };
    }).filter((d: any) => !isNaN(d.open) && !isNaN(d.close));
  } finally {
    clearTimeout(timeout);
  }
}

// POST: 批量缓存历史数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const codes: string[] = body.codes || CORE_STOCKS;
    const limit: number = body.limit || 250; // 默认250个交易日（约1年）
    const batchSize: number = body.batchSize || 5; // 每批并发数

    const results: { code: string; stored: number; error?: string }[] = [];
    let totalStored = 0;

    // 分批处理避免API压力
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (code) => {
          try {
            const klines = await fetchEastmoneyKline(code, limit);
            if (klines.length === 0) {
              return { code, stored: 0, error: 'No data from API' };
            }

            let stored = 0;
            // 逐条写入（使用 upsert 避免重复）
            for (const kline of klines) {
              const timestamp = new Date(kline.date + 'T00:00:00Z');
              const prevClose = kline.open; // 简化：用开盘价近似昨收
              const change = parseFloat((kline.close - prevClose).toFixed(4));
              const changePercent = prevClose > 0
                ? parseFloat(((change / prevClose) * 100).toFixed(4))
                : 0;

              try {
                await prisma.stockPriceHistory.upsert({
                  where: {
                    stockCode_timestamp: {
                      stockCode: code,
                      timestamp,
                    },
                  },
                  update: {
                    price: kline.close,
                    highPrice: kline.high,
                    lowPrice: kline.low,
                    volume: kline.volume,
                    turnover: kline.turnover,
                    change,
                    changePercent,
                  },
                  create: {
                    stockCode: code,
                    price: kline.close,
                    highPrice: kline.high,
                    lowPrice: kline.low,
                    volume: kline.volume,
                    turnover: kline.turnover,
                    change,
                    changePercent,
                    timestamp,
                  },
                });
                stored++;
              } catch {
                // 忽略单条写入错误
              }
            }

            return { code, stored };
          } catch (error) {
            return { code, stored: 0, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          totalStored += result.value.stored;
        } else {
          results.push({ code: 'unknown', stored: 0, error: result.reason?.message });
        }
      }

      // 批间延迟500ms避免API限流
      if (i + batchSize < codes.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return NextResponse.json({
      success: true,
      totalCodes: codes.length,
      totalStored,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stock data cache error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// GET: 查询缓存数据
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '250', 10);

    if (!code) {
      // 返回缓存统计
      const stats = await prisma.stockPriceHistory.groupBy({
        by: ['stockCode'],
        _count: { id: true },
        _min: { timestamp: true },
        _max: { timestamp: true },
      });

      return NextResponse.json({
        success: true,
        totalCodes: stats.length,
        stats: stats.map(s => ({
          code: s.stockCode,
          count: s._count.id,
          from: s._min.timestamp,
          to: s._max.timestamp,
        })),
      });
    }

    // 查询特定股票的历史数据
    const data = await prisma.stockPriceHistory.findMany({
      where: { stockCode: code },
      orderBy: { timestamp: 'asc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      code,
      count: data.length,
      data: data.map(d => ({
        time: d.timestamp.toISOString().split('T')[0],
        open: Number(d.price), // 简化
        close: Number(d.price),
        high: Number(d.highPrice || d.price),
        low: Number(d.lowPrice || d.price),
        volume: Number(d.volume || 0),
        change: Number(d.change || 0),
        changePercent: Number(d.changePercent || 0),
      })),
    });
  } catch (error) {
    console.error('Stock data cache query error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
