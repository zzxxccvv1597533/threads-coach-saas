import { describe, it, expect } from 'vitest';
import { buildViralFactorsPrompt, buildHooksPrompt } from './db';

describe('buildViralFactorsPrompt', () => {
  it('should return generic suggestions when no benchmarks provided', () => {
    const result = buildViralFactorsPrompt([]);
    
    // 應該包含通用建議
    expect(result).toContain('爆文因子建議');
    expect(result).toContain('應該加入的元素');
    expect(result).toContain('應該避免的元素');
    expect(result).toContain('結果導向詞');
    expect(result).toContain('CTA 硬塞');
    expect(result).toContain('Top10 命中率');
  });

  it('should include keyword-specific data when benchmark provided', () => {
    const mockBenchmark = {
      id: 1,
      keyword: '2026運勢',
      category: '又穩又爆（主力支柱）',
      totalPosts: 208,
      avgLikes: 53772,
      medianLikes: 35640,
      maxLikes: 509424,
      viralCount: 0,
      viralRate: 7846, // 78.46%
      bestContentType: null,
      bestContentTypeViralRate: 0,
      avgLength: 0,
      optimalLengthMin: 200,
      optimalLengthMax: 400,
      hasImageRate: 0,
      viralFactors: {
        resultFlag: 0.072,
        ctaFlag: 0.077,
        questionMark: 0.278,
        numberFlag: 0.416,
        timeFlag: 0.158,
      },
      funnelSuggestions: {
        tofu: '預言/提醒：某時間點會發生什麼',
        mofu: '行動清單：3步/7天調整',
        bofu: '引導私訊：領『個人化運勢/提醒』或加LINE',
      },
      stabilityScore: 3990,
      burstScore: 44783,
      topHooks: null,
      dataSource: 'excel_import_2025Q1',
      lastUpdatedAt: new Date(),
      createdAt: new Date(),
    };

    const result = buildViralFactorsPrompt([mockBenchmark]);
    
    // 應該包含關鍵字資訊
    expect(result).toContain('2026運勢');
    expect(result).toContain('又穩又爆');
    expect(result).toContain('53,772'); // 平均讚數（格式化）
    expect(result).toContain('78.5%'); // 爆文率
    
    // 應該包含爆文因子建議
    expect(result).toContain('應該加入的元素');
    expect(result).toContain('應該避免的元素');
    
    // 應該包含漏斗建議
    expect(result).toContain('內容策略建議');
    expect(result).toContain('TOFU');
    expect(result).toContain('預言/提醒');
  });

  it('should highlight high CTA usage as warning', () => {
    const mockBenchmark = {
      id: 1,
      keyword: '塔羅',
      category: '不穩也不爆',
      totalPosts: 260,
      avgLikes: 579,
      medianLikes: 70,
      maxLikes: 24609,
      viralCount: 0,
      viralRate: 192,
      bestContentType: null,
      bestContentTypeViralRate: 0,
      avgLength: 0,
      optimalLengthMin: 200,
      optimalLengthMax: 400,
      hasImageRate: 0,
      viralFactors: {
        resultFlag: 0.038,
        ctaFlag: 0.281, // 高 CTA 使用率
        questionMark: 0.412,
        numberFlag: 0.342,
        timeFlag: 0.238,
      },
      topHooks: null,
      dataSource: 'excel_import_2025Q1',
      lastUpdatedAt: new Date(),
      createdAt: new Date(),
    };

    const result = buildViralFactorsPrompt([mockBenchmark]);
    
    // 應該包含 CTA 警告
    expect(result).toContain('⚠️');
    expect(result).toContain('CTA');
    expect(result).toContain('28.1%');
  });

  it('should highlight high result flag usage as recommendation', () => {
    const mockBenchmark = {
      id: 1,
      keyword: '財運',
      category: '又穩又爆（主力支柱）',
      totalPosts: 203,
      avgLikes: 2579,
      medianLikes: 552,
      maxLikes: 41701,
      viralCount: 0,
      viralRate: 985,
      bestContentType: null,
      bestContentTypeViralRate: 0,
      avgLength: 0,
      optimalLengthMin: 200,
      optimalLengthMax: 400,
      hasImageRate: 0,
      viralFactors: {
        resultFlag: 0.936, // 非常高的結果導向使用率
        ctaFlag: 0.118,
        questionMark: 0.202,
        numberFlag: 0.576,
        timeFlag: 0.202,
      },
      topHooks: null,
      dataSource: 'excel_import_2025Q1',
      lastUpdatedAt: new Date(),
      createdAt: new Date(),
    };

    const result = buildViralFactorsPrompt([mockBenchmark]);
    
    // 應該包含結果導向的強烈建議
    expect(result).toContain('⭐');
    expect(result).toContain('結果導向');
    expect(result).toContain('93.6%');
    expect(result).toContain('強烈建議');
  });
});

describe('buildHooksPrompt', () => {
  it('should return empty string when no hooks provided', () => {
    const result = buildHooksPrompt([]);
    expect(result).toBe('');
  });

  it('should include hook patterns in prompt', () => {
    const mockHooks = [
      {
        id: 1,
        hookPattern: '你是不是也常常...',
        hookType: 'mirror',
        avgLikes: 5000,
        viralRate: 500,
        sampleCount: 10,
        source: 'viral_analysis',
        isActive: true,
        contentTypes: null,
        keywords: null,
        examplePosts: null,
        lastUpdatedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: 2,
        hookPattern: '明明很努力，為什麼...',
        hookType: 'contrast',
        avgLikes: 4500,
        viralRate: 450,
        sampleCount: 8,
        source: 'viral_analysis',
        isActive: true,
        contentTypes: null,
        keywords: null,
        examplePosts: null,
        lastUpdatedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const result = buildHooksPrompt(mockHooks);
    
    expect(result).toContain('開頭參考模式');
    expect(result).toContain('你是不是也常常');
    expect(result).toContain('明明很努力');
    expect(result).toContain('不要生硬套用');
  });

  it('should only include short hook patterns (under 50 chars)', () => {
    const mockHooks = [
      {
        id: 1,
        // 這個 hook 有 60 個字元，超過 50 字元的限制
        hookPattern: '這是一個非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常長的開頭模式，超過50個字元',
        hookType: 'long',
        avgLikes: 5000,
        viralRate: 500,
        sampleCount: 10,
        source: 'viral_analysis',
        isActive: true,
        contentTypes: null,
        keywords: null,
        examplePosts: null,
        lastUpdatedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: 2,
        hookPattern: '你是不是也常常...', // 短的 hook
        hookType: 'mirror',
        avgLikes: 4000,
        viralRate: 400,
        sampleCount: 5,
        source: 'viral_analysis',
        isActive: true,
        contentTypes: null,
        keywords: null,
        examplePosts: null,
        lastUpdatedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const result = buildHooksPrompt(mockHooks);
    
    // 應該包含短的 hook
    expect(result).toContain('你是不是也常常');
    // 不應該包含長的 hook
    expect(result).not.toContain('這是一個非常非常');
  });
});
