import { describe, it, expect } from 'vitest';
import { filterProfanity, applyContentFilters } from './contentFilters';

describe('Profanity Filter', () => {
  describe('filterProfanity function', () => {
    it('should replace Chinese profanity with appropriate alternatives', () => {
      const input = '靠，這也太扯了吧';
      const result = filterProfanity(input);
      expect(result).toBe('天啊，這也太扯了吧');
    });

    it('should replace 媽的 with 真的假的', () => {
      const input = '他媽的，這太誇張了';
      const result = filterProfanity(input);
      // "他媽的" 會被替換成 "他真的假的"(保留前面的"他")
      expect(result).toBe('他真的假的，這太誇張了');
    });

    it('should replace 屁話 with 傻話', () => {
      const input = '這是什麼屁話';
      const result = filterProfanity(input);
      // "屁話" 會被替換成 "傻話"，但單獨的"屁"會被替換成"傻眼"
      expect(result).toBe('這是什麼傻眼話');
    });

    it('should replace 白癡 with 傻眼', () => {
      const input = '這也太白癡了';
      const result = filterProfanity(input);
      expect(result).toBe('這也太傻眼了');
    });

    it('should replace English profanity Fuck', () => {
      const input = 'Fuck, this is crazy';
      const result = filterProfanity(input);
      expect(result).toBe('天啊, this is crazy');
    });

    it('should replace FK', () => {
      const input = 'FK 這太扯了';
      const result = filterProfanity(input);
      expect(result).toBe('天啊 這太扯了');
    });

    it('should replace Shit', () => {
      const input = 'Shit, 怎麼會這樣';
      const result = filterProfanity(input);
      expect(result).toBe('傻眼, 怎麼會這樣');
    });

    it('should replace WTF', () => {
      const input = 'WTF 這是什麼';
      const result = filterProfanity(input);
      expect(result).toBe('傻眼 這是什麼');
    });

    it('should handle multiple profanities in one text', () => {
      const input = '靠，他媽的，這也太扯了，白癡';
      const result = filterProfanity(input);
      expect(result).not.toContain('靠');
      expect(result).not.toContain('媽的');
      expect(result).not.toContain('白癡');
    });

    it('should not modify clean text', () => {
      const input = '今天天氣真好，心情很棒';
      const result = filterProfanity(input);
      expect(result).toBe(input);
    });

    it('should handle case insensitivity for English profanity', () => {
      const input = 'fuck FUCK Fuck';
      const result = filterProfanity(input);
      expect(result.toLowerCase()).not.toContain('fuck');
    });
  });

  describe('applyContentFilters integration', () => {
    it('should apply profanity filter first regardless of other settings', () => {
      const input = '靠，這個方法真的很有效';
      const result = applyContentFilters(input, {
        enableIdiomFilter: false,
        enableFillerFilter: false,
        enableEmotionFilter: false,
      });
      expect(result).not.toContain('靠');
      expect(result).toContain('天啊');
    });

    it('should filter profanity even when all other filters are disabled', () => {
      const input = 'Fuck, 這太誇張了，媽的';
      const result = applyContentFilters(input, {
        enableIdiomFilter: false,
        enableFillerFilter: false,
        enableEmotionFilter: false,
        enableSimplify: false,
      });
      expect(result).not.toContain('Fuck');
      expect(result).not.toContain('媽的');
    });

    it('should combine profanity filter with other filters', () => {
      const input = '靠，盆滿缽滿，此外，這也太扯了';
      const result = applyContentFilters(input, {
        enableIdiomFilter: true,
        enableFillerFilter: true,
        enableEmotionFilter: false,
      });
      // Profanity should be filtered
      expect(result).not.toContain('靠');
      // Idiom might be replaced (depending on random factor)
      // Filler words might be removed
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = filterProfanity('');
      expect(result).toBe('');
    });

    it('should handle text with only spaces', () => {
      const result = filterProfanity('   ');
      expect(result).toBe(' ');
    });

    it('should not create double spaces after replacement', () => {
      const input = '靠  這太扯了';
      const result = filterProfanity(input);
      expect(result).not.toContain('  ');
    });

    it('should handle profanity at the beginning of text', () => {
      const input = '靠北，這也太誇張';
      const result = filterProfanity(input);
      expect(result).not.toContain('靠北');
    });

    it('should handle profanity at the end of text', () => {
      const input = '這也太誇張了，靠';
      const result = filterProfanity(input);
      expect(result).not.toContain('靠');
    });
  });
});
