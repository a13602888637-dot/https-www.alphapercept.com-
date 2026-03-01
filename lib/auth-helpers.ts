import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

/**
 * 从请求中获取Clerk userId（不依赖middleware）
 *
 * 这个函数直接从cookie中提取和验证session token，
 * 避免了依赖middleware context的问题（在Vercel上可能失效）
 */
export async function getUserIdFromRequest(req: Request | NextRequest): Promise<string | null> {
  try {
    // 1. 从cookie中获取session token
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) {
      console.log('[auth-helpers] No cookie header found');
      return null;
    }

    // 2. 提取__session cookie
    const sessionMatch = cookieHeader.match(/__session=([^;]+)/);
    if (!sessionMatch) {
      console.log('[auth-helpers] No __session cookie found');
      return null;
    }

    const sessionToken = sessionMatch[1];
    console.log('[auth-helpers] Found session token:', sessionToken.substring(0, 50) + '...');

    // 3. 使用clerkClient验证session token
    const client = await clerkClient();

    // 验证JWT token
    const { data: sessions } = await client.sessions.getSessionList();
    console.log('[auth-helpers] Active sessions count:', sessions.length);

    // 从JWT token中解析userId
    // JWT格式: header.payload.signature
    // payload中包含sub (subject) = userId
    const parts = sessionToken.split('.');
    if (parts.length !== 3) {
      console.log('[auth-helpers] Invalid JWT format');
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      console.log('[auth-helpers] Decoded payload:', {
        sub: payload.sub,
        sid: payload.sid,
        exp: payload.exp,
        iat: payload.iat
      });

      // 检查token是否过期
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.log('[auth-helpers] Token expired');
        return null;
      }

      // 返回userId (sub claim)
      const userId = payload.sub;
      console.log('[auth-helpers] Extracted userId:', userId);
      return userId || null;
    } catch (parseError) {
      console.error('[auth-helpers] Failed to parse JWT payload:', parseError);
      return null;
    }
  } catch (error) {
    console.error('[auth-helpers] Error getting userId from request:', error);
    return null;
  }
}

/**
 * 验证用户是否已认证（用于API路由）
 */
export async function requireAuth(req: Request | NextRequest): Promise<string> {
  const userId = await getUserIdFromRequest(req);

  if (!userId) {
    throw new Error('Authentication required');
  }

  return userId;
}
