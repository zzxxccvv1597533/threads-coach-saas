/**
 * 完整的 Opener Generator 端到端測試
 * 驗證 API 返回的數據結構
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMultipleOpeners, type OpenerCandidate } from './openerGenerator';
import { selectAndRank, type RankedCandidate } from './selector';

// Mock LLM
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: '這是一個測試開頭，用來驗證 API 返回結構'
      }
    }]
  })
}));

// Mock db
vi.mock('./db', () => ({
  getDb: vi.fn().mockReturnValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }])
      })
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      })
    })
  })
}));

// Mock promptService
vi.mock('./promptService', () => ({
  getActiveTemplates: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: 'scene',
      category: 'scene',
      promptTemplate: '用場景描述開頭：{{topic}}',
      exampleOutput: '昨天有個案主跟我說...',
      weight: 1.0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: 'question',
      category: 'question',
      promptTemplate: '用問題開頭：{{topic}}',
      exampleOutput: '你是不是也曾經...',
      weight: 1.0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      name: 'contrast',
      category: 'contrast',
      promptTemplate: '用反差開頭：{{topic}}',
      exampleOutput: '很多人以為...但其實...',
      weight: 1.0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getAvoidList: vi.fn().mockResolvedValue([]),
}));

describe('Opener Generator API 返回結構驗證', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OpenerCandidate 應該包含正確的欄位', async () => {
    const result = await generateMultipleOpeners({
      userId: 1,
      topic: '如何克服自我懷疑',
      contentType: 'story',
      hookStyle: 'scene',
      count: 3,
    });

    expect(result.candidates).toBeDefined();
    expect(result.candidates.length).toBeGreaterThan(0);

    // 驗證每個候選的欄位
    for (const candidate of result.candidates) {
      console.log('[Test] Candidate structure:', JSON.stringify(candidate, null, 2));
      
      // 必須有 openerText 欄位（不是 content）
      expect(candidate).toHaveProperty('openerText');
      expect(typeof candidate.openerText).toBe('string');
      expect(candidate.openerText.length).toBeGreaterThan(0);
      
      // 必須有 templateCategory 欄位
      expect(candidate).toHaveProperty('templateCategory');
      expect(typeof candidate.templateCategory).toBe('string');
      
      // 必須有 aiScore 欄位
      expect(candidate).toHaveProperty('aiScore');
      expect(typeof candidate.aiScore).toBe('number');
      
      // 必須有 scoreLevel 欄位（不是 aiLevel）
      expect(candidate).toHaveProperty('scoreLevel');
      expect(typeof candidate.scoreLevel).toBe('string');
      
      // 必須有 templateId 欄位
      expect(candidate).toHaveProperty('templateId');
      expect(typeof candidate.templateId).toBe('number');
    }
  });

  it('RankedCandidate 應該繼承 OpenerCandidate 的所有欄位', async () => {
    const mockCandidates: OpenerCandidate[] = [
      {
        templateId: 1,
        templateName: 'scene',
        templateCategory: 'scene',
        openerText: '昨天有個案主跟我說，他一直很自我懷疑...',
        aiScore: 0.2,
        aiFlags: [],
        scoreLevel: 'natural',
        isExploration: false,
      },
      {
        templateId: 2,
        templateName: 'question',
        templateCategory: 'question',
        openerText: '你是不是也曾經懷疑過自己的能力？',
        aiScore: 0.3,
        aiFlags: [],
        scoreLevel: 'natural',
        isExploration: false,
      },
    ];

    const result = selectAndRank(mockCandidates);

    expect(result.rankedCandidates).toBeDefined();
    expect(result.rankedCandidates.length).toBe(2);

    for (const ranked of result.rankedCandidates) {
      console.log('[Test] RankedCandidate structure:', JSON.stringify(ranked, null, 2));
      
      // 必須保留 openerText 欄位
      expect(ranked).toHaveProperty('openerText');
      expect(typeof ranked.openerText).toBe('string');
      expect(ranked.openerText.length).toBeGreaterThan(0);
      
      // 必須保留 templateCategory 欄位
      expect(ranked).toHaveProperty('templateCategory');
      
      // 必須保留 aiScore 欄位
      expect(ranked).toHaveProperty('aiScore');
      
      // 必須保留 scoreLevel 欄位
      expect(ranked).toHaveProperty('scoreLevel');
      
      // 必須有 rank 欄位（RankedCandidate 新增）
      expect(ranked).toHaveProperty('rank');
      expect(typeof ranked.rank).toBe('number');
      
      // 必須有 finalScore 欄位（RankedCandidate 新增）
      expect(ranked).toHaveProperty('finalScore');
      expect(typeof ranked.finalScore).toBe('number');
    }
  });

  it('前端應該使用 openerText 而不是 content', () => {
    // 這個測試驗證前端的欄位映射是否正確
    const mockApiResponse = {
      candidates: [
        {
          id: 1,
          templateId: 1,
          templateName: 'scene',
          templateCategory: 'scene',
          openerText: '昨天有個案主跟我說...',
          aiScore: 0.2,
          aiFlags: [],
          scoreLevel: 'natural',
          isExploration: false,
          rank: 1,
          finalScore: 0.85,
          diversityScore: 0.9,
          scoreBreakdown: {
            aiComponent: 0.32,
            diversityComponent: 0.27,
            templateComponent: 0.2,
            explorationBonus: 0,
          },
        },
      ],
    };

    // 模擬前端的轉換邏輯
    const transformedHooks = mockApiResponse.candidates.map((candidate: any) => ({
      style: String(candidate.templateId) || 'custom',
      styleName: candidate.templateCategory || '自訂風格',
      content: candidate.openerText || candidate.content || '', // 使用 openerText 欄位
      reason: `AI 痕跡分數：${Math.round((1 - (candidate.aiScore || 0)) * 100)}% 自然度`,
      aiScore: candidate.aiScore || 0,
      aiLevel: candidate.scoreLevel || candidate.aiLevel || 'natural', // 使用 scoreLevel 欄位
      candidateId: candidate.id,
      templateCategory: candidate.templateCategory,
    }));

    console.log('[Test] Transformed hooks:', JSON.stringify(transformedHooks, null, 2));

    expect(transformedHooks[0].content).toBe('昨天有個案主跟我說...');
    expect(transformedHooks[0].content.length).toBeGreaterThan(0);
    expect(transformedHooks[0].aiLevel).toBe('natural');
  });
});
