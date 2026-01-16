/**
 * 品質規則模組
 * 定義內容品質檢查的規則和標準
 */

export interface QualityRule {
  id: string;
  name: string;
  category: 'structure' | 'style' | 'ai_detection' | 'engagement';
  weight: number; // 權重（0-1）
  check: (content: string) => QualityCheckResult;
}

export interface QualityCheckResult {
  passed: boolean;
  score: number; // 0-100
  message?: string;
  suggestions?: string[];
}

export interface QualityThresholds {
  excellent: number;  // 優秀門檻
  good: number;       // 良好門檻
  acceptable: number; // 可接受門檻
  minimum: number;    // 最低門檻
}

/**
 * 品質分數門檻
 */
export const QUALITY_THRESHOLDS: QualityThresholds = {
  excellent: 85,
  good: 70,
  acceptable: 55,
  minimum: 40,
};

/**
 * 內容長度規則
 */
export const LENGTH_RULES = {
  short: { min: 150, max: 200, ideal: 175 },
  medium: { min: 250, max: 350, ideal: 300 },
  long: { min: 350, max: 450, ideal: 400 },
};

/**
 * AI 痕跡檢測規則
 */
export const AI_DETECTION_RULES = {
  // 重複模式檢測
  repetitionThreshold: 3, // 同一模式出現超過 3 次視為重複
  
  // 句式密度檢測
  structureWordsDensity: 0.05, // 結構詞密度上限
  
  // AI 短語檢測
  aiPhraseThreshold: 2, // AI 短語出現超過 2 次視為 AI 感過重
};

/**
 * 常見 AI 短語列表
 */
export const AI_PHRASES = [
  '不得不說',
  '值得一提',
  '毋庸置疑',
  '不可否認',
  '眾所周知',
  '事實上',
  '換句話說',
  '總而言之',
  '綜上所述',
  '由此可見',
  '顯而易見',
  '不言而喻',
  '一言以蔽之',
  '歸根結底',
  '追根究底',
];

/**
 * 結構詞列表
 */
export const STRUCTURE_WORDS = [
  '首先',
  '其次',
  '再者',
  '最後',
  '第一',
  '第二',
  '第三',
  '一方面',
  '另一方面',
  '總結',
  '結論',
];

/**
 * 檢查內容長度
 */
export function checkContentLength(
  content: string,
  type: 'short' | 'medium' | 'long'
): QualityCheckResult {
  const rules = LENGTH_RULES[type];
  const length = content.length;
  
  if (length < rules.min) {
    return {
      passed: false,
      score: Math.max(0, (length / rules.min) * 50),
      message: `內容過短（${length} 字），建議至少 ${rules.min} 字`,
      suggestions: ['增加更多細節描述', '補充具體例子'],
    };
  }
  
  if (length > rules.max) {
    return {
      passed: true,
      score: Math.max(50, 100 - ((length - rules.max) / rules.max) * 30),
      message: `內容偏長（${length} 字），建議不超過 ${rules.max} 字`,
      suggestions: ['精簡冗餘內容', '刪除重複表達'],
    };
  }
  
  // 計算與理想長度的偏差
  const deviation = Math.abs(length - rules.ideal) / rules.ideal;
  const score = Math.max(70, 100 - deviation * 30);
  
  return {
    passed: true,
    score,
    message: `內容長度適中（${length} 字）`,
  };
}

/**
 * 檢查 AI 短語密度
 */
export function checkAiPhraseDensity(content: string): QualityCheckResult {
  let count = 0;
  const foundPhrases: string[] = [];
  
  for (const phrase of AI_PHRASES) {
    const matches = content.split(phrase).length - 1;
    if (matches > 0) {
      count += matches;
      foundPhrases.push(phrase);
    }
  }
  
  if (count > AI_DETECTION_RULES.aiPhraseThreshold) {
    return {
      passed: false,
      score: Math.max(0, 50 - (count - AI_DETECTION_RULES.aiPhraseThreshold) * 10),
      message: `AI 短語過多（${count} 個）`,
      suggestions: foundPhrases.map(p => `替換「${p}」為更自然的表達`),
    };
  }
  
  return {
    passed: true,
    score: 100 - count * 15,
    message: count > 0 ? `發現 ${count} 個 AI 短語` : '無 AI 短語',
  };
}

/**
 * 檢查結構詞密度
 */
export function checkStructureWordsDensity(content: string): QualityCheckResult {
  let count = 0;
  const foundWords: string[] = [];
  
  for (const word of STRUCTURE_WORDS) {
    const matches = content.split(word).length - 1;
    if (matches > 0) {
      count += matches;
      foundWords.push(word);
    }
  }
  
  const density = count / content.length;
  
  if (density > AI_DETECTION_RULES.structureWordsDensity) {
    return {
      passed: false,
      score: Math.max(0, 50 - (density - AI_DETECTION_RULES.structureWordsDensity) * 1000),
      message: `結構詞密度過高（${(density * 100).toFixed(2)}%）`,
      suggestions: foundWords.map(w => `減少使用「${w}」`),
    };
  }
  
  return {
    passed: true,
    score: 100 - density * 500,
    message: '結構詞使用適當',
  };
}

/**
 * 檢查重複模式
 */
export function checkRepetitionPatterns(content: string): QualityCheckResult {
  // 檢查句首重複
  const sentences = content.split(/[。！？\n]/).filter(s => s.trim().length > 0);
  const openers = sentences.map(s => s.trim().slice(0, 5));
  
  const openerCounts: Record<string, number> = {};
  for (const opener of openers) {
    openerCounts[opener] = (openerCounts[opener] || 0) + 1;
  }
  
  const repetitions = Object.entries(openerCounts)
    .filter(([_, count]) => count >= AI_DETECTION_RULES.repetitionThreshold)
    .map(([opener, count]) => ({ opener, count }));
  
  if (repetitions.length > 0) {
    return {
      passed: false,
      score: Math.max(0, 60 - repetitions.length * 15),
      message: `發現重複句首模式`,
      suggestions: repetitions.map(r => `「${r.opener}...」重複 ${r.count} 次，建議變化開頭`),
    };
  }
  
  return {
    passed: true,
    score: 100,
    message: '無重複模式',
  };
}

/**
 * 綜合品質評分
 */
export function calculateOverallQuality(
  content: string,
  contentType: 'short' | 'medium' | 'long' = 'medium'
): {
  score: number;
  grade: 'excellent' | 'good' | 'acceptable' | 'poor';
  checks: Record<string, QualityCheckResult>;
  suggestions: string[];
} {
  const checks: Record<string, QualityCheckResult> = {
    length: checkContentLength(content, contentType),
    aiPhrase: checkAiPhraseDensity(content),
    structure: checkStructureWordsDensity(content),
    repetition: checkRepetitionPatterns(content),
  };
  
  // 加權計算總分
  const weights = {
    length: 0.2,
    aiPhrase: 0.3,
    structure: 0.2,
    repetition: 0.3,
  };
  
  let totalScore = 0;
  for (const [key, result] of Object.entries(checks)) {
    totalScore += result.score * (weights[key as keyof typeof weights] || 0.25);
  }
  
  // 判斷等級
  let grade: 'excellent' | 'good' | 'acceptable' | 'poor';
  if (totalScore >= QUALITY_THRESHOLDS.excellent) {
    grade = 'excellent';
  } else if (totalScore >= QUALITY_THRESHOLDS.good) {
    grade = 'good';
  } else if (totalScore >= QUALITY_THRESHOLDS.acceptable) {
    grade = 'acceptable';
  } else {
    grade = 'poor';
  }
  
  // 收集所有建議
  const suggestions: string[] = [];
  for (const result of Object.values(checks)) {
    if (result.suggestions) {
      suggestions.push(...result.suggestions);
    }
  }
  
  return {
    score: Math.round(totalScore),
    grade,
    checks,
    suggestions: suggestions.slice(0, 5), // 最多 5 條建議
  };
}
