import { NextRequest, NextResponse } from "next/server"
import { getSearchService } from "@/lib/search-proxy"

// Disable caching for search results
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// 股票搜索结果接口（保持向后兼容）
interface StockResult {
  code: string
  name: string
  market: string
}

// 获取客户端IP地址
function getClientIp(request: NextRequest): string | undefined {
  // 从请求头中获取真实IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // 从请求头中获取其他IP信息
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // 从连接信息中获取
  const connection = request.headers.get('x-forwarded-for');
  if (connection) {
    return connection.split(',')[0].trim();
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const source = searchParams.get("source") || undefined; // 可选：指定数据源

    // 获取客户端IP
    const clientIp = getClientIp(request);

    // 使用新的搜索服务
    const searchService = getSearchService();
    const result = await searchService.search({
      query,
      clientIp,
      useCache: true,
      maxResults: 15,
      timeout: 10000,
      preferredSource: source,
    });

    // 保持向后兼容的响应格式
    return NextResponse.json({
      success: result.success,
      data: result.data,
      count: result.data.length,
      query,
      source: result.source,
      cached: result.cached,
      metadata: result.metadata,
      error: result.error,
    });
  } catch (error) {
    console.error("股票搜索API错误:", error);

    // 使用搜索服务的降级机制
    const searchService = getSearchService();
    const fallbackResults = searchService.search({
      query: searchParams.get("q") || "",
      useCache: false, // 不使用缓存，直接获取降级数据
    }).then(result => result.data).catch(() => []);

    const results = await fallbackResults;

    return NextResponse.json({
      success: results.length > 0,
      data: results,
      count: results.length,
      query: searchParams.get("q") || "",
      source: 'fallback',
      cached: false,
      error: results.length > 0 ? undefined : 'Search service failed',
    });
  }
}

// 管理端点：获取搜索服务状态
export async function POST(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get("action");

    const searchService = getSearchService();

    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          status: searchService.getStatus(),
        });

      case 'clear-cache':
        const cleared = searchService.clearCache();
        return NextResponse.json({
          success: true,
          message: `Cleared ${cleared} cache entries`,
        });

      case 'cleanup-cache':
        const cleaned = searchService.cleanupCache();
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${cleaned} expired cache entries`,
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
        }, { status: 400 });
    }
  } catch (error) {
    console.error("搜索管理API错误:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}