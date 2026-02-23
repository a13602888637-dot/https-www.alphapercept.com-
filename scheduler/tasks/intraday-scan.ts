/**
 * Alpha-Quant-Copilot 盘中热点扫描任务
 * 每小时执行一次，扫描涨幅榜、成交量异动、MA60突破信号
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchMultipleStocks, MarketData } from '../../skills/data_crawler';
import { SchedulerConfig, isTradingTime, isTradingDay } from '../config/scheduler.config';
import { Logger } from '../utils/logger';

// 扫描结果接口
export interface IntradayScanResult {
  timestamp: string;
  scanType: 'intraday';
  marketStatus: 'open' | 'closed' | 'non_trading_day';

  // 涨幅榜分析
  topGainers: {
    symbol: string;
    name: string;
    currentPrice: number;
    changePercent: number;
    volume: number;
    volumeRatio: number; // 成交量比（今日/20日均量）
    ma60Status: 'above' | 'below' | 'breakthrough';
    ma60Distance: number; // 距离MA60的百分比
  }[];

  // 成交量异动
  volumeAnomalies: {
    symbol: string;
    name: string;
    volume: number;
    avgVolume20d: number;
    volumeRatio: number;
    priceChange: number;
    reason: 'breakout' | 'reversal' | 'news_driven';
  }[];

  // MA60突破信号
  ma60Breakthroughs: {
    symbol: string;
    name: string;
    currentPrice: number;
    ma60Price: number;
    breakthroughPercent: number;
    volumeConfirmation: boolean;
    trendConfirmation: boolean;
    signalStrength: 'weak' | 'moderate' | 'strong';
  }[];

  // 实时警报
  alerts: {
    level: 'info' | 'warning' | 'critical';
    symbol?: string;
    message: string;
    timestamp: string;
    action?: 'monitor' | 'consider_buy' | 'consider_sell';
  }[];

  // 统计摘要
  summary: {
    totalStocksScanned: number;
    topGainersCount: number;
    volumeAnomaliesCount: number;
    ma60BreakthroughsCount: number;
    criticalAlertsCount: number;
    scanDurationMs: number;
  };
}

// 模拟的MA60数据（实际应从数据库或API获取）
interface MA60Data {
  symbol: string;
  ma60Price: number;
  avgVolume20d: number;
  trend: 'up' | 'down' | 'sideways';
}

/**
 * 盘中热点扫描任务
 */
export class IntradayScanTask {
  private logger: Logger;
  private config: SchedulerConfig;

  constructor(config: SchedulerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * 执行扫描任务
   */
  async execute(): Promise<IntradayScanResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    this.logger.info('开始执行盘中热点扫描任务', { timestamp });

    // 检查市场状态
    const marketStatus = this.getMarketStatus();
    if (marketStatus !== 'open') {
      this.logger.info('非交易时间，跳过扫描', { marketStatus });
      return this.createEmptyResult(timestamp, marketStatus, 0);
    }

    try {
      // 1. 获取热门股票列表（实际应从数据源获取）
      const watchlist = this.getWatchlist();
      this.logger.info(`获取到 ${watchlist.length} 只股票进行扫描`);

      // 2. 获取实时数据
      const marketData = await this.fetchMarketData(watchlist);
      this.logger.info(`成功获取 ${marketData.length} 只股票的实时数据`);

      // 3. 获取技术指标数据（模拟）
      const technicalData = this.getTechnicalData(marketData);

      // 4. 执行各项分析
      const topGainers = this.analyzeTopGainers(marketData, technicalData);
      const volumeAnomalies = this.analyzeVolumeAnomalies(marketData, technicalData);
      const ma60Breakthroughs = this.analyzeMA60Breakthroughs(marketData, technicalData);
      const alerts = this.generateAlerts(topGainers, volumeAnomalies, ma60Breakthroughs);

      // 5. 生成结果
      const scanDurationMs = Date.now() - startTime;
      const result: IntradayScanResult = {
        timestamp,
        scanType: 'intraday',
        marketStatus,
        topGainers,
        volumeAnomalies,
        ma60Breakthroughs,
        alerts,
        summary: {
          totalStocksScanned: marketData.length,
          topGainersCount: topGainers.length,
          volumeAnomaliesCount: volumeAnomalies.length,
          ma60BreakthroughsCount: ma60Breakthroughs.length,
          criticalAlertsCount: alerts.filter(a => a.level === 'critical').length,
          scanDurationMs
        }
      };

      this.logger.info('盘中热点扫描任务完成', {
        duration: scanDurationMs,
        topGainers: topGainers.length,
        volumeAnomalies: volumeAnomalies.length,
        ma60Breakthroughs: ma60Breakthroughs.length,
        alerts: alerts.length
      });

      // 6. 保存结果
      await this.saveResult(result);

      return result;

    } catch (error) {
      this.logger.error('盘中热点扫描任务执行失败', { error: error.message });
      return this.createErrorResult(timestamp, marketStatus, error.message, Date.now() - startTime);
    }
  }

  /**
   * 获取市场状态
   */
  private getMarketStatus(): 'open' | 'closed' | 'non_trading_day' {
    if (!isTradingDay()) {
      return 'non_trading_day';
    }
    if (!isTradingTime(this.config)) {
      return 'closed';
    }
    return 'open';
  }

  /**
   * 获取监控股票列表
   */
  private getWatchlist(): string[] {
    // 实际应从数据库或配置文件获取
    // 这里返回一些代表性的A股代码
    return [
      '000001', // 平安银行
      '000002', // 万科A
      '000858', // 五粮液
      '002415', // 海康威视
      '300750', // 宁德时代
      '600000', // 浦发银行
      '600036', // 招商银行
      '600519', // 贵州茅台
      '601318', // 中国平安
      '601857', // 中国石油
      // 可以添加更多...
    ];
  }

  /**
   * 获取市场数据
   */
  private async fetchMarketData(symbols: string[]): Promise<MarketData[]> {
    try {
      return await fetchMultipleStocks(symbols);
    } catch (error) {
      this.logger.error('获取市场数据失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 获取技术指标数据（模拟）
   */
  private getTechnicalData(marketData: MarketData[]): Map<string, MA60Data> {
    const technicalData = new Map<string, MA60Data>();

    for (const stock of marketData) {
      // 模拟MA60价格（实际价格 ± 随机波动）
      const ma60Price = stock.currentPrice * (0.95 + Math.random() * 0.1);
      // 模拟20日平均成交量（今日成交量的0.5-1.5倍）
      const avgVolume20d = stock.volume ? stock.volume * (0.5 + Math.random()) : 1000000;
      // 模拟趋势
      const trends: Array<'up' | 'down' | 'sideways'> = ['up', 'down', 'sideways'];
      const trend = trends[Math.floor(Math.random() * trends.length)];

      technicalData.set(stock.symbol, {
        symbol: stock.symbol,
        ma60Price,
        avgVolume20d,
        trend
      });
    }

    return technicalData;
  }

  /**
   * 分析涨幅榜
   */
  private analyzeTopGainers(
    marketData: MarketData[],
    technicalData: Map<string, MA60Data>
  ): IntradayScanResult['topGainers'] {
    // 按涨幅排序
    const sortedByGain = [...marketData]
      .filter(stock => stock.changePercent !== undefined)
      .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
      .slice(0, this.config.intradayScan.topGainersCount);

    return sortedByGain.map(stock => {
      const techData = technicalData.get(stock.symbol);
      const volumeRatio = stock.volume && techData?.avgVolume20d
        ? stock.volume / techData.avgVolume20d
        : 1;

      // 判断MA60状态
      let ma60Status: 'above' | 'below' | 'breakthrough' = 'below';
      let ma60Distance = 0;

      if (techData) {
        ma60Distance = ((stock.currentPrice - techData.ma60Price) / techData.ma60Price) * 100;

        if (Math.abs(ma60Distance) < 1) {
          ma60Status = 'breakthrough'; // 在MA60附近
        } else if (ma60Distance > 0) {
          ma60Status = 'above'; // 在MA60之上
        } else {
          ma60Status = 'below'; // 在MA60之下
        }
      }

      return {
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: stock.currentPrice,
        changePercent: stock.changePercent || 0,
        volume: stock.volume || 0,
        volumeRatio,
        ma60Status,
        ma60Distance: parseFloat(ma60Distance.toFixed(2))
      };
    });
  }

  /**
   * 分析成交量异动
   */
  private analyzeVolumeAnomalies(
    marketData: MarketData[],
    technicalData: Map<string, MA60Data>
  ): IntradayScanResult['volumeAnomalies'] {
    const anomalies: IntradayScanResult['volumeAnomalies'] = [];

    for (const stock of marketData) {
      const techData = technicalData.get(stock.symbol);
      if (!techData || !stock.volume) continue;

      const volumeRatio = stock.volume / techData.avgVolume20d;

      // 检查是否达到成交量阈值
      if (volumeRatio >= this.config.intradayScan.volumeThreshold) {
        let reason: 'breakout' | 'reversal' | 'news_driven' = 'breakout';

        // 简单判断异动原因
        if (stock.changePercent && Math.abs(stock.changePercent) > 5) {
          reason = stock.changePercent > 0 ? 'breakout' : 'reversal';
        } else {
          reason = 'news_driven';
        }

        anomalies.push({
          symbol: stock.symbol,
          name: stock.name,
          volume: stock.volume,
          avgVolume20d: techData.avgVolume20d,
          volumeRatio: parseFloat(volumeRatio.toFixed(2)),
          priceChange: stock.changePercent || 0,
          reason
        });
      }
    }

    return anomalies;
  }

  /**
   * 分析MA60突破信号
   */
  private analyzeMA60Breakthroughs(
    marketData: MarketData[],
    technicalData: Map<string, MA60Data>
  ): IntradayScanResult['ma60Breakthroughs'] {
    const breakthroughs: IntradayScanResult['ma60Breakthroughs'] = [];

    for (const stock of marketData) {
      const techData = technicalData.get(stock.symbol);
      if (!techData) continue;

      const breakthroughPercent = ((stock.currentPrice - techData.ma60Price) / techData.ma60Price) * 100;
      const absBreakthrough = Math.abs(breakthroughPercent);

      // 检查是否达到突破阈值
      if (absBreakthrough >= this.config.intradayScan.ma60BreakThreshold) {
        const volumeConfirmation = stock.volume ?
          stock.volume >= techData.avgVolume20d * 1.5 : false;

        const trendConfirmation = (breakthroughPercent > 0 && techData.trend === 'up') ||
                                 (breakthroughPercent < 0 && techData.trend === 'down');

        // 判断信号强度
        let signalStrength: 'weak' | 'moderate' | 'strong' = 'weak';
        if (volumeConfirmation && trendConfirmation) {
          signalStrength = 'strong';
        } else if (volumeConfirmation || trendConfirmation) {
          signalStrength = 'moderate';
        }

        breakthroughs.push({
          symbol: stock.symbol,
          name: stock.name,
          currentPrice: stock.currentPrice,
          ma60Price: techData.ma60Price,
          breakthroughPercent: parseFloat(breakthroughPercent.toFixed(2)),
          volumeConfirmation,
          trendConfirmation,
          signalStrength
        });
      }
    }

    return breakthroughs;
  }

  /**
   * 生成实时警报
   */
  private generateAlerts(
    topGainers: IntradayScanResult['topGainers'],
    volumeAnomalies: IntradayScanResult['volumeAnomalies'],
    ma60Breakthroughs: IntradayScanResult['ma60Breakthroughs']
  ): IntradayScanResult['alerts'] {
    const alerts: IntradayScanResult['alerts'] = [];
    const timestamp = new Date().toISOString();

    // 1. 涨幅榜异常警报
    const extremeGainers = topGainers.filter(g => g.changePercent > 9.5); // 接近涨停
    for (const gainer of extremeGainers) {
      alerts.push({
        level: 'warning',
        symbol: gainer.symbol,
        message: `${gainer.name}(${gainer.symbol}) 涨幅接近涨停: ${gainer.changePercent.toFixed(2)}%`,
        timestamp,
        action: 'monitor'
      });
    }

    // 2. 成交量异常警报
    const extremeVolume = volumeAnomalies.filter(v => v.volumeRatio > 5);
    for (const anomaly of extremeVolume) {
      alerts.push({
        level: 'warning',
        symbol: anomaly.symbol,
        message: `${anomaly.name}(${anomaly.symbol}) 成交量异常放大: ${anomaly.volumeRatio.toFixed(1)}倍`,
        timestamp,
        action: 'monitor'
      });
    }

    // 3. MA60强势突破警报
    const strongBreakthroughs = ma60Breakthroughs.filter(b =>
      b.signalStrength === 'strong' && Math.abs(b.breakthroughPercent) > 5
    );
    for (const breakthrough of strongBreakthroughs) {
      const direction = breakthrough.breakthroughPercent > 0 ? '向上' : '向下';
      alerts.push({
        level: breakthrough.breakthroughPercent > 0 ? 'warning' : 'critical',
        symbol: breakthrough.symbol,
        message: `${breakthrough.name}(${breakthrough.symbol}) MA60${direction}强势突破: ${breakthrough.breakthroughPercent.toFixed(2)}%`,
        timestamp,
        action: breakthrough.breakthroughPercent > 0 ? 'consider_buy' : 'consider_sell'
      });
    }

    // 4. 综合警报
    if (alerts.length === 0) {
      alerts.push({
        level: 'info',
        message: '盘中扫描未发现显著异常信号',
        timestamp
      });
    }

    return alerts;
  }

  /**
   * 保存扫描结果
   */
  private async saveResult(result: IntradayScanResult): Promise<void> {
    try {
      const logsDir = path.join(process.cwd(), 'scheduler', 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const date = new Date().toISOString().split('T')[0];
      const filename = `intraday-scan-${date}.json`;
      const filepath = path.join(logsDir, filename);

      // 读取现有数据或创建新文件
      let existingData: IntradayScanResult[] = [];
      if (fs.existsSync(filepath)) {
        try {
          const fileContent = fs.readFileSync(filepath, 'utf-8');
          existingData = JSON.parse(fileContent);
        } catch (error) {
          this.logger.warn('无法读取现有日志文件，将创建新文件', { error: error.message });
        }
      }

      // 添加新结果
      existingData.push(result);

      // 保存文件
      fs.writeFileSync(filepath, JSON.stringify(existingData, null, 2), 'utf-8');
      this.logger.info('扫描结果已保存', { filename });

    } catch (error) {
      this.logger.error('保存扫描结果失败', { error: error.message });
    }
  }

  /**
   * 创建空结果（用于非交易时间）
   */
  private createEmptyResult(
    timestamp: string,
    marketStatus: 'open' | 'closed' | 'non_trading_day',
    scanDurationMs: number
  ): IntradayScanResult {
    return {
      timestamp,
      scanType: 'intraday',
      marketStatus,
      topGainers: [],
      volumeAnomalies: [],
      ma60Breakthroughs: [],
      alerts: [{
        level: 'info',
        message: `市场状态: ${marketStatus === 'open' ? '交易中' : marketStatus === 'closed' ? '已收盘' : '非交易日'}`,
        timestamp
      }],
      summary: {
        totalStocksScanned: 0,
        topGainersCount: 0,
        volumeAnomaliesCount: 0,
        ma60BreakthroughsCount: 0,
        criticalAlertsCount: 0,
        scanDurationMs
      }
    };
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    timestamp: string,
    marketStatus: 'open' | 'closed' | 'non_trading_day',
    errorMessage: string,
    scanDurationMs: number
  ): IntradayScanResult {
    return {
      timestamp,
      scanType: 'intraday',
      marketStatus,
      topGainers: [],
      volumeAnomalies: [],
      ma60Breakthroughs: [],
      alerts: [{
        level: 'critical',
        message: `扫描任务执行失败: ${errorMessage}`,
        timestamp
      }],
      summary: {
        totalStocksScanned: 0,
        topGainersCount: 0,
        volumeAnomaliesCount: 0,
        ma60BreakthroughsCount: 0,
        criticalAlertsCount: 1,
        scanDurationMs
      }
    };
  }
}