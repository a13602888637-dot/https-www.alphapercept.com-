/**
 * 物理动画工具函数
 * 提供阻尼、弹性、吸附等物理效果计算
 */

/**
 * 阻尼系数
 */
export const DAMPING_COEFFICIENT = 0.8;

/**
 * 弹性系数
 */
export const SPRING_COEFFICIENT = 0.3;

/**
 * 吸附阈值（像素）
 */
export const SNAP_THRESHOLD = 100;

/**
 * 长按时间阈值（毫秒）
 */
export const LONG_PRESS_DURATION = 500;

/**
 * 计算阻尼效果
 * @param velocity 当前速度
 * @param damping 阻尼系数，默认0.8
 * @returns 阻尼后的速度
 */
export function applyDamping(velocity: number, damping: number = DAMPING_COEFFICIENT): number {
  return velocity * damping;
}

/**
 * 计算弹性效果
 * @param displacement 位移
 * @param stiffness 弹性系数，默认0.3
 * @returns 弹性力
 */
export function applySpring(displacement: number, stiffness: number = SPRING_COEFFICIENT): number {
  return -displacement * stiffness;
}

/**
 * 计算吸附效果
 * @param position 当前位置
 * @param target 目标位置
 * @param threshold 吸附阈值，默认100px
 * @returns 是否应该吸附
 */
export function shouldSnap(position: number, target: number, threshold: number = SNAP_THRESHOLD): boolean {
  return Math.abs(position - target) <= threshold;
}

/**
 * 计算吸附动画的最终位置
 * @param position 当前位置
 * @param target 目标位置
 * @param threshold 吸附阈值
 * @returns 吸附后的位置
 */
export function calculateSnapPosition(position: number, target: number, threshold: number = SNAP_THRESHOLD): number {
  if (shouldSnap(position, target, threshold)) {
    return target;
  }
  return position;
}

/**
 * 计算惯性滚动
 * @param velocity 初始速度
 * @param damping 阻尼系数
 * @param timeStep 时间步长（毫秒）
 * @returns 位移
 */
export function calculateInertia(velocity: number, damping: number = DAMPING_COEFFICIENT, timeStep: number = 16): number {
  let displacement = 0;
  let currentVelocity = velocity;

  while (Math.abs(currentVelocity) > 0.1) {
    displacement += currentVelocity * (timeStep / 1000);
    currentVelocity = applyDamping(currentVelocity, damping);
  }

  return displacement;
}

/**
 * 计算弹簧动画值
 * @param current 当前值
 * @param target 目标值
 * @param velocity 当前速度
 * @param stiffness 弹性系数
 * @param damping 阻尼系数
 * @param timeStep 时间步长
 * @returns [新值, 新速度]
 */
export function calculateSpring(
  current: number,
  target: number,
  velocity: number,
  stiffness: number = SPRING_COEFFICIENT,
  damping: number = DAMPING_COEFFICIENT,
  timeStep: number = 16
): [number, number] {
  const displacement = current - target;
  const springForce = applySpring(displacement, stiffness);

  // 计算加速度
  const acceleration = springForce - velocity * damping;

  // 更新速度
  const newVelocity = velocity + acceleration * (timeStep / 1000);

  // 更新位置
  const newPosition = current + newVelocity * (timeStep / 1000);

  return [newPosition, newVelocity];
}

/**
 * 缓动函数集合
 */
export const easingFunctions = {
  /** 线性 */
  linear: (t: number): number => t,

  /** 缓入（二次） */
  easeInQuad: (t: number): number => t * t,

  /** 缓出（二次） */
  easeOutQuad: (t: number): number => t * (2 - t),

  /** 缓入缓出（二次） */
  easeInOutQuad: (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },

  /** 缓入（三次） */
  easeInCubic: (t: number): number => t * t * t,

  /** 缓出（三次） */
  easeOutCubic: (t: number): number => {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  },

  /** 缓入缓出（三次） */
  easeInOutCubic: (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },

  /** 弹性效果 */
  elastic: (t: number): number => {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },

  /** 反弹效果 */
  bounce: (t: number): number => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      t -= 1.5 / 2.75;
      return 7.5625 * t * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      t -= 2.25 / 2.75;
      return 7.5625 * t * t + 0.9375;
    } else {
      t -= 2.625 / 2.75;
      return 7.5625 * t * t + 0.984375;
    }
  }
};

/**
 * 计算动画值
 * @param start 起始值
 * @param end 结束值
 * @param progress 进度（0-1）
 * @param easing 缓动函数
 * @returns 动画值
 */
export function interpolate(
  start: number,
  end: number,
  progress: number,
  easing: (t: number) => number = easingFunctions.easeOutCubic
): number {
  const easedProgress = easing(progress);
  return start + (end - start) * easedProgress;
}

/**
 * 计算拖拽时的缩放效果
 * @param dragDistance 拖拽距离
 * @param maxScale 最大缩放比例
 * @returns 缩放比例
 */
export function calculateDragScale(dragDistance: number, maxScale: number = 1.05): number {
  const scale = 1 + Math.min(Math.abs(dragDistance) * 0.001, maxScale - 1);
  return scale;
}

/**
 * 计算阴影强度
 * @param dragDistance 拖拽距离
 * @param maxShadow 最大阴影强度
 * @returns 阴影强度
 */
export function calculateShadowIntensity(dragDistance: number, maxShadow: number = 0.3): number {
  const intensity = Math.min(Math.abs(dragDistance) * 0.002, maxShadow);
  return intensity;
}

/**
 * 计算滑动操作的进度
 * @param distance 滑动距离
 * @param threshold 触发阈值
 * @returns 进度（0-1）
 */
export function calculateSwipeProgress(distance: number, threshold: number = 80): number {
  return Math.min(Math.abs(distance) / threshold, 1);
}

/**
 * 计算滑动操作的背景色透明度
 * @param progress 进度（0-1）
 * @returns 透明度（0-1）
 */
export function calculateSwipeOpacity(progress: number): number {
  return Math.min(progress * 1.2, 1);
}