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

    // 去重: 同一用户同一股票如果已有pending/tracked记录，不重复创建
    const existing = await prisma.boardTrack.findFirst({
      where: {
        userId: clerkUserId,
        stockCode,
        trackStatus: { in: ["pending", "tracked"] },
      },
    });
    if (existing) {
      return NextResponse.json({ success: true, id: existing.id, duplicate: true });
    }

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

    const allRecords = await prisma.boardTrack.findMany({
      where: { userId: clerkUserId },
      orderBy: { createdAt: "desc" },
      take: limit * 3, // fetch more to allow dedup
    });

    // 按 stockCode 去重，只保留每只股票最新的一条记录
    const seen = new Set<string>();
    const deduped = allRecords.filter((r) => {
      if (seen.has(r.stockCode)) return false;
      seen.add(r.stockCode);
      return true;
    }).slice(0, limit);

    return NextResponse.json({
      success: true,
      records: deduped.map((r) => ({
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

// DELETE: 取消跟踪（删除记录）
export async function DELETE(req: Request) {
  try {
    const clerkUserId = await getAuthUserId(req);
    if (!clerkUserId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const stockCode = searchParams.get("stockCode");

    if (!id && !stockCode) {
      return NextResponse.json({ error: "Missing id or stockCode" }, { status: 400 });
    }

    if (stockCode) {
      // 按股票代码删除该用户所有跟踪记录
      const deleted = await prisma.boardTrack.deleteMany({
        where: { userId: clerkUserId, stockCode },
      });
      return NextResponse.json({ success: true, deleted: deleted.count });
    }

    // 按 id 删除单条
    const record = await prisma.boardTrack.findFirst({
      where: { id: id!, userId: clerkUserId },
    });
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    await prisma.boardTrack.delete({ where: { id: id! } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("BoardTrack DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
