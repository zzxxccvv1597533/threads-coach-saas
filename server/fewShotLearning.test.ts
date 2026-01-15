import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fewShotLearning from './fewShotLearning';
import * as db from './db';

// Mock db module
vi.mock('./db', () => ({
  getUserWritingStyle: vi.fn(),
}));

describe('Few-Shot Learning 服務', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractViralPatterns', () => {
    it('應該從用戶樣本貼文中提取成功模式', async () => {
      const mockUserStyle = {
        toneStyle: '溫暖療癒',
        commonPhrases: ['真的', '其實'],
        catchphrases: ['你懂的'],
        hookStylePreference: '情緒爆發型',
        metaphorStyle: null,
        emotionRhythm: '短句為主',
        viralElements: {
          emotionWords: ['暈', '傻眼'],
          identityTags: ['媽媽'],
          ctaStyles: [],
        },
        samplePosts: [
          { content: '我真的覺得這件事太扯了\n每次都這樣', engagement: 1000, addedAt: '2025-01-01' },
          { content: '昨天發生了一件事\n讓我很有感觸', engagement: 500, addedAt: '2025-01-02' },
          { content: '我真的很傻眼\n怎麼會這樣', engagement: 800, addedAt: '2025-01-03' },
        ],
      };

      vi.mocked(db.getUserWritingStyle).mockResolvedValue(mockUserStyle);

      const patterns = await fewShotLearning.extractViralPatterns(1);

      expect(patterns).toBeInstanceOf(Array);
      expect(patterns.length).toBeGreaterThan(0);
      // 情緒爆發型應該是最常見的
      expect(patterns[0].openerType).toBe('情緒爆發型');
      expect(patterns[0].successRate).toBeGreaterThan(0);
    });

    it('沒有樣本貼文時應該返回空陣列', async () => {
      vi.mocked(db.getUserWritingStyle).mockResolvedValue(null);

      const patterns = await fewShotLearning.extractViralPatterns(1);

      expect(patterns).toEqual([]);
    });

    it('樣本貼文為空時應該返回空陣列', async () => {
      vi.mocked(db.getUserWritingStyle).mockResolvedValue({
        toneStyle: null,
        commonPhrases: [],
        catchphrases: [],
        hookStylePreference: null,
        metaphorStyle: null,
        emotionRhythm: null,
        viralElements: null,
        samplePosts: [],
      });

      const patterns = await fewShotLearning.extractViralPatterns(1);

      expect(patterns).toEqual([]);
    });
  });

  describe('buildEnhancedFewShotContext', () => {
    it('應該建構完整的 Few-Shot 上下文', async () => {
      const mockUserStyle = {
        toneStyle: '幽默吐槽',
        commonPhrases: ['真的', '其實'],
        catchphrases: ['笑死'],
        hookStylePreference: '情緒爆發型',
        metaphorStyle: null,
        emotionRhythm: '短句為主',
        viralElements: {
          emotionWords: ['暈', '傻眼'],
          identityTags: ['創業者'],
          ctaStyles: [],
        },
        samplePosts: [
          { content: '我真的覺得這件事太扯了', engagement: 100, addedAt: '2025-01-01' },
        ],
      };

      vi.mocked(db.getUserWritingStyle).mockResolvedValue(mockUserStyle);

      const context = await fewShotLearning.buildEnhancedFewShotContext(1);

      expect(context).toHaveProperty('styleProfile');
      expect(context).toHaveProperty('viralPatterns');
      expect(context).toHaveProperty('recentSuccesses');
      expect(context).toHaveProperty('personalizedPrompt');
      expect(context.personalizedPrompt).toContain('寫作風格 DNA');
    });

    it('沒有用戶風格時應該返回 null styleProfile', async () => {
      vi.mocked(db.getUserWritingStyle).mockResolvedValue(null);

      const context = await fewShotLearning.buildEnhancedFewShotContext(1);

      expect(context.styleProfile).toBeNull();
      expect(context.viralPatterns).toEqual([]);
      expect(context.recentSuccesses).toEqual([]);
    });
  });

  describe('getBestOpenerPattern', () => {
    it('有成功模式時應該返回最佳模式', async () => {
      const mockUserStyle = {
        toneStyle: '溫暖療癒',
        commonPhrases: [],
        catchphrases: [],
        hookStylePreference: null,
        metaphorStyle: null,
        emotionRhythm: null,
        viralElements: null,
        samplePosts: [
          { content: '我真的覺得這件事太扯了', engagement: 1000, addedAt: '2025-01-01' },
          { content: '我真的很傻眼', engagement: 800, addedAt: '2025-01-02' },
        ],
      };

      vi.mocked(db.getUserWritingStyle).mockResolvedValue(mockUserStyle);

      const bestPattern = await fewShotLearning.getBestOpenerPattern(1);

      expect(bestPattern).toBe('情緒爆發型');
    });

    it('沒有成功模式時應該返回預設模式', async () => {
      vi.mocked(db.getUserWritingStyle).mockResolvedValue(null);

      const bestPattern = await fewShotLearning.getBestOpenerPattern(1);

      expect(bestPattern).toBe('情緒爆發型');
    });
  });

  describe('calculateUserStyleMatch', () => {
    it('有風格資料時應該計算匹配度', () => {
      const content = '笑死，這件事真的太扯了';
      const styleProfile = {
        toneStyle: '幽默吐槽',
        commonPhrases: ['真的', '其實'],
        catchphrases: ['笑死'],
        hookStylePreference: '情緒爆發型',
        metaphorStyle: null,
        emotionRhythm: '短句為主',
        viralElements: {
          emotionWords: ['暈', '傻眼'],
          identityTags: [],
          ctaStyles: [],
        },
        samplePosts: [],
      };

      const result = fewShotLearning.calculateUserStyleMatch(content, styleProfile);

      expect(result.score).toBeGreaterThan(50);
      expect(result.details).toBeInstanceOf(Array);
      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it('沒有風格資料時應該返回預設分數', () => {
      const content = '這是一篇測試貼文';

      const result = fewShotLearning.calculateUserStyleMatch(content, null);

      expect(result.score).toBe(50);
      expect(result.details).toContain('尚未設定個人風格');
    });

    it('口頭禪使用適度時應該加分', () => {
      const content = '笑死，這件事真的太扶了';
      const styleProfile = {
        toneStyle: '幽默吐槽',
        commonPhrases: [],
        catchphrases: ['笑死'],
        hookStylePreference: null,
        metaphorStyle: null,
        emotionRhythm: null,
        viralElements: null,
        samplePosts: [],
      };

      const result = fewShotLearning.calculateUserStyleMatch(content, styleProfile);

      // 口頭禪使用適度應該加分
      expect(result.score).toBeGreaterThan(50);
      expect(result.details.some(d => d.includes('口頭禪'))).toBe(true);
    });
  });

  describe('generateFeedbackSuggestions', () => {
    it('有成功模式時應該生成建議', async () => {
      const mockUserStyle = {
        toneStyle: '溫暖療癒',
        commonPhrases: [],
        catchphrases: [],
        hookStylePreference: null,
        metaphorStyle: null,
        emotionRhythm: null,
        viralElements: null,
        samplePosts: [
          { content: '我真的覺得這件事太扯了', engagement: 1000, addedAt: '2025-01-01' },
        ],
      };

      vi.mocked(db.getUserWritingStyle).mockResolvedValue(mockUserStyle);

      const suggestions = await fewShotLearning.generateFeedbackSuggestions(1);

      expect(suggestions).toHaveProperty('topPatterns');
      expect(suggestions).toHaveProperty('recommendations');
      expect(suggestions).toHaveProperty('nextActions');
      expect(suggestions.topPatterns.length).toBeGreaterThan(0);
    });

    it('沒有樣本時應該建議上傳貼文', async () => {
      vi.mocked(db.getUserWritingStyle).mockResolvedValue(null);

      const suggestions = await fewShotLearning.generateFeedbackSuggestions(1);

      expect(suggestions.nextActions.some(a => a.includes('上傳'))).toBe(true);
    });
  });

  describe('開頭類型檢測', () => {
    it('應該正確檢測情緒爆發型開頭', async () => {
      const mockUserStyle = {
        toneStyle: null,
        commonPhrases: [],
        catchphrases: [],
        hookStylePreference: null,
        metaphorStyle: null,
        emotionRhythm: null,
        viralElements: null,
        samplePosts: [
          { content: '我真的覺得這件事太扯了', engagement: 100, addedAt: '2025-01-01' },
          { content: '天啊這也太誇張了吧', engagement: 100, addedAt: '2025-01-02' },
          { content: '傻眼，怎麼會這樣', engagement: 100, addedAt: '2025-01-03' },
        ],
      };

      vi.mocked(db.getUserWritingStyle).mockResolvedValue(mockUserStyle);

      const patterns = await fewShotLearning.extractViralPatterns(1);

      expect(patterns[0].openerType).toBe('情緒爆發型');
    });

    it('應該正確檢測故事敘事型開頭', async () => {
      const mockUserStyle = {
        toneStyle: null,
        commonPhrases: [],
        catchphrases: [],
        hookStylePreference: null,
        metaphorStyle: null,
        emotionRhythm: null,
        viralElements: null,
        samplePosts: [
          { content: '昨天發生了一件事', engagement: 100, addedAt: '2025-01-01' },
          { content: '今天早上起床的時候', engagement: 100, addedAt: '2025-01-02' },
          { content: '記得小時候', engagement: 100, addedAt: '2025-01-03' },
        ],
      };

      vi.mocked(db.getUserWritingStyle).mockResolvedValue(mockUserStyle);

      const patterns = await fewShotLearning.extractViralPatterns(1);

      expect(patterns[0].openerType).toBe('故事敘事型');
    });

    it('應該正確檢測對話引用型開頭', async () => {
      const mockUserStyle = {
        toneStyle: null,
        commonPhrases: [],
        catchphrases: [],
        hookStylePreference: null,
        metaphorStyle: null,
        emotionRhythm: null,
        viralElements: null,
        samplePosts: [
          { content: '「你怕不怕失敗？」', engagement: 100, addedAt: '2025-01-01' },
          { content: '「為什麼你要這樣做？」', engagement: 100, addedAt: '2025-01-02' },
        ],
      };

      vi.mocked(db.getUserWritingStyle).mockResolvedValue(mockUserStyle);

      const patterns = await fewShotLearning.extractViralPatterns(1);

      expect(patterns[0].openerType).toBe('對話引用型');
    });
  });
});
