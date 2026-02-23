# Alpha-Quant-Copilot 自动化调度系统

基于node-cron的自动化调度系统，实现盘中热点扫描和盘后深度复盘功能。

## 功能特性

### 🕒 盘中热点扫描（每小时执行）
- 扫描涨幅榜前20名
- 分析成交量异动（达到20日均量2倍以上）
- 识别MA60突破信号（突破3%以上）
- 生成实时警报（信息/警告/关键三级）
- 支持中国股市交易时间（9:30-15:00）

### 📊 盘后深度复盘（每日15:30执行）
- 全市场数据分析
- 策略表现评估（五大投资流派）
- MA60/MD60纪律执行情况分析
- 规则优化建议生成
- 明日策略建议
- 自动生成复盘报告

### 📝 任务执行日志系统
- 结构化日志记录
- 文件轮转（最大30天，10MB/文件）
- 多级别日志（debug/info/warn/error）
- 支持历史查询

### 🤖 AI推理引擎集成
- DeepSeek AI策略分析
- 自动交易决策生成
- 规则合规性检查
- 市场情绪分析

## 系统架构

```
scheduler/
├── main.ts                    # 主调度器入口
├── config/
│   └── scheduler.config.ts    # 调度器配置
├── tasks/
│   ├── intraday-scan.ts       # 盘中热点扫描任务
│   └── postmarket-review.ts   # 盘后深度复盘任务
├── services/
│   └── ai-service.ts          # AI集成服务
├── utils/
│   └── logger.ts              # 日志系统
└── logs/                      # 日志文件目录
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量（可选）
```bash
# 设置DeepSeek API密钥（用于AI分析）
export DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 3. 启动调度器
```bash
# 使用npm脚本
npm run scheduler:start

# 或直接运行
ts-node scheduler/main.ts start
```

### 4. 查看状态
```bash
npm run scheduler:status
```

### 5. 停止调度器
```bash
npm run scheduler:stop
```

## 命令参考

### 主要命令
```bash
# 启动调度器
npm run scheduler:start

# 停止调度器
npm run scheduler:stop

# 查看状态
npm run scheduler:status

# 显示帮助
npm run scheduler
```

### 手动触发命令
```bash
# 手动触发盘中扫描
ts-node scheduler/main.ts trigger-intraday

# 手动触发盘后复盘
ts-node scheduler/main.ts trigger-postmarket
```

## 配置说明

### 交易时间配置
- **交易时间**: 周一至周五 9:30-15:00
- **盘中扫描**: 每小时执行一次（9:00-15:00）
- **盘后复盘**: 每日15:30执行

### 扫描参数
```typescript
// 默认配置
intradayScan: {
  enabled: true,
  intervalMinutes: 60,        // 扫描间隔
  topGainersCount: 20,        // 涨幅榜前N名
  volumeThreshold: 2.0,       // 成交量异动阈值
  ma60BreakThreshold: 3.0     // MA60突破阈值
}
```

### AI集成配置
```typescript
aiIntegration: {
  enabled: true,
  provider: 'deepseek',       // AI提供商
  model: 'deepseek-chat',     // 模型名称
  maxTokens: 2000,
  temperature: 0.3
}
```

## 日志系统

### 日志文件位置
```
scheduler/logs/
├── scheduler-2026-02-22.log      # 当日日志
├── intraday-scan-2026-02-22.json # 盘中扫描结果
├── postmarket-review-2026-02-22.json # 复盘结果
└── reports/
    └── postmarket-review-2026-02-22.md # 复盘报告
```

### 日志级别
- **debug**: 调试信息（最详细）
- **info**: 常规信息（默认级别）
- **warn**: 警告信息
- **error**: 错误信息

## 输出示例

### 盘中扫描输出
```json
{
  "timestamp": "2026-02-22T10:00:00.000Z",
  "scanType": "intraday",
  "marketStatus": "open",
  "topGainers": [
    {
      "symbol": "000001",
      "name": "平安银行",
      "currentPrice": 10.96,
      "changePercent": 4.38,
      "volumeRatio": 2.5,
      "ma60Status": "above",
      "ma60Distance": 5.2
    }
  ],
  "alerts": [
    {
      "level": "warning",
      "symbol": "000001",
      "message": "平安银行(000001) MA60向上强势突破: 5.2%",
      "action": "consider_buy"
    }
  ]
}
```

### 盘后复盘报告
```markdown
# Alpha-Quant-Copilot 盘后复盘报告
## 2026-02-22 交易日复盘

### 市场概况
- 市场情绪: bullish
- 上涨股票: 1250 只
- 下跌股票: 850 只
- 平均涨跌幅: 1.2%

### 策略表现摘要
- MA60纪律遵守率: 86.7%
- 趋势判断准确率: 73.3%
- 总收益率: 8.75%
- 夏普比率: 1.42
- 最大回撤: -4.32%

### 明日策略方向
- 市场展望: bullish
- 交易焦点: momentum_trading
- 股票配置: 70%
```

## 故障排除

### 常见问题

1. **调度器无法启动**
   - 检查node-cron是否安装：`npm list node-cron`
   - 检查TypeScript配置：`tsc --noEmit`

2. **AI分析失败**
   - 检查API密钥：`echo $DEEPSEEK_API_KEY`
   - 检查网络连接
   - 查看日志文件：`tail -f scheduler/logs/scheduler-*.log`

3. **日志文件过大**
   - 自动轮转：保留30天，单个文件最大10MB
   - 手动清理：删除`scheduler/logs/`下的旧文件

4. **任务未按计划执行**
   - 检查时区设置（Asia/Shanghai）
   - 检查交易时间配置
   - 查看cron表达式是否正确

### 调试模式
```bash
# 设置日志级别为debug
# 修改 scheduler/config/scheduler.config.ts
logging: {
  enabled: true,
  level: 'debug',  # 改为debug级别
  // ...
}

# 重启调度器
npm run scheduler:stop
npm run scheduler:start
```

## 扩展开发

### 添加新任务
1. 在`scheduler/tasks/`目录创建新任务类
2. 实现`execute()`方法
3. 在主调度器中调度任务

### 修改配置
1. 编辑`scheduler/config/scheduler.config.ts`
2. 修改`defaultConfig`对象
3. 重启调度器生效

### 集成其他AI服务
1. 在`scheduler/services/`创建新服务
2. 实现AI分析接口
3. 更新配置中的`aiIntegration.provider`

## 性能监控

### 系统状态查询
```bash
npm run scheduler:status
```

输出包含：
- 调度器运行状态
- 任务执行统计
- 错误记录
- 系统资源使用情况
- AI服务状态

### 健康检查
- 每5分钟自动健康检查
- 内存使用监控
- 任务执行时间统计
- 错误率监控

## 安全注意事项

1. **API密钥保护**
   - 不要将API密钥提交到版本控制
   - 使用环境变量存储敏感信息
   - 定期轮换API密钥

2. **日志文件安全**
   - 日志文件可能包含敏感信息
   - 定期清理旧日志
   - 设置适当的文件权限

3. **网络访问**
   - 仅允许必要的网络访问
   - 使用HTTPS连接API
   - 配置防火墙规则

## 版本历史

- **v1.0.0** (2026-02-22): 初始版本
  - 盘中热点扫描
  - 盘后深度复盘
  - 日志系统
  - AI集成
  - 健康监控

## 技术支持

如有问题，请检查：
1. 日志文件：`scheduler/logs/scheduler-*.log`
2. 配置文件：`scheduler/config/scheduler.config.ts`
3. 环境变量：`DEEPSEEK_API_KEY`

或联系开发团队。