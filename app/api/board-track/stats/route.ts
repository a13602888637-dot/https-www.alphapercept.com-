import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

interface TagStats {
  tag: string;
  total: number;
  tracked: number;
  wins: number;       // 次日涨
  losses: number;     // 次日跌
  winRate: number;     // 胜率 %
  avgReturn: number;   // 平均收益 %
  maxReturn: number;   // 最大收益 %
  maxLoss: number;     // 最大亏损 %
}

// GET: 打板胜率统计（按信号标签分组）
export async function GET(req: Request) {
  try {
    const clerkUserId = await getAuthUserId(req);

    // 允许未登录查看全局统计
    const where = clerkUserId ? { userId: clerkUserId } : {};

    const allRecords = await prisma.boardTrack.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // 按 stockCode 去重：每只股票只算最新一条记录
    const seenStocks = new Set<string>();
    const dedupedRecords = allRecords.filter((r) => {
      if (seenStocks.has(r.stockCode)) return false;
      seenStocks.add(r.stockCode);
      return true;
    });

    // 按 signalTag 分组统计（基于去重后的记录）
    const tagMap = new Map<string, {
      total: number;
      tracked: number;
      changes: number[];
    }>();

    const overall = { total: 0, tracked: 0, changes: [] as number[] };

    for (const r of dedupedRecords) {
      const tag = r.signalTag || "未分类";
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { total: 0, tracked: 0, changes: [] });
      }
      const group = tagMap.get(tag)!;
      group.total++;
      overall.total++;

      if (r.trackStatus === "tracked" && r.nextDayChange != null) {
        const change = Number(r.nextDayChange);
        group.tracked++;
        group.changes.push(change);
        overall.tracked++;
        overall.changes.push(change);
      }
    }

    const buildStats = (tag: string, data: { total: number; tracked: number; changes: number[] }): TagStats => {
      const wins = data.changes.filter((c) => c > 0).length;
      const losses = data.changes.filter((c) => c < 0).length;
      return {
        tag,
        total: data.total,
        tracked: data.tracked,
        wins,
        losses,
        winRate: data.tracked > 0 ? Math.round((wins / data.tracked) * 1000) / 10 : 0,
        avgReturn: data.changes.length > 0
          ? Math.round((data.changes.reduce((a, b) => a + b, 0) / data.changes.length) * 100) / 100
          : 0,
        maxReturn: data.changes.length > 0 ? Math.round(Math.max(...data.changes) * 100) / 100 : 0,
        maxLoss: data.changes.length > 0 ? Math.round(Math.min(...data.changes) * 100) / 100 : 0,
      };
    };

    // 排序：强烈推荐 > 爆发打板 > 确认上攻 > 其他
    const tagOrder = ["强烈推荐", "爆发打板", "确认上攻", "高风险追板", "疑似诱多"];
    const byTag: TagStats[] = [];
    for (const tag of tagOrder) {
      if (tagMap.has(tag)) {
        byTag.push(buildStats(tag, tagMap.get(tag)!));
      }
    }
    // 其他未在预定义列表中的标签
    for (const [tag, data] of tagMap) {
      if (!tagOrder.includes(tag)) {
        byTag.push(buildStats(tag, data));
      }
    }

    // 最近 10 条跟踪记录（含pending+tracked，按 stockCode 去重）
    const recentSeen = new Set<string>();
    const recentTracked = dedupedRecords
      .filter((r) => {
        if (r.trackStatus === "failed") return false;
        if (recentSeen.has(r.stockCode)) return false;
        recentSeen.add(r.stockCode);
        return true;
      })
      .slice(0, 10)
      .map((r) => ({
        stockCode: r.stockCode,
        stockName: r.stockName,
        signalTag: r.signalTag,
        entryPrice: Number(r.entryPrice),
        nextDayChange: r.trackStatus === "tracked" ? Number(r.nextDayChange) : null,
        entryDate: r.entryDate,
        trackStatus: r.trackStatus,
      }));

    return NextResponse.json({
      success: true,
      overall: buildStats("总计", overall),
      byTag,
      recentTracked,
      pendingCount: dedupedRecords.filter((r) => r.trackStatus === "pending").length,
    });
  } catch (error) {
    console.error("BoardTrack stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
