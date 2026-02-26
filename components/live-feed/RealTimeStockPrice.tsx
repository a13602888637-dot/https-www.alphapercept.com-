'use client';

import React, { useState, useEffect } from 'react';
import { useRealTimeStockPrice, StockPrice } from '../../hooks/useRealTimeStockPrices';
import { cn } from '../../lib/utils';

export interface RealTimeStockPriceProps {
  symbol: string;
  showName?: boolean;
  showChange?: boolean;
  showChangePercent?: boolean;
  showVolume?: boolean;
  showLastUpdate?: boolean;
  showConnectionStatus?: boolean;
  animateChanges?: boolean;
  className?: string;
  priceClassName?: string;
  changeClassName?: string;
  onPriceUpdate?: (price: StockPrice | null) => void;
  fallbackPrice?: number;
  fallbackChange?: number;
}

export function RealTimeStockPrice({
  symbol,
  showName = true,
  showChange = true,
  showChangePercent = true,
  showVolume = false,
  showLastUpdate = false,
  showConnectionStatus = true,
  animateChanges = true,
  className,
  priceClassName,
  changeClassName,
  onPriceUpdate,
  fallbackPrice,
  fallbackChange
}: RealTimeStockPriceProps) {
  const [priceChangeAnimation, setPriceChangeAnimation] = useState<'up' | 'down' | null>(null);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);

  const {
    price,
    connected,
    loading,
    error,
    lastUpdate,
    isConnected,
    hasError
  } = useRealTimeStockPrice(symbol, {
    autoConnect: true,
    updateInterval: 3000,
    onPriceUpdate: (update) => {
      if (update.prices[symbol] && onPriceUpdate) {
        onPriceUpdate(update.prices[symbol]);
      }
    }
  });

  // Handle price change animation
  useEffect(() => {
    if (!price || !animateChanges) return;

    const currentPrice = price.price;

    if (previousPrice !== null && previousPrice !== currentPrice) {
      const changeDirection = currentPrice > previousPrice ? 'up' : 'down';
      setPriceChangeAnimation(changeDirection);

      // Clear animation after 1 second
      const timer = setTimeout(() => {
        setPriceChangeAnimation(null);
      }, 1000);

      return () => clearTimeout(timer);
    }

    setPreviousPrice(currentPrice);
  }, [price?.price, previousPrice, animateChanges]);

  // Format price with 2 decimal places
  const formatPrice = (value: number) => {
    return value.toFixed(2);
  };

  // Format change with sign
  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  };

  // Format change percent with sign
  const formatChangePercent = (changePercent: number) => {
    const sign = changePercent >= 0 ? '+' : '';
    return `${sign}${changePercent.toFixed(2)}%`;
  };

  // Format volume
  const formatVolume = (volume: number) => {
    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(2)}B`;
    } else if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toString();
  };

  // Format last update time
  const formatLastUpdate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 60) {
      return `${diffSec}秒前`;
    } else if (diffMin < 60) {
      return `${diffMin}分钟前`;
    } else {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Determine color based on change
  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  // Determine background color for animation
  const getAnimationColor = () => {
    if (priceChangeAnimation === 'up') {
      return 'bg-green-50 dark:bg-green-900/20';
    } else if (priceChangeAnimation === 'down') {
      return 'bg-red-50 dark:bg-red-900/20';
    }
    return '';
  };

  // Render connection status indicator
  const renderConnectionStatus = () => {
    if (!showConnectionStatus) return null;

    let statusColor = 'bg-gray-400';
    let statusText = '离线';

    if (loading) {
      statusColor = 'bg-yellow-400';
      statusText = '连接中...';
    } else if (connected) {
      statusColor = 'bg-green-400';
      statusText = '在线';
    } else if (error) {
      statusColor = 'bg-red-400';
      statusText = '错误';
    }

    return (
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <div className={cn('w-2 h-2 rounded-full', statusColor)} />
        <span>{statusText}</span>
      </div>
    );
  };

  // Use fallback data if no real-time data
  const displayPrice = price?.price ?? fallbackPrice ?? 0;
  const displayChange = price?.change ?? fallbackChange ?? 0;
  const displayChangePercent = price?.changePercent ?? (fallbackChange ? (fallbackChange / (fallbackPrice || 1)) * 100 : 0);
  const displayVolume = price?.volume ?? 0;
  const displayName = price?.name ?? symbol;
  const displayLastUpdate = price?.lastUpdate ?? lastUpdate;

  return (
    <div className={cn(
      'p-4 rounded-lg border transition-all duration-300',
      getAnimationColor(),
      className
    )}>
      <div className="flex flex-col gap-2">
        {/* Header with symbol and connection status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {symbol}
            </span>
            {showName && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {displayName}
              </span>
            )}
          </div>
          {renderConnectionStatus()}
        </div>

        {/* Price and change */}
        <div className="flex items-baseline gap-3">
          <span className={cn(
            'text-2xl font-bold',
            priceChangeAnimation === 'up' ? 'text-green-600 dark:text-green-400' :
            priceChangeAnimation === 'down' ? 'text-red-600 dark:text-red-400' :
            'text-gray-900 dark:text-gray-100',
            priceClassName
          )}>
            {formatPrice(displayPrice)}
          </span>

          {(showChange || showChangePercent) && displayChange !== 0 && (
            <div className={cn('flex items-center gap-2', changeClassName)}>
              {showChange && (
                <span className={cn('text-sm font-medium', getChangeColor(displayChange))}>
                  {formatChange(displayChange)}
                </span>
              )}
              {showChangePercent && (
                <span className={cn('text-sm font-medium', getChangeColor(displayChangePercent))}>
                  {formatChangePercent(displayChangePercent)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Additional info */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
          {showVolume && displayVolume > 0 && (
            <div className="flex items-center gap-1">
              <span>成交量:</span>
              <span className="font-medium">{formatVolume(displayVolume)}</span>
            </div>
          )}

          {showLastUpdate && displayLastUpdate && (
            <div className="flex items-center gap-1">
              <span>更新:</span>
              <span className="font-medium">{formatLastUpdate(displayLastUpdate)}</span>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading indicator */}
        {loading && !price && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
            正在获取实时价格...
          </div>
        )}
      </div>
    </div>
  );
}

// Component for displaying multiple real-time prices
export function RealTimeStockPriceGrid({
  symbols,
  ...props
}: Omit<RealTimeStockPriceProps, 'symbol'> & { symbols: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {symbols.map(symbol => (
        <RealTimeStockPrice
          key={symbol}
          symbol={symbol}
          {...props}
        />
      ))}
    </div>
  );
}