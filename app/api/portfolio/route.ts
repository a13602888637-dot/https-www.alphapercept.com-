import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

// GET: Get user's portfolio with real-time prices
export async function GET(req: Request) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: authResult.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const portfolioItems = await prisma.portfolio.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch real-time prices for all stocks
    const stockCodes = portfolioItems.map(p => p.stockCode)
    let priceMap: Record<string, { currentPrice: number; change: number; changePercent: number }> = {}

    if (stockCodes.length > 0) {
      try {
        const priceResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/stock-prices?codes=${stockCodes.join(',')}`,
          { cache: 'no-store' }
        )
        if (priceResponse.ok) {
          const priceData = await priceResponse.json()
          if (priceData.success && priceData.data) {
            for (const stock of priceData.data) {
              priceMap[stock.code] = {
                currentPrice: stock.price || 0,
                change: stock.change || 0,
                changePercent: stock.changePercent || 0,
              }
            }
          }
        }
      } catch {
        // Price fetch failed, continue without prices
      }
    }

    // Calculate portfolio metrics
    let totalMarketValue = 0
    let totalCost = 0

    const enrichedPortfolio = portfolioItems.map(item => {
      const avgCost = Number(item.avgCost)
      const prices = priceMap[item.stockCode]
      const currentPrice = prices?.currentPrice || avgCost
      const marketValue = currentPrice * item.quantity
      const cost = avgCost * item.quantity
      const profitLoss = marketValue - cost
      const profitLossPercent = cost > 0 ? (profitLoss / cost) * 100 : 0

      totalMarketValue += marketValue
      totalCost += cost

      return {
        id: item.id,
        stockCode: item.stockCode,
        stockName: item.stockName,
        industry: item.industry,
        quantity: item.quantity,
        avgCost,
        currentPrice,
        marketValue,
        profitLoss,
        profitLossPercent,
        change: prices?.change || 0,
        changePercent: prices?.changePercent || 0,
        status: item.status,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    })

    // Calculate weights
    const portfolio = enrichedPortfolio.map(item => ({
      ...item,
      weight: totalMarketValue > 0 ? (item.marketValue / totalMarketValue) * 100 : 0,
    }))

    return NextResponse.json({
      success: true,
      portfolio,
      summary: {
        totalMarketValue,
        totalCost,
        totalProfitLoss: totalMarketValue - totalCost,
        totalProfitLossPercent: totalCost > 0 ? ((totalMarketValue - totalCost) / totalCost) * 100 : 0,
        positionCount: portfolio.length,
      },
    })
  } catch (error) {
    console.error('Portfolio GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Add a new position
export async function POST(req: Request) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: authResult.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const { stockCode, stockName, quantity, avgCost, industry, notes } = body

    if (!stockCode || !stockName || !quantity || !avgCost) {
      return NextResponse.json({ error: '股票代码、名称、数量和成本价为必填项' }, { status: 400 })
    }

    // Check for existing position
    const existing = await prisma.portfolio.findUnique({
      where: { userId_stockCode: { userId: user.id, stockCode } },
    })

    if (existing) {
      // Update existing position (average up/down)
      const totalQuantity = existing.quantity + quantity
      const totalCost = Number(existing.avgCost) * existing.quantity + avgCost * quantity
      const newAvgCost = totalCost / totalQuantity

      const updated = await prisma.portfolio.update({
        where: { id: existing.id },
        data: {
          quantity: totalQuantity,
          avgCost: newAvgCost,
          industry: industry || existing.industry,
          notes: notes || existing.notes,
        },
      })

      return NextResponse.json({
        success: true,
        item: { ...updated, avgCost: Number(updated.avgCost) },
        message: `已更新 ${stockName} 持仓，平均成本: ¥${newAvgCost.toFixed(2)}`,
      })
    }

    const item = await prisma.portfolio.create({
      data: {
        userId: user.id,
        stockCode,
        stockName,
        quantity,
        avgCost,
        industry: industry || null,
        notes: notes || null,
      },
    })

    return NextResponse.json({
      success: true,
      item: { ...item, avgCost: Number(item.avgCost) },
    })
  } catch (error) {
    console.error('Portfolio POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Update a position
export async function PUT(req: Request) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: authResult.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const { id, quantity, avgCost, industry, notes, status } = body

    if (!id) {
      return NextResponse.json({ error: 'Position ID required' }, { status: 400 })
    }

    const existing = await prisma.portfolio.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    const updated = await prisma.portfolio.update({
      where: { id },
      data: {
        ...(quantity !== undefined && { quantity }),
        ...(avgCost !== undefined && { avgCost }),
        ...(industry !== undefined && { industry }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
      },
    })

    return NextResponse.json({
      success: true,
      item: { ...updated, avgCost: Number(updated.avgCost) },
    })
  } catch (error) {
    console.error('Portfolio PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove a position
export async function DELETE(req: Request) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: authResult.userId },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Position ID required' }, { status: 400 })
    }

    const existing = await prisma.portfolio.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    await prisma.portfolio.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Portfolio DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
