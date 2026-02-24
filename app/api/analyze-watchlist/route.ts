import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { runCompleteIntelligencePipeline } from "../../../skills/deepseek_agent";
import { fetchMultipleStocks } from "../../../skills/data_crawler";

// GET: 分析用户的自选股列表
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取用户
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    // 如果用户不存在，创建它（回退机制）
    if (!user) {
      console.log(`User ${clerkUserId} not found, creating fallback user record`);
      try {
        user = await prisma.user.create({
          data: {
            clerkUserId,
            email: null,
            username: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            metadata: {
              createdVia: "analyze_watchlist_api_fallback",
              createdAt: Date.now(),
            },
            settings: {
              notificationPreferences: {
                email: true,
                push: true,
              },
              theme: "dark",
              language: "zh-CN",
              tradingPreferences: {
                riskLevel: "medium",
                autoStopLoss: true,
                notificationEnabled: true,
              },
            },
          },
        });
        console.log(`Fallback user created: ${user.id}`);
      } catch (error) {
        console.error("Error creating fallback user:", error);
        return NextResponse.json(
          { error: "Failed to create user record" },
          { status: 500 }
        );
      }
    }

    // 获取用户的自选股列表
    const watchlist = await prisma.watchlist.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (watchlist.length === 0) {
      return NextResponse.json({
        success: true,
        message: "自选股列表为空",
        analysis: [],
        savedCount: 0
      });
    }

    // 提取股票代码
    const stockSymbols = watchlist.map(item => item.stockCode);
    console.log(`开始分析自选股，共 ${stockSymbols.length} 只股票:`, stockSymbols);

    // 运行完整的智能情报流水线
    const result = await runCompleteIntelligencePipeline(
      stockSymbols,
      user.id,
      process.env.DEEPSEEK_API_KEY
    );

    if (!result.success) {
      console.error("智能情报流水线失败:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "智能分析失败",
          analysis: []
        },
        { status: 500 }
      );
    }

    // 获取最新的智能情报数据
    const recentFeeds = await prisma.intelligenceFeed.findMany({
      where: {
        userId: user.id,
        stockCode: { in: stockSymbols }
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['stockCode'] // 每个股票只取最新的一条
    });

    // 获取当前市场价格
    let currentPrices: Record<string, number> = {};
    try {
      const marketData = await fetchMultipleStocks(stockSymbols);
      marketData.forEach(stock => {
        currentPrices[stock.symbol] = stock.currentPrice;
      });
    } catch (error) {
      console.warn('获取市场价格失败，使用默认值:', error);
      // 如果获取失败，使用默认值
      stockSymbols.forEach(symbol => {
        currentPrices[symbol] = 0;
      });
    }

    // 格式化分析结果
    const analysis = watchlist.map(item => {
      const feed = recentFeeds.find(f => f.stockCode === item.stockCode);
      const currentPrice = currentPrices[item.stockCode] || 0;

      return {
        id: item.id,
        stockCode: item.stockCode,
        stockName: item.stockName,
        buyPrice: item.buyPrice ? item.buyPrice.toNumber() : null,
        stopLossPrice: item.stopLossPrice ? item.stopLossPrice.toNumber() : null,
        targetPrice: item.targetPrice ? item.targetPrice.toNumber() : null,
        notes: item.notes,
        currentPrice: currentPrice,
        analysis: feed ? {
          eventSummary: feed.eventSummary,
          industryTrend: feed.industryTrend,
          trapProbability: feed.trapProbability,
          actionSignal: feed.actionSignal,
          targetPrice: feed.targetPrice ? feed.targetPrice.toNumber() : null,
          stopLoss: feed.stopLoss ? feed.stopLoss.toNumber() : null,
          logicChain: feed.logicChain,
          createdAt: feed.createdAt
        } : null,
        warningLevel: feed && feed.trapProbability > 50 ? 'high' :
                     feed && feed.trapProbability > 30 ? 'medium' : 'low'
      };
    });

    return NextResponse.json({
      success: true,
      message: `成功分析 ${analysis.length} 只自选股`,
      analysis: analysis,
      savedCount: result.savedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error analyzing watchlist:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        analysis: []
      },
      { status: 500 }
    );
  }
}

// POST: 手动触发自选股分析（支持指定股票）
export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取用户
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    // 如果用户不存在，创建它（回退机制）
    if (!user) {
      console.log(`User ${clerkUserId} not found, creating fallback user record`);
      try {
        user = await prisma.user.create({
          data: {
            clerkUserId,
            email: null,
            username: null,
            firstName: null,
            lastName: null,
            imageUrl: null,
            metadata: {
              createdVia: "analyze_watchlist_api_fallback",
              createdAt: Date.now(),
            },
            settings: {
              notificationPreferences: {
                email: true,
                push: true,
              },
              theme: "dark",
              language: "zh-CN",
              tradingPreferences: {
                riskLevel: "medium",
                autoStopLoss: true,
                notificationEnabled: true,
              },
            },
          },
        });
        console.log(`Fallback user created: ${user.id}`);
      } catch (error) {
        console.error("Error creating fallback user:", error);
        return NextResponse.json(
          { error: "Failed to create user record" },
          { status: 500 }
        );
      }
    }

    const body = await req.json();
    const { stockSymbols } = body;

    let targetSymbols: string[] = [];

    if (stockSymbols && Array.isArray(stockSymbols) && stockSymbols.length > 0) {
      // 使用指定的股票代码
      targetSymbols = stockSymbols;
      console.log(`手动分析指定股票:`, targetSymbols);
    } else {
      // 获取用户的自选股列表
      const watchlist = await prisma.watchlist.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      if (watchlist.length === 0) {
        return NextResponse.json({
          success: true,
          message: "自选股列表为空",
          analysis: [],
          savedCount: 0
        });
      }

      targetSymbols = watchlist.map(item => item.stockCode);
      console.log(`分析全部自选股，共 ${targetSymbols.length} 只股票:`, targetSymbols);
    }

    // 运行完整的智能情报流水线
    const result = await runCompleteIntelligencePipeline(
      targetSymbols,
      user.id,
      process.env.DEEPSEEK_API_KEY
    );

    if (!result.success) {
      console.error("智能情报流水线失败:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "智能分析失败",
          analysis: []
        },
        { status: 500 }
      );
    }

    // 获取最新的智能情报数据
    const recentFeeds = await prisma.intelligenceFeed.findMany({
      where: {
        userId: user.id,
        stockCode: { in: targetSymbols }
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['stockCode'] // 每个股票只取最新的一条
    });

    // 获取当前市场价格
    let currentPrices: Record<string, number> = {};
    try {
      const marketData = await fetchMultipleStocks(targetSymbols);
      marketData.forEach(stock => {
        currentPrices[stock.symbol] = stock.currentPrice;
      });
    } catch (error) {
      console.warn('获取市场价格失败，使用默认值:', error);
      // 如果获取失败，使用默认值
      targetSymbols.forEach(symbol => {
        currentPrices[symbol] = 0;
      });
    }

    // 获取自选股详细信息
    const watchlistItems = await prisma.watchlist.findMany({
      where: {
        userId: user.id,
        stockCode: { in: targetSymbols }
      },
    });

    // 格式化分析结果
    const analysis = targetSymbols.map(stockCode => {
      const feed = recentFeeds.find(f => f.stockCode === stockCode);
      const watchlistItem = watchlistItems.find(w => w.stockCode === stockCode);
      const currentPrice = currentPrices[stockCode] || 0;

      return {
        stockCode: stockCode,
        stockName: feed?.stockName || watchlistItem?.stockName || stockCode,
        currentPrice: currentPrice,
        analysis: feed ? {
          eventSummary: feed.eventSummary,
          industryTrend: feed.industryTrend,
          trapProbability: feed.trapProbability,
          actionSignal: feed.actionSignal,
          targetPrice: feed.targetPrice ? feed.targetPrice.toNumber() : null,
          stopLoss: feed.stopLoss ? feed.stopLoss.toNumber() : null,
          logicChain: feed.logicChain,
          createdAt: feed.createdAt
        } : null,
        warningLevel: feed && feed.trapProbability > 50 ? 'high' :
                     feed && feed.trapProbability > 30 ? 'medium' : 'low',
        isInWatchlist: !!watchlistItem,
        watchlistInfo: watchlistItem ? {
          buyPrice: watchlistItem.buyPrice ? watchlistItem.buyPrice.toNumber() : null,
          stopLossPrice: watchlistItem.stopLossPrice ? watchlistItem.stopLossPrice.toNumber() : null,
          targetPrice: watchlistItem.targetPrice ? watchlistItem.targetPrice.toNumber() : null,
          notes: watchlistItem.notes
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      message: `成功分析 ${analysis.length} 只股票`,
      analysis: analysis,
      savedCount: result.savedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error analyzing watchlist:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        analysis: []
      },
      { status: 500 }
    );
  }
}