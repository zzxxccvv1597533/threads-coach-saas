# 動態個人化開頭生成系統：實作程式碼範例

**撰寫日期**：2026 年 1 月 16 日  
**版本**：v1.0

---

## 一、品質控制實作

### 1.1 修改 fewShotLearning.ts - 品質門檻

```typescript
// fewShotLearning.ts - 新增品質門檻常數

// ==================== 品質門檻設定 ====================

export const QUALITY_THRESHOLDS = {
  // Few-Shot Learning 最低門檻
  fewShotMinEngagement: 500,
  
  // 動態權重計算門檻
  weightCalculation: {
    highQuality: 1000,   // 高品質：完全信任
    mediumQuality: 500,  // 中品質：部分信任
    lowQuality: 100,     // 低品質：僅計數
  },
  
  // 爆文模式分析門檻
  viralPatternAnalysis: 1000,
  
  // 開頭 DNA 提取門檻
  openerDnaMinEngagement: 500,
};

// ==================== 修改 extractViralPatterns ====================

/**
 * 從用戶的風格樣本中提取成功模式（品質控制版）
 */
export async function extractViralPatterns(userId: number): Promise<ViralPattern[]> {
  const userStyle = await db.getUserWritingStyle(userId);
  
  if (!userStyle?.samplePosts) {
    return [];
  }
  
  const samplePosts = userStyle.samplePosts as Array<{
    content: string;
    engagement?: number;
    addedAt: string;
  }>;
  
  // ⚠️ 品質過濾：只使用高品質樣本進行模式分析
  const highQualitySamples = samplePosts.filter(
    p => (p.engagement || 0) >= QUALITY_THRESHOLDS.fewShotMinEngagement
  );
  
  if (highQualitySamples.length === 0) {
    console.log(`[FewShot] User ${userId} has no high-quality samples (>=${QUALITY_THRESHOLDS.fewShotMinEngagement})`);
    return [];
  }
  
  // 分析開頭模式（使用高品質樣本）
  const openerPatterns: Record<string, {
    count: number;
    totalEngagement: number;
    examples: string[];
  }> = {};
  
  for (const post of highQualitySamples) {
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
      successRate: (data.count / highQualitySamples.length) * 100,
      examples: data.examples,
    });
  }
  
  patterns.sort((a, b) => b.successRate - a.successRate);
  
  return patterns;
}
```

### 1.2 動態權重計算（品質控制版）

```typescript
// fewShotLearning.ts - 新增動態權重計算

export interface StyleWeightResult {
  systemWeight: number;
  userWeight: number;
  qualityWarning?: string;
  breakdown: {
    ipdCompleteness: number;
    highQualitySamples: number;
    totalSamples: number;
    viralPostCount: number;
  };
}

/**
 * 計算用戶風格權重（品質控制版）
 */
export async function calculateStyleWeight(userId: number): Promise<StyleWeightResult> {
  // 取得用戶資料
  const userStyle = await db.getUserWritingStyle(userId);
  const ipProfile = await db.getIpProfile(userId);
  
  const samplePosts = (userStyle?.samplePosts as Array<{
    content: string;
    engagement?: number;
  }>) || [];
  
  // 分類樣本
  const totalSamples = samplePosts.length;
  const highQualitySamples = samplePosts.filter(
    p => (p.engagement || 0) >= QUALITY_THRESHOLDS.weightCalculation.highQuality
  ).length;
  const mediumQualitySamples = samplePosts.filter(
    p => {
      const eng = p.engagement || 0;
      return eng >= QUALITY_THRESHOLDS.weightCalculation.mediumQuality &&
             eng < QUALITY_THRESHOLDS.weightCalculation.highQuality;
    }
  ).length;
  
  // 計算 IPD 完整度
  const ipdCompleteness = calculateIPDCompleteness(ipProfile);
  
  // 計算爆文數量（從戰報）
  const viralPostCount = await db.getViralPostCount(userId);
  
  // 基礎權重
  let userWeight = 30;
  let qualityWarning: string | undefined;
  
  // IPD 完整度加成
  if (ipdCompleteness >= 80) userWeight += 15;
  else if (ipdCompleteness >= 50) userWeight += 10;
  
  // ⚠️ 只有高品質樣本才能增加權重
  if (highQualitySamples >= 10) userWeight += 25;
  else if (highQualitySamples >= 5) userWeight += 15;
  else if (highQualitySamples >= 3) userWeight += 10;
  
  // 中品質樣本給予較少加成
  if (mediumQualitySamples >= 5) userWeight += 5;
  
  // 爆文數量加成
  if (viralPostCount >= 10) userWeight += 10;
  else if (viralPostCount >= 5) userWeight += 5;
  
  // ⚠️ 品質警告：樣本多但高品質少
  if (totalSamples >= 10 && highQualitySamples < 3) {
    qualityWarning = `您上傳了 ${totalSamples} 篇樣本，但高互動（≥${QUALITY_THRESHOLDS.weightCalculation.highQuality}）的只有 ${highQualitySamples} 篇。建議補充更多爆款貼文以提升個人化效果。`;
    userWeight = Math.min(userWeight, 40); // 限制最大權重
  }
  
  // 上限 90%
  userWeight = Math.min(userWeight, 90);
  
  return {
    systemWeight: 100 - userWeight,
    userWeight,
    qualityWarning,
    breakdown: {
      ipdCompleteness,
      highQualitySamples,
      totalSamples,
      viralPostCount,
    },
  };
}

function calculateIPDCompleteness(ipProfile: any): number {
  if (!ipProfile) return 0;
  
  let score = 0;
  const fields = [
    'occupation', 'voiceTone', 'viewpointStatement',
    'personaExpertise', 'personaEmotion', 'personaDaily',
  ];
  
  for (const field of fields) {
    if (ipProfile[field]) score += 100 / fields.length;
  }
  
  return Math.round(score);
}
```

---

## 二、開頭 DNA 提取實作

### 2.1 OpenerDNA 類型定義

```typescript
// fewShotLearning.ts - 新增類型定義

export interface OpenerDNA {
  structure: {
    hasColon: boolean;
    hasNumber: boolean;
    hasQuestion: boolean;
    hasTimeWord: boolean;
    hasEmotionWord: boolean;
    hasIdentityTag: boolean;
  };
  emotion: {
    tone: 'direct' | 'warm' | 'humorous' | 'neutral';
    intensity: number; // 1-10
  };
  vocabulary: {
    catchphrases: string[];
    emotionWords: string[];
    uniqueWords: string[];
  };
  engagement: number;
  successRate: number;
}

export interface OpenerDNAAnalysis {
  dnaList: OpenerDNA[];
  summary: {
    dominantStructure: string;
    dominantTone: string;
    topCatchphrases: string[];
    topEmotionWords: string[];
    avgEngagement: number;
  };
  recommendations: string[];
}
```

### 2.2 extractOpenerDNA 函數

```typescript
// fewShotLearning.ts - 新增 extractOpenerDNA

/**
 * 從用戶的爆文中提取開頭 DNA
 */
export async function extractOpenerDNA(userId: number): Promise<OpenerDNAAnalysis> {
  const userStyle = await db.getUserWritingStyle(userId);
  const samplePosts = (userStyle?.samplePosts as Array<{
    content: string;
    engagement?: number;
  }>) || [];
  
  // 只使用高品質樣本
  const highQualitySamples = samplePosts.filter(
    p => (p.engagement || 0) >= QUALITY_THRESHOLDS.openerDnaMinEngagement
  );
  
  if (highQualitySamples.length === 0) {
    return {
      dnaList: [],
      summary: {
        dominantStructure: '無資料',
        dominantTone: '無資料',
        topCatchphrases: [],
        topEmotionWords: [],
        avgEngagement: 0,
      },
      recommendations: ['建議上傳更多高互動（≥500）的爆款貼文'],
    };
  }
  
  // 分析每篇貼文的開頭
  const dnaList: OpenerDNA[] = highQualitySamples.map(post => {
    const firstLine = (post.content || '').split('\n')[0] || '';
    const fullContent = post.content || '';
    
    return {
      structure: analyzeStructure(firstLine),
      emotion: analyzeEmotion(firstLine),
      vocabulary: extractVocabulary(firstLine, fullContent),
      engagement: post.engagement || 0,
      successRate: (post.engagement || 0) / 1000,
    };
  });
  
  // 生成摘要
  const summary = generateDNASummary(dnaList);
  
  // 生成建議
  const recommendations = generateDNARecommendations(dnaList, summary);
  
  return {
    dnaList,
    summary,
    recommendations,
  };
}

function analyzeStructure(firstLine: string): OpenerDNA['structure'] {
  return {
    hasColon: /:/.test(firstLine) && firstLine.indexOf(':') < 15,
    hasNumber: /^\d+|第[一二三四五六七八九十]/.test(firstLine),
    hasQuestion: /[?？]$/.test(firstLine),
    hasTimeWord: /^(昨天|今天|上週|前幾天|那天|有一次|記得)/.test(firstLine),
    hasEmotionWord: /^(我真的|天啊|傻眼|崩潰|暈|無言|笑死|太扯|超級|好想)/.test(firstLine),
    hasIdentityTag: /^(身為|作為|當一個|我是)/.test(firstLine),
  };
}

function analyzeEmotion(firstLine: string): OpenerDNA['emotion'] {
  let tone: OpenerDNA['emotion']['tone'] = 'neutral';
  let intensity = 5;
  
  if (/傻眼|崩潰|笑死|太扯|超級|真的很/.test(firstLine)) {
    tone = 'direct';
    intensity = 8;
  } else if (/其實|說真的|你知道嗎|我跟你說/.test(firstLine)) {
    tone = 'warm';
    intensity = 6;
  } else if (/哈哈|XD|笑死|好笑/.test(firstLine)) {
    tone = 'humorous';
    intensity = 7;
  }
  
  return { tone, intensity };
}

function extractVocabulary(
  firstLine: string,
  fullContent: string
): OpenerDNA['vocabulary'] {
  // 口頭禪檢測
  const catchphrasePatterns = [
    { pattern: /說真的/g, word: '說真的' },
    { pattern: /其實/g, word: '其實' },
    { pattern: /真的/g, word: '真的' },
    { pattern: /欸/g, word: '欸' },
    { pattern: /吧/g, word: '吧' },
    { pattern: /你知道嗎/g, word: '你知道嗎' },
    { pattern: /我跟你說/g, word: '我跟你說' },
    { pattern: /不誇張/g, word: '不誇張' },
    { pattern: /認真說/g, word: '認真說' },
  ];
  
  const catchphrases: string[] = [];
  for (const { pattern, word } of catchphrasePatterns) {
    const matches = fullContent.match(pattern);
    if (matches && matches.length >= 2) {
      catchphrases.push(word);
    }
  }
  
  // 情緒詞檢測
  const emotionPattern = /傻眼|崩潰|暈|無言|笑死|太扯|超級|好想|真的很|超|很|好/g;
  const emotionMatches = fullContent.match(emotionPattern) || [];
  const emotionWords = [...new Set(emotionMatches)].slice(0, 5);
  
  return {
    catchphrases: [...new Set(catchphrases)].slice(0, 5),
    emotionWords,
    uniqueWords: [],
  };
}

function generateDNASummary(dnaList: OpenerDNA[]): OpenerDNAAnalysis['summary'] {
  if (dnaList.length === 0) {
    return {
      dominantStructure: '無資料',
      dominantTone: '無資料',
      topCatchphrases: [],
      topEmotionWords: [],
      avgEngagement: 0,
    };
  }
  
  // 統計結構特徵
  const structureStats = {
    colon: dnaList.filter(d => d.structure.hasColon).length,
    question: dnaList.filter(d => d.structure.hasQuestion).length,
    emotion: dnaList.filter(d => d.structure.hasEmotionWord).length,
    time: dnaList.filter(d => d.structure.hasTimeWord).length,
    identity: dnaList.filter(d => d.structure.hasIdentityTag).length,
  };
  
  // 找出主導結構
  const dominantStructure = Object.entries(structureStats)
    .sort((a, b) => b[1] - a[1])[0];
  
  const structureNames: Record<string, string> = {
    colon: '冒號斷言型',
    question: '反問開場型',
    emotion: '情緒爆發型',
    time: '故事敘事型',
    identity: '身分標籤型',
  };
  
  // 統計語調
  const toneStats: Record<string, number> = {};
  for (const dna of dnaList) {
    toneStats[dna.emotion.tone] = (toneStats[dna.emotion.tone] || 0) + 1;
  }
  const dominantTone = Object.entries(toneStats)
    .sort((a, b) => b[1] - a[1])[0];
  
  const toneNames: Record<string, string> = {
    direct: '直接犀利',
    warm: '溫暖親切',
    humorous: '幽默風趣',
    neutral: '中性平穩',
  };
  
  // 統計詞彙
  const allCatchphrases: string[] = [];
  const allEmotionWords: string[] = [];
  for (const dna of dnaList) {
    allCatchphrases.push(...dna.vocabulary.catchphrases);
    allEmotionWords.push(...dna.vocabulary.emotionWords);
  }
  
  const topCatchphrases = getTopItems(allCatchphrases, 3);
  const topEmotionWords = getTopItems(allEmotionWords, 3);
  
  // 計算平均互動
  const avgEngagement = dnaList.reduce((sum, d) => sum + d.engagement, 0) / dnaList.length;
  
  return {
    dominantStructure: structureNames[dominantStructure[0]] || '其他',
    dominantTone: toneNames[dominantTone[0]] || '中性',
    topCatchphrases,
    topEmotionWords,
    avgEngagement: Math.round(avgEngagement),
  };
}

function getTopItems(items: string[], count: number): string[] {
  const freq: Record<string, number> = {};
  for (const item of items) {
    freq[item] = (freq[item] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([item]) => item);
}

function generateDNARecommendations(
  dnaList: OpenerDNA[],
  summary: OpenerDNAAnalysis['summary']
): string[] {
  const recommendations: string[] = [];
  
  if (dnaList.length < 5) {
    recommendations.push(`目前只有 ${dnaList.length} 篇高品質樣本，建議上傳更多以提升分析準確度`);
  }
  
  if (summary.dominantStructure !== '無資料') {
    recommendations.push(`你最成功的開頭模式是「${summary.dominantStructure}」，建議優先使用`);
  }
  
  if (summary.topCatchphrases.length > 0) {
    recommendations.push(`你的口頭禪「${summary.topCatchphrases.join('、')}」是個人特色，可以適度使用`);
  }
  
  return recommendations;
}
```

---

## 三、快取機制實作

### 3.1 快取服務

```typescript
// server/cache.ts - 新增快取服務

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // 每 5 分鐘清理過期項目
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }
  
  set<T>(key: string, data: T, ttlMs: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  invalidate(keyPattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
  
  invalidateUser(userId: number): void {
    this.invalidate(`user:${userId}`);
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: [...this.cache.keys()],
    };
  }
  
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

export const appCache = new SimpleCache();

// 快取鍵生成器
export const CacheKeys = {
  userStyle: (userId: number) => `user:${userId}:style`,
  viralPatterns: (userId: number) => `user:${userId}:viral_patterns`,
  openerDNA: (userId: number) => `user:${userId}:opener_dna`,
  styleWeight: (userId: number) => `user:${userId}:style_weight`,
  avoidList: () => `global:avoid_list`,
  templates: () => `global:templates`,
};

// TTL 設定
export const CacheTTL = {
  userStyle: 300000,      // 5 分鐘
  viralPatterns: 600000,  // 10 分鐘
  openerDNA: 600000,      // 10 分鐘
  styleWeight: 300000,    // 5 分鐘
  avoidList: 1800000,     // 30 分鐘
  templates: 1800000,     // 30 分鐘
};
```

### 3.2 快取整合範例

```typescript
// fewShotLearning.ts - 整合快取

import { appCache, CacheKeys, CacheTTL } from './cache';

/**
 * 從用戶的風格樣本中提取成功模式（帶快取版）
 */
export async function extractViralPatterns(userId: number): Promise<ViralPattern[]> {
  const cacheKey = CacheKeys.viralPatterns(userId);
  
  // 嘗試從快取取得
  const cached = appCache.get<ViralPattern[]>(cacheKey);
  if (cached) {
    console.log(`[Cache] Hit: ${cacheKey}`);
    return cached;
  }
  
  console.log(`[Cache] Miss: ${cacheKey}`);
  
  // 執行原有邏輯
  const userStyle = await db.getUserWritingStyle(userId);
  // ... 原有計算邏輯 ...
  
  // 存入快取
  appCache.set(cacheKey, patterns, CacheTTL.viralPatterns);
  
  return patterns;
}

/**
 * 當用戶更新風格時，失效相關快取
 */
export function invalidateUserStyleCache(userId: number): void {
  appCache.invalidateUser(userId);
  console.log(`[Cache] Invalidated all cache for user ${userId}`);
}
```

---

## 四、品質檢查機制實作

### 4.1 品質檢查服務

```typescript
// server/qualityChecker.ts - 新增品質檢查服務

import { detectAiPatterns, AiDetectionResult } from './aiDetector';
import { applyContentFilters } from './contentFilters';

export interface QualityCheckResult {
  isPass: boolean;
  score: number;
  level: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  suggestions: string[];
  action: 'pass' | 'warn' | 'regenerate';
  retryCount: number;
  details: {
    aiScore: number;
    lengthScore: number;
    filterScore: number;
  };
}

export interface QualityCheckOptions {
  maxRetries?: number;
  targetLength?: { min: number; max: number };
  userId?: number;
}

const DEFAULT_OPTIONS: Required<QualityCheckOptions> = {
  maxRetries: 2,
  targetLength: { min: 150, max: 500 },
  userId: 0,
};

/**
 * 執行品質檢查
 */
export async function performQualityCheck(
  content: string,
  options: QualityCheckOptions = {}
): Promise<QualityCheckResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // 1. AI Detector 檢測
  const aiResult = await detectAiPatterns(content, opts.userId);
  
  // 2. 長度檢查
  const lengthResult = checkContentLength(content, opts.targetLength);
  
  // 3. 計算綜合分數
  const finalScore = calculateFinalScore(aiResult, lengthResult);
  
  // 4. 決定等級和動作
  const level = getScoreLevel(finalScore);
  const action = determineAction(finalScore, aiResult);
  
  return {
    isPass: finalScore < 0.4,
    score: finalScore,
    level,
    issues: aiResult.suggestions.map(s => s.issue),
    suggestions: aiResult.suggestions.map(s => s.suggestion),
    action,
    retryCount: 0,
    details: {
      aiScore: aiResult.overallScore,
      lengthScore: lengthResult.score,
      filterScore: 0,
    },
  };
}

function checkContentLength(
  content: string,
  target: { min: number; max: number }
): { isValid: boolean; score: number; deviation: number } {
  const length = content.length;
  
  if (length >= target.min && length <= target.max) {
    return { isValid: true, score: 0, deviation: 0 };
  }
  
  let deviation = 0;
  if (length < target.min) {
    deviation = (target.min - length) / target.min;
  } else {
    deviation = (length - target.max) / target.max;
  }
  
  return {
    isValid: false,
    score: Math.min(0.3, deviation * 0.5),
    deviation,
  };
}

function calculateFinalScore(
  aiResult: AiDetectionResult,
  lengthResult: { score: number }
): number {
  // AI 分數佔 80%，長度分數佔 20%
  return aiResult.overallScore * 0.8 + lengthResult.score * 0.2;
}

function getScoreLevel(score: number): QualityCheckResult['level'] {
  if (score < 0.2) return 'excellent';
  if (score < 0.4) return 'good';
  if (score < 0.6) return 'fair';
  return 'poor';
}

function determineAction(
  score: number,
  aiResult: AiDetectionResult
): QualityCheckResult['action'] {
  // 如果有 block 級別的匹配，建議重新生成
  const hasBlock = aiResult.matches.some(m => m.severity === 'block');
  if (hasBlock) return 'regenerate';
  
  if (score >= 0.6) return 'regenerate';
  if (score >= 0.4) return 'warn';
  return 'pass';
}

/**
 * 帶自動重試的品質檢查
 */
export async function performQualityCheckWithRetry(
  generateFn: () => Promise<string>,
  options: QualityCheckOptions = {}
): Promise<{ content: string; quality: QualityCheckResult }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let retryCount = 0;
  let bestResult: { content: string; quality: QualityCheckResult } | null = null;
  
  while (retryCount <= opts.maxRetries) {
    const content = await generateFn();
    const quality = await performQualityCheck(content, options);
    quality.retryCount = retryCount;
    
    // 記錄最佳結果
    if (!bestResult || quality.score < bestResult.quality.score) {
      bestResult = { content, quality };
    }
    
    // 如果通過，直接返回
    if (quality.isPass) {
      return { content, quality };
    }
    
    // 如果是警告級別，也可以接受
    if (quality.action === 'warn') {
      return { content, quality };
    }
    
    retryCount++;
    console.log(`[QualityCheck] Retry ${retryCount}/${opts.maxRetries}, score: ${quality.score.toFixed(2)}`);
  }
  
  // 返回最佳結果
  return bestResult!;
}
```

---

## 五、監控指標實作

### 5.1 生成指標收集

```typescript
// server/metrics.ts - 新增監控指標

export interface GenerationMetrics {
  userId: number;
  contentType: string;
  promptLength: number;
  llmCallCount: number;
  totalDurationMs: number;
  cacheHitRate: number;
  retryCount: number;
  qualityScore: number;
  isPass: boolean;
  timestamp: Date;
}

class MetricsCollector {
  private metrics: GenerationMetrics[] = [];
  private maxSize = 1000;
  
  record(metric: GenerationMetrics): void {
    this.metrics.push(metric);
    
    // 保持最大數量
    if (this.metrics.length > this.maxSize) {
      this.metrics = this.metrics.slice(-this.maxSize);
    }
    
    // 輸出日誌
    this.logMetric(metric);
    
    // 檢查警告
    this.checkWarnings(metric);
  }
  
  private logMetric(metric: GenerationMetrics): void {
    console.log('[Metrics]', {
      user: metric.userId,
      type: metric.contentType,
      promptLen: metric.promptLength,
      llmCalls: metric.llmCallCount,
      duration: `${metric.totalDurationMs}ms`,
      cacheHit: `${(metric.cacheHitRate * 100).toFixed(1)}%`,
      retries: metric.retryCount,
      quality: metric.qualityScore.toFixed(2),
      pass: metric.isPass,
    });
  }
  
  private checkWarnings(metric: GenerationMetrics): void {
    if (metric.promptLength > 4000) {
      console.warn('[Metrics] ⚠️ Prompt length exceeds 4000 chars');
    }
    if (metric.totalDurationMs > 15000) {
      console.warn('[Metrics] ⚠️ Generation took > 15 seconds');
    }
    if (metric.qualityScore > 0.6) {
      console.warn('[Metrics] ⚠️ Quality score is poor');
    }
  }
  
  getStats(timeRangeMs: number = 3600000): {
    count: number;
    avgDuration: number;
    avgQuality: number;
    passRate: number;
    avgPromptLength: number;
    avgCacheHit: number;
  } {
    const cutoff = Date.now() - timeRangeMs;
    const recent = this.metrics.filter(m => m.timestamp.getTime() > cutoff);
    
    if (recent.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        avgQuality: 0,
        passRate: 0,
        avgPromptLength: 0,
        avgCacheHit: 0,
      };
    }
    
    return {
      count: recent.length,
      avgDuration: recent.reduce((s, m) => s + m.totalDurationMs, 0) / recent.length,
      avgQuality: recent.reduce((s, m) => s + m.qualityScore, 0) / recent.length,
      passRate: recent.filter(m => m.isPass).length / recent.length,
      avgPromptLength: recent.reduce((s, m) => s + m.promptLength, 0) / recent.length,
      avgCacheHit: recent.reduce((s, m) => s + m.cacheHitRate, 0) / recent.length,
    };
  }
}

export const metricsCollector = new MetricsCollector();
```

---

## 六、整合到 routers.ts 的範例

```typescript
// routers.ts - 整合範例（部分程式碼）

import { appCache, CacheKeys, CacheTTL } from './cache';
import { performQualityCheckWithRetry } from './qualityChecker';
import { metricsCollector } from './metrics';
import { calculateStyleWeight, extractOpenerDNA } from './fewShotLearning';

// 在 generateDraft 中整合
generateDraft: protectedProcedure
  .input(/* ... */)
  .mutation(async ({ ctx, input }) => {
    const startTime = Date.now();
    let cacheHits = 0;
    let cacheMisses = 0;
    
    // 1. 取得用戶風格（帶快取）
    const styleKey = CacheKeys.userStyle(ctx.user.id);
    let userStyle = appCache.get(styleKey);
    if (userStyle) {
      cacheHits++;
    } else {
      cacheMisses++;
      userStyle = await db.getUserWritingStyle(ctx.user.id);
      appCache.set(styleKey, userStyle, CacheTTL.userStyle);
    }
    
    // 2. 取得動態權重（帶品質控制）
    const weightResult = await calculateStyleWeight(ctx.user.id);
    if (weightResult.qualityWarning) {
      // 可以在回應中包含警告
      console.log(`[Warning] ${weightResult.qualityWarning}`);
    }
    
    // 3. 取得開頭 DNA
    const openerDNA = await extractOpenerDNA(ctx.user.id);
    
    // 4. 建構 prompt（帶長度控制）
    const systemPrompt = buildSystemPrompt(/* ... */);
    const userPrompt = buildUserPrompt(/* ... */);
    
    // 檢查 prompt 長度
    const totalPromptLength = systemPrompt.length + userPrompt.length;
    if (totalPromptLength > 5000) {
      console.warn(`[Prompt] Length ${totalPromptLength} exceeds recommended limit`);
    }
    
    // 5. 生成內容（帶品質檢查和重試）
    const { content, quality } = await performQualityCheckWithRetry(
      async () => {
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        return response.choices[0]?.message?.content || '';
      },
      {
        maxRetries: 2,
        targetLength: { min: 150, max: 500 },
        userId: ctx.user.id,
      }
    );
    
    // 6. 記錄指標
    metricsCollector.record({
      userId: ctx.user.id,
      contentType: input.contentType,
      promptLength: totalPromptLength,
      llmCallCount: 1 + quality.retryCount,
      totalDurationMs: Date.now() - startTime,
      cacheHitRate: cacheHits / (cacheHits + cacheMisses),
      retryCount: quality.retryCount,
      qualityScore: quality.score,
      isPass: quality.isPass,
      timestamp: new Date(),
    });
    
    return {
      content,
      quality: {
        score: quality.score,
        level: quality.level,
        suggestions: quality.suggestions,
      },
      warning: weightResult.qualityWarning,
    };
  }),
```

---

**程式碼範例結束**

以上程式碼範例可以直接複製到專案中使用，或根據實際需求進行調整。
