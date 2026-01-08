/**
 * 開頭規則模組
 * 基於 1,739 篇爆款貼文統計分析得出的開頭規則
 * 
 * 同質性解決機制：
 * 1. 多模式輪換 - 每次生成從推薦模式中隨機選擇
 * 2. 範例隨機化 - 從 Top20 中隨機抽取範例
 * 3. 素材關鍵詞提取 - 強制使用素材中的關鍵詞
 */

export interface OpenerPattern {
  name: string;
  pattern: string;
  effect: number; // 效果倍數，1.0 為基準
  examples: string[];
  instruction: string;
  regex?: RegExp; // 用於檢測是否符合該模式
  templateFormula?: string; // 模板公式，用於生成新開頭
}

// 高效開頭模式（效果倍數 > 1.0x）
export const HIGH_EFFECT_OPENER_PATTERNS: OpenerPattern[] = [
  {
    name: "冒號斷言",
    pattern: "主題：觀點/結論",
    effect: 2.8,
    examples: [
      "學習的真相：不是你不夠努力",
      "經營自己的關鍵：先搞清楚這件事",
      "感情的本質：不是付出越多越好",
      "成長最快的方式：硬著頭皮上",
      "人際關係的秘密：不是討好所有人",
      "時間管理的真相：不是擠出更多時間",
      "自律的本質：不是逼自己",
      "溝通的關鍵：不是說得多",
      "創業的真相：不是有好點子就行",
      "職場生存法則：不是能力最重要"
    ],
    instruction: "第一行使用「主題：觀點」的格式，冒號後直接給結論，不要問句",
    regex: /^.{2,10}[：:].{5,}/,
    templateFormula: "[素材關鍵詞]的[真相/關鍵/本質/秘密]：[反直覺觀點]"
  },
  {
    name: "禁忌/警告詞",
    pattern: "千萬不要.../90%的人都搞錯了",
    effect: 2.4,
    examples: [
      "千萬不要在還沒搞懂這件事之前就開始",
      "90% 的人都搞錯了這件事",
      "這個錯誤會讓你白學三年",
      "別再犯這個錯了",
      "停止這樣做，你只會越來越累",
      "80% 的人都不知道這個秘密",
      "這件事做錯了，前面全白費",
      "千萬別在這個時候放棄",
      "95% 的人都踩過這個坑",
      "這個習慣正在毀掉你"
    ],
    instruction: "使用「千萬」「不要」「錯誤」「搞錯」「停止」等警告詞製造緊迫感",
    regex: /^(千萬|不要|別再|停止|錯誤|\d+%.*搞錯|這個錯誤|\d+%.*不知道)/,
    templateFormula: "[數字]% 的人都[搞錯了/不知道][素材關鍵詞]這件事"
  },
  {
    name: "數字開頭",
    pattern: "N個/N%/N件事",
    effect: 1.7,
    examples: [
      "3 個讓你學了還是不會的原因",
      "90% 的人都犯的錯",
      "5 件事讓你的 Threads 沒人看",
      "7 個徵兆說明你正在轉運",
      "2 個問題幫你看清一段關係",
      "4 個習慣讓你越來越有錢",
      "6 個特徵說明你正在成長",
      "3 種人不適合創業",
      "5 個信號說明該離職了",
      "8 個小習慣改變你的人生"
    ],
    instruction: "第一行包含具體數字，增加可信度和具體感",
    regex: /^\d+\s*(個|件|種|%|招|步|點|特徵|習慣|信號|徵兆|原因|問題)/,
    templateFormula: "[數字] 個[讓你/幫你/說明你][素材相關動作]的[原因/方法/特徵]"
  },
  {
    name: "時間點",
    pattern: "這週/昨天/最近",
    effect: 1.5,
    examples: [
      "這週我終於想通了",
      "昨天有學員問我",
      "最近發現一件事",
      "上週遇到一個案例",
      "今天收到一個訊息",
      "前幾天跟朋友聊天",
      "剛剛突然想到",
      "這幾天一直在想",
      "昨晚睡前突然明白",
      "上個月發生的事"
    ],
    instruction: "使用具體時間點，增加真實感和即時性",
    regex: /^(這週|昨天|今天|最近|上週|前幾天|剛剛|這幾天|昨晚|上個月)/,
    templateFormula: "[時間詞]我[發現/想通/遇到][素材相關事件]"
  },
  {
    name: "對話式「你」",
    pattern: "你是不是.../你有沒有",
    effect: 1.56,
    examples: [
      "你是不是也這樣？",
      "你有沒有發現",
      "你一定遇過這種情況",
      "你可能不知道",
      "你以為的努力，其實是在原地踏步",
      "你是不是總覺得時間不夠用",
      "你有沒有過這種感覺",
      "你是不是也在等一個答案",
      "你可能正在犯這個錯",
      "你以為的堅持，可能只是固執"
    ],
    instruction: "直接跟讀者對話，製造共鳴，但不要用問句結尾",
    regex: /^你(是不是|有沒有|一定|可能|以為|總覺得)/,
    templateFormula: "你是不是也[素材相關的痛點行為]"
  },
  {
    name: "結果導向",
    pattern: "結果.../後來.../最後...",
    effect: 1.4,
    examples: [
      "結果我發現，問題根本不在這裡",
      "後來我才明白",
      "最後我終於想通了",
      "結果呢？完全不是我想的那樣",
      "後來才知道，原來是這樣",
      "結果證明我錯了",
      "後來發生的事讓我傻眼",
      "最後的答案出乎意料",
      "結果這個決定改變了一切",
      "後來我才懂得珍惜"
    ],
    instruction: "用結果導向的詞彙開頭，製造好奇心",
    regex: /^(結果|後來|最後)/,
    templateFormula: "[結果詞]我[發現/明白/才知道]，[素材相關的反轉觀點]"
  },
  {
    name: "反直覺陳述",
    pattern: "不是...而是.../其實...",
    effect: 1.8,
    examples: [
      "不是你不夠努力，是方向錯了",
      "其實問題不在這裡",
      "不是沒時間，是沒優先",
      "其實你已經很好了",
      "不是能力不夠，是信心不足",
      "其實答案一直都在",
      "不是運氣不好，是準備不夠",
      "其實你比想像中更強",
      "不是沒機會，是沒看見",
      "其實改變沒那麼難"
    ],
    instruction: "用「不是...而是」或「其實」開頭，打破讀者預期",
    regex: /^(不是.{2,10}(，|,|是)|其實)/,
    templateFormula: "不是[常見歸因]，是[真正原因/素材觀點]"
  }
];

// 低效開頭模式（效果倍數 < 1.0x，應避免）
export const LOW_EFFECT_OPENER_PATTERNS: OpenerPattern[] = [
  {
    name: "問句開頭",
    pattern: "你有沒有想過...？",
    effect: 0.4,
    examples: [
      "你有沒有想過為什麼學了很多還是不會？",
      "為什麼學了這麼多還是不會？",
      "你覺得呢？"
    ],
    instruction: "避免用問句作為第一行，效果只有斷言的 40%",
    regex: /^.+[？?]$/
  },
  {
    name: "Emoji 開頭",
    pattern: "✨ 今天想分享...",
    effect: 0.6,
    examples: [
      "✨ 今天想分享一個觀點",
      "🔥 這個觀點很重要",
      "💡 突然想到"
    ],
    instruction: "避免用 Emoji 作為第一行開頭，會降低專業感",
    regex: /^[✨🔥👉💡⭐💪🎯]/
  },
  {
    name: "AI 常用詞",
    pattern: "讓我們.../今天要分享...",
    effect: 0.3,
    examples: [
      "讓我們一起來看看",
      "今天要分享一個觀點",
      "在這個快節奏的時代",
      "親愛的朋友們"
    ],
    instruction: "避免使用 AI 常用的開頭詞彙，會讓內容顯得不真誠",
    regex: /^(讓我們|今天要分享|在這個|親愛的)/
  },
  {
    name: "模糊開頭",
    pattern: "其實.../我覺得...",
    effect: 0.5,
    examples: [
      "其實我想說",
      "我覺得這件事很重要",
      "說真的"
    ],
    instruction: "避免用「其實」「我覺得」等模糊詞開頭，缺乏力量",
    regex: /^(我覺得|說真的)/
  }
];

// 所有開頭規則
export const OPENER_RULES = {
  highEffectPatterns: HIGH_EFFECT_OPENER_PATTERNS,
  lowEffectPatterns: LOW_EFFECT_OPENER_PATTERNS
};

/**
 * 檢測開頭是否符合高效模式
 */
export function analyzeOpener(firstLine: string): {
  matchedHighEffect: OpenerPattern[];
  matchedLowEffect: OpenerPattern[];
  score: number;
  suggestions: string[];
} {
  const matchedHighEffect: OpenerPattern[] = [];
  const matchedLowEffect: OpenerPattern[] = [];
  const suggestions: string[] = [];
  
  // 檢查高效模式
  for (const pattern of HIGH_EFFECT_OPENER_PATTERNS) {
    if (pattern.regex && pattern.regex.test(firstLine)) {
      matchedHighEffect.push(pattern);
    }
  }
  
  // 檢查低效模式
  for (const pattern of LOW_EFFECT_OPENER_PATTERNS) {
    if (pattern.regex && pattern.regex.test(firstLine)) {
      matchedLowEffect.push(pattern);
    }
  }
  
  // 計算分數
  let score = 1.0;
  for (const p of matchedHighEffect) {
    score *= p.effect;
  }
  for (const p of matchedLowEffect) {
    score *= p.effect;
  }
  
  // 生成建議
  if (matchedHighEffect.length === 0) {
    suggestions.push("建議使用「冒號斷言」格式，例如：「主題：觀點」");
  }
  if (matchedLowEffect.length > 0) {
    for (const p of matchedLowEffect) {
      suggestions.push(`避免${p.name}：${p.instruction}`);
    }
  }
  
  return {
    matchedHighEffect,
    matchedLowEffect,
    score,
    suggestions
  };
}

/**
 * 根據貼文類型取得推薦的開頭模式（帶權重）
 */
export function getRecommendedOpenerPatterns(contentType: string): OpenerPattern[] {
  const typePatternMap: Record<string, string[]> = {
    viewpoint: ["冒號斷言", "禁忌/警告詞", "對話式「你」", "反直覺陳述"],
    story: ["時間點", "結果導向", "對話式「你」"],
    knowledge: ["數字開頭", "禁忌/警告詞", "冒號斷言"],
    summary: ["數字開頭", "冒號斷言"],
    contrast: ["冒號斷言", "禁忌/警告詞", "反直覺陳述"],
    casual: ["時間點", "對話式「你」"],
    dialogue: ["時間點", "對話式「你」"],
    question: ["對話式「你」", "反直覺陳述"],
    poll: ["對話式「你」", "數字開頭"],
    quote: ["冒號斷言", "反直覺陳述"],
    diagnosis: ["對話式「你」", "數字開頭"]
  };
  
  const patternNames = typePatternMap[contentType] || ["冒號斷言", "對話式「你」"];
  
  return HIGH_EFFECT_OPENER_PATTERNS.filter(p => patternNames.includes(p.name));
}

/**
 * 【同質性解決】隨機選擇一個開頭模式
 * 從推薦模式中隨機選擇，避免每次都用同一種
 */
export function selectRandomOpenerPattern(contentType: string): OpenerPattern {
  const recommendedPatterns = getRecommendedOpenerPatterns(contentType);
  
  // 加權隨機選擇（效果越高的模式，被選中的機率越高）
  const totalWeight = recommendedPatterns.reduce((sum, p) => sum + p.effect, 0);
  let random = Math.random() * totalWeight;
  
  for (const pattern of recommendedPatterns) {
    random -= pattern.effect;
    if (random <= 0) {
      return pattern;
    }
  }
  
  // 預設返回第一個
  return recommendedPatterns[0] || HIGH_EFFECT_OPENER_PATTERNS[0];
}

/**
 * 【同質性解決】從範例中隨機抽取
 * 每次只展示 2-3 個範例，而不是全部
 */
export function getRandomExamples(pattern: OpenerPattern, count: number = 3): string[] {
  const examples = [...pattern.examples];
  const shuffled = examples.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * 【同質性解決】從素材中提取關鍵詞
 * 用於強制在開頭使用素材中的關鍵詞
 */
export function extractMaterialKeywords(material: string): string[] {
  if (!material) return [];
  
  // 常見的關鍵詞模式
  const keywordPatterns = [
    // 動詞短語
    /經營自己|學習|成長|創業|溝通|時間管理|自律|堅持|放棄|改變/g,
    // 名詞短語
    /人際關係|職場|感情|金錢|健康|習慣|目標|夢想|選擇|決定/g,
    // 形容詞短語
    /努力|焦慮|迷茫|困惑|疲憊|快樂|成功|失敗/g,
  ];
  
  const keywords: string[] = [];
  for (const pattern of keywordPatterns) {
    const matches = material.match(pattern);
    if (matches) {
      keywords.push(...matches);
    }
  }
  
  // 去重
  return Array.from(new Set(keywords));
}

/**
 * 【同質性解決】生成開頭公式提示
 * 根據選中的模式和素材關鍵詞，生成具體的開頭指示
 */
export function generateOpenerFormula(
  pattern: OpenerPattern,
  materialKeywords: string[]
): string {
  if (!pattern.templateFormula) {
    return pattern.instruction;
  }
  
  let formula = pattern.templateFormula;
  
  // 替換素材關鍵詞
  if (materialKeywords.length > 0) {
    const keyword = materialKeywords[Math.floor(Math.random() * materialKeywords.length)];
    formula = formula.replace(/\[素材關鍵詞\]/g, keyword);
    formula = formula.replace(/\[素材相關.*?\]/g, `與「${keyword}」相關的內容`);
  }
  
  return formula;
}

/**
 * 生成開頭規則提示詞（優化版 - 解決同質性問題）
 */
export function buildOpenerRulesPrompt(
  contentType: string,
  material?: string
): string {
  // 隨機選擇一個主要模式
  const selectedPattern = selectRandomOpenerPattern(contentType);
  
  // 取得其他推薦模式作為備選
  const allRecommended = getRecommendedOpenerPatterns(contentType);
  const alternativePatterns = allRecommended.filter(p => p.name !== selectedPattern.name).slice(0, 2);
  
  // 從素材提取關鍵詞
  const materialKeywords = material ? extractMaterialKeywords(material) : [];
  
  // 生成開頭公式
  const openerFormula = generateOpenerFormula(selectedPattern, materialKeywords);
  
  // 隨機抽取範例
  const selectedExamples = getRandomExamples(selectedPattern, 3);
  const alternativeExamples = alternativePatterns.map(p => ({
    name: p.name,
    examples: getRandomExamples(p, 2)
  }));
  
  let prompt = `
=== 第一行黃金規則（最重要 - 決定 80% 成敗） ===

【數據來源】以下規則來自 1,739 篇爆款貼文的統計分析

【🎯 本次推薦的開頭模式】${selectedPattern.name}（效果 ${selectedPattern.effect}x）

【開頭公式】
${openerFormula}

【指令】${selectedPattern.instruction}

【範例參考】（學習格式，不要複製內容）
${selectedExamples.map((e: string, i: number) => `  ${i + 1}. ${e}`).join('\n')}
`;

  // 加入素材關鍵詞提示
  if (materialKeywords.length > 0) {
    prompt += `
【⚠️ 重要：素材關鍵詞】
你的素材包含這些關鍵詞：${materialKeywords.join('、')}
請在第一行中使用至少一個關鍵詞，讓開頭與素材緊密相關。
`;
  }

  // 加入備選模式
  if (alternativePatterns.length > 0) {
    prompt += `
【備選開頭模式】（如果主推薦不適合，可選用）
`;
    alternativePatterns.forEach((p, i) => {
      prompt += `
${i + 1}. ${p.name}（效果 ${p.effect}x）
   範例：${alternativeExamples[i]?.examples.join(' / ')}
`;
    });
  }

  prompt += `
【❌ 必須避免的開頭模式】
`;

  for (const pattern of LOW_EFFECT_OPENER_PATTERNS) {
    prompt += `• ${pattern.name}（效果 ${pattern.effect}x）：${pattern.instruction}\n`;
  }

  prompt += `
【⚠️ 同質性警告 - 極度重要】
1. 禁止直接複製上述範例的內容
2. 必須根據你的素材創造全新的開頭
3. 開頭必須包含素材中的核心概念
4. 每次生成都要有不同的開頭，不能重複

【執行要求】
1. 第一行必須使用「${selectedPattern.name}」格式
2. 第一行必須獨立成段（後面空一行）
3. 第一行不能超過 30 字
4. 第一行必須與素材內容相關
`;

  return prompt;
}

/**
 * 驗證生成的開頭是否符合規則
 */
export function validateGeneratedOpener(
  generatedFirstLine: string,
  material: string,
  expectedPattern: OpenerPattern
): {
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  // 1. 檢查是否符合預期模式
  if (expectedPattern.regex && !expectedPattern.regex.test(generatedFirstLine)) {
    issues.push(`未使用「${expectedPattern.name}」格式`);
    score -= 30;
    suggestions.push(`建議改用：${expectedPattern.instruction}`);
  }
  
  // 2. 檢查是否使用了低效模式
  for (const lowPattern of LOW_EFFECT_OPENER_PATTERNS) {
    if (lowPattern.regex && lowPattern.regex.test(generatedFirstLine)) {
      issues.push(`使用了低效的「${lowPattern.name}」模式`);
      score -= 20;
    }
  }
  
  // 3. 檢查字數
  if (generatedFirstLine.length > 30) {
    issues.push(`第一行超過 30 字（目前 ${generatedFirstLine.length} 字）`);
    score -= 10;
  }
  
  // 4. 檢查是否與素材相關
  const materialKeywords = extractMaterialKeywords(material);
  const hasKeyword = materialKeywords.some(kw => generatedFirstLine.includes(kw));
  if (materialKeywords.length > 0 && !hasKeyword) {
    issues.push('第一行未包含素材關鍵詞');
    score -= 15;
    suggestions.push(`建議在開頭加入：${materialKeywords.slice(0, 3).join('、')}`);
  }
  
  // 5. 檢查是否直接複製範例
  const isExampleCopy = expectedPattern.examples.some(ex => 
    generatedFirstLine.includes(ex) || ex.includes(generatedFirstLine)
  );
  if (isExampleCopy) {
    issues.push('疑似直接複製範例');
    score -= 40;
    suggestions.push('請根據素材創造全新的開頭');
  }
  
  return {
    isValid: issues.length === 0,
    score: Math.max(0, score),
    issues,
    suggestions
  };
}
