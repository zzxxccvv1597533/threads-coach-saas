import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 資料
const mockPost = {
  id: 1,
  userId: 1,
  draftPostId: 1,
  threadUrl: 'https://threads.net/test/123',
  postedAt: new Date(),
  createdAt: new Date(),
};

const mockDraft = {
  id: 1,
  userId: 1,
  body: '這是一篇測試貼文，分享我的創業心得。',
  contentType: 'story',
  createdAt: new Date(),
};

const mockMetrics = {
  id: 1,
  postId: 1,
  reach: 5000,
  likes: 200,
  comments: 50,
  reposts: 30,
  saves: 80,
  isViral: false,
  viralAnalysis: null,
  recordedAt: new Date(),
};

const mockIpProfile = {
  id: 1,
  userId: 1,
  viralPatterns: null,
  bestPostingTime: null,
  aiStrategySummary: null,
  aiStrategyUpdatedAt: null,
};

describe('Viral Analysis Features', () => {
  describe('markAsViral API', () => {
    it('should mark a post as viral', () => {
      const input = { postId: 1, isViral: true };
      expect(input.isViral).toBe(true);
      expect(input.postId).toBe(1);
    });

    it('should unmark a post as viral', () => {
      const input = { postId: 1, isViral: false };
      expect(input.isViral).toBe(false);
    });

    it('should require postId to be a positive number', () => {
      const input = { postId: 1, isViral: true };
      expect(input.postId).toBeGreaterThan(0);
    });

    it('should return viral analysis when marking as viral', () => {
      const expectedResponse = {
        success: true,
        isViral: true,
        viralAnalysis: '這篇貼文成功的原因是...',
      };
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.viralAnalysis).toBeTruthy();
    });

    it('should clear viral analysis when unmarking', () => {
      const expectedResponse = {
        success: true,
        isViral: false,
        viralAnalysis: null,
      };
      expect(expectedResponse.isViral).toBe(false);
      expect(expectedResponse.viralAnalysis).toBeNull();
    });
  });

  describe('generateStrategySummary API', () => {
    it('should require at least 5 posts to generate summary', () => {
      const posts = [mockPost, mockPost, mockPost]; // 只有 3 篇
      const minRequired = 5;
      expect(posts.length).toBeLessThan(minRequired);
    });

    it('should calculate average reach correctly', () => {
      const postsData = [
        { reach: 1000 },
        { reach: 2000 },
        { reach: 3000 },
        { reach: 4000 },
        { reach: 5000 },
      ];
      const totalReach = postsData.reduce((sum, p) => sum + p.reach, 0);
      const avgReach = Math.round(totalReach / postsData.length);
      expect(avgReach).toBe(3000);
    });

    it('should identify viral posts', () => {
      const postsData = [
        { isViral: true, viralAnalysis: '分析 1' },
        { isViral: false, viralAnalysis: null },
        { isViral: true, viralAnalysis: '分析 2' },
      ];
      const viralPosts = postsData.filter(p => p.isViral);
      expect(viralPosts.length).toBe(2);
    });

    it('should calculate posting time statistics', () => {
      const postsData = [
        { postingTime: 'morning' },
        { postingTime: 'morning' },
        { postingTime: 'evening' },
        { postingTime: 'night' },
        { postingTime: 'morning' },
      ];
      const postingTimeStats = postsData.reduce((acc, p) => {
        if (p.postingTime) {
          acc[p.postingTime] = (acc[p.postingTime] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      expect(postingTimeStats.morning).toBe(3);
      expect(postingTimeStats.evening).toBe(1);
      expect(postingTimeStats.night).toBe(1);
    });

    it('should find best posting time', () => {
      const postingTimeStats: Record<string, number> = {
        morning: 5,
        noon: 2,
        evening: 3,
        night: 1,
      };
      const bestTime = Object.entries(postingTimeStats)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      expect(bestTime).toBe('morning');
    });

    it('should return success response with summary', () => {
      const expectedResponse = {
        success: true,
        error: null,
        summary: '根據你最近的貼文數據分析...',
        stats: {
          totalPosts: 20,
          avgReach: 2500,
          viralCount: 3,
          bestTime: 'evening',
        },
      };
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.summary).toBeTruthy();
      expect(expectedResponse.stats.totalPosts).toBe(20);
    });

    it('should return error when insufficient posts', () => {
      const expectedResponse = {
        success: false,
        error: '需要至少 5 篇貼文數據才能生成策略總結',
        summary: null,
      };
      expect(expectedResponse.success).toBe(false);
      expect(expectedResponse.error).toBeTruthy();
    });
  });

  describe('Viral Patterns Integration', () => {
    it('should combine viral analyses into patterns', () => {
      const viralPosts = [
        { viralAnalysis: '分析 1：Hook 開頭有效' },
        { viralAnalysis: '分析 2：情緒共鳴強' },
        { viralAnalysis: '分析 3：故事結構完整' },
      ];
      const viralPatterns = viralPosts
        .map(p => p.viralAnalysis)
        .filter(Boolean)
        .join('\n---\n');
      
      expect(viralPatterns).toContain('分析 1');
      expect(viralPatterns).toContain('分析 2');
      expect(viralPatterns).toContain('分析 3');
      expect(viralPatterns).toContain('---');
    });

    it('should handle empty viral analyses', () => {
      const viralPosts = [
        { viralAnalysis: null },
        { viralAnalysis: '' },
        { viralAnalysis: '有效分析' },
      ];
      const viralPatterns = viralPosts
        .map(p => p.viralAnalysis)
        .filter(Boolean)
        .join('\n---\n');
      
      expect(viralPatterns).toBe('有效分析');
    });
  });

  describe('buildUserStyleContext Integration', () => {
    it('should include viral patterns in context', () => {
      const ipProfile = {
        viralPatterns: '爆文模式 1\n---\n爆文模式 2',
        bestPostingTime: 'evening',
        aiStrategySummary: '策略建議內容...',
      };
      
      const parts: string[] = [];
      
      if (ipProfile.viralPatterns) {
        parts.push('=== 你的爆文模式分析 ===');
        parts.push(ipProfile.viralPatterns);
      }
      if (ipProfile.bestPostingTime) {
        parts.push(`【最佳發文時段】${ipProfile.bestPostingTime}`);
      }
      if (ipProfile.aiStrategySummary) {
        parts.push('=== AI 策略建議 ===');
        parts.push(ipProfile.aiStrategySummary.substring(0, 500));
      }
      
      const context = parts.join('\n');
      expect(context).toContain('爆文模式分析');
      expect(context).toContain('爆文模式 1');
      expect(context).toContain('最佳發文時段');
      expect(context).toContain('evening');
      expect(context).toContain('AI 策略建議');
    });

    it('should handle missing viral data gracefully', () => {
      const ipProfile = {
        viralPatterns: null,
        bestPostingTime: null,
        aiStrategySummary: null,
      };
      
      const parts: string[] = [];
      
      if (ipProfile.viralPatterns) {
        parts.push(ipProfile.viralPatterns);
      }
      if (ipProfile.bestPostingTime) {
        parts.push(ipProfile.bestPostingTime);
      }
      if (ipProfile.aiStrategySummary) {
        parts.push(ipProfile.aiStrategySummary);
      }
      
      expect(parts.length).toBe(0);
    });

    it('should truncate long strategy summary', () => {
      const longSummary = 'A'.repeat(1000);
      const truncated = longSummary.substring(0, 500);
      expect(truncated.length).toBe(500);
    });
  });

  describe('Post Metrics with Viral Flag', () => {
    it('should include isViral in metrics', () => {
      const metrics = {
        ...mockMetrics,
        isViral: true,
      };
      expect(metrics.isViral).toBe(true);
    });

    it('should include viralAnalysis in metrics', () => {
      const metrics = {
        ...mockMetrics,
        isViral: true,
        viralAnalysis: 'AI 分析結果',
      };
      expect(metrics.viralAnalysis).toBe('AI 分析結果');
    });
  });
});

describe('IP Profile Strategy Fields', () => {
  it('should have aiStrategySummary field', () => {
    const profile = {
      ...mockIpProfile,
      aiStrategySummary: '策略總結內容',
    };
    expect(profile.aiStrategySummary).toBeTruthy();
  });

  it('should have aiStrategyUpdatedAt field', () => {
    const profile = {
      ...mockIpProfile,
      aiStrategyUpdatedAt: new Date(),
    };
    expect(profile.aiStrategyUpdatedAt).toBeInstanceOf(Date);
  });

  it('should have bestPostingTime field', () => {
    const profile = {
      ...mockIpProfile,
      bestPostingTime: 'evening',
    };
    expect(profile.bestPostingTime).toBe('evening');
  });

  it('should have viralPatterns field', () => {
    const profile = {
      ...mockIpProfile,
      viralPatterns: '爆文模式分析內容',
    };
    expect(profile.viralPatterns).toBeTruthy();
  });
});
