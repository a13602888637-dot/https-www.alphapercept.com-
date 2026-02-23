# Alpha-Quant-Copilot 前端UI组件系统

基于Next.js 15构建的AI量化交易分析系统前端界面，包含完整的暗色主题、实时数据展示和交互式AI助手功能。

## 功能特性

### 🎨 主题系统
- 使用`next-themes`实现的暗色/浅色主题切换
- 响应式设计，支持移动端和桌面端
- 自定义shadcn/ui主题配置

### 📊 实时市场组件
- **LiveStockCard**: 实时股票卡片，显示价格、涨跌幅和警报类型
- **AlertFeed**: 实时市场警报流，支持暂停/继续和自动滚动
- **MA60Warning**: MA60破位警告组件，红色高亮显示和脉冲动画
- **MA60WarningPanel**: MA60破位监控面板，支持过滤和确认

### 🤖 AI策略组件
- **StrategyRecommendationCard**: AI策略推荐卡片，显示投资风格、风险等级和预期收益
- **StrategyRecommendationPanel**: 策略推荐面板，支持搜索、过滤和排序
- **QAChat**: 交互式AI助手聊天界面，支持Markdown渲染和消息反馈

### 🏗️ 布局组件
- **Sidebar**: 响应式侧边栏导航
- **Header**: 顶部导航栏，包含搜索和用户操作
- **ThemeToggle**: 主题切换按钮

## 技术栈

- **框架**: Next.js 15 (App Router)
- **样式**: Tailwind CSS v4
- **组件库**: shadcn/ui
- **主题**: next-themes
- **图标**: lucide-react
- **图表**: recharts (预留)
- **Markdown**: react-markdown + remark-gfm
- **工具**: date-fns, class-variance-authority, clsx, tailwind-merge

## 项目结构

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 根布局，包含主题提供者
│   ├── page.tsx          # 主页面，展示所有组件
│   └── globals.css       # 全局样式和主题变量
├── components/
│   ├── ui/               # shadcn/ui基础组件
│   ├── layout/           # 布局组件
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── theme-toggle.tsx
│   ├── live-feed/        # 实时市场组件
│   │   ├── live-stock-card.tsx
│   │   ├── alert-feed.tsx
│   │   ├── ma60-warning.tsx
│   │   └── ma60-warning-panel.tsx
│   ├── strategy-chat/    # AI策略组件
│   │   ├── strategy-recommendation.tsx
│   │   ├── strategy-recommendation-panel.tsx
│   │   └── qa-chat.tsx
│   └── providers/        # 上下文提供者
│       └── theme-provider.tsx
├── lib/
│   └── utils.ts          # 工具函数
└── public/               # 静态资源
```

## 快速开始

### 安装依赖
```bash
cd frontend
npm install
```

### 开发模式
```bash
npm run dev
```
访问 http://localhost:3000

### 构建生产版本
```bash
npm run build
npm start
```

## 组件使用示例

### 实时警报流
```tsx
import { AlertFeed } from "@/components/live-feed/alert-feed"

function Dashboard() {
  return <AlertFeed autoScroll={true} scrollSpeed={3000} />
}
```

### AI策略推荐
```tsx
import { StrategyRecommendationPanel } from "@/components/strategy-chat/strategy-recommendation-panel"

function StrategyPage() {
  return <StrategyRecommendationPanel />
}
```

### AI聊天助手
```tsx
import { QAChat } from "@/components/strategy-chat/qa-chat"

function ChatPage() {
  return <QAChat />
}
```

## 设计原则

### 1. 暗色主题优先
- 默认使用暗色主题，减少视觉疲劳
- 支持系统主题跟随
- 精心设计的颜色对比度

### 2. 实时数据展示
- 模拟实时数据流
- 支持暂停/继续控制
- 重要警报高亮显示

### 3. AI驱动交互
- 基于五大投资流派的策略推荐
- 自然语言问答界面
- Markdown格式响应

### 4. 响应式设计
- 移动端优先的响应式布局
- 自适应屏幕尺寸
- 触摸友好的交互元素

## 数据模拟

所有组件都包含模拟数据生成函数，便于开发和测试：

- `generateMockAlerts()`: 生成实时市场警报
- `generateMockWarnings()`: 生成MA60破位警告
- `generateMockStrategies()`: 生成AI策略推荐
- `generateAIResponse()`: 生成AI聊天响应

## 后续开发计划

1. **后端集成**: 连接真实市场数据API
2. **实时图表**: 集成recharts实现数据可视化
3. **用户认证**: 添加登录和用户管理
4. **数据持久化**: 保存用户偏好和聊天历史
5. **移动应用**: 使用React Native开发移动端

## 许可证

MIT License
