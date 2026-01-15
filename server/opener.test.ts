/**
 * Opener Generator 測試
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMultipleOpeners, type OpenerCandidate } from "./openerGenerator";
import { selectAndRank, type RankedCandidate } from "./selector";

// Mock dependencies
vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  })),
}));

vi.mock("./promptService", () => ({
  getActiveTemplates: vi.fn().mockResolvedValue([
    { id: 1, name: "對比型", category: "contrast", pattern: "你以為...其實...", weight: 1.0, isActive: true },
    { id: 2, name: "場景型", category: "scene", pattern: "那天...我發現...", weight: 1.0, isActive: true },
    { id: 3, name: "提問型", category: "question", pattern: "你有沒有想過...?", weight: 1.0, isActive: true },
  ]),
  getAvoidList: vi.fn().mockResolvedValue([
    { id: 1, pattern: "在這個快節奏的時代", severity: "high" },
  ]),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: "你以為自我懷疑是天生的？其實是這三件事沒做對。",
      },
    }],
  }),
}));

vi.mock("./aiDetector", () => ({
  detectAiPatterns: vi.fn().mockReturnValue({
    score: 0.15,
    flags: [],
    level: "natural",
  }),
  quickDetect: vi.fn().mockReturnValue({
    score: 0.15,
    flags: [],
    level: "natural",
  }),
}));

describe("OpenerCandidate 類型結構", () => {
  it("OpenerCandidate 應該包含 openerText 欄位", () => {
    const candidate: OpenerCandidate = {
      id: 1,
      templateId: 1,
      templateName: "對比型",
      templateCategory: "contrast",
      openerText: "你以為自我懷疑是天生的？其實是這三件事沒做對。",
      aiScore: 0.15,
      aiFlags: [],
      scoreLevel: "natural",
      isExploration: false,
    };

    expect(candidate.openerText).toBe("你以為自我懷疑是天生的？其實是這三件事沒做對。");
    expect(candidate.scoreLevel).toBe("natural");
    expect(candidate).not.toHaveProperty("content");
    expect(candidate).not.toHaveProperty("aiLevel");
  });
});

describe("RankedCandidate 類型結構", () => {
  it("RankedCandidate 應該繼承 OpenerCandidate 並包含排名資訊", () => {
    const candidate: OpenerCandidate = {
      id: 1,
      templateId: 1,
      templateName: "對比型",
      templateCategory: "contrast",
      openerText: "測試開頭文字",
      aiScore: 0.15,
      aiFlags: [],
      scoreLevel: "natural",
      isExploration: false,
    };

    const result = selectAndRank([candidate]);
    
    expect(result.rankedCandidates.length).toBe(1);
    const ranked = result.rankedCandidates[0];
    
    // 驗證 RankedCandidate 包含 openerText 而非 content
    expect(ranked.openerText).toBe("測試開頭文字");
    expect(ranked.scoreLevel).toBe("natural");
    expect(ranked.rank).toBe(1);
    expect(ranked.finalScore).toBeGreaterThan(0);
  });
});

describe("selectAndRank 函數", () => {
  it("應該正確排序候選並保留 openerText 欄位", () => {
    const candidates: OpenerCandidate[] = [
      {
        templateId: 1,
        templateName: "對比型",
        templateCategory: "contrast",
        openerText: "開頭一",
        aiScore: 0.3,
        aiFlags: [],
        scoreLevel: "natural",
        isExploration: false,
      },
      {
        templateId: 2,
        templateName: "場景型",
        templateCategory: "scene",
        openerText: "開頭二",
        aiScore: 0.1,
        aiFlags: [],
        scoreLevel: "very_natural",
        isExploration: false,
      },
    ];

    const result = selectAndRank(candidates);
    
    expect(result.rankedCandidates.length).toBe(2);
    // 每個候選都應該有 openerText
    result.rankedCandidates.forEach(c => {
      expect(c.openerText).toBeDefined();
      expect(c.openerText.length).toBeGreaterThan(0);
    });
  });
});
