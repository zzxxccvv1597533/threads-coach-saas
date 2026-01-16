/**
 * 三層品質檢查服務
 * 
 * 第一層：Prompt 注入禁止句式檢查（生成前）
 * 第二層：AI Detector + Content Filter（生成後）
 * 第三層：品質分數計算 + 自動重試
 */

import { isFeatureEnabled } from '../infrastructure/feature-flags';
import { recordQualityCheck } from '../infrastructure/metrics-collector';
import { 
  AVOID_PATTERNS, 
  checkAvoidPatterns, 
  replaceAvoidPatterns 
} from '../../shared/rules/opener-rules';
import { 
  calculateOverallQuality, 
  QUALITY_THRESHOLDS 
} from '../../shared/rules/quality-rules';

/**
 * 品質檢查結果
 */
export interface QualityCheckResult {
  passed: boolean;
  score: number;
  grade: 'excellent' | 'good' | 'acceptable' | 'poor';
  layer1: Layer1Result;
  layer2: Layer2Result;
  layer3: Layer3Result;
  suggestions: string[];
  shouldRetry: boolean;
  retryReason?: string;
}

/**
 * 第一層檢查結果
 */
interface Layer1Result {
  passed: boolean;
  blockedPatterns: string[];
  warningPatterns: string[];
}

/**
 * 第二層檢查結果
 */
interface Layer2Result {
  passed: boolean;
  aiScore: number;
  aiFlags: string[];
  contentFilterPassed: boolean;
}

/**
 * 第三層檢查結果
 */
interface Layer3Result {
  passed: boolean;
  qualityScore: number;
  details: Record<string, { score: number; passed: boolean }>;
}

/**
 * 重試配置
 */
export interface RetryConfig {
  maxRetries: number;
  minScoreForPass: number;
  retryOnWarnings: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  minScoreForPass: QUALITY_THRESHOLDS.acceptable,
  retryOnWarnings: false,
};

/**
 * 第一層檢查：Prompt 注入禁止句式
 */
export function checkLayer1(content: string): Layer1Result {
  const result = checkAvoidPatterns(content);
  
  const blockedPatterns = result.matches
    .filter(m => m.pattern.severity === 'block')
    .map(m => m.pattern.pattern);
  
  const warningPatterns = result.matches
    .filter(m => m.pattern.severity === 'warn')
    .map(m => m.pattern.pattern);
  
  return {
    passed: !result.hasBlocked,
    blockedPatterns,
    warningPatterns,
  };
}

/**
 * 第二層檢查：AI Detector + Content Filter
 */
export function checkLayer2(content: string): Layer2Result {
  // AI 痕跡檢測
  const aiFlags: string[] = [];
  let aiScore = 100;
  
  // 檢查 AI 短語
  const aiPhrases = [
    '不得不說', '值得一提', '毋庸置疑', '不可否認', '眾所周知',
    '事實上', '換句話說', '總而言之', '綜上所述', '由此可見',
  ];
  
  for (const phrase of aiPhrases) {
    if (content.includes(phrase)) {
      aiFlags.push(`AI 短語：${phrase}`);
      aiScore -= 10;
    }
  }
  
  // 檢查結構詞
  const structureWords = ['首先', '其次', '再者', '最後', '第一', '第二', '第三'];
  let structureCount = 0;
  for (const word of structureWords) {
    if (content.includes(word)) {
      structureCount++;
    }
  }
  if (structureCount >= 2) {
    aiFlags.push(`結構詞過多：${structureCount} 個`);
    aiScore -= structureCount * 5;
  }
  
  // 檢查句首重複
  const sentences = content.split(/[。！？\n]/).filter(s => s.trim().length > 0);
  const openers = sentences.map(s => s.trim().slice(0, 5));
  const openerCounts: Record<string, number> = {};
  for (const opener of openers) {
    openerCounts[opener] = (openerCounts[opener] || 0) + 1;
  }
  for (const [opener, count] of Object.entries(openerCounts)) {
    if (count >= 3) {
      aiFlags.push(`句首重複：「${opener}...」出現 ${count} 次`);
      aiScore -= 15;
    }
  }
  
  // Content Filter（基本檢查）
  const contentFilterPassed = !containsProhibitedContent(content);
  if (!contentFilterPassed) {
    aiFlags.push('包含禁止內容');
    aiScore -= 50;
  }
  
  return {
    passed: aiScore >= 60 && contentFilterPassed,
    aiScore: Math.max(0, aiScore),
    aiFlags,
    contentFilterPassed,
  };
}

/**
 * 檢查是否包含禁止內容
 */
function containsProhibitedContent(content: string): boolean {
  const prohibitedPatterns = [
    // 廣告相關
    /加我(微信|line|ig)/i,
    /私訊(領取|獲得)/i,
    /限時(優惠|免費)/i,
    // 敏感內容
    /政治敏感詞/i,
  ];
  
  return prohibitedPatterns.some(pattern => pattern.test(content));
}

/**
 * 第三層檢查：品質分數計算
 */
export function checkLayer3(
  content: string,
  contentType: 'short' | 'medium' | 'long' = 'medium'
): Layer3Result {
  const quality = calculateOverallQuality(content, contentType);
  
  const details: Record<string, { score: number; passed: boolean }> = {};
  for (const [key, result] of Object.entries(quality.checks)) {
    details[key] = {
      score: result.score,
      passed: result.passed,
    };
  }
  
  return {
    passed: quality.score >= QUALITY_THRESHOLDS.acceptable,
    qualityScore: quality.score,
    details,
  };
}

/**
 * 執行完整品質檢查
 */
export function performQualityCheck(
  content: string,
  contentType: 'short' | 'medium' | 'long' = 'medium',
  config: Partial<RetryConfig> = {}
): QualityCheckResult {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  
  // 如果功能未啟用，直接通過
  if (!isFeatureEnabled('QUALITY_CHECKER')) {
    return {
      passed: true,
      score: 100,
      grade: 'excellent',
      layer1: { passed: true, blockedPatterns: [], warningPatterns: [] },
      layer2: { passed: true, aiScore: 100, aiFlags: [], contentFilterPassed: true },
      layer3: { passed: true, qualityScore: 100, details: {} },
      suggestions: [],
      shouldRetry: false,
    };
  }
  
  // 執行三層檢查
  const layer1 = checkLayer1(content);
  const layer2 = checkLayer2(content);
  const layer3 = checkLayer3(content, contentType);
  
  // 計算綜合分數
  const score = Math.round(
    layer2.aiScore * 0.4 + layer3.qualityScore * 0.6
  );
  
  // 判斷等級
  let grade: 'excellent' | 'good' | 'acceptable' | 'poor';
  if (score >= QUALITY_THRESHOLDS.excellent) {
    grade = 'excellent';
  } else if (score >= QUALITY_THRESHOLDS.good) {
    grade = 'good';
  } else if (score >= QUALITY_THRESHOLDS.acceptable) {
    grade = 'acceptable';
  } else {
    grade = 'poor';
  }
  
  // 判斷是否通過
  const passed = layer1.passed && layer2.passed && layer3.passed;
  
  // 收集建議
  const suggestions: string[] = [];
  if (layer1.blockedPatterns.length > 0) {
    suggestions.push(`移除禁止句式：${layer1.blockedPatterns.join('、')}`);
  }
  if (layer1.warningPatterns.length > 0) {
    suggestions.push(`考慮替換：${layer1.warningPatterns.join('、')}`);
  }
  if (layer2.aiFlags.length > 0) {
    suggestions.push(...layer2.aiFlags.map(f => `修正：${f}`));
  }
  
  // 判斷是否需要重試
  let shouldRetry = false;
  let retryReason: string | undefined;
  
  if (!passed && score < finalConfig.minScoreForPass) {
    shouldRetry = true;
    retryReason = `品質分數 ${score} 低於門檻 ${finalConfig.minScoreForPass}`;
  } else if (!layer1.passed) {
    shouldRetry = true;
    retryReason = `包含禁止句式：${layer1.blockedPatterns.join('、')}`;
  }
  
  // 記錄指標
  recordQualityCheck(score, passed, 0);
  
  return {
    passed,
    score,
    grade,
    layer1,
    layer2,
    layer3,
    suggestions: suggestions.slice(0, 5),
    shouldRetry,
    retryReason,
  };
}

/**
 * 自動修復內容
 */
export function autoFixContent(content: string): {
  fixed: string;
  changes: string[];
} {
  const changes: string[] = [];
  let fixed = content;
  
  // 替換禁止句式
  const original = fixed;
  fixed = replaceAvoidPatterns(fixed);
  if (fixed !== original) {
    changes.push('替換了禁止句式');
  }
  
  // 移除多餘空格
  const beforeSpaces = fixed;
  fixed = fixed.replace(/\s+/g, ' ').trim();
  if (fixed !== beforeSpaces) {
    changes.push('移除了多餘空格');
  }
  
  return { fixed, changes };
}

/**
 * 帶自動重試的品質檢查
 */
export async function performQualityCheckWithRetry(
  generateFn: () => Promise<string>,
  contentType: 'short' | 'medium' | 'long' = 'medium',
  config: Partial<RetryConfig> = {}
): Promise<{
  content: string;
  result: QualityCheckResult;
  retryCount: number;
}> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  
  if (!isFeatureEnabled('QUALITY_AUTO_RETRY')) {
    const content = await generateFn();
    const result = performQualityCheck(content, contentType, config);
    return { content, result, retryCount: 0 };
  }
  
  let retryCount = 0;
  let bestContent = '';
  let bestResult: QualityCheckResult | null = null;
  
  while (retryCount <= finalConfig.maxRetries) {
    const content = await generateFn();
    const result = performQualityCheck(content, contentType, config);
    
    // 記錄最佳結果
    if (!bestResult || result.score > bestResult.score) {
      bestContent = content;
      bestResult = result;
    }
    
    // 如果通過或達到門檻，直接返回
    if (result.passed || result.score >= finalConfig.minScoreForPass) {
      recordQualityCheck(result.score, result.passed, retryCount);
      return { content, result, retryCount };
    }
    
    // 如果不需要重試，返回當前結果
    if (!result.shouldRetry) {
      break;
    }
    
    retryCount++;
  }
  
  // 返回最佳結果
  recordQualityCheck(bestResult!.score, bestResult!.passed, retryCount);
  return { content: bestContent, result: bestResult!, retryCount };
}
