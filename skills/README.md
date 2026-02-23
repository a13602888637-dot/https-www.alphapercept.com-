# Alpha-Quant-Copilot 爬虫模块

本目录包含股票数据爬虫和财经新闻爬虫，为量化交易系统提供实时数据支持。

## 文件结构

- `data_crawler.ts` - 股票数据爬虫，支持新浪、腾讯等多个数据源
- `news_crawler.ts` - 财经新闻爬虫，支持新浪财经、东方财富、雪球等多个新闻源
- `example_usage.ts` - 使用示例和测试代码
- `deepseek_agent.ts` - DeepSeek AI代理（其他功能）

## 环境要求

1. Node.js >= 18.0.0
2. TypeScript支持
3. 新浪/腾讯财经API（无需Token）

## 环境变量配置

在 `.env.local` 文件中配置以下环境变量：

```bash
# DeepSeek API Key（可选，用于AI分析）
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 日志级别配置（可选）
LOG_LEVEL=info
```

## 安装依赖

```bash
npm install
```

## 使用方法

### 1. 运行示例

```bash
# 运行所有使用示例
npm run dev -- --example

# 或直接运行
npx ts-node skills/example_usage.ts --example
```

### 2. 运行测试

```bash
# 运行爬虫测试
npm run dev -- --test

# 或直接运行
npx ts-node skills/example_usage.ts --test
```

### 3. 在代码中使用

#### 股票数据爬虫

```typescript
import {
  fetchMarketDataWithFallback,
  fetchMultipleStocks,
  fetchSinaStockData,
  fetchTencentStockData
} from './skills/data_crawler';

// 获取单个股票数据（自动回退机制：新浪优先，腾讯备用）
const stockData = await fetchMarketDataWithFallback('000001');

// 获取多只股票数据
const multipleStocks = await fetchMultipleStocks(['000001', '600000', '000002']);

// 直接使用新浪API
const sinaData = await fetchSinaStockData('000001');

// 直接使用腾讯API
const tencentData = await fetchTencentStockData('sh600000');
```

#### 财经新闻爬虫

```typescript
import {
  fetchNewsFromMultipleSources,
  fetchNewsByStockCode,
  fetchNewsByIndustry,
  analyzeNewsSummary,
  NewsCrawlerConfig
} from './skills/news_crawler';

// 配置新闻爬虫
const config: NewsCrawlerConfig = {
  useMockData: false, // 设置为true使用模拟数据
  timeout: 10000,
  maxRetries: 3,
  logLevel: 'info'
};

// 获取多源新闻
const newsItems = await fetchNewsFromMultipleSources(
  ['A股', '市场'],
  ['sina', 'eastmoney'],
  config
);

// 按股票代码获取新闻
const stockNews = await fetchNewsByStockCode('000001', config);

// 按行业获取新闻
const industryNews = await fetchNewsByIndustry('新能源', config);

// 分析新闻摘要
const analysis = analyzeNewsSummary(newsItems);
console.log('总体情感:', analysis.overallSentiment);
console.log('关键主题:', analysis.keyThemes);
```

## 数据格式

### 股票数据格式 (MarketData)

```typescript
interface MarketData {
  symbol: string;        // 股票代码
  name: string;         // 股票名称
  currentPrice: number; // 当前价格
  highPrice: number;    // 最高价
  lowPrice: number;     // 最低价
  lastUpdateTime: string; // 最后更新时间
  change?: number;      // 涨跌额
  changePercent?: number; // 涨跌幅
  volume?: number;      // 成交量
  turnover?: number;    // 成交额
  peRatio?: number;     // 市盈率
  marketCap?: number;   // 市值
}
```

### 新闻数据格式 (NewsItem)

```typescript
interface NewsItem {
  title: string;        // 新闻标题
  summary: string;      // 新闻摘要
  content: string;      // 新闻内容
  source: string;       // 新闻来源
  url: string;          // 新闻链接
  publishTime: string;  // 发布时间
  sentiment: 'positive' | 'negative' | 'neutral'; // 情感分析
  keywords: string[];   // 关键词
  relatedStocks: string[]; // 相关股票
  impactLevel: 'high' | 'medium' | 'low'; // 影响级别
}
```

## 特性

### 数据爬虫特性

1. **多数据源支持**：新浪财经（主要）、腾讯财经（备用）
2. **自动回退机制**：当新浪API失败时自动切换到腾讯API
3. **重试机制**：网络请求失败时自动重试（最多3次）
4. **错误处理**：完善的错误处理和日志记录
5. **实时数据**：支持实时行情数据获取
6. **编码处理**：自动处理GBK/GB18030等中文编码

### 新闻爬虫特性

1. **多新闻源**：新浪财经、东方财富、雪球
2. **模拟数据**：支持模拟数据模式，避免网络依赖
3. **情感分析**：内置中文情感分析算法
4. **股票关联**：自动提取新闻中的股票代码
5. **影响评估**：评估新闻对市场的影响级别
6. **关键词提取**：自动提取新闻关键词
7. **去重功能**：基于标题相似性去重

## 错误处理

两个爬虫都包含完善的错误处理机制：

1. **网络超时**：可配置的超时时间（默认15秒）
2. **重试逻辑**：指数退避重试机制
3. **降级策略**：API失败时返回模拟数据
4. **详细日志**：分级日志系统（debug/info/warn/error）

## 配置选项

### 新闻爬虫配置 (NewsCrawlerConfig)

```typescript
interface NewsCrawlerConfig {
  useMockData?: boolean;    // 是否使用模拟数据
  timeout?: number;         // 请求超时时间（毫秒）
  maxRetries?: number;      // 最大重试次数
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // 日志级别
}
```

## 注意事项

1. **API限制**：新浪/腾讯API有调用频率限制，请合理使用
2. **网络依赖**：真实数据获取需要网络连接
3. **数据延迟**：免费API可能有数据延迟
4. **历史数据**：新浪/腾讯API不提供历史数据，MA60/MD60计算使用模拟数据
5. **错误处理**：生产环境应添加额外的错误处理逻辑
6. **编码问题**：新浪API使用GB18030编码，腾讯API使用GBK编码

## 开发指南

### 添加新的数据源

1. 在 `data_crawler.ts` 中添加新的API接口
2. 实现数据解析函数
3. 添加到回退机制中

### 添加新的新闻源

1. 在 `news_crawler.ts` 的 `NEWS_SOURCES` 中添加配置
2. 实现新闻获取函数
3. 实现新闻解析函数
4. 添加到多源获取函数中

### 运行测试

```bash
# 运行数据爬虫测试
npx ts-node skills/data_crawler.ts

# 运行新闻爬虫测试
npx ts-node skills/news_crawler.ts

# 运行完整示例
npx ts-node skills/example_usage.ts --example
```

## 许可证

MIT License