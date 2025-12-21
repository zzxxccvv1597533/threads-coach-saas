import { describe, it, expect } from 'vitest';
import { recalibrateScore, MAX_SCORES, FOUR_LENS_MAX_SCORES } from './content-health-check';

describe('Content Health Check - recalibrateScore', () => {
  // 基本結構測試
  const createMockResult = (overrides: any = {}) => ({
    hook: {
      hasContrastOpener: false,
      hasObservationQuestion: false,
      hasSuspense: false,
      openerType: 'none',
      openerContent: '',
      deductionReason: '',
      advice: '',
      ...overrides.hook,
    },
    translation: {
      hasJargon: false,
      hasBrilliantMetaphor: false,
      hasSimpleExplanation: false,
      metaphorExample: '',
      jargonList: [],
      deductionReason: '',
      advice: '',
      ...overrides.translation,
    },
    tone: {
      hasInterjections: false,
      hasBreathingSpace: false,
      isHumanLike: false,
      detectedInterjections: [],
      deductionReason: '',
      advice: '',
      ...overrides.tone,
    },
    cta: {
      ctaType: 'none',
      hasTargetAudienceCall: false,
      ctaContent: '',
      deductionReason: '',
      advice: '',
      ...overrides.cta,
    },
    fourLens: {
      emotion: {
        isDesireOriented: false,
        emotionType: '',
        deductionReason: '',
        advice: '',
        ...overrides.fourLens?.emotion,
      },
      persona: {
        isConsistent: false,
        hasPersonalTouch: false,
        deductionReason: '',
        advice: '',
        ...overrides.fourLens?.persona,
      },
      structure: {
        isEasyToAbsorb: false,
        hasLogicalFlow: false,
        deductionReason: '',
        advice: '',
        ...overrides.fourLens?.structure,
      },
      conversion: {
        hasNextStep: false,
        isActionable: false,
        deductionReason: '',
        advice: '',
        ...overrides.fourLens?.conversion,
      },
    },
  });

  describe('Hook scoring (max 25)', () => {
    it('should give 25 points for contrast opener', () => {
      const result = recalibrateScore(createMockResult({
        hook: { hasContrastOpener: true },
      }));
      expect(result.scores.hook).toBe(25);
    });

    it('should give 18 points for observation question opener', () => {
      const result = recalibrateScore(createMockResult({
        hook: { hasObservationQuestion: true },
      }));
      expect(result.scores.hook).toBe(18);
    });

    it('should give 10 points for suspense only', () => {
      const result = recalibrateScore(createMockResult({
        hook: { hasSuspense: true },
      }));
      expect(result.scores.hook).toBe(10);
    });

    it('should give 0 points for no hook', () => {
      const result = recalibrateScore(createMockResult());
      expect(result.scores.hook).toBe(0);
    });

    it('should prioritize contrast opener over others', () => {
      const result = recalibrateScore(createMockResult({
        hook: { 
          hasContrastOpener: true, 
          hasObservationQuestion: true, 
          hasSuspense: true 
        },
      }));
      expect(result.scores.hook).toBe(25);
    });
  });

  describe('Translation scoring (max 20)', () => {
    it('should give 20 points for brilliant metaphor', () => {
      const result = recalibrateScore(createMockResult({
        translation: { hasBrilliantMetaphor: true },
      }));
      expect(result.scores.translation).toBe(20);
    });

    it('should give 16 points for simple explanation without jargon', () => {
      const result = recalibrateScore(createMockResult({
        translation: { hasSimpleExplanation: true, hasJargon: false },
      }));
      expect(result.scores.translation).toBe(16);
    });

    it('should give 12 points for simple explanation with jargon', () => {
      const result = recalibrateScore(createMockResult({
        translation: { hasSimpleExplanation: true, hasJargon: true },
      }));
      expect(result.scores.translation).toBe(12);
    });

    it('should give 4 points for jargon without explanation', () => {
      const result = recalibrateScore(createMockResult({
        translation: { hasJargon: true },
      }));
      expect(result.scores.translation).toBe(4);
    });

    it('should give 12 points (base) for no jargon and no metaphor', () => {
      const result = recalibrateScore(createMockResult({
        translation: { hasJargon: false, hasBrilliantMetaphor: false, hasSimpleExplanation: false },
      }));
      expect(result.scores.translation).toBe(12);
    });
  });

  describe('Tone scoring (max 15)', () => {
    it('should give 15 points for all tone elements', () => {
      const result = recalibrateScore(createMockResult({
        tone: { hasInterjections: true, hasBreathingSpace: true, isHumanLike: true },
      }));
      expect(result.scores.tone).toBe(15);
    });

    it('should give 11 points for breathing space and human-like', () => {
      const result = recalibrateScore(createMockResult({
        tone: { hasBreathingSpace: true, isHumanLike: true },
      }));
      expect(result.scores.tone).toBe(11);
    });

    it('should give 7 points for human-like only', () => {
      const result = recalibrateScore(createMockResult({
        tone: { isHumanLike: true },
      }));
      expect(result.scores.tone).toBe(7);
    });

    it('should give 5 points for breathing space only', () => {
      const result = recalibrateScore(createMockResult({
        tone: { hasBreathingSpace: true },
      }));
      expect(result.scores.tone).toBe(5);
    });

    it('should give 0 points for no tone elements', () => {
      const result = recalibrateScore(createMockResult());
      expect(result.scores.tone).toBe(0);
    });
  });

  describe('CTA scoring (max 10)', () => {
    it('should give 10 points for tribe call', () => {
      const result = recalibrateScore(createMockResult({
        cta: { ctaType: 'tribe_call' },
      }));
      expect(result.scores.cta).toBe(10);
    });

    it('should give 10 points for binary choice', () => {
      const result = recalibrateScore(createMockResult({
        cta: { ctaType: 'binary_choice' },
      }));
      expect(result.scores.cta).toBe(10);
    });

    it('should give 5 points for open question', () => {
      const result = recalibrateScore(createMockResult({
        cta: { ctaType: 'open_question' },
      }));
      expect(result.scores.cta).toBe(5);
    });

    it('should give 0 points for lecture', () => {
      const result = recalibrateScore(createMockResult({
        cta: { ctaType: 'lecture' },
      }));
      expect(result.scores.cta).toBe(0);
    });

    it('should give 0 points for no CTA', () => {
      const result = recalibrateScore(createMockResult({
        cta: { ctaType: 'none' },
      }));
      expect(result.scores.cta).toBe(0);
    });
  });

  describe('Four Lens scoring (max 30)', () => {
    describe('Emotion lens (max 8)', () => {
      it('should give 8 points for desire-oriented', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { emotion: { isDesireOriented: true } },
        }));
        expect(result.fourLensScores.emotion).toBe(8);
      });

      it('should give 3 points for anxiety-oriented (base)', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { emotion: { isDesireOriented: false } },
        }));
        expect(result.fourLensScores.emotion).toBe(3);
      });
    });

    describe('Persona lens (max 8)', () => {
      it('should give 8 points for consistent and personal touch', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { persona: { isConsistent: true, hasPersonalTouch: true } },
        }));
        expect(result.fourLensScores.persona).toBe(8);
      });

      it('should give 5 points for consistent only', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { persona: { isConsistent: true, hasPersonalTouch: false } },
        }));
        expect(result.fourLensScores.persona).toBe(5);
      });

      it('should give 5 points for personal touch only', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { persona: { isConsistent: false, hasPersonalTouch: true } },
        }));
        expect(result.fourLensScores.persona).toBe(5);
      });

      it('should give 0 points for neither', () => {
        const result = recalibrateScore(createMockResult());
        expect(result.fourLensScores.persona).toBe(0);
      });
    });

    describe('Structure lens (max 7)', () => {
      it('should give 7 points for easy to absorb and logical flow', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { structure: { isEasyToAbsorb: true, hasLogicalFlow: true } },
        }));
        expect(result.fourLensScores.structure).toBe(7);
      });

      it('should give 4 points for easy to absorb only', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { structure: { isEasyToAbsorb: true, hasLogicalFlow: false } },
        }));
        expect(result.fourLensScores.structure).toBe(4);
      });

      it('should give 4 points for logical flow only', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { structure: { isEasyToAbsorb: false, hasLogicalFlow: true } },
        }));
        expect(result.fourLensScores.structure).toBe(4);
      });

      it('should give 0 points for neither', () => {
        const result = recalibrateScore(createMockResult());
        expect(result.fourLensScores.structure).toBe(0);
      });
    });

    describe('Conversion lens (max 7)', () => {
      it('should give 7 points for next step and actionable', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { conversion: { hasNextStep: true, isActionable: true } },
        }));
        expect(result.fourLensScores.conversion).toBe(7);
      });

      it('should give 4 points for next step only', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { conversion: { hasNextStep: true, isActionable: false } },
        }));
        expect(result.fourLensScores.conversion).toBe(4);
      });

      it('should give 4 points for actionable only', () => {
        const result = recalibrateScore(createMockResult({
          fourLens: { conversion: { hasNextStep: false, isActionable: true } },
        }));
        expect(result.fourLensScores.conversion).toBe(4);
      });

      it('should give 0 points for neither', () => {
        const result = recalibrateScore(createMockResult());
        expect(result.fourLensScores.conversion).toBe(0);
      });
    });

    it('should calculate fourLens total as sum of sub-scores', () => {
      const result = recalibrateScore(createMockResult({
        fourLens: {
          emotion: { isDesireOriented: true },
          persona: { isConsistent: true, hasPersonalTouch: true },
          structure: { isEasyToAbsorb: true, hasLogicalFlow: true },
          conversion: { hasNextStep: true, isActionable: true },
        },
      }));
      expect(result.scores.fourLens).toBe(8 + 8 + 7 + 7); // 30
      expect(result.fourLensScores.emotion).toBe(8);
      expect(result.fourLensScores.persona).toBe(8);
      expect(result.fourLensScores.structure).toBe(7);
      expect(result.fourLensScores.conversion).toBe(7);
    });
  });

  describe('Total score calculation', () => {
    it('should calculate 100 for perfect score', () => {
      const result = recalibrateScore(createMockResult({
        hook: { hasContrastOpener: true },
        translation: { hasBrilliantMetaphor: true },
        tone: { hasInterjections: true, hasBreathingSpace: true, isHumanLike: true },
        cta: { ctaType: 'tribe_call' },
        fourLens: {
          emotion: { isDesireOriented: true },
          persona: { isConsistent: true, hasPersonalTouch: true },
          structure: { isEasyToAbsorb: true, hasLogicalFlow: true },
          conversion: { hasNextStep: true, isActionable: true },
        },
      }));
      expect(result.totalScore).toBe(100);
    });

    it('should calculate minimum score correctly', () => {
      // 無任何項目時：hook=0, translation=12(基本分), tone=0, cta=0, fourLens=3(焦慮導向基本分)
      const result = recalibrateScore(createMockResult());
      expect(result.totalScore).toBe(0 + 12 + 0 + 0 + 3); // 15
    });

    it('should calculate total as sum of all dimensions', () => {
      const result = recalibrateScore(createMockResult({
        hook: { hasObservationQuestion: true }, // 18
        translation: { hasSimpleExplanation: true }, // 16
        tone: { isHumanLike: true }, // 7
        cta: { ctaType: 'open_question' }, // 5
        fourLens: {
          emotion: { isDesireOriented: true }, // 8
          persona: { isConsistent: true }, // 5
          structure: { isEasyToAbsorb: true }, // 4
          conversion: { hasNextStep: true }, // 4
        },
      }));
      expect(result.totalScore).toBe(18 + 16 + 7 + 5 + (8 + 5 + 4 + 4)); // 67
    });
  });

  describe('MAX_SCORES constants', () => {
    it('should have correct max scores for each dimension', () => {
      expect(MAX_SCORES.hook).toBe(25);
      expect(MAX_SCORES.translation).toBe(20);
      expect(MAX_SCORES.tone).toBe(15);
      expect(MAX_SCORES.cta).toBe(10);
      expect(MAX_SCORES.fourLens).toBe(30);
    });

    it('should sum to 100', () => {
      const total = Object.values(MAX_SCORES).reduce((sum, val) => sum + val, 0);
      expect(total).toBe(100);
    });
  });

  describe('FOUR_LENS_MAX_SCORES constants', () => {
    it('should have correct max scores for each sub-dimension', () => {
      expect(FOUR_LENS_MAX_SCORES.emotion).toBe(8);
      expect(FOUR_LENS_MAX_SCORES.persona).toBe(8);
      expect(FOUR_LENS_MAX_SCORES.structure).toBe(7);
      expect(FOUR_LENS_MAX_SCORES.conversion).toBe(7);
    });

    it('should sum to 30', () => {
      const total = Object.values(FOUR_LENS_MAX_SCORES).reduce((sum, val) => sum + val, 0);
      expect(total).toBe(30);
    });
  });
});
