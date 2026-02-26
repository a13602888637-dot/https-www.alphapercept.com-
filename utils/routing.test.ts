// utils/routing.test.ts
import { isSecondaryPage, getBackDestination } from './routing';

describe('routing utilities', () => {
  describe('isSecondaryPage', () => {
    it('应该将dashboard识别为一级页面', () => {
      expect(isSecondaryPage('/dashboard')).toBe(false);
    });

    it('应该将根路径识别为一级页面', () => {
      expect(isSecondaryPage('/')).toBe(false);
    });

    it('应该将live-feed识别为二级页面', () => {
      expect(isSecondaryPage('/live-feed')).toBe(true);
    });

    it('应该将strategy-recommendation识别为二级页面', () => {
      expect(isSecondaryPage('/strategy-recommendation')).toBe(true);
    });

    it('应该将API路由排除', () => {
      expect(isSecondaryPage('/api/sse')).toBe(false);
    });
  });
});