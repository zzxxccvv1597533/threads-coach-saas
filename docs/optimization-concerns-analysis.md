# 動態個人化開頭生成系統：五大關鍵問題深度分析

**撰寫日期**：2026 年 1 月 16 日  
**撰寫者**：Manus AI  
**版本**：v1.0

---

## 摘要

本報告針對「動態個人化開頭生成系統」優化方案中用戶提出的五個關鍵問題進行深度分析，包括：分層範例庫品質控制、函數整合方式、品質檢查機制、快取策略、以及系統複雜度。每個問題都提供了詳細的現況分析、風險評估、以及具體的解決方案建議。

---

## 一、分層範例庫品質控制問題

### 1.1 問題描述

用戶擔心：如果學員上傳了大量低品質（無互動數據）的貼文，動態權重系統可能會優先使用這些低品質範例，導致系統生成品質下降。

### 1.2 現況分析

目前系統的分層範例庫（`getTieredViralExamples`）設計如下：

| 層級 | 讚數門檻 | 用途 |
|------|----------|------|
| S 級 | ≥50,000 | 學習爆款公式 |
| A 級 | 10,000-50,000 | 主要參考 |
| B 級 | 3,000-10,000 | 風格多樣性 |
| C 級 | 1,000-3,000 | 備用 |

**關鍵發現**：目前的 `getTieredViralExamples` 函數已經內建了 **最低 1,000 讚門檻**（見 db.ts 第 3421 行），這意味著低於 1,000 讚的貼文不會被納入分層範例庫。

然而，用戶風格樣本（`userWritingStyles.samplePosts`）的處理邏輯不同：

```typescript
// fewShotLearning.ts 第 168-171 行
const recentSuccesses = samplePosts
  .filter(p => (p.engagement || 0) >= 50) // 門檻僅 50 互動
  .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
  .slice(0, 5);
```

**問題根源**：用戶上傳的樣本貼文（samplePosts）門檻過低（僅 50 互動），且沒有區分「系統爆款庫」和「用戶個人庫」的品質標準。

### 1.3 風險評估

| 風險場景 | 發生機率 | 影響程度 | 說明 |
|----------|----------|----------|------|
| 用戶上傳無數據貼文 | 高 | 中 | 用戶可能不知道要填寫互動數據 |
| 低品質範例污染生成 | 中 | 高 | 如果動態權重過度信任用戶資料 |
| 新用戶體驗下降 | 低 | 中 | 新用戶沒有足夠資料，會使用系統預設 |

### 1.4 解決方案

#### 方案 A：分級品質門檻（推薦）

為用戶上傳的樣本貼文設定分級門檻：

```typescript
// 建議的品質門檻
const USER_SAMPLE_THRESHOLDS = {
  // 用於 Few-Shot Learning 的最低門檻
  fewShotMinEngagement: 500, // 從 50 提升到 500
  
  // 用於動態權重計算的門檻
  weightCalculation: {
    highQuality: 1000,  // 高品質樣本
    mediumQuality: 500, // 中品質樣本
    lowQuality: 100,    // 低品質樣本（僅計數，不用於生成）
  },
  
  // 用於爆文模式分析的門檻
  viralPatternAnalysis: 1000, // 只有 1000+ 才算爆文
};
```

#### 方案 B：品質加權機制

不是簡單過濾，而是根據品質給予不同權重：

```typescript
function calculateSampleWeight(engagement: number): number {
  if (engagement >= 5000) return 1.0;   // 完全信任
  if (engagement >= 1000) return 0.8;   // 高度信任
  if (engagement >= 500) return 0.5;    // 中度信任
  if (engagement >= 100) return 0.2;    // 低度信任
  return 0.05;                          // 僅作參考
}
```

#### 方案 C：雙軌制（最終推薦）

將「系統爆款庫」和「用戶個人庫」分開管理：

| 來源 | 品質門檻 | 用途 | 權重 |
|------|----------|------|------|
| 系統爆款庫 | ≥1,000 讚 | 學習爆款公式 | 固定 |
| 用戶高品質樣本 | ≥500 互動 | 個人風格學習 | 動態 |
| 用戶低品質樣本 | <500 互動 | 僅用於風格分析 | 0 |

**實作程式碼範例**：

```typescript
// 修改 buildUserStyleContext 函數
const buildUserStyleContext = async () => {
  const samplePosts = userStyle?.samplePosts as Array<{
    content: string;
    engagement?: number;
    addedAt: string;
  }> | undefined;
  
  if (!samplePosts || samplePosts.length === 0) return '';
  
  // 分離高品質和低品質樣本
  const highQualitySamples = samplePosts.filter(p => (p.engagement || 0) >= 500);
  const allSamples = samplePosts;
  
  // 風格分析使用所有樣本（提取語氣特徵）
  const styleAnalysis = analyzeStyleFromSamples(allSamples);
  
  // Few-Shot Learning 只使用高品質樣本
  const fewShotSamples = highQualitySamples.length > 0 
    ? highQualitySamples 
    : []; // 如果沒有高品質樣本，不使用 Few-Shot
  
  // 如果沒有高品質樣本，給出提示
  if (highQualitySamples.length === 0) {
    parts.push(`【提示】目前沒有高互動樣本（≥500），建議上傳更多爆款貼文以提升個人化效果。`);
  }
  
  return parts.join('\n');
};
```

### 1.5 動態權重計算的安全機制

修改 `calculateStyleWeight` 函數，加入品質檢查：

```typescript
function calculateStyleWeight(userId: number): {
  systemWeight: number;
  userWeight: number;
  qualityWarning?: string;
} {
  const ipdCompleteness = await getIPDCompleteness(userId);
  const viralPostCount = await getViralPostCount(userId); // 只計算 ≥500 互動的
  const writingStyleSamples = await getWritingStyleSamples(userId);
  const highQualitySamples = await getHighQualitySamples(userId); // 新增：≥500 互動
  
  let userWeight = 30;
  let qualityWarning: string | undefined;
  
  // 只有高品質樣本才能增加權重
  if (highQualitySamples >= 10) userWeight += 25;
  else if (highQualitySamples >= 5) userWeight += 15;
  else if (highQualitySamples >= 3) userWeight += 10;
  
  // 如果樣本很多但高品質樣本很少，給出警告
  if (writingStyleSamples >= 10 && highQualitySamples < 3) {
    qualityWarning = '您上傳了很多樣本，但高互動（≥500）的樣本較少，建議補充更多爆款貼文';
    userWeight = Math.min(userWeight, 40); // 限制最大權重
  }
  
  userWeight = Math.min(userWeight, 90);
  
  return {
    systemWeight: 100 - userWeight,
    userWeight,
    qualityWarning,
  };
}
```

---

## 二、函數整合方式問題

### 2.1 問題描述

用戶詢問：`extractOpenerDNA` 和 `buildPersonalizedOpenerPrompt` 這兩個新函數如何與現有的 `fewShotLearning.ts` 整合？

### 2.2 現況架構分析

目前系統的開頭生成相關模組：

```
┌─────────────────────────────────────────────────────────────┐
│                      routers.ts                              │
│  - generateDraft (主要生成邏輯)                              │
│  - buildUserStyleContext (用戶風格上下文)                    │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ openerGenerator │ │ fewShotLearning │ │ data-driven-    │
│ .ts             │ │ .ts             │ │ prompt-builder  │
│ - generateMulti │ │ - extractViral  │ │ .ts             │
│   pleOpeners    │ │   Patterns      │ │ - buildLayer1   │
│ - buildOpener   │ │ - buildEnhanced │ │ - buildLayer2   │
│   Prompt        │ │   FewShotContext│ │ - buildLayer3   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      promptService.ts                        │
│  - getActiveTemplates                                        │
│  - getAvoidList                                              │
│  - DEFAULT_AVOID_PATTERNS                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 整合方案

#### 方案：擴展 fewShotLearning.ts

將新函數整合到現有的 `fewShotLearning.ts` 中，而不是創建新檔案：

```typescript
// fewShotLearning.ts 新增內容

// ==================== 開頭 DNA 提取 ====================

export interface OpenerDNA {
  structure: {
    hasColon: boolean;
    hasNumber: boolean;
    hasQuestion: boolean;
    hasTimeWord: boolean;
    hasEmotionWord: boolean;
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
  successRate: number;
}

/**
 * 從用戶的爆文中提取開頭 DNA
 * 整合到現有的 extractViralPatterns 函數
 */
export async function extractOpenerDNA(userId: number): Promise<OpenerDNA[]> {
  // 1. 取得用戶的高品質樣本（≥500 互動）
  const userStyle = await db.getUserWritingStyle(userId);
  const samplePosts = (userStyle?.samplePosts as Array<{
    content: string;
    engagement?: number;
  }>) || [];
  
  const highQualitySamples = samplePosts.filter(p => (p.engagement || 0) >= 500);
  
  if (highQualitySamples.length === 0) {
    return []; // 沒有高品質樣本，返回空
  }
  
  // 2. 分析每篇貼文的開頭
  return highQualitySamples.map(post => {
    const firstLine = post.content.split('\n')[0] || '';
    
    return {
      structure: analyzeStructure(firstLine),
      emotion: analyzeEmotion(firstLine),
      vocabulary: extractVocabulary(firstLine, post.content),
      successRate: (post.engagement || 0) / 1000, // 正規化
    };
  });
}

/**
 * 建構個人化開頭提示詞
 * 整合 OpenerDNA + 現有的 buildPersonalizedPrompt
 */
export async function buildPersonalizedOpenerPrompt(
  userId: number,
  material: string,
  contentType: string
): Promise<string> {
  // 1. 取得開頭 DNA
  const openerDNA = await extractOpenerDNA(userId);
  
  // 2. 取得現有的 Few-Shot 上下文
  const fewShotContext = await buildEnhancedFewShotContext(userId);
  
  // 3. 取得最近使用記錄（避免重複）
  const recentUsage = await getRecentOpenerUsage(userId, 7);
  
  // 4. 選擇最佳模式
  const bestPattern = selectOptimalPattern(openerDNA, recentUsage);
  
  // 5. 組合提示詞
  const parts: string[] = [];
  
  // 如果有 DNA 資料
  if (openerDNA.length > 0) {
    parts.push(`=== 你的開頭成功模式（數據驅動）===`);
    parts.push(`根據你 ${openerDNA.length} 篇高互動貼文的分析：`);
    parts.push(``);
    
    // 找出最成功的結構特徵
    const structureStats = analyzeStructureStats(openerDNA);
    parts.push(`【最成功的結構】`);
    if (structureStats.colonRate > 0.5) parts.push(`  • 冒號斷言（${(structureStats.colonRate * 100).toFixed(0)}% 使用率）`);
    if (structureStats.questionRate > 0.3) parts.push(`  • 反問句式（${(structureStats.questionRate * 100).toFixed(0)}% 使用率）`);
    if (structureStats.emotionRate > 0.4) parts.push(`  • 情緒開場（${(structureStats.emotionRate * 100).toFixed(0)}% 使用率）`);
    parts.push(``);
  }
  
  // 整合現有的個人化提示詞
  if (fewShotContext.personalizedPrompt) {
    parts.push(fewShotContext.personalizedPrompt);
  }
  
  // 避免重複的指令
  if (recentUsage.length > 0) {
    parts.push(`=== 最近用過的開頭（避免重複）===`);
    recentUsage.slice(0, 3).forEach(u => {
      parts.push(`  • ${u.openerPattern}: ${u.generatedOpener?.substring(0, 30)}...`);
    });
    parts.push(``);
  }
  
  return parts.join('\n');
}

// 輔助函數
function analyzeStructure(firstLine: string): OpenerDNA['structure'] {
  return {
    hasColon: /:/.test(firstLine) && firstLine.indexOf(':') < 15,
    hasNumber: /^\d+|第[一二三四五]/.test(firstLine),
    hasQuestion: /[?？]$/.test(firstLine),
    hasTimeWord: /^(昨天|今天|上週|前幾天|那天)/.test(firstLine),
    hasEmotionWord: /^(我真的|天啊|傻眼|崩潰|笑死|太扯)/.test(firstLine),
  };
}

function analyzeEmotion(firstLine: string): OpenerDNA['emotion'] {
  // 檢測語調
  let tone: OpenerDNA['emotion']['tone'] = 'neutral';
  let intensity = 5;
  
  if (/傻眼|崩潰|笑死|太扯|超級/.test(firstLine)) {
    tone = 'direct';
    intensity = 8;
  } else if (/其實|說真的|你知道嗎/.test(firstLine)) {
    tone = 'warm';
    intensity = 6;
  } else if (/哈哈|XD|笑死/.test(firstLine)) {
    tone = 'humorous';
    intensity = 7;
  }
  
  return { tone, intensity };
}

function extractVocabulary(firstLine: string, fullContent: string): OpenerDNA['vocabulary'] {
  // 提取口頭禪
  const catchphrasePatterns = [
    /說真的/g, /其實/g, /真的/g, /欸/g, /吧/g,
    /你知道嗎/g, /我跟你說/g, /不誇張/g,
  ];
  
  const catchphrases: string[] = [];
  for (const pattern of catchphrasePatterns) {
    const matches = fullContent.match(pattern);
    if (matches && matches.length >= 2) {
      catchphrases.push(matches[0]);
    }
  }
  
  // 提取情緒詞
  const emotionPatterns = /傻眼|崩潰|暈|無言|笑死|太扯|超級|好想|真的很/g;
  const emotionWords = [...new Set(fullContent.match(emotionPatterns) || [])];
  
  return {
    catchphrases: [...new Set(catchphrases)].slice(0, 5),
    emotionWords: emotionWords.slice(0, 5),
    uniqueWords: [], // 可以進一步擴展
  };
}
```

### 2.4 整合後的調用流程

```
用戶請求生成開頭
       │
       ▼
┌─────────────────────────────────────────┐
│ opener.generate API (routers.ts)         │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ buildPersonalizedOpenerPrompt()          │
│ (fewShotLearning.ts)                     │
│   ├── extractOpenerDNA()                 │
│   ├── buildEnhancedFewShotContext()      │
│   └── getRecentOpenerUsage()             │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ generateMultipleOpeners()                │
│ (openerGenerator.ts)                     │
│   ├── selectTemplatesForGeneration()     │
│   ├── buildOpenerPrompt() + 個人化上下文 │
│   └── detectAiPatterns()                 │
└─────────────────────────────────────────┘
       │
       ▼
返回候選開頭列表
```

---

## 三、品質檢查機制問題

### 3.1 問題描述

用戶詢問：「AI 生成品質不穩定」的風險緩解措施「加入品質檢查機制」的具體規格是什麼？

### 3.2 現況分析

目前系統已有的品質檢查機制：

| 機制 | 檔案 | 功能 | 檢查時機 |
|------|------|------|----------|
| AI Detector | aiDetector.ts | 檢測 AI 痕跡 | 生成後 |
| Content Filters | contentFilters.ts | 過濾髒話、敏感詞 | 生成後 |
| Avoid List | promptService.ts | 禁止句式清單 | 生成前（prompt 注入） |

**現有 AI Detector 的四大檢測維度**：

1. **Avoid-list 匹配**（權重 35%）：檢測禁止句式
2. **重複模式**（權重 25%）：檢測句子開頭重複、詞彙過度使用
3. **AI 短語**（權重 25%）：檢測常見 AI 用語
4. **句式密度**（權重 15%）：檢測過於工整的結構

### 3.3 完整品質檢查機制規格

#### 3.3.1 三層品質檢查架構

```
┌─────────────────────────────────────────────────────────────┐
│                    第一層：生成前檢查                         │
│  - Prompt 注入禁止句式                                       │
│  - 檢查用戶輸入的素材品質                                    │
│  - 驗證模板可用性                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    第二層：生成後檢查                         │
│  - AI Detector 分數檢測                                      │
│  - Content Filters 過濾                                      │
│  - 長度和格式驗證                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    第三層：重試機制                           │
│  - 分數 ≥ 0.6：自動重新生成（最多 2 次）                     │
│  - 分數 0.4-0.6：標記警告，讓用戶決定                        │
│  - 分數 < 0.4：通過                                          │
└─────────────────────────────────────────────────────────────┘
```

#### 3.3.2 品質檢查流程圖

```typescript
interface QualityCheckResult {
  isPass: boolean;
  score: number;
  level: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  suggestions: string[];
  action: 'pass' | 'warn' | 'regenerate';
  retryCount: number;
}

async function performQualityCheck(
  content: string,
  userId: number,
  maxRetries: number = 2
): Promise<QualityCheckResult> {
  let retryCount = 0;
  let currentContent = content;
  
  while (retryCount <= maxRetries) {
    // 1. AI Detector 檢測
    const aiResult = await detectAiPatterns(currentContent, userId);
    
    // 2. Content Filters 過濾
    const filteredContent = await applyContentFilters(currentContent, userId);
    
    // 3. 長度檢查
    const lengthCheck = checkContentLength(filteredContent);
    
    // 4. 綜合評分
    const finalScore = calculateFinalScore(aiResult, lengthCheck);
    
    // 5. 決定動作
    if (finalScore < 0.4) {
      return {
        isPass: true,
        score: finalScore,
        level: finalScore < 0.2 ? 'excellent' : 'good',
        issues: [],
        suggestions: [],
        action: 'pass',
        retryCount,
      };
    }
    
    if (finalScore >= 0.6 && retryCount < maxRetries) {
      // 自動重試
      retryCount++;
      currentContent = await regenerateWithFeedback(content, aiResult.suggestions);
      continue;
    }
    
    // 返回結果（可能是 warn 或最終的 regenerate）
    return {
      isPass: finalScore < 0.6,
      score: finalScore,
      level: finalScore < 0.4 ? 'good' : finalScore < 0.6 ? 'fair' : 'poor',
      issues: aiResult.suggestions.map(s => s.issue),
      suggestions: aiResult.suggestions.map(s => s.suggestion),
      action: finalScore >= 0.6 ? 'regenerate' : 'warn',
      retryCount,
    };
  }
  
  // 達到最大重試次數
  return {
    isPass: false,
    score: 1,
    level: 'poor',
    issues: ['達到最大重試次數'],
    suggestions: ['建議手動修改或更換主題'],
    action: 'regenerate',
    retryCount,
  };
}
```

#### 3.3.3 品質分數計算公式

```typescript
function calculateFinalScore(
  aiResult: AiDetectionResult,
  lengthCheck: { isValid: boolean; deviation: number }
): number {
  // 基礎分數：AI Detector 分數
  let score = aiResult.overallScore;
  
  // 長度懲罰
  if (!lengthCheck.isValid) {
    score += lengthCheck.deviation * 0.1; // 每偏離 10% 加 0.01 分
  }
  
  // 嚴重問題懲罰
  const blockCount = aiResult.matches.filter(m => m.severity === 'block').length;
  score += blockCount * 0.15;
  
  return Math.min(1, score);
}
```

#### 3.3.4 品質等級定義

| 等級 | 分數範圍 | 標籤 | 動作 | 說明 |
|------|----------|------|------|------|
| Excellent | 0 - 0.2 | 非常自然 | 通過 | 幾乎無 AI 痕跡 |
| Good | 0.2 - 0.4 | 較自然 | 通過 | 輕微 AI 痕跡，可接受 |
| Fair | 0.4 - 0.6 | 有 AI 痕跡 | 警告 | 建議修改，但不強制 |
| Poor | 0.6 - 1.0 | AI 感明顯 | 重新生成 | 需要重新生成 |

---

## 四、快取策略問題

### 4.1 問題描述

用戶詢問：「快取常用計算結果」的具體做法是什麼？目前系統有沒有快取機制？

### 4.2 現況分析

經過程式碼搜尋，**目前系統沒有任何快取機制**。每次請求都會重新查詢資料庫和計算。

需要快取的計算結果：

| 計算項目 | 調用頻率 | 計算成本 | 快取價值 |
|----------|----------|----------|----------|
| 用戶風格資料 | 每次生成 | 中 | 高 |
| 爆文模式分析 | 每次生成 | 高 | 高 |
| 開頭 DNA | 每次生成 | 高 | 高 |
| 禁止句式清單 | 每次生成 | 低 | 中 |
| 模板列表 | 每次生成 | 低 | 中 |
| 動態權重 | 每次生成 | 中 | 高 |

### 4.3 快取策略設計

#### 4.3.1 快取架構

```typescript
// 簡單的記憶體快取實現
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // 存活時間（毫秒）
}

class SimpleCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  
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
  
  invalidate(keyPattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const appCache = new SimpleCache();
```

#### 4.3.2 快取策略表

| 快取項目 | 快取鍵 | TTL | 失效條件 |
|----------|--------|-----|----------|
| 用戶風格 | `user_style:${userId}` | 5 分鐘 | 用戶更新風格設定 |
| 爆文模式 | `viral_patterns:${userId}` | 10 分鐘 | 用戶新增爆文 |
| 開頭 DNA | `opener_dna:${userId}` | 10 分鐘 | 用戶新增樣本 |
| 禁止句式 | `avoid_list:global` | 30 分鐘 | 管理員更新 |
| 模板列表 | `templates:active` | 30 分鐘 | 管理員更新 |
| 動態權重 | `style_weight:${userId}` | 5 分鐘 | 用戶資料變更 |

#### 4.3.3 快取使用範例

```typescript
// 修改 extractViralPatterns 函數
export async function extractViralPatterns(userId: number): Promise<ViralPattern[]> {
  const cacheKey = `viral_patterns:${userId}`;
  
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
  appCache.set(cacheKey, patterns, 600000); // 10 分鐘
  
  return patterns;
}

// 當用戶更新風格時，失效相關快取
export async function invalidateUserCache(userId: number): void {
  appCache.invalidate(`user_style:${userId}`);
  appCache.invalidate(`viral_patterns:${userId}`);
  appCache.invalidate(`opener_dna:${userId}`);
  appCache.invalidate(`style_weight:${userId}`);
}
```

#### 4.3.4 預期效能提升

| 場景 | 無快取 | 有快取 | 提升 |
|------|--------|--------|------|
| 連續生成 5 篇 | 5 次 DB 查詢 | 1 次 DB 查詢 | 80% |
| 同一用戶 10 分鐘內 | 每次重新計算 | 首次計算，後續快取 | 90% |
| 模板列表查詢 | 每次查詢 | 30 分鐘內共用 | 95% |

---

## 五、系統複雜度問題

### 5.1 問題描述

用戶擔心：過長或過於複雜的 prompt 和函數是否會導致類似過去的問題？

### 5.2 現況複雜度分析

#### 5.2.1 檔案行數統計

| 檔案 | 行數 | 主要功能 |
|------|------|----------|
| routers.ts | 5,691 | 主要路由和生成邏輯 |
| opener-rules.ts | 869 | 開頭規則定義 |
| data-driven-prompt-builder.ts | 796 | 數據驅動 prompt 建構 |
| content-type-rules.ts | 584 | 內容類型規則 |
| aiDetector.ts | 471 | AI 痕跡檢測 |
| openerGenerator.ts | 466 | 開頭生成器 |
| fewShotLearning.ts | 419 | Few-Shot 學習 |
| promptService.ts | 380 | Prompt 服務 |
| **總計** | **9,676** | - |

#### 5.2.2 Prompt 長度估算

目前 `generateDraft` 的完整 prompt 組成：

| 組件 | 估計字數 | 來源 |
|------|----------|------|
| System Prompt 基礎 | ~500 | 固定 |
| 知識庫內容 | ~1,000 | KNOWLEDGE_BASE |
| 內容類型規則 | ~300 | content-type-rules |
| 開頭規則 | ~400 | opener-rules |
| 用戶風格上下文 | ~500 | buildUserStyleContext |
| 數據驅動上下文 | ~600 | data-driven-prompt-builder |
| Few-Shot 範例 | ~600 | fewShotLearning |
| **總計** | **~3,900** | - |

#### 5.2.3 LLM 調用次數

| 功能 | 調用次數 | 說明 |
|------|----------|------|
| 生成開頭候選 | 5 次（並行） | 每個模板一次 |
| 生成完整貼文 | 1 次 | 主要生成 |
| AI 痕跡檢測 | 0 次 | 規則版，不調用 LLM |
| **單次生成總計** | **6 次** | - |

### 5.3 複雜度風險評估

| 風險 | 可能性 | 影響 | 現況 |
|------|--------|------|------|
| Prompt 過長導致截斷 | 低 | 高 | ~3,900 字，GPT-4 支援 128K |
| 函數調用鏈過深 | 中 | 中 | 最深 4 層 |
| 並行調用失敗 | 低 | 中 | 已有錯誤處理 |
| 記憶體使用過高 | 低 | 低 | 無快取，每次重新計算 |

### 5.4 複雜度控制建議

#### 5.4.1 Prompt 長度控制

```typescript
// 設定 prompt 長度上限
const PROMPT_LENGTH_LIMITS = {
  systemPrompt: 2000,      // System prompt 上限
  userContext: 1000,       // 用戶上下文上限
  fewShotExamples: 1500,   // Few-Shot 範例上限
  total: 5000,             // 總上限
};

function truncatePrompt(prompt: string, limit: number): string {
  if (prompt.length <= limit) return prompt;
  
  // 智能截斷：保留開頭和結尾的重要內容
  const keepStart = Math.floor(limit * 0.7);
  const keepEnd = Math.floor(limit * 0.25);
  
  return prompt.substring(0, keepStart) + 
         '\n...[內容已截斷]...\n' + 
         prompt.substring(prompt.length - keepEnd);
}
```

#### 5.4.2 函數調用鏈簡化

目前的調用鏈：
```
routers.ts
  → buildUserStyleContext()
    → db.getUserWritingStyle()
    → db.getIpProfile()
    → extractViralPatterns()
      → db.getUserWritingStyle()  // 重複查詢！
```

建議簡化為：
```
routers.ts
  → buildGenerationContext()  // 統一的上下文建構函數
    → 一次性取得所有需要的資料
    → 快取結果
```

#### 5.4.3 模組化重構建議

```
目前結構（分散）：
├── routers.ts (5,691 行) ← 過大
├── data-driven-prompt-builder.ts
├── fewShotLearning.ts
├── openerGenerator.ts
└── promptService.ts

建議結構（模組化）：
├── routers.ts (核心路由，~2,000 行)
├── generation/
│   ├── index.ts (統一入口)
│   ├── context-builder.ts (上下文建構)
│   ├── prompt-assembler.ts (Prompt 組裝)
│   └── quality-checker.ts (品質檢查)
├── learning/
│   ├── few-shot.ts
│   └── viral-patterns.ts
└── templates/
    ├── opener-rules.ts
    └── content-type-rules.ts
```

### 5.5 複雜度監控指標

建議加入以下監控：

```typescript
interface GenerationMetrics {
  promptLength: number;
  llmCallCount: number;
  totalDurationMs: number;
  cacheHitRate: number;
  retryCount: number;
  errorRate: number;
}

// 在每次生成後記錄
async function logGenerationMetrics(metrics: GenerationMetrics): Promise<void> {
  console.log('[Metrics]', {
    promptLength: metrics.promptLength,
    llmCalls: metrics.llmCallCount,
    duration: `${metrics.totalDurationMs}ms`,
    cacheHit: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
    retries: metrics.retryCount,
    errors: `${(metrics.errorRate * 100).toFixed(1)}%`,
  });
  
  // 警告閾值
  if (metrics.promptLength > 4000) {
    console.warn('[Metrics] Prompt length exceeds recommended limit');
  }
  if (metrics.totalDurationMs > 10000) {
    console.warn('[Metrics] Generation took too long');
  }
}
```

---

## 六、總結與下一步行動

### 6.1 五大問題解決方案摘要

| 問題 | 解決方案 | 實作優先級 | 預估時間 |
|------|----------|------------|----------|
| 分層範例庫品質控制 | 雙軌制 + 品質門檻 | P0 | 2 小時 |
| 函數整合方式 | 擴展 fewShotLearning.ts | P1 | 3 小時 |
| 品質檢查機制 | 三層檢查 + 自動重試 | P1 | 2 小時 |
| 快取策略 | 記憶體快取 + TTL | P2 | 2 小時 |
| 系統複雜度 | Prompt 長度控制 + 監控 | P2 | 1 小時 |

### 6.2 建議實作順序

1. **第一階段（P0）**：品質控制
   - 修改 `fewShotLearning.ts` 的品質門檻
   - 修改 `calculateStyleWeight` 加入品質檢查
   - 新增品質警告提示

2. **第二階段（P1）**：功能整合
   - 新增 `extractOpenerDNA` 函數
   - 新增 `buildPersonalizedOpenerPrompt` 函數
   - 整合到現有生成流程

3. **第三階段（P2）**：效能優化
   - 實作快取機制
   - 加入 Prompt 長度控制
   - 加入監控指標

### 6.3 風險緩解措施

| 風險 | 緩解措施 |
|------|----------|
| 新機制影響現有功能 | 漸進式部署，先在測試環境驗證 |
| 品質門檻過高導致無資料 | 保留 Fallback 到系統預設 |
| 快取導致資料不一致 | 設定合理 TTL + 主動失效機制 |
| Prompt 過長 | 設定硬性上限 + 智能截斷 |

---

**報告結束**

如有任何問題或需要進一步說明，請隨時告知。
