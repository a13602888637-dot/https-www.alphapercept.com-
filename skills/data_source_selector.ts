/**
 * Alpha-Quant-Copilot 智能数据源选择器
 * 多数据源智能路由、健康检查、故障切换系统
 */

import { MarketData } from './data_crawler';

// 数据源类型定义
export enum DataSourceType {
  SINA = 'sina',
  TENCENT = 'tencent',
  YAHOO = 'yahoo',
  SIMULATED = 'simulated'
}

// 数据源配置接口
export interface DataSourceConfig {
  type: DataSourceType;
  name: string;
  enabled: boolean;
  priority: number; // 初始优先级 (1-100)
  weight: number; // 智能路由权重 (0-100)
  timeout: number; // 超时时间 (ms)
  retryCount: number; // 重试次数
  healthCheckInterval: number; // 健康检查间隔 (ms)
  region: string; // 区域 (cn, global)
  endpoints: string[]; // 备用端点
}

// 数据源性能统计
export interface DataSourceStats {
  type: DataSourceType;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalLatency: number; // 总延迟 (ms)
  avgLatency: number; // 平均延迟 (ms)
  lastResponseTime: number; // 最后响应时间 (ms)
  lastSuccessTime: number; // 最后成功时间
  lastFailureTime: number; // 最后失败时间
  consecutiveFailures: number; // 连续失败次数
  healthScore: number; // 健康度评分 (0-100)
  regionPerformance: Record<string, number>; // 区域性能评分
}

// 智能路由决策
export interface RoutingDecision {
  selectedSource: DataSourceType;
  backupSources: DataSourceType[];
  reason: string;
  confidence: number; // 置信度 (0-1)
  estimatedLatency: number; // 预估延迟 (ms)
}

// 健康检查结果
export interface HealthCheckResult {
  source: DataSourceType;
  isHealthy: boolean;
  latency: number;
  timestamp: Date;
  error?: string;
}

// 地理位置信息（简化版）
export interface GeoLocation {
  country: string;
  region: string;
  city?: string;
  timezone: string;
  estimatedLatency: Record<string, number>; // 到各数据源的预估延迟
}

/**
 * 智能数据源管理器
 */
export class DataSourceManager {
  private configs: Map<DataSourceType, DataSourceConfig>;
  private stats: Map<DataSourceType, DataSourceStats>;
  private healthChecks: Map<DataSourceType, HealthCheckResult>;
  private geoLocation: GeoLocation | null;
  private lastRoutingDecision: RoutingDecision | null;

  // 性能监控窗口
  private readonly STATS_WINDOW_SIZE = 100; // 统计窗口大小
  private readonly HEALTH_CHECK_THRESHOLD = 3; // 连续失败阈值
  private readonly LATENCY_PENALTY_FACTOR = 1.5; // 延迟惩罚因子

  constructor() {
    this.configs = new Map();
    this.stats = new Map();
    this.healthChecks = new Map();
    this.geoLocation = null;
    this.lastRoutingDecision = null;

    this.initializeDefaultConfigs();
    this.initializeStats();
  }

  /**
   * 初始化默认数据源配置
   */
  private initializeDefaultConfigs(): void {
    // 新浪数据源配置
    this.configs.set(DataSourceType.SINA, {
      type: DataSourceType.SINA,
      name: '新浪财经API',
      enabled: true,
      priority: 90,
      weight: 85,
      timeout: 10000,
      retryCount: 3,
      healthCheckInterval: 30000, // 30秒
      region: 'cn',
      endpoints: ['http://hq.sinajs.cn']
    });

    // 腾讯数据源配置
    this.configs.set(DataSourceType.TENCENT, {
      type: DataSourceType.TENCENT,
      name: '腾讯财经API',
      enabled: true,
      priority: 80,
      weight: 75,
      timeout: 10000,
      retryCount: 3,
      healthCheckInterval: 30000,
      region: 'cn',
      endpoints: ['https://qt.gtimg.cn']
    });

    // 雅虎财经数据源配置
    this.configs.set(DataSourceType.YAHOO, {
      type: DataSourceType.YAHOO,
      name: '雅虎财经API',
      enabled: true,
      priority: 70,
      weight: 65,
      timeout: 15000,
      retryCount: 2,
      healthCheckInterval: 45000, // 45秒
      region: 'global',
      endpoints: ['https://query1.finance.yahoo.com']
    });

    // 模拟数据源配置
    this.configs.set(DataSourceType.SIMULATED, {
      type: DataSourceType.SIMULATED,
      name: '模拟数据源',
      enabled: true,
      priority: 10,
      weight: 5,
      timeout: 100,
      retryCount: 0,
      healthCheckInterval: 60000, // 60秒
      region: 'local',
      endpoints: ['local']
    });
  }

  /**
   * 初始化统计数据
   */
  private initializeStats(): void {
    for (const [type, config] of this.configs) {
      this.stats.set(type, {
        type,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalLatency: 0,
        avgLatency: 0,
        lastResponseTime: 0,
        lastSuccessTime: Date.now(),
        lastFailureTime: 0,
        consecutiveFailures: 0,
        healthScore: 100,
        regionPerformance: {}
      });
    }
  }

  /**
   * 更新数据源配置
   */
  updateConfig(type: DataSourceType, config: Partial<DataSourceConfig>): void {
    const existingConfig = this.configs.get(type);
    if (existingConfig) {
      this.configs.set(type, { ...existingConfig, ...config });
    }
  }

  /**
   * 启用/禁用数据源
   */
  setDataSourceEnabled(type: DataSourceType, enabled: boolean): void {
    const config = this.configs.get(type);
    if (config) {
      config.enabled = enabled;
      this.configs.set(type, config);
    }
  }

  /**
   * 记录请求结果
   */
  recordRequestResult(
    type: DataSourceType,
    success: boolean,
    latency: number,
    region?: string
  ): void {
    const stat = this.stats.get(type);
    if (!stat) return;

    stat.totalRequests++;
    stat.lastResponseTime = latency;
    stat.totalLatency += latency;
    stat.avgLatency = stat.totalLatency / stat.totalRequests;

    if (success) {
      stat.successfulRequests++;
      stat.lastSuccessTime = Date.now();
      stat.consecutiveFailures = 0;

      // 更新区域性能
      if (region) {
        if (!stat.regionPerformance[region]) {
          stat.regionPerformance[region] = 0;
        }
        // 简单的性能评分：延迟越低，评分越高
        const performanceScore = Math.max(0, 100 - (latency / 100));
        stat.regionPerformance[region] =
          (stat.regionPerformance[region] * 0.7 + performanceScore * 0.3);
      }
    } else {
      stat.failedRequests++;
      stat.lastFailureTime = Date.now();
      stat.consecutiveFailures++;
    }

    // 计算健康度评分
    stat.healthScore = this.calculateHealthScore(stat);

    this.stats.set(type, stat);
  }

  /**
   * 计算健康度评分
   */
  private calculateHealthScore(stat: DataSourceStats): number {
    let score = 100;

    // 成功率权重: 40%
    const successRate = stat.totalRequests > 0
      ? stat.successfulRequests / stat.totalRequests
      : 1;
    score *= successRate * 0.4;

    // 平均延迟权重: 30%
    const latencyPenalty = Math.min(1, stat.avgLatency / 5000); // 5秒为最大惩罚
    score *= (1 - latencyPenalty * 0.3);

    // 连续失败惩罚: 30%
    const failurePenalty = Math.min(1, stat.consecutiveFailures / this.HEALTH_CHECK_THRESHOLD);
    score *= (1 - failurePenalty * 0.3);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(type: DataSourceType): Promise<HealthCheckResult> {
    const config = this.configs.get(type);
    if (!config || !config.enabled) {
      return {
        source: type,
        isHealthy: false,
        latency: 0,
        timestamp: new Date(),
        error: 'DataSource disabled or not configured'
      };
    }

    const startTime = Date.now();
    let isHealthy = false;
    let latency = 0;
    let error: string | undefined;

    try {
      // 根据数据源类型执行不同的健康检查
      switch (type) {
        case DataSourceType.SINA:
          isHealthy = await this.checkSinaHealth();
          break;
        case DataSourceType.TENCENT:
          isHealthy = await this.checkTencentHealth();
          break;
        case DataSourceType.YAHOO:
          isHealthy = await this.checkYahooHealth();
          break;
        case DataSourceType.SIMULATED:
          isHealthy = true; // 模拟数据源总是健康的
          break;
        default:
          isHealthy = false;
          error = `Unknown data source type: ${type}`;
      }

      latency = Date.now() - startTime;

      // 记录健康检查结果
      const result: HealthCheckResult = {
        source: type,
        isHealthy,
        latency,
        timestamp: new Date(),
        error
      };

      this.healthChecks.set(type, result);

      // 更新统计数据
      this.recordRequestResult(type, isHealthy, latency);

      return result;

    } catch (err) {
      latency = Date.now() - startTime;
      const result: HealthCheckResult = {
        source: type,
        isHealthy: false,
        latency,
        timestamp: new Date(),
        error: err instanceof Error ? err.message : String(err)
      };

      this.healthChecks.set(type, result);
      this.recordRequestResult(type, false, latency);

      return result;
    }
  }

  /**
   * 检查新浪API健康状态
   */
  private async checkSinaHealth(): Promise<boolean> {
    try {
      const testSymbol = 'sh000001'; // 上证指数
      const url = `http://hq.sinajs.cn/list=${testSymbol}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://finance.sina.com.cn'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const text = await response.text();
      // 简单验证响应格式
      return text.includes('var hq_str') || text.includes('=');

    } catch {
      return false;
    }
  }

  /**
   * 检查腾讯API健康状态
   */
  private async checkTencentHealth(): Promise<boolean> {
    try {
      const testSymbol = 'sh000001';
      const url = `https://qt.gtimg.cn/q=${testSymbol}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const text = await response.text();
      return text.includes('v_sh') || text.includes('=');

    } catch {
      return false;
    }
  }

  /**
   * 检查雅虎API健康状态
   */
  private async checkYahooHealth(): Promise<boolean> {
    try {
      const testSymbol = '000001.SS';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${testSymbol}?interval=1d&range=1d`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.chart && data.chart.result;

    } catch {
      return false;
    }
  }

  /**
   * 批量健康检查
   */
  async performBatchHealthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const enabledSources = Array.from(this.configs.values())
      .filter(config => config.enabled)
      .map(config => config.type);

    // 并行执行健康检查
    const promises = enabledSources.map(source =>
      this.performHealthCheck(source)
    );

    const checkResults = await Promise.allSettled(promises);

    for (let i = 0; i < checkResults.length; i++) {
      const result = checkResults[i];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          source: enabledSources[i],
          isHealthy: false,
          latency: 0,
          timestamp: new Date(),
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });
      }
    }

    return results;
  }

  /**
   * 智能路由决策
   */
  makeRoutingDecision(symbol?: string, forceRegion?: string): RoutingDecision {
    const enabledSources = Array.from(this.configs.values())
      .filter(config => config.enabled)
      .map(config => config.type);

    if (enabledSources.length === 0) {
      return {
        selectedSource: DataSourceType.SIMULATED,
        backupSources: [],
        reason: 'No enabled data sources available',
        confidence: 0,
        estimatedLatency: 100
      };
    }

    // 计算每个数据源的得分
    const sourceScores = new Map<DataSourceType, number>();

    for (const source of enabledSources) {
      const config = this.configs.get(source)!;
      const stat = this.stats.get(source)!;
      const healthCheck = this.healthChecks.get(source);

      let score = 0;

      // 1. 基础优先级权重 (30%)
      score += config.priority * 0.3;

      // 2. 健康度权重 (40%)
      score += stat.healthScore * 0.4;

      // 3. 最近健康检查结果 (20%)
      if (healthCheck) {
        const healthCheckWeight = healthCheck.isHealthy ? 20 : 0;
        score += healthCheckWeight;
      }

      // 4. 区域优化 (10%)
      const regionScore = this.calculateRegionScore(source, forceRegion);
      score += regionScore * 10;

      // 5. 符号特定优化（如果有符号）
      if (symbol) {
        const symbolScore = this.calculateSymbolScore(source, symbol);
        score += symbolScore * 5;
      }

      sourceScores.set(source, score);
    }

    // 按得分排序
    const sortedSources = Array.from(sourceScores.entries())
      .sort((a, b) => b[1] - a[1]);

    const selectedSource = sortedSources[0][0];
    const backupSources = sortedSources.slice(1, 3).map(([source]) => source);

    // 计算置信度
    const topScore = sortedSources[0][1];
    const secondScore = sortedSources[1]?.[1] || 0;
    const confidence = secondScore > 0
      ? Math.min(1, (topScore - secondScore) / topScore * 2)
      : 1;

    // 预估延迟
    const selectedStat = this.stats.get(selectedSource)!;
    const estimatedLatency = selectedStat.avgLatency || 1000;

    const decision: RoutingDecision = {
      selectedSource,
      backupSources,
      reason: this.generateRoutingReason(selectedSource, sortedSources),
      confidence: Math.max(0.1, Math.min(1, confidence)),
      estimatedLatency
    };

    this.lastRoutingDecision = decision;
    return decision;
  }

  /**
   * 计算区域得分
   */
  private calculateRegionScore(source: DataSourceType, forceRegion?: string): number {
    const config = this.configs.get(source)!;
    const stat = this.stats.get(source)!;

    // 如果强制指定区域，检查匹配度
    if (forceRegion) {
      return config.region === forceRegion ? 1 : 0;
    }

    // 自动检测区域（简化版）
    // 在实际应用中，这里应该使用IP地理位置检测
    const currentRegion = this.geoLocation?.region || 'cn';

    if (config.region === 'global') {
      return 0.8; // 全球数据源在任何区域都有一定可用性
    }

    return config.region === currentRegion ? 1 : 0.3;
  }

  /**
   * 计算符号特定得分
   */
  private calculateSymbolScore(source: DataSourceType, symbol: string): number {
    // 根据数据源对特定符号的支持程度评分
    switch (source) {
      case DataSourceType.SINA:
      case DataSourceType.TENCENT:
        // 新浪和腾讯主要支持A股
        if (symbol.startsWith('6') || symbol.startsWith('0') || symbol.startsWith('3')) {
          return 1;
        }
        if (symbol.startsWith('sh') || symbol.startsWith('sz')) {
          return 1;
        }
        return 0.3;

      case DataSourceType.YAHOO:
        // 雅虎支持全球股票
        return 0.8;

      case DataSourceType.SIMULATED:
        // 模拟数据源支持所有符号
        return 0.5;

      default:
        return 0.5;
    }
  }

  /**
   * 生成路由原因
   */
  private generateRoutingReason(
    selectedSource: DataSourceType,
    sortedSources: [DataSourceType, number][]
  ): string {
    const reasons: string[] = [];
    const selectedScore = sortedSources[0][1];
    const secondScore = sortedSources[1]?.[1] || 0;

    reasons.push(`Selected ${selectedSource} with score ${selectedScore.toFixed(1)}`);

    if (secondScore > 0) {
      const scoreDiff = selectedScore - secondScore;
      if (scoreDiff > 20) {
        reasons.push('Significantly outperforms alternatives');
      } else if (scoreDiff > 5) {
        reasons.push('Moderately better than alternatives');
      } else {
        reasons.push('Slightly better than alternatives');
      }
    }

    const healthCheck = this.healthChecks.get(selectedSource);
    if (healthCheck?.isHealthy) {
      reasons.push('Recent health check passed');
    }

    const stat = this.stats.get(selectedSource);
    if (stat && stat.healthScore > 80) {
      reasons.push('High health score');
    }

    return reasons.join('. ');
  }

  /**
   * 获取数据源统计信息
   */
  getDataSourceStats(type?: DataSourceType): DataSourceStats | DataSourceStats[] {
    if (type) {
      return this.stats.get(type) || this.createEmptyStats(type);
    }
    return Array.from(this.stats.values());
  }

  /**
   * 获取健康检查结果
   */
  getHealthCheckResults(type?: DataSourceType): HealthCheckResult | HealthCheckResult[] {
    if (type) {
      return this.healthChecks.get(type) || this.createEmptyHealthCheck(type);
    }
    return Array.from(this.healthChecks.values());
  }

  /**
   * 获取最后的路由决策
   */
  getLastRoutingDecision(): RoutingDecision | null {
    return this.lastRoutingDecision;
  }

  /**
   * 获取所有数据源配置
   */
  getAllConfigs(): DataSourceConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * 设置地理位置信息
   */
  setGeoLocation(location: GeoLocation): void {
    this.geoLocation = location;
  }

  /**
   * 获取地理位置信息
   */
  getGeoLocation(): GeoLocation | null {
    return this.geoLocation;
  }

  /**
   * 重置统计数据
   */
  resetStats(type?: DataSourceType): void {
    if (type) {
      const stat = this.stats.get(type);
      if (stat) {
        this.stats.set(type, this.createEmptyStats(type));
      }
    } else {
      this.initializeStats();
    }
  }

  /**
   * 创建空的统计数据
   */
  private createEmptyStats(type: DataSourceType): DataSourceStats {
    return {
      type,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      avgLatency: 0,
      lastResponseTime: 0,
      lastSuccessTime: Date.now(),
      lastFailureTime: 0,
      consecutiveFailures: 0,
      healthScore: 100,
      regionPerformance: {}
    };
  }

  /**
   * 创建空的健康检查结果
   */
  private createEmptyHealthCheck(type: DataSourceType): HealthCheckResult {
    return {
      source: type,
      isHealthy: false,
      latency: 0,
      timestamp: new Date(),
      error: 'No health check performed'
    };
  }

  /**
   * 导出配置到JSON
   */
  exportConfig(): string {
    const config = {
      dataSources: this.getAllConfigs(),
      stats: this.getDataSourceStats(),
      healthChecks: this.getHealthCheckResults(),
      lastRoutingDecision: this.getLastRoutingDecision(),
      geoLocation: this.getGeoLocation(),
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(config, null, 2);
  }

  /**
   * 从JSON导入配置
   */
  importConfig(json: string): void {
    try {
      const config = JSON.parse(json);

      if (config.dataSources && Array.isArray(config.dataSources)) {
        for (const sourceConfig of config.dataSources) {
          if (sourceConfig.type && this.configs.has(sourceConfig.type)) {
            this.updateConfig(sourceConfig.type, sourceConfig);
          }
        }
      }

      // 注意：不导入统计数据，保持运行时统计

    } catch (error) {
      console.error('Failed to import config:', error);
    }
  }
}

/**
 * 智能数据源选择器（主接口）
 */
export class SmartDataSourceSelector {
  private manager: DataSourceManager;
  private isHealthCheckRunning: boolean;
  private healthCheckInterval: NodeJS.Timeout | null;

  constructor() {
    this.manager = new DataSourceManager();
    this.isHealthCheckRunning = false;
    this.healthCheckInterval = null;

    // 启动定期健康检查
    this.startPeriodicHealthCheck();
  }

  /**
   * 启动定期健康检查
   */
  startPeriodicHealthCheck(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.isHealthCheckRunning) {
        this.isHealthCheckRunning = true;
        try {
          await this.manager.performBatchHealthCheck();
        } catch (error) {
          console.error('Periodic health check failed:', error);
        } finally {
          this.isHealthCheckRunning = false;
        }
      }
    }, intervalMs);
  }

  /**
   * 停止定期健康检查
   */
  stopPeriodicHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * 选择最佳数据源
   */
  selectBestDataSource(symbol?: string, region?: string): RoutingDecision {
    return this.manager.makeRoutingDecision(symbol, region);
  }

  /**
   * 执行数据获取（智能路由）
   */
  async fetchWithSmartRouting<T>(
    fetchFunctions: Record<DataSourceType, () => Promise<T>>,
    symbol?: string,
    maxRetries: number = 3
  ): Promise<T> {
    const decision = this.selectBestDataSource(symbol);
    const sourcesToTry = [decision.selectedSource, ...decision.backupSources];

    let lastError: Error | null = null;

    for (let i = 0; i < Math.min(sourcesToTry.length, maxRetries); i++) {
      const source = sourcesToTry[i];
      const fetchFunction = fetchFunctions[source];

      if (!fetchFunction) {
        console.warn(`No fetch function for data source: ${source}`);
        continue;
      }

      const startTime = Date.now();

      try {
        const result = await fetchFunction();
        const latency = Date.now() - startTime;

        // 记录成功结果
        this.manager.recordRequestResult(source, true, latency);

        return result;

      } catch (error) {
        const latency = Date.now() - startTime;

        // 记录失败结果
        this.manager.recordRequestResult(source, false, latency);

        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Data source ${source} failed:`, lastError.message);

        if (i < sourcesToTry.length - 1) {
          console.log(`Trying next data source: ${sourcesToTry[i + 1]}`);
        }
      }
    }

    // 所有数据源都失败，尝试模拟数据源
    const simulatedFetch = fetchFunctions[DataSourceType.SIMULATED];
    if (simulatedFetch) {
      try {
        const result = await simulatedFetch();
        this.manager.recordRequestResult(DataSourceType.SIMULATED, true, 0);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError || new Error('All data sources failed');
  }

  /**
   * 获取管理器实例（用于高级操作）
   */
  getManager(): DataSourceManager {
    return this.manager;
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    const stats = this.manager.getDataSourceStats() as DataSourceStats[];
    const healthChecks = this.manager.getHealthCheckResults() as HealthCheckResult[];
    const lastDecision = this.manager.getLastRoutingDecision();

    let report = '=== Data Source Performance Report ===\n\n';

    // 数据源统计
    report += 'Data Source Statistics:\n';
    report += '----------------------\n';

    for (const stat of stats) {
      const successRate = stat.totalRequests > 0
        ? (stat.successfulRequests / stat.totalRequests * 100).toFixed(1)
        : 'N/A';

      report += `${stat.type}:\n`;
      report += `  Total Requests: ${stat.totalRequests}\n`;
      report += `  Success Rate: ${successRate}%\n`;
      report += `  Avg Latency: ${stat.avgLatency.toFixed(0)}ms\n`;
      report += `  Health Score: ${stat.healthScore.toFixed(1)}\n`;
      report += `  Consecutive Failures: ${stat.consecutiveFailures}\n`;
      report += '\n';
    }

    // 健康检查状态
    report += 'Health Check Status:\n';
    report += '-------------------\n';

    for (const check of healthChecks) {
      const status = check.isHealthy ? '✅ Healthy' : '❌ Unhealthy';
      report += `${check.source}: ${status} (${check.latency}ms)\n`;
      if (check.error) {
        report += `  Error: ${check.error}\n`;
      }
    }

    report += '\n';

    // 最后路由决策
    if (lastDecision) {
      report += 'Last Routing Decision:\n';
      report += '---------------------\n';
      report += `Selected: ${lastDecision.selectedSource}\n`;
      report += `Backups: ${lastDecision.backupSources.join(', ')}\n`;
      report += `Confidence: ${(lastDecision.confidence * 100).toFixed(1)}%\n`;
      report += `Estimated Latency: ${lastDecision.estimatedLatency}ms\n`;
      report += `Reason: ${lastDecision.reason}\n`;
    }

    report += '\n=== End of Report ===\n';

    return report;
  }

  /**
   * 销毁选择器（清理资源）
   */
  destroy(): void {
    this.stopPeriodicHealthCheck();
  }
}

// 导出单例实例
export const dataSourceSelector = new SmartDataSourceSelector();