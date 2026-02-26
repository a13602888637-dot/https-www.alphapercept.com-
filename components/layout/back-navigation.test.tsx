// components/layout/back-navigation.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BackNavigation } from './back-navigation';
import { useRouter } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('BackNavigation', () => {
  const mockPush = jest.fn();
  const mockBack = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      back: mockBack,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染返回按钮', () => {
    render(<BackNavigation />);
    expect(screen.getByLabelText('返回')).toBeInTheDocument();
  });

  it('点击按钮应该调用router.back()当有历史时', () => {
    // 模拟有历史记录
    Object.defineProperty(window, 'history', {
      value: { length: 3 },
      writable: true,
    });

    render(<BackNavigation />);
    fireEvent.click(screen.getByLabelText('返回'));

    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});