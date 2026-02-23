/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 配置WebSocket支持
  webpack: (config, { isServer }) => {
    // 如果是服务器端，配置WebSocket支持
    if (isServer) {
      config.externals.push({
        'ws': 'commonjs ws',
      });
    }

    return config;
  },

  // 配置API路由
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },

  // 配置环境变量
  env: {
    APP_NAME: 'Alpha-Quant-Copilot',
    APP_VERSION: '1.0.0',
    DEFAULT_SYMBOLS: '000001,600000,000002,600036',
    UPDATE_INTERVAL: '5000', // 5秒
  },

  // 配置图片域名
  images: {
    domains: ['localhost'],
  },

  // 配置TypeScript
  typescript: {
    ignoreBuildErrors: true,
  },

  // 配置ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;