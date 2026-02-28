/**
 * K线数据API路由
 * GET /api/kline?code=000001&timeframe=daily&limit=200
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKLineData } from '@/lib/kline-api';
import type { TimeFrame } from '@/lib/kline-api';

export const dynamic = 'force-dynamic';

// 支持的时间周期
const VALID_TIMEFRAMES: TimeFrame[] = ['5m', '15m', '30m', '60m', 'daily', 'weekly', 'monthly'];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const timeframe = searchParams.get('timeframe') || 'daily';
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    // 参数验证
    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: code',
        },
        { status: 400 }
      );
    }

    if (!VALID_TIMEFRAMES.includes(timeframe as TimeFrame)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid timeframe. Must be one of: ${VALID_TIMEFRAMES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit <= 0 || limit > 1000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid limit. Must be between 1 and 1000',
        },
        { status: 400 }
      );
    }

    // 获取K线数据（带降级策略）
    const result = await getKLineData({
      stockCode: code,
      timeFrame: timeframe as TimeFrame,
      limit,
    });

    // 返回数据
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });

  } catch (error) {
    console.error('[API /kline] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        data: [],
        source: 'mock',
        cached: false,
      },
      { status: 500 }
    );
  }
}

// 支持OPTIONS请求（CORS预检）
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
