/**
 * K线数据服务测试示例
 *
 * 使用方法：
 * 1. 在你的组件或API中导入：
 *    import { getKLineData } from '@/lib/kline-api';
 *
 * 2. 调用获取数据：
 *    const result = await getKLineData({
 *      stockCode: '600519',
 *      timeFrame: 'daily',
 *      limit: 200
 *    });
 *
 * 3. 使用数据：
 *    if (result.success) {
 *      console.log('数据来源:', result.source);
 *      console.log('是否缓存:', result.cached);
 *      console.log('数据点数:', result.data.length);
 *      result.data.forEach(point => {
 *        console.log(point.time, point.close);
 *      });
 *    }
 */

import { getKLineData } from './index';

// 测试函数
export async function testKLineAPI() {
  console.log('=== K线数据服务测试 ===\n');

  // 测试1: 获取日K数据
  console.log('测试1: 获取贵州茅台日K数据');
  try {
    const result1 = await getKLineData({
      stockCode: '600519',
      timeFrame: 'daily',
      limit: 50,
    });

    console.log('✓ 成功');
    console.log(`  - 数据来源: ${result1.source}`);
    console.log(`  - 是否缓存: ${result1.cached}`);
    console.log(`  - 数据点数: ${result1.data.length}`);
    console.log(`  - 最新数据: ${result1.data[result1.data.length - 1]?.time} 收盘价 ${result1.data[result1.data.length - 1]?.close}`);
  } catch (error) {
    console.log('✗ 失败:', error);
  }

  console.log('\n');

  // 测试2: 测试缓存
  console.log('测试2: 再次获取同样数据（应该命中缓存）');
  try {
    const result2 = await getKLineData({
      stockCode: '600519',
      timeFrame: 'daily',
      limit: 50,
    });

    console.log('✓ 成功');
    console.log(`  - 数据来源: ${result2.source}`);
    console.log(`  - 是否缓存: ${result2.cached}`);
    console.log(`  - 数据点数: ${result2.data.length}`);
  } catch (error) {
    console.log('✗ 失败:', error);
  }

  console.log('\n');

  // 测试3: 不同时间周期
  console.log('测试3: 获取周K数据');
  try {
    const result3 = await getKLineData({
      stockCode: '000001',
      timeFrame: 'weekly',
      limit: 30,
    });

    console.log('✓ 成功');
    console.log(`  - 数据来源: ${result3.source}`);
    console.log(`  - 是否缓存: ${result3.cached}`);
    console.log(`  - 数据点数: ${result3.data.length}`);
  } catch (error) {
    console.log('✗ 失败:', error);
  }

  console.log('\n=== 测试完成 ===');
}

// 如果直接运行此文件
if (require.main === module) {
  testKLineAPI();
}
