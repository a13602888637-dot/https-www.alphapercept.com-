// components/layout/gesture-detector.client.tsx
"use client";

import dynamic from 'next/dynamic';

// 动态导入手势检测组件，仅在客户端渲染
const GestureDetector = dynamic(
  () => import('./gesture-detector').then((mod) => mod.GestureDetector),
  { ssr: false }
);

export default GestureDetector;