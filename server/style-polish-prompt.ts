/**
 * stylePolish 專用提示詞模組
 * 
 * 核心目標：學習用戶風格，只改語氣，不改內容/結構/字數
 * 
 * 與 refineDraft 的差異：
 * - refineDraft：根據用戶指令修改內容
 * - stylePolish：自動套用用戶風格，不需要指令
 */

export interface StylePolishContext {
  // 用戶風格資料
  catchphrases: string[];        // 口頭禪列表
  speakingStyle: string;         // 說話風格描述
  toneStyle: string;             // 語氣風格
  commonPhrases: string[];       // 常用句式
  emotionWords: string[];        // 情緒表達詞彙
  
  // 用戶爆款範例（Few-Shot）
  viralExamples: string[];       // 用戶的爆款貼文（最多 3 篇）
  
  // 原文資訊
  originalContent: string;       // 原始內容
  originalWordCount: number;     // 原始字數
  originalParagraphCount: number; // 原始段落數
}

/**
 * 建立 stylePolish 系統提示詞
 * 
 * 設計原則：
 * 1. 只改語氣，不改內容
 * 2. 字數誤差 ±10% 以內
 * 3. 段落結構保持不變
 * 4. 核心觀點不能改變
 */
export function buildStylePolishSystemPrompt(context: StylePolishContext): string {
  const { 
    catchphrases, 
    speakingStyle, 
    toneStyle,
    commonPhrases,
    emotionWords,
    viralExamples,
    originalWordCount,
    originalParagraphCount
  } = context;

  // 計算字數容許範圍
  const minWordCount = Math.floor(originalWordCount * 0.9);
  const maxWordCount = Math.ceil(originalWordCount * 1.1);

  // 建立風格參考區塊
  const styleReference = buildStyleReference(context);

  return `你是一個「風格潤飾」專家。

=== 你的唯一任務 ===
把文章改成「這個人會說的話」，但不改變內容本身。

想像你是一個配音員：
- 台詞（內容）不能改
- 但說話的「語氣」「節奏」「用詞」要像這個人

=== 這個人的說話風格 ===
${styleReference}

=== 絕對不能做的事（違反任何一條就是失敗）===

❌ 不能改變任何觀點或論點
❌ 不能添加新的內容或想法
❌ 不能刪除任何原有的觀點
❌ 不能改變段落結構（原本 ${originalParagraphCount} 段，潤飾後也要 ${originalParagraphCount} 段）
❌ 不能大幅改變字數（原本 ${originalWordCount} 字，潤飾後要在 ${minWordCount}-${maxWordCount} 字之間）
❌ 不能加入 CTA、問題、反問（除非原文有）
❌ 不能用 Markdown 符號

=== 可以做的事 ===

✅ 把書面語改成口語（「因此」→「所以」）
✅ 加入這個人的口頭禪（自然地融入，不要刻意）
✅ 調整語氣詞（「啊」「吧」「呢」「欸」）
✅ 讓句子更像傳訊息給朋友
✅ 調整標點符號讓節奏更自然

=== 口語化對照表（參考）===
| 書面語 | 口語 |
|--------|------|
| 因此 | 所以 |
| 然而 | 但是 |
| 此外 | 還有 |
| 例如 | 像是 |
| 認為 | 覺得 |
| 非常 | 超 |
| 或許 | 可能 |
| 儘管 | 雖然 |
| 由於 | 因為 |
| 應該 | 要 |

=== 輸出格式 ===
直接輸出潤飾後的內容，不要任何解釋、標題或分隔線。`;
}

/**
 * 建立風格參考區塊
 */
function buildStyleReference(context: StylePolishContext): string {
  const parts: string[] = [];

  // 口頭禪
  if (context.catchphrases.length > 0) {
    parts.push(`【口頭禪】${context.catchphrases.join('、')}`);
    parts.push(`（可以自然地融入 1-2 個，但不要每句都用）`);
  }

  // 說話風格
  if (context.speakingStyle) {
    parts.push(`【說話風格】${context.speakingStyle}`);
  }

  // 語氣風格
  if (context.toneStyle) {
    parts.push(`【語氣】${context.toneStyle}`);
  }

  // 常用句式
  if (context.commonPhrases.length > 0) {
    parts.push(`【常用句式】`);
    context.commonPhrases.slice(0, 3).forEach(phrase => {
      parts.push(`  - ${phrase}`);
    });
  }

  // 情緒表達詞彙
  if (context.emotionWords.length > 0) {
    parts.push(`【情緒表達】${context.emotionWords.join('、')}`);
  }

  // 爆款範例（Few-Shot）
  if (context.viralExamples.length > 0) {
    parts.push(`\n【這個人寫過的文章（感受語氣，不要模仿結構）】`);
    context.viralExamples.slice(0, 2).forEach((example, i) => {
      // 只取前 200 字作為風格參考
      const truncated = example.length > 200 ? example.slice(0, 200) + '...' : example;
      parts.push(`範例 ${i + 1}：\n${truncated}`);
    });
  }

  return parts.join('\n');
}

/**
 * 建立 stylePolish 用戶提示詞
 */
export function buildStylePolishUserPrompt(originalContent: string): string {
  return `請把以下文章潤飾成「我會說的話」：

---
${originalContent}
---

記住：
1. 只改語氣，不改內容
2. 字數要差不多
3. 段落結構不能變
4. 直接輸出結果，不要任何解釋`;
}

/**
 * 語意驗證函數
 * 
 * 檢查潤飾後的內容是否符合要求：
 * 1. 字數誤差 ±10% 以內
 * 2. 段落數相同
 * 3. 沒有新增觀點
 */
export interface SemanticValidation {
  isValid: boolean;
  wordCountValid: boolean;
  paragraphCountValid: boolean;
  warnings: string[];
  originalWordCount: number;
  polishedWordCount: number;
  originalParagraphCount: number;
  polishedParagraphCount: number;
}

export function validateSemanticPreservation(
  original: string,
  polished: string
): SemanticValidation {
  const warnings: string[] = [];

  // 計算字數
  const originalWordCount = original.replace(/\s/g, '').length;
  const polishedWordCount = polished.replace(/\s/g, '').length;
  const wordCountDiff = Math.abs(polishedWordCount - originalWordCount) / originalWordCount;
  const wordCountValid = wordCountDiff <= 0.15; // 允許 15% 誤差

  if (!wordCountValid) {
    const diffPercent = Math.round(wordCountDiff * 100);
    if (polishedWordCount > originalWordCount) {
      warnings.push(`字數增加了 ${diffPercent}%（${originalWordCount} → ${polishedWordCount}）`);
    } else {
      warnings.push(`字數減少了 ${diffPercent}%（${originalWordCount} → ${polishedWordCount}）`);
    }
  }

  // 計算段落數
  const originalParagraphCount = countParagraphs(original);
  const polishedParagraphCount = countParagraphs(polished);
  const paragraphCountValid = Math.abs(polishedParagraphCount - originalParagraphCount) <= 1;

  if (!paragraphCountValid) {
    warnings.push(`段落數變化過大（${originalParagraphCount} → ${polishedParagraphCount}）`);
  }

  // 檢查是否有新增觀點的跡象
  const newOpinionPatterns = [
    /從.*角度來看/,
    /讓我們/,
    /今天要分享/,
    /希望對你有幫助/,
    /你可以試試/,
    /建議你/,
    /我認為你應該/,
  ];

  for (const pattern of newOpinionPatterns) {
    if (pattern.test(polished) && !pattern.test(original)) {
      warnings.push(`可能新增了觀點：「${polished.match(pattern)?.[0]}」`);
    }
  }

  return {
    isValid: wordCountValid && paragraphCountValid && warnings.length <= 1,
    wordCountValid,
    paragraphCountValid,
    warnings,
    originalWordCount,
    polishedWordCount,
    originalParagraphCount,
    polishedParagraphCount,
  };
}

/**
 * 計算段落數
 */
function countParagraphs(text: string): number {
  // 以連續兩個換行或更多作為段落分隔
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  return Math.max(paragraphs.length, 1);
}

/**
 * 從用戶資料建立 StylePolishContext
 */
export function buildStylePolishContext(
  originalContent: string,
  userStyle: {
    catchphrases?: string;
    speakingStyle?: string;
    toneStyle?: string;
    commonPhrases?: string;
    emotionExpressions?: string;
  } | null,
  viralExamples: string[] = []
): StylePolishContext {
  // 解析口頭禪（可能是逗號分隔的字串）
  const catchphrases = userStyle?.catchphrases
    ? userStyle.catchphrases.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
    : [];

  // 解析常用句式
  const commonPhrases = userStyle?.commonPhrases
    ? userStyle.commonPhrases.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)
    : [];

  // 解析情緒表達詞彙
  const emotionWords = userStyle?.emotionExpressions
    ? userStyle.emotionExpressions.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
    : [];

  return {
    catchphrases,
    speakingStyle: userStyle?.speakingStyle || '',
    toneStyle: userStyle?.toneStyle || '',
    commonPhrases,
    emotionWords,
    viralExamples,
    originalContent,
    originalWordCount: originalContent.replace(/\s/g, '').length,
    originalParagraphCount: countParagraphs(originalContent),
  };
}
