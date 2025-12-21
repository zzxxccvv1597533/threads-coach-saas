import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recalibrateScore, MAX_SCORES, DIMENSION_NAMES, HEALTH_CHECK_SYSTEM_PROMPT } from './content-health-check';

describe('Content Health Check - recalibrateScore', () => {
  describe('Hook scoring (max 30)', () => {
    it('should give 30 points for contrast opener', () => {
      const result = {
        hook: {
          hasContrastOpener: true,
          hasObservationQuestion: false,
          hasSuspense: false,
          openerType: 'contrast',
          openerContent: '朋友過世我沒感覺',
          deductionReason: '',
          advice: '',
        },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.hook).toBe(30);
    });

    it('should give 20 points for observation question opener', () => {
      const result = {
        hook: {
          hasContrastOpener: false,
          hasObservationQuestion: true,
          hasSuspense: false,
          openerType: 'observation_question',
          openerContent: '你是不是也常常這樣',
          deductionReason: '',
          advice: '',
        },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.hook).toBe(20);
    });

    it('should give 10 points for suspense only', () => {
      const result = {
        hook: {
          hasContrastOpener: false,
          hasObservationQuestion: false,
          hasSuspense: true,
          openerType: 'suspense',
          openerContent: '接下來發生的事讓我驚呆了',
          deductionReason: '',
          advice: '',
        },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.hook).toBe(10);
    });

    it('should give 0 points for no hook', () => {
      const result = {
        hook: {
          hasContrastOpener: false,
          hasObservationQuestion: false,
          hasSuspense: false,
          openerType: 'none',
          openerContent: '今天要分享一個想法',
          deductionReason: '開頭太平淡',
          advice: '建議加入反差或提問',
        },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.hook).toBe(0);
    });
  });

  describe('Tagging scoring (max 25)', () => {
    it('should give 25 points for MBTI as core topic', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: {
          hasMBTI: true,
          hasConstellation: false,
          hasMetaphysics: false,
          hasIdentityTag: false,
          detectedKeywords: ['ENTP'],
          isCoreTopic: true,
          deductionReason: '',
          advice: '',
        },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.tagging).toBe(25);
    });

    it('should give 15 points for tag mentioned but not core topic', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: {
          hasMBTI: true,
          hasConstellation: false,
          hasMetaphysics: false,
          hasIdentityTag: false,
          detectedKeywords: ['ENTP'],
          isCoreTopic: false,
          deductionReason: '只是順帶提及',
          advice: '可以更深入討論 MBTI',
        },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.tagging).toBe(15);
    });

    it('should give 0 points for no tagging', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: {
          hasMBTI: false,
          hasConstellation: false,
          hasMetaphysics: false,
          hasIdentityTag: false,
          detectedKeywords: [],
          isCoreTopic: false,
          deductionReason: '沒有流量密碼',
          advice: '建議加入 MBTI 或身分標籤',
        },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.tagging).toBe(0);
    });
  });

  describe('Translation scoring (max 25)', () => {
    it('should give 25 points for brilliant metaphor', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: {
          hasJargon: false,
          hasBrilliantMetaphor: true,
          hasSimpleExplanation: true,
          metaphorExample: '悲傷檔案下載太慢',
          jargonList: [],
          deductionReason: '',
          advice: '',
        },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.translation).toBe(25);
    });

    it('should give 20 points for simple explanation without jargon', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: {
          hasJargon: false,
          hasBrilliantMetaphor: false,
          hasSimpleExplanation: true,
          metaphorExample: '',
          jargonList: [],
          deductionReason: '',
          advice: '',
        },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.translation).toBe(20);
    });

    it('should give 5 points for jargon without explanation', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: {
          hasJargon: true,
          hasBrilliantMetaphor: false,
          hasSimpleExplanation: false,
          metaphorExample: '',
          jargonList: ['ROI', 'KPI'],
          deductionReason: '有專業術語未解釋',
          advice: '建議用比喻解釋',
        },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.translation).toBe(5);
    });
  });

  describe('Tone scoring (max 10)', () => {
    it('should give 10 points for all tone elements', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: {
          hasInterjections: true,
          hasBreathingSpace: true,
          isHumanLike: true,
          detectedInterjections: ['真的', '欸'],
          deductionReason: '',
          advice: '',
        },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.tone).toBe(10);
    });

    it('should give 7 points for breathing space and human-like without interjections', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: {
          hasInterjections: false,
          hasBreathingSpace: true,
          isHumanLike: true,
          detectedInterjections: [],
          deductionReason: '缺少語助詞',
          advice: '建議加入「真的」「欸」等語助詞',
        },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.tone).toBe(7);
    });

    it('should give 0 points for not human-like', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: {
          hasInterjections: false,
          hasBreathingSpace: false,
          isHumanLike: false,
          detectedInterjections: [],
          deductionReason: '太像 AI 寫的',
          advice: '需要更多人味',
        },
        cta: { ctaType: 'none', hasTargetAudienceCall: false, ctaContent: '', deductionReason: '', advice: '' },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.tone).toBe(0);
    });
  });

  describe('CTA scoring (max 10)', () => {
    it('should give 10 points for tribe call', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: {
          ctaType: 'tribe_call',
          hasTargetAudienceCall: true,
          ctaContent: '你們也是這樣嗎？',
          deductionReason: '',
          advice: '',
        },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.cta).toBe(10);
    });

    it('should give 10 points for binary choice', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: {
          ctaType: 'binary_choice',
          hasTargetAudienceCall: false,
          ctaContent: '你選 A 還是 B？',
          deductionReason: '',
          advice: '',
        },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.cta).toBe(10);
    });

    it('should give 5 points for open question', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: {
          ctaType: 'open_question',
          hasTargetAudienceCall: false,
          ctaContent: '你怎麼看？',
          deductionReason: '開放式問題門檻較高',
          advice: '建議改為二選一',
        },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.cta).toBe(5);
    });

    it('should give 0 points for no CTA', () => {
      const result = {
        hook: { hasContrastOpener: false, hasObservationQuestion: false, hasSuspense: false, openerType: 'none', openerContent: '', deductionReason: '', advice: '' },
        tagging: { hasMBTI: false, hasConstellation: false, hasMetaphysics: false, hasIdentityTag: false, detectedKeywords: [], isCoreTopic: false, deductionReason: '', advice: '' },
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: true, metaphorExample: '', jargonList: [], deductionReason: '', advice: '' },
        tone: { hasInterjections: false, hasBreathingSpace: true, isHumanLike: true, detectedInterjections: [], deductionReason: '', advice: '' },
        cta: {
          ctaType: 'none',
          hasTargetAudienceCall: false,
          ctaContent: '',
          deductionReason: '沒有 CTA',
          advice: '建議加入召喚同類的結尾',
        },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.cta).toBe(0);
    });
  });

  describe('Total score calculation', () => {
    it('should calculate correct total score for perfect content', () => {
      const result = {
        hook: {
          hasContrastOpener: true,
          hasObservationQuestion: false,
          hasSuspense: true,
          openerType: 'contrast',
          openerContent: '朋友過世我沒感覺',
          deductionReason: '',
          advice: '',
        },
        tagging: {
          hasMBTI: true,
          hasConstellation: false,
          hasMetaphysics: false,
          hasIdentityTag: false,
          detectedKeywords: ['ENTP'],
          isCoreTopic: true,
          deductionReason: '',
          advice: '',
        },
        translation: {
          hasJargon: false,
          hasBrilliantMetaphor: true,
          hasSimpleExplanation: true,
          metaphorExample: '悲傷檔案下載太慢',
          jargonList: [],
          deductionReason: '',
          advice: '',
        },
        tone: {
          hasInterjections: true,
          hasBreathingSpace: true,
          isHumanLike: true,
          detectedInterjections: ['真的'],
          deductionReason: '',
          advice: '',
        },
        cta: {
          ctaType: 'tribe_call',
          hasTargetAudienceCall: true,
          ctaContent: '其他 ENTP 也是這樣嗎？',
          deductionReason: '',
          advice: '',
        },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.hook).toBe(30);
      expect(calibrated.scores.tagging).toBe(25);
      expect(calibrated.scores.translation).toBe(25);
      expect(calibrated.scores.tone).toBe(10);
      expect(calibrated.scores.cta).toBe(10);
      expect(calibrated.totalScore).toBe(100);
    });

    it('should calculate correct total score for poor content', () => {
      const result = {
        hook: {
          hasContrastOpener: false,
          hasObservationQuestion: false,
          hasSuspense: false,
          openerType: 'none',
          openerContent: '今天要分享',
          deductionReason: '開頭太平淡',
          advice: '需要加入反差',
        },
        tagging: {
          hasMBTI: false,
          hasConstellation: false,
          hasMetaphysics: false,
          hasIdentityTag: false,
          detectedKeywords: [],
          isCoreTopic: false,
          deductionReason: '沒有流量密碼',
          advice: '建議加入 MBTI',
        },
        translation: {
          hasJargon: true,
          hasBrilliantMetaphor: false,
          hasSimpleExplanation: false,
          metaphorExample: '',
          jargonList: ['ROI'],
          deductionReason: '有術語未解釋',
          advice: '需要白話翻譯',
        },
        tone: {
          hasInterjections: false,
          hasBreathingSpace: false,
          isHumanLike: false,
          detectedInterjections: [],
          deductionReason: '太像 AI',
          advice: '需要更多人味',
        },
        cta: {
          ctaType: 'none',
          hasTargetAudienceCall: false,
          ctaContent: '',
          deductionReason: '沒有 CTA',
          advice: '需要加入互動',
        },
      };

      const calibrated = recalibrateScore(result);
      expect(calibrated.scores.hook).toBe(0);
      expect(calibrated.scores.tagging).toBe(0);
      expect(calibrated.scores.translation).toBe(5);
      expect(calibrated.scores.tone).toBe(0);
      expect(calibrated.scores.cta).toBe(0);
      expect(calibrated.totalScore).toBe(5);
    });
  });

  describe('Constants', () => {
    it('should have correct max scores', () => {
      expect(MAX_SCORES.hook).toBe(30);
      expect(MAX_SCORES.tagging).toBe(25);
      expect(MAX_SCORES.translation).toBe(25);
      expect(MAX_SCORES.tone).toBe(10);
      expect(MAX_SCORES.cta).toBe(10);
    });

    it('should have all dimension names', () => {
      expect(DIMENSION_NAMES.hook).toBe('Hook 鉤子強度');
      expect(DIMENSION_NAMES.tagging).toBe('Tagging 流量密碼');
      expect(DIMENSION_NAMES.translation).toBe('Translation 翻譯機');
      expect(DIMENSION_NAMES.tone).toBe('Tone 閱讀體感');
      expect(DIMENSION_NAMES.cta).toBe('CTA 互動召喚');
    });

    it('should have system prompt defined', () => {
      expect(HEALTH_CHECK_SYSTEM_PROMPT).toBeDefined();
      expect(HEALTH_CHECK_SYSTEM_PROMPT.length).toBeGreaterThan(100);
      expect(HEALTH_CHECK_SYSTEM_PROMPT).toContain('Threads');
      expect(HEALTH_CHECK_SYSTEM_PROMPT).toContain('Boolean');
    });
  });
});
