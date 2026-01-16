/**
 * 最近使用追蹤服務
 * 追蹤用戶最近使用的開頭模式，避免重複
 */

import { isFeatureEnabled } from '../infrastructure/feature-flags';
import { cache, CacheKeys, CACHE_TTL } from '../infrastructure/cache';

/**
 * 使用記錄
 */
interface UsageRecord {
  pattern: string;
  style: string;
  opener: string;
  usedAt: number;
}

/**
 * 最近使用配置
 */
export interface RecentUsageConfig {
  maxRecords: number;        // 最多記錄數量
  avoidDays: number;         // 避免重複的天數
  similarityThreshold: number; // 相似度門檻（0-1）
}

const DEFAULT_CONFIG: RecentUsageConfig = {
  maxRecords: 20,
  avoidDays: 7,
  similarityThreshold: 0.7,
};

/**
 * 取得用戶最近使用記錄
 */
export function getRecentUsage(userId: string): UsageRecord[] {
  if (!isFeatureEnabled('RECENT_USAGE_TRACKER')) {
    return [];
  }
  
  const key = CacheKeys.recentUsage(userId);
  const records = cache.get<UsageRecord[]>(key);
  
  return records || [];
}

/**
 * 記錄使用
 */
export function recordUsage(
  userId: string,
  pattern: string,
  style: string,
  opener: string
): void {
  if (!isFeatureEnabled('RECENT_USAGE_TRACKER')) {
    return;
  }
  
  const key = CacheKeys.recentUsage(userId);
  const records = getRecentUsage(userId);
  
  // 新增記錄
  records.unshift({
    pattern,
    style,
    opener,
    usedAt: Date.now(),
  });
  
  // 限制數量
  const trimmed = records.slice(0, DEFAULT_CONFIG.maxRecords);
  
  // 儲存（使用較長的 TTL）
  cache.set(key, trimmed, 7 * 24 * 60 * 60 * 1000); // 7 天
}

/**
 * 檢查是否最近使用過
 */
export function wasRecentlyUsed(
  userId: string,
  opener: string,
  config: Partial<RecentUsageConfig> = {}
): {
  used: boolean;
  similarRecord?: UsageRecord;
  similarity?: number;
} {
  if (!isFeatureEnabled('RECENT_USAGE_TRACKER')) {
    return { used: false };
  }
  
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const records = getRecentUsage(userId);
  const cutoffTime = Date.now() - finalConfig.avoidDays * 24 * 60 * 60 * 1000;
  
  // 過濾在時間範圍內的記錄
  const recentRecords = records.filter(r => r.usedAt >= cutoffTime);
  
  // 檢查相似度
  for (const record of recentRecords) {
    const similarity = calculateSimilarity(opener, record.opener);
    if (similarity >= finalConfig.similarityThreshold) {
      return {
        used: true,
        similarRecord: record,
        similarity,
      };
    }
  }
  
  return { used: false };
}

/**
 * 計算文字相似度（簡化版 Jaccard 相似度）
 */
function calculateSimilarity(text1: string, text2: string): number {
  // 分詞（簡單按字符分割）
  const chars1 = new Set(text1.split(''));
  const chars2 = new Set(text2.split(''));
  
  // 計算交集
  let intersection = 0;
  chars1.forEach(char => {
    if (chars2.has(char)) {
      intersection++;
    }
  });
  
  // 計算聯集
  const union = chars1.size + chars2.size - intersection;
  
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * 取得最近使用的風格分佈
 */
export function getRecentStyleDistribution(
  userId: string,
  days: number = 7
): Record<string, number> {
  const records = getRecentUsage(userId);
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  
  const recentRecords = records.filter(r => r.usedAt >= cutoffTime);
  
  const distribution: Record<string, number> = {};
  for (const record of recentRecords) {
    distribution[record.style] = (distribution[record.style] || 0) + 1;
  }
  
  return distribution;
}

/**
 * 取得應該避免的風格（最近使用過多的）
 */
export function getStylesToAvoid(
  userId: string,
  maxUsagePerStyle: number = 3
): string[] {
  const distribution = getRecentStyleDistribution(userId);
  
  const toAvoid: string[] = [];
  for (const [style, count] of Object.entries(distribution)) {
    if (count >= maxUsagePerStyle) {
      toAvoid.push(style);
    }
  }
  
  return toAvoid;
}

/**
 * 過濾掉最近使用過的開頭
 */
export function filterRecentlyUsed<T extends { opener: string }>(
  userId: string,
  candidates: T[],
  config: Partial<RecentUsageConfig> = {}
): T[] {
  if (!isFeatureEnabled('RECENT_USAGE_TRACKER')) {
    return candidates;
  }
  
  return candidates.filter(candidate => {
    const result = wasRecentlyUsed(userId, candidate.opener, config);
    return !result.used;
  });
}

/**
 * 清除用戶的使用記錄
 */
export function clearUsageHistory(userId: string): void {
  const key = CacheKeys.recentUsage(userId);
  cache.delete(key);
}

/**
 * 取得使用統計
 */
export function getUsageStats(userId: string): {
  totalRecords: number;
  recentCount: number;
  styleDistribution: Record<string, number>;
  oldestRecord?: Date;
  newestRecord?: Date;
} {
  const records = getRecentUsage(userId);
  const recentCount = records.filter(
    r => r.usedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000
  ).length;
  
  return {
    totalRecords: records.length,
    recentCount,
    styleDistribution: getRecentStyleDistribution(userId),
    oldestRecord: records.length > 0 
      ? new Date(records[records.length - 1].usedAt) 
      : undefined,
    newestRecord: records.length > 0 
      ? new Date(records[0].usedAt) 
      : undefined,
  };
}
