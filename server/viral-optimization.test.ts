import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from './db';

describe('爆文優化系統', () => {
  describe('關鍵字 Benchmark 查詢', () => {
    it('應該能根據關鍵字查詢 Benchmark 數據', async () => {
      const benchmark = await db.getKeywordBenchmark('星座');
      // 如果有數據，應該包含必要欄位
      if (benchmark) {
        expect(benchmark).toHaveProperty('keyword');
        expect(benchmark).toHaveProperty('avgLikes');
        expect(benchmark).toHaveProperty('viralRate');
      }
    });

    it('應該能取得所有關鍵字 Benchmark 列表', async () => {
      const benchmarks = await db.getAllKeywordBenchmarks();
      expect(Array.isArray(benchmarks)).toBe(true);
      // 應該有匯入的數據
      expect(benchmarks.length).toBeGreaterThan(0);
    });

    it('應該能從內容中識別匹配的關鍵字', async () => {
      const content = '今天來聊聊星座運勢，你是什麼星座呢？';
      const matches = await db.findMatchingKeywords(content);
      expect(Array.isArray(matches)).toBe(true);
      // 應該能匹配到「星座」相關關鍵字
      if (matches.length > 0) {
        expect(matches[0]).toHaveProperty('keyword');
      }
    });
  });

  describe('開頭鉤子庫', () => {
    it('應該能取得開頭鉤子列表', async () => {
      const hooks = await db.getContentHooks({ limit: 10 });
      expect(Array.isArray(hooks)).toBe(true);
      // 應該有匯入的數據
      expect(hooks.length).toBeGreaterThan(0);
    });

    it('應該能根據內容類型取得推薦鉤子', async () => {
      const hooks = await db.getRecommendedHooks('story', 5);
      expect(Array.isArray(hooks)).toBe(true);
    });
  });

  describe('爆文因子 Prompt 建構', () => {
    it('應該能建構爆文因子提示', () => {
      const mockBenchmarks = [{
        id: 1,
        keyword: '星座',
        category: '命理',
        avgLikes: 4614,
        viralRate: 0.682,
        optimalLengthMin: 100,
        optimalLengthMax: 150,
        bestContentType: 'knowledge',
        totalPosts: 200,
        viralPosts: 136,
        avgComments: 100,
        avgSaves: 50,
        topHooks: null,
        viralFactors: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }];
      
      const prompt = db.buildViralFactorsPrompt(mockBenchmarks);
      expect(prompt).toContain('星座');
      expect(prompt).toContain('4614');
      expect(prompt).toContain('爆文因子建議');
    });

    it('空 Benchmark 應該返回空字串', () => {
      const prompt = db.buildViralFactorsPrompt([]);
      expect(prompt).toBe('');
    });
  });

  describe('開頭鉤子 Prompt 建構', () => {
    it('應該能建構鉤子提示', () => {
      const mockHooks = [{
        id: 1,
        hookType: 'story',
        hookPattern: '我曾經...',
        hookTemplate: null,
        description: '故事型開頭',
        applicableKeywords: null,
        applicableContentTypes: null,
        avgLikes: 5000,
        viralRate: 30,
        sampleCount: 100,
        examples: null,
        isActive: true,
        source: 'extracted',
        createdAt: new Date(),
        updatedAt: new Date(),
      }];
      
      const prompt = db.buildHooksPrompt(mockHooks);
      expect(prompt).toContain('我曾經');
      expect(prompt).toContain('開頭參考模式');
    });

    it('空鉤子應該返回空字串', () => {
      const prompt = db.buildHooksPrompt([]);
      expect(prompt).toBe('');
    });
  });

  describe('爆文學習記錄', () => {
    it('應該能取得未整合的爆文學習記錄', async () => {
      const learnings = await db.getUnintegratedViralLearnings(10);
      expect(Array.isArray(learnings)).toBe(true);
    });
  });
});
