/**
 * Opener Generator 和 Selector 測試
 */

import { describe, it, expect, vi } from 'vitest';
import { selectAndRank, getTopN, passesQualityCheck, groupByCategory } from './selector';

// Mock OpenerCandidate 類型
interface MockOpenerCandidate {
  id?: number;
  templateId: number;
  templateName: string;
  templateCategory: string;
  openerText: string;
  aiScore: number;
  aiFlags: string[];
  scoreLevel: string;
  isExploration: boolean;
  rank?: number;
  finalScore?: number;
}

describe('Selector 模組', () => {
  describe('selectAndRank', () => {
    it('應該對候選進行排序', () => {
      const candidates: MockOpenerCandidate[] = [
        {
          templateId: 1,
          templateName: '情境共鳴',
          templateCategory: 'mirror',
          openerText: '每次打開手機，看到那些數字...',
          aiScore: 0.3,
          aiFlags: [],
          scoreLevel: '較自然',
          isExploration: false,
        },
        {
          templateId: 2,
          templateName: '認知反轉',
          templateCategory: 'contrast',
          openerText: '你以為努力就會成功？',
          aiScore: 0.5,
          aiFlags: ['過度使用問句'],
          scoreLevel: '有 AI 痕跡',
          isExploration: false,
        },
        {
          templateId: 3,
          templateName: '數據衝擊',
          templateCategory: 'data',
          openerText: '87% 的人都不知道...',
          aiScore: 0.2,
          aiFlags: [],
          scoreLevel: '非常自然',
          isExploration: true,
        },
      ];

      const result = selectAndRank(candidates as any);
      
      expect(result.rankedCandidates.length).toBeGreaterThan(0);
      expect(result.topPick).toBeDefined();
      // 排名應該從 1 開始
      expect(result.rankedCandidates[0].rank).toBe(1);
    });

    it('應該過濾掉 AI 分數過高的候選', () => {
      const candidates: MockOpenerCandidate[] = [
        {
          templateId: 1,
          templateName: '測試模板',
          templateCategory: 'mirror',
          openerText: '這是一個測試',
          aiScore: 0.8, // 過高
          aiFlags: ['多個 AI 痕跡'],
          scoreLevel: 'AI 感明顯',
          isExploration: false,
        },
        {
          templateId: 2,
          templateName: '好模板',
          templateCategory: 'contrast',
          openerText: '這是另一個測試',
          aiScore: 0.3,
          aiFlags: [],
          scoreLevel: '較自然',
          isExploration: false,
        },
      ];

      const result = selectAndRank(candidates as any);
      
      // 應該過濾掉 AI 分數過高的
      expect(result.filteredCount).toBe(1);
    });
  });

  describe('getTopN', () => {
    it('應該返回前 N 個候選', () => {
      const candidates: MockOpenerCandidate[] = Array.from({ length: 10 }, (_, i) => ({
        templateId: i + 1,
        templateName: `模板 ${i + 1}`,
        templateCategory: 'mirror',
        openerText: `開頭 ${i + 1}`,
        aiScore: 0.1 + i * 0.05,
        aiFlags: [],
        scoreLevel: '較自然',
        isExploration: false,
        rank: i + 1,
        finalScore: 1 - i * 0.1,
      }));

      const top3 = getTopN(candidates as any, 3);
      expect(top3.length).toBe(3);
    });
  });

  describe('passesQualityCheck', () => {
    it('應該通過品質良好的候選', () => {
      const candidate: MockOpenerCandidate = {
        templateId: 1,
        templateName: '測試',
        templateCategory: 'mirror',
        openerText: '這是一個足夠長的開頭文字，用來測試品質檢查功能',
        aiScore: 0.3,
        aiFlags: [],
        scoreLevel: '較自然',
        isExploration: false,
      };

      expect(passesQualityCheck(candidate as any).passes).toBe(true);
    });

    it('應該拒絕 AI 分數過高的候選', () => {
      const candidate: MockOpenerCandidate = {
        templateId: 1,
        templateName: '測試',
        templateCategory: 'mirror',
        openerText: '這是一個測試開頭',
        aiScore: 0.8, // 過高
        aiFlags: ['多個問題'],
        scoreLevel: 'AI 感明顯',
        isExploration: false,
      };

      expect(passesQualityCheck(candidate as any).passes).toBe(false);
    });

    it('應該拒絕內容過短的候選', () => {
      const candidate: MockOpenerCandidate = {
        templateId: 1,
        templateName: '測試',
        templateCategory: 'mirror',
        openerText: '太短', // 只有 2 個字
        aiScore: 0.2,
        aiFlags: [],
        scoreLevel: '非常自然',
        isExploration: false,
      };

      expect(passesQualityCheck(candidate as any).passes).toBe(false);
    });
  });

  describe('groupByCategory', () => {
    it('應該按類別分組', () => {
      const candidates: MockOpenerCandidate[] = [
        { templateId: 1, templateName: 'A', templateCategory: 'mirror', openerText: '1', aiScore: 0.2, aiFlags: [], scoreLevel: '較自然', isExploration: false },
        { templateId: 2, templateName: 'B', templateCategory: 'mirror', openerText: '2', aiScore: 0.3, aiFlags: [], scoreLevel: '較自然', isExploration: false },
        { templateId: 3, templateName: 'C', templateCategory: 'contrast', openerText: '3', aiScore: 0.2, aiFlags: [], scoreLevel: '較自然', isExploration: false },
      ];

      const grouped = groupByCategory(candidates as any);
      
      expect(grouped.mirror?.length).toBe(2);
      expect(grouped.contrast?.length).toBe(1);
    });
  });
});

describe('Opener Generator 整合', () => {
  it('應該正確 export 所需的函數', async () => {
    const { generateMultipleOpeners, markOpenerSelected, quickGenerateOpeners } = await import('./openerGenerator');
    
    expect(typeof generateMultipleOpeners).toBe('function');
    expect(typeof markOpenerSelected).toBe('function');
    expect(typeof quickGenerateOpeners).toBe('function');
  });
});
