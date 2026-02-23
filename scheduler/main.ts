#!/usr/bin/env node

/**
 * Alpha-Quant-Copilot 主调度器入口
 * 基于node-cron的自动化调度系统
 */

import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';
import { defaultConfig, SchedulerConfig } from './config/scheduler.config';
import { Logger, initLogger } from './utils/logger';
import { IntradayScanTask } from './tasks/intraday-scan';
import { PostMarketReviewTask } from './tasks/postmarket-review';
import { WatchlistPriceUpdateTask } from './tasks/watchlist-price-update';
import { AIService } from './services/ai-service';

// 调度器状态
interface SchedulerStatus {
  running: boolean;
  startTime: Date | null;
  tasks: {
    intradayScan: {
      scheduled: boolean;
      lastExecution: Date | null;
      nextExecution: Date | null;
      executionCount: number;
    };
    postMarketReview: {
      scheduled: boolean;
      lastExecution: Date | null;
      nextExecution: Date | null;
      executionCount: number;
    };
    watchlistPriceUpdate: {
      scheduled: boolean;
      lastExecution: Date | null;
      nextExecution: Date | null;
      executionCount: number;
    };
  };
  errors: Array<{
    timestamp: Date;
    task: string;
    error: string;
  }>;
}

/**
 * Alpha-Quant-Copilot 主调度器
 */
class AlphaQuantScheduler {
  private config: SchedulerConfig;
  private logger: Logger;
  private aiService: AIService;
  private status: SchedulerStatus;
  private intradayTask: IntradayScanTask;
  private postMarketTask: PostMarketReviewTask;
  private watchlistPriceUpdateTask: WatchlistPriceUpdateTask;
  private cronTasks: cron.ScheduledTask[] = [];

  constructor(config?: Partial<SchedulerConfig>) {
    // 合并配置
    this.config = { ...defaultConfig, ...config };

    // 初始化日志系统
    this.logger = initLogger({
      enabled: this.config.logging.enabled,
      level: this.config.logging.level,
      maxLogFiles: this.config.logging.maxLogFiles,
      maxLogSizeMB: this.config.logging.maxLogSizeMB,
      logDirectory: path.join(process.cwd(), 'scheduler', 'logs')
    });

    // 获取DeepSeek API密钥
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

    // 初始化AI服务
    this.aiService = new AIService(this.config, this.logger, deepseekApiKey);

    // 初始化任务
    this.intradayTask = new IntradayScanTask(this.config, this.logger);
    this.postMarketTask = new PostMarketReviewTask(this.config, this.logger, deepseekApiKey);
    this.watchlistPriceUpdateTask = new WatchlistPriceUpdateTask(this.config.watchlistPriceUpdate, this.logger);

    // 初始化状态
    this.status = {
      running: false,
      startTime: null,
      tasks: {
        intradayScan: {
          scheduled: false,
          lastExecution: null,
          nextExecution: null,
          executionCount: 0
        },
        postMarketReview: {
          scheduled: false,
          lastExecution: null,
          nextExecution: null,
          executionCount: 0
        },
        watchlistPriceUpdate: {
          scheduled: false,
          lastExecution: null,
          nextExecution: null,
          executionCount: 0
        }
      },
      errors: []
    };

    this.logger.info('Alpha-Quant-Copilot 调度器初始化完成', {
      data: {
        intradayScan: this.config.intradayScan.enabled,
        postMarketReview: this.config.postMarketReview.enabled,
        watchlistPriceUpdate: this.config.watchlistPriceUpdate.enabled,
        aiIntegration: this.config.aiIntegration.enabled
      }
    });
  }

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.status.running) {
      this.logger.warn('调度器已经在运行中');
      return;
    }

    this.logger.info('启动调度器...');

    try {
      // 验证配置
      const configErrors = this.validateConfig();
      if (configErrors.length > 0) {
        throw new Error(`配置验证失败:\n${configErrors.join('\n')}`);
      }

      // 验证AI服务状态
      const aiStatus = this.aiService.getServiceStatus();
      if (this.config.aiIntegration.enabled && !aiStatus.apiKeyConfigured) {
        this.logger.warn('AI集成已启用但未配置API密钥，将使用模拟模式');
      }

      // 调度盘中扫描任务
      if (this.config.intradayScan.enabled) {
        this.scheduleIntradayScan();
      }

      // 调度盘后复盘任务
      if (this.config.postMarketReview.enabled) {
        this.schedulePostMarketReview();
      }

      // 调度自选股价格更新任务
      if (this.config.watchlistPriceUpdate.enabled) {
        this.scheduleWatchlistPriceUpdate();
      }

      // 更新状态
      this.status.running = true;
      this.status.startTime = new Date();

      this.logger.info('调度器启动成功', {
        data: {
          scheduledTasks: this.cronTasks.length,
          nextIntradayScan: this.status.tasks.intradayScan.nextExecution,
          nextPostMarketReview: this.status.tasks.postMarketReview.nextExecution,
          nextWatchlistPriceUpdate: this.status.tasks.watchlistPriceUpdate.nextExecution
        }
      });

      // 保持进程运行
      this.keepAlive();

    } catch (error) {
      const err = error as Error;
      this.logger.error('调度器启动失败', { error: err });
      throw err;
    }
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    if (!this.status.running) {
      this.logger.warn('调度器未运行');
      return;
    }

    this.logger.info('停止调度器...');

    // 停止所有cron任务
    for (const task of this.cronTasks) {
      task.stop();
    }
    this.cronTasks = [];

    // 更新状态
    this.status.running = false;

    this.logger.info('调度器已停止', {
      data: {
        totalExecutions: this.status.tasks.intradayScan.executionCount + this.status.tasks.postMarketReview.executionCount,
        totalErrors: this.status.errors.length
      }
    });
  }

  /**
   * 调度盘中扫描任务
   */
  private scheduleIntradayScan(): void {
    // 中国股市交易时间：周一至周五 9:30-15:00
    // 每小时执行一次：在每小时的0分钟执行（例如 10:00, 11:00, 12:00...）
    const cronExpression = '0 9-15 * * 1-5'; // 周一至周五 9:00-15:00 每小时执行

    const task = cron.schedule(cronExpression, async () => {
      await this.executeIntradayScan();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    this.cronTasks.push(task);
    this.status.tasks.intradayScan.scheduled = true;

    // 计算下次执行时间
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    this.status.tasks.intradayScan.nextExecution = nextHour;

    this.logger.info('盘中扫描任务已调度', {
      data: {
        cronExpression,
        nextExecution: nextHour.toISOString()
      }
    });
  }

  /**
   * 调度盘后复盘任务
   */
  private schedulePostMarketReview(): void {
    // 每日收盘后30分钟执行（15:30）
    const cronExpression = '30 15 * * 1-5'; // 周一至周五 15:30

    const task = cron.schedule(cronExpression, async () => {
      await this.executePostMarketReview();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    this.cronTasks.push(task);
    this.status.tasks.postMarketReview.scheduled = true;

    // 计算下次执行时间
    const now = new Date();
    const nextExecution = new Date(now);
    nextExecution.setHours(15, 30, 0, 0);
    if (nextExecution <= now) {
      nextExecution.setDate(nextExecution.getDate() + 1);
    }
    this.status.tasks.postMarketReview.nextExecution = nextExecution;

    this.logger.info('盘后复盘任务已调度', {
      data: {
        cronExpression,
        nextExecution: nextExecution.toISOString()
      }
    });
  }

  /**
   * 调度自选股价格更新任务
   */
  private scheduleWatchlistPriceUpdate(): void {
    // 每N分钟执行一次（根据配置）
    const intervalMinutes = this.config.watchlistPriceUpdate.intervalMinutes;
    const cronExpression = `*/${intervalMinutes} 9-15 * * 1-5`; // 交易时间内每N分钟执行

    const task = cron.schedule(cronExpression, async () => {
      await this.executeWatchlistPriceUpdate();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    this.cronTasks.push(task);
    this.status.tasks.watchlistPriceUpdate.scheduled = true;

    // 计算下次执行时间
    const now = new Date();
    const nextExecution = new Date(now);
    nextExecution.setMinutes(nextExecution.getMinutes() + intervalMinutes, 0, 0); // 精确到分钟
    this.status.tasks.watchlistPriceUpdate.nextExecution = nextExecution;

    this.logger.info('自选股价格更新任务已调度', {
      data: {
        cronExpression,
        intervalMinutes,
        nextExecution: nextExecution.toISOString()
      }
    });
  }

  /**
   * 执行盘中扫描任务
   */
  private async executeIntradayScan(): Promise<void> {
    const taskId = `intraday-${Date.now()}`;
    const startTime = Date.now();

    this.logger.info('开始执行盘中扫描任务', { taskId });

    try {
      const result = await this.intradayTask.execute();

      // 更新状态
      this.status.tasks.intradayScan.lastExecution = new Date();
      this.status.tasks.intradayScan.executionCount++;
      this.status.tasks.intradayScan.nextExecution = new Date(Date.now() + 60 * 60 * 1000); // 1小时后

      const duration = Date.now() - startTime;

      this.logger.info('盘中扫描任务执行完成', {
        taskId,
        data: {
          duration,
          alerts: result.alerts.length,
          topGainers: result.topGainers.length,
          ma60Breakthroughs: result.ma60Breakthroughs.length
        }
      });

      // 如果有警报，记录详细信息
      const criticalAlerts = result.alerts.filter(a => a.level === 'critical');
      if (criticalAlerts.length > 0) {
        this.logger.warn('发现关键警报', {
          taskId,
          data: {
            alerts: criticalAlerts.map(a => ({
              symbol: a.symbol,
              message: a.message,
              action: a.action
            }))
          }
        });
      }

    } catch (error) {
      const err = error as Error;
      this.logger.error('盘中扫描任务执行失败', {
        taskId,
        error: err
      });

      this.status.errors.push({
        timestamp: new Date(),
        task: 'intradayScan',
        error: err.message
      });
    }
  }

  /**
   * 执行盘后复盘任务
   */
  private async executePostMarketReview(): Promise<void> {
    const taskId = `postmarket-${Date.now()}`;
    const startTime = Date.now();

    this.logger.info('开始执行盘后复盘任务', { taskId });

    try {
      const result = await this.postMarketTask.execute();

      // 更新状态
      this.status.tasks.postMarketReview.lastExecution = new Date();
      this.status.tasks.postMarketReview.executionCount++;

      // 计算下次执行时间（明天15:30）
      const nextExecution = new Date();
      nextExecution.setDate(nextExecution.getDate() + 1);
      nextExecution.setHours(15, 30, 0, 0);
      this.status.tasks.postMarketReview.nextExecution = nextExecution;

      const duration = Date.now() - startTime;

      this.logger.info('盘后复盘任务执行完成', {
        taskId,
        data: {
          duration,
          marketSentiment: result.marketOverview.marketSentiment,
          ma60ComplianceRate: result.strategyPerformance.ma60Discipline.ma60ComplianceRate,
          trendAccuracy: result.strategyPerformance.md60TrendFollowing.trendAccuracy
        }
      });

      // 如果有生成的报告，记录路径
      if (result.generatedReport?.attachments) {
        this.logger.info('复盘报告已生成', {
          taskId,
          data: {
            attachments: result.generatedReport.attachments
          }
        });
      }

    } catch (error) {
      const err = error as Error;
      this.logger.error('盘后复盘任务执行失败', {
        taskId,
        error: err
      });

      this.status.errors.push({
        timestamp: new Date(),
        task: 'postMarketReview',
        error: err.message
      });
    }
  }

  /**
   * 执行自选股价格更新任务
   */
  private async executeWatchlistPriceUpdate(): Promise<void> {
    const taskId = `watchlist-price-${Date.now()}`;
    const startTime = Date.now();

    this.logger.info('开始执行自选股价格更新任务', { taskId });

    try {
      const result = await this.watchlistPriceUpdateTask.execute();

      // 更新状态
      this.status.tasks.watchlistPriceUpdate.lastExecution = new Date();
      this.status.tasks.watchlistPriceUpdate.executionCount++;

      // 计算下次执行时间（N分钟后）
      const nextExecution = new Date();
      nextExecution.setMinutes(nextExecution.getMinutes() + this.config.watchlistPriceUpdate.intervalMinutes, 0, 0);
      this.status.tasks.watchlistPriceUpdate.nextExecution = nextExecution;

      const duration = Date.now() - startTime;

      this.logger.info('自选股价格更新任务执行完成', {
        taskId,
        data: {
          duration,
          processedUsers: result.processedUsers,
          processedStocks: result.processedStocks,
          storedRecords: result.storedRecords,
          errors: result.errors.length
        }
      });

    } catch (error) {
      const err = error as Error;
      this.logger.error('自选股价格更新任务执行失败', {
        taskId,
        error: err
      });

      this.status.errors.push({
        timestamp: new Date(),
        task: 'watchlistPriceUpdate',
        error: err.message
      });
    }
  }

  /**
   * 验证配置
   */
  private validateConfig(): string[] {
    const errors: string[] = [];

    // 检查日志目录
    const logsDir = path.join(process.cwd(), 'scheduler', 'logs');
    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
    } catch (error) {
      const err = error as Error;
      errors.push(`无法创建日志目录: ${err.message}`);
    }

    // 检查AI配置
    if (this.config.aiIntegration.enabled) {
      if (!this.config.aiIntegration.provider) {
        errors.push('AI集成已启用但未指定提供商');
      }
      if (!this.config.aiIntegration.model) {
        errors.push('AI集成已启用但未指定模型');
      }
    }

    return errors;
  }

  /**
   * 保持进程运行
   */
  private keepAlive(): void {
    // 定期记录健康状态
    const healthCheckInterval = setInterval(() => {
      if (!this.status.running) {
        clearInterval(healthCheckInterval);
        return;
      }

      this.logger.debug('调度器健康检查', {
        data: {
          uptime: this.status.startTime ? Date.now() - this.status.startTime.getTime() : 0,
          memoryUsage: process.memoryUsage(),
          tasks: {
            intradayScan: this.status.tasks.intradayScan.executionCount,
            postMarketReview: this.status.tasks.postMarketReview.executionCount
          }
        }
      });

    }, this.config.monitoring.healthCheckInterval * 1000);

    // 处理进程退出
    process.on('SIGINT', async () => {
      this.logger.info('收到SIGINT信号，正在停止调度器...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.logger.info('收到SIGTERM信号，正在停止调度器...');
      await this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('未捕获的异常', { error });
      this.status.errors.push({
        timestamp: new Date(),
        task: 'system',
        error: error.message
      });
    });

    process.on('unhandledRejection', (reason, _promise) => {
      this.logger.error('未处理的Promise拒绝', { error: new Error(String(reason)) });
      this.status.errors.push({
        timestamp: new Date(),
        task: 'system',
        error: `Unhandled rejection: ${reason}`
      });
    });
  }

  /**
   * 获取调度器状态
   */
  getStatus(): SchedulerStatus {
    return { ...this.status };
  }

  /**
   * 获取系统信息
   */
  getSystemInfo(): {
    version: string;
    nodeVersion: string;
    platform: string;
    uptime: number;
    config: SchedulerConfig;
    aiServiceStatus: any;
  } {
    const packageJson = require('../../package.json');

    return {
      version: packageJson.version,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: this.status.startTime ? Date.now() - this.status.startTime.getTime() : 0,
      config: this.config,
      aiServiceStatus: this.aiService.getServiceStatus()
    };
  }

  /**
   * 手动触发盘中扫描
   */
  async triggerIntradayScan(): Promise<void> {
    this.logger.info('手动触发盘中扫描');
    await this.executeIntradayScan();
  }

  /**
   * 手动触发盘后复盘
   */
  async triggerPostMarketReview(): Promise<void> {
    this.logger.info('手动触发盘后复盘');
    await this.executePostMarketReview();
  }

  /**
   * 手动触发自选股价格更新
   */
  async triggerWatchlistPriceUpdate(): Promise<void> {
    this.logger.info('手动触发自选股价格更新');
    await this.executeWatchlistPriceUpdate();
  }
}

/**
 * CLI入口点
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  const scheduler = new AlphaQuantScheduler();

  switch (command) {
    case 'start':
      try {
        await scheduler.start();
        console.log('✅ Alpha-Quant-Copilot 调度器已启动');
        console.log('📊 按 Ctrl+C 停止调度器');
      } catch (error) {
        const err = error as Error;
        console.error('❌ 启动失败:', err.message);
        process.exit(1);
      }
      break;

    case 'stop':
      await scheduler.stop();
      console.log('🛑 调度器已停止');
      process.exit(0);
      break;

    case 'status':
      const status = scheduler.getStatus();
      const systemInfo = scheduler.getSystemInfo();

      console.log('📈 Alpha-Quant-Copilot 调度器状态');
      console.log('================================');
      console.log(`运行状态: ${status.running ? '✅ 运行中' : '❌ 已停止'}`);
      if (status.startTime) {
        console.log(`启动时间: ${status.startTime.toLocaleString()}`);
        console.log(`运行时长: ${Math.floor(systemInfo.uptime / 1000 / 60)}分钟`);
      }

      console.log('\n📊 任务状态:');
      console.log(`盘中扫描: ${status.tasks.intradayScan.scheduled ? '✅ 已调度' : '❌ 未调度'}`);
      console.log(`  执行次数: ${status.tasks.intradayScan.executionCount}`);
      console.log(`  上次执行: ${status.tasks.intradayScan.lastExecution ? status.tasks.intradayScan.lastExecution.toLocaleString() : '从未执行'}`);
      console.log(`  下次执行: ${status.tasks.intradayScan.nextExecution ? status.tasks.intradayScan.nextExecution.toLocaleString() : '未安排'}`);

      console.log(`\n盘后复盘: ${status.tasks.postMarketReview.scheduled ? '✅ 已调度' : '❌ 未调度'}`);
      console.log(`  执行次数: ${status.tasks.postMarketReview.executionCount}`);
      console.log(`  上次执行: ${status.tasks.postMarketReview.lastExecution ? status.tasks.postMarketReview.lastExecution.toLocaleString() : '从未执行'}`);
      console.log(`  下次执行: ${status.tasks.postMarketReview.nextExecution ? status.tasks.postMarketReview.nextExecution.toLocaleString() : '未安排'}`);

      console.log(`\n自选股价格更新: ${status.tasks.watchlistPriceUpdate.scheduled ? '✅ 已调度' : '❌ 未调度'}`);
      console.log(`  执行次数: ${status.tasks.watchlistPriceUpdate.executionCount}`);
      console.log(`  上次执行: ${status.tasks.watchlistPriceUpdate.lastExecution ? status.tasks.watchlistPriceUpdate.lastExecution.toLocaleString() : '从未执行'}`);
      console.log(`  下次执行: ${status.tasks.watchlistPriceUpdate.nextExecution ? status.tasks.watchlistPriceUpdate.nextExecution.toLocaleString() : '未安排'}`);

      console.log('\n⚠️  错误统计:');
      console.log(`  总错误数: ${status.errors.length}`);
      if (status.errors.length > 0) {
        console.log('  最近错误:');
        status.errors.slice(-3).forEach((error, i) => {
          console.log(`    ${i+1}. ${error.timestamp.toLocaleString()} - ${error.task}: ${error.error}`);
        });
      }

      console.log('\n🔧 系统信息:');
      console.log(`  版本: ${systemInfo.version}`);
      console.log(`  Node版本: ${systemInfo.nodeVersion}`);
      console.log(`  平台: ${systemInfo.platform}`);

      const aiStatus = systemInfo.aiServiceStatus;
      console.log('\n🤖 AI服务状态:');
      console.log(`  启用: ${aiStatus.enabled ? '✅' : '❌'}`);
      console.log(`  提供商: ${aiStatus.provider}`);
      console.log(`  模型: ${aiStatus.model}`);
      console.log(`  API密钥: ${aiStatus.apiKeyConfigured ? '✅ 已配置' : '❌ 未配置'}`);
      console.log(`  策略文档: ${aiStatus.strategyDocumentValid ? '✅ 有效' : '❌ 无效'}`);

      process.exit(0);
      break;

    case 'trigger-intraday':
      await scheduler.triggerIntradayScan();
      console.log('✅ 盘中扫描已手动触发');
      process.exit(0);
      break;

    case 'trigger-postmarket':
      await scheduler.triggerPostMarketReview();
      console.log('✅ 盘后复盘已手动触发');
      process.exit(0);
      break;

    case 'trigger-watchlist-price':
      await scheduler.triggerWatchlistPriceUpdate();
      console.log('✅ 自选股价格更新已手动触发');
      process.exit(0);
      break;

    case 'help':
    default:
      console.log('🚀 Alpha-Quant-Copilot 调度器命令:');
      console.log('================================');
      console.log('npm run scheduler:start    启动调度器');
      console.log('npm run scheduler:stop     停止调度器');
      console.log('npm run scheduler:status   查看状态');
      console.log('npm run scheduler          显示此帮助信息');
      console.log('\n手动触发命令:');
      console.log('node scheduler/main.ts trigger-intraday          手动触发盘中扫描');
      console.log('node scheduler/main.ts trigger-postmarket        手动触发盘后复盘');
      console.log('node scheduler/main.ts trigger-watchlist-price   手动触发自选股价格更新');
      console.log('\n环境变量:');
      console.log('DEEPSEEK_API_KEY          DeepSeek API密钥');
      console.log('\n配置文件:');
      console.log('scheduler/config/scheduler.config.ts');
      process.exit(0);
  }
}

// 如果是直接运行此文件，执行CLI
if (require.main === module) {
  main().catch(error => {
    console.error('调度器运行失败:', error);
    process.exit(1);
  });
}

// 导出调度器类
export { AlphaQuantScheduler };