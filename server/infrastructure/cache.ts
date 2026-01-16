/**
 * 快取服務模組
 * 用於快取常用計算結果，減少重複查詢和計算
 */

import { isFeatureEnabled } from './feature-flags';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

/**
 * 快取 TTL 配置（毫秒）
 */
export const CACHE_TTL = {
  USER_STYLE: 5 * 60 * 1000,        // 用戶風格資料：5 分鐘
  VIRAL_PATTERNS: 10 * 60 * 1000,   // 爆文模式分析：10 分鐘
  AVOID_PHRASES: 30 * 60 * 1000,    // 禁止句式清單：30 分鐘
  USER_METRICS: 5 * 60 * 1000,      // 用戶指標：5 分鐘
  TEMPLATES: 15 * 60 * 1000,        // 模板資料：15 分鐘
  EXAMPLES: 10 * 60 * 1000,         // 範例資料：10 分鐘
};

/**
 * 記憶體快取實作
 */
class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private maxSize: number = 1000; // 最大快取項目數

  /**
   * 取得快取值
   */
  get<T>(key: string): T | null {
    if (!isFeatureEnabled('CACHE_ENABLED')) {
      return null;
    }

    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 檢查是否過期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * 設定快取值
   */
  set<T>(key: string, value: T, ttl: number): void {
    if (!isFeatureEnabled('CACHE_ENABLED')) {
      return;
    }

    // 如果快取已滿，清理過期項目
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    // 如果還是滿的，刪除最舊的項目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.findOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
      createdAt: now,
    });
    this.stats.size = this.cache.size;
  }

  /**
   * 刪除快取值
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * 刪除符合前綴的所有快取
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      count++;
    });
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * 清空所有快取
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * 取得快取統計
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    return {
      ...this.stats,
      hitRate,
    };
  }

  /**
   * 清理過期項目
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
    this.stats.size = this.cache.size;
  }

  /**
   * 找到最舊的快取項目
   */
  private findOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    });

    return oldestKey;
  }
}

// 全域快取實例
const cache = new MemoryCache();

/**
 * 快取鍵生成器
 */
export const CacheKeys = {
  userStyle: (userId: string) => `user_style:${userId}`,
  userMetrics: (userId: string) => `user_metrics:${userId}`,
  viralPatterns: (userId: string) => `viral_patterns:${userId}`,
  avoidPhrases: () => 'avoid_phrases:all',
  templates: (type: string) => `templates:${type}`,
  examples: (tier: string, limit: number) => `examples:${tier}:${limit}`,
  recentUsage: (userId: string) => `recent_usage:${userId}`,
};

/**
 * 帶快取的函數包裝器
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  // 嘗試從快取取得
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 執行函數並快取結果
  const result = await fn();
  cache.set(key, result, ttl);
  return result;
}

/**
 * 使快取失效（用於資料更新後）
 */
export function invalidateCache(key: string): boolean {
  return cache.delete(key);
}

/**
 * 使用戶相關快取失效
 */
export function invalidateUserCache(userId: string): void {
  cache.deleteByPrefix(`user_style:${userId}`);
  cache.deleteByPrefix(`user_metrics:${userId}`);
  cache.deleteByPrefix(`viral_patterns:${userId}`);
  cache.deleteByPrefix(`recent_usage:${userId}`);
}

/**
 * 取得快取統計
 */
export function getCacheStats() {
  return cache.getStats();
}

/**
 * 清空所有快取
 */
export function clearAllCache(): void {
  cache.clear();
}

export { cache };
