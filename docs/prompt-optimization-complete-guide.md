# 提示詞優化完整指南

**版本**：v2.0  
**日期**：2025-01-19  
**作者**：Manus AI  

---

## 目錄

1. [我的理解：最底層目標與約束](#一我的理解最底層目標與約束)
2. [根本問題分析](#二根本問題分析)
3. [優化方案總覽](#三優化方案總覽)
4. [準則與執行細節](#四準則與執行細節)
5. [執行流程](#五執行流程)
6. [調整前後範例對照](#六調整前後範例對照)
7. [驗收標準與監控](#七驗收標準與監控)
8. [風險與回滾機制](#八風險與回滾機制)

---

## 一、我的理解：最底層目標與約束

### 1.1 四大核心目標

根據你提供的資料，這次優化的最底層目標是：

| 目標 | 說明 | 量化指標 |
|------|------|----------|
| **A. 人味化** | 生成的內容要「像作者、有人味」，能呈現個人語氣與口頭禪 | styleMatch 評分 ≥ 70 分 |
| **B. 多樣性** | 減少開頭與風格的同質性，提高 Hook 成功率 | homogeneity ratio < 30% |
| **C. 成效提升** | 保持或提升內容在 Threads 的表現，同時降低成本與延遲 | CTR ↑ ≥10%、tokens ↓ ≥30% |
| **D. 保護原意** | 不改變事實/結構、不新增觀點 | 人工抽檢通過率 ≥ 90% |

### 1.2 系統約束條件

| 約束 | 說明 | 如何滿足 |
|------|------|----------|
| **足夠指引** | 系統 prompt 必須提供足夠指引（風格、排版、Hook 原則） | 保留最小核心規則集 |
| **不被鎖死** | 不能讓 LLM 過度被鎖死成填空（forced templates → 同質性） | 從「強制」改為「推薦」 |
| **Fallback 機制** | 對於新用戶或無個人範例情況，要有 fallback 機制 | 系統範例 + 動態長度判斷 |

---

## 二、根本問題分析

### 2.1 五大根本問題（Root Causes）

| # | 根本問題 | 現有程式碼位置 | 影響 |
|---|----------|----------------|------|
| 1 | **preserve 模式過度禁止** | `server/routers.ts` 第 3596-3634 行 | AI 不敢潤飾 |
| 2 | **提示詞過長/衝突** | `server/data-driven-prompt-builder.ts` | LLM 被稀釋或不敢行動 |
| 3 | **強制開頭模式** | `buildDataDrivenSystemPrompt()` 第 326 行 | AI 被限制，同質性高 |
| 4 | **Few-Shot 範例過多** | `buildLayer3KeywordRules()` 第 226-247 行 | 模仿/同質或 token 爆表 |
| 5 | **缺少個人風格範本** | `handlePolish()` | AI 不知道怎麼像作者說話 |

### 2.2 問題與優化對策映射

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      根本問題 → 優化對策 映射表                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Root #1: preserve 過度禁止                                              │
│  ────────────────────────                                               │
│  現狀：「不能改變作者的語氣和用詞習慣」與「加入個人風格」矛盾              │
│  對策：新增 stylePolish 專用 API，明確允許口語化但禁止改結構              │
│  能否解決：✅ 條件成立時 Yes                                             │
│                                                                         │
│  Root #2: 提示詞過長/衝突                                                │
│  ────────────────────────                                               │
│  現狀：3,000-8,000 字，多重禁止 vs 潤飾目標衝突                          │
│  對策：精簡 prompt（300-500 字）+ 動態長度（複雜任務用長 prompt）         │
│  能否解決：⚠️ Conditional（需保證核心規則不丟失）                        │
│                                                                         │
│  Root #3: 強制開頭模式                                                   │
│  ────────────────────────                                               │
│  現狀：「本次必須使用 X 格式」→ AI 沒有選擇權                            │
│  對策：改為「推薦公式」+ post-check 同質性檢測 + 重試機制                │
│  能否解決：✅ Yes（如果配套 post-check 與重試機制）                       │
│                                                                         │
│  Root #4: Few-Shot 範例過多                                              │
│  ────────────────────────                                               │
│  現狀：3-5 個完整範例，佔用 50%+ tokens                                  │
│  對策：精簡為 1-2 個開頭片段，或使用 user sample                         │
│  能否解決：✅ Yes（在精選與 fallback 策略下）                             │
│                                                                         │
│  Root #5: 缺少個人風格範本                                               │
│  ────────────────────────                                               │
│  現狀：只有口頭禪輸入，沒有風格學習                                       │
│  對策：拿 userStyle.samplePosts 注入 stylePolish                         │
│  能否解決：✅ Yes（只要 user sample 真實且代表性高）                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 三、優化方案總覽

### 3.1 四大優化方案

| 方案 | 改動範圍 | 優先級 | 風險 |
|------|----------|--------|------|
| **方案 A：stylePolish 專用 API** | 新增 API + 專用提示詞 | P0（最高） | 低 |
| **方案 B：開頭模式改為推薦** | 修改 prompt + 新增 post-check | P0（最高） | 中 |
| **方案 C：精簡提示詞** | 重構三層架構 | P1（高） | 中 |
| **方案 D：Few-Shot 精簡** | 修改範例邏輯 | P1（高） | 中 |

### 3.2 方案依賴關係

```
方案 A (stylePolish)
    │
    └── 獨立實施，無依賴
    
方案 B (開頭模式)
    │
    ├── 依賴：post-check 同質性檢測
    └── 依賴：重試機制
    
方案 C (精簡提示詞)
    │
    ├── 依賴：確定最小核心規則集
    └── 依賴：動態長度判斷邏輯
    
方案 D (Few-Shot 精簡)
    │
    ├── 依賴：user sample 品質控制
    └── 依賴：fallback 系統範例
```

---

## 四、準則與執行細節

### 4.1 方案 A：stylePolish 專用 API

#### 準則

| 準則 | 說明 |
|------|------|
| **允許口語化** | 可以把書面語改成口語（因此→所以、非常→超） |
| **允許加語氣詞** | 可以自然地加入「欸」「啊」「吧」「呢」「嘛」 |
| **禁止改結構** | 段落順序不能變、不能新增段落 |
| **禁止新增觀點** | 不能加入原文沒有的觀點或分析 |
| **字數限制** | 字數變化 ±10% 以內 |

#### 執行細節

**新增檔案**：`server/style-polish-prompt.ts`

```typescript
export function buildStylePolishPrompt(options: {
  catchphrases?: string;
  speakingStyle?: string;
  samplePost?: string;
}): string {
  return `你是一個專業的文字潤飾師，專門把文章改成更有「人味」的風格。

=== 你的任務 ===
把這篇文章改成更口語、更像真人說話的風格。

=== 限制條件（極重要） ===
- 字數維持差不多（±10%）
- 段落順序不變
- 不新增觀點或內容
- 不加入 CTA 或問題

=== 口語化技巧 ===
1. 書面語 → 口語：
   - 「因此」→「所以」
   - 「然而」→「但是」
   - 「此外」→「還有」
   - 「非常」→「超」「很」「真的很」
   
2. 加入語氣詞（自然地加，不要每句都加）：
   - 「欸」「啊」「吧」「呢」「嘛」
   - 「真的」「其實」「說真的」
   
3. 句子要短：
   - 長句拆成短句
   - 每句 10-20 字

${options.catchphrases ? `
=== 用戶的口頭禪（適度加入，不要每段都用） ===
${options.catchphrases}
` : ''}

${options.speakingStyle ? `
=== 用戶的說話風格 ===
${options.speakingStyle}
` : ''}

${options.samplePost ? `
=== 用戶的風格參考（學習語氣，不是複製） ===
${options.samplePost.substring(0, 300)}
` : ''}

=== 輸出格式 ===
直接輸出潤飾後的內容，不要任何解釋。`;
}
```

**新增 API**：`server/routers.ts`

```typescript
stylePolish: protectedProcedure
  .input(z.object({
    content: z.string(),
    catchphrases: z.string().optional(),
    speakingStyle: z.string().optional(),
    draftId: z.number().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. 取得用戶風格資料
    const userStyle = await db.getUserWritingStyle(ctx.user.id);
    const samplePosts = (userStyle?.samplePosts as Array<{ content: string }>) || [];
    
    // 2. 建構專用提示詞
    const systemPrompt = buildStylePolishPrompt({
      catchphrases: input.catchphrases,
      speakingStyle: input.speakingStyle,
      samplePost: samplePosts[0]?.content,
    });
    
    // 3. 調用 LLM
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `請潤飾這篇文章：\n\n${input.content}` },
      ],
    });
    
    let polishedContent = response.choices[0]?.message?.content || input.content;
    
    // 4. 自動化檢查
    const validation = await validateStylePolish(input.content, polishedContent);
    if (!validation.passed) {
      console.warn('[stylePolish] Validation failed:', validation.reason);
      // 可選：重試或返回原文
    }
    
    // 5. 更新草稿
    if (input.draftId) {
      await db.updateDraft(input.draftId, { body: polishedContent });
    }
    
    return { content: polishedContent, validation };
  }),
```

**自動化檢查函數**：

```typescript
async function validateStylePolish(
  original: string, 
  polished: string
): Promise<{ passed: boolean; reason?: string }> {
  // 1. 字數檢查（±10%）
  const originalLength = original.length;
  const polishedLength = polished.length;
  const lengthDiff = Math.abs(polishedLength - originalLength) / originalLength;
  if (lengthDiff > 0.1) {
    return { passed: false, reason: `字數變化過大：${(lengthDiff * 100).toFixed(1)}%` };
  }
  
  // 2. 段落數檢查
  const originalParagraphs = original.split(/\n\n+/).length;
  const polishedParagraphs = polished.split(/\n\n+/).length;
  if (Math.abs(polishedParagraphs - originalParagraphs) > 1) {
    return { passed: false, reason: '段落數變化過大' };
  }
  
  // 3. 新觀點檢測（使用 LLM）
  // 可選：調用 LLM 檢查是否新增了觀點
  
  return { passed: true };
}
```

---

### 4.2 方案 B：開頭模式改為推薦

#### 準則

| 準則 | 說明 |
|------|------|
| **給公式不給選項** | 提供 3-5 種開頭公式，讓 LLM 自己選擇最適合的 |
| **移除「必須」字眼** | 把「本次必須使用 X 格式」改為「推薦使用以下公式」 |
| **Post-check 檢測** | 生成後檢查同質性，若太高則重試 |
| **重試上限** | 最多重試 2 次，避免成本爆表 |

#### 執行細節

**修改 `buildDataDrivenSystemPrompt()`**：

```typescript
// 修改前（第 326 行）
systemPrompt += `
=== 最終指示 ===

【第一行最重要 - 決定 80% 成敗】
1. 本次必須使用「${context.selectedOpenerPattern.name}」格式  // ❌ 強制
`;

// 修改後
systemPrompt += `
=== 最終指示 ===

【第一行最重要 - 決定 80% 成敗】

推薦使用以下開頭公式（根據素材自然選擇，不要刻意套用）：

${buildOpenerFormulasPrompt(contentType)}

重要：
- 不要每次都用同一種開頭
- 根據素材內容選擇最自然的方式
- 開頭必須與素材緊密相關
`;
```

**新增 `buildOpenerFormulasPrompt()` 函數**：

```typescript
function buildOpenerFormulasPrompt(contentType: string): string {
  const typeRule = getContentTypeRule(contentType);
  const recommendedOpeners = typeRule?.recommendedOpeners || ['冒號斷言', '情緒爆發', '時間點'];
  
  const formulas = recommendedOpeners.slice(0, 5).map(name => {
    const pattern = OPENER_PATTERNS.find(p => p.name === name);
    if (!pattern) return null;
    return `- **${pattern.name}**：${pattern.templateFormula}
  範例：${pattern.examples[0]}`;
  }).filter(Boolean);
  
  return formulas.join('\n\n');
}
```

**新增 Post-check 同質性檢測**：

```typescript
async function checkOpenerHomogeneity(
  newOpener: string,
  userId: number,
  contentType: string
): Promise<{ isHomogeneous: boolean; similarity: number; pattern?: string }> {
  // 1. 取得用戶最近 10 篇同類型貼文的開頭
  const recentDrafts = await db.getRecentDrafts(userId, contentType, 10);
  const recentOpeners = recentDrafts.map(d => d.body.split('\n')[0]);
  
  // 2. 計算相似度（使用 n-gram 或 embedding）
  let maxSimilarity = 0;
  let matchedPattern = '';
  
  for (const opener of recentOpeners) {
    const similarity = calculateNgramSimilarity(newOpener, opener);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      matchedPattern = opener;
    }
  }
  
  // 3. 檢查是否與爆款範例過於相似
  const viralOpeners = await db.getViralOpeners({ limit: 20 });
  for (const viral of viralOpeners) {
    const similarity = calculateNgramSimilarity(newOpener, viral.opener50);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      matchedPattern = viral.opener50;
    }
  }
  
  // 4. 判斷是否同質
  const threshold = 0.6; // 60% 相似度閾值
  return {
    isHomogeneous: maxSimilarity > threshold,
    similarity: maxSimilarity,
    pattern: matchedPattern
  };
}

function calculateNgramSimilarity(text1: string, text2: string, n: number = 3): number {
  const getNgrams = (text: string) => {
    const ngrams = new Set<string>();
    for (let i = 0; i <= text.length - n; i++) {
      ngrams.add(text.substring(i, i + n));
    }
    return ngrams;
  };
  
  const ngrams1 = getNgrams(text1);
  const ngrams2 = getNgrams(text2);
  
  let intersection = 0;
  ngrams1.forEach(ng => {
    if (ngrams2.has(ng)) intersection++;
  });
  
  const union = ngrams1.size + ngrams2.size - intersection;
  return union > 0 ? intersection / union : 0;
}
```

**修改 `generateDraft` 加入重試機制**：

```typescript
// 在 generateDraft mutation 中
let attempts = 0;
const maxAttempts = 3;
let generatedContent = '';

while (attempts < maxAttempts) {
  attempts++;
  
  // 生成內容
  const response = await invokeLLM({ ... });
  generatedContent = response.choices[0]?.message?.content || '';
  
  // 檢查同質性
  const opener = generatedContent.split('\n')[0];
  const homogeneityCheck = await checkOpenerHomogeneity(opener, ctx.user.id, contentType);
  
  if (!homogeneityCheck.isHomogeneous) {
    // 通過檢查，跳出循環
    break;
  }
  
  console.log(`[generateDraft] Homogeneity detected (attempt ${attempts}): ${homogeneityCheck.similarity}`);
  
  if (attempts < maxAttempts) {
    // 重試時加入額外指令
    systemPrompt += `\n\n⚠️ 你上次生成的開頭與「${homogeneityCheck.pattern}」太相似，請換一種完全不同的開頭方式。`;
  }
}
```

---

### 4.3 方案 C：精簡提示詞

#### 準則

| 準則 | 說明 |
|------|------|
| **保留最小核心規則** | 第一行最重要、呼吸感、句長、禁止詞 |
| **動態長度判斷** | 根據 contentType、有無 userStyle、是否為變現貼文 |
| **Fallback 機制** | 若判斷錯誤，回滾到長 prompt |

#### 執行細節

**最小核心規則集**（必須保留）：

```typescript
const MINIMAL_CORE_RULES = `
【核心規則】
1. 第一行最重要：決定 80% 成敗，必須獨立成段
2. 呼吸感：每 2-4 行空一行
3. 句長：每句 10-20 字，超過必須斷句
4. 口語化：像傳訊息給朋友

【禁止詞】
- 「讓我們」「今天要分享」「親愛的朋友們」
- 「首先」「其次」「最後」
- 「希望對你有幫助」「加油！」
`;
```

**動態長度判斷邏輯**：

```typescript
function determinePromptLength(context: {
  contentType: string;
  hasUserStyle: boolean;
  isMonetizationPost: boolean;
  userExperienceLevel: 'beginner' | 'intermediate' | 'expert';
}): 'short' | 'medium' | 'long' {
  // 新手用長 prompt
  if (context.userExperienceLevel === 'beginner') {
    return 'long';
  }
  
  // 變現貼文用長 prompt（風險較高）
  if (context.isMonetizationPost) {
    return 'long';
  }
  
  // 有個人風格資料的專家用短 prompt
  if (context.hasUserStyle && context.userExperienceLevel === 'expert') {
    return 'short';
  }
  
  // 其他情況用中等長度
  return 'medium';
}
```

**三種長度的 prompt 模板**：

```typescript
const PROMPT_TEMPLATES = {
  short: `${MINIMAL_CORE_RULES}
  
${buildOpenerFormulasPrompt(contentType)}

直接輸出內容，不要解釋。`,

  medium: `${MINIMAL_CORE_RULES}

${buildContentTypePrompt(contentType)}

${buildOpenerFormulasPrompt(contentType)}

【輸出格式】
直接輸出可發布的貼文，不要任何解釋。`,

  long: `${buildLayer1UniversalRules(contentType, material)}

${buildLayer2ContentTypeRules(contentType)}

${buildLayer3KeywordRules(context)}

${buildFinalInstructions(context)}`
};
```

---

### 4.4 方案 D：Few-Shot 精簡

#### 準則

| 準則 | 說明 |
|------|------|
| **只保留開頭片段** | 範例只展示開頭 50 字，不展示完整貼文 |
| **最多 2 個範例** | 從 3-5 個減少到 1-2 個 |
| **優先使用 user sample** | 有用戶爆款時優先使用，沒有時用系統範例 |
| **明確禁止複製** | 範例前後都加上「禁止複製」警告 |

#### 執行細節

**修改 `buildLayer3KeywordRules()`**：

```typescript
// 修改前
if (fewShotExamples.length > 0) {
  prompt += `
【風格參考範例】（學習風格，禁止複製）
`;
  fewShotExamples.forEach((example, index) => {
    const truncated = example.postText.length > 300 
      ? example.postText.substring(0, 300) + '...' 
      : example.postText;
    prompt += `
--- 範例 ${index + 1}（${example.likes} 讚）---
${truncated}
`;
  });
}

// 修改後
if (fewShotExamples.length > 0) {
  // 只取前 2 個範例，只展示開頭 50 字
  const selectedExamples = fewShotExamples.slice(0, 2);
  
  prompt += `
【開頭風格參考】（學習節奏，禁止複製）

⚠️ 以下只是「開頭」的節奏參考，禁止複製任何文字：

${selectedExamples.map((example, index) => {
  const opener = example.postText.split('\n')[0].substring(0, 50);
  return `${index + 1}. ${opener}...（${example.likes} 讚）`;
}).join('\n')}

學習要點：觀察開頭的「節奏」和「語氣」，不是複製文字。
`;
}
```

**User Sample 優先邏輯**：

```typescript
async function getFewShotExamples(
  userId: number,
  contentType: string,
  keyword?: string
): Promise<Array<{ postText: string; likes: number; source: 'user' | 'system' }>> {
  // 1. 優先取得用戶的爆款貼文
  const userStyle = await db.getUserWritingStyle(userId);
  const userSamples = (userStyle?.samplePosts as Array<{ content: string; likes?: number }>) || [];
  
  if (userSamples.length >= 2) {
    // 有足夠的用戶範例
    return userSamples.slice(0, 2).map(s => ({
      postText: s.content,
      likes: s.likes || 0,
      source: 'user' as const
    }));
  }
  
  // 2. 不足時補充系統範例
  const systemExamples = await db.getSmartViralExamples({
    keyword,
    contentType,
    totalCount: 2 - userSamples.length
  });
  
  return [
    ...userSamples.map(s => ({
      postText: s.content,
      likes: s.likes || 0,
      source: 'user' as const
    })),
    ...systemExamples.map(e => ({
      postText: e.postText,
      likes: e.likes,
      source: 'system' as const
    }))
  ];
}
```

---

## 五、執行流程

### 5.1 實施階段

```
Phase 1: stylePolish API（1-2 天）
├── 新增 server/style-polish-prompt.ts
├── 新增 stylePolish API 端點
├── 新增自動化檢查函數
├── 修改前端 handlePolish 調用新 API
└── 撰寫測試案例

Phase 2: 開頭模式改為推薦（2-3 天）
├── 修改 buildDataDrivenSystemPrompt()
├── 新增 buildOpenerFormulasPrompt()
├── 新增 checkOpenerHomogeneity()
├── 修改 generateDraft 加入重試機制
└── 撰寫測試案例

Phase 3: 精簡提示詞（2-3 天）
├── 定義最小核心規則集
├── 實作動態長度判斷邏輯
├── 建立三種長度的 prompt 模板
├── 加入 feature flag 控制
└── 撰寫測試案例

Phase 4: Few-Shot 精簡（1-2 天）
├── 修改 buildLayer3KeywordRules()
├── 實作 user sample 優先邏輯
├── 建立 fallback 系統範例
└── 撰寫測試案例

Phase 5: A/B 測試與監控（1 週）
├── 設置 feature flags
├── 建立監控 dashboard
├── 漸進放量（1% → 10% → 50% → 100%）
└── 收集數據並調整
```

### 5.2 A/B 測試設計

| 測試 | 對照組 | 實驗組 | 主要指標 | 成功門檻 |
|------|--------|--------|----------|----------|
| stylePolish vs preserve | 現有 preserve 模式 | 新 stylePolish API | styleMatch 評分 | ≥ +10 分 |
| opener forced vs formula | 強制開頭模式 | 公式推薦 + post-check | CTR、homogeneity | CTR 不降、homogeneity < 30% |
| short vs long prompt | 長 prompt（3,000 字） | 短 prompt（500 字） | 品質評分、tokens | 品質不降、tokens ↓ 30% |

### 5.3 漸進放量策略

```
Week 1: 1% 放量
├── 監控核心指標
├── 收集用戶回饋
└── 修復發現的問題

Week 2: 10% 放量
├── 確認指標穩定
├── 調整參數
└── 準備擴大放量

Week 3: 50% 放量
├── 大規模驗證
├── 收集更多數據
└── 準備全面上線

Week 4: 100% 放量
├── 全面上線
├── 持續監控
└── 迭代優化
```

---

## 六、調整前後範例對照

### 6.1 stylePolish 範例

**原文**（用戶輸入）：

```
因此我認為學習這件事情非常重要。
然而很多人都忽略了這一點。
此外，我們還需要注意時間管理的問題。
```

**調整前**（preserve 模式）：

```
因此我認為學習這件事情非常重要。

然而很多人都忽略了這一點。

此外，我們還需要注意時間管理的問題。
```

問題：只加了換行，沒有改變語氣。

**調整後**（stylePolish）：

```
所以我真的覺得學習超重要的欸。

但很多人都沒注意到這點。

還有啊，時間管理也是一個問題。
```

改變：
- 「因此」→「所以」
- 「非常重要」→「超重要的欸」
- 「然而」→「但」
- 「此外」→「還有啊」
- 加入語氣詞「欸」「啊」

---

### 6.2 開頭模式範例

**素材**：

```
今天去咖啡廳工作，發現隔壁桌的人一直在抱怨老闆。
聽了一個小時，發現他們的問題其實都是自己造成的。
```

**調整前**（強制「冒號斷言」）：

```
職場的真相：你的問題都是自己造成的

今天去咖啡廳工作...
```

問題：每篇都是「XX 的真相：...」，同質性高。

**調整後**（公式推薦 + 自然選擇）：

**版本 A**（情緒爆發）：
```
我真的聽不下去了

今天去咖啡廳工作
隔壁桌的人抱怨老闆抱怨了一個小時
...
```

**版本 B**（時間點）：
```
今天在咖啡廳聽到一段對話

讓我突然明白一件事
...
```

**版本 C**（反問）：
```
你有沒有發現
抱怨最多的人，問題通常都是自己造成的？
...
```

改變：AI 根據素材自然選擇最適合的開頭方式，不再被強制使用同一種格式。

---

### 6.3 提示詞長度範例

**調整前**（長 prompt，~3,000 字）：

```
你是一位專業的 Threads 文案教練，專門幫助創作者寫出高互動的貼文。

以下規則來自 1,739 篇爆款貼文的統計分析，請嚴格遵守。

=== 第一層：通用規則（所有貼文必須遵守） ===

【開頭模式規則】
根據 1,739 篇爆款貼文分析，以下 13 種開頭模式效果最好：
1. 冒號斷言：[主題]的[真相/關鍵/本質]：[反直覺觀點]
   範例：「學習的真相：不是努力就會成功」
   適用：知識型、觀點型
2. 情緒爆發：我真的[情緒詞][感受]
   範例：「我真的受不了了」
   適用：故事型、抒情型
...（省略 11 種）

【Threads 風格規則】
• 口語化：像傳訊息給朋友，不是寫部落格
• 呼吸感：每 2-4 行空一行
• 單句限制：每句最多 15-20 字，超過必須斷句
...

=== 第二層：類型專屬規則 ===
...

=== 第三層：關鍵字專屬規則 ===
...

=== 最終指示 ===
...

【檢查清單】
□ 第一行是否使用了「冒號斷言」格式？
□ 第一行是否獨立成段（後面空一行）？
...
```

**調整後**（短 prompt，~500 字）：

```
你是 Threads 文案助手。

【核心規則】
1. 第一行最重要：決定 80% 成敗，必須獨立成段
2. 呼吸感：每 2-4 行空一行
3. 句長：每句 10-20 字
4. 口語化：像傳訊息給朋友

【禁止詞】
- 「讓我們」「今天要分享」「親愛的朋友們」
- 「首先」「其次」「最後」
- 「希望對你有幫助」「加油！」

【開頭公式參考】（根據素材自然選擇）
- 冒號斷言：[主題]的[真相]：[觀點]
- 情緒爆發：我真的[情緒][感受]
- 時間點：[時間]我[發現][事件]
- 反問：你有沒有發現[現象]？
- 數字：[數字][單位]後，我[發現][結果]

字數：150-400 字

直接輸出內容，不要解釋。
```

改變：
- 從 ~3,000 字精簡到 ~500 字
- 移除冗餘的說明和範例
- 保留最小核心規則集
- 開頭模式從「強制」改為「參考」

---

### 6.4 Few-Shot 範例

**調整前**（3 個完整範例，~900 字）：

```
【風格參考範例】（學習風格，禁止複製）
以下是該主題的高讚貼文，學習其「節奏」和「語氣」：

--- 範例 1（2,345 讚）---
學習的真相：不是努力就會成功

我以前也以為
只要夠努力，就一定會有結果

但後來我發現
方向比努力更重要

很多人花了十年
在錯誤的方向上努力
結果還是原地踏步

你有沒有想過
你現在的努力
是不是也在錯誤的方向上？

--- 範例 2（1,876 讚）---
...（完整貼文）

--- 範例 3（1,543 讚）---
...（完整貼文）

【學習要點】
✓ 學習：句子長短的節奏、換行的頻率、說話的語氣
✗ 禁止：複製開頭句式、使用同樣的句型、抄襲內容
```

**調整後**（2 個開頭片段，~100 字）：

```
【開頭風格參考】（學習節奏，禁止複製）

⚠️ 以下只是「開頭」的節奏參考，禁止複製任何文字：

1. 學習的真相：不是努力就會成功...（2,345 讚）
2. 我真的受不了了，為什麼每次都這樣...（1,876 讚）

學習要點：觀察開頭的「節奏」和「語氣」，不是複製文字。
```

改變：
- 從 3 個完整範例減少到 2 個開頭片段
- 從 ~900 字減少到 ~100 字
- 更強調「禁止複製」

---

## 七、驗收標準與監控

### 7.1 Must 通過項目（上線前必須）

| 項目 | 驗收標準 | 檢測方式 |
|------|----------|----------|
| stylePolish 自動化檢查 | 通過率 ≥ 90% | 人工抽檢 N=50 |
| styleMatch 評分 | 比 preserve 提升 ≥ 10 分 | A/B 測試 |
| opener 同質性 | homogeneity ratio < 30% | 自動檢測 |
| 重試次數 | 平均 < 1.2 次 | 日誌統計 |
| tokens 減少 | ≥ 30% | API 統計 |
| CTR 不下降 | 與 control 差距 < 5% | A/B 測試 |

### 7.2 監控 Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         監控 Dashboard                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    CTR      │  │ Engagement  │  │ Time-on-    │  │  Profile    │    │
│  │   12.5%     │  │    8.3%     │  │   Post      │  │   Clicks    │    │
│  │   ↑ 2.1%   │  │   ↑ 1.5%   │  │   45s       │  │   3.2%      │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Homogeneity │  │ styleMatch  │  │   Tokens    │  │   Retries   │    │
│  │    23%      │  │    72       │  │   1,234     │  │    1.1      │    │
│  │   ↓ 17%    │  │   ↑ 12     │  │   ↓ 35%    │  │   OK        │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                         │
│  Alerts:                                                                │
│  ⚠️ CTR 下降 > 10% → 自動回滾                                           │
│  ⚠️ Homogeneity > 40% → 通知開發者                                      │
│  ⚠️ Retries > 2.0 → 檢查 prompt                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Alert 閾值

| 指標 | 警告閾值 | 回滾閾值 |
|------|----------|----------|
| CTR | 下降 > 5% | 下降 > 10% |
| Engagement | 下降 > 5% | 下降 > 10% |
| Homogeneity | > 35% | > 50% |
| Retries | > 1.5 | > 2.0 |
| Tokens | 上升 > 20% | 上升 > 50% |

---

## 八、風險與回滾機制

### 8.1 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| stylePolish 改寫過度 | 中 | 高 | 自動化檢查 + 人工抽檢 |
| 開頭多樣性不足 | 中 | 中 | post-check + 重試機制 |
| 短 prompt 品質下降 | 中 | 高 | 保留核心規則 + 動態長度 |
| 新用戶體驗差 | 低 | 中 | fallback 系統範例 |
| 成本暴增（重試過多） | 低 | 中 | 重試上限 + 成本監控 |

### 8.2 Feature Flag 設計

```typescript
const FEATURE_FLAGS = {
  // stylePolish
  USE_NEW_STYLE_POLISH: false,
  
  // 開頭模式
  USE_FORMULA_OPENER: false,
  USE_OPENER_POST_CHECK: false,
  OPENER_MAX_RETRIES: 2,
  
  // 提示詞長度
  USE_DYNAMIC_PROMPT_LENGTH: false,
  DEFAULT_PROMPT_LENGTH: 'long' as 'short' | 'medium' | 'long',
  
  // Few-Shot
  USE_SIMPLIFIED_FEWSHOT: false,
  MAX_FEWSHOT_EXAMPLES: 2,
  PREFER_USER_SAMPLES: true,
};

// 使用方式
if (isFeatureEnabled('USE_NEW_STYLE_POLISH')) {
  return stylePolish.mutate({ ... });
} else {
  return refineDraft.mutate({ editMode: 'preserve', ... });
}
```

### 8.3 回滾流程

```
1. 監控系統檢測到指標異常
   │
   ▼
2. 自動發送 Alert 通知
   │
   ▼
3. 判斷是否達到回滾閾值
   │
   ├── 否 → 繼續監控
   │
   └── 是 → 執行回滾
         │
         ▼
4. 關閉對應的 Feature Flag
   │
   ▼
5. 驗證系統恢復正常
   │
   ▼
6. 分析問題原因
   │
   ▼
7. 修復後重新上線
```

---

## 總結

### 核心理解

這次優化的核心是**「讓 AI 更像助手，而非替代創作者」**。具體來說：

1. **stylePolish**：讓 AI 能真正改變語氣，但不改變內容
2. **開頭模式**：給 AI 選擇權，而非強制使用同一種格式
3. **精簡提示詞**：減少干擾，讓 AI 專注於核心任務
4. **Few-Shot 精簡**：學習節奏，而非複製內容

### 成功的關鍵

> **「真正的最佳」不是單一設計，而是設計 + 嚴格的自動檢查 / 重試策略 / 個人化 sample 管理 / 成效監控 + 人機回饋迴路 五者合一。**

只有把所有 Must 項目都做到，並通過 A/B 測試驗證，才能確保這次優化真正有效。
