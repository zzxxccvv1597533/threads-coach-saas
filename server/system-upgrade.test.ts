/**
 * 系統升級服務單元測試
 * 
 * 測試範圍：
 * 1. embedding.ts - 向量生成、語意檢索、MMR 多樣性重排
 * 2. userInteraction.ts - 用戶互動追蹤、偏好上下文
 * 3. promptBuilder.ts - 三種模式提示詞建構
 * 4. contentHealth.ts - AI 痕跡檢測、內容健康檢查
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mock 設定
// ============================================

// Mock 資料庫
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
  }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          embedding: Array(1536).fill(0.1),
          aiScore: 0.3,
          issues: [],
          humanizedContent: "這是人味化後的內容",
        }),
      },
    }],
  }),
}));

// ============================================
// embedding.ts 測試
// ============================================

describe("embedding.ts", () => {
  describe("cosineSimilarity", () => {
    it("應該正確計算兩個向量的餘弦相似度", async () => {
      const { cosineSimilarity } = await import("./embedding");
      
      // 相同向量應該返回 1
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1, 5);
      
      // 正交向量應該返回 0
      const vec3 = [1, 0, 0];
      const vec4 = [0, 1, 0];
      expect(cosineSimilarity(vec3, vec4)).toBeCloseTo(0, 5);
      
      // 相反向量應該返回 -1
      const vec5 = [1, 0, 0];
      const vec6 = [-1, 0, 0];
      expect(cosineSimilarity(vec5, vec6)).toBeCloseTo(-1, 5);
    });

    it("應該處理零向量的情況", async () => {
      const { cosineSimilarity } = await import("./embedding");
      
      const vec1 = [0, 0, 0];
      const vec2 = [1, 0, 0];
      expect(cosineSimilarity(vec1, vec2)).toBe(0);
    });
  });

  describe("cosineSimilarity 進階測試", () => {
    it("應該正確處理不同長度的向量", async () => {
      const { cosineSimilarity } = await import("./embedding");
      
      // 相似方向的向量
      const vec1 = [1, 1];
      const vec2 = [2, 2];
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1, 5);
    });

    it("應該正確計算部分相似的向量", async () => {
      const { cosineSimilarity } = await import("./embedding");
      
      const vec1 = [1, 0];
      const vec2 = [1, 1];
      // cos(45°) ≈ 0.707
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0.707, 2);
    });
  });
});

// ============================================
// userInteraction.ts 測試
// ============================================

describe("userInteraction.ts", () => {
  describe("buildUserPreferencePrompt", () => {
    it("應該正確建構用戶偏好提示詞", async () => {
      const { buildUserPreferencePrompt } = await import("./userInteraction");
      
      const context = {
        stage: "growing" as const,
        humanizerStrictness: "moderate" as const,
        preferredHookStyles: ["故事型", "反差型"],
        preferredContentTypes: ["分享型"],
        deletedPhrasePatterns: ["過度使用驚嘆號"],
        keptPhrasePatterns: ["具體數字"],
        adoptionRate: 0.75,
        selfEditRate: 0.5,
      };
      
      const prompt = buildUserPreferencePrompt(context);
      
      expect(prompt).toContain("故事型");
      expect(prompt).toContain("反差型");
      expect(prompt).toContain("過度使用驚嘆號");
      // 檢查提示詞包含用戶階段資訊
      expect(prompt).toContain("成長中");
    });

    it("應該處理空偏好的情況", async () => {
      const { buildUserPreferencePrompt } = await import("./userInteraction");
      
      const context = {
        stage: "new" as const,
        humanizerStrictness: "strict" as const,
        preferredHookStyles: [],
        preferredContentTypes: [],
        deletedPhrasePatterns: [],
        keptPhrasePatterns: [],
        adoptionRate: 0,
        selfEditRate: 0,
      };
      
      const prompt = buildUserPreferencePrompt(context);
      
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
    });
  });

  describe("determineGrowthStage", () => {
    it("應該根據統計數據判定用戶階段", async () => {
      const { determineGrowthStage } = await import("./userInteraction");
      
      // 新手階段：發文數 < 5
      const newStats = {
        totalPosts: 3,
        totalDrafts: 5,
        adoptionRate: 0.5,
        selfEditRate: 0.3,
        avgAiScore: 50,
        preferredHookStyles: [],
        preferredContentTypes: [],
        deletedPhrasePatterns: [],
        keptPhrasePatterns: [],
      };
      expect(determineGrowthStage(newStats)).toBe("new");
      
      // 成長階段：發文數 >= 5 但不滿足成熟條件
      const growingStats = {
        totalPosts: 15,
        totalDrafts: 30,
        adoptionRate: 0.6,
        selfEditRate: 0.4,
        avgAiScore: 40,
        preferredHookStyles: [],
        preferredContentTypes: [],
        deletedPhrasePatterns: [],
        keptPhrasePatterns: [],
      };
      expect(determineGrowthStage(growingStats)).toBe("growing");
      
      // 成熟階段：發文數 >= 20 且 自主修改率 >= 0.5 且 採納率 >= 0.3
      const matureStats = {
        totalPosts: 25,
        totalDrafts: 50,
        adoptionRate: 0.4,
        selfEditRate: 0.6,
        avgAiScore: 30,
        preferredHookStyles: [],
        preferredContentTypes: [],
        deletedPhrasePatterns: [],
        keptPhrasePatterns: [],
      };
      expect(determineGrowthStage(matureStats)).toBe("mature");
    });
  });
});

// ============================================
// promptBuilder.ts 測試
// ============================================

describe("promptBuilder.ts", () => {
  describe("buildBaseWritingRules", () => {
    it("應該包含基礎寫作規則", async () => {
      const { buildBaseWritingRules } = await import("./promptBuilder");
      
      const rules = buildBaseWritingRules();
      
      expect(rules).toContain("真實性原則");
      expect(rules).toContain("語言風格");
      expect(rules).toContain("禁止事項");
      expect(typeof rules).toBe("string");
    });
  });
});

// ============================================
// contentHealth.ts 測試
// ============================================

describe("contentHealth.ts", () => {
  describe("quickDetect", () => {
    it("應該檢測常見 AI 痕跡", async () => {
      const { quickDetect } = await import("./contentHealth");
      
      // 包含 AI 痕跡的內容
      const aiContent = "在這個快節奏的時代，讓我們一起探討一下這個問題。首先，我們需要了解背景。其次，分析原因。最後，總結一下。";
      const result1 = await quickDetect(aiContent);
      
      expect(result1.score).toBeGreaterThan(0);
      expect(result1.traces.length).toBeGreaterThan(0);
      
      // 自然的內容
      const naturalContent = "昨天我去咖啡廳，遇到一個老朋友。我們聊了很久。";
      const result2 = await quickDetect(naturalContent);
      
      expect(result2.score).toBeLessThan(result1.score);
    });

    it("應該檢測過度使用的結構", async () => {
      const { quickDetect } = await import("./contentHealth");
      
      const content = "首先，我要說明一下。其次，這很重要。最後，總結一下。";
      const result = await quickDetect(content);
      
      expect(result.traces.some(t => t.type === "ai_structure")).toBe(true);
    });
  });

  describe("getHumanizerConfigByStrictness", () => {
    it("應該根據嚴格度返回不同配置", async () => {
      const { getHumanizerConfigByStrictness } = await import("./contentHealth");
      
      const strictConfig = getHumanizerConfigByStrictness("strict");
      const relaxedConfig = getHumanizerConfigByStrictness("relaxed");
      
      // 嚴格模式應該有更低的 AI 痕跡閾值
      expect(strictConfig.thresholds.aiTraceScore).toBeLessThan(relaxedConfig.thresholds.aiTraceScore);
      // 嚴格模式應該有更多的規則
      expect(strictConfig.rules.length).toBeGreaterThanOrEqual(relaxedConfig.rules.length);
    });

    it("應該返回正確的配置結構", async () => {
      const { getHumanizerConfigByStrictness } = await import("./contentHealth");
      
      const config = getHumanizerConfigByStrictness("moderate");
      
      expect(config).toHaveProperty("strictness");
      expect(config).toHaveProperty("rules");
      expect(config).toHaveProperty("thresholds");
      expect(config.strictness).toBe("moderate");
      expect(Array.isArray(config.rules)).toBe(true);
    });
  });
});

// ============================================
// 整合測試
// ============================================

describe("整合測試", () => {
  it("應該能夠完成完整的內容生成流程", async () => {
    // 這個測試驗證各服務之間的整合
    const { quickDetect, getHumanizerConfigByStrictness } = await import("./contentHealth");
    const { buildUserPreferencePrompt, determineGrowthStage } = await import("./userInteraction");
    const { cosineSimilarity } = await import("./embedding");
    const { buildBaseWritingRules } = await import("./promptBuilder");
    
    // 1. 判定用戶階段
    const stats = {
      totalPosts: 10,
      totalDrafts: 20,
      adoptionRate: 0.6,
      selfEditRate: 0.4,
      avgAiScore: 40,
      preferredHookStyles: [],
      preferredContentTypes: [],
      deletedPhrasePatterns: [],
      keptPhrasePatterns: [],
    };
    const stage = determineGrowthStage(stats);
    expect(["new", "growing", "mature"]).toContain(stage);
    
    // 2. 獲取 Humanizer 配置
    const config = getHumanizerConfigByStrictness("moderate");
    expect(config).toBeDefined();
    expect(config.thresholds.aiTraceScore).toBeDefined();
    
    // 3. 建構用戶偏好提示詞
    const preferencePrompt = buildUserPreferencePrompt({
      stage: "growing" as const,
      humanizerStrictness: "moderate" as const,
      preferredHookStyles: ["故事型"],
      preferredContentTypes: [],
      deletedPhrasePatterns: [],
      keptPhrasePatterns: [],
      adoptionRate: 0.6,
      selfEditRate: 0.4,
    });
    expect(preferencePrompt).toBeDefined();
    
    // 4. 檢測內容健康度
    const content = "這是一段測試內容。";
    const healthResult = await quickDetect(content);
    expect(healthResult.score).toBeDefined();
    
    // 5. 計算相似度
    const similarity = cosineSimilarity([1, 0], [0.5, 0.5]);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
    
    // 6. 建構基礎寫作規則
    const rules = buildBaseWritingRules();
    expect(rules).toContain("真實性原則");
  });
});
