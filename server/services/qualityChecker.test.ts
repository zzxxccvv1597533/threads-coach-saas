/**
 * 品質檢查服務測試
 */

import { describe, it, expect, vi } from 'vitest';
import {
  checkLayer1,
  checkLayer2,
  checkLayer3,
  performQualityCheck,
  autoFixContent,
} from './qualityChecker';

// Mock feature flags
vi.mock('../infrastructure/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

// Mock metrics collector
vi.mock('../infrastructure/metrics-collector', () => ({
  recordQualityCheck: vi.fn(),
}));

describe('qualityChecker', () => {
  describe('checkLayer1 - Prompt 注入禁止句式檢查', () => {
    it('should pass for content without blocked patterns', () => {
      const content = '今天想分享一個小故事，關於我如何開始創業的旅程。';
      const result = checkLayer1(content);
      expect(result.passed).toBe(true);
      expect(result.blockedPatterns).toHaveLength(0);
    });

    it('should fail for content with blocked patterns', () => {
      const content = '讓我們一起來看看今天的分享吧！';
      const result = checkLayer1(content);
      expect(result.passed).toBe(false);
      expect(result.blockedPatterns.length).toBeGreaterThan(0);
    });

    it('should detect warning patterns or blocked patterns for structure words', () => {
      const content = '首先，我想說的是這個很重要。其次，你需要注意這點。';
      const result = checkLayer1(content);
      // 結構詞可能被歸類為 blocked 或 warning，只要有任一個即可
      const hasIssues = result.warningPatterns.length > 0 || result.blockedPatterns.length > 0;
      expect(hasIssues).toBe(true);
    });
  });

  describe('checkLayer2 - AI Detector + Content Filter', () => {
    it('should pass for natural content', () => {
      const content = '昨天去咖啡廳，遇到一個超有趣的人。我們聊了很久，發現原來我們有很多共同點。';
      const result = checkLayer2(content);
      expect(result.passed).toBe(true);
      expect(result.aiScore).toBeGreaterThanOrEqual(60);
    });

    it('should detect AI phrases', () => {
      const content = '不得不說，這真的值得一提。毋庸置疑，這是一個很好的選擇。';
      const result = checkLayer2(content);
      expect(result.aiFlags.length).toBeGreaterThan(0);
      expect(result.aiScore).toBeLessThan(100);
    });

    it('should detect excessive structure words', () => {
      const content = '首先，我們要了解這個概念。其次，我們需要實踐。再者，我們要反思。最後，我們要總結。';
      const result = checkLayer2(content);
      expect(result.aiFlags.some(f => f.includes('結構詞'))).toBe(true);
    });

    it('should fail for prohibited content', () => {
      const content = '加我微信領取免費資料！';
      const result = checkLayer2(content);
      expect(result.contentFilterPassed).toBe(false);
    });
  });

  describe('checkLayer3 - 品質分數計算', () => {
    it('should calculate quality score for short content', () => {
      const content = '今天想分享一個小故事。';
      const result = checkLayer3(content, 'short');
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should calculate quality score for medium content', () => {
      const content = `今天想分享一個小故事。

昨天去咖啡廳，遇到一個超有趣的人。

我們聊了很久，發現原來我們有很多共同點。

這讓我想到，人與人之間的連結真的很奇妙。

你有沒有過這樣的經驗呢？`;
      const result = checkLayer3(content, 'medium');
      expect(result.qualityScore).toBeGreaterThan(0);
    });
  });

  describe('performQualityCheck - 完整品質檢查', () => {
    it('should return complete result', () => {
      const content = '今天想分享一個小故事，關於我如何開始創業的旅程。這是一段很特別的經歷。';
      const result = performQualityCheck(content, 'medium');
      
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('layer1');
      expect(result).toHaveProperty('layer2');
      expect(result).toHaveProperty('layer3');
      expect(result).toHaveProperty('suggestions');
    });

    it('should assign correct grade based on score', () => {
      const goodContent = '昨天去咖啡廳，遇到一個超有趣的人。我們聊了很久，發現原來我們有很多共同點。這讓我想到，人與人之間的連結真的很奇妙。';
      const result = performQualityCheck(goodContent, 'medium');
      
      expect(['excellent', 'good', 'acceptable', 'poor']).toContain(result.grade);
    });
  });

  describe('autoFixContent - 自動修復', () => {
    it('should fix blocked patterns', () => {
      const content = '讓我們一起來看看今天的分享吧！';
      const result = autoFixContent(content);
      
      expect(result.fixed).not.toContain('讓我們');
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('should remove extra spaces', () => {
      const content = '今天   想分享   一個故事。';
      const result = autoFixContent(content);
      
      expect(result.fixed).not.toContain('   ');
    });

    it('should not modify clean content', () => {
      const content = '今天想分享一個小故事。';
      const result = autoFixContent(content);
      
      expect(result.fixed).toBe(content);
      expect(result.changes).toHaveLength(0);
    });
  });
});
