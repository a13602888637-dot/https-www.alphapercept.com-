import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // 1. 检查请求headers
    const headers = Object.fromEntries(req.headers.entries());

    // 2. 检查auth()结果
    let authResult = null;
    let authError = null;
    try {
      authResult = await auth();
    } catch (error) {
      authError = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }

    // 3. 检查currentUser()结果
    let user = null;
    let userError = null;
    try {
      user = await currentUser();
    } catch (error) {
      userError = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }

    // 4. 检查环境变量
    const envCheck = {
      hasPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      hasSecretKey: !!process.env.CLERK_SECRET_KEY,
      publishableKeyPrefix: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 20) + "...",
      secretKeyPrefix: process.env.CLERK_SECRET_KEY?.substring(0, 20) + "...",
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics: {
        // 请求信息
        request: {
          hasCookie: !!headers.cookie,
          cookiePreview: headers.cookie?.substring(0, 100) + "...",
          host: headers.host,
          referer: headers.referer,
          userAgent: headers["user-agent"]?.substring(0, 50) + "...",
        },

        // 认证结果
        auth: {
          success: !authError,
          userId: authResult?.userId || null,
          sessionId: authResult?.sessionId || null,
          orgId: authResult?.orgId || null,
          error: authError,
        },

        // 用户信息
        user: {
          success: !userError,
          id: user?.id || null,
          email: user?.primaryEmailAddress?.emailAddress || null,
          firstName: user?.firstName || null,
          lastName: user?.lastName || null,
          error: userError,
        },

        // 环境配置
        environment: envCheck,

        // 结论
        conclusion: authResult?.userId
          ? "✅ 认证成功！后端可以获取到用户信息"
          : "❌ 认证失败！后端无法获取用户信息，请检查Cookie是否发送",
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
