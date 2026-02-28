/**
 * DeepSeek API测试脚本
 * 使用方法: npx tsx scripts/test-deepseek-api.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

async function testDeepSeekAPI() {
  console.log('🔍 开始测试 DeepSeek API...\n');

  // 检查API密钥
  if (!DEEPSEEK_API_KEY) {
    console.error('❌ 错误: DEEPSEEK_API_KEY 环境变量未设置');
    console.log('请在 .env.local 中配置: DEEPSEEK_API_KEY=sk-xxx');
    process.exit(1);
  }

  console.log(`✅ API密钥已配置: ${DEEPSEEK_API_KEY.substring(0, 10)}...`);
  console.log(`📡 API端点: ${DEEPSEEK_API_URL}\n`);

  try {
    // 测试流式请求
    console.log('📤 发送测试请求...');
    const startTime = Date.now();

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的股票分析师。'
          },
          {
            role: 'user',
            content: '简单介绍一下什么是K线图？请在50字内回答。'
          }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API请求失败 (${response.status}): ${errorData.error?.message || response.statusText}`
      );
    }

    console.log(`✅ 连接成功 (耗时: ${Date.now() - startTime}ms)`);
    console.log('\n📥 接收流式响应:\n');

    // 读取流式响应
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let chunkCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              console.log('\n\n✅ 流式传输完成');
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                process.stdout.write(content);
                fullText += content;
                chunkCount++;
              }
            } catch (e) {
              // 忽略JSON解析错误
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const totalTime = Date.now() - startTime;

    console.log('\n\n📊 测试统计:');
    console.log(`  - 总耗时: ${totalTime}ms`);
    console.log(`  - 响应块数: ${chunkCount}`);
    console.log(`  - 响应长度: ${fullText.length} 字符`);
    console.log(`  - 首字延迟: ~${totalTime / (chunkCount || 1)}ms/chunk`);

    console.log('\n✅ DeepSeek API 测试通过！');
    console.log('\n💡 下一步:');
    console.log('  1. 启动开发服务器: npm run dev');
    console.log('  2. 访问任意股票详情页');
    console.log('  3. 切换到 "💬 AI对话" 标签页');
    console.log('  4. 尝试预设问题或自定义提问');

  } catch (error) {
    console.error('\n❌ 测试失败:', error instanceof Error ? error.message : error);
    console.log('\n🔧 故障排查:');
    console.log('  1. 检查网络连接');
    console.log('  2. 验证API密钥是否正确');
    console.log('  3. 确认DeepSeek服务是否可用');
    console.log('  4. 检查是否有代理或防火墙限制');
    process.exit(1);
  }
}

testDeepSeekAPI();
