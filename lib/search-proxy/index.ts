/**
 * 搜索API代理中间层主入口
 */

export * from './config';
export * from './cache';
export * from './proxy-service';
export * from './search-service';
export * from './cloud-function';

// 默认导出搜索服务
import { getSearchService } from './search-service';
export default getSearchService();