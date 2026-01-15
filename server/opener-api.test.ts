/**
 * 測試 opener.generate API 的返回結構
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectAndRank, type RankedCandidate } from './selector';
import { type OpenerCandidate } from './openerGenerator';

describe('Opener API Response Structure', () => {
  it('should have correct field names in OpenerCandidate', () => {
    // 模擬 OpenerCandidate 結構
    const candidate: OpenerCandidate = {
      id: 1,
      templateId: 1,
      templateName: '對比反差型',
      templateCategory: 'contrast',
      openerText: '你以為自我懷疑是你的錯？其實是這件事沒做對！',
      aiScore: 0.3,
      aiFlags: [],
      scoreLevel: 'natural',
      isExploration: false,
    };

    // 驗證欄位名稱
    expect(candidate).toHaveProperty('openerText');
    expect(candidate).toHaveProperty('aiScore');
    expect(candidate).toHaveProperty('scoreLevel');
    expect(candidate).toHaveProperty('templateCategory');
    expect(candidate).toHaveProperty('templateName');
    
    // 驗證欄位值
    expect(candidate.openerText).toBe('你以為自我懷疑是你的錯？其實是這件事沒做對！');
    expect(candidate.aiScore).toBe(0.3);
    expect(candidate.scoreLevel).toBe('natural');
  });

  it('should have correct field names in RankedCandidate after selectAndRank', () => {
    const candidates: OpenerCandidate[] = [
      {
        id: 1,
        templateId: 1,
        templateName: '對比反差型',
        templateCategory: 'contrast',
        openerText: '你以為自我懷疑是你的錯？其實是這件事沒做對！',
        aiScore: 0.3,
        aiFlags: [],
        scoreLevel: 'natural',
        isExploration: false,
      },
      {
        id: 2,
        templateId: 2,
        templateName: '場景帶入型',
        templateCategory: 'scene',
        openerText: '昨天有個學員跟我說，她每次要發文都會自我懷疑...',
        aiScore: 0.2,
        aiFlags: [],
        scoreLevel: 'very_natural',
        isExploration: false,
      },
    ];

    const result = selectAndRank(candidates);

    // 驗證返回結構
    expect(result).toHaveProperty('rankedCandidates');
    expect(result).toHaveProperty('topPick');
    expect(result).toHaveProperty('filteredCount');
    expect(result).toHaveProperty('avgFinalScore');

    // 驗證 rankedCandidates 的欄位
    expect(result.rankedCandidates.length).toBeGreaterThan(0);
    
    const firstCandidate = result.rankedCandidates[0];
    expect(firstCandidate).toHaveProperty('openerText');
    expect(firstCandidate).toHaveProperty('aiScore');
    expect(firstCandidate).toHaveProperty('scoreLevel');
    expect(firstCandidate).toHaveProperty('templateCategory');
    expect(firstCandidate).toHaveProperty('rank');
    expect(firstCandidate).toHaveProperty('finalScore');
    expect(firstCandidate).toHaveProperty('scoreBreakdown');
    expect(firstCandidate).toHaveProperty('diversityScore');

    // 驗證欄位值不為空
    expect(firstCandidate.openerText).toBeTruthy();
    expect(typeof firstCandidate.aiScore).toBe('number');
    expect(firstCandidate.scoreLevel).toBeTruthy();
  });

  it('should verify frontend field mapping matches API response', () => {
    // 模擬 API 返回的 rankedCandidates
    const apiResponse = {
      candidates: [
        {
          id: 1,
          templateId: 1,
          templateName: '對比反差型',
          templateCategory: 'contrast',
          openerText: '你以為自我懷疑是你的錯？其實是這件事沒做對！',
          aiScore: 0.3,
          aiFlags: [],
          scoreLevel: 'natural',
          isExploration: false,
          rank: 1,
          finalScore: 0.8,
          scoreBreakdown: {
            aiComponent: 0.28,
            diversityComponent: 0.3,
            templateComponent: 0.2,
            explorationBonus: 0,
          },
          diversityScore: 1,
        },
      ],
      topPick: null,
      filteredCount: 0,
      avgFinalScore: 0.8,
    };

    // 模擬前端的轉換邏輯
    const transformedHooks = apiResponse.candidates.map((candidate: any) => ({
      style: String(candidate.templateId) || 'custom',
      styleName: candidate.templateCategory || '自訂風格',
      content: candidate.openerText || candidate.content || '', // 使用 openerText 欄位
      reason: `AI 痕跡分數：${Math.round((1 - (candidate.aiScore || 0)) * 100)}% 自然度`,
      aiScore: candidate.aiScore || 0,
      aiLevel: candidate.scoreLevel || candidate.aiLevel || 'natural', // 使用 scoreLevel 欄位
      candidateId: candidate.id,
      templateCategory: candidate.templateCategory,
    }));

    // 驗證轉換後的結構
    expect(transformedHooks.length).toBe(1);
    expect(transformedHooks[0].content).toBe('你以為自我懷疑是你的錯？其實是這件事沒做對！');
    expect(transformedHooks[0].aiScore).toBe(0.3);
    expect(transformedHooks[0].aiLevel).toBe('natural');
    expect(transformedHooks[0].styleName).toBe('contrast');
  });
});
