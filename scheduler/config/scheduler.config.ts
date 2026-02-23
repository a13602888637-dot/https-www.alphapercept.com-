/**
 * Alpha-Quant-Copilot 调度器配置
 * 支持中国股市交易时间（9:30-15:00）
 */

export interface SchedulerConfig {
  // 交易时间配置
  tradingHours: {
    startHour: number; // 9:30
    startMinute: number; // 30
    endHour: number; // 15:00
    endMinute: number; // 0
  };

  // 盘中扫描配置
  intradayScan: {
    enabled: boolean;
    intervalMinutes: number; // 扫描间隔（分钟）
    topGainersCount: number; // 涨幅榜前N名
    volumeThreshold: number; // 成交量异动阈值（倍）
    ma60BreakThreshold: number; // MA60突破阈值（%）
  };

  // 盘后复盘配置
  postMarketReview: {
    enabled: boolean;
    executionTime: string; // 执行时间 "15:30"
    analysisDepth: 'basic' | 'standard' | 'deep'; // 分析深度
    generateReport: boolean; // 是否生成报告
  };

  // 自选股价格更新配置
  watchlistPriceUpdate: {
    enabled: boolean;
    intervalMinutes: number; // 更新间隔（分钟）
    batchSize: number; // 批量处理大小
    maxRetries: number; // 最大重试次数
  };

  // 数据清理配置
  dataCleanup: {
    enabled: boolean;
    retentionDays: number; // 数据保留天数
    cleanupIntervalHours: number; // 清理间隔（小时）
    batchSize: number; // 批量删除大小
  };

  // 日志配置
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    maxLogFiles: number; // 最大日志文件数
    maxLogSizeMB: number; // 单个日志文件最大大小（MB）
  };

  // AI集成配置
  aiIntegration: {
    enabled: boolean;
    provider: 'deepseek' | 'openai' | 'anthropic';
    model: string;
    maxTokens: number;
    temperature: number;
  };

  // 监控配置
  monitoring: {
    healthCheckInterval: number; // 健康检查间隔（秒）
    alertOnFailure: boolean;
    alertChannels: string[]; // 告警渠道
  };
}

// 默认配置
export const defaultConfig: SchedulerConfig = {
  tradingHours: {
    startHour: 9,
    startMinute: 30,
    endHour: 15,
    endMinute: 0
  },

  intradayScan: {
    enabled: true,
    intervalMinutes: 60, // 每小时执行一次
    topGainersCount: 20, // 涨幅榜前20名
    volumeThreshold: 2.0, // 成交量达到20日均量的2倍
    ma60BreakThreshold: 3.0 // 价格突破MA60超过3%
  },

  postMarketReview: {
    enabled: true,
    executionTime: "15:30", // 每日收盘后30分钟执行
    analysisDepth: 'deep',
    generateReport: true
  },

  watchlistPriceUpdate: {
    enabled: true,
    intervalMinutes: 5, // 每5分钟执行一次
    batchSize: 20, // 每批处理20个股票
    maxRetries: 2 // 最大重试2次
  },

  dataCleanup: {
    enabled: true,
    retentionDays: 90, // 保留90天数据
    cleanupIntervalHours: 24, // 每天清理一次
    batchSize: 1000 // 每批删除1000条记录
  },

  logging: {
    enabled: true,
    level: 'info',
    maxLogFiles: 30, // 保留30天的日志
    maxLogSizeMB: 10 // 每个日志文件最大10MB
  },

  aiIntegration: {
    enabled: true,
    provider: 'deepseek',
    model: 'deepseek-chat',
    maxTokens: 2000,
    temperature: 0.3
  },

  monitoring: {
    healthCheckInterval: 300, // 每5分钟检查一次
    alertOnFailure: true,
    alertChannels: ['console', 'log'] // 控制台和日志文件
  }
};

/**
 * 检查当前是否在交易时间内
 */
export function isTradingTime(config: SchedulerConfig): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const { startHour, startMinute, endHour, endMinute } = config.tradingHours;

  // 转换为分钟数进行比较
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
}

/**
 * 检查是否为交易日（周一至周五）
 */
export function isTradingDay(): boolean {
  const day = new Date().getDay();
  return day >= 1 && day <= 5; // 1=周一, 5=周五
}

/**
 * 获取下次执行时间
 */
export function getNextExecutionTime(config: SchedulerConfig, taskType: 'intraday' | 'postmarket'): Date {
  const now = new Date();
  const nextTime = new Date(now);

  if (taskType === 'intraday') {
    // 下次盘中扫描：当前时间 + intervalMinutes
    nextTime.setMinutes(now.getMinutes() + config.intradayScan.intervalMinutes);
  } else {
    // 下次盘后复盘：今天的15:30，如果已经过了就是明天的15:30
    const [hour, minute] = config.postMarketReview.executionTime.split(':').map(Number);
    nextTime.setHours(hour, minute, 0, 0);

    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  }

  return nextTime;
}

/**
 * 验证配置
 */
export function validateConfig(config: SchedulerConfig): string[] {
  const errors: string[] = [];

  // 交易时间验证
  if (config.tradingHours.startHour < 0 || config.tradingHours.startHour > 23) {
    errors.push('交易开始小时必须在0-23之间');
  }
  if (config.tradingHours.startMinute < 0 || config.tradingHours.startMinute > 59) {
    errors.push('交易开始分钟必须在0-59之间');
  }
  if (config.tradingHours.endHour < 0 || config.tradingHours.endHour > 23) {
    errors.push('交易结束小时必须在0-23之间');
  }
  if (config.tradingHours.endMinute < 0 || config.tradingHours.endMinute > 59) {
    errors.push('交易结束分钟必须在0-59之间');
  }

  // 盘中扫描验证
  if (config.intradayScan.intervalMinutes < 1 || config.intradayScan.intervalMinutes > 240) {
    errors.push('盘中扫描间隔必须在1-240分钟之间');
  }
  if (config.intradayScan.topGainersCount < 1 || config.intradayScan.topGainersCount > 100) {
    errors.push('涨幅榜数量必须在1-100之间');
  }
  if (config.intradayScan.volumeThreshold < 1 || config.intradayScan.volumeThreshold > 10) {
    errors.push('成交量阈值必须在1-10倍之间');
  }

  // 盘后复盘时间验证
  const [hour, minute] = config.postMarketReview.executionTime.split(':').map(Number);
  if (isNaN(hour) || hour < 0 || hour > 23) {
    errors.push('盘后复盘执行时间小时无效');
  }
  if (isNaN(minute) || minute < 0 || minute > 59) {
    errors.push('盘后复盘执行时间分钟无效');
  }

  // 自选股价格更新验证
  if (config.watchlistPriceUpdate.intervalMinutes < 1 || config.watchlistPriceUpdate.intervalMinutes > 60) {
    errors.push('自选股价格更新间隔必须在1-60分钟之间');
  }
  if (config.watchlistPriceUpdate.batchSize < 1 || config.watchlistPriceUpdate.batchSize > 100) {
    errors.push('自选股批量处理大小必须在1-100之间');
  }
  if (config.watchlistPriceUpdate.maxRetries < 0 || config.watchlistPriceUpdate.maxRetries > 5) {
    errors.push('自选股最大重试次数必须在0-5之间');
  }

  // 数据清理验证
  if (config.dataCleanup.retentionDays < 1 || config.dataCleanup.retentionDays > 365) {
    errors.push('数据保留天数必须在1-365天之间');
  }
  if (config.dataCleanup.cleanupIntervalHours < 1 || config.dataCleanup.cleanupIntervalHours > 168) {
    errors.push('数据清理间隔必须在1-168小时之间');
  }
  if (config.dataCleanup.batchSize < 100 || config.dataCleanup.batchSize > 10000) {
    errors.push('数据清理批量大小必须在100-10000之间');
  }

  return errors;
}