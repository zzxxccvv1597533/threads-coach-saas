/**
 * 十大貼文類型完整定義 v2
 * 根據方法論定義每種類型的專屬輸入欄位
 */

// ==================== 十大貼文類型專屬輸入欄位 ====================
export interface ContentTypeInputField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  description: string;
  type: 'text' | 'textarea';
}

export interface ContentTypeDefinition {
  id: string;
  name: string;
  description: string;
  example: string;
  structure: string;
  inputFields: ContentTypeInputField[];
  viralElements: {
    hookTips: string;
    contentTips: string;
    ctaTips: string;
    avoidTips: string;
  };
  aiPromptTemplate: string;
}

export const CONTENT_TYPES_V2: ContentTypeDefinition[] = [
  {
    id: "story",
    name: "故事型",
    description: "建立信任與個人品牌的關鍵，結構：開場 Hook → 情境 → 個人經驗 → 核心價值 → 結尾",
    example: "昨天有個案主跟我說...",
    structure: "narrative",
    inputFields: [
      {
        key: "event_conflict",
        label: "具體事件/衝突點",
        placeholder: "發生了什麼事？遇到的困難是什麼？（如：賠了三千萬、被合夥人騙）",
        required: true,
        description: "故事的核心衝突，讓讀者產生好奇",
        type: "textarea"
      },
      {
        key: "turning_point",
        label: "轉折點",
        placeholder: "是誰或什麼觀念改變了局面？（如：遇到了某位老師、學了八字）",
        required: true,
        description: "故事的關鍵轉折，英雄登場的時刻",
        type: "textarea"
      },
      {
        key: "emotion_change",
        label: "情感變化",
        placeholder: "當下的心情是如何轉變的？（從焦慮到釋懷等）",
        required: false,
        description: "情緒的轉變讓故事更有溫度",
        type: "text"
      },
      {
        key: "core_insight",
        label: "核心啟發",
        placeholder: "你想透過這個故事傳達什麼教訓或價值觀？",
        required: true,
        description: "故事的核心訊息，讓讀者有收穫",
        type: "textarea"
      }
    ],
    viralElements: {
      hookTips: "開頭用具體時間：「昨天」「上週」「前幾天」，加上真實人物",
      contentTips: "有情緒轉折：「沒想到」「結果」「後來」，用對話增加真實感",
      ctaTips: "結尾帶反思：「這件事讓我明白...」，然後問讀者經驗",
      avoidTips: "避免流水帳，避免沒有轉折點"
    },
    aiPromptTemplate: `請使用「英雄旅程」架構撰寫故事型貼文：
1. 開頭用具體時間和人物製造真實感
2. 描述衝突/困境：{{event_conflict}}
3. 帶入轉折點：{{turning_point}}
4. 展現情感變化：{{emotion_change}}
5. 結尾帶出核心啟發：{{core_insight}}
6. 最後用開放式問題引導互動`
  },
  {
    id: "knowledge",
    name: "知識型",
    description: "展現專業但要「說人話」，降低閱讀門檻到「小學五年級」程度",
    example: "三招判斷你的貓是否在生氣...",
    structure: "golden",
    inputFields: [
      {
        key: "specific_problem",
        label: "解決的具體問題",
        placeholder: "這篇文只解決一個痛點（如：如何定價、如何看夫妻宮）",
        required: true,
        description: "聚焦單一問題，不要貪多",
        type: "text"
      },
      {
        key: "professional_concept",
        label: "專業概念的「白話翻譯」",
        placeholder: "提供原本艱澀的專業術語，並說明想翻譯成什麼（如：夫妻宮有這顆星 = 喜歡長得好看的人）",
        required: false,
        description: "把專業術語翻譯成生活化比喻",
        type: "textarea"
      },
      {
        key: "key_points",
        label: "步驟或重點",
        placeholder: "歸納出「3個步驟」或「3個重點」",
        required: true,
        description: "用條列讓讀者容易吸收",
        type: "textarea"
      }
    ],
    viralElements: {
      hookTips: "開頭用數字或問題：「90%的人都不知道...」「你有沒有想過...」",
      contentTips: "分點清晰，每點獨立成金句，用大白話解釋專業概念",
      ctaTips: "結尾給行動建議：「下次遇到這種情況，你可以...」",
      avoidTips: "避免太多專業術語，避免說教語氣"
    },
    aiPromptTemplate: `請撰寫知識型貼文，目標是讓「小學五年級」都能懂：
1. 解決的問題：{{specific_problem}}
2. 專業概念白話翻譯：{{professional_concept}}
3. 歸納成 3 個重點/步驟：{{key_points}}
4. 用生活化比喻解釋，避免專業術語
5. 結尾給具體的行動建議`
  },
  {
    id: "summary",
    name: "整理型",
    description: "成為資訊樞紐，讓讀者想「收藏」",
    example: "5個讓你更有魅力的小習慣...",
    structure: "list",
    inputFields: [
      {
        key: "summary_topic",
        label: "整理主題",
        placeholder: "例如「2024年好日子」、「免費排版工具」、「新手必備技巧」",
        required: true,
        description: "明確的整理主題",
        type: "text"
      },
      {
        key: "raw_data",
        label: "原始資料/清單",
        placeholder: "提供你想整理的雜亂資訊或連結，AI 幫忙篩選與分類",
        required: true,
        description: "你手邊有的資料",
        type: "textarea"
      },
      {
        key: "save_what",
        label: "節省了什麼",
        placeholder: "這個懶人包能幫讀者省下什麼（時間、金錢、避雷）",
        required: false,
        description: "讓讀者知道收藏的價值",
        type: "text"
      }
    ],
    viralElements: {
      hookTips: "標題必須有數字：「5個」「3種」「7件事」",
      contentTips: "每點獨立成段，每點都是可單獨截圖的金句",
      ctaTips: "結尾問：「你中了幾個？」「還有什麼想補充的？」",
      avoidTips: "避免每點太長，避免沒有結論"
    },
    aiPromptTemplate: `請撰寫整理型貼文（懶人包）：
1. 主題：{{summary_topic}}
2. 整理以下資料：{{raw_data}}
3. 幫讀者節省：{{save_what}}
4. 用清晰的標題和條列式排版
5. 每點都要是可單獨截圖的金句`
  },
  {
    id: "viewpoint",
    name: "觀點型",
    description: "建立獨特觀點，引發共鳴或討論",
    example: "我一直相信...",
    structure: "argument",
    inputFields: [
      {
        key: "phenomenon",
        label: "觀察到的現象",
        placeholder: "最近看到了什麼新聞、社會現象或客戶行為（如：很多老師不敢收高價）",
        required: true,
        description: "引發你思考的現象",
        type: "textarea"
      },
      {
        key: "unique_stance",
        label: "你的獨特立場",
        placeholder: "你贊成還是反對？你的看法與大眾有何不同？（如：收高價反而是幫助客戶珍惜建議）",
        required: true,
        description: "你的觀點要有立場",
        type: "textarea"
      },
      {
        key: "underlying_value",
        label: "背後的價值觀",
        placeholder: "為什麼你這樣想？這連結到你的什麼信念？",
        required: false,
        description: "觀點背後的核心信念",
        type: "textarea"
      }
    ],
    viralElements: {
      hookTips: "開頭直接拋出觀點，要有立場不要模糊",
      contentTips: "用 2-3 個論點或經歷支撐，觀點要能引發討論",
      ctaTips: "結尾問：「你怎麼看？」「你同意嗎？」",
      avoidTips: "避免太激進或攻擊性，避免沒有支撐的空談"
    },
    aiPromptTemplate: `請撰寫觀點型貼文：
1. 觀察到的現象：{{phenomenon}}
2. 你的獨特立場：{{unique_stance}}
3. 背後的價值觀：{{underlying_value}}
4. 用 2-3 個論點或經歷支撐
5. 結尾引發討論：「你怎麼看？」`
  },
  {
    id: "dialogue",
    name: "對話型",
    description: "透過模擬真實對話，展現個性與立體感",
    example: "朋友問我：「你怎麼知道...」",
    structure: "qa",
    inputFields: [
      {
        key: "dialogue_roles",
        label: "對話角色",
        placeholder: "是「媽媽對小孩」、「諮商師對個案」還是「老闆對員工」？",
        required: true,
        description: "對話的雙方是誰",
        type: "text"
      },
      {
        key: "situation_conflict",
        label: "情境衝突",
        placeholder: "對話發生在什麼場景？雙方的立場是什麼？（如：厭世的諮商師 vs. 糾結的個案）",
        required: true,
        description: "對話的背景和張力",
        type: "textarea"
      },
      {
        key: "punchline",
        label: "金句",
        placeholder: "你想在對話中置入哪一句關鍵回應或吐槽？",
        required: true,
        description: "對話的亮點",
        type: "text"
      }
    ],
    viralElements: {
      hookTips: "開頭用引號呈現對話：「朋友問我...」「有人問我...」",
      contentTips: "對話要有情緒轉折，回答要有觀點不只是資訊",
      ctaTips: "結尾問：「你們會怎麼回答？」「換作是你呢？」",
      avoidTips: "避免對話太長，避免回答太說教"
    },
    aiPromptTemplate: `請撰寫對話型貼文：
1. 對話角色：{{dialogue_roles}}
2. 情境衝突：{{situation_conflict}}
3. 金句：{{punchline}}
4. 寫出「口語化」、「有情緒」的對白
5. 結尾問讀者：「你們會怎麼回答？」`
  }
];


// 繼續定義剩餘的五種貼文類型
export const CONTENT_TYPES_V2_PART2: ContentTypeDefinition[] = [
  {
    id: "quote",
    name: "引用型",
    description: "藉由引用他人的內容來「接話」或發表看法，降低創作門檻",
    example: "「...」這句話讓我想到...",
    structure: "reflection",
    inputFields: [
      {
        key: "original_quote",
        label: "原始貼文/引用內容",
        placeholder: "複製你想引用的那段話",
        required: true,
        description: "你想引用的內容",
        type: "textarea"
      },
      {
        key: "your_reaction",
        label: "你的反應",
        placeholder: "你是認同、反對、還是有補充意見？",
        required: true,
        description: "你對這段話的看法",
        type: "text"
      },
      {
        key: "extended_view",
        label: "延伸觀點",
        placeholder: "你想藉此帶出什麼自己的經驗或專業知識？",
        required: false,
        description: "延伸你的觀點",
        type: "textarea"
      }
    ],
    viralElements: {
      hookTips: "開頭引用這句話，選擇能引發共鳴的句子",
      contentTips: "分享你的解讀或相關經歷，讓引用變成你的觀點",
      ctaTips: "結尾問：「這句話對你來說有什麼意義？」",
      avoidTips: "避免只引用不解讀，避免解讀太長"
    },
    aiPromptTemplate: `請撰寫引用型貼文：
1. 引用內容：{{original_quote}}
2. 你的反應：{{your_reaction}}
3. 延伸觀點：{{extended_view}}
4. 分享你的解讀或相關經歷
5. 結尾問讀者這句話對他們的意義`
  },
  {
    id: "contrast",
    name: "反差型",
    description: "利用個性或身份的反差來建立記憶點",
    example: "很多人以為...其實...",
    structure: "twist",
    inputFields: [
      {
        key: "two_opposites",
        label: "兩個對立面",
        placeholder: "提供你的兩種特質（如：極度理性的操盤手 vs. 極度感性的實踐者）",
        required: true,
        description: "你身上的反差特質",
        type: "textarea"
      },
      {
        key: "specific_scene",
        label: "具體場景",
        placeholder: "在什麼情況下會出現這種反差？（如：平常隨和，但遇到個案不愛惜自己時會變得很兇）",
        required: true,
        description: "反差出現的時機",
        type: "textarea"
      },
      {
        key: "purpose",
        label: "目的",
        placeholder: "強調這種反差是為了客戶好，或是為了展現真實人性",
        required: false,
        description: "為什麼要展現這個反差",
        type: "text"
      }
    ],
    viralElements: {
      hookTips: "開頭用「很多人以為...」「大家都說...」製造預期",
      contentTips: "轉折要明確：「但其實...」「真相是...」，解釋為什麼",
      ctaTips: "結尾問：「你也有這種經驗嗎？」「你以前也這樣想嗎？」",
      avoidTips: "避免反差太弱，避免沒有解釋原因"
    },
    aiPromptTemplate: `請撰寫反差型貼文：
1. 兩個對立面：{{two_opposites}}
2. 具體場景：{{specific_scene}}
3. 目的：{{purpose}}
4. 用「很多人以為...但其實...」的結構
5. 結尾問讀者是否有類似經驗`
  },
  {
    id: "casual",
    name: "閒聊型",
    description: "像是在「碎碎唸」或「Murmur」，展現真實感，不需要完美",
    example: "今天發生了一件有趣的事...",
    structure: "free",
    inputFields: [
      {
        key: "current_mood",
        label: "當下的情緒/狀態",
        placeholder: "例如「覺得累」、「剛發生一件小確幸」、「對某事感到無奈」",
        required: true,
        description: "你現在的心情",
        type: "text"
      },
      {
        key: "life_fragment",
        label: "生活碎片",
        placeholder: "剛剛吃了什麼、在哪裡、看到了什麼小東西（如：貓咪在睡覺）",
        required: false,
        description: "生活中的小細節",
        type: "textarea"
      }
    ],
    viralElements: {
      hookTips: "開頭用日常場景：「今天」「剛剛」「突然想到」",
      contentTips: "語氣輕鬆，像在跟朋友聊天，可以有小抱怨或小發現",
      ctaTips: "結尾問：「你們有過這種經驗嗎？」「只有我這樣嗎？」",
      avoidTips: "避免太正經，避免沒有互動點"
    },
    aiPromptTemplate: `請撰寫閒聊型貼文：
1. 當下情緒：{{current_mood}}
2. 生活碎片：{{life_fragment}}
3. 語氣要「隨意」、「不修飾」、「像在跟朋友傳訊息」
4. 結尾問讀者是否有類似經驗`
  },
  {
    id: "question",
    name: "提問型",
    description: "降低互動門檻，讓受眾容易留言",
    example: "你們覺得...?",
    structure: "question",
    inputFields: [
      {
        key: "simple_topic",
        label: "簡單的主題",
        placeholder: "受眾感興趣且容易回答的話題（如：1992年出生的人現在還好嗎？大家最近有覺得奧客變多嗎？）",
        required: true,
        description: "好回答的話題",
        type: "text"
      },
      {
        key: "target_audience",
        label: "目標受眾",
        placeholder: "你想問誰？（如：問老闆、問媽媽、問同行）",
        required: false,
        description: "你想問的對象",
        type: "text"
      }
    ],
    viralElements: {
      hookTips: "開頭直接拋出問題，問題要能引發思考或共鳴",
      contentTips: "可以加一兩句背景說明，但不要太長",
      ctaTips: "結尾用「你們覺得呢？」「想聽聽大家的看法」",
      avoidTips: "避免問題太複雜，避免自己先給答案"
    },
    aiPromptTemplate: `請撰寫提問型貼文：
1. 主題：{{simple_topic}}
2. 目標受眾：{{target_audience}}
3. 設計「開放式」但「好回答」的問題
4. 避免太深奧的思考題
5. 結尾用「你們覺得呢？」`
  },
  {
    id: "poll",
    name: "投票型",
    description: "類似「市場調查」，了解受眾偏好或引發戰隊",
    example: "A還是B？",
    structure: "poll",
    inputFields: [
      {
        key: "binary_choice",
        label: "二選一的情境",
        placeholder: "例如「有一筆錢你會做財庫還是做法會？」、「你比較喜歡 A 還是 B？」",
        required: true,
        description: "讓讀者選邊站的問題",
        type: "text"
      },
      {
        key: "survey_purpose",
        label: "調查目的",
        placeholder: "你想知道什麼資訊？（是為了推新品做預熱，還是純粹好玩？）",
        required: false,
        description: "為什麼要做這個投票",
        type: "text"
      }
    ],
    viralElements: {
      hookTips: "開頭簡短介紹投票主題，選項要有趣或有爭議性",
      contentTips: "選項用 A/B 或數字標註，可以加上選項的小描述",
      ctaTips: "結尾用「留言告訴我你的選擇」「選好的留言+1」",
      avoidTips: "避免選項太多，避免選項太相似"
    },
    aiPromptTemplate: `請撰寫投票型貼文：
1. 二選一情境：{{binary_choice}}
2. 調查目的：{{survey_purpose}}
3. 設計兩個立場鮮明或有趣的選項
4. 結尾用「留言告訴我你的選擇」`
  },
  {
    id: "diagnosis",
    name: "診斷型",
    description: "高互動類型，幫讀者分析症狀並給出標籤（如：你是哪種焦慮型？）",
    example: "你是不是常常...那你可能是...",
    structure: "diagnosis",
    inputFields: [
      {
        key: "symptoms",
        label: "常見特徵/症狀",
        placeholder: "列出 3 個讀者會有的具體行為（如：明明很累卻捨不得睡）",
        required: true,
        description: "讓讀者對號入座的特徵",
        type: "textarea"
      },
      {
        key: "diagnosis_label",
        label: "診斷標籤/術語",
        placeholder: "這個現象在你的專業裡叫什麼？（如：報復性熬夜、夫妻宮無碼）",
        required: false,
        description: "賦予一個有趣的標籤",
        type: "text"
      },
      {
        key: "explanation",
        label: "簡單解析/解法",
        placeholder: "為什麼會這樣？一句話的安撫或建議",
        required: true,
        description: "展現專業與同理",
        type: "textarea"
      }
    ],
    viralElements: {
      hookTips: "開頭直接點名特徵：「如果你有這三個跡象...」",
      contentTips: "特徵要夠具體，標籤要有趣或專業，解析要溫暖",
      ctaTips: "結尾問：「你是哪一型？」「你有中嗎？」",
      avoidTips: "避免負面批判，避免長篇大論的說教"
    },
    aiPromptTemplate: `請撰寫診斷型貼文：
1. 特徵/症狀：{{symptoms}}
2. 診斷標籤：{{diagnosis_label}}
3. 解析：{{explanation}}
4. 讓讀者覺得「天啊這就是在說我」`
  }
];

// 合併所有類型
export const ALL_CONTENT_TYPES_V2 = [...CONTENT_TYPES_V2, ...CONTENT_TYPES_V2_PART2];

// ==================== Hook 風格定義 ====================
export const HOOK_STYLES_V2 = [
  {
    id: "mirror",
    name: "鏡像開頭",
    description: "直接說出受眾的心聲，讓他們覺得「這就是在說我」",
    example: "你是不是也常常覺得，明明很努力了，卻還是得不到認可？",
    template: "你是不是也{{受眾的困擾}}？"
  },
  {
    id: "contrast",
    name: "反差開頭",
    description: "打破預期的陳述，製造認知衝突",
    example: "很多人以為要先有自信才能行動，但其實剛好相反。",
    template: "很多人以為{{常見認知}}，但其實{{反差真相}}。"
  },
  {
    id: "scene",
    name: "場景開頭",
    description: "描繪具體畫面，讓讀者身歷其境",
    example: "昨天晚上，我坐在電腦前，盯著那封已經寫了三次的訊息...",
    template: "{{時間}}，我{{具體動作}}，{{當下的狀態}}..."
  },
  {
    id: "question",
    name: "提問開頭",
    description: "直接拋出問題，引發讀者思考",
    example: "你有沒有想過，為什麼有些人總是能吸引好運？",
    template: "你有沒有想過，{{引發思考的問題}}？"
  },
  {
    id: "data",
    name: "數據開頭",
    description: "用數字吸引注意，建立權威感",
    example: "90%的人都不知道，其實塔羅牌不是用來算命的。",
    template: "{{數字}}%的人都不知道，{{反常識的事實}}。"
  },
  {
    id: "dialogue",
    name: "對話開頭",
    description: "用真實對話開場，增加真實感",
    example: "「你怎麼知道自己適合什麼？」朋友問我。",
    template: "「{{別人問的問題}}」{{誰}}問我。"
  }
];

// ==================== 人味潤飾欄位 ====================
export interface PersonalTouchFields {
  catchphrases: string[];  // 口頭禪
  speakingStyle: string;   // 說話風格描述
  samplePosts: string[];   // 過去成功的貼文範例
}

// ==================== AI 協作流程 ====================
export const AI_WORKFLOW_STEPS = [
  {
    step: 1,
    name: "餵養核心資料",
    description: "讓 AI 認識你的人設、受眾、英雄旅程",
    autoFilled: true
  },
  {
    step: 2,
    name: "選定貼文類型與主題",
    description: "從痛點矩陣選主題，從十大類型選呈現方式",
    userAction: "select"
  },
  {
    step: 3,
    name: "填寫關鍵資訊",
    description: "根據類型填寫專屬欄位",
    userAction: "input"
  },
  {
    step: 4,
    name: "選擇 Hook 風格",
    description: "選擇開頭的呈現方式",
    userAction: "select"
  },
  {
    step: 5,
    name: "生成 Hook 選項",
    description: "AI 生成 3-5 個 Hook 讓你選擇",
    aiAction: "generate_hooks"
  },
  {
    step: 6,
    name: "選定 Hook 生成全文",
    description: "選定 Hook 後 AI 生成完整貼文",
    aiAction: "generate_full"
  },
  {
    step: 7,
    name: "對話修改",
    description: "與 AI 對話調整內容",
    userAction: "chat"
  },
  {
    step: 8,
    name: "人味潤飾",
    description: "套用口頭禪和個人風格",
    aiAction: "polish"
  }
];
