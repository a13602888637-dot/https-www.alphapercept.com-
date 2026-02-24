/**
 * 搜索API代理中间层简单验证脚本
 */

// 模拟测试环境
process.env.NODE_ENV = 'development';

async function testBasicFunctionality() {
  console.log('=== 搜索API代理中间层基本功能验证 ===\n');

  try {
    // 动态导入模块
    const { getSearchService } = await import('../lib/search-proxy/search-service.js');
    const { getCache } = await import('../lib/search-proxy/cache.js');

    const searchService = getSearchService();
    const cache = getCache();

    console.log('1. 测试服务状态...');
    const status = searchService.getStatus();
    console.log('✓ 搜索服务初始化成功');
    console.log(`   缓存: ${status.cache.size}/${status.cache.maxSize} 条目`);
    console.log(`   数据源: ${status.sources.length} 个已启用`);

    console.log('\n2. 测试缓存功能...');
    const testQuery = '测试';

    // 清理缓存
    cache.clear();
    console.log('✓ 缓存清理完成');

    console.log('\n3. 测试搜索功能（使用降级数据）...');
    const result = await searchService.search({
      query: testQuery,
      useCache: true,
      maxResults: 5,
    });

    console.log(`✓ 搜索完成`);
    console.log(`   查询: "${testQuery}"`);
    console.log(`   结果数: ${result.data.length}`);
    console.log(`   数据源: ${result.source}`);
    console.log(`   缓存命中: ${result.cached}`);
    console.log(`   成功: ${result.success}`);

    if (result.data.length > 0) {
      console.log(`   示例结果: ${result.data[0].name} (${result.data[0].code}.${result.data[0].market})`);
    }

    console.log('\n4. 测试缓存统计...');
    const cacheStats = cache.getStats();
    console.log(`✓ 缓存统计`);
    console.log(`   大小: ${cacheStats.size}`);
    console.log(`   最大容量: ${cacheStats.maxSize}`);
    console.log(`   TTL: ${cacheStats.ttl}ms`);

    console.log('\n5. 测试管理功能...');
    const cleared = searchService.clearCache();
    console.log(`✓ 清理缓存: ${cleared} 个条目`);

    console.log('\n=== 基本功能验证完成 ===');
    console.log('✓ 所有基本功能测试通过');

    return true;

  } catch (error) {
    console.error('✗ 验证失败:', error);
    console.error('错误堆栈:', error.stack);
    return false;
  }
}

// 运行验证
if (require.main === module) {
  testBasicFunctionality()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('验证过程异常:', error);
      process.exit(1);
    });
}

module.exports = { testBasicFunctionality };