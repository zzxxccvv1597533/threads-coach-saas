/**
 * 自適應品質門檻服務測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  determineUserStage,
  calculateRelativeThreshold,
  calculateAdaptiveThreshold,
  calculateUserMetrics,
  calculateExampleCounts,
  getStageName,
  STAGE_CONFIGS,
  type UserMetrics,
} from './adaptiveThreshold';

// Mock feature flags
vi.mock('../infrastructure/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(true),
}));

// Mock metrics collector
vi.mock('../infrastructure/metrics-collector', () => ({
  recordUserStage: vi.fn(),
}));

describe('adaptiveThreshold', () => {
  describe('determineUserStage', () => {
    it('should return expert for users with maxEngagement >= 1000 and totalPosts >= 20', () => {
      const metrics: UserMetrics = {
        totalPosts: 25,
        avgEngagement: 500,
        maxEngagement: 1500,
      };
      expect(determineUserStage(metrics)).toBe('expert');
    });

    it('should return mature for users with avgEngagement >= 300 and totalPosts >= 10', () => {
      const metrics: UserMetrics = {
        totalPosts: 15,
        avgEngagement: 350,
        maxEngagement: 800,
      };
      expect(determineUserStage(metrics)).toBe('mature');
    });

    it('should return growing for users with avgEngagement >= 100 and totalPosts >= 5', () => {
      const metrics: UserMetrics = {
        totalPosts: 8,
        avgEngagement: 150,
        maxEngagement: 400,
      };
      expect(determineUserStage(metrics)).toBe('growing');
    });

    it('should return newbie for users with low engagement', () => {
      const metrics: UserMetrics = {
        totalPosts: 3,
        avgEngagement: 50,
        maxEngagement: 100,
      };
      expect(determineUserStage(metrics)).toBe('newbie');
    });

    it('should prioritize expert over mature when both conditions are met', () => {
      const metrics: UserMetrics = {
        totalPosts: 25,
        avgEngagement: 500,
        maxEngagement: 1500,
      };
      expect(determineUserStage(metrics)).toBe('expert');
    });
  });

  describe('calculateRelativeThreshold', () => {
    it('should return 0 for empty array', () => {
      expect(calculateRelativeThreshold([])).toBe(0);
    });

    it('should return the top 30% value', () => {
      const engagements = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      // Top 30% = 3 items, so index 2 (0-indexed) = 800
      const result = calculateRelativeThreshold(engagements);
      expect(result).toBe(800);
    });

    it('should return the highest value for small arrays', () => {
      const engagements = [50, 100];
      const result = calculateRelativeThreshold(engagements);
      expect(result).toBe(100);
    });
  });

  describe('calculateUserMetrics', () => {
    it('should return zeros for empty array', () => {
      const result = calculateUserMetrics([]);
      expect(result).toEqual({
        totalPosts: 0,
        avgEngagement: 0,
        maxEngagement: 0,
      });
    });

    it('should calculate correct metrics', () => {
      const engagements = [100, 200, 300, 400, 500];
      const result = calculateUserMetrics(engagements);
      expect(result).toEqual({
        totalPosts: 5,
        avgEngagement: 300,
        maxEngagement: 500,
      });
    });
  });

  describe('calculateAdaptiveThreshold', () => {
    it('should return the larger of relative and absolute threshold', () => {
      const metrics: UserMetrics = {
        totalPosts: 25,
        avgEngagement: 500,
        maxEngagement: 1500,
      };
      const engagements = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      
      const result = calculateAdaptiveThreshold(metrics, engagements);
      
      // Expert stage: absolute threshold = 300
      // Relative threshold (top 30%) = 800
      // Should return 800 (larger value)
      expect(result.threshold).toBe(800);
      expect(result.stage).toBe('expert');
    });

    it('should use absolute threshold when relative is lower', () => {
      const metrics: UserMetrics = {
        totalPosts: 25,
        avgEngagement: 500,
        maxEngagement: 1500,
      };
      const engagements = [100, 150, 200, 250, 280];
      
      const result = calculateAdaptiveThreshold(metrics, engagements);
      
      // Expert stage: absolute threshold = 300
      // Relative threshold (top 30%) = 250
      // Should return 300 (larger value)
      expect(result.threshold).toBe(300);
    });
  });

  describe('calculateExampleCounts', () => {
    it('should calculate correct counts for expert stage', () => {
      const result = calculateExampleCounts('expert', 10);
      // Expert: 90% user, 10% system
      expect(result.userCount).toBe(9);
      expect(result.systemCount).toBe(1);
    });

    it('should calculate correct counts for newbie stage', () => {
      const result = calculateExampleCounts('newbie', 10);
      // Newbie: 30% user, 70% system
      expect(result.userCount).toBe(3);
      expect(result.systemCount).toBe(7);
    });
  });

  describe('getStageName', () => {
    it('should return correct Chinese names', () => {
      expect(getStageName('expert')).toBe('專家級');
      expect(getStageName('mature')).toBe('成熟期');
      expect(getStageName('growing')).toBe('成長期');
      expect(getStageName('newbie')).toBe('新手期');
    });
  });

  describe('STAGE_CONFIGS', () => {
    it('should have correct absolute thresholds', () => {
      expect(STAGE_CONFIGS.expert.absoluteThreshold).toBe(300);
      expect(STAGE_CONFIGS.mature.absoluteThreshold).toBe(150);
      expect(STAGE_CONFIGS.growing.absoluteThreshold).toBe(50);
      expect(STAGE_CONFIGS.newbie.absoluteThreshold).toBe(20);
    });

    it('should have correct weights', () => {
      expect(STAGE_CONFIGS.expert.systemWeight).toBe(0.10);
      expect(STAGE_CONFIGS.expert.userWeight).toBe(0.90);
      expect(STAGE_CONFIGS.newbie.systemWeight).toBe(0.70);
      expect(STAGE_CONFIGS.newbie.userWeight).toBe(0.30);
    });
  });
});
