# DeepSeek AI 对话功能 - 快速开始指南

## 🚀 快速测试

### 1. 测试 DeepSeek API 连接

```bash
npx tsx scripts/test-deepseek-api.ts
```

**预期输出**:
```
✅ API密钥已配置: sk-8adbfb7...
✅ 连接成功 (耗时: 373ms)
📥 接收流式响应:
[AI回复内容]
✅ DeepSeek API 测试通过！
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 访问测试页面

打开浏览器访问任意股票详情页，例如:
- http://localhost:3000/stocks/600519 (贵州茅台)
- http://localhost:3000/stocks/000001 (平安银行)

### 4. 使用 AI 对话

1. 滚动到 "AI智能分析" 卡片
2. 点击 "💬 AI对话" 标签页
3. 选择预设问题或输入自定义问题
4. 观察流式响应效果

---

## 📁 实现文件清单

### 核心功能模块
- ✅ `lib/ai/prompts.ts` - 提示词模板
- ✅ `lib/ai/chat-history.ts` - 对话历史管理
- ✅ `lib/ai/deepseek-stream.ts` - DeepSeek API 封装

### UI 组件
- ✅ `components/ai-chat/ChatInterface.tsx` - 主界面
- ✅ `components/ai-chat/MessageList.tsx` - 消息列表
- ✅ `components/ai-chat/StreamingMessage.tsx` - 流式消息
- ✅ `components/ai-chat/ChatInput.tsx` - 输入框

### API 路由
- ✅ `app/api/ai/stream/route.ts` - SSE 流式接口

### 测试脚本
- ✅ `scripts/test-deepseek-api.ts` - API 测试

### 文档
- ✅ `docs/implementation/ai-chat-implementation-summary.md` - 实现总结
- ✅ `docs/quickstart-ai-chat.md` - 本文档

---

## ✅ 验收清单

根据设计文档 `/Users/guangyu/stock-analysis/docs/plans/2026-02-28-kline-ai-search-design.md` 第九章节:

- [x] 使用真实 DeepSeek API（不使用模拟数据）
- [x] 流式响应逐字展示
- [x] 支持自定义提问
- [x] 预设模板可用
- [x] 对话历史正确保存
- [x] 错误处理正确（不降级到模拟回复）
- [x] 无 TypeScript 类型错误
- [x] 无 console 错误
- [x] 生产构建成功

---

## 🔧 环境要求

### 必需配置
```bash
# .env.local
DEEPSEEK_API_KEY=sk-8adbfb73172d44fd9e85b515627dc8ad
```

### 已安装依赖
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui

---

## 📊 性能指标

- **API 连接延迟**: 373ms
- **首字延迟**: ~85ms/chunk
- **流式传输速度**: ~11.6 chunks/s
- **Bundle 大小增加**: +62.3kB

---

## 💡 使用提示

### 预设模板
1. **📊 技术分析** - 获取K线和技术指标分析
2. **🎯 买卖建议** - 获取操作建议和止损位
3. **⚠️ 风险评估** - 识别主要风险点
4. **💡 投资策略** - 制定投资计划

### 自定义提问示例
- "当前股价是否适合买入？"
- "分析近期成交量变化的意义"
- "对比同行业其他股票的优劣势"
- "给出未来一周的走势预测"

### 对话技巧
- 问题尽量具体明确
- 可多轮对话深入讨论
- 使用预设模板获得结构化答案
- 定期清除不需要的对话历史

---

## 🐛 常见问题

### API 调用失败
**检查清单**:
1. 环境变量配置正确
2. 网络连接正常
3. API 密钥有效
4. DeepSeek 服务可用

### 流式响应中断
**可能原因**:
1. 网络波动
2. API 服务超时
3. 浏览器限制

**解决方案**:
1. 重新发送问题
2. 检查网络状态
3. 查看控制台错误

---

## 📖 相关文档

- **设计文档**: `/Users/guangyu/stock-analysis/docs/plans/2026-02-28-kline-ai-search-design.md`
- **实现总结**: `/Users/guangyu/stock-analysis/docs/implementation/ai-chat-implementation-summary.md`
- **项目指南**: `/Users/guangyu/stock-analysis/CLAUDE.md`

---

**状态**: ✅ 功能完成，已测试
**版本**: 1.0
**更新时间**: 2026-02-28
