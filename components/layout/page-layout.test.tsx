// components/layout/page-layout.test.tsx
import { render, screen } from '@testing-library/react';
import { PageLayout } from './page-layout';
import { usePathname } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

// Mock child components
jest.mock('./back-navigation', () => ({
  BackNavigation: () => <div data-testid="back-navigation">BackNavigation</div>,
}));

jest.mock('./gesture-detector.client', () => ({
  __esModule: true,
  default: () => <div data-testid="gesture-detector">GestureDetector</div>,
}));

describe('PageLayout', () => {
  beforeEach(() => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染子内容', () => {
    render(
      <PageLayout>
        <div data-testid="child-content">Test Content</div>
      </PageLayout>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('当是二级页面时应该显示返回按钮', () => {
    (usePathname as jest.Mock).mockReturnValue('/strategy-recommendation');

    render(
      <PageLayout>
        <div>Test Content</div>
      </PageLayout>
    );

    expect(screen.getByTestId('back-navigation')).toBeInTheDocument();
    expect(screen.getByTestId('gesture-detector')).toBeInTheDocument();
  });

  it('当是主页面时不应该显示返回按钮', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    render(
      <PageLayout>
        <div>Test Content</div>
      </PageLayout>
    );

    expect(screen.queryByTestId('back-navigation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gesture-detector')).not.toBeInTheDocument();
  });

  it('当showBackButton为true时应该强制显示返回按钮', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');

    render(
      <PageLayout showBackButton={true}>
        <div>Test Content</div>
      </PageLayout>
    );

    expect(screen.getByTestId('back-navigation')).toBeInTheDocument();
    expect(screen.getByTestId('gesture-detector')).toBeInTheDocument();
  });

  it('当showBackButton为false时应该强制隐藏返回按钮', () => {
    (usePathname as jest.Mock).mockReturnValue('/strategy-recommendation');

    render(
      <PageLayout showBackButton={false}>
        <div>Test Content</div>
      </PageLayout>
    );

    expect(screen.queryByTestId('back-navigation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gesture-detector')).not.toBeInTheDocument();
  });

  it('应该渲染标题当提供时', () => {
    render(
      <PageLayout title="测试页面标题">
        <div>Test Content</div>
      </PageLayout>
    );

    expect(screen.getByText('测试页面标题')).toBeInTheDocument();
  });

  it('应该应用自定义类名', () => {
    const { container } = render(
      <PageLayout className="custom-class" contentClassName="custom-content-class">
        <div>Test Content</div>
      </PageLayout>
    );

    const layoutDiv = container.firstChild;
    expect(layoutDiv).toHaveClass('custom-class');

    const mainElement = screen.getByRole('main');
    expect(mainElement).toHaveClass('custom-content-class');
  });
});