/**
 * AI Detector - 規則版 AI 痕跡檢測器
 * 
 * 功能：
 * - detectAiPatterns(): 檢測內容中的 AI 痕跡
 * - getAiScore(): 計算 AI 痕跡分數
 * - getSuggestions(): 取得修改建議
 * - logDetection(): 記錄檢測結果
 */

import { getDb } from "./db";
import { aiDetectorLogs, promptAvoidList, type AiDetectorLog } from "../drizzle/schema";
import { getAvoidList, DEFAULT_AVOID_PATTERNS } from "./promptService";

// ==================== 類型定義 ====================

export interface AiPatternMatch {
  pattern: string;
  type: 'opener' | 'transition' | 'ending' | 'ai_phrase' | 'filler' | 'repetition' | 'density';
  position: number;
  severity: 'block' | 'warn' | 'suggest';
  description: string;
  suggestion: string;
}

export interface AiDetectionResult {
  overallScore: number; // 0-1，越低越好
  isPass: boolean; // 是否通過檢測
  matches: AiPatternMatch[];
  scores: {
    avoidListScore: number;
    repetitionScore: number;
    aiPhraseScore: number;
    densityScore: number;
  };
  suggestions: { issue: string; suggestion: string }[];
  action: 'pass' | 'warn' | 'regenerate';
}

// ==================== 常見 AI 短語 ====================

const AI_PHRASES = [
  // 過於正式的表達
  { phrase: "值得注意的是", weight: 0.3 },
  { phrase: "需要指出的是", weight: 0.3 },
  { phrase: "不難發現", weight: 0.2 },
  { phrase: "顯而易見", weight: 0.2 },
  { phrase: "毋庸置疑", weight: 0.3 },
  { phrase: "不言而喻", weight: 0.3 },
  { phrase: "眾所周知", weight: 0.2 },
  { phrase: "由此可見", weight: 0.2 },
  { phrase: "換言之", weight: 0.2 },
  { phrase: "換句話說", weight: 0.2 },
  
  // AI 常用連接詞
  { phrase: "此外", weight: 0.15 },
  { phrase: "另外", weight: 0.1 },
  { phrase: "同時", weight: 0.1 },
  { phrase: "因此", weight: 0.1 },
  { phrase: "然而", weight: 0.15 },
  { phrase: "儘管如此", weight: 0.2 },
  { phrase: "與此同時", weight: 0.2 },
  
  // 過於工整的結構
  { phrase: "一方面.*另一方面", weight: 0.3 },
  { phrase: "不僅.*而且", weight: 0.2 },
  { phrase: "既.*又", weight: 0.15 },
  
  // 過於客觀的表達
  { phrase: "研究表明", weight: 0.3 },
  { phrase: "數據顯示", weight: 0.2 },
  { phrase: "專家指出", weight: 0.3 },
  { phrase: "根據統計", weight: 0.2 },
];

// ==================== 檢測函數 ====================

/**
 * 檢測內容中的 AI 痕跡
 */
export async function detectAiPatterns(
  content: string,
  userId?: number
): Promise<AiDetectionResult> {
  const matches: AiPatternMatch[] = [];
  
  // 1. Avoid-list 匹配檢測
  const avoidPatterns = await getAvoidList(userId);
  const avoidListMatches = detectAvoidListPatterns(content, avoidPatterns);
  matches.push(...avoidListMatches);
  
  // 2. 重複模式檢測
  const repetitionMatches = detectRepetitionPatterns(content);
  matches.push(...repetitionMatches);
  
  // 3. AI 短語檢測
  const aiPhraseMatches = detectAiPhrases(content);
  matches.push(...aiPhraseMatches);
  
  // 4. 句式密度檢測
  const densityMatches = detectDensityPatterns(content);
  matches.push(...densityMatches);
  
  // 計算各項分數
  const scores = {
    avoidListScore: calculateAvoidListScore(avoidListMatches),
    repetitionScore: calculateRepetitionScore(repetitionMatches),
    aiPhraseScore: calculateAiPhraseScore(aiPhraseMatches),
    densityScore: calculateDensityScore(densityMatches),
  };
  
  // 計算總體分數（加權平均）
  const overallScore = 
    scores.avoidListScore * 0.35 +
    scores.repetitionScore * 0.25 +
    scores.aiPhraseScore * 0.25 +
    scores.densityScore * 0.15;
  
  // 生成建議
  const suggestions = generateSuggestions(matches);
  
  // 決定動作
  const action = determineAction(overallScore, matches);
  
  return {
    overallScore,
    isPass: overallScore < 0.4,
    matches,
    scores,
    suggestions,
    action,
  };
}

/**
 * 檢測 Avoid-list 中的模式
 */
function detectAvoidListPatterns(
  content: string,
  avoidPatterns: { pattern: string | null; patternType: string | null; severity: string | null; description: string | null; replacement: string | null }[]
): AiPatternMatch[] {
  const matches: AiPatternMatch[] = [];
  
  for (const pattern of avoidPatterns) {
    if (!pattern.pattern) continue;
    
    try {
      const regex = new RegExp(pattern.pattern, 'gi');
      let match;
      while ((match = regex.exec(content)) !== null) {
        matches.push({
          pattern: match[0],
          type: (pattern.patternType as AiPatternMatch['type']) || 'ai_phrase',
          position: match.index,
          severity: (pattern.severity as AiPatternMatch['severity']) || 'warn',
          description: pattern.description || '可能的 AI 痕跡',
          suggestion: pattern.replacement || '考慮使用更自然的表達',
        });
      }
    } catch (e) {
      // 如果正則表達式無效，使用簡單的字串匹配
      const index = content.indexOf(pattern.pattern);
      if (index !== -1) {
        matches.push({
          pattern: pattern.pattern,
          type: (pattern.patternType as AiPatternMatch['type']) || 'ai_phrase',
          position: index,
          severity: (pattern.severity as AiPatternMatch['severity']) || 'warn',
          description: pattern.description || '可能的 AI 痕跡',
          suggestion: pattern.replacement || '考慮使用更自然的表達',
        });
      }
    }
  }
  
  return matches;
}

/**
 * 檢測重複模式
 */
function detectRepetitionPatterns(content: string): AiPatternMatch[] {
  const matches: AiPatternMatch[] = [];
  
  // 檢測句子開頭重複
  const sentences = content.split(/[。！？\n]/);
  const openers: Record<string, number[]> = {};
  
  sentences.forEach((sentence, index) => {
    const trimmed = sentence.trim();
    if (trimmed.length < 5) return;
    
    // 取前 5 個字作為開頭
    const opener = trimmed.substring(0, 5);
    if (!openers[opener]) {
      openers[opener] = [];
    }
    openers[opener].push(index);
  });
  
  // 找出重複的開頭
  for (const [opener, indices] of Object.entries(openers)) {
    if (indices.length >= 2) {
      matches.push({
        pattern: opener,
        type: 'repetition',
        position: 0,
        severity: indices.length >= 3 ? 'warn' : 'suggest',
        description: `句子開頭「${opener}」重複出現 ${indices.length} 次`,
        suggestion: '嘗試使用不同的開頭方式，增加內容多樣性',
      });
    }
  }
  
  // 檢測相同詞彙過度使用
  const words = content.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  const wordCount: Record<string, number> = {};
  
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  for (const [word, count] of Object.entries(wordCount)) {
    const frequency = count / words.length;
    if (count >= 4 && frequency > 0.05) {
      matches.push({
        pattern: word,
        type: 'repetition',
        position: content.indexOf(word),
        severity: 'suggest',
        description: `詞彙「${word}」出現 ${count} 次，佔比 ${(frequency * 100).toFixed(1)}%`,
        suggestion: '考慮使用同義詞或換一種表達方式',
      });
    }
  }
  
  return matches;
}

/**
 * 檢測 AI 短語
 */
function detectAiPhrases(content: string): AiPatternMatch[] {
  const matches: AiPatternMatch[] = [];
  
  for (const { phrase, weight } of AI_PHRASES) {
    try {
      const regex = new RegExp(phrase, 'gi');
      let match;
      while ((match = regex.exec(content)) !== null) {
        matches.push({
          pattern: match[0],
          type: 'ai_phrase',
          position: match.index,
          severity: weight >= 0.3 ? 'warn' : 'suggest',
          description: `「${match[0]}」是常見的 AI 用語`,
          suggestion: '嘗試使用更口語化的表達',
        });
      }
    } catch (e) {
      // 忽略無效的正則表達式
    }
  }
  
  return matches;
}

/**
 * 檢測句式密度
 */
function detectDensityPatterns(content: string): AiPatternMatch[] {
  const matches: AiPatternMatch[] = [];
  
  // 檢測過於工整的列點結構
  const listPatterns = [
    /第[一二三四五六七八九十][\s,，、]/g,
    /[1-9][.、)）]/g,
    /[①②③④⑤⑥⑦⑧⑨⑩]/g,
  ];
  
  let listCount = 0;
  for (const pattern of listPatterns) {
    const listMatches = content.match(pattern);
    if (listMatches) {
      listCount += listMatches.length;
    }
  }
  
  if (listCount >= 3) {
    matches.push({
      pattern: '列點結構',
      type: 'density',
      position: 0,
      severity: listCount >= 5 ? 'warn' : 'suggest',
      description: `內容包含 ${listCount} 個列點，結構過於工整`,
      suggestion: '考慮用更自然的敘述方式，減少列點使用',
    });
  }
  
  // 檢測句子長度過於一致
  const sentences = content.split(/[。！？]/);
  const validSentences = sentences.filter(s => s.trim().length > 5);
  
  if (validSentences.length >= 3) {
    const lengths = validSentences.map(s => s.trim().length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    
    // 如果標準差太小，表示句子長度過於一致
    if (stdDev < avgLength * 0.2 && avgLength > 15) {
      matches.push({
        pattern: '句子長度一致',
        type: 'density',
        position: 0,
        severity: 'suggest',
        description: '句子長度過於一致，缺乏節奏變化',
        suggestion: '嘗試混合使用長短句，增加閱讀節奏感',
      });
    }
  }
  
  return matches;
}

// ==================== 分數計算 ====================

function calculateAvoidListScore(matches: AiPatternMatch[]): number {
  if (matches.length === 0) return 0;
  
  let score = 0;
  for (const match of matches) {
    switch (match.severity) {
      case 'block': score += 0.4; break;
      case 'warn': score += 0.2; break;
      case 'suggest': score += 0.1; break;
    }
  }
  
  return Math.min(1, score);
}

function calculateRepetitionScore(matches: AiPatternMatch[]): number {
  if (matches.length === 0) return 0;
  return Math.min(1, matches.length * 0.15);
}

function calculateAiPhraseScore(matches: AiPatternMatch[]): number {
  if (matches.length === 0) return 0;
  
  let score = 0;
  for (const match of matches) {
    const phrase = AI_PHRASES.find(p => match.pattern.includes(p.phrase.replace(/\.\*/g, '')));
    score += phrase?.weight || 0.1;
  }
  
  return Math.min(1, score);
}

function calculateDensityScore(matches: AiPatternMatch[]): number {
  if (matches.length === 0) return 0;
  return Math.min(1, matches.length * 0.2);
}

// ==================== 建議生成 ====================

function generateSuggestions(matches: AiPatternMatch[]): { issue: string; suggestion: string }[] {
  const suggestions: { issue: string; suggestion: string }[] = [];
  const seen = new Set<string>();
  
  for (const match of matches) {
    const key = `${match.type}-${match.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    suggestions.push({
      issue: match.description,
      suggestion: match.suggestion,
    });
  }
  
  // 限制建議數量
  return suggestions.slice(0, 5);
}

// ==================== 動作決定 ====================

function determineAction(score: number, matches: AiPatternMatch[]): 'pass' | 'warn' | 'regenerate' {
  // 如果有 block 級別的匹配，建議重新生成
  const hasBlock = matches.some(m => m.severity === 'block');
  if (hasBlock) return 'regenerate';
  
  // 根據分數決定
  if (score >= 0.6) return 'regenerate';
  if (score >= 0.4) return 'warn';
  return 'pass';
}

// ==================== 日誌記錄 ====================

/**
 * 記錄檢測結果到資料庫
 */
export async function logDetection(
  userId: number,
  content: string,
  result: AiDetectionResult,
  candidateId?: number,
  draftId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(aiDetectorLogs).values({
    userId,
    candidateId: candidateId || null,
    draftId: draftId || null,
    contentSnippet: content.substring(0, 500),
    contentLength: content.length,
    overallScore: result.overallScore.toFixed(4),
    avoidListScore: result.scores.avoidListScore.toFixed(4),
    repetitionScore: result.scores.repetitionScore.toFixed(4),
    aiPhraseScore: result.scores.aiPhraseScore.toFixed(4),
    densityScore: result.scores.densityScore.toFixed(4),
    matchedPatterns: result.matches.map(m => ({
      pattern: m.pattern,
      type: m.type,
      position: m.position,
    })),
    suggestions: result.suggestions,
    action: result.action,
    wasModified: false,
    modifiedContent: null,
  });
}

/**
 * 快速檢測（不記錄日誌）
 */
export async function quickDetect(content: string, userId?: number): Promise<{
  score: number;
  isPass: boolean;
  topIssues: string[];
}> {
  const result = await detectAiPatterns(content, userId);
  
  return {
    score: result.overallScore,
    isPass: result.isPass,
    topIssues: result.suggestions.slice(0, 3).map(s => s.issue),
  };
}

/**
 * 取得 AI 分數的等級描述
 */
export function getScoreLevel(score: number): {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  label: string;
  color: string;
} {
  if (score < 0.2) {
    return { level: 'excellent', label: '非常自然', color: 'green' };
  } else if (score < 0.4) {
    return { level: 'good', label: '較自然', color: 'blue' };
  } else if (score < 0.6) {
    return { level: 'fair', label: '有 AI 痕跡', color: 'yellow' };
  } else {
    return { level: 'poor', label: 'AI 感明顯', color: 'red' };
  }
}
