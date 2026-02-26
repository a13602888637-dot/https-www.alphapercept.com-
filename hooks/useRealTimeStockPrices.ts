/**
 * useRealTimeStockPrices Hook
 * Subscribe to real-time stock price updates via SSE
 * Manages connection, reconnection, and state updates
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface StockPrice {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  lastUpdate: string;
  name: string;
  hasPriceChange: boolean;
}

export interface PriceUpdate {
  timestamp: string;
  prices: Record<string, StockPrice>;
  priceChanges: Array<{
    symbol: string;
    previousPrice: number;
    currentPrice: number;
    change: number;
    changePercent: number;
    timestamp: string;
  }>;
}

export interface RealTimePriceOptions {
  symbols: string[];
  updateInterval?: number; // milliseconds
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  onPriceUpdate?: (update: PriceUpdate) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

export interface RealTimePriceState {
  prices: Record<string, StockPrice>;
  connected: boolean;
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
  connectionId: string | null;
}

export function useRealTimeStockPrices(options: RealTimePriceOptions) {
  const {
    symbols,
    updateInterval = 3000,
    autoConnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 3000,
    onPriceUpdate,
    onConnectionChange,
    onError
  } = options;

  const [state, setState] = useState<RealTimePriceState>({
    prices: {},
    connected: false,
    loading: false,
    error: null,
    lastUpdate: null,
    connectionId: null
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Build SSE URL
  const buildSSEUrl = useCallback(() => {
    const baseUrl = '/api/stock-prices/realtime';
    const params = new URLSearchParams({
      symbols: symbols.join(','),
      interval: updateInterval.toString()
    });
    return `${baseUrl}?${params.toString()}`;
  }, [symbols, updateInterval]);

  // Handle SSE messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (event.type) {
        case 'connected':
          setState(prev => ({
            ...prev,
            connected: true,
            loading: false,
            error: null,
            connectionId: data.clientId
          }));
          onConnectionChange?.(true);
          reconnectAttemptsRef.current = 0;
          break;

        case 'initial-prices':
        case 'price-update':
          const priceUpdate: PriceUpdate = {
            timestamp: data.timestamp,
            prices: data.prices,
            priceChanges: data.priceChanges || []
          };

          setState(prev => ({
            ...prev,
            prices: data.prices,
            lastUpdate: data.timestamp,
            error: null
          }));

          onPriceUpdate?.(priceUpdate);
          break;

        case 'symbols-updated':
          console.log('Symbols updated:', data.symbols);
          break;

        case 'heartbeat':
          // Keep connection alive
          break;

        case 'error':
          setState(prev => ({
            ...prev,
            error: data.message || 'Unknown error'
          }));
          onError?.(new Error(data.message || 'SSE error'));
          break;
      }
    } catch (error) {
      console.error('Error parsing SSE message:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to parse SSE message'));
    }
  }, [onPriceUpdate, onConnectionChange, onError]);

  // Handle SSE errors
  const handleError = useCallback((error: Event) => {
    console.error('SSE connection error:', error);

    if (!isMountedRef.current) return;

    setState(prev => ({
      ...prev,
      connected: false,
      loading: false,
      error: 'Connection error'
    }));

    onConnectionChange?.(false);
    onError?.(new Error('SSE connection error'));

    // Attempt reconnection
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      reconnectAttemptsRef.current++;
      console.log(`Reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
      setState(prev => ({
        ...prev,
        error: 'Max reconnection attempts reached'
      }));
    }
  }, [maxReconnectAttempts, reconnectDelay, onConnectionChange, onError]);

  // Connect to SSE
  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    // Clean up existing connection
    disconnect();

    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));

    try {
      const url = buildSSEUrl();
      const eventSource = new EventSource(url);

      // Set up event listeners
      eventSource.addEventListener('connected', handleMessage);
      eventSource.addEventListener('initial-prices', handleMessage);
      eventSource.addEventListener('price-update', handleMessage);
      eventSource.addEventListener('symbols-updated', handleMessage);
      eventSource.addEventListener('heartbeat', handleMessage);
      eventSource.addEventListener('error', handleMessage);
      eventSource.onerror = handleError;

      eventSourceRef.current = eventSource;

      console.log('Connecting to real-time price stream:', url);

    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to connect'
      }));
      onError?.(error instanceof Error ? error : new Error('Failed to create EventSource'));
    }
  }, [buildSSEUrl, handleMessage, handleError, onError]);

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      connected: false,
      loading: false,
      connectionId: null
    }));

    onConnectionChange?.(false);
    reconnectAttemptsRef.current = 0;

    console.log('Disconnected from real-time price stream');
  }, [onConnectionChange]);

  // Update symbols
  const updateSymbols = useCallback(async (newSymbols: string[]) => {
    if (!state.connectionId) {
      console.warn('Cannot update symbols: no active connection');
      return false;
    }

    try {
      const response = await fetch('/api/stock-prices/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: state.connectionId,
          symbols: newSymbols
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update symbols: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Error updating symbols:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to update symbols'));
      return false;
    }
  }, [state.connectionId, onError]);

  // Get price for a specific symbol
  const getPrice = useCallback((symbol: string): StockPrice | null => {
    return state.prices[symbol] || null;
  }, [state.prices]);

  // Get all prices
  const getAllPrices = useCallback((): Record<string, StockPrice> => {
    return state.prices;
  }, [state.prices]);

  // Get symbols with price changes
  const getChangedSymbols = useCallback((): string[] => {
    return Object.entries(state.prices)
      .filter(([_, price]) => price.hasPriceChange)
      .map(([symbol]) => symbol);
  }, [state.prices]);

  // Effect for auto-connect
  useEffect(() => {
    isMountedRef.current = true;

    if (autoConnect && symbols.length > 0) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [autoConnect, symbols.length, connect, disconnect]);

  // Effect for symbols change
  useEffect(() => {
    if (state.connected && symbols.length > 0) {
      updateSymbols(symbols);
    }
  }, [symbols, state.connected, updateSymbols]);

  return {
    // State
    ...state,

    // Actions
    connect,
    disconnect,
    updateSymbols,

    // Price utilities
    getPrice,
    getAllPrices,
    getChangedSymbols,

    // Connection info
    isConnected: state.connected,
    isLoading: state.loading,
    hasError: !!state.error
  };
}

// Helper hook for single symbol
export function useRealTimeStockPrice(symbol: string, options?: Omit<RealTimePriceOptions, 'symbols'>) {
  const realTimePrices = useRealTimeStockPrices({
    symbols: [symbol],
    ...options
  });

  const price = realTimePrices.getPrice(symbol);

  return {
    ...realTimePrices,
    price,
    symbol
  };
}