import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { filterProfanity } from "./contentFilters";

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
    // 教學化欄位：紅線標記和改寫建議
    redlineMarks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          originalText: { type: "string" as const, description: "原文中有問題的片段" },
          suggestedText: { type: "string" as const, description: "建議改寫的版本" },
          reason: { type: "string" as const, description: "為什麼要改（用一句話解釋）" },
          category: { type: "string" as const, enum: ["hook", "translation", "tone", "cta", "structure"], description: "屬於哪個維度的問題" },
        },
        required: ["originalText", "suggestedText", "reason", "category"],
        additionalProperties: false,
      },
      description: "最多 5 個最重要的問題段落，每個都要有具體改寫建議",
    },
    fourLens: {
      type: "object" as const,
      properties: {
        emotion: {
          type: "object" as const,
          properties: {
            isDesireOriented: { type: "boolean" as const, description: "這篇文案傳遞的是渴望（正向）還是焦慮（負向）？渴望導向為 true" },
            emotionType: { type: "string" as const, description: "主要情緒類型（如：希望、期待、恐懼、焦慮等）" },
            deductionReason: { type: "string" as const, description: "如果扣分，說明原因" },
            advice: { type: "string" as const, description: "如何調整情緒基調的建議" },
          },
          required: ["isDesireOriented", "emotionType", "deductionReason", "advice"],
          additionalProperties: false,
        },
        persona: {
          type: "object" as const,
          properties: {
            isConsistent: { type: "boolean" as const, description: "這篇文案像不像你說的話？是否符合你的人設？" },
            hasPersonalTouch: { type: "boolean" as const, description: "是否有個人特色/獨特觀點？" },
            deductionReason: { type: "string" as const, description: "如果扣分，說明原因" },
            advice: { type: "string" as const, description: "如何增加人設一致性的建議" },
          },
          required: ["isConsistent", "hasPersonalTouch", "deductionReason", "advice"],
          additionalProperties: false,
        },
        structure: {
          type: "object" as const,
          properties: {
            isEasyToAbsorb: { type: "boolean" as const, description: "這篇文案好不好吸收？結構是否清晰？" },
            hasLogicalFlow: { type: "boolean" as const, description: "是否有清楚的邏輯脈絡？" },
            deductionReason: { type: "string" as const, description: "如果扣分，說明原因" },
            advice: { type: "string" as const, description: "如何優化結構的建議" },
          },
          required: ["isEasyToAbsorb", "hasLogicalFlow", "deductionReason", "advice"],
          additionalProperties: false,
        },
        conversion: {
          type: "object" as const,
          properties: {
            hasNextStep: { type: "boolean" as const, description: "讀者看完要做什麼？是否有明確的下一步？" },
            isActionable: { type: "boolean" as const, description: "行動呼籲是否具體可執行？" },
            deductionReason: { type: "string" as const, description: "如果扣分，說明原因" },
            advice: { type: "string" as const, description: "如何提升轉化的建議" },
          },
          required: ["hasNextStep", "isActionable", "deductionReason", "advice"],
          additionalProperties: false,
        },
      },
      required: ["emotion", "persona", "structure", "conversion"],
      additionalProperties: false,
    },
  },
  required: ["hook", "translation", "tone", "cta", "redlineMarks", "fourLens"],
  additionalProperties: false,
};

// System Prompt
export const HEALTH_CHECK_SYSTEM_PROMPT = `你現在是【Threads 演算法審核機器人】與【爆款文案教練】。
你的任務不是批改作文，而是判斷這篇文章是否符合 Threads 的演算法偏好。
請拋棄傳統寫作邏輯（起承轉合），改用以下【流量變現邏輯】進行嚴格審核。

## 核心價值觀 (Core Values)
1. 真實 > 完美：越像「真人碎碎念」越好，太像廣告或官方文章要扣分。
2. 小學五年級原則：必須連小學生都看得懂，禁止堆砌術語。
3. 渴望導向：文案應該傳遞正向渴望，而非製造焦慮。

## 評分規則 (必須嚴格執行 Boolean 檢查，不要憑感覺打分)

### 維度一：Hook 鉤子強度 (25分)
- [必要] 黃金開局 check：前兩行是否包含「觀察+提問」或「反直覺/反差敘述」？
  - 若前 3 秒(前兩行)無法讓人想點開，這是致命傷。
  - 有強烈反差（預期 vs 實際）→ hasContrastOpener = true
  - 有觀察+提問句型 → hasObservationQuestion = true
  - 單純有懸念 → hasSuspense = true

### 維度二：Translation 翻譯機 (20分)
- [必要] 翻譯機技巧 check：
  - 若有專業術語但未解釋/未比喻 → hasJargon = true, hasSimpleExplanation = false
  - 若有精彩比喻（如：悲傷檔案下載太慢）→ hasBrilliantMetaphor = true
  - 若用白話解釋 → hasSimpleExplanation = true

### 維度三：Tone 閱讀體感 (15分)
- [必要] 人味 check：
  - 是否有語助詞（真的、欸、啊、FK）→ hasInterjections = true
  - 排版是否有呼吸感（不是文字牆）→ hasBreathingSpace = true
  - 整體像真人說話 → isHumanLike = true

### 維度四：CTA 互動召喚 (10分) - 加分項
- CTA 是加分項，不是必要項。純分享型內容沒有 CTA 也沒問題。
- 重點是 CTA 要「自然」且「能引發互動」，而不是每篇都要有。
- CTA 類型判斷：
  - 召喚同類（你們也是這樣嗎？）→ ctaType = "tribe_call" (加分)
  - 簡單二選一 → ctaType = "binary_choice" (加分)
  - 開放式提問 → ctaType = "open_question" (小加分)
  - 說教結尾 → ctaType = "lecture" (不加分，建議改進)
  - 無 CTA → ctaType = "none" (純分享型，不扣分)

### 維度五：四透鏡檢核 (30分)
這是最重要的框架，用四個問題來檢視文案品質：

#### 心法透鏡 (8分) - 這篇文案傳遞的是渴望還是焦慮？
- 好的文案應該傳遞正向渴望，讓讀者看完感到希望和期待
- 如果文案充滿恐懼行銷或焦慮製造，要扣分
- isDesireOriented = true 表示渴望導向

#### 人設透鏡 (8分) - 這篇文案像不像你說的話？
- 文案應該有個人特色，不是千篇一律的模板
- 應該能感受到作者的獨特觀點和風格
- isConsistent = true 表示符合人設
- hasPersonalTouch = true 表示有個人特色

#### 結構透鏡 (7分) - 這篇文案好不好吸收？
- 結構應該清晰，讀者能輕鬆理解
- 有邏輯脈絡，不是東一句西一句
- isEasyToAbsorb = true 表示好吸收
- hasLogicalFlow = true 表示有邏輯

#### 轉化透鏡 (7分) - 讀者看完要做什麼？
- 應該有明確的下一步行動
- 行動呼籲要具體可執行
- hasNextStep = true 表示有下一步
- isActionable = true 表示可執行

## 輸出要求
請分析輸入的文案，嚴格填寫每個 Boolean 欄位。
對於每一個扣分項，必須在 advice 中給出具體的「改寫範例」。

## 教學化輸出（redlineMarks）
這是最重要的教學功能，讓學員知道「哪裡要改」和「為什麼要改」。

請找出文案中最多 5 個最需要改進的地方，每個都要包含：
1. originalText：原文中有問題的片段（完整擷取）
2. suggestedText：建議改寫的版本（具體可用）
3. reason：為什麼要改（用一句話解釋，讓學員學會）
4. category：屬於哪個維度的問題

範例：
- originalText: "今天要來分享一個很重要的觀念"
- suggestedText: "你有沒有過這種經驗？明明很努力，却總是覺得不夠好"
- reason: "開頭太平，沒有勾子。用「觀察+提問」句型讓讀者對號入座"
- category: "hook"`;

// 程式碼二次校正分數（確保穩定性）
export function recalibrateScore(result: any) {
  let totalScore = 0;
  const scores = {
    hook: 0,
    translation: 0,
    tone: 0,
    cta: 0,
    fourLens: 0,
  };

  // 四透鏡子分數
  const fourLensScores = {
    emotion: 0,
    persona: 0,
    structure: 0,
    conversion: 0,
  };

  // 1. Hook (滿分 25)
  if (result.hook.hasContrastOpener) scores.hook = 25;
  else if (result.hook.hasObservationQuestion) scores.hook = 18;
  else if (result.hook.hasSuspense) scores.hook = 10;
  else scores.hook = 0;

  // 2. Translation (滿分 20)
  if (result.translation.hasBrilliantMetaphor) scores.translation = 20;
  else if (result.translation.hasSimpleExplanation && !result.translation.hasJargon) scores.translation = 16;
  else if (result.translation.hasSimpleExplanation) scores.translation = 12;
  else if (result.translation.hasJargon) scores.translation = 4;
  else scores.translation = 12; // 無術語也無比喻，給基本分

  // 3. Tone (滿分 15)
  if (result.tone.hasInterjections && result.tone.hasBreathingSpace && result.tone.isHumanLike) scores.tone = 15;
  else if (result.tone.hasBreathingSpace && result.tone.isHumanLike) scores.tone = 11;
  else if (result.tone.isHumanLike) scores.tone = 7;
  else if (result.tone.hasBreathingSpace) scores.tone = 5;
  else scores.tone = 0;

  // 4. CTA (滿分 10) - 改為加分項，沒有 CTA 不扣分
  // 基礎分 5 分（純分享型內容也能取得基本分）
  // 有好的 CTA 加分，生硬的 CTA 不加分
  if (result.cta.ctaType === "tribe_call" && result.cta.hasTargetAudienceCall) {
    scores.cta = 10; // 召喚同類 + 有目標受眾，滿分
  } else if (result.cta.ctaType === "tribe_call" || result.cta.ctaType === "binary_choice") {
    scores.cta = 8; // 自然的 CTA，加分
  } else if (result.cta.ctaType === "open_question") {
    scores.cta = 6; // 開放式提問，小加分
  } else if (result.cta.ctaType === "lecture") {
    scores.cta = 4; // 說教式 CTA，不加分但也不扣分
  } else {
    scores.cta = 5; // 無 CTA，給基礎分（純分享型內容）
  }

  // 5. 四透鏡 (滿分 30)
  // 心法透鏡 (8分)
  if (result.fourLens.emotion.isDesireOriented) fourLensScores.emotion = 8;
  else fourLensScores.emotion = 3; // 焦慮導向給部分分

  // 人設透鏡 (8分)
  if (result.fourLens.persona.isConsistent && result.fourLens.persona.hasPersonalTouch) fourLensScores.persona = 8;
  else if (result.fourLens.persona.isConsistent || result.fourLens.persona.hasPersonalTouch) fourLensScores.persona = 5;
  else fourLensScores.persona = 0;

  // 結構透鏡 (7分)
  if (result.fourLens.structure.isEasyToAbsorb && result.fourLens.structure.hasLogicalFlow) fourLensScores.structure = 7;
  else if (result.fourLens.structure.isEasyToAbsorb || result.fourLens.structure.hasLogicalFlow) fourLensScores.structure = 4;
  else fourLensScores.structure = 0;

  // 轉化透鏡 (7分)
  if (result.fourLens.conversion.hasNextStep && result.fourLens.conversion.isActionable) fourLensScores.conversion = 7;
  else if (result.fourLens.conversion.hasNextStep || result.fourLens.conversion.isActionable) fourLensScores.conversion = 4;
  else fourLensScores.conversion = 0;

  scores.fourLens = fourLensScores.emotion + fourLensScores.persona + fourLensScores.structure + fourLensScores.conversion;

  totalScore = scores.hook + scores.translation + scores.tone + scores.cta + scores.fourLens;

  return {
    ...result,
    scores,
    fourLensScores,
    totalScore,
  };
}

// 維度名稱對照表
export const DIMENSION_NAMES: Record<string, string> = {
  hook: 'Hook 鉤子強度',
  translation: 'Translation 翻譯機',
  tone: 'Tone 閱讀體感',
  cta: 'CTA 互動召喚',
  fourLens: '四透鏡檢核',
};

// 四透鏡名稱對照表
export const FOUR_LENS_NAMES: Record<string, string> = {
  emotion: '心法透鏡',
  persona: '人設透鏡',
  structure: '結構透鏡',
  conversion: '轉化透鏡',
};

// 最大分數對照表
export const MAX_SCORES = {
  hook: 25,
  translation: 20,
  tone: 15,
  cta: 10,
  fourLens: 30,
};

// 四透鏡最大分數
export const FOUR_LENS_MAX_SCORES = {
  emotion: 8,
  persona: 8,
  structure: 7,
  conversion: 7,
};

// 建立個人化健檢提示詞
function buildPersonalizedPrompt(
  ipProfile: any | null,
  writingStyle: any | null
): string {
  let personalContext = '';
  
  // 整合 IP 地基資料
  if (ipProfile) {
    personalContext += `\n\n## 學員個人資料（請根據這些資料給出個人化建議）\n`;
    
    if (ipProfile.occupation) {
      personalContext += `- **職業/身份**：${ipProfile.occupation}\n`;
    }
    
    // 人設三支柱（使用正確的欄位名稱）
    if (ipProfile.personaExpertise || ipProfile.personaEmotion || ipProfile.personaViewpoint) {
      personalContext += `- **人設三支柱**：\n`;
      if (ipProfile.personaExpertise) personalContext += `  - 專業權威：${ipProfile.personaExpertise}\n`;
      if (ipProfile.personaEmotion) personalContext += `  - 情感共鳴：${ipProfile.personaEmotion}\n`;
      if (ipProfile.personaViewpoint) personalContext += `  - 獨特觀點：${ipProfile.personaViewpoint}\n`;
    }
    
    // 目標受眾（從 contentMatrixAudiences 取得）
    if (ipProfile.contentMatrixAudiences) {
      const audiences = ipProfile.contentMatrixAudiences;
      if (audiences.core) {
        personalContext += `- **核心受眾**：${audiences.core}\n`;
      }
    }
    
    // 觀點聲明
    if (ipProfile.viewpointStatement) {
      personalContext += `- **核心觀點**：${ipProfile.viewpointStatement}\n`;
    }
    
    // 說話風格
    if (ipProfile.voiceTone) {
      personalContext += `- **說話風格**：${ipProfile.voiceTone}\n`;
    }
    
    // 身份標籤
    if (ipProfile.identityTags && ipProfile.identityTags.length > 0) {
      personalContext += `- **身份標籤**：${ipProfile.identityTags.join('、')}\n`;
    }
    
    // 內容主題
    if (ipProfile.contentMatrixThemes && ipProfile.contentMatrixThemes.length > 0) {
      personalContext += `- **內容主題**：${ipProfile.contentMatrixThemes.join('、')}\n`;
    }
    
    // AI 策略總結（從戰報數據學習）
    if (ipProfile.aiStrategySummary) {
      personalContext += `- **AI 策略分析**：${ipProfile.aiStrategySummary}\n`;
    }
    
    if (ipProfile.bestPerformingType) {
      personalContext += `- **表現最好的內容類型**：${ipProfile.bestPerformingType}\n`;
    }
    
    if (ipProfile.viralPatterns) {
      personalContext += `- **爆文模式**：${ipProfile.viralPatterns}\n`;
    }
  }
  
  // 整合風格樣本分析結果
  if (writingStyle) {
    personalContext += `\n## 學員爆款文風格分析\n`;
    
    if (writingStyle.toneStyle) {
      personalContext += `- **語氣風格**：${writingStyle.toneStyle}\n`;
    }
    
    if (writingStyle.commonPhrases && writingStyle.commonPhrases.length > 0) {
      personalContext += `- **常用句式**：${writingStyle.commonPhrases.join('、')}\n`;
    }
    
    if (writingStyle.emotionalTone) {
      personalContext += `- **情緒基調**：${writingStyle.emotionalTone}\n`;
    }
    
    if (writingStyle.hookPatterns && writingStyle.hookPatterns.length > 0) {
      personalContext += `- **擅長的開頭風格**：${writingStyle.hookPatterns.join('、')}\n`;
    }
    
    if (writingStyle.viralElements && writingStyle.viralElements.length > 0) {
      personalContext += `- **爆款元素**：${writingStyle.viralElements.join('、')}\n`;
    }
    
    // 加入爆款貼文範例（最多 3 篇）
    if (writingStyle.samplePosts && writingStyle.samplePosts.length > 0) {
      const topPosts = writingStyle.samplePosts.slice(0, 3);
      personalContext += `\n### 學員爆款貼文範例（請參考這些風格給建議）\n`;
      topPosts.forEach((post: any, index: number) => {
        const content = typeof post === 'string' ? post : post.content;
        if (content) {
          personalContext += `\n**範例 ${index + 1}**：\n「${content.substring(0, 300)}${content.length > 300 ? '...' : ''}」\n`;
        }
      });
    }
  }
  
  // 加入個人化健檢指令
  if (personalContext) {
    personalContext += `\n## 個人化健檢指令\n`;
    personalContext += `請根據上述學員資料，在建議中：\n`;
    personalContext += `1. 檢查文案是否符合學員的人設定位和專業領域\n`;
    personalContext += `2. 檢查語氣是否符合學員的說話風格和口頭禪\n`;
    personalContext += `3. 檢查內容是否對準學員的目標受眾\n`;
    personalContext += `4. 在改寫建議中參考學員的爆款文風格\n`;
    personalContext += `5. 如果文案風格與學員的爆款文差異很大，要特別指出\n`;
  }
  
  return personalContext;
}

// 執行健檢的主函數
export async function executeContentHealthCheck(userId: number, text: string) {
  // 載入學員的 IP 地基和風格資料
  const [ipProfile, writingStyle] = await Promise.all([
    db.getIpProfile(userId),
    db.getUserWritingStyle(userId),
  ]);
  
  // 建立個人化提示詞
  const personalContext = buildPersonalizedPrompt(ipProfile || null, writingStyle);
  const fullSystemPrompt = HEALTH_CHECK_SYSTEM_PROMPT + personalContext;
  
  const response = await invokeLLM({
    messages: [
      { role: "system", content: fullSystemPrompt },
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

  // 對所有建議文字進行髒話過濾
  if (calibratedResult.redlineMarks) {
    calibratedResult.redlineMarks = calibratedResult.redlineMarks.map((mark: any) => ({
      ...mark,
      suggestedText: filterProfanity(mark.suggestedText || ''),
      reason: filterProfanity(mark.reason || ''),
    }));
  }
  
  // 過濾各維度的建議文字
  if (calibratedResult.hook?.advice) {
    calibratedResult.hook.advice = filterProfanity(calibratedResult.hook.advice);
  }
  if (calibratedResult.translation?.advice) {
    calibratedResult.translation.advice = filterProfanity(calibratedResult.translation.advice);
  }
  if (calibratedResult.tone?.advice) {
    calibratedResult.tone.advice = filterProfanity(calibratedResult.tone.advice);
  }
  if (calibratedResult.cta?.advice) {
    calibratedResult.cta.advice = filterProfanity(calibratedResult.cta.advice);
  }
  if (calibratedResult.fourLens) {
    if (calibratedResult.fourLens.emotion?.advice) {
      calibratedResult.fourLens.emotion.advice = filterProfanity(calibratedResult.fourLens.emotion.advice);
    }
    if (calibratedResult.fourLens.persona?.advice) {
      calibratedResult.fourLens.persona.advice = filterProfanity(calibratedResult.fourLens.persona.advice);
    }
    if (calibratedResult.fourLens.structure?.advice) {
      calibratedResult.fourLens.structure.advice = filterProfanity(calibratedResult.fourLens.structure.advice);
    }
    if (calibratedResult.fourLens.conversion?.advice) {
      calibratedResult.fourLens.conversion.advice = filterProfanity(calibratedResult.fourLens.conversion.advice);
    }
  }

  // 生成總結建議（針對最弱的維度）
  const mainScores = [
    { key: 'hook', score: calibratedResult.scores.hook, max: MAX_SCORES.hook },
    { key: 'translation', score: calibratedResult.scores.translation, max: MAX_SCORES.translation },
    { key: 'tone', score: calibratedResult.scores.tone, max: MAX_SCORES.tone },
    { key: 'cta', score: calibratedResult.scores.cta, max: MAX_SCORES.cta },
  ];
  
  // 找出得分率最低的維度
  const weakest = mainScores.sort((a, b) => (a.score / a.max) - (b.score / b.max))[0];
  
  let overallAdvice = `最需要加強的是【${DIMENSION_NAMES[weakest.key]}】。`;
  if (weakest.key === 'hook') overallAdvice += calibratedResult.hook.advice;
  else if (weakest.key === 'translation') overallAdvice += calibratedResult.translation.advice;
  else if (weakest.key === 'tone') overallAdvice += calibratedResult.tone.advice;
  else if (weakest.key === 'cta') overallAdvice += calibratedResult.cta.advice;

  // 建立個人化資訊摘要
  const personalizationInfo = {
    hasIpProfile: !!ipProfile,
    hasWritingStyle: !!writingStyle,
    hasSamplePosts: !!(writingStyle?.samplePosts && writingStyle.samplePosts.length > 0),
    samplePostCount: writingStyle?.samplePosts?.length || 0,
    ipProfileFields: ipProfile ? {
      hasOccupation: !!ipProfile.occupation,
      hasPersonaTriad: !!(ipProfile.personaExpertise || ipProfile.personaEmotion || ipProfile.personaViewpoint),
      hasTargetAudience: !!ipProfile.contentMatrixAudiences,
      hasSpeakingStyle: !!ipProfile.voiceTone,
    } : null,
  };

  return {
    ...calibratedResult,
    overallAdvice,
    maxScores: MAX_SCORES,
    fourLensMaxScores: FOUR_LENS_MAX_SCORES,
    personalizationInfo,
  };
}
