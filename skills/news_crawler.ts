/**
 * Alpha-Quant-Copilot News Crawler
 * 财经新闻爬取与分析模块
 * Updated with enhanced error handling and mock data support
 */

import * as https from 'https';
import * as http from 'http';
import * as iconv from 'iconv-lite';
import * as zlib from 'zlib';

// 新闻数据接口
export interface NewsItem {
  title: string;
  summary: string;
  content: string;
  source: string;
  url: string;
  publishTime: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
  relatedStocks: string[];
  impactLevel: 'high' | 'medium' | 'low';
}

// 新闻源配置
const NEWS_SOURCES = {
  // 新浪财经
  SINA_FINANCE: {
    baseUrl: 'https://finance.sina.com.cn',
    apiUrl: 'https://interface.sina.cn/finance/feedNews.d.json',
    params: {
      page: 1,
      pageSize: 20,
      channel: 'cj'
    }
  },

  // 东方财富
  EASTMONEY: {
    baseUrl: 'https://finance.eastmoney.com',
    apiUrl: 'https://newsapi.eastmoney.com/kuaixun/v1/getlist_103_ajaxResult_50_1_.html',
    params: {
      _: Date.now()
    }
  },

  // 雪球财经新闻
  XUEQIU: {
    baseUrl: 'https://xueqiu.com',
    apiUrl: 'https://xueqiu.com/statuses/topic/list.json',
    params: {
      count: 20,
      page: 1,
      type: 'news'
    }
  },

  // 财新网 (Caixin) - 高质量财经新闻
  CAIXIN: {
    baseUrl: 'https://www.caixin.com',
    apiUrl: 'https://gateway.caixin.com/api/dataplatform/feed/list',
    params: {
      page: 1,
      pageSize: 20,
      channel: 'finance',
      _: Date.now()
    }
  }
};

// 请求头配置
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0'
};

// 配置选项
export interface NewsCrawlerConfig {
  useMockData?: boolean;
  timeout?: number;
  maxRetries?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// 默认配置
const DEFAULT_CONFIG: NewsCrawlerConfig = {
  useMockData: false,
  timeout: 15000,
  maxRetries: 3,
  logLevel: 'info'
};

// 增强的日志系统
class NewsLogger {
  static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  static setConfig(config: NewsCrawlerConfig) {
    if (config.logLevel) {
      this.logLevel = config.logLevel;
    }
  }

  static debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      console.debug(`[NEWS DEBUG] ${new Date().toISOString()} - ${message}`, data || '');
    }
  }

  static info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      console.log(`[NEWS INFO] ${new Date().toISOString()} - ${message}`, data || '');
    }
  }

  static error(message: string, error?: any) {
    if (this.shouldLog('error')) {
      console.error(`[NEWS ERROR] ${new Date().toISOString()} - ${message}`, error || '');
    }
  }

  static warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      console.warn(`[NEWS WARN] ${new Date().toISOString()} - ${message}`, data || '');
    }
  }

  private static shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }
}

/**
 * 生成模拟新闻数据
 */
function generateMockNews(keywords: string[] = []): NewsItem[] {
  const mockStocks = ['000001', '600000', '000002', '600036', '601318'];
  const mockSources = ['财联社', '华尔街见闻', '证券时报', '中国证券报', '上海证券报'];
  const mockSentiments: Array<'positive' | 'negative' | 'neutral'> = ['positive', 'negative', 'neutral'];
  const mockImpactLevels: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

  const mockTitles = [
    'A股市场迎来重大利好，政策支持力度加大',
    '科技股集体回调，投资者需谨慎操作',
    '央行释放流动性信号，市场预期改善',
    '上市公司业绩预告密集发布，超预期公司受关注',
    '外资持续流入A股，配置价值凸显',
    '行业监管政策收紧，相关板块承压',
    '新能源赛道热度不减，产业链公司受益',
    '消费复苏迹象明显，大消费板块走强',
    '人工智能概念持续发酵，相关公司受追捧',
    '房地产市场政策优化，地产股迎来反弹'
  ];

  const mockSummaries = [
    '近期政策面利好频出，市场情绪明显回暖，投资者信心得到提振。',
    '受外部环境影响，部分板块出现调整，建议投资者保持谨慎态度。',
    '流动性预期改善，为市场提供支撑，中长期看好A股配置价值。',
    '业绩预告显示多数公司表现良好，基本面支撑市场走强。',
    '外资持续看好中国资产，北向资金净流入创近期新高。',
    '监管政策趋严，相关行业面临调整压力，需关注政策变化。',
    '新能源产业政策支持力度大，产业链公司业绩增长确定性高。',
    '消费数据回暖，居民消费意愿增强，大消费板块值得关注。',
    '人工智能技术突破不断，应用场景拓展，相关公司迎来发展机遇。',
    '房地产政策优化调整，行业基本面改善，板块估值修复可期。'
  ];

  const newsItems: NewsItem[] = [];
  const newsCount = 5 + Math.floor(Math.random() * 10); // 5-15条新闻

  for (let i = 0; i < newsCount; i++) {
    const titleIndex = Math.floor(Math.random() * mockTitles.length);
    const summaryIndex = Math.floor(Math.random() * mockSummaries.length);
    const sourceIndex = Math.floor(Math.random() * mockSources.length);
    const sentimentIndex = Math.floor(Math.random() * mockSentiments.length);
    const impactIndex = Math.floor(Math.random() * mockImpactLevels.length);

    // 随机选择1-3个相关股票
    const relatedStocksCount = 1 + Math.floor(Math.random() * 3);
    const relatedStocks: string[] = [];
    for (let j = 0; j < relatedStocksCount; j++) {
      const stockIndex = Math.floor(Math.random() * mockStocks.length);
      if (!relatedStocks.includes(mockStocks[stockIndex])) {
        relatedStocks.push(mockStocks[stockIndex]);
      }
    }

    // 生成关键词
    const extractedKeywords = extractKeywords(mockTitles[titleIndex] + ' ' + mockSummaries[summaryIndex]);

    // 确保包含用户关键词
    const uniqueKeywords = new Set([...extractedKeywords, ...keywords.slice(0, 3)]);
    const allKeywords = Array.from(uniqueKeywords).slice(0, 10);

    newsItems.push({
      title: mockTitles[titleIndex],
      summary: mockSummaries[summaryIndex],
      content: mockSummaries[summaryIndex] + ' 详细内容请参考相关财经媒体报道。',
      source: mockSources[sourceIndex],
      url: `https://mock.news.example.com/article/${Date.now()}-${i}`,
      publishTime: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment: mockSentiments[sentimentIndex],
      keywords: allKeywords,
      relatedStocks,
      impactLevel: mockImpactLevels[impactIndex]
    });
  }

  // 按发布时间排序
  newsItems.sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime());

  return newsItems;
}

/**
 * 从新浪财经获取新闻（带重试机制）
 */
export async function fetchSinaFinanceNews(
  keywords: string[] = [],
  config: NewsCrawlerConfig = DEFAULT_CONFIG
): Promise<NewsItem[]> {

  // 如果配置使用模拟数据，返回模拟新闻
  if (config.useMockData) {
    NewsLogger.info('使用模拟新闻数据', { keywords });
    return generateMockNews(keywords);
  }

  const maxRetries = config.maxRetries || DEFAULT_CONFIG.maxRetries!;
  const timeout = config.timeout || DEFAULT_CONFIG.timeout!;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const params = new URLSearchParams();
      params.set('page', NEWS_SOURCES.SINA_FINANCE.params.page.toString());
      params.set('pageSize', NEWS_SOURCES.SINA_FINANCE.params.pageSize.toString());
      params.set('channel', NEWS_SOURCES.SINA_FINANCE.params.channel);
      if (keywords.length > 0) {
        params.set('keywords', keywords.join(','));
      }
      const url = `${NEWS_SOURCES.SINA_FINANCE.apiUrl}?${params.toString()}`;

      NewsLogger.info(`从新浪财经获取新闻 (尝试 ${attempt}/${maxRetries}): ${url}`);

      const newsItems = await new Promise<NewsItem[]>((resolve, reject) => {
        const req = https.get(url, { headers: DEFAULT_HEADERS }, (res) => {
          let rawData: Buffer[] = [];

          res.on('data', (chunk: Buffer) => {
            rawData.push(chunk);
          });

          res.on('end', () => {
            try {
              const buffer = Buffer.concat(rawData);

              // 检查是否为gzip压缩
              const contentEncoding = res.headers['content-encoding'];
              let processedBuffer = buffer;

              if (contentEncoding === 'gzip') {
                processedBuffer = zlib.gunzipSync(buffer);
              }

              // 解析JSON响应 - 尝试多种编码处理
              let decodedText: string;
              try {
                // 先尝试UTF-8
                decodedText = processedBuffer.toString('utf-8');
                // 检查UTF-8解码是否产生乱码
                if (decodedText.includes('�') || !decodedText.includes('{')) {
                  throw new Error('UTF-8 decoding may be garbled');
                }
              } catch (e) {
                try {
                  // 尝试GB18030（新浪财经常用编码）
                  decodedText = iconv.decode(processedBuffer, 'gb18030');
                } catch (e2) {
                  try {
                    // 尝试GBK
                    decodedText = iconv.decode(processedBuffer, 'gbk');
                  } catch (e3) {
                    try {
                      // 尝试GB2312
                      decodedText = iconv.decode(processedBuffer, 'gb2312');
                    } catch (e4) {
                      // 最后尝试：使用替换字符的UTF-8
                      decodedText = processedBuffer.toString('utf-8', { fatal: false });
                      NewsLogger.warn('使用带替换字符的UTF-8解码新浪财经API响应');
                    }
                  }
                }
              }

              let data: any;
              try {
                data = JSON.parse(decodedText);
              } catch (error) {
                // 尝试清理非标准JSON格式
                NewsLogger.warn('标准JSON解析失败，尝试清理响应', {
                  decodedTextPreview: decodedText.substring(0, 300)
                });

                try {
                  const cleanedJson = cleanJsonResponse(decodedText);
                  data = JSON.parse(cleanedJson);
                  NewsLogger.info('成功解析清理后的JSON响应');
                } catch (cleanError) {
                  NewsLogger.error('JSON解析失败，响应内容前500字符:', decodedText.substring(0, 500));
                  throw new Error(`JSON解析失败: ${error}`);
                }
              }

              // 解析新闻数据
              const newsItems = parseSinaNews(data, keywords);
              resolve(newsItems);
            } catch (error) {
              NewsLogger.error('解析新浪财经新闻失败', error);
              reject(new Error(`Failed to parse Sina finance news: ${error}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`HTTP请求失败: ${error.message}`));
        });

        req.setTimeout(timeout, () => {
          req.destroy();
          reject(new Error(`请求超时 (${timeout}ms)`));
        });
      });

      NewsLogger.info(`成功获取 ${newsItems.length} 条新浪财经新闻`);
      return newsItems;

    } catch (error) {
      lastError = error as Error;
      NewsLogger.warn(`新浪财经新闻获取失败 (尝试 ${attempt}/${maxRetries})`, {
        error: error instanceof Error ? error.message : String(error)
      });

      if (attempt < maxRetries) {
        // 指数退避
        const delay = Math.pow(2, attempt - 1) * 1000;
        NewsLogger.info(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  NewsLogger.error(`所有 ${maxRetries} 次尝试都失败，返回模拟数据`, lastError);
  // 所有尝试都失败，返回模拟数据
  return generateMockNews(keywords);
}

/**
 * 解析新浪财经新闻数据
 */
function parseSinaNews(data: any, keywords: string[]): NewsItem[] {
  if (!data || !data.data || !Array.isArray(data.data.list)) {
    return [];
  }

  return data.data.list.map((item: any) => {
    // 提取相关股票代码
    const relatedStocks = extractStockCodes(item.title + ' ' + item.intro);

    // 分析情感
    const sentiment = analyzeSentiment(item.title + ' ' + item.intro);

    // 评估影响级别
    const impactLevel = assessImpactLevel(item, keywords);

    return {
      title: item.title || '',
      summary: item.intro || '',
      content: item.intro || '',
      source: '新浪财经',
      url: item.url || `${NEWS_SOURCES.SINA_FINANCE.baseUrl}${item.link}`,
      publishTime: item.ctime || new Date().toISOString(),
      sentiment,
      keywords: extractKeywords(item.title + ' ' + item.intro),
      relatedStocks,
      impactLevel
    };
  }).filter((item: NewsItem) => item.title && item.summary);
}

/**
 * 从东方财富获取新闻（带重试机制）
 */
export async function fetchEastMoneyNews(
  keywords: string[] = [],
  config: NewsCrawlerConfig = DEFAULT_CONFIG
): Promise<NewsItem[]> {

  // 如果配置使用模拟数据，返回模拟新闻
  if (config.useMockData) {
    NewsLogger.info('使用模拟新闻数据（东方财富）', { keywords });
    return generateMockNews(keywords);
  }

  const maxRetries = config.maxRetries || DEFAULT_CONFIG.maxRetries!;
  const timeout = config.timeout || DEFAULT_CONFIG.timeout!;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const params = new URLSearchParams();
      params.set('_', NEWS_SOURCES.EASTMONEY.params._.toString());
      const url = `${NEWS_SOURCES.EASTMONEY.apiUrl}?${params.toString()}`;

      NewsLogger.info(`从东方财富获取新闻 (尝试 ${attempt}/${maxRetries}): ${url}`);

      const newsItems = await new Promise<NewsItem[]>((resolve, reject) => {
        const req = https.get(url, { headers: DEFAULT_HEADERS }, (res) => {
          let rawData: Buffer[] = [];

          res.on('data', (chunk: Buffer) => {
            rawData.push(chunk);
          });

          res.on('end', () => {
            try {
              const buffer = Buffer.concat(rawData);
              const responseText = buffer.toString('utf-8');

              // 东方财富返回的是JavaScript代码，需要提取JSON
              let data: any;
              try {
                // 尝试第一种格式：ajaxResult={...};
                let jsonMatch = responseText.match(/ajaxResult\s*=\s*(\{[\s\S]*?\})\s*;/);
                if (jsonMatch) {
                  data = JSON.parse(jsonMatch[1]);
                } else {
                  // 尝试第二种格式：直接是JSON对象
                  jsonMatch = responseText.match(/(\{[\s\S]*\})/);
                  if (jsonMatch) {
                    const cleanedJson = cleanJsonResponse(jsonMatch[1]);
                    data = JSON.parse(cleanedJson);
                  } else {
                    // 尝试第三种格式：在JavaScript变量中
                    const lines = responseText.split('\n');
                    for (const line of lines) {
                      if (line.includes('{') && line.includes('}')) {
                        try {
                          const match = line.match(/(\{[\s\S]*\})/);
                          if (match) {
                            const cleanedJson = cleanJsonResponse(match[1]);
                            data = JSON.parse(cleanedJson);
                            break;
                          }
                        } catch (e) {
                          // 继续尝试下一行
                          continue;
                        }
                      }
                    }
                  }
                }

                if (!data) {
                  NewsLogger.warn('未找到有效的东方财富新闻数据');
                  resolve([]);
                  return;
                }
              } catch (error) {
                NewsLogger.error('解析东方财富JSON失败', {
                  error,
                  responseTextPreview: responseText.substring(0, 300)
                });
                resolve([]);
                return;
              }
              const newsItems = parseEastMoneyNews(data, keywords);
              resolve(newsItems);
            } catch (error) {
              NewsLogger.error('解析东方财富新闻失败', error);
              reject(new Error(`Failed to parse EastMoney news: ${error}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`HTTP请求失败: ${error.message}`));
        });

        req.setTimeout(timeout, () => {
          req.destroy();
          reject(new Error(`请求超时 (${timeout}ms)`));
        });
      });

      NewsLogger.info(`成功获取 ${newsItems.length} 条东方财富新闻`);
      return newsItems;

    } catch (error) {
      lastError = error as Error;
      NewsLogger.warn(`东方财富新闻获取失败 (尝试 ${attempt}/${maxRetries})`, {
        error: error instanceof Error ? error.message : String(error)
      });

      if (attempt < maxRetries) {
        // 指数退避
        const delay = Math.pow(2, attempt - 1) * 1000;
        NewsLogger.info(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  NewsLogger.error(`所有 ${maxRetries} 次尝试都失败，返回模拟数据`, lastError);
  // 所有尝试都失败，返回模拟数据
  return generateMockNews(keywords);
}

/**
 * 解析东方财富新闻数据
 */
function parseEastMoneyNews(data: any, keywords: string[]): NewsItem[] {
  if (!data || !data.LivesList || !Array.isArray(data.LivesList)) {
    return [];
  }

  return data.LivesList.map((item: any) => {
    // 提取相关股票代码
    const relatedStocks = extractStockCodes(item.Content);

    // 分析情感
    const sentiment = analyzeSentiment(item.Content);

    // 评估影响级别
    const impactLevel = assessImpactLevel(item, keywords);

    return {
      title: item.Title || item.ShowTime || '财经快讯',
      summary: item.Content || '',
      content: item.Content || '',
      source: '东方财富',
      url: item.Url || `${NEWS_SOURCES.EASTMONEY.baseUrl}/a/${item.NewsID}.html`,
      publishTime: item.ShowTime || new Date().toISOString(),
      sentiment,
      keywords: extractKeywords(item.Content),
      relatedStocks,
      impactLevel
    };
  }).filter((item: NewsItem) => item.title && item.summary);
}

/**
 * 从雪球获取财经新闻（带重试机制）
 */
export async function fetchXueqiuNews(
  keywords: string[] = [],
  config: NewsCrawlerConfig = DEFAULT_CONFIG
): Promise<NewsItem[]> {

  // 如果配置使用模拟数据，返回模拟新闻
  if (config.useMockData) {
    NewsLogger.info('使用模拟新闻数据（雪球）', { keywords });
    return generateMockNews(keywords);
  }

  const maxRetries = config.maxRetries || DEFAULT_CONFIG.maxRetries!;
  const timeout = config.timeout || DEFAULT_CONFIG.timeout!;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const params = new URLSearchParams();
      params.set('count', NEWS_SOURCES.XUEQIU.params.count.toString());
      params.set('page', NEWS_SOURCES.XUEQIU.params.page.toString());
      params.set('type', NEWS_SOURCES.XUEQIU.params.type);
      const url = `${NEWS_SOURCES.XUEQIU.apiUrl}?${params.toString()}`;

      NewsLogger.info(`从雪球获取新闻 (尝试 ${attempt}/${maxRetries}): ${url}`);

      const newsItems = await new Promise<NewsItem[]>((resolve, reject) => {
        const req = https.get(url, {
          headers: {
            ...DEFAULT_HEADERS,
            'Cookie': 'device_id=anonymous; s=anonymous;' // 匿名访问
          }
        }, (res) => {
          let rawData: Buffer[] = [];

          res.on('data', (chunk: Buffer) => {
            rawData.push(chunk);
          });

          res.on('end', () => {
            try {
              const buffer = Buffer.concat(rawData);
              const responseText = buffer.toString('utf-8');
              const data = JSON.parse(responseText);

              const newsItems = parseXueqiuNews(data, keywords);
              resolve(newsItems);
            } catch (error) {
              NewsLogger.error('解析雪球新闻失败', error);
              reject(new Error(`Failed to parse Xueqiu news: ${error}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`HTTP请求失败: ${error.message}`));
        });

        req.setTimeout(timeout, () => {
          req.destroy();
          reject(new Error(`请求超时 (${timeout}ms)`));
        });
      });

      NewsLogger.info(`成功获取 ${newsItems.length} 条雪球新闻`);
      return newsItems;

    } catch (error) {
      lastError = error as Error;
      NewsLogger.warn(`雪球新闻获取失败 (尝试 ${attempt}/${maxRetries})`, {
        error: error instanceof Error ? error.message : String(error)
      });

      if (attempt < maxRetries) {
        // 指数退避
        const delay = Math.pow(2, attempt - 1) * 1000;
        NewsLogger.info(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  NewsLogger.error(`所有 ${maxRetries} 次尝试都失败，返回模拟数据`, lastError);
  // 所有尝试都失败，返回模拟数据
  return generateMockNews(keywords);
}

/**
 * 解析雪球新闻数据
 */
function parseXueqiuNews(data: any, keywords: string[]): NewsItem[] {
  if (!data || !data.list || !Array.isArray(data.list)) {
    return [];
  }

  return data.list
    .filter((item: any) => item.type === 'news' || item.type === 'article')
    .map((item: any) => {
      // 提取相关股票代码
      const relatedStocks = extractStockCodes(item.title + ' ' + item.description);

      // 分析情感
      const sentiment = analyzeSentiment(item.title + ' ' + item.description);

      // 评估影响级别
      const impactLevel = assessImpactLevel(item, keywords);

      return {
        title: item.title || '',
        summary: item.description || '',
        content: item.description || '',
        source: '雪球',
        url: item.target || `${NEWS_SOURCES.XUEQIU.baseUrl}${item.url}`,
        publishTime: new Date(item.created_at || Date.now()).toISOString(),
        sentiment,
        keywords: extractKeywords(item.title + ' ' + item.description),
        relatedStocks,
        impactLevel
      };
    })
    .filter((item: NewsItem) => item.title && item.summary);
}

/**
 * 获取财新网新闻
 */
export async function fetchCaixinNews(
  keywords: string[] = [],
  config: NewsCrawlerConfig = DEFAULT_CONFIG
): Promise<NewsItem[]> {

  // 如果配置使用模拟数据，返回模拟新闻
  if (config.useMockData) {
    NewsLogger.info('使用模拟新闻数据（财新）', { keywords });
    return generateMockNews(keywords);
  }

  const maxRetries = config.maxRetries || DEFAULT_CONFIG.maxRetries!;
  const timeout = config.timeout || DEFAULT_CONFIG.timeout!;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const params = new URLSearchParams();
      params.set('page', NEWS_SOURCES.CAIXIN.params.page.toString());
      params.set('pageSize', NEWS_SOURCES.CAIXIN.params.pageSize.toString());
      params.set('channel', NEWS_SOURCES.CAIXIN.params.channel);
      params.set('_', NEWS_SOURCES.CAIXIN.params._.toString());
      if (keywords.length > 0) {
        params.set('keywords', keywords.join(','));
      }
      const url = `${NEWS_SOURCES.CAIXIN.apiUrl}?${params.toString()}`;

      NewsLogger.info(`从财新网获取新闻 (尝试 ${attempt}/${maxRetries}): ${url}`);

      const newsItems = await new Promise<NewsItem[]>((resolve, reject) => {
        const req = https.get(url, {
          headers: {
            ...DEFAULT_HEADERS,
            'Referer': 'https://www.caixin.com/',
            'Origin': 'https://www.caixin.com'
          }
        }, (res) => {
          let rawData: Buffer[] = [];

          res.on('data', (chunk: Buffer) => {
            rawData.push(chunk);
          });

          res.on('end', () => {
            try {
              const buffer = Buffer.concat(rawData);
              const responseText = buffer.toString('utf-8');
              const data = JSON.parse(responseText);

              const newsItems = parseCaixinNews(data, keywords);
              resolve(newsItems);
            } catch (error) {
              NewsLogger.error('解析财新网新闻失败', error);
              reject(new Error(`Failed to parse Caixin news: ${error}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`HTTP请求失败: ${error.message}`));
        });

        req.setTimeout(timeout, () => {
          req.destroy();
          reject(new Error(`请求超时 (${timeout}ms)`));
        });
      });

      NewsLogger.info(`成功获取 ${newsItems.length} 条财新网新闻`);
      return newsItems;

    } catch (error) {
      lastError = error as Error;
      NewsLogger.warn(`财新网新闻获取失败 (尝试 ${attempt}/${maxRetries})`, {
        error: error instanceof Error ? error.message : String(error)
      });

      if (attempt < maxRetries) {
        // 指数退避
        const delay = Math.pow(2, attempt - 1) * 1000;
        NewsLogger.info(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  NewsLogger.error(`所有 ${maxRetries} 次尝试都失败，返回模拟数据`, lastError);
  // 所有尝试都失败，返回模拟数据
  return generateMockNews(keywords);
}

/**
 * 解析财新网新闻数据
 */
function parseCaixinNews(data: any, keywords: string[]): NewsItem[] {
  if (!data || !data.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data
    .filter((item: any) => item.type === 'article' || item.type === 'news')
    .map((item: any) => {
      // 提取相关股票代码
      const relatedStocks = extractStockCodes(item.title + ' ' + item.summary);

      // 分析情感
      const sentiment = analyzeSentiment(item.title + ' ' + item.summary);

      // 评估影响级别
      const impactLevel = assessImpactLevel(item, keywords);

      return {
        title: item.title || '',
        summary: item.summary || '',
        content: item.content || item.summary || '',
        source: '财新网',
        url: item.url || `${NEWS_SOURCES.CAIXIN.baseUrl}${item.path}`,
        publishTime: new Date(item.publishTime || item.createdAt || Date.now()).toISOString(),
        sentiment,
        keywords: extractKeywords(item.title + ' ' + item.summary),
        relatedStocks,
        impactLevel
      };
    })
    .filter((item: NewsItem) => item.title && item.summary);
}

/**
 * 提取股票代码
 */
function extractStockCodes(text: string): string[] {
  const stockPatterns = [
    /[0-9]{6}/g, // 6位数字代码
    /[A-Z]{2,4}/g, // 美股代码
    /[A-Z]{2,4}\.[A-Z]{2}/g, // 港股代码
    /[0-9]{5}/g // 5位数字代码（部分市场）
  ];

  const codes: string[] = [];

  for (const pattern of stockPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      codes.push(...matches);
    }
  }

  // 去重并过滤无效代码
  const uniqueCodes = Array.from(new Set(codes))
    .filter(code => {
      // 过滤明显不是股票代码的数字
      if (/^\d+$/.test(code)) {
        const num = parseInt(code, 10);
        return num >= 100000 && num <= 999999; // A股代码范围
      }
      return true;
    })
    .slice(0, 10); // 最多返回10个相关股票

  return uniqueCodes;
}

/**
 * 分析新闻情感
 */
function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const positiveWords = [
    '上涨', '大涨', '飙升', '暴涨', '突破', '创新高', '利好', '增长', '盈利',
    '复苏', '回暖', '扩张', '升级', '优化', '改善', '提升', '加强', '突破',
    '超预期', '看好', '推荐', '买入', '增持', '牛市', '乐观'
  ];

  const negativeWords = [
    '下跌', '大跌', '暴跌', '崩盘', '跌破', '创新低', '利空', '亏损', '下滑',
    '衰退', '恶化', '收缩', '降级', '恶化', '下降', '减弱', '破位', '低于预期',
    '看空', '减持', '卖出', '熊市', '悲观', '风险', '警告', '危机'
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  const lowerText = text.toLowerCase();

  for (const word of positiveWords) {
    if (lowerText.includes(word.toLowerCase())) {
      positiveCount++;
    }
  }

  for (const word of negativeWords) {
    if (lowerText.includes(word.toLowerCase())) {
      negativeCount++;
    }
  }

  if (positiveCount > negativeCount * 1.5) {
    return 'positive';
  } else if (negativeCount > positiveCount * 1.5) {
    return 'negative';
  } else {
    return 'neutral';
  }
}

/**
 * 提取关键词
 */
function extractKeywords(text: string): string[] {
  const commonWords = new Set([
    '的', '了', '在', '是', '和', '与', '或', '及', '等', '这', '那', '就',
    '都', '也', '还', '又', '而', '但', '并', '且', '如果', '因为', '所以',
    '虽然', '但是', '然而', '因此', '于是', '然后', '而且', '或者', '不仅',
    '而且', '即使', '尽管', '只要', '只有', '除非', '无论', '不管', '关于',
    '对于', '根据', '按照', '通过', '由于', '为了', '关于', '对于', '以及',
    '以及', '以及', '以及'
  ]);

  const words = text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2 && !commonWords.has(word));

  // 统计词频
  const wordCount: Record<string, number> = {};
  for (const word of words) {
    wordCount[word] = (wordCount[word] || 0) + 1;
  }

  // 按词频排序并返回前10个关键词
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * 清理非标准JSON响应（JSONP、包装的JSON等）
 */
function cleanJsonResponse(rawData: string): string {
  let cleaned = rawData.trim();

  // 移除JSONP包装：callback({...}) 或 callback(...);
  const jsonpMatch = cleaned.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(\s*({[\s\S]*})\s*\)\s*;?\s*$/);
  if (jsonpMatch) {
    cleaned = jsonpMatch[1];
    NewsLogger.debug('移除JSONP包装');
  }

  // 移除潜在的函数包装
  cleaned = cleaned.replace(/^[^{[]*([{[])/, '$1');
  cleaned = cleaned.replace(/([}\]])[^}\]]*$/, '$1');

  // 修复常见的JSON问题
  cleaned = cleaned
    // 将单引号替换为双引号（小心处理）
    .replace(/([{,]\s*)'([^']+)'(?=\s*[:,\]}])/g, '$1"$2"')
    // 移除尾随逗号
    .replace(/,(\s*[}\]])/g, '$1')
    // 修复未加引号的属性名
    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

  // 验证JSON结构
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    NewsLogger.warn('清理后的JSON仍然无效，尝试更激进的清理', {
      cleanedPreview: cleaned.substring(0, 200)
    });

    // 更激进的清理：提取JSON对象/数组
    const jsonObjectMatch = cleaned.match(/({[\s\S]*})/);
    if (jsonObjectMatch) {
      return jsonObjectMatch[1];
    }

    const jsonArrayMatch = cleaned.match(/(\[[\s\S]*\])/);
    if (jsonArrayMatch) {
      return jsonArrayMatch[1];
    }

    throw new Error('无法清理JSON响应，响应格式无效');
  }
}

/**
 * 评估新闻影响级别
 */
function assessImpactLevel(newsItem: any, keywords: string[]): 'high' | 'medium' | 'low' {
  // 检查是否包含关键词
  const hasKeywords = keywords.some(keyword =>
    newsItem.title?.includes(keyword) ||
    newsItem.summary?.includes(keyword) ||
    newsItem.content?.includes(keyword)
  );

  // 检查标题长度和强度词
  const title = newsItem.title || '';
  const strongWords = ['突发', '紧急', '重磅', '重大', '特大利好', '特大利空', '紧急通知'];
  const hasStrongWord = strongWords.some(word => title.includes(word));

  // 检查来源权威性
  const authoritativeSources = ['新华社', '人民日报', '央视', '证监会', '央行', '国务院'];
  const source = newsItem.source || '';
  const isAuthoritative = authoritativeSources.some(authSource => source.includes(authSource));

  // 评分逻辑
  let score = 0;

  if (hasKeywords) score += 2;
  if (hasStrongWord) score += 3;
  if (isAuthoritative) score += 2;

  // 检查是否涉及多个股票
  const relatedStocks = extractStockCodes(title + ' ' + (newsItem.summary || ''));
  if (relatedStocks.length >= 3) score += 1;

  // 根据分数确定影响级别
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

/**
 * 从多个来源获取新闻（支持配置）
 */
export async function fetchNewsFromMultipleSources(
  keywords: string[] = [],
  sources: ('sina' | 'eastmoney' | 'xueqiu' | 'caixin')[] = ['sina', 'eastmoney'],
  config: NewsCrawlerConfig = DEFAULT_CONFIG
): Promise<NewsItem[]> {

  NewsLogger.info('从多个来源获取新闻', { keywords, sources, useMockData: config.useMockData });

  // 应用配置到日志系统
  NewsLogger.setConfig(config);

  const promises: Promise<NewsItem[]>[] = [];

  if (sources.includes('sina')) {
    promises.push(fetchSinaFinanceNews(keywords, config).catch(error => {
      NewsLogger.error('获取新浪财经新闻失败', error);
      return [];
    }));
  }

  if (sources.includes('eastmoney')) {
    promises.push(fetchEastMoneyNews(keywords, config).catch(error => {
      NewsLogger.error('获取东方财富新闻失败', error);
      return [];
    }));
  }

  if (sources.includes('xueqiu')) {
    promises.push(fetchXueqiuNews(keywords, config).catch(error => {
      NewsLogger.error('获取雪球新闻失败', error);
      return [];
    }));
  }

  if (sources.includes('caixin')) {
    promises.push(fetchCaixinNews(keywords, config).catch(error => {
      NewsLogger.error('获取财新网新闻失败', error);
      return [];
    }));
  }

  const results = await Promise.all(promises);

  // 合并所有新闻，按发布时间排序
  const allNews = results.flat();
  allNews.sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime());

  // 去重（基于标题相似性）
  const uniqueNews: NewsItem[] = [];
  const seenTitles = new Set<string>();

  for (const news of allNews) {
    const normalizedTitle = news.title
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
      .trim();

    if (!seenTitles.has(normalizedTitle) && normalizedTitle.length > 5) {
      seenTitles.add(normalizedTitle);
      uniqueNews.push(news);
    }
  }

  NewsLogger.info(`新闻获取完成，共 ${allNews.length} 条，去重后 ${uniqueNews.length} 条`);

  return uniqueNews.slice(0, 50); // 最多返回50条新闻
}

/**
 * 按股票代码获取相关新闻
 */
export async function fetchNewsByStockCode(
  stockCode: string,
  config: NewsCrawlerConfig = DEFAULT_CONFIG
): Promise<NewsItem[]> {
  NewsLogger.info(`按股票代码获取新闻: ${stockCode}`);

  // 股票相关关键词
  const stockKeywords = [
    stockCode,
    '股票',
    'A股',
    '上市公司',
    '财报',
    '业绩'
  ];

  // 获取新闻
  const newsItems = await fetchNewsFromMultipleSources(stockKeywords, ['sina', 'eastmoney'], config);

  // 过滤出真正包含该股票代码的新闻
  const filteredNews = newsItems.filter(news =>
    news.relatedStocks.includes(stockCode) ||
    news.title.includes(stockCode) ||
    news.summary.includes(stockCode)
  );

  NewsLogger.info(`股票 ${stockCode} 相关新闻: ${filteredNews.length} 条`);

  return filteredNews;
}

/**
 * 按行业获取新闻
 */
export async function fetchNewsByIndustry(
  industry: string,
  config: NewsCrawlerConfig = DEFAULT_CONFIG
): Promise<NewsItem[]> {
  NewsLogger.info(`按行业获取新闻: ${industry}`);

  const industryKeywords = [
    industry,
    '行业',
    '板块',
    '产业链',
    '供应链'
  ];

  return fetchNewsFromMultipleSources(industryKeywords, ['sina', 'eastmoney'], config);
}

/**
 * 分析新闻摘要
 */
export function analyzeNewsSummary(newsItems: NewsItem[]): {
  overallSentiment: 'positive' | 'negative' | 'neutral';
  keyThemes: string[];
  highImpactNews: NewsItem[];
  stockImpact: Record<string, { count: number; sentiment: string }>;
} {
  if (newsItems.length === 0) {
    return {
      overallSentiment: 'neutral',
      keyThemes: [],
      highImpactNews: [],
      stockImpact: {}
    };
  }

  // 计算总体情感
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  for (const news of newsItems) {
    sentimentCounts[news.sentiment]++;
  }

  const total = newsItems.length;
  let overallSentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

  if (sentimentCounts.positive / total > 0.4) {
    overallSentiment = 'positive';
  } else if (sentimentCounts.negative / total > 0.4) {
    overallSentiment = 'negative';
  }

  // 提取关键主题
  const allKeywords = newsItems.flatMap(news => news.keywords);
  const keywordCounts: Record<string, number> = {};

  for (const keyword of allKeywords) {
    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
  }

  const keyThemes = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword]) => keyword);

  // 筛选高影响新闻
  const highImpactNews = newsItems.filter(news => news.impactLevel === 'high');

  // 分析股票影响
  const stockImpact: Record<string, { count: number; sentiment: string }> = {};

  for (const news of newsItems) {
    for (const stock of news.relatedStocks) {
      if (!stockImpact[stock]) {
        stockImpact[stock] = { count: 0, sentiment: 'neutral' };
      }
      stockImpact[stock].count++;

      // 更新股票情感（如果有强烈情感新闻）
      if (news.sentiment === 'positive' && news.impactLevel === 'high') {
        stockImpact[stock].sentiment = 'positive';
      } else if (news.sentiment === 'negative' && news.impactLevel === 'high') {
        stockImpact[stock].sentiment = 'negative';
      }
    }
  }

  return {
    overallSentiment,
    keyThemes,
    highImpactNews,
    stockImpact
  };
}

/**
 * 测试函数
 */
export async function testNewsCrawler(): Promise<boolean> {
  try {
    NewsLogger.info('开始测试新闻爬虫...');

    // 测试配置
    const testConfig: NewsCrawlerConfig = {
      useMockData: true, // 使用模拟数据避免网络问题
      timeout: 10000,
      maxRetries: 2,
      logLevel: 'info'
    };

    // 测试新浪财经（模拟数据）
    NewsLogger.info('\n1. 测试新浪财经新闻（模拟数据）...');
    const sinaNews = await fetchSinaFinanceNews(['股票', 'A股'], testConfig);
    NewsLogger.info(`获取到 ${sinaNews.length} 条新浪财经新闻`);
    if (sinaNews.length > 0) {
      NewsLogger.info('最新新闻:', {
        title: sinaNews[0].title,
        source: sinaNews[0].source,
        sentiment: sinaNews[0].sentiment,
        impact: sinaNews[0].impactLevel,
        relatedStocks: sinaNews[0].relatedStocks
      });
    }

    // 测试东方财富（模拟数据）
    NewsLogger.info('\n2. 测试东方财富新闻（模拟数据）...');
    const eastMoneyNews = await fetchEastMoneyNews(['股市', '投资'], testConfig);
    NewsLogger.info(`获取到 ${eastMoneyNews.length} 条东方财富新闻`);
    if (eastMoneyNews.length > 0) {
      NewsLogger.info('最新新闻:', {
        title: eastMoneyNews[0].title,
        source: eastMoneyNews[0].source,
        sentiment: eastMoneyNews[0].sentiment
      });
    }

    // 测试多源获取（模拟数据）
    NewsLogger.info('\n3. 测试多源新闻获取（模拟数据）...');
    const allNews = await fetchNewsFromMultipleSources(['财经', '市场'], ['sina', 'eastmoney'], testConfig);
    NewsLogger.info(`总共获取到 ${allNews.length} 条新闻`);

    // 测试按股票代码获取新闻
    NewsLogger.info('\n4. 测试按股票代码获取新闻...');
    const stockNews = await fetchNewsByStockCode('000001', testConfig);
    NewsLogger.info(`股票 000001 相关新闻: ${stockNews.length} 条`);
    if (stockNews.length > 0) {
      NewsLogger.info('相关新闻示例:', {
        title: stockNews[0].title,
        sentiment: stockNews[0].sentiment,
        impact: stockNews[0].impactLevel
      });
    }

    // 测试按行业获取新闻
    NewsLogger.info('\n5. 测试按行业获取新闻...');
    const industryNews = await fetchNewsByIndustry('新能源', testConfig);
    NewsLogger.info(`新能源行业新闻: ${industryNews.length} 条`);

    // 测试新闻分析
    NewsLogger.info('\n6. 测试新闻分析...');
    const analysis = analyzeNewsSummary(allNews.slice(0, 20));
    NewsLogger.info('新闻分析结果:', {
      overallSentiment: analysis.overallSentiment,
      keyThemes: analysis.keyThemes.slice(0, 5),
      highImpactNewsCount: analysis.highImpactNews.length,
      stockImpactCount: Object.keys(analysis.stockImpact).length
    });

    // 显示股票影响分析
    if (Object.keys(analysis.stockImpact).length > 0) {
      NewsLogger.info('股票影响分析（前5个）:',
        Object.entries(analysis.stockImpact)
          .slice(0, 5)
          .map(([stock, data]) => `${stock}: ${data.count}条新闻，情感: ${data.sentiment}`)
      );
    }

    // 测试真实API（如果可用）
    const useRealAPI = process.env.TEST_REAL_API === 'true';
    if (useRealAPI) {
      NewsLogger.info('\n7. 测试真实API（需要网络连接）...');
      const realConfig: NewsCrawlerConfig = {
        useMockData: false,
        timeout: 15000,
        maxRetries: 3,
        logLevel: 'debug'
      };

      try {
        const realNews = await fetchNewsFromMultipleSources(['财经'], ['sina'], realConfig);
        NewsLogger.info(`真实API获取到 ${realNews.length} 条新闻`);
      } catch (error) {
        NewsLogger.warn('真实API测试失败（可能是网络问题）', error);
      }
    }

    NewsLogger.info('新闻爬虫测试完成');
    return true;
  } catch (error) {
    NewsLogger.error('新闻爬虫测试失败:', error);
    return false;
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testNewsCrawler().then(success => {
    process.exit(success ? 0 : 1);
  });
}