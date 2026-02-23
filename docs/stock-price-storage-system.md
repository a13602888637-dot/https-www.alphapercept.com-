# 自选股实时数据存储系统

## 概述

本系统实现了自选股实时数据的获取、存储和分析功能。系统会自动获取用户自选股的实时价格，存储到数据库，并提供历史数据查询和趋势分析功能。

## 系统架构

### 1. 数据库模型

#### StockPriceHistory 表
```prisma
model StockPriceHistory {
  id          String   @id @default(cuid())
  stockCode   String   // 股票代码
  price       Decimal  // 当前价格
  volume      Decimal? // 成交量
  turnover    Decimal? // 成交额
  highPrice   Decimal? // 最高价
  lowPrice    Decimal? // 最低价
  change      Decimal? // 涨跌额
  changePercent Decimal? // 涨跌幅
  timestamp   DateTime @default(now()) // 数据时间戳
  createdAt   DateTime @default(now()) // 记录创建时间

  @@index([stockCode])
  @@index([timestamp])
  @@index([stockCode, timestamp])
  @@unique([stockCode, timestamp])
}
```

### 2. API 端点

#### GET /api/stock-prices
获取实时股票价格并自动存储到数据库

**参数：**
- `symbols` (必需): 股票代码，多个用逗号分隔，如 `000001,600000`

**响应：**
```json
{
  "success": true,
  "prices": {
    "000001": {
      "price": 15.80,
      "change": 0.25,
      "changePercent": 1.61,
      "high": 16.20,
      "low": 15.50,
      "volume": 12345678,
      "turnover": 195000000,
      "lastUpdate": "2026-02-23 14:30:00",
      "name": "平安银行"
    }
  },
  "timestamp": "2026-02-23T14:30:00.000Z",
  "count": 1,
  "totalRequested": 1
}
```

#### GET /api/stock-price-history
查询股票历史价格数据，包含趋势分析

**参数：**
- `stockCode` (必需): 股票代码
- `startDate`: 开始日期 (默认: 30天前)
- `endDate`: 结束日期 (默认: 当前时间)
- `interval`: 时间间隔 (day/hour/minute，默认: day)
- `limit`: 返回数据点数量 (默认: 100)

**响应：**
```json
{
  "success": true,
  "stockCode": "000001",
  "interval": "day",
  "dateRange": {
    "start": "2026-01-24T00:00:00.000Z",
    "end": "2026-02-23T00:00:00.000Z"
  },
  "data": [
    {
      "timestamp": "2026-02-23T00:00:00.000Z",
      "price": 15.80,
      "high": 16.20,
      "low": 15.50,
      "volume": 12345678,
      "turnover": 195000000,
      "change": 0.25,
      "changePercent": 1.61,
      "dataPoints": 48
    }
  ],
  "analysis": {
    "trend": "up",
    "strength": 0.85,
    "volatility": 0.023,
    "support": 15.20,
    "resistance": 16.50,
    "movingAverages": {
      "sma5": 15.65,
      "sma10": 15.40,
      "sma20": 15.10
    },
    "volumeAnalysis": {
      "averageVolume": 10000000,
      "recentVolume": 12345678,
      "trend": "increasing"
    }
  }
}
```

### 3. 定时任务

#### 自选股价格更新任务
- **频率**: 每5分钟执行一次（可配置）
- **功能**: 获取所有用户自选股的实时价格并存储
- **配置**: `scheduler/config/scheduler.config.ts`

#### 数据清理任务
- **频率**: 每天执行一次（可配置）
- **功能**: 清理超过90天的旧数据
- **配置**: `scheduler/config/scheduler.config.ts`

## 使用指南

### 1. 启动系统

```bash
# 启动Next.js开发服务器
npm run next:dev

# 启动调度器（在另一个终端）
npm run scheduler:start
```

### 2. 查看系统状态

```bash
# 查看调度器状态
npm run scheduler:status

# 输出示例：
# 📈 Alpha-Quant-Copilot 调度器状态
# ================================
# 运行状态: ✅ 运行中
# 启动时间: 2026-02-23 14:30:00
# 运行时长: 15分钟
#
# 📊 任务状态:
# 盘中扫描: ✅ 已调度
#   执行次数: 2
#   上次执行: 2026-02-23 14:00:00
#   下次执行: 2026-02-23 15:00:00
#
# 盘后复盘: ✅ 已调度
#   执行次数: 0
#   上次执行: 从未执行
#   下次执行: 2026-02-23 15:30:00
#
# 自选股价格更新: ✅ 已调度
#   执行次数: 3
#   上次执行: 2026-02-23 14:25:00
#   下次执行: 2026-02-23 14:30:00
```

### 3. 手动触发任务

```bash
# 手动触发自选股价格更新
node scheduler/main.ts trigger-watchlist-price

# 手动触发盘中扫描
node scheduler/main.ts trigger-intraday

# 手动触发盘后复盘
node scheduler/main.ts trigger-postmarket
```

### 4. 测试系统

```bash
# 运行测试脚本
node scripts/test-stock-price-storage.js
```

## 配置说明

### 调度器配置 (`scheduler/config/scheduler.config.ts`)

```typescript
watchlistPriceUpdate: {
  enabled: true,           // 是否启用
  intervalMinutes: 5,      // 更新间隔（分钟）
  batchSize: 20,           // 批量处理大小
  maxRetries: 2            // 最大重试次数
},

dataCleanup: {
  enabled: true,           // 是否启用
  retentionDays: 90,       // 数据保留天数
  cleanupIntervalHours: 24, // 清理间隔（小时）
  batchSize: 1000          // 批量删除大小
}
```

### 环境变量

确保以下环境变量已正确配置：

```bash
# 数据库连接
DATABASE_URL="postgresql://username:password@host:6543/database?pgbouncer=true"
DIRECT_URL="postgresql://username:password@host:5432/database"

# 新浪/腾讯API无需Token
```

## 数据存储策略

### 1. 增量存储
- 只有当价格变化超过0.01%时才存储新记录
- 避免存储大量重复数据
- 每分钟最多存储一条记录

### 2. 数据清理
- 自动清理超过90天的旧数据
- 保留最近3个月的数据用于趋势分析
- 支持手动调整保留期限

### 3. 性能优化
- 添加复合索引 `(stockCode, timestamp)`
- 使用批量操作减少数据库压力
- 支持分页查询大数据集

## 趋势分析功能

### 1. 技术指标
- 简单移动平均线 (SMA 5/10/20)
- 趋势强度和方向
- 支撑位和阻力位识别
- 波动率计算

### 2. 成交量分析
- 平均成交量
- 成交量趋势
- 量价关系分析

### 3. 价格行为
- 价格区间分析
- 高低点识别
- 价格变化统计

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 `DATABASE_URL` 和 `DIRECT_URL` 环境变量
   - 确保数据库服务正在运行
   - 运行 `npx prisma migrate dev` 创建表

2. **API调用失败**
   - 检查新浪/腾讯API是否可访问
   - 查看服务器日志中的错误信息
   - 验证股票代码格式（如 `000001` 而不是 `000001.SZ`）

3. **数据未存储**
   - 检查 `storePriceHistory` 函数的错误日志
   - 验证价格变化是否超过0.01%阈值
   - 检查数据库权限

4. **调度器未运行**
   - 检查 `npm run scheduler:status`
   - 查看调度器日志文件
   - 验证时区设置（Asia/Shanghai）

### 日志查看

调度器日志位于 `scheduler/logs/` 目录，包含：
- 任务执行记录
- 错误信息
- 性能指标
- 数据库操作统计

## 扩展功能

### 1. 添加新的数据源
- 实现新的 `fetchStockData` 函数
- 添加到 `data_crawler.ts` 中的回退机制
- 更新API响应格式

### 2. 自定义分析指标
- 在 `calculateTrendIndicators` 函数中添加新指标
- 扩展 `stock-price-history` API响应
- 添加配置选项

### 3. 数据导出
- 添加CSV/JSON导出功能
- 支持特定时间范围的数据导出
- 添加批量导出接口

### 4. 实时通知
- 价格突破预警
- 成交量异常提醒
- 趋势变化通知

## 性能监控

### 关键指标
- 数据存储速率（记录/分钟）
- 数据库查询响应时间
- API调用成功率
- 内存使用情况

### 监控建议
- 定期检查数据库索引性能
- 监控API响应时间
- 设置数据存储失败告警
- 定期清理日志文件

---

**最后更新**: 2026-02-23
**版本**: 1.0.0
**维护者**: Alpha-Quant-Copilot Team