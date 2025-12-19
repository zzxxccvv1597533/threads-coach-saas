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

// ==================== 內容類型 ====================
// 每種類型有不同的輸入需求和結構要求
export const CONTENT_TYPES = [
  { 
    id: "knowledge", 
    name: "知識型", 
    description: "分享專業知識、技巧、方法", 
    example: "塔羅牌的三個常見誤解...",
    inputType: "full", // full = 需要完整結構
    inputFields: ["material"],
    structure: "golden" // 黃金結構：Hook + 內容 + CTA
  },
  { 
    id: "summary", 
    name: "整理型", 
    description: "整理、歸納、清單式內容", 
    example: "5個讓你更有魅力的小習慣...",
    inputType: "full",
    inputFields: ["material", "count"],
    structure: "list" // 清單結構
  },
  { 
    id: "story", 
    name: "故事型", 
    description: "個人經歷、案例分享", 
    example: "今天有個案主問我...",
    inputType: "full",
    inputFields: ["material"],
    structure: "narrative" // 敘事結構
  },
  { 
    id: "viewpoint", 
    name: "觀點型", 
    description: "表達立場、價值觀", 
    example: "我一直相信...",
    inputType: "stance", // 需要立場/觀點
    inputFields: ["stance", "reason"],
    structure: "argument" // 論述結構
  },
  { 
    id: "contrast", 
    name: "反差型", 
    description: "打破認知、製造驚喜", 
    example: "很多人以為...其實...",
    inputType: "contrast",
    inputFields: ["common_belief", "truth"],
    structure: "twist" // 轉折結構
  },
  { 
    id: "casual", 
    name: "閒聊型", 
    description: "日常分享、輕鬆互動", 
    example: "今天發生了一件有趣的事...",
    inputType: "simple", // 簡單輸入
    inputFields: ["topic"],
    structure: "free" // 自由結構
  },
  { 
    id: "dialogue", 
    name: "對話型", 
    description: "對話截圖、問答形式", 
    example: "朋友問我：「你怎麼知道...」",
    inputType: "dialogue",
    inputFields: ["question", "context"],
    structure: "qa" // 問答結構
  },
  { 
    id: "question", 
    name: "提問型", 
    description: "引發思考、徵求意見", 
    example: "你們覺得...?",
    inputType: "question", // 只需要問題主題
    inputFields: ["topic"],
    structure: "question" // 簡單提問，不需要完整結構
  },
  { 
    id: "poll", 
    name: "投票型", 
    description: "選擇題、投票互動", 
    example: "A還是B？",
    inputType: "poll", // 需要選項
    inputFields: ["topic", "options"],
    structure: "poll" // 投票結構
  },
  { 
    id: "quote", 
    name: "引用型", 
    description: "引用名言、他人觀點", 
    example: "「...」這句話讓我想到...",
    inputType: "quote",
    inputFields: ["quote", "reflection"],
    structure: "reflection" // 反思結構
  }
];

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
    ]
  },
  persona: {
    name: "人設透鏡",
    question: "這篇文案像不像你說的話？",
    principle: "語氣一致：確保文案符合你的人設三支柱",
    checkpoints: [
      "語氣是否符合你平常的說話方式？",
      "是否展現了你的專業/情感/觀點？",
      "讀者能認出這是你寫的嗎？"
    ]
  },
  structure: {
    name: "結構透鏡",
    question: "這篇文案好不好吸收？",
    principle: "呼吸感：多段落、空白行、短句，讓閱讀輕鬆",
    checkpoints: [
      "段落是否夠短（3-4行一段）？",
      "是否有足夠的空白行？",
      "句子是否簡潔有力？"
    ]
  },
  conversion: {
    name: "轉化透鏡",
    question: "讀者看完要做什麼？",
    principle: "明確CTA：引導讀者採取下一步行動（優先引導留言）",
    checkpoints: [
      "CTA是否清楚明確？",
      "行動門檻是否夠低？",
      "是否優先引導留言互動？"
    ]
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

核心原則：
1. 渴望導向：內容要讓讀者看到美好的可能性，而非恐嚇
2. 人設一致：確保內容符合創作者的三支柱（專業/情感/觀點）
3. 呼吸感：多段落、空白行、短句，讓閱讀輕鬆
4. 互動優先：文末要有明確的互動引導，優先引導留言

Threads 演算法重點：
- 留言回覆權重最高
- 內容比例建議 70%情緒互動 / 30%品牌產品
- 發文後30分鐘內積極回覆留言很重要`,

  optimization: `你是一位文案優化專家，使用「幕創透鏡框架」來優化文案。

四透鏡檢查：
1. 心法透鏡：傳遞渴望還是焦慮？
2. 人設透鏡：像不像創作者說的話？
3. 結構透鏡：好不好吸收？
4. 轉化透鏡：讀者看完要做什麼？

優化時要：
- 保留原文的核心訊息
- 調整語氣符合人設
- 增加呼吸感（空白行、短句）
- 強化文末互動引導`,

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
  contentTypes: CONTENT_TYPES,
  hookStyles: HOOK_STYLES,
  fourLensFramework: FOUR_LENS_FRAMEWORK,
  threadsAlgorithm: THREADS_ALGORITHM,
  interactionTaskTypes: INTERACTION_TASK_TYPES,
  productMatrix: PRODUCT_MATRIX,
  businessGoals: BUSINESS_GOALS,
  systemPrompts: SYSTEM_PROMPTS,
};
