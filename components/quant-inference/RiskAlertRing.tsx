/**
 * 风险警报环组件
 * 用于显示AI推理的高危状态警报
 */

import * as React from 'react';
import { AlertTriangle, ShieldAlert, X, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertRingConfig } from '@/lib/ai/inference-types';
import { generateAlertRingCSS, generateTailwindClasses } from '@/lib/ai/risk-parser';

interface RiskAlertRingProps {
  config: AlertRingConfig;
  className?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  showDetails?: boolean;
  onToggleDetails?: () => void;
}

export function RiskAlertRing({
  config,
  className,
  showCloseButton = false,
  onClose,
  showDetails = false,
  onToggleDetails
}: RiskAlertRingProps) {
  const {
    color,
    intensity,
    animation,
    message,
    priority
  } = config;

  // 生成CSS动画
  const cssAnimation = generateAlertRingCSS(config);
  const tailwindClasses = generateTailwindClasses(config);

  // 根据优先级选择图标
  const getIcon = () => {
    switch (priority) {
      case 'critical':
        return <ShieldAlert className="h-5 w-5" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5" />;
      case 'medium':
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  // 根据优先级选择背景色
  const getBackgroundColor = () => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10';
      case 'high':
        return 'bg-orange-500/10';
      case 'medium':
        return 'bg-yellow-500/10';
      default:
        return 'bg-green-500/10';
    }
  };

  // 根据优先级选择文本色
  const getTextColor = () => {
    switch (priority) {
      case 'critical':
        return 'text-red-700';
      case 'high':
        return 'text-orange-700';
      case 'medium':
        return 'text-yellow-700';
      default:
        return 'text-green-700';
    }
  };

  // 根据优先级选择边框色
  const getBorderColor = () => {
    switch (priority) {
      case 'critical':
        return 'border-red-500/30';
      case 'high':
        return 'border-orange-500/30';
      case 'medium':
        return 'border-yellow-500/30';
      default:
        return 'border-green-500/30';
    }
  };

  // 根据强度计算阴影大小
  const getShadowSize = () => {
    return `${intensity * 2}px`;
  };

  return (
    <>
      {/* 注入CSS动画 */}
      <style jsx global>{`
        ${cssAnimation}

        .alert-ring-container {
          position: relative;
          transition: all 0.3s ease;
        }

        .alert-ring-pulse {
          animation: pulse-alert 2s infinite;
        }

        .alert-ring-flash {
          animation: flash-alert 1s infinite;
        }

        .alert-ring-glow {
          animation: glow-alert 3s infinite;
        }
      `}</style>

      <div
        className={cn(
          'alert-ring-container',
          'rounded-lg p-4',
          getBackgroundColor(),
          getBorderColor(),
          'border',
          tailwindClasses,
          className
        )}
        style={{
          boxShadow: animation === 'none'
            ? `0 0 ${getShadowSize()} ${color}40`
            : undefined
        }}
      >
        {/* 警报环装饰 */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            boxShadow: `inset 0 0 0 1px ${color}30`,
          }}
        />

        {/* 内容区域 */}
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {/* 图标 */}
              <div
                className={cn(
                  'p-2 rounded-full flex-shrink-0',
                  priority === 'critical' && 'bg-red-500 text-white',
                  priority === 'high' && 'bg-orange-500 text-white',
                  priority === 'medium' && 'bg-yellow-500 text-white',
                  priority === 'low' && 'bg-green-500 text-white'
                )}
              >
                {getIcon()}
              </div>

              {/* 消息 */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('font-semibold', getTextColor())}>
                    {message}
                  </span>
                  {priority === 'critical' && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                      紧急
                    </span>
                  )}
                </div>

                {/* 强度指示器 */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="text-xs text-muted-foreground">警报强度:</div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-300',
                          i < intensity
                            ? (priority === 'critical' ? 'bg-red-500' :
                               priority === 'high' ? 'bg-orange-500' :
                               priority === 'medium' ? 'bg-yellow-500' :
                               priority === 'low' ? 'bg-green-500' : 'bg-gray-300')
                            : 'bg-gray-300'
                        )}
                        style={{
                          width: i < intensity ? '12px' : '6px',
                          opacity: i < intensity ? 1 : 0.3,
                          backgroundColor: i < intensity ? color : undefined
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-xs font-medium" style={{ color }}>
                    {intensity}/10
                  </div>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {showDetails && onToggleDetails && (
                <button
                  onClick={onToggleDetails}
                  className={cn(
                    'p-1.5 rounded-md text-xs font-medium transition-colors',
                    priority === 'critical' && 'bg-red-100 text-red-700 hover:bg-red-200',
                    priority === 'high' && 'bg-orange-100 text-orange-700 hover:bg-orange-200',
                    priority === 'medium' && 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
                    priority === 'low' && 'bg-green-100 text-green-700 hover:bg-green-200'
                  )}
                >
                  {showDetails ? '隐藏详情' : '查看详情'}
                </button>
              )}

              {showCloseButton && onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="关闭警报"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* 动画指示器 */}
          <div className="mt-3 flex items-center gap-2">
            <div className="text-xs text-muted-foreground">动画效果:</div>
            <div className="flex items-center gap-2">
              <div className="text-xs font-medium capitalize" style={{ color }}>
                {animation}
              </div>
              {animation !== 'none' && (
                <div className="flex items-center gap-1">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: color,
                      animation: animation === 'pulse' ? 'pulse-alert 2s infinite' :
                                animation === 'flash' ? 'flash-alert 1s infinite' :
                                animation === 'glow' ? 'glow-alert 3s infinite' : 'none'
                    }}
                  />
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: color,
                      animation: animation === 'pulse' ? 'pulse-alert 2s infinite 0.3s' :
                                animation === 'flash' ? 'flash-alert 1s infinite 0.2s' :
                                animation === 'glow' ? 'glow-alert 3s infinite 0.5s' : 'none'
                    }}
                  />
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: color,
                      animation: animation === 'pulse' ? 'pulse-alert 2s infinite 0.6s' :
                                animation === 'flash' ? 'flash-alert 1s infinite 0.4s' :
                                animation === 'glow' ? 'glow-alert 3s infinite 1s' : 'none'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// 简化版本：仅显示警报环
interface SimpleAlertRingProps {
  config: AlertRingConfig;
  className?: string;
}

export function SimpleAlertRing({ config, className }: SimpleAlertRingProps) {
  const { color, message, priority } = config;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
        priority === 'critical' && 'bg-red-100 text-red-800 border border-red-300',
        priority === 'high' && 'bg-orange-100 text-orange-800 border border-orange-300',
        priority === 'medium' && 'bg-yellow-100 text-yellow-800 border border-yellow-300',
        priority === 'low' && 'bg-green-100 text-green-800 border border-green-300',
        className
      )}
      style={{
        boxShadow: `0 0 0 2px ${color}20`,
        animation: config.animation !== 'none' ? `${config.animation}-alert 2s infinite` : 'none'
      }}
    >
      <div
        className="h-2 w-2 rounded-full animate-pulse"
        style={{ backgroundColor: color }}
      />
      <span>{message}</span>
    </div>
  );
}

// 迷你警报环：用于紧凑空间
interface MiniAlertRingProps {
  config: AlertRingConfig;
  className?: string;
}

export function MiniAlertRing({ config, className }: MiniAlertRingProps) {
  const { color, priority } = config;

  return (
    <div
      className={cn(
        'relative inline-block',
        className
      )}
      title={config.message}
    >
      {/* 外环 */}
      <div
        className="absolute inset-0 rounded-full animate-ping"
        style={{
          backgroundColor: color,
          opacity: 0.3,
          animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
        }}
      />

      {/* 内环 */}
      <div
        className={cn(
          'relative h-3 w-3 rounded-full',
          priority === 'critical' && 'bg-red-500',
          priority === 'high' && 'bg-orange-500',
          priority === 'medium' && 'bg-yellow-500',
          priority === 'low' && 'bg-green-500'
        )}
        style={{
          boxShadow: `0 0 0 2px ${color}40`
        }}
      />

      {/* 中心点 */}
      <div
        className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-white"
      />
    </div>
  );
}