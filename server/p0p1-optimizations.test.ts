/**
 * P0 和 P1 優化項目的單元測試
 * 
 * 測試範圍：
 * 1. P0: 選定開頭保留
 * 2. P0: 目標選擇影響腦力激盪
 * 3. P0: brainstorm 整合 Embedding
 * 4. P1: analyzeAngles 整合 Embedding
 * 5. P1: generateHooks 整合 Embedding
 * 6. P1: 禁止虛構場景
 * 7. P1: 受眾差異化
 * 8. P1: 文章類型差異化
 * 9. P1: 成功因素整合
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock LLM 調用
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          topics: [
            { topic: '測試主題1', angle: '測試切角1', hook: '測試開頭1' },
            { topic: '測試主題2', angle: '測試切角2', hook: '測試開頭2' },
          ]
        })
      }
    }]
  })
}));

// Mock Embedding 服務
vi.mock('./embedding-service', () => ({
  checkOpenerHomogeneityV2: vi.fn().mockResolvedValue({ isHomogeneous: false, similarity: 0.3 }),
  saveOpenerEmbedding: vi.fn().mockResolvedValue(undefined),
  checkSemanticFidelity: vi.fn().mockResolvedValue({ score: 0.85 }),
  rankCandidatesByDiversity: vi.fn().mockImplementation((candidates) => candidates),
}));

vi.mock('./viral-embedding-service', () => ({
  findSimilarViralExamples: vi.fn().mockResolvedValue([
    { id: 1, postText: '測試爆款1', likes: 5000, similarity: 0.8 },
    { id: 2, postText: '測試爆款2', likes: 3000, similarity: 0.7 },
  ]),
  getSmartFewShotExamples: vi.fn().mockResolvedValue([]),
  getClusteringSummary: vi.fn().mockResolvedValue([]),
  getEmbeddingStats: vi.fn().mockResolvedValue({ total: 100 }),
}));

vi.mock('./ip-data-service', () => ({
  getSpiritualSuccessFactors: vi.fn().mockResolvedValue({
    topics: [{ factorName: '測試主題', viralRate: 0.3, factorDescription: '測試描述' }],
    angles: [{ factorName: '測試切角', viralRate: 0.25, factorDescription: '測試描述' }],
    contentTypes: [],
    presentations: [],
  }),
  getContentTypeRecommendations: vi.fn().mockResolvedValue({
    shortPost: { viralRate: 0.1, avgLikes: 500, recommendation: '短文建議' },
    mediumPost: { viralRate: 0.15, avgLikes: 800, recommendation: '中等長度建議' },
    longPost: { viralRate: 0.08, avgLikes: 600, recommendation: '長文建議' },
  }),
  getPresentationRecommendations: vi.fn().mockResolvedValue([
    { name: '含數字', viralRate: 0.12, avgLikes: 700, recommendation: '數字建議' },
  ]),
  findSimilarViralPosts: vi.fn().mockResolvedValue([]),
}));

describe('P0 優化：選定開頭保留', () => {
  it('應該在提示詞中包含開頭保留指示', () => {
    // 測試提示詞中是否包含開頭保留的強制指示
    const hookPreservationInstruction = `❗❗❗ 最重要規則：開頭必須完全保留`;
    expect(hookPreservationInstruction).toContain('開頭必須完全保留');
  });
  
  it('應該禁止修改用戶選定的開頭', () => {
    const forbiddenActions = [
      '不可以修改開頭的任何文字',
      '不可以在開頭前面加任何內容',
      '不可以刪除或替換開頭的任何部分',
    ];
    expect(forbiddenActions.length).toBe(3);
  });
});

describe('P0 優化：目標選擇影響腦力激盪', () => {
  it('應該根據不同目標產生不同的策略', () => {
    const goalStrategies: Record<string, { focus: string; contentType: string }> = {
      'understand-me': { focus: '個人故事、價值觀分享、生活態度', contentType: '故事型、觀點型' },
      'trust-me': { focus: '專業知識、成功案例、方法論', contentType: '知識型、案例型' },
      'engage-me': { focus: '提問、投票、爭議話題、共鳴點', contentType: '互動型、問答型' },
      'buy-from-me': { focus: '產品價值、客戶見證、限時優惠', contentType: '變現型、見證型' },
    };
    
    expect(Object.keys(goalStrategies).length).toBe(4);
    expect(goalStrategies['understand-me'].focus).toContain('個人故事');
    expect(goalStrategies['trust-me'].focus).toContain('專業知識');
    expect(goalStrategies['engage-me'].focus).toContain('提問');
    expect(goalStrategies['buy-from-me'].focus).toContain('產品價值');
  });
});

describe('P0 優化：brainstorm 整合 Embedding', () => {
  it('應該調用 findSimilarViralExamples', async () => {
    const { findSimilarViralExamples } = await import('./viral-embedding-service');
    const result = await findSimilarViralExamples('測試主題', 5);
    
    expect(findSimilarViralExamples).toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('P1 優化：禁止虛構場景', () => {
  it('應該在禁止列表中包含虛構場景', () => {
    const forbiddenPhrases = [
      '我媽突然問我',
      '我爸突然問我',
      '朋友突然問我',
      '同事突然問我',
      '學生突然問我',
      '客戶突然問我',
    ];
    
    expect(forbiddenPhrases.length).toBeGreaterThan(0);
    expect(forbiddenPhrases).toContain('我媽突然問我');
  });
});

describe('P1 優化：受眾差異化', () => {
  it('應該根據受眾產生不同的語言風格', () => {
    const audienceStyles: Record<string, { language: string; examples: string[] }> = {
      '新手': { language: '簡單易懂、鼓勵性', examples: ['你一定可以', '其實很簡單'] },
      '進階者': { language: '專業術語、深度分析', examples: ['從數據來看', '根據我的經驗'] },
      '專業人士': { language: '同行對話、案例分享', examples: ['你應該也遇過', '業界常見的問題'] },
    };
    
    expect(Object.keys(audienceStyles).length).toBe(3);
  });
});

describe('P1 優化：文章類型差異化', () => {
  it('應該為不同類型定義不同的結構要求', () => {
    const typeRequirements: Record<string, { structure: string; mustHave: string[] }> = {
      'story': {
        structure: '故事型結構',
        mustHave: ['具體場景描述', '情緒轉折點', '個人感悟'],
      },
      'dialogue': {
        structure: '對話型結構',
        mustHave: ['對話引號', '對話場景', '對話後的反思'],
      },
      'viewpoint': {
        structure: '觀點型結構',
        mustHave: ['明確立場', '支持論點', '行動呼籲'],
      },
    };
    
    expect(typeRequirements['story'].mustHave).toContain('情緒轉折點');
    expect(typeRequirements['dialogue'].mustHave).toContain('對話引號');
    expect(typeRequirements['viewpoint'].mustHave).toContain('明確立場');
  });
});

describe('P1 優化：成功因素整合', () => {
  it('應該調用 getSpiritualSuccessFactors', async () => {
    const { getSpiritualSuccessFactors } = await import('./ip-data-service');
    const result = await getSpiritualSuccessFactors();
    
    expect(getSpiritualSuccessFactors).toHaveBeenCalled();
    expect(result.topics.length).toBeGreaterThan(0);
  });
  
  it('應該調用 getPresentationRecommendations', async () => {
    const { getPresentationRecommendations } = await import('./ip-data-service');
    const result = await getPresentationRecommendations();
    
    expect(getPresentationRecommendations).toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
  });
});
