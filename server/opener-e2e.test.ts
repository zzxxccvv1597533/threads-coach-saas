/**
 * Opener Generator 端到端測試
 * 驗證 API 返回的數據結構是否正確
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { selectAndRank, type RankedCandidate } from "./selector";
import { type OpenerCandidate } from "./openerGenerator";

describe("Opener API 返回結構驗證", () => {
  it("RankedCandidate 應該包含 openerText 欄位（不是 content）", () => {
    // 模擬 OpenerCandidate 結構
    const mockCandidate: OpenerCandidate = {
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

    const result = selectAndRank([mockCandidate]);
    
    // 驗證返回結構
    expect(result.rankedCandidates.length).toBe(1);
    const ranked = result.rankedCandidates[0];
    
    // 關鍵驗證：openerText 應該存在且有值
    expect(ranked.openerText).toBeDefined();
    expect(ranked.openerText).toBe("你以為自我懷疑是天生的？其實是這三件事沒做對。");
    
    // 驗證 scoreLevel 存在
    expect(ranked.scoreLevel).toBe("natural");
    
    // 驗證不應該有 content 欄位（這是前端映射的問題）
    expect((ranked as any).content).toBeUndefined();
  });

  it("前端映射邏輯應該正確轉換 openerText 到 content", () => {
    // 模擬 API 返回的 RankedCandidate
    const apiResponse: RankedCandidate = {
      id: 1,
      templateId: 1,
      templateName: "對比型",
      templateCategory: "contrast",
      openerText: "這是測試開頭文字",
      aiScore: 0.15,
      aiFlags: [],
      scoreLevel: "natural",
      isExploration: false,
      rank: 1,
      finalScore: 0.85,
      diversityScore: 0.7,
      scoreBreakdown: {
        aiComponent: 0.34,
        diversityComponent: 0.21,
        templateComponent: 0.2,
        explorationBonus: 0,
      },
    };

    // 模擬前端的轉換邏輯（這是 GuidedWritingFlow 中的邏輯）
    const transformedHook = {
      style: String(apiResponse.templateId) || 'custom',
      styleName: apiResponse.templateCategory || '自訂風格',
      content: apiResponse.openerText || '', // 這裡應該使用 openerText
      reason: `AI 痕跡分數：${Math.round((1 - (apiResponse.aiScore || 0)) * 100)}% 自然度`,
      aiScore: apiResponse.aiScore || 0,
      aiLevel: apiResponse.scoreLevel || 'natural', // 使用 scoreLevel
      candidateId: apiResponse.id,
      templateCategory: apiResponse.templateCategory,
    };

    // 驗證轉換後的結構
    expect(transformedHook.content).toBe("這是測試開頭文字");
    expect(transformedHook.aiLevel).toBe("natural");
    expect(transformedHook.styleName).toBe("contrast");
  });

  it("多個候選應該都正確包含 openerText", () => {
    const candidates: OpenerCandidate[] = [
      {
        templateId: 1,
        templateName: "對比型",
        templateCategory: "contrast",
        openerText: "開頭一：對比型",
        aiScore: 0.2,
        aiFlags: [],
        scoreLevel: "natural",
        isExploration: false,
      },
      {
        templateId: 2,
        templateName: "場景型",
        templateCategory: "scene",
        openerText: "開頭二：場景型",
        aiScore: 0.1,
        aiFlags: [],
        scoreLevel: "very_natural",
        isExploration: false,
      },
      {
        templateId: 3,
        templateName: "提問型",
        templateCategory: "question",
        openerText: "開頭三：提問型",
        aiScore: 0.3,
        aiFlags: [],
        scoreLevel: "natural",
        isExploration: true,
      },
    ];

    const result = selectAndRank(candidates);
    
    // 驗證所有候選都有 openerText
    expect(result.rankedCandidates.length).toBe(3);
    result.rankedCandidates.forEach((ranked, index) => {
      expect(ranked.openerText).toBeDefined();
      expect(ranked.openerText.length).toBeGreaterThan(0);
      expect(ranked.openerText).toContain("開頭");
    });
  });

  it("空的 openerText 應該被正確處理", () => {
    const candidate: OpenerCandidate = {
      templateId: 1,
      templateName: "對比型",
      templateCategory: "contrast",
      openerText: "", // 空字串
      aiScore: 0.5,
      aiFlags: [],
      scoreLevel: "has_ai_traces",
      isExploration: false,
    };

    const result = selectAndRank([candidate]);
    
    // 即使是空字串，也應該正確處理
    expect(result.rankedCandidates.length).toBe(1);
    expect(result.rankedCandidates[0].openerText).toBe("");
  });
});
