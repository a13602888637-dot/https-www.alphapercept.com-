/**
 * Test script for real-time stock prices SSE endpoint
 * Run with: node test-realtime-prices.js
 */

const http = require('http');
const https = require('https');

const symbols = ['000001', '600000'];
const url = `http://localhost:3000/api/stock-prices/realtime?symbols=${symbols.join(',')}&interval=3000`;

console.log('Testing real-time stock prices SSE endpoint...');
console.log(`URL: ${url}`);
console.log(`Symbols: ${symbols.join(', ')}`);
console.log('---');

// Create HTTP request
const req = http.request(url, {
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
});

req.on('response', (res) => {
  console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);

  if (res.statusCode !== 200) {
    console.error('Failed to connect to SSE endpoint');
    process.exit(1);
  }

  let buffer = '';

  res.on('data', (chunk) => {
    buffer += chunk.toString();

    // Process complete SSE messages
    const messages = buffer.split('\n\n');
    buffer = messages.pop() || ''; // Keep incomplete message in buffer

    for (const message of messages) {
      if (message.trim()) {
        processSSEMessage(message);
      }
    }
  });

  res.on('end', () => {
    console.log('SSE connection closed by server');
    process.exit(0);
  });

  res.on('error', (err) => {
    console.error('Response error:', err);
    process.exit(1);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
  process.exit(1);
});

// Set timeout to stop after 10 seconds
setTimeout(() => {
  console.log('\nTest completed after 10 seconds');
  req.destroy();
  process.exit(0);
}, 10000);

req.end();

function processSSEMessage(message) {
  const lines = message.split('\n');
  let eventType = 'message';
  let data = null;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      try {
        data = JSON.parse(line.substring(5).trim());
      } catch (err) {
        console.error('Failed to parse JSON data:', err.message);
        data = line.substring(5).trim();
      }
    }
  }

  console.log(`\n[${new Date().toISOString()}] Event: ${eventType}`);

  if (data) {
    switch (eventType) {
      case 'connected':
        console.log('Connected to SSE stream');
        console.log(`Client ID: ${data.clientId}`);
        console.log(`Symbols: ${data.symbols.join(', ')}`);
        console.log(`Update interval: ${data.updateInterval}ms`);
        break;

      case 'initial-prices':
      case 'price-update':
        console.log(`Timestamp: ${data.timestamp}`);
        console.log(`Price count: ${Object.keys(data.prices).length}`);

        // Show first few prices
        const symbolKeys = Object.keys(data.prices);
        for (let i = 0; i < Math.min(2, symbolKeys.length); i++) {
          const symbol = symbolKeys[i];
          const price = data.prices[symbol];
          console.log(`  ${symbol}: ¥${price.price.toFixed(2)} (${price.change >= 0 ? '+' : ''}${price.change.toFixed(2)}, ${price.changePercent >= 0 ? '+' : ''}${price.changePercent.toFixed(2)}%)`);
        }

        if (data.priceChanges && data.priceChanges.length > 0) {
          console.log(`Price changes: ${data.priceChanges.length}`);
          for (const change of data.priceChanges.slice(0, 2)) {
            console.log(`  ${change.symbol}: ${change.previousPrice.toFixed(2)} → ${change.currentPrice.toFixed(2)} (${change.change >= 0 ? '+' : ''}${change.change.toFixed(2)})`);
          }
        }
        break;

      case 'heartbeat':
        console.log('Heartbeat received');
        break;

      case 'error':
        console.error('Error:', data.message);
        if (data.error) {
          console.error('Details:', data.error);
        }
        break;

      default:
        console.log('Data:', JSON.stringify(data, null, 2));
    }
  }
}

console.log('Starting test... Press Ctrl+C to stop early.');