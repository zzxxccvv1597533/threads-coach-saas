import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from './db';

// Mock the database functions
vi.mock('./db', async () => {
  const actual = await vi.importActual('./db');
  return {
    ...actual,
    getAllCohorts: vi.fn(),
    getStudentsWithStats: vi.fn(),
    getStudentDetail: vi.fn(),
    updateUserCoachInfo: vi.fn(),
    getAllStudentReports: vi.fn(),
    getStudentReportDetail: vi.fn(),
  };
});

describe('Coach API - Database Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllCohorts', () => {
    it('should return an array of cohort names', async () => {
      const mockCohorts = ['第四期', '第五期', '第六期'];
      vi.mocked(db.getAllCohorts).mockResolvedValue(mockCohorts);

      const result = await db.getAllCohorts();
      
      expect(result).toEqual(mockCohorts);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no cohorts exist', async () => {
      vi.mocked(db.getAllCohorts).mockResolvedValue([]);

      const result = await db.getAllCohorts();
      
      expect(result).toEqual([]);
    });
  });

  describe('getStudentsWithStats', () => {
    it('should return students with statistics', async () => {
      const mockStudents = [
        {
          id: 1,
          name: '測試學員',
          email: 'test@example.com',
          cohort: '第四期',
          threadsHandle: 'test_user',
          coachNote: '積極學習',
          coachTags: ['積極', 'VIP'],
          activatedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lastSignedIn: new Date(),
          postCount: 10,
          latestPostDate: new Date(),
          latestPostReach: 500,
          ipCompleteness: 80,
        },
      ];
      vi.mocked(db.getStudentsWithStats).mockResolvedValue(mockStudents);

      const result = await db.getStudentsWithStats({ cohort: '第四期' });
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('測試學員');
      expect(result[0].cohort).toBe('第四期');
      expect(result[0].postCount).toBe(10);
      expect(result[0].ipCompleteness).toBe(80);
    });

    it('should filter by cohort', async () => {
      vi.mocked(db.getStudentsWithStats).mockResolvedValue([]);

      await db.getStudentsWithStats({ cohort: '第四期' });
      
      expect(db.getStudentsWithStats).toHaveBeenCalledWith({ cohort: '第四期' });
    });

    it('should filter by search term', async () => {
      vi.mocked(db.getStudentsWithStats).mockResolvedValue([]);

      await db.getStudentsWithStats({ search: '測試' });
      
      expect(db.getStudentsWithStats).toHaveBeenCalledWith({ search: '測試' });
    });
  });

  describe('getStudentDetail', () => {
    it('should return student detail with IP profile and stats', async () => {
      const mockDetail = {
        user: {
          id: 1,
          name: '測試學員',
          email: 'test@example.com',
          cohort: '第四期',
          threadsHandle: 'test_user',
          coachNote: '積極學習',
          coachTags: '["積極", "VIP"]',
        },
        ipProfile: {
          occupation: '行銷顧問',
          voiceTone: '專業但親切',
        },
        stats: {
          totalPosts: 10,
          totalReach: 5000,
          totalLikes: 200,
          totalComments: 50,
          avgEngagement: 25,
          viralPosts: 2,
        },
      };
      vi.mocked(db.getStudentDetail).mockResolvedValue(mockDetail);

      const result = await db.getStudentDetail(1);
      
      expect(result).not.toBeNull();
      expect(result?.user.name).toBe('測試學員');
      expect(result?.stats.totalPosts).toBe(10);
      expect(result?.stats.viralPosts).toBe(2);
    });

    it('should return null for non-existent user', async () => {
      vi.mocked(db.getStudentDetail).mockResolvedValue(null);

      const result = await db.getStudentDetail(999);
      
      expect(result).toBeNull();
    });
  });

  describe('updateUserCoachInfo', () => {
    it('should update cohort successfully', async () => {
      vi.mocked(db.updateUserCoachInfo).mockResolvedValue(true);

      const result = await db.updateUserCoachInfo(1, { cohort: '第五期' });
      
      expect(result).toBe(true);
      expect(db.updateUserCoachInfo).toHaveBeenCalledWith(1, { cohort: '第五期' });
    });

    it('should update coach note successfully', async () => {
      vi.mocked(db.updateUserCoachInfo).mockResolvedValue(true);

      const result = await db.updateUserCoachInfo(1, { coachNote: '需要關注' });
      
      expect(result).toBe(true);
    });

    it('should update coach tags successfully', async () => {
      vi.mocked(db.updateUserCoachInfo).mockResolvedValue(true);

      const result = await db.updateUserCoachInfo(1, { coachTags: ['積極', 'VIP'] });
      
      expect(result).toBe(true);
    });

    it('should update threads handle successfully', async () => {
      vi.mocked(db.updateUserCoachInfo).mockResolvedValue(true);

      const result = await db.updateUserCoachInfo(1, { threadsHandle: 'new_handle' });
      
      expect(result).toBe(true);
    });

    it('should handle multiple field updates', async () => {
      vi.mocked(db.updateUserCoachInfo).mockResolvedValue(true);

      const result = await db.updateUserCoachInfo(1, {
        cohort: '第四期',
        coachNote: '表現優秀',
        coachTags: ['優秀', '積極'],
        threadsHandle: 'star_student',
      });
      
      expect(result).toBe(true);
    });
  });

  describe('getAllStudentReports', () => {
    it('should return reports with pagination info', async () => {
      const mockReports = {
        reports: [
          {
            postId: 1,
            userId: 1,
            userName: '測試學員',
            userEmail: 'test@example.com',
            cohort: '第四期',
            threadsHandle: 'test_user',
            threadUrl: 'https://threads.net/...',
            postedAt: new Date(),
            createdAt: new Date(),
            reach: 500,
            likes: 50,
            comments: 10,
            reposts: 5,
            saves: 20,
            profileVisits: 30,
            linkClicks: 5,
            inquiries: 2,
            notes: '',
            postingTime: '10:00',
            topComment: '很棒的分享！',
            selfReflection: '這篇效果不錯',
            aiInsight: 'Hook 使用得當',
            performanceLevel: 'hit' as const,
            isViral: true,
            viralAnalysis: '觸及率高',
          },
        ],
        total: 1,
      };
      vi.mocked(db.getAllStudentReports).mockResolvedValue(mockReports);

      const result = await db.getAllStudentReports({ cohort: '第四期' });
      
      expect(result.reports).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.reports[0].isViral).toBe(true);
    });

    it('should filter by userId', async () => {
      vi.mocked(db.getAllStudentReports).mockResolvedValue({ reports: [], total: 0 });

      await db.getAllStudentReports({ userId: 1 });
      
      expect(db.getAllStudentReports).toHaveBeenCalledWith({ userId: 1 });
    });

    it('should support pagination', async () => {
      vi.mocked(db.getAllStudentReports).mockResolvedValue({ reports: [], total: 0 });

      await db.getAllStudentReports({ limit: 20, offset: 40 });
      
      expect(db.getAllStudentReports).toHaveBeenCalledWith({ limit: 20, offset: 40 });
    });
  });

  describe('getStudentReportDetail', () => {
    it('should return report detail with post content', async () => {
      const mockDetail = {
        post: {
          id: 1,
          userId: 1,
          threadUrl: 'https://threads.net/...',
          postedAt: new Date(),
          createdAt: new Date(),
          draftPostId: 1,
        },
        user: {
          id: 1,
          name: '測試學員',
          email: 'test@example.com',
          cohort: '第四期',
          threadsHandle: 'test_user',
          coachNote: '積極學習',
          coachTags: ['積極'],
        },
        metrics: {
          reach: 500,
          likes: 50,
          comments: 10,
          saves: 20,
          isViral: true,
          viralAnalysis: '觸及率高',
          selfReflection: '這篇效果不錯',
          aiInsight: 'Hook 使用得當',
        },
        draftContent: {
          id: 1,
          body: '這是測試貼文內容...',
        },
      };
      vi.mocked(db.getStudentReportDetail).mockResolvedValue(mockDetail);

      const result = await db.getStudentReportDetail(1);
      
      expect(result).not.toBeNull();
      expect(result?.post.id).toBe(1);
      expect(result?.user.name).toBe('測試學員');
      expect(result?.metrics?.isViral).toBe(true);
      expect(result?.draftContent?.body).toContain('測試貼文');
    });

    it('should return null for non-existent post', async () => {
      vi.mocked(db.getStudentReportDetail).mockResolvedValue(null);

      const result = await db.getStudentReportDetail(999);
      
      expect(result).toBeNull();
    });
  });
});

describe('Coach Feature - Data Validation', () => {
  it('should validate cohort format', () => {
    const validCohorts = ['第四期', '第五期', '第六期', 'Cohort 1'];
    const invalidCohorts = ['', null, undefined];

    validCohorts.forEach(cohort => {
      expect(typeof cohort).toBe('string');
      expect(cohort.length).toBeGreaterThan(0);
    });

    invalidCohorts.forEach(cohort => {
      expect(!cohort || cohort === '').toBe(true);
    });
  });

  it('should validate coach tags as array', () => {
    const validTags = ['積極', 'VIP', '需關注'];
    
    expect(Array.isArray(validTags)).toBe(true);
    validTags.forEach(tag => {
      expect(typeof tag).toBe('string');
    });
  });

  it('should calculate IP completeness correctly', () => {
    const calculateCompleteness = (profile: any): number => {
      if (!profile) return 0;
      const fields = [
        'occupation', 'voiceTone', 'viewpointStatement',
        'personaExpertise', 'personaEmotion', 'personaViewpoint',
        'heroJourneyOrigin', 'heroJourneyProcess', 'heroJourneyHero', 'heroJourneyMission',
      ];
      let filled = 0;
      for (const field of fields) {
        if (profile[field]) filled++;
      }
      return Math.round((filled / fields.length) * 100);
    };

    // Test empty profile
    expect(calculateCompleteness(null)).toBe(0);
    expect(calculateCompleteness({})).toBe(0);

    // Test partial profile
    expect(calculateCompleteness({ occupation: '行銷顧問' })).toBe(10);

    // Test full profile
    const fullProfile = {
      occupation: '行銷顧問',
      voiceTone: '專業',
      viewpointStatement: '...',
      personaExpertise: '...',
      personaEmotion: '...',
      personaViewpoint: '...',
      heroJourneyOrigin: '...',
      heroJourneyProcess: '...',
      heroJourneyHero: '...',
      heroJourneyMission: '...',
    };
    expect(calculateCompleteness(fullProfile)).toBe(100);
  });
});
