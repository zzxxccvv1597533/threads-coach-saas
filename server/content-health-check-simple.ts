import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

// 維度名稱對照表
export const DIMENSION_NAMES: Record<string, string> = {
  hook: 'Hook 鉤子強度',
  translation: 'Translation 翻譯機',
  tone: 'Tone 閱讀體感',
  cta: 'CTA 互動召喚',
  fourLens: '四透鏡檢核',
};

// 最大分數對照表
export const MAX_SCORES = {
  hook: 25,
  translation: 20,
  tone: 15,
  cta: 10,
  fourLens: 30,
};

// 簡化的 Schema - 只包含必要的頂級欄位
const SIMPLE_HEALTH_CHECK_SCHEMA = {
  type: "object" as const,
  properties: {
    hook_score: { type: "number" as const },
    translation_score: { type: "number" as const },
    tone_score: { type: "number" as const },
    cta_score: { type: "number" as const },
    fourlens_score: { type: "number" as const },
    hook_advice: { type: "string" as const },
    translation_advice: { type: "string" as const },
    tone_advice: { type: "string" as const },
    cta_advice: { type: "string" as const },
    fourlens_advice: { type: "string" as const },
    overall_advice: { type: "string" as const },
  },
  required: [
    "hook_score", "translation_score", "tone_score", "cta_score", "fourlens_score",
    "hook_advice", "translation_advice", "tone_advice", "cta_advice", "fourlens_advice",
    "overall_advice"
  ],
  additionalProperties: false,
};

const SIMPLE_HEALTH_CHECK_PROMPT = `你是【Threads 文案評分專家】。

請根據以下五大維度對這篇文案進行評分（0-100 分制，然後轉換為該維度的最大分數）：

## 評分維度

1. **Hook 鉤子強度（滿分 25 分）**：前兩行是否讓人停下？是否有反直覺/反差敘述或觀察+提問？
2. **Translation 翻譯機（滿分 20 分）**：是否用比喻說白話？是否避免堆砌專業術語？
3. **Tone 閱讀體感（滿分 15 分）**：是否像真人說話？排版是否有呼吸感？
4. **CTA 互動召喚（滿分 10 分）**：是否有自然的互動召喚？
5. **四透鏡檢核（滿分 30 分）**：心法(傳遞渴望?) + 人設(符合風格?) + 結構(邏輯清晰?) + 轉化(有下一步?)

## 輸出格式

請輸出 JSON 格式，包含：
- hook_score: 0-25 的分數
- translation_score: 0-20 的分數
- tone_score: 0-15 的分數
- cta_score: 0-10 的分數
- fourlens_score: 0-30 的分數
- hook_advice: Hook 維度的改進建議（簡短）
- translation_advice: Translation 維度的改進建議（簡短）
- tone_advice: Tone 維度的改進建議（簡短）
- cta_advice: CTA 維度的改進建議（簡短）
- fourlens_advice: 四透鏡維度的改進建議（簡短）
- overall_advice: 整體改進建議（簡短）

只輸出 JSON，不要其他文字。`;

export async function executeContentHealthCheck(userId: number, text: string) {
  console.log('[executeContentHealthCheck] Starting for user:', userId);
  console.log('[executeContentHealthCheck] Text length:', text.length);
  
  try {
    console.log('[executeContentHealthCheck] Calling LLM with simple json_schema mode...');
    
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SIMPLE_HEALTH_CHECK_PROMPT },
        { role: "user", content: `請評分這篇文案：\n\n「${text}」` }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "simple_health_check",
          strict: true,
          schema: SIMPLE_HEALTH_CHECK_SCHEMA,
        },
      },
    });
    
    console.log('[executeContentHealthCheck] Response received');
    
    if (!response?.choices || response.choices.length === 0) {
      console.error('[executeContentHealthCheck] ERROR: Empty choices array');
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR', 
        message: 'LLM API 返回空結果' 
      });
    }
    
    const content = response.choices[0]?.message?.content;
    
    if (!content || typeof content !== 'string') {
      console.error('[executeContentHealthCheck] ERROR: Invalid content');
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR', 
        message: '健檢結果格式錯誤' 
      });
    }
    
    console.log('[executeContentHealthCheck] Parsing JSON...');
    const aiResult = JSON.parse(content);
    console.log('[executeContentHealthCheck] Successfully parsed result');
    
    // 轉換為前端期望的格式
    const result = {
      scores: {
        hook: Math.round(aiResult.hook_score),
        translation: Math.round(aiResult.translation_score),
        tone: Math.round(aiResult.tone_score),
        cta: Math.round(aiResult.cta_score),
        fourLens: Math.round(aiResult.fourlens_score),
      },
      totalScore: Math.round(
        aiResult.hook_score + 
        aiResult.translation_score + 
        aiResult.tone_score + 
        aiResult.cta_score + 
        aiResult.fourlens_score
      ),
      maxScores: MAX_SCORES,
      hook: {
        hasContrastOpener: aiResult.hook_score >= 15,
        hasObservationQuestion: aiResult.hook_score >= 10,
        hasSuspense: aiResult.hook_score >= 5,
        openerType: 'inferred',
        openerContent: 'N/A',
        deductionReason: `得分 ${Math.round(aiResult.hook_score)}/25`,
        advice: aiResult.hook_advice || '需要改進',
      },
      translation: {
        hasJargon: aiResult.translation_score < 10,
        hasBrilliantMetaphor: aiResult.translation_score >= 15,
        hasSimpleExplanation: aiResult.translation_score >= 10,
        metaphorExample: 'N/A',
        jargonList: [],
        deductionReason: `得分 ${Math.round(aiResult.translation_score)}/20`,
        advice: aiResult.translation_advice || '需要改進',
      },
      tone: {
        hasInterjections: aiResult.tone_score >= 8,
        hasBreathingSpace: aiResult.tone_score >= 10,
        isHumanLike: aiResult.tone_score >= 10,
        detectedInterjections: [],
        deductionReason: `得分 ${Math.round(aiResult.tone_score)}/15`,
        advice: aiResult.tone_advice || '需要改進',
      },
      cta: {
        hasCTA: aiResult.cta_score >= 5,
        ctaType: 'inferred',
        ctaContent: 'N/A',
        targetAudience: 'N/A',
        deductionReason: `得分 ${Math.round(aiResult.cta_score)}/10`,
        advice: aiResult.cta_advice || '需要改進',
      },
      fourLens: {
        emotion: {
          isDesireOriented: aiResult.fourlens_score >= 20,
          emotionalTone: 'inferred',
          deductionReason: `得分 ${Math.round(aiResult.fourlens_score)}/30`,
          advice: aiResult.fourlens_advice || '需要改進',
        },
        persona: {
          matchesPersona: aiResult.fourlens_score >= 15,
          personaAlignment: 'inferred',
          deductionReason: `得分 ${Math.round(aiResult.fourlens_score)}/30`,
          advice: aiResult.fourlens_advice || '需要改進',
        },
        structure: {
          isWellStructured: aiResult.fourlens_score >= 15,
          structureQuality: 'inferred',
          deductionReason: `得分 ${Math.round(aiResult.fourlens_score)}/30`,
          advice: aiResult.fourlens_advice || '需要改進',
        },
        conversion: {
          hasConversionPath: aiResult.fourlens_score >= 10,
          conversionClarity: 'inferred',
          deductionReason: `得分 ${Math.round(aiResult.fourlens_score)}/30`,
          advice: aiResult.fourlens_advice || '需要改進',
        },
      },
      redlineMarks: [],
      overallAdvice: aiResult.overall_advice || '需要改進',
    };
    
    await db.logApiUsage(userId, 'contentHealthCheck', 'llm', 600, 800);
    
    return result;
  } catch (error) {
    console.error('[executeContentHealthCheck] Error:', error);
    
    if (error instanceof TRPCError) {
      throw error;
    }
    
    throw new TRPCError({ 
      code: 'INTERNAL_SERVER_ERROR', 
      message: '健檢失敗：' + String(error) 
    });
  }
}
