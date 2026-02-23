/**
 * 数据清理任务
 * 定期清理旧的历史价格数据，保持数据库性能
 */

import { Logger } from '../utils/logger';
import { prisma } from '../../lib/db';

export interface DataCleanupConfig {
  enabled: boolean;
  retentionDays: number; // 数据保留天数
  cleanupIntervalHours: number; // 清理间隔（小时）
  batchSize: number; // 批量删除大小
}

export interface DataCleanupResult {
  success: boolean;
  deletedRecords: number;
  affectedStocks: number;
  duration: number;
  errors: string[];
}

export class DataCleanupTask {
  private config: DataCleanupConfig;
  private logger: Logger;

  constructor(config: DataCleanupConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * 执行数据清理任务
   */
  async execute(): Promise<DataCleanupResult> {
    const startTime = Date.now();
    const result: DataCleanupResult = {
      success: true,
      deletedRecords: 0,
      affectedStocks: 0,
      duration: 0,
      errors: []
    };

    try {
      this.logger.info('开始执行数据清理任务');

      // 计算截止日期
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      this.logger.info(`清理 ${cutoffDate.toISOString()} 之前的数据`);

      // 1. 首先统计要清理的数据
      const stats = await prisma.stockPriceHistory.aggregate({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        },
        _count: {
          id: true
        },
        _count: {
          stockCode: true
        }
      });

      const totalRecords = (stats as any)._count.id;
      const uniqueStocks = (stats as any)._count.stockCode;

      this.logger.info(`找到 ${totalRecords} 条记录需要清理，涉及 ${uniqueStocks} 个股票`);

      if (totalRecords === 0) {
        this.logger.info('没有需要清理的数据，任务结束');
        result.duration = Date.now() - startTime;
        return result;
      }

      // 2. 分批删除数据
      let deletedCount = 0;
      let batchNumber = 1;

      while (deletedCount < totalRecords) {
        try {
          const batchResult = await prisma.stockPriceHistory.deleteMany({
            where: {
              timestamp: {
                lt: cutoffDate
              }
            },
            take: this.config.batchSize
          });

          const batchDeleted = batchResult.count;
          deletedCount += batchDeleted;

          this.logger.info(`批次 ${batchNumber} 删除了 ${batchDeleted} 条记录，累计 ${deletedCount}/${totalRecords}`);

          if (batchDeleted < this.config.batchSize) {
            break; // 没有更多数据了
          }

          batchNumber++;

          // 短暂暂停以避免数据库压力
          await this.sleep(100);

        } catch (error) {
          const err = error as Error;
          this.logger.error(`批次 ${batchNumber} 删除失败`, { error: err });
          result.errors.push(`批次 ${batchNumber}: ${err.message}`);
          break;
        }
      }

      result.deletedRecords = deletedCount;
      result.affectedStocks = uniqueStocks;

      this.logger.info(`数据清理完成，共删除 ${deletedCount} 条记录`);

      // 3. 执行数据库维护（可选）
      await this.performDatabaseMaintenance();

    } catch (error) {
      const err = error as Error;
      this.logger.error('数据清理任务执行失败', { error: err });
      result.success = false;
      result.errors.push(`任务失败: ${err.message}`);
    } finally {
      result.duration = Date.now() - startTime;
      this.logger.info(`任务执行完成，耗时 ${result.duration}ms`, {
        data: {
          deletedRecords: result.deletedRecords,
          affectedStocks: result.affectedStocks,
          errors: result.errors.length
        }
      });
    }

    return result;
  }

  /**
   * 执行数据库维护操作
   */
  private async performDatabaseMaintenance(): Promise<void> {
    try {
      this.logger.info('开始数据库维护');

      // 更新表统计信息
      await prisma.$executeRaw`VACUUM ANALYZE "StockPriceHistory"`;

      // 重建索引（如果性能需要）
      // await prisma.$executeRaw`REINDEX TABLE "StockPriceHistory"`;

      this.logger.info('数据库维护完成');
    } catch (error) {
      this.logger.warn('数据库维护失败，但不会影响主要功能', { error });
      // 不抛出异常，维护失败不影响主要功能
    }
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取任务配置
   */
  getConfig(): DataCleanupConfig {
    return { ...this.config };
  }

  /**
   * 更新任务配置
   */
  updateConfig(newConfig: Partial<DataCleanupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('数据清理任务配置已更新', { data: this.config });
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<{
    totalRecords: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
    storageEstimate: string;
  }> {
    try {
      const stats = await prisma.stockPriceHistory.aggregate({
        _count: {
          id: true
        },
        _min: {
          timestamp: true
        },
        _max: {
          timestamp: true
        }
      });

      // 估算存储空间（假设每条记录约100字节）
      const estimatedBytes = (stats._count.id || 0) * 100;
      const storageEstimate = this.formatBytes(estimatedBytes);

      return {
        totalRecords: stats._count.id || 0,
        oldestRecord: stats._min.timestamp,
        newestRecord: stats._max.timestamp,
        storageEstimate
      };
    } catch (error) {
      this.logger.error('获取数据库统计信息失败', { error });
      return {
        totalRecords: 0,
        oldestRecord: null,
        newestRecord: null,
        storageEstimate: '0 B'
      };
    }
  }

  /**
   * 格式化字节大小
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}