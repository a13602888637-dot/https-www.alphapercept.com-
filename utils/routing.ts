// utils/routing.ts

// 路由配置常量
export const ROUTE_CONFIG = {
  // 基础路由（一级页面），不需要返回按钮
  BASE_ROUTES: ['/', '/dashboard'] as const,

  // 默认返回目标（当没有浏览历史时）
  DEFAULT_BACK_DESTINATION: '/dashboard' as const,

  // 排除的路由路径（API路由、静态资源等）
  EXCLUDED_PATHS: ['api', '_next', 'favicon.ico', 'public'] as const,
} as const;

/**
 * 检测当前路由是否为二级页面
 * 二级页面需要显示返回按钮，一级页面（如dashboard）不需要
 */
export const isSecondaryPage = (pathname: string): boolean => {
  // 基础路由，不需要返回按钮
  const baseRoutes = ROUTE_CONFIG.BASE_ROUTES;

  // 获取第一级路由路径
  const currentPath = pathname.split('/')[1] || '';

  // 排除基础路由
  if (baseRoutes.some(route => route === `/${currentPath}`) || pathname === ROUTE_CONFIG.DEFAULT_BACK_DESTINATION) {
    return false;
  }

  // 排除API路由和特殊路由
  if (ROUTE_CONFIG.EXCLUDED_PATHS.some(path => path === currentPath)) {
    return false;
  }

  // 其他路由视为二级页面，需要返回按钮
  return true;
};

/**
 * 获取返回目标路由
 * 当没有浏览历史时返回仪表板，否则返回上一页
 */
export const getBackDestination = (): string => {
  if (typeof window === 'undefined') {
    return ROUTE_CONFIG.DEFAULT_BACK_DESTINATION;
  }

  return window.history.length <= 1 ? ROUTE_CONFIG.DEFAULT_BACK_DESTINATION : 'back';
};