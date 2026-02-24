/**
 * 云函数代理
 * 用于部署到国内服务器，解决海外IP限制问题
 */

import { NextRequest, NextResponse } from 'next/server';

// 允许的源（CORS配置）
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://alpha-quant-copilot.vercel.app',
  // 添加其他允许的域名
];

// 允许的数据源
const ALLOWED_SOURCES = ['sina', 'xueqiu', 'eastmoney', 'tencent'];

interface CloudFunctionRequest {
  query: string;
  source: string;
  url: string;
  headers?: Record<string, string>;
}

interface CloudFunctionResponse {
  success: boolean;
  data: string;
  source: string;
  status: number;
  error?: string;
  metadata?: {
    responseTime: number;
    proxyUsed: boolean;
  };
}

/**
 * 云函数处理程序
 * 部署到国内服务器（如阿里云函数计算、腾讯云函数等）
 */
export async function cloudFunctionHandler(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // 检查CORS
    const origin = request.headers.get('origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return NextResponse.json(
        { error: 'Origin not allowed' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body: CloudFunctionRequest = await request.json();

    // 验证请求参数
    if (!body.query || !body.source || !body.url) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 验证数据源
    if (!ALLOWED_SOURCES.includes(body.source)) {
      return NextResponse.json(
        { error: 'Invalid source' },
        { status: 400 }
      );
    }

    // 执行代理请求
    const result = await executeProxyRequest(body);

    const response: CloudFunctionResponse = {
      ...result,
      metadata: {
        responseTime: Date.now() - startTime,
        proxyUsed: false, // 云函数本身就在国内，不需要额外代理
      },
    };

    // 设置CORS头
    const headers = new Headers();
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    }
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Cloud function error:', error);

    const response: CloudFunctionResponse = {
      success: false,
      data: '',
      source: 'cloud-function',
      status: 500,
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        responseTime: Date.now() - startTime,
        proxyUsed: false,
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * 执行代理请求
 */
async function executeProxyRequest(request: CloudFunctionRequest): Promise<CloudFunctionResponse> {
  const { url, headers, source } = request;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...headers,
      },
      signal: controller.signal,
    });

    const data = await response.text();

    return {
      success: response.ok,
      data,
      source,
      status: response.status,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 健康检查端点
 */
export async function healthCheckHandler(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'search-proxy-cloud-function',
    version: '1.0.0',
    features: {
      proxy: true,
      cors: true,
      sources: ALLOWED_SOURCES,
    },
  });
}

/**
 * 测试端点（用于验证代理功能）
 */
export async function testHandler(request: NextRequest): Promise<NextResponse> {
  const testUrl = 'https://httpbin.org/get';

  try {
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Proxy test successful',
      data: {
        url: testUrl,
        status: response.status,
        headers: data.headers,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Proxy test failed',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * 部署说明：
 *
 * 1. 部署到国内云函数服务：
 *    - 阿里云函数计算：https://www.aliyun.com/product/fc
 *    - 腾讯云函数：https://cloud.tencent.com/product/scf
 *    - 华为云函数：https://www.huaweicloud.com/product/functiongraph.html
 *
 * 2. 配置环境变量：
 *    - 设置允许的源（ALLOWED_ORIGINS）
 *    - 设置API密钥（可选，用于认证）
 *
 * 3. 配置域名：
 *    - 为云函数绑定自定义域名
 *    - 配置SSL证书
 *
 * 4. 更新主应用配置：
 *    - 将SEARCH_PROXY_CLOUD_FUNCTION_URL设置为云函数地址
 *
 * 示例部署命令（阿里云函数计算）：
 *
 * # 安装依赖
 * npm install
 *
 * # 构建
 * npm run build
 *
 * # 部署
 * fun deploy
 *
 * 或使用Serverless Framework：
 *
 * # 安装Serverless Framework
 * npm install -g serverless
 *
 * # 部署
 * serverless deploy
 */