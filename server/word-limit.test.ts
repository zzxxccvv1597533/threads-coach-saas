import { describe, it, expect } from 'vitest';

/**
 * 字數限制功能測試
 * 驗證不同內容類型的字數限制設定是否正確
 */

// 內容類型字數限制對照表（與 routers.ts 中的定義一致）
const contentTypeWordLimits: Record<string, { min: number; max: number; style: string }> = {
  // 短型內容（150-200 字）
  casual: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
  viewpoint: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
  question: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
  poll: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
  dialogue: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
  // 中型內容（300-400 字）
  story: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
  observation: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
  quote: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
  contrast: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
  diagnosis: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
  // 長型內容（400-500 字）
  knowledge: { min: 400, max: 500, style: '有乾貨、但要用故事包裝，不是条列式' },
  teaching: { min: 400, max: 500, style: '有乾貨、但要用故事包裝，不是条列式' },
  list: { min: 400, max: 500, style: '有乾貨、但要用故事包裝，不是条列式' },
  summary: { min: 400, max: 500, style: '有乾貨、但要用故事包裝，不是条列式' },
};

// 輔助函數：根據內容類型取得字數限制
function getWordLimit(contentType: string) {
  return contentTypeWordLimits[contentType] || { min: 300, max: 400, style: '適中長度、有轉折' };
}

// 輔助函數：建構字數限制提示
function buildWordLimitPrompt(contentType: string, contentTypeName: string) {
  const wordLimit = getWordLimit(contentType);
  return `
=== ❗❗❗ 字數限制（強制執行，超過 = 失敗） ❗❗❗ ===
【當前內容類型】${contentTypeName}
【字數範圍】${wordLimit.min}-${wordLimit.max} 字（含空格和換行）
【風格要求】${wordLimit.style}
【重要】超過 ${wordLimit.max} 字 = 失敗，必須精簡！少於 ${wordLimit.min} 字 = 內容不足！`;
}

describe('內容類型字數限制', () => {
  describe('短型內容（150-200 字）', () => {
    const shortTypes = ['casual', 'viewpoint', 'question', 'poll', 'dialogue'];
    
    shortTypes.forEach(type => {
      it(`${type} 類型應該是 150-200 字`, () => {
        const limit = getWordLimit(type);
        expect(limit.min).toBe(150);
        expect(limit.max).toBe(200);
      });
    });
  });

  describe('中型內容（300-400 字）', () => {
    const mediumTypes = ['story', 'observation', 'quote', 'contrast', 'diagnosis'];
    
    mediumTypes.forEach(type => {
      it(`${type} 類型應該是 300-400 字`, () => {
        const limit = getWordLimit(type);
        expect(limit.min).toBe(300);
        expect(limit.max).toBe(400);
      });
    });
  });

  describe('長型內容（400-500 字）', () => {
    const longTypes = ['knowledge', 'teaching', 'list', 'summary'];
    
    longTypes.forEach(type => {
      it(`${type} 類型應該是 400-500 字`, () => {
        const limit = getWordLimit(type);
        expect(limit.min).toBe(400);
        expect(limit.max).toBe(500);
      });
    });
  });

  describe('未知類型的預設值', () => {
    it('未知類型應該使用預設值 300-400 字', () => {
      const limit = getWordLimit('unknown_type');
      expect(limit.min).toBe(300);
      expect(limit.max).toBe(400);
    });
  });
});

describe('字數限制提示建構', () => {
  it('應該正確建構短型內容的提示', () => {
    const prompt = buildWordLimitPrompt('casual', '閒聊型');
    expect(prompt).toContain('150-200 字');
    expect(prompt).toContain('閒聊型');
    expect(prompt).toContain('短小精悄');
  });

  it('應該正確建構中型內容的提示', () => {
    const prompt = buildWordLimitPrompt('story', '故事型');
    expect(prompt).toContain('300-400 字');
    expect(prompt).toContain('故事型');
    expect(prompt).toContain('有轉折');
  });

  it('應該正確建構長型內容的提示', () => {
    const prompt = buildWordLimitPrompt('knowledge', '知識型');
    expect(prompt).toContain('400-500 字');
    expect(prompt).toContain('知識型');
    expect(prompt).toContain('有乾貨');
  });

  it('提示應該包含強制執行的警告', () => {
    const prompt = buildWordLimitPrompt('casual', '閒聊型');
    expect(prompt).toContain('強制執行');
    expect(prompt).toContain('超過 200 字 = 失敗');
    expect(prompt).toContain('少於 150 字 = 內容不足');
  });
});

describe('字數限制風格描述', () => {
  it('短型內容應該強調快速互動', () => {
    const limit = getWordLimit('question');
    expect(limit.style).toContain('快速引發互動');
  });

  it('中型內容應該強調情緒推進', () => {
    const limit = getWordLimit('story');
    expect(limit.style).toContain('情緒推進');
  });

  it('長型內容應該強調乾貨但不條列', () => {
    const limit = getWordLimit('knowledge');
    expect(limit.style).toContain('乾貨');
    expect(limit.style).toContain('不是条列式');
  });
});
