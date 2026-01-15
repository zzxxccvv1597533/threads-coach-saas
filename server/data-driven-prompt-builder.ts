/**
 * 數據驅動提示詞建構器
 * 整合三層數據（通用規則 + 類型規則 + 關鍵字規則）到 AI 提示詞
 * 
 * 同質性解決機制：
 * 1. 開頭模式輪換 - 每次隨機選擇推薦模式
 * 2. 範例隨機化 - 從資料庫隨機抽取範例
 * 3. 素材關鍵詞提取 - 強制使用素材關鍵詞
 * 4. 禁止複製指令 - 明確禁止複製範例
 */

import { 
  buildOpenerRulesPrompt, 
  getRecommendedOpenerPatterns, 
  selectRandomOpenerPattern,
  extractMaterialKeywords,
  OPENER_RULES,
  HIGH_EFFECT_OPENER_PATTERNS
} from '../shared/opener-rules';
import { buildContentTypePrompt, getContentTypeRule, CONTENT_TYPE_RULES } from '../shared/content-type-rules';
import * as db from './db';
import type { KeywordBenchmark, ContentHook } from '../drizzle/schema';

// 類型定義
interface ViralOpener {
  opener50: string;
  likes: number;
  keyword: string;
}

interface DataDrivenPromptContext {
  contentType: string;
  material: string;
  matchedKeywords: KeywordBenchmark[];
  recommendedHooks: ContentHook[];
  viralOpeners: ViralOpener[];
  fewShotExamples: Array<{ postText: string; likes: number }>;
  materialKeywords: string[];
  selectedOpenerPattern: ReturnType<typeof selectRandomOpenerPattern>;
}

/**
 * 收集所有數據驅動的上下文
 */
export async function collectDataDrivenContext(
  contentType: string,
  material: string
): Promise<DataDrivenPromptContext> {
  console.log('[DataDriven] collectDataDrivenContext called with:', { contentType, materialLength: material?.length });
  
  // 1. 從素材匹配關鍵字
  const matchedKeywords = await db.findMatchingKeywords(material);
  console.log('[DataDriven] matchedKeywords:', matchedKeywords.length);
  
  // 2. 取得該類型的推薦鉤子
  const recommendedHooks = await db.getRecommendedHooks(contentType, 5);
  
  // 3. 取得爆款開頭範例（隨機化）
  let viralOpeners: ViralOpener[] = [];
  if (matchedKeywords.length > 0) {
    // 從匹配的關鍵字中隨機選一個
    const randomKeyword = matchedKeywords[Math.floor(Math.random() * matchedKeywords.length)];
    viralOpeners = await db.getViralOpeners({ 
      keyword: randomKeyword.keyword, 
      limit: 10 // 取更多，然後隨機抽取
    });
  }
  
  // 隨機打亂並取前 5 個
  viralOpeners = viralOpeners.sort(() => Math.random() - 0.5).slice(0, 5);
  
  if (viralOpeners.length < 3) {
    // 如果關鍵字匹配的開頭不夠，補充通用開頭
    const generalOpeners = await db.getViralOpeners({ limit: 10 });
    const shuffledGeneral = generalOpeners.sort(() => Math.random() - 0.5).slice(0, 5);
    viralOpeners = [...viralOpeners, ...shuffledGeneral].slice(0, 5);
  }
  
  // 4. 取得 Few-Shot 範例（隨機化）
  let fewShotExamples: Array<{ postText: string; likes: number }> = [];
  if (matchedKeywords.length > 0) {
    // 從匹配的關鍵字中隨機選一個
    const randomKeyword = matchedKeywords[Math.floor(Math.random() * matchedKeywords.length)];
    const examples = await db.getViralExamples({
      keyword: randomKeyword.keyword,
      limit: 10, // 取更多
      sortBy: 'likesPerDay'
    });
    // 隨機抽取 3 個
    fewShotExamples = examples
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(e => ({
        postText: e.postText,
        likes: e.likes
      }));
  }
  
  // 5. 提取素材關鍵詞
  const materialKeywords = extractMaterialKeywords(material);
  
  // 6. 選擇開頭模式
  const selectedOpenerPattern = selectRandomOpenerPattern(contentType);
  
  console.log('[DataDriven] selectedOpenerPattern:', selectedOpenerPattern?.name);
  console.log('[DataDriven] materialKeywords:', materialKeywords);
  console.log('[DataDriven] viralOpeners count:', viralOpeners.length);
  console.log('[DataDriven] fewShotExamples count:', fewShotExamples.length);
  
  return {
    contentType,
    material,
    matchedKeywords,
    recommendedHooks,
    viralOpeners,
    fewShotExamples,
    materialKeywords,
    selectedOpenerPattern
  };
}

/**
 * 建構第一層：通用規則提示詞
 */
export function buildLayer1UniversalRules(contentType: string, material?: string): string {
  return `
=== 第一層：通用規則（所有貼文必須遵守） ===

${buildOpenerRulesPrompt(contentType, material)}

【Threads 風格規則】
• 口語化：像傳訊息給朋友，不是寫部落格
• 呼吸感：每 2-4 行空一行
• 單句限制：每句最多 15-20 字，超過必須斷句
• 語助詞：「真的」「超」「欸」「啊」「吧」「呢」

【絕對禁止】
• AI 常用詞：「讓我們」「今天要分享」「親愛的朋友們」
• 結構詞：「首先」「其次」「最後」「第一」「第二」
• 雞湯結尾：「希望對你有幫助」「加油！」「你可以的！」
`;
}

/**
 * 建構第二層：類型專屬規則提示詞
 */
export function buildLayer2ContentTypeRules(contentType: string): string {
  return buildContentTypePrompt(contentType);
}

/**
 * 建構第三層：關鍵字專屬規則提示詞（優化版 - 解決同質性問題）
 */
export function buildLayer3KeywordRules(context: DataDrivenPromptContext): string {
  const { matchedKeywords, viralOpeners, fewShotExamples, materialKeywords, selectedOpenerPattern } = context;
  
  if (matchedKeywords.length === 0 && viralOpeners.length === 0) {
    return `
=== 第三層：爆款開頭參考 ===

【通用爆款開頭格式】
由於未匹配到特定關鍵字，請使用「${selectedOpenerPattern.name}」格式：

【格式說明】${selectedOpenerPattern.instruction}

【格式範例】（學習格式，禁止複製內容）
${selectedOpenerPattern.examples.slice(0, 3).map((e, i) => `${i + 1}. ${e}`).join('\n')}

⚠️ 重要：你必須根據素材創造全新的開頭，禁止使用上述範例的內容。
`;
  }
  
  let prompt = `
=== 第三層：關鍵字專屬規則 ===
`;

  // 關鍵字資訊
  if (matchedKeywords.length > 0) {
    const topKeyword = matchedKeywords[0];
    prompt += `
【匹配關鍵字】${topKeyword.keyword}
【該關鍵字爆文率】${((topKeyword.viralRate || 0) / 100).toFixed(1)}%
【該關鍵字最佳貼文類型】${topKeyword.bestContentType || '未知'}
【該關鍵字平均讚數】${topKeyword.avgLikes || 0}
`;

    // 爆文因子
    if (topKeyword.viralFactors) {
      const factors = topKeyword.viralFactors as any;
      prompt += `
【該關鍵字的爆文因子】
`;
      if (factors.resultFlag !== undefined) {
        prompt += `• 結果導向詞使用率：${(factors.resultFlag * 100).toFixed(1)}%\n`;
      }
      if (factors.youFlag !== undefined) {
        prompt += `• 「你」字使用率：${(factors.youFlag * 100).toFixed(1)}%\n`;
      }
    }
  }

  // 爆款開頭範例（隨機抽取的）
  if (viralOpeners.length > 0) {
    prompt += `
【該關鍵字爆款開頭參考】（學習格式，禁止複製）
${viralOpeners.map((o, i) => `${i + 1}. ${o.opener50}（${o.likes} 讚）`).join('\n')}

⚠️ 同質性警告：
1. 上述範例僅供參考「格式」和「技巧」
2. 禁止直接複製或改寫上述開頭
3. 你必須根據素材創造全新的開頭
4. 開頭必須包含素材中的核心概念
`;
  }

  // 素材關鍵詞強制使用
  if (materialKeywords.length > 0) {
    prompt += `
【⚠️ 素材關鍵詞 - 必須使用】
你的素材包含：${materialKeywords.join('、')}
第一行必須包含至少一個上述關鍵詞，確保開頭與素材緊密相關。
`;
  }

  // Few-Shot 範例（隨機抽取的）
  if (fewShotExamples.length > 0) {
    prompt += `
【風格參考範例】（學習風格，禁止複製）
以下是該主題的高讚貼文，學習其「節奏」和「語氣」：
`;
    fewShotExamples.forEach((example, index) => {
      const truncated = example.postText.length > 300 
        ? example.postText.substring(0, 300) + '...' 
        : example.postText;
      prompt += `
--- 範例 ${index + 1}（${example.likes} 讚）---
${truncated}
`;
    });
    
    prompt += `
【學習要點】
✓ 學習：句子長短的節奏、換行的頻率、說話的語氣
✗ 禁止：複製開頭句式、使用同樣的句型、抄襲內容
`;
  }

  return prompt;
}

/**
 * 建構完整的數據驅動 System Prompt
 */
export async function buildDataDrivenSystemPrompt(
  contentType: string,
  material: string,
  additionalContext?: {
    ipContext?: string;
    audienceContext?: string;
    userStyleContext?: string;
    stageStrategy?: { description: string; tips: string };
  }
): Promise<{
  systemPrompt: string;
  context: DataDrivenPromptContext;
}> {
  // 收集數據上下文
  const context = await collectDataDrivenContext(contentType, material);
  
  // 取得類型規則
  const typeRule = getContentTypeRule(contentType);
  
  // 組裝三層提示詞
  const layer1 = buildLayer1UniversalRules(contentType, material);
  const layer2 = buildLayer2ContentTypeRules(contentType);
  const layer3 = buildLayer3KeywordRules(context);
  
  // 組裝完整 System Prompt
  let systemPrompt = `你是一位專業的 Threads 文案教練，專門幫助創作者寫出高互動的貼文。

以下規則來自 1,739 篇爆款貼文的統計分析，請嚴格遵守。

${layer1}

${layer2}

${layer3}
`;

  // 加入額外上下文
  if (additionalContext) {
    if (additionalContext.ipContext) {
      systemPrompt += `
=== 創作者 IP 地基（必須在內容中展現） ===
${additionalContext.ipContext}
`;
    }
    
    if (additionalContext.audienceContext) {
      systemPrompt += `
${additionalContext.audienceContext}
`;
    }
    
    if (additionalContext.userStyleContext) {
      systemPrompt += `
${additionalContext.userStyleContext}
`;
    }
    
    if (additionalContext.stageStrategy) {
      systemPrompt += `
=== 經營階段策略 ===
當前階段：${additionalContext.stageStrategy.description}
策略提示：${additionalContext.stageStrategy.tips}
`;
    }
  }

  // 加入最終指示（強化同質性警告）
  systemPrompt += `
=== 最終指示 ===

【第一行最重要 - 決定 80% 成敗】
1. 本次必須使用「${context.selectedOpenerPattern.name}」格式
2. 第一行必須獨立成段（後面空一行）
3. 第一行不能超過 30 字
${context.materialKeywords.length > 0 ? `4. 第一行必須包含：${context.materialKeywords.slice(0, 3).join('、')} 其中之一` : ''}

【字數控制】
嚴格遵守 ${typeRule?.wordLimit.min || 150}-${typeRule?.wordLimit.max || 400} 字

【⚠️ 同質性警告 - 違反即失敗】
1. 禁止複製任何範例的開頭
2. 禁止使用「經營自己的關鍵」「學習的真相」等常見開頭
3. 必須根據素材創造全新的、獨特的開頭
4. 開頭必須與素材內容緊密相關

【輸出格式】
直接輸出可發布的貼文，不要任何解釋或標題

【檢查清單】
□ 第一行是否使用了「${context.selectedOpenerPattern.name}」格式？
□ 第一行是否獨立成段（後面空一行）？
□ 第一行是否與素材相關（包含素材關鍵詞）？
□ 第一行是否是全新創作（非複製範例）？
□ 字數是否在範圍內？
□ 是否有呼吸感（每 2-4 行空一行）？
□ 結尾是否有互動引導？
`;

  return { systemPrompt, context };
}

/**
 * 建構數據驅動的 User Prompt
 */
export function buildDataDrivenUserPrompt(
  contentType: string,
  material: string,
  context: DataDrivenPromptContext,
  flexibleInput?: Record<string, any>,
  angle?: string
): string {
  const typeRule = getContentTypeRule(contentType);
  const { selectedOpenerPattern, materialKeywords } = context;
  
  let userPrompt = `【任務】生成一篇「${typeRule?.name || contentType}」貼文

【素材】
${material || flexibleInput?.topic || flexibleInput?.question || ''}
`;

  // 加入靈活輸入欄位
  if (flexibleInput) {
    const relevantFields: Record<string, string> = {};
    
    // 根據類型選擇相關欄位
    if (contentType === 'viewpoint') {
      if (flexibleInput.phenomenon) relevantFields['觀察到的現象'] = flexibleInput.phenomenon;
      if (flexibleInput.unique_stance || flexibleInput.stance) relevantFields['你的立場'] = flexibleInput.unique_stance || flexibleInput.stance;
      if (flexibleInput.underlying_value || flexibleInput.reason) relevantFields['背後的價值觀'] = flexibleInput.underlying_value || flexibleInput.reason;
    } else if (contentType === 'story') {
      if (flexibleInput.event_conflict) relevantFields['事件/衝突'] = flexibleInput.event_conflict;
      if (flexibleInput.turning_point) relevantFields['轉折點'] = flexibleInput.turning_point;
      if (flexibleInput.emotion_change) relevantFields['情感變化'] = flexibleInput.emotion_change;
      if (flexibleInput.core_insight) relevantFields['核心啟發'] = flexibleInput.core_insight;
    } else if (contentType === 'diagnosis') {
      if (flexibleInput.symptoms) relevantFields['特徵/症狀'] = flexibleInput.symptoms;
      if (flexibleInput.diagnosis_label) relevantFields['診斷標籤'] = flexibleInput.diagnosis_label;
      if (flexibleInput.explanation) relevantFields['解析'] = flexibleInput.explanation;
    } else if (contentType === 'contrast') {
      if (flexibleInput.common_belief) relevantFields['常見認知'] = flexibleInput.common_belief;
      if (flexibleInput.truth) relevantFields['真相'] = flexibleInput.truth;
    }
    
    if (Object.keys(relevantFields).length > 0) {
      userPrompt += '\n【補充資訊】\n';
      for (const [key, value] of Object.entries(relevantFields)) {
        if (value) userPrompt += `• ${key}：${value}\n`;
      }
    }
  }

  // 加入切角
  if (angle) {
    userPrompt += `\n【切角方向】請從「${angle}」這個角度來寫這篇貼文。\n`;
  }

  // 加入執行要求（強化同質性警告）
  userPrompt += `
【執行要求】
1. 第一行必須使用「${selectedOpenerPattern.name}」格式
   格式說明：${selectedOpenerPattern.instruction}
   
2. 字數控制在 ${typeRule?.wordLimit.min || 150}-${typeRule?.wordLimit.max || 400} 字

3. 直接輸出可發布的貼文，不要任何解釋
`;

  // 素材關鍵詞強制使用
  if (materialKeywords.length > 0) {
    userPrompt += `
【⚠️ 必須使用的關鍵詞】
第一行必須包含以下關鍵詞之一：${materialKeywords.slice(0, 3).join('、')}
`;
  }

  userPrompt += `
❗❗❗ 最後提醒：
1. 第一行決定 80% 的成敗，請務必使用「${selectedOpenerPattern.name}」格式！
2. 禁止複製任何範例，必須創造全新的開頭！
3. 開頭必須與素材緊密相關！
`;

  return userPrompt;
}

/**
 * 分析生成結果是否符合數據規則
 */
export function analyzeGeneratedContent(
  content: string,
  contentType: string,
  context?: DataDrivenPromptContext
): {
  score: number;
  openerAnalysis: {
    firstLine: string;
    matchedHighEffect: string[];
    matchedLowEffect: string[];
    usedMaterialKeyword: boolean;
    suggestions: string[];
  };
  wordCountAnalysis: {
    actual: number;
    expected: { min: number; max: number };
    isInRange: boolean;
  };
  structureAnalysis: {
    hasBreathingSpace: boolean;
    hasCTA: boolean;
  };
  homogeneityCheck: {
    isOriginal: boolean;
    issues: string[];
  };
} {
  const typeRule = getContentTypeRule(contentType);
  const lines = content.split('\n').filter(l => l.trim());
  const firstLine = lines[0] || '';
  
  // 分析開頭
  const matchedHighEffect: string[] = [];
  const matchedLowEffect: string[] = [];
  const suggestions: string[] = [];
  
  for (const pattern of OPENER_RULES.highEffectPatterns) {
    if (pattern.regex && pattern.regex.test(firstLine)) {
      matchedHighEffect.push(pattern.name);
    }
  }
  
  for (const pattern of OPENER_RULES.lowEffectPatterns) {
    if (pattern.regex && pattern.regex.test(firstLine)) {
      matchedLowEffect.push(pattern.name);
    }
  }
  
  if (matchedHighEffect.length === 0) {
    suggestions.push('建議使用「冒號斷言」格式，例如：「主題：觀點」');
  }
  
  // 檢查是否使用了素材關鍵詞
  let usedMaterialKeyword = false;
  if (context?.materialKeywords && context.materialKeywords.length > 0) {
    usedMaterialKeyword = context.materialKeywords.some(kw => firstLine.includes(kw));
    if (!usedMaterialKeyword) {
      suggestions.push(`建議在開頭加入素材關鍵詞：${context.materialKeywords.slice(0, 3).join('、')}`);
    }
  }
  
  // 分析字數
  const wordCount = content.length;
  const expectedRange = typeRule?.wordLimit || { min: 150, max: 400 };
  
  // 分析結構
  const hasBreathingSpace = content.includes('\n\n');
  const ctaPatterns = /你(怎麼看|同意嗎|覺得呢|有過|會怎麼)|留言|分享/;
  const hasCTA = ctaPatterns.test(content);
  
  // 同質性檢查
  const homogeneityIssues: string[] = [];
  
  // 檢查是否使用了常見的範例開頭
  const commonOpeners = [
    '經營自己的關鍵',
    '學習的真相',
    '成長最快的方式',
    '感情的本質',
    '人際關係的秘密',
    '90% 的人都搞錯了',
    '千萬不要在還沒搞懂'
  ];
  
  for (const opener of commonOpeners) {
    if (firstLine.includes(opener)) {
      homogeneityIssues.push(`使用了常見範例開頭「${opener}」`);
    }
  }
  
  // 檢查是否複製了範例
  if (context?.viralOpeners) {
    for (const opener of context.viralOpeners) {
      if (firstLine === opener.opener50 || opener.opener50.includes(firstLine)) {
        homogeneityIssues.push('疑似複製爆款範例');
      }
    }
  }
  
  // 計算分數
  let score = 50;
  if (matchedHighEffect.length > 0) score += 20;
  if (matchedLowEffect.length > 0) score -= 20;
  if (wordCount >= expectedRange.min && wordCount <= expectedRange.max) score += 15;
  if (hasBreathingSpace) score += 10;
  if (hasCTA) score += 5;
  if (usedMaterialKeyword) score += 10;
  if (homogeneityIssues.length === 0) score += 10;
  if (homogeneityIssues.length > 0) score -= 15;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    openerAnalysis: {
      firstLine,
      matchedHighEffect,
      matchedLowEffect,
      usedMaterialKeyword,
      suggestions
    },
    wordCountAnalysis: {
      actual: wordCount,
      expected: expectedRange,
      isInRange: wordCount >= expectedRange.min && wordCount <= expectedRange.max
    },
    structureAnalysis: {
      hasBreathingSpace,
      hasCTA
    },
    homogeneityCheck: {
      isOriginal: homogeneityIssues.length === 0,
      issues: homogeneityIssues
    }
  };
}

/**
 * 取得數據驅動生成的統計摘要
 */
export function getDataDrivenSummary(context: DataDrivenPromptContext): string {
  const { matchedKeywords, viralOpeners, fewShotExamples, materialKeywords, selectedOpenerPattern } = context;
  
  return `
【數據驅動生成摘要】
• 選用開頭模式：${selectedOpenerPattern.name}（效果 ${selectedOpenerPattern.effect}x）
• 匹配關鍵字：${matchedKeywords.length > 0 ? matchedKeywords.map(k => k.keyword).join('、') : '無'}
• 素材關鍵詞：${materialKeywords.length > 0 ? materialKeywords.join('、') : '無'}
• 爆款開頭參考：${viralOpeners.length} 個
• Few-Shot 範例：${fewShotExamples.length} 個
`;
}


/**
 * 計算生成內容與用戶風格的匹配度
 * @param content 生成的內容
 * @param userStyle 用戶的寫作風格設定
 * @param ipProfile 用戶的 IP 地基資料
 * @returns 風格匹配度分析結果
 */
export function calculateStyleMatch(
  content: string,
  userStyle: {
    toneStyle?: string | null;
    commonPhrases?: string[] | null;
    catchphrases?: string[] | null;
    hookStylePreference?: string | null;
    metaphorStyle?: string | null;
    emotionRhythm?: string | null;
  } | null,
  ipProfile: {
    profession?: string | null;
    pillars?: { authority?: string; resonance?: string; uniqueness?: string } | null;
    targetAudience?: string | null;
    beliefs?: string | null;
  } | null
): {
  score: number;
  breakdown: {
    toneMatch: number;
    phraseUsage: number;
    audienceAlignment: number;
    pillarConsistency: number;
  };
  details: string[];
  suggestions: string[];
} {
  const details: string[] = [];
  const suggestions: string[] = [];
  let toneMatch = 0;
  let phraseUsage = 0;
  let audienceAlignment = 0;
  let pillarConsistency = 0;

  // 1. 語氣風格匹配（30 分）
  if (userStyle?.toneStyle) {
    const toneKeywords = extractToneKeywords(userStyle.toneStyle);
    const matchedTone = toneKeywords.filter(kw => content.includes(kw)).length;
    toneMatch = Math.min(30, (matchedTone / Math.max(toneKeywords.length, 1)) * 30);
    if (toneMatch >= 20) {
      details.push('語氣風格高度匹配');
    } else if (toneMatch >= 10) {
      details.push('語氣風格部分匹配');
    } else {
      suggestions.push('可以加入更多個人語氣特色');
    }
  } else {
    toneMatch = 15; // 沒有設定時給予基礎分
    suggestions.push('建議在 IP 地基設定個人語氣風格');
  }

  // 2. 慣用詞彙使用（25 分）
  const allPhrases = [
    ...(userStyle?.commonPhrases || []),
    ...(userStyle?.catchphrases || [])
  ].filter(Boolean);
  
  if (allPhrases.length > 0) {
    const usedPhrases = allPhrases.filter(phrase => content.includes(phrase));
    phraseUsage = Math.min(25, (usedPhrases.length / Math.min(allPhrases.length, 5)) * 25);
    if (usedPhrases.length > 0) {
      details.push(`使用了 ${usedPhrases.length} 個個人慣用詞彙`);
    } else {
      suggestions.push('可以適度加入個人口頭禪或慣用語');
    }
  } else {
    phraseUsage = 12; // 沒有設定時給予基礎分
  }

  // 3. 受眾對齊（25 分）
  if (ipProfile?.targetAudience) {
    const audienceKeywords = extractAudienceKeywords(ipProfile.targetAudience);
    const matchedAudience = audienceKeywords.filter(kw => content.toLowerCase().includes(kw.toLowerCase())).length;
    audienceAlignment = Math.min(25, (matchedAudience / Math.max(audienceKeywords.length, 1)) * 25);
    if (audienceAlignment >= 15) {
      details.push('內容與目標受眾高度相關');
    } else if (audienceAlignment >= 8) {
      details.push('內容與目標受眾部分相關');
    } else {
      suggestions.push('可以更明確地針對目標受眾的痛點');
    }
  } else {
    audienceAlignment = 12;
    suggestions.push('建議在 IP 地基設定目標受眾');
  }

  // 4. 人設三支柱一致性（20 分）
  if (ipProfile?.pillars) {
    const pillars = ipProfile.pillars;
    let pillarMatches = 0;
    
    if (pillars.authority && content.includes(pillars.authority.substring(0, 10))) {
      pillarMatches++;
    }
    if (pillars.resonance && containsEmotionalResonance(content, pillars.resonance)) {
      pillarMatches++;
    }
    if (pillars.uniqueness && containsUniquePerspective(content, pillars.uniqueness)) {
      pillarMatches++;
    }
    
    pillarConsistency = Math.min(20, (pillarMatches / 3) * 20);
    if (pillarMatches >= 2) {
      details.push('內容符合人設三支柱');
    } else if (pillarMatches >= 1) {
      details.push('內容部分符合人設定位');
    } else {
      suggestions.push('可以更強調個人專業權威或獨特觀點');
    }
  } else {
    pillarConsistency = 10;
  }

  const totalScore = Math.round(toneMatch + phraseUsage + audienceAlignment + pillarConsistency);

  return {
    score: totalScore,
    breakdown: {
      toneMatch: Math.round(toneMatch),
      phraseUsage: Math.round(phraseUsage),
      audienceAlignment: Math.round(audienceAlignment),
      pillarConsistency: Math.round(pillarConsistency)
    },
    details,
    suggestions
  };
}

// 輔助函數：從語氣描述中提取關鍵詞
function extractToneKeywords(toneStyle: string): string[] {
  const keywords: string[] = [];
  
  // 常見語氣特徵詞
  const tonePatterns = [
    { pattern: /溫暖|溫馨|暖心/, keywords: ['你', '我們', '一起', '陪伴'] },
    { pattern: /專業|權威|理性/, keywords: ['其實', '根據', '研究', '數據'] },
    { pattern: /幽默|風趣|輕鬆/, keywords: ['哈哈', '笑', '有趣', '好玩'] },
    { pattern: /直接|犀利|真誠/, keywords: ['說實話', '老實說', '真的', '直接'] },
    { pattern: /感性|細膩|溫柔/, keywords: ['感覺', '心裡', '想著', '記得'] },
  ];
  
  for (const { pattern, keywords: kws } of tonePatterns) {
    if (pattern.test(toneStyle)) {
      keywords.push(...kws);
    }
  }
  
  // 如果沒有匹配到任何模式，從原文提取
  if (keywords.length === 0) {
    const words = toneStyle.split(/[，、。\s]+/).filter(w => w.length >= 2);
    keywords.push(...words.slice(0, 5));
  }
  
  return keywords;
}

// 輔助函數：從受眾描述中提取關鍵詞
function extractAudienceKeywords(targetAudience: string): string[] {
  const keywords: string[] = [];
  
  // 常見受眾特徵詞
  const audiencePatterns = [
    { pattern: /創業|老闆|企業主/, keywords: ['創業', '生意', '客戶', '營收', '品牌'] },
    { pattern: /上班族|職場|工作/, keywords: ['工作', '職場', '主管', '同事', '加班'] },
    { pattern: /媽媽|爸爸|家長/, keywords: ['孩子', '家庭', '教育', '成長', '陪伴'] },
    { pattern: /學生|年輕人/, keywords: ['學習', '成長', '未來', '夢想', '迷茫'] },
    { pattern: /自由工作者|接案/, keywords: ['接案', '客戶', '作品', '收入', '自由'] },
  ];
  
  for (const { pattern, keywords: kws } of audiencePatterns) {
    if (pattern.test(targetAudience)) {
      keywords.push(...kws);
    }
  }
  
  // 從原文提取關鍵詞
  const words = targetAudience.split(/[，、。\s]+/).filter(w => w.length >= 2);
  keywords.push(...words.slice(0, 5));
  
  return Array.from(new Set(keywords));
}

// 輔助函數：檢查是否包含情感共鳴元素
function containsEmotionalResonance(content: string, resonance: string): boolean {
  const emotionWords = ['感覺', '心裡', '想著', '害怕', '擔心', '開心', '難過', '焦慮', '期待', '感動'];
  const hasEmotion = emotionWords.some(word => content.includes(word));
  const resonanceKeywords = resonance.split(/[，、。\s]+/).filter(w => w.length >= 2).slice(0, 3);
  const hasResonanceKeyword = resonanceKeywords.some(kw => content.includes(kw));
  return hasEmotion || hasResonanceKeyword;
}

// 輔助函數：檢查是否包含獨特觀點
function containsUniquePerspective(content: string, uniqueness: string): boolean {
  const perspectiveWords = ['我認為', '我覺得', '其實', '說實話', '真正的', '關鍵是', '重點是'];
  const hasPerspective = perspectiveWords.some(word => content.includes(word));
  const uniquenessKeywords = uniqueness.split(/[，、。\s]+/).filter(w => w.length >= 2).slice(0, 3);
  const hasUniquenessKeyword = uniquenessKeywords.some(kw => content.includes(kw));
  return hasPerspective || hasUniquenessKeyword;
}
