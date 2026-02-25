/**
 * BMAD 节流防抖管理器
 * 使用requestAnimationFrame节流高频更新，避免React组件掉帧
 * 支持多种节流策略：throttle、debounce、rafThrottle
 */

export interface ThrottleConfig {
  mode: 'throttle' | 'debounce' | 'raf';
  delay: number;
  maxWait?: number;
  leading: boolean;
  trailing: boolean;
}

export interface ThrottleInstance {
  id: string;
  callback: (...args: any[]) => void;
  config: ThrottleConfig;
  lastCallTime: number;
  lastExecutionTime: number;
  timeoutId: NodeJS.Timeout | null;
  rafId: number | null;
  pendingArgs: any[] | null;
  isPending: boolean;
}

export class ThrottleManager {
  private instances: Map<string, ThrottleInstance> = new Map();
  private defaultConfig: ThrottleConfig = {
    mode: 'raf',
    delay: 16, // ~60fps
    leading: true,
    trailing: true,
  };

  /**
   * 创建节流函数
   */
  createThrottledFunction<T extends (...args: any[]) => any>(
    id: string,
    callback: T,
    config: Partial<ThrottleConfig> = {}
  ): T {
    // 如果已存在，先清理
    if (this.instances.has(id)) {
      this.cancel(id);
    }

    const fullConfig: ThrottleConfig = {
      ...this.defaultConfig,
      ...config,
    };

    const instance: ThrottleInstance = {
      id,
      callback,
      config: fullConfig,
      lastCallTime: 0,
      lastExecutionTime: 0,
      timeoutId: null,
      rafId: null,
      pendingArgs: null,
      isPending: false,
    };

    this.instances.set(id, instance);

    // 返回包装函数
    return ((...args: any[]) => {
      return this.scheduleExecution(id, args);
    }) as T;
  }

  /**
   * 执行节流调用
   */
  throttle(id: string, callback: (...args: any[]) => void, delay?: number): void {
    const config: Partial<ThrottleConfig> = {
      mode: 'throttle',
      delay: delay || this.defaultConfig.delay,
    };

    const throttledFn = this.createThrottledFunction(id, callback, config);
    throttledFn();
  }

  /**
   * 执行防抖调用
   */
  debounce(id: string, callback: (...args: any[]) => void, delay?: number): void {
    const config: Partial<ThrottleConfig> = {
      mode: 'debounce',
      delay: delay || this.defaultConfig.delay,
    };

    const throttledFn = this.createThrottledFunction(id, callback, config);
    throttledFn();
  }

  /**
   * 执行requestAnimationFrame节流调用
   */
  rafThrottle(id: string, callback: (...args: any[]) => void): void {
    const config: Partial<ThrottleConfig> = {
      mode: 'raf',
      delay: 0,
    };

    const throttledFn = this.createThrottledFunction(id, callback, config);
    throttledFn();
  }

  /**
   * 取消待执行的调用
   */
  cancel(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;

    this.cleanupInstance(instance);
    this.instances.delete(id);
  }

  /**
   * 立即执行并取消节流
   */
  flush(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;

    if (instance.isPending && instance.pendingArgs) {
      this.executeCallback(instance, instance.pendingArgs);
    }

    this.cancel(id);
  }

  /**
   * 检查是否有待执行的调用
   */
  isPending(id: string): boolean {
    const instance = this.instances.get(id);
    return instance?.isPending || false;
  }

  /**
   * 获取节流统计信息
   */
  getStats(id: string): {
    totalCalls: number;
    executedCalls: number;
    skippedCalls: number;
    lastCallTime: number;
    lastExecutionTime: number;
    averageDelay: number;
  } | null {
    // 这里需要扩展ThrottleInstance来跟踪统计信息
    // 暂时返回基本信息
    const instance = this.instances.get(id);
    if (!instance) return null;

    return {
      totalCalls: 0,
      executedCalls: 0,
      skippedCalls: 0,
      lastCallTime: instance.lastCallTime,
      lastExecutionTime: instance.lastExecutionTime,
      averageDelay: 0,
    };
  }

  /**
   * 清理所有节流实例
   */
  cleanupAll(): void {
    for (const instance of this.instances.values()) {
      this.cleanupInstance(instance);
    }
    this.instances.clear();
  }

  /**
   * 私有方法
   */
  private scheduleExecution(id: string, args: any[]): void {
    const instance = this.instances.get(id);
    if (!instance) return;

    const now = Date.now();
    instance.lastCallTime = now;
    instance.pendingArgs = args;

    switch (instance.config.mode) {
      case 'throttle':
        this.scheduleThrottle(instance, now);
        break;
      case 'debounce':
        this.scheduleDebounce(instance, now);
        break;
      case 'raf':
        this.scheduleRaf(instance);
        break;
    }
  }

  private scheduleThrottle(instance: ThrottleInstance, now: number): void {
    const { delay, leading, trailing } = instance.config;
    const timeSinceLastExecution = now - instance.lastExecutionTime;

    // 如果是首次调用且配置了leading，立即执行
    if (leading && instance.lastExecutionTime === 0) {
      this.executeCallback(instance, instance.pendingArgs!);
      return;
    }

    // 如果距离上次执行已经超过delay，立即执行
    if (timeSinceLastExecution >= delay) {
      this.executeCallback(instance, instance.pendingArgs!);
      return;
    }

    // 否则，安排延迟执行
    if (!instance.isPending) {
      instance.isPending = true;

      instance.timeoutId = setTimeout(() => {
        if (trailing && instance.pendingArgs) {
          this.executeCallback(instance, instance.pendingArgs);
        }
        instance.isPending = false;
        instance.pendingArgs = null;
      }, delay - timeSinceLastExecution);
    }
  }

  private scheduleDebounce(instance: ThrottleInstance, now: number): void {
    const { delay, leading, trailing } = instance.config;

    // 如果是首次调用且配置了leading，立即执行
    if (leading && instance.lastExecutionTime === 0) {
      this.executeCallback(instance, instance.pendingArgs!);
      return;
    }

    // 清除之前的定时器
    if (instance.timeoutId) {
      clearTimeout(instance.timeoutId);
    }

    instance.isPending = true;

    instance.timeoutId = setTimeout(() => {
      if (trailing && instance.pendingArgs) {
        this.executeCallback(instance, instance.pendingArgs);
      }
      instance.isPending = false;
      instance.pendingArgs = null;
    }, delay);
  }

  private scheduleRaf(instance: ThrottleInstance): void {
    // 如果已经在等待RAF，更新参数
    if (instance.rafId !== null) {
      return;
    }

    instance.isPending = true;

    instance.rafId = requestAnimationFrame(() => {
      if (instance.pendingArgs) {
        this.executeCallback(instance, instance.pendingArgs);
      }
      instance.rafId = null;
      instance.isPending = false;
      instance.pendingArgs = null;
    });
  }

  private executeCallback(instance: ThrottleInstance, args: any[]): void {
    instance.lastExecutionTime = Date.now();

    try {
      instance.callback(...args);
    } catch (error) {
      console.error(`Error in throttled function ${instance.id}:`, error);
    }
  }

  private cleanupInstance(instance: ThrottleInstance): void {
    if (instance.timeoutId) {
      clearTimeout(instance.timeoutId);
      instance.timeoutId = null;
    }

    if (instance.rafId !== null) {
      cancelAnimationFrame(instance.rafId);
      instance.rafId = null;
    }

    instance.isPending = false;
    instance.pendingArgs = null;
  }
}

// 单例实例
let globalThrottleManager: ThrottleManager | null = null;

export function getThrottleManager(): ThrottleManager {
  if (!globalThrottleManager) {
    globalThrottleManager = new ThrottleManager();
  }
  return globalThrottleManager;
}

/**
 * 工具函数：创建节流函数
 */
export function createThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: Partial<ThrottleConfig> = {}
): T {
  const manager = getThrottleManager();
  const id = `throttle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return manager.createThrottledFunction(id, callback, {
    mode: 'throttle',
    delay,
    ...options,
  });
}

/**
 * 工具函数：创建防抖函数
 */
export function createDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: Partial<ThrottleConfig> = {}
): T {
  const manager = getThrottleManager();
  const id = `debounce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return manager.createThrottledFunction(id, callback, {
    mode: 'debounce',
    delay,
    ...options,
  });
}

/**
 * 工具函数：创建RAF节流函数
 */
export function createRafThrottle<T extends (...args: any[]) => any>(
  callback: T
): T {
  const manager = getThrottleManager();
  const id = `raf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return manager.createThrottledFunction(id, callback, {
    mode: 'raf',
  });
}