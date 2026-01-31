# 幕創行銷 Threads AI 教練系統
# 內容創作優化方案報告

**版本**：v3.0  
**日期**：2026 年 1 月 29 日  
**作者**：Manus AI

---

## 摘要

本報告基於您提供的「第一性原理」分析文件，重新審視幕創行銷 Threads AI 教練系統的核心問題，並提出完整的優化方案。報告涵蓋四大面向：**問題診斷**、**根因分析**、**解決方案**、**實施路線圖**。

核心發現：系統的 AI 感問題並非源於「缺少去 AI 痕跡的規則」，而是**系統設計偏離了創作的第一性原理**——過度追求爆款公式，忽視了創作者的獨特性與長期價值。

---

## 目錄

1. [問題診斷：系統偏離第一性原理的具體表現](#一問題診斷系統偏離第一性原理的具體表現)
2. [根因分析：為什麼會產生 AI 感](#二根因分析為什麼會產生-ai-感)
3. [解決方案：回歸第一性原理的優化策略](#三解決方案回歸第一性原理的優化策略)
4. [實施路線圖：分階段執行計畫](#四實施路線圖分階段執行計畫)
5. [附錄：技術實作細節](#五附錄技術實作細節)

---

## 一、問題診斷：系統偏離第一性原理的具體表現

### 1.1 第一性原理回顧

根據您的分析，內容創作的第一性原理可以歸納為：

> **用戶為何停下來看？**
> 1. 引發好奇與注意（Hook）
> 2. 情緒共鳴與真實感（Emotion）
> 3. 提供價值與啟發（Value）

> **用戶與創作者的心理鏈條**
> ```
> 注意 → 共鳴 → 信任 → 行動
> ```

這個鏈條的核心是**真實感**——讀者能感受到「這是一個真人在跟我說話」，而不是「這是一篇被優化過的文案」。

### 1.2 現有系統的偏離點

經過深入分析現有系統的提示詞架構（約 4,000 字），我發現以下偏離點：

| 偏離類型 | 具體表現 | 對第一性原理的違背 |
|----------|----------|-------------------|
| **規則過載** | 提示詞包含 4,000+ 字的規則 | LLM 選擇性執行，產生「模板拼湊感」 |
| **公式化思維** | 強制套用「爆款元素」「四透鏡框架」 | 犧牲真實感，追求公式化輸出 |
| **一刀切設計** | 所有內容都套用相同的爆款策略 | 忽視創作者的多元目標（不是每篇都要爆） |
| **過度禁止** | 80+ 個禁止詞彙、多種禁止句式 | 限制創作自由，反而產生「避開禁區」的刻意感 |
| **數據驅動過頭** | 強制使用「數據驅動開頭模式」 | 所有貼文開頭風格趨同 |

### 1.3 AI 感的具體症狀

基於 Humanizer-zh 的 24 種 AI 痕跡模式，對照現有系統輸出，我識別出以下症狀：

**內容模式問題**：
- 過度強調「意義」和「價值」（每篇都要有「金句」）
- 公式化結尾（總是以 CTA 結束）
- 模糊歸因（「很多人」「大家」）

**語言模式問題**：
- 三段式法則（開頭 → 內容 → CTA）
- 同義詞循環（為了避開禁止詞而使用替代詞）
- 句子長度一致（都控制在 15-20 字）

**風格模式問題**：
- 轉折詞過度使用（「但」「結果」「沒想到」）
- 節奏過於規整（每 2-4 行一段）
- 情緒推動過於刻意

**交流模式問題**：
- 諂媚語氣（「你是不是也...」「你有沒有...」）
- 填充短語（為了達到字數而加入的內容）
- 協作交流痕跡（「讓我幫你...」「我們一起...」）

---

## 二、根因分析：為什麼會產生 AI 感

### 2.1 核心矛盾：規則越多，AI 感越重

這是一個反直覺的發現：

> **傳統思維**：AI 感來自於規則不夠，所以要加更多規則來「禁止 AI 詞彙」「強制人類風格」。
>
> **實際情況**：規則越多，LLM 越難全部遵守，反而會選擇性執行，產生「部分規則被套用、部分被忽略」的拼湊感。

現有系統的提示詞結構：

```
硬性字數限制（約 300 字）
↓
SYSTEM_PROMPTS.contentGeneration（約 500 字）
↓
創作者 IP 地基（約 200 字）
↓
目標受眾（約 150 字）
↓
內容支柱（約 100 字）
↓
用戶風格（約 200 字）
↓
經營階段策略（約 100 字）
↓
爆款元素提示（約 200 字）
↓
成功因素（約 300 字）
↓
選題庫參考（約 100 字）
↓
群集資訊（約 100 字）
↓
四透鏡框架（約 200 字）
↓
翻譯機規則（約 100 字）
↓
Threads 爆款風格（約 500 字）
↓
語調控制（約 200 字）
↓
絕對禁止（約 400 字）
↓
數據驅動開頭規則（約 200 字）
↓
重要指示（約 100 字）
─────────────────────
總計：約 4,000 字
```

當 LLM 收到 4,000 字的指令時，它無法同時滿足所有要求，只能「挑重點執行」。而它挑選的重點，往往是最明確、最強調的規則（如「字數限制」「禁止詞彙」），而忽略了更微妙的風格要求。

### 2.2 第二矛盾：爆款公式 vs 真實感

您的分析文件中有一段關鍵洞察：

> 「初版系統明顯帶有流量至上的設計傾向，假設所有創作者都一心追求爆款。」

這導致了一個根本性的矛盾：

| 爆款公式的要求 | 真實感的要求 |
|----------------|--------------|
| 強烈的 Hook | 自然的開場 |
| 情緒推動 | 真實的情緒流動 |
| 明確的 CTA | 自然的結束 |
| 結構清晰 | 思緒的自然展開 |
| 金句收尾 | 像聊天一樣結束 |

當系統強制套用爆款公式時，即使內容「技術上正確」，也會給讀者一種「這是被優化過的」感覺。

### 2.3 第三矛盾：風格學習 vs 風格複製

現有系統有「風格學習機制」，會分析用戶的爆款貼文並提取成功模式。但這個機制有一個問題：

> **風格學習**：學習用戶的「說話方式」「用詞習慣」「情緒表達」
>
> **風格複製**：複製用戶的「句式」「開頭」「結構」

當系統過度依賴 Few-Shot 範例時，它學到的是「句式」而非「風格」。這導致生成的內容「像用戶的貼文」，但「不像用戶會說的話」。

### 2.4 根因總結

| 根因 | 表現 | 影響 |
|------|------|------|
| **規則過載** | 4,000 字提示詞 | LLM 選擇性執行，產生拼湊感 |
| **公式化思維** | 強制爆款元素 | 犧牲真實感 |
| **風格複製** | Few-Shot 過度依賴 | 學到句式而非風格 |
| **一刀切設計** | 所有內容同一策略 | 忽視創作多元性 |

---

## 三、解決方案：回歸第一性原理的優化策略

### 3.1 核心理念轉變

**從「幫用戶寫爆款」轉變為「幫用戶說出想說的話」**

這個轉變的核心是：

| 舊理念 | 新理念 |
|--------|--------|
| AI 是「寫手」 | AI 是「助手」 |
| 目標是「爆款」 | 目標是「表達」 |
| 規則是「限制」 | 規則是「參考」 |
| 風格是「複製」 | 風格是「學習」 |

### 3.2 方案一：提示詞架構重構（最優先）

#### 3.2.1 從 4,000 字精簡到 500 字

**新的提示詞結構**：

```
=== 核心指令（100 字）===
你是這位創作者的「內心聲音」。
用他的口氣說話，用他的方式思考。
不要寫得「比他更好」，要寫得「像他」。

=== 風格 DNA（150 字）===
[動態注入：用戶的風格特徵]
- 常用開頭：...
- 常用轉折：...
- 情緒表達：...
- 句子長度：...

=== 內容方向（100 字）===
[動態注入：本次創作的主題和目標]

=== 品質底線（150 字）===
- 字數：[根據內容類型動態設定]
- 禁止：AI 常見詞彙（此外、值得一提、綜上所述）
- 禁止：髒話和粗俗用語
- 格式：純文字，不用 Markdown
```

#### 3.2.2 規則分層：核心規則 vs 參考規則

**核心規則（必須遵守）**：
1. 字數限制
2. 禁止髒話
3. 禁止 Markdown
4. 用創作者的口氣

**參考規則（可選遵守）**：
1. 爆款元素（用戶選擇是否啟用）
2. CTA 引導（用戶選擇是否需要）
3. 四透鏡框架（用戶選擇是否檢核）

#### 3.2.3 實作程式碼範例

```typescript
// 新的提示詞建構函數
function buildOptimizedPrompt(input: {
  userStyle: UserStyleDNA;
  contentGoal: ContentGoal;
  enableViralMode: boolean;
}): string {
  // 核心指令（永遠存在）
  const coreInstruction = `
你是這位創作者的「內心聲音」。
用他的口氣說話，用他的方式思考。
不要寫得「比他更好」，要寫得「像他」。
`;

  // 風格 DNA（從用戶數據提取）
  const styleDNA = `
=== 你的說話方式 ===
常用開頭：${input.userStyle.commonOpenings.join('、')}
常用轉折：${input.userStyle.commonTransitions.join('、')}
情緒表達：${input.userStyle.emotionStyle}
句子長度：平均 ${input.userStyle.avgSentenceLength} 字
`;

  // 內容方向（本次創作）
  const contentDirection = `
=== 這次要說的話 ===
主題：${input.contentGoal.topic}
想傳達的核心訊息：${input.contentGoal.coreMessage}
`;

  // 品質底線（永遠存在）
  const qualityBaseline = `
=== 品質底線 ===
字數：${input.contentGoal.wordLimit.min}-${input.contentGoal.wordLimit.max} 字
禁止：「此外」「值得一提」「綜上所述」「希望對你有幫助」
禁止：任何髒話和粗俗用語
格式：純文字，不用 **、#、- 等符號
`;

  // 爆款模式（可選）
  const viralMode = input.enableViralMode ? `
=== 爆款加成（可選參考）===
開頭技巧：用場景或情緒開頭，讓讀者停下來
結尾技巧：可以加一個問句引導互動
` : '';

  return `${coreInstruction}${styleDNA}${contentDirection}${qualityBaseline}${viralMode}`;
}
```

### 3.3 方案二：風格 DNA 提取系統（核心差異化）

#### 3.3.1 從「複製句式」到「學習風格」

現有的風格學習機制是基於 Few-Shot，會直接注入用戶的爆款貼文作為範例。這導致 LLM 會「模仿句式」而非「學習風格」。

**新的風格 DNA 提取系統**：

```typescript
interface UserStyleDNA {
  // 語言層面
  commonOpenings: string[];      // 常用開頭方式
  commonTransitions: string[];   // 常用轉折詞
  commonEndings: string[];       // 常用結尾方式
  avgSentenceLength: number;     // 平均句子長度
  paragraphPattern: string;      // 段落模式
  
  // 情緒層面
  emotionStyle: 'warm' | 'direct' | 'humorous' | 'reflective';
  emotionIntensity: 'low' | 'medium' | 'high';
  
  // 內容層面
  preferredTopics: string[];     // 偏好主題
  preferredAngles: string[];     // 偏好切角
  
  // 互動層面
  ctaStyle: 'question' | 'invitation' | 'none';
  ctaFrequency: number;          // CTA 出現頻率（0-1）
}

// 風格 DNA 提取函數
async function extractStyleDNA(userPosts: Post[]): Promise<UserStyleDNA> {
  // 分析用戶的歷史貼文，提取風格特徵
  const analysis = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `你是一位風格分析專家。分析以下貼文，提取作者的寫作風格特徵。
        
注意：你要提取的是「風格」而非「句式」。
- 風格：這個人說話的「感覺」是什麼？溫暖？直接？幽默？
- 句式：這個人用什麼「句子結構」？（這不是我們要的）

請用 JSON 格式回答。`
      },
      {
        role: 'user',
        content: userPosts.map(p => p.content).join('\n\n---\n\n')
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'style_dna',
        schema: {
          type: 'object',
          properties: {
            emotionStyle: { type: 'string', enum: ['warm', 'direct', 'humorous', 'reflective'] },
            emotionIntensity: { type: 'string', enum: ['low', 'medium', 'high'] },
            avgSentenceLength: { type: 'number' },
            commonOpenings: { type: 'array', items: { type: 'string' } },
            commonTransitions: { type: 'array', items: { type: 'string' } },
            // ... 其他欄位
          },
          required: ['emotionStyle', 'emotionIntensity', 'avgSentenceLength']
        }
      }
    }
  });
  
  return JSON.parse(analysis.choices[0].message.content);
}
```

#### 3.3.2 風格 DNA 的使用方式

**舊方式（Few-Shot）**：
```
以下是這位創作者的爆款貼文，請參考風格：

範例 1：「昨天我媽突然問我...」
範例 2：「你有沒有過這種感覺...」
範例 3：「我以前也是這樣想的...」

請用類似的風格寫一篇關於 [主題] 的貼文。
```

**新方式（風格 DNA）**：
```
這位創作者的說話方式：

情緒風格：溫暖、有同理心
情緒強度：中等（不會太激動，也不會太平淡）
句子長度：平均 12 字（偏短）
常用開頭：場景描述、自我揭露
常用轉折：「但」「後來」「沒想到」
結尾習慣：通常會問讀者一個問題

請用這種「感覺」寫一篇關於 [主題] 的貼文。
不要模仿上面的句式，而是用這種「感覺」來創作。
```

### 3.4 方案三：創作目標分流系統

#### 3.4.1 不是每篇都要爆款

您的分析文件中有一個重要洞察：

> 「不是每篇內容都要成為爆款，更重要的是整體內容和人設的一致性及長期信任的建立。」

基於這個洞察，我建議建立「創作目標分流系統」：

| 創作目標 | 說明 | 系統策略 |
|----------|------|----------|
| **表達型** | 只是想說說話 | 最少規則，最大自由 |
| **互動型** | 想引發討論 | 加入問句引導 |
| **價值型** | 想分享知識 | 結構化呈現 |
| **導流型** | 想引導行動 | 加入 CTA |
| **爆款型** | 想衝流量 | 啟用爆款元素 |

#### 3.4.2 實作程式碼範例

```typescript
// 創作目標類型
type ContentGoalType = 'express' | 'interact' | 'value' | 'convert' | 'viral';

// 根據目標調整策略
function getStrategyByGoal(goal: ContentGoalType): ContentStrategy {
  const strategies: Record<ContentGoalType, ContentStrategy> = {
    express: {
      promptLength: 'minimal',      // 最少提示詞
      viralElements: false,         // 不加爆款元素
      ctaRequired: false,           // 不需要 CTA
      structureRequired: false,     // 不需要結構
      wordLimit: { min: 100, max: 500 }
    },
    interact: {
      promptLength: 'short',
      viralElements: false,
      ctaRequired: true,            // 需要互動引導
      ctaType: 'question',          // CTA 類型是問句
      structureRequired: false,
      wordLimit: { min: 150, max: 300 }
    },
    value: {
      promptLength: 'medium',
      viralElements: false,
      ctaRequired: false,
      structureRequired: true,      // 需要結構
      wordLimit: { min: 300, max: 500 }
    },
    convert: {
      promptLength: 'medium',
      viralElements: false,
      ctaRequired: true,
      ctaType: 'action',            // CTA 類型是行動
      structureRequired: false,
      wordLimit: { min: 200, max: 400 }
    },
    viral: {
      promptLength: 'full',         // 完整提示詞
      viralElements: true,          // 啟用爆款元素
      ctaRequired: true,
      structureRequired: true,
      wordLimit: { min: 200, max: 400 }
    }
  };
  
  return strategies[goal];
}
```

### 3.5 方案四：AI 去痕後處理層

即使優化了提示詞，生成的內容仍可能有 AI 痕跡。因此，我建議加入「AI 去痕後處理層」。

#### 3.5.1 檢測 + 修正流程

```
生成內容
    ↓
AI 痕跡檢測
    ↓
[有痕跡] → 自動修正 → 輸出
[無痕跡] → 直接輸出
```

#### 3.5.2 檢測規則（基於 Humanizer-zh，但針對 Threads 調整）

```typescript
// AI 痕跡檢測規則
const AI_PATTERN_RULES = {
  // 適用於 Threads 的規則（從 Humanizer-zh 選取）
  applicable: [
    {
      name: 'AI 詞彙',
      patterns: ['此外', '值得一提', '綜上所述', '不可否認', '顯而易見'],
      action: 'replace',
      severity: 'high'
    },
    {
      name: '句子長度一致',
      check: (text: string) => {
        const sentences = text.split(/[。！？]/);
        const lengths = sentences.map(s => s.length);
        const variance = calculateVariance(lengths);
        return variance < 10; // 變異數太低 = 長度太一致
      },
      action: 'vary_length',
      severity: 'medium'
    },
    {
      name: '轉折詞過度使用',
      check: (text: string) => {
        const transitions = ['但', '然而', '不過', '結果', '沒想到'];
        const count = transitions.reduce((acc, t) => acc + (text.match(new RegExp(t, 'g'))?.length || 0), 0);
        return count > 3; // 超過 3 個轉折詞
      },
      action: 'reduce_transitions',
      severity: 'medium'
    }
  ],
  
  // 不適用於 Threads 的規則（Humanizer-zh 有但我們不用）
  notApplicable: [
    {
      name: '刪除金句',
      reason: 'Threads 爆款需要可截圖金句'
    },
    {
      name: '打破三段式',
      reason: 'Threads 清單型貼文需要結構'
    },
    {
      name: '刪除所有填充短語',
      reason: 'Threads 需要「呼吸感」'
    }
  ]
};
```

#### 3.5.3 自動修正函數

```typescript
// AI 痕跡修正函數
async function humanizeContent(content: string): Promise<string> {
  // 1. 檢測 AI 痕跡
  const detectedPatterns = detectAIPatterns(content);
  
  if (detectedPatterns.length === 0) {
    return content; // 沒有痕跡，直接返回
  }
  
  // 2. 根據檢測結果修正
  let humanizedContent = content;
  
  for (const pattern of detectedPatterns) {
    switch (pattern.action) {
      case 'replace':
        // 替換 AI 詞彙
        humanizedContent = replaceAIWords(humanizedContent, pattern.patterns);
        break;
      case 'vary_length':
        // 變化句子長度
        humanizedContent = await varySentenceLength(humanizedContent);
        break;
      case 'reduce_transitions':
        // 減少轉折詞
        humanizedContent = reduceTransitions(humanizedContent);
        break;
    }
  }
  
  return humanizedContent;
}

// AI 詞彙替換表
const AI_WORD_REPLACEMENTS: Record<string, string[]> = {
  '此外': ['還有', '另外', '對了'],
  '值得一提的是': ['有一點很有趣', '說到這個'],
  '綜上所述': ['所以', '總之'],
  '不可否認': ['確實', '真的'],
  '顯而易見': ['很明顯', '大家都知道'],
  '由此可見': ['所以說', '這就是為什麼'],
  '事實上': ['其實', '說真的'],
  '實際上': ['其實', '說真的'],
  '基本上': ['大概', '差不多'],
};

function replaceAIWords(content: string, patterns: string[]): string {
  let result = content;
  for (const pattern of patterns) {
    const replacements = AI_WORD_REPLACEMENTS[pattern];
    if (replacements) {
      const replacement = replacements[Math.floor(Math.random() * replacements.length)];
      result = result.replace(new RegExp(pattern, 'g'), replacement);
    }
  }
  return result;
}
```

### 3.6 方案五：創作者自主權強化

#### 3.6.1 「規則開關」系統

讓創作者自己決定要啟用哪些規則：

```typescript
interface CreatorPreferences {
  // 爆款模式
  enableViralMode: boolean;
  
  // CTA 設定
  ctaPreference: 'always' | 'sometimes' | 'never';
  
  // 結構設定
  structurePreference: 'strict' | 'loose' | 'free';
  
  // AI 去痕設定
  humanizeLevel: 'aggressive' | 'moderate' | 'minimal';
  
  // 風格學習設定
  styleSource: 'my_posts' | 'examples' | 'none';
}
```

#### 3.6.2 「大膽模式」

對於經驗豐富的創作者，提供「大膽模式」：

```typescript
// 大膽模式：放寬所有規則
const boldModePrompt = `
你是這位創作者的「內心聲音」。

這次，不要有任何限制。
不要擔心字數、結構、CTA。
只要用他的口氣，說出他想說的話。

素材：${material}

直接輸出貼文內容，不要任何解釋。
`;
```

---

## 四、實施路線圖：分階段執行計畫

### 4.1 階段一：提示詞精簡（1-2 天）

| 任務 | 說明 | 優先級 |
|------|------|--------|
| 精簡 SYSTEM_PROMPTS | 從 500 字降至 200 字 | P0 |
| 移除冗餘規則 | 刪除重複的禁止詞彙 | P0 |
| 規則分層 | 區分核心規則 vs 參考規則 | P0 |

**預期效果**：減少 30-40% 的 AI 感

### 4.2 階段二：風格 DNA 系統（3-5 天）

| 任務 | 說明 | 優先級 |
|------|------|--------|
| 設計 UserStyleDNA 結構 | 定義風格特徵欄位 | P1 |
| 實作風格提取函數 | 從用戶貼文提取風格 | P1 |
| 整合到生成流程 | 用風格 DNA 替代 Few-Shot | P1 |

**預期效果**：提升風格一致性，減少「句式複製」感

### 4.3 階段三：創作目標分流（2-3 天）

| 任務 | 說明 | 優先級 |
|------|------|--------|
| 設計目標類型 | 定義 5 種創作目標 | P1 |
| 實作策略選擇 | 根據目標調整提示詞 | P1 |
| 前端 UI 調整 | 讓用戶選擇創作目標 | P2 |

**預期效果**：讓創作者有更多自主權

### 4.4 階段四：AI 去痕後處理（3-4 天）

| 任務 | 說明 | 優先級 |
|------|------|--------|
| 實作檢測函數 | 檢測 AI 痕跡 | P1 |
| 實作修正函數 | 自動修正 AI 痕跡 | P1 |
| 整合到生成流程 | 生成後自動處理 | P1 |

**預期效果**：減少 20-30% 的 AI 感

### 4.5 階段五：創作者自主權（2-3 天）

| 任務 | 說明 | 優先級 |
|------|------|--------|
| 設計偏好設定 | 定義可調整的規則 | P2 |
| 實作規則開關 | 讓用戶自己開關規則 | P2 |
| 實作大膽模式 | 放寬所有規則的模式 | P2 |

**預期效果**：提升創作者滿意度

### 4.6 時程總覽

```
第 1 週：階段一（提示詞精簡）+ 階段二開始（風格 DNA）
第 2 週：階段二完成 + 階段三（創作目標分流）
第 3 週：階段四（AI 去痕後處理）+ 階段五（創作者自主權）
```

**總計**：約 2-3 週

---

## 五、附錄：技術實作細節

### 5.1 精簡後的 SYSTEM_PROMPTS.contentGeneration

```typescript
export const SYSTEM_PROMPTS = {
  contentGeneration: `你是這位創作者的「內心聲音」。

=== 核心原則 ===
用他的口氣說話，用他的方式思考。
不要寫得「比他更好」，要寫得「像他」。

=== 品質底線 ===
- 禁止：「此外」「值得一提」「綜上所述」「希望對你有幫助」
- 禁止：任何髒話和粗俗用語
- 格式：純文字，不用 **、#、- 等符號
- 像聊天，不像教學文章

=== 輸出要求 ===
直接輸出可發布的貼文，不要任何解釋。`
};
```

### 5.2 風格 DNA 提取 Prompt

```typescript
const STYLE_DNA_EXTRACTION_PROMPT = `你是一位風格分析專家。

分析以下貼文，提取作者的「寫作風格」。

注意：你要提取的是「風格」而非「句式」。
- 風格：這個人說話的「感覺」是什麼？
- 句式：這個人用什麼「句子結構」？（這不是我們要的）

請分析以下面向：
1. 情緒風格：溫暖？直接？幽默？反思？
2. 情緒強度：低（平淡）？中（適度）？高（激動）？
3. 句子長度：平均多少字？
4. 常用開頭：這個人通常怎麼開始一篇貼文？
5. 常用轉折：這個人用什麼詞來轉折？
6. 結尾習慣：這個人通常怎麼結束一篇貼文？

請用 JSON 格式回答。`;
```

### 5.3 AI 痕跡檢測函數

```typescript
interface AIPatternResult {
  hasAIPatterns: boolean;
  patterns: {
    name: string;
    severity: 'high' | 'medium' | 'low';
    locations: number[];
  }[];
  score: number; // 0-100，越高越像 AI
}

function detectAIPatterns(content: string): AIPatternResult {
  const patterns: AIPatternResult['patterns'] = [];
  let score = 0;
  
  // 1. 檢測 AI 詞彙
  const aiWords = ['此外', '值得一提', '綜上所述', '不可否認', '顯而易見', '由此可見'];
  for (const word of aiWords) {
    const regex = new RegExp(word, 'g');
    const matches = [...content.matchAll(regex)];
    if (matches.length > 0) {
      patterns.push({
        name: `AI 詞彙：${word}`,
        severity: 'high',
        locations: matches.map(m => m.index!)
      });
      score += 10 * matches.length;
    }
  }
  
  // 2. 檢測句子長度一致性
  const sentences = content.split(/[。！？]/).filter(s => s.trim().length > 0);
  const lengths = sentences.map(s => s.length);
  const variance = calculateVariance(lengths);
  if (variance < 10 && sentences.length > 3) {
    patterns.push({
      name: '句子長度過於一致',
      severity: 'medium',
      locations: []
    });
    score += 15;
  }
  
  // 3. 檢測轉折詞過度使用
  const transitions = ['但', '然而', '不過', '結果', '沒想到'];
  let transitionCount = 0;
  for (const t of transitions) {
    transitionCount += (content.match(new RegExp(t, 'g'))?.length || 0);
  }
  if (transitionCount > 3) {
    patterns.push({
      name: '轉折詞過度使用',
      severity: 'medium',
      locations: []
    });
    score += 10;
  }
  
  // 4. 檢測公式化結尾
  const formulaicEndings = ['你覺得呢', '你怎麼看', '留言告訴我', '歡迎分享'];
  for (const ending of formulaicEndings) {
    if (content.endsWith(ending) || content.includes(ending + '？') || content.includes(ending + '！')) {
      patterns.push({
        name: `公式化結尾：${ending}`,
        severity: 'low',
        locations: [content.lastIndexOf(ending)]
      });
      score += 5;
    }
  }
  
  return {
    hasAIPatterns: patterns.length > 0,
    patterns,
    score: Math.min(score, 100)
  };
}

function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}
```

---

## 結論

本報告提出的優化方案，核心理念是**回歸創作的第一性原理**：

1. **從「幫用戶寫爆款」轉變為「幫用戶說出想說的話」**
2. **從「規則限制」轉變為「風格學習」**
3. **從「一刀切設計」轉變為「目標分流」**
4. **從「被動生成」轉變為「主動去痕」**

這些改變的目標，是讓 AI 生成的內容更像「創作者自己寫的」，而不是「被 AI 優化過的」。

最終，我們希望達到的效果是：

> **讀者看完貼文後，感受到的是「這個人在跟我說話」，而不是「這是一篇被優化過的文案」。**

---

## 參考資料

1. Humanizer-zh：https://github.com/op7418/Humanizer-zh
2. AI-Text-Humanizer-App：https://github.com/DadaNanjesha/AI-Text-Humanizer-App
3. 用戶提供的「第一性原理」分析文件
4. 現有系統的 knowledge-base.ts 和 routers.ts
