import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

interface HealthRule {
  id: string;
  name: string;
  pass: boolean;
  value: string;
  message: string;
}

interface PriceInfo {
  price: number;
  name?: string;
  change?: number;
  changePercent?: number;
}

/**
 * GET /api/portfolio/health-check
 *
 * Query params:
 *   cash          - manually specified cash balance (optional)
 *   reverseRepo   - 国债逆回购 amount (optional)
 *   monthlyTrades - number of trades this month (optional, default 0)
 *
 * Returns portfolio health score based on 5 iron rules.
 */
export async function GET(req: Request) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const cashParam = searchParams.get("cash");
    const reverseRepoParam = searchParams.get("reverseRepo");
    const monthlyTradesParam = searchParams.get("monthlyTrades");

    const manualCash = cashParam ? parseFloat(cashParam) : 0;
    const reverseRepo = reverseRepoParam ? parseFloat(reverseRepoParam) : 0;
    const monthlyTrades = monthlyTradesParam ? parseInt(monthlyTradesParam, 10) : 0;

    // 1. Fetch portfolio positions
    const positions = await prisma.portfolio.findMany({
      where: { userId: user.id },
    });

    if (positions.length === 0) {
      return NextResponse.json({
        success: true,
        rules: buildRules([], {}, 0, 0, 0),
        score: 100,
        summary: {
          totalAssets: manualCash + reverseRepo,
          totalMarketValue: 0,
          cashBalance: manualCash,
          reverseRepo,
          positionCount: 0,
        },
      });
    }

    // 2. Fetch real-time prices from internal stock-prices API
    const stockCodes = positions.map((p) => p.stockCode);
    const priceMap = await fetchPrices(stockCodes);

    // 3. Compute position market values
    const positionsWithValue = positions.map((p) => {
      const avgCost = Number(p.avgCost);
      const currentPrice = priceMap[p.stockCode]?.price || avgCost;
      const marketValue = currentPrice * p.quantity;
      const costBasis = avgCost * p.quantity;
      const unrealizedPnlPct =
        costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0;

      return {
        stockCode: p.stockCode,
        stockName: p.stockName,
        industry: p.industry,
        quantity: p.quantity,
        avgCost,
        currentPrice,
        marketValue,
        unrealizedPnlPct,
      };
    });

    const totalMarketValue = positionsWithValue.reduce(
      (sum, p) => sum + p.marketValue,
      0
    );
    const totalAssets = totalMarketValue + manualCash + reverseRepo;

    // 4. Evaluate 5 rules
    const rules = buildRules(
      positionsWithValue,
      { totalAssets },
      manualCash,
      reverseRepo,
      monthlyTrades
    );

    const passingCount = rules.filter((r) => r.pass).length;
    const score = Math.round((passingCount / rules.length) * 100);

    return NextResponse.json({
      success: true,
      rules,
      score,
      summary: {
        totalAssets: round2(totalAssets),
        totalMarketValue: round2(totalMarketValue),
        cashBalance: round2(manualCash),
        reverseRepo: round2(reverseRepo),
        positionCount: positions.length,
      },
    });
  } catch (error) {
    console.error("[health-check] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PositionWithValue {
  stockCode: string;
  stockName: string;
  industry: string | null;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnlPct: number;
}

function buildRules(
  positions: PositionWithValue[],
  totals: { totalAssets?: number },
  cashBalance: number,
  reverseRepo: number,
  monthlyTrades: number
): HealthRule[] {
  const { totalAssets = 0 } = totals;

  // Rule 1: 单股上限 40%
  const singleStockRule = checkSingleStockLimit(positions, totalAssets);

  // Rule 2: 现金储备 >= 20%
  const cashRule = checkCashReserve(totalAssets, cashBalance, reverseRepo);

  // Rule 3: 月交易 <= 6次
  const tradeRule = checkMonthlyTrades(monthlyTrades);

  // Rule 4: 同板块 <= 35%
  const sectorRule = checkSectorConcentration(positions, totalAssets);

  // Rule 5: 止损 -8%
  const stopLossRule = checkStopLossBreach(positions);

  return [singleStockRule, cashRule, tradeRule, sectorRule, stopLossRule];
}

/** Rule 1: No single stock > 40% of total assets */
function checkSingleStockLimit(
  positions: PositionWithValue[],
  totalAssets: number
): HealthRule {
  if (positions.length === 0 || totalAssets <= 0) {
    return {
      id: "single_stock_limit",
      name: "单股上限 40%",
      pass: true,
      value: "0%",
      message: "无持仓",
    };
  }

  let maxWeight = 0;
  let maxStock = "";

  for (const p of positions) {
    const weight = (p.marketValue / totalAssets) * 100;
    if (weight > maxWeight) {
      maxWeight = weight;
      maxStock = p.stockName;
    }
  }

  const pass = maxWeight <= 40;
  return {
    id: "single_stock_limit",
    name: "单股上限 40%",
    pass,
    value: `${maxWeight.toFixed(1)}%`,
    message: `${maxStock}占比最高`,
  };
}

/** Rule 2: Cash ratio >= 20% */
function checkCashReserve(
  totalAssets: number,
  cashBalance: number,
  reverseRepo: number
): HealthRule {
  const liquidCash = cashBalance + reverseRepo;

  if (totalAssets <= 0) {
    return {
      id: "cash_reserve",
      name: "现金储备 ≥20%",
      pass: true,
      value: "100%",
      message: "无持仓，全部为现金",
    };
  }

  const cashRatio = (liquidCash / totalAssets) * 100;
  const pass = cashRatio >= 20;

  return {
    id: "cash_reserve",
    name: "现金储备 ≥20%",
    pass,
    value: `${cashRatio.toFixed(1)}%`,
    message: pass
      ? `现金+逆回购 ¥${round2(liquidCash).toLocaleString()}`
      : `现金不足，建议至少 ¥${round2(totalAssets * 0.2).toLocaleString()}`,
  };
}

/** Rule 3: Monthly trades <= 6 */
function checkMonthlyTrades(monthlyTrades: number): HealthRule {
  const pass = monthlyTrades <= 6;
  return {
    id: "monthly_trades",
    name: "月交易 ≤6次",
    pass,
    value: `${monthlyTrades}次`,
    message: pass ? "交易频率正常" : "交易过于频繁，注意控制手数",
  };
}

/** Rule 4: No single sector > 35% of total assets */
function checkSectorConcentration(
  positions: PositionWithValue[],
  totalAssets: number
): HealthRule {
  if (positions.length === 0 || totalAssets <= 0) {
    return {
      id: "sector_concentration",
      name: "同板块 ≤35%",
      pass: true,
      value: "0%",
      message: "无持仓",
    };
  }

  // Group by industry
  const sectorMap: Record<string, { value: number; names: string[] }> = {};

  for (const p of positions) {
    const sector = p.industry || "未分类";
    if (!sectorMap[sector]) {
      sectorMap[sector] = { value: 0, names: [] };
    }
    sectorMap[sector].value += p.marketValue;
    sectorMap[sector].names.push(p.stockName);
  }

  let maxSector = "";
  let maxSectorWeight = 0;

  for (const [sector, info] of Object.entries(sectorMap)) {
    const weight = (info.value / totalAssets) * 100;
    if (weight > maxSectorWeight) {
      maxSectorWeight = weight;
      maxSector = sector;
    }
  }

  const pass = maxSectorWeight <= 35;
  return {
    id: "sector_concentration",
    name: "同板块 ≤35%",
    pass,
    value: `${maxSectorWeight.toFixed(1)}%`,
    message: `${maxSector}占比最高（${sectorMap[maxSector]?.names.join("、")}）`,
  };
}

/** Rule 5: Any position with unrealizedPnlPct <= -8% is a breach */
function checkStopLossBreach(positions: PositionWithValue[]): HealthRule {
  if (positions.length === 0) {
    return {
      id: "stop_loss_breach",
      name: "新股止损 -8%",
      pass: true,
      value: "无",
      message: "无持仓",
    };
  }

  const breached = positions.filter((p) => p.unrealizedPnlPct <= -8);

  if (breached.length === 0) {
    // Show the worst position for context
    const worst = positions.reduce((prev, curr) =>
      curr.unrealizedPnlPct < prev.unrealizedPnlPct ? curr : prev
    );
    return {
      id: "stop_loss_breach",
      name: "新股止损 -8%",
      pass: true,
      value: `${worst.unrealizedPnlPct.toFixed(1)}%`,
      message: `最大亏损: ${worst.stockName} ${worst.unrealizedPnlPct.toFixed(1)}%`,
    };
  }

  const names = breached.map(
    (p) => `${p.stockName}(${p.unrealizedPnlPct.toFixed(1)}%)`
  );
  return {
    id: "stop_loss_breach",
    name: "新股止损 -8%",
    pass: false,
    value: `${breached.length}只`,
    message: `触发止损: ${names.join("、")}`,
  };
}

/**
 * Fetch real-time prices from the internal /api/stock-prices endpoint.
 * Uses the same pattern as app/api/portfolio/route.ts.
 */
async function fetchPrices(
  stockCodes: string[]
): Promise<Record<string, PriceInfo>> {
  const priceMap: Record<string, PriceInfo> = {};

  if (stockCodes.length === 0) return priceMap;

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(
      `${baseUrl}/api/stock-prices?symbols=${stockCodes.join(",")}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.warn("[health-check] stock-prices API returned", res.status);
      return priceMap;
    }

    const data = await res.json();

    if (data.success && data.prices) {
      for (const [code, info] of Object.entries(data.prices)) {
        const p = info as PriceInfo;
        if (p.price > 0) {
          priceMap[code] = p;
        }
      }
    }
  } catch (err) {
    console.warn("[health-check] Failed to fetch prices:", err);
  }

  return priceMap;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
