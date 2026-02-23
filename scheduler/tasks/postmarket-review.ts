/**
 * Alpha-Quant-Copilot 盘后深度复盘任务
 * 每日收盘后执行，进行全市场数据分析、策略表现评估、规则优化建议
 */

import * as fs from 'fs';
import * as path from 'path';
import { MarketData } from '../../skills/data_crawler';
import { generateTradingDecision, TradingDecision, StrategyContext } from '../../skills/deepseek_agent';
import { SchedulerConfig } from '../config/scheduler.config';
import { Logger } from '../utils/logger';

// 复盘结果接口
export interface PostMarketReviewResult {
  timestamp: string;
  reviewType: 'postmarket';
  tradingDate: string;

  // 市场概况
  marketOverview: {
    totalStocks: number;
    advancingStocks: number;
    decliningStocks: number;
    unchangedStocks: number;
    avgChangePercent: number;
    totalVolume: number;
    totalTurnover: number;
    marketSentiment: 'bullish' | 'bearish' | 'neutral';
  };

  // 策略表现评估
  strategyPerformance: {
    // MA60纪律执行情况
    ma60Discipline: {
      totalPositions: number;
      ma60Violations: number;
      stopLossExecuted: number;
      avgHoldingDays: number;
      ma60ComplianceRate: number; // MA60纪律遵守率
    };

    // MD60趋势跟踪效果
    md60TrendFollowing: {
      correctTrendJudgments: number;
      incorrectTrendJudgments: number;
      trendAccuracy: number;
      avgTrendDuration: number;
    };

    // 五大流派表现
    strategyPerformanceBySchool: {
      bridgewater: {
        macroCycleAccuracy: number;
        assetAllocationScore: number;
        riskParityEffectiveness: number;
      };
      buffett: {
        valueStocksPerformance: number;
        safetyMarginEffectiveness: number;
        moatStocksOutperformance: number;
      };
      soros: {
        reflexivityIdentifications: number;
        trendAccelerationCaptured: number;
        bubbleWarningAccuracy: number;
      };
      pelosi: {
        policySensitivityScore: number;
        regulatoryRiskAvoidance: number;
        industrialPolicyBenefit: number;
      };
      chineseHotMoney: {
        themeRecognitionRate: number;
        sentimentCycleAccuracy: number;
        fundFlowPrediction: number;
      };
    };

    // 整体绩效
    overallPerformance: {
      totalReturn: number;
      sharpeRatio: number;
      maxDrawdown: number;
      winRate: number;
      profitFactor: number;
      dailyVolatility: number;
    };
  };

  // AI决策分析
  aiDecisionAnalysis: {
    totalDecisions: number;
    buyDecisions: number;
    sellDecisions: number;
    holdDecisions: number;
    decisionConfidenceAvg: number;
    positionSizeAvg: number;
    riskLevelDistribution: {
      low: number;
      medium: number;
      high: number;
    };
    timeHorizonDistribution: {
      short: number;
      medium: number;
      long: number;
    };
  };

  // 规则优化建议
  ruleOptimizationSuggestions: {
    ma60Rules: {
      currentThreshold: number;
      suggestedThreshold?: number;
      optimizationReason?: string;
      expectedImprovement?: number;
    };
    md60Rules: {
      currentMomentumThresholds: {
        strong: number;
        moderate: number;
        consolidation: number;
      };
      suggestedThresholds?: {
        strong: number;
        moderate: number;
        consolidation: number;
      };
      optimizationReason?: string;
    };
    positionSizing: {
      currentMaxPosition: number;
      suggestedMaxPosition?: number;
      optimizationReason?: string;
    };
    stopLossRules: {
      currentInitialStop: number;
      currentTrailingStop: number;
      suggestedImprovements?: string[];
    };
  };

  // 明日策略建议
  tomorrowStrategySuggestions: {
    marketOutlook: 'bullish' | 'bearish' | 'neutral';
    suggestedAssetAllocation: {
      stocks: number;
      bonds: number;
      commodities: number;
      cash: number;
    };
    keySectorsToWatch: string[];
    riskWarnings: string[];
    tradingFocus: 'value_investing' | 'momentum_trading' | 'theme_rotation' | 'defensive';
  };

  // 生成的报告
  generatedReport?: {
    executiveSummary: string;
    detailedAnalysis: string;
    actionableInsights: string[];
    attachments?: string[]; // 报告附件路径
  };

  // 统计摘要
  summary: {
    analysisDurationMs: number;
    dataSourcesUsed: string[];
    aiModelUsed?: string;
    reviewDepth: 'basic' | 'standard' | 'deep';
  };
}

/**
 * 盘后深度复盘任务
 */
export class PostMarketReviewTask {
  private logger: Logger;
  private config: SchedulerConfig;
  private deepseekApiKey?: string;

  constructor(config: SchedulerConfig, logger: Logger, deepseekApiKey?: string) {
    this.config = config;
    this.logger = logger;
    this.deepseekApiKey = deepseekApiKey;
  }

  /**
   * 执行复盘任务
   */
  async execute(): Promise<PostMarketReviewResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const tradingDate = new Date().toISOString().split('T')[0];

    this.logger.info('开始执行盘后深度复盘任务', { timestamp, tradingDate });

    try {
      // 1. 收集当日市场数据
      const marketData = await this.collectMarketData();
      this.logger.info(`收集到 ${marketData.length} 只股票的当日数据`);

      // 2. 分析市场概况
      const marketOverview = this.analyzeMarketOverview(marketData);

      // 3. 评估策略表现（从历史数据中分析）
      const strategyPerformance = await this.evaluateStrategyPerformance(tradingDate);

      // 4. AI决策分析（如果启用AI）
      const aiDecisionAnalysis = this.config.aiIntegration.enabled
        ? await this.analyzeAIDecisions(marketData)
        : this.createEmptyAIDecisionAnalysis();

      // 5. 生成规则优化建议
      const ruleOptimizationSuggestions = this.generateOptimizationSuggestions(strategyPerformance);

      // 6. 生成明日策略建议
      const tomorrowStrategySuggestions = await this.generateTomorrowSuggestions(
        marketOverview,
        strategyPerformance,
        aiDecisionAnalysis
      );

      // 7. 生成详细报告（如果配置要求）
      let generatedReport;
      if (this.config.postMarketReview.generateReport) {
        generatedReport = await this.generateDetailedReport({
          marketOverview,
          strategyPerformance,
          aiDecisionAnalysis,
          ruleOptimizationSuggestions,
          tomorrowStrategySuggestions
        });
      }

      // 8. 生成最终结果
      const analysisDurationMs = Date.now() - startTime;
      const result: PostMarketReviewResult = {
        timestamp,
        reviewType: 'postmarket',
        tradingDate,
        marketOverview,
        strategyPerformance,
        aiDecisionAnalysis,
        ruleOptimizationSuggestions,
        tomorrowStrategySuggestions,
        generatedReport,
        summary: {
          analysisDurationMs,
          dataSourcesUsed: ['sina_finance', 'tencent_finance', 'historical_database'],
          aiModelUsed: this.config.aiIntegration.enabled ? this.config.aiIntegration.model : undefined,
          reviewDepth: this.config.postMarketReview.analysisDepth
        }
      };

      this.logger.info('盘后深度复盘任务完成', {
        duration: analysisDurationMs,
        marketSentiment: marketOverview.marketSentiment,
        strategyAccuracy: strategyPerformance.md60TrendFollowing.trendAccuracy
      });

      // 9. 保存结果
      await this.saveResult(result);

      return result;

    } catch (error) {
      this.logger.error('盘后深度复盘任务执行失败', { error: error.message });
      return this.createErrorResult(timestamp, tradingDate, error.message, Date.now() - startTime);
    }
  }

  /**
   * 收集市场数据
   */
  private async collectMarketData(): Promise<MarketData[]> {
    // 实际应从数据库或API获取当日完整数据
    // 这里返回模拟数据
    return [
      {
        symbol: '000001',
        name: '平安银行',
        currentPrice: 10.96,
        highPrice: 11.20,
        lowPrice: 10.80,
        lastUpdateTime: `${new Date().toISOString().split('T')[0]} 15:00:00`,
        change: 0.46,
        changePercent: 4.38,
        volume: 50000000,
        turnover: 548000000
      },
      {
        symbol: '600519',
        name: '贵州茅台',
        currentPrice: 1650.50,
        highPrice: 1665.00,
        lowPrice: 1635.00,
        lastUpdateTime: `${new Date().toISOString().split('T')[0]} 15:00:00`,
        change: -12.50,
        changePercent: -0.75,
        volume: 8000000,
        turnover: 13200000000
      },
      // 可以添加更多模拟数据...
    ];
  }

  /**
   * 分析市场概况
   */
  private analyzeMarketOverview(marketData: MarketData[]): PostMarketReviewResult['marketOverview'] {
    let advancingStocks = 0;
    let decliningStocks = 0;
    let unchangedStocks = 0;
    let totalChangePercent = 0;
    let totalVolume = 0;
    let totalTurnover = 0;

    for (const stock of marketData) {
      if (stock.changePercent) {
        totalChangePercent += stock.changePercent;
        if (stock.changePercent > 0) advancingStocks++;
        else if (stock.changePercent < 0) decliningStocks++;
        else unchangedStocks++;
      }
      if (stock.volume) totalVolume += stock.volume;
      if (stock.turnover) totalTurnover += stock.turnover;
    }

    const avgChangePercent = marketData.length > 0 ? totalChangePercent / marketData.length : 0;

    // 判断市场情绪
    let marketSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    const advanceDeclineRatio = advancingStocks / (decliningStocks || 1);
    if (advanceDeclineRatio > 1.5 && avgChangePercent > 0.5) {
      marketSentiment = 'bullish';
    } else if (advanceDeclineRatio < 0.67 && avgChangePercent < -0.5) {
      marketSentiment = 'bearish';
    }

    return {
      totalStocks: marketData.length,
      advancingStocks,
      decliningStocks,
      unchangedStocks,
      avgChangePercent: parseFloat(avgChangePercent.toFixed(2)),
      totalVolume,
      totalTurnover,
      marketSentiment
    };
  }

  /**
   * 评估策略表现
   */
  private async evaluateStrategyPerformance(tradingDate: string): Promise<PostMarketReviewResult['strategyPerformance']> {
    // 实际应从历史交易记录数据库获取数据
    // 这里返回模拟数据

    return {
      ma60Discipline: {
        totalPositions: 15,
        ma60Violations: 2,
        stopLossExecuted: 1,
        avgHoldingDays: 8.5,
        ma60ComplianceRate: 86.7 // (15-2)/15 * 100
      },

      md60TrendFollowing: {
        correctTrendJudgments: 22,
        incorrectTrendJudgments: 8,
        trendAccuracy: 73.3, // 22/(22+8)*100
        avgTrendDuration: 12.5
      },

      strategyPerformanceBySchool: {
        bridgewater: {
          macroCycleAccuracy: 75.0,
          assetAllocationScore: 82.5,
          riskParityEffectiveness: 88.0
        },
        buffett: {
          valueStocksPerformance: 15.3,
          safetyMarginEffectiveness: 91.2,
          moatStocksOutperformance: 12.8
        },
        soros: {
          reflexivityIdentifications: 5,
          trendAccelerationCaptured: 18.7,
          bubbleWarningAccuracy: 66.7
        },
        pelosi: {
          policySensitivityScore: 78.9,
          regulatoryRiskAvoidance: 92.3,
          industrialPolicyBenefit: 24.5
        },
        chineseHotMoney: {
          themeRecognitionRate: 68.4,
          sentimentCycleAccuracy: 71.2,
          fundFlowPrediction: 63.8
        }
      },

      overallPerformance: {
        totalReturn: 8.75,
        sharpeRatio: 1.42,
        maxDrawdown: -4.32,
        winRate: 62.8,
        profitFactor: 1.85,
        dailyVolatility: 1.23
      }
    };
  }

  /**
   * 分析AI决策
   */
  private async analyzeAIDecisions(marketData: MarketData[]): Promise<PostMarketReviewResult['aiDecisionAnalysis']> {
    if (!this.deepseekApiKey) {
      this.logger.warn('未提供DeepSeek API密钥，跳过AI决策分析');
      return this.createEmptyAIDecisionAnalysis();
    }

    try {
      // 创建模拟策略上下文
      const context: StrategyContext = {
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
        availableCapital: 100000
      };

      // 调用AI生成决策
      const decisions = await generateTradingDecision(marketData, context, this.deepseekApiKey);

      // 分析决策分布
      let buyDecisions = 0;
      let sellDecisions = 0;
      let holdDecisions = 0;
      let totalConfidence = 0;
      let totalPositionSize = 0;
      const riskLevelDistribution = { low: 0, medium: 0, high: 0 };
      const timeHorizonDistribution = { short: 0, medium: 0, long: 0 };

      for (const [symbol, decision] of Object.entries(decisions)) {
        if (decision.action === 'buy') buyDecisions++;
        else if (decision.action === 'sell') sellDecisions++;
        else holdDecisions++;

        totalConfidence += decision.confidence;
        if (decision.position_size) totalPositionSize += decision.position_size;

        if (decision.risk_level) {
          riskLevelDistribution[decision.risk_level]++;
        }

        if (decision.time_horizon) {
          timeHorizonDistribution[decision.time_horizon]++;
        }
      }

      const totalDecisions = Object.keys(decisions).length;

      return {
        totalDecisions,
        buyDecisions,
        sellDecisions,
        holdDecisions,
        decisionConfidenceAvg: totalDecisions > 0 ? parseFloat((totalConfidence / totalDecisions).toFixed(1)) : 0,
        positionSizeAvg: totalDecisions > 0 ? parseFloat((totalPositionSize / totalDecisions).toFixed(1)) : 0,
        riskLevelDistribution,
        timeHorizonDistribution
      };

    } catch (error) {
      this.logger.error('AI决策分析失败', { error: error.message });
      return this.createEmptyAIDecisionAnalysis();
    }
  }

  /**
   * 生成规则优化建议
   */
  private generateOptimizationSuggestions(
    performance: PostMarketReviewResult['strategyPerformance']
  ): PostMarketReviewResult['ruleOptimizationSuggestions'] {
    const suggestions: PostMarketReviewResult['ruleOptimizationSuggestions'] = {
      ma60Rules: {
        currentThreshold: 3.0
      },
      md60Rules: {
        currentMomentumThresholds: {
          strong: 15,
          moderate: 5,
          consolidation: 5
        }
      },
      positionSizing: {
        currentMaxPosition: 20
      },
      stopLossRules: {
        currentInitialStop: 8,
        currentTrailingStop: 3
      }
    };

    // 基于MA60纪律遵守率提出建议
    if (performance.ma60Discipline.ma60ComplianceRate < 90) {
      suggestions.ma60Rules.suggestedThreshold = 2.5;
      suggestions.ma60Rules.optimizationReason = `MA60纪律遵守率较低(${performance.ma60Discipline.ma60ComplianceRate}%)，建议降低突破阈值以提高纪律性`;
      suggestions.ma60Rules.expectedImprovement = 5;
    }

    // 基于趋势判断准确率提出建议
    if (performance.md60TrendFollowing.trendAccuracy < 70) {
      suggestions.md60Rules.suggestedThresholds = {
        strong: 12,
        moderate: 3,
        consolidation: 3
      };
      suggestions.md60Rules.optimizationReason = `趋势判断准确率较低(${performance.md60TrendFollowing.trendAccuracy}%)，建议调整动量阈值`;
    }

    // 基于最大回撤提出仓位建议
    if (performance.overallPerformance.maxDrawdown < -5) {
      suggestions.positionSizing.suggestedMaxPosition = 15;
      suggestions.positionSizing.optimizationReason = `最大回撤较大(${performance.overallPerformance.maxDrawdown}%)，建议降低单只股票最大仓位`;
    }

    // 止损规则改进建议
    if (performance.ma60Discipline.stopLossExecuted > 0) {
      suggestions.stopLossRules.suggestedImprovements = [
        '考虑引入ATR（平均真实波幅）动态止损',
        '增加时间止损（持仓超过20日无盈利自动平仓）',
        '引入移动止盈机制'
      ];
    }

    return suggestions;
  }

  /**
   * 生成明日策略建议
   */
  private async generateTomorrowSuggestions(
    marketOverview: PostMarketReviewResult['marketOverview'],
    strategyPerformance: PostMarketReviewResult['strategyPerformance'],
    aiDecisionAnalysis: PostMarketReviewResult['aiDecisionAnalysis']
  ): Promise<PostMarketReviewResult['tomorrowStrategySuggestions']> {
    // 基于市场情绪决定市场展望
    let marketOutlook: 'bullish' | 'bearish' | 'neutral' = marketOverview.marketSentiment;

    // 基于策略表现调整资产配置
    let stockAllocation = 60;
    let bondAllocation = 20;
    let commodityAllocation = 10;
    let cashAllocation = 10;

    // 如果趋势判断准确率高，增加股票配置
    if (strategyPerformance.md60TrendFollowing.trendAccuracy > 75) {
      stockAllocation += 10;
      cashAllocation -= 10;
    }

    // 如果市场情绪悲观，增加现金配置
    if (marketOutlook === 'bearish') {
      stockAllocation -= 20;
      cashAllocation += 20;
    }

    // 确定交易焦点
    let tradingFocus: 'value_investing' | 'momentum_trading' | 'theme_rotation' | 'defensive' = 'momentum_trading';

    // 如果巴菲特策略表现好，关注价值投资
    if (strategyPerformance.strategyPerformanceBySchool.buffett.valueStocksPerformance > 10) {
      tradingFocus = 'value_investing';
    }

    // 如果市场波动大，采取防御策略
    if (strategyPerformance.overallPerformance.dailyVolatility > 1.5) {
      tradingFocus = 'defensive';
    }

    return {
      marketOutlook,
      suggestedAssetAllocation: {
        stocks: stockAllocation,
        bonds: bondAllocation,
        commodities: commodityAllocation,
        cash: cashAllocation
      },
      keySectorsToWatch: ['新能源', '人工智能', '医药生物', '芯片半导体'],
      riskWarnings: [
        '注意美联储利率决议对全球市场的影响',
        '关注国内经济数据发布',
        '警惕高位股回调风险'
      ],
      tradingFocus
    };
  }

  /**
   * 生成详细报告
   */
  private async generateDetailedReport(data: {
    marketOverview: PostMarketReviewResult['marketOverview'];
    strategyPerformance: PostMarketReviewResult['strategyPerformance'];
    aiDecisionAnalysis: PostMarketReviewResult['aiDecisionAnalysis'];
    ruleOptimizationSuggestions: PostMarketReviewResult['ruleOptimizationSuggestions'];
    tomorrowStrategySuggestions: PostMarketReviewResult['tomorrowStrategySuggestions'];
  }): Promise<PostMarketReviewResult['generatedReport']> {
    const date = new Date().toISOString().split('T')[0];

    const executiveSummary = `
# Alpha-Quant-Copilot 盘后复盘报告
## ${date} 交易日复盘

### 市场概况
- 市场情绪: ${data.marketOverview.marketSentiment}
- 上涨股票: ${data.marketOverview.advancingStocks} 只
- 下跌股票: ${data.marketOverview.decliningStocks} 只
- 平均涨跌幅: ${data.marketOverview.avgChangePercent}%

### 策略表现摘要
- MA60纪律遵守率: ${data.strategyPerformance.ma60Discipline.ma60ComplianceRate}%
- 趋势判断准确率: ${data.strategyPerformance.md60TrendFollowing.trendAccuracy}%
- 总收益率: ${data.strategyPerformance.overallPerformance.totalReturn}%
- 夏普比率: ${data.strategyPerformance.overallPerformance.sharpeRatio}
- 最大回撤: ${data.strategyPerformance.overallPerformance.maxDrawdown}%

### 明日策略方向
- 市场展望: ${data.tomorrowStrategySuggestions.marketOutlook}
- 交易焦点: ${data.tomorrowStrategySuggestions.tradingFocus}
- 股票配置: ${data.tomorrowStrategySuggestions.suggestedAssetAllocation.stocks}%
    `.trim();

    const detailedAnalysis = `
## 详细分析

### 1. MA60纪律执行情况
- 总持仓数: ${data.strategyPerformance.ma60Discipline.totalPositions}
- MA60违规次数: ${data.strategyPerformance.ma60Discipline.ma60Violations}
- 止损执行次数: ${data.strategyPerformance.ma60Discipline.stopLossExecuted}
- 平均持仓天数: ${data.strategyPerformance.ma60Discipline.avgHoldingDays}

### 2. MD60趋势跟踪效果
- 正确趋势判断: ${data.strategyPerformance.md60TrendFollowing.correctTrendJudgments}
- 错误趋势判断: ${data.strategyPerformance.md60TrendFollowing.incorrectTrendJudgments}
- 平均趋势持续时间: ${data.strategyPerformance.md60TrendFollowing.avgTrendDuration}天

### 3. 五大投资流派表现
- 桥水宏观策略: ${data.strategyPerformance.strategyPerformanceBySchool.bridgewater.macroCycleAccuracy}% 准确率
- 巴菲特价值投资: ${data.strategyPerformance.strategyPerformanceBySchool.buffett.valueStocksPerformance}% 收益
- 索罗斯反身性: ${data.strategyPerformance.strategyPerformanceBySchool.soros.reflexivityIdentifications} 次识别
- 佩洛西政策前瞻: ${data.strategyPerformance.strategyPerformanceBySchool.pelosi.policySensitivityScore} 分
- 中国游资情绪: ${data.strategyPerformance.strategyPerformanceBySchool.chineseHotMoney.themeRecognitionRate}% 识别率

### 4. AI决策分析
- 总决策数: ${data.aiDecisionAnalysis.totalDecisions}
- 买入建议: ${data.aiDecisionAnalysis.buyDecisions}
- 卖出建议: ${data.aiDecisionAnalysis.sellDecisions}
- 观望建议: ${data.aiDecisionAnalysis.holdDecisions}
- 平均信心分数: ${data.aiDecisionAnalysis.decisionConfidenceAvg}
    `.trim();

    const actionableInsights = [
      `MA60纪律遵守率 ${data.strategyPerformance.ma60Discipline.ma60ComplianceRate}%，${data.strategyPerformance.ma60Discipline.ma60ComplianceRate >= 90 ? '表现良好' : '需要改进'}`,
      `趋势判断准确率 ${data.strategyPerformance.md60TrendFollowing.trendAccuracy}%，${data.strategyPerformance.md60TrendFollowing.trendAccuracy >= 70 ? '可以信赖' : '需要谨慎'}`,
      `明日建议 ${data.tomorrowStrategySuggestions.tradingFocus} 策略，股票配置 ${data.tomorrowStrategySuggestions.suggestedAssetAllocation.stocks}%`,
      `重点关注板块: ${data.tomorrowStrategySuggestions.keySectorsToWatch.join('、')}`
    ];

    // 保存报告文件
    const reportDir = path.join(process.cwd(), 'scheduler', 'logs', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFilename = `postmarket-review-${date}.md`;
    const reportPath = path.join(reportDir, reportFilename);

    const fullReport = `${executiveSummary}\n\n${detailedAnalysis}\n\n## 可执行建议\n${actionableInsights.map(insight => `- ${insight}`).join('\n')}`;

    fs.writeFileSync(reportPath, fullReport, 'utf-8');
    this.logger.info('复盘报告已生成', { filename: reportFilename });

    return {
      executiveSummary,
      detailedAnalysis,
      actionableInsights,
      attachments: [reportPath]
    };
  }

  /**
   * 保存复盘结果
   */
  private async saveResult(result: PostMarketReviewResult): Promise<void> {
    try {
      const logsDir = path.join(process.cwd(), 'scheduler', 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const date = new Date().toISOString().split('T')[0];
      const filename = `postmarket-review-${date}.json`;
      const filepath = path.join(logsDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');
      this.logger.info('复盘结果已保存', { filename });

    } catch (error) {
      this.logger.error('保存复盘结果失败', { error: error.message });
    }
  }

  /**
   * 创建空的AI决策分析
   */
  private createEmptyAIDecisionAnalysis(): PostMarketReviewResult['aiDecisionAnalysis'] {
    return {
      totalDecisions: 0,
      buyDecisions: 0,
      sellDecisions: 0,
      holdDecisions: 0,
      decisionConfidenceAvg: 0,
      positionSizeAvg: 0,
      riskLevelDistribution: { low: 0, medium: 0, high: 0 },
      timeHorizonDistribution: { short: 0, medium: 0, long: 0 }
    };
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    timestamp: string,
    tradingDate: string,
    errorMessage: string,
    analysisDurationMs: number
  ): PostMarketReviewResult {
    return {
      timestamp,
      reviewType: 'postmarket',
      tradingDate,
      marketOverview: {
        totalStocks: 0,
        advancingStocks: 0,
        decliningStocks: 0,
        unchangedStocks: 0,
        avgChangePercent: 0,
        totalVolume: 0,
        totalTurnover: 0,
        marketSentiment: 'neutral'
      },
      strategyPerformance: {
        ma60Discipline: {
          totalPositions: 0,
          ma60Violations: 0,
          stopLossExecuted: 0,
          avgHoldingDays: 0,
          ma60ComplianceRate: 0
        },
        md60TrendFollowing: {
          correctTrendJudgments: 0,
          incorrectTrendJudgments: 0,
          trendAccuracy: 0,
          avgTrendDuration: 0
        },
        strategyPerformanceBySchool: {
          bridgewater: {
            macroCycleAccuracy: 0,
            assetAllocationScore: 0,
            riskParityEffectiveness: 0
          },
          buffett: {
            valueStocksPerformance: 0,
            safetyMarginEffectiveness: 0,
            moatStocksOutperformance: 0
          },
          soros: {
            reflexivityIdentifications: 0,
            trendAccelerationCaptured: 0,
            bubbleWarningAccuracy: 0
          },
          pelosi: {
            policySensitivityScore: 0,
            regulatoryRiskAvoidance: 0,
            industrialPolicyBenefit: 0
          },
          chineseHotMoney: {
            themeRecognitionRate: 0,
            sentimentCycleAccuracy: 0,
            fundFlowPrediction: 0
          }
        },
        overallPerformance: {
          totalReturn: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          winRate: 0,
          profitFactor: 0,
          dailyVolatility: 0
        }
      },
      aiDecisionAnalysis: this.createEmptyAIDecisionAnalysis(),
      ruleOptimizationSuggestions: {
        ma60Rules: { currentThreshold: 3.0 },
        md60Rules: {
          currentMomentumThresholds: { strong: 15, moderate: 5, consolidation: 5 }
        },
        positionSizing: { currentMaxPosition: 20 },
        stopLossRules: { currentInitialStop: 8, currentTrailingStop: 3 }
      },
      tomorrowStrategySuggestions: {
        marketOutlook: 'neutral',
        suggestedAssetAllocation: { stocks: 0, bonds: 0, commodities: 0, cash: 100 },
        keySectorsToWatch: [],
        riskWarnings: [`复盘任务执行失败: ${errorMessage}`],
        tradingFocus: 'defensive'
      },
      summary: {
        analysisDurationMs,
        dataSourcesUsed: [],
        reviewDepth: this.config.postMarketReview.analysisDepth
      }
    };
  }
}