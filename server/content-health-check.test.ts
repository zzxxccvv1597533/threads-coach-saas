import { describe, it, expect } from 'vitest';
import { MAX_SCORES, DIMENSION_NAMES } from './content-health-check';

describe('Content Health Check - Constants', () => {
  describe('MAX_SCORES', () => {
    it('should have correct max scores for each dimension', () => {
      expect(MAX_SCORES.hook).toBe(25);
      expect(MAX_SCORES.translation).toBe(20);
      expect(MAX_SCORES.tone).toBe(15);
      expect(MAX_SCORES.cta).toBe(10);
      expect(MAX_SCORES.fourLens).toBe(30);
    });

    it('should sum to 100', () => {
      const total = Object.values(MAX_SCORES).reduce((sum, score) => sum + score, 0);
      expect(total).toBe(100);
    });
  });

  describe('DIMENSION_NAMES', () => {
    it('should have names for all dimensions', () => {
      expect(DIMENSION_NAMES.hook).toBe('Hook 鉤子強度');
      expect(DIMENSION_NAMES.translation).toBe('Translation 翻譯機');
      expect(DIMENSION_NAMES.tone).toBe('Tone 閱讀體感');
      expect(DIMENSION_NAMES.cta).toBe('CTA 互動召喚');
      expect(DIMENSION_NAMES.fourLens).toBe('四透鏡檢核');
    });

    it('should include openerEffect dimension', () => {
      expect(DIMENSION_NAMES.openerEffect).toBe('開頭效果倍數');
    });
  });
});

describe('Content Health Check - Data Driven Integration', () => {
  it('should import opener rules correctly', async () => {
    const { analyzeOpener, HIGH_EFFECT_OPENER_PATTERNS } = await import('../shared/opener-rules');
    expect(typeof analyzeOpener).toBe('function');
    expect(Array.isArray(HIGH_EFFECT_OPENER_PATTERNS)).toBe(true);
  });

  it('should analyze opener with colon assertion pattern', async () => {
    const { analyzeOpener } = await import('../shared/opener-rules');
    const result = analyzeOpener('學習的真相：不是你不夠努力');
    expect(result.matchedHighEffect.length).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(1);
  });

  it('should detect low effect opener patterns', async () => {
    const { analyzeOpener } = await import('../shared/opener-rules');
    const result = analyzeOpener('你有沒有想過？');
    // 問句開頭是低效模式，新版本評分邏輯基礎分 50，扣分後仍可能 > 1
    expect(result.matchedLowEffect.length).toBeGreaterThan(0);
  });

  it('should detect number in opener', async () => {
    const { analyzeOpener } = await import('../shared/opener-rules');
    const result = analyzeOpener('90% 的人都搞錯了這件事');
    // 數字開頭會匹配到「禁忌/警告詞」或「數字開頭」模式
    expect(result.matchedHighEffect.length).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(1);
  });
});
