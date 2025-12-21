import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

// 定義流量關鍵字庫
export const TRAFFIC_KEYWORDS = {
  mbti: ['ENTP', 'INFP', 'INFJ', 'ENFP', 'INTJ', 'INTP', 'ENFJ', 'ENTJ', 'ISFJ', 'ISTJ', 'ISTP', 'ISFP', 'ESFP', 'ESTP', 'ESFJ', 'ESTJ', 'MBTI', 'Fi', 'Fe', 'Ti', 'Te', 'Ni', 'Ne', 'Si', 'Se'],
  constellation: ['牡羊', '金牛', '雙子', '巨蟹', '獅子', '處女', '天秤', '天蠍', '射手', '摩羯', '水瓶', '雙魚', '水逆', '星座', '運勢', '塔羅', '占星'],
  metaphysics: ['能量', '頻率', '吸引力法則', '宇宙', '靈性', '冥想', '脈輪', '人類圖', '紫微', '八字', '風水'],
  identity: ['ADHD', 'ADD', '高敏人', 'HSP', '內向者', '外向者', '創業者', '老闆', '自由工作者', '斜槓', '媽媽', '爸爸', '新手爸媽', '單親', '職場新鮮人', 'Z世代', '千禧世代'],
};

// 定義 JSON Schema 強制 AI 輸出結構化資料
export const healthCheckSchema = {
  type: "object" as const,
  properties: {
    hook: {
      type: "object" as const,
      properties: {
        hasContrastOpener: { type: "boolean" as const, description: "前兩句是否有反直覺/強烈反差（預期 vs 實際）" },
        hasObservationQuestion: { type: "boolean" as const, description: "是否有觀察+提問句型（你是不是也...）" },
        hasSuspense: { type: "boolean" as const, description: "是否有懸念讓人想繼續看" },
        openerType: { type: "string" as const, enum: ["contrast", "observation_question", "suspense", "none"], description: "開場類型" },
        openerContent: { type: "string" as const, description: "擷取開場前兩句的文字內容" },
        deductionReason: { type: "string" as const, description: "如果扣分，說明原因" },
        advice: { type: "string" as const, description: "具體的改進建議，包含改寫範例" },
      },
      required: ["hasContrastOpener", "hasObservationQuestion", "hasSuspense", "openerType", "openerContent", "deductionReason", "advice"],
      additionalProperties: false,
    },
    tagging: {
      type: "object" as const,
      properties: {
        hasMBTI: { type: "boolean" as const, description: "是否提及 MBTI 相關詞彙" },
        hasConstellation: { type: "boolean" as const, description: "是否提及星座相關詞彙" },
        hasMetaphysics: { type: "boolean" as const, description: "是否提及玄學/能量相關詞彙" },
        hasIdentityTag: { type: "boolean" as const, description: "是否提及具體身分標籤（ADHD、高敏人、創業者等）" },
        detectedKeywords: { type: "array" as const, items: { type: "string" as const }, description: "偵測到的流量關鍵字" },
        isCoreTopic: { type: "boolean" as const, description: "流量關鍵字是否為文章核心主題" },
        deductionReason: { type: "string" as const, description: "如果扣分，說明原因" },
        advice: { type: "string" as const, description: "如何加入流量密碼的建議" },
      },
      required: ["hasMBTI", "hasConstellation", "hasMetaphysics", "hasIdentityTag", "detectedKeywords", "isCoreTopic", "deductionReason", "advice"],
      additionalProperties: false,
    },
    translation: {
      type: "object" as const,
      properties: {
        hasJargon: { type: "boolean" as const, description: "是否有使用專業術語" },
        hasBrilliantMetaphor: { type: "boolean" as const, description: "是否有精彩的比喻（將抽象概念具象化）" },
        hasSimpleExplanation: { type: "boolean" as const, description: "是否用白話解釋（小學五年級能懂）" },
        metaphorExample: { type: "string" as const, description: "擷取文中的比喻片段，若無則為空" },
        jargonList: { type: "array" as const, items: { type: "string" as const }, description: "偵測到的專業術語" },
        deductionReason: { type: "string" as const, description: "如果扣分，說明原因" },
        advice: { type: "string" as const, description: "如何改進的建議，包含比喻範例" },
      },
      required: ["hasJargon", "hasBrilliantMetaphor", "hasSimpleExplanation", "metaphorExample", "jargonList", "deductionReason", "advice"],
      additionalProperties: false,
    },
    tone: {
      type: "object" as const,
      properties: {
        hasInterjections: { type: "boolean" as const, description: "是否有語助詞（真的、欸、啊、FK、WTF 等）" },
        hasBreathingSpace: { type: "boolean" as const, description: "排版是否有呼吸感（適度分段、不是文字牆）" },
        isHumanLike: { type: "boolean" as const, description: "整體是否像真人說話（不像 AI 或官方文章）" },
        detectedInterjections: { type: "array" as const, items: { type: "string" as const }, description: "偵測到的語助詞" },
        deductionReason: { type: "string" as const, description: "如果扣分，說明原因" },
        advice: { type: "string" as const, description: "如何增加人味的建議" },
      },
      required: ["hasInterjections", "hasBreathingSpace", "isHumanLike", "detectedInterjections", "deductionReason", "advice"],
      additionalProperties: false,
    },
    cta: {
      type: "object" as const,
      properties: {
        ctaType: { type: "string" as const, enum: ["tribe_call", "binary_choice", "open_question", "lecture", "none"], description: "CTA 類型" },
        hasTargetAudienceCall: { type: "boolean" as const, description: "是否召喚同類（讓特定族群覺得這是在說我）" },
        ctaContent: { type: "string" as const, description: "擷取 CTA 的文字內容" },
        deductionReason: { type: "string" as const, description: "如果扣分，說明原因" },
        advice: { type: "string" as const, description: "更好的 CTA 建議，包含改寫範例" },
      },
      required: ["ctaType", "hasTargetAudienceCall", "ctaContent", "deductionReason", "advice"],
      additionalProperties: false,
    },
  },
  required: ["hook", "tagging", "translation", "tone", "cta"],
  additionalProperties: false,
};

// System Prompt
export const HEALTH_CHECK_SYSTEM_PROMPT = `你現在是【Threads 演算法審核機器人】與【爆款文案教練】。
你的任務不是批改作文，而是判斷這篇文章是否符合 Threads 的演算法偏好。
請拋棄傳統寫作邏輯（起承轉合），改用以下【流量變現邏輯】進行嚴格審核。

## 核心價值觀 (Core Values)
1. 真實 > 完美：越像「真人碎碎念」越好，太像廣告或官方文章要扣分。
2. 小學五年級原則：必須連小學生都看得懂，禁止堆砌術語。
3. 流量密碼：MBTI、玄學、具體人設標籤 (ADHD, 高敏人) 是絕對加分項。

## 評分規則 (必須嚴格執行 Boolean 檢查，不要憑感覺打分)

### 維度一：Hook 鉤子強度 (30分)
- [必要] 黃金開局 check：前兩行是否包含「觀察+提問」或「反直覺/反差敘述」？
  - 若前 3 秒(前兩行)無法讓人想點開，這是致命傷。
  - 有強烈反差（預期 vs 實際）→ hasContrastOpener = true
  - 有觀察+提問句型 → hasObservationQuestion = true
  - 單純有懸念 → hasSuspense = true

### 維度二：Tagging 流量密碼 (25分)
- [加分] 流量密碼植入：
  1. 是否提及 MBTI/星座/人類圖？ → hasMBTI, hasConstellation
  2. 是否提及具體身分標籤 (如：ADHD、創業老闆、受傷過的人)？ → hasIdentityTag
  3. 是否提及玄學/能量話題？ → hasMetaphysics
- 如果有關鍵字且為核心主題 → isCoreTopic = true

### 維度三：Translation 翻譯機 (25分)
- [必要] 翻譯機技巧 check：
  - 若有專業術語但未解釋/未比喻 → hasJargon = true, hasSimpleExplanation = false
  - 若有精彩比喻（如：悲傷檔案下載太慢）→ hasBrilliantMetaphor = true
  - 若用白話解釋 → hasSimpleExplanation = true

### 維度四：Tone 閱讀體感 (10分)
- [必要] 人味 check：
  - 是否有語助詞（真的、欸、啊、FK）→ hasInterjections = true
  - 排版是否有呼吸感（不是文字牆）→ hasBreathingSpace = true
  - 整體像真人說話 → isHumanLike = true

### 維度五：CTA 互動召喚 (10分)
- [必要] 明確 CTA check：
  - 召喚同類（你們也是這樣嗎？）→ ctaType = "tribe_call"
  - 簡單二選一 → ctaType = "binary_choice"
  - 開放式高難度提問 → ctaType = "open_question"
  - 說教結尾 → ctaType = "lecture"
  - 無 CTA → ctaType = "none"

## 測試案例校準
如果文章是：「朋友過世我沒感覺，過了5個月才哭，原來是因為我是 ENTP，悲傷檔案下載太慢。」
>> 這篇文章的各項 Boolean 應該是：
- hasContrastOpener: true（朋友死沒感覺是強烈反差）
- hasMBTI: true（提到 ENTP）
- hasBrilliantMetaphor: true（檔案下載的比喻）
- hasInterjections: true（如果有語助詞）
- ctaType: "tribe_call"（如果結尾問其他 ENTP）

## 輸出要求
請分析輸入的文案，嚴格填寫每個 Boolean 欄位。
對於每一個扣分項，必須在 advice 中給出具體的「改寫範例」。`;

// 程式碼二次校正分數（確保穩定性）
export function recalibrateScore(result: any) {
  let totalScore = 0;
  const scores = {
    hook: 0,
    tagging: 0,
    translation: 0,
    tone: 0,
    cta: 0,
  };

  // 1. Hook (滿分 30)
  if (result.hook.hasContrastOpener) scores.hook = 30;
  else if (result.hook.hasObservationQuestion) scores.hook = 20;
  else if (result.hook.hasSuspense) scores.hook = 10;
  else scores.hook = 0;

  // 2. Tagging (滿分 25)
  const hasAnyTag = result.tagging.hasMBTI || 
                   result.tagging.hasConstellation || 
                   result.tagging.hasMetaphysics || 
                   result.tagging.hasIdentityTag;
  if (hasAnyTag && result.tagging.isCoreTopic) scores.tagging = 25;
  else if (hasAnyTag) scores.tagging = 15;
  else scores.tagging = 0;

  // 3. Translation (滿分 25)
  if (result.translation.hasBrilliantMetaphor) scores.translation = 25;
  else if (result.translation.hasSimpleExplanation && !result.translation.hasJargon) scores.translation = 20;
  else if (result.translation.hasSimpleExplanation) scores.translation = 15;
  else if (result.translation.hasJargon) scores.translation = 5;
  else scores.translation = 15; // 無術語也無比喻，給基本分

  // 4. Tone (滿分 10)
  if (result.tone.hasInterjections && result.tone.hasBreathingSpace && result.tone.isHumanLike) scores.tone = 10;
  else if (result.tone.hasBreathingSpace && result.tone.isHumanLike) scores.tone = 7;
  else if (result.tone.isHumanLike) scores.tone = 5;
  else scores.tone = 0;

  // 5. CTA (滿分 10)
  if (result.cta.ctaType === "tribe_call" || result.cta.ctaType === "binary_choice") scores.cta = 10;
  else if (result.cta.ctaType === "open_question") scores.cta = 5;
  else scores.cta = 0;

  totalScore = scores.hook + scores.tagging + scores.translation + scores.tone + scores.cta;

  return {
    ...result,
    scores,
    totalScore,
  };
}

// 維度名稱對照表
export const DIMENSION_NAMES: Record<string, string> = {
  hook: 'Hook 鉤子強度',
  tagging: 'Tagging 流量密碼',
  translation: 'Translation 翻譯機',
  tone: 'Tone 閱讀體感',
  cta: 'CTA 互動召喚',
};

// 最大分數對照表
export const MAX_SCORES = {
  hook: 30,
  tagging: 25,
  translation: 25,
  tone: 10,
  cta: 10,
};

// 執行健檢的主函數
export async function executeContentHealthCheck(userId: number, text: string) {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: HEALTH_CHECK_SYSTEM_PROMPT },
      { role: "user", content: `請分析這篇文案：\n\n「${text}」` }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "content_health_check",
        strict: true,
        schema: healthCheckSchema,
      },
    },
    // temperature 由 LLM 模組內部控制
  });

  await db.logApiUsage(userId, 'contentHealthCheck', 'llm', 600, 800);

  // 解析 AI 回傳的 JSON
  let aiResult;
  try {
    const content = response.choices[0]?.message?.content;
    aiResult = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (e) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '健檢結果解析失敗' });
  }

  const calibratedResult = recalibrateScore(aiResult);

  // 生成總結建議（針對最弱的維度）
  const weakestDimension = Object.entries(calibratedResult.scores)
    .sort(([,a], [,b]) => (a as number) - (b as number))[0];
  
  const overallAdvice = `最需要加強的是【${DIMENSION_NAMES[weakestDimension[0]]}】。${calibratedResult[weakestDimension[0]].advice}`;

  return {
    ...calibratedResult,
    overallAdvice,
    maxScores: MAX_SCORES,
  };
}
