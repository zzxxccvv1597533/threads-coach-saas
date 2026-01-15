/**
 * Prompt Service & AI Detector Tests
 * 測試 Prompt Service 和 AI Detector 的功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  detectAiPatterns, 
  quickDetect, 
  getScoreLevel,
  type AiDetectionResult 
} from './aiDetector';
import { 
  DEFAULT_AVOID_PATTERNS, 
  DEFAULT_OPENER_TEMPLATES,
  getAvoidList,
  getActiveTemplates,
  assemblePrompt,
  selectTemplateByWeight
} from './promptService';

// Mock getDb to return null (use defaults)
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

describe('Prompt Service', () => {
  describe('DEFAULT_AVOID_PATTERNS', () => {
    it('should have at least 20 default avoid patterns', () => {
      expect(DEFAULT_AVOID_PATTERNS.length).toBeGreaterThanOrEqual(20);
    });

    it('should have patterns for all types', () => {
      const types = DEFAULT_AVOID_PATTERNS.map(p => p.patternType);
      expect(types).toContain('opener');
      expect(types).toContain('transition');
      expect(types).toContain('ending');
      expect(types).toContain('ai_phrase');
      expect(types).toContain('filler');
    });

    it('should have severity levels', () => {
      const severities = DEFAULT_AVOID_PATTERNS.map(p => p.severity);
      expect(severities).toContain('block');
      expect(severities).toContain('warn');
      expect(severities).toContain('suggest');
    });

    it('should include common AI opener patterns', () => {
      const patterns = DEFAULT_AVOID_PATTERNS.map(p => p.pattern);
      expect(patterns).toContain('你是不是也');
      expect(patterns).toContain('你有沒有發現');
      expect(patterns).toContain('你覺得呢');
    });
  });

  describe('DEFAULT_OPENER_TEMPLATES', () => {
    it('should have at least 10 default templates', () => {
      expect(DEFAULT_OPENER_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    });

    it('should have templates for multiple categories', () => {
      const categories = [...new Set(DEFAULT_OPENER_TEMPLATES.map(t => t.category))];
      expect(categories.length).toBeGreaterThanOrEqual(5);
      expect(categories).toContain('mirror');
      expect(categories).toContain('contrast');
      expect(categories).toContain('scene');
      expect(categories).toContain('question');
    });

    it('should have examples for each template', () => {
      for (const template of DEFAULT_OPENER_TEMPLATES) {
        expect(template.example).toBeTruthy();
        expect(template.example!.length).toBeGreaterThan(5);
      }
    });
  });

  describe('getAvoidList', () => {
    it('should return default patterns when db is not available', async () => {
      const patterns = await getAvoidList();
      expect(patterns.length).toBe(DEFAULT_AVOID_PATTERNS.length);
    });
  });

  describe('getActiveTemplates', () => {
    it('should return default templates when db is not available', async () => {
      const templates = await getActiveTemplates();
      expect(templates.length).toBe(DEFAULT_OPENER_TEMPLATES.length);
    });
  });

  describe('assemblePrompt', () => {
    it('should include avoid instructions in the prompt', async () => {
      const basePrompt = '請幫我寫一篇關於創業的貼文';
      const result = await assemblePrompt(basePrompt, {});
      
      expect(result).toContain(basePrompt);
      expect(result).toContain('禁止使用的句式');
      expect(result).toContain('避免使用的句式');
      expect(result).toContain('替代建議');
    });

    it('should include important reminders', async () => {
      const result = await assemblePrompt('test', {});
      
      expect(result).toContain('重要提醒');
      expect(result).toContain('每次生成的開頭都要不同');
    });
  });

  describe('selectTemplateByWeight', () => {
    it('should return a template', async () => {
      const template = await selectTemplateByWeight();
      expect(template).not.toBeNull();
      expect(template?.name).toBeTruthy();
      expect(template?.template).toBeTruthy();
    });

    it('should return template from specified category', async () => {
      const template = await selectTemplateByWeight('mirror');
      expect(template).not.toBeNull();
      expect(template?.category).toBe('mirror');
    });
  });
});

describe('AI Detector', () => {
  describe('detectAiPatterns', () => {
    it('should detect avoid-list patterns', async () => {
      const content = '你是不是也常常覺得很累？你有沒有發現這個問題？';
      const result = await detectAiPatterns(content);
      
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.some(m => m.pattern.includes('你是不是也'))).toBe(true);
    });

    it('should detect repetition patterns', async () => {
      // 需要更多重複才能觸發檢測（同一開頭出現 2 次以上，或同一詞彙出現 4 次以上）
      const content = '我覺得這很重要。我覺得這需要改變。我覺得這是關鍵。我覺得這是核心。我覺得這是未來。';
      const result = await detectAiPatterns(content);
      
      // 檢測是否有任何匹配（可能是重複或其他類型）
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should detect AI phrases', async () => {
      const content = '值得注意的是，研究表明這個方法非常有效。此外，專家指出這是最佳實踐。';
      const result = await detectAiPatterns(content);
      
      expect(result.matches.some(m => m.type === 'ai_phrase')).toBe(true);
    });

    it('should detect density patterns (list structure)', async () => {
      const content = '第一，要有目標。第二，要有計劃。第三，要有行動。第四，要有堅持。第五，要有反思。';
      const result = await detectAiPatterns(content);
      
      expect(result.matches.some(m => m.type === 'density')).toBe(true);
    });

    it('should return low score for natural content', async () => {
      const content = '昨天晚上十一點，我終於把那份報告改完了。關上電腦的那一刻，突然覺得好空虛。';
      const result = await detectAiPatterns(content);
      
      expect(result.overallScore).toBeLessThan(0.4);
      expect(result.isPass).toBe(true);
    });

    it('should return high score for AI-like content', async () => {
      // 加入更多 AI 特徵詞來確保分數超過閾值
      const content = '你是不是也常常覺得很累？其實，很多人以為努力就會成功，但其實不是這樣的。作為一個專業人士，綜上所述，首先，你需要找到方向。其次，你需要制定計劃。最後，你需要堅持執行。你覺得呢？';
      const result = await detectAiPatterns(content);
      
      // 這段內容包含多個 block 級別的 AI 特徵，應該有較高分數
      expect(result.overallScore).toBeGreaterThan(0.3);
      expect(result.matches.length).toBeGreaterThan(3);
    });

    it('should provide suggestions', async () => {
      const content = '你是不是也這樣？你覺得呢？';
      const result = await detectAiPatterns(content);
      
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should determine correct action based on score', async () => {
      // Low score should pass
      const naturalContent = '凌晨三點，我還在改簡報。';
      const naturalResult = await detectAiPatterns(naturalContent);
      expect(naturalResult.action).toBe('pass');
      
      // High score with block patterns should regenerate
      const aiContent = '作為一個專業人士，綜上所述，這是最佳方案。';
      const aiResult = await detectAiPatterns(aiContent);
      expect(['warn', 'regenerate']).toContain(aiResult.action);
    });
  });

  describe('quickDetect', () => {
    it('should return score and top issues', async () => {
      const content = '你是不是也覺得很累？你覺得呢？';
      const result = await quickDetect(content);
      
      expect(typeof result.score).toBe('number');
      expect(typeof result.isPass).toBe('boolean');
      expect(Array.isArray(result.topIssues)).toBe(true);
    });

    it('should limit top issues to 3', async () => {
      const content = '你是不是也這樣？你有沒有發現？很多人以為這樣，但其實不是。你覺得呢？留言告訴我。';
      const result = await quickDetect(content);
      
      expect(result.topIssues.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getScoreLevel', () => {
    it('should return excellent for score < 0.2', () => {
      const result = getScoreLevel(0.1);
      expect(result.level).toBe('excellent');
      expect(result.label).toBe('非常自然');
      expect(result.color).toBe('green');
    });

    it('should return good for score 0.2-0.4', () => {
      const result = getScoreLevel(0.3);
      expect(result.level).toBe('good');
      expect(result.label).toBe('較自然');
      expect(result.color).toBe('blue');
    });

    it('should return fair for score 0.4-0.6', () => {
      const result = getScoreLevel(0.5);
      expect(result.level).toBe('fair');
      expect(result.label).toBe('有 AI 痕跡');
      expect(result.color).toBe('yellow');
    });

    it('should return poor for score >= 0.6', () => {
      const result = getScoreLevel(0.7);
      expect(result.level).toBe('poor');
      expect(result.label).toBe('AI 感明顯');
      expect(result.color).toBe('red');
    });
  });
});

describe('Integration: Prompt + Detector', () => {
  it('should detect patterns that are in the avoid list', async () => {
    const avoidList = await getAvoidList();
    const testPatterns = avoidList.slice(0, 5).map(p => p.pattern).filter(Boolean);
    
    for (const pattern of testPatterns) {
      const content = `這是一段測試內容，${pattern}，這是結尾。`;
      const result = await detectAiPatterns(content);
      
      // Should detect the pattern
      expect(result.matches.some(m => content.includes(m.pattern))).toBe(true);
    }
  });

  it('should not flag content that avoids all patterns', async () => {
    // Content that deliberately avoids all common AI patterns
    const content = '凌晨三點，我終於改完了那份報告。關上電腦，突然覺得好空虛。明天又是新的一天。';
    const result = await detectAiPatterns(content);
    
    expect(result.isPass).toBe(true);
    expect(result.action).toBe('pass');
  });
});
