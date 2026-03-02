# 统一检索网关与宏观数据大屏 - 系统设计文档

**项目代号**: P0级底层重构
**版本**: 1.0
**日期**: 2026-03-02
**架构师**: Claude Sonnet 4.5
**批准状态**: ✅ 已批准

---

## 执行摘要

本设计旨在解决 Alpha-Quant-Copilot 系统的两大核心缺陷：
1. **资产检索能力严重受限**：当前仅能搜索80只沪深300核心股票，导致用户投资意图动线从入口处即被切断
2. **宏观数据维度缺失**：系统定位需从单一自选股工具升级为"极度高敏的实时投资分析大屏"

**核心解决方案**：
- 构建 BFF（Backend for Frontend）模式的统一检索网关，聚合 A股（Python FastAPI + AKShare）、美股（Finnhub）、商品/宏观指标（公开爬虫）三大数据源
- 基于 SSE + SWR 的实时数据流架构，实现核心指标1秒推送、次要指标10秒推送
- 新增 `/dashboard/macro` 独立宏观大屏页面，采用彭博终端风格，提供沉浸式专业分析体验

**技术选型决策**：
- **数据源**: Python FastAPI (Railway/Render) + Finnhub API + 公开爬虫
- **架构模式**: BFF 模式（Next.js API Gateway）
- **实时推送**: Server-Sent Events (SSE)
- **缓存策略**: 分层缓存（Edge 60s + ISR 24h + SWR）

---

## 一、整体系统架构

### 1.1 系统分层设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    前端层 (Next.js Client)                        │
│  - React Components (Dashboard, MacroDashboard, SearchUI)       │
│  - State Management (Zustand/React Query)                       │
│  - Real-time Updates (SSE Client + SWR)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│              BFF 层 (Next.js API Routes)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /api/unified-search      (统一检索网关)                   │  │
│  │  ├─ A股路由 → Python FastAPI                             │  │
│  │  ├─ 美股路由 → Finnhub API                              │  │
│  │  └─ 降级路由 → Local Fallback                           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ /api/market-data/sse     (实时数据流)                     │  │
│  │  ├─ 核心指标 SSE (1s 推送)                               │  │
│  │  └─ 数据聚合器 (多源并行拉取)                            │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ /api/macro-indicators    (宏观指标 REST API)              │  │
│  │  └─ 黄金/原油/BDI/SCFI 聚合                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                    ↓ Edge Cache (60s TTL)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   数据源层 (External Services)                   │
│  ┌─────────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │ Python FastAPI  │  │ Finnhub API │  │ Public Crawlers    │  │
│  │ (Railway/Render)│  │ (60req/min) │  │ (Sina/Investing)   │  │
│  │ - AKShare       │  │ - US Stocks │  │ - Commodities      │  │
│  │ - A股全量搜索    │  │ - Forex     │  │ - BDI/SCFI        │  │
│  │ - 实时行情       │  │ - Metals    │  │                    │  │
│  └─────────────────┘  └─────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

1. **智能路由**：BFF 层根据查询内容自动选择数据源（A股 → Python，美股 → Finnhub）
2. **并行聚合**：多个数据源并行调用，取最快返回，超时自动降级
3. **分层缓存**：
   - 边缘缓存（Vercel Edge）：搜索结果 60s
   - 应用缓存（Next.js ISR）：历史数据 24h
   - 客户端缓存（SWR）：用户交互级缓存
4. **渐进增强**：从本地数据 → 单源 → 多源聚合，逐步提升覆盖率

---

## 二、统一检索网关 (UnifiedSearchGateway)

### 2.1 接口设计

```typescript
// 统一检索请求
interface UnifiedSearchRequest {
  query: string;              // 搜索关键词
  markets?: ('CN' | 'US' | 'CRYPTO' | 'COMMODITY')[];  // 市场过滤
  limit?: number;             // 结果数量限制（默认15）
  timeout?: number;           // 超时时间（默认10s）
}

// 统一检索响应
interface UnifiedSearchResponse {
  success: boolean;
  data: SearchResultGroup[];  // 按市场分组的结果
  metadata: {
    totalResults: number;
    responseTime: number;
    sources: SourceStatus[];  // 各数据源状态
  };
}

// 搜索结果分组
interface SearchResultGroup {
  market: 'CN_A_STOCK' | 'US_STOCK' | 'CRYPTO' | 'COMMODITY';
  displayName: string;        // "A股" | "美股" | "加密货币" | "大宗商品"
  results: UnifiedAsset[];
}

// 统一资产模型
interface UnifiedAsset {
  symbol: string;             // 统一标识 "600519.SH" | "AAPL" | "XAUUSD"
  name: string;               // 中文名称
  market: string;             // 市场代码
  type: 'STOCK' | 'ETF' | 'INDEX' | 'COMMODITY' | 'FOREX' | 'CRYPTO';
  exchange?: string;          // 交易所（可选）
  metadata?: {
    pinyin?: string;          // 拼音缩写（A股特有）
    sector?: string;          // 行业分类
    country?: string;         // 国家
  };
}
```

### 2.2 智能路由逻辑

```typescript
// /lib/unified-search/router.ts
class SearchRouter {
  route(query: string): DataSource[] {
    // 1. 市场识别
    if (this.isCNStock(query)) {
      return [
        { name: 'python-fastapi', priority: 1 },
        { name: 'sina-fallback', priority: 2 },
        { name: 'local-cn-stocks', priority: 3 }
      ];
    }

    if (this.isUSStock(query)) {
      return [
        { name: 'finnhub', priority: 1 },
        { name: 'local-us-stocks', priority: 2 }
      ];
    }

    if (this.isCommodity(query)) {
      return [
        { name: 'investing-crawler', priority: 1 },
        { name: 'akshare-commodity', priority: 2 }
      ];
    }

    // 2. 混合搜索（不确定市场）
    return [
      { name: 'python-fastapi', priority: 1 },  // A股最常用
      { name: 'finnhub', priority: 1 },         // 并行查询
      { name: 'commodity-crawler', priority: 2 }
    ];
  }

  // 市场识别规则
  private isCNStock(query: string): boolean {
    // 6位数字 或 中文名称
    return /^[0-9]{6}$/.test(query) || /[\u4e00-\u9fa5]/.test(query);
  }

  private isUSStock(query: string): boolean {
    // 1-5位大写字母
    return /^[A-Z]{1,5}$/.test(query);
  }

  private isCommodity(query: string): boolean {
    const keywords = ['黄金', 'gold', '原油', 'oil', 'crude', '白银', 'silver'];
    return keywords.some(k => query.toLowerCase().includes(k));
  }
}
```

### 2.3 并行查询与超时控制

```typescript
// /lib/unified-search/aggregator.ts
class SearchAggregator {
  async search(query: string, timeout: number = 10000): Promise<UnifiedSearchResponse> {
    const sources = this.router.route(query);
    const startTime = Date.now();

    // 1. 并行调用所有数据源（Promise.race 模式）
    const results = await Promise.race([
      this.fetchFromSources(sources, query),
      this.timeout(timeout)
    ]);

    // 2. 结果合并去重
    const deduplicated = this.deduplicateResults(results);

    // 3. 按市场分组
    const grouped = this.groupByMarket(deduplicated);

    return {
      success: grouped.length > 0,
      data: grouped,
      metadata: {
        totalResults: deduplicated.length,
        responseTime: Date.now() - startTime,
        sources: this.getSourceStatus()
      }
    };
  }

  private async fetchFromSources(sources: DataSource[], query: string) {
    // 按优先级分批并行
    const priority1 = sources.filter(s => s.priority === 1);
    const priority2 = sources.filter(s => s.priority === 2);

    // 先尝试高优先级源
    let results = await this.parallelFetch(priority1, query);

    // 如果结果不足，尝试低优先级源
    if (results.length < 5) {
      const backupResults = await this.parallelFetch(priority2, query);
      results = [...results, ...backupResults];
    }

    return results;
  }
}
```

### 2.4 API 端点实现

```typescript
// /app/api/unified-search/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q') || '';
  const markets = searchParams.get('markets')?.split(',');

  // 1. 输入验证
  if (query.length < 1) {
    return NextResponse.json({
      success: false,
      error: 'Query too short'
    }, { status: 400 });
  }

  // 2. 调用聚合器
  const aggregator = new SearchAggregator();
  const result = await aggregator.search(query, {
    markets,
    timeout: 10000,
    useCache: true
  });

  // 3. 返回结果
  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
```

---

## 三、数据源集成详细设计

### 3.1 Python FastAPI 微服务（A股数据提供者）

**服务职责**：
- A股全量搜索（5000+ 标的，包含股票、ETF、指数）
- 实时行情数据（通过 AKShare）
- 历史K线数据（可选）

**项目结构**：
```
python-data-service/
├── app/
│   ├── main.py                 # FastAPI 应用入口
│   ├── routers/
│   │   ├── search.py           # /search 搜索端点
│   │   ├── quotes.py           # /quotes 实时行情
│   │   └── macro.py            # /macro 宏观指标（AKShare）
│   ├── services/
│   │   ├── akshare_service.py  # AKShare 封装
│   │   └── cache_service.py    # Redis 缓存（可选）
│   └── models/
│       └── schemas.py          # Pydantic 数据模型
├── requirements.txt
├── Dockerfile                  # Railway/Render 部署
└── railway.toml / render.yaml  # 部署配置
```

**核心 API 接口**：

```python
# app/routers/search.py
from fastapi import APIRouter, Query
from app.services.akshare_service import AKShareService

router = APIRouter()
akshare = AKShareService()

@router.get("/search")
async def search_stocks(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(15, ge=1, le=100)
):
    """
    A股全量搜索
    支持：股票代码（6位数字）、股票名称、拼音缩写
    """
    results = await akshare.search_stocks(query=q, limit=limit)

    return {
        "success": True,
        "data": [
            {
                "symbol": f"{r['code']}.{r['market']}",  # 600519.SH
                "code": r['code'],
                "name": r['name'],
                "market": r['market'],
                "type": r['type'],  # 'STOCK' | 'ETF' | 'INDEX'
                "pinyin": r.get('pinyin', ''),
            }
            for r in results
        ],
        "count": len(results),
        "source": "akshare"
    }

@router.get("/quotes")
async def get_realtime_quotes(
    symbols: str = Query(..., description="逗号分隔的股票代码，如：600519,000001")
):
    """
    批量获取实时行情
    """
    symbol_list = symbols.split(',')[:50]  # 限制最多50只
    quotes = await akshare.get_realtime_quotes(symbol_list)

    return {
        "success": True,
        "data": quotes,
        "timestamp": datetime.now().isoformat()
    }
```

**AKShare 服务封装**：

```python
# app/services/akshare_service.py
import akshare as ak
import pandas as pd
from typing import List, Dict

class AKShareService:
    def __init__(self):
        # 初始化时加载股票列表到内存（约5000条，占用<10MB）
        self._stock_list = self._load_stock_list()

    def _load_stock_list(self) -> pd.DataFrame:
        """
        加载A股全部股票列表
        """
        # 获取沪深A股列表
        sh_stocks = ak.stock_info_a_code_name()  # 上交所
        sz_stocks = ak.stock_info_sz_name_code()  # 深交所

        # 合并并标准化
        all_stocks = pd.concat([
            sh_stocks.assign(market='SH'),
            sz_stocks.assign(market='SZ')
        ])

        return all_stocks

    async def search_stocks(self, query: str, limit: int = 15) -> List[Dict]:
        """
        本地内存搜索（毫秒级响应）
        """
        query_lower = query.lower()

        # 优先精确匹配代码
        exact_match = self._stock_list[
            self._stock_list['code'] == query
        ]
        if not exact_match.empty:
            return exact_match.head(limit).to_dict('records')

        # 模糊匹配名称或拼音
        fuzzy_match = self._stock_list[
            self._stock_list['name'].str.contains(query, case=False, na=False) |
            self._stock_list.get('pinyin', pd.Series()).str.contains(query_lower, na=False)
        ]

        return fuzzy_match.head(limit).to_dict('records')

    async def get_realtime_quotes(self, symbols: List[str]) -> List[Dict]:
        """
        获取实时行情（调用 AKShare API）
        """
        quotes = []
        for symbol in symbols:
            try:
                # AKShare 实时行情接口
                df = ak.stock_zh_a_spot_em()
                stock_data = df[df['代码'] == symbol]

                if not stock_data.empty:
                    quotes.append({
                        "symbol": symbol,
                        "price": float(stock_data['最新价'].values[0]),
                        "change": float(stock_data['涨跌幅'].values[0]),
                        "volume": int(stock_data['成交量'].values[0]),
                    })
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")
                continue

        return quotes
```

**部署配置（Railway）**：

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"

[[deploy.environmentVariables]]
name = "PYTHON_VERSION"
value = "3.11"
```

### 3.2 Finnhub API 集成（美股数据）

```typescript
// /lib/data-sources/finnhub.ts
export class FinnhubService {
  private apiKey: string;
  private baseUrl = 'https://finnhub.io/api/v1';

  constructor() {
    this.apiKey = process.env.FINNHUB_API_KEY || '';
  }

  /**
   * 搜索美股 Symbol
   */
  async searchSymbols(query: string): Promise<UnifiedAsset[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}&token=${this.apiKey}`,
        { next: { revalidate: 3600 } }  // 1小时缓存
      );

      const data = await response.json();

      return data.result?.map((item: any) => ({
        symbol: item.symbol,
        name: item.description,
        market: 'US',
        type: item.type === 'Common Stock' ? 'STOCK' : 'ETF',
        exchange: item.displaySymbol.split(':')[0],
        metadata: {
          country: 'US'
        }
      })) || [];

    } catch (error) {
      console.error('Finnhub search error:', error);
      return [];
    }
  }

  /**
   * 获取实时报价
   */
  async getQuote(symbol: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/quote?symbol=${symbol}&token=${this.apiKey}`
    );
    return response.json();
  }

  /**
   * 获取贵金属价格（XAU/USD）
   */
  async getForexRates(symbols: string[]): Promise<any[]> {
    const quotes = await Promise.all(
      symbols.map(symbol => this.getQuote(symbol))
    );
    return quotes;
  }
}
```

### 3.3 Public Crawlers（商品/宏观指标）

```typescript
// /lib/data-sources/commodity-crawler.ts
export class CommodityCrawler {
  /**
   * 获取黄金现货价格（新浪财经）
   */
  async getGoldPrice(): Promise<CommodityQuote> {
    try {
      const response = await fetch(
        'http://hq.sinajs.cn/list=hf_XAU',
        {
          headers: {
            'Referer': 'https://finance.sina.com.cn',
            'User-Agent': 'Mozilla/5.0...'
          }
        }
      );

      const text = await response.text();
      const parts = text.split(',');

      return {
        symbol: 'XAU',
        name: '黄金',
        price: parseFloat(parts[8]),
        change: parseFloat(parts[10]),
        changePercent: parseFloat(parts[11]),
        unit: 'USD/oz',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Gold price fetch error:', error);
      throw error;
    }
  }
}
```

---

## 四、实时数据流架构（SSE + SWR）

### 4.1 SSE Stream Manager 设计

```typescript
// /lib/real-time/sse-stream-manager.ts
export class SSEStreamManager {
  private connections: Map<string, WritableStreamDefaultWriter> = new Map();
  private dataSources: Map<string, DataSourcePoller> = new Map();

  /**
   * 数据源配置
   */
  private config = {
    // 核心指标：1秒推送
    core: {
      interval: 1000,
      sources: [
        'index.000001.SH',  // 上证指数
        'index.399001.SZ',  // 深证成指
        'commodity.XAU',     // 黄金
        'commodity.CL',      // 原油WTI
      ]
    },
    // 次要指标：10秒推送
    secondary: {
      interval: 10000,
      sources: [
        'macro.BDI',        // 波罗的海指数
        'macro.SCFI',       // 上海集装箱运价
        'forex.USDCNY',     // 美元人民币
      ]
    }
  };

  /**
   * 启动流管理器
   */
  start(clientId: string, writer: WritableStreamDefaultWriter) {
    this.connections.set(clientId, writer);

    // 启动各优先级轮询器
    this.startPoller('core', clientId);
    this.startPoller('secondary', clientId);

    // 发送初始数据
    this.sendInitialData(clientId);
  }
}
```

### 4.2 SSE API 端点

```typescript
// /app/api/market-data/sse/route.ts
import { SSEStreamManager } from '@/lib/real-time/sse-stream-manager';

const streamManager = new SSEStreamManager();

export async function GET(request: NextRequest) {
  const clientId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      const writer = controller as any;
      streamManager.start(clientId, writer);

      // 心跳（每30秒）
      const heartbeat = setInterval(() => {
        try {
          const encoder = new TextEncoder();
          writer.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // 监听断开
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        streamManager.cleanup(clientId);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
```

### 4.3 前端 SSE Hook

```typescript
// /lib/hooks/useSSEMarketData.ts
export function useSSEMarketData() {
  const [data, setData] = useState<Map<string, DataPoint>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = () => {
      eventSource = new EventSource('/api/market-data/sse');

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        const update: MarketDataUpdate = JSON.parse(event.data);

        setData(prev => {
          const newData = new Map(prev);
          update.data.forEach(point => {
            newData.set(point.symbol, point);
          });
          return newData;
        });
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        setTimeout(connect, 3000);  // 自动重连
      };
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, []);

  return { data, isConnected };
}
```

---

## 五、宏观大屏页面设计 (/dashboard/macro)

### 5.1 页面布局（彭博终端风格）

```typescript
// /app/dashboard/macro/page.tsx
export default function MacroDashboard() {
  const { data, isConnected } = useMarketData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              宏观经济脉搏监控台
            </h1>
            <ConnectionStatus isConnected={isConnected} dataSourcesCount={data.size} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {/* 核心市场指数 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            核心市场指数 <span className="text-xs text-slate-400 ml-2">(1秒实时推送)</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {coreIndices.map(point => (
              <MarketDataCard key={point.symbol} dataPoint={point} />
            ))}
          </div>
        </section>

        {/* 贵金属与能源 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            贵金属与能源 <span className="text-xs text-slate-400 ml-2">(5秒推送)</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {commodities.map(point => (
              <MarketDataCard key={point.symbol} dataPoint={point} />
            ))}
          </div>
        </section>

        {/* 供应链动脉 + 宏观情绪雷达 */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold mb-4">
              供应链动脉 <span className="text-xs text-slate-400 ml-2">(10秒推送)</span>
            </h2>
            <div className="space-y-4">
              {supplyChain.map(point => (
                <SupplyChainCard key={point.symbol} dataPoint={point} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">宏观情绪雷达</h2>
            <MacroRadarChart data={radarData} />
          </div>
        </section>
      </main>
    </div>
  );
}
```

### 5.2 数据卡片组件（红绿呼吸动画）

```typescript
// /components/macro/MarketDataCard.tsx
export function MarketDataCard({ dataPoint }: { dataPoint: DataPoint }) {
  const isPositive = dataPoint.change >= 0;

  return (
    <div className={`
      p-4 rounded-lg border transition-all duration-300
      ${isPositive
        ? 'bg-green-50 border-green-200 animate-pulse-green'
        : 'bg-red-50 border-red-200 animate-pulse-red'
      }
    `}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-600">
            {dataPoint.name}
          </h3>
          <div className="text-2xl font-bold mt-1">
            {dataPoint.value.toFixed(2)}
          </div>
        </div>

        <div className={`text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          <div className="text-lg font-bold">
            {isPositive ? '+' : ''}{dataPoint.changePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 迷你趋势图 */}
      {dataPoint.metadata?.trend && (
        <MiniTrendChart data={dataPoint.metadata.trend} />
      )}
    </div>
  );
}
```

**呼吸动画 CSS**：

```css
@keyframes pulse-green {
  0%, 100% {
    background-color: rgb(240 253 244);
    border-color: rgb(187 247 208);
  }
  50% {
    background-color: rgb(220 252 231);
    border-color: rgb(134 239 172);
  }
}

@keyframes pulse-red {
  0%, 100% {
    background-color: rgb(254 242 242);
    border-color: rgb(254 202 202);
  }
  50% {
    background-color: rgb(254 226 226);
    border-color: rgb(252 165 165);
  }
}

.animate-pulse-green {
  animation: pulse-green 2s ease-in-out infinite;
}

.animate-pulse-red {
  animation: pulse-red 2s ease-in-out infinite;
}
```

---

## 六、部署架构与运维

### 6.1 服务部署拓扑

```
┌─────────────────────────────────────────────┐
│  Vercel (Next.js Frontend + BFF Layer)      │
│  - Edge Functions: /api/unified-search      │
│  - SSE Endpoint: /api/market-data/sse       │
│  - Static Pages: /dashboard/macro           │
└─────────────┬───────────────────────────────┘
              │
              ├──────────────┐
              ▼              ▼
┌─────────────────────┐  ┌──────────────────┐
│  Railway/Render     │  │  Finnhub API     │
│  (Python FastAPI)   │  │  (External)      │
│  - A股搜索          │  │  - 美股数据       │
│  - AKShare 数据     │  │  - 贵金属        │
└─────────────────────┘  └──────────────────┘
```

### 6.2 环境变量配置

```bash
# Next.js (.env.local)
NEXT_PUBLIC_PYTHON_SERVICE_URL=https://your-railway-app.up.railway.app
FINNHUB_API_KEY=your_finnhub_api_key
NEXT_PUBLIC_SSE_ENDPOINT=/api/market-data/sse

# Python FastAPI (.env)
PYTHON_VERSION=3.11
PORT=8000
AKSHARE_CACHE_ENABLED=true
```

### 6.3 监控与日志

- **Vercel Analytics**: 前端性能监控
- **Railway Logs**: Python 服务日志
- **SSE 连接监控**: 自定义监控端点 `/api/market-data/status`

---

## 七、关键技术决策记录

| 决策点 | 选择方案 | 理由 | 权衡 |
|--------|---------|------|------|
| A股数据源 | Python FastAPI + AKShare | 免费、数据全、内存搜索快 | 需维护独立服务 |
| 美股数据源 | Finnhub 免费层 | 官方API稳定、免费额度足够 | 60次/分钟限制 |
| 实时推送 | SSE + SWR | Vercel原生支持、延迟1-5秒可接受 | 非真正WebSocket |
| 架构模式 | BFF (Next.js Gateway) | 单仓库、Vercel友好、开发效率高 | Next.js成为单点瓶颈 |
| Python部署 | Railway/Render 免费层 | 常驻进程、无冷启动、免费 | 免费额度有限 |

---

## 八、实施里程碑

### Phase 1: 基础设施搭建（第1-2周）
- [ ] Python FastAPI 项目初始化
- [ ] AKShare 集成与内存搜索实现
- [ ] Railway/Render 部署配置
- [ ] Next.js BFF 层框架搭建

### Phase 2: 统一检索网关（第3-4周）
- [ ] SearchRouter 智能路由实现
- [ ] SearchAggregator 并行聚合逻辑
- [ ] Finnhub 集成
- [ ] 前端搜索 UI 升级

### Phase 3: 实时数据流（第5-6周）
- [ ] SSE Stream Manager 实现
- [ ] 数据源轮询器（1s/5s/10s）
- [ ] 前端 SSE Hook
- [ ] 降级策略（SWR 轮询）

### Phase 4: 宏观大屏（第7-8周）
- [ ] /dashboard/macro 页面框架
- [ ] MarketDataCard 组件（红绿呼吸动画）
- [ ] MiniTrendChart 迷你趋势图
- [ ] MacroRadarChart 情绪雷达
- [ ] 商品/宏观指标爬虫

### Phase 5: 测试与优化（第9-10周）
- [ ] 端到端测试
- [ ] 性能优化（缓存策略调优）
- [ ] 监控告警配置
- [ ] 用户验收测试

---

## 九、风险与缓解措施

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Railway/Render 免费额度耗尽 | 高 | 中 | 监控用量，准备升级方案 |
| AKShare API 反爬限制 | 中 | 低 | 添加请求间隔、User-Agent轮换 |
| Finnhub 免费额度不足 | 中 | 低 | 前端缓存+SWR，减少API调用 |
| SSE 连接稳定性问题 | 中 | 中 | 自动重连+SWR降级 |
| Vercel Edge Function 冷启动 | 低 | 高 | 升级 Pro 计划（$20/月预热实例） |

---

## 十、附录

### A. 数据点模型完整定义

```typescript
export interface DataPoint {
  symbol: string;           // 'index.000001.SH' | 'commodity.XAU'
  name: string;             // '上证指数' | '黄金'
  value: number;            // 当前值
  change: number;           // 涨跌额
  changePercent: number;    // 涨跌幅
  timestamp: number;        // 时间戳
  metadata?: {
    high?: number;          // 最高
    low?: number;           // 最低
    volume?: number;        // 成交量
    trend?: number[];       // 迷你趋势图数据（最近20个点）
  };
}
```

### B. 宏观指标清单

| 类别 | 指标 | 数据源 | 推送频率 |
|------|------|--------|---------|
| 核心指数 | 上证/深证/恒生/纳斯达克/标普/道琼斯 | AKShare/Finnhub | 1s |
| 贵金属 | 黄金/白银/铜 | 新浪财经/Finnhub | 5s |
| 能源 | 原油WTI/Brent/天然气 | 新浪财经 | 5s |
| 外汇 | 美元指数/人民币/欧元 | Finnhub | 5s |
| 供应链 | BDI/SCFI | AKShare/公开网站 | 10s |

---

**文档状态**: ✅ 已批准
**下一步**: 执行 `/writing-plans` 创建详细实施计划
**批准人**: 用户
**批准日期**: 2026-03-02
