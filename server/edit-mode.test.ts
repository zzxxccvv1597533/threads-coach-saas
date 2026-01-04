import { describe, it, expect } from "vitest";

describe("Edit Mode Feature", () => {
  describe("Edit Mode Types", () => {
    it("should have three valid edit modes", () => {
      const validModes = ['light', 'preserve', 'rewrite'];
      expect(validModes).toHaveLength(3);
      expect(validModes).toContain('light');
      expect(validModes).toContain('preserve');
      expect(validModes).toContain('rewrite');
    });
  });

  describe("Edit Mode Prompt Generation", () => {
    // 模擬不同模式的 Prompt 生成邏輯
    const getModePrompt = (mode: 'light' | 'preserve' | 'rewrite'): string => {
      switch (mode) {
        case 'light':
          return '輕度優化模式：只修正錯字、調整排版，完全保留原文內容和結構';
        case 'preserve':
          return '風格保留模式：保留敘事結構和語氣，只優化表達方式';
        case 'rewrite':
          return '爆款改寫模式：完整套用爆款公式，加入 Hook、CTA 等元素';
        default:
          return '風格保留模式';
      }
    };

    it("should return light mode prompt for light mode", () => {
      const prompt = getModePrompt('light');
      expect(prompt).toContain('輕度優化');
      expect(prompt).toContain('修正錯字');
      expect(prompt).toContain('保留原文');
    });

    it("should return preserve mode prompt for preserve mode", () => {
      const prompt = getModePrompt('preserve');
      expect(prompt).toContain('風格保留');
      expect(prompt).toContain('敘事結構');
      expect(prompt).toContain('語氣');
    });

    it("should return rewrite mode prompt for rewrite mode", () => {
      const prompt = getModePrompt('rewrite');
      expect(prompt).toContain('爆款改寫');
      expect(prompt).toContain('Hook');
      expect(prompt).toContain('CTA');
    });
  });

  describe("Edit Mode Selection Logic", () => {
    // 模擬根據內容類型推薦修改模式
    const getRecommendedMode = (contentType: string): 'light' | 'preserve' | 'rewrite' => {
      const storyTypes = ['story', 'casual', 'dialogue'];
      const knowledgeTypes = ['knowledge', 'viewpoint', 'contrast'];
      
      if (storyTypes.includes(contentType)) {
        return 'preserve'; // 故事型推薦風格保留
      } else if (knowledgeTypes.includes(contentType)) {
        return 'rewrite'; // 知識型推薦爆款改寫
      }
      return 'preserve'; // 預設風格保留
    };

    it("should recommend preserve mode for story content", () => {
      expect(getRecommendedMode('story')).toBe('preserve');
      expect(getRecommendedMode('casual')).toBe('preserve');
      expect(getRecommendedMode('dialogue')).toBe('preserve');
    });

    it("should recommend rewrite mode for knowledge content", () => {
      expect(getRecommendedMode('knowledge')).toBe('rewrite');
      expect(getRecommendedMode('viewpoint')).toBe('rewrite');
      expect(getRecommendedMode('contrast')).toBe('rewrite');
    });

    it("should default to preserve mode for unknown types", () => {
      expect(getRecommendedMode('unknown')).toBe('preserve');
      expect(getRecommendedMode('')).toBe('preserve');
    });
  });

  describe("Content Preservation Rules", () => {
    // 模擬內容保留規則
    const shouldPreserveElement = (mode: string, element: string): boolean => {
      const preserveRules: Record<string, string[]> = {
        light: ['structure', 'content', 'style', 'length', 'tone'],
        preserve: ['structure', 'tone', 'narrative_flow'],
        rewrite: ['core_message', 'key_facts']
      };
      
      return preserveRules[mode]?.includes(element) ?? false;
    };

    it("should preserve all elements in light mode", () => {
      expect(shouldPreserveElement('light', 'structure')).toBe(true);
      expect(shouldPreserveElement('light', 'content')).toBe(true);
      expect(shouldPreserveElement('light', 'style')).toBe(true);
      expect(shouldPreserveElement('light', 'length')).toBe(true);
      expect(shouldPreserveElement('light', 'tone')).toBe(true);
    });

    it("should preserve structure and tone in preserve mode", () => {
      expect(shouldPreserveElement('preserve', 'structure')).toBe(true);
      expect(shouldPreserveElement('preserve', 'tone')).toBe(true);
      expect(shouldPreserveElement('preserve', 'narrative_flow')).toBe(true);
      expect(shouldPreserveElement('preserve', 'length')).toBe(false);
    });

    it("should only preserve core elements in rewrite mode", () => {
      expect(shouldPreserveElement('rewrite', 'core_message')).toBe(true);
      expect(shouldPreserveElement('rewrite', 'key_facts')).toBe(true);
      expect(shouldPreserveElement('rewrite', 'structure')).toBe(false);
      expect(shouldPreserveElement('rewrite', 'tone')).toBe(false);
    });
  });

  describe("Word Count Guidelines by Mode", () => {
    const getWordCountGuideline = (mode: string, originalLength: number): { min: number; max: number } => {
      switch (mode) {
        case 'light':
          // 輕度優化：保持原文長度 ±5%
          return {
            min: Math.floor(originalLength * 0.95),
            max: Math.ceil(originalLength * 1.05)
          };
        case 'preserve':
          // 風格保留：允許 ±20% 調整
          return {
            min: Math.floor(originalLength * 0.8),
            max: Math.ceil(originalLength * 1.2)
          };
        case 'rewrite':
          // 爆款改寫：根據最佳實踐調整
          return {
            min: 100,
            max: 400
          };
        default:
          return { min: originalLength, max: originalLength };
      }
    };

    it("should keep length within 5% for light mode", () => {
      const guideline = getWordCountGuideline('light', 200);
      expect(guideline.min).toBe(190);
      expect(guideline.max).toBe(210);
    });

    it("should allow 20% variation for preserve mode", () => {
      const guideline = getWordCountGuideline('preserve', 200);
      expect(guideline.min).toBe(160);
      expect(guideline.max).toBe(240);
    });

    it("should use optimal range for rewrite mode", () => {
      const guideline = getWordCountGuideline('rewrite', 200);
      expect(guideline.min).toBe(100);
      expect(guideline.max).toBe(400);
    });
  });
});
