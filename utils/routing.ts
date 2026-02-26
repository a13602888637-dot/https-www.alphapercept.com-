// utils/routing.ts
/**
 * 检测当前路由是否为二级页面
 * 二级页面需要显示返回按钮，一级页面（如dashboard）不需要
 */
export const isSecondaryPage = (pathname: string): boolean => {
  // 基础路由，不需要返回按钮
  const baseRoutes = ['/', '/dashboard'];

  // 获取第一级路由路径
  const currentPath = pathname.split('/')[1] || '';

  // 排除基础路由
  if (baseRoutes.includes(`/${currentPath}`) || pathname === '/dashboard') {
    return false;
  }

  // 排除API路由和特殊路由
  const excludedPaths = ['api', '_next', 'favicon.ico', 'public'];
  if (excludedPaths.includes(currentPath)) {
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
    return '/dashboard';
  }

  return window.history.length <= 1 ? '/dashboard' : 'back';
};