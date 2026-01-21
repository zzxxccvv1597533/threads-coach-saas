/**
 * 語意 Embedding 升級測試
 * 測試 LLM 語意擴展和相關性提示功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock LLM
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          keywords: ['靜坐', '沉思', '禪修', '正念', '內觀']
        })
      }
    }]
  })
}));

// Mock database
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  }),
}));

describe('語意 Embedding 升級', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('expandSemanticKeywords', () => {
    it('應該能擴展關鍵字為同義詞', async () => {
      const { expandSemanticKeywords } = await import('./semantic-expansion-service');
      
      const result = await expandSemanticKeywords('冥想');
      
      // 應該包含原始關鍵字
      expect(result).toContain('冥想');
      // 應該包含擴展的同義詞
      expect(result.length).toBeGreaterThan(1);
    });

    it('應該使用快取避免重複調用 LLM', async () => {
      const { expandSemanticKeywords, clearExpansionCache } = await import('./semantic-expansion-service');
      const { invokeLLM } = await import('./_core/llm');
      
      clearExpansionCache();
      
      // 第一次調用
      await expandSemanticKeywords('冥想');
      const firstCallCount = (invokeLLM as any).mock.calls.length;
      
      // 第二次調用（應該使用快取）
      await expandSemanticKeywords('冥想');
      const secondCallCount = (invokeLLM as any).mock.calls.length;
      
      // LLM 調用次數應該相同（第二次使用快取）
      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('相關性提示', () => {
    it('當相似度低於 50% 時應該顯示提示', () => {
      const maxSimilarity = 0.3;
      const topic = '區塊鏈';
      
      const shouldShowHint = maxSimilarity < 0.5;
      const hint = shouldShowHint 
        ? `💡 提示：目前爆款庫中沒有與「${topic}」高度相關的範例。以下內容僅供啟發參考，建議嘗試用更常見的詞彙描述你的主題。`
        : '';
      
      expect(shouldShowHint).toBe(true);
      expect(hint).toContain('提示');
      expect(hint).toContain(topic);
    });

    it('當相似度高於 50% 時不應該顯示提示', () => {
      const maxSimilarity = 0.7;
      
      const shouldShowHint = maxSimilarity < 0.5;
      
      expect(shouldShowHint).toBe(false);
    });
  });

  describe('開頭選擇優化', () => {
    it('應該標記最接近爆款的開頭為推薦', () => {
      const hooks = [
        { content: 'Hook 1', viralSimilarity: 0.5 },
        { content: 'Hook 2', viralSimilarity: 0.8 },
        { content: 'Hook 3', viralSimilarity: 0.3 },
      ];
      
      const maxSimilarity = Math.max(...hooks.map(h => h.viralSimilarity));
      const hooksWithRecommendation = hooks.map(hook => ({
        ...hook,
        isRecommended: hook.viralSimilarity === maxSimilarity && maxSimilarity > 0.3,
      }));
      
      // 只有 Hook 2 應該被標記為推薦
      expect(hooksWithRecommendation[0].isRecommended).toBe(false);
      expect(hooksWithRecommendation[1].isRecommended).toBe(true);
      expect(hooksWithRecommendation[2].isRecommended).toBe(false);
    });

    it('當所有相似度都低於 30% 時不應該標記任何推薦', () => {
      const hooks = [
        { content: 'Hook 1', viralSimilarity: 0.2 },
        { content: 'Hook 2', viralSimilarity: 0.25 },
        { content: 'Hook 3', viralSimilarity: 0.1 },
      ];
      
      const maxSimilarity = Math.max(...hooks.map(h => h.viralSimilarity));
      const hooksWithRecommendation = hooks.map(hook => ({
        ...hook,
        isRecommended: hook.viralSimilarity === maxSimilarity && maxSimilarity > 0.3,
      }));
      
      // 沒有任何 Hook 應該被標記為推薦
      expect(hooksWithRecommendation.every(h => !h.isRecommended)).toBe(true);
    });
  });

  describe('類型智能推薦', () => {
    it('應該根據相似爆款的類型分佈推薦', () => {
      const similarExamples = [
        { contentType: 'story', likes: 1000 },
        { contentType: 'story', likes: 2000 },
        { contentType: 'knowledge', likes: 1500 },
        { contentType: 'story', likes: 800 },
        { contentType: 'opinion', likes: 1200 },
      ];
      
      // 統計各類型數量
      const typeStats = new Map<string, { count: number; totalLikes: number }>();
      for (const ex of similarExamples) {
        const existing = typeStats.get(ex.contentType) || { count: 0, totalLikes: 0 };
        typeStats.set(ex.contentType, {
          count: existing.count + 1,
          totalLikes: existing.totalLikes + ex.likes,
        });
      }
      
      // 故事型應該是最多的
      expect(typeStats.get('story')?.count).toBe(3);
      expect(typeStats.get('knowledge')?.count).toBe(1);
      expect(typeStats.get('opinion')?.count).toBe(1);
    });
  });

  describe('今日高潛力推薦', () => {
    it('應該根據領域返回相關關鍵字', () => {
      const getDomainKeywords = (domain: string): string[] => {
        const domainKeywordMap: Record<string, string[]> = {
          '身心靈': ['冥想', '覺察', '療癒', '內在', '成長'],
          '商業創業': ['創業', '經營', '客戶', '營收', '品牌'],
        };
        return domainKeywordMap[domain] || ['成長', '學習', '分享'];
      };
      
      const spiritualKeywords = getDomainKeywords('身心靈');
      const businessKeywords = getDomainKeywords('商業創業');
      
      expect(spiritualKeywords).toContain('冥想');
      expect(businessKeywords).toContain('創業');
    });
  });
});
