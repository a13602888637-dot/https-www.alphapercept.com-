import { NextRequest, NextResponse } from 'next/server';
import { searchAggregator } from '@/lib/unified-search/aggregator';
import { MarketType } from '@/lib/unified-search/types';

// 禁用缓存（搜索结果需要实时）
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * 统一检索 API
 * GET /api/unified-search?q=查询关键词&markets=CN_A_STOCK,US_STOCK&limit=15
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // 解析参数
  const query = searchParams.get('q')?.trim() || '';
  const marketsParam = searchParams.get('markets');
  const limitParam = searchParams.get('limit');

  // 参数验证
  if (!query) {
    return NextResponse.json(
      {
        success: false,
        error: 'Query parameter "q" is required',
        data: [],
        metadata: {
          totalResults: 0,
          responseTime: 0,
          sources: []
        }
      },
      { status: 400 }
    );
  }

  if (query.length > 50) {
    return NextResponse.json(
      {
        success: false,
        error: 'Query too long (max 50 characters)',
        data: [],
        metadata: {
          totalResults: 0,
          responseTime: 0,
          sources: []
        }
      },
      { status: 400 }
    );
  }

  // 解析可选参数
  const markets = marketsParam
    ? (marketsParam.split(',') as MarketType[])
    : undefined;

  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100)
    : 15;

  try {
    // 调用聚合器
    const result = await searchAggregator.search(query, {
      markets,
      limit,
      timeout: 10000
    });

    // 返回结果（添加 Edge 缓存）
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Search-Query': query,
        'X-Total-Results': result.metadata.totalResults.toString()
      }
    });

  } catch (error) {
    console.error('Unified search API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        data: [],
        metadata: {
          totalResults: 0,
          responseTime: 0,
          sources: []
        }
      },
      { status: 500 }
    );
  }
}

/**
 * 健康检查端点
 * GET /api/unified-search/health
 */
export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');

  if (action === 'health') {
    try {
      const health = await searchAggregator.getHealthStatus();

      return NextResponse.json({
        success: true,
        sources: health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Health check failed'
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { success: false, error: 'Invalid action' },
    { status: 400 }
  );
}
