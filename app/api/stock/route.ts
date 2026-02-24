import { NextResponse } from "next/server";

// 代理 Yahoo Finance API 请求，解决 CORS 问题
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol parameter is required" },
        { status: 400 }
      );
    }

    // 转换符号为 Yahoo Finance 格式
    let yahooSymbol = symbol;

    // 如果符号已经有 .SS 或 .SZ 后缀，直接使用
    if (!symbol.includes('.')) {
      // 移除 sh/sz 前缀（如果存在）
      let cleanSymbol = symbol.replace(/^(sh|sz)/i, '');

      // 确定交易所后缀
      if (cleanSymbol.startsWith('6') || cleanSymbol === '000001') {
        yahooSymbol = cleanSymbol + '.SS'; // 上海
      } else if (cleanSymbol.startsWith('0') || cleanSymbol.startsWith('3') || cleanSymbol === '399001') {
        yahooSymbol = cleanSymbol + '.SZ'; // 深圳
      } else {
        yahooSymbol = cleanSymbol + '.SS'; // 默认上海
      }
    } else {
      // 符号已有后缀，确保大写
      yahooSymbol = yahooSymbol.toUpperCase();
    }

    const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=3mo`;

    // 配置代理（使用本地1087代理解决海外IP限制）
    const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:1087';

    // 使用增强的头部信息绕过限制
    const fetchOptions: RequestInit = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'DNT': '1',
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    try {
      const response = await fetch(apiUrl, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // 返回原始 Yahoo Finance 数据，让前端解析
      return NextResponse.json({
        success: true,
        data,
        symbol,
        yahooSymbol,
        source: 'yahoo-finance-proxy',
        timestamp: new Date().toISOString(),
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    console.error("Error proxying Yahoo Finance request:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch data from Yahoo Finance",
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// 支持 OPTIONS 请求用于 CORS 预检
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}