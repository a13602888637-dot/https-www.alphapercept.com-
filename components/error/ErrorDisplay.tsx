/**
 * 统一错误显示组件
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Info, XCircle, WifiOff, Clock, ShieldAlert } from 'lucide-react';
import { StandardError, ErrorSeverity, ErrorType } from '@/lib/error/types';

interface ErrorDisplayProps {
  error: StandardError;
  title?: string;
  description?: string;
  showIcon?: boolean;
  showRetry?: boolean;
  onRetry?: () => void;
  showDetails?: boolean;
  className?: string;
  variant?: 'card' | 'inline' | 'full';
}

export function ErrorDisplay({
  error,
  title,
  description,
  showIcon = true,
  showRetry = true,
  onRetry,
  showDetails = false,
  className = '',
  variant = 'card'
}: ErrorDisplayProps) {
  const displayTitle = title || getErrorTitle(error);
  const displayDescription = description || error.userFriendlyMessage || error.message;

  const icon = getErrorIcon(error);
  const variantClass = getVariantClass(error);
  const iconColor = getIconColor(error);

  const content = (
    <div className={`flex items-start gap-3 ${variant === 'inline' ? 'py-2' : ''}`}>
      {showIcon && (
        <div className={`flex-shrink-0 ${iconColor}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="space-y-1">
          <h3 className={`font-medium ${variant === 'inline' ? 'text-sm' : 'text-base'}`}>
            {displayTitle}
          </h3>
          <p className={`text-muted-foreground ${variant === 'inline' ? 'text-xs' : 'text-sm'}`}>
            {displayDescription}
          </p>
        </div>
        {showDetails && error.details && (
          <div className="mt-2">
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                查看错误详情
              </summary>
              <pre className="mt-1 p-2 bg-muted rounded overflow-auto max-h-40">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          </div>
        )}
        {showRetry && onRetry && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              重试
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (variant === 'card') {
    return (
      <Card className={`${variantClass} ${className}`}>
        <CardContent className={`pt-6 ${variant === 'inline' ? 'py-3' : ''}`}>
          {content}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`min-h-[200px] flex flex-col items-center justify-center p-6 ${className}`}>
        <div className="text-center space-y-4 max-w-md">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${getFullVariantBg(error)}`}>
            <div className={iconColor}>
              {React.cloneElement(icon, { className: 'h-8 w-8' })}
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{displayTitle}</h2>
            <p className="text-muted-foreground">{displayDescription}</p>
          </div>
          {showRetry && onRetry && (
            <Button onClick={onRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>
          )}
        </div>
      </div>
    );
  }

  // inline variant
  return (
    <div className={`${variantClass} rounded-lg p-3 ${className}`}>
      {content}
    </div>
  );
}

/**
 * 错误边界组件
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 这里可以集成错误上报
    // reportErrorToService(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const standardError: StandardError = {
        code: 'COMPONENT_ERROR',
        message: this.state.error.message,
        severity: ErrorSeverity.HIGH,
        type: ErrorType.CLIENT,
        timestamp: new Date(),
        originalError: this.state.error,
        stack: this.state.error.stack,
        userFriendlyMessage: '组件渲染失败'
      };

      return (
        <ErrorDisplay
          error={standardError}
          showRetry={true}
          onRetry={this.handleRetry}
          variant="full"
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 降级数据组件
 */
interface FallbackDataDisplayProps<T = any> {
  data: T;
  isFallback: boolean;
  error?: StandardError;
  children: (data: T, isFallback: boolean) => React.ReactNode;
  fallbackComponent?: React.ReactNode;
}

export function FallbackDataDisplay<T = any>({
  data,
  isFallback,
  error,
  children,
  fallbackComponent
}: FallbackDataDisplayProps<T>): React.ReactElement {
  if (isFallback && error) {
    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }

    return (
      <div className="space-y-4">
        <ErrorDisplay
          error={error}
          title="数据加载失败"
          description="正在使用缓存数据，部分功能可能受限"
          variant="inline"
          showRetry={true}
        />
        {children(data, true)}
      </div>
    );
  }

  return <>{children(data, false)}</>;
}

// 辅助函数
function getErrorTitle(error: StandardError): string {
  switch (error.severity) {
    case ErrorSeverity.LOW:
      return '提示';
    case ErrorSeverity.MEDIUM:
      return '操作失败';
    case ErrorSeverity.HIGH:
      return '系统错误';
    case ErrorSeverity.CRITICAL:
      return '严重错误';
    default:
      return '错误';
  }
}

function getErrorIcon(error: StandardError): React.ReactElement {
  const className = 'h-5 w-5';

  switch (error.type) {
    case ErrorType.NETWORK:
      return <WifiOff className={className} />;
    case ErrorType.TIMEOUT:
      return <Clock className={className} />;
    case ErrorType.AUTH:
    case ErrorType.PERMISSION:
      return <ShieldAlert className={className} />;
    case ErrorType.VALIDATION:
      return <Info className={className} />;
    default:
      return <AlertTriangle className={className} />;
  }
}

function getIconColor(error: StandardError): string {
  switch (error.severity) {
    case ErrorSeverity.LOW:
      return 'text-blue-500';
    case ErrorSeverity.MEDIUM:
      return 'text-yellow-500';
    case ErrorSeverity.HIGH:
      return 'text-orange-500';
    case ErrorSeverity.CRITICAL:
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

function getVariantClass(error: StandardError): string {
  switch (error.severity) {
    case ErrorSeverity.LOW:
      return 'border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800';
    case ErrorSeverity.MEDIUM:
      return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800';
    case ErrorSeverity.HIGH:
      return 'border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800';
    case ErrorSeverity.CRITICAL:
      return 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800';
    default:
      return 'border-gray-200 bg-gray-50 dark:bg-gray-950/20 dark:border-gray-800';
  }
}

function getFullVariantBg(error: StandardError): string {
  switch (error.severity) {
    case ErrorSeverity.LOW:
      return 'bg-blue-100 dark:bg-blue-900/30';
    case ErrorSeverity.MEDIUM:
      return 'bg-yellow-100 dark:bg-yellow-900/30';
    case ErrorSeverity.HIGH:
      return 'bg-orange-100 dark:bg-orange-900/30';
    case ErrorSeverity.CRITICAL:
      return 'bg-red-100 dark:bg-red-900/30';
    default:
      return 'bg-gray-100 dark:bg-gray-900/30';
  }
}