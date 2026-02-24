/**
 * Alpha-Quant-Copilot DeepSeek AI Agent
 * 核心推理引擎：读取策略规则 + 市场数据 + 新闻分析 → AI交易决策
 * 版本 2.0：集成新闻摘要、技术面分析、数据库存储
 */

import * as fs from 'fs';
import * as path from 'path';
import { MarketData, fetchMarketDataWithFallback, fetchMultipleStocks } from './data_crawler';
import { NewsItem, fetchNewsFromMultipleSources, analyzeNewsSummary } from './news_crawler';
import { prisma } from '../lib/db';

// DeepSeek API配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat'; // 或 deepseek-r1, deepseek-v3

// 日志工具
class Logger {
  static info(message: string, data?: any) {
    console.log(`[DEEPSEEK-AGENT INFO] ${new Date().toISOString()} - ${message}`, data || '');
  }

  static error(message: string, error?: any) {
    console.error(`[DEEPSEEK-AGENT ERROR] ${new Date().toISOString()} - ${message}`, error || '');
  }

  static warn(message: string, data?: any) {
    console.warn(`[DEEPSEEK-AGENT WARN] ${new Date().toISOString()} - ${message}`, data || '');
  }
}

// 智能情报接口（符合数据库模型）
export interface IntelligenceFeedData {
  event_summary: string;
  industry_trend: string;
  trap_probability: number; // 0-100
  action_signal: 'BUY' | 'SELL' | 'HOLD';
  target_price: number | null;
  stop_loss: number | null;
  logic_chain: any; // JSON格式的逻辑链
  raw_data?: any; // 原始数据
  stock_code: string;
  stock_name: string;
}

// 扩展的策略上下文
export interface EnhancedStrategyContext {
  currentPortfolio: {
    [symbol: string]: {
      quantity: number;
      avgPrice: number;
      currentValue: number;
      unrealizedPnl: number;
    }
  };
  marketCondition: {
    trend: 'bullish' | 'bearish' | 'sideways';
    volatility: 'low' | 'medium' | 'high';
    liquidity: '充足' | '一般' | '紧张';
  };
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  availableCapital: number;
  userId?: string; // 用户ID（用于数据库关联）
  newsAnalysis?: {
    overallSentiment: 'positive' | 'negative' | 'neutral';
    keyThemes: string[];
    highImpactNews: NewsItem[];
    stockImpact: Record<string, { count: number; sentiment: string }>;
  };
  technicalIndicators?: {
    [symbol: string]: {
      ma60: number; // 60日移动平均线
      md60: number; // 60日动量方向
      rsi?: number; // 相对强弱指数
      macd?: { diff: number; signal: number; histogram: number }; // MACD指标
      volumeRatio?: number; // 成交量比率
    }
  };
}

// 交易决策接口（向后兼容）
export interface TradingDecision {
  action: 'buy' | 'sell' | 'hold';
  target_price: number;
  stop_loss: number;
  reasoning: string;
  confidence: number; // 0-100
  position_size?: number; // 仓位比例 0-100%
  time_horizon?: string; // 持有期限：短期/中期/长期
  risk_level?: 'low' | 'medium' | 'high';
}

// 策略上下文（向后兼容）
export interface StrategyContext {
  currentPortfolio: {
    [symbol: string]: {
      quantity: number;
      avgPrice: number;
      currentValue: number;
      unrealizedPnl: number;
    }
  };
  marketCondition: {
    trend: 'bullish' | 'bearish' | 'sideways';
    volatility: 'low' | 'medium' | 'high';
    liquidity: '充足' | '一般' | '紧张';
  };
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  availableCapital: number;
  userId?: string; // 用户ID（用于数据库关联）
}

/**
 * 读取CLAUDE.md策略文档
 */
export function readStrategyDocument(): string {
  try {
    const strategyPath = path.join(process.cwd(), 'CLAUDE.md');
    const content = fs.readFileSync(strategyPath, 'utf-8');
    Logger.info('策略文档读取成功', { length: content.length });
    return content;
  } catch (error) {
    Logger.error('读取策略文档失败:', error);
    return '# 策略文档读取失败\n请确保CLAUDE.md文件存在';
  }
}

/**
 * 获取新闻摘要和分析
 */
export async function fetchAndAnalyzeNews(keywords: string[] = []): Promise<{
  overallSentiment: 'positive' | 'negative' | 'neutral';
  keyThemes: string[];
  highImpactNews: NewsItem[];
  stockImpact: Record<string, { count: number; sentiment: string }>;
}> {
  try {
    Logger.info('开始获取新闻数据...', { keywords });

    // 从多个来源获取新闻
    const newsItems = await fetchNewsFromMultipleSources(keywords, ['sina', 'eastmoney']);
    Logger.info(`获取到 ${newsItems.length} 条新闻`);

    // 分析新闻摘要
    const analysis = analyzeNewsSummary(newsItems);
    Logger.info('新闻分析完成', {
      overallSentiment: analysis.overallSentiment,
      keyThemesCount: analysis.keyThemes.length,
      highImpactNewsCount: analysis.highImpactNews.length
    });

    return analysis;
  } catch (error) {
    Logger.error('获取或分析新闻失败:', error);
    return {
      overallSentiment: 'neutral',
      keyThemes: [],
      highImpactNews: [],
      stockImpact: {}
    };
  }
}

/**
 * 计算技术指标
 * 注意：此函数需要历史数据来计算真实的技术指标
 * 当前版本返回占位符值，实际应用中应从历史K线数据计算
 */
export function calculateTechnicalIndicators(
  marketData: MarketData[],
  historicalData?: any[]
): Record<string, any> {
  const indicators: Record<string, any> = {};

  for (const stock of marketData) {
    const currentPrice = stock.currentPrice;

    // 如果没有历史数据，返回占位符值并记录警告
    if (!historicalData || historicalData.length === 0) {
      Logger.warn(`缺少历史数据，无法为 ${stock.symbol} 计算真实技术指标`);

      indicators[stock.symbol] = {
        ma60: null,
        md60: null,
        rsi: null,
        macd: null,
        volumeRatio: stock.volume ? stock.volume / 1000000 : null,
        note: '需要历史数据来计算真实技术指标'
      };
      continue;
    }

    // TODO: 实现真实的技术指标计算逻辑
    // 这里应该从historicalData中提取该股票的历史价格数据
    // 计算真实的MA60、MD60、RSI、MACD等指标

    // 临时占位符
    indicators[stock.symbol] = {
      ma60: null,
      md60: null,
      rsi: null,
      macd: null,
      volumeRatio: stock.volume ? stock.volume / 1000000 : null,
      note: '技术指标计算功能待实现，需要历史K线数据'
    };
  }

  Logger.info('技术指标计算完成', {
    stocks: Object.keys(indicators).length,
    note: '当前为占位符实现，需要历史数据来计算真实指标'
  });
  return indicators;
}

/**
 * 构建增强版AI提示词（集成新闻和技术面分析）
 */
function buildEnhancedPrompt(
  strategyRules: string,
  marketData: MarketData[],
  context: EnhancedStrategyContext
): string {
  const currentTime = new Date().toISOString();

  // 格式化市场数据
  const marketDataStr = marketData.map(stock => {
    const indicators = context.technicalIndicators?.[stock.symbol] || {};
    return `
股票: ${stock.name} (${stock.symbol})
当前价格: ${stock.currentPrice}
最高价: ${stock.highPrice}
最低价: ${stock.lowPrice}
涨跌: ${stock.change} (${stock.changePercent}%)
更新时间: ${stock.lastUpdateTime}
成交量: ${stock.volume ? (stock.volume / 10000).toFixed(2) + '万手' : 'N/A'}
成交额: ${stock.turnover ? (stock.turnover / 100000000).toFixed(2) + '亿元' : 'N/A'}
技术指标:
  - MA60: ${indicators.ma60 || 'N/A'}
  - MD60: ${indicators.md60 ? indicators.md60.toFixed(2) + '%' : 'N/A'}
  - RSI: ${indicators.rsi || 'N/A'}
  - MACD: ${indicators.macd && typeof indicators.macd === 'object' && 'diff' in indicators.macd && 'signal' in indicators.macd ? `DIFF=${(indicators.macd as any).diff.toFixed(3)}, SIGNAL=${(indicators.macd as any).signal.toFixed(3)}` : 'N/A'}
`;
  }).join('\n');

  // 格式化投资组合
  const portfolioStr = Object.entries(context.currentPortfolio)
    .map(([symbol, position]) => `
${symbol}: ${position.quantity}股 @均价${position.avgPrice}
当前价值: ${position.currentValue.toFixed(2)}
浮动盈亏: ${position.unrealizedPnl.toFixed(2)} (${((position.unrealizedPnl / (position.quantity * position.avgPrice)) * 100).toFixed(2)}%)
`)
    .join('\n') || '无持仓';

  // 格式化新闻分析
  let newsAnalysisStr = '无新闻分析数据';
  if (context.newsAnalysis) {
    const { overallSentiment, keyThemes, highImpactNews, stockImpact } = context.newsAnalysis;
    newsAnalysisStr = `
总体市场情绪: ${overallSentiment}
关键主题: ${keyThemes.slice(0, 5).join(', ')}${keyThemes.length > 5 ? '...' : ''}
高影响新闻数量: ${highImpactNews.length}
相关股票影响: ${Object.entries(stockImpact)
      .slice(0, 5)
      .map(([stock, data]) => `${stock}: ${data.count}条新闻 (${data.sentiment})`)
      .join(', ')}${Object.keys(stockImpact).length > 5 ? '...' : ''}
`;
  }

  // 提取策略文档中的反人性破解器模块
  const antiHumanityRules = extractAntiHumanityRules(strategyRules);

  return `# Alpha-Quant-Copilot 增强版交易决策请求
时间: ${currentTime}

## 一、核心策略规则（必须严格遵守）
${strategyRules}

## 二、反人性破解器模块（特别重要！）
${antiHumanityRules}

## 三、当前市场数据
${marketDataStr}

## 四、新闻分析
${newsAnalysisStr}

## 五、投资组合现状
${portfolioStr}

## 六、市场环境
- 趋势: ${context.marketCondition.trend}
- 波动率: ${context.marketCondition.volatility}
- 流动性: ${context.marketCondition.liquidity}
- 风险偏好: ${context.riskTolerance}
- 可用资金: ${context.availableCapital.toFixed(2)}

## 七、决策要求

### 硬性约束（不可违反）：
1. MA60纪律：任何持仓必须遵守MA60破位止损规则
2. MD60纪律：必须尊重60日动量方向
3. 仓位控制：单只股票不超过总资金的20%
4. 风险控制：最大回撤不超过总资金的5%
5. 反人性破解器：必须识别并规避诱多、洗盘、龙头衰竭等模式

### 分析框架（按优先级）：
1. **宏观对冲（找预期差）**：经济周期定位，政策预期差，流动性拐点
2. **价值防守（拒绝泡沫）**：财务健康度筛选，估值安全边际，护城河验证
3. **游资情绪接力**：情绪周期定位，资金流向监控，题材热度评估
4. **事件驱动分析**：事件分类，产业链推演，预期差计算
5. **反人性破解器**：诱多模型识别，洗盘模型识别，龙头衰竭识别

### 输出格式要求（必须严格遵循JSON格式）：
{
  "event_summary": "事件摘要（基于新闻分析）",
  "industry_trend": "行业趋势分析",
  "trap_probability": 0-100, // 陷阱概率，基于反人性破解器分析
  "action_signal": "BUY|SELL|HOLD",
  "target_price": number | null,
  "stop_loss": number | null,
  "logic_chain": {
    "macro_analysis": "宏观分析结论",
    "value_assessment": "价值评估结论",
    "sentiment_analysis": "情绪分析结论",
    "event_impact": "事件影响分析",
    "anti_humanity_check": "反人性破解器检查结果",
    "risk_assessment": "风险评估"
  }
}

### 特别提醒：
1. 必须严格遵循CLAUDE.md中的反人性破解器规则
2. 如果trap_probability > 50，必须选择"HOLD"或"SELL"
3. 所有分析必须基于数据和具体规则，不能主观臆断
4. 逻辑链必须详细，引用具体规则条款
5. 对于BUY/SELL信号，必须提供具体的target_price和stop_loss

请基于以上信息，为每只股票生成独立的智能情报分析。`;
}

/**
 * 提取策略文档中的反人性破解器模块
 */
function extractAntiHumanityRules(strategyRules: string): string {
  const lines = strategyRules.split('\n');
  let inAntiHumanitySection = false;
  let antiHumanityRules = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('模块B：反人性破解器') || line.includes('反人性破解器')) {
      inAntiHumanitySection = true;
    }

    if (inAntiHumanitySection) {
      antiHumanityRules += line + '\n';

      // 如果遇到下一个主要模块，停止提取
      if (i < lines.length - 1 && lines[i + 1].includes('## ') && !lines[i + 1].includes('反人性破解器')) {
        break;
      }
    }
  }

  return antiHumanityRules || '未找到反人性破解器模块，请确保CLAUDE.md文件包含该模块';
}

/**
 * 调用DeepSeek API
 */
async function callDeepSeekAPI(
  prompt: string,
  apiKey: string,
  isEnhanced: boolean = false,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      Logger.info(`调用DeepSeek API (尝试 ${attempt}/${maxRetries})...`);

      const systemPrompt = isEnhanced
        ? `你是一个严格遵守量化交易规则的AI交易员。你必须：
1. 严格遵循提供的策略规则，特别是反人性破解器模块
2. 输出必须为有效的JSON格式
3. 所有决策必须有明确的数据支持
4. 风险控制优先于收益追求
5. 必须识别并规避市场陷阱
6. 所有分析必须基于具体规则条款`
        : '你是一个严格遵守量化交易规则的AI交易员。你必须：1. 严格遵循提供的策略规则 2. 输出必须为有效的JSON格式 3. 所有决策必须有明确的数据支持 4. 风险控制优先于收益追求';

      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2, // 更低的温度确保一致性
          max_tokens: 3000,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API错误 (${response.status}): ${response.statusText}. 响应: ${errorText}`);
      }

      const data = await response.json() as any;

      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error('DeepSeek API返回了无效的响应格式');
      }

      const content = data.choices[0].message.content;
      Logger.info(`DeepSeek API调用成功 (尝试 ${attempt})`, { contentLength: content.length });
      return content;

    } catch (error: any) {
      lastError = error;
      Logger.warn(`DeepSeek API调用失败 (尝试 ${attempt}/${maxRetries}):`, error.message);

      // 如果不是最后一次尝试，等待一段时间后重试
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 指数退避，最大10秒
        Logger.info(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 所有重试都失败
  Logger.error('DeepSeek API调用失败，所有重试均未成功');
  throw lastError || new Error('DeepSeek API调用失败');
}

/**
 * 验证决策格式
 */
function validateDecision(decision: any): TradingDecision {
  // 基本字段验证
  const requiredFields = ['action', 'target_price', 'stop_loss', 'reasoning', 'confidence'];
  for (const field of requiredFields) {
    if (!(field in decision)) {
      throw new Error(`决策缺少必要字段: ${field}`);
    }
  }

  // 动作验证
  if (!['buy', 'sell', 'hold'].includes(decision.action)) {
    throw new Error(`无效的action: ${decision.action}`);
  }

  // 价格验证
  if (typeof decision.target_price !== 'number') {
    throw new Error(`无效的target_price: ${decision.target_price}`);
  }

  if (typeof decision.stop_loss !== 'number') {
    throw new Error(`无效的stop_loss: ${decision.stop_loss}`);
  }

  // 对于hold操作，允许价格为0（表示不适用）
  if (decision.action !== 'hold') {
    if (decision.target_price <= 0) {
      throw new Error(`无效的target_price: ${decision.target_price} (非hold操作必须>0)`);
    }
    if (decision.stop_loss <= 0) {
      throw new Error(`无效的stop_loss: ${decision.stop_loss} (非hold操作必须>0)`);
    }
  }

  // 信心分数验证
  if (typeof decision.confidence !== 'number' || decision.confidence < 0 || decision.confidence > 100) {
    throw new Error(`无效的confidence: ${decision.confidence}`);
  }

  // 仓位大小验证（如果提供）
  if (decision.position_size !== undefined) {
    if (typeof decision.position_size !== 'number' || decision.position_size < 0 || decision.position_size > 100) {
      throw new Error(`无效的position_size: ${decision.position_size}`);
    }
  }

  // 时间期限验证（如果提供）
  if (decision.time_horizon !== undefined) {
    if (!['short', 'medium', 'long'].includes(decision.time_horizon)) {
      throw new Error(`无效的time_horizon: ${decision.time_horizon}`);
    }
  }

  // 风险等级验证（如果提供）
  if (decision.risk_level !== undefined) {
    if (!['low', 'medium', 'high'].includes(decision.risk_level)) {
      throw new Error(`无效的risk_level: ${decision.risk_level}`);
    }
  }

  return decision as TradingDecision;
}

/**
 * 验证智能情报数据格式
 */
function validateIntelligenceFeedData(data: any, stockCode: string, stockName: string): IntelligenceFeedData {
  // 基本字段验证
  const requiredFields = ['event_summary', 'industry_trend', 'trap_probability', 'action_signal'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`智能情报数据缺少必要字段: ${field}`);
    }
  }

  // 陷阱概率验证
  if (typeof data.trap_probability !== 'number' || data.trap_probability < 0 || data.trap_probability > 100) {
    throw new Error(`无效的trap_probability: ${data.trap_probability} (必须是0-100之间的数字)`);
  }

  // 行动信号验证
  if (!['BUY', 'SELL', 'HOLD'].includes(data.action_signal)) {
    throw new Error(`无效的action_signal: ${data.action_signal}`);
  }

  // 价格验证（对于BUY/SELL信号）
  if (data.action_signal !== 'HOLD') {
    if (data.target_price === null || data.target_price === undefined) {
      throw new Error(`BUY/SELL信号必须提供target_price`);
    }
    if (data.stop_loss === null || data.stop_loss === undefined) {
      throw new Error(`BUY/SELL信号必须提供stop_loss`);
    }
    if (typeof data.target_price !== 'number' || data.target_price <= 0) {
      throw new Error(`无效的target_price: ${data.target_price}`);
    }
    if (typeof data.stop_loss !== 'number' || data.stop_loss <= 0) {
      throw new Error(`无效的stop_loss: ${data.stop_loss}`);
    }
  }

  // 逻辑链验证
  if (!data.logic_chain || typeof data.logic_chain !== 'object') {
    throw new Error(`无效的logic_chain: 必须是JSON对象`);
  }

  return {
    ...data,
    stock_code: stockCode,
    stock_name: stockName,
    target_price: data.target_price !== null && data.target_price !== undefined ? data.target_price : null,
    stop_loss: data.stop_loss !== null && data.stop_loss !== undefined ? data.stop_loss : null,
    logic_chain: data.logic_chain || {},
    raw_data: data.raw_data || {}
  };
}

/**
 * 数据库存储功能
 */
export class IntelligenceFeedStorage {
  private prisma;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * 保存智能情报数据到数据库
   */
  async saveIntelligenceFeed(
    data: IntelligenceFeedData,
    userId?: string
  ): Promise<boolean> {
    try {
      Logger.info('保存智能情报数据到数据库', {
        stockCode: data.stock_code,
        actionSignal: data.action_signal,
        userId
      });

      await this.prisma.intelligenceFeed.create({
        data: {
          userId: userId || null,
          stockCode: data.stock_code,
          stockName: data.stock_name,
          eventSummary: data.event_summary,
          industryTrend: data.industry_trend,
          trapProbability: data.trap_probability,
          actionSignal: data.action_signal,
          targetPrice: data.target_price !== null ? data.target_price : null,
          stopLoss: data.stop_loss !== null ? data.stop_loss : null,
          logicChain: data.logic_chain,
          rawData: data.raw_data || {}
        }
      });

      Logger.info('智能情报数据保存成功');
      return true;
    } catch (error) {
      Logger.error('保存智能情报数据失败:', error);
      return false;
    }
  }

  /**
   * 批量保存智能情报数据
   */
  async saveMultipleIntelligenceFeeds(
    feeds: IntelligenceFeedData[],
    userId?: string
  ): Promise<number> {
    try {
      Logger.info(`批量保存智能情报数据，数量: ${feeds.length}`);

      const savedCount = await this.prisma.$transaction(async (tx) => {
        let count = 0;
        for (const feed of feeds) {
          await tx.intelligenceFeed.create({
            data: {
              userId: userId || null,
              stockCode: feed.stock_code,
              stockName: feed.stock_name,
              eventSummary: feed.event_summary,
              industryTrend: feed.industry_trend,
              trapProbability: feed.trap_probability,
              actionSignal: feed.action_signal,
              targetPrice: feed.target_price !== null ? feed.target_price : null,
              stopLoss: feed.stop_loss !== null ? feed.stop_loss : null,
              logicChain: feed.logic_chain,
              rawData: feed.raw_data || {}
            }
          });
          count++;
        }
        return count;
      });

      Logger.info(`批量保存完成，成功保存 ${savedCount} 条记录`);
      return savedCount;
    } catch (error) {
      Logger.error('批量保存智能情报数据失败:', error);
      return 0;
    }
  }

  /**
   * 获取用户的智能情报历史
   */
  async getUserIntelligenceFeeds(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const feeds = await this.prisma.intelligenceFeed.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      Logger.info(`获取用户智能情报历史，用户ID: ${userId}, 数量: ${feeds.length}`);
      return feeds;
    } catch (error) {
      Logger.error('获取用户智能情报历史失败:', error);
      return [];
    }
  }

  /**
   * 关闭数据库连接
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

/**
 * 主函数：生成交易决策（向后兼容）
 */
export async function generateTradingDecision(
  marketData: MarketData[],
  context: StrategyContext,
  apiKey: string
): Promise<{ [symbol: string]: TradingDecision }> {
  try {
    Logger.info('开始生成交易决策...');

    // 1. 读取策略规则
    const strategyRules = readStrategyDocument();
    Logger.info('策略规则读取完成', { length: strategyRules.length });

    // 2. 构建提示词
    const prompt = buildEnhancedPrompt(strategyRules, marketData, {
      ...context,
      newsAnalysis: undefined,
      technicalIndicators: undefined
    });
    Logger.info('提示词构建完成', { length: prompt.length });

    // 3. 调用DeepSeek API
    Logger.info('调用DeepSeek API...');
    const aiResponse = await callDeepSeekAPI(prompt, apiKey, false);
    Logger.info('DeepSeek API响应接收', { length: aiResponse.length });

    // 4. 解析响应
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
      Logger.info('解析AI响应成功');
    } catch (error) {
      Logger.error('解析JSON响应失败:', error);
      Logger.error('原始响应:', aiResponse);
      throw new Error('AI响应不是有效的JSON格式');
    }

    // 5. 验证决策格式
    const decisions: { [symbol: string]: TradingDecision } = {};

    // 如果是单个决策
    if (parsedResponse.action) {
      const decision = validateDecision(parsedResponse);
      // 默认关联到第一个股票
      if (marketData.length > 0) {
        decisions[marketData[0].symbol] = decision;
      }
    }
    // 如果是多个决策的数组
    else if (Array.isArray(parsedResponse)) {
      for (const item of parsedResponse) {
        if (item.symbol && item.decision) {
          const decision = validateDecision(item.decision);
          decisions[item.symbol] = decision;
        }
      }
    }
    // 如果是按symbol索引的对象
    else {
      for (const [symbol, decision] of Object.entries(parsedResponse)) {
        if (typeof decision === 'object' && decision !== null) {
          const validatedDecision = validateDecision(decision);
          decisions[symbol] = validatedDecision;
        }
      }
    }

    Logger.info(`成功生成 ${Object.keys(decisions).length} 个交易决策`);
    return decisions;

  } catch (error) {
    Logger.error('生成交易决策失败:', error);
    throw error;
  }
}

/**
 * 生成增强版智能情报分析（集成新闻和技术面分析）
 */
export async function generateEnhancedIntelligenceAnalysis(
  marketData: MarketData[],
  context: EnhancedStrategyContext,
  apiKey: string
): Promise<{ [symbol: string]: IntelligenceFeedData }> {
  try {
    Logger.info('开始生成增强版智能情报分析...');

    // 1. 读取策略规则
    const strategyRules = readStrategyDocument();
    Logger.info('策略规则读取完成', { length: strategyRules.length });

    // 2. 获取新闻分析（如果未提供）
    let newsAnalysis = context.newsAnalysis;
    if (!newsAnalysis) {
      Logger.info('开始获取新闻分析...');
      const keywords = marketData.map(stock => stock.name).slice(0, 5);
      newsAnalysis = await fetchAndAnalyzeNews(keywords);
      Logger.info('新闻分析获取完成', {
        overallSentiment: newsAnalysis.overallSentiment,
        keyThemesCount: newsAnalysis.keyThemes.length
      });
    }

    // 3. 计算技术指标（如果未提供）
    let technicalIndicators = context.technicalIndicators;
    if (!technicalIndicators) {
      Logger.info('开始计算技术指标...');
      technicalIndicators = calculateTechnicalIndicators(marketData);
      Logger.info('技术指标计算完成', { stocks: Object.keys(technicalIndicators).length });
    }

    // 4. 构建增强版上下文
    const enhancedContext: EnhancedStrategyContext = {
      ...context,
      newsAnalysis,
      technicalIndicators
    };

    // 5. 构建增强版提示词
    const prompt = buildEnhancedPrompt(strategyRules, marketData, enhancedContext);
    Logger.info('增强版提示词构建完成', { length: prompt.length });

    // 6. 调用DeepSeek API
    Logger.info('调用DeepSeek API（增强版）...');
    const aiResponse = await callDeepSeekAPI(prompt, apiKey, true);
    Logger.info('DeepSeek API响应接收', { length: aiResponse.length });

    // 7. 解析响应
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
      Logger.info('解析AI响应成功');
    } catch (error) {
      Logger.error('解析JSON响应失败:', error);
      Logger.error('原始响应:', aiResponse);
      throw new Error('AI响应不是有效的JSON格式');
    }

    // 8. 验证并处理智能情报数据
    const intelligenceFeeds: { [symbol: string]: IntelligenceFeedData } = {};

    // 如果是单个智能情报
    if (parsedResponse.event_summary) {
      // 查找对应的股票
      const targetStock = marketData[0];
      if (targetStock) {
        const validatedData = validateIntelligenceFeedData(
          parsedResponse,
          targetStock.symbol,
          targetStock.name
        );
        intelligenceFeeds[targetStock.symbol] = validatedData;
      }
    }
    // 如果是多个智能情报的数组
    else if (Array.isArray(parsedResponse)) {
      for (const item of parsedResponse) {
        if (item.stock_code && item.event_summary) {
          const stock = marketData.find(s => s.symbol === item.stock_code);
          if (stock) {
            const validatedData = validateIntelligenceFeedData(
              item,
              stock.symbol,
              stock.name
            );
            intelligenceFeeds[stock.symbol] = validatedData;
          }
        }
      }
    }
    // 如果是按symbol索引的对象
    else {
      for (const [symbol, data] of Object.entries(parsedResponse)) {
        if (typeof data === 'object' && data !== null) {
          const stock = marketData.find(s => s.symbol === symbol);
          if (stock) {
            const validatedData = validateIntelligenceFeedData(
              data,
              stock.symbol,
              stock.name
            );
            intelligenceFeeds[symbol] = validatedData;
          }
        }
      }
    }

    // 9. 如果没有生成任何智能情报，抛出错误而不是使用默认分析
    if (Object.keys(intelligenceFeeds).length === 0 && marketData.length > 0) {
      throw new Error('AI未生成有效的智能情报分析。请检查：1) API密钥是否正确 2) 网络连接 3) AI响应格式');
    }

    Logger.info(`成功生成 ${Object.keys(intelligenceFeeds).length} 个智能情报分析`);
    return intelligenceFeeds;

  } catch (error) {
    Logger.error('生成增强版智能情报分析失败:', error);
    throw error;
  }
}

/**
 * 完整流程：获取数据 → 分析 → 存储
 */
export async function runCompleteIntelligencePipeline(
  stockSymbols: string[],
  userId?: string,
  apiKey?: string
): Promise<{
  success: boolean;
  feeds: IntelligenceFeedData[];
  savedCount: number;
  error?: string;
}> {
  try {
    Logger.info('开始完整智能情报流水线', { stockSymbols, userId });

    // 1. 获取市场数据
    Logger.info('获取市场数据...');
    const marketData = await fetchMultipleStocks(stockSymbols);
    if (marketData.length === 0) {
      throw new Error('无法获取市场数据');
    }
    Logger.info(`获取到 ${marketData.length} 只股票的市场数据`);

    // 2. 创建默认上下文
    const context: EnhancedStrategyContext = {
      currentPortfolio: {},
      marketCondition: {
        trend: 'sideways',
        volatility: 'medium',
        liquidity: '充足'
      },
      riskTolerance: 'moderate',
      availableCapital: 100000,
      userId
    };

    // 3. 获取API密钥
    const deepseekApiKey = apiKey || process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      throw new Error('未设置DeepSeek API密钥。请设置环境变量 DEEPSEEK_API_KEY');
    }

    // 4. 生成智能情报分析
    Logger.info('生成智能情报分析...');
    const intelligenceFeeds = await generateEnhancedIntelligenceAnalysis(
      marketData,
      context,
      deepseekApiKey
    );

    // 5. 转换为数组
    const feedsArray = Object.values(intelligenceFeeds);

    // 6. 存储到数据库
    let savedCount = 0;
    if (feedsArray.length > 0) {
      Logger.info('存储智能情报数据到数据库...');
      const storage = new IntelligenceFeedStorage();
      savedCount = await storage.saveMultipleIntelligenceFeeds(feedsArray, userId);
      await storage.disconnect();
    }

    Logger.info('完整智能情报流水线完成', {
      feedsCount: feedsArray.length,
      savedCount
    });

    return {
      success: true,
      feeds: feedsArray,
      savedCount
    };

  } catch (error: any) {
    Logger.error('完整智能情报流水线失败:', error);
    return {
      success: false,
      feeds: [],
      savedCount: 0,
      error: error.message
    };
  }
}

/**
 * 模拟策略上下文（用于测试）
 */
export function createMockContext(): StrategyContext {
  return {
    currentPortfolio: {
      '000001': {
        quantity: 1000,
        avgPrice: 10.50,
        currentValue: 10960, // 10.96 * 1000
        unrealizedPnl: 460 // (10.96 - 10.50) * 1000
      }
    },
    marketCondition: {
      trend: 'sideways',
      volatility: 'medium',
      liquidity: '充足'
    },
    riskTolerance: 'moderate',
    availableCapital: 100000
  };
}

/**
 * 创建增强版模拟上下文
 */
export function createEnhancedMockContext(): EnhancedStrategyContext {
  return {
    currentPortfolio: {
      '000001': {
        quantity: 1000,
        avgPrice: 10.50,
        currentValue: 10960,
        unrealizedPnl: 460
      }
    },
    marketCondition: {
      trend: 'sideways',
      volatility: 'medium',
      liquidity: '充足'
    },
    riskTolerance: 'moderate',
    availableCapital: 100000,
    newsAnalysis: {
      overallSentiment: 'neutral',
      keyThemes: ['A股', '市场', '投资', '财经', '政策'],
      highImpactNews: [],
      stockImpact: {
        '000001': { count: 3, sentiment: 'neutral' },
        '600000': { count: 2, sentiment: 'positive' }
      }
    },
    technicalIndicators: {
      '000001': {
        ma60: 10.80,
        md60: 1.48,
        rsi: 55.3,
        macd: { diff: 0.12, signal: 0.08, histogram: 0.04 },
        volumeRatio: 1.2
      }
    }
  };
}

/**
 * 测试函数
 */
async function testDeepSeekAgent() {
  try {
    console.log('测试DeepSeek代理...');

    // 检查API密钥
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error('错误：未设置DeepSeek API密钥');
      console.log('请设置环境变量 DEEPSEEK_API_KEY');
      console.log('获取API密钥：https://platform.deepseek.com/api_keys');
      console.log('或在.env.local文件中添加：DEEPSEEK_API_KEY=your_api_key_here');
      return {};
    }

    // 使用真实API
    console.log('使用真实DeepSeek API...');

    // 模拟市场数据
    const mockMarketData: MarketData[] = [
      {
        symbol: '000001',
        name: '平安银行',
        currentPrice: 10.96,
        highPrice: 10.91,
        lowPrice: 10.99,
        lastUpdateTime: '2026-02-13 15:00:00',
        change: 0,
        changePercent: 0
      }
    ];

    const context = createMockContext();
    const decisions = await generateTradingDecision(mockMarketData, context, apiKey);

    console.log('生成的决策:', decisions);
    return decisions;

  } catch (error) {
    console.error('DeepSeek代理测试失败:', error);
    return {};
  }
}

/**
 * 测试增强版智能情报分析
 */
export async function testEnhancedIntelligenceAnalysis(): Promise<{
  success: boolean;
  feeds: IntelligenceFeedData[];
  error?: string;
}> {
  try {
    Logger.info('测试增强版智能情报分析...');

    // 检查API密钥
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      Logger.error('错误：未设置DeepSeek API密钥');
      Logger.info('请设置环境变量 DEEPSEEK_API_KEY');
      Logger.info('获取API密钥：https://platform.deepseek.com/api_keys');
      Logger.info('或在.env.local文件中添加：DEEPSEEK_API_KEY=your_api_key_here');
      return {
        success: false,
        feeds: [],
        error: '未设置DeepSeek API密钥'
      };
    }

    // 使用真实API
    Logger.info('使用真实DeepSeek API进行增强版分析...');

    // 模拟市场数据
    const mockMarketData: MarketData[] = [
      {
        symbol: '000001',
        name: '平安银行',
        currentPrice: 10.96,
        highPrice: 10.91,
        lowPrice: 10.99,
        lastUpdateTime: '2026-02-13 15:00:00',
        change: 0,
        changePercent: 0,
        volume: 1000000,
        turnover: 10960000
      },
      {
        symbol: '600000',
        name: '浦发银行',
        currentPrice: 9.85,
        highPrice: 9.90,
        lowPrice: 9.80,
        lastUpdateTime: '2026-02-13 15:00:00',
        change: 0.05,
        changePercent: 0.51,
        volume: 800000,
        turnover: 7880000
      }
    ];

    const context = createEnhancedMockContext();
    const intelligenceFeeds = await generateEnhancedIntelligenceAnalysis(
      mockMarketData,
      context,
      apiKey
    );

    const feedsArray = Object.values(intelligenceFeeds);
    Logger.info(`生成 ${feedsArray.length} 个智能情报分析`);

    // 测试数据库存储
    if (feedsArray.length > 0) {
      Logger.info('测试数据库存储...');
      const storage = new IntelligenceFeedStorage();
      const savedCount = await storage.saveMultipleIntelligenceFeeds(feedsArray);
      await storage.disconnect();
      Logger.info(`成功保存 ${savedCount} 条记录到数据库`);
    }

    return {
      success: true,
      feeds: feedsArray
    };

  } catch (error: any) {
    Logger.error('增强版智能情报分析测试失败:', error);
    return {
      success: false,
      feeds: [],
      error: error.message
    };
  }
}

/**
 * 测试完整流水线
 */
export async function testCompletePipeline(): Promise<{
  success: boolean;
  feeds: IntelligenceFeedData[];
  savedCount: number;
  error?: string;
}> {
  try {
    Logger.info('测试完整智能情报流水线...');

    const result = await runCompleteIntelligencePipeline(
      ['000001', '600000'],
      'test-user-123',
      process.env.DEEPSEEK_API_KEY
    );

    if (result.success) {
      Logger.info('完整流水线测试成功', {
        feedsCount: result.feeds.length,
        savedCount: result.savedCount
      });
    } else {
      Logger.warn('完整流水线测试部分成功或失败', {
        error: result.error,
        feedsCount: result.feeds.length
      });
    }

    return result;

  } catch (error: any) {
    Logger.error('完整流水线测试失败:', error);
    return {
      success: false,
      feeds: [],
      savedCount: 0,
      error: error.message
    };
  }
}

// 测试函数已通过各自的export语句导出

// 如果直接运行此文件，执行测试
if (require.main === module) {
  const testMode = process.argv[2] || 'basic';

  async function runTest() {
    switch (testMode) {
      case 'enhanced':
        console.log('运行增强版智能情报分析测试...');
        const enhancedResult = await testEnhancedIntelligenceAnalysis();
        console.log('增强版测试结果:', JSON.stringify(enhancedResult, null, 2));
        process.exit(enhancedResult.success ? 0 : 1);
        break;

      case 'pipeline':
        console.log('运行完整流水线测试...');
        const pipelineResult = await testCompletePipeline();
        console.log('完整流水线测试结果:', JSON.stringify(pipelineResult, null, 2));
        process.exit(pipelineResult.success ? 0 : 1);
        break;

      case 'basic':
      default:
        console.log('运行基础版测试...');
        const decisions = await testDeepSeekAgent();
        console.log('测试完成，决策数量:', Object.keys(decisions).length);
        process.exit(Object.keys(decisions).length > 0 ? 0 : 1);
        break;
    }
  }

  runTest().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
}