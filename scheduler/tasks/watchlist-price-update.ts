/**
 * 自选股价格更新任务
 * 定期获取所有用户自选股的实时价格并存储到数据库
 */

import { Logger } from '../utils/logger';
import { prisma } from '../../lib/db';
import { fetchMultipleStocks } from '../../skills/data_crawler';

export interface WatchlistPriceUpdateConfig {
  enabled: boolean;
  intervalMinutes: number; // 更新间隔（分钟）
  batchSize: number; // 批量处理大小
  maxRetries: number; // 最大重试次数
}

export interface WatchlistPriceUpdateResult {
  success: boolean;
  processedUsers: number;
  processedStocks: number;
  storedRecords: number;
  errors: Array<{
    userId: string;
    stockCode: string;
    error: string;
  }>;
  duration: number;
}

export class WatchlistPriceUpdateTask {
  private config: WatchlistPriceUpdateConfig;
  private logger: Logger;

  constructor(config: WatchlistPriceUpdateConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * 执行自选股价格更新任务
   */
  async execute(): Promise<WatchlistPriceUpdateResult> {
    const startTime = Date.now();
    const result: WatchlistPriceUpdateResult = {
      success: true,
      processedUsers: 0,
      processedStocks: 0,
      storedRecords: 0,
      errors: [],
      duration: 0
    };

    try {
      this.logger.info('开始执行自选股价格更新任务');

      // 1. 获取所有有自选股的用户
      const usersWithWatchlist = await prisma.user.findMany({
        where: {
          watchlists: {
            some: {}
          }
        },
        include: {
          watchlists: {
            select: {
              stockCode: true,
              stockName: true
            }
          }
        }
      });

      result.processedUsers = usersWithWatchlist.length;
      this.logger.info(`找到 ${usersWithWatchlist.length} 个有自选股的用户`);

      if (usersWithWatchlist.length === 0) {
        this.logger.info('没有找到有自选股的用户，任务结束');
        result.duration = Date.now() - startTime;
        return result;
      }

      // 2. 收集所有唯一的股票代码
      const allStockCodes = new Set<string>();
      usersWithWatchlist.forEach(user => {
        user.watchlists.forEach(item => {
          allStockCodes.add(item.stockCode);
        });
      });

      const uniqueStockCodes = Array.from(allStockCodes);
      result.processedStocks = uniqueStockCodes.length;
      this.logger.info(`需要更新 ${uniqueStockCodes.length} 个不同的股票`);

      if (uniqueStockCodes.length === 0) {
        this.logger.info('没有找到股票代码，任务结束');
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. 分批获取股票数据
      const batches = this.createBatches(uniqueStockCodes, this.config.batchSize);
      let totalStored = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.info(`处理批次 ${i + 1}/${batches.length}，包含 ${batch.length} 个股票`);

        try {
          // 获取实时股票数据
          const marketData = await fetchMultipleStocks(batch, this.config.maxRetries);

          // 存储价格历史
          const storedCount = await this.storePriceHistory(marketData);
          totalStored += storedCount;

          this.logger.info(`批次 ${i + 1} 完成，存储了 ${storedCount} 条记录`);
        } catch (error) {
          const err = error as Error;
          this.logger.error(`批次 ${i + 1} 处理失败`, { error: err });

          // 记录错误但继续处理其他批次
          batch.forEach(stockCode => {
            result.errors.push({
              userId: 'batch',
              stockCode,
              error: err.message
            });
          });
        }
      }

      result.storedRecords = totalStored;
      this.logger.info(`自选股价格更新完成，共存储 ${totalStored} 条记录`);

    } catch (error) {
      const err = error as Error;
      this.logger.error('自选股价格更新任务执行失败', { error: err });
      result.success = false;
      result.errors.push({
        userId: 'system',
        stockCode: 'all',
        error: err.message
      });
    } finally {
      result.duration = Date.now() - startTime;
      this.logger.info(`任务执行完成，耗时 ${result.duration}ms`, {
        data: {
          processedUsers: result.processedUsers,
          processedStocks: result.processedStocks,
          storedRecords: result.storedRecords,
          errors: result.errors.length
        }
      });
    }

    return result;
  }

  /**
   * 将数组分成指定大小的批次
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 存储价格历史到数据库
   */
  private async storePriceHistory(marketData: any[]): Promise<number> {
    let storedCount = 0;
    const now = new Date();
    const timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0); // 精确到分钟

    const createPromises = marketData.map(async (data) => {
      try {
        // 检查是否已经有这一分钟的记录
        const existingRecord = await prisma.stockPriceHistory.findFirst({
          where: {
            stockCode: data.symbol,
            timestamp: {
              gte: new Date(timestamp.getTime() - 60000), // 上一分钟内
              lte: timestamp
            }
          },
          orderBy: {
            timestamp: 'desc'
          }
        });

        // 只有当价格变化超过0.01%时才存储
        const shouldStore = !existingRecord ||
          Math.abs((data.currentPrice - Number(existingRecord.price)) / Number(existingRecord.price)) > 0.0001;

        if (shouldStore) {
          await prisma.stockPriceHistory.create({
            data: {
              stockCode: data.symbol,
              price: data.currentPrice,
              volume: data.volume,
              turnover: data.turnover,
              highPrice: data.highPrice,
              lowPrice: data.lowPrice,
              change: data.change,
              changePercent: data.changePercent,
              timestamp: timestamp
            }
          });
          storedCount++;
        }
      } catch (error) {
        this.logger.error(`存储股票 ${data.symbol} 价格历史失败`, { error });
        // 不抛出异常，继续处理其他股票
      }
    });

    await Promise.all(createPromises);
    return storedCount;
  }

  /**
   * 获取任务配置
   */
  getConfig(): WatchlistPriceUpdateConfig {
    return { ...this.config };
  }

  /**
   * 更新任务配置
   */
  updateConfig(newConfig: Partial<WatchlistPriceUpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('自选股价格更新任务配置已更新', { data: this.config });
  }
}