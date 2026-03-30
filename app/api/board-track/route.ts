import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// POST: 保存打板跟踪记录
export async function POST(req: Request) {
  try {
    const clerkUserId = await getAuthUserId(req);
    if (!clerkUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { stockCode, stockName, entryPrice, signalTag, signalScore } = body;

    if (!stockCode || !stockName || !entryPrice) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const now = new Date();
    const entryDate = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });

    const record = await prisma.boardTrack.create({
      data: {
        userId: clerkUserId,
        stockCode,
        stockName,
        entryPrice,
        signalTag: signalTag || "未分类",
        signalScore: signalScore || 0,
        entryDate,
      },
    });

    return NextResponse.json({ success: true, id: record.id });
  } catch (error) {
    console.error("BoardTrack POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: 获取用户的打板跟踪记录
export async function GET(req: Request) {
  try {
    const clerkUserId = await getAuthUserId(req);
    if (!clerkUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "30");

    const records = await prisma.boardTrack.findMany({
      where: { userId: clerkUserId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      records: records.map((r) => ({
        ...r,
        entryPrice: Number(r.entryPrice),
        nextDayPrice: r.nextDayPrice ? Number(r.nextDayPrice) : null,
        nextDayChange: r.nextDayChange ? Number(r.nextDayChange) : null,
        nextDayHigh: r.nextDayHigh ? Number(r.nextDayHigh) : null,
        nextDayLow: r.nextDayLow ? Number(r.nextDayLow) : null,
      })),
    });
  } catch (error) {
    console.error("BoardTrack GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
