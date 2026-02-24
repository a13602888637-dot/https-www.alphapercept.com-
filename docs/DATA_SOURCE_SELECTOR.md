# Alpha-Quant-Copilot 智能数据源选择器

## 概述

智能数据源选择器是一个多数据源智能路由系统，用于自动选择最优的数据源获取市场数据。系统支持健康检查、性能监控、故障自动切换和智能路由决策。

## 核心特性

### 1. 多数据源支持
- **新浪财经API**: 主要A股数据源
- **腾讯财经API**: 备用A股数据源
- **雅虎财经API**: 全球备用数据源
- **模拟数据源**: 最终降级数据源

### 2. 智能路由算法
- **健康度评分**: 基于成功率、延迟、连续失败次数计算
- **地理位置优化**: 根据用户区域选择最优数据源
- **符号特定优化**: 根据股票代码选择最适合的数据源
- **动态权重调整**: 根据历史性能动态调整数据源权重

### 3. 健康检查系统
- 定期检查数据源可用性
- 实时监控响应延迟
- 自动故障检测和恢复
- 熔断机制防止雪崩效应

### 4. 性能监控
- 请求成功率统计
- 平均延迟监控
- 区域性能分析
- 实时性能报告

### 5. 配置化管理
- JSON配置文件管理
- 动态配置更新
- 配置版本控制
- 热重载支持

## 架构设计

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    SmartDataSourceSelector                   │
├─────────────────────────────────────────────────────────────┤
│  - 智能路由决策                                             │
│  - 故障自动切换                                             │
│  - 性能监控统计                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    DataSourceManager                         │
├─────────────────────────────────────────────────────────────┤
│  - 数据源配置管理                                           │
│  - 健康检查执行                                             │
│  - 性能数据收集                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    DataSourceConfigManager                   │
├─────────────────────────────────────────────────────────────┤
│  - 配置文件管理                                             │
│  - 配置验证合并                                             │
│  - 配置热重载                                               │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户请求 → 智能路由决策 → 选择最佳数据源 → 获取数据
       ↓                    ↓                    ↓
   性能监控 ←───── 记录结果 ←───── 执行请求 ←───── 备用数据源
```

## 安装和配置

### 1. 依赖安装

已集成到现有项目中，无需额外安装。

### 2. 配置文件

配置文件位置: `config/data_sources.json`

主要配置项:
```json
{
  "dataSources": [
    {
      "type": "sina",
      "enabled": true,
      "priority": 90,
      "weight": 85,
      "timeout": 10000,
      "region": "cn"
    }
  ],
  "routing": {
    "strategy": "smart",
    "maxRetries": 3
  },
  "monitoring": {
    "enableHealthChecks": true,
    "healthCheckInterval": 60000
  }
}
```

### 3. 环境变量

可选环境变量:
```bash
# 数据源选择器配置
DATA_SOURCE_CONFIG_PATH="./config/data_sources.json"
DATA_SOURCE_HEALTH_CHECK_INTERVAL=60000
DATA_SOURCE_ENABLE_GEO_ROUTING=true
```

## API 使用

### 1. 智能数据获取

```typescript
import { fetchStockDataSmart, fetchMultipleStocksSmart } from '../skills/data_crawler';

// 获取单个股票数据
const stockData = await fetchStockDataSmart('000001');

// 批量获取股票数据
const multipleStocks = await fetchMultipleStocksSmart(['000001', '600000']);
```

### 2. 数据源管理API

**获取数据源状态**
```bash
GET /api/data-sources
GET /api/data-sources?action=stats
GET /api/data-sources?action=health
GET /api/data-sources?action=config
GET /api/data-sources?action=report
```

**更新数据源配置**
```bash
POST /api/data-sources
Content-Type: application/json

{
  "action": "update-config",
  "sourceType": "sina",
  "config": {
    "enabled": true,
    "priority": 95,
    "timeout": 8000
  }
}
```

**启用/禁用数据源**
```bash
POST /api/data-sources
Content-Type: application/json

{
  "action": "enable-source",
  "sourceType": "yahoo"
}

{
  "action": "disable-source",
  "sourceType": "tencent"
}
```

**执行健康检查**
```bash
POST /api/data-sources
Content-Type: application/json

{
  "action": "health-check",
  "sourceType": "sina"  # 可选，不指定则检查所有
}
```

### 3. 编程接口

```typescript
import { dataSourceSelector } from '../skills/data_source_selector';
import { dataSourceConfigManager } from '../skills/data_source_config';

// 获取性能报告
const report = dataSourceSelector.getPerformanceReport();

// 获取统计数据
const stats = dataSourceSelector.getManager().getDataSourceStats();

// 执行健康检查
const healthChecks = await dataSourceSelector.getManager().performBatchHealthCheck();

// 更新配置
dataSourceConfigManager.updateDataSourceConfig('sina', {
  priority: 95,
  timeout: 8000
});
```

## 路由策略

### 1. 智能路由（默认）

综合考虑以下因素:
- **健康度评分** (40%): 基于历史成功率、延迟、连续失败次数
- **基础优先级** (30%): 配置中的优先级设置
- **区域优化** (10%): 用户地理位置匹配
- **符号优化** (5%): 股票代码特定优化
- **最近健康检查** (15%): 最近健康检查结果

### 2. 优先级路由

按配置优先级顺序选择数据源。

### 3. 轮询路由

按顺序轮流使用各数据源。

### 4. 随机路由

随机选择数据源（用于负载测试）。

## 健康检查机制

### 检查频率
- 新浪/腾讯: 每30秒
- 雅虎: 每45秒
- 模拟数据源: 每60秒

### 检查内容
1. **连接测试**: 测试API端点可达性
2. **响应验证**: 验证响应格式和内容
3. **延迟测量**: 记录响应时间
4. **错误检测**: 检测API错误和异常

### 熔断机制
- 连续失败3次: 标记为不健康
- 连续失败5次: 触发熔断，暂停使用60秒
- 恢复检查: 熔断后每30秒尝试恢复

## 性能监控

### 监控指标
- **请求总数**: 总请求次数
- **成功率**: 成功请求比例
- **平均延迟**: 请求平均响应时间
- **连续失败**: 连续失败次数
- **健康度评分**: 综合健康评分 (0-100)

### 统计窗口
- 最近100次请求的统计数据
- 7天内的性能趋势
- 区域性能分析

### 报警阈值
```json
{
  "successRate": 80,      // 成功率低于80%报警
  "avgLatency": 5000,     // 平均延迟超过5秒报警
  "consecutiveFailures": 3 // 连续失败3次报警
}
```

## 故障处理

### 1. 数据源故障
- 自动切换到备用数据源
- 记录故障信息
- 触发健康检查
- 更新健康度评分

### 2. 网络故障
- 重试机制（最多3次）
- 指数退避重试延迟
- 最终降级到模拟数据

### 3. API限制
- 自动切换到备用API端点
- 调整请求频率
- 记录限流信息

### 4. 数据不一致
- 数据验证和清洗
- 异常数据过滤
- 数据源交叉验证

## 集成指南

### 1. 替换现有数据获取

**之前:**
```typescript
import { fetchMarketDataWithFallback } from '../skills/data_crawler';

const data = await fetchMarketDataWithFallback('000001');
```

**之后:**
```typescript
import { fetchStockDataSmart } from '../skills/data_crawler';

const data = await fetchStockDataSmart('000001');
```

### 2. 批量数据获取

**之前:**
```typescript
import { fetchMultipleStocks } from '../skills/data_crawler';

const stocks = await fetchMultipleStocks(['000001', '600000']);
```

**之后:**
```typescript
import { fetchMultipleStocksSmart } from '../skills/data_crawler';

const stocks = await fetchMultipleStocksSmart(['000001', '600000']);
```

### 3. 向后兼容

系统保持向后兼容，现有API继续工作:
- `fetchSinaStockData()` - 直接使用新浪API
- `fetchTencentStockData()` - 直接使用腾讯API
- `fetchYahooStockData()` - 直接使用雅虎API
- `fetchMarketDataWithFallback()` - 顺序回退机制
- `fetchMultipleStocks()` - 批量顺序回退

## 测试和验证

### 1. 单元测试
```bash
# 测试智能路由
npm test -- --testPathPattern=data_source_selector

# 测试健康检查
npm test -- --testPathPattern=data_source_health
```

### 2. 集成测试
```typescript
import { testSmartDataSourceSelector } from '../skills/data_crawler';

// 运行集成测试
const result = await testSmartDataSourceSelector();
console.log('Test result:', result ? 'PASS' : 'FAIL');
```

### 3. 性能测试
```bash
# 压力测试
node scripts/stress_test.js --sources=all --duration=300

# 延迟测试
node scripts/latency_test.js --region=cn --iterations=100
```

### 4. 监控验证
1. 访问 `/api/data-sources?action=report` 查看性能报告
2. 检查日志中的健康检查记录
3. 监控数据源切换频率
4. 验证故障恢复机制

## 配置示例

### 1. 自定义数据源配置

```json
{
  "type": "custom",
  "name": "自定义数据源",
  "enabled": true,
  "priority": 85,
  "weight": 80,
  "timeout": 12000,
  "retryCount": 2,
  "healthCheckInterval": 40000,
  "region": "cn",
  "endpoints": [
    "https://api.custom-finance.com/v1"
  ],
  "metadata": {
    "description": "自定义金融数据API",
    "rateLimit": "100次/分钟",
    "dataFreshness": "实时",
    "coverage": "A股、港股",
    "reliability": "高"
  }
}
```

### 2. 路由策略配置

```json
{
  "routing": {
    "strategy": "priority",
    "enableGeoRouting": false,
    "enableSymbolRouting": true,
    "failoverThreshold": 2,
    "recoveryCheckInterval": 15000,
    "maxRetries": 2,
    "retryDelay": 500,
    "enableCircuitBreaker": true,
    "circuitBreakerThreshold": 3,
    "circuitBreakerTimeout": 30000
  }
}
```

### 3. 监控配置

```json
{
  "monitoring": {
    "enableStats": true,
    "statsRetentionDays": 30,
    "enableHealthChecks": true,
    "healthCheckInterval": 30000,
    "enableAlerting": true,
    "alertThresholds": {
      "successRate": 90,
      "avgLatency": 3000,
      "consecutiveFailures": 2
    },
    "alertChannels": ["slack", "email"]
  }
}
```

## 故障排除

### 常见问题

1. **数据源全部失败**
   - 检查网络连接
   - 验证API端点可达性
   - 检查防火墙设置
   - 查看错误日志

2. **健康检查失败**
   - 检查健康检查配置
   - 验证测试符号有效性
   - 检查响应解析逻辑
   - 查看健康检查日志

3. **路由决策不合理**
   - 检查健康度评分计算
   - 验证区域检测逻辑
   - 检查权重配置
   - 查看路由决策日志

4. **性能下降**
   - 检查数据源延迟
   - 验证熔断机制
   - 检查重试配置
   - 监控系统资源

### 日志分析

关键日志位置:
- `logs/data_source_selector.log` - 选择器日志
- `logs/health_check.log` - 健康检查日志
- `logs/performance.log` - 性能监控日志
- `logs/error.log` - 错误日志

### 调试模式

启用调试日志:
```typescript
import { Logger } from '../skills/data_crawler';

Logger.setLogLevel('debug');
```

## 性能优化

### 1. 缓存策略
- 健康检查结果缓存（30秒）
- 路由决策缓存（10秒）
- 统计数据缓存（60秒）

### 2. 并发优化
- 并行健康检查
- 异步数据获取
- 连接池复用

### 3. 内存优化
- 统计数据窗口限制（最近100次）
- 定期清理旧数据
- 内存使用监控

### 4. 网络优化
- 连接超时优化
- 重试策略优化
- 压缩传输启用

## 安全考虑

### 1. API安全
- 请求频率限制
- API密钥管理（如需）
- 请求签名验证
- 传输加密（HTTPS）

### 2. 配置安全
- 配置文件权限控制
- 配置加密存储
- 配置变更审计
- 备份和恢复

### 3. 数据安全
- 数据验证和清洗
- 异常数据过滤
- 隐私数据保护
- 数据源认证

## 扩展开发

### 1. 添加新数据源

```typescript
// 1. 扩展DataSourceType枚举
enum DataSourceType {
  SINA = 'sina',
  TENCENT = 'tencent',
  YAHOO = 'yahoo',
  SIMULATED = 'simulated',
  CUSTOM = 'custom'  // 新增
}

// 2. 添加数据源获取函数
async function fetchCustomStockData(symbol: string): Promise<MarketData> {
  // 实现自定义数据源逻辑
}

// 3. 更新智能路由
const fetchFunctions = {
  [DataSourceType.CUSTOM]: () => fetchCustomStockData(symbol),
  // ... 其他数据源
};
```

### 2. 自定义路由策略

```typescript
class CustomRoutingStrategy {
  makeDecision(sources: DataSourceConfig[], stats: DataSourceStats[]): RoutingDecision {
    // 实现自定义路由逻辑
  }
}
```

### 3. 扩展监控指标

```typescript
interface ExtendedDataSourceStats extends DataSourceStats {
  customMetric1: number;
  customMetric2: string;
  // ... 自定义指标
}
```

## 版本历史

### v1.0.0 (2026-02-24)
- 初始版本发布
- 支持新浪、腾讯、雅虎、模拟数据源
- 智能路由算法
- 健康检查系统
- 性能监控和统计
- 配置化管理
- RESTful API接口

### 未来计划
- 机器学习路由优化
- 实时性能预测
- 多区域负载均衡
- 高级报警系统
- 可视化监控面板

## 支持与贡献

### 问题报告
- GitHub Issues: [项目地址]/issues
- 错误模板: 包含环境、步骤、日志、期望结果

### 功能请求
- 描述使用场景
- 提供具体需求
- 建议实现方案

### 代码贡献
1. Fork 项目仓库
2. 创建功能分支
3. 提交代码变更
4. 创建 Pull Request
5. 通过代码审查

### 文档改进
- 修正错误内容
- 补充使用示例
- 添加最佳实践
- 翻译多语言版本

## 许可证

MIT License - 详见 LICENSE 文件