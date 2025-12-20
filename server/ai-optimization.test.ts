import { describe, it, expect } from 'vitest';
import { 
  CONTENT_TYPES_WITH_VIRAL_ELEMENTS, 
  FORBIDDEN_PHRASES, 
  THREADS_STYLE_GUIDE, 
  FOUR_LENS_FRAMEWORK,
  VIRAL_POST_TYPES 
} from '../shared/knowledge-base';

describe('Knowledge Base - Viral Elements', () => {
  it('should have viral elements for all content types', () => {
    expect(CONTENT_TYPES_WITH_VIRAL_ELEMENTS).toBeDefined();
    expect(Array.isArray(CONTENT_TYPES_WITH_VIRAL_ELEMENTS)).toBe(true);
    expect(CONTENT_TYPES_WITH_VIRAL_ELEMENTS.length).toBeGreaterThan(0);
    
    // Each content type should have viralElements
    CONTENT_TYPES_WITH_VIRAL_ELEMENTS.forEach((type) => {
      expect(type.id).toBeDefined();
      expect(type.name).toBeDefined();
      expect(type.viralElements).toBeDefined();
      expect(type.viralElements.hookTips).toBeDefined();
      expect(type.viralElements.contentTips).toBeDefined();
      expect(type.viralElements.ctaTips).toBeDefined();
      expect(type.viralElements.avoidTips).toBeDefined();
    });
  });

  it('should include all 10 content types', () => {
    const expectedTypes = ['story', 'knowledge', 'summary', 'viewpoint', 'contrast', 'casual', 'dialogue', 'question', 'poll', 'quote'];
    const actualTypes = CONTENT_TYPES_WITH_VIRAL_ELEMENTS.map(t => t.id);
    
    expectedTypes.forEach(type => {
      expect(actualTypes).toContain(type);
    });
  });
});

describe('Knowledge Base - Forbidden Phrases', () => {
  it('should have forbidden phrases defined', () => {
    expect(FORBIDDEN_PHRASES).toBeDefined();
    expect(typeof FORBIDDEN_PHRASES).toBe('object');
  });

  it('should have opening forbidden phrases', () => {
    expect(FORBIDDEN_PHRASES.openingForbidden).toBeDefined();
    expect(Array.isArray(FORBIDDEN_PHRASES.openingForbidden)).toBe(true);
    expect(FORBIDDEN_PHRASES.openingForbidden).toContain('讓我們');
    expect(FORBIDDEN_PHRASES.openingForbidden).toContain('一起來');
    expect(FORBIDDEN_PHRASES.openingForbidden).toContain('今天要分享');
  });

  it('should have content forbidden phrases', () => {
    expect(FORBIDDEN_PHRASES.contentForbidden).toBeDefined();
    expect(Array.isArray(FORBIDDEN_PHRASES.contentForbidden)).toBe(true);
    expect(FORBIDDEN_PHRASES.contentForbidden).toContain('親愛的朋友們');
    expect(FORBIDDEN_PHRASES.contentForbidden).toContain('各位');
  });

  it('should have CTA forbidden phrases', () => {
    expect(FORBIDDEN_PHRASES.ctaForbidden).toBeDefined();
    expect(Array.isArray(FORBIDDEN_PHRASES.ctaForbidden)).toBe(true);
  });

  it('should have format forbidden items', () => {
    expect(FORBIDDEN_PHRASES.formatForbidden).toBeDefined();
    expect(Array.isArray(FORBIDDEN_PHRASES.formatForbidden)).toBe(true);
    expect(FORBIDDEN_PHRASES.formatForbidden).toContain('**');
    expect(FORBIDDEN_PHRASES.formatForbidden).toContain('##');
  });
});

describe('Knowledge Base - Threads Style Guide', () => {
  it('should have style guide defined', () => {
    expect(THREADS_STYLE_GUIDE).toBeDefined();
    expect(THREADS_STYLE_GUIDE.principles).toBeDefined();
    expect(Array.isArray(THREADS_STYLE_GUIDE.principles)).toBe(true);
  });

  it('should have formatting rules', () => {
    expect(THREADS_STYLE_GUIDE.formatting).toBeDefined();
    expect(THREADS_STYLE_GUIDE.formatting.paragraphLength).toBeDefined();
    expect(THREADS_STYLE_GUIDE.formatting.sentenceLength).toBeDefined();
    expect(THREADS_STYLE_GUIDE.formatting.useEmptyLines).toBe(true);
    expect(THREADS_STYLE_GUIDE.formatting.noMarkdown).toBe(true);
  });

  it('should have key principles', () => {
    const principleNames = THREADS_STYLE_GUIDE.principles.map(p => p.name);
    expect(principleNames).toContain('五年級可讀性');
    expect(principleNames).toContain('黃金開局');
    expect(principleNames).toContain('一句一行');
  });
});

describe('Knowledge Base - Four Lens Framework', () => {
  it('should have four lens framework defined as object', () => {
    expect(FOUR_LENS_FRAMEWORK).toBeDefined();
    expect(typeof FOUR_LENS_FRAMEWORK).toBe('object');
  });

  it('should include all four lenses', () => {
    expect(FOUR_LENS_FRAMEWORK.emotion).toBeDefined();
    expect(FOUR_LENS_FRAMEWORK.persona).toBeDefined();
    expect(FOUR_LENS_FRAMEWORK.structure).toBeDefined();
    expect(FOUR_LENS_FRAMEWORK.conversion).toBeDefined();
  });

  it('should have structure for each lens', () => {
    const lenses = [
      FOUR_LENS_FRAMEWORK.emotion,
      FOUR_LENS_FRAMEWORK.persona,
      FOUR_LENS_FRAMEWORK.structure,
      FOUR_LENS_FRAMEWORK.conversion
    ];
    
    lenses.forEach(lens => {
      expect(lens.name).toBeDefined();
      expect(lens.question).toBeDefined();
      expect(lens.principle).toBeDefined();
      expect(lens.checkpoints).toBeDefined();
      expect(Array.isArray(lens.checkpoints)).toBe(true);
    });
  });
});

describe('Knowledge Base - Viral Post Types', () => {
  it('should have viral post types defined', () => {
    expect(VIRAL_POST_TYPES).toBeDefined();
    expect(typeof VIRAL_POST_TYPES).toBe('object');
  });

  it('should include all four viral post types', () => {
    expect(VIRAL_POST_TYPES.list).toBeDefined();
    expect(VIRAL_POST_TYPES.story).toBeDefined();
    expect(VIRAL_POST_TYPES.reminder).toBeDefined();
    expect(VIRAL_POST_TYPES.viewpoint).toBeDefined();
  });

  it('should have structure for each viral post type', () => {
    const types = [
      VIRAL_POST_TYPES.list,
      VIRAL_POST_TYPES.story,
      VIRAL_POST_TYPES.reminder,
      VIRAL_POST_TYPES.viewpoint
    ];
    
    types.forEach(type => {
      expect(type.name).toBeDefined();
      expect(type.description).toBeDefined();
      expect(type.structure).toBeDefined();
      expect(type.hookExample).toBeDefined();
      expect(type.characteristics).toBeDefined();
      expect(Array.isArray(type.characteristics)).toBe(true);
    });
  });
});
