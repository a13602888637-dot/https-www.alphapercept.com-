import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

// GET: Get user's intelligence feed
export async function GET(req: Request) {
  try {
    let clerkUserId = null;
    try {
      const authResult = await auth();
      clerkUserId = authResult.userId;
    } catch (authError) {
      console.warn("Clerk auth failed, using public feed:", authError);
      // Continue with public feed (clerkUserId will be null)
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const stockCode = searchParams.get("stockCode");

    let userId = null;
    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
      });
      userId = user?.id || null;
    }

    // Build query
    const where: any = {};
    if (stockCode) {
      where.stockCode = stockCode;
    }

    // Get intelligence feed
    const feed = await prisma.intelligenceFeed.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Get total count for pagination
    const total = await prisma.intelligenceFeed.count({ where });

    // Format response
    const formattedFeed = feed.map(item => ({
      id: item.id,
      userId: item.userId,
      user: item.user,
      stockCode: item.stockCode,
      stockName: item.stockName,
      eventSummary: item.eventSummary,
      industryTrend: item.industryTrend,
      trapProbability: item.trapProbability,
      actionSignal: item.actionSignal,
      targetPrice: item.targetPrice ? item.targetPrice.toNumber() : null,
      stopLoss: item.stopLoss ? item.stopLoss.toNumber() : null,
      logicChain: item.logicChain,
      rawData: item.rawData,
      createdAt: item.createdAt,
      isUserSpecific: item.userId === userId,
    }));

    return NextResponse.json({
      success: true,
      feed: formattedFeed,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching intelligence feed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create new intelligence feed item
export async function POST(req: Request) {
  try {
    let clerkUserId = null;
    try {
      const authResult = await auth();
      clerkUserId = authResult.userId;
    } catch (authError) {
      console.warn("Clerk auth failed:", authError);
      // 对于POST请求，需要认证，返回401错误
      return NextResponse.json(
        {
          error: "Authentication required",
          details: "Clerk authentication failed. Please sign in to create intelligence feed items."
        },
        { status: 401 }
      );
    }

    if (!clerkUserId) {
      return NextResponse.json(
        {
          error: "Authentication required",
          details: "User authentication failed. Please sign in to create intelligence feed items."
        },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      stockCode,
      stockName,
      eventSummary,
      industryTrend,
      trapProbability,
      actionSignal,
      targetPrice,
      stopLoss,
      logicChain,
      rawData,
    } = body;

    if (!stockCode || !stockName || !eventSummary) {
      return NextResponse.json(
        { error: "Stock code, name, and event summary are required" },
        { status: 400 }
      );
    }

    // Create intelligence feed item
    const feedItem = await prisma.intelligenceFeed.create({
      data: {
        userId: user.id,
        stockCode,
        stockName,
        eventSummary,
        industryTrend: industryTrend || "",
        trapProbability: trapProbability || 0,
        actionSignal: actionSignal || "HOLD",
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        logicChain: logicChain || null,
        rawData: rawData || null,
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        ...feedItem,
        targetPrice: feedItem.targetPrice ? feedItem.targetPrice.toNumber() : null,
        stopLoss: feedItem.stopLoss ? feedItem.stopLoss.toNumber() : null,
      },
    });
  } catch (error) {
    console.error("Error creating intelligence feed item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}