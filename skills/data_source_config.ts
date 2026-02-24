/**
 * Alpha-Quant-Copilot 数据源配置管理器
 * 支持动态配置、持久化存储、热更新
 */

import * as fs from 'fs';
import * as path from 'path';
import { DataSourceType, DataSourceConfig } from './data_source_selector';

// 配置文件路径
const CONFIG_FILE_PATH = path.join(process.cwd(), 'config', 'data_sources.json');
const BACKUP_DIR = path.join(process.cwd(), 'config', 'backups');

// 默认配置模板
const DEFAULT_CONFIG_TEMPLATE: DataSourceSystemConfig = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  dataSources: [
    {
      type: DataSourceType.SINA,
      name: '新浪财经API',
      enabled: true,
      priority: 90,
      weight: 85,
      timeout: 10000,
      retryCount: 3,
      healthCheckInterval: 30000,
      region: 'cn',
      endpoints: ['http://hq.sinajs.cn'],
      metadata: {
        description: '主要A股数据源，覆盖沪深股票',
        rateLimit: '无公开限制，建议1秒1次',
        dataFreshness: '实时（3-5秒延迟）',
        coverage: 'A股、指数、基金',
        reliability: '高（国内网络）'
      }
    },
    {
      type: DataSourceType.TENCENT,
      name: '腾讯财经API',
      enabled: true,
      priority: 80,
      weight: 75,
      timeout: 10000,
      retryCount: 3,
      healthCheckInterval: 30000,
      region: 'cn',
      endpoints: ['https://qt.gtimg.cn'],
      metadata: {
        description: '备用A股数据源',
        rateLimit: '无公开限制',
        dataFreshness: '实时（3-5秒延迟）',
        coverage: 'A股、指数',
        reliability: '高（国内网络）'
      }
    },
    {
      type: DataSourceType.YAHOO,
      name: '雅虎财经API',
      enabled: true,
      priority: 70,
      weight: 65,
      timeout: 15000,
      retryCount: 2,
      healthCheckInterval: 45000,
      region: 'global',
      endpoints: ['https://query1.finance.yahoo.com'],
      metadata: {
        description: '全球备用数据源，支持海外访问',
        rateLimit: '2000次/小时',
        dataFreshness: '15分钟延迟（免费版）',
        coverage: '全球股票、指数、基金',
        reliability: '中（依赖国际网络）'
      }
    },
    {
      type: DataSourceType.SIMULATED,
      name: '模拟数据源',
      enabled: true,
      priority: 10,
      weight: 5,
      timeout: 100,
      retryCount: 0,
      healthCheckInterval: 60000,
      region: 'local',
      endpoints: ['local'],
      metadata: {
        description: '最终降级数据源，返回模拟数据',
        rateLimit: '无限制',
        dataFreshness: '静态数据',
        coverage: '有限A股',
        reliability: '100%（本地）'
      }
    }
  ],
  routing: {
    strategy: 'smart', // smart, priority, round_robin, random
    enableGeoRouting: true,
    enableSymbolRouting: true,
    failoverThreshold: 3, // 连续失败次数阈值
    recoveryCheckInterval: 30000, // 恢复检查间隔
    maxRetries: 3,
    retryDelay: 1000, // 重试延迟（ms）
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5, // 熔断阈值
    circuitBreakerTimeout: 60000 // 熔断超时（ms）
  },
  monitoring: {
    enableStats: true,
    statsRetentionDays: 7,
    enableHealthChecks: true,
    healthCheckInterval: 60000,
    enableAlerting: false,
    alertThresholds: {
      successRate: 80, // 成功率阈值（%）
      avgLatency: 5000, // 平均延迟阈值（ms）
      consecutiveFailures: 3 // 连续失败阈值
    }
  },
  regions: {
    cn: {
      name: '中国',
      preferredSources: [DataSourceType.SINA, DataSourceType.TENCENT],
      fallbackSources: [DataSourceType.YAHOO, DataSourceType.SIMULATED],
      estimatedLatency: {
        sina: 100,
        tencent: 150,
        yahoo: 2000,
        simulated: 0
      }
    },
    global: {
      name: '全球',
      preferredSources: [DataSourceType.YAHOO],
      fallbackSources: [DataSourceType.SINA, DataSourceType.TENCENT, DataSourceType.SIMULATED],
      estimatedLatency: {
        sina: 2000,
        tencent: 2000,
        yahoo: 500,
        simulated: 0
      }
    }
  }
};

// 配置接口
export interface DataSourceRoutingConfig {
  strategy: 'smart' | 'priority' | 'round_robin' | 'random';
  enableGeoRouting: boolean;
  enableSymbolRouting: boolean;
  failoverThreshold: number;
  recoveryCheckInterval: number;
  maxRetries: number;
  retryDelay: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export interface MonitoringConfig {
  enableStats: boolean;
  statsRetentionDays: number;
  enableHealthChecks: boolean;
  healthCheckInterval: number;
  enableAlerting: boolean;
  alertThresholds: {
    successRate: number;
    avgLatency: number;
    consecutiveFailures: number;
  };
}

export interface RegionConfig {
  name: string;
  preferredSources: DataSourceType[];
  fallbackSources: DataSourceType[];
  estimatedLatency: Record<string, number>;
}

export interface DataSourceMetadata {
  description: string;
  rateLimit: string;
  dataFreshness: string;
  coverage: string;
  reliability: string;
}

export interface EnhancedDataSourceConfig extends DataSourceConfig {
  metadata: DataSourceMetadata;
}

export interface DataSourceSystemConfig {
  version: string;
  lastUpdated: string;
  dataSources: EnhancedDataSourceConfig[];
  routing: DataSourceRoutingConfig;
  monitoring: MonitoringConfig;
  regions: Record<string, RegionConfig>;
}

/**
 * 数据源配置管理器
 */
export class DataSourceConfigManager {
  private config: DataSourceSystemConfig;
  private configFilePath: string;
  private backupDir: string;
  private configWatcher: fs.FSWatcher | null;

  constructor(configPath: string = CONFIG_FILE_PATH) {
    this.configFilePath = configPath;
    this.backupDir = BACKUP_DIR;
    this.configWatcher = null;

    // 确保配置目录存在
    this.ensureConfigDirectory();

    // 加载配置
    this.config = this.loadConfig();

    // 启动配置监听
    this.startConfigWatching();
  }

  /**
   * 确保配置目录存在
   */
  private ensureConfigDirectory(): void {
    const configDir = path.dirname(this.configFilePath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 加载配置
   */
  private loadConfig(): DataSourceSystemConfig {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const configData = fs.readFileSync(this.configFilePath, 'utf-8');
        const loadedConfig = JSON.parse(configData);

        // 验证配置版本并合并默认值
        return this.validateAndMergeConfig(loadedConfig);
      } else {
        // 创建默认配置
        const defaultConfig = DEFAULT_CONFIG_TEMPLATE;
        this.saveConfig(defaultConfig);
        return defaultConfig;
      }
    } catch (error) {
      console.error('Failed to load config, using defaults:', error);
      return DEFAULT_CONFIG_TEMPLATE;
    }
  }

  /**
   * 验证并合并配置
   */
  private validateAndMergeConfig(loadedConfig: any): DataSourceSystemConfig {
    const defaultConfig = DEFAULT_CONFIG_TEMPLATE;

    // 基本验证
    if (!loadedConfig.version || !loadedConfig.dataSources) {
      console.warn('Invalid config format, using defaults');
      return defaultConfig;
    }

    // 合并配置，优先使用加载的配置
    const mergedConfig: DataSourceSystemConfig = {
      version: loadedConfig.version || defaultConfig.version,
      lastUpdated: loadedConfig.lastUpdated || new Date().toISOString(),
      dataSources: this.mergeDataSourceConfigs(
        defaultConfig.dataSources,
        loadedConfig.dataSources || []
      ),
      routing: { ...defaultConfig.routing, ...(loadedConfig.routing || {}) },
      monitoring: { ...defaultConfig.monitoring, ...(loadedConfig.monitoring || {}) },
      regions: { ...defaultConfig.regions, ...(loadedConfig.regions || {}) }
    };

    return mergedConfig;
  }

  /**
   * 合并数据源配置
   */
  private mergeDataSourceConfigs(
    defaults: EnhancedDataSourceConfig[],
    loaded: any[]
  ): EnhancedDataSourceConfig[] {
    const merged: EnhancedDataSourceConfig[] = [];

    // 首先处理默认配置
    for (const defaultConfig of defaults) {
      const loadedConfig = loaded.find(c => c.type === defaultConfig.type);

      if (loadedConfig) {
        // 合并配置，优先使用加载的配置
        merged.push({
          type: defaultConfig.type,
          name: loadedConfig.name || defaultConfig.name,
          enabled: loadedConfig.enabled !== undefined ? loadedConfig.enabled : defaultConfig.enabled,
          priority: loadedConfig.priority || defaultConfig.priority,
          weight: loadedConfig.weight || defaultConfig.weight,
          timeout: loadedConfig.timeout || defaultConfig.timeout,
          retryCount: loadedConfig.retryCount || defaultConfig.retryCount,
          healthCheckInterval: loadedConfig.healthCheckInterval || defaultConfig.healthCheckInterval,
          region: loadedConfig.region || defaultConfig.region,
          endpoints: loadedConfig.endpoints || defaultConfig.endpoints,
          metadata: { ...defaultConfig.metadata, ...(loadedConfig.metadata || {}) }
        });
      } else {
        merged.push(defaultConfig);
      }
    }

    // 添加加载配置中的新数据源
    for (const loadedConfig of loaded) {
      if (!merged.some(c => c.type === loadedConfig.type)) {
        merged.push({
          type: loadedConfig.type,
          name: loadedConfig.name || loadedConfig.type,
          enabled: loadedConfig.enabled !== undefined ? loadedConfig.enabled : true,
          priority: loadedConfig.priority || 50,
          weight: loadedConfig.weight || 50,
          timeout: loadedConfig.timeout || 10000,
          retryCount: loadedConfig.retryCount || 2,
          healthCheckInterval: loadedConfig.healthCheckInterval || 30000,
          region: loadedConfig.region || 'global',
          endpoints: loadedConfig.endpoints || [],
          metadata: loadedConfig.metadata || {
            description: 'Custom data source',
            rateLimit: 'Unknown',
            dataFreshness: 'Unknown',
            coverage: 'Unknown',
            reliability: 'Unknown'
          }
        });
      }
    }

    return merged;
  }

  /**
   * 保存配置
   */
  private saveConfig(config: DataSourceSystemConfig): void {
    try {
      // 创建备份
      this.createBackup();

      // 更新最后修改时间
      config.lastUpdated = new Date().toISOString();

      // 保存配置
      fs.writeFileSync(
        this.configFilePath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      console.log(`Config saved to ${this.configFilePath}`);
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  /**
   * 创建配置备份
   */
  private createBackup(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(
          this.backupDir,
          `data_sources_backup_${timestamp}.json`
        );

        const configData = fs.readFileSync(this.configFilePath, 'utf-8');
        fs.writeFileSync(backupPath, configData, 'utf-8');

        // 清理旧备份（保留最近5个）
        this.cleanupOldBackups(5);
      }
    } catch (error) {
      console.warn('Failed to create config backup:', error);
    }
  }

  /**
   * 清理旧备份
   */
  private cleanupOldBackups(maxBackups: number): void {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('data_sources_backup_') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // 按时间倒序排序

      // 删除超出数量的旧备份
      for (let i = maxBackups; i < files.length; i++) {
        fs.unlinkSync(files[i].path);
      }
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
    }
  }

  /**
   * 启动配置监听
   */
  private startConfigWatching(): void {
    try {
      if (this.configWatcher) {
        this.configWatcher.close();
      }

      this.configWatcher = fs.watch(this.configFilePath, (eventType) => {
        if (eventType === 'change') {
          console.log('Config file changed, reloading...');
          setTimeout(() => {
            try {
              this.config = this.loadConfig();
              console.log('Config reloaded successfully');
            } catch (error) {
              console.error('Failed to reload config:', error);
            }
          }, 1000); // 延迟1秒，避免文件写入中的读取
        }
      });
    } catch (error) {
      console.warn('Failed to start config watcher:', error);
    }
  }

  /**
   * 获取完整配置
   */
  getConfig(): DataSourceSystemConfig {
    return { ...this.config };
  }

  /**
   * 获取数据源配置
   */
  getDataSourceConfig(type?: DataSourceType): EnhancedDataSourceConfig | EnhancedDataSourceConfig[] {
    if (type) {
      return this.config.dataSources.find(ds => ds.type === type) || this.createDefaultDataSourceConfig(type);
    }
    return [...this.config.dataSources];
  }

  /**
   * 更新数据源配置
   */
  updateDataSourceConfig(type: DataSourceType, updates: Partial<EnhancedDataSourceConfig>): void {
    const index = this.config.dataSources.findIndex(ds => ds.type === type);

    if (index >= 0) {
      this.config.dataSources[index] = {
        ...this.config.dataSources[index],
        ...updates
      };
    } else {
      // 添加新数据源
      const newConfig = this.createDefaultDataSourceConfig(type);
      this.config.dataSources.push({
        ...newConfig,
        ...updates
      });
    }

    this.saveConfig(this.config);
  }

  /**
   * 添加新数据源
   */
  addDataSource(config: Omit<EnhancedDataSourceConfig, 'type'> & { type: string }): void {
    const type = config.type as DataSourceType;

    if (this.config.dataSources.some(ds => ds.type === type)) {
      throw new Error(`Data source ${type} already exists`);
    }

    this.config.dataSources.push({
      type,
      name: config.name,
      enabled: config.enabled !== undefined ? config.enabled : true,
      priority: config.priority || 50,
      weight: config.weight || 50,
      timeout: config.timeout || 10000,
      retryCount: config.retryCount || 2,
      healthCheckInterval: config.healthCheckInterval || 30000,
      region: config.region || 'global',
      endpoints: config.endpoints || [],
      metadata: config.metadata || {
        description: 'Custom data source',
        rateLimit: 'Unknown',
        dataFreshness: 'Unknown',
        coverage: 'Unknown',
        reliability: 'Unknown'
      }
    });

    this.saveConfig(this.config);
  }

  /**
   * 删除数据源
   */
  removeDataSource(type: DataSourceType): void {
    const index = this.config.dataSources.findIndex(ds => ds.type === type);

    if (index >= 0) {
      // 不允许删除模拟数据源
      if (type === DataSourceType.SIMULATED) {
        throw new Error('Cannot remove simulated data source');
      }

      this.config.dataSources.splice(index, 1);
      this.saveConfig(this.config);
    }
  }

  /**
   * 获取路由配置
   */
  getRoutingConfig(): DataSourceRoutingConfig {
    return { ...this.config.routing };
  }

  /**
   * 更新路由配置
   */
  updateRoutingConfig(updates: Partial<DataSourceRoutingConfig>): void {
    this.config.routing = { ...this.config.routing, ...updates };
    this.saveConfig(this.config);
  }

  /**
   * 获取监控配置
   */
  getMonitoringConfig(): MonitoringConfig {
    return { ...this.config.monitoring };
  }

  /**
   * 更新监控配置
   */
  updateMonitoringConfig(updates: Partial<MonitoringConfig>): void {
    this.config.monitoring = { ...this.config.monitoring, ...updates };
    this.saveConfig(this.config);
  }

  /**
   * 获取区域配置
   */
  getRegionConfig(region?: string): RegionConfig | Record<string, RegionConfig> {
    if (region) {
      return this.config.regions[region] || this.createDefaultRegionConfig(region);
    }
    return { ...this.config.regions };
  }

  /**
   * 更新区域配置
   */
  updateRegionConfig(region: string, updates: Partial<RegionConfig>): void {
    if (!this.config.regions[region]) {
      this.config.regions[region] = this.createDefaultRegionConfig(region);
    }

    this.config.regions[region] = {
      ...this.config.regions[region],
      ...updates
    };

    this.saveConfig(this.config);
  }

  /**
   * 导出配置到文件
   */
  exportConfig(exportPath: string): void {
    try {
      const exportData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(exportPath, exportData, 'utf-8');
      console.log(`Config exported to ${exportPath}`);
    } catch (error) {
      console.error('Failed to export config:', error);
      throw error;
    }
  }

  /**
   * 从文件导入配置
   */
  importConfig(importPath: string): void {
    try {
      if (!fs.existsSync(importPath)) {
        throw new Error(`Import file not found: ${importPath}`);
      }

      const importData = fs.readFileSync(importPath, 'utf-8');
      const importedConfig = JSON.parse(importData);

      // 验证导入的配置
      if (!importedConfig.dataSources || !Array.isArray(importedConfig.dataSources)) {
        throw new Error('Invalid config format: missing dataSources array');
      }

      // 合并配置
      this.config = this.validateAndMergeConfig(importedConfig);
      this.saveConfig(this.config);

      console.log(`Config imported from ${importPath}`);
    } catch (error) {
      console.error('Failed to import config:', error);
      throw error;
    }
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.config = DEFAULT_CONFIG_TEMPLATE;
    this.saveConfig(this.config);
    console.log('Config reset to defaults');
  }

  /**
   * 获取配置摘要
   */
  getConfigSummary(): string {
    const enabledCount = this.config.dataSources.filter(ds => ds.enabled).length;
    const disabledCount = this.config.dataSources.length - enabledCount;

    return `
Data Source Configuration Summary:
================================
Total Data Sources: ${this.config.dataSources.length}
Enabled: ${enabledCount}
Disabled: ${disabledCount}

Routing Strategy: ${this.config.routing.strategy}
Geo Routing: ${this.config.routing.enableGeoRouting ? 'Enabled' : 'Disabled'}
Symbol Routing: ${this.config.routing.enableSymbolRouting ? 'Enabled' : 'Disabled'}

Monitoring: ${this.config.monitoring.enableStats ? 'Enabled' : 'Disabled'}
Health Checks: ${this.config.monitoring.enableHealthChecks ? 'Enabled' : 'Disabled'}
Alerting: ${this.config.monitoring.enableAlerting ? 'Enabled' : 'Disabled'}

Config Version: ${this.config.version}
Last Updated: ${this.config.lastUpdated}
    `.trim();
  }

  /**
   * 创建默认数据源配置
   */
  private createDefaultDataSourceConfig(type: DataSourceType): EnhancedDataSourceConfig {
    return {
      type,
      name: `Data Source ${type}`,
      enabled: true,
      priority: 50,
      weight: 50,
      timeout: 10000,
      retryCount: 2,
      healthCheckInterval: 30000,
      region: 'global',
      endpoints: [],
      metadata: {
        description: 'Custom data source',
        rateLimit: 'Unknown',
        dataFreshness: 'Unknown',
        coverage: 'Unknown',
        reliability: 'Unknown'
      }
    };
  }

  /**
   * 创建默认区域配置
   */
  private createDefaultRegionConfig(region: string): RegionConfig {
    return {
      name: region.toUpperCase(),
      preferredSources: [],
      fallbackSources: [],
      estimatedLatency: {}
    };
  }

  /**
   * 销毁管理器（清理资源）
   */
  destroy(): void {
    if (this.configWatcher) {
      this.configWatcher.close();
      this.configWatcher = null;
    }
  }
}

// 导出单例实例
export const dataSourceConfigManager = new DataSourceConfigManager();