/**
 * 指標收集器模組
 * 用於收集和追蹤系統運行指標
 */

interface MetricEntry {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface MetricSummary {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  latest: number;
}

/**
 * 指標類型
 */
type MetricType = 'counter' | 'gauge' | 'histogram';

interface MetricConfig {
  name: string;
  type: MetricType;
  description: string;
  buckets?: number[]; // 用於 histogram
}

/**
 * 預定義指標
 */
export const METRICS = {
  // 生成相關
  GENERATION_COUNT: 'generation_count',
  GENERATION_DURATION: 'generation_duration_ms',
  GENERATION_SUCCESS_RATE: 'generation_success_rate',
  
  // 品質相關
  QUALITY_CHECK_COUNT: 'quality_check_count',
  QUALITY_SCORE_AVG: 'quality_score_avg',
  QUALITY_RETRY_COUNT: 'quality_retry_count',
  
  // 快取相關
  CACHE_HIT_RATE: 'cache_hit_rate',
  CACHE_SIZE: 'cache_size',
  
  // Prompt 相關
  PROMPT_LENGTH: 'prompt_length',
  PROMPT_TRUNCATION_COUNT: 'prompt_truncation_count',
  
  // 用戶相關
  USER_STAGE_DISTRIBUTION: 'user_stage_distribution',
  ADAPTIVE_THRESHOLD_AVG: 'adaptive_threshold_avg',
};

/**
 * 指標收集器
 */
class MetricsCollector {
  private metrics: Map<string, MetricEntry[]> = new Map();
  private maxEntriesPerMetric: number = 1000;
  private retentionPeriod: number = 24 * 60 * 60 * 1000; // 24 小時

  /**
   * 記錄計數器指標（累加）
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>
  ): void {
    this.record(name, value, labels);
  }

  /**
   * 記錄量表指標（當前值）
   */
  setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.record(name, value, labels);
  }

  /**
   * 記錄直方圖指標（分佈）
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.record(name, value, labels);
  }

  /**
   * 記錄指標
   */
  private record(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const key = this.buildKey(name, labels);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const entries = this.metrics.get(key)!;
    entries.push({
      value,
      timestamp: Date.now(),
      labels,
    });

    // 限制條目數量
    if (entries.length > this.maxEntriesPerMetric) {
      entries.shift();
    }
  }

  /**
   * 取得指標摘要
   */
  getSummary(
    name: string,
    labels?: Record<string, string>,
    timeRange?: number // 毫秒
  ): MetricSummary | null {
    const key = this.buildKey(name, labels);
    const entries = this.metrics.get(key);

    if (!entries || entries.length === 0) {
      return null;
    }

    // 過濾時間範圍
    const now = Date.now();
    const filteredEntries = timeRange
      ? entries.filter(e => now - e.timestamp <= timeRange)
      : entries;

    if (filteredEntries.length === 0) {
      return null;
    }

    const values = filteredEntries.map(e => e.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
    };
  }

  /**
   * 取得所有指標名稱
   */
  getMetricNames(): string[] {
    const names = new Set<string>();
    this.metrics.forEach((_, key) => {
      const name = key.split(':')[0];
      names.add(name);
    });
    return Array.from(names);
  }

  /**
   * 清理過期指標
   */
  cleanup(): void {
    const now = Date.now();
    this.metrics.forEach((entries, key) => {
      const filtered = entries.filter(
        e => now - e.timestamp <= this.retentionPeriod
      );
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filtered);
      }
    });
  }

  /**
   * 重置所有指標
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * 建立指標鍵
   */
  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}:${labelStr}`;
  }
}

// 全域指標收集器實例
const metricsCollector = new MetricsCollector();

/**
 * 計時器工具
 */
export function createTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}

/**
 * 記錄生成指標
 */
export function recordGeneration(
  duration: number,
  success: boolean,
  contentType: string
): void {
  metricsCollector.incrementCounter(METRICS.GENERATION_COUNT, 1, {
    content_type: contentType,
    success: String(success),
  });
  metricsCollector.recordHistogram(METRICS.GENERATION_DURATION, duration, {
    content_type: contentType,
  });
}

/**
 * 記錄品質檢查指標
 */
export function recordQualityCheck(
  score: number,
  passed: boolean,
  retryCount: number
): void {
  metricsCollector.incrementCounter(METRICS.QUALITY_CHECK_COUNT, 1, {
    passed: String(passed),
  });
  metricsCollector.setGauge(METRICS.QUALITY_SCORE_AVG, score);
  if (retryCount > 0) {
    metricsCollector.incrementCounter(METRICS.QUALITY_RETRY_COUNT, retryCount);
  }
}

/**
 * 記錄 Prompt 長度
 */
export function recordPromptLength(length: number, truncated: boolean): void {
  metricsCollector.recordHistogram(METRICS.PROMPT_LENGTH, length);
  if (truncated) {
    metricsCollector.incrementCounter(METRICS.PROMPT_TRUNCATION_COUNT);
  }
}

/**
 * 記錄用戶階段
 */
export function recordUserStage(stage: string): void {
  metricsCollector.incrementCounter(METRICS.USER_STAGE_DISTRIBUTION, 1, {
    stage,
  });
}

/**
 * 取得指標摘要
 */
export function getMetricsSummary(): Record<string, MetricSummary | null> {
  const names = metricsCollector.getMetricNames();
  const result: Record<string, MetricSummary | null> = {};
  
  names.forEach(name => {
    result[name] = metricsCollector.getSummary(name);
  });
  
  return result;
}

export { metricsCollector };
