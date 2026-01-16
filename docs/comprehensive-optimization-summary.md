# 幕創行銷 Threads AI 教練：完整優化建議總結報告

**撰寫日期**：2026 年 1 月 16 日  
**撰寫者**：Manus AI  
**版本**：v1.0

---

## 目錄

1. [品質門檻彈性調整方案](#一品質門檻彈性調整方案)
2. [系統複雜度拆分方案](#二系統複雜度拆分方案)
3. [完整優化項目總表](#三完整優化項目總表)
4. [實作優先級建議](#四實作優先級建議)
5. [風險評估與緩解措施](#五風險評估與緩解措施)

---

## 一、品質門檻彈性調整方案

### 1.1 問題回顧

原方案採用「固定門檻」（≥500 互動），可能對某些用戶過於嚴格：
- 新手用戶：可能沒有任何貼文達到 500 互動
- 小眾領域用戶：整體互動數據偏低
- 成長中用戶：平均互動可能在 200-400 之間

### 1.2 彈性調整方案：相對值比較機制

#### 方案 A：百分位數門檻（推薦）

根據用戶自己的貼文表現，取前 N% 作為高品質樣本：

```typescript
interface RelativeThreshold {
  // 取用戶貼文的前 30% 作為高品質樣本
  percentile: number; // 預設 30
  // 最低絕對門檻（避免全部都是低品質）
  absoluteMin: number; // 預設 100
  // 最低樣本數量
  minSampleCount: number; // 預設 3
}

function calculateRelativeThreshold(
  samplePosts: Array<{ engagement?: number }>,
  config: RelativeThreshold = { percentile: 30, absoluteMin: 100, minSampleCount: 3 }
): number {
  // 取得所有有互動數據的貼文
  const postsWithEngagement = samplePosts
    .filter(p => p.engagement !== undefined && p.engagement > 0)
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
  
  if (postsWithEngagement.length < config.minSampleCount) {
    // 樣本太少，使用絕對門檻
    return config.absoluteMin;
  }
  
  // 計算百分位數門檻
  const percentileIndex = Math.floor(postsWithEngagement.length * (config.percentile / 100));
  const percentileThreshold = postsWithEngagement[percentileIndex]?.engagement || 0;
  
  // 取百分位數和絕對門檻的較大值
  return Math.max(percentileThreshold, config.absoluteMin);
}
```

**優點**：
- 自動適應用戶的實際表現水平
- 對新手和小眾領域用戶更友善
- 始終能選出用戶「相對最好」的內容

**缺點**：
- 如果用戶所有貼文都很差，仍會選出「相對最好但絕對很差」的內容
- 需要設定絕對下限來防止這種情況

---

#### 方案 B：動態門檻（根據用戶成長階段）

根據用戶的整體數據量和表現，動態調整門檻：

```typescript
interface UserGrowthStage {
  stage: 'beginner' | 'growing' | 'established' | 'expert';
  threshold: number;
  description: string;
}

function determineUserStage(
  totalPosts: number,
  avgEngagement: number,
  maxEngagement: number
): UserGrowthStage {
  // 專家級：有 10+ 爆文（≥1000 互動）
  if (maxEngagement >= 1000 && totalPosts >= 20) {
    return {
      stage: 'expert',
      threshold: 500,
      description: '您已有多篇高互動貼文，系統將使用較高標準'
    };
  }
  
  // 成熟期：平均互動 ≥300
  if (avgEngagement >= 300 && totalPosts >= 10) {
    return {
      stage: 'established',
      threshold: 300,
      description: '您的帳號表現穩定，系統將使用中等標準'
    };
  }
  
  // 成長期：平均互動 ≥100
  if (avgEngagement >= 100 && totalPosts >= 5) {
    return {
      stage: 'growing',
      threshold: 150,
      description: '您的帳號正在成長，系統將使用適中標準'
    };
  }
  
  // 新手期
  return {
    stage: 'beginner',
    threshold: 50,
    description: '您剛開始使用，系統將使用較低標準以收集更多學習素材'
  };
}
```

**優點**：
- 根據用戶成長階段自動調整
- 對新手更友善
- 隨著用戶成長，標準自動提高

**缺點**：
- 邏輯較複雜
- 需要持續追蹤用戶數據

---

#### 方案 C：混合方案（最終推薦）

結合「相對值」和「成長階段」的優點：

```typescript
interface AdaptiveThresholdResult {
  threshold: number;
  stage: string;
  percentile: number;
  explanation: string;
  highQualityCount: number;
  totalCount: number;
}

async function calculateAdaptiveThreshold(userId: number): Promise<AdaptiveThresholdResult> {
  const userStyle = await db.getUserWritingStyle(userId);
  const samplePosts = (userStyle?.samplePosts as Array<{
    content: string;
    engagement?: number;
  }>) || [];
  
  // 1. 計算基礎統計
  const postsWithEngagement = samplePosts.filter(p => (p.engagement || 0) > 0);
  const engagements = postsWithEngagement.map(p => p.engagement || 0);
  
  if (engagements.length === 0) {
    return {
      threshold: 0,
      stage: 'no_data',
      percentile: 0,
      explanation: '尚無互動數據，所有樣本都會被用於風格分析',
      highQualityCount: samplePosts.length,
      totalCount: samplePosts.length,
    };
  }
  
  const avgEngagement = engagements.reduce((a, b) => a + b, 0) / engagements.length;
  const maxEngagement = Math.max(...engagements);
  const sortedEngagements = [...engagements].sort((a, b) => b - a);
  
  // 2. 計算相對門檻（前 30%）
  const percentileIndex = Math.floor(sortedEngagements.length * 0.3);
  const relativeThreshold = sortedEngagements[percentileIndex] || 0;
  
  // 3. 根據成長階段設定絕對下限
  let absoluteMin: number;
  let stage: string;
  
  if (maxEngagement >= 1000) {
    absoluteMin = 300;
    stage = 'expert';
  } else if (avgEngagement >= 200) {
    absoluteMin = 150;
    stage = 'established';
  } else if (avgEngagement >= 50) {
    absoluteMin = 50;
    stage = 'growing';
  } else {
    absoluteMin = 20;
    stage = 'beginner';
  }
  
  // 4. 取相對門檻和絕對下限的較大值
  const finalThreshold = Math.max(relativeThreshold, absoluteMin);
  
  // 5. 計算高品質樣本數量
  const highQualityCount = engagements.filter(e => e >= finalThreshold).length;
  
  // 6. 生成說明
  const explanation = generateThresholdExplanation(
    stage,
    finalThreshold,
    avgEngagement,
    highQualityCount,
    postsWithEngagement.length
  );
  
  return {
    threshold: finalThreshold,
    stage,
    percentile: 30,
    explanation,
    highQualityCount,
    totalCount: postsWithEngagement.length,
  };
}

function generateThresholdExplanation(
  stage: string,
  threshold: number,
  avgEngagement: number,
  highQualityCount: number,
  totalCount: number
): string {
  const stageNames: Record<string, string> = {
    expert: '專家級',
    established: '成熟期',
    growing: '成長期',
    beginner: '新手期',
    no_data: '無數據',
  };
  
  return `您目前處於「${stageNames[stage]}」階段（平均互動 ${Math.round(avgEngagement)}）。` +
    `系統將使用互動數 ≥${threshold} 的貼文作為高品質樣本（${highQualityCount}/${totalCount} 篇符合）。`;
}
```

**優點**：
- 兼顧相對表現和絕對品質
- 對各階段用戶都友善
- 提供清晰的說明，用戶知道為什麼

**缺點**：
- 實作較複雜
- 需要更多測試驗證

---

### 1.3 門檻方案比較表

| 方案 | 新手友善度 | 品質保證 | 實作複雜度 | 推薦度 |
|------|------------|----------|------------|--------|
| 固定門檻（原方案） | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| 百分位數門檻 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 動態門檻 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 混合方案 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 二、系統複雜度拆分方案

### 2.1 現況問題

| 檔案 | 行數 | 問題 |
|------|------|------|
| routers.ts | 5,691 | 過大，難以維護 |
| opener-rules.ts | 869 | 規則和邏輯混合 |
| data-driven-prompt-builder.ts | 796 | 功能過於集中 |
| 總計 | 9,676 | 單一開發者難以掌握全貌 |

### 2.2 拆分方案：領域驅動模組化

#### 目標架構

```
server/
├── routers.ts                    # 核心路由（~1,500 行）
│
├── modules/                      # 業務模組
│   ├── generation/               # 內容生成模組
│   │   ├── index.ts              # 統一入口
│   │   ├── draft-generator.ts    # 草稿生成
│   │   ├── opener-generator.ts   # 開頭生成
│   │   └── context-builder.ts    # 上下文建構
│   │
│   ├── learning/                 # 學習模組
│   │   ├── index.ts
│   │   ├── few-shot.ts           # Few-Shot Learning
│   │   ├── viral-patterns.ts     # 爆文模式分析
│   │   └── opener-dna.ts         # 開頭 DNA
│   │
│   ├── quality/                  # 品質控制模組
│   │   ├── index.ts
│   │   ├── ai-detector.ts        # AI 痕跡檢測
│   │   ├── content-filters.ts    # 內容過濾
│   │   └── quality-checker.ts    # 品質檢查
│   │
│   └── analytics/                # 分析模組
│       ├── index.ts
│       ├── battle-report.ts      # 戰報分析
│       └── metrics.ts            # 指標收集
│
├── shared/                       # 共用資源
│   ├── rules/                    # 規則定義
│   │   ├── opener-rules.ts       # 開頭規則（純資料）
│   │   └── content-type-rules.ts # 內容類型規則（純資料）
│   │
│   ├── types/                    # 類型定義
│   │   ├── generation.ts
│   │   ├── learning.ts
│   │   └── quality.ts
│   │
│   └── constants/                # 常數定義
│       ├── thresholds.ts         # 門檻設定
│       └── prompts.ts            # Prompt 模板
│
└── infrastructure/               # 基礎設施
    ├── cache.ts                  # 快取服務
    ├── logger.ts                 # 日誌服務
    └── metrics-collector.ts      # 指標收集器
```

#### 拆分步驟

**第一階段：抽離規則定義（低風險）**

```typescript
// shared/rules/opener-rules.ts - 純資料，無邏輯
export const OPENER_PATTERNS = {
  contrast: {
    name: '對比型',
    description: '用反差製造衝擊',
    templates: [
      '你以為{A}？其實{B}',
      '{A}的人，往往{B}',
    ],
    weight: 1.2,
  },
  // ...
};

export const AVOID_PATTERNS = [
  { pattern: '你是不是也', type: 'opener', severity: 'block' },
  // ...
];
```

**第二階段：抽離生成邏輯（中風險）**

```typescript
// modules/generation/draft-generator.ts
import { buildContext } from './context-builder';
import { checkQuality } from '../quality';
import { invokeLLM } from '../../_core/llm';

export async function generateDraft(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  // 1. 建構上下文
  const context = await buildContext(input);
  
  // 2. 生成內容
  const content = await invokeLLM({
    messages: [
      { role: 'system', content: context.systemPrompt },
      { role: 'user', content: context.userPrompt },
    ],
  });
  
  // 3. 品質檢查
  const quality = await checkQuality(content, input.userId);
  
  return { content, quality };
}
```

**第三階段：重構 routers.ts（高風險）**

```typescript
// routers.ts - 精簡版
import { generateDraft } from './modules/generation';
import { extractViralPatterns } from './modules/learning';
import { performQualityCheck } from './modules/quality';

export const appRouter = router({
  generation: router({
    generateDraft: protectedProcedure
      .input(generateDraftSchema)
      .mutation(async ({ ctx, input }) => {
        return generateDraft({ ...input, userId: ctx.user.id });
      }),
    // ...
  }),
  
  learning: router({
    getViralPatterns: protectedProcedure
      .query(async ({ ctx }) => {
        return extractViralPatterns(ctx.user.id);
      }),
    // ...
  }),
  
  // ...
});
```

### 2.3 拆分方案比較

| 方案 | 風險 | 工作量 | 效益 | 建議 |
|------|------|--------|------|------|
| 不拆分 | 低 | 0 | 0 | 短期可行，長期不可持續 |
| 僅抽離規則 | 低 | 2 天 | 中 | 立即可做 |
| 完整模組化 | 中 | 1-2 週 | 高 | 建議分階段進行 |
| 微服務化 | 高 | 1 個月+ | 很高 | 目前不建議 |

### 2.4 建議的拆分順序

1. **Phase 1（本週）**：抽離規則定義到 `shared/rules/`
2. **Phase 2（下週）**：建立 `infrastructure/` 基礎設施
3. **Phase 3（第三週）**：抽離 `modules/quality/`
4. **Phase 4（第四週）**：抽離 `modules/learning/`
5. **Phase 5（第五週）**：抽離 `modules/generation/`
6. **Phase 6（第六週）**：精簡 `routers.ts`

---

## 三、完整優化項目總表

### 3.1 開頭生成優化（來自 opener-optimization-proposal.md）

| 項目 | 描述 | 優點 | 缺點 | 優先級 |
|------|------|------|------|--------|
| 動態個人化 Prompt | 根據用戶資料量調整系統/用戶權重 | 更精準的個人化 | 實作複雜 | P0 |
| 開頭 DNA 提取 | 分析用戶爆文的開頭結構特徵 | 學習用戶成功模式 | 需要足夠樣本 | P1 |
| 最近使用避免 | 記錄最近 7 天使用的開頭模式 | 避免重複 | 增加儲存需求 | P1 |
| 品質檢查機制 | 三層檢查 + 自動重試 | 提升生成品質 | 增加生成時間 | P0 |

### 3.2 分層範例庫優化

| 項目 | 描述 | 優點 | 缺點 | 優先級 |
|------|------|------|------|--------|
| 彈性品質門檻 | 根據用戶相對表現調整門檻 | 對新手友善 | 可能降低品質標準 | P0 |
| 雙軌制管理 | 系統庫和用戶庫分開管理 | 清晰的品質控制 | 邏輯較複雜 | P1 |
| 品質加權機制 | 根據互動數給予不同權重 | 更細緻的控制 | 計算成本增加 | P2 |

### 3.3 系統架構優化

| 項目 | 描述 | 優點 | 缺點 | 優先級 |
|------|------|------|------|--------|
| 快取機制 | 快取常用計算結果 | 減少重複計算 | 需要處理失效 | P1 |
| 模組化拆分 | 將大檔案拆分為小模組 | 易於維護 | 重構風險 | P2 |
| Prompt 長度控制 | 設定上限和智能截斷 | 避免超出限制 | 可能丟失資訊 | P1 |
| 監控指標 | 追蹤生成時間、品質分數 | 便於優化 | 增加儲存需求 | P2 |

### 3.4 Few-Shot Learning 整合

| 項目 | 描述 | 優點 | 缺點 | 優先級 |
|------|------|------|------|--------|
| 函數整合 | 將新函數整合到 fewShotLearning.ts | 避免重複計算 | 增加檔案複雜度 | P1 |
| 爆文模式分析 | 提取用戶成功模式 | 數據驅動 | 需要足夠樣本 | P1 |
| 個人化 Prompt 建構 | 結合 DNA + Few-Shot | 更精準 | 實作複雜 | P1 |

---

## 四、實作優先級建議

### 4.1 優先級定義

| 優先級 | 定義 | 時間框架 |
|--------|------|----------|
| P0 | 必須立即處理，影響核心功能 | 本週 |
| P1 | 重要，應盡快處理 | 下週 |
| P2 | 有價值，可以稍後處理 | 2-4 週內 |
| P3 | 錦上添花，有空再做 | 未來規劃 |

### 4.2 建議實作順序

#### 第一週（P0 項目）

| 項目 | 預估時間 | 風險 |
|------|----------|------|
| 彈性品質門檻（混合方案） | 4 小時 | 低 |
| 品質檢查機制 | 3 小時 | 低 |
| 動態個人化 Prompt 基礎版 | 4 小時 | 中 |

**交付物**：
- 修改後的 `fewShotLearning.ts`
- 新增 `qualityChecker.ts`
- 更新的品質門檻邏輯

#### 第二週（P1 項目）

| 項目 | 預估時間 | 風險 |
|------|----------|------|
| 快取機制 | 3 小時 | 低 |
| 開頭 DNA 提取 | 4 小時 | 中 |
| Prompt 長度控制 | 2 小時 | 低 |
| 最近使用避免 | 2 小時 | 低 |

**交付物**：
- 新增 `cache.ts`
- 擴展 `fewShotLearning.ts`
- 更新 `openerGenerator.ts`

#### 第三週（P2 項目 - Phase 1）

| 項目 | 預估時間 | 風險 |
|------|----------|------|
| 抽離規則定義 | 4 小時 | 低 |
| 監控指標 | 3 小時 | 低 |
| 雙軌制管理 | 3 小時 | 中 |

**交付物**：
- 新增 `shared/rules/` 目錄
- 新增 `metrics.ts`
- 更新範例庫管理邏輯

#### 第四週（P2 項目 - Phase 2）

| 項目 | 預估時間 | 風險 |
|------|----------|------|
| 建立 infrastructure 基礎設施 | 4 小時 | 低 |
| 抽離 quality 模組 | 6 小時 | 中 |

**交付物**：
- 新增 `infrastructure/` 目錄
- 新增 `modules/quality/` 目錄

#### 第五-六週（P2 項目 - Phase 3-4）

| 項目 | 預估時間 | 風險 |
|------|----------|------|
| 抽離 learning 模組 | 8 小時 | 中 |
| 抽離 generation 模組 | 8 小時 | 高 |
| 精簡 routers.ts | 4 小時 | 高 |

**交付物**：
- 完整的模組化架構
- 精簡後的 `routers.ts`（~1,500 行）

---

## 五、風險評估與緩解措施

### 5.1 風險矩陣

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| 彈性門檻導致品質下降 | 中 | 中 | 設定絕對下限，監控品質指標 |
| 快取導致資料不一致 | 低 | 中 | 設定合理 TTL，主動失效機制 |
| 模組化重構破壞功能 | 中 | 高 | 分階段進行，每階段測試 |
| Prompt 截斷丟失重要資訊 | 低 | 中 | 智能截斷，保留關鍵內容 |
| 新機制增加系統複雜度 | 高 | 中 | 完善文檔，統一設計模式 |

### 5.2 回滾策略

每個優化項目都應該有回滾計劃：

1. **彈性門檻**：保留原有固定門檻作為 fallback
2. **快取機制**：可以通過配置完全禁用
3. **模組化拆分**：使用 Git 分支，隨時可以回滾
4. **品質檢查**：可以設定為「僅警告」模式

### 5.3 監控指標

建議追蹤以下指標來評估優化效果：

| 指標 | 目標 | 警告閾值 |
|------|------|----------|
| 平均生成時間 | <10 秒 | >15 秒 |
| 品質通過率 | >80% | <60% |
| 快取命中率 | >70% | <50% |
| Prompt 平均長度 | <4,000 字 | >5,000 字 |
| 用戶滿意度 | >4.0/5.0 | <3.5/5.0 |

---

## 六、總結

### 6.1 核心建議

1. **品質門檻**：採用「混合方案」，兼顧相對表現和絕對品質
2. **系統拆分**：分 6 階段進行，從低風險項目開始
3. **實作順序**：先做 P0（品質控制），再做 P1（效能優化），最後做 P2（架構重構）

### 6.2 預期效益

| 效益 | 量化目標 |
|------|----------|
| 生成品質提升 | 品質通過率從 70% 提升到 85% |
| 個人化程度提升 | 用戶風格匹配度提升 20% |
| 系統效能提升 | 平均生成時間減少 30% |
| 維護成本降低 | routers.ts 行數減少 70% |

### 6.3 下一步行動

請確認：
1. 是否同意採用「混合方案」作為品質門檻策略？
2. 是否同意按照建議的 6 階段進行系統拆分？
3. 是否同意從 P0 項目開始實作？

確認後，我將開始進行第一階段的實作工作。

---

**報告結束**
