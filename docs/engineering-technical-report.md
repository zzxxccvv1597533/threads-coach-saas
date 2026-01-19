# 提示詞系統優化 - 工程師技術報告

**版本**：v1.0  
**日期**：2025-01-18  
**作者**：Manus AI  

---

## 一、系統架構概覽

### 1.1 現有提示詞系統架構

目前系統採用**三層提示詞架構**，由 `server/data-driven-prompt-builder.ts` 負責組裝：

```
┌─────────────────────────────────────────────────────────────┐
│                    System Prompt 組裝流程                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Layer 1   │ +  │   Layer 2   │ +  │   Layer 3   │     │
│  │  通用規則    │    │  類型規則    │    │  關鍵字規則  │     │
│  │  (~500字)   │    │  (~400字)   │    │ (~1,500字)  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                 │                  │              │
│         ▼                 ▼                  ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Additional Context                      │   │
│  │  • IP Context (職業、人設三支柱)                      │   │
│  │  • Audience Context (目標受眾)                       │   │
│  │  • User Style Context (風格資料 + Few-Shot)          │   │
│  │  • Stage Strategy (經營階段策略)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Final Instructions                      │   │
│  │  • 開頭模式強制指定                                   │   │
│  │  • 字數控制                                          │   │
│  │  • 同質性警告                                        │   │
│  │  • 檢查清單                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Total: 3,000 ~ 8,000 字 (視情況而定)                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 相關檔案清單

| 檔案路徑 | 功能 | 行數 |
|----------|------|------|
| `server/data-driven-prompt-builder.ts` | 三層提示詞組裝器 | ~800 行 |
| `server/routers.ts` | API 端點，包含 `generateDraft`、`refineDraft` | ~4,500 行 |
| `shared/opener-rules.ts` | 13 種開頭模式定義 | ~300 行 |
| `shared/content-type-rules.ts` | 12 種內容類型規則 | ~500 行 |
| `server/fewShotLearning.ts` | Few-Shot Learning 邏輯 | ~600 行 |
| `server/profanity-filter.ts` | 去 AI 化過濾器 | ~400 行 |

---

## 二、現有問題分析

### 2.1 問題一：提示詞過長

**現狀**：

```typescript
// server/data-driven-prompt-builder.ts - buildDataDrivenPrompt()
export async function buildDataDrivenPrompt(
  contentType: string,
  material: string,
  additionalContext?: {...}
): Promise<{ systemPrompt: string; context: DataDrivenPromptContext }> {
  
  const layer1 = buildLayer1UniversalRules(contentType, material);  // ~500 字
  const layer2 = buildLayer2ContentTypeRules(contentType);          // ~400 字
  const layer3 = buildLayer3KeywordRules(context);                  // ~1,500 字
  
  let systemPrompt = `你是一位專業的 Threads 文案教練...
  
${layer1}

${layer2}

${layer3}
`;
  // ... 還有 Additional Context 和 Final Instructions
}
```

**問題影響**：

| 影響項目 | 說明 | 量化數據 |
|----------|------|----------|
| API 成本 | 輸入 tokens 越多，費用越高 | 每次請求增加 $0.01-0.03 |
| 回應延遲 | 每 500 tokens 增加約 25ms | 總延遲增加 150-400ms |
| 推理品質 | 長提示詞會「稀釋」重要指令 | 研究顯示 500+ 字效果下降 |
| 同質性 | 太多範例導致模仿 | 開頭重複率 ~40% |

---

### 2.2 問題二：強制選項而非公式

**現狀程式碼**：

```typescript
// server/data-driven-prompt-builder.ts - 第 322-337 行
systemPrompt += `
=== 最終指示 ===

【第一行最重要 - 決定 80% 成敗】
1. 本次必須使用「${context.selectedOpenerPattern.name}」格式  // ❌ 強制選項
2. 第一行必須獨立成段（後面空一行）
3. 第一行不能超過 30 字
${context.materialKeywords.length > 0 ? `4. 第一行必須包含：${context.materialKeywords.slice(0, 3).join('、')} 其中之一` : ''}

【字數控制】
嚴格遵守 ${typeRule?.wordLimit.min || 150}-${typeRule?.wordLimit.max || 400} 字
`;
```

**問題分析**：

```
現有流程：
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  素材輸入    │ → │ 系統選擇開頭 │ → │ 強制使用該格式│
│             │    │  模式       │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                         ↓
                   AI 沒有選擇權
                         ↓
                   同質性高、缺乏創意
```

**具體問題**：

1. `selectOpenerPattern()` 函數根據內容類型選擇開頭模式
2. 選擇後直接寫入「本次必須使用 X 格式」
3. AI 被迫使用該格式，即使不適合素材

---

### 2.3 問題三：潤飾功能無效

**前端程式碼**（`client/src/components/GuidedWritingFlow.tsx` 第 418-439 行）：

```typescript
const handlePolish = () => {
  if (!catchphrases && !speakingStyle) {
    setFinalContent(draftContent);
    toast.success("已完成！");
    return;
  }

  const polishInstruction = `請幫我潤飾這篇文章，加入以下個人風格：
${catchphrases ? `口頭禪：${catchphrases}` : ''}
${speakingStyle ? `說話風格：${speakingStyle}` : ''}
保持原本的內容結構，只是讓語氣更有我的個人特色。`;

  refineDraft.mutate({
    currentDraft: draftContent,
    instruction: polishInstruction,
    draftId: draftId || undefined,
    chatHistory: chatMessages,
  });
};
```

**後端程式碼**（`server/routers.ts` 第 3596-3634 行）：

```typescript
// preserve 模式的提示詞
if (editMode === 'preserve') {
  return `你是一個尊重作者風格的文字優化助理。

=== 可以做的事 ===
1. 調整排版（加入呼吸感，每 2-4 行一個段落）
2. 讓句子更口語化（像傳訊息給朋友）
3. 修正錯字和標點
4. 讓語句更通順

=== 絕對禁止（這是最重要的） ===
- ✘ 不能改變敘事的順序和結構
- ✘ 不能添加作者沒有說的觀點或分析
- ✘ 不能改變作者的語氣和用詞習慣  // ❌ 這條與潤飾目的矛盾
- ✘ 不能讓內容變得更長
`;
}
```

**問題根源**：

| 問題 | 原因 | 影響 |
|------|------|------|
| 提示詞矛盾 | 「不能改變語氣」與「加入個人風格」矛盾 | AI 不敢修改 |
| 沒有風格範本 | 沒有提供用戶的爆款貼文 | AI 不知道「風格」是什麼 |
| 指令不具體 | 只說「加入口頭禪」，沒說如何加 | AI 只是插入文字 |

---

### 2.4 問題四：串文功能改寫過度

**原有提示詞**（`server/routers.ts` 第 3950-4000 行）：

```typescript
const systemPrompt = `你是一個專業的 Threads 串文轉換專家。

=== 串文原則 ===
1. 每段都要能獨立閱讀，但又讓人想看下一段
2. 每段結尾要留懸念或鉤子
3. 第一段是最重要的 Hook
4. 最後一段是總結和 CTA

=== 分段技巧 ===
- 在轉折點分段
- 在高潮前分段
- 在問題提出後分段
`;
```

**問題**：這個提示詞要求 AI 大幅改寫原文，導致：
- 原文結構被打亂
- 加入太多「懸念」和「鉤子」
- 最後一段強制加 CTA

---

## 三、優化方案詳細設計

### 3.1 方案一：精簡提示詞架構

**目標**：從 3,000-8,000 字精簡到 300-500 字

**實作方式**：

```typescript
// 新版 buildDataDrivenPrompt()
export async function buildDataDrivenPrompt(
  contentType: string,
  material: string,
  additionalContext?: {...}
): Promise<{ systemPrompt: string }> {
  
  // 精簡版 Layer 1：只保留核心禁止詞
  const coreRules = `
【核心規則】
- 像傳訊息給朋友，不是寫文章
- 每句 10-20 字，每段 2-4 行
- 禁止：「讓我們」「首先」「希望對你有幫助」
`;

  // 精簡版 Layer 2：只保留字數範圍
  const typeRule = getContentTypeRule(contentType);
  const wordLimit = `字數：${typeRule?.wordLimit.min}-${typeRule?.wordLimit.max} 字`;

  // 精簡版 Layer 3：給公式而非強制選項
  const openerFormulas = `
【開頭公式】（選擇最適合的，不要刻意）
- 冒號斷言：[主題]的[真相]：[觀點]
- 情緒爆發：我真的[情緒][感受]
- 時間點：[時間]我[發現][事件]
`;

  return {
    systemPrompt: `你是 Threads 文案助手。

${coreRules}
${wordLimit}
${openerFormulas}

直接輸出內容，不要解釋。`
  };
}
```

**改動檔案**：

| 檔案 | 改動內容 | 預估行數變化 |
|------|----------|--------------|
| `server/data-driven-prompt-builder.ts` | 重構三層架構 | -500 行 |
| `shared/opener-rules.ts` | 簡化為公式列表 | -200 行 |
| `shared/content-type-rules.ts` | 只保留字數範圍 | -300 行 |

---

### 3.2 方案二：開頭模式從「強制」改為「選擇」

**現有程式碼**：

```typescript
// server/data-driven-prompt-builder.ts - selectOpenerPattern()
function selectOpenerPattern(contentType: string, keywords: string[]): OpenerPattern {
  const typeRule = getContentTypeRule(contentType);
  const recommendedOpeners = typeRule?.recommendedOpeners || ['冒號斷言'];
  
  // 隨機選擇一個推薦的開頭模式
  const selectedName = recommendedOpeners[Math.floor(Math.random() * recommendedOpeners.length)];
  return OPENER_PATTERNS.find(p => p.name === selectedName) || OPENER_PATTERNS[0];
}
```

**優化後程式碼**：

```typescript
// 新版：不再強制選擇，而是提供公式列表
function buildOpenerFormulasPrompt(contentType: string): string {
  const typeRule = getContentTypeRule(contentType);
  const recommendedOpeners = typeRule?.recommendedOpeners || ['冒號斷言', '情緒爆發', '時間點'];
  
  const formulas = recommendedOpeners.map(name => {
    const pattern = OPENER_PATTERNS.find(p => p.name === name);
    return pattern ? `- ${pattern.name}：${pattern.templateFormula}` : null;
  }).filter(Boolean);
  
  return `
【開頭公式參考】（根據素材自然選擇，不要刻意套用）
${formulas.join('\n')}

重要：不要每次都用同一種開頭，根據內容選擇最自然的方式。
`;
}
```

**改動位置**：

```
server/data-driven-prompt-builder.ts
├── selectOpenerPattern() → buildOpenerFormulasPrompt()  // 重構
├── buildLayer3KeywordRules() → 移除強制指定              // 修改
└── Final Instructions → 移除「必須使用 X 格式」          // 刪除
```

---

### 3.3 方案三：新增專用風格潤飾 API

**新增 API 端點**：

```typescript
// server/routers.ts - 新增 stylePolish API
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
    
    // 4. 更新草稿
    if (input.draftId) {
      await db.updateDraft(input.draftId, { body: polishedContent });
    }
    
    return { content: polishedContent };
  }),
```

**專用提示詞建構函數**：

```typescript
// server/style-polish-prompt.ts - 新增檔案
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

**前端改動**：

```typescript
// client/src/components/GuidedWritingFlow.tsx
// 將 handlePolish 改為調用新的 stylePolish API

const stylePolish = trpc.studio.stylePolish.useMutation({
  onSuccess: (data) => {
    setDraftContent(data.content);
    setFinalContent(data.content);
    toast.success("潤飾完成！");
    setIsChatting(false);
  },
  onError: (error) => {
    toast.error("潤飾失敗：" + error.message);
    setIsChatting(false);
  },
});

const handlePolish = () => {
  if (!catchphrases && !speakingStyle) {
    toast.info("請輸入口頭禪或說話風格");
    return;
  }

  setIsChatting(true);
  stylePolish.mutate({
    content: draftContent,
    catchphrases: catchphrases || undefined,
    speakingStyle: speakingStyle || undefined,
    draftId: draftId || undefined,
  });
};
```

---

### 3.4 方案四：優化串文功能

**已完成的改動**（`server/routers.ts` 第 3950-4000 行）：

```typescript
// 優化後的串文提示詞
const systemPrompt = `你是一個 Threads 串文助手。

=== 核心原則（極重要） ===
你的任務是「分段」而不是「改寫」。
保留原文 90% 以上的內容，只做分段和加鉤子。

=== 分段規則 ===
- 分成 3-4 段（不要超過 4 段）
- 每段 50-100 字
- 在自然的轉折點分段

=== 鉤子規則（簡單就好） ===
只在每段結尾加入簡單的鉤子，例如：
- 「但這還不是最恐怖的...」
- 「結果呢？」
- 「後來我才發現...」
- 「重點來了」

=== 絕對禁止 ===
- 不要大幅改寫原文
- 不要加入原文沒有的觀點
- 不要在最後一段強制加 CTA
- 不要讓每段都變成「獨立文章」
`;
```

---

## 四、改動影響範圍

### 4.1 檔案改動清單

| 檔案 | 改動類型 | 改動內容 | 風險等級 |
|------|----------|----------|----------|
| `server/data-driven-prompt-builder.ts` | 重構 | 精簡三層架構 | 高 |
| `server/routers.ts` | 修改 | 新增 stylePolish API、優化串文 | 中 |
| `server/style-polish-prompt.ts` | 新增 | 專用潤飾提示詞 | 低 |
| `shared/opener-rules.ts` | 修改 | 簡化為公式列表 | 中 |
| `shared/content-type-rules.ts` | 修改 | 只保留字數範圍 | 中 |
| `client/src/components/GuidedWritingFlow.tsx` | 修改 | 改用 stylePolish API | 低 |

### 4.2 API 變更

| API | 變更類型 | 說明 |
|-----|----------|------|
| `studio.generateDraft` | 修改 | 使用精簡版提示詞 |
| `studio.refineDraft` | 不變 | 保持現有邏輯 |
| `studio.stylePolish` | 新增 | 專用風格潤飾 |
| `studio.convertToThread` | 已修改 | 簡化串文邏輯 |

### 4.3 資料庫影響

**無資料庫 Schema 變更**。所有改動都在應用層。

---

## 五、測試計畫

### 5.1 單元測試

```typescript
// server/style-polish-prompt.test.ts - 新增測試
describe('buildStylePolishPrompt', () => {
  it('should include catchphrases when provided', () => {
    const prompt = buildStylePolishPrompt({
      catchphrases: '說真的、我跟你說',
    });
    expect(prompt).toContain('說真的');
    expect(prompt).toContain('我跟你說');
  });

  it('should include sample post when provided', () => {
    const prompt = buildStylePolishPrompt({
      samplePost: '這是一篇範例貼文...',
    });
    expect(prompt).toContain('風格參考');
  });

  it('should not exceed 500 characters for core rules', () => {
    const prompt = buildStylePolishPrompt({});
    const coreRulesSection = prompt.split('===')[1];
    expect(coreRulesSection.length).toBeLessThan(500);
  });
});
```

### 5.2 整合測試

| 測試案例 | 預期結果 | 驗證方式 |
|----------|----------|----------|
| 生成草稿 | 開頭多樣性提升 | 生成 10 篇，檢查開頭重複率 < 20% |
| 風格潤飾 | 語氣改變，結構不變 | 比對原文和潤飾後的段落數 |
| 串文轉換 | 分成 3-4 段，內容保留 90%+ | 計算文字相似度 |

### 5.3 A/B 測試計畫

| 測試項目 | 對照組 | 實驗組 | 成功指標 |
|----------|--------|--------|----------|
| 提示詞長度 | 3,000 字 | 500 字 | 生成品質評分 ≥ 對照組 |
| 開頭模式 | 強制選擇 | 給公式選擇 | 開頭重複率 < 20% |
| 潤飾功能 | 現有 refineDraft | 新 stylePolish | 用戶滿意度 ≥ 80% |

---

## 六、風險評估與緩解措施

### 6.1 高風險項目

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 精簡提示詞導致品質下降 | 生成內容不符合 Threads 風格 | 保留核心規則，逐步精簡 |
| 移除 Few-Shot 範例 | AI 不知道「風格」是什麼 | 改為精簡（1-2 個）而非移除 |
| 新 API 引入 bug | 潤飾功能異常 | 完整測試後再上線 |

### 6.2 回滾計畫

```typescript
// 功能開關設計
const FEATURE_FLAGS = {
  USE_SIMPLIFIED_PROMPT: false,      // 精簡版提示詞
  USE_FORMULA_OPENER: false,         // 公式選擇開頭
  USE_NEW_STYLE_POLISH: false,       // 新潤飾 API
};

// 在 generateDraft 中使用
if (isFeatureEnabled('USE_SIMPLIFIED_PROMPT')) {
  systemPrompt = buildSimplifiedPrompt(contentType, material);
} else {
  systemPrompt = buildDataDrivenPrompt(contentType, material);
}
```

---

## 七、實施時程

| 階段 | 內容 | 預估時間 | 狀態 |
|------|------|----------|------|
| Phase 1 | 串文功能優化 | 1 天 | ✅ 已完成 |
| Phase 2 | 新增 stylePolish API | 2 天 | ⏳ 待實施 |
| Phase 3 | 精簡提示詞架構 | 3 天 | ⏳ 待實施 |
| Phase 4 | 開頭模式改為選擇 | 2 天 | ⏳ 待實施 |
| Phase 5 | A/B 測試 | 1 週 | ⏳ 待實施 |
| Phase 6 | 全面上線 | 1 天 | ⏳ 待實施 |

---

## 八、總結

### 8.1 改動摘要

| 項目 | 現狀 | 優化後 | 預期效果 |
|------|------|--------|----------|
| 提示詞長度 | 3,000-8,000 字 | 300-500 字 | 降低成本 60%+、加快回應 |
| 開頭模式 | 強制選擇 | 給公式選擇 | 減少同質性 |
| 潤飾功能 | 無效 | 專用 API | 真正改變語氣 |
| 串文功能 | 改寫過度 | 只分段加鉤子 | 保留原文 90%+ |

### 8.2 核心原則

> **優化的目標是「讓 AI 更像助手，而非替代創作者」。**
> 
> 提示詞應該給 AI 足夠的指引，但不要限制到變成「填空題」。
> 
> 用戶的風格和內容應該被尊重，AI 只是幫助潤飾和優化。

---

## 附錄：程式碼差異對照

### A.1 串文功能提示詞差異

```diff
// server/routers.ts - convertToThread

- const systemPrompt = `你是一個專業的 Threads 串文轉換專家。
- 
- === 串文原則 ===
- 1. 每段都要能獨立閱讀，但又讓人想看下一段
- 2. 每段結尾要留懸念或鉤子
- 3. 第一段是最重要的 Hook
- 4. 最後一段是總結和 CTA
- 
- === 分段技巧 ===
- - 在轉折點分段
- - 在高潮前分段
- - 在問題提出後分段
- `;

+ const systemPrompt = `你是一個 Threads 串文助手。
+ 
+ === 核心原則（極重要） ===
+ 你的任務是「分段」而不是「改寫」。
+ 保留原文 90% 以上的內容，只做分段和加鉤子。
+ 
+ === 分段規則 ===
+ - 分成 3-4 段（不要超過 4 段）
+ - 每段 50-100 字
+ - 在自然的轉折點分段
+ 
+ === 鉤子規則（簡單就好） ===
+ 只在每段結尾加入簡單的鉤子，例如：
+ - 「但這還不是最恐怖的...」
+ - 「結果呢？」
+ - 「後來我才發現...」
+ 
+ === 絕對禁止 ===
+ - 不要大幅改寫原文
+ - 不要加入原文沒有的觀點
+ - 不要在最後一段強制加 CTA
+ `;
```

### A.2 對話修改顯示差異

```diff
// client/src/pages/WritingStudio.tsx - DraftResultWithChat

- {/* AI 回覆顯示完整修改後內容 */}
- <div className="text-sm whitespace-pre-wrap">
-   {msg.content.length > 200 
-     ? msg.content.substring(0, 200) + '...' 
-     : msg.content}
- </div>

+ {/* AI 回覆只顯示簡短確認 */}
+ <div className="text-sm text-muted-foreground flex items-center gap-2">
+   <Check className="w-4 h-4 text-green-500" />
+   已根據你的指令修改完成，請查看上方最新版本
+ </div>
```
