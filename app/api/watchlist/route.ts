import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

// GET: Get user's watchlist
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get or create user in database
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    // If user doesn't exist, create it (fallback for when webhook fails)
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
              createdVia: "watchlist_api_fallback",
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

    // Get user's watchlist
    const watchlist = await prisma.watchlist.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      watchlist: watchlist.map(item => ({
        ...item,
        buyPrice: item.buyPrice ? item.buyPrice.toNumber() : null,
        stopLossPrice: item.stopLossPrice ? item.stopLossPrice.toNumber() : null,
        targetPrice: item.targetPrice ? item.targetPrice.toNumber() : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Add item to watchlist
export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get or create user in database
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    // If user doesn't exist, create it (fallback for when webhook fails)
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
              createdVia: "watchlist_api_fallback",
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
    const { stockCode, stockName, buyPrice, stopLossPrice, targetPrice, notes } = body;

    if (!stockCode || !stockName) {
      return NextResponse.json(
        { error: "Stock code and name are required" },
        { status: 400 }
      );
    }

    // Check if already in watchlist
    const existingItem = await prisma.watchlist.findUnique({
      where: {
        userId_stockCode: {
          userId: user.id,
          stockCode,
        },
      },
    });

    if (existingItem) {
      return NextResponse.json(
        { error: "Stock already in watchlist" },
        { status: 409 }
      );
    }

    // Add to watchlist
    const watchlistItem = await prisma.watchlist.create({
      data: {
        userId: user.id,
        stockCode,
        stockName,
        buyPrice: buyPrice ? parseFloat(buyPrice) : null,
        stopLossPrice: stopLossPrice ? parseFloat(stopLossPrice) : null,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        ...watchlistItem,
        buyPrice: watchlistItem.buyPrice ? watchlistItem.buyPrice.toNumber() : null,
        stopLossPrice: watchlistItem.stopLossPrice ? watchlistItem.stopLossPrice.toNumber() : null,
        targetPrice: watchlistItem.targetPrice ? watchlistItem.targetPrice.toNumber() : null,
      },
    });
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Update watchlist item
export async function PUT(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get or create user in database
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    // If user doesn't exist, create it (fallback for when webhook fails)
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
              createdVia: "watchlist_api_fallback",
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
    const { id, buyPrice, stopLossPrice, targetPrice, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    // Check if item belongs to user
    const existingItem = await prisma.watchlist.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Watchlist item not found" },
        { status: 404 }
      );
    }

    // Update item
    const updatedItem = await prisma.watchlist.update({
      where: { id },
      data: {
        buyPrice: buyPrice !== undefined ? parseFloat(buyPrice) : existingItem.buyPrice,
        stopLossPrice: stopLossPrice !== undefined ? parseFloat(stopLossPrice) : existingItem.stopLossPrice,
        targetPrice: targetPrice !== undefined ? parseFloat(targetPrice) : existingItem.targetPrice,
        notes: notes !== undefined ? notes : existingItem.notes,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        ...updatedItem,
        buyPrice: updatedItem.buyPrice ? updatedItem.buyPrice.toNumber() : null,
        stopLossPrice: updatedItem.stopLossPrice ? updatedItem.stopLossPrice.toNumber() : null,
        targetPrice: updatedItem.targetPrice ? updatedItem.targetPrice.toNumber() : null,
      },
    });
  } catch (error) {
    console.error("Error updating watchlist:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Remove item from watchlist
export async function DELETE(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get or create user in database
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    // If user doesn't exist, create it (fallback for when webhook fails)
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
              createdVia: "watchlist_api_fallback",
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    // Check if item belongs to user
    const existingItem = await prisma.watchlist.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Watchlist item not found" },
        { status: 404 }
      );
    }

    // Delete item
    await prisma.watchlist.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Item removed from watchlist",
    });
  } catch (error) {
    console.error("Error deleting from watchlist:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}