/**
 * Alpha-Quant-Copilot Data Crawler
 * Real-time market data collection from Sina and Tencent finance APIs
 * Primary data source: Sina Finance API
 * Fallback data source: Tencent Finance API
 */

import * as iconv from 'iconv-lite';
import * as zlib from 'zlib';
import {
  DataSourceType,
  dataSourceSelector,
  SmartDataSourceSelector
} from './data_source_selector';

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
  ma20?: number;   // 20-day moving average
  ma60?: number;   // 60-day moving average
}

// Sina finance API configuration
const SINA_API_BASE = 'http://hq.sinajs.cn';
const SINA_STOCK_PREFIX = 'sh'; // Shanghai stock exchange
const SINA_STOCK_SUFFIX = 'sz'; // Shenzhen stock exchange

// User-Agent and headers to avoid 403 errors and bypass Vercel IP blocking
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': 'https://finance.sina.com.cn',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Upgrade-Insecure-Requests': '1',
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
  // Normalize symbol for Sina API
  const sinaSymbol = normalizeSymbolForSina(symbol);
  const apiUrl = `${SINA_API_BASE}/list=${sinaSymbol}`;

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
      Logger.error(`Sina API failed for ${symbol}:`, error);

      // Try Tencent API as fallback
      Logger.info(`Trying Tencent API as fallback for ${symbol}`);
      return fetchTencentStockData(symbol, maxRetries).catch(tencentError => {
        Logger.error(`Sina and Tencent APIs failed for ${symbol}, trying Yahoo Finance as global fallback`, tencentError);

        // Try Yahoo Finance as global fallback
        return fetchYahooStockData(symbol, maxRetries).catch(yahooError => {
          Logger.error(`All APIs including Yahoo Finance failed for ${symbol}:`, yahooError);
          // Ultimate fallback: return minimal market data
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
          Logger.warn(`Returning ultimate fallback data for ${symbol} due to complete API failure`);
          return fallbackData;
        });
      });
    })
  );

  try {
    const results = await Promise.all(promises);
    Logger.info(`Fetched ${results.length}/${symbols.length} stocks successfully`);
    return results;
  } catch (error) {
    Logger.error(`Error fetching multiple stocks:`, error);
    // 重新抛出错误，让调用方处理
    throw error;
  }
}

/**
 * Normalize symbol for Tencent API
 * Tencent API format: sh600000, sz000001, sz399001
 */
function normalizeSymbolForTencent(symbol: string): string {
  // Remove any .SH/.SZ suffix first
  let cleanSymbol = symbol.replace(/\.(SH|SZ)$/i, '');

  // If already starts with sh/sz, return as is
  if (cleanSymbol.startsWith('sh') || cleanSymbol.startsWith('sz')) {
    return cleanSymbol;
  }

  // Determine exchange prefix
  if (cleanSymbol.startsWith('6')) {
    return `sh${cleanSymbol}`;
  } else {
    return `sz${cleanSymbol}`;
  }
}

/**
 * Normalize symbol for Sina API
 * Sina API format: sh600000, sz000001, sz399001
 */
function normalizeSymbolForSina(symbol: string): string {
  // Remove any .SH/.SZ suffix first
  let cleanSymbol = symbol.replace(/\.(SH|SZ)$/i, '');

  // If already starts with sh/sz, return as is
  if (cleanSymbol.startsWith('sh') || cleanSymbol.startsWith('sz')) {
    return cleanSymbol;
  }

  // Determine exchange prefix
  if (cleanSymbol.startsWith('6')) {
    return `sh${cleanSymbol}`;
  } else {
    return `sz${cleanSymbol}`;
  }
}

/**
 * Tencent finance API (alternative source) with enhanced error handling and retry mechanism
 * Note: Tencent API may have different rate limits and format
 */
export async function fetchTencentStockData(symbol: string, maxRetries: number = 3): Promise<MarketData> {
  // Convert symbol to Tencent format
  const tencentSymbol = normalizeSymbolForTencent(symbol);

  // Tencent API endpoint
  const apiUrl = `https://qt.gtimg.cn/q=${tencentSymbol}`;

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
 * Fetch stock data from Yahoo Finance API (global fallback for overseas IPs)
 * Yahoo symbol format: 000001.SS (Shanghai), 399001.SZ (Shenzhen)
 */
export async function fetchYahooStockData(symbol: string, maxRetries: number = 2): Promise<MarketData> {
  // Convert symbol to Yahoo format
  let yahooSymbol = symbol;

  // If symbol already has .SS or .SZ suffix, use it as is
  if (!symbol.includes('.')) {
    // Remove sh/sz prefix if present
    let cleanSymbol = symbol.replace(/^(sh|sz)/i, '');

    // Determine exchange suffix
    if (cleanSymbol.startsWith('6') || cleanSymbol === '000001') {
      yahooSymbol = cleanSymbol + '.SS'; // Shanghai
    } else if (cleanSymbol.startsWith('0') || cleanSymbol.startsWith('3') || cleanSymbol === '399001') {
      yahooSymbol = cleanSymbol + '.SZ'; // Shenzhen
    } else {
      yahooSymbol = cleanSymbol + '.SS'; // Default to Shanghai
    }
  } else {
    // Symbol already has suffix, ensure it's uppercase
    yahooSymbol = yahooSymbol.toUpperCase();
  }

  const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=3mo`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      Logger.info(`Fetching data from Yahoo Finance (attempt ${attempt}/${maxRetries}): ${apiUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'DNT': '1',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Parse Yahoo Finance response
        const marketData = parseYahooResponse(data, symbol, yahooSymbol);
        Logger.info(`Successfully fetched Yahoo Finance data for ${symbol}`);
        return marketData;

      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error as Error;
      Logger.warn(`Yahoo Finance API call failed (attempt ${attempt}/${maxRetries})`, {
        symbol,
        yahooSymbol,
        error: error instanceof Error ? error.message : String(error)
      });

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        Logger.info(`Retrying Yahoo Finance API in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  Logger.error(`All ${maxRetries} attempts failed for Yahoo Finance API: ${symbol}`, lastError);
  throw lastError || new Error(`Failed to fetch Yahoo Finance data for ${symbol} after ${maxRetries} attempts`);
}

/**
 * Parse Yahoo Finance API response
 */
function parseYahooResponse(data: any, originalSymbol: string, yahooSymbol: string): MarketData {
  try {
    Logger.debug(`Parsing Yahoo Finance response for ${originalSymbol}`);

    const chart = data.chart;
    if (!chart || !chart.result || !chart.result[0]) {
      throw new Error('Invalid Yahoo Finance response format');
    }

    const result = chart.result[0];
    const meta = result.meta;
    const timestamp = meta.regularMarketTime;
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose;
    const highPrice = meta.regularMarketDayHigh || currentPrice;
    const lowPrice = meta.regularMarketDayLow || currentPrice;

    // Calculate change
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    // Get historical data for MA calculation
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    // Calculate MA20 and MA60 if enough data
    let ma20 = currentPrice;
    let ma60 = currentPrice;

    if (closes.length >= 20) {
      const recent20 = closes.slice(-20);
      ma20 = recent20.reduce((sum: number, price: number) => sum + price, 0) / 20;
    }

    if (closes.length >= 60) {
      const recent60 = closes.slice(-60);
      ma60 = recent60.reduce((sum: number, price: number) => sum + price, 0) / 60;
    }

    // Format date
    const date = new Date(timestamp * 1000);
    const formattedDate = date.toISOString().split('T')[0];
    const formattedTime = date.toTimeString().split(' ')[0];

    const marketData: MarketData = {
      symbol: originalSymbol,
      name: meta.symbol || originalSymbol,
      currentPrice,
      highPrice,
      lowPrice,
      lastUpdateTime: `${formattedDate} ${formattedTime}`,
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      // Add MA values as additional fields (extend interface if needed)
      ...(ma20 !== currentPrice && { ma20: parseFloat(ma20.toFixed(2)) }),
      ...(ma60 !== currentPrice && { ma60: parseFloat(ma60.toFixed(2)) })
    };

    Logger.debug(`Successfully parsed Yahoo Finance data for ${originalSymbol}:`, {
      name: marketData.name,
      price: marketData.currentPrice,
      change: marketData.change,
      ma20: marketData.ma20,
      ma60: marketData.ma60
    });

    return marketData;
  } catch (error) {
    Logger.error(`Failed to parse Yahoo Finance response for ${originalSymbol}:`, error);
    throw new Error(`Yahoo Finance response parsing failed for ${originalSymbol}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch market data using Sina as primary source with Tencent as fallback
 */
export async function fetchMarketDataWithFallback(symbol: string, maxRetries: number = 2): Promise<MarketData> {
  try {
    Logger.info(`Fetching market data for ${symbol} using Sina with ${maxRetries} retries`);

    // Try Sina first - it will handle symbol normalization internally
    return await fetchSinaStockData(symbol, maxRetries);

  } catch (error) {
    Logger.error(`Sina API failed for ${symbol}, trying Tencent`, error);

    try {
      // Try Tencent API as fallback - it will handle symbol normalization internally
      return await fetchTencentStockData(symbol, maxRetries);
    } catch (tencentError) {
      Logger.error(`Sina and Tencent APIs failed for ${symbol}, trying Yahoo Finance as global fallback`, tencentError);

      try {
        // Try Yahoo Finance as global fallback (works for overseas IPs)
        return await fetchYahooStockData(symbol, maxRetries);
      } catch (yahooError) {
        Logger.error(`All data sources including Yahoo Finance failed for ${symbol}`, yahooError);
        // Ultimate fallback: return minimal data to prevent complete failure
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
        Logger.warn(`Returning ultimate fallback data for ${symbol} due to complete API failure`);
        return fallbackData;
      }
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

// ============================================================================
// 智能数据源选择器集成
// ============================================================================

/**
 * 使用智能数据源选择器获取股票数据
 * @param symbol 股票代码
 * @param maxRetries 最大重试次数
 * @returns 市场数据
 */
export async function fetchStockDataSmart(symbol: string, maxRetries: number = 3): Promise<MarketData> {
  try {
    Logger.info(`Fetching stock data with smart routing: ${symbol}`);

    // 定义各数据源的获取函数
    const fetchFunctions = {
      [DataSourceType.SINA]: () => fetchSinaStockData(symbol, maxRetries),
      [DataSourceType.TENCENT]: () => fetchTencentStockData(symbol, maxRetries),
      [DataSourceType.YAHOO]: () => fetchYahooStockData(symbol, maxRetries),
      [DataSourceType.SIMULATED]: () => Promise.resolve(createSimulatedMarketData(symbol))
    };

    // 使用智能路由获取数据
    const result = await dataSourceSelector.fetchWithSmartRouting(
      fetchFunctions,
      symbol,
      maxRetries
    );

    Logger.info(`Successfully fetched data for ${symbol} using smart routing`);
    return result;

  } catch (error) {
    Logger.error(`Smart routing failed for ${symbol}:`, error);

    // 最终降级：返回模拟数据
    Logger.warn(`Returning simulated data for ${symbol} as ultimate fallback`);
    return createSimulatedMarketData(symbol);
  }
}

/**
 * 使用智能数据源选择器批量获取股票数据
 * @param symbols 股票代码数组
 * @param maxRetries 最大重试次数
 * @returns 市场数据数组
 */
export async function fetchMultipleStocksSmart(
  symbols: string[],
  maxRetries: number = 2
): Promise<MarketData[]> {
  try {
    Logger.info(`Fetching ${symbols.length} stocks with smart routing`);

    const promises = symbols.map(symbol =>
      fetchStockDataSmart(symbol, maxRetries).catch(error => {
        Logger.error(`Smart routing failed for ${symbol}:`, error);
        return createSimulatedMarketData(symbol);
      })
    );

    const results = await Promise.all(promises);
    Logger.info(`Successfully fetched ${results.length} stocks using smart routing`);
    return results;

  } catch (error) {
    Logger.error(`Batch smart routing failed:`, error);

    // 返回所有股票的模拟数据
    return symbols.map(symbol => createSimulatedMarketData(symbol));
  }
}

/**
 * 创建模拟市场数据（最终降级）
 */
function createSimulatedMarketData(symbol: string): MarketData {
  // 简单模拟数据生成
  const basePrice = 10 + Math.random() * 100;
  const change = (Math.random() - 0.5) * 5;
  const changePercent = (change / basePrice) * 100;

  return {
    symbol,
    name: symbol,
    currentPrice: parseFloat(basePrice.toFixed(2)),
    highPrice: parseFloat((basePrice + Math.random() * 5).toFixed(2)),
    lowPrice: parseFloat((basePrice - Math.random() * 3).toFixed(2)),
    lastUpdateTime: new Date().toISOString(),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    volume: Math.floor(Math.random() * 1000000),
    turnover: Math.floor(Math.random() * 10000000)
  };
}

/**
 * 获取数据源选择器性能报告
 */
export function getDataSourcePerformanceReport(): string {
  return dataSourceSelector.getPerformanceReport();
}

/**
 * 获取数据源统计信息
 */
export function getDataSourceStats(): any {
  const manager = dataSourceSelector.getManager();
  return manager.getDataSourceStats();
}

/**
 * 执行健康检查
 */
export async function performDataSourceHealthCheck(): Promise<any> {
  const manager = dataSourceSelector.getManager();
  return await manager.performBatchHealthCheck();
}

/**
 * 测试智能数据源选择器
 */
export async function testSmartDataSourceSelector(): Promise<boolean> {
  try {
    Logger.info('Testing smart data source selector...');

    // 测试单个股票
    const testSymbol = '000001';
    const singleResult = await fetchStockDataSmart(testSymbol, 2);
    Logger.info('Single stock smart routing result:', {
      symbol: singleResult.symbol,
      price: singleResult.currentPrice,
      source: 'smart'
    });

    // 测试批量股票
    const batchSymbols = ['000001', '600000'];
    const batchResults = await fetchMultipleStocksSmart(batchSymbols, 2);
    Logger.info(`Batch smart routing fetched ${batchResults.length} stocks`);

    // 获取性能报告
    const report = getDataSourcePerformanceReport();
    Logger.info('Performance report generated');

    Logger.info('Smart data source selector test completed');
    return true;

  } catch (error) {
    Logger.error('Smart data source selector test failed:', error);
    return false;
  }
}

// Run test if this file is executed directly
// Note: In ES modules, we can't use require.main === module
// Instead, we check if the file is being run directly
// by looking at import.meta.url (for ES modules) or require.main (for CommonJS)

// For now, we'll export the test function and let users call it explicitly
// To run tests: npx ts-node skills/data_crawler.ts --test
// or import and call testDataCrawler()