/**
 * 強化版 Few-Shot Learning 和流量反哺機制
 * 
 * 功能：
 * 1. 從用戶的爆款貼文中提取成功模式
 * 2. 將成功模式反哺到生成策略
 * 3. 根據用戶風格動態調整 prompt
 */

import * as db from './db';

// 類型定義
interface UserStyleProfile {
  toneStyle: string | null;
  commonPhrases: string[];
  catchphrases: string[];
  hookStylePreference: string | null;
  metaphorStyle: string | null;
  emotionRhythm: string | null;
  viralElements: {
    identityTags: string[];
    emotionWords: string[];
    ctaStyles: string[];
  } | null;
  samplePosts: Array<{
    content: string;
    engagement?: number;
    addedAt: string;
  }>;
}

interface ViralPattern {
  openerType: string;
  avgEngagement: number;
  successRate: number;
  examples: string[];
}

interface FewShotContext {
  styleProfile: UserStyleProfile | null;
  viralPatterns: ViralPattern[];
  recentSuccesses: Array<{
    content: string;
    likes: number;
    comments: number;
    openerType: string;
  }>;
  personalizedPrompt: string;
}

/**
 * 從用戶的風格樣本中提取成功模式
 */
export async function extractViralPatterns(userId: number): Promise<ViralPattern[]> {
  // 取得用戶的風格資料（包含樣本貼文）
  const userStyle = await db.getUserWritingStyle(userId);
  
  if (!userStyle?.samplePosts) {
    return [];
  }
  
  const samplePosts = userStyle.samplePosts as Array<{ content: string; engagement?: number; addedAt: string }>;
  
  if (samplePosts.length === 0) {
    return [];
  }
  
  // 分析開頭模式
  const openerPatterns: Record<string, { count: number; totalEngagement: number; examples: string[] }> = {};
  
  for (const post of samplePosts) {
    const content = post.content || '';
    const firstLine = content.split('\n')[0] || '';
    const openerType = detectOpenerType(firstLine);
    
    if (!openerPatterns[openerType]) {
      openerPatterns[openerType] = { count: 0, totalEngagement: 0, examples: [] };
    }
    
    openerPatterns[openerType].count++;
    openerPatterns[openerType].totalEngagement += post.engagement || 0;
    if (openerPatterns[openerType].examples.length < 3) {
      openerPatterns[openerType].examples.push(firstLine);
    }
  }
  
  // 轉換為 ViralPattern 格式
  const patterns: ViralPattern[] = [];
  for (const [openerType, data] of Object.entries(openerPatterns)) {
    patterns.push({
      openerType,
      avgEngagement: data.count > 0 ? data.totalEngagement / data.count : 0,
      successRate: (data.count / samplePosts.length) * 100,
      examples: data.examples,
    });
  }
  
  // 按成功率排序
  patterns.sort((a, b) => b.successRate - a.successRate);
  
  return patterns;
}

/**
 * 檢測開頭類型
 */
function detectOpenerType(firstLine: string): string {
  // 情緒爆發型
  if (/^(我真的|天啊|傻眼|崩潰|暈|無言|笑死|太扯|超級|好想)/.test(firstLine)) {
    return '情緒爆發型';
  }
  
  // 故事敘事型
  if (/^(昨天|今天|上週|前幾天|那天|有一次|記得|小時候)/.test(firstLine)) {
    return '故事敘事型';
  }
  
  // 冒號斷言型
  if (/:/.test(firstLine) && firstLine.indexOf(':') < 15) {
    return '冒號斷言型';
  }
  
  // 數字清單型
  if (/^\d+/.test(firstLine) || /^(第一|第二|第三)/.test(firstLine)) {
    return '數字清單型';
  }
  
  // 對話引用型
  if (/^["「『]/.test(firstLine) || /^(有人問我|朋友說|客戶問)/.test(firstLine)) {
    return '對話引用型';
  }
  
  // 身分標籤型
  if (/^(身為|作為|當一個|我是)/.test(firstLine)) {
    return '身分標籤型';
  }
  
  // 懸念引導型
  if (/^(你知道嗎|你有沒有想過|你相信嗎|猜猜看)/.test(firstLine)) {
    return '懸念引導型';
  }
  
  // 認知衝突型
  if (/^(很多人以為|大家都說|一般人認為|90%的人)/.test(firstLine)) {
    return '認知衝突型';
  }
  
  // 反問開場型
  if (/\?|？$/.test(firstLine)) {
    return '反問開場型';
  }
  
  return '其他';
}

/**
 * 建構強化版 Few-Shot Learning 上下文
 */
export async function buildEnhancedFewShotContext(userId: number): Promise<FewShotContext> {
  // 1. 取得用戶風格資料
  const userStyle = await db.getUserWritingStyle(userId);
  
  // 2. 提取成功模式
  const viralPatterns = await extractViralPatterns(userId);
  
  // 3. 取得最近成功的貼文（從樣本貼文中）
  const samplePosts = (userStyle?.samplePosts as Array<{ content: string; engagement?: number; addedAt: string }>) || [];
  const recentSuccesses = samplePosts
    .filter(p => (p.engagement || 0) >= 50) // 至少 50 互動
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, 5)
    .map(p => ({
      content: p.content || '',
      likes: p.engagement || 0,
      comments: 0,
      openerType: detectOpenerType((p.content || '').split('\n')[0] || ''),
    }));
  
  // 4. 建構個人化 prompt
  const personalizedPrompt = buildPersonalizedPrompt(userStyle, viralPatterns, recentSuccesses);
  
  // 5. 轉換 userStyle 為 UserStyleProfile
  const styleProfile: UserStyleProfile | null = userStyle ? {
    toneStyle: userStyle.toneStyle,
    commonPhrases: (userStyle.commonPhrases as string[]) || [],
    catchphrases: (userStyle.catchphrases as string[]) || [],
    hookStylePreference: userStyle.hookStylePreference,
    metaphorStyle: userStyle.metaphorStyle,
    emotionRhythm: userStyle.emotionRhythm,
    viralElements: userStyle.viralElements as UserStyleProfile['viralElements'] || null,
    samplePosts: samplePosts,
  } : null;
  
  return {
    styleProfile,
    viralPatterns,
    recentSuccesses,
    personalizedPrompt,
  };
}

/**
 * 建構個人化 prompt
 */
function buildPersonalizedPrompt(
  userStyle: Awaited<ReturnType<typeof db.getUserWritingStyle>>,
  viralPatterns: ViralPattern[],
  recentSuccesses: Array<{ content: string; likes: number; openerType: string }>
): string {
  const parts: string[] = [];
  
  // 1. 風格精神（強化版）
  if (userStyle?.toneStyle) {
    parts.push(`=== 你的寫作風格 DNA ===`);
    parts.push(`【核心語氣】${userStyle.toneStyle}`);
    parts.push(`重要：學習這個語氣的「感覺」，不是複製句子。`);
    parts.push(``);
  }
  
  // 2. 成功模式分析（流量反哺）
  if (viralPatterns.length > 0) {
    parts.push(`=== 你的爆文成功模式（數據驅動） ===`);
    parts.push(`以下是根據你過去貼文分析出的成功模式：`);
    parts.push(``);
    
    for (const pattern of viralPatterns.slice(0, 3)) {
      parts.push(`【${pattern.openerType}】成功率 ${pattern.successRate.toFixed(0)}%，平均互動 ${pattern.avgEngagement.toFixed(0)}`);
      if (pattern.examples.length > 0) {
        parts.push(`  範例：${pattern.examples[0].substring(0, 30)}...`);
      }
    }
    parts.push(``);
    parts.push(`建議：優先使用「${viralPatterns[0]?.openerType || '情緒爆發型'}」開頭，這是你最成功的模式。`);
    parts.push(``);
  }
  
  // 3. 個人詞彙庫（強化版）
  if (userStyle?.viralElements) {
    const ve = userStyle.viralElements as { emotionWords?: string[]; identityTags?: string[] };
    if (ve.emotionWords && ve.emotionWords.length > 0) {
      parts.push(`=== 你的個人詞彙庫 ===`);
      parts.push(`【情緒詞】使用這些詞彙讓內容更有你的風格：`);
      parts.push(`  ${ve.emotionWords.slice(0, 5).join('、')}`);
      parts.push(``);
    }
  }
  
  // 4. 口頭禪（限制使用）
  if (userStyle?.catchphrases && (userStyle.catchphrases as string[]).length > 0) {
    const catchphrases = userStyle.catchphrases as string[];
    parts.push(`【口頭禪】偶爾使用，不要每篇都用：`);
    parts.push(`  ${catchphrases.slice(0, 3).join('、')}`);
    parts.push(``);
  }
  
  // 5. 最近成功案例（Few-Shot）
  if (recentSuccesses.length > 0) {
    parts.push(`=== 你最近的成功案例 ===`);
    parts.push(`學習這些貼文的「節奏」和「語氣」，不是複製內容：`);
    parts.push(``);
    
    // 隨機選取 1 篇
    const randomIndex = Math.floor(Math.random() * recentSuccesses.length);
    const selected = recentSuccesses[randomIndex];
    
    parts.push(`--- 成功案例（${selected.likes} 讚，${selected.openerType}）---`);
    parts.push(selected.content.length > 300 ? selected.content.substring(0, 300) + '...' : selected.content);
    parts.push(`--- 案例結束 ---`);
    parts.push(``);
    parts.push(`【學習要點】`);
    parts.push(`✓ 學習：句子長短的節奏、換行的頻率、說話的語氣`);
    parts.push(`✗ 禁止：複製開頭句式、使用同樣的句型、抄襲內容`);
    parts.push(``);
  }
  
  // 6. 禁止事項（強化版）
  parts.push(`=== 禁止事項（違反即失敗） ===`);
  parts.push(`1. 禁止複製任何範例的開頭句式`);
  parts.push(`2. 禁止每篇都用同樣的開場白`);
  parts.push(`3. 禁止過度使用口頭禪（每篇最多 1-2 個）`);
  parts.push(`4. 禁止使用 AI 常見詞彙（讓我們、親愛的、值得一提）`);
  
  return parts.join('\n');
}

/**
 * 取得用戶的最佳開頭模式
 */
export async function getBestOpenerPattern(userId: number): Promise<string> {
  const patterns = await extractViralPatterns(userId);
  
  if (patterns.length === 0) {
    // 沒有資料時，返回爆款資料庫中最有效的模式
    return '情緒爆發型';
  }
  
  return patterns[0].openerType;
}

/**
 * 計算用戶風格匹配度
 */
export function calculateUserStyleMatch(
  content: string,
  styleProfile: UserStyleProfile | null
): {
  score: number;
  details: string[];
  suggestions: string[];
} {
  if (!styleProfile) {
    return {
      score: 50,
      details: ['尚未設定個人風格'],
      suggestions: ['建議在 IP 地基上傳爆款貼文進行風格分析'],
    };
  }
  
  const details: string[] = [];
  const suggestions: string[] = [];
  let score = 50;
  
  // 1. 檢查口頭禪使用
  const usedCatchphrases = styleProfile.catchphrases.filter(cp => content.includes(cp));
  if (usedCatchphrases.length > 0 && usedCatchphrases.length <= 2) {
    score += 15;
    details.push(`適度使用了 ${usedCatchphrases.length} 個口頭禪`);
  } else if (usedCatchphrases.length > 2) {
    score -= 10;
    suggestions.push('口頭禪使用過多，建議每篇最多 1-2 個');
  }
  
  // 2. 檢查情緒詞使用
  if (styleProfile.viralElements?.emotionWords) {
    const usedEmotionWords = styleProfile.viralElements.emotionWords.filter(ew => content.includes(ew));
    if (usedEmotionWords.length > 0) {
      score += 10;
      details.push(`使用了個人情緒詞：${usedEmotionWords.join('、')}`);
    }
  }
  
  // 3. 檢查 Hook 風格
  if (styleProfile.hookStylePreference) {
    const firstLine = content.split('\n')[0] || '';
    const detectedType = detectOpenerType(firstLine);
    if (detectedType === styleProfile.hookStylePreference || 
        styleProfile.hookStylePreference.includes(detectedType)) {
      score += 15;
      details.push(`開頭風格符合個人偏好（${detectedType}）`);
    }
  }
  
  // 4. 檢查節奏
  if (styleProfile.emotionRhythm) {
    if (styleProfile.emotionRhythm.includes('短句') && content.split('\n').some(line => line.length < 20)) {
      score += 10;
      details.push('節奏符合個人風格（短句）');
    } else if (styleProfile.emotionRhythm.includes('長句') && content.split('\n').some(line => line.length > 50)) {
      score += 10;
      details.push('節奏符合個人風格（長句）');
    }
  }
  
  return {
    score: Math.min(100, Math.max(0, score)),
    details,
    suggestions,
  };
}

/**
 * 生成流量反哺建議
 */
export async function generateFeedbackSuggestions(userId: number): Promise<{
  topPatterns: string[];
  recommendations: string[];
  nextActions: string[];
}> {
  const patterns = await extractViralPatterns(userId);
  const userStyle = await db.getUserWritingStyle(userId);
  const samplePosts = (userStyle?.samplePosts as Array<{ content: string; engagement?: number }>) || [];
  
  const topPatterns = patterns.slice(0, 3).map(p => p.openerType);
  const recommendations: string[] = [];
  const nextActions: string[] = [];
  
  // 根據成功模式生成建議
  if (patterns.length > 0) {
    recommendations.push(`你最成功的開頭模式是「${patterns[0].openerType}」，建議繼續使用`);
    
    if (patterns.length > 1) {
      recommendations.push(`也可以嘗試「${patterns[1].openerType}」，這是你第二成功的模式`);
    }
  } else {
    recommendations.push('建議在戰報中記錄更多貼文數據，以便分析成功模式');
  }
  
  // 根據樣本數量生成行動建議
  if (samplePosts.length > 0) {
    const avgEngagement = samplePosts.reduce((sum, p) => sum + (p.engagement || 0), 0) / samplePosts.length;
    
    if (avgEngagement < 100) {
      nextActions.push('建議增加發文頻率，每週至少 3-5 篇');
    }
    
    if (samplePosts.length < 5) {
      nextActions.push(`目前只有 ${samplePosts.length} 篇樣本，建議上傳更多爆款貼文以提升分析準確度`);
    }
  } else {
    nextActions.push('開始在 IP 地基上傳爆款貼文');
    nextActions.push('上傳 3 篇以上爆款貼文進行風格分析');
  }
  
  return {
    topPatterns,
    recommendations,
    nextActions,
  };
}
