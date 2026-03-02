import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

/**
 * 从请求中获取Clerk userId（使用Bearer Token标准鉴权）
 *
 * 前端通过Authorization头显式传递Bearer Token
 * 后端从Authorization头提取token并解析userId
 */
export async function getUserIdFromRequest(req: Request | NextRequest): Promise<string | null> {
  try {
    // 1. 从Authorization头获取Bearer Token
    const authHeader = req.headers.get('Authorization');
    console.log('[auth-helpers] Authorization Header:', authHeader ? 'Exists' : 'Missing');

    if (!authHeader) {
      console.log('[auth-helpers] No Authorization header found');
      return null;
    }

    // 2. 提取Bearer Token
    if (!authHeader.startsWith('Bearer ')) {
      console.log('[auth-helpers] Invalid Authorization header format (must start with "Bearer ")');
      return null;
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    console.log('[auth-helpers] Found bearer token:', token.substring(0, 50) + '...');

    // 3. 从JWT token中解析userId
    // JWT格式: header.payload.signature
    // payload中包含sub (subject) = userId
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[auth-helpers] Invalid JWT format (expected 3 parts)');
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
