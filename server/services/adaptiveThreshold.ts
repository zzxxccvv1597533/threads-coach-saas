/**
 * 自適應品質門檻服務
 * 實現混合方案：相對門檻 + 絕對下限
 * 
 * 核心邏輯：
 * 1. 計算用戶貼文的前 30% 作為「相對門檻」
 * 2. 根據用戶成長階段設定「絕對下限」
 * 3. 取兩者較大值作為最終門檻
 */

import { isFeatureEnabled } from '../infrastructure/feature-flags';
import { recordUserStage } from '../infrastructure/metrics-collector';

/**
 * 用戶指標介面
 */
export interface UserMetrics {
  totalPosts: number;      // 用戶上傳的總貼文數
  avgEngagement: number;   // 平均互動數（讚 + 留言 + 分享）
  maxEngagement: number;   // 最高單篇互動數
}

/**
 * 用戶成長階段
 */
export type UserStage = 'expert' | 'mature' | 'growing' | 'newbie';

/**
 * 階段配置
 */
export interface StageConfig {
  name: string;
  nameChinese: string;
  absoluteThreshold: number;
  systemWeight: number;
  userWeight: number;
  description: string;
}

/**
 * 自適應門檻結果
 */
export interface AdaptiveThresholdResult {
  threshold: number;
  stage: UserStage;
  stageConfig: StageConfig;
  relativeThreshold: number;
  absoluteThreshold: number;
  weights: { system: number; user: number };
  reasoning: string;
}

/**
 * 階段配置表
 */
export const STAGE_CONFIGS: Record<UserStage, StageConfig> = {
  expert: {
    name: 'expert',
    nameChinese: '專家級',
    absoluteThreshold: 300,
    systemWeight: 0.10,
    userWeight: 0.90,
    description: '最高互動 ≥1000 且 總貼文 ≥20',
  },
  mature: {
    name: 'mature',
    nameChinese: '成熟期',
    absoluteThreshold: 150,
    systemWeight: 0.30,
    userWeight: 0.70,
    description: '平均互動 ≥300 且 總貼文 ≥10',
  },
  growing: {
    name: 'growing',
    nameChinese: '成長期',
    absoluteThreshold: 50,
    systemWeight: 0.50,
    userWeight: 0.50,
    description: '平均互動 ≥100 且 總貼文 ≥5',
  },
  newbie: {
    name: 'newbie',
    nameChinese: '新手期',
    absoluteThreshold: 20,
    systemWeight: 0.70,
    userWeight: 0.30,
    description: '其他情況',
  },
};

/**
 * 判斷用戶成長階段
 * 
 * 判斷順序：專家級 → 成熟期 → 成長期 → 新手期
 * 符合第一個條件即停止
 */
export function determineUserStage(metrics: UserMetrics): UserStage {
  const { totalPosts, avgEngagement, maxEngagement } = metrics;
  
  // 專家級：最高互動 ≥1000 且 總貼文 ≥20
  if (maxEngagement >= 1000 && totalPosts >= 20) {
    return 'expert';
  }
  
  // 成熟期：平均互動 ≥300 且 總貼文 ≥10
  if (avgEngagement >= 300 && totalPosts >= 10) {
    return 'mature';
  }
  
  // 成長期：平均互動 ≥100 且 總貼文 ≥5
  if (avgEngagement >= 100 && totalPosts >= 5) {
    return 'growing';
  }
  
  // 新手期：其他情況
  return 'newbie';
}

/**
 * 計算相對門檻（前 30%）
 * 
 * 邏輯：取用戶所有貼文互動數的前 30% 位置的值
 * 這確保門檻隨用戶實際表現動態調整
 */
export function calculateRelativeThreshold(engagements: number[]): number {
  if (engagements.length === 0) return 0;
  
  // 降序排列
  const sorted = [...engagements].sort((a, b) => b - a);
  
  // 計算前 30% 的位置（至少取第一個）
  const top30Index = Math.max(0, Math.ceil(sorted.length * 0.3) - 1);
  
  return sorted[top30Index];
}

/**
 * 計算自適應門檻（混合方案核心函數）
 * 
 * @param metrics 用戶指標
 * @param engagements 用戶所有貼文的互動數陣列
 * @returns 自適應門檻結果
 */
export function calculateAdaptiveThreshold(
  metrics: UserMetrics,
  engagements: number[]
): AdaptiveThresholdResult {
  // 如果功能未啟用，使用預設值
  if (!isFeatureEnabled('ADAPTIVE_THRESHOLD')) {
    return {
      threshold: 50,
      stage: 'growing',
      stageConfig: STAGE_CONFIGS.growing,
      relativeThreshold: 0,
      absoluteThreshold: 50,
      weights: { system: 0.50, user: 0.50 },
      reasoning: 'Feature flag disabled, using default threshold',
    };
  }
  
  // 1. 判斷用戶階段
  const stage = determineUserStage(metrics);
  const stageConfig = STAGE_CONFIGS[stage];
  
  // 記錄指標
  recordUserStage(stage);
  
  // 2. 計算相對門檻
  const relativeThreshold = calculateRelativeThreshold(engagements);
  
  // 3. 取得絕對門檻
  const absoluteThreshold = stageConfig.absoluteThreshold;
  
  // 4. 取兩者較大值
  const threshold = Math.max(absoluteThreshold, relativeThreshold);
  
  // 5. 建立說明
  const reasoning = buildReasoning(
    stage,
    relativeThreshold,
    absoluteThreshold,
    threshold,
    metrics
  );
  
  return {
    threshold,
    stage,
    stageConfig,
    relativeThreshold,
    absoluteThreshold,
    weights: {
      system: stageConfig.systemWeight,
      user: stageConfig.userWeight,
    },
    reasoning,
  };
}

/**
 * 建立門檻計算說明
 */
function buildReasoning(
  stage: UserStage,
  relativeThreshold: number,
  absoluteThreshold: number,
  finalThreshold: number,
  metrics: UserMetrics
): string {
  const stageConfig = STAGE_CONFIGS[stage];
  
  const parts = [
    `用戶階段：${stageConfig.nameChinese}（${stageConfig.description}）`,
    `用戶指標：總貼文 ${metrics.totalPosts} 篇，平均互動 ${metrics.avgEngagement.toFixed(0)}，最高互動 ${metrics.maxEngagement}`,
    `相對門檻（前 30%）：${relativeThreshold}`,
    `絕對下限：${absoluteThreshold}`,
    `最終門檻：${finalThreshold}（取較大值）`,
    `範例權重：系統 ${(stageConfig.systemWeight * 100).toFixed(0)}% / 用戶 ${(stageConfig.userWeight * 100).toFixed(0)}%`,
  ];
  
  return parts.join(' | ');
}

/**
 * 根據門檻過濾用戶貼文
 * 
 * @param posts 用戶貼文陣列
 * @param threshold 互動門檻
 * @returns 符合門檻的貼文
 */
export function filterPostsByThreshold<T extends { engagement: number }>(
  posts: T[],
  threshold: number
): T[] {
  return posts.filter(post => post.engagement >= threshold);
}

/**
 * 計算用戶指標
 * 
 * @param engagements 用戶所有貼文的互動數陣列
 * @returns 用戶指標
 */
export function calculateUserMetrics(engagements: number[]): UserMetrics {
  if (engagements.length === 0) {
    return {
      totalPosts: 0,
      avgEngagement: 0,
      maxEngagement: 0,
    };
  }
  
  const sum = engagements.reduce((a, b) => a + b, 0);
  
  return {
    totalPosts: engagements.length,
    avgEngagement: sum / engagements.length,
    maxEngagement: Math.max(...engagements),
  };
}

/**
 * 取得階段的中文名稱
 */
export function getStageName(stage: UserStage): string {
  return STAGE_CONFIGS[stage].nameChinese;
}

/**
 * 取得所有階段配置（用於管理後台）
 */
export function getAllStageConfigs(): Record<UserStage, StageConfig> {
  return { ...STAGE_CONFIGS };
}

/**
 * 根據用戶階段選擇範例數量
 * 
 * @param stage 用戶階段
 * @param totalNeeded 總共需要的範例數
 * @returns 系統範例和用戶範例的數量
 */
export function calculateExampleCounts(
  stage: UserStage,
  totalNeeded: number
): { systemCount: number; userCount: number } {
  const config = STAGE_CONFIGS[stage];
  
  const userCount = Math.round(totalNeeded * config.userWeight);
  const systemCount = totalNeeded - userCount;
  
  return { systemCount, userCount };
}
