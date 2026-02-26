/**
 * 搜索API代理配置模块
 * 用于解决海外IP限制问题
 */

export interface SearchSourceConfig {
  name: string;
  url: string;
  enabled: boolean;
  priority: number; // 优先级，数字越小优先级越高
  timeout: number; // 超时时间（毫秒）
  retryCount: number; // 重试次数
  headers?: Record<string, string>;
  parser: (data: string, query: string) => StockResult[];
}

export interface StockResult {
  code: string;
  name: string;
  market: string;
  pinyin?: string; // 拼音缩写
  fullName?: string; // 全称
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // 缓存时间（毫秒）
  maxSize: number; // 最大缓存条目数
}

export interface ProxyConfig {
  enabled: boolean;
  type: 'direct' | 'proxy' | 'cloud-function';
  proxyUrl?: string; // 代理服务器地址
  cloudFunctionUrl?: string; // 云函数地址
  timeout: number;
}

// 搜索源配置
export const SEARCH_SOURCES: Record<string, SearchSourceConfig> = {
  // 新浪财经（主数据源）
  sina: {
    name: 'sina',
    url: 'https://suggest3.sinajs.cn/quotes/v1/sugg',
    enabled: true,
    priority: 1,
    timeout: 8000,
    retryCount: 2,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://finance.sina.com.cn',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    parser: parseSinaResponse,
  },

  // 雪球（备用数据源）
  xueqiu: {
    name: 'xueqiu',
    url: 'https://xueqiu.com/stock/search.json',
    enabled: true,
    priority: 2,
    timeout: 5000,
    retryCount: 2,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    parser: parseXueqiuResponse,
  },

  // 东方财富（备用数据源）
  eastmoney: {
    name: 'eastmoney',
    url: 'https://searchapi.eastmoney.com/api/suggest/get',
    enabled: true,
    priority: 3,
    timeout: 5000,
    retryCount: 2,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    parser: parseEastmoneyResponse,
  },

  // 腾讯财经（备用数据源）
  tencent: {
    name: 'tencent',
    url: 'https://smartbox.gtimg.cn/s3',
    enabled: true,
    priority: 4,
    timeout: 5000,
    retryCount: 2,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    parser: parseTencentResponse,
  },
};

// 缓存配置
export const CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 5 * 60 * 1000, // 5分钟
  maxSize: 1000, // 最多缓存1000个查询
};

// 代理配置
export const PROXY_CONFIG: ProxyConfig = {
  enabled: true,
  type: (process.env.SEARCH_PROXY_TYPE as 'direct' | 'proxy' | 'cloud-function') || 'direct', // 从环境变量读取，默认为direct模式
  timeout: process.env.SEARCH_PROXY_TIMEOUT ? parseInt(process.env.SEARCH_PROXY_TIMEOUT) : 10000,
  // 代理服务器地址
  proxyUrl: process.env.SEARCH_PROXY_URL,
  // 云函数地址（需要部署到国内服务器）
  cloudFunctionUrl: process.env.SEARCH_PROXY_CLOUD_FUNCTION_URL,
};

// 解析新浪API响应
function parseSinaResponse(data: string, query: string): StockResult[] {
  try {
    // 新浪API返回GBK编码的文本，格式如：var suggestdata="浦发银行,600000,sh,银行;平安银行,000001,sz,银行;..."
    const match = data.match(/="([^"]+)"/);
    if (!match || !match[1]) {
      return [];
    }

    const dataString = match[1];
    if (!dataString || dataString === '') {
      return [];
    }

    const results: StockResult[] = [];
    const items = dataString.split(';');

    for (const item of items) {
      if (!item.trim()) continue;

      const fields = item.split(',');
      if (fields.length >= 3) {
        const name = fields[0]?.trim();
        const code = fields[1]?.trim();
        const marketCode = fields[2]?.trim().toLowerCase();

        if (name && code && marketCode) {
          // 转换市场代码：sh -> SH, sz -> SZ
          const market = marketCode === 'sh' ? 'SH' : 'SZ';
          results.push({ code, name, market });
        }
      }
    }

    return results.slice(0, 15);
  } catch (error) {
    console.error('Failed to parse Sina response:', error);
    return [];
  }
}

// 解析雪球API响应
function parseXueqiuResponse(data: string, query: string): StockResult[] {
  try {
    const jsonData = JSON.parse(data);
    if (!jsonData.stocks || !Array.isArray(jsonData.stocks)) {
      return [];
    }

    const results: StockResult[] = [];
    for (const stock of jsonData.stocks) {
      if (stock.symbol && stock.name) {
        const code = stock.symbol.replace(/[^0-9]/g, '');
        const market = stock.symbol.includes('SH') ? 'SH' : 'SZ';
        results.push({
          code,
          name: stock.name,
          market,
          pinyin: stock.pinyin,
        });
      }
    }

    return results.slice(0, 15);
  } catch (error) {
    console.error('Failed to parse Xueqiu response:', error);
    return [];
  }
}

// 解析东方财富API响应
function parseEastmoneyResponse(data: string, query: string): StockResult[] {
  try {
    const jsonData = JSON.parse(data);
    if (!jsonData.QuotationCodeTable || !jsonData.QuotationCodeTable.Data) {
      return [];
    }

    const results: StockResult[] = [];
    for (const item of jsonData.QuotationCodeTable.Data) {
      if (item.Code && item.Name) {
        const code = item.Code;
        const market = code.startsWith('6') || code.startsWith('9') ? 'SH' : 'SZ';
        results.push({
          code,
          name: item.Name,
          market,
          fullName: item.FullName,
        });
      }
    }

    return results.slice(0, 15);
  } catch (error) {
    console.error('Failed to parse Eastmoney response:', error);
    return [];
  }
}

// 解析腾讯财经API响应
function parseTencentResponse(data: string, query: string): StockResult[] {
  try {
    // 腾讯API返回格式：v_sh600000="浦发银行~600000~sh";v_sz000001="平安银行~000001~sz";
    const results: StockResult[] = [];
    const lines = data.split(';');

    for (const line of lines) {
      const match = line.match(/="([^"]+)"/);
      if (!match || !match[1]) continue;

      const fields = match[1].split('~');
      if (fields.length >= 3) {
        const name = fields[0]?.trim();
        const code = fields[1]?.trim();
        const marketCode = fields[2]?.trim().toLowerCase();

        if (name && code && marketCode) {
          const market = marketCode === 'sh' ? 'SH' : 'SZ';
          results.push({ code, name, market });
        }
      }
    }

    return results.slice(0, 15);
  } catch (error) {
    console.error('Failed to parse Tencent response:', error);
    return [];
  }
}

// 获取启用的搜索源（按优先级排序）
export function getEnabledSources(): SearchSourceConfig[] {
  return Object.values(SEARCH_SOURCES)
    .filter(source => source.enabled)
    .sort((a, b) => a.priority - b.priority);
}

// 根据IP地理位置选择最优数据源
export function selectOptimalSource(clientIp?: string): SearchSourceConfig[] {
  const enabledSources = getEnabledSources();

  // 如果没有客户端IP信息，返回默认排序
  if (!clientIp) {
    return enabledSources;
  }

  // 简单判断：如果是中国IP，优先使用新浪
  // 实际项目中可以使用IP地理位置服务
  const isChineseIp = isChineseIP(clientIp);

  if (isChineseIp) {
    // 中国IP：新浪优先
    return enabledSources.sort((a, b) => {
      if (a.name === 'sina') return -1;
      if (b.name === 'sina') return 1;
      return a.priority - b.priority;
    });
  } else {
    // 海外IP：优先使用对海外友好的数据源
    return enabledSources.sort((a, b) => {
      // 腾讯和雅虎对海外IP更友好
      if (a.name === 'tencent' || a.name === 'xueqiu') return -1;
      if (b.name === 'tencent' || b.name === 'xueqiu') return 1;
      return a.priority - b.priority;
    });
  }
}

// 简单判断是否为中国IP（实际项目应使用专业IP库）
function isChineseIP(ip: string): boolean {
  // 简单判断：检查是否为私有IP或中国IP段
  // 实际项目中应使用IP地理位置数据库
  if (ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('192.168.')) {
    return true; // 私有IP，假设为中国
  }

  // 简单判断中国IP段（不完整，仅示例）
  if (ip.startsWith('1.') ||
      ip.startsWith('14.') ||
      ip.startsWith('27.') ||
      ip.startsWith('36.') ||
      ip.startsWith('39.') ||
      ip.startsWith('42.') ||
      ip.startsWith('49.') ||
      ip.startsWith('58.') ||
      ip.startsWith('59.') ||
      ip.startsWith('60.') ||
      ip.startsWith('61.') ||
      ip.startsWith('101.') ||
      ip.startsWith('103.') ||
      ip.startsWith('106.') ||
      ip.startsWith('110.') ||
      ip.startsWith('111.') ||
      ip.startsWith('112.') ||
      ip.startsWith('113.') ||
      ip.startsWith('114.') ||
      ip.startsWith('115.') ||
      ip.startsWith('116.') ||
      ip.startsWith('117.') ||
      ip.startsWith('118.') ||
      ip.startsWith('119.') ||
      ip.startsWith('120.') ||
      ip.startsWith('121.') ||
      ip.startsWith('122.') ||
      ip.startsWith('123.') ||
      ip.startsWith('124.') ||
      ip.startsWith('125.') ||
      ip.startsWith('126.') ||
      ip.startsWith('171.') ||
      ip.startsWith('175.') ||
      ip.startsWith('180.') ||
      ip.startsWith('182.') ||
      ip.startsWith('183.') ||
      ip.startsWith('202.') ||
      ip.startsWith('203.') ||
      ip.startsWith('210.') ||
      ip.startsWith('211.') ||
      ip.startsWith('218.') ||
      ip.startsWith('219.') ||
      ip.startsWith('220.') ||
      ip.startsWith('221.') ||
      ip.startsWith('222.')) {
    return true;
  }

  return false;
}