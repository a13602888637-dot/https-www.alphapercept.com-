import { auth } from "@clerk/nextjs/server";

/**
 * 安全的认证函数，处理Clerk认证失败的情况
 * @param requireAuth 是否要求认证（对于GET请求通常为false，对于POST/PUT/DELETE请求为true）
 * @param endpointName 端点名称，用于错误消息
 * @returns 认证结果对象
 */
export async function safeAuth(requireAuth: boolean = false, endpointName: string = "endpoint") {
  try {
    const authResult = await auth();
    return {
      success: true,
      clerkUserId: authResult.userId,
      authResult,
      error: null
    };
  } catch (authError) {
    console.warn(`Clerk auth failed for ${endpointName}:`, authError);

    if (requireAuth) {
      return {
        success: false,
        clerkUserId: null,
        authResult: null,
        error: {
          message: "Authentication required",
          details: `Clerk authentication failed. Please sign in to use ${endpointName}.`,
          status: 401
        }
      };
    } else {
      // 对于不需要认证的端点，返回成功但用户ID为null
      return {
        success: true,
        clerkUserId: null,
        authResult: null,
        error: null
      };
    }
  }
}

/**
 * 获取认证用户ID，如果认证失败则返回null
 */
export async function getAuthUserId(): Promise<string | null> {
  try {
    const authResult = await auth();
    return authResult.userId;
  } catch (error) {
    console.warn("Clerk auth failed:", error);
    return null;
  }
}

/**
 * 检查用户是否已认证
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const authResult = await auth();
    return !!authResult.userId;
  } catch (error) {
    return false;
  }
}

/**
 * 认证错误响应
 */
export function authErrorResponse(endpointName: string = "this feature") {
  return {
    success: false,
    error: "Authentication required",
    details: `Please sign in to use ${endpointName}.`,
    status: 401
  };
}

/**
 * 未认证时的空数据响应（用于GET请求）
 */
export function emptyDataResponse(message: string = "未登录，返回空数据") {
  return {
    success: true,
    message,
    data: [],
    count: 0,
    timestamp: new Date().toISOString()
  };
}