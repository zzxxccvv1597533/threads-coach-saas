/**
 * 幕創行銷 Threads 經營核心知識庫
 * 整合所有 PDF 文件的核心內容，用於 AI 提示詞注入
 * 
 * 優化版本 v2.0 - 基於 17,850 篇爆款貼文分析
 */

// ==================== 人設三支柱框架 ====================
export const PERSONA_THREE_PILLARS = {
  expertise: {
    name: "專業權威",
    description: "你的專業能力與知識深度，讓受眾相信你有能力幫助他們",
    questions: [
      "你在這個領域有什麼獨特的經驗或成就？",
      "你解決過什麼具體的問題？",
      "你有什麼專業認證或背景？"
    ]
  },
  emotion: {
    name: "情感共鳴",
    description: "你的故事與經歷，讓受眾感受到你理解他們的處境",
    questions: [
      "你曾經歷過什麼困境或挑戰？",
      "你是如何走過來的？",
      "你最想幫助什麼樣的人？"
    ]
  },
  viewpoint: {
    name: "獨特觀點",
    description: "你對事物的獨特看法，讓受眾記住你、認同你",
    questions: [
      "你對這個領域有什麼不同於主流的看法？",
      "你相信什麼？反對什麼？",
      "你的核心價值觀是什麼？"
    ]
  }
};

// ==================== 爆款文案四大類型 ====================
export const VIRAL_POST_TYPES = {
  list: {
    name: "清單型",
    description: "標題點出數量，每點是獨立金句",
    structure: "標題數字 → 逐點展開 → 互動結尾",
    hookExample: "你開始轉運的五個徵兆",
    characteristics: [
      "開頭用數字吸引注意",
      "每個點獨立成段",
      "每點都是可單獨截圖的金句",
      "結尾邀請互動：「你中了幾個？」"
    ]
  },
  story: {
    name: "故事型",
    description: "以「我」開頭，有具體時間人物場景",
    structure: "場景開頭 → 轉折點 → 感悟 → 互動",
    hookExample: "昨天我朋友跟我說...",
    characteristics: [
      "開頭有具體時間：「昨天」「上週」「前幾天」",
      "有真實的人物：「朋友」「案主」「學員」",
      "有情緒轉折：「沒想到」「結果」「後來」",
      "結尾帶反思或提問"
    ]
  },
  reminder: {
    name: "提醒型",
    description: "直接對讀者說話，帶預言/祝福性質",
    structure: "預言開頭 → 解釋原因 → 祝福結尾",
    hookExample: "滑到這篇，表示好消息已經在路上",
    characteristics: [
      "開頭直接對讀者說話：「你」",
      "帶有預言或祝福的語氣",
      "給讀者正面的期待",
      "結尾邀請留言許願或接收祝福"
    ]
  },
  viewpoint: {
    name: "觀點型",
    description: "開頭就是核心觀點，後面用經歷支撐",
    structure: "觀點開頭 → 經歷佐證 → 強化觀點 → 互動",
    hookExample: "成長最快的方式，就是『硬著頭皮上』",
    characteristics: [
      "開頭直接拋出觀點",
      "用個人經歷或案例支撐",
      "觀點要有立場，不要模糊",
      "結尾問讀者：「你怎麼看？」"
    ]
  }
};

// ==================== 十大貼文類型 × 爆款元素 ====================
export const CONTENT_TYPES_WITH_VIRAL_ELEMENTS = [
  { 
    id: "knowledge", 
    name: "知識型", 
    description: "分享專業知識、技巧、方法", 
    example: "塔羅牌的三個常見誤解...",
    inputType: "full",
    inputFields: ["material"],
    structure: "golden",
    viralElements: {
      hookTips: "開頭用數字或問題：「90%的人都不知道...」「你有沒有想過...」",
      contentTips: "分點清晰，每點獨立成金句，用大白話解釋專業概念",
      ctaTips: "結尾給行動建議：「下次遇到這種情況，你可以...」",
      avoidTips: "避免太多專業術語，避免說教語氣"
    }
  },
  { 
    id: "summary", 
    name: "整理型", 
    description: "整理、歸納、清單式內容", 
    example: "5個讓你更有魅力的小習慣...",
    inputType: "full",
    inputFields: ["material", "count"],
    structure: "list",
    viralElements: {
      hookTips: "標題必須有數字：「5個」「3種」「7件事」",
      contentTips: "每點獨立成段，每點都是可單獨截圖的金句",
      ctaTips: "結尾問：「你中了幾個？」「還有什麼想補充的？」",
      avoidTips: "避免每點太長，避免沒有結論"
    }
  },
  { 
    id: "story", 
    name: "故事型", 
    description: "個人經歷、案例分享", 
    example: "今天有個案主問我...",
    inputType: "full",
    inputFields: ["material"],
    structure: "narrative",
    viralElements: {
      hookTips: "開頭用具體時間：「昨天」「上週」「前幾天」，加上真實人物",
      contentTips: "有情緒轉折：「沒想到」「結果」「後來」，用對話增加真實感",
      ctaTips: "結尾帶反思：「這件事讓我明白...」，然後問讀者經驗",
      avoidTips: "避免流水帳，避免沒有轉折點"
    }
  },
  { 
    id: "viewpoint", 
    name: "觀點型", 
    description: "表達立場、價值觀", 
    example: "我一直相信...",
    inputType: "stance",
    inputFields: ["stance", "reason"],
    structure: "argument",
    viralElements: {
      hookTips: "開頭直接拋出觀點，要有立場不要模糊",
      contentTips: "用 2-3 個論點或經歷支撐，觀點要能引發討論",
      ctaTips: "結尾問：「你怎麼看？」「你同意嗎？」",
      avoidTips: "避免太激進或攻擊性，避免沒有支撐的空談"
    }
  },
  { 
    id: "contrast", 
    name: "反差型", 
    description: "打破認知、製造驚喜", 
    example: "很多人以為...其實...",
    inputType: "contrast",
    inputFields: ["common_belief", "truth"],
    structure: "twist",
    viralElements: {
      hookTips: "開頭用「很多人以為...」「大家都說...」製造預期",
      contentTips: "轉折要明確：「但其實...」「真相是...」，解釋為什麼",
      ctaTips: "結尾問：「你也有這種經驗嗎？」「你以前也這樣想嗎？」",
      avoidTips: "避免反差太弱，避免沒有解釋原因"
    }
  },
  { 
    id: "casual", 
    name: "閒聊型", 
    description: "日常分享、輕鬆互動", 
    example: "今天發生了一件有趣的事...",
    inputType: "simple",
    inputFields: ["topic"],
    structure: "free",
    viralElements: {
      hookTips: "開頭用日常場景：「今天」「剛剛」「突然想到」",
      contentTips: "語氣輕鬆，像在跟朋友聊天，可以有小抱怨或小發現",
      ctaTips: "結尾問：「你們有過這種經驗嗎？」「只有我這樣嗎？」",
      avoidTips: "避免太正經，避免沒有互動點"
    }
  },
  { 
    id: "dialogue", 
    name: "對話型", 
    description: "對話截圖、問答形式", 
    example: "朋友問我：「你怎麼知道...」",
    inputType: "dialogue",
    inputFields: ["question", "context"],
    structure: "qa",
    viralElements: {
      hookTips: "開頭用引號呈現對話：「朋友問我...」「有人問我...」",
      contentTips: "對話要有情緒轉折，回答要有觀點不只是資訊",
      ctaTips: "結尾問：「你們會怎麼回答？」「換作是你呢？」",
      avoidTips: "避免對話太長，避免回答太說教"
    }
  },
  { 
    id: "question", 
    name: "提問型", 
    description: "引發思考、徵求意見", 
    example: "你們覺得...?",
    inputType: "question",
    inputFields: ["topic"],
    structure: "question",
    viralElements: {
      hookTips: "開頭直接拋出問題，問題要能引發思考或共鳴",
      contentTips: "可以加一兩句背景說明，但不要太長",
      ctaTips: "結尾用「你們覺得呢？」「想聽聽大家的看法」",
      avoidTips: "避免問題太複雜，避免自己先給答案"
    }
  },
  { 
    id: "poll", 
    name: "投票型", 
    description: "選擇題、投票互動", 
    example: "A還是B？",
    inputType: "poll",
    inputFields: ["topic", "options"],
    structure: "poll",
    viralElements: {
      hookTips: "開頭簡短介紹投票主題，選項要有趣或有爭議性",
      contentTips: "選項用 A/B 或數字標註，可以加上選項的小描述",
      ctaTips: "結尾用「留言告訴我你的選擇」「選好的留言+1」",
      avoidTips: "避免選項太多，避免選項太相似"
    }
  },
  { 
    id: "quote", 
    name: "引用型", 
    description: "引用名言、他人觀點", 
    example: "「...」這句話讓我想到...",
    inputType: "quote",
    inputFields: ["quote", "reflection"],
    structure: "reflection",
    viralElements: {
      hookTips: "開頭引用這句話，選擇能引發共鳴的句子",
      contentTips: "分享你的解讀或相關經歷，讓引用變成你的觀點",
      ctaTips: "結尾問：「這句話對你來說有什麼意義？」",
      avoidTips: "避免只引用不解讀，避免解讀太長"
    }
  },
  { 
    id: "diagnosis", 
    name: "診斷型", 
    description: "幫讀者診斷問題、分類標籤", 
    example: "如果你經常...那你可能是...",
    inputType: "diagnosis",
    inputFields: ["symptoms", "diagnosis_label", "explanation"],
    structure: "diagnosis",
    viralElements: {
      hookTips: "開頭用「特徵召喚」：「如果你經常...」「你有沒有這種經驗...」",
      contentTips: "結構：特徵召喚 → 標籤揭曉 → 簡單解析 → CTA。讓讀者覺得「天啊這就是在說我」",
      ctaTips: "結尾問：「你是哪一型？」「有沒有中？」「想知道更多可以留言」",
      avoidTips: "避免標籤太負面或攻擊性，要讓讀者感到被理解而不是被評判"
    }
  }
];

// 保留舊的 CONTENT_TYPES 以維持向後相容
export const CONTENT_TYPES = CONTENT_TYPES_WITH_VIRAL_ELEMENTS.map(t => ({
  id: t.id,
  name: t.name,
  description: t.description,
  example: t.example,
  inputType: t.inputType,
  inputFields: t.inputFields,
  structure: t.structure
}));

// ==================== 禁止詞彙列表（優化版 - 擴充到 80+ 個） ====================
export const FORBIDDEN_PHRASES = {
  // 開頭禁止詞（擴充到 25+ 個）
  openingForbidden: [
    // 原有
    "讓我們",
    "一起來",
    "今天要分享",
    "不妨",
    "其實",
    "首先",
    "接下來",
    "在這篇文章中",
    // 新增 - AI 常見開頭
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
    "我必須承認",
    "不得不說",
    "說實話",
    "坦白說",
    "老實說"
  ],
  
  // 內容禁止詞（擴充到 30+ 個）
  contentForbidden: [
    // 原有
    "親愛的朋友們",
    "各位",
    "大家好",
    "相信大家",
    "眾所周知",
    "不言而喻",
    "毋庸置疑",
    // 新增 - AI 常見連接詞
    "值得一提的是",
    "不可否認",
    "顯而易見",
    "由此可見",
    "綜上所述",
    "總而言之",
    "換言之",
    "簡而言之",
    "總的來說",
    "歸根結底",
    "不僅如此",
    "與此同時",
    "此外",
    "因此",
    "然而",
    "事實上",
    "實際上",
    "基本上",
    "本質上",
    "某種程度上",
    "在某種意義上",
    "從某種角度來看",
    "從這個角度來說"
  ],
  
  // CTA 禁止詞（保持原有）
  ctaForbidden: [
    "立即購買",
    "限時優惠",
    "馬上行動",
    "不要錯過",
    "趕快",
    "立刻"
  ],
  
  // 結尾禁止詞（新增）
  endingForbidden: [
    "希望對你有幫助",
    "希望這篇文章對你有幫助",
    "希望能幫助到你",
    "以上就是我的分享",
    "感謝你的閱讀",
    "謝謝你看到這裡",
    "如果你喜歡這篇文章",
    "歡迎留言告訴我",
    "期待你的留言",
    "加油！你可以的！",
    "相信自己！",
    "一起加油！",
    "祝福大家",
    "願你"
  ],
  
  // 格式禁止符號（保持原有）
  formatForbidden: [
    "**",
    "##",
    "###",
    "```",
    "---",
    "___"
  ],
  
  // 髒話禁止詞（保持原有）
  profanityForbidden: [
    // 英文髒話
    "Fuck", "fuck", "FUCK",
    "FK", "fk", "F*ck", "f*ck",
    "Shit", "shit", "SHIT", "sh*t",
    "Damn", "damn", "DAMN",
    "Ass", "ass", "ASS",
    "Bitch", "bitch", "BITCH",
    "WTF", "wtf", "STFU", "stfu",
    // 中文髒話
    "靠", "靠北", "靠幸",
    "幹", "幹你", "幹他",
    "媽的", "他媽的", "你媽的",
    "操", "操你",
    "屁", "屁話", "放屁",
    "賤", "賤人",
    "婊", "婊子",
    "屎", "狗屎",
    "去死", "死開",
    "白癡", "白吃",
    "智障", "弱智"
  ],
  
  // 過度正向詞（新增 - 基於爆款分析，高讚貼文很少使用這些詞）
  overlyPositiveForbidden: [
    "絕對",
    "一定",
    "必須",
    "完美",
    "最好",
    "最棒",
    "超級棒",
    "太厲害了",
    "太強了",
    "無敵",
    "神級",
    "頂級"
  ],
  
  // AI 常見成語（新增 - 這些成語在高讚貼文中幾乎不出現）
  aiIdiomsForbidden: [
    "盆滿缽滿",
    "入不敷出",
    "捉襟見肘",
    "披荊斬棘",
    "孜孜不倦",
    "鍥而不捨",
    "廢寢忘食",
    "事半功倍",
    "事倍功半",
    "功虧一簣",
    "水到渠成",
    "心力交瘁",
    "焦頭爛額",
    "欲哭無淚",
    "喜出望外",
    "一針見血",
    "醍醐灌頂",
    "茅塞頓開",
    "如魚得水",
    "游刃有餘",
    "得心應手",
    "循序漸進",
    "深入淺出",
    "言簡意賅",
    "一語中的"
  ]
};

// ==================== Threads 風格指南 ====================
export const THREADS_STYLE_GUIDE = {
  principles: [
    {
      name: "五年級可讀性",
      description: "文案要簡單到五年級小孩都能懂",
      tips: ["避開專業術語", "用大白話解釋", "簡單才是傳播的王道"]
    },
    {
      name: "黃金開局",
      description: "前 3 行是生死線",
      tips: ["開頭必須有強烈的鉤子", "加一句預示告訴讀者結尾會發生什麼", "給讀者一個看到最後的理由"]
    },
    {
      name: "情緒推動",
      description: "用轉折和因果推動故事",
      tips: ["轉折詞：但是、然而、沒想到", "因果詞：因此、所以、於是", "懸念詞：直到有一天、這件事徹底改變了"]
    },
    {
      name: "一句一行",
      description: "每個句子獨立成段",
      tips: ["方便手機閱讀", "增加呼吸感", "讓重點更突出"]
    },
    {
      name: "真人說話",
      description: "像朋友聊天，不像品牌廣告",
      tips: ["用「我」「你」", "用口語化表達", "有情緒有溫度"]
    }
  ],
  formatting: {
    paragraphLength: "3-4 行一段",
    sentenceLength: "一句話不超過 20 字",
    useEmptyLines: true,
    noMarkdown: true
  },
  // 新增：人稱使用指引（基於爆款分析）
  pronounGuidelines: {
    preferred: "我",
    reason: "「我」開頭的貼文平均讚數比「你」開頭高 164%",
    examples: [
      "我發現...",
      "我以前也...",
      "我最近在想...",
      "我朋友跟我說..."
    ],
    avoid: [
      "你應該...",
      "你必須...",
      "你一定要..."
    ]
  }
};

// ==================== 靈活輸入欄位定義 ====================
export const FLEXIBLE_INPUT_FIELDS: Record<string, { label: string; placeholder: string; required: boolean; description: string }> = {
  material: {
    label: "素材/主題",
    placeholder: "例如：最近很多人問我關於自我懷疑的問題...",
    required: true,
    description: "你想分享的主題或素材"
  },
  count: {
    label: "清單項目數",
    placeholder: "例如：5",
    required: false,
    description: "你想列出幾個重點（建議 3-7 個）"
  },
  stance: {
    label: "你的觀點/立場",
    placeholder: "例如：我認為自我懷疑不是壞事...",
    required: true,
    description: "你想表達的核心觀點"
  },
  reason: {
    label: "支撐理由",
    placeholder: "例如：因為我自己也曾經歷過...",
    required: false,
    description: "為什麼你有這個觀點？可以用經歷或案例支撐"
  },
  common_belief: {
    label: "大家通常認為",
    placeholder: "例如：很多人認為要先有自信才能行動...",
    required: true,
    description: "大家普遍的認知或迷思"
  },
  truth: {
    label: "但其實",
    placeholder: "例如：但其實行動才能帶來自信...",
    required: true,
    description: "你想分享的真相或反差觀點"
  },
  topic: {
    label: "主題/話題",
    placeholder: "例如：今天的心情...",
    required: true,
    description: "你想聊的話題"
  },
  question: {
    label: "別人問你的問題",
    placeholder: "例如：朋友問我「你怎麼知道自己適合什麼？」",
    required: true,
    description: "別人問你的問題，用引號包起來"
  },
  context: {
    label: "背景說明",
    placeholder: "例如：這是在聊到職涯轉換的時候...",
    required: false,
    description: "這個對話發生的背景"
  },
  options: {
    label: "投票選項",
    placeholder: "例如：A. 先存錢再說 / B. 先投資自己",
    required: true,
    description: "用 A/B 或數字列出選項"
  },
  quote: {
    label: "引用的句子",
    placeholder: "例如：「成功不是終點，失敗也不是終結」",
    required: true,
    description: "你想引用的名言或句子"
  },
  reflection: {
    label: "你的解讀",
    placeholder: "例如：這句話讓我想到...",
    required: false,
    description: "你對這句話的解讀或感想"
  },
  // 診斷型貼文欄位
  symptoms: {
    label: "特徵/症狀",
    placeholder: "例如：經常覺得累、容易想太多、常常懷疑自己...",
    required: true,
    description: "描述讀者可能有的特徵或症狀（用「如果你...」的方式）"
  },
  diagnosis_label: {
    label: "診斷標籤",
    placeholder: "例如：高敏人、完美主義者、慈悲疲勞型...",
    required: true,
    description: "給這種特徵一個標籤或名稱"
  },
  explanation: {
    label: "簡單解析",
    placeholder: "例如：這其實是因為你太在乎別人的感受...",
    required: false,
    description: "簡單解釋為什麼會有這種特徵"
  }
};

// ==================== Hook 風格（優化版 - 新增高效模式） ====================
export const HOOK_STYLES = [
  { id: "mirror", name: "鏡像開頭", description: "直接說出受眾的心聲", example: "你是不是也常常...", effectMultiplier: 1.2 },
  { id: "contrast", name: "反差開頭", description: "打破預期的陳述", example: "很多人以為...但其實...", effectMultiplier: 1.3 },
  { id: "scene", name: "場景開頭", description: "描繪具體畫面", example: "昨天晚上，我坐在電腦前...", effectMultiplier: 1.4 },
  { id: "question", name: "提問開頭", description: "直接拋出問題", example: "你有沒有想過...", effectMultiplier: 1.1 },
  { id: "data", name: "數據開頭", description: "用數字吸引注意", example: "90%的人都不知道...", effectMultiplier: 1.2 },
  // 新增 - 基於爆款分析的高效模式
  { id: "emotion_burst", name: "情緒爆發開頭", description: "直接表達強烈情緒", example: "我真的受夠了...", effectMultiplier: 1.5 },
  { id: "family_story", name: "家庭故事開頭", description: "以家人為主角的故事", example: "我媽昨天突然跟我說...", effectMultiplier: 1.6 },
  { id: "confession", name: "自白開頭", description: "坦承自己的弱點或錯誤", example: "我以前也是這樣...", effectMultiplier: 1.4 },
  { id: "dialogue_quote", name: "對話引用開頭", description: "直接引用對話", example: "「你為什麼要這樣？」", effectMultiplier: 1.3 },
  { id: "identity_tag", name: "身分標籤開頭", description: "用身分標籤召喚讀者", example: "致所有正在迷茫的人...", effectMultiplier: 1.2 },
  { id: "time_anchor", name: "時間錨點開頭", description: "用具體時間點開頭", example: "昨天凌晨三點...", effectMultiplier: 1.4 }
];

// ==================== 四透鏡優化框架 ====================
export const FOUR_LENS_FRAMEWORK = {
  emotion: {
    name: "心法透鏡",
    question: "這篇文案傳遞的是渴望還是焦慮？",
    principle: "渴望導向：讓讀者看到美好的可能性，而不是恐嚇他們",
    checkpoints: [
      "是否描繪了美好的結果？",
      "是否讓人感到希望而非恐懼？",
      "情緒基調是正向的嗎？"
    ],
    whyBad: "焦慮行銷會讓讀者反感，短期有效但長期傷害信任"
  },
  persona: {
    name: "人設透鏡",
    question: "這篇文案像不像你說的話？",
    principle: "語氣一致：確保文案符合你的人設三支柱",
    checkpoints: [
      "語氣是否符合你平常的說話方式？",
      "是否展現了你的專業/情感/觀點？",
      "讀者能認出這是你寫的嗎？"
    ],
    whyBad: "語氣不一致會讓讀者感到陌生，降低信任感"
  },
  structure: {
    name: "結構透鏡",
    question: "這篇文案好不好吸收？",
    principle: "呼吸感：多段落、空白行、短句，讓閱讀輕鬆",
    checkpoints: [
      "段落是否夠短（3-4行一段）？",
      "是否有足夠的空白行？",
      "句子是否簡潔有力？"
    ],
    whyBad: "結構混亂會讓讀者直接滑過，再好的內容也沒人看"
  },
  conversion: {
    name: "轉化透鏡",
    question: "讀者看完要做什麼？",
    principle: "明確CTA：引導讀者採取下一步行動（優先引導留言）",
    checkpoints: [
      "CTA是否清楚明確？",
      "行動門檻是否夠低？",
      "是否優先引導留言互動？"
    ],
    whyBad: "沒有 CTA 等於浪費流量，讀者不知道下一步該做什麼"
  }
};

// ==================== Threads 演算法規則 ====================
export const THREADS_ALGORITHM = {
  weightOrder: [
    { action: "留言回覆", weight: "最高", note: "回覆留言是最重要的互動" },
    { action: "引用轉發", weight: "高", note: "引用你的貼文表示高度認同" },
    { action: "收藏", weight: "中高", note: "收藏代表內容有價值" },
    { action: "愛心", weight: "中", note: "按讚是基本互動" }
  ],
  bestPractices: [
    "發文後30分鐘內積極回覆留言",
    "每天主動去別人貼文留言（海巡）",
    "回覆要有溫度，不要只是表情符號",
    "善用引用轉發來延伸討論"
  ],
  contentRatio: {
    emotional: 70,
    promotional: 30,
    description: "70%情緒互動內容，30%品牌/產品相關"
  },
  postingTime: {
    weekday: ["12:00-13:00", "18:00-20:00"],
    weekend: ["10:00-12:00", "20:00-22:00"],
    note: "工作日中午和傍晚，週末上午和晚間"
  }
};

// ==================== 互動任務類型（優化版 - 加入時間等級和具體指引） ====================
export const INTERACTION_TASK_TYPES = {
  reply_comments: {
    name: "回覆留言",
    description: "回覆自己貼文下的留言",
    priority: 1,
    timeLevel: "5分鐘",
    targetCount: "全部回覆",
    tips: [
      "發文後30分鐘內優先回覆",
      "回覆要有溫度，延伸話題",
      "可以反問對方，創造對話"
    ],
    templates: [
      "謝謝你的分享！我也很好奇你是怎麼...",
      "真的超有共鳴！你有沒有遇過...",
      "哇，這個角度我沒想過耶！可以多說一點嗎？"
    ]
  },
  comment_others: {
    name: "串門子",
    description: "去別人的貼文留言互動",
    priority: 2,
    timeLevel: "15分鐘",
    targetCount: "5-10則",
    tips: [
      "選擇同領域或目標受眾會關注的帳號",
      "留言要有觀點，不要只說「讚」",
      "可以分享自己的經驗或補充"
    ],
    templates: [
      "這個觀點我也有同感！我之前遇到...",
      "補充一個我的經驗：...",
      "好奇問一下，如果是...的情況你會怎麼處理？"
    ],
    targetAccounts: [
      "同領域的創作者（不是競爭對手，是合作弥伴）",
      "目標受眾會追蹤的帳號",
      "經常發與你專業相關內容的帳號"
    ]
  },
  sea_patrol: {
    name: "海巡",
    description: "主動搜尋並參與相關話題討論",
    priority: 3,
    timeLevel: "20分鐘",
    targetCount: "3-5則",
    tips: [
      "搜尋你的專業關鍵字",
      "找到正在討論相關話題的貼文",
      "提供有價值的回覆，建立專業形象"
    ],
    templates: [
      "跟你分享一個我在這方面的經驗...",
      "我是做...的，這個問題我常遇到，我的建議是...",
      "這個話題我也很有興趣！從我的專業角度來看..."
    ],
    searchKeywords: [
      "你的專業關鍵字",
      "目標受眾的痛點關鍵字",
      "產業趨勢關鍵字"
    ]
  }
};

// ==================== 產品矩陣 ====================
export const PRODUCT_MATRIX = {
  lead: {
    name: "引流品",
    priceRange: "0-499",
    purpose: "吸引潛在客戶，建立初步信任",
    characteristics: [
      "時間成本低（可快速體驗）",
      "與核心服務強相關",
      "可體驗到價值",
      "定價無痛（低門檻）",
      "合規性（不違反平台規則）"
    ],
    examples: ["免費電子書", "低價工作坊", "體驗諮詢"]
  },
  core: {
    name: "核心品",
    priceRange: "500-5000",
    purpose: "主力產品，創造主要營收",
    characteristics: [
      "解決核心問題",
      "有完整的交付流程",
      "可複製或規模化"
    ],
    examples: ["線上課程", "團體諮詢", "會員方案"]
  },
  vip: {
    name: "VIP品",
    priceRange: "5000+",
    purpose: "高價值服務，深度陪伴",
    characteristics: [
      "一對一或小班制",
      "長期陪伴",
      "客製化服務"
    ],
    examples: ["一對一教練", "年度顧問", "私人訂製"]
  },
  passive: {
    name: "被動品",
    priceRange: "不限",
    purpose: "自動化收入，時間槓桿",
    characteristics: [
      "一次製作，重複銷售",
      "不需要即時交付",
      "可自動化流程"
    ],
    examples: ["數位產品", "模板", "錄播課程"]
  }
};

// ==================== 經營目標 ====================
export const BUSINESS_GOALS = {
  monetize: {
    name: "商業變現",
    kpis: ["私訊/Email詢問量", "主頁連結點擊率", "名單增長", "實際轉換率"],
    focus: "內容要有明確的轉換路徑"
  },
  influence: {
    name: "擴大影響力",
    kpis: ["追蹤者增長", "曝光/觸及", "引用轉發次數", "跨圈互動數"],
    focus: "內容要有傳播性和話題性"
  },
  expression: {
    name: "自我表達",
    kpis: ["互動留言品質", "被收藏數", "被引用數", "粉絲記憶度"],
    focus: "內容要有獨特觀點和個人風格"
  }
};

// ==================== 系統提示詞模板（優化版 v2.0） ====================
export const SYSTEM_PROMPTS = {
  contentGeneration: `你是一位專業的 Threads 內容創作教練，專門幫助創作者產出高互動的貼文。

=== 最重要的一條規則（必讀） ===

你必須「成為」這位創作者，而不是「協助」他。

想像你就是這個人，用他的口氣說話、用他的語言習慣、用他的思考方式。

如果他的句子很短，你的句子就要很短。
如果他喜歡用「真的」開頭，你就要用「真的」開頭。
如果他的語氣很溫暖，你就要很溫暖。

不要寫得「比他更好」，要寫得「像他」。

=== 核心創作原則 ===

1. 「五年級可讀性」原則：
   - 文案要簡單到五年級小孩都能懂
   - 避開專業術語，用大白話解釋
   - 簡單，才是傳播的王道

2. 「黃金開局」原則（前 3 行是生死線）：
   - 開頭必須有強烈的「鉤子」讓讀者停下
   - 加一句「預示」告訴讀者結尾會發生什麼
   - 給讀者一個看到最後的理由

3. 「情緒推動」原則：
   - 用轉折和因果來推動故事情緒
   - 讓讀者一直有「接下來會怎樣」的期待感
   - 可用：轉折（但是、然而、沒想到）、因果（因此、所以、於是）、懸念（直到有一天...、這件事徹底改變了...）、對比（我以為...結果...）、遞進（不只是...更是...）

4. 「故事化」原則：
   - 任何主題都能火，關鍵是注入「故事」和「轉折」
   - 不是羅列功能，而是講一個吸引人的故事
   - 觀眾滿意度和分享性比留存率更重要

5. 「人設一致」原則：
   - 必須用創作者的語氣風格來寫作
   - 必須展現創作者的人設三支柱（專業/情感/觀點）
   - 可以引用創作者的英雄旅程故事

6. 「渴望導向」原則：
   - 內容要讓讀者看到美好的可能性
   - 不用恐嚇行銷，用渴望引導
   - 像朋友分享，不是銷售文案

=== 人稱使用指引（基於 17,850 篇爆款分析） ===
優先使用「我」開頭：
- 「我」開頭的貼文平均讚數比「你」開頭高 164%
- 推薦開頭：「我發現...」「我以前也...」「我最近在想...」「我朋友跟我說...」
- 避免開頭：「你應該...」「你必須...」「你一定要...」

=== 禁止詞彙（絕對不能使用） ===
開頭禁止：「讓我們」「一起來」「今天要分享」「不妨」「其實」「首先」「接下來」「說到」「談到」「關於」「對於」「身為一個」「作為一位」
內容禁止：「親愛的朋友們」「各位」「大家好」「相信大家」「眾所周知」「值得一提的是」「不可否認」「顯而易見」「由此可見」「綜上所述」「總而言之」
結尾禁止：「希望對你有幫助」「以上就是我的分享」「感謝你的閱讀」「加油！你可以的！」
成語禁止：「盆滿缽滿」「披荊斬棘」「事半功倍」「醍醐灌頂」「茅塞頓開」「如魚得水」「游刃有餘」「深入淺出」

=== 髒話與粗俗用語禁止（絕對禁止，無例外） ===
嚴禁使用任何髒話、粗俗用語、不雅詞彙，包括但不限於：
- 英文髒話：Fuck、FK、F*ck、Shit、Damn、Ass、Bitch、WTF、STFU
- 中文髒話：靠、幹、媽的、他媽的、操、屁、賤、婊、屎、去死、白癡、智障
- 變體寫法：F開頭的任何暗示性詞彙、用符號替代的髒話（如 f**k、sh*t）
- 即使創作者的風格偏向犀利或直白，也絕對不能使用髒話
- 可以用「天啊」「真的假的」「傻眼」「無言」「暈」等表達情緒，但不能用髒話

=== 格式要求 ===
- 呼吸感：多段落、空白行、短句，讓閱讀輕鬆
- 一句一行：每個句子獨立成段
- 互動優先：文末要有明確的互動引導，優先引導留言
- 禁止 Markdown：不要用 **、*、#、\`、- 等符號，直接用空行分段
- 禁止教學文章格式：不要用「邏輯一、邏輯二、邏輯三」、「第一點、第二點」、「重點一、重點二」這種編號標題
- 禁止粗體標題：不要用「👉 **標題**」這種格式，讓內容自然流動
- 像聊天不像教學：Threads 貼文應該像朋友聊天，不是教學文章或懶人包

=== Emoji 條列式規則（針對知識型/懶人包內容） ===
- 禁止：傳統數字條列（1. 2. 3.）、Markdown 條列（- •）
- 允許：Emoji 開頭的條列式（✨ / 👉 / 🔥 / ✅）
- 使用時機：知識型、整理型、懶人包內容可以用 3-5 點 Emoji 條列
- 其他類型：故事型、觀點型、閃聊型不要用條列，用段落式敍述

=== Threads 演算法重點 ===
- 留言回覆權重最高
- 內容比例建議 70%情緒互動 / 30%品牌產品
- 發文後30分鐘內積極回覆留言很重要`,

  optimization: `你是一位文案優化專家，使用「幕創透鏡框架」來優化文案。

=== 四透鏡檢查 ===
1. 心法透鏡：傳遞渴望還是焦慮？
2. 人設透鏡：像不像創作者說的話？
3. 結構透鏡：好不好吸收？
4. 轉化透鏡：讀者看完要做什麼？

=== 優化原則 ===
1. 「五年級可讀性」：文案要簡單到五年級小孩都能懂，避開專業術語
2. 「黃金開局」：前 3 行必須有強烈的鉤子，讓讀者想看完
3. 「情緒推動」：用轉折和因果推動故事，讓讀者有期待感
4. 「人設一致」：調整語氣符合創作者的風格
5. 「呼吸感」：多段落、空白行、短句，讓閱讀輕鬆
6. 「互動引導」：強化文末互動引導，優先引導留言

=== 禁止詞彙 ===
開頭禁止：「讓我們」「一起來」「今天要分享」「不妨」「其實」「說到」「談到」「關於」
內容禁止：「親愛的朋友們」「各位」「大家好」「相信大家」「值得一提的是」「由此可見」
結尾禁止：「希望對你有幫助」「以上就是我的分享」「加油！你可以的！」
成語禁止：「盆滿缽滿」「披荊斬棘」「事半功倍」「醍醐灌頂」「茅塞頓開」
髒話禁止：絕對不能使用任何髒話、粗俗用語（Fuck、FK、靠、幹、媽的等）

=== 優化時要 ===
- 保留原文的核心訊息
- 簡化複雜的表達，用大白話重寫
- 確保開頭有足夠的吸引力
- 增加轉折和情緒推動
- 不要使用 Markdown 符號`,

  interactionSuggestion: `你是一位 Threads 互動策略顧問，幫助創作者提升互動品質。

互動原則：
1. 回覆要有溫度，不要只是表情符號
2. 延伸話題，創造對話機會
3. 可以反問對方，增加互動深度
4. 展現專業但不說教

海巡策略：
- 選擇同領域帳號互動
- 留言要有觀點和價值
- 建立長期互動關係`
};

// ==================== 數據驗證的 Hook 類型（基於 50 帳號 29,475 篇分析） ====================
export const DATA_DRIVEN_HOOK_TYPES = [
  {
    id: 'number_data',
    name: '數字/數據開頭',
    shareOfTop200: 34,
    bestFor: '清單、工具、教學',
    template: '[N] 個 [某領域的工具/技巧/方法]，[具體好處/省下的時間/解決的痛點]',
    realExamples: [
      '15 個好用的 ChatGPT 提示詞，每週為您節省 20 小時',
      '5 個我最常用的文案指令，讓你直接複製貼上就能用',
      '11 門真的「免費＋拿得到證書」的 AI 課程',
    ],
    adaptationFormula: '[N] 個 [你的專業領域的工具/技巧/方法]，[具體好處/省下的時間/解決的痛點]',
  },
  {
    id: 'extreme_adjective',
    name: '極端形容詞/震撼',
    shareOfTop200: 17,
    bestFor: '情緒型、驚喜揭露',
    template: '我真的 [極端反應]。[簡短原因]...',
    realExamples: [
      '我真的嚇到。用 ChatGPT 幫我分析職涯，本來只是想玩玩看，結果它講的每一點…都像在翻我內心劇本。',
      '這真的太狂了 🎮🔥 用 AI 來 Vibe coding 完全改寫了遊戲開發的玩法！',
      '我覺得好諷刺！眾量級 Andy 失去頻道的事跟我當年失去東京著衣超級類似！',
    ],
    adaptationFormula: '我真的[嚇到/傻眼/沒想到]。[用你的專業做了某件事]，[出乎意料的結果]...',
  },
  {
    id: 'personal_experience',
    name: '個人經驗/故事',
    shareOfTop200: 8,
    bestFor: '個人品牌、信任建立',
    template: '[時間標記或場景]，[個人時刻]，[意外轉折]...',
    realExamples: [
      '我把婚顧退掉了，用 ChatGPT 規劃出完美婚禮（還免費）',
      '朋友用 ChatGPT 改 LinkedIn，沒買工具、沒請別人寫履歷，結果一堆獵頭主動加他好友。',
      '我經營餐飲已經十年了，領悟到一種最強的賺錢方式，但我學不來...',
    ],
    adaptationFormula: '[我/我朋友/某人] + [做了某件事] + [意外的好結果或壞結果]...',
  },
  {
    id: 'negation_warning',
    name: '否定/警告開頭',
    shareOfTop200: 4,
    bestFor: '糾正型、反向權威',
    template: '不要再 [常見錯誤]。[為什麼是錯的]。[更好的替代方案]:',
    realExamples: [
      '不要再叫 ChatGPT「幫我摘要」因為那只會得到機械、沒靈魂的筆記。',
      '不要再丟「幫我寫履歷」給 ChatGPT 了。結果都寬寬鬆鬆、沒重點，HR 一看就滑掉。',
      '別再亂買 AI 課啦！我幫你整理了 11 門真的「免費＋拿得到證書」的 AI 課程',
    ],
    adaptationFormula: '不要再[你的受眾常犯的錯誤]。[為什麼這是錯的]。[你提供的更好方法]:',
  },
  {
    id: 'question_hook',
    name: '疑問句/提問',
    shareOfTop200: 4,
    bestFor: '互動、社群建設',
    template: '[共鳴情境/兩難]？[2-3 個選項或開放問題]',
    realExamples: [
      '有沒有2000年後生的朋友？？如果動動已經是老人拍的了，那你各位都拍什麼啊？？',
      '同樣30歲 A：環遊世界，存款10萬 B：穩定工作，存款500萬。你會選哪一個？',
      '你覺得禁菸，是在限制吸菸者的權利、還是保護人民的健康？',
    ],
    adaptationFormula: '[你的受眾會遇到的兩難情境]？[A選項 vs B選項]，你會怎麼選？',
  },
  {
    id: 'scene_dialogue',
    name: '場景式對話開頭',
    shareOfTop200: 0, // 無明確佔比，但在命理/寵物/情感領域極高
    bestFor: '故事型領域、高沉浸',
    template: '[某人說]: "..." → [另一人反應] → [轉折或笑點]',
    realExamples: [
      '媽：寶寶你下禮拜要生日了耶！想要什麼禮物？ 🐱：我想要把媽媽化妝桌上的東西全部打到地板上',
      '她看了我一眼，輕聲說：「我知道啊，你是例外。可是人有時候，是會被整個世界消耗掉的。」',
      '有人問：「考上正式老師還辭職，會不會很可惜？」',
    ],
    adaptationFormula: '[某人問/說]：「[你的受眾常被問到的問題]」→ [你的/主角的反應] → [出乎意料的回答或轉折]',
  },
];

// ==================== Hook 組合模式（最高互動） ====================
export const HOOK_COMBINATION_PATTERNS = [
  {
    id: 'number_negation',
    name: '數字+否定',
    avgEngagement: 1500,
    template: '不要再X了。這N個方法才是正解',
    example: '不要再叫 ChatGPT「幫我摘要」了。這 5 個指令才是正確用法：',
  },
  {
    id: 'shock_personal',
    name: '震撼+個人經驗',
    avgEngagement: 1200,
    template: '我真的嚇到。我用X做了Y...',
    example: '我真的嚇到。用 ChatGPT 幫我分析職涯，結果它講的每一點都像在翻我內心劇本。',
  },
  {
    id: 'number_personal',
    name: '數字+個人經驗',
    avgEngagement: 1100,
    template: '我朋友用X做了Y，N天就看到效果',
    example: '朋友用 ChatGPT 改 LinkedIn，3 天就收到 5 個獵頭邀請。',
  },
  {
    id: 'question_scene',
    name: '疑問+場景',
    avgEngagement: 1000,
    template: '如果你手上N萬，你會怎麼規劃？',
    example: '如果你手上500萬，你會選擇買房還是投資？',
  },
];

// ==================== 互動機制設計（三大引擎） ====================
export const ENGAGEMENT_ENGINES = {
  share: {
    name: '分享引擎',
    goal: '最大化分享/轉發',
    strategies: [
      '提供「可直接複製」的內容（提示詞、模板、檢查清單）',
      '創造「懶人包」或「整理」型內容，有收藏價值',
      '使用情感共鳴（「不要曬你...」「藏在...」）',
    ],
    ctaExamples: [
      '直接複製就能用 👆',
      '存起來，之後一定用得到',
      '分享給需要的朋友',
    ],
  },
  comment: {
    name: '留言引擎',
    goal: '最大化留言互動',
    strategies: [
      '問開放式問題（「你會選哪個？」「你怎麼回？」）',
      '創造爭議或辯論場景',
      '使用 CTA：「留言『XX』就可以獲得...」',
    ],
    ctaExamples: [
      '你會選 A 還是 B？留言告訴我',
      '你有過類似的經驗嗎？',
      '留言「+1」我私訊你完整版',
    ],
  },
  like: {
    name: '讚數引擎',
    goal: '最大化按讚數',
    strategies: [
      '用簡短形式傳遞清晰價值',
      '使用共鳴觀察（讀者心想「對！就是這樣」）',
      '強烈情感共鳴，不需要讀者採取行動',
    ],
    ctaExamples: [
      '（不需要明確 CTA，讓內容自然引發共鳴）',
    ],
  },
};

// ==================== 數據驗證的寫作規則 ====================
export const DATA_DRIVEN_WRITING_RULES = {
  lengthSweetSpot: {
    optimal: '100-200 字',
    avgEngagement: 141,
    note: '教學型可延伸到 300 字',
  },
  carouselMarker: {
    usage: '在文末加上 1/2 標記',
    topPostRate: 62.6,
    overallRate: 53.5,
    note: '表示有圖片輪播，提高互動率',
  },
  emojiUsage: {
    optimal: '2-5 個',
    topPostRate: 34,
    bottomPostRate: 17.2,
    note: '不要過度使用，也不要完全不用',
  },
  numberedLists: {
    topPostRate: 59.4,
    bottomPostRate: 39.8,
    differencePercent: 19.6,
    note: '#1 差異化因素，條列型內容表現最好',
  },
  spokenMandarin: {
    particles: ['的', '了', '啊', '耶', '欸', '嘛', '吧', '呢'],
    note: '口語化，像朋友聊天，不像品牌廣告',
  },
  specificNumbers: {
    rule: '在 Hook 中使用具體數字',
    good: '5 個指令',
    bad: '幾個指令',
    note: '具體數字比模糊描述更有吸引力',
  },
};

// ==================== 13 個領域個性化公式 ====================
export const DOMAIN_FORMULAS: Array<{
  id: string;
  name: string;
  avgEngagement: number;
  primaryDriver: string;
  bestFormula: string;
  exampleHooks: string[];
  contentRules: string[];
}> = [
  {
    id: 'ai_tech',
    name: 'AI/科技/數位',
    avgEngagement: 107,
    primaryDriver: '工具指令+可複製',
    bestFormula: '[痛點開頭] + [N個指令/工具整理] + [直接複製就能用] + [1/2 輪播]',
    exampleHooks: [
      '不要再叫 ChatGPT「幫我摘要」因為那只會得到機械、沒靈魂的筆記。',
      '是一個超強大的工具，但前提是要寫出好的提示詞。以下👇 15 個好用的 ChatGPT 提示詞',
    ],
    contentRules: [
      '一定要包含讀者可以直接複製的指令或提示詞',
      '使用「直接複製就能用」或「直接複製貼上」作為 CTA',
      '搭配圖片輪播展示工具或提示詞',
      '將 AI 工具連結到真實生活場景（求職、投資、婚禮、學習）',
    ],
  },
  {
    id: 'psychology',
    name: '心理/諮商/情感',
    avgEngagement: 136,
    primaryDriver: '共鳴+被理解感',
    bestFormula: '[日常場景] + [心理學概念解讀] + [反思提問] + [溫暖收尾]',
    exampleHooks: [
      '我曾有這樣的經驗：在我轉行念心理諮商後，度過一段很不容易的時光...',
      '孩子最大的痛苦，家長把自己未竟的人生強加在自己身上。',
    ],
    contentRules: [
      '使用第一人稱敘事（「我曾...」「我發現...」）',
      '每篇引入一個心理學概念，用白話解釋',
      '結尾用溫柔的反思提問，不要硬性 CTA',
      '避免說教，分享脆弱來建立信任',
    ],
  },
  {
    id: 'divination',
    name: '命理/塔羅/靈性',
    avgEngagement: 156,
    primaryDriver: '互動機制+神秘感',
    bestFormula: '[神秘鉤子] + [簡化命理知識] + [「你也來試試」互動] + [1/2 圖片]',
    exampleHooks: [
      '如何看出一個人童年過得好不好，你可以看看他的耳朵。',
      '問一個很玄的問題，要是答得出來那代表你真的悟透了自己',
    ],
    contentRules: [
      '設計低門檻互動（「看看你的手相」「查查你的農曆生日」）',
      '使用「大眾占卜」或「選一張牌」格式提高互動',
      '語言保持神秘但易懂',
      '包含讀者可以立即檢查的具體特徵（耳朵/眉毛/手相）',
    ],
  },
  {
    id: 'career_business',
    name: '職涯/創業/商業',
    avgEngagement: 163,
    primaryDriver: '個人故事+具體數字',
    bestFormula: '[個人血淚故事] + [具體數字/結果] + [可行建議] + [討論問題]',
    exampleHooks: [
      '我覺得好諷刺！眾量級 Andy 失去頻道的事跟我當年失去東京著衣超級類似！',
      '全遠距工作＋年薪可達100萬＋不少出國機會',
      '同樣30歲 A：環遊世界...存款10萬 B：穩定工作...存款500萬。你會選哪一個？',
    ],
    contentRules: [
      '用具體數字開頭（年薪、營收、存款金額）',
      '分享真實失敗，不只是成功',
      '使用「A vs B」比較格式提高留言互動',
      '結尾用引發觀點的問題',
    ],
  },
  {
    id: 'reading_knowledge',
    name: '閱讀/知識/學習',
    avgEngagement: 171,
    primaryDriver: '收藏價值+金句',
    bestFormula: '[書/內容金句] + [個人解讀] + [懶人包摘要] + [書單]',
    exampleHooks: [
      '判斷一個人的時候，別只看他「說」了什麼，而是觀察他到底「做」了什麼。',
      '如何將事業規模拓展至千萬美元的 5 個方法',
    ],
    contentRules: [
      '每篇提取一個強力洞見，不是完整摘要',
      '一定要加個人解讀（「我讀完的感受是...」）',
      '書展優惠/攻略型貼文表現極好',
      '使用數字框架（3個方法、5個步驟）',
    ],
  },
  {
    id: 'law_society',
    name: '法律/社會',
    avgEngagement: 294,
    primaryDriver: '議題性+大眾切身',
    bestFormula: '[挑釁社會議題鉤子] + [法律/事實知識+數字] + [引發觀點的問題]',
    exampleHooks: [
      '水瓶座 O 型都是 G8 人，所以公司要拒絕錄取你！',
      '你覺得禁菸，是在限制吸菸者的權利、還是保護人民的健康？',
    ],
    contentRules: [
      '用「白話文」解釋複雜法律概念',
      '包含具體法條編號或數據增加可信度',
      '一定要以辯論性問題結尾',
      '爭議性框架是關鍵，但要保持事實基礎',
    ],
  },
  {
    id: 'copywriting_marketing',
    name: '文案/行銷/自媒體',
    avgEngagement: 120,
    primaryDriver: '實戰技巧+數據',
    bestFormula: '[共鳴觀察] + [專業洞見/框架] + [可行建議] + [追蹤 CTA]',
    exampleHooks: [
      '當有人說自己沒醉，有很大機率他已經醉了。當有人說自己很渣...',
      '這週末兩天漲了快 2,000 追蹤',
    ],
    contentRules: [
      '分享真實成長數據和案例',
      '提供逐步「起號攻略」或「經營技巧」',
      '用日常觀察幽默作為 Hook',
      '關於 Threads 本身的 Meta 內容在 Threads 上表現很好',
    ],
  },
  {
    id: 'lifestyle_personal',
    name: '生活風格/個人品牌',
    avgEngagement: 105,
    primaryDriver: '真實感+個人觀點',
    bestFormula: '[真實生活時刻] + [個人觀點/洞見] + [共鳴結論]',
    exampleHooks: [
      '在蒙古國拍到人生照片🥹',
      '大概是現在太多人曬「漲粉超快」的戰績...漲粉慢才是絕大多數人的常態',
    ],
    contentRules: [
      '真實感勝過精緻感——不完美的真實時刻更勝',
      '旅行/生活照片搭配簡短反思文字',
      '對流行趨勢的反向觀點表現好',
      '搭配強力圖片時文字保持簡短（50-100字）',
    ],
  },
  {
    id: 'language_teaching',
    name: '語言教學',
    avgEngagement: 106,
    primaryDriver: '圖解+實用',
    bestFormula: '[常見混淆點] + [視覺/圖表解釋] + [範例+比較]',
    exampleHooks: [
      '看到「て形」是不是很容易腦袋一片空白？',
    ],
    contentRules: [
      '每篇一個文法點或詞彙，不是整堂課',
      '使用比較圖表在輪播圖片中',
      '突出「常見錯誤」格式',
      '文化冷知識混合語言學習提高互動',
    ],
  },
  {
    id: 'pets',
    name: '寵物',
    avgEngagement: 220,
    primaryDriver: '情感共鳴+可愛',
    bestFormula: '[寵物對話/對話格式] + [意外的寵物回應] + [人類反應]',
    exampleHooks: [
      '媽：寶寶你下禮拜要生日了耶！想要什麼禮物？ 🐱：我想要把媽媽化妝桌上的東西全部打到地板上',
    ],
    contentRules: [
      '寵物「對話」格式是最佳公式',
      '來自寵物意外邏輯的幽默',
      '使用 🐱🐶 emoji 和可愛語言',
      '分享率極高——讀者會標記有寵物的朋友',
    ],
  },
  {
    id: 'voice_expression',
    name: '聲音/表達',
    avgEngagement: 94,
    primaryDriver: '專業冷知識+反差',
    bestFormula: '[關於聲音/說話的驚人事實] + [常見錯誤揭露] + [簡單修正]',
    exampleHooks: [],
    contentRules: [
      '專業「冷知識」Hook 表現最好',
      '輪播中加入影片/音頻示範',
      '將聲音訓練連結到日常場景（開會、看診、教學）',
    ],
  },
  {
    id: 'anime_subculture',
    name: '動漫/次文化',
    avgEngagement: 99,
    primaryDriver: '社群歸屬+梗',
    bestFormula: '[共鳴日常場景] + [次文化引用] + [社會評論+情感]',
    exampleHooks: [],
    contentRules: [
      '將日常生活困境與動漫/次文化視角混合',
      '使用關於人際關係和社會動態的故事敘述',
      '社群建設語言（「你們有沒有過這種經驗」）',
    ],
  },
  {
    id: 'food_baking',
    name: '美食/烘焙',
    avgEngagement: 76,
    primaryDriver: '視覺+專業深度',
    bestFormula: '[食物歷史/文化故事] + [專業深度] + [意外角度]',
    exampleHooks: [],
    contentRules: [
      '深度文化/歷史背景與一般美食貼文區分',
      '專業內部知識建立權威',
      '搭配高品質美食攝影在輪播中',
    ],
  },
];

// ==================== AI 感禁止詞彙（Skill 補充） ====================
export const AI_SOUNDING_PHRASES = [
  '不是…而是…',
  '記住！',
  '一起撐',
  '溫柔地',
  '值得被愛',
  '你值得',
  '擁抱自己',
  '療癒',
  '賦能',
  '共創',
];

// ==================== 內容結構模板（數據驗證佔比） ====================
export const CONTENT_STRUCTURES = [
  {
    id: 'list_summary',
    name: '條列整理型',
    shareOfTopPosts: 52.8,
    bestFor: '知識分享、工具清單、技巧',
    template: '[Hook: 1-2 句痛點或數字] → [3-7 個要點核心內容] → [CTA 或結尾問題] → [1/2 輪播標記]',
  },
  {
    id: 'tutorial_list',
    name: '教學列表型',
    shareOfTopPosts: 14.4,
    bestFor: '步驟教學、How-to 內容',
    template: '[Hook: 「不要再...」或「用X做Y」] → [編號步驟 1-5] → [結果承諾] → [直接複製就能用 / 存起來] → [1/2]',
  },
  {
    id: 'question_interaction',
    name: '提問互動型',
    shareOfTopPosts: 9.6,
    bestFor: '提高留言、社群建設',
    template: '[情境或兩難設定] → [開放問題 + 2-3 選項] → [可選：簡短分享自己立場]',
  },
  {
    id: 'story_narrative',
    name: '故事敘事型',
    shareOfTopPosts: 1.2,
    bestFor: '建立信任、個人品牌（情感衝擊最高）',
    template: '[個人時刻或對話開頭] → [張力或轉折點] → [洞見或教訓] → [反思提問]',
  },
  {
    id: 'opinion_output',
    name: '觀點輸出型',
    shareOfTopPosts: 0, // 無明確佔比
    bestFor: '思想領導、建立權威',
    template: '[反直覺或驚人陳述] → [2-3 個支持論點] → [可行的結論]',
  },
];

// ==================== 導出所有常量 ====================
export const KNOWLEDGE_BASE = {
  personaThreePillars: PERSONA_THREE_PILLARS,
  viralPostTypes: VIRAL_POST_TYPES,
  contentTypes: CONTENT_TYPES,
  contentTypesWithViralElements: CONTENT_TYPES_WITH_VIRAL_ELEMENTS,
  forbiddenPhrases: FORBIDDEN_PHRASES,
  threadsStyleGuide: THREADS_STYLE_GUIDE,
  hookStyles: HOOK_STYLES,
  fourLensFramework: FOUR_LENS_FRAMEWORK,
  threadsAlgorithm: THREADS_ALGORITHM,
  interactionTaskTypes: INTERACTION_TASK_TYPES,
  productMatrix: PRODUCT_MATRIX,
  businessGoals: BUSINESS_GOALS,
  systemPrompts: SYSTEM_PROMPTS,
  // 新增 - 基於 Skill 數據分析
  dataDrivenHookTypes: DATA_DRIVEN_HOOK_TYPES,
  hookCombinationPatterns: HOOK_COMBINATION_PATTERNS,
  engagementEngines: ENGAGEMENT_ENGINES,
  dataDrivenWritingRules: DATA_DRIVEN_WRITING_RULES,
  domainFormulas: DOMAIN_FORMULAS,
  aiSoundingPhrases: AI_SOUNDING_PHRASES,
  contentStructures: CONTENT_STRUCTURES,
};
