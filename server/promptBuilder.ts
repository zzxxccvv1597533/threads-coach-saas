/**
 * Prompt Builder 服務
 * 
 * 功能：
 * 1. buildPromptByMode - 三種模式的提示詞建構
 * 2. 整合 recommendedHooks
 * 3. 整合 userPreferenceContext
 * 4. 整合 IP 地基資料
 */

import { getRecommendedHooks } from "./embedding";
import { getUserPreferenceContext, buildUserPreferencePrompt, type UserPreferenceContext } from "./userInteraction";
import { getDb } from "./db";
import { ipProfiles, userWritingStyles, type IpProfile, type UserWritingStyle } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ============================================
// 模式定義
// ============================================

export type PromptMode = "pure_story" | "light_connect" | "full_inject";

interface PromptModeConfig {
  includeIpFoundation: boolean;
  includeViralExamples: boolean;
  includeSuccessFactors: boolean;
  includeUserStyle: boolean;
  includeUserPreference: boolean;
  humanizerLevel: "strict" | "moderate" | "relaxed";
}

const MODE_CONFIGS: Record<PromptMode, PromptModeConfig> = {
  // 純故事模式：僅寫作規則 + userStyle，無 IP/爆款
  pure_story: {
    includeIpFoundation: false,
    includeViralExamples: false,
    includeSuccessFactors: false,
    includeUserStyle: true,
    includeUserPreference: true,
    humanizerLevel: "strict",
  },
  // 輕度連結模式：IP 地基，無 few-shot viral examples
  light_connect: {
    includeIpFoundation: true,
    includeViralExamples: false,
    includeSuccessFactors: false,
    includeUserStyle: true,
    includeUserPreference: true,
    humanizerLevel: "moderate",
  },
  // 完整注入模式：IP + viral data + success factors
  full_inject: {
    includeIpFoundation: true,
    includeViralExamples: true,
    includeSuccessFactors: true,
    includeUserStyle: true,
    includeUserPreference: true,
    humanizerLevel: "moderate",
  },
};

// ============================================
// 資料獲取
// ============================================

/**
 * 獲取用戶的 IP 地基資料
 */
async function getIpFoundation(userId: number): Promise<IpProfile | null> {
  const db = await getDb();
  if (!db) return null;

  const [profile] = await db
    .select()
    .from(ipProfiles)
    .where(eq(ipProfiles.userId, userId))
    .limit(1);

  return profile || null;
}

/**
 * 獲取用戶的寫作風格
 */
async function getUserWritingStyle(userId: number): Promise<UserWritingStyle | null> {
  const db = await getDb();
  if (!db) return null;

  const [style] = await db
    .select()
    .from(userWritingStyles)
    .where(eq(userWritingStyles.userId, userId))
    .limit(1);

  return style || null;
}

// ============================================
// 提示詞建構
// ============================================

interface BuildPromptOptions {
  userId: number;
  mode: PromptMode;
  topic: string;
  contentType: string;
  audience?: string;
  additionalContext?: string;
}

interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  metadata: {
    mode: PromptMode;
    includedComponents: string[];
    recommendedHooks?: Array<{ hook: string; style: string; similarity: number }>;
  };
}

/**
 * 根據模式建構提示詞
 */
export async function buildPromptByMode(options: BuildPromptOptions): Promise<BuiltPrompt> {
  const { userId, mode, topic, contentType, audience, additionalContext } = options;
  const config = MODE_CONFIGS[mode];

  const includedComponents: string[] = [];
  const systemPromptParts: string[] = [];

  // 基礎寫作規則（所有模式都包含）
  systemPromptParts.push(buildBaseWritingRules());
  includedComponents.push("base_writing_rules");

  // 用戶寫作風格
  if (config.includeUserStyle) {
    const writingStyle = await getUserWritingStyle(userId);
    if (writingStyle) {
      systemPromptParts.push(buildUserStylePrompt(writingStyle));
      includedComponents.push("user_style");
    }
  }

  // 用戶偏好上下文
  if (config.includeUserPreference) {
    const preferenceContext = await getUserPreferenceContext(userId);
    if (preferenceContext) {
      systemPromptParts.push(buildUserPreferencePrompt(preferenceContext));
      includedComponents.push("user_preference");
    }
  }

  // IP 地基
  let ipFoundation: IpProfile | null = null;
  if (config.includeIpFoundation) {
    ipFoundation = await getIpFoundation(userId);
    if (ipFoundation) {
      systemPromptParts.push(buildIpFoundationPrompt(ipFoundation));
      includedComponents.push("ip_foundation");
    }
  }

  // 爆款範例（推薦 Hooks）
  let recommendedHooks: Array<{ hook: string; style: string; similarity: number }> | undefined;
  if (config.includeViralExamples) {
    recommendedHooks = await getRecommendedHooks(topic, 3, 0.5);
    if (recommendedHooks.length > 0) {
      systemPromptParts.push(buildViralExamplesPrompt(recommendedHooks));
      includedComponents.push("viral_examples");
    }
  }

  // 成功因素
  if (config.includeSuccessFactors && ipFoundation) {
    systemPromptParts.push(buildSuccessFactorsPrompt(ipFoundation));
    includedComponents.push("success_factors");
  }

  // Humanizer 規則
  systemPromptParts.push(buildHumanizerRules(config.humanizerLevel));
  includedComponents.push(`humanizer_${config.humanizerLevel}`);

  // 組合系統提示詞
  const systemPrompt = systemPromptParts.join("\n\n---\n\n");

  // 建構用戶提示詞
  const userPrompt = buildUserPrompt({
    topic,
    contentType,
    audience,
    additionalContext,
  });

  return {
    systemPrompt,
    userPrompt,
    metadata: {
      mode,
      includedComponents,
      recommendedHooks,
    },
  };
}

// ============================================
// 提示詞片段建構
// ============================================

/**
 * 基礎寫作規則
 */
export function buildBaseWritingRules(): string {
  return `【基礎寫作規則】

1. **真實性原則**
   - 只使用用戶明確提供的資訊
   - 禁止編造用戶沒有提到的場景、物品、人物
   - 時間、地點、人物、數字必須原封不動保留

2. **語言風格**
   - 使用口語化、自然的表達
   - 避免過於正式或學術的用語
   - 句子長度適中，避免過長的複合句

3. **結構要求**
   - 開頭要有吸引力，能引起讀者興趣
   - 中間要有故事性或觀點的展開
   - 結尾要有餘韻或行動呼籲

4. **禁止事項**
   - 禁止使用「首先」「其次」「最後」等列舉詞
   - 禁止使用「讓我們」「我們來」等說教語氣
   - 禁止使用過多的感嘆號`;
}

/**
 * 用戶寫作風格提示詞
 */
function buildUserStylePrompt(style: UserWritingStyle): string {
  const parts: string[] = ["【用戶寫作風格】"];

  if (style.toneStyle) {
    parts.push(`語氣風格：${style.toneStyle}`);
  }

  if (style.hookStylePreference) {
    parts.push(`開頭風格偏好：${style.hookStylePreference}`);
  }

  if (style.emotionRhythm) {
    parts.push(`情緒節奏：${style.emotionRhythm}`);
  }

  if (style.commonPhrases && style.commonPhrases.length > 0) {
    parts.push(`常用句式：${style.commonPhrases.join("、")}`);
  }

  if (style.catchphrases && style.catchphrases.length > 0) {
    parts.push(`口頭禪：${style.catchphrases.join("、")}`);
  }

  if (style.metaphorStyle) {
    parts.push(`比喻風格：${style.metaphorStyle}`);
  }

  return parts.join("\n");
}

/**
 * IP 地基提示詞
 */
function buildIpFoundationPrompt(ip: IpProfile): string {
  const parts: string[] = ["【IP 地基】"];

  if (ip.occupation) {
    parts.push(`職業身份：${ip.occupation}`);
  }

  if (ip.voiceTone) {
    parts.push(`說話風格：${ip.voiceTone}`);
  }

  if (ip.viewpointStatement) {
    parts.push(`核心觀點：${ip.viewpointStatement}`);
  }

  if (ip.personaExpertise) {
    parts.push(`專業領域：${ip.personaExpertise}`);
  }

  if (ip.personaEmotion) {
    parts.push(`情感特質：${ip.personaEmotion}`);
  }

  if (ip.identityTags) {
    const tags = ip.identityTags as string[];
    if (tags.length > 0) {
      parts.push(`身份標籤：${tags.join("、")}`);
    }
  }

  // 英雄旅程
  if (ip.heroJourneyOrigin || ip.heroJourneyProcess || ip.heroJourneyHero || ip.heroJourneyMission) {
    parts.push("\n【個人故事】");
    if (ip.heroJourneyOrigin) parts.push(`緣起：${ip.heroJourneyOrigin}`);
    if (ip.heroJourneyProcess) parts.push(`過程：${ip.heroJourneyProcess}`);
    if (ip.heroJourneyHero) parts.push(`轉折：${ip.heroJourneyHero}`);
    if (ip.heroJourneyMission) parts.push(`使命：${ip.heroJourneyMission}`);
  }

  return parts.join("\n");
}

/**
 * 爆款範例提示詞
 */
function buildViralExamplesPrompt(hooks: Array<{ hook: string; style: string; similarity: number }>): string {
  const parts: string[] = [
    "【參考開頭範例】",
    "以下是與主題相關的高互動開頭範例，請參考其風格和節奏，但不要直接複製：",
  ];

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];
    parts.push(`\n範例 ${i + 1}（${hook.style} 風格）：`);
    parts.push(`「${hook.hook}」`);
  }

  parts.push("\n請從中感受節奏與關鍵元素，創造屬於用戶自己的開頭。");

  return parts.join("\n");
}

/**
 * 成功因素提示詞
 */
function buildSuccessFactorsPrompt(ip: IpProfile): string {
  const parts: string[] = ["【成功因素】"];

  if (ip.bestPerformingType) {
    parts.push(`表現最好的內容類型：${ip.bestPerformingType}`);
  }

  if (ip.bestPostingTime) {
    parts.push(`最佳發文時段：${ip.bestPostingTime}`);
  }

  if (ip.viralPatterns) {
    parts.push(`爆文模式：${ip.viralPatterns}`);
  }

  if (ip.aiStrategySummary) {
    parts.push(`AI 策略建議：${ip.aiStrategySummary}`);
  }

  return parts.join("\n");
}

/**
 * Humanizer 規則
 */
function buildHumanizerRules(level: "strict" | "moderate" | "relaxed"): string {
  const baseRules = [
    "【人味化規則】",
    "",
    "**核心禁止項（所有等級適用）**",
    "- 禁止使用「在這個...的時代」開頭",
    "- 禁止使用「作為一個...」自我介紹",
    "- 禁止使用「讓我們一起...」號召語氣",
    "- 禁止使用「不得不說」「說實話」等口頭禪",
    "- 禁止使用過多的「！」（每段最多 1 個）",
  ];

  const strictRules = [
    "",
    "**嚴格模式額外規則**",
    "- 禁止使用「其實」「事實上」「說白了」等轉折詞",
    "- 禁止使用「非常」「特別」「真的很」等程度副詞",
    "- 禁止使用「...的話」「如果...」等假設句開頭",
    "- 每個句子不超過 30 字",
    "- 避免使用成語和四字詞組",
  ];

  const moderateRules = [
    "",
    "**適度模式額外規則**",
    "- 限制使用「其實」「事實上」（每篇最多 1 次）",
    "- 限制使用程度副詞（每段最多 2 個）",
    "- 句子長度可適度放寬至 40 字",
  ];

  const relaxedRules = [
    "",
    "**寬鬆模式**",
    "- 僅保留核心禁止項",
    "- 允許用戶的個人風格表達",
    "- 尊重用戶的創作自由",
  ];

  switch (level) {
    case "strict":
      return [...baseRules, ...strictRules].join("\n");
    case "moderate":
      return [...baseRules, ...moderateRules].join("\n");
    case "relaxed":
      return [...baseRules, ...relaxedRules].join("\n");
  }
}

/**
 * 用戶提示詞
 */
function buildUserPrompt(options: {
  topic: string;
  contentType: string;
  audience?: string;
  additionalContext?: string;
}): string {
  const { topic, contentType, audience, additionalContext } = options;

  const parts: string[] = [
    `請根據以下資訊撰寫一篇 Threads 貼文：`,
    "",
    `【主題】${topic}`,
    `【內容類型】${contentType}`,
  ];

  if (audience) {
    parts.push(`【目標受眾】${audience}`);
  }

  if (additionalContext) {
    parts.push(`【補充資訊】${additionalContext}`);
  }

  parts.push("");
  parts.push("請確保內容真實、自然、有人味，避免 AI 痕跡。");

  return parts.join("\n");
}

// ============================================
// 模式驗證
// ============================================

/**
 * 驗證 pure_story 模式的輸出
 * 確保沒有 IP/爆款關鍵字洩漏
 */
export function validatePureStoryOutput(content: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // 檢查是否包含 IP 相關關鍵字
  const ipKeywords = ["IP", "品牌", "變現", "流量", "粉絲", "漲粉", "爆款"];
  for (const keyword of ipKeywords) {
    if (content.includes(keyword)) {
      issues.push(`包含 IP 相關關鍵字：${keyword}`);
    }
  }

  // 檢查是否包含行銷語言
  const marketingPhrases = ["限時", "優惠", "免費", "點擊", "連結", "購買"];
  for (const phrase of marketingPhrases) {
    if (content.includes(phrase)) {
      issues.push(`包含行銷語言：${phrase}`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// ============================================
// 導出類型
// ============================================

export type { BuiltPrompt, BuildPromptOptions };
