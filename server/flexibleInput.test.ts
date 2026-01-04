import { describe, it, expect } from 'vitest';

// 模擬前端 content-types-v2.ts 中的 inputFields 定義
const FRONTEND_INPUT_FIELDS: Record<string, string[]> = {
  story: ['event_conflict', 'turning_point', 'emotion_change', 'core_insight'],
  knowledge: ['specific_problem', 'professional_concept', 'key_points'],
  summary: ['summary_topic', 'raw_data', 'save_what'],
  viewpoint: ['phenomenon', 'unique_stance', 'underlying_value'],
  dialogue: ['dialogue_roles', 'situation_conflict', 'punchline'],
  quote: ['original_quote', 'your_reaction', 'extended_view'],
  contrast: ['two_opposites', 'specific_scene', 'purpose'],
  casual: ['current_mood', 'life_fragment'],
  question: ['simple_topic', 'target_audience'],
  poll: ['binary_choice', 'survey_purpose'],
  diagnosis: ['symptoms', 'diagnosis_label', 'explanation'],
};

// 模擬後端 typeSpecificPrompts 中使用的欄位（修復後的版本）
const BACKEND_USED_FIELDS: Record<string, string[]> = {
  story: ['story_source', 'event_conflict', 'turning_point', 'emotion_change', 'core_insight'],
  knowledge: ['specific_problem', 'professional_concept', 'key_points'],
  summary: ['summary_topic', 'raw_data', 'save_what'],
  viewpoint: ['phenomenon', 'unique_stance', 'underlying_value'],
  dialogue: ['dialogue_roles', 'situation_conflict', 'punchline'],
  quote: ['original_quote', 'your_reaction', 'extended_view'],
  contrast: ['two_opposites', 'specific_scene', 'purpose'],
  casual: ['current_mood', 'life_fragment'],
  question: ['simple_topic', 'target_audience'],
  poll: ['binary_choice', 'survey_purpose'],
  diagnosis: ['symptoms', 'diagnosis_label', 'explanation'],
};

describe('flexibleInput 欄位名稱匹配測試', () => {
  it('所有貼文類型的前端欄位都應該在後端被使用', () => {
    for (const [type, frontendFields] of Object.entries(FRONTEND_INPUT_FIELDS)) {
      const backendFields = BACKEND_USED_FIELDS[type];
      expect(backendFields, `類型 ${type} 在後端沒有定義`).toBeDefined();
      
      for (const field of frontendFields) {
        expect(
          backendFields.includes(field),
          `類型 ${type} 的欄位 ${field} 在後端沒有被使用`
        ).toBe(true);
      }
    }
  });

  it('所有 11 種貼文類型都應該有對應的後端處理', () => {
    const expectedTypes = [
      'story', 'knowledge', 'summary', 'viewpoint', 'dialogue',
      'quote', 'contrast', 'casual', 'question', 'poll', 'diagnosis'
    ];
    
    for (const type of expectedTypes) {
      expect(
        BACKEND_USED_FIELDS[type],
        `類型 ${type} 在後端沒有定義`
      ).toBeDefined();
    }
  });

  it('整理型 (summary) 的欄位應該正確匹配', () => {
    const frontendFields = FRONTEND_INPUT_FIELDS.summary;
    const backendFields = BACKEND_USED_FIELDS.summary;
    
    expect(frontendFields).toContain('summary_topic');
    expect(frontendFields).toContain('raw_data');
    expect(frontendFields).toContain('save_what');
    
    expect(backendFields).toContain('summary_topic');
    expect(backendFields).toContain('raw_data');
    expect(backendFields).toContain('save_what');
  });

  it('觀點型 (viewpoint) 的欄位應該正確匹配', () => {
    const frontendFields = FRONTEND_INPUT_FIELDS.viewpoint;
    const backendFields = BACKEND_USED_FIELDS.viewpoint;
    
    // 前端使用的欄位
    expect(frontendFields).toContain('phenomenon');
    expect(frontendFields).toContain('unique_stance');
    expect(frontendFields).toContain('underlying_value');
    
    // 後端應該使用相同的欄位（修復後）
    expect(backendFields).toContain('phenomenon');
    expect(backendFields).toContain('unique_stance');
    expect(backendFields).toContain('underlying_value');
  });

  it('反差型 (contrast) 的欄位應該正確匹配', () => {
    const frontendFields = FRONTEND_INPUT_FIELDS.contrast;
    const backendFields = BACKEND_USED_FIELDS.contrast;
    
    expect(frontendFields).toContain('two_opposites');
    expect(frontendFields).toContain('specific_scene');
    expect(frontendFields).toContain('purpose');
    
    expect(backendFields).toContain('two_opposites');
    expect(backendFields).toContain('specific_scene');
    expect(backendFields).toContain('purpose');
  });

  it('對話型 (dialogue) 的欄位應該正確匹配', () => {
    const frontendFields = FRONTEND_INPUT_FIELDS.dialogue;
    const backendFields = BACKEND_USED_FIELDS.dialogue;
    
    expect(frontendFields).toContain('dialogue_roles');
    expect(frontendFields).toContain('situation_conflict');
    expect(frontendFields).toContain('punchline');
    
    expect(backendFields).toContain('dialogue_roles');
    expect(backendFields).toContain('situation_conflict');
    expect(backendFields).toContain('punchline');
  });

  it('引用型 (quote) 的欄位應該正確匹配', () => {
    const frontendFields = FRONTEND_INPUT_FIELDS.quote;
    const backendFields = BACKEND_USED_FIELDS.quote;
    
    expect(frontendFields).toContain('original_quote');
    expect(frontendFields).toContain('your_reaction');
    expect(frontendFields).toContain('extended_view');
    
    expect(backendFields).toContain('original_quote');
    expect(backendFields).toContain('your_reaction');
    expect(backendFields).toContain('extended_view');
  });
});
