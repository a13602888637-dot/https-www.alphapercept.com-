/**
 * Alpha-Quant-Copilot Data Crawler
 * Real-time market data collection from Sina and Tencent finance APIs
 * Primary data source: Sina Finance API
 * Fallback data source: Tencent Finance API
 */

import iconv from 'iconv-lite';
import * as zlib from 'zlib';

// Market data interface for internal system use
export interface MarketData {
  symbol: string;
  name: string;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  lastUpdateTime: string;
  change?: number;
  changePercent?: number;
  volume?: number;
  turnover?: number;
  peRatio?: number;
  marketCap?: number;
}

// Sina finance API configuration
const SINA_API_BASE = 'http://hq.sinajs.cn';
const SINA_STOCK_PREFIX = 'sh'; // Shanghai stock exchange
const SINA_STOCK_SUFFIX = 'sz'; // Shenzhen stock exchange

// User-Agent and headers to avoid 403 errors
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'http://finance.sina.com.cn',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0',
};

/**
 * Generic fetch function with enhanced error handling, gzip decompression, and encoding conversion
 * @param url The URL to fetch
 * @param options Optional fetch options
 * @returns Decoded text response
 */
async function fetchWithEncoding(
  url: string,
  options: RequestInit = {}
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...(options.headers || {})
      },
      signal: controller.signal
    };

    Logger.debug(`Fetching URL: ${url}`);
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
    }

    // Get response as ArrayBuffer to handle binary data
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(new Uint8Array(arrayBuffer)) as Buffer;

    // Handle gzip decompression if needed
    const contentEncoding = response.headers.get('content-encoding');
    if (contentEncoding === 'gzip' || contentEncoding === 'deflate') {
      try {
        buffer = await new Promise<Buffer>((resolve, reject) => {
          zlib.gunzip(buffer, (error, result) => {
            if (error) {
              // Try inflate if gunzip fails
              zlib.inflate(buffer, (inflateError, inflateResult) => {
                if (inflateError) {
                  reject(new Error(`Failed to decompress response: ${inflateError.message}`));
                } else {
                  resolve(inflateResult);
                }
              });
            } else {
              resolve(result);
            }
          });
        });
      } catch (decompressError) {
        Logger.warn(`Failed to decompress response, using raw data: ${decompressError}`);
        // Continue with raw buffer
      }
    }

    // Try to detect and decode the encoding
    let decodedText: string;

    // For Chinese financial APIs (Sina/Tencent), they typically use GBK or GB18030
    // Try GBK first (most common for these APIs)
    let decodedWithGBK = iconv.decode(buffer, 'gbk');
    if (!decodedWithGBK.includes('�') && (decodedWithGBK.includes('=') || decodedWithGBK.includes('~'))) {
      decodedText = decodedWithGBK;
      Logger.debug(`Successfully decoded with GBK, length: ${decodedText.length}`);
    } else {
      // Try GB18030 (superset of GBK)
      let decodedWithGB18030 = iconv.decode(buffer, 'gb18030');
      if (!decodedWithGB18030.includes('�') && (decodedWithGB18030.includes('=') || decodedWithGB18030.includes('~'))) {
        decodedText = decodedWithGB18030;
        Logger.debug(`Successfully decoded with GB18030, length: ${decodedText.length}`);
      } else {
        // Try UTF-8
        let decodedWithUTF8 = buffer.toString('utf-8');
        if (!decodedWithUTF8.includes('�') && (decodedWithUTF8.includes('=') || decodedWithUTF8.includes('~'))) {
          decodedText = decodedWithUTF8;
          Logger.debug(`Successfully decoded with UTF-8, length: ${decodedText.length}`);
        } else {
          // Try GB2312
          try {
            decodedText = iconv.decode(buffer, 'gb2312');
            Logger.warn('Using GB2312 encoding for API response');
          } catch (e) {
            // Last resort: use UTF-8 with replacement characters
            decodedText = buffer.toString('utf-8');
            Logger.warn('Using UTF-8 with replacement characters for API response');
          }
        }
      }
    }

    Logger.debug(`Successfully fetched and decoded response from ${url}, length: ${decodedText.length}`);
    return decodedText;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after 10 seconds for ${url}`);
    }
    throw new Error(`Fetch failed for ${url}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Enhanced Logger utility with log levels and file output support
class Logger {
  static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error') {
    this.logLevel = level;
  }

  static debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data || '');
    }
  }

  static info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || '');
    }
  }

  static error(message: string, error?: any) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
    }
  }

  static warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data || '');
    }
  }

  private static shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }
}

/**
 * Fetch real-time stock data from Sina finance API with enhanced error handling and retry mechanism
 * @param symbol Stock symbol (e.g., '000001' for Ping An Bank)
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @returns Parsed market data
 */
export async function fetchSinaStockData(symbol: string, maxRetries: number = 3): Promise<MarketData> {
  // Determine exchange prefix based on symbol
  const exchangePrefix = symbol.startsWith('6') ? SINA_STOCK_PREFIX : SINA_STOCK_SUFFIX;
  const apiUrl = `${SINA_API_BASE}/list=${exchangePrefix}${symbol}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      Logger.info(`Fetching data from Sina API (attempt ${attempt}/${maxRetries}): ${apiUrl}`);

      // Use fetchWithEncoding to handle HTTP request, gzip decompression, and encoding conversion
      const responseText = await fetchWithEncoding(apiUrl);

      // Parse the response
      const marketData = parseSinaResponse(responseText, symbol);
      Logger.info(`Successfully fetched Sina data for ${symbol}`);

      return marketData;
    } catch (error) {
      lastError = error as Error;
      Logger.warn(`Sina API call failed (attempt ${attempt}/${maxRetries})`, {
        symbol,
        error: error instanceof Error ? error.message : String(error)
      });

      if (attempt < maxRetries) {
        // Exponential backoff: wait 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        Logger.info(`Retrying Sina API in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  Logger.error(`All ${maxRetries} attempts failed for Sina API: ${symbol}`, lastError);
  throw lastError || new Error(`Failed to fetch Sina data for ${symbol} after ${maxRetries} attempts`);
}

/**
 * Parse Sina API response string with enhanced error handling
 * Response format: var hq_str_sh600000="浦发银行,16.85,16.86,16.80,16.95,16.70,16.80,16.81,12345678,208888888,1600,16.80,200,16.79,500,16.78,800,16.77,1000,16.76,500,16.81,100,16.82,200,16.83,300,16.84,400,16.85,500,2024-01-15,15:00:00,00";
 *
 * Field mapping according to user requirements:
 * Index 1: name (股票名称)
 * Index 3: now (当前价格)
 * Index 4: high (最高价)
 * Index 5: low (最低价)
 * Index 31: time (最后更新时间)
 */
function parseSinaResponse(responseText: string, symbol: string): MarketData {
  try {
    Logger.debug(`Parsing Sina response for ${symbol}: ${responseText.substring(0, 200)}...`);

    // Extract the data part from the response - handle multiple formats
    let dataString: string = '';

    // Format 1: var hq_str_sh600000="data..."
    let match = responseText.match(/="([^"]+)"/);
    if (match && match[1]) {
      dataString = match[1];
    } else {
      // Format 2: Just the data without var declaration
      match = responseText.match(/^([^=]+)$/);
      if (match && match[1]) {
        dataString = match[1];
      } else {
        // Format 3: Try to extract any CSV-like data
        const lines = responseText.split('\n');
        for (const line of lines) {
          if (line.includes(',') && line.length > 10) {
            dataString = line.trim();
            break;
          }
        }
      }
    }

    if (!dataString) {
      throw new Error(`Invalid Sina API response format. Response: ${responseText.substring(0, 200)}`);
    }

    const fields = dataString.split(',');

    // Validate minimum required fields
    if (fields.length < 32) {
      Logger.warn(`Insufficient fields in Sina response. Expected at least 32, got ${fields.length}`, {
        symbol,
        fieldsCount: fields.length,
        sampleFields: fields.slice(0, 10)
      });

      // Try to parse with available fields
      if (fields.length < 5) {
        throw new Error(`Too few fields in Sina response: ${fields.length}`);
      }
    }

    // Parse fields with validation
    const name = fields[0] || symbol;
    const currentPrice = safeParseFloat(fields[2], 0);
    const highPrice = safeParseFloat(fields[3], currentPrice);
    const lowPrice = safeParseFloat(fields[4], currentPrice);

    // Handle date and time fields (may be missing in some responses)
    let date = fields[30] || '';
    let time = fields[31] || '';

    // If date/time fields are missing, use current time
    if (!date || !time) {
      const now = new Date();
      date = now.toISOString().split('T')[0];
      time = now.toTimeString().split(' ')[0];
      Logger.warn(`Missing date/time in Sina response for ${symbol}, using current time`);
    }

    // Calculate change if previous close is available
    const previousClose = safeParseFloat(fields[1], currentPrice);
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    // Parse volume and turnover if available
    const volume = fields[7] ? safeParseFloat(fields[7]) : undefined;
    const turnover = fields[8] ? safeParseFloat(fields[8]) : undefined;

    // Validate parsed data
    if (isNaN(currentPrice) || currentPrice <= 0) {
      throw new Error(`Invalid current price: ${currentPrice}`);
    }

    const marketData: MarketData = {
      symbol,
      name,
      currentPrice,
      highPrice,
      lowPrice,
      lastUpdateTime: `${date} ${time}`.trim(),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume,
      turnover,
    };

    Logger.debug(`Successfully parsed Sina data for ${symbol}:`, {
      name: marketData.name,
      price: marketData.currentPrice,
      time: marketData.lastUpdateTime
    });

    return marketData;
  } catch (error) {
    Logger.error(`Failed to parse Sina response for ${symbol}:`, error);
    throw new Error(`Sina response parsing failed for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Safe parse float with default value
 */
function safeParseFloat(value: string | undefined, defaultValue: number = 0): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}


/**
 * Fetch multiple stocks data in parallel with enhanced error handling
 * @param symbols Array of stock symbols
 * @param maxRetries Maximum retry attempts per symbol (default: 2)
 * @returns Array of market data
 */
export async function fetchMultipleStocks(symbols: string[], maxRetries: number = 2): Promise<MarketData[]> {
  const promises = symbols.map(symbol =>
    fetchSinaStockData(symbol, maxRetries).catch(error => {
      Logger.error(`Failed to fetch data for ${symbol}:`, error);

      // Try Tencent API as fallback
      Logger.info(`Trying Tencent API as fallback for ${symbol}`);
      return fetchTencentStockData(symbol, maxRetries).catch(tencentError => {
        Logger.error(`All APIs failed for ${symbol}:`, tencentError);
        return null;
      });
    })
  );

  const results = await Promise.all(promises);
  const validResults = results.filter((data): data is MarketData => data !== null);

  Logger.info(`Fetched ${validResults.length}/${symbols.length} stocks successfully`);
  return validResults;
}

/**
 * Tencent finance API (alternative source) with enhanced error handling and retry mechanism
 * Note: Tencent API may have different rate limits and format
 */
export async function fetchTencentStockData(symbol: string, maxRetries: number = 3): Promise<MarketData> {
  // Tencent API endpoint
  const apiUrl = `https://qt.gtimg.cn/q=${symbol}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      Logger.info(`Fetching data from Tencent API (attempt ${attempt}/${maxRetries}): ${apiUrl}`);

      // Use fetchWithEncoding to handle HTTP request, gzip decompression, and encoding conversion
      const responseText = await fetchWithEncoding(apiUrl);

      const marketData = parseTencentResponse(responseText, symbol);
      Logger.info(`Successfully fetched Tencent data for ${symbol}`);

      return marketData;
    } catch (error) {
      lastError = error as Error;
      Logger.warn(`Tencent API call failed (attempt ${attempt}/${maxRetries})`, {
        symbol,
        error: error instanceof Error ? error.message : String(error)
      });

      if (attempt < maxRetries) {
        // Exponential backoff: wait 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        Logger.info(`Retrying Tencent API in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  Logger.error(`All ${maxRetries} attempts failed for Tencent API: ${symbol}`, lastError);
  throw lastError || new Error(`Failed to fetch Tencent data for ${symbol} after ${maxRetries} attempts`);
}

/**
 * Parse Tencent API response with enhanced error handling
 * Response format: v_sh600000="1~浦发银行~600000~9.89~9.98~9.98~700407~250085~450322~9.89~1630~9.88~25534~9.87~4845~9.86~8487~9.85~4170~9.90~1821~9.91~2795~9.92~2204~9.93~1060~9.94~894~~20260213161414~-0.09~-0.90~10.03~9.88~9.89/700407/696614490~..."
 *
 * Field mapping based on actual API response:
 * [1] 股票名称
 * [2] 股票代码
 * [3] 当前价格
 * [4] 昨收
 * [5] 今开
 * [6] 成交量(手)
 * [30] 时间戳 (YYYYMMDDHHMMSS)
 * [31] 涨跌
 * [32] 涨跌幅
 * [33] 最高价
 * [34] 最低价
 */
function parseTencentResponse(responseText: string, symbol: string): MarketData {
  try {
    Logger.debug(`Parsing Tencent response for ${symbol}: ${responseText.substring(0, 200)}...`);

    // Extract the data part from the response - handle multiple formats
    let dataString: string = '';

    // Format 1: v_sh600000="data..."
    let match = responseText.match(/="([^"]+)"/);
    if (match && match[1]) {
      dataString = match[1];
    } else {
      // Format 2: Just the data without prefix
      match = responseText.match(/^([^=]+)$/);
      if (match && match[1]) {
        dataString = match[1];
      } else {
        // Format 3: Try to extract any ~ separated data
        const lines = responseText.split('\n');
        for (const line of lines) {
          if (line.includes('~') && line.length > 10) {
            dataString = line.trim();
            break;
          }
        }
      }
    }

    if (!dataString) {
      throw new Error(`Invalid Tencent API response format. Response: ${responseText.substring(0, 200)}`);
    }

    const fields = dataString.split('~');

    // Validate minimum required fields
    if (fields.length < 35) {
      Logger.warn(`Insufficient fields in Tencent response. Expected at least 35, got ${fields.length}`, {
        symbol,
        fieldsCount: fields.length,
        sampleFields: fields.slice(0, 10)
      });

      // Try to parse with available fields
      if (fields.length < 5) {
        throw new Error(`Too few fields in Tencent response: ${fields.length}`);
      }
    }

    // Tencent field mapping with safe parsing
    const name = fields[1] || symbol;
    const currentPrice = safeParseFloat(fields[3], 0);
    const previousClose = safeParseFloat(fields[4], currentPrice);
    const volume = fields[6] ? safeParseFloat(fields[6]) * 100 : undefined; // Convert to shares

    // Key fields - based on actual response position
    const timestamp = fields[30] || ''; // YYYYMMDDHHMMSS
    const change = fields[31] ? safeParseFloat(fields[31]) : currentPrice - previousClose;
    const changePercent = fields[32] ? safeParseFloat(fields[32]) : (previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0);
    const highPrice = fields[33] ? safeParseFloat(fields[33], currentPrice) : currentPrice;
    const lowPrice = fields[34] ? safeParseFloat(fields[34], currentPrice) : currentPrice;

    // Parse timestamp
    let formattedDate = '';
    let formattedTime = '';

    if (timestamp && timestamp.length >= 14) {
      formattedDate = `${timestamp.slice(0,4)}-${timestamp.slice(4,6)}-${timestamp.slice(6,8)}`;
      formattedTime = `${timestamp.slice(8,10)}:${timestamp.slice(10,12)}:${timestamp.slice(12,14)}`;
    } else {
      // Use current time if timestamp is missing
      const now = new Date();
      formattedDate = now.toISOString().split('T')[0];
      formattedTime = now.toTimeString().split(' ')[0];
      Logger.warn(`Missing timestamp in Tencent response for ${symbol}, using current time`);
    }

    // Calculate turnover (if available)
    let turnover: number | undefined = undefined;
    if (fields[35] && fields[35].includes('/')) {
      const turnoverParts = fields[35].split('/');
      if (turnoverParts.length >= 3) {
        turnover = safeParseFloat(turnoverParts[2]);
      }
    }

    // Validate parsed data
    if (isNaN(currentPrice) || currentPrice <= 0) {
      throw new Error(`Invalid current price: ${currentPrice}`);
    }

    const marketData: MarketData = {
      symbol,
      name,
      currentPrice,
      highPrice,
      lowPrice,
      lastUpdateTime: `${formattedDate} ${formattedTime}`.trim(),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume,
      turnover,
    };

    Logger.debug(`Successfully parsed Tencent data for ${symbol}:`, {
      name: marketData.name,
      price: marketData.currentPrice,
      time: marketData.lastUpdateTime
    });

    return marketData;
  } catch (error) {
    Logger.error(`Failed to parse Tencent response for ${symbol}:`, error);
    throw new Error(`Tencent response parsing failed for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch market data using Sina as primary source with Tencent as fallback
 */
export async function fetchMarketDataWithFallback(symbol: string, maxRetries: number = 2): Promise<MarketData> {
  try {
    Logger.info(`Fetching market data for ${symbol} using Sina with ${maxRetries} retries`);

    // Try Sina first
    const sinaSymbol = symbol.replace(/\.(SH|SZ)$/, ''); // Remove .SH/.SZ suffix if present
    return await fetchSinaStockData(sinaSymbol, maxRetries);

  } catch (error) {
    Logger.error(`Sina API failed for ${symbol}, trying Tencent`, error);

    try {
      // Try Tencent API as fallback
      const tencentSymbol = symbol.includes('.SH') ? 'sh' + symbol.replace('.SH', '') :
                          symbol.includes('.SZ') ? 'sz' + symbol.replace('.SZ', '') :
                          symbol.startsWith('6') ? 'sh' + symbol : 'sz' + symbol;
      return await fetchTencentStockData(tencentSymbol, maxRetries);
    } catch (tencentError) {
      Logger.error(`All data sources failed for ${symbol}`, tencentError);

      // Create a minimal market data object to prevent complete failure
      const fallbackData: MarketData = {
        symbol,
        name: symbol,
        currentPrice: 0,
        highPrice: 0,
        lowPrice: 0,
        lastUpdateTime: new Date().toISOString(),
        change: 0,
        changePercent: 0
      };

      Logger.warn(`Returning fallback data for ${symbol} due to complete API failure`);
      return fallbackData;
    }
  }
}

/**
 * Main function to test the data crawler
 */
async function testDataCrawler() {
  try {
    Logger.info('Starting data crawler test...');

    // Test Sina API
    Logger.info('Testing Sina API data crawler...');
    try {
      const sinaData = await fetchSinaStockData('000001');
      Logger.info('Sina API Test Result:', {
        symbol: sinaData.symbol,
        name: sinaData.name,
        price: sinaData.currentPrice,
        high: sinaData.highPrice,
        low: sinaData.lowPrice,
        time: sinaData.lastUpdateTime,
        change: sinaData.change,
        changePercent: sinaData.changePercent,
      });
    } catch (error) {
      Logger.warn('Sina API test failed', error);
    }

    // Test Tencent API
    Logger.info('\nTesting Tencent API data crawler...');
    try {
      const tencentData = await fetchTencentStockData('sh600000');
      Logger.info('Tencent API Test Result:', {
        symbol: tencentData.symbol,
        name: tencentData.name,
        price: tencentData.currentPrice,
        high: tencentData.highPrice,
        low: tencentData.lowPrice,
        time: tencentData.lastUpdateTime,
        change: tencentData.change,
        changePercent: tencentData.changePercent,
      });
    } catch (error) {
      Logger.warn('Tencent API test failed', error);
    }

    // Test fallback mechanism
    Logger.info('\nTesting fallback mechanism...');
    const fallbackData = await fetchMarketDataWithFallback('000001');
    Logger.info('Fallback mechanism result:', {
      symbol: fallbackData.symbol,
      name: fallbackData.name,
      price: fallbackData.currentPrice,
      source: 'Sina/Tencent',
    });

    // Test multiple stocks
    Logger.info('\nTesting multiple stocks...');
    try {
      const multipleStocks = await fetchMultipleStocks(['000001', '600000']);
      Logger.info(`Fetched ${multipleStocks.length} stocks successfully`);
    } catch (error) {
      Logger.warn('Multiple stocks test failed', error);
    }

    Logger.info('Data crawler test completed');
    return true;
  } catch (error) {
    Logger.error('Data crawler test failed:', error);
    return false;
  }
}

// Export test function
export { testDataCrawler };

// Run test if this file is executed directly
// Note: In ES modules, we can't use require.main === module
// Instead, we check if the file is being run directly
// by looking at import.meta.url (for ES modules) or require.main (for CommonJS)

// For now, we'll export the test function and let users call it explicitly
// To run tests: npx ts-node skills/data_crawler.ts --test
// or import and call testDataCrawler()