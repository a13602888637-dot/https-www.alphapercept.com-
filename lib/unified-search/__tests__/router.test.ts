import { SearchRouter } from '../router';

describe('SearchRouter', () => {
  const router = new SearchRouter();

  describe('isCNStock', () => {
    it('should recognize 6-digit codes as CN stocks', () => {
      const sources = router.route('600519');
      expect(sources[0].name).toBe('python-fastapi');
    });

    it('should recognize Chinese characters as CN stocks', () => {
      const sources = router.route('贵州茅台');
      expect(sources[0].name).toBe('python-fastapi');
    });

    it('should recognize .SH/.SZ suffix', () => {
      const sources = router.route('600519.SH');
      expect(sources[0].name).toBe('python-fastapi');
    });
  });

  describe('isUSStock', () => {
    it('should recognize 1-5 letter tickers', () => {
      const sources = router.route('AAPL');
      expect(sources[0].name).toBe('finnhub');
    });

    it('should recognize exchange prefixes', () => {
      const sources = router.route('NASDAQ:TSLA');
      expect(sources[0].name).toBe('finnhub');
    });
  });

  describe('isCommodity', () => {
    it('should recognize commodity keywords', () => {
      const sources = router.route('黄金');
      expect(sources[0].name).toBe('commodity-crawler');
    });

    it('should recognize English commodity names', () => {
      const sources = router.route('gold');
      expect(sources[0].name).toBe('commodity-crawler');
    });
  });

  describe('mixed queries', () => {
    it('should return multiple sources for ambiguous queries', () => {
      const sources = router.route('test');
      expect(sources.length).toBeGreaterThan(1);
      expect(sources.some(s => s.name === 'python-fastapi')).toBe(true);
      expect(sources.some(s => s.name === 'finnhub')).toBe(true);
    });
  });
});
