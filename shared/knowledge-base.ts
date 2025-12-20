/**
 * 幕創行銷 Threads 經營核心知識庫
 * 整合所有 PDF 文件的核心內容，用於 AI 提示詞注入
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

// ==================== 禁止詞彙列表 ====================
export const FORBIDDEN_PHRASES = {
  openingForbidden: [
    "讓我們",
    "一起來",
    "今天要分享",
    "不妨",
    "其實",
    "首先",
    "接下來",
    "在這篇文章中"
  ],
  contentForbidden: [
    "親愛的朋友們",
    "各位",
    "大家好",
    "相信大家",
    "眾所周知",
    "不言而喻",
    "毋庸置疑"
  ],
  ctaForbidden: [
    "立即購買",
    "限時優惠",
    "馬上行動",
    "不要錯過",
    "趕快",
    "立刻"
  ],
  formatForbidden: [
    "**",
    "##",
    "###",
    "```",
    "---",
    "___"
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
  }
};

// ==================== Hook 風格 ====================
export const HOOK_STYLES = [
  { id: "mirror", name: "鏡像開頭", description: "直接說出受眾的心聲", example: "你是不是也常常..." },
  { id: "contrast", name: "反差開頭", description: "打破預期的陳述", example: "很多人以為...但其實..." },
  { id: "scene", name: "場景開頭", description: "描繪具體畫面", example: "昨天晚上，我坐在電腦前..." },
  { id: "question", name: "提問開頭", description: "直接拋出問題", example: "你有沒有想過..." },
  { id: "data", name: "數據開頭", description: "用數字吸引注意", example: "90%的人都不知道..." }
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

// ==================== 互動任務類型 ====================
export const INTERACTION_TASK_TYPES = {
  reply_comments: {
    name: "回覆留言",
    description: "回覆自己貼文下的留言",
    priority: 1,
    tips: [
      "發文後30分鐘內優先回覆",
      "回覆要有溫度，延伸話題",
      "可以反問對方，創造對話"
    ]
  },
  comment_others: {
    name: "串門子",
    description: "去別人的貼文留言互動",
    priority: 2,
    tips: [
      "選擇同領域或目標受眾會關注的帳號",
      "留言要有觀點，不要只說「讚」",
      "可以分享自己的經驗或補充"
    ]
  },
  sea_patrol: {
    name: "海巡",
    description: "主動搜尋並參與相關話題討論",
    priority: 3,
    tips: [
      "搜尋你的專業關鍵字",
      "找到正在討論相關話題的貼文",
      "提供有價值的回覆，建立專業形象"
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

// ==================== 系統提示詞模板 ====================
export const SYSTEM_PROMPTS = {
  contentGeneration: `你是一位專業的 Threads 內容創作教練，專門幫助創作者產出高互動的貼文。

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

=== 禁止詞彙（絕對不能使用） ===
開頭禁止：「讓我們」「一起來」「今天要分享」「不妨」「其實」「首先」「接下來」
內容禁止：「親愛的朋友們」「各位」「大家好」「相信大家」「眾所周知」
CTA 禁止：「立即購買」「限時優惠」「馬上行動」「不要錯過」

=== 格式要求 ===
- 呼吸感：多段落、空白行、短句，讓閱讀輕鬆
- 一句一行：每個句子獨立成段
- 互動優先：文末要有明確的互動引導，優先引導留言
- 禁止 Markdown：不要用 **、*、#、\`、- 等符號，直接用空行分段

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
開頭禁止：「讓我們」「一起來」「今天要分享」「不妨」「其實」
內容禁止：「親愛的朋友們」「各位」「大家好」「相信大家」

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
};
