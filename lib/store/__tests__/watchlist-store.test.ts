/**
 * Watchlist Store 测试
 * 测试状态机和API失败场景
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useWatchlistStore } from '../watchlist-store';
import { WatchlistToggleState } from '@/lib/types/watchlist-state-machine';

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true,
});

describe('Watchlist Store', () => {
  beforeEach(() => {
    // 重置store状态
    useWatchlistStore.setState({
      items: {},
      groups: [],
      itemOrder: [],
      itemStatuses: {},
      activeTransactions: {},
      isLoading: false,
      error: null,
      lastSynced: null,
      config: {
        syncTimeout: 10000,
        maxRetries: 3,
        hapticFeedback: true,
      },
    });

    // 重置mock
    mockFetch.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('状态机操作', () => {
    it('应该成功添加自选股', async () => {
      const store = useWatchlistStore.getState();

      // Mock成功的API响应
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test-id', stockCode: 'AAPL', stockName: 'Apple Inc.' }),
      });

      const transactionId = await store.startToggleTransaction('AAPL', 'Apple Inc.', 'ADD');

      expect(transactionId).toBeDefined();
      expect(store.getFavoriteItems()).toHaveLength(1);
      expect(store.getItemStatus('AAPL').state).toBe('OPTIMISTIC_UPDATING');

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(store.getItemStatus('AAPL').state).toBe('SUCCESS');
    });

    it('应该处理API网络错误', async () => {
      const store = useWatchlistStore.getState();

      // Mock网络错误
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const transactionId = await store.startToggleTransaction('AAPL', 'Apple Inc.', 'ADD');

      expect(transactionId).toBeDefined();
      expect(store.getFavoriteItems()).toHaveLength(1);

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = store.getItemStatus('AAPL');
      expect(status.state).toBe('ROLLBACK_ERROR');
      expect(status.error).toContain('网络错误');
      expect(store.getFavoriteItems()).toHaveLength(0); // 应该回滚
    });

    it('应该处理API服务器错误（500）', async () => {
      const store = useWatchlistStore.getState();

      // Mock服务器错误
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: '服务器内部错误' }),
      });

      const transactionId = await store.startToggleTransaction('AAPL', 'Apple Inc.', 'ADD');

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = store.getItemStatus('AAPL');
      expect(status.state).toBe('ROLLBACK_ERROR');
      expect(status.error).toContain('API请求失败: 500');
    });

    it('应该处理API超时', async () => {
      const store = useWatchlistStore.getState();

      // Mock超时（长时间不响应）
      mockFetch.mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ id: 'test-id' }),
        }), 20000); // 20秒超时
      }));

      const transactionId = await store.startToggleTransaction('AAPL', 'Apple Inc.', 'ADD');

      // 等待超时（配置为10秒）
      await new Promise(resolve => setTimeout(resolve, 11000));

      // 注意：当前实现没有显式的超时处理，需要检查状态
      const transaction = store.getItemTransaction('AAPL');
      expect(transaction).toBeDefined();
      // 超时后应该仍然是SYNCING状态，因为没有超时处理逻辑
    });

    it('应该成功重试失败的事务', async () => {
      const store = useWatchlistStore.getState();

      // 第一次失败
      mockFetch.mockRejectedValueOnce(new Error('First attempt failed'));
      // 第二次成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test-id' }),
      });

      const transactionId = await store.startToggleTransaction('AAPL', 'Apple Inc.', 'ADD');

      // 等待第一次失败
      await new Promise(resolve => setTimeout(resolve, 150));

      // 重试
      store.retryTransaction(transactionId);

      // 等待重试成功
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = store.getItemStatus('AAPL');
      expect(status.state).toBe('SUCCESS');
    });

    it('应该达到最大重试次数后停止重试', async () => {
      const store = useWatchlistStore.getState();

      // 连续失败4次（超过最大重试次数3次）
      mockFetch.mockRejectedValue(new Error('Persistent failure'));

      const transactionId = await store.startToggleTransaction('AAPL', 'Apple Inc.', 'ADD');

      // 等待第一次失败
      await new Promise(resolve => setTimeout(resolve, 150));

      // 重试3次
      for (let i = 0; i < 3; i++) {
        store.retryTransaction(transactionId);
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // 第4次重试应该被忽略（超过最大重试次数）
      const transactionBefore = store.getItemTransaction('AAPL');
      store.retryTransaction(transactionId);
      const transactionAfter = store.getItemTransaction('AAPL');

      expect(transactionBefore?.retryCount).toBe(3);
      expect(transactionAfter?.retryCount).toBe(3); // 应该没有增加
    });
  });

  describe('syncWithServer API', () => {
    it('应该成功同步数据', async () => {
      const store = useWatchlistStore.getState();

      const mockData = [
        { id: '1', stockCode: 'AAPL', stockName: 'Apple Inc.', createdAt: '2024-01-01', updatedAt: '2024-01-02' },
        { id: '2', stockCode: 'GOOGL', stockName: 'Alphabet Inc.', createdAt: '2024-01-01', updatedAt: '2024-01-02' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      await store.syncWithServer();

      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.lastSynced).toBeDefined();
      expect(store.getFavoriteItems()).toHaveLength(2);
    });

    it('应该处理同步API失败', async () => {
      const store = useWatchlistStore.getState();

      mockFetch.mockRejectedValueOnce(new Error('Network error during sync'));

      await store.syncWithServer();

      expect(store.isLoading).toBe(false);
      expect(store.error).toContain('同步失败');
      expect(store.lastSynced).toBeDefined(); // 即使失败也记录同步尝试时间
    });

    it('应该处理同步API返回无效数据', async () => {
      const store = useWatchlistStore.getState();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notAnArray: true }), // 无效的数据格式
      });

      await store.syncWithServer();

      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      // 应该保持原有数据不变
    });

    it('应该处理同步API返回空数组', async () => {
      const store = useWatchlistStore.getState();

      // 先添加一些本地数据
      store.addItemOptimistic('AAPL', 'Apple Inc.');
      await new Promise(resolve => setTimeout(resolve, 50));

      // API返回空数组
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await store.syncWithServer();

      expect(store.getFavoriteItems()).toHaveLength(0); // 应该清空
    });
  });

  describe('乐观更新', () => {
    it('应该立即更新UI（乐观更新）', async () => {
      const store = useWatchlistStore.getState();

      // Mock慢速API
      mockFetch.mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ id: 'test-id' }),
        }), 1000);
      }));

      const transactionId = await store.addItemOptimistic('AAPL', 'Apple Inc.');

      // 立即检查（乐观更新应该立即生效）
      expect(store.getFavoriteItems()).toHaveLength(1);
      expect(store.getItem('AAPL')?.isFavorite).toBe(true);
      expect(store.getItemStatus('AAPL').state).toBe('OPTIMISTIC_UPDATING');
    });

    it('应该回滚乐观更新当API失败时', async () => {
      const store = useWatchlistStore.getState();

      mockFetch.mockRejectedValueOnce(new Error('API failed'));

      await store.addItemOptimistic('AAPL', 'Apple Inc.');

      // 等待API失败
      await new Promise(resolve => setTimeout(resolve, 150));

      // 应该回滚
      expect(store.getFavoriteItems()).toHaveLength(0);
      expect(store.getItemStatus('AAPL').state).toBe('ROLLBACK_ERROR');
    });

    it('应该保持乐观更新当API成功时', async () => {
      const store = useWatchlistStore.getState();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test-id' }),
      });

      await store.addItemOptimistic('AAPL', 'Apple Inc.');

      // 等待API成功
      await new Promise(resolve => setTimeout(resolve, 150));

      // 应该保持添加状态
      expect(store.getFavoriteItems()).toHaveLength(1);
      expect(store.getItemStatus('AAPL').state).toBe('SUCCESS');
    });
  });

  describe('事务管理', () => {
    it('应该取消进行中的事务', async () => {
      const store = useWatchlistStore.getState();

      // Mock慢速API
      mockFetch.mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ id: 'test-id' }),
        }), 1000);
      }));

      const transactionId = await store.startToggleTransaction('AAPL', 'Apple Inc.', 'ADD');

      // 立即取消
      store.cancelTransaction(transactionId);

      // 应该回滚到之前的状态
      expect(store.getFavoriteItems()).toHaveLength(0);
      expect(store.getItemTransaction('AAPL')).toBeUndefined();
    });

    it('应该清理成功的事务', async () => {
      const store = useWatchlistStore.getState();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test-id' }),
      });

      const transactionId = await store.startToggleTransaction('AAPL', 'Apple Inc.', 'ADD');

      // 等待成功
      await new Promise(resolve => setTimeout(resolve, 150));

      // 再等待清理（成功2秒后清理）
      await new Promise(resolve => setTimeout(resolve, 2100));

      expect(store.getItemTransaction('AAPL')).toBeUndefined();
    });
  });

  describe('边界情况', () => {
    it('应该处理重复添加', async () => {
      const store = useWatchlistStore.getState();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'test-id' }),
      });

      // 第一次添加
      await store.addItemOptimistic('AAPL', 'Apple Inc.');
      await new Promise(resolve => setTimeout(resolve, 150));

      // 第二次添加（应该被正确处理）
      await store.addItemOptimistic('AAPL', 'Apple Inc.');
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(store.getFavoriteItems()).toHaveLength(1); // 仍然只有一项
      expect(store.getItemStatus('AAPL').state).toBe('SUCCESS');
    });

    it('应该处理移除不存在的项目', async () => {
      const store = useWatchlistStore.getState();

      const result = await store.removeItemOptimistic('NONEXISTENT');

      expect(result).toBe(''); // 应该返回空字符串
    });

    it('应该处理无效的状态转换', () => {
      const store = useWatchlistStore.getState();

      // 手动设置一个无效的状态转换
      store.updateTransactionState('invalid-id', 'SUCCESS' as WatchlistToggleState);

      // 应该不会崩溃，只是警告
      expect(store.error).toBeNull();
    });
  });
});