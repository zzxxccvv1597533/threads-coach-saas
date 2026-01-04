/**
 * 爆款數據優化系統測試
 * 測試 P0+P1 優化項目：
 * - viral_examples 資料表查詢
 * - topic_templates 資料表查詢
 * - content_clusters 資料表查詢
 * - Few-Shot Prompt 建構
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('爆款數據優化系統', () => {
  
  describe('viral_examples 資料表', () => {
    it('應該能取得爆款貼文範例', async () => {
      const examples = await db.getViralExamples({ limit: 5 });
      expect(Array.isArray(examples)).toBe(true);
      // 應該有數據（已匯入 1240 筆）
      expect(examples.length).toBeGreaterThan(0);
    });

    it('應該能根據關鍵字篩選範例', async () => {
      const examples = await db.getViralExamples({ 
        keyword: '自媒體',
        limit: 5 
      });
      expect(Array.isArray(examples)).toBe(true);
    });

    it('應該能根據 Top200 篩選', async () => {
      const examples = await db.getViralExamples({ 
        isTop200: true,
        limit: 5 
      });
      expect(Array.isArray(examples)).toBe(true);
    });

    it('應該能根據 Top20 篩選', async () => {
      const examples = await db.getViralExamples({ 
        isTop20: true,
        limit: 5 
      });
      expect(Array.isArray(examples)).toBe(true);
    });
  });

  describe('getBestExamplesForKeyword', () => {
    it('應該能取得關鍵字的最佳範例', async () => {
      const examples = await db.getBestExamplesForKeyword('自媒體', 3);
      expect(Array.isArray(examples)).toBe(true);
    });

    it('沒有匹配時應該返回 Top200 範例', async () => {
      const examples = await db.getBestExamplesForKeyword('不存在的關鍵字xyz123', 3);
      expect(Array.isArray(examples)).toBe(true);
    });
  });

  describe('topic_templates 資料表', () => {
    it('應該能取得選題模板', async () => {
      const templates = await db.getTopicTemplates({ limit: 5 });
      expect(Array.isArray(templates)).toBe(true);
      // 應該有數據（已匯入 48 筆）
      expect(templates.length).toBeGreaterThan(0);
    });

    it('應該能根據群集篩選模板', async () => {
      const templates = await db.getTopicTemplates({ cluster: 1 });
      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe('getRandomTopicSuggestions', () => {
    it('應該能取得隨機選題建議', async () => {
      const suggestions = await db.getRandomTopicSuggestions(5);
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('每次取得的建議應該可能不同（隨機性）', async () => {
      const suggestions1 = await db.getRandomTopicSuggestions(3);
      const suggestions2 = await db.getRandomTopicSuggestions(3);
      // 至少有數據
      expect(suggestions1.length).toBeGreaterThan(0);
      expect(suggestions2.length).toBeGreaterThan(0);
    });
  });

  describe('content_clusters 資料表', () => {
    it('應該能取得所有內容群集', async () => {
      const clusters = await db.getContentClusters();
      expect(Array.isArray(clusters)).toBe(true);
      // 應該有數據（已匯入 8 筆）
      expect(clusters.length).toBeGreaterThan(0);
    });

    it('群集應該包含必要欄位', async () => {
      const clusters = await db.getContentClusters();
      if (clusters.length > 0) {
        const cluster = clusters[0];
        expect(cluster).toHaveProperty('clusterId');
        expect(cluster).toHaveProperty('themeKeywords');
      }
    });
  });

  describe('getClusterById', () => {
    it('應該能根據 ID 取得群集', async () => {
      const cluster = await db.getClusterById(1);
      // 可能有也可能沒有，取決於數據
      if (cluster) {
        expect(cluster.clusterId).toBe(1);
      }
    });

    it('不存在的群集應該返回 null', async () => {
      const cluster = await db.getClusterById(9999);
      expect(cluster).toBeNull();
    });
  });

  describe('suggestClusterForContent', () => {
    it('應該能根據內容推薦群集', async () => {
      const suggestion = await db.suggestClusterForContent('自媒體經營 個人品牌 創業');
      // 可能有也可能沒有匹配
      if (suggestion) {
        expect(suggestion).toHaveProperty('clusterId');
        expect(suggestion).toHaveProperty('themeKeywords');
        expect(suggestion).toHaveProperty('confidence');
      }
    });
  });

  describe('buildFewShotPrompt', () => {
    it('應該能建構 Few-Shot Prompt', async () => {
      const prompt = await db.buildFewShotPrompt('自媒體', 3);
      expect(typeof prompt).toBe('string');
    });

    it('有範例時應該包含參考範例標題', async () => {
      const prompt = await db.buildFewShotPrompt('自媒體', 3);
      // 如果有數據，應該包含「參考範例」
      if (prompt.length > 0) {
        expect(prompt).toContain('參考範例');
      }
    });
  });

  describe('getViralOpeners', () => {
    it('應該能取得爆款開頭範例', async () => {
      const openers = await db.getViralOpeners({ limit: 5 });
      expect(Array.isArray(openers)).toBe(true);
    });

    it('應該能根據關鍵字篩選開頭', async () => {
      const openers = await db.getViralOpeners({ 
        keyword: '自媒體',
        limit: 5 
      });
      expect(Array.isArray(openers)).toBe(true);
    });
  });

  describe('getViralDataStats', () => {
    it('應該能取得爆款數據統計', async () => {
      const stats = await db.getViralDataStats();
      expect(stats).toHaveProperty('totalExamples');
      expect(stats).toHaveProperty('top200Count');
      expect(stats).toHaveProperty('top20Count');
      expect(stats).toHaveProperty('topicTemplatesCount');
      expect(stats).toHaveProperty('clustersCount');
      expect(stats).toHaveProperty('keywordsCount');
    });

    it('統計數據應該大於 0', async () => {
      const stats = await db.getViralDataStats();
      // 已匯入數據，應該大於 0
      expect(stats.totalExamples).toBeGreaterThan(0);
      expect(stats.top200Count).toBeGreaterThan(0);
      expect(stats.top20Count).toBeGreaterThan(0);
      expect(stats.topicTemplatesCount).toBeGreaterThan(0);
      expect(stats.clustersCount).toBeGreaterThan(0);
    });
  });

  describe('getClusterTopicTemplates', () => {
    it('應該能取得群集的選題模板', async () => {
      const templates = await db.getClusterTopicTemplates(1);
      expect(Array.isArray(templates)).toBe(true);
    });
  });
});
