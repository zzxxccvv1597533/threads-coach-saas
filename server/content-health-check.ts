import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { 
  analyzeOpener, 
  HIGH_EFFECT_OPENER_PATTERNS,
  LOW_EFFECT_OPENER_PATTERNS 
} from "../shared/opener-rules";

// 維度名稱對照表
export const DIMENSION_NAMES: Record<string, string> = {
  hook: 'Hook 鉤子強度',
  translation: 'Translation 翻譯機',
  tone: 'Tone 閱讀體感',
  cta: 'CTA 互動召喚',
  fourLens: '四透鏡檢核',
  openerEffect: '開頭效果倍數', // 新增
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

/**
 * 數據驅動的開頭效果分析
 * 根據 1,739 篇爆款貼文統計數據評估開頭效果
 */
function analyzeOpenerWithData(text: string): {
  effectMultiplier: number;
  matchedPatterns: Array<{ name: string; multiplier: number; description: string }>;
  lowEffectPatterns: Array<{ name: string; multiplier: number; description: string }>;
  suggestions: string[];
  openerText: string;
  grade: 'A' | 'B' | 'C' | 'D';
  hasNumber: boolean;
} {
  // 取得第一行
  const lines = text.split('\n').filter(line => line.trim());
  const openerText = lines[0] || '';
  
  // 使用 opener-rules 的分析函數
  const analysis = analyzeOpener(openerText);
  
  // 找出匹配的高效模式
  const matchedPatterns: Array<{ name: string; multiplier: number; description: string }> = [];
  const lowEffectPatterns: Array<{ name: string; multiplier: number; description: string }> = [];
  
  // 檢查高效模式（使用 regex）
  for (const pattern of HIGH_EFFECT_OPENER_PATTERNS) {
    if (pattern.regex && pattern.regex.test(openerText)) {
      matchedPatterns.push({
        name: pattern.name,
        multiplier: pattern.effect,
        description: pattern.instruction,
      });
    }
  }
  
  // 檢查低效模式（使用 regex）
  for (const pattern of LOW_EFFECT_OPENER_PATTERNS) {
    if (pattern.regex && pattern.regex.test(openerText)) {
      lowEffectPatterns.push({
        name: pattern.name,
        multiplier: pattern.effect,
        description: pattern.instruction,
      });
    }
  }
  
  // 計算效果倍數
  let effectMultiplier = 1.0;
  for (const p of matchedPatterns) {
    effectMultiplier *= p.multiplier;
  }
  for (const p of lowEffectPatterns) {
    effectMultiplier *= p.multiplier;
  }
  
  // 檢查是否有數字
  const hasNumber = /\d/.test(openerText);
  
  // 生成建議
  const suggestions: string[] = [];
  
  if (matchedPatterns.length === 0) {
    suggestions.push('建議使用「冒號斷言」格式（效果 2.8x），例如：「主題：觀點」');
    suggestions.push('或使用「禁忌/警告詞」（效果 2.4x），例如：「千萬不要...」「90% 的人都搞錯了...」');
  }
  
  if (lowEffectPatterns.length > 0) {
    for (const p of lowEffectPatterns) {
      if (p.name === '問句開頭') {
        suggestions.push('避免用問句作為第一行（效果只有 0.4x），改用斷言式開頭');
      }
      if (p.name === 'Emoji 開頭') {
        suggestions.push('避免用 Emoji 作為第一行（效果只有 0.6x），Emoji 放在中間或結尾更好');
      }
    }
  }
  
  // 如果沒有數字，建議加入
  if (!hasNumber) {
    suggestions.push('考慮加入數字（效果 1.7x），例如：「3 個方法」「90% 的人」');
  }
  
  // 評級
  let grade: 'A' | 'B' | 'C' | 'D' = 'D';
  if (effectMultiplier >= 2.0) grade = 'A';
  else if (effectMultiplier >= 1.5) grade = 'B';
  else if (effectMultiplier >= 1.0) grade = 'C';
  else grade = 'D';
  
  return {
    effectMultiplier: Math.round(effectMultiplier * 100) / 100,
    matchedPatterns,
    lowEffectPatterns,
    suggestions,
    openerText,
    grade,
    hasNumber,
  };
}

/**
 * 與爆款數據對比分析
 */
async function compareWithViralData(text: string): Promise<{
  charCount: number;
  recommendedRange: { min: number; max: number };
  isInRange: boolean;
  matchedKeywords: Array<{ keyword: string; viralRate: number }>;
  suggestions: string[];
}> {
  const charCount = text.length;
  
  // 根據內容長度推測類型並給出建議範圍
  let recommendedRange = { min: 150, max: 400 };
  
  // 從內容中匹配關鍵字
  const matchedKeywords = await db.findMatchingKeywords(text);
  
  const suggestions: string[] = [];
  
  // 字數建議
  if (charCount < recommendedRange.min) {
    suggestions.push(`字數偏少（${charCount} 字），建議增加到 ${recommendedRange.min}-${recommendedRange.max} 字`);
  } else if (charCount > recommendedRange.max) {
    suggestions.push(`字數偏多（${charCount} 字），建議精簡到 ${recommendedRange.min}-${recommendedRange.max} 字`);
  }
  
  // 關鍵字建議
  if (matchedKeywords.length > 0) {
    const topKeyword = matchedKeywords[0];
    if (topKeyword.viralRate && topKeyword.viralRate > 10) {
      suggestions.push(`你的內容包含高爆文率關鍵字「${topKeyword.keyword}」（爆文率 ${topKeyword.viralRate}%），很好！`);
    }
  } else {
    suggestions.push('建議加入熱門關鍵字，例如：經營自己、個人品牌、時間管理');
  }
  
  return {
    charCount,
    recommendedRange,
    isInRange: charCount >= recommendedRange.min && charCount <= recommendedRange.max,
    matchedKeywords: matchedKeywords.map(k => ({
      keyword: k.keyword,
      viralRate: k.viralRate || 0,
    })),
    suggestions,
  };
}

export async function executeContentHealthCheck(userId: number, text: string) {
  console.log('[executeContentHealthCheck] Starting for user:', userId);
  console.log('[executeContentHealthCheck] Text length:', text.length);
  
  try {
    // 1. 數據驅動的開頭效果分析（不需要 LLM）
    console.log('[executeContentHealthCheck] Analyzing opener with data...');
    const openerAnalysis = analyzeOpenerWithData(text);
    console.log('[executeContentHealthCheck] Opener analysis:', openerAnalysis);
    
    // 2. 與爆款數據對比
    console.log('[executeContentHealthCheck] Comparing with viral data...');
    const viralComparison = await compareWithViralData(text);
    console.log('[executeContentHealthCheck] Viral comparison:', viralComparison);
    
    // 3. LLM 評分
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
    
    // 計算四透鏡的各子維度分數
    const emotionScore = Math.round(aiResult.fourlens_score * 0.25);
    const personaScore = Math.round(aiResult.fourlens_score * 0.25);
    const structureScore = Math.round(aiResult.fourlens_score * 0.25);
    const conversionScore = Math.round(aiResult.fourlens_score * 0.25);
    
    // 根據數據驅動分析調整 Hook 分數
    // 如果開頭效果倍數高，給予額外加分
    let adjustedHookScore = Math.round(aiResult.hook_score);
    if (openerAnalysis.effectMultiplier >= 2.0) {
      adjustedHookScore = Math.min(25, adjustedHookScore + 3);
    } else if (openerAnalysis.effectMultiplier < 1.0) {
      adjustedHookScore = Math.max(0, adjustedHookScore - 3);
    }
    
    // 組合所有建議
    const allSuggestions = [
      ...openerAnalysis.suggestions,
      ...viralComparison.suggestions,
    ];
    
    // 轉換為前端期望的格式
    const result = {
      scores: {
        hook: adjustedHookScore,
        translation: Math.round(aiResult.translation_score),
        tone: Math.round(aiResult.tone_score),
        cta: Math.round(aiResult.cta_score),
        fourLens: Math.round(aiResult.fourlens_score),
      },
      totalScore: Math.round(
        adjustedHookScore + 
        aiResult.translation_score + 
        aiResult.tone_score + 
        aiResult.cta_score + 
        aiResult.fourlens_score
      ),
      maxScores: MAX_SCORES,
      fourLensScores: {
        emotion: emotionScore,
        persona: personaScore,
        structure: structureScore,
        conversion: conversionScore,
      },
      fourLensMaxScores: {
        emotion: 8,
        persona: 8,
        structure: 8,
        conversion: 6,
      },
      // 數據驅動的開頭效果分析（新增）
      openerAnalysis: {
        openerText: openerAnalysis.openerText,
        effectMultiplier: openerAnalysis.effectMultiplier,
        grade: openerAnalysis.grade,
        matchedPatterns: openerAnalysis.matchedPatterns,
        lowEffectPatterns: openerAnalysis.lowEffectPatterns,
        suggestions: openerAnalysis.suggestions,
      },
      // 與爆款數據對比（新增）
      viralComparison: {
        charCount: viralComparison.charCount,
        recommendedRange: viralComparison.recommendedRange,
        isInRange: viralComparison.isInRange,
        matchedKeywords: viralComparison.matchedKeywords,
        suggestions: viralComparison.suggestions,
      },
      hook: {
        hasContrastOpener: aiResult.hook_score >= 15,
        hasObservationQuestion: aiResult.hook_score >= 10,
        hasSuspense: aiResult.hook_score >= 5,
        openerType: openerAnalysis.matchedPatterns.length > 0 
          ? openerAnalysis.matchedPatterns[0].name 
          : (openerAnalysis.lowEffectPatterns.length > 0 ? openerAnalysis.lowEffectPatterns[0].name : 'unknown'),
        openerContent: openerAnalysis.openerText,
        deductionReason: openerAnalysis.matchedPatterns.length > 0
          ? `使用了「${openerAnalysis.matchedPatterns[0].name}」（效果 ${openerAnalysis.matchedPatterns[0].multiplier}x）`
          : (openerAnalysis.lowEffectPatterns.length > 0 
            ? `使用了「${openerAnalysis.lowEffectPatterns[0].name}」（效果只有 ${openerAnalysis.lowEffectPatterns[0].multiplier}x）`
            : `得分 ${adjustedHookScore}/25`),
        advice: openerAnalysis.suggestions.length > 0 
          ? openerAnalysis.suggestions[0] 
          : aiResult.hook_advice || '需要改進',
        // 數據驅動的效果倍數
        effectMultiplier: openerAnalysis.effectMultiplier,
        effectGrade: openerAnalysis.grade,
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
        hasTargetAudienceCall: aiResult.cta_score >= 5,
        ctaType: 'inferred',
        ctaContent: 'N/A',
        targetAudience: 'N/A',
        deductionReason: `得分 ${Math.round(aiResult.cta_score)}/10`,
        advice: aiResult.cta_advice || '需要改進',
      },
      fourLens: {
        emotion: {
          isDesireOriented: aiResult.fourlens_score >= 20,
          emotionType: 'inferred',
          deductionReason: `得分 ${emotionScore}/8`,
          advice: aiResult.fourlens_advice || '需要改進',
        },
        persona: {
          isConsistent: aiResult.fourlens_score >= 15,
          hasPersonalTouch: aiResult.fourlens_score >= 15,
          deductionReason: `得分 ${personaScore}/8`,
          advice: aiResult.fourlens_advice || '需要改進',
        },
        structure: {
          isEasyToAbsorb: aiResult.fourlens_score >= 15,
          hasLogicalFlow: aiResult.fourlens_score >= 15,
          deductionReason: `得分 ${structureScore}/8`,
          advice: aiResult.fourlens_advice || '需要改進',
        },
        conversion: {
          hasNextStep: aiResult.fourlens_score >= 10,
          isActionable: aiResult.fourlens_score >= 10,
          deductionReason: `得分 ${conversionScore}/6`,
          advice: aiResult.fourlens_advice || '需要改進',
        },
      },
      redlineMarks: [],
      overallAdvice: allSuggestions.length > 0 
        ? allSuggestions.join('\n') 
        : aiResult.overall_advice || '需要改進',
      // 數據驅動的綜合建議（新增）
      dataDrivenSuggestions: allSuggestions,
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
