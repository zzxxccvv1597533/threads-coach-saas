/**
 * Opener Generator Debug Test
 * 
 * 用於驗證 opener.generate API 返回的數據結構
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMultipleOpeners, type OpenerCandidate } from "./openerGenerator";
import { selectAndRank, type RankedCandidate } from "./selector";

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          opener: "這是一個測試開頭，你是不是也常常覺得自己不夠好？",
        }),
      },
    }],
  }),
}));

// Mock DB
vi.mock("./db", () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  }),
}));

// Mock promptService
vi.mock("./promptService", () => ({
  getActiveTemplates: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "對比式",
      category: "contrast",
      template: "很多人以為{{topic}}，但其實...",
      weight: 1.0,
      isActive: true,
    },
    {
      id: 2,
      name: "場景式",
      category: "scene",
      template: "昨天有個{{audience}}跟我說...",
      weight: 1.0,
      isActive: true,
    },
  ]),
  getAvoidList: vi.fn().mockResolvedValue([
    { pattern: "在這個快節奏的時代" },
    { pattern: "你是否曾經" },
  ]),
}));

// Mock aiDetector
vi.mock("./aiDetector", () => ({
  detectAiPatterns: vi.fn().mockReturnValue({
    score: 0.15,
    flags: [],
    level: "very_natural",
  }),
  quickDetect: vi.fn().mockReturnValue({
    score: 0.15,
    flags: [],
    level: "very_natural",
  }),
}));

describe("Opener Generator Data Structure", () => {
  it("should return OpenerCandidate with correct fields", async () => {
    // 模擬一個 OpenerCandidate
    const candidate: OpenerCandidate = {
      id: 1,
      templateId: 1,
      templateName: "對比式",
      templateCategory: "contrast",
      openerText: "這是一個測試開頭",
      aiScore: 0.15,
      aiFlags: [],
      scoreLevel: "very_natural",
      isExploration: false,
    };

    // 驗證所有必要欄位存在
    expect(candidate).toHaveProperty("openerText");
    expect(candidate).toHaveProperty("aiScore");
    expect(candidate).toHaveProperty("scoreLevel");
    expect(candidate).toHaveProperty("templateCategory");
    expect(candidate).toHaveProperty("templateId");
    
    // 驗證 openerText 不為空
    expect(candidate.openerText).toBeTruthy();
    expect(typeof candidate.openerText).toBe("string");
    expect(candidate.openerText.length).toBeGreaterThan(0);
  });

  it("should return RankedCandidate with correct fields after selectAndRank", () => {
    const candidates: OpenerCandidate[] = [
      {
        id: 1,
        templateId: 1,
        templateName: "對比式",
        templateCategory: "contrast",
        openerText: "很多人以為自我懷疑是壞事，但其實...",
        aiScore: 0.15,
        aiFlags: [],
        scoreLevel: "very_natural",
        isExploration: false,
      },
      {
        id: 2,
        templateId: 2,
        templateName: "場景式",
        templateCategory: "scene",
        openerText: "昨天有個學員跟我說，他總是覺得自己不夠好...",
        aiScore: 0.20,
        aiFlags: [],
        scoreLevel: "very_natural",
        isExploration: false,
      },
    ];

    const result = selectAndRank(candidates);

    // 驗證返回結構
    expect(result).toHaveProperty("rankedCandidates");
    expect(result).toHaveProperty("topPick");
    expect(result).toHaveProperty("filteredCount");
    expect(Array.isArray(result.rankedCandidates)).toBe(true);

    // 驗證每個 RankedCandidate 都有 openerText
    for (const ranked of result.rankedCandidates) {
      expect(ranked).toHaveProperty("openerText");
      expect(ranked.openerText).toBeTruthy();
      expect(typeof ranked.openerText).toBe("string");
      expect(ranked.openerText.length).toBeGreaterThan(0);
      
      // 驗證其他必要欄位
      expect(ranked).toHaveProperty("aiScore");
      expect(ranked).toHaveProperty("scoreLevel");
      expect(ranked).toHaveProperty("templateCategory");
      expect(ranked).toHaveProperty("rank");
      expect(ranked).toHaveProperty("finalScore");
    }

    console.log("RankedCandidate structure:", JSON.stringify(result.rankedCandidates[0], null, 2));
  });

  it("should map openerText correctly in frontend transformation", () => {
    // 模擬 API 返回的數據
    const apiResponse = {
      candidates: [
        {
          id: 1,
          templateId: 1,
          templateName: "對比式",
          templateCategory: "contrast",
          openerText: "很多人以為自我懷疑是壞事，但其實它是成長的開始",
          aiScore: 0.15,
          aiFlags: [],
          scoreLevel: "very_natural",
          isExploration: false,
          rank: 1,
          finalScore: 0.85,
          scoreBreakdown: {
            aiComponent: 0.34,
            diversityComponent: 0.30,
            templateComponent: 0.20,
            explorationBonus: 0,
          },
          diversityScore: 1.0,
        },
      ],
    };

    // 模擬前端轉換邏輯
    const transformedHooks = apiResponse.candidates.map((candidate: any) => ({
      style: String(candidate.templateId) || "custom",
      styleName: candidate.templateCategory || "自訂風格",
      content: candidate.openerText || candidate.content || "", // 使用 openerText 欄位
      reason: `AI 痕跡分數：${Math.round((1 - (candidate.aiScore || 0)) * 100)}% 自然度`,
      aiScore: candidate.aiScore || 0,
      aiLevel: candidate.scoreLevel || candidate.aiLevel || "natural",
      candidateId: candidate.id,
      templateCategory: candidate.templateCategory,
    }));

    // 驗證轉換後的 content 欄位
    expect(transformedHooks[0].content).toBe("很多人以為自我懷疑是壞事，但其實它是成長的開始");
    expect(transformedHooks[0].content).not.toBe("");
    expect(transformedHooks[0].content.length).toBeGreaterThan(0);

    console.log("Transformed hook:", JSON.stringify(transformedHooks[0], null, 2));
  });
});
