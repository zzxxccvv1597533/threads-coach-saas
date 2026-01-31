# 幕創行銷 Threads AI 教練 — AI 去痕優化方案報告

**版本**：v1.0  
**日期**：2026 年 1 月 29 日  
**作者**：Manus AI

---

## 摘要

本報告針對「幕創行銷 Threads AI 教練」系統的 AI 感問題，提出三套完整的優化方案。經過深入分析現有系統架構、Humanizer-zh 開源專案的 24 種 AI 痕跡模式，以及 Threads 平台的爆款特徵，我們發現：**現有系統的 AI 感問題並非源於缺少規則，而是規則過多、過於複雜，導致 LLM 無法全部遵守，反而產生「模板式 AI 感」**。

本報告提供三套方案的詳細實作細節、優缺點分析、程式碼範例，以及具體的實施建議。

---

## 目錄

1. [問題診斷：現有系統的 AI 感來源](#一問題診斷現有系統的-ai-感來源)
2. [方案 A：提示詞精簡優化](#二方案-a提示詞精簡優化)
3. [方案 B：後處理去 AI 感層](#三方案-b後處理去-ai-感層)
4. [方案 C：風格學習強化系統](#四方案-c風格學習強化系統)
5. [Humanizer-zh 規則適用性分析](#五humanizer-zh-規則適用性分析)
6. [實施優先級與時程建議](#六實施優先級與時程建議)
7. [結論與建議](#七結論與建議)

---

## 一、問題診斷：現有系統的 AI 感來源

### 1.1 現有提示詞架構分析

經過分析現有系統的 `generateDraft` 函數，發現系統提示詞包含以下區塊：

| 區塊名稱 | 估計字數 | 功能 |
|----------|----------|------|
| 字數限制（硬性） | ~200 字 | 強制字數範圍 |
| 系統核心提示詞 | ~800 字 | 創作原則、人稱指引 |
| IP 地基 | ~300 字 | 創作者人設 |
| 受眾資訊 | ~200 字 | 目標受眾痛點 |
| 內容支柱 | ~150 字 | 內容主題方向 |
| 用戶風格 | ~200 字 | 口頭禪、語氣特徵 |
| 經營階段策略 | ~100 字 | 軟性權重 |
| 爆款元素提示 | ~150 字 | 開頭/內容/CTA 技巧 |
| 成功因素分析 | ~200 字 | 數據驅動建議 |
| 選題庫參考 | ~100 字 | 結構參考 |
| 群集資訊 | ~100 字 | 主題方向 |
| 四透鏡框架 | ~200 字 | 創作檢核 |
| 翻譯機規則 | ~100 字 | 白話翻譯 |
| Threads 爆款風格 | ~500 字 | 口語化、排版、轉折詞 |
| 語調控制 | ~200 字 | 避免感傷、固定句式 |
| 絕對禁止清單 | ~400 字 | AI 詞彙、結構詞、開頭/結尾規則 |
| 數據驅動開頭規則 | ~200 字 | 指定開頭模式 |
| 重要指示 | ~100 字 | 精簡優先、輸出格式 |

**總計：約 4,000 字的系統提示詞**

### 1.2 問題根源分析

根據分析，現有系統的 AI 感問題來自以下四個根源：

#### 問題 1：提示詞過長，LLM 選擇性執行

當提示詞超過 2,000 字時，LLM 會開始「選擇性遵守」規則。根據 OpenAI 的研究，LLM 對於提示詞中間部分的遵守率會顯著下降（稱為「Lost in the Middle」現象）[1]。

> **影響**：系統花大量篇幅定義「禁止 AI 詞彙」，但因為位於提示詞中後段，LLM 可能忽略這些規則。

#### 問題 2：規則互相矛盾

現有提示詞中存在多處矛盾：

| 規則 A | 規則 B | 矛盾點 |
|--------|--------|--------|
| 「像在 LINE 跟朋友聊天」 | 「必須有結構：開頭→轉折→啟發」 | 朋友聊天不會有固定結構 |
| 「省略主詞，例如『超累』」 | 「優先使用『我』開頭」 | 省略主詞 vs 使用「我」 |
| 「每篇開頭都要不一樣」 | 「本次指定開頭模式：冠號斷言」 | 多樣化 vs 指定模式 |
| 「不要每句都加『真的』」 | Few-Shot 範例中有「真的」 | 禁止 vs 範例示範 |

#### 問題 3：過度框架化導致「模板感」

系統注入了太多框架：
- 四透鏡框架（心法/人設/結構/轉化）
- 英雄旅程架構
- 爆款元素提示
- 數據驅動開頭規則
- 成功因素分析

當 LLM 試圖同時滿足所有框架時，輸出會變得「公式化」，每篇都有類似的結構。

#### 問題 4：Few-Shot 範例導致「模仿」而非「創作」

系統注入了多個 Few-Shot 範例，但這些範例可能導致 LLM 直接模仿句式，而非學習風格。

### 1.3 兩種不同的 AI 感

理解這一點非常重要：**Humanizer-zh 解決的是「報告式 AI 感」，而您的系統需要解決的是「模板式 AI 感」**。

| 類型 | 特徵 | 來源 | 解決方式 |
|------|------|------|----------|
| **報告式 AI 感** | 過度正式、學術語言、宣傳語氣 | LLM 的預訓練偏好 | Humanizer-zh 的 24 種模式 |
| **模板式 AI 感** | 每篇結構相似、開頭模式固定、CTA 重複 | 過度框架化的提示詞 | 精簡提示詞、增加隨機性 |

---

## 二、方案 A：提示詞精簡優化

### 2.1 方案概述

將現有 4,000 字的提示詞精簡到 800-1,000 字，只保留最核心的規則，讓 LLM 有更大的創作空間。

### 2.2 精簡原則

| 保留 | 刪除 | 原因 |
|------|------|------|
| 用戶風格（口頭禪、語氣） | 四透鏡框架 | 風格是差異化核心 |
| 字數限制（簡化版） | 成功因素分析 | 字數是硬性需求 |
| 禁止 AI 詞彙（精簡版） | 群集資訊 | 去 AI 感核心 |
| 內容類型結構 | 經營階段策略 | 結構是基本需求 |
| 核心創作原則（3 條） | 選題庫參考 | 原則太多會失焦 |

### 2.3 精簡後的提示詞範本

```typescript
const SIMPLIFIED_SYSTEM_PROMPT = `你是這位創作者本人，用他的口氣說話。

=== 創作者風格（必須展現） ===
${userStyleContext}

=== 字數限制 ===
${wordLimit.min}-${wordLimit.max} 字，超過就精簡。

=== 核心原則（只有三條） ===
1. 像傳訊息給朋友，不是寫文章
2. 有轉折、有情緒，不是流水帳
3. 結尾引導互動，但不要太刻意

=== 禁止（違反就重寫） ===
- 「讓我們」「今天要分享」「希望對你有幫助」
- 「首先」「其次」「最後」
- 「在這個快節奏的時代」

=== 輸出 ===
直接輸出貼文，不要解釋。`;
```

### 2.4 實作細節

#### 步驟 1：建立精簡提示詞函數

```typescript
// server/prompts/simplified-prompt.ts

export function buildSimplifiedPrompt(params: {
  userStyle: string;
  wordLimit: { min: number; max: number };
  contentType: string;
  material: string;
}): string {
  const { userStyle, wordLimit, contentType, material } = params;
  
  // 根據內容類型選擇結構提示
  const structureHint = getStructureHint(contentType);
  
  return `你是這位創作者本人，用他的口氣說話。

=== 創作者風格 ===
${userStyle || '自然、有溫度、像朋友聊天'}

=== 字數 ===
${wordLimit.min}-${wordLimit.max} 字

=== 結構提示 ===
${structureHint}

=== 禁止 ===
「讓我們」「今天要分享」「希望對你有幫助」「首先」「其次」「最後」

=== 素材 ===
${material}

直接輸出貼文。`;
}

function getStructureHint(contentType: string): string {
  const hints: Record<string, string> = {
    story: '有時間、有人物、有轉折、有感悟',
    knowledge: '開頭吸引、分點清晰、結尾行動建議',
    viewpoint: '觀點明確、有支撐、引發討論',
    casual: '輕鬆、有情緒、引導互動',
  };
  return hints[contentType] || '自然流暢、有轉折';
}
```

#### 步驟 2：A/B 測試機制

```typescript
// server/utils/ab-test.ts

export function shouldUseSimplifiedPrompt(userId: string): boolean {
  // 50% 的用戶使用精簡版提示詞
  const hash = hashCode(userId);
  return hash % 2 === 0;
}

// 在 generateDraft 中使用
const useSimplified = shouldUseSimplifiedPrompt(ctx.user.id);
const systemPrompt = useSimplified 
  ? buildSimplifiedPrompt({ userStyle, wordLimit, contentType, material })
  : buildFullPrompt({ /* 現有邏輯 */ });
```

### 2.5 優缺點分析

| 面向 | 優點 | 缺點 |
|------|------|------|
| **效果** | 減少「模板感」，輸出更自然 | 可能失去某些「爆款技巧」 |
| **成本** | 零成本，只需修改提示詞 | 需要 A/B 測試驗證效果 |
| **時間** | 2-3 小時可完成 | 需要持續調整 |
| **風險** | 低風險，可隨時回滾 | 輸出品質可能不穩定 |
| **維護** | 提示詞更容易維護 | 需要重新定義「好的輸出」標準 |

### 2.6 預期效果

| 指標 | 預期變化 | 說明 |
|------|----------|------|
| AI 感評分 | 降低 30-50% | 減少模板化結構 |
| 輸出多樣性 | 提升 40-60% | LLM 有更大創作空間 |
| 用戶滿意度 | 需 A/B 測試 | 可能因人而異 |
| 爆款率 | 需 A/B 測試 | 可能略降，但更真實 |

---

## 三、方案 B：後處理去 AI 感層

### 3.1 方案概述

在 LLM 生成內容後，增加一個「後處理層」，自動檢測並修正 AI 痕跡。這是 Humanizer-zh 的核心思路。

### 3.2 架構設計

```
用戶輸入 → LLM 生成 → AI 痕跡檢測 → 自動修正 → 輸出
                         ↓
                    檢測報告（可選）
```

### 3.3 實作細節

#### 模組 1：AI 詞彙替換器

```typescript
// server/humanizer/word-replacer.ts

// 基於 Humanizer-zh 的 AI 詞彙清單，針對 Threads 風格調整
export const AI_WORD_REPLACEMENTS: Record<string, string[]> = {
  // 連接詞替換
  '此外': ['還有', '另外', '對了'],
  '然而': ['但', '不過', '結果'],
  '因此': ['所以', '就', ''],
  '值得注意的是': ['重點是', '關鍵是', ''],
  '總而言之': ['總之', '簡單說', ''],
  '換句話說': ['就是說', '意思是', ''],
  
  // 強調詞替換
  '至關重要': ['很重要', '超重要', '關鍵'],
  '極其重要': ['很重要', '超重要', ''],
  '非常重要': ['很重要', '蠻重要', ''],
  '深入探討': ['聊聊', '說說', '講講'],
  '深刻的': ['很深的', '蠻深的', ''],
  
  // 宣傳語言替換
  '充滿活力': ['很有活力', '蠻有精神', ''],
  '令人印象深刻': ['印象很深', '蠻厲害', ''],
  '獨特的': ['特別的', '不一樣的', ''],
  
  // 開場白替換
  '今天要分享': ['想說', '來聊', ''],
  '讓我們': ['我們', '一起', ''],
  '親愛的': ['', '', ''],
  
  // 結尾語替換
  '希望對你有幫助': ['', '', ''],
  '希望這篇文章': ['', '', ''],
  '加油！': ['', '', ''],
};

export function replaceAIWords(text: string): string {
  let result = text;
  
  for (const [aiWord, replacements] of Object.entries(AI_WORD_REPLACEMENTS)) {
    if (result.includes(aiWord)) {
      // 隨機選擇一個替換詞（包括空字串，表示直接刪除）
      const replacement = replacements[Math.floor(Math.random() * replacements.length)];
      result = result.replace(new RegExp(aiWord, 'g'), replacement);
    }
  }
  
  return result.trim();
}
```

#### 模組 2：節奏檢測器

```typescript
// server/humanizer/rhythm-checker.ts

export interface RhythmAnalysis {
  isMonotonous: boolean;
  consecutiveSameLengthCount: number;
  suggestions: string[];
}

export function analyzeRhythm(text: string): RhythmAnalysis {
  // 分割句子（考慮中文標點）
  const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0);
  
  if (sentences.length < 3) {
    return { isMonotonous: false, consecutiveSameLengthCount: 0, suggestions: [] };
  }
  
  // 計算句子長度
  const lengths = sentences.map(s => s.trim().length);
  
  // 檢測連續相同長度（允許 ±5 字的誤差）
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  
  for (let i = 1; i < lengths.length; i++) {
    if (Math.abs(lengths[i] - lengths[i - 1]) <= 5) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }
  
  const isMonotonous = maxConsecutive >= 3;
  const suggestions: string[] = [];
  
  if (isMonotonous) {
    suggestions.push('連續三句以上長度相近，建議打斷其中一句');
  }
  
  // 檢測是否缺少短句
  const shortSentences = lengths.filter(l => l <= 10).length;
  if (shortSentences < lengths.length * 0.2) {
    suggestions.push('短句（10 字以內）比例過低，建議增加節奏變化');
  }
  
  return {
    isMonotonous,
    consecutiveSameLengthCount: maxConsecutive,
    suggestions,
  };
}
```

#### 模組 3：結構檢測器

```typescript
// server/humanizer/structure-checker.ts

export interface StructureAnalysis {
  hasTemplateOpening: boolean;
  hasTemplateCTA: boolean;
  hasThreePartStructure: boolean;
  detectedPatterns: string[];
}

// 模板化開頭模式
const TEMPLATE_OPENINGS = [
  /^你有沒有(過|想過)/,
  /^你是不是也/,
  /^今天(想|要)(跟大家)?分享/,
  /^最近很多人問我/,
  /^其實(呢)?/,
  /^我覺得/,
];

// 模板化 CTA 模式
const TEMPLATE_CTAS = [
  /你(們)?覺得呢[？?]?$/,
  /你怎麼看[？?]?$/,
  /留言告訴我[！!]?$/,
  /你中了幾個[？?]?$/,
  /有沒有同感[？?]?$/,
];

export function analyzeStructure(text: string): StructureAnalysis {
  const detectedPatterns: string[] = [];
  
  // 檢測模板化開頭
  const firstLine = text.split('\n')[0];
  const hasTemplateOpening = TEMPLATE_OPENINGS.some(pattern => {
    if (pattern.test(firstLine)) {
      detectedPatterns.push(`模板開頭：${firstLine.slice(0, 20)}...`);
      return true;
    }
    return false;
  });
  
  // 檢測模板化 CTA
  const lastLine = text.split('\n').filter(l => l.trim()).pop() || '';
  const hasTemplateCTA = TEMPLATE_CTAS.some(pattern => {
    if (pattern.test(lastLine)) {
      detectedPatterns.push(`模板 CTA：${lastLine.slice(-20)}`);
      return true;
    }
    return false;
  });
  
  // 檢測三段式結構
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  const hasThreePartStructure = paragraphs.length === 3;
  if (hasThreePartStructure) {
    detectedPatterns.push('三段式結構');
  }
  
  return {
    hasTemplateOpening,
    hasTemplateCTA,
    hasThreePartStructure,
    detectedPatterns,
  };
}
```

#### 模組 4：整合的 Humanizer 服務

```typescript
// server/humanizer/index.ts

import { replaceAIWords } from './word-replacer';
import { analyzeRhythm, RhythmAnalysis } from './rhythm-checker';
import { analyzeStructure, StructureAnalysis } from './structure-checker';

export interface HumanizerResult {
  originalText: string;
  humanizedText: string;
  aiScore: number; // 0-100，越低越好
  rhythmAnalysis: RhythmAnalysis;
  structureAnalysis: StructureAnalysis;
  appliedFixes: string[];
}

export async function humanizeText(text: string): Promise<HumanizerResult> {
  const appliedFixes: string[] = [];
  let humanizedText = text;
  
  // 1. AI 詞彙替換
  const beforeReplace = humanizedText;
  humanizedText = replaceAIWords(humanizedText);
  if (humanizedText !== beforeReplace) {
    appliedFixes.push('AI 詞彙替換');
  }
  
  // 2. 節奏分析
  const rhythmAnalysis = analyzeRhythm(humanizedText);
  
  // 3. 結構分析
  const structureAnalysis = analyzeStructure(humanizedText);
  
  // 4. 計算 AI 感評分
  const aiScore = calculateAIScore(rhythmAnalysis, structureAnalysis, humanizedText);
  
  return {
    originalText: text,
    humanizedText,
    aiScore,
    rhythmAnalysis,
    structureAnalysis,
    appliedFixes,
  };
}

function calculateAIScore(
  rhythm: RhythmAnalysis,
  structure: StructureAnalysis,
  text: string
): number {
  let score = 0;
  
  // 節奏單調 +20 分
  if (rhythm.isMonotonous) score += 20;
  
  // 模板開頭 +25 分
  if (structure.hasTemplateOpening) score += 25;
  
  // 模板 CTA +15 分
  if (structure.hasTemplateCTA) score += 15;
  
  // 三段式結構 +10 分
  if (structure.hasThreePartStructure) score += 10;
  
  // AI 詞彙檢測（每個 +5 分，最多 30 分）
  const aiWordCount = countAIWords(text);
  score += Math.min(aiWordCount * 5, 30);
  
  return Math.min(score, 100);
}

function countAIWords(text: string): number {
  const AI_WORDS = ['此外', '然而', '因此', '值得注意', '至關重要', '深入探討'];
  return AI_WORDS.filter(word => text.includes(word)).length;
}
```

#### 模組 5：LLM 輔助修正（可選）

```typescript
// server/humanizer/llm-fix.ts

import { invokeLLM } from '../_core/llm';

export async function llmAssistedFix(
  text: string,
  issues: string[]
): Promise<string> {
  if (issues.length === 0) return text;
  
  const prompt = `請修正以下文字的 AI 感問題，保持原意但讓它更像人寫的。

問題：
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

原文：
${text}

修正後（直接輸出，不要解釋）：`;

  const response = await invokeLLM({
    messages: [
      { role: 'system', content: '你是文字編輯，專門把 AI 感的文字改成更自然的人類寫作風格。' },
      { role: 'user', content: prompt },
    ],
  });
  
  return response.choices[0].message.content || text;
}
```

### 3.4 API 整合

```typescript
// 在 server/routers.ts 中新增

import { humanizeText } from './humanizer';

// 新增 humanize 程序
humanize: protectedProcedure
  .input(z.object({
    text: z.string(),
    autoFix: z.boolean().default(true),
  }))
  .mutation(async ({ input }) => {
    const result = await humanizeText(input.text);
    
    // 如果 AI 感評分過高且開啟自動修正，使用 LLM 輔助修正
    if (input.autoFix && result.aiScore > 50) {
      const issues = [
        ...result.rhythmAnalysis.suggestions,
        ...result.structureAnalysis.detectedPatterns,
      ];
      result.humanizedText = await llmAssistedFix(result.humanizedText, issues);
    }
    
    return result;
  }),
```

### 3.5 優缺點分析

| 面向 | 優點 | 缺點 |
|------|------|------|
| **效果** | 可量化的 AI 感評分 | 規則式替換可能不夠智慧 |
| **成本** | 基礎版零成本，LLM 輔助版有 API 成本 | LLM 輔助會增加延遲和成本 |
| **時間** | 基礎版 4-6 小時，完整版 8-10 小時 | 需要持續維護詞彙清單 |
| **風險** | 中等風險，可能改變原意 | 過度修正可能失去風格 |
| **維護** | 詞彙清單需定期更新 | 規則可能過時 |

### 3.6 預期效果

| 指標 | 預期變化 | 說明 |
|------|----------|------|
| AI 感評分 | 降低 40-60% | 直接針對 AI 痕跡修正 |
| 輸出一致性 | 提升 | 有明確的修正規則 |
| 用戶滿意度 | 需測試 | 可能因過度修正而降低 |
| 處理時間 | 增加 0.5-2 秒 | 後處理需要時間 |

---

## 四、方案 C：風格學習強化系統

### 4.1 方案概述

這是最長期、最有效的方案。透過分析用戶的歷史貼文，提取「風格特徵」而非「句式」，讓 LLM 學習用戶的真實風格。

### 4.2 架構設計

```
用戶歷史貼文 → 風格分析 → 風格向量 → 風格提示詞 → LLM 生成
                  ↓
            風格特徵庫
            - 句子長度分布
            - 常用詞彙
            - 情緒傾向
            - 結構偏好
```

### 4.3 實作細節

#### 模組 1：風格分析器

```typescript
// server/style-analyzer/index.ts

export interface StyleProfile {
  // 句子特徵
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  shortSentenceRatio: number; // 10 字以內
  
  // 詞彙特徵
  topWords: string[];
  uniqueWordRatio: number;
  emojiUsage: 'none' | 'low' | 'medium' | 'high';
  
  // 結構特徵
  avgParagraphCount: number;
  preferredOpeningPatterns: string[];
  preferredCTAPatterns: string[];
  
  // 情緒特徵
  emotionTone: 'warm' | 'professional' | 'casual' | 'energetic';
  
  // 口頭禪
  catchphrases: string[];
}

export async function analyzeUserStyle(posts: string[]): Promise<StyleProfile> {
  if (posts.length < 5) {
    throw new Error('需要至少 5 篇貼文才能分析風格');
  }
  
  // 句子分析
  const allSentences = posts.flatMap(p => 
    p.split(/[。！？\n]/).filter(s => s.trim().length > 0)
  );
  const sentenceLengths = allSentences.map(s => s.trim().length);
  
  const avgSentenceLength = average(sentenceLengths);
  const sentenceLengthVariance = variance(sentenceLengths);
  const shortSentenceRatio = sentenceLengths.filter(l => l <= 10).length / sentenceLengths.length;
  
  // 詞彙分析
  const allWords = posts.join('').split(/[\s,，。！？、\n]/);
  const wordFreq = countFrequency(allWords);
  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
  
  // Emoji 使用分析
  const emojiCount = posts.join('').match(/[\u{1F600}-\u{1F64F}]/gu)?.length || 0;
  const totalLength = posts.join('').length;
  const emojiRatio = emojiCount / totalLength;
  const emojiUsage = emojiRatio < 0.01 ? 'none' 
    : emojiRatio < 0.02 ? 'low'
    : emojiRatio < 0.05 ? 'medium' 
    : 'high';
  
  // 結構分析
  const paragraphCounts = posts.map(p => p.split('\n\n').filter(s => s.trim()).length);
  const avgParagraphCount = average(paragraphCounts);
  
  // 開頭模式分析
  const openings = posts.map(p => p.split('\n')[0].slice(0, 20));
  const preferredOpeningPatterns = extractPatterns(openings);
  
  // CTA 模式分析
  const ctas = posts.map(p => {
    const lines = p.split('\n').filter(l => l.trim());
    return lines[lines.length - 1]?.slice(-30) || '';
  });
  const preferredCTAPatterns = extractPatterns(ctas);
  
  // 口頭禪提取（出現在 30% 以上貼文中的短語）
  const catchphrases = extractCatchphrases(posts);
  
  // 情緒傾向（使用 LLM 分析）
  const emotionTone = await analyzeEmotionTone(posts.slice(0, 5));
  
  return {
    avgSentenceLength,
    sentenceLengthVariance,
    shortSentenceRatio,
    topWords,
    uniqueWordRatio: new Set(allWords).size / allWords.length,
    emojiUsage,
    avgParagraphCount,
    preferredOpeningPatterns,
    preferredCTAPatterns,
    emotionTone,
    catchphrases,
  };
}

// 輔助函數
function average(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[]): number {
  const avg = average(arr);
  return arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
}

function countFrequency(arr: string[]): Record<string, number> {
  return arr.reduce((acc, word) => {
    if (word.length >= 2) {
      acc[word] = (acc[word] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
}

function extractPatterns(texts: string[]): string[] {
  // 簡化版：提取常見的開頭/結尾模式
  const patterns: Record<string, number> = {};
  texts.forEach(text => {
    // 提取前 5 個字作為模式
    const pattern = text.slice(0, 5);
    patterns[pattern] = (patterns[pattern] || 0) + 1;
  });
  return Object.entries(patterns)
    .filter(([_, count]) => count >= texts.length * 0.2)
    .map(([pattern]) => pattern);
}

function extractCatchphrases(posts: string[]): string[] {
  // 提取 2-4 字的常見短語
  const phrases: Record<string, number> = {};
  posts.forEach(post => {
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i <= post.length - len; i++) {
        const phrase = post.slice(i, i + len);
        if (!/[\s\n。！？，、]/.test(phrase)) {
          phrases[phrase] = (phrases[phrase] || 0) + 1;
        }
      }
    }
  });
  
  const threshold = posts.length * 0.3;
  return Object.entries(phrases)
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

async function analyzeEmotionTone(posts: string[]): Promise<'warm' | 'professional' | 'casual' | 'energetic'> {
  const response = await invokeLLM({
    messages: [
      { 
        role: 'system', 
        content: '分析以下貼文的整體情緒傾向，只回答一個詞：warm（溫暖）、professional（專業）、casual（隨性）、energetic（有活力）' 
      },
      { role: 'user', content: posts.join('\n\n---\n\n') },
    ],
  });
  
  const tone = response.choices[0].message.content?.toLowerCase() || 'warm';
  if (['warm', 'professional', 'casual', 'energetic'].includes(tone)) {
    return tone as 'warm' | 'professional' | 'casual' | 'energetic';
  }
  return 'warm';
}
```

#### 模組 2：風格提示詞生成器

```typescript
// server/style-analyzer/prompt-generator.ts

import { StyleProfile } from './index';

export function generateStylePrompt(profile: StyleProfile): string {
  const parts: string[] = [];
  
  // 句子長度指引
  parts.push(`【句子長度】平均 ${Math.round(profile.avgSentenceLength)} 字，${
    profile.shortSentenceRatio > 0.3 ? '多用短句' : '長短句交錯'
  }`);
  
  // Emoji 使用指引
  const emojiGuide = {
    none: '不使用 Emoji',
    low: '偶爾使用 Emoji（1-2 個）',
    medium: '適度使用 Emoji（3-5 個）',
    high: '大量使用 Emoji',
  };
  parts.push(`【Emoji】${emojiGuide[profile.emojiUsage]}`);
  
  // 情緒傾向
  const toneGuide = {
    warm: '溫暖、有同理心、像朋友',
    professional: '專業、有見地、但不冷漠',
    casual: '隨性、輕鬆、不拘小節',
    energetic: '有活力、積極、帶動氣氛',
  };
  parts.push(`【語氣】${toneGuide[profile.emotionTone]}`);
  
  // 口頭禪（只列出前 5 個，避免過度使用）
  if (profile.catchphrases.length > 0) {
    parts.push(`【口頭禪】可適度使用：${profile.catchphrases.slice(0, 5).join('、')}（不要每篇都用）`);
  }
  
  // 結構偏好
  parts.push(`【段落】通常 ${Math.round(profile.avgParagraphCount)} 段`);
  
  return parts.join('\n');
}
```

#### 模組 3：風格一致性檢測

```typescript
// server/style-analyzer/consistency-checker.ts

import { StyleProfile } from './index';

export interface ConsistencyScore {
  overall: number; // 0-100
  details: {
    sentenceLength: number;
    emojiUsage: number;
    tone: number;
  };
  suggestions: string[];
}

export function checkStyleConsistency(
  generatedText: string,
  profile: StyleProfile
): ConsistencyScore {
  const suggestions: string[] = [];
  
  // 檢查句子長度
  const sentences = generatedText.split(/[。！？\n]/).filter(s => s.trim().length > 0);
  const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
  const lengthDiff = Math.abs(avgLength - profile.avgSentenceLength);
  const sentenceLengthScore = Math.max(0, 100 - lengthDiff * 5);
  
  if (lengthDiff > 10) {
    suggestions.push(`句子長度偏差過大（生成 ${Math.round(avgLength)} 字 vs 風格 ${Math.round(profile.avgSentenceLength)} 字）`);
  }
  
  // 檢查 Emoji 使用
  const emojiCount = (generatedText.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
  const expectedEmoji = { none: 0, low: 1.5, medium: 4, high: 8 };
  const emojiDiff = Math.abs(emojiCount - expectedEmoji[profile.emojiUsage]);
  const emojiScore = Math.max(0, 100 - emojiDiff * 15);
  
  if (emojiDiff > 3) {
    suggestions.push(`Emoji 使用量與風格不符（生成 ${emojiCount} 個 vs 預期 ${expectedEmoji[profile.emojiUsage]} 個）`);
  }
  
  // 語氣檢測（簡化版）
  const toneScore = 80; // 需要 LLM 輔助才能準確評估
  
  const overall = (sentenceLengthScore + emojiScore + toneScore) / 3;
  
  return {
    overall,
    details: {
      sentenceLength: sentenceLengthScore,
      emojiUsage: emojiScore,
      tone: toneScore,
    },
    suggestions,
  };
}
```

### 4.4 資料庫 Schema 擴展

```typescript
// drizzle/schema.ts 新增

export const userStyleProfiles = mysqlTable('user_style_profiles', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull(),
  
  // 句子特徵
  avgSentenceLength: float('avg_sentence_length'),
  sentenceLengthVariance: float('sentence_length_variance'),
  shortSentenceRatio: float('short_sentence_ratio'),
  
  // 詞彙特徵
  topWords: json('top_words').$type<string[]>(),
  uniqueWordRatio: float('unique_word_ratio'),
  emojiUsage: varchar('emoji_usage', { length: 20 }),
  
  // 結構特徵
  avgParagraphCount: float('avg_paragraph_count'),
  preferredOpeningPatterns: json('preferred_opening_patterns').$type<string[]>(),
  preferredCTAPatterns: json('preferred_cta_patterns').$type<string[]>(),
  
  // 情緒特徵
  emotionTone: varchar('emotion_tone', { length: 20 }),
  
  // 口頭禪
  catchphrases: json('catchphrases').$type<string[]>(),
  
  // 分析來源
  analyzedPostCount: int('analyzed_post_count'),
  lastAnalyzedAt: timestamp('last_analyzed_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
```

### 4.5 優缺點分析

| 面向 | 優點 | 缺點 |
|------|------|------|
| **效果** | 最能保持用戶風格一致性 | 需要足夠的歷史數據 |
| **成本** | 一次分析，多次使用 | 初始分析需要 LLM 成本 |
| **時間** | 完整實作需 2-3 週 | 需要持續迭代優化 |
| **風險** | 低風險，基於用戶真實數據 | 風格可能過度固化 |
| **維護** | 需定期重新分析 | 用戶風格變化時需更新 |

### 4.6 預期效果

| 指標 | 預期變化 | 說明 |
|------|----------|------|
| AI 感評分 | 降低 50-70% | 基於用戶真實風格 |
| 風格一致性 | 提升 60-80% | 有量化的風格指標 |
| 用戶滿意度 | 顯著提升 | 「像我自己寫的」 |
| 輸出多樣性 | 保持 | 風格一致但內容多樣 |

---

## 五、Humanizer-zh 規則適用性分析

### 5.1 完整適用性對照表

| 編號 | Humanizer-zh 規則 | Threads 適用性 | 說明 |
|------|-------------------|----------------|------|
| 1 | 過度強調意義 | ✅ 適用 | Threads 不需要宏大敘事 |
| 2 | 過度強調知名度 | ✅ 適用 | 不需要引用權威 |
| 3 | -ing 結尾膚淺分析 | ⚠️ 部分適用 | 中文較少此問題 |
| 4 | 宣傳式語言 | ✅ 適用 | Threads 需要真實感 |
| 5 | 模糊歸因 | ✅ 適用 | 不需要「專家認為」 |
| 6 | 挑戰與展望部分 | ✅ 適用 | Threads 不需要此結構 |
| 7 | AI 詞彙 | ✅ 適用 | 核心規則 |
| 8 | 繫動詞迴避 | ⚠️ 部分適用 | 中文影響較小 |
| 9 | 否定式排比 | ✅ 適用 | 「不僅...而且」太 AI |
| 10 | 三段式法則 | ❌ 不適用 | Threads 清單型需要 |
| 11 | 同義詞循環 | ✅ 適用 | 重複用詞更自然 |
| 12 | 虛假範圍 | ✅ 適用 | 「從 X 到 Y」太刻意 |
| 13 | 破折號過度使用 | ✅ 適用 | 中文應減少破折號 |
| 14 | 粗體過度使用 | ✅ 適用 | Threads 不支援粗體 |
| 15 | 內聯標題列表 | ✅ 適用 | 太結構化 |
| 16 | 標題大寫 | ❌ 不適用 | 中文無此問題 |
| 17 | 表情符號 | ⚠️ 部分適用 | Threads 可適度使用 |
| 18 | 彎引號 | ⚠️ 部分適用 | 影響較小 |
| 19 | 協作交流痕跡 | ✅ 適用 | 「希望對你有幫助」 |
| 20 | 知識截止免責 | ✅ 適用 | 不應出現 |
| 21 | 諂媚語氣 | ✅ 適用 | 太討好不自然 |
| 22 | 填充短語 | ⚠️ 部分適用 | Threads 需要呼吸感 |
| 23 | 過度限定 | ✅ 適用 | 直接陳述更好 |
| 24 | 通用積極結論 | ✅ 適用 | 結尾要具體 |

### 5.2 建議整合的規則

基於上述分析，建議整合以下 Humanizer-zh 規則：

#### 高優先級（必須整合）

1. **AI 詞彙替換**（規則 7）
2. **協作交流痕跡移除**（規則 19）
3. **否定式排比避免**（規則 9）
4. **同義詞循環避免**（規則 11）
5. **諂媚語氣避免**（規則 21）

#### 中優先級（建議整合）

6. **宣傳式語言避免**（規則 4）
7. **模糊歸因避免**（規則 5）
8. **破折號減少**（規則 13）
9. **過度限定避免**（規則 23）
10. **通用積極結論避免**（規則 24）

#### 低優先級（可選整合）

11. **虛假範圍避免**（規則 12）
12. **填充短語精簡**（規則 22，需謹慎）

### 5.3 不建議整合的規則

| 規則 | 原因 |
|------|------|
| 三段式法則（規則 10） | Threads 清單型貼文需要 |
| 刪除金句（核心規則 5） | Threads 爆款需要可截圖金句 |
| 刪除所有填充短語（規則 22） | Threads 需要「呼吸感」 |
| 表情符號限制（規則 17） | Threads 可適度使用 Emoji |

---

## 六、實施優先級與時程建議

### 6.1 實施路線圖

```
第 1 週：方案 A（提示詞精簡）
    ↓
第 2-3 週：方案 B（後處理層）
    ↓
第 4-6 週：方案 C（風格學習）
    ↓
持續迭代優化
```

### 6.2 詳細時程

| 階段 | 任務 | 時間 | 優先級 |
|------|------|------|--------|
| **Phase 1** | 提示詞精簡 | 2-3 小時 | P0 |
| | A/B 測試機制 | 2 小時 | P0 |
| | 效果監測 | 1 週 | P0 |
| **Phase 2** | AI 詞彙替換器 | 3 小時 | P1 |
| | 節奏檢測器 | 2 小時 | P1 |
| | 結構檢測器 | 2 小時 | P1 |
| | API 整合 | 2 小時 | P1 |
| | LLM 輔助修正（可選） | 3 小時 | P2 |
| **Phase 3** | 風格分析器 | 8 小時 | P2 |
| | 風格提示詞生成 | 4 小時 | P2 |
| | 一致性檢測 | 4 小時 | P2 |
| | 資料庫擴展 | 2 小時 | P2 |
| | 前端整合 | 6 小時 | P2 |

### 6.3 成本估算

| 方案 | 開發成本 | 運營成本（每月） | ROI |
|------|----------|------------------|-----|
| **方案 A** | 0（純提示詞修改） | 0 | 高 |
| **方案 B（基礎版）** | 0（純規則） | 0 | 中高 |
| **方案 B（LLM 輔助）** | 0 | ~$10-30（API 費用） | 中 |
| **方案 C** | 0 | ~$5-15（初始分析） | 高（長期） |

---

## 七、結論與建議

### 7.1 核心發現

1. **現有系統的 AI 感問題不是「缺少規則」，而是「規則太多」**。4,000 字的提示詞導致 LLM 選擇性執行，反而產生「模板式 AI 感」。

2. **Humanizer-zh 的規則針對「報告式 AI 感」設計**，約 60% 的規則適用於 Threads，但「刪除金句」「打破三段式」等規則不適用。

3. **最有效的解法是「精簡提示詞 + 選擇性整合 Humanizer-zh 規則」**，而非全盤採用。

### 7.2 建議實施順序

| 順序 | 方案 | 預期效果 | 風險 |
|------|------|----------|------|
| 1 | 方案 A：提示詞精簡 | 減少 30-50% AI 感 | 低 |
| 2 | 方案 B：AI 詞彙替換 | 減少 20-30% AI 感 | 低 |
| 3 | 方案 B：節奏/結構檢測 | 提供量化指標 | 低 |
| 4 | 方案 C：風格學習 | 長期最佳效果 | 中 |

### 7.3 最終建議

**立即行動**：實施方案 A（提示詞精簡），這是最快見效、零成本、低風險的方案。

**短期目標**：在方案 A 的基礎上，整合方案 B 的 AI 詞彙替換和節奏檢測，提供量化的 AI 感評分。

**長期目標**：實施方案 C（風格學習），建立每位用戶的風格檔案，讓生成內容真正「像用戶自己寫的」。

---

## 附錄

### A. Humanizer-zh 24 種模式完整清單

詳見 `/reports/humanizer-zh-24-patterns.md`

### B. AI 詞彙替換完整清單

詳見本報告「方案 B」章節的 `AI_WORD_REPLACEMENTS` 物件。

### C. 參考資料

[1] Liu, N. F., et al. (2023). "Lost in the Middle: How Language Models Use Long Contexts." arXiv:2307.03172.

[2] Humanizer-zh GitHub Repository: https://github.com/op7418/Humanizer-zh

[3] AI-Text-Humanizer-App GitHub Repository: https://github.com/DadaNanjesha/AI-Text-Humanizer-App

---

*本報告由 Manus AI 生成，基於對現有系統架構和開源專案的深入分析。*
