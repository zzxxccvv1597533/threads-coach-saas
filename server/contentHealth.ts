/**
 * 內容健康檢測服務
 * 
 * 功能：
 * 1. quickDetect - 快速 AI 痕跡檢測
 * 2. contentHealthCheck - 完整內容健康檢查
 * 3. autoGuardrail - 自動修正迴圈
 * 4. humanize - 人味化潤飾
 */

import { invokeLLM } from "./_core/llm";
import { checkStylePolish } from "./embedding";
import { getUserPreferenceContext, type UserPreferenceContext } from "./userInteraction";

// ============================================
// AI 痕跡檢測
// ============================================

interface AiTraceResult {
  score: number; // 0-100，越高越像 AI
  confidence: number; // 信心度
  traces: Array<{
    type: string;
    text: string;
    suggestion: string;
  }>;
  overallAssessment: string;
}

/**
 * 快速 AI 痕跡檢測
 * 使用規則匹配 + 輕量 LLM 判斷
 */
export async function quickDetect(content: string): Promise<AiTraceResult> {
  const traces: AiTraceResult["traces"] = [];
  let score = 0;

  // 規則匹配檢測
  const ruleResults = detectByRules(content);
  traces.push(...ruleResults.traces);
  score += ruleResults.score;

  // 如果規則匹配分數較高，進行 LLM 深度檢測
  if (score > 30) {
    const llmResults = await detectByLLM(content);
    traces.push(...llmResults.traces);
    score = Math.min(100, score + llmResults.score);
  }

  return {
    score: Math.min(100, score),
    confidence: traces.length > 0 ? 0.8 : 0.6,
    traces,
    overallAssessment: getOverallAssessment(score),
  };
}

/**
 * 規則匹配檢測
 */
function detectByRules(content: string): { score: number; traces: AiTraceResult["traces"] } {
  const traces: AiTraceResult["traces"] = [];
  let score = 0;

  // 常見 AI 開頭模式
  const aiOpenings = [
    { pattern: /^在這個.*的時代/, type: "ai_opening", weight: 15 },
    { pattern: /^作為一個/, type: "ai_opening", weight: 15 },
    { pattern: /^讓我們一起/, type: "ai_opening", weight: 12 },
    { pattern: /^你有沒有想過/, type: "ai_opening", weight: 8 },
    { pattern: /^不得不說/, type: "ai_phrase", weight: 10 },
    { pattern: /^說實話/, type: "ai_phrase", weight: 8 },
  ];

  for (const { pattern, type, weight } of aiOpenings) {
    const match = content.match(pattern);
    if (match) {
      traces.push({
        type,
        text: match[0],
        suggestion: getReplacementSuggestion(type, match[0]),
      });
      score += weight;
    }
  }

  // 常見 AI 句型
  const aiPatterns = [
    { pattern: /首先[\s\S]*其次[\s\S]*最後/, type: "ai_structure", weight: 20 },
    { pattern: /第一[\s\S]*第二[\s\S]*第三/, type: "ai_structure", weight: 15 },
    { pattern: /不僅[\s\S]*而且[\s\S]*更/, type: "ai_structure", weight: 10 },
    { pattern: /一方面[\s\S]*另一方面/, type: "ai_structure", weight: 12 },
    { pattern: /總而言之/, type: "ai_phrase", weight: 10 },
    { pattern: /綜上所述/, type: "ai_phrase", weight: 12 },
    { pattern: /值得一提的是/, type: "ai_phrase", weight: 10 },
    { pattern: /不可否認/, type: "ai_phrase", weight: 8 },
  ];

  for (const { pattern, type, weight } of aiPatterns) {
    const match = content.match(pattern);
    if (match) {
      traces.push({
        type,
        text: match[0],
        suggestion: getReplacementSuggestion(type, match[0]),
      });
      score += weight;
    }
  }

  // 過多感嘆號
  const exclamationCount = (content.match(/！/g) || []).length;
  if (exclamationCount > 3) {
    traces.push({
      type: "excessive_punctuation",
      text: `使用了 ${exclamationCount} 個感嘆號`,
      suggestion: "建議減少感嘆號使用，每段最多 1 個",
    });
    score += Math.min(15, exclamationCount * 3);
  }

  // 過長句子
  const sentences = content.split(/[。！？]/);
  const longSentences = sentences.filter((s) => s.length > 50);
  if (longSentences.length > 0) {
    traces.push({
      type: "long_sentence",
      text: `有 ${longSentences.length} 個句子超過 50 字`,
      suggestion: "建議拆分長句，增加閱讀節奏感",
    });
    score += longSentences.length * 5;
  }

  return { score, traces };
}

/**
 * LLM 深度檢測
 */
async function detectByLLM(content: string): Promise<{ score: number; traces: AiTraceResult["traces"] }> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一個專業的 AI 痕跡檢測專家。請分析以下內容是否有明顯的 AI 生成痕跡。

請以 JSON 格式回覆：
{
  "score": 0-50 的分數，越高越像 AI,
  "traces": [
    {
      "type": "ai_phrase|ai_structure|ai_tone|unnatural",
      "text": "問題文字",
      "suggestion": "修改建議"
    }
  ]
}

只回覆 JSON，不要其他文字。`,
        },
        {
          role: "user",
          content: content,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ai_trace_detection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score: { type: "number" },
              traces: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    text: { type: "string" },
                    suggestion: { type: "string" },
                  },
                  required: ["type", "text", "suggestion"],
                  additionalProperties: false,
                },
              },
            },
            required: ["score", "traces"],
            additionalProperties: false,
          },
        },
      },
    });

    const messageContent = response.choices[0].message.content;
    const result = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");
    return {
      score: result.score || 0,
      traces: result.traces || [],
    };
  } catch (error) {
    console.error("[ContentHealth] LLM detection error:", error);
    return { score: 0, traces: [] };
  }
}

/**
 * 獲取替換建議
 */
function getReplacementSuggestion(type: string, text: string): string {
  const suggestions: Record<string, string> = {
    ai_opening: "建議使用更自然的開頭，例如直接描述場景或提出問題",
    ai_phrase: "建議移除或替換為更口語化的表達",
    ai_structure: "建議打散列舉結構，用故事或對話方式呈現",
    excessive_punctuation: "建議減少感嘆號，用文字本身傳達情緒",
    long_sentence: "建議拆分成 2-3 個短句，增加閱讀節奏",
  };
  return suggestions[type] || "建議修改為更自然的表達";
}

/**
 * 獲取整體評估
 */
function getOverallAssessment(score: number): string {
  if (score < 20) return "內容自然度高，AI 痕跡不明顯";
  if (score < 40) return "有輕微 AI 痕跡，建議微調";
  if (score < 60) return "AI 痕跡較明顯，建議修改標記處";
  if (score < 80) return "AI 痕跡明顯，建議重新潤飾";
  return "AI 痕跡非常明顯，建議重寫";
}

// ============================================
// 完整內容健康檢查
// ============================================

interface ContentHealthResult {
  isHealthy: boolean;
  overallScore: number; // 0-100，越高越健康
  checks: {
    aiTrace: AiTraceResult;
    readability: ReadabilityResult;
    engagement: EngagementResult;
    brandSafety: BrandSafetyResult;
  };
  recommendations: string[];
}

interface ReadabilityResult {
  score: number;
  avgSentenceLength: number;
  paragraphCount: number;
  hasBreathingSpace: boolean;
}

interface EngagementResult {
  score: number;
  hasHook: boolean;
  hasCta: boolean;
  emotionalAppeal: number;
}

interface BrandSafetyResult {
  score: number;
  issues: string[];
}

/**
 * 完整內容健康檢查
 */
export async function contentHealthCheck(
  content: string,
  options?: {
    userId?: number;
    contentType?: string;
  }
): Promise<ContentHealthResult> {
  // AI 痕跡檢測
  const aiTrace = await quickDetect(content);

  // 可讀性檢查
  const readability = checkReadability(content);

  // 互動性檢查
  const engagement = checkEngagement(content);

  // 品牌安全檢查
  const brandSafety = checkBrandSafety(content);

  // 計算整體分數
  const overallScore = Math.round(
    (100 - aiTrace.score) * 0.3 +
    readability.score * 0.25 +
    engagement.score * 0.25 +
    brandSafety.score * 0.2
  );

  // 生成建議
  const recommendations = generateRecommendations({
    aiTrace,
    readability,
    engagement,
    brandSafety,
  });

  return {
    isHealthy: overallScore >= 70 && aiTrace.score < 40,
    overallScore,
    checks: {
      aiTrace,
      readability,
      engagement,
      brandSafety,
    },
    recommendations,
  };
}

/**
 * 可讀性檢查
 */
function checkReadability(content: string): ReadabilityResult {
  const sentences = content.split(/[。！？]/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const hasBreathingSpace = paragraphs.length >= 3 || content.includes("\n");

  let score = 100;

  // 句子長度扣分
  if (avgSentenceLength > 40) score -= 20;
  else if (avgSentenceLength > 30) score -= 10;

  // 段落數扣分
  if (paragraphs.length < 2) score -= 15;

  // 呼吸感扣分
  if (!hasBreathingSpace) score -= 15;

  return {
    score: Math.max(0, score),
    avgSentenceLength,
    paragraphCount: paragraphs.length,
    hasBreathingSpace,
  };
}

/**
 * 互動性檢查
 */
function checkEngagement(content: string): EngagementResult {
  let score = 50; // 基礎分

  // 檢查是否有吸引人的開頭
  const hasHook = /^[「『"]|^[^\s]{1,10}[？?！!]|^我|^你/.test(content);
  if (hasHook) score += 20;

  // 檢查是否有 CTA
  const hasCta = /留言|分享|按讚|追蹤|私訊|點擊|連結|你呢|你覺得|告訴我/.test(content);
  if (hasCta) score += 15;

  // 檢查情緒詞
  const emotionWords = [
    "開心", "難過", "感動", "驚訝", "生氣", "害怕", "期待", "失望",
    "興奮", "緊張", "放鬆", "焦慮", "幸福", "痛苦", "感謝", "後悔",
  ];
  const emotionCount = emotionWords.filter((w) => content.includes(w)).length;
  const emotionalAppeal = Math.min(100, emotionCount * 20);
  score += emotionalAppeal * 0.15;

  return {
    score: Math.min(100, Math.round(score)),
    hasHook,
    hasCta,
    emotionalAppeal,
  };
}

/**
 * 品牌安全檢查
 */
function checkBrandSafety(content: string): BrandSafetyResult {
  const issues: string[] = [];
  let score = 100;

  // 敏感詞檢查
  const sensitiveWords = [
    { word: "保證", weight: 10 },
    { word: "絕對", weight: 10 },
    { word: "一定", weight: 5 },
    { word: "最好", weight: 5 },
    { word: "第一", weight: 5 },
    { word: "唯一", weight: 10 },
    { word: "免費", weight: 5 },
    { word: "限時", weight: 5 },
  ];

  for (const { word, weight } of sensitiveWords) {
    if (content.includes(word)) {
      issues.push(`包含敏感詞「${word}」`);
      score -= weight;
    }
  }

  // 過度承諾檢查
  if (/保證.*效果|一定.*成功|絕對.*有效/.test(content)) {
    issues.push("包含過度承諾的表述");
    score -= 20;
  }

  return {
    score: Math.max(0, score),
    issues,
  };
}

/**
 * 生成建議
 */
function generateRecommendations(checks: {
  aiTrace: AiTraceResult;
  readability: ReadabilityResult;
  engagement: EngagementResult;
  brandSafety: BrandSafetyResult;
}): string[] {
  const recommendations: string[] = [];

  // AI 痕跡建議
  if (checks.aiTrace.score >= 40) {
    recommendations.push("建議修改 AI 痕跡明顯的句子，使用更口語化的表達");
    for (const trace of checks.aiTrace.traces.slice(0, 3)) {
      recommendations.push(`- ${trace.suggestion}`);
    }
  }

  // 可讀性建議
  if (checks.readability.avgSentenceLength > 35) {
    recommendations.push("建議縮短句子長度，增加閱讀節奏感");
  }
  if (!checks.readability.hasBreathingSpace) {
    recommendations.push("建議增加段落分隔，創造「呼吸感」");
  }

  // 互動性建議
  if (!checks.engagement.hasHook) {
    recommendations.push("建議優化開頭，使用提問、場景描述或對話引入");
  }
  if (!checks.engagement.hasCta) {
    recommendations.push("建議在結尾加入互動引導，如提問或邀請留言");
  }

  // 品牌安全建議
  if (checks.brandSafety.issues.length > 0) {
    recommendations.push("建議修改敏感詞，避免過度承諾");
  }

  return recommendations;
}

// ============================================
// 自動修正迴圈
// ============================================

interface AutoGuardrailResult {
  success: boolean;
  originalContent: string;
  finalContent: string;
  iterations: number;
  healthChecks: ContentHealthResult[];
  preservedSemantic: boolean;
}

/**
 * 自動修正迴圈
 * 最多執行 2 次修正，避免無限迴圈
 */
export async function autoGuardrail(
  content: string,
  options?: {
    userId?: number;
    maxIterations?: number;
    targetScore?: number;
    preservedWords?: string[];
  }
): Promise<AutoGuardrailResult> {
  const maxIterations = options?.maxIterations ?? 2;
  const targetScore = options?.targetScore ?? 70;
  const preservedWords = options?.preservedWords ?? [];

  let currentContent = content;
  const healthChecks: ContentHealthResult[] = [];
  let iterations = 0;

  // 初始健康檢查
  let healthCheck = await contentHealthCheck(currentContent, { userId: options?.userId });
  healthChecks.push(healthCheck);

  // 如果已經健康，直接返回
  if (healthCheck.isHealthy && healthCheck.overallScore >= targetScore) {
    return {
      success: true,
      originalContent: content,
      finalContent: currentContent,
      iterations: 0,
      healthChecks,
      preservedSemantic: true,
    };
  }

  // 修正迴圈
  while (iterations < maxIterations && !healthCheck.isHealthy) {
    iterations++;

    // 執行人味化潤飾
    const humanized = await humanize(currentContent, {
      traces: healthCheck.checks.aiTrace.traces,
      recommendations: healthCheck.recommendations,
    });

    // 檢查語意保真
    const semanticCheck = await checkStylePolish(
      content,
      humanized,
      preservedWords,
      0.80,
      0.60
    );

    if (!semanticCheck.isPreserved) {
      console.warn("[ContentHealth] Semantic drift detected, stopping guardrail");
      break;
    }

    currentContent = humanized;

    // 重新健康檢查
    healthCheck = await contentHealthCheck(currentContent, { userId: options?.userId });
    healthChecks.push(healthCheck);
  }

  // 最終語意保真檢查
  const finalSemanticCheck = await checkStylePolish(
    content,
    currentContent,
    preservedWords,
    0.75,
    0.50
  );

  return {
    success: healthCheck.isHealthy || healthCheck.overallScore >= targetScore,
    originalContent: content,
    finalContent: currentContent,
    iterations,
    healthChecks,
    preservedSemantic: finalSemanticCheck.isPreserved,
  };
}

// ============================================
// 人味化潤飾
// ============================================

/**
 * 人味化潤飾
 */
async function humanize(
  content: string,
  context: {
    traces: AiTraceResult["traces"];
    recommendations: string[];
  }
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一個專業的文案潤飾專家。請將以下內容進行人味化潤飾，使其更自然、更像真人寫的。

【潤飾原則】
1. 保留原意和核心資訊
2. 移除 AI 痕跡明顯的句型
3. 使用更口語化的表達
4. 保持原有的情感基調
5. 不要改變事實性內容

【需要修改的問題】
${context.traces.map((t) => `- ${t.text}: ${t.suggestion}`).join("\n")}

【建議】
${context.recommendations.join("\n")}

請直接輸出潤飾後的內容，不要加任何說明。`,
        },
        {
          role: "user",
          content: content,
        },
      ],
    });

    const messageContent = response.choices[0].message.content;
    return typeof messageContent === 'string' ? messageContent : content;
  } catch (error) {
    console.error("[ContentHealth] Humanize error:", error);
    return content;
  }
}

// ============================================
// 動態 Humanizer 規則
// ============================================

interface HumanizerConfig {
  strictness: "strict" | "moderate" | "relaxed";
  rules: string[];
  thresholds: {
    aiTraceScore: number;
    minReadabilityScore: number;
    maxSentenceLength: number;
  };
}

/**
 * 根據用戶階段獲取 Humanizer 配置
 */
export async function getHumanizerConfig(userId: number): Promise<HumanizerConfig> {
  const preferenceContext = await getUserPreferenceContext(userId);

  if (!preferenceContext) {
    // 默認使用嚴格模式
    return getHumanizerConfigByStrictness("strict");
  }

  return getHumanizerConfigByStrictness(preferenceContext.humanizerStrictness);
}

/**
 * 根據嚴格度獲取 Humanizer 配置
 */
export function getHumanizerConfigByStrictness(
  strictness: "strict" | "moderate" | "relaxed"
): HumanizerConfig {
  const configs: Record<typeof strictness, HumanizerConfig> = {
    strict: {
      strictness: "strict",
      rules: [
        "禁止使用「在這個...的時代」開頭",
        "禁止使用「作為一個...」自我介紹",
        "禁止使用「讓我們一起...」號召語氣",
        "禁止使用「其實」「事實上」「說白了」等轉折詞",
        "禁止使用「非常」「特別」「真的很」等程度副詞",
        "每個句子不超過 30 字",
        "每段最多 1 個感嘆號",
        "避免使用成語和四字詞組",
      ],
      thresholds: {
        aiTraceScore: 30,
        minReadabilityScore: 80,
        maxSentenceLength: 30,
      },
    },
    moderate: {
      strictness: "moderate",
      rules: [
        "禁止使用「在這個...的時代」開頭",
        "禁止使用「作為一個...」自我介紹",
        "禁止使用「讓我們一起...」號召語氣",
        "限制使用「其實」「事實上」（每篇最多 1 次）",
        "限制使用程度副詞（每段最多 2 個）",
        "句子長度可適度放寬至 40 字",
      ],
      thresholds: {
        aiTraceScore: 50,
        minReadabilityScore: 70,
        maxSentenceLength: 40,
      },
    },
    relaxed: {
      strictness: "relaxed",
      rules: [
        "禁止使用「在這個...的時代」開頭",
        "禁止使用「作為一個...」自我介紹",
        "禁止使用「讓我們一起...」號召語氣",
        "允許用戶的個人風格表達",
        "尊重用戶的創作自由",
      ],
      thresholds: {
        aiTraceScore: 70,
        minReadabilityScore: 60,
        maxSentenceLength: 50,
      },
    },
  };

  return configs[strictness];
}

// ============================================
// 導出
// ============================================

export type {
  AiTraceResult,
  ContentHealthResult,
  AutoGuardrailResult,
  HumanizerConfig,
};
