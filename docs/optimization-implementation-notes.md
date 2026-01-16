# 優化實作筆記（從 final-optimization-report-v2.md 提取）

## 一、成長階段判斷邏輯

### 1.1 三個核心指標

```typescript
interface UserMetrics {
  totalPosts: number;      // 用戶上傳的總貼文數
  avgEngagement: number;   // 平均互動數（讚 + 留言 + 分享）
  maxEngagement: number;   // 最高單篇互動數
}
```

### 1.2 階段判斷條件（決策樹）

| 階段 | 判斷條件 | 絕對門檻 | 系統範例權重 | 用戶範例權重 |
|------|----------|----------|------------|------------|
| **專家級** | 最高互動 ≥1000 且 總貼文 ≥20 | 300 | 10% | 90% |
| **成熟期** | 平均互動 ≥300 且 總貼文 ≥10 | 150 | 30% | 70% |
| **成長期** | 平均互動 ≥100 且 總貼文 ≥5 | 50 | 50% | 50% |
| **新手期** | 其他情況 | 20 | 70% | 30% |

### 1.3 判斷順序

專家級 → 成熟期 → 成長期 → 新手期（依序檢查，符合第一個條件即停止）

---

## 二、提示詞精簡的核心邏輯

### 2.1 為什麼需要精簡提示詞？

| 問題 | 影響 | 解決方案 |
|------|------|----------|
| Token 成本高 | 每次生成費用增加 | 移除冗餘內容 |
| 上下文窗口限制 | 可能超出 LLM 限制 | 智能截斷 |
| 注意力分散 | LLM 難以聚焦重點 | 結構化分層 |
| 維護困難 | 修改一處影響全局 | 模組化設計 |

### 2.2 精簡的核心原則：「分離關注點」

**原始 Prompt 結構**：
```
規則 + 範例 + 用戶資料 + 上下文 + 指令 = 一個巨大的字串
問題：難以維護、難以優化
```

**優化後 Prompt 結構**：
```
規則層（純資料）
    ↓
範例層（動態選擇）
    ↓
上下文層（用戶資料）
    ↓
Prompt 組裝器（動態組合）
    ↓
最終 Prompt（精簡、聚焦）
```

### 2.3 精簡策略一：規則抽離

**原始方式**：規則硬編碼在 Prompt 中
```typescript
const prompt = `
你是一個 Threads 文案專家。

開頭規則：
1. 不要使用「你是不是也」開頭
2. 不要使用「在這個時代」開頭
3. 不要使用「你有沒有想過」開頭
... (50+ 條規則)

現在請生成開頭...
`;
```

**優化方式**：規則抽離為純資料
```typescript
// shared/rules/opener-rules.ts
export const AVOID_PATTERNS = [
  { pattern: '你是不是也', type: 'opener', severity: 'block' },
  { pattern: '在這個時代', type: 'opener', severity: 'block' },
  { pattern: '你有沒有想過', type: 'opener', severity: 'warn' },
  // ...
];
```

---

## 三、混合方案實作

### 3.1 核心邏輯

1. 計算用戶貼文的前 30% 作為「相對門檻」
2. 根據用戶成長階段設定「絕對下限」
3. 取兩者較大值作為最終門檻

### 3.2 實作程式碼

```typescript
// server/services/adaptiveThreshold.ts

interface UserMetrics {
  totalPosts: number;
  avgEngagement: number;
  maxEngagement: number;
}

type UserStage = 'expert' | 'mature' | 'growing' | 'newbie';

// 階段判斷
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

// 絕對門檻
const ABSOLUTE_THRESHOLDS: Record<UserStage, number> = {
  expert: 300,
  mature: 150,
  growing: 50,
  newbie: 20,
};

// 權重配置
const WEIGHT_CONFIG: Record<UserStage, { system: number; user: number }> = {
  expert: { system: 0.10, user: 0.90 },
  mature: { system: 0.30, user: 0.70 },
  growing: { system: 0.50, user: 0.50 },
  newbie: { system: 0.70, user: 0.30 },
};

// 計算相對門檻（前 30%）
export function calculateRelativeThreshold(engagements: number[]): number {
  if (engagements.length === 0) return 0;
  
  const sorted = [...engagements].sort((a, b) => b - a);
  const top30Index = Math.ceil(sorted.length * 0.3) - 1;
  
  return sorted[Math.max(0, top30Index)];
}

// 計算自適應門檻
export function calculateAdaptiveThreshold(
  metrics: UserMetrics,
  engagements: number[]
): {
  threshold: number;
  stage: UserStage;
  weights: { system: number; user: number };
} {
  const stage = determineUserStage(metrics);
  const absoluteThreshold = ABSOLUTE_THRESHOLDS[stage];
  const relativeThreshold = calculateRelativeThreshold(engagements);
  
  // 取兩者較大值
  const threshold = Math.max(absoluteThreshold, relativeThreshold);
  
  return {
    threshold,
    stage,
    weights: WEIGHT_CONFIG[stage],
  };
}
```

---

## 四、系統複雜度拆分方案

### 4.1 六階段拆分計劃

| 階段 | 內容 | 風險 | 時間 |
|------|------|------|------|
| Phase 1 | 抽離規則定義到 `shared/rules/` | 低 | 4 小時 |
| Phase 2 | 建立 `infrastructure/` 基礎設施 | 低 | 4 小時 |
| Phase 3 | 抽離 `modules/quality/` | 中 | 6 小時 |
| Phase 4 | 抽離 `modules/learning/` | 中 | 8 小時 |
| Phase 5 | 抽離 `modules/generation/` | 高 | 8 小時 |
| Phase 6 | 精簡 `routers.ts` | 高 | 4 小時 |

### 4.2 預期效果

routers.ts 從 5,691 行減少到約 1,500 行

---

## 五、Feature Flag 控制

```typescript
// server/infrastructure/feature-flags.ts

export const FEATURE_FLAGS = {
  // 自適應門檻
  ADAPTIVE_THRESHOLD: true,
  
  // 三層品質檢查
  QUALITY_CHECKER: true,
  
  // 開頭 DNA 提取
  OPENER_DNA: true,
  
  // 快取機制
  CACHE_ENABLED: true,
  
  // 最近使用避免
  RECENT_USAGE_TRACKER: true,
};

export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[feature] ?? false;
}
```

---

## 六、實作順序

按照依賴順序實作：

1. **基礎設施層**（無依賴）
   - cache.ts
   - metrics-collector.ts
   - feature-flags.ts
   - shared/rules/

2. **核心服務層**（依賴基礎設施）
   - adaptiveThreshold.ts
   - qualityChecker.ts
   - openerDNA.ts
   - recentUsageTracker.ts

3. **整合層**（依賴核心服務）
   - fewShotLearning.ts（擴展）
   - openerGenerator.ts（更新）
   - data-driven-prompt-builder.ts（更新）

4. **路由層**（依賴整合層）
   - routers.ts（精簡）
