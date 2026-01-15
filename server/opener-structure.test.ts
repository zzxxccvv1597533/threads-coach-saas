import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectAndRank, SelectorResult } from './selector';
import { OpenerCandidate } from './openerGenerator';

describe('Opener Structure Tests', () => {
  // 模擬 OpenerCandidate 結構
  const mockCandidates: OpenerCandidate[] = [
    {
      templateId: 1,
      templateName: '反差開場',
      templateCategory: 'contrast',
      openerText: '很多人以為命理師就是要很準，但其實...',
      aiScore: 0.15,
      aiFlags: [],
      scoreLevel: 'natural',
      isExploration: false,
    },
    {
      templateId: 2,
      templateName: '場景描述',
      templateCategory: 'scene',
      openerText: '昨天有個案主跟我說，她已經自我懷疑了三年...',
      aiScore: 0.08,
      aiFlags: [],
      scoreLevel: 'very_natural',
      isExploration: false,
    },
  ];

  it('should have correct OpenerCandidate structure', () => {
    const candidate = mockCandidates[0];
    
    // 驗證必要欄位存在
    expect(candidate).toHaveProperty('templateId');
    expect(candidate).toHaveProperty('templateName');
    expect(candidate).toHaveProperty('templateCategory');
    expect(candidate).toHaveProperty('openerText');
    expect(candidate).toHaveProperty('aiScore');
    expect(candidate).toHaveProperty('aiFlags');
    expect(candidate).toHaveProperty('scoreLevel');
    expect(candidate).toHaveProperty('isExploration');
    
    // 驗證 openerText 不為空
    expect(candidate.openerText).toBeTruthy();
    expect(typeof candidate.openerText).toBe('string');
    expect(candidate.openerText.length).toBeGreaterThan(0);
  });

  it('should return rankedCandidates with openerText field', () => {
    const result: SelectorResult = selectAndRank(mockCandidates);
    
    // 驗證返回結構
    expect(result).toHaveProperty('rankedCandidates');
    expect(result).toHaveProperty('topPick');
    expect(Array.isArray(result.rankedCandidates)).toBe(true);
    
    // 驗證每個候選都有 openerText
    result.rankedCandidates.forEach((candidate) => {
      expect(candidate).toHaveProperty('openerText');
      expect(typeof candidate.openerText).toBe('string');
      expect(candidate.openerText.length).toBeGreaterThan(0);
    });
  });

  it('should preserve openerText through selectAndRank', () => {
    const result = selectAndRank(mockCandidates);
    
    // 驗證 openerText 被正確保留
    const originalTexts = mockCandidates.map(c => c.openerText);
    const rankedTexts = result.rankedCandidates.map(c => c.openerText);
    
    // 所有原始文本都應該出現在排序後的結果中
    originalTexts.forEach(text => {
      expect(rankedTexts).toContain(text);
    });
  });

  it('should have correct scoreLevel values', () => {
    const validLevels = ['very_natural', 'natural', 'ai_trace', 'ai_obvious', 'error'];
    
    mockCandidates.forEach(candidate => {
      expect(validLevels).toContain(candidate.scoreLevel);
    });
  });
});
