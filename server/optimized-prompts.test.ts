/**
 * 優化版提示詞系統測試
 * 
 * 測試項目：
 * 1. AI 詞彙替換功能
 * 2. CTA 選擇功能
 * 3. 貼文類型專屬結構
 * 4. 選題生成提示詞
 */

import { describe, it, expect } from "vitest";
import {
  replaceAIWords,
  selectCTA,
  POST_TYPE_STRUCTURES,
  CTA_TYPES,
  OPTIMIZED_SYSTEM_PROMPT,
  TOPIC_GENERATION_PROMPT,
  GUIDED_QUESTIONS,
  AI_WORD_REPLACEMENTS,
} from "../shared/optimized-prompts";

describe("優化版提示詞系統", () => {
  describe("AI 詞彙替換功能", () => {
    it("應該替換「此外」", () => {
      const { result } = replaceAIWords("此外，這是一個測試。");
      expect(result).not.toContain("此外");
    });

    it("應該替換「值得注意的是」", () => {
      const { result } = replaceAIWords("值得注意的是，這很重要。");
      expect(result).not.toContain("值得注意的是");
    });

    it("應該替換「至關重要」", () => {
      const { result } = replaceAIWords("這件事至關重要。");
      expect(result).not.toContain("至關重要");
    });

    it("應該替換「深入探討」", () => {
      const { result } = replaceAIWords("讓我們深入探討這個問題。");
      expect(result).not.toContain("深入探討");
    });

    it("應該替換「總而言之」", () => {
      const { result } = replaceAIWords("總而言之，這就是結論。");
      expect(result).not.toContain("總而言之");
    });

    it("應該替換「綜上所述」", () => {
      const { result } = replaceAIWords("綜上所述，我們可以得出結論。");
      expect(result).not.toContain("綜上所述");
    });

    it("應該替換「事實上」", () => {
      const { result } = replaceAIWords("事實上，這是真的。");
      expect(result).not.toContain("事實上");
    });

    it("應該替換「實際上」", () => {
      const { result } = replaceAIWords("實際上，情況並非如此。");
      expect(result).not.toContain("實際上");
    });

    it("應該替換「基本上」", () => {
      const { result } = replaceAIWords("基本上，這就是答案。");
      expect(result).not.toContain("基本上");
    });

    it("應該替換「顯而易見」", () => {
      const { result } = replaceAIWords("顯而易見，這是對的。");
      expect(result).not.toContain("顯而易見");
    });

    it("應該替換結尾禁止詞「希望對你有幫助」", () => {
      const { result } = replaceAIWords("這是我的分享，希望對你有幫助。");
      expect(result).not.toContain("希望對你有幫助");
    });

    it("應該替換成語「盆滿缽滿」", () => {
      const { result } = replaceAIWords("他賺得盆滿缽滿。");
      expect(result).not.toContain("盆滿缽滿");
    });

    it("應該返回替換記錄", () => {
      const { replacements } = replaceAIWords("此外，這至關重要。");
      expect(replacements.length).toBeGreaterThan(0);
    });

    it("沒有 AI 詞彙時應該返回原文", () => {
      const originalText = "這是一個普通的句子。";
      const { result } = replaceAIWords(originalText);
      expect(result).toBe(originalText);
    });

    it("應該處理多個 AI 詞彙", () => {
      const { result, replacements } = replaceAIWords(
        "此外，值得注意的是，這件事至關重要。總而言之，我們需要深入探討。"
      );
      expect(replacements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("CTA 選擇功能", () => {
    it("應該為故事型選擇適合的 CTA", () => {
      const cta = selectCTA("story");
      // CTA 應該是字串
      expect(typeof cta).toBe("string");
    });

    it("應該為知識型選擇適合的 CTA", () => {
      const cta = selectCTA("knowledge");
      expect(typeof cta).toBe("string");
    });

    it("應該為閒聊型選擇適合的 CTA", () => {
      const cta = selectCTA("casual");
      expect(typeof cta).toBe("string");
    });

    it("應該為觀點型選擇適合的 CTA", () => {
      const cta = selectCTA("viewpoint");
      expect(typeof cta).toBe("string");
    });

    it("未知類型應該返回預設 CTA", () => {
      const cta = selectCTA("unknown_type");
      expect(typeof cta).toBe("string");
    });
  });

  describe("貼文類型專屬結構", () => {
    it("應該包含故事型結構", () => {
      expect(POST_TYPE_STRUCTURES.story).toBeDefined();
      expect(POST_TYPE_STRUCTURES.story.name).toBe("故事型");
      expect(POST_TYPE_STRUCTURES.story.structure).toBeDefined();
      expect(POST_TYPE_STRUCTURES.story.endingStyle).toBeDefined();
      expect(POST_TYPE_STRUCTURES.story.tips).toBeDefined();
      expect(POST_TYPE_STRUCTURES.story.example).toBeDefined();
    });

    it("應該包含知識型結構", () => {
      expect(POST_TYPE_STRUCTURES.knowledge).toBeDefined();
      expect(POST_TYPE_STRUCTURES.knowledge.name).toBe("知識型");
    });

    it("應該包含閒聊型結構", () => {
      expect(POST_TYPE_STRUCTURES.casual).toBeDefined();
      expect(POST_TYPE_STRUCTURES.casual.name).toBe("閒聊型");
    });

    it("應該包含觀點型結構", () => {
      expect(POST_TYPE_STRUCTURES.viewpoint).toBeDefined();
      expect(POST_TYPE_STRUCTURES.viewpoint.name).toBe("觀點型");
    });

    it("應該包含對比型結構", () => {
      expect(POST_TYPE_STRUCTURES.contrast).toBeDefined();
      expect(POST_TYPE_STRUCTURES.contrast.name).toBe("反差型");
    });

    it("應該包含對話型結構", () => {
      expect(POST_TYPE_STRUCTURES.dialogue).toBeDefined();
      expect(POST_TYPE_STRUCTURES.dialogue.name).toBe("對話型");
    });

    it("應該包含診斷型結構", () => {
      expect(POST_TYPE_STRUCTURES.diagnosis).toBeDefined();
      expect(POST_TYPE_STRUCTURES.diagnosis.name).toBe("診斷型");
    });

    it("應該包含整理型結構", () => {
      expect(POST_TYPE_STRUCTURES.summary).toBeDefined();
      expect(POST_TYPE_STRUCTURES.summary.name).toBe("整理型");
    });

    it("應該包含金句型結構", () => {
      expect(POST_TYPE_STRUCTURES.quote).toBeDefined();
      expect(POST_TYPE_STRUCTURES.quote.name).toBe("金句型");
    });

    it("應該包含投票型結構", () => {
      expect(POST_TYPE_STRUCTURES.poll).toBeDefined();
      expect(POST_TYPE_STRUCTURES.poll.name).toBe("投票型");
    });

    it("每個類型都應該有完整的結構定義", () => {
      Object.values(POST_TYPE_STRUCTURES).forEach((type) => {
        expect(type.name).toBeDefined();
        expect(type.structure).toBeDefined();
        expect(type.endingStyle).toBeDefined();
        expect(type.tips).toBeDefined();
        expect(type.example).toBeDefined();
      });
    });
  });

  describe("CTA 類型庫", () => {
    it("應該包含問句型 CTA", () => {
      expect(CTA_TYPES.question).toBeDefined();
      expect(CTA_TYPES.question.examples.length).toBeGreaterThan(0);
    });

    it("應該包含陳述型 CTA", () => {
      expect(CTA_TYPES.statement).toBeDefined();
      expect(CTA_TYPES.statement.examples.length).toBeGreaterThan(0);
    });

    it("應該包含反思型 CTA", () => {
      expect(CTA_TYPES.reflection).toBeDefined();
      expect(CTA_TYPES.reflection.examples.length).toBeGreaterThan(0);
    });

    it("應該包含邀請型 CTA", () => {
      expect(CTA_TYPES.invitation).toBeDefined();
      expect(CTA_TYPES.invitation.examples.length).toBeGreaterThan(0);
    });

    it("應該包含無 CTA 選項", () => {
      expect(CTA_TYPES.none).toBeDefined();
    });

    it("每個 CTA 類型都應該有適用的貼文類型", () => {
      Object.values(CTA_TYPES).forEach((cta) => {
        expect(cta.suitableFor).toBeDefined();
        expect(Array.isArray(cta.suitableFor)).toBe(true);
      });
    });
  });

  describe("精簡版核心提示詞", () => {
    it("應該包含核心原則", () => {
      expect(OPTIMIZED_SYSTEM_PROMPT).toContain("像跟朋友聊天一樣說話");
    });

    it("應該包含禁止詞彙", () => {
      expect(OPTIMIZED_SYSTEM_PROMPT).toContain("禁止詞彙");
    });

    it("應該包含口語詞彙", () => {
      expect(OPTIMIZED_SYSTEM_PROMPT).toContain("口語詞彙");
    });

    it("應該包含格式指引", () => {
      expect(OPTIMIZED_SYSTEM_PROMPT).toContain("格式");
    });

    it("提示詞長度應該小於 1500 字", () => {
      expect(OPTIMIZED_SYSTEM_PROMPT.length).toBeLessThan(1500);
    });
  });

  describe("選題生成提示詞", () => {
    it("應該包含選題的定義", () => {
      expect(TOPIC_GENERATION_PROMPT).toContain("選題的定義");
    });

    it("應該包含「具體情境」的概念", () => {
      expect(TOPIC_GENERATION_PROMPT).toContain("具體情境");
    });

    it("應該包含「然後呢」的概念", () => {
      expect(TOPIC_GENERATION_PROMPT).toContain("然後呢");
    });

    it("應該包含好的選題範例", () => {
      expect(TOPIC_GENERATION_PROMPT).toContain("好的選題範例");
    });

    it("應該包含不好的選題範例", () => {
      expect(TOPIC_GENERATION_PROMPT).toContain("不好的選題");
    });
  });

  describe("問答引導問題庫", () => {
    it("應該包含故事型的問題", () => {
      expect(GUIDED_QUESTIONS.story).toBeDefined();
      expect(GUIDED_QUESTIONS.story.length).toBeGreaterThan(0);
    });

    it("應該包含知識型的問題", () => {
      expect(GUIDED_QUESTIONS.knowledge).toBeDefined();
      expect(GUIDED_QUESTIONS.knowledge.length).toBeGreaterThan(0);
    });

    it("應該包含觀點型的問題", () => {
      expect(GUIDED_QUESTIONS.viewpoint).toBeDefined();
      expect(GUIDED_QUESTIONS.viewpoint.length).toBeGreaterThan(0);
    });

    it("應該包含閒聊型的問題", () => {
      expect(GUIDED_QUESTIONS.casual).toBeDefined();
      expect(GUIDED_QUESTIONS.casual.length).toBeGreaterThan(0);
    });

    it("每種類型都應該有 2-4 個問題", () => {
      Object.values(GUIDED_QUESTIONS).forEach((questions) => {
        expect(questions.length).toBeGreaterThanOrEqual(2);
        expect(questions.length).toBeLessThanOrEqual(4);
      });
    });
  });

  describe("AI 詞彙替換表", () => {
    it("應該包含至少 30 個替換規則", () => {
      expect(AI_WORD_REPLACEMENTS.length).toBeGreaterThanOrEqual(30);
    });

    it("每個規則都應該有 find 和 replace", () => {
      AI_WORD_REPLACEMENTS.forEach((rule) => {
        expect(rule.find).toBeDefined();
        expect(rule.replace).toBeDefined();
        expect(Array.isArray(rule.replace)).toBe(true);
      });
    });

    it("每個規則的 replace 都應該有至少一個選項", () => {
      AI_WORD_REPLACEMENTS.forEach((rule) => {
        expect(rule.replace.length).toBeGreaterThan(0);
      });
    });
  });
});
