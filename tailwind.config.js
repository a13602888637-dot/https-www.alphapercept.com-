/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // 交易相关颜色
        trade: {
          buy: "#10b981", // 绿色
          sell: "#ef4444", // 红色
          hold: "#f59e0b", // 黄色
        },
        // 警告级别颜色
        warning: {
          critical: "#dc2626",
          high: "#ea580c",
          medium: "#d97706",
          low: "#2563eb",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        // 数据更新闪烁动画
        "highlight": {
          "0%": { backgroundColor: "rgba(59, 130, 246, 0.1)" },
          "100%": { backgroundColor: "transparent" },
        },
        // 连接状态脉冲动画
        "pulse-connection": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
        // 价格变化动画
        "price-up": {
          "0%": { color: "inherit", backgroundColor: "transparent" },
          "50%": { color: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)" },
          "100%": { color: "#10b981", backgroundColor: "transparent" },
        },
        "price-down": {
          "0%": { color: "inherit", backgroundColor: "transparent" },
          "50%": { color: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.1)" },
          "100%": { color: "#ef4444", backgroundColor: "transparent" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "highlight": "highlight 1s ease-out",
        "pulse-connection": "pulse-connection 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "price-up": "price-up 0.5s ease-out",
        "price-down": "price-down 0.5s ease-out",
      },
      // 自定义字体
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      // 自定义阴影
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'warning': '0 0 0 3px rgba(220, 38, 38, 0.1)',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
};