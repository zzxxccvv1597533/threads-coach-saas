import { describe, it, expect } from 'vitest';
import {
  buildLayer1UniversalRules,
  buildLayer2ContentTypeRules,
  analyzeGeneratedContent,
  getDataDrivenSummary,
} from './data-driven-prompt-builder';
import {
  selectRandomOpenerPattern,
  extractMaterialKeywords,
  analyzeOpener,
  getRecommendedOpenerPatterns,
  HIGH_EFFECT_OPENER_PATTERNS,
  LOW_EFFECT_OPENER_PATTERNS,
} from '../shared/opener-rules';
import { getContentTypeRule, CONTENT_TYPE_RULES } from '../shared/content-type-rules';

describe('opener-rules', () => {
  describe('selectRandomOpenerPattern', () => {
    it('should return a valid opener pattern for viewpoint type', () => {
      const pattern = selectRandomOpenerPattern('viewpoint');
      expect(pattern).toBeDefined();
      expect(pattern.name).toBeDefined();
      expect(pattern.effect).toBeGreaterThan(1);
      expect(pattern.examples).toBeInstanceOf(Array);
    });

    it('should return a valid opener pattern for story type', () => {
      const pattern = selectRandomOpenerPattern('story');
      expect(pattern).toBeDefined();
      expect(['時間點', '結果導向', '對話式「你」']).toContain(pattern.name);
    });

    it('should return a valid opener pattern for knowledge type', () => {
      const pattern = selectRandomOpenerPattern('knowledge');
      expect(pattern).toBeDefined();
      expect(['數字開頭', '禁忌/警告詞', '冒號斷言']).toContain(pattern.name);
    });
  });

  describe('extractMaterialKeywords', () => {
    it('should extract keywords from material', () => {
      const material = '很多人問我，為什麼學了這麼多課程，還是不知道怎麼經營自己？';
      const keywords = extractMaterialKeywords(material);
      expect(keywords).toContain('經營自己');
    });

    it('should return empty array for empty material', () => {
      const keywords = extractMaterialKeywords('');
      expect(keywords).toEqual([]);
    });

    it('should extract multiple keywords', () => {
      const material = '我在學習成長的過程中，發現時間管理和自律是最重要的';
      const keywords = extractMaterialKeywords(material);
      expect(keywords.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeOpener', () => {
    it('should identify colon assertion pattern', () => {
      const result = analyzeOpener('學習的真相：不是你不夠努力');
      expect(result.matchedHighEffect.some(p => p.name === '冒號斷言')).toBe(true);
      expect(result.score).toBeGreaterThan(1);
    });

    it('should identify warning/taboo pattern', () => {
      const result = analyzeOpener('90% 的人都搞錯了這件事');
      expect(result.matchedHighEffect.some(p => p.name === '禁忌/警告詞')).toBe(true);
    });

    it('should identify number pattern', () => {
      const result = analyzeOpener('3 個讓你學了還是不會的原因');
      expect(result.matchedHighEffect.some(p => p.name === '數字開頭')).toBe(true);
    });

    it('should identify question pattern as low effect', () => {
      const result = analyzeOpener('你有沒有想過為什麼學了很多還是不會？');
      expect(result.matchedLowEffect.some(p => p.name === '問句開頭')).toBe(true);
      expect(result.score).toBeLessThan(1);
    });

    it('should identify emoji pattern as low effect', () => {
      const result = analyzeOpener('✨ 今天想分享一個觀點');
      expect(result.matchedLowEffect.some(p => p.name === 'Emoji 開頭')).toBe(true);
    });
  });

  describe('getRecommendedOpenerPatterns', () => {
    it('should return recommended patterns for viewpoint type', () => {
      const patterns = getRecommendedOpenerPatterns('viewpoint');
      expect(patterns.length).toBeGreaterThan(0);
      const patternNames = patterns.map(p => p.name);
      expect(patternNames).toContain('冒號斷言');
    });

    it('should return recommended patterns for story type', () => {
      const patterns = getRecommendedOpenerPatterns('story');
      expect(patterns.length).toBeGreaterThan(0);
      const patternNames = patterns.map(p => p.name);
      expect(patternNames).toContain('時間點');
    });
  });
});

describe('content-type-rules', () => {
  describe('getContentTypeRule', () => {
    it('should return rule for viewpoint type', () => {
      const rule = getContentTypeRule('viewpoint');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('觀點型');
      expect(rule?.wordLimit.min).toBe(150);
      expect(rule?.wordLimit.max).toBe(200);
    });

    it('should return rule for story type', () => {
      const rule = getContentTypeRule('story');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('故事型');
      expect(rule?.wordLimit.min).toBe(300);
      expect(rule?.wordLimit.max).toBe(400);
    });

    it('should return rule for knowledge type', () => {
      const rule = getContentTypeRule('knowledge');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('知識型');
      expect(rule?.wordLimit.min).toBe(400);
      expect(rule?.wordLimit.max).toBe(500);
    });

    it('should return null for unknown type', () => {
      const rule = getContentTypeRule('unknown_type');
      expect(rule).toBeNull();
    });
  });

  describe('CONTENT_TYPE_RULES', () => {
    it('should have rules for all 11 content types', () => {
      const expectedTypes = [
        'viewpoint', 'story', 'knowledge', 'summary', 'contrast',
        'casual', 'dialogue', 'question', 'poll', 'quote', 'diagnosis'
      ];
      
      for (const type of expectedTypes) {
        const rule = CONTENT_TYPE_RULES[type];
        expect(rule).toBeDefined();
        expect(rule.wordLimit).toBeDefined();
        expect(rule.wordLimit.min).toBeGreaterThan(0);
        expect(rule.wordLimit.max).toBeGreaterThan(rule.wordLimit.min);
      }
    });
  });
});

describe('data-driven-prompt-builder', () => {
  describe('buildLayer1UniversalRules', () => {
    it('should include opener rules in the prompt', () => {
      const prompt = buildLayer1UniversalRules('viewpoint');
      expect(prompt).toContain('第一行黃金規則');
      expect(prompt).toContain('Threads 風格規則');
      expect(prompt).toContain('絕對禁止');
    });

    it('should include material keywords when provided', () => {
      const prompt = buildLayer1UniversalRules('viewpoint', '經營自己的關鍵是什麼');
      expect(prompt).toContain('素材關鍵詞');
      expect(prompt).toContain('經營自己');
    });
  });

  describe('buildLayer2ContentTypeRules', () => {
    it('should include content type specific rules', () => {
      const prompt = buildLayer2ContentTypeRules('viewpoint');
      expect(prompt).toContain('觀點型');
      expect(prompt).toContain('字數範圍');
    });

    it('should include structure template for story type', () => {
      const prompt = buildLayer2ContentTypeRules('story');
      expect(prompt).toContain('故事型');
      expect(prompt).toContain('結構模板');
    });
  });

  describe('analyzeGeneratedContent', () => {
    it('should analyze content with high effect opener', () => {
      const content = `學習的真相：不是你不夠努力

而是你用錯了方法。

很多人以為學越多越好，
其實學習的關鍵在於應用。

你有沒有過這種經驗？
學了很多，卻用不出來？`;

      const result = analyzeGeneratedContent(content, 'viewpoint');
      expect(result.openerAnalysis.matchedHighEffect).toContain('冒號斷言');
      expect(result.score).toBeGreaterThan(50);
    });

    it('should detect low effect opener', () => {
      const content = `你有沒有想過為什麼學了很多還是不會？

這是一個很多人都有的問題。`;

      const result = analyzeGeneratedContent(content, 'viewpoint');
      expect(result.openerAnalysis.matchedLowEffect).toContain('問句開頭');
      expect(result.score).toBeLessThanOrEqual(70);
    });

    it('should check word count', () => {
      const shortContent = '這是一個很短的內容。';
      const result = analyzeGeneratedContent(shortContent, 'viewpoint');
      expect(result.wordCountAnalysis.isInRange).toBe(false);
      expect(result.wordCountAnalysis.actual).toBeLessThan(result.wordCountAnalysis.expected.min);
    });

    it('should detect breathing space', () => {
      const contentWithBreathing = `第一行。

第二段。

第三段。`;

      const contentWithoutBreathing = `第一行。第二段。第三段。`;

      const result1 = analyzeGeneratedContent(contentWithBreathing, 'viewpoint');
      const result2 = analyzeGeneratedContent(contentWithoutBreathing, 'viewpoint');

      expect(result1.structureAnalysis.hasBreathingSpace).toBe(true);
      expect(result2.structureAnalysis.hasBreathingSpace).toBe(false);
    });

    it('should detect CTA', () => {
      const contentWithCTA = `這是內容。

你怎麼看？`;

      const contentWithoutCTA = `這是內容。結束了。`;

      const result1 = analyzeGeneratedContent(contentWithCTA, 'viewpoint');
      const result2 = analyzeGeneratedContent(contentWithoutCTA, 'viewpoint');

      expect(result1.structureAnalysis.hasCTA).toBe(true);
      expect(result2.structureAnalysis.hasCTA).toBe(false);
    });

    it('should detect common opener phrases (homogeneity check)', () => {
      const content = `經營自己的關鍵：就是要找到自己的定位

這是很多人都忽略的事情。`;

      const result = analyzeGeneratedContent(content, 'viewpoint');
      expect(result.homogeneityCheck.isOriginal).toBe(false);
      expect(result.homogeneityCheck.issues.length).toBeGreaterThan(0);
    });
  });

  describe('getDataDrivenSummary', () => {
    it('should return a formatted summary', () => {
      const mockContext = {
        contentType: 'viewpoint',
        material: '經營自己',
        matchedKeywords: [{ keyword: '經營自己', viralRate: 1530, avgLikes: 500 }],
        recommendedHooks: [],
        viralOpeners: [],
        fewShotExamples: [],
        materialKeywords: ['經營自己', '學習'],
        selectedOpenerPattern: HIGH_EFFECT_OPENER_PATTERNS[0],
      };

      const summary = getDataDrivenSummary(mockContext as any);
      expect(summary).toContain('數據驅動生成摘要');
      expect(summary).toContain('選用開頭模式');
      expect(summary).toContain('匹配關鍵字');
      expect(summary).toContain('素材關鍵詞');
    });
  });
});

describe('HIGH_EFFECT_OPENER_PATTERNS', () => {
  it('should have all required fields for each pattern', () => {
    for (const pattern of HIGH_EFFECT_OPENER_PATTERNS) {
      expect(pattern.name).toBeDefined();
      expect(pattern.pattern).toBeDefined();
      expect(pattern.effect).toBeGreaterThan(1);
      expect(pattern.examples.length).toBeGreaterThan(0);
      expect(pattern.instruction).toBeDefined();
    }
  });

  it('should have regex for pattern detection', () => {
    const patternsWithRegex = HIGH_EFFECT_OPENER_PATTERNS.filter(p => p.regex);
    expect(patternsWithRegex.length).toBeGreaterThan(0);
  });
});

describe('LOW_EFFECT_OPENER_PATTERNS', () => {
  it('should have effect less than 1 for all patterns', () => {
    for (const pattern of LOW_EFFECT_OPENER_PATTERNS) {
      expect(pattern.effect).toBeLessThan(1);
    }
  });
});
