/**
 * 開頭 DNA 提取服務
 * 從用戶的高品質貼文中提取開頭結構特徵
 */

import { isFeatureEnabled } from '../infrastructure/feature-flags';
import { withCache, CacheKeys, CACHE_TTL } from '../infrastructure/cache';

/**
 * 開頭 DNA 特徵
 */
export interface OpenerDNA {
  // 結構特徵
  usesColon: boolean;           // 是否使用冒號斷言
  usesQuestion: boolean;        // 是否使用反問
  usesQuote: boolean;           // 是否使用引號對話
  usesNumber: boolean;          // 是否使用數字
  usesEmoji: boolean;           // 是否使用表情符號
  
  // 語氣特徵
  emotionalWords: string[];     // 情緒詞彙
  personalPronouns: string[];   // 人稱代詞使用
  
  // 長度特徵
  avgOpenerLength: number;      // 平均開頭長度
  
  // 風格特徵
  dominantStyle: string;        // 主導風格
  styleDistribution: Record<string, number>; // 風格分佈
  
  // 成功模式
  topPatterns: OpenerPattern[]; // 最成功的開頭模式
}

/**
 * 開頭模式
 */
export interface OpenerPattern {
  pattern: string;
  example: string;
  avgEngagement: number;
  count: number;
}

/**
 * 用戶貼文資料
 */
export interface UserPost {
  content: string;
  engagement: number;
  createdAt?: Date;
}

/**
 * 提取開頭（取第一句或前 50 字）
 */
export function extractOpener(content: string): string {
  // 嘗試找到第一個句號、問號或驚嘆號
  const sentenceEnd = content.search(/[。！？\n]/);
  
  if (sentenceEnd !== -1 && sentenceEnd <= 80) {
    return content.slice(0, sentenceEnd + 1);
  }
  
  // 如果沒有找到或太長，取前 50 字
  return content.slice(0, 50);
}

/**
 * 檢查是否包含 emoji
 */
function hasEmoji(text: string): boolean {
  // 使用簡單的 emoji 範圍檢測
  const emojiRanges = [
    [0x1F300, 0x1F9FF], // Miscellaneous Symbols and Pictographs
    [0x2600, 0x26FF],   // Miscellaneous Symbols
    [0x2700, 0x27BF],   // Dingbats
  ];
  
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i) || 0;
    for (const [start, end] of emojiRanges) {
      if (code >= start && code <= end) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 分析開頭結構特徵
 */
export function analyzeOpenerStructure(opener: string): {
  usesColon: boolean;
  usesQuestion: boolean;
  usesQuote: boolean;
  usesNumber: boolean;
  usesEmoji: boolean;
} {
  return {
    usesColon: /[:：]/.test(opener),
    usesQuestion: /[？?]/.test(opener),
    usesQuote: /[「」『』""'']/.test(opener),
    usesNumber: /\d/.test(opener),
    usesEmoji: hasEmoji(opener),
  };
}

/**
 * 提取情緒詞彙
 */
export function extractEmotionalWords(content: string): string[] {
  const emotionalPatterns = [
    '天啊', '真的', '太', '超', '好', '很', '非常',
    '居然', '竟然', '原來', '終於', '果然',
    '開心', '難過', '生氣', '驚訝', '感動',
    '崩潰', '無奈', '期待', '興奮', '緊張',
  ];
  
  const found: string[] = [];
  for (const word of emotionalPatterns) {
    if (content.includes(word)) {
      found.push(word);
    }
  }
  
  return Array.from(new Set(found));
}

/**
 * 分析人稱代詞使用
 */
export function analyzePronouns(content: string): string[] {
  const pronouns = ['我', '你', '他', '她', '我們', '你們', '他們', '大家'];
  const found: string[] = [];
  
  for (const pronoun of pronouns) {
    if (content.includes(pronoun)) {
      found.push(pronoun);
    }
  }
  
  return found;
}

/**
 * 判斷開頭風格
 */
export function determineOpenerStyle(opener: string): string {
  // 對話型：以引號開頭
  if (/^[「『"]/.test(opener)) {
    return 'dialogue';
  }
  
  // 反問型：包含問號
  if (/[？?]/.test(opener)) {
    return 'mirror';
  }
  
  // 情境型：以時間/地點開頭
  if (/^(昨天|今天|剛剛|那天|在|當)/.test(opener)) {
    return 'scene';
  }
  
  // 反差型：包含「但」「卻」「其實」
  if (/(但|卻|其實|後來發現)/.test(opener)) {
    return 'contrast';
  }
  
  // 情緒型：以情緒詞開頭
  if (/^(天啊|真的|太|超|好)/.test(opener)) {
    return 'emotion';
  }
  
  // 懸念型：包含省略號或「...」
  if (/\.{3}|…/.test(opener)) {
    return 'suspense';
  }
  
  // 預設：閒聊型
  return 'casual';
}

/**
 * 提取開頭 DNA
 */
export async function extractOpenerDNA(
  userId: string,
  posts: UserPost[],
  minEngagement: number = 100
): Promise<OpenerDNA> {
  if (!isFeatureEnabled('OPENER_DNA')) {
    return getDefaultDNA();
  }
  
  // 使用快取
  return withCache(
    `opener_dna:${userId}`,
    CACHE_TTL.VIRAL_PATTERNS,
    async () => {
      // 過濾高品質貼文
      const qualityPosts = posts.filter(p => p.engagement >= minEngagement);
      
      if (qualityPosts.length === 0) {
        return getDefaultDNA();
      }
      
      // 提取所有開頭
      const openers = qualityPosts.map(p => ({
        opener: extractOpener(p.content),
        engagement: p.engagement,
      }));
      
      // 分析結構特徵
      let colonCount = 0;
      let questionCount = 0;
      let quoteCount = 0;
      let numberCount = 0;
      let emojiCount = 0;
      let totalLength = 0;
      
      const allEmotionalWords: string[] = [];
      const allPronouns: string[] = [];
      const styleCount: Record<string, number> = {};
      
      for (const { opener } of openers) {
        const structure = analyzeOpenerStructure(opener);
        if (structure.usesColon) colonCount++;
        if (structure.usesQuestion) questionCount++;
        if (structure.usesQuote) quoteCount++;
        if (structure.usesNumber) numberCount++;
        if (structure.usesEmoji) emojiCount++;
        
        totalLength += opener.length;
        
        allEmotionalWords.push(...extractEmotionalWords(opener));
        allPronouns.push(...analyzePronouns(opener));
        
        const style = determineOpenerStyle(opener);
        styleCount[style] = (styleCount[style] || 0) + 1;
      }
      
      const total = openers.length;
      
      // 找出主導風格
      let dominantStyle = 'casual';
      let maxCount = 0;
      for (const [style, count] of Object.entries(styleCount)) {
        if (count > maxCount) {
          maxCount = count;
          dominantStyle = style;
        }
      }
      
      // 計算風格分佈百分比
      const styleDistribution: Record<string, number> = {};
      for (const [style, count] of Object.entries(styleCount)) {
        styleDistribution[style] = Math.round((count / total) * 100);
      }
      
      // 提取最成功的開頭模式
      const topPatterns = extractTopPatterns(openers);
      
      return {
        usesColon: colonCount / total > 0.3,
        usesQuestion: questionCount / total > 0.3,
        usesQuote: quoteCount / total > 0.2,
        usesNumber: numberCount / total > 0.2,
        usesEmoji: emojiCount / total > 0.1,
        emotionalWords: Array.from(new Set(allEmotionalWords)).slice(0, 10),
        personalPronouns: Array.from(new Set(allPronouns)),
        avgOpenerLength: Math.round(totalLength / total),
        dominantStyle,
        styleDistribution,
        topPatterns,
      };
    }
  );
}

/**
 * 提取最成功的開頭模式
 */
function extractTopPatterns(
  openers: Array<{ opener: string; engagement: number }>
): OpenerPattern[] {
  // 按互動數排序
  const sorted = [...openers].sort((a, b) => b.engagement - a.engagement);
  
  // 取前 5 個
  const top5 = sorted.slice(0, 5);
  
  return top5.map(({ opener, engagement }) => ({
    pattern: determineOpenerStyle(opener),
    example: opener,
    avgEngagement: engagement,
    count: 1,
  }));
}

/**
 * 取得預設 DNA
 */
function getDefaultDNA(): OpenerDNA {
  return {
    usesColon: false,
    usesQuestion: false,
    usesQuote: false,
    usesNumber: false,
    usesEmoji: false,
    emotionalWords: [],
    personalPronouns: ['我'],
    avgOpenerLength: 30,
    dominantStyle: 'casual',
    styleDistribution: { casual: 100 },
    topPatterns: [],
  };
}

/**
 * 根據 DNA 建立個人化開頭提示詞
 */
export function buildPersonalizedOpenerPrompt(dna: OpenerDNA): string {
  const parts: string[] = [];
  
  // 風格指導
  parts.push(`用戶偏好的開頭風格：${dna.dominantStyle}`);
  
  // 結構指導
  const structureHints: string[] = [];
  if (dna.usesColon) structureHints.push('善用冒號斷言');
  if (dna.usesQuestion) structureHints.push('善用反問句');
  if (dna.usesQuote) structureHints.push('善用對話引用');
  if (dna.usesNumber) structureHints.push('善用數字');
  
  if (structureHints.length > 0) {
    parts.push(`結構特徵：${structureHints.join('、')}`);
  }
  
  // 情緒詞指導
  if (dna.emotionalWords.length > 0) {
    parts.push(`常用情緒詞：${dna.emotionalWords.slice(0, 5).join('、')}`);
  }
  
  // 長度指導
  parts.push(`建議開頭長度：約 ${dna.avgOpenerLength} 字`);
  
  // 成功範例
  if (dna.topPatterns.length > 0) {
    parts.push(`成功開頭範例：「${dna.topPatterns[0].example}」`);
  }
  
  return parts.join('\n');
}
