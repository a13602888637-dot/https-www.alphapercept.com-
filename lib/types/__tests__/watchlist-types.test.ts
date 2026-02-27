/**
 * Watchlist 类型验证测试
 * 确保所有类型定义正确且完整
 */

import { describe, it, expect } from 'vitest';
import {
  WatchlistToggleState,
  WatchlistItemStatus,
  WatchlistTransaction,
  ToggleStateMachineConfig,
  DEFAULT_TOGGLE_CONFIG,
  STATE_TRANSITIONS,
  isValidTransition,
  getStateDescription,
  generateTransactionId,
} from '../watchlist-state-machine';

describe('Watchlist 类型定义', () => {
  describe('基本类型', () => {
    it('应该正确定义 WatchlistToggleState 类型', () => {
      const validStates: WatchlistToggleState[] = [
        'IDLE',
        'OPTIMISTIC_UPDATING',
        'SYNCING',
        'SUCCESS',
        'ROLLBACK_ERROR',
      ];

      validStates.forEach(state => {
        expect(state).toBeDefined();
      });

      // 测试无效状态（TypeScript会在编译时捕获）
      // @ts-expect-error - 测试无效状态
      const invalidState: WatchlistToggleState = 'INVALID';
      expect(invalidState).toBe('INVALID');
    });

    it('应该正确定义 WatchlistItemStatus 接口', () => {
      const status: WatchlistItemStatus = {
        stockCode: 'AAPL',
        state: 'IDLE',
        isInWatchlist: true,
        lastUpdated: Date.now(),
      };

      expect(status.stockCode).toBe('AAPL');
      expect(status.state).toBe('IDLE');
      expect(status.isInWatchlist).toBe(true);
      expect(status.lastUpdated).toBeGreaterThan(0);

      // 可选属性
      const statusWithError: WatchlistItemStatus = {
        stockCode: 'AAPL',
        state: 'ROLLBACK_ERROR',
        isInWatchlist: false,
        lastUpdated: Date.now(),
        error: '网络错误',
      };

      expect(statusWithError.error).toBe('网络错误');
    });

    it('应该正确定义 WatchlistTransaction 接口', () => {
      const transaction: WatchlistTransaction = {
        id: 'AAPL_1234567890_abc123',
        stockCode: 'AAPL',
        targetState: 'ADD',
        startedAt: Date.now(),
        state: 'OPTIMISTIC_UPDATING',
        retryCount: 0,
      };

      expect(transaction.id).toContain('AAPL');
      expect(transaction.targetState).toBe('ADD');
      expect(transaction.retryCount).toBe(0);

      const removeTransaction: WatchlistTransaction = {
        id: 'AAPL_1234567890_def456',
        stockCode: 'AAPL',
        targetState: 'REMOVE',
        startedAt: Date.now(),
        state: 'SYNCING',
        retryCount: 1,
      };

      expect(removeTransaction.targetState).toBe('REMOVE');
      expect(removeTransaction.retryCount).toBe(1);
    });

    it('应该正确定义 ToggleStateMachineConfig 接口', () => {
      const config: ToggleStateMachineConfig = {
        optimisticUpdateDelay: 0,
        syncTimeout: 10000,
        maxRetries: 3,
        hapticFeedback: true,
        visualFeedback: {
          popAnimation: true,
          colorTransition: true,
          duration: 300,
        },
      };

      expect(config.syncTimeout).toBe(10000);
      expect(config.maxRetries).toBe(3);
      expect(config.hapticFeedback).toBe(true);
      expect(config.visualFeedback.duration).toBe(300);
    });
  });

  describe('默认配置', () => {
    it('应该提供完整的默认配置', () => {
      expect(DEFAULT_TOGGLE_CONFIG).toBeDefined();
      expect(DEFAULT_TOGGLE_CONFIG.optimisticUpdateDelay).toBe(0);
      expect(DEFAULT_TOGGLE_CONFIG.syncTimeout).toBe(10000);
      expect(DEFAULT_TOGGLE_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_TOGGLE_CONFIG.hapticFeedback).toBe(true);
      expect(DEFAULT_TOGGLE_CONFIG.visualFeedback).toEqual({
        popAnimation: true,
        colorTransition: true,
        duration: 300,
      });
    });
  });

  describe('状态转换', () => {
    it('应该正确定义状态转换规则', () => {
      expect(STATE_TRANSITIONS).toBeDefined();
      expect(STATE_TRANSITIONS.IDLE).toEqual(['OPTIMISTIC_UPDATING']);
      expect(STATE_TRANSITIONS.OPTIMISTIC_UPDATING).toEqual(['SYNCING', 'ROLLBACK_ERROR']);
      expect(STATE_TRANSITIONS.SYNCING).toEqual(['SUCCESS', 'ROLLBACK_ERROR']);
      expect(STATE_TRANSITIONS.SUCCESS).toEqual(['IDLE']);
      expect(STATE_TRANSITIONS.ROLLBACK_ERROR).toEqual(['IDLE', 'OPTIMISTIC_UPDATING']);
    });

    it('应该验证有效的状态转换', () => {
      // 有效转换
      expect(isValidTransition('IDLE', 'OPTIMISTIC_UPDATING')).toBe(true);
      expect(isValidTransition('OPTIMISTIC_UPDATING', 'SYNCING')).toBe(true);
      expect(isValidTransition('SYNCING', 'SUCCESS')).toBe(true);
      expect(isValidTransition('SYNCING', 'ROLLBACK_ERROR')).toBe(true);
      expect(isValidTransition('SUCCESS', 'IDLE')).toBe(true);
      expect(isValidTransition('ROLLBACK_ERROR', 'IDLE')).toBe(true);
      expect(isValidTransition('ROLLBACK_ERROR', 'OPTIMISTIC_UPDATING')).toBe(true);

      // 无效转换
      expect(isValidTransition('IDLE', 'SUCCESS')).toBe(false);
      expect(isValidTransition('SUCCESS', 'SYNCING')).toBe(false);
      expect(isValidTransition('OPTIMISTIC_UPDATING', 'IDLE')).toBe(false);
    });

    it('应该处理未知状态', () => {
      // @ts-expect-error - 测试无效状态
      expect(isValidTransition('UNKNOWN', 'IDLE')).toBe(false);
      // @ts-expect-error - 测试无效状态
      expect(isValidTransition('IDLE', 'UNKNOWN')).toBe(false);
    });
  });

  describe('状态描述', () => {
    it('应该为所有状态提供描述', () => {
      const states: WatchlistToggleState[] = ['IDLE', 'OPTIMISTIC_UPDATING', 'SYNCING', 'SUCCESS', 'ROLLBACK_ERROR'];

      states.forEach(state => {
        const description = getStateDescription(state);
        expect(description).toBeDefined();
        expect(description.message).toBeDefined();
        expect(typeof description.isError).toBe('boolean');
        expect(typeof description.isProcessing).toBe('boolean');
      });
    });

    it('应该提供正确的描述内容', () => {
      expect(getStateDescription('IDLE')).toEqual({
        message: '准备就绪',
        isError: false,
        isProcessing: false,
      });

      expect(getStateDescription('OPTIMISTIC_UPDATING')).toEqual({
        message: '更新中...',
        isError: false,
        isProcessing: true,
      });

      expect(getStateDescription('SYNCING')).toEqual({
        message: '同步数据...',
        isError: false,
        isProcessing: true,
      });

      expect(getStateDescription('SUCCESS')).toEqual({
        message: '操作成功',
        isError: false,
        isProcessing: false,
      });

      expect(getStateDescription('ROLLBACK_ERROR')).toEqual({
        message: '操作失败，已回滚',
        isError: true,
        isProcessing: false,
      });
    });
  });

  describe('工具函数', () => {
    it('应该生成唯一的事务ID', () => {
      const stockCode = 'AAPL';
      const transactionId1 = generateTransactionId(stockCode);
      const transactionId2 = generateTransactionId(stockCode);

      expect(transactionId1).toContain(stockCode);
      expect(transactionId2).toContain(stockCode);
      expect(transactionId1).not.toBe(transactionId2); // 应该不同

      // 验证格式
      expect(transactionId1).toMatch(new RegExp(`^${stockCode}_\\d+_[a-z0-9]{9}$`));
    });

    it('应该为不同的股票代码生成不同的ID', () => {
      const id1 = generateTransactionId('AAPL');
      const id2 = generateTransactionId('GOOGL');

      expect(id1).not.toBe(id2);
      expect(id1).toContain('AAPL');
      expect(id2).toContain('GOOGL');
    });
  });

  describe('类型兼容性', () => {
    it('应该与store中的使用兼容', () => {
      // 测试类型是否与store中的使用兼容
      const mockStatus: WatchlistItemStatus = {
        stockCode: 'TEST',
        state: 'IDLE',
        isInWatchlist: false,
        lastUpdated: Date.now(),
      };

      const mockTransaction: WatchlistTransaction = {
        id: 'TEST_123',
        stockCode: 'TEST',
        targetState: 'ADD',
        startedAt: Date.now(),
        state: 'OPTIMISTIC_UPDATING',
        retryCount: 0,
      };

      // 这些应该不会导致类型错误
      expect(mockStatus).toBeDefined();
      expect(mockTransaction).toBeDefined();
    });

    it('应该支持所有有效的状态值', () => {
      // 测试所有状态值都可以被使用
      const allStates: WatchlistToggleState[] = [
        'IDLE',
        'OPTIMISTIC_UPDATING',
        'SYNCING',
        'SUCCESS',
        'ROLLBACK_ERROR',
      ];

      allStates.forEach(state => {
        const description = getStateDescription(state);
        expect(description).toBeDefined();

        // 测试状态转换
        if (state === 'IDLE') {
          expect(isValidTransition(state, 'OPTIMISTIC_UPDATING')).toBe(true);
        }
      });
    });
  });
});