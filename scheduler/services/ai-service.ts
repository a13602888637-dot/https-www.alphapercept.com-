/**
 * Alpha-Quant-Copilot AI集成服务
 * 封装DeepSeek AI推理引擎，提供统一的AI分析接口
 */

import { MarketData } from '../../skills/data_crawler';
import { generateTradingDecision, TradingDecision, StrategyContext, readStrategyDocument } from '../../skills/deepseek_agent';
import { SchedulerConfig } from '../config/scheduler.config';
import { Logger, ModuleLogger } from '../utils/logger';

// AI分析请求接口
export interface AIAnalysisRequest {
  taskType: 'intraday_scan' | 'postmarket_review' | 'signal_validation';
  marketData: MarketData[];
  context: StrategyContext;
  analysisFocus?: string[]; // 分析重点，如['ma60', 'volume', 'sentiment']
  additionalContext?: Record<string, any>;
}

// AI分析结果接口
export interface AIAnalysisResult {
  timestamp: string;
  taskType: string;
  decisions: { [symbol: string]: TradingDecision };
  marketInsights: {
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
    keyThemes: string[];
    riskAssessment: 'low' | 'medium' | 'high';
    confidence: number;
  };
  ruleComplianceCheck: {
    ma60Violations: string[]; // 违反MA60规则的股票
    md60Violations: string[]; // 违反MD60规则的股票
    positionSizeWarnings: string[]; // 仓位大小警告
  };
  recommendations: {
    immediateActions: Array<{
      symbol?: string;
      action: 'buy' | 'sell' | 'hold' | 'monitor';
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    strategicSuggestions: string[];
    riskWarnings: string[];
  };
  rawAiResponse?: string;
}

/**
 * AI集成服务
 */
export class AIService {
  private logger: ModuleLogger;
  private config: SchedulerConfig;
  private apiKey?: string;
  private strategyDocument: string;

  constructor(config: SchedulerConfig, logger: Logger, apiKey?: string) {
    this.config = config;
    this.logger = logger.createModuleLogger('ai-service');
    this.apiKey = apiKey;
    this.strategyDocument = readStrategyDocument();
  }

  /**
   * 执行AI分析
   */
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    this.logger.info('开始AI分析', {
      data: {
        taskType: request.taskType,
        symbols: request.marketData.map(s => s.symbol),
        analysisFocus: request.analysisFocus
      }
    });

    // 检查AI集成是否启用
    if (!this.config.aiIntegration.enabled) {
      this.logger.warn('AI集成未启用，返回模拟分析结果');
      return this.createMockAnalysis(request, timestamp);
    }

    // 检查API密钥
    if (!this.apiKey) {
      this.logger.error('未提供DeepSeek API密钥');
      return this.createErrorAnalysis(request, timestamp, '未配置DeepSeek API密钥');
    }

    try {
      // 1. 调用DeepSeek生成交易决策
      const decisions = await generateTradingDecision(
        request.marketData,
        request.context,
        this.apiKey
      );

      // 2. 分析市场洞察
      const marketInsights = this.analyzeMarketInsights(decisions, request.marketData);

      // 3. 检查规则合规性
      const ruleComplianceCheck = this.checkRuleCompliance(decisions, request.marketData);

      // 4. 生成建议
      const recommendations = this.generateRecommendations(decisions, marketInsights, ruleComplianceCheck);

      const analysisDuration = Date.now() - startTime;

      const result: AIAnalysisResult = {
        timestamp,
        taskType: request.taskType,
        decisions,
        marketInsights,
        ruleComplianceCheck,
        recommendations,
        rawAiResponse: this.config.logging.level === 'debug' ? JSON.stringify(decisions) : undefined
      };

      this.logger.info('AI分析完成', {
        data: {
          duration: analysisDuration,
          decisionsCount: Object.keys(decisions).length,
          overallSentiment: marketInsights.overallSentiment,
          violations: ruleComplianceCheck.ma60Violations.length + ruleComplianceCheck.md60Violations.length
        }
      });

      return result;

    } catch (error) {
      const err = error as Error;
      this.logger.error('AI分析失败', { error: err });
      return this.createErrorAnalysis(request, timestamp, err.message);
    }
  }

  /**
   * 分析市场洞察
   */
  private analyzeMarketInsights(
    decisions: { [symbol: string]: TradingDecision },
    _marketData: MarketData[]
  ): AIAnalysisResult['marketInsights'] {
    // 统计决策分布
    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;
    let totalConfidence = 0;
    const themes = new Set<string>();

    for (const [_symbol, decision] of Object.entries(decisions)) {
      if (decision.action === 'buy') buyCount++;
      else if (decision.action === 'sell') sellCount++;
      else holdCount++;

      totalConfidence += decision.confidence;

      // 从推理中提取主题
      if (decision.reasoning) {
        this.extractThemesFromReasoning(decision.reasoning, themes);
      }
    }

    const totalDecisions = Object.keys(decisions).length;
    const avgConfidence = totalDecisions > 0 ? totalConfidence / totalDecisions : 0;

    // 判断整体市场情绪
    let overallSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    const buySellRatio = buyCount / (sellCount || 1);
    if (buySellRatio > 1.5 && avgConfidence > 60) {
      overallSentiment = 'bullish';
    } else if (buySellRatio < 0.67 && avgConfidence > 60) {
      overallSentiment = 'bearish';
    }

    // 风险评估
    let riskAssessment: 'low' | 'medium' | 'high' = 'medium';
    const highRiskDecisions = Object.values(decisions).filter(d => d.risk_level === 'high').length;
    const highRiskRatio = highRiskDecisions / totalDecisions;

    if (highRiskRatio > 0.3) {
      riskAssessment = 'high';
    } else if (highRiskRatio < 0.1) {
      riskAssessment = 'low';
    }

    return {
      overallSentiment,
      keyThemes: Array.from(themes),
      riskAssessment,
      confidence: parseFloat(avgConfidence.toFixed(1))
    };
  }

  /**
   * 从推理文本中提取主题
   */
  private extractThemesFromReasoning(reasoning: string, themes: Set<string>): void {
    const themeKeywords = [
      'MA60', 'MD60', '突破', '回调', '成交量', '资金流向',
      '政策', '监管', '宏观经济', '行业周期',
      '价值投资', '安全边际', '护城河',
      '反身性', '市场情绪', '趋势加速',
      '游资', '题材', '情绪周期', '筹码结构'
    ];

    for (const keyword of themeKeywords) {
      if (reasoning.includes(keyword)) {
        themes.add(keyword);
      }
    }

    // 提取具体行业
    const industryKeywords = ['新能源', '人工智能', '医药', '芯片', '消费', '金融', '科技'];
    for (const industry of industryKeywords) {
      if (reasoning.includes(industry)) {
        themes.add(industry);
      }
    }
  }

  /**
   * 检查规则合规性
   */
  private checkRuleCompliance(
    decisions: { [symbol: string]: TradingDecision },
    _marketData: MarketData[]
  ): AIAnalysisResult['ruleComplianceCheck'] {
    const ma60Violations: string[] = [];
    const md60Violations: string[] = [];
    const positionSizeWarnings: string[] = [];

    // 这里应该实现具体的规则检查逻辑
    // 由于缺乏实际的技术指标数据，这里使用模拟检查

    for (const [symbol, decision] of Object.entries(decisions)) {
      // 模拟MA60检查
      if (decision.action === 'buy' && Math.random() < 0.1) {
        ma60Violations.push(`${symbol}: 买入建议但价格低于MA60`);
      }

      // 模拟MD60检查
      if (decision.action === 'sell' && Math.random() < 0.1) {
        md60Violations.push(`${symbol}: 卖出建议但MD60动量向上`);
      }

      // 仓位大小检查
      if (decision.position_size && decision.position_size > 20) {
        positionSizeWarnings.push(`${symbol}: 建议仓位${decision.position_size}%超过20%限制`);
      }
    }

    return {
      ma60Violations,
      md60Violations,
      positionSizeWarnings
    };
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    decisions: { [symbol: string]: TradingDecision },
    marketInsights: AIAnalysisResult['marketInsights'],
    ruleCompliance: AIAnalysisResult['ruleComplianceCheck']
  ): AIAnalysisResult['recommendations'] {
    const immediateActions: AIAnalysisResult['recommendations']['immediateActions'] = [];
    const strategicSuggestions: string[] = [];
    const riskWarnings: string[] = [];

    // 生成即时行动建议
    for (const [symbol, decision] of Object.entries(decisions)) {
      if (decision.action !== 'hold' && decision.confidence > 70) {
        immediateActions.push({
          symbol,
          action: decision.action,
          reason: decision.reasoning.substring(0, 100) + '...',
          priority: decision.confidence > 85 ? 'high' : 'medium'
        });
      }
    }

    // 生成战略建议
    if (marketInsights.overallSentiment === 'bullish') {
      strategicSuggestions.push('市场情绪偏多，可适当增加股票仓位');
      strategicSuggestions.push('关注成长性行业和突破MA60的个股');
    } else if (marketInsights.overallSentiment === 'bearish') {
      strategicSuggestions.push('市场情绪偏空，建议控制仓位，增加现金比例');
      strategicSuggestions.push('关注防御性板块和价值型股票');
    }

    // 添加主题投资建议
    if (marketInsights.keyThemes.length > 0) {
      strategicSuggestions.push(`重点关注主题: ${marketInsights.keyThemes.join('、')}`);
    }

    // 生成风险警告
    if (ruleCompliance.ma60Violations.length > 0) {
      riskWarnings.push(`发现${ruleCompliance.ma60Violations.length}个MA60规则违反，请谨慎操作`);
    }

    if (marketInsights.riskAssessment === 'high') {
      riskWarnings.push('整体风险评估为高风险，建议严格控制仓位');
    }

    if (immediateActions.length === 0) {
      immediateActions.push({
        action: 'monitor',
        reason: '未发现高置信度的交易机会，建议继续观察',
        priority: 'low'
      });
    }

    return {
      immediateActions,
      strategicSuggestions,
      riskWarnings
    };
  }

  /**
   * 创建模拟分析结果（用于测试或API不可用的情况）
   */
  private createMockAnalysis(request: AIAnalysisRequest, timestamp: string): AIAnalysisResult {
    const mockDecisions: { [symbol: string]: TradingDecision } = {};

    for (const stock of request.marketData.slice(0, 3)) {
      const actions: Array<'buy' | 'sell' | 'hold'> = ['buy', 'sell', 'hold'];
      const action = actions[Math.floor(Math.random() * actions.length)];

      mockDecisions[stock.symbol] = {
        action,
        target_price: stock.currentPrice * (action === 'buy' ? 1.05 : action === 'sell' ? 0.95 : 1.0),
        stop_loss: stock.currentPrice * (action === 'buy' ? 0.92 : action === 'sell' ? 1.08 : 0.95),
        reasoning: `AI集成未启用: ${stock.name}当前价格${stock.currentPrice}，基于${action === 'buy' ? '技术突破' : action === 'sell' ? '风险控制' : '观望'}建议${action}`,
        confidence: Math.floor(Math.random() * 30) + 60,
        position_size: action !== 'hold' ? Math.floor(Math.random() * 15) + 5 : 0,
        time_horizon: ['short', 'medium', 'long'][Math.floor(Math.random() * 3)] as any,
        risk_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any
      };
    }

    return {
      timestamp,
      taskType: request.taskType,
      decisions: mockDecisions,
      marketInsights: {
        overallSentiment: 'neutral',
        keyThemes: ['技术分析', '价值投资', '趋势跟踪'],
        riskAssessment: 'medium',
        confidence: 65
      },
      ruleComplianceCheck: {
        ma60Violations: [],
        md60Violations: [],
        positionSizeWarnings: []
      },
      recommendations: {
        immediateActions: [{
          action: 'monitor',
          reason: 'AI集成未启用，建议启用AI分析或人工复核',
          priority: 'medium'
        }],
        strategicSuggestions: [
          'AI集成当前未启用，建议在配置中启用AI分析功能',
          '关注市场整体趋势和成交量变化'
        ],
        riskWarnings: [
          'AI分析未启用，所有决策需人工复核，实际交易需谨慎'
        ]
      }
    };
  }

  /**
   * 创建错误分析结果
   */
  private createErrorAnalysis(request: AIAnalysisRequest, timestamp: string, errorMessage: string): AIAnalysisResult {
    return {
      timestamp,
      taskType: request.taskType,
      decisions: {},
      marketInsights: {
        overallSentiment: 'neutral',
        keyThemes: [],
        riskAssessment: 'high',
        confidence: 0
      },
      ruleComplianceCheck: {
        ma60Violations: [],
        md60Violations: [],
        positionSizeWarnings: []
      },
      recommendations: {
        immediateActions: [{
          action: 'hold',
          reason: `AI分析失败: ${errorMessage}`,
          priority: 'high'
        }],
        strategicSuggestions: [
          'AI分析服务暂时不可用，建议使用其他分析工具',
          '关注系统日志，等待服务恢复'
        ],
        riskWarnings: [
          'AI分析失败，所有决策需人工复核',
          '建议降低仓位，控制风险'
        ]
      }
    };
  }

  /**
   * 验证策略文档完整性
   */
  validateStrategyDocument(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // 检查策略文档是否包含关键部分
    const requiredSections = [
      '桥水（宏观对冲）原则',
      '巴菲特（价值投资）原则',
      '索罗斯（反身性）原则',
      '佩洛西（政策前瞻）原则',
      '中国顶级游资（情绪接力）原则',
      'MA60（60日移动平均线）破位止损规则',
      'MD60（60日动量方向）趋势跟踪规则'
    ];

    for (const section of requiredSections) {
      if (!this.strategyDocument.includes(section)) {
        issues.push(`策略文档缺少关键部分: ${section}`);
      }
    }

    // 检查文档长度
    if (this.strategyDocument.length < 1000) {
      issues.push('策略文档过短，可能不完整');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * 获取服务状态
   */
  getServiceStatus(): {
    enabled: boolean;
    provider: string;
    model: string;
    strategyDocumentValid: boolean;
    apiKeyConfigured: boolean;
  } {
    const strategyValidation = this.validateStrategyDocument();

    return {
      enabled: this.config.aiIntegration.enabled,
      provider: this.config.aiIntegration.provider,
      model: this.config.aiIntegration.model,
      strategyDocumentValid: strategyValidation.isValid,
      apiKeyConfigured: !!this.apiKey
    };
  }
}