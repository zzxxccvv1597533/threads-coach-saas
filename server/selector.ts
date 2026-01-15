/**
 * Selector 模組 - 規則式 rerank
 * 
 * 負責對生成的開頭候選進行排序和篩選
 * 根據 AI 分數、多樣性、模板權重等因素進行 rerank
 */

import { type OpenerCandidate } from "./openerGenerator";

// ============================================
// 類型定義
// ============================================

export interface SelectorConfig {
  // 權重配置
  aiScoreWeight: number;      // AI 分數權重（越低越好）
  diversityWeight: number;    // 多樣性權重
  templateWeight: number;     // 模板權重
  explorationBonus: number;   // 探索模式加分
  
  // 閾值配置
  maxAiScore: number;         // 最大允許的 AI 分數
  minDiversityScore: number;  // 最小多樣性分數
}

export interface RankedCandidate extends OpenerCandidate {
  rank: number;
  finalScore: number;
  scoreBreakdown: {
    aiComponent: number;
    diversityComponent: number;
    templateComponent: number;
    explorationBonus: number;
  };
  diversityScore: number;
}

export interface SelectorResult {
  rankedCandidates: RankedCandidate[];
  topPick: RankedCandidate | null;
  filteredCount: number;
  avgFinalScore: number;
}

// ============================================
// 預設配置
// ============================================

export const DEFAULT_SELECTOR_CONFIG: SelectorConfig = {
  aiScoreWeight: 0.4,       // AI 分數佔 40%
  diversityWeight: 0.3,     // 多樣性佔 30%
  templateWeight: 0.2,      // 模板權重佔 20%
  explorationBonus: 0.1,    // 探索模式額外加 10%
  maxAiScore: 0.7,          // AI 分數超過 0.7 的會被過濾
  minDiversityScore: 0.3,   // 多樣性分數低於 0.3 的會被警告
};

// ============================================
// 核心函數
// ============================================

/**
 * 對候選進行排序和篩選
 */
export function selectAndRank(
  candidates: OpenerCandidate[],
  config: Partial<SelectorConfig> = {}
): SelectorResult {
  const fullConfig = { ...DEFAULT_SELECTOR_CONFIG, ...config };
  
  if (candidates.length === 0) {
    return {
      rankedCandidates: [],
      topPick: null,
      filteredCount: 0,
      avgFinalScore: 0,
    };
  }
  
  // 計算每個候選的多樣性分數
  const candidatesWithDiversity = candidates.map((candidate, index) => ({
    ...candidate,
    diversityScore: calculateDiversityScore(candidate, candidates, index),
  }));
  
  // 過濾掉 AI 分數過高的候選
  const filteredCandidates = candidatesWithDiversity.filter(
    c => c.aiScore <= fullConfig.maxAiScore
  );
  const filteredCount = candidates.length - filteredCandidates.length;
  
  // 計算最終分數並排序
  const rankedCandidates: RankedCandidate[] = filteredCandidates
    .map(candidate => {
      const scoreBreakdown = calculateScoreBreakdown(candidate, fullConfig);
      const finalScore = 
        scoreBreakdown.aiComponent +
        scoreBreakdown.diversityComponent +
        scoreBreakdown.templateComponent +
        scoreBreakdown.explorationBonus;
      
      return {
        ...candidate,
        rank: 0, // 稍後設定
        finalScore,
        scoreBreakdown,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }));
  
  // 計算平均分數
  const avgFinalScore = rankedCandidates.length > 0
    ? rankedCandidates.reduce((sum, c) => sum + c.finalScore, 0) / rankedCandidates.length
    : 0;
  
  return {
    rankedCandidates,
    topPick: rankedCandidates[0] || null,
    filteredCount,
    avgFinalScore,
  };
}

/**
 * 計算多樣性分數
 * 基於與其他候選的文字相似度
 */
function calculateDiversityScore(
  candidate: OpenerCandidate,
  allCandidates: OpenerCandidate[],
  currentIndex: number
): number {
  if (allCandidates.length <= 1) return 1;
  
  const otherCandidates = allCandidates.filter((_, i) => i !== currentIndex);
  
  // 計算與其他候選的平均相似度
  const similarities = otherCandidates.map(other => 
    calculateTextSimilarity(candidate.openerText, other.openerText)
  );
  
  const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  
  // 多樣性 = 1 - 平均相似度
  return 1 - avgSimilarity;
}

/**
 * 計算兩段文字的相似度（簡化版）
 * 使用 Jaccard 相似度
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));
  
  const intersection = Array.from(words1).filter(w => words2.has(w));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);
  
  if (union.size === 0) return 0;
  
  return intersection.length / union.size;
}

/**
 * 計算分數細項
 */
function calculateScoreBreakdown(
  candidate: OpenerCandidate & { diversityScore: number },
  config: SelectorConfig
): RankedCandidate["scoreBreakdown"] {
  // AI 分數：越低越好，所以用 1 - aiScore
  const aiComponent = (1 - candidate.aiScore) * config.aiScoreWeight;
  
  // 多樣性分數
  const diversityComponent = candidate.diversityScore * config.diversityWeight;
  
  // 模板權重（這裡假設所有模板權重相同，實際可以從模板資料取得）
  const templateComponent = 0.5 * config.templateWeight;
  
  // 探索模式加分
  const explorationBonus = candidate.isExploration ? config.explorationBonus : 0;
  
  return {
    aiComponent,
    diversityComponent,
    templateComponent,
    explorationBonus,
  };
}

// ============================================
// 輔助函數
// ============================================

/**
 * 快速選擇最佳候選
 */
export function quickSelect(candidates: OpenerCandidate[]): OpenerCandidate | null {
  const result = selectAndRank(candidates);
  return result.topPick;
}

/**
 * 取得前 N 個候選
 */
export function getTopN(
  candidates: OpenerCandidate[],
  n: number,
  config?: Partial<SelectorConfig>
): RankedCandidate[] {
  const result = selectAndRank(candidates, config);
  return result.rankedCandidates.slice(0, n);
}

/**
 * 檢查候選是否通過基本品質檢查
 */
export function passesQualityCheck(
  candidate: OpenerCandidate,
  config: Partial<SelectorConfig> = {}
): { passes: boolean; reasons: string[] } {
  const fullConfig = { ...DEFAULT_SELECTOR_CONFIG, ...config };
  const reasons: string[] = [];
  
  // 檢查 AI 分數
  if (candidate.aiScore > fullConfig.maxAiScore) {
    reasons.push(`AI 分數過高 (${(candidate.aiScore * 100).toFixed(0)}%)`);
  }
  
  // 檢查是否有生成錯誤
  if (candidate.aiFlags.includes("generation_error")) {
    reasons.push("生成失敗");
  }
  
  // 檢查內容長度
  if (candidate.openerText.length < 20) {
    reasons.push("內容過短");
  }
  
  if (candidate.openerText.length > 200) {
    reasons.push("內容過長");
  }
  
  return {
    passes: reasons.length === 0,
    reasons,
  };
}

/**
 * 對候選進行分組（按模板類別）
 */
export function groupByCategory(
  candidates: OpenerCandidate[]
): Record<string, OpenerCandidate[]> {
  return candidates.reduce((groups, candidate) => {
    const category = candidate.templateCategory;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(candidate);
    return groups;
  }, {} as Record<string, OpenerCandidate[]>);
}

/**
 * 確保每個類別至少有一個候選
 */
export function ensureCategoryDiversity(
  candidates: RankedCandidate[],
  minPerCategory: number = 1
): RankedCandidate[] {
  const groups = groupByCategory(candidates) as Record<string, RankedCandidate[]>;
  const result: RankedCandidate[] = [];
  const usedIds = new Set<number>();
  
  // 先從每個類別選取最佳的
  for (const category of Object.keys(groups)) {
    const categoryBest = groups[category]
      .filter(c => !usedIds.has(c.id || 0))
      .slice(0, minPerCategory);
    
    for (const candidate of categoryBest) {
      result.push(candidate);
      if (candidate.id) usedIds.add(candidate.id);
    }
  }
  
  // 補充剩餘的高分候選
  const remaining = candidates
    .filter(c => !usedIds.has(c.id || 0))
    .sort((a, b) => b.finalScore - a.finalScore);
  
  result.push(...remaining);
  
  // 重新排序
  return result
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}
