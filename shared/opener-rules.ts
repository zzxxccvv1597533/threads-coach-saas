/**
 * 開頭規則模組
 * 基於 1,739 篇爆款貼文分析 + 17,850 篇爆款資料庫優化
 * 
 * 優化版本 v2.0 - 新增 6 種高效開頭模式
 * 
 * 同質性解決機制：
 * 1. 多模式輪換 - 每次生成從推薦模式中隨機選擇
 * 2. 範例隨機化 - 從 Top20 中隨機抽取範例
 * 3. 素材關鍵詞提取 - 強制使用素材中的關鍵詞
 * 4. 開頭記錄檢查 - 避免連續使用相同模式
 */

export interface OpenerPattern {
  name: string;
  pattern: string;
  effect: number; // 效果倍數，1.0 為基準
  examples: string[];
  instruction: string;
  regex?: RegExp; // 用於檢測是否符合該模式
  templateFormula?: string; // 模板公式，用於生成新開頭
  successRate?: number; // 成功率（基於爆款資料庫分析）
  avgLikes?: number; // 平均讚數（基於爆款資料庫分析）
}

// 高效開頭模式（優化版 - 新增 6 種，共 13 種）
export const HIGH_EFFECT_OPENER_PATTERNS: OpenerPattern[] = [
  // ==================== 原有高效模式（調整權重） ====================
  {
    name: "冒號斷言",
    pattern: "主題：觀點/結論",
    effect: 2.8,
    successRate: 7.0,
    avgLikes: 4200,
    examples: [
      "學習的真相：不是你不夠努力",
      "經營自己的關鍵：先搞清楚這件事",
      "感情的本質：不是付出越多越好",
      "成長最快的方式：硬著頭皮上",
      "人際關係的秘密：不是討好所有人"
    ],
    instruction: "第一行使用「主題：觀點」的格式，冒號後直接給結論，不要問句",
    regex: /^.{2,10}[：:].{5,}/,
    templateFormula: "[素材關鍵詞]的[真相/關鍵/本質/秘密]：[反直覺觀點]"
  },
  {
    name: "禁忌/警告詞",
    pattern: "千萬不要.../90%的人都搞錯了",
    effect: 2.4,
    successRate: 5.2,
    avgLikes: 3600,
    examples: [
      "千萬不要在還沒搞懂這件事之前就開始",
      "90% 的人都搞錯了這件事",
      "這個錯誤會讓你白學三年",
      "別再犯這個錯了",
      "停止這樣做，你只會越來越累"
    ],
    instruction: "使用「千萬」「不要」「錯誤」「搞錯」「停止」等警告詞製造緊迫感",
    regex: /^(千萬|不要|別再|停止|錯誤|\d+%.*搞錯|這個錯誤|\d+%.*不知道)/,
    templateFormula: "[數字]% 的人都[搞錯了/不知道][素材關鍵詞]這件事"
  },
  {
    name: "數字開頭",
    pattern: "N個/N%/N件事",
    effect: 1.7,
    successRate: 5.5,
    avgLikes: 3800,
    examples: [
      "3 個讓你學了還是不會的原因",
      "90% 的人都犯的錯",
      "5 件事讓你的 Threads 沒人看",
      "7 個徵兆說明你正在轉運",
      "2 個問題幫你看清一段關係"
    ],
    instruction: "第一行包含具體數字，增加可信度和具體感",
    regex: /^\d+\s*(個|件|種|%|招|步|點|特徵|習慣|信號|徵兆|原因|問題)/,
    templateFormula: "[數字] 個[讓你/幫你/說明你][素材相關動作]的[原因/方法/特徵]"
  },
  {
    name: "時間點",
    pattern: "這週/昨天/最近",
    effect: 1.5,
    successRate: 9.8,
    avgLikes: 4500,
    examples: [
      "這週我終於想通了",
      "昨天有學員問我",
      "最近發現一件事",
      "上週遇到一個案例",
      "今天收到一個訊息"
    ],
    instruction: "使用具體時間點，增加真實感和即時性",
    regex: /^(這週|昨天|今天|最近|上週|前幾天|剛剛|這幾天|昨晚|上個月)/,
    templateFormula: "[時間詞]我[發現/想通/遇到][素材相關事件]"
  },
  {
    name: "對話式「你」",
    pattern: "你是不是.../你有沒有",
    effect: 1.56,
    successRate: 4.8,
    avgLikes: 3200,
    examples: [
      "你是不是也這樣？",
      "你有沒有發現",
      "你一定遇過這種情況",
      "你可能不知道",
      "你以為的努力，其實是在原地踏步"
    ],
    instruction: "直接跟讀者對話，製造共鳴，但不要用問句結尾",
    regex: /^你(是不是|有沒有|一定|可能|以為|總覺得)/,
    templateFormula: "你是不是也[素材相關的痛點行為]"
  },
  {
    name: "結果導向",
    pattern: "結果.../後來.../最後...",
    effect: 1.4,
    successRate: 6.2,
    avgLikes: 3900,
    examples: [
      "結果我發現，問題根本不在這裡",
      "後來我才明白",
      "最後我終於想通了",
      "結果呢？完全不是我想的那樣",
      "後來才知道，原來是這樣"
    ],
    instruction: "用結果導向的詞彙開頭，製造好奇心",
    regex: /^(結果|後來|最後)/,
    templateFormula: "[結果詞]我[發現/明白/才知道]，[素材相關的反轉觀點]"
  },
  {
    name: "反直覺陳述",
    pattern: "不是...而是.../其實...",
    effect: 1.8,
    successRate: 5.8,
    avgLikes: 4100,
    examples: [
      "不是你不夠努力，是方向錯了",
      "其實問題不在這裡",
      "不是沒時間，是沒優先",
      "其實你已經很好了",
      "不是能力不夠，是信心不足"
    ],
    instruction: "用「不是...而是」或「其實」開頭，打破讀者預期",
    regex: /^(不是.{2,10}(，|,|是)|其實)/,
    templateFormula: "不是[常見歸因]，是[真正原因/素材觀點]"
  },
  
  // ==================== 新增高效模式（基於 17,850 篇爆款資料庫分析） ====================
  {
    name: "情緒爆發",
    pattern: "我真的.../天啊.../說真的...",
    effect: 3.2,
    successRate: 13.3,
    avgLikes: 5800,
    examples: [
      "我真的受夠了那些假裝正向的人",
      "天啊，這件事我憋了好久",
      "說真的，我以前也不相信",
      "我超討厭那種說教的文章",
      "老實說，我也曾經很迷茫"
    ],
    instruction: "用強烈的情緒詞開頭，直接表達真實感受，不要委婉",
    regex: /^(我真的|天啊|說真的|老實說|不騙你|真的是|我發誓|我超|我好|我很)/,
    templateFormula: "我真的[強烈情緒動詞][素材相關的感受]"
  },
  {
    name: "家庭故事",
    pattern: "我媽.../我爸.../我阿嬤...",
    effect: 3.4,
    successRate: 12.8,
    avgLikes: 6200,
    examples: [
      "我媽昨天突然跟我說了一句話",
      "我爸從來不說愛我，但他做了這件事",
      "我阿嬤走之前跟我說的最後一句話",
      "我老婆問我一個問題，我答不出來",
      "我女兒說了一句話，讓我愣住"
    ],
    instruction: "用家人開頭，分享與家人相關的故事或對話，容易引發共鳴",
    regex: /^(我媽|我爸|我阿嬤|我阿公|我老婆|我老公|我女兒|我兒子|我弟|我妹|我哥|我姐|我爺爺|我奶奶|我外婆|我外公)/,
    templateFormula: "[家人稱謂][時間詞][動作/說了什麼]"
  },
  {
    name: "自白坦承",
    pattern: "我以前.../我曾經.../我承認...",
    effect: 3.0,
    successRate: 10.2,
    avgLikes: 4800,
    examples: [
      "我以前也是那種很愛說教的人",
      "我曾經因為太在意別人眼光，差點放棄",
      "我承認，我也有很多做不到的事",
      "我必須坦白，我也走過很多彎路",
      "說實話，我以前超討厭這種人"
    ],
    instruction: "用自白的方式開頭，坦承自己的弱點或過去的錯誤，增加真實感",
    regex: /^(我以前|我曾經|我承認|我坦白|我必須承認|說實話我|老實說我|我不得不承認)/,
    templateFormula: "我以前也是[素材相關的負面行為/狀態]"
  },
  {
    name: "對話引用",
    pattern: "「...」/『...』",
    effect: 2.8,
    successRate: 8.5,
    avgLikes: 4100,
    examples: [
      "「你為什麼要這樣對我？」",
      "「我覺得你變了。」朋友這樣說",
      "『你不覺得這樣很累嗎？』",
      "「你到底在堅持什麼？」",
      "「如果重來一次，你還會這樣選嗎？」"
    ],
    instruction: "用引號開頭，直接引用一段對話，製造臨場感",
    regex: /^[「『"']/,
    templateFormula: "「[素材相關的對話內容]」"
  },
  {
    name: "身分標籤",
    pattern: "致.../給.../送給...",
    effect: 2.6,
    successRate: 6.5,
    avgLikes: 3500,
    examples: [
      "致所有正在迷茫的人",
      "給那個總是為別人著想的你",
      "送給每一個還在努力的人",
      "致那些不被理解的靈魂",
      "給正在考慮放棄的你"
    ],
    instruction: "用「致/給」開頭，直接對特定身分的讀者說話",
    regex: /^(致|給|送給|獻給)/,
    templateFormula: "致[素材相關的目標受眾身分]"
  },
  {
    name: "朋友故事",
    pattern: "我朋友.../朋友跟我說...",
    effect: 2.5,
    successRate: 7.8,
    avgLikes: 4300,
    examples: [
      "我朋友昨天跟我說了一件事",
      "朋友問我一個問題，我答不出來",
      "我一個朋友最近遇到一件事",
      "有個朋友跟我分享她的經歷",
      "我朋友的一句話點醒了我"
    ],
    instruction: "用朋友的故事開頭，增加真實感和距離感",
    regex: /^(我朋友|朋友|我一個朋友|有個朋友|一個朋友)/,
    templateFormula: "我朋友[時間詞][動作/說了什麼/遇到什麼]"
  }
];

// 低效開頭模式（效果倍數 < 1.0x，應避免）
export const LOW_EFFECT_OPENER_PATTERNS: OpenerPattern[] = [
  {
    name: "問句開頭",
    pattern: "你有沒有想過...？",
    effect: 0.4,
    successRate: 0.8,
    avgLikes: 350,
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
    successRate: 1.2,
    avgLikes: 450,
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
    successRate: 0.5,
    avgLikes: 200,
    examples: [
      "讓我們一起來看看",
      "今天要分享一個觀點",
      "在這個快節奏的時代",
      "親愛的朋友們"
    ],
    instruction: "避免使用 AI 常用的開頭詞彙，會讓內容顯得不真誠",
    regex: /^(讓我們|今天要分享|在這個|親愛的|各位|大家好)/
  },
  {
    name: "模糊開頭",
    pattern: "說到.../談到.../關於...",
    effect: 0.5,
    successRate: 1.2,
    avgLikes: 450,
    examples: [
      "說到這個話題",
      "談到這件事",
      "關於這個問題"
    ],
    instruction: "避免用「說到」「談到」「關於」等模糊詞開頭，缺乏力量",
    regex: /^(說到|談到|關於|對於|針對|提到)/
  },
  {
    name: "刻意口語",
    pattern: "欸欸欸.../哈囉.../嗨...",
    effect: 0.6,
    successRate: 1.5,
    avgLikes: 500,
    examples: [
      "欸欸欸你們知道嗎",
      "哈囉大家好",
      "嘿，今天來聊聊"
    ],
    instruction: "過度刻意的口語化反而不自然，改用自然的敘述",
    regex: /^(欸欸欸|哈囉|嗨|嘿|yo|hey)/i
  },
  {
    name: "過度正向",
    pattern: "今天是美好的一天.../感謝...",
    effect: 0.5,
    successRate: 1.0,
    avgLikes: 400,
    examples: [
      "今天是美好的一天！",
      "感謝大家的支持！",
      "好開心可以分享這個"
    ],
    instruction: "過度正向的開頭缺乏張力，改用有情緒轉折的開頭",
    regex: /^(今天是美好的一天|感謝|謝謝|好開心|好幸福|太棒了)/
  },
  {
    name: "說教開頭",
    pattern: "你應該.../你必須.../你一定要...",
    effect: 0.4,
    successRate: 0.8,
    avgLikes: 350,
    examples: [
      "你應該要學會...",
      "你必須知道這件事...",
      "請記住這個重要的原則..."
    ],
    instruction: "說教語氣會讓讀者反感，改用分享語氣",
    regex: /^(你應該|你必須|你一定要|你需要|請記住|請注意)/
  }
];

// 所有開頭規則
export const OPENER_RULES = {
  highEffectPatterns: HIGH_EFFECT_OPENER_PATTERNS,
  lowEffectPatterns: LOW_EFFECT_OPENER_PATTERNS,
  
  // 通用規則
  universalRules: [
    "第一行必須獨立成段（後面空一行）",
    "第一行不能超過 30 字",
    "第一行必須有「鉤子」讓讀者想看下去",
    "禁止使用 AI 常見開頭詞",
    "優先使用「我」開頭，而非「你」開頭"
  ],
  
  // 禁止開頭詞（擴充版）
  forbiddenOpeners: [
    "讓我們",
    "一起來",
    "今天要分享",
    "親愛的",
    "各位",
    "大家好",
    "不妨",
    "首先",
    "接下來",
    "在這篇文章中",
    "說到",
    "談到",
    "提到",
    "關於",
    "對於",
    "針對",
    "有鑑於",
    "隨著",
    "在當今",
    "在這個時代",
    "身為一個",
    "身為一位",
    "作為一個",
    "作為一位",
    "我想說的是",
    "不得不說"
  ],
  
  // 人稱使用指引（新增）
  pronounGuidelines: {
    preferred: "我",
    preferredExamples: [
      "我發現...",
      "我以前也...",
      "我最近在想...",
      "我朋友跟我說...",
      "我真的覺得...",
      "我超討厭..."
    ],
    avoid: "你",
    avoidExamples: [
      "你應該...",
      "你必須...",
      "你一定要...",
      "你需要..."
    ],
    reason: "「我」開頭的貼文平均讚數比「你」開頭高 164%（4,432 vs 1,675）"
  }
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
  
  // 檢查禁止開頭詞
  for (const forbidden of OPENER_RULES.forbiddenOpeners) {
    if (firstLine.startsWith(forbidden)) {
      suggestions.push(`開頭使用了禁止詞「${forbidden}」，建議改用其他開頭`);
    }
  }
  
  // 檢查字數
  if (firstLine.length > 30) {
    suggestions.push(`開頭超過 30 字（目前 ${firstLine.length} 字），建議精簡`);
  }
  
  // 檢查人稱
  if (firstLine.startsWith('你應該') || firstLine.startsWith('你必須') || firstLine.startsWith('你一定要')) {
    suggestions.push('建議改用「我」開頭，成功率更高');
  }
  
  // 計算分數
  let score = 50;
  if (matchedHighEffect.length > 0) {
    score += matchedHighEffect.reduce((sum, p) => sum + (p.effect - 1) * 15, 0);
  }
  if (matchedLowEffect.length > 0) {
    score -= matchedLowEffect.reduce((sum, p) => sum + (1 - p.effect) * 20, 0);
  }
  if (suggestions.length > 0) {
    score -= suggestions.length * 5;
  }
  
  // 生成建議
  if (matchedHighEffect.length === 0 && suggestions.length === 0) {
    suggestions.push("建議使用「情緒爆發」或「家庭故事」格式，成功率最高");
  }
  
  return {
    matchedHighEffect,
    matchedLowEffect,
    score: Math.max(0, Math.min(100, score)),
    suggestions
  };
}

/**
 * 根據貼文類型取得推薦的開頭模式（帶權重）
 */
export function getRecommendedOpenerPatterns(contentType: string): OpenerPattern[] {
  const typePatternMap: Record<string, string[]> = {
    viewpoint: ["冒號斷言", "情緒爆發", "自白坦承", "禁忌/警告詞", "反直覺陳述"],
    story: ["家庭故事", "時間點", "對話引用", "自白坦承", "朋友故事", "情緒爆發"],
    knowledge: ["數字開頭", "禁忌/警告詞", "冒號斷言", "情緒爆發"],
    summary: ["數字開頭", "冒號斷言", "禁忌/警告詞"],
    contrast: ["冒號斷言", "情緒爆發", "禁忌/警告詞", "反直覺陳述", "自白坦承"],
    casual: ["情緒爆發", "時間點", "家庭故事", "對話引用", "朋友故事"],
    dialogue: ["對話引用", "時間點", "家庭故事", "朋友故事"],
    question: ["對話式「你」", "情緒爆發", "身分標籤"],
    poll: ["對話式「你」", "數字開頭", "情緒爆發"],
    quote: ["對話引用", "冒號斷言", "情緒爆發"],
    diagnosis: ["對話式「你」", "數字開頭", "身分標籤", "情緒爆發"]
  };
  
  const patternNames = typePatternMap[contentType] || ["情緒爆發", "家庭故事", "冒號斷言", "時間點", "自白坦承"];
  
  return HIGH_EFFECT_OPENER_PATTERNS.filter(p => patternNames.includes(p.name));
}

/**
 * 【同質性解決】隨機選擇一個開頭模式
 * 從推薦模式中加權隨機選擇（成功率越高，被選中的機率越高）
 */
export function selectRandomOpenerPattern(contentType: string): OpenerPattern {
  const recommendedPatterns = getRecommendedOpenerPatterns(contentType);
  
  // 加權隨機選擇（成功率越高的模式，被選中的機率越高）
  const totalWeight = recommendedPatterns.reduce((sum, p) => sum + (p.successRate || p.effect * 3), 0);
  let random = Math.random() * totalWeight;
  
  for (const pattern of recommendedPatterns) {
    random -= (pattern.successRate || pattern.effect * 3);
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
  
  // 常見的關鍵詞模式（擴充版）
  const keywordPatterns = [
    // 命理身心靈
    /塔羅|占卜|星座|命理|運勢|水逆|人類圖|紫微|八字|風水/g,
    // 感情
    /感情|愛情|戀愛|分手|復合|曖昧|婚姻|伴侶|單身|暗戀/g,
    // 工作
    /工作|職場|轉職|創業|副業|斜槓|離職|面試|升遷|薪水/g,
    // 情緒
    /焦慮|迷茫|壓力|情緒|療癒|成長|憂鬱|失眠|疲憊|崩潰/g,
    // 人際
    /人際|關係|溝通|界線|社交|朋友|家人|父母|小孩|同事/g,
    // 金錢
    /金錢|理財|投資|存錢|財務|收入|負債|買房|退休/g,
    // 健康
    /健康|運動|飲食|睡眠|身體|減肥|養生/g,
    // 動詞短語
    /經營自己|學習|成長|創業|溝通|時間管理|自律|堅持|放棄|改變/g
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

【數據來源】以下規則來自 17,850 篇爆款貼文的統計分析

【🎯 本次推薦的開頭模式】${selectedPattern.name}（成功率 ${selectedPattern.successRate || 'N/A'}%，效果 ${selectedPattern.effect}x）

【開頭公式】
${openerFormula}

【指令】${selectedPattern.instruction}

【範例參考】（學習格式，不要複製內容）
${selectedExamples.map((e: string, i: number) => `  ${i + 1}. ${e}`).join('\n')}

【人稱使用指引】
• 優先使用「我」開頭：${OPENER_RULES.pronounGuidelines.preferredExamples.slice(0, 3).join('、')}
• 避免使用「你應該」「你必須」等說教開頭
• 原因：${OPENER_RULES.pronounGuidelines.reason}
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
${i + 1}. ${p.name}（成功率 ${p.successRate || 'N/A'}%，效果 ${p.effect}x）
   範例：${alternativeExamples[i]?.examples.join(' / ')}
`;
    });
  }

  prompt += `
【❌ 必須避免的開頭模式】
`;

  for (const pattern of LOW_EFFECT_OPENER_PATTERNS.slice(0, 4)) {
    prompt += `• ${pattern.name}（成功率 ${pattern.successRate || 'N/A'}%）：${pattern.instruction}\n`;
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
  for (const pattern of LOW_EFFECT_OPENER_PATTERNS) {
    if (pattern.regex && pattern.regex.test(generatedFirstLine)) {
      issues.push(`使用了低效模式「${pattern.name}」`);
      score -= 20;
      suggestions.push(`避免：${pattern.instruction}`);
    }
  }
  
  // 3. 檢查是否使用了禁止開頭詞
  for (const forbidden of OPENER_RULES.forbiddenOpeners) {
    if (generatedFirstLine.startsWith(forbidden)) {
      issues.push(`使用了禁止開頭詞「${forbidden}」`);
      score -= 25;
    }
  }
  
  // 4. 檢查字數
  if (generatedFirstLine.length > 30) {
    issues.push(`開頭超過 30 字（${generatedFirstLine.length} 字）`);
    score -= 10;
    suggestions.push('建議精簡開頭，控制在 30 字以內');
  }
  
  // 5. 檢查是否包含素材關鍵詞
  const materialKeywords = extractMaterialKeywords(material);
  const hasKeyword = materialKeywords.some(kw => generatedFirstLine.includes(kw));
  if (materialKeywords.length > 0 && !hasKeyword) {
    issues.push('開頭未包含素材關鍵詞');
    score -= 15;
    suggestions.push(`建議在開頭加入：${materialKeywords.slice(0, 3).join('、')}`);
  }
  
  // 6. 檢查人稱
  if (generatedFirstLine.startsWith('你應該') || generatedFirstLine.startsWith('你必須')) {
    issues.push('使用了說教語氣的「你」開頭');
    score -= 10;
    suggestions.push('建議改用「我」開頭，成功率更高');
  }
  
  return {
    isValid: issues.length === 0,
    score: Math.max(0, score),
    issues,
    suggestions
  };
}

/**
 * 檢查開頭是否與最近使用過的開頭重複
 */
export function checkOpenerHomogeneity(
  currentOpener: string,
  recentOpeners: string[]
): {
  isHomogeneous: boolean;
  similarOpeners: string[];
  suggestions: string[];
} {
  const similarOpeners: string[] = [];
  const suggestions: string[] = [];
  
  // 提取開頭的結構特徵
  const currentPattern = extractOpenerPatternType(currentOpener);
  
  for (const recent of recentOpeners) {
    const recentPattern = extractOpenerPatternType(recent);
    
    // 檢查結構相似度
    if (currentPattern === recentPattern) {
      similarOpeners.push(recent);
    }
    
    // 檢查開頭詞相似度
    const currentFirstWord = currentOpener.slice(0, 3);
    const recentFirstWord = recent.slice(0, 3);
    if (currentFirstWord === recentFirstWord && !similarOpeners.includes(recent)) {
      similarOpeners.push(recent);
    }
  }
  
  const isHomogeneous = similarOpeners.length >= 2;
  
  if (isHomogeneous) {
    suggestions.push('最近的開頭模式過於相似，建議嘗試不同的開頭風格');
    suggestions.push(`推薦嘗試：${getAlternativeOpenerSuggestions(currentPattern).join('、')}`);
  }
  
  return {
    isHomogeneous,
    similarOpeners: Array.from(new Set(similarOpeners)),
    suggestions
  };
}

/**
 * 提取開頭的結構模式類型
 */
function extractOpenerPatternType(opener: string): string {
  // 檢查各種模式
  if (/^.{2,10}[:：]/.test(opener)) return 'colon_assertion';
  if (/^[0-9０-９一二三四五六七八九十]+[個種件點]/.test(opener)) return 'number_list';
  if (/^(千萬|絕對|一定)(不要|別|不能)/.test(opener)) return 'warning';
  if (/^如果你/.test(opener)) return 'if_you';
  if (/^(我真的|天啊|說真的|老實說)/.test(opener)) return 'emotion_burst';
  if (/^(我媽|我爸|我阿嬤|我阿公)/.test(opener)) return 'family_story';
  if (/^(我以前|我曾經|我承認)/.test(opener)) return 'confession';
  if (/^[「『"']/.test(opener)) return 'dialogue_quote';
  if (/^(昨天|今天|前幾天|上週|最近)/.test(opener)) return 'time_anchor';
  if (/^(致|給|送給)/.test(opener)) return 'identity_tag';
  if (/^(我朋友|朋友)/.test(opener)) return 'friend_story';
  
  return 'other';
}

/**
 * 取得替代開頭建議
 */
function getAlternativeOpenerSuggestions(currentPattern: string): string[] {
  const patternNames: Record<string, string> = {
    'colon_assertion': '冒號斷言',
    'number_list': '數字開頭',
    'warning': '禁忌/警告詞',
    'if_you': '對話式「你」',
    'emotion_burst': '情緒爆發',
    'family_story': '家庭故事',
    'confession': '自白坦承',
    'dialogue_quote': '對話引用',
    'time_anchor': '時間點',
    'identity_tag': '身分標籤',
    'friend_story': '朋友故事'
  };
  
  const allPatterns = Object.keys(patternNames);
  
  return allPatterns
    .filter(p => p !== currentPattern)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(p => patternNames[p] || p);
}
