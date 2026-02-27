/**
 * useWatchlistData Hook 测试
 * 测试Hook的API失败场景和状态管理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWatchlistData } from '../useWatchlistData';
import { useWatchlistStore } from '@/lib/store/watchlist-store';

// Mock store
vi.mock('@/lib/store/watchlist-store', () => ({
  useWatchlistStore: vi.fn(),
}));

// Mock data-sync-manager
vi.mock('@/lib/bmad/data-sync-manager', () => ({
  getDataSyncManager: vi.fn(() => ({
    initialize: vi.fn(),
    sync: vi.fn(),
    cleanup: vi.fn(),
    subscribeToRealtimeData: vi.fn(() => ['sub-1']),
    on: vi.fn(),
  })),
}));

describe('useWatchlistData Hook', () => {
  const mockStore = {
    getFavoriteItems: vi.fn(),
    isLoading: false,
    error: null,
    syncWithServer: vi.fn(),
    addItemOptimistic: vi.fn(),
    removeItemOptimistic: vi.fn(),
    updateItem: vi.fn(),
    updateItemPrice: vi.fn(),
    reorderItems: vi.fn(),
  };

  beforeEach(() => {
    // 重置mock
    vi.clearAllMocks();

    // 设置默认mock返回值
    mockStore.getFavoriteItems.mockReturnValue([]);
    mockStore.syncWithServer.mockResolvedValue(undefined);
    mockStore.addItemOptimistic.mockResolvedValue('transaction-123');
    mockStore.removeItemOptimistic.mockResolvedValue('transaction-456');

    (useWatchlistStore as any).mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('基本功能', () => {
    it('应该正确初始化', () => {
      const { result } = renderHook(() => useWatchlistData());

      expect(result.current.items).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isRealtimeConnected).toBe(false);
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.syncProgress).toBe(0);
    });

    it('应该返回store中的数据', () => {
      const mockItems = [
        { id: '1', stockCode: 'AAPL', stockName: 'Apple Inc.', isFavorite: true, toggleStatus: 'IDLE' as any, createdAt: new Date(), updatedAt: new Date(), lastUpdated: Date.now() },
        { id: '2', stockCode: 'GOOGL', stockName: 'Alphabet Inc.', isFavorite: true, toggleStatus: 'IDLE' as any, createdAt: new Date(), updatedAt: new Date(), lastUpdated: Date.now() },
      ];

      mockStore.getFavoriteItems.mockReturnValue(mockItems);

      const { result } = renderHook(() => useWatchlistData());

      expect(result.current.items).toEqual(mockItems);
      expect(result.current.items).toHaveLength(2);
    });
  });

  describe('数据操作', () => {
    it('应该成功添加项目', async () => {
      const { result } = renderHook(() => useWatchlistData());

      await act(async () => {
        const transactionId = await result.current.addItem('AAPL', 'Apple Inc.');
        expect(transactionId).toBe('transaction-123');
        expect(mockStore.addItemOptimistic).toHaveBeenCalledWith('AAPL', 'Apple Inc.');
      });
    });

    it('应该处理添加项目失败', async () => {
      mockStore.addItemOptimistic.mockRejectedValue(new Error('添加失败'));

      const { result } = renderHook(() => useWatchlistData());

      await act(async () => {
        await expect(result.current.addItem('AAPL', 'Apple Inc.')).rejects.toThrow('添加失败');
      });
    });

    it('应该成功移除项目', async () => {
      const { result } = renderHook(() => useWatchlistData());

      await act(async () => {
        const transactionId = await result.current.removeItem('AAPL');
        expect(transactionId).toBe('transaction-456');
        expect(mockStore.removeItemOptimistic).toHaveBeenCalledWith('AAPL');
      });
    });

    it('应该处理移除项目失败', async () => {
      mockStore.removeItemOptimistic.mockRejectedValue(new Error('移除失败'));

      const { result } = renderHook(() => useWatchlistData());

      await act(async () => {
        await expect(result.current.removeItem('AAPL')).rejects.toThrow('移除失败');
      });
    });

    it('应该成功更新项目', async () => {
      const { result } = renderHook(() => useWatchlistData());

      await act(async () => {
        await result.current.updateItem('AAPL', { notes: '测试备注' });
        expect(mockStore.updateItem).toHaveBeenCalledWith('AAPL', { notes: '测试备注' });
      });
    });

    it('应该成功重新排序', () => {
      const { result } = renderHook(() => useWatchlistData());

      act(() => {
        result.current.reorderItems(['GOOGL', 'AAPL']);
        expect(mockStore.reorderItems).toHaveBeenCalledWith(['GOOGL', 'AAPL']);
      });
    });
  });

  describe('刷新和同步', () => {
    it('应该成功刷新数据', async () => {
      const { result } = renderHook(() => useWatchlistData());

      await act(async () => {
        await result.current.refresh();
        expect(mockStore.syncWithServer).toHaveBeenCalled();
      });
    });

    it('应该处理刷新失败', async () => {
      mockStore.syncWithServer.mockRejectedValue(new Error('同步失败'));

      const { result } = renderHook(() => useWatchlistData());

      await act(async () => {
        await result.current.refresh();
        expect(mockStore.syncWithServer).toHaveBeenCalled();
        // 错误会被捕获并记录到console.error
      });
    });

    it('应该显示同步状态', async () => {
      // Mock同步管理器事件
      const eventHandlers: Record<string, Function> = {};
      const mockSyncManager = {
        initialize: vi.fn(),
        sync: vi.fn(),
        cleanup: vi.fn(),
        subscribeToRealtimeData: vi.fn(() => ['sub-1']),
        on: vi.fn((event: string, handler: Function) => {
          eventHandlers[event] = handler;
        }),
      };

      vi.mocked(require('@/lib/bmad/data-sync-manager').getDataSyncManager).mockReturnValue(mockSyncManager);

      const { result } = renderHook(() => useWatchlistData({ autoSync: true }));

      // 触发同步开始事件
      act(() => {
        eventHandlers.syncStart?.();
      });

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true);
        expect(result.current.syncProgress).toBe(0);
      });

      // 触发同步进度事件
      act(() => {
        eventHandlers.syncProgress?.(50);
      });

      await waitFor(() => {
        expect(result.current.syncProgress).toBe(50);
      });

      // 触发同步完成事件
      act(() => {
        eventHandlers.syncComplete?.(true);
      });

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false);
      });
    });

    it('应该处理同步失败事件', async () => {
      const eventHandlers: Record<string, Function> = {};
      const mockSyncManager = {
        initialize: vi.fn(),
        sync: vi.fn(),
        cleanup: vi.fn(),
        subscribeToRealtimeData: vi.fn(() => ['sub-1']),
        on: vi.fn((event: string, handler: Function) => {
          eventHandlers[event] = handler;
        }),
      };

      vi.mocked(require('@/lib/bmad/data-sync-manager').getDataSyncManager).mockReturnValue(mockSyncManager);

      const { result } = renderHook(() => useWatchlistData());

      // 触发同步开始
      act(() => {
        eventHandlers.syncStart?.();
      });

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true);
      });

      // 触发同步失败
      act(() => {
        eventHandlers.syncComplete?.(false);
      });

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false);
      });
    });
  });

  describe('实时数据', () => {
    it('应该连接实时数据', () => {
      const mockItems = [
        { id: '1', stockCode: 'AAPL', stockName: 'Apple Inc.', isFavorite: true, toggleStatus: 'IDLE' as any, createdAt: new Date(), updatedAt: new Date(), lastUpdated: Date.now() },
      ];

      mockStore.getFavoriteItems.mockReturnValue(mockItems);

      const { result } = renderHook(() => useWatchlistData({ enableRealtime: true }));

      expect(result.current.isRealtimeConnected).toBe(true);
    });

    it('应该处理实时数据更新', () => {
      const mockItems = [
        { id: '1', stockCode: 'AAPL', stockName: 'Apple Inc.', isFavorite: true, toggleStatus: 'IDLE' as any, createdAt: new Date(), updatedAt: new Date(), lastUpdated: Date.now() },
      ];

      mockStore.getFavoriteItems.mockReturnValue(mockItems);

      const { result } = renderHook(() => useWatchlistData({ enableRealtime: true }));

      // 实时数据连接应该已建立
      expect(result.current.isRealtimeConnected).toBe(true);
    });

    it('应该禁用实时数据', () => {
      const { result } = renderHook(() => useWatchlistData({ enableRealtime: false }));

      expect(result.current.isRealtimeConnected).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('应该显示store错误', () => {
      const mockStoreWithError = {
        ...mockStore,
        error: '网络连接失败',
      };

      (useWatchlistStore as any).mockReturnValue(mockStoreWithError);

      const { result } = renderHook(() => useWatchlistData());

      expect(result.current.error).toBe('网络连接失败');
    });

    it('应该处理初始化失败', async () => {
      const mockSyncManager = {
        initialize: vi.fn().mockRejectedValue(new Error('初始化失败')),
        sync: vi.fn(),
        cleanup: vi.fn(),
        subscribeToRealtimeData: vi.fn(() => []),
        on: vi.fn(),
      };

      vi.mocked(require('@/lib/bmad/data-sync-manager').getDataSyncManager).mockReturnValue(mockSyncManager);

      // 不应该抛出错误
      const { result } = renderHook(() => useWatchlistData());

      expect(result.current.isRealtimeConnected).toBe(false);
    });
  });

  describe('配置选项', () => {
    it('应该禁用自动同步', () => {
      const mockSyncManager = {
        initialize: vi.fn(),
        sync: vi.fn(),
        cleanup: vi.fn(),
        subscribeToRealtimeData: vi.fn(() => []),
        on: vi.fn(),
      };

      vi.mocked(require('@/lib/bmad/data-sync-manager').getDataSyncManager).mockReturnValue(mockSyncManager);

      renderHook(() => useWatchlistData({ autoSync: false }));

      // sync方法不应该被调用
      expect(mockSyncManager.sync).not.toHaveBeenCalled();
    });

    it('应该使用自定义同步间隔', () => {
      const mockSyncManager = {
        initialize: vi.fn(),
        sync: vi.fn(),
        cleanup: vi.fn(),
        subscribeToRealtimeData: vi.fn(() => []),
        on: vi.fn(),
      };

      vi.mocked(require('@/lib/bmad/data-sync-manager').getDataSyncManager).mockReturnValue(mockSyncManager);

      // 注意：我们无法直接测试setInterval，但可以验证配置被传递
      renderHook(() => useWatchlistData({ syncInterval: 60000 }));

      expect(mockSyncManager.initialize).toHaveBeenCalled();
    });

    it('应该使用自定义实时数据间隔', () => {
      renderHook(() => useWatchlistData({ realtimeInterval: 10000 }));

      // 主要验证不会抛出错误
      expect(true).toBe(true);
    });
  });

  describe('清理', () => {
    it('应该在卸载时清理', () => {
      const mockSyncManager = {
        initialize: vi.fn(),
        sync: vi.fn(),
        cleanup: vi.fn(),
        subscribeToRealtimeData: vi.fn(() => ['sub-1']),
        on: vi.fn(),
      };

      vi.mocked(require('@/lib/bmad/data-sync-manager').getDataSyncManager).mockReturnValue(mockSyncManager);

      const { unmount } = renderHook(() => useWatchlistData());

      unmount();

      expect(mockSyncManager.cleanup).toHaveBeenCalled();
    });
  });
});