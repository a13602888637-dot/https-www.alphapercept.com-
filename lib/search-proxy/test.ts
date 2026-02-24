/**
 * 搜索API代理中间层测试脚本
 */

import { getSearchService } from './search-service';
import { getProxyService } from './proxy-service';
import { getCache } from './cache';

async function runTests() {
  console.log('=== 搜索API代理中间层测试 ===\n');

  const searchService = getSearchService();
  const proxyService = getProxyService();
  const cache = getCache();

  // 测试1：搜索服务状态
  console.log('1. 测试搜索服务状态...');
  const status = searchService.getStatus();
  console.log('搜索服务状态:', JSON.stringify(status, null, 2));

  // 测试2：缓存功能
  console.log('\n2. 测试缓存功能...');
  const testQuery = '茅台';

  // 第一次搜索（应该调用API）
  console.log(`第一次搜索: "${testQuery}"`);
  const result1 = await searchService.search({ query: testQuery });
  console.log(`结果: ${result1.data.length} 条记录`);
  console.log(`数据源: ${result1.source}`);
  console.log(`缓存命中: ${result1.cached}`);
  console.log(`响应时间: ${result1.metadata?.responseTime}ms`);

  // 第二次搜索（应该命中缓存）
  console.log(`\n第二次搜索: "${testQuery}"`);
  const result2 = await searchService.search({ query: testQuery });
  console.log(`结果: ${result2.data.length} 条记录`);
  console.log(`数据源: ${result2.source}`);
  console.log(`缓存命中: ${result2.cached}`);
  console.log(`响应时间: ${result2.metadata?.responseTime}ms`);

  // 测试3：不同查询
  console.log('\n3. 测试不同查询...');
  const testQueries = ['平安', '600000', '腾讯', '阿里巴巴'];

  for (const query of testQueries) {
    console.log(`\n搜索: "${query}"`);
    try {
      const result = await searchService.search({ query });
      console.log(`结果: ${result.data.length} 条记录`);
      console.log(`数据源: ${result.source}`);
      console.log(`成功: ${result.success}`);
      if (result.error) {
        console.log(`错误: ${result.error}`);
      }
    } catch (error) {
      console.log(`错误: ${error}`);
    }
  }

  // 测试4：指定数据源
  console.log('\n4. 测试指定数据源...');
  const sources = ['sina', 'xueqiu', 'tencent'];

  for (const source of sources) {
    console.log(`\n使用数据源: ${source}`);
    try {
      const result = await searchService.search({
        query: '茅台',
        preferredSource: source,
      });
      console.log(`结果: ${result.data.length} 条记录`);
      console.log(`实际数据源: ${result.source}`);
      console.log(`成功: ${result.success}`);
    } catch (error) {
      console.log(`错误: ${error}`);
    }
  }

  // 测试5：缓存统计
  console.log('\n5. 测试缓存统计...');
  const cacheStats = cache.getStats();
  console.log('缓存统计:', cacheStats);
  console.log('缓存键:', cache.getKeys().slice(0, 5), '...');

  // 测试6：清理缓存
  console.log('\n6. 测试缓存清理...');
  const cleared = searchService.clearCache();
  console.log(`清理了 ${cleared} 个缓存条目`);

  const newCacheStats = cache.getStats();
  console.log('清理后缓存大小:', newCacheStats.size);

  // 测试7：代理服务连接测试
  console.log('\n7. 测试代理服务连接...');
  try {
    const connectionTest = await proxyService.testConnection();
    console.log('连接测试结果:', connectionTest);
  } catch (error) {
    console.log('代理连接测试失败:', error);
  }

  // 测试8：错误处理
  console.log('\n8. 测试错误处理...');

  // 空查询
  console.log('\n测试空查询:');
  const emptyResult = await searchService.search({ query: '' });
  console.log(`结果: ${emptyResult.data.length} 条记录`);
  console.log(`成功: ${emptyResult.success}`);

  // 超短查询
  console.log('\n测试超短查询 ("a"):');
  const shortResult = await searchService.search({ query: 'a' });
  console.log(`结果: ${shortResult.data.length} 条记录`);
  console.log(`成功: ${shortResult.success}`);

  // 不存在的查询
  console.log('\n测试不存在的查询 ("不存在的数据"):');
  const notFoundResult = await searchService.search({ query: '不存在的数据' });
  console.log(`结果: ${notFoundResult.data.length} 条记录`);
  console.log(`数据源: ${notFoundResult.source}`);
  console.log(`成功: ${notFoundResult.success}`);

  // 测试9：性能测试
  console.log('\n9. 性能测试...');
  const performanceQueries = ['银行', '证券', '保险', '科技', '医药'];
  const startTime = Date.now();

  const promises = performanceQueries.map(query =>
    searchService.search({ query, useCache: false })
  );

  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  console.log(`并发搜索 ${performanceQueries.length} 个查询`);
  console.log(`总时间: ${totalTime}ms`);
  console.log(`平均时间: ${totalTime / performanceQueries.length}ms`);

  let totalResults = 0;
  for (let i = 0; i < results.length; i++) {
    totalResults += results[i].data.length;
    console.log(`${performanceQueries[i]}: ${results[i].data.length} 条记录 (${results[i].source})`);
  }
  console.log(`总结果数: ${totalResults}`);

  // 测试10：降级机制
  console.log('\n10. 测试降级机制...');

  // 模拟所有数据源失败的情况
  console.log('测试降级数据...');
  const fallbackQuery = '测试降级';
  const fallbackResult = await searchService.search({
    query: fallbackQuery,
    useCache: false,
  });

  console.log(`查询: "${fallbackQuery}"`);
  console.log(`结果: ${fallbackResult.data.length} 条记录`);
  console.log(`数据源: ${fallbackResult.source}`);
  console.log(`降级使用: ${fallbackResult.metadata?.fallbackUsed}`);
  console.log(`成功: ${fallbackResult.success}`);

  console.log('\n=== 测试完成 ===');
}

// 运行测试
if (require.main === module) {
  runTests().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
  });
}

export { runTests };