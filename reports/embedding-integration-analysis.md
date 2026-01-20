# Embedding 向量資料庫整合狀態分析報告

**分析日期**：2025 年 1 月 20 日

---

## 一、您提出的問題分析

### 問題 1：引導模式的「目標」沒有影響腦力激盪

**現狀**：
- 前端有 4 個目標選項（讓人更懂我、讓人信任我、有人互動、慢慢賣產品）
- 但 `brainstorm.mutate()` 呼叫時**只傳遞 `topic`**，沒有傳遞 `selectedGoal`
- 後端 `brainstorm` API 也**沒有接收 `goal` 參數**

**程式碼證據**：
```typescript
// GuidedWritingFlow.tsx 第 294 行
const handleGenerateTopics = () => {
  brainstorm.mutate({ topic: topicHint || undefined });
  // ❌ 沒有傳遞 selectedGoal
};
```

**結論**：目標選擇**確實沒有影響**腦力激盪的主題建議。目標只在「選擇文章類型」步驟用來篩選推薦的類型。

---

### 問題 2：受眾選擇沒有影響貼文產出

**現狀**：
- `generateDraft` API **有接收** `targetAudienceId` 參數
- 但在 `GuidedWritingFlow.tsx` 中，`selectedAudienceId` **有被傳遞**到 API

**程式碼證據**：
```typescript
// routers.ts 第 2374-2395 行
if (input.targetAudienceId) {
  const targetAudience = audiences.find(a => a.id === input.targetAudienceId);
  if (targetAudience) {
    return `❗❗❗【極度重要 - 目標受眾】❗❗❗
    🎯 受眾名稱：${targetAudience.segmentName}
    🔥 他們的痛點（必須在文章中觸及）：${targetAudience.painPoint}
    ...
```

**可能原因**：
1. 提示詞中雖然強調了受眾，但 LLM 可能沒有足夠重視
2. 受眾痛點描述可能太籠統，導致生成內容差異不大
3. 需要在提示詞中加入更具體的「受眾專屬語言」和「受眾專屬場景」

---

### 問題 3：故事型、對話型、觀點型產出相似

**現狀**：
- 每種類型有獨立的提示詞（`typeSpecificPrompts`）
- 但提示詞的結構差異不夠明顯

**程式碼證據**：
```typescript
// routers.ts 第 2526-2684 行
const typeSpecificPrompts: Record<string, string> = {
  question: `寫一篇「提問型」貼文...`,
  poll: `寫一篇「投票型」貼文...`,
  story: `寫一篇「故事型」貼文...`,
  // ...
};
```

**可能原因**：
1. 各類型的「結構要求」描述相似
2. 缺乏具體的「範例對比」讓 LLM 理解差異
3. 建議：加入 K-means 聚類的爆款公式，讓不同類型使用不同公式

---

### 問題 4：選擇的開頭與最終產出差距大

**現狀**：
- 開頭選項由 `generateHooks` API 生成
- 完整貼文由 `generateDraft` API 生成
- 兩個 API **獨立運作**，沒有強制連結

**程式碼證據**：
```typescript
// 開頭生成（generateHooks）和完整貼文生成（generateDraft）是分開的
// 雖然有傳遞 selectedHook，但 LLM 可能會「改寫」開頭
```

**可能原因**：
1. 提示詞中沒有強制「必須使用選定的開頭」
2. LLM 在生成完整內容時可能會「優化」開頭
3. 建議：在提示詞中加入「❗ 開頭必須完全保留：{selectedHook}」

---

### 問題 5：「我媽突然問我」等虛構場景

**現狀**：
- 這是 Threads 爆款的常見開頭模式
- 系統的 Few-Shot 範例中可能包含這類內容

**可能原因**：
1. 爆款資料庫中有大量「我媽問我」「朋友突然說」等開頭
2. LLM 學習到這些模式後會自動套用
3. 建議：在提示詞中加入「禁止虛構場景」的約束

---

## 二、Embedding 向量資料庫整合狀態

### 2.1 已完成的整合

| 功能 | 整合位置 | 狀態 |
|------|----------|------|
| 爆款 Embedding 生成 | `viral-embedding-service.ts` | ✅ 已完成 |
| 語意相似度匹配 | `findSimilarViralExamples()` | ✅ 已完成 |
| 智能 Few-Shot 選取 | `getSmartFewShotExamples()` | ✅ 已完成 |
| K-means 聚類分析 | `viralClusters` 資料表 | ✅ 已完成 |
| **generateDraft 整合** | `routers.ts` 第 2250-2268 行 | ✅ 已完成 |

### 2.2 尚未整合的功能

| 功能 | 建議整合位置 | 優先級 |
|------|--------------|--------|
| brainstorm 語意匹配 | `brainstorm` API | P0 |
| analyzeAngles 語意匹配 | `analyzeAngles` API | P1 |
| 開頭同質性檢測 | `generateHooks` API | P1 |
| 用戶風格向量 | 新增 API | P2 |

### 2.3 目前 Embedding 在 generateDraft 中的使用

```typescript
// routers.ts 第 2250-2268 行
let semanticFewShotPrompt = '';
try {
  const smartExamples = await getSmartFewShotExamples(
    materialContent,
    input.contentType,
    3
  );
  if (smartExamples.length > 0) {
    semanticFewShotPrompt = `\n=== 語意匹配爆款範例（基於 1,240 篇爆款分析） ===\n`;
    smartExamples.forEach((ex, i) => {
      semanticFewShotPrompt += `\n範例 ${i + 1}（${ex.likes} 讚，${ex.matchReason}）：\n${ex.postText.substring(0, 200)}...\n`;
    });
    // ...
  }
} catch (embeddingError) {
  console.warn('[Embedding] 語意匹配失敗:', embeddingError);
}
```

**結論**：Embedding 語意匹配**只在 generateDraft（進階模式的「直接生成」）中使用**，尚未整合到：
- brainstorm（腦力激盪）
- analyzeAngles（切角分析）
- generateHooks（開頭生成）

---

## 三、進階模式 vs 引導模式的 Embedding 使用

| 模式 | API | Embedding 使用 |
|------|-----|----------------|
| 進階模式 | `generateDraft` | ✅ 有使用語意匹配 |
| 進階模式 | `analyzeAngles` | ❌ 沒有使用 |
| 引導模式 | `brainstorm` | ❌ 沒有使用 |
| 引導模式 | `generateHooks` | ❌ 沒有使用 |
| 引導模式 | `generateDraft` | ✅ 有使用語意匹配 |

---

## 四、建議優化方案

### 4.1 P0：修復「目標」影響腦力激盪

**修改 1**：後端 `brainstorm` API 新增 `goal` 參數

```typescript
brainstorm: protectedProcedure
  .input(z.object({
    pillarId: z.number().optional(),
    topic: z.string().optional(),
    goal: z.enum(['connect', 'trust', 'engage', 'sell']).optional(), // 新增
  }))
```

**修改 2**：根據目標調整提示詞

```typescript
const goalPrompts: Record<string, string> = {
  connect: '主題必須能讓讀者感受到你是真實的人，分享故事、心情、生活',
  trust: '主題必須能展現你的專業能力，分享知識、整理、教學',
  engage: '主題必須能引發讀者留言互動，提問、投票、對話',
  sell: '主題必須能軟性帶入產品/服務，故事帶產品、知識分享',
};
```

### 4.2 P0：整合 Embedding 到 brainstorm

```typescript
// 在 brainstorm API 中加入
const smartExamples = await getSmartFewShotExamples(
  input.topic || profile?.occupation || '',
  'general',
  3
);
// 將範例加入提示詞
```

### 4.3 P1：強化受眾差異化

在提示詞中加入更具體的受眾專屬元素：

```typescript
audienceContext = `
🎯 受眾：${targetAudience.segmentName}
🗣️ 他們常說的話：「${targetAudience.commonPhrases || ''}」
📍 他們常見的場景：${targetAudience.commonScenarios || ''}
❌ 他們討厭聽到：${targetAudience.avoidPhrases || ''}
`;
```

### 4.4 P1：強化開頭一致性

在 `generateDraft` 提示詞中加入：

```typescript
`❗❗❗ 開頭必須完全保留 ❗❗❗
用戶已選擇的開頭：「${selectedHook}」
你必須使用這個開頭作為文章的第一句話，不能修改或替換。`
```

### 4.5 P2：加入「禁止虛構場景」約束

```typescript
`❗ 禁止虛構場景 ❗
- 不要使用「我媽突然問我」「朋友突然說」等虛構對話
- 除非用戶素材中明確提到，否則不要捏造人物
- 如果需要舉例，使用「有人問我」「常有人說」等泛指方式`
```

---

## 五、總結

### 5.1 Embedding 向量資料庫的價值

1. **語意匹配**：根據用戶素材找出「意思相近」的爆款，而非只靠關鍵字
2. **跨領域學習**：創業困難 ≈ 減肥困難，可以找到結構相似的爆款
3. **K-means 爆款公式**：從數據中發現 11 種「隱藏的爆款公式」

### 5.2 目前的限制

1. **只在 generateDraft 中使用**：brainstorm、analyzeAngles 尚未整合
2. **目標選擇沒有實際影響**：前端有選項但後端沒有處理
3. **受眾差異化不足**：提示詞中的受眾描述太籠統

### 5.3 下一步行動

1. **P0**：修復 brainstorm API，加入 `goal` 參數和 Embedding 語意匹配
2. **P1**：強化受眾專屬元素和開頭一致性
3. **P2**：加入「禁止虛構場景」約束

---

**報告結束**
