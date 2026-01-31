# AI 去痕優化策略報告

## 一、研究發現總結

### 1.1 Humanizer-zh 的 24 種 AI 痕跡模式

經過深入研究 Humanizer-zh 專案，整理出 24 種 AI 寫作痕跡，分為四大類：

| 類別 | 模式數量 | 關鍵特徵 |
|------|----------|----------|
| **內容模式** | 6 種 | 過度強調意義、宣傳語言、模糊歸因 |
| **語言語法模式** | 6 種 | AI 詞彙、三段式法則、同義詞循環 |
| **風格模式** | 6 種 | 破折號過度使用、粗體過度使用、表情符號 |
| **交流模式** | 6 種 | 協作交流痕跡、諂媚語氣、填充短語 |

### 1.2 AI-Text-Humanizer-App 的技術方案

該專案使用 Python + NLP 模型實現：
- 展開縮寫（英文適用）
- 添加學術過渡詞（反而增加 AI 感）
- 被動語態轉換
- 同義詞替換（使用 WordNet + Sentence Transformer）

**評估**：該方案主要針對英文學術寫作，對繁體中文 Threads 貼文不適用。

### 1.3 核心洞察

Humanizer-zh 的核心規則對我們系統最有價值：

1. **刪除填充短語** - 去除開場白和強調性拐杖詞
2. **打破公式結構** - 避免二元對比、戲劇性分段、修辭性設置
3. **變化節奏** - 混合句子長度。兩項優於三項。段落結尾要多樣化
4. **信任讀者** - 直接陳述事實，跳過軟化、辯解和手把手引導
5. **刪除金句** - 如果聽起來像可引用的語句，重寫它

---

## 二、與現有系統的整合策略

### 2.1 現有系統架構分析

目前系統的內容生成流程：

```
用戶輸入 → generateDraft → stylePolish → 輸出
           (內容生成)      (風格潤飾)
```

**現有的 AI 去痕機制**：
- `stylePolish`：將書面語改成口語（「因此」→「所以」）
- `cleanAIOutput`：清理 AI 輸出的格式問題
- `contentFilters`：過濾禁用詞彙

**現有機制的不足**：
- 只處理詞彙層面，沒有處理結構層面
- 沒有檢測 AI 痕跡的機制
- 沒有針對 24 種模式的系統性處理

### 2.2 整合方案：三層 AI 去痕系統

#### 第一層：生成時預防（Prompt 層）

在 `generateDraft` 的系統提示詞中加入 AI 痕跡預防指令：

```typescript
const AI_PREVENTION_PROMPT = `
=== AI 痕跡預防（必須遵守）===

【禁止使用的詞彙】
此外、與……保持一致、至關重要、深入探討、強調、持久的、增強、培養、
獲得、突出、相互作用、複雜性、關鍵性的、展示、織錦、證明、寶貴的、充滿活力的

【禁止的結構】
❌ 三段式法則（不要強行分成三點）
❌ 否定式排比（不要用「不僅...而且...」）
❌ 虛假範圍（不要用「從 X 到 Y」的空泛描述）
❌ 公式化結尾（不要用「總之」「希望對你有幫助」）

【必須做到】
✅ 句子長度要變化（短句和長句交替）
✅ 直接陳述，不要繞圈子
✅ 用具體例子，不要抽象描述
✅ 像跟朋友說話，不要像寫報告
`;
```

#### 第二層：生成後檢測（Detection 層）

新增 `detectAIPatterns` 函數，檢測生成內容中的 AI 痕跡：

```typescript
interface AIPatternDetection {
  hasAIPatterns: boolean;
  patterns: Array<{
    type: string;        // 模式類型
    severity: 'high' | 'medium' | 'low';
    location: string;    // 問題位置
    suggestion: string;  // 修改建議
  }>;
  score: number;         // 0-100，越低越像 AI
}

function detectAIPatterns(content: string): AIPatternDetection {
  const patterns: AIPatternDetection['patterns'] = [];
  
  // 1. 檢測 AI 詞彙
  const AI_VOCABULARY = [
    '此外', '至關重要', '深入探討', '強調', '持久的', '增強',
    '培養', '獲得', '突出', '相互作用', '複雜性', '關鍵性的',
    '展示', '織錦', '證明', '寶貴的', '充滿活力的', '不可或缺'
  ];
  
  for (const word of AI_VOCABULARY) {
    if (content.includes(word)) {
      patterns.push({
        type: 'AI_VOCABULARY',
        severity: 'high',
        location: word,
        suggestion: `建議替換「${word}」為更口語化的表達`
      });
    }
  }
  
  // 2. 檢測三段式法則
  const threePartPattern = /(?:第一|首先|一、).*(?:第二|其次|二、).*(?:第三|最後|三、)/s;
  if (threePartPattern.test(content)) {
    patterns.push({
      type: 'THREE_PART_RULE',
      severity: 'medium',
      location: '整體結構',
      suggestion: '建議改為兩點或四點，避免三段式'
    });
  }
  
  // 3. 檢測否定式排比
  const negationPattern = /不僅.*而且|這不僅僅是.*而是/;
  if (negationPattern.test(content)) {
    patterns.push({
      type: 'NEGATION_PARALLELISM',
      severity: 'high',
      location: content.match(negationPattern)?.[0] || '',
      suggestion: '建議直接陳述，不要用「不僅...而且...」'
    });
  }
  
  // 4. 檢測句子長度一致性
  const sentences = content.split(/[。！？]/);
  const lengths = sentences.map(s => s.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
  
  if (variance < 100) { // 方差太小表示句子長度太一致
    patterns.push({
      type: 'UNIFORM_SENTENCE_LENGTH',
      severity: 'medium',
      location: '整體節奏',
      suggestion: '建議混合使用長短句，增加節奏變化'
    });
  }
  
  // 5. 檢測公式化結尾
  const formulaicEndings = [
    '希望對你有幫助', '總之', '綜上所述', '最後',
    '讓我們一起', '期待你的', '歡迎留言'
  ];
  
  const lastParagraph = content.split('\n').slice(-3).join('\n');
  for (const ending of formulaicEndings) {
    if (lastParagraph.includes(ending)) {
      patterns.push({
        type: 'FORMULAIC_ENDING',
        severity: 'low',
        location: ending,
        suggestion: `建議用更自然的結尾，避免「${ending}」`
      });
    }
  }
  
  // 計算分數
  const score = Math.max(0, 100 - patterns.length * 15);
  
  return {
    hasAIPatterns: patterns.length > 0,
    patterns,
    score
  };
}
```

#### 第三層：自動修正（Humanize 層）

新增 `humanizeContent` API，自動修正檢測到的 AI 痕跡：

```typescript
const HUMANIZE_PROMPT = `你是一位「去 AI 感」專家。

你的任務是把 AI 生成的文字改得更像真人寫的。

=== 檢測到的 AI 痕跡 ===
{detectedPatterns}

=== 修改規則 ===

【詞彙替換】
| AI 詞彙 | 人類說法 |
|---------|----------|
| 此外 | 還有 / 另外 |
| 至關重要 | 很重要 / 超重要 |
| 深入探討 | 聊聊 / 說說 |
| 強調 | 說 / 提到 |
| 展示 | 給你看 / 分享 |
| 證明 | 說明 / 表示 |

【結構調整】
- 三段式 → 改成兩點或直接敘述
- 否定式排比 → 直接陳述
- 公式化結尾 → 用問句或個人感受結尾

【節奏調整】
- 如果句子長度太一致，打斷其中一些
- 加入短句：「真的。」「對吧？」「就這樣。」
- 加入語氣詞：「欸」「啊」「吧」「呢」

=== 輸出要求 ===
直接輸出修改後的內容，不要任何解釋。
保持原意，只改語氣和結構。
`;
```

### 2.3 實作優先級

| 優先級 | 項目 | 預估時間 | 影響範圍 |
|--------|------|----------|----------|
| **P0** | 生成時預防（Prompt 層）| 2 小時 | generateDraft |
| **P1** | 生成後檢測（Detection 層）| 4 小時 | 新增 API |
| **P1** | 自動修正（Humanize 層）| 4 小時 | 新增 API |
| **P2** | 前端整合（顯示檢測結果）| 3 小時 | WritingStudio |

---

## 三、針對 Threads 的特殊優化

### 3.1 Threads 特有的「人味」特徵

根據 50 個 IP 帳號的爆款分析，Threads 上的「人味」貼文有以下特徵：

| 特徵 | 說明 | 範例 |
|------|------|------|
| **語氣詞** | 使用「欸」「啊」「吧」「呢」 | 「欸你們知道嗎」 |
| **斷句** | 短句多，節奏快 | 「真的。超累。但值得。」 |
| **問句** | 直接問讀者 | 「你也是這樣嗎？」 |
| **情緒詞** | 表達真實感受 | 「超崩潰」「爽翻」「好煩」 |
| **身分標籤** | 強調身分 | 「身為一個媽媽」「創業第三年」 |

### 3.2 Threads 專用的 AI 痕跡清單

除了 Humanizer-zh 的 24 種模式，針對 Threads 新增以下檢測：

| 模式 | 說明 | 修正方式 |
|------|------|----------|
| **過度正式** | 像在寫報告 | 改成聊天語氣 |
| **沒有情緒** | 只有事實沒有感受 | 加入「我覺得」「好煩」等 |
| **沒有問句** | 沒有跟讀者互動 | 結尾加問句 |
| **段落太長** | 一段超過 100 字 | 分成 2-3 段 |
| **沒有換行** | 視覺沒有呼吸感 | 每 2-3 句換行 |

### 3.3 整合到 stylePolish 的增強版

```typescript
// 在 stylePolish 中加入 Threads 專用的人味化處理
const THREADS_HUMANIZE_RULES = `
=== Threads 專用人味化規則 ===

【語氣詞注入】
- 開頭可用：「欸」「你們知道嗎」「說真的」
- 中間可用：「真的」「超」「好」
- 結尾可用：「吧」「呢」「啊」

【節奏調整】
- 每 2-3 句換行一次
- 加入短句打斷節奏：「真的。」「對吧？」
- 段落不超過 80 字

【情緒表達】
- 如果內容是正面的，加入「超開心」「爽」「讚」
- 如果內容是負面的，加入「好煩」「崩潰」「累」
- 如果內容是中性的，加入「有點意外」「蠻有趣的」

【互動元素】
- 結尾必須有問句或邀請：「你們也是這樣嗎？」「留言告訴我」
`;
```

---

## 四、實作計畫

### 4.1 第一階段：Prompt 層預防（2 小時）

1. 在 `generateDraft` 的系統提示詞中加入 AI 痕跡預防指令
2. 加入 Threads 專用的人味化規則
3. 測試生成效果

### 4.2 第二階段：Detection 層（4 小時）

1. 新增 `detectAIPatterns` 函數
2. 實作 24 種 AI 痕跡的檢測邏輯
3. 新增 `ai.detectPatterns` API
4. 撰寫測試案例

### 4.3 第三階段：Humanize 層（4 小時）

1. 新增 `humanizeContent` 函數
2. 整合到 `stylePolish` API
3. 新增獨立的 `ai.humanize` API
4. 撰寫測試案例

### 4.4 第四階段：前端整合（3 小時）

1. 在 WritingStudio 顯示 AI 痕跡檢測結果
2. 提供「一鍵去 AI 感」按鈕
3. 顯示修改前後對比

---

## 五、預期效果

### 5.1 量化指標

| 指標 | 目前 | 目標 |
|------|------|------|
| AI 痕跡檢測率 | 無 | 90%+ |
| 自動修正成功率 | 無 | 80%+ |
| 用戶滿意度 | 未知 | 提升 30% |

### 5.2 質化效果

- 生成的內容更像「真人在聊天」
- 減少「AI 味」的抱怨
- 提升內容的互動率（因為更有人味）

---

## 六、參考資源

1. [Humanizer-zh](https://github.com/op7418/Humanizer-zh) - 24 種 AI 痕跡模式
2. [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) - AI 寫作特徵指南
3. [AI-Text-Humanizer-App](https://github.com/DadaNanjesha/AI-Text-Humanizer-App) - Python 實作參考
