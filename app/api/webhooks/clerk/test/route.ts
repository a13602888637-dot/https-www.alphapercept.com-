import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";

export async function GET() {
  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`;

    // 获取用户统计
    const userCount = await prisma.user.count();
    const latestUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        userCount,
      },
      webhook: {
        endpoint: "/api/webhooks/clerk",
        method: "POST",
        requiredHeaders: ["svix-id", "svix-timestamp", "svix-signature"],
      },
      recentUsers: latestUsers,
      instructions: {
        setup: [
          "1. 在Clerk仪表板中创建Webhook: https://dashboard.clerk.com",
          "2. 设置Webhook URL为: https://your-domain.com/api/webhooks/clerk",
          "3. 复制Webhook Secret到环境变量: CLERK_WEBHOOK_SECRET",
          "4. 订阅事件: user.created, user.updated, user.deleted",
        ],
        testing: [
          "1. 在Clerk仪表板中手动触发Webhook测试",
          "2. 检查数据库中的用户记录是否同步",
          "3. 查看服务器日志确认Webhook处理",
        ],
      },
    });
  } catch (error) {
    console.error("Webhook测试端点错误:", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        database: {
          connected: false,
        },
      },
      { status: 500 }
    );
  }
}