// components/layout/gesture-detector.test.tsx
import { render } from '@testing-library/react';
import { GestureDetector } from './gesture-detector';
import { useRouter } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('GestureDetector', () => {
  let mockBack: jest.Mock;
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    mockBack = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      back: mockBack,
    });

    // Mock window event listeners
    addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    jest.clearAllMocks();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('应该不渲染任何内容', () => {
    const { container } = render(<GestureDetector />);
    expect(container.firstChild).toBeNull();
  });

  it('当enabled为true时应该添加事件监听器', () => {
    render(<GestureDetector enabled={true} />);

    expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true });
    expect(addEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });
  });

  it('当enabled为false时不应该添加事件监听器', () => {
    render(<GestureDetector enabled={false} />);

    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it('组件卸载时应该移除事件监听器', () => {
    const { unmount } = render(<GestureDetector />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
  });

  it('应该使用默认参数', () => {
    render(<GestureDetector />);

    // 验证事件监听器被添加
    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
  });

  it('应该支持自定义参数', () => {
    render(<GestureDetector edgeWidth={30} minSwipeDistance={80} />);

    // 验证事件监听器被添加
    expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
  });

  describe('手势检测逻辑', () => {
    let touchStartHandler: (e: TouchEvent) => void;
    let touchEndHandler: (e: TouchEvent) => void;

    beforeEach(() => {
      render(<GestureDetector />);

      // 获取事件处理函数
      const touchstartCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchstart');
      const touchendCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend');

      touchStartHandler = touchstartCall[1];
      touchEndHandler = touchendCall[1];
    });

    it('应该只检测左边缘的触摸', () => {
      // 在左边缘内的触摸
      const touchEvent = {
        touches: [{ clientX: 10 }] // edgeWidth默认20，10 < 20
      } as unknown as TouchEvent;

      touchStartHandler(touchEvent);
      expect(touchStartHandler).toBeDefined();

      // 在左边缘外的触摸
      const touchEventOutside = {
        touches: [{ clientX: 30 }] // 30 > 20
      } as unknown as TouchEvent;

      // 这个应该被忽略
      touchStartHandler(touchEventOutside);
    });

    it('应该检测有效的从左向右滑动', () => {
      // 模拟触摸开始
      const touchStartEvent = {
        touches: [{ clientX: 10, clientY: 100 }]
      } as unknown as TouchEvent;

      touchStartHandler(touchStartEvent);

      // 模拟触摸结束 - 有效的从左向右滑动
      const touchEndEvent = {
        changedTouches: [{ clientX: 80, clientY: 105 }] // deltaX = 70 > minSwipeDistance(50), deltaY = 5
      } as unknown as TouchEvent;

      touchEndHandler(touchEndEvent);

      expect(mockBack).toHaveBeenCalled();
    });

    it('应该忽略垂直滑动', () => {
      // 模拟触摸开始
      const touchStartEvent = {
        touches: [{ clientX: 10, clientY: 100 }]
      } as unknown as TouchEvent;

      touchStartHandler(touchStartEvent);

      // 模拟触摸结束 - 垂直滑动
      const touchEndEvent = {
        changedTouches: [{ clientX: 20, clientY: 180 }] // deltaX = 10, deltaY = 80 (垂直移动远大于水平移动)
      } as unknown as TouchEvent;

      touchEndHandler(touchEndEvent);

      expect(mockBack).not.toHaveBeenCalled();
    });

    it('应该忽略滑动距离不足', () => {
      // 模拟触摸开始
      const touchStartEvent = {
        touches: [{ clientX: 10, clientY: 100 }]
      } as unknown as TouchEvent;

      touchStartHandler(touchStartEvent);

      // 模拟触摸结束 - 滑动距离不足
      const touchEndEvent = {
        changedTouches: [{ clientX: 40, clientY: 102 }] // deltaX = 30 < minSwipeDistance(50)
      } as unknown as TouchEvent;

      touchEndHandler(touchEndEvent);

      expect(mockBack).not.toHaveBeenCalled();
    });

    it('应该忽略从右向左滑动', () => {
      // 模拟触摸开始
      const touchStartEvent = {
        touches: [{ clientX: 80, clientY: 100 }]
      } as unknown as TouchEvent;

      touchStartHandler(touchStartEvent);

      // 模拟触摸结束 - 从右向左滑动
      const touchEndEvent = {
        changedTouches: [{ clientX: 20, clientY: 102 }] // deltaX = -60 (负值，从右向左)
      } as unknown as TouchEvent;

      touchEndHandler(touchEndEvent);

      expect(mockBack).not.toHaveBeenCalled();
    });
  });
});