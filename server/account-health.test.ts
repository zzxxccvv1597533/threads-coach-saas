import { describe, it, expect, vi } from 'vitest';

// Mock db functions
vi.mock('./db', () => ({
  getAccountHealthDiagnosis: vi.fn().mockResolvedValue({
    overallScore: 65,
    contentHealth: {
      score: 70,
      postFrequency: 4,
      typeBalance: 60,
      avgWordCount: 250,
      issues: ['內容類型單一'],
      suggestions: ['嘗試不同類型的貼文'],
    },
    interactionHealth: {
      score: 50,
      avgComments: 8,
      avgLikes: 120,
      replyRate: 0,
      issues: ['平均留言數偏低'],
      suggestions: ['在貼文結尾加入引導互動的問題'],
    },
    growthHealth: {
      score: 60,
      followerTrend: 'unknown',
      reachTrend: 'unknown',
      issues: ['數據樣本不足'],
      suggestions: ['持續發文累積數據'],
    },
    personaConsistency: {
      score: 80,
      hasIpProfile: true,
      hasAudience: true,
      hasContentPillars: false,
      issues: ['尚未設定內容支柱'],
      suggestions: ['設定 2-3 個主要的內容主題'],
    },
  }),
  getContentMixAnalysis: vi.fn().mockResolvedValue({
    totalPosts: 50,
    last7Days: 5,
    last30Days: 20,
    typeDistribution: [
      { type: 'story', count: 3, percentage: 60 },
      { type: 'question', count: 1, percentage: 20 },
      { type: 'casual', count: 1, percentage: 20 },
    ],
    categoryDistribution: {
      emotional: { count: 4, percentage: 80, types: ['story', 'casual'] },
      brand: { count: 0, percentage: 0, types: [] },
      interactive: { count: 1, percentage: 20, types: ['question'] },
      monetization: { count: 0, percentage: 0, types: [] },
    },
    recommendation: {
      nextType: 'knowledge',
      reason: '可以適當增加一些乾貨內容建立專業形象',
      urgency: 'low',
    },
  }),
  identifyUserDomain: vi.fn().mockResolvedValue({
    primaryDomain: '身心靈',
    subDomains: ['商業創業'],
    keywords: ['療癒', '冥想', '能量'],
    confidence: 0.8,
  }),
  getPersonalizedTopicSuggestions: vi.fn().mockResolvedValue({
    topics: [
      { title: '我第一次接觸療癒的契機', contentType: 'story', reason: '建立人設，讓人認識你', targetGoal: 'awareness' },
      { title: '很多人問我：要怎麼開始練習冥想？', contentType: 'dialogue', reason: '展現專業，建立信任', targetGoal: 'trust' },
      { title: '你相信能量嗎？', contentType: 'question', reason: '引發討論，增加互動', targetGoal: 'engagement' },
    ],
    basedOn: {
      domain: '身心靈',
      stage: 'startup',
      recentTypes: ['story', 'question', 'casual'],
    },
  }),
}));

describe('P2 優化：帳號健康度和內容組合分析', () => {
  describe('帳號健康度診斷', () => {
    it('應該返回完整的健康度診斷結構', async () => {
      const { getAccountHealthDiagnosis } = await import('./db');
      const diagnosis = await getAccountHealthDiagnosis(1);
      
      expect(diagnosis).toHaveProperty('overallScore');
      expect(diagnosis).toHaveProperty('contentHealth');
      expect(diagnosis).toHaveProperty('interactionHealth');
      expect(diagnosis).toHaveProperty('growthHealth');
      expect(diagnosis).toHaveProperty('personaConsistency');
    });

    it('健康度分數應該在 0-100 範圍內', async () => {
      const { getAccountHealthDiagnosis } = await import('./db');
      const diagnosis = await getAccountHealthDiagnosis(1);
      
      expect(diagnosis.overallScore).toBeGreaterThanOrEqual(0);
      expect(diagnosis.overallScore).toBeLessThanOrEqual(100);
      expect(diagnosis.contentHealth.score).toBeGreaterThanOrEqual(0);
      expect(diagnosis.contentHealth.score).toBeLessThanOrEqual(100);
    });

    it('應該包含改善建議', async () => {
      const { getAccountHealthDiagnosis } = await import('./db');
      const diagnosis = await getAccountHealthDiagnosis(1);
      
      expect(diagnosis.contentHealth.suggestions).toBeDefined();
      expect(Array.isArray(diagnosis.contentHealth.suggestions)).toBe(true);
      expect(diagnosis.interactionHealth.suggestions).toBeDefined();
    });
  });

  describe('內容組合分析', () => {
    it('應該返回完整的內容組合分析結構', async () => {
      const { getContentMixAnalysis } = await import('./db');
      const analysis = await getContentMixAnalysis(1);
      
      expect(analysis).toHaveProperty('totalPosts');
      expect(analysis).toHaveProperty('last7Days');
      expect(analysis).toHaveProperty('typeDistribution');
      expect(analysis).toHaveProperty('categoryDistribution');
      expect(analysis).toHaveProperty('recommendation');
    });

    it('類型分佈百分比總和應該合理', async () => {
      const { getContentMixAnalysis } = await import('./db');
      const analysis = await getContentMixAnalysis(1);
      
      const totalPercentage = analysis.typeDistribution.reduce((sum, t) => sum + t.percentage, 0);
      // 允許四捨五入誤差
      expect(totalPercentage).toBeGreaterThanOrEqual(95);
      expect(totalPercentage).toBeLessThanOrEqual(105);
    });

    it('應該包含下一篇推薦', async () => {
      const { getContentMixAnalysis } = await import('./db');
      const analysis = await getContentMixAnalysis(1);
      
      expect(analysis.recommendation).toHaveProperty('nextType');
      expect(analysis.recommendation).toHaveProperty('reason');
      expect(analysis.recommendation).toHaveProperty('urgency');
      expect(['high', 'medium', 'low']).toContain(analysis.recommendation.urgency);
    });
  });

  describe('用戶領域識別', () => {
    it('應該識別用戶的主要領域', async () => {
      const { identifyUserDomain } = await import('./db');
      const domain = await identifyUserDomain(1);
      
      expect(domain).toHaveProperty('primaryDomain');
      expect(domain).toHaveProperty('subDomains');
      expect(domain).toHaveProperty('keywords');
      expect(domain).toHaveProperty('confidence');
    });

    it('信心度應該在 0-1 範圍內', async () => {
      const { identifyUserDomain } = await import('./db');
      const domain = await identifyUserDomain(1);
      
      expect(domain.confidence).toBeGreaterThanOrEqual(0);
      expect(domain.confidence).toBeLessThanOrEqual(1);
    });

    it('關鍵字應該是陣列', async () => {
      const { identifyUserDomain } = await import('./db');
      const domain = await identifyUserDomain(1);
      
      expect(Array.isArray(domain.keywords)).toBe(true);
    });
  });

  describe('個人化選題推薦', () => {
    it('應該返回推薦選題列表', async () => {
      const { getPersonalizedTopicSuggestions } = await import('./db');
      const suggestions = await getPersonalizedTopicSuggestions(1, 5);
      
      expect(suggestions).toHaveProperty('topics');
      expect(Array.isArray(suggestions.topics)).toBe(true);
      expect(suggestions.topics.length).toBeGreaterThan(0);
    });

    it('每個選題應該包含必要欄位', async () => {
      const { getPersonalizedTopicSuggestions } = await import('./db');
      const suggestions = await getPersonalizedTopicSuggestions(1, 5);
      
      const topic = suggestions.topics[0];
      expect(topic).toHaveProperty('title');
      expect(topic).toHaveProperty('contentType');
      expect(topic).toHaveProperty('reason');
      expect(topic).toHaveProperty('targetGoal');
    });

    it('目標應該是有效的值', async () => {
      const { getPersonalizedTopicSuggestions } = await import('./db');
      const suggestions = await getPersonalizedTopicSuggestions(1, 5);
      
      const validGoals = ['awareness', 'trust', 'engagement', 'sales'];
      suggestions.topics.forEach(topic => {
        expect(validGoals).toContain(topic.targetGoal);
      });
    });

    it('應該包含推薦依據', async () => {
      const { getPersonalizedTopicSuggestions } = await import('./db');
      const suggestions = await getPersonalizedTopicSuggestions(1, 5);
      
      expect(suggestions).toHaveProperty('basedOn');
      expect(suggestions.basedOn).toHaveProperty('domain');
      expect(suggestions.basedOn).toHaveProperty('stage');
      expect(suggestions.basedOn).toHaveProperty('recentTypes');
    });
  });
});
