/**
 * 漸進式去 AI 化過濾器系統
 * 
 * 優化版本 v2.0 - 根據 17,850 篇爆款資料庫分析
 * 
 * 設計原則：
 * 1. 用戶風格優先：如果用戶有上傳爆款貼文，優先使用學習到的風格
 * 2. 動態強度：根據說話風格和內容類型調整過濾強度
 * 3. 漸進式：只過濾「明確的 AI 痕跡」，保留用戶可能會用的表達
 * 4. 編輯模式感知：根據 editMode 調整過濾強度
 * 
 * 主要優化：
 * 1. 擴充成語殺手清單（新增 30+ 個）
 * 2. 擴充情緒替換模式（新增 10+ 個）
 * 3. 新增編輯模式感知
 * 4. 分層處理廢話刪除
 */

// ============================================
// 成語殺手：AI 常用成語 → 白話替換（擴充版）
// ============================================

const IDIOM_REPLACEMENTS: Record<string, string[]> = {
  // ==================== 原有成語 ====================
  // 財務相關
  '盆滿缽滿': ['賺翻了', '賺到爆', '口袋滿滿'],
  '入不敷出': ['錢不夠用', '一直在燒錢', '賺的不夠花'],
  '捉襟見肘': ['錢不夠', '手頭很緊', '快沒錢了'],
  
  // 價值相關
  '價值倒掛': ['爛人賺大錢', '好人沒好報', '努力的人反而賺不到'],
  '劣幣驅逐良幣': ['騙子把好老師擠走了', '認真的人被淘汰', '劣質的反而活得好'],
  '物超所值': ['超值', '很划算', '賺到了'],
  '物有所值': ['值得', '沒白花', '花得值'],
  
  // 變化相關
  '斷崖式下跌': ['直接歸零', '暴跌', '一落千丈'],
  '突飛猛進': ['進步超快', '飛速成長', '衝很快'],
  '日新月異': ['變化超快', '一直在變', '每天都不一樣'],
  '翻天覆地': ['完全不一樣', '大翻轉', '整個變了'],
  
  // 努力相關
  '披荊斬棘': ['一路打怪', '克服困難', '硬撐過來'],
  '孜孜不倦': ['一直努力', '很拼', '超認真'],
  '鍥而不捨': ['不放棄', '一直堅持', '死不放手'],
  '廢寢忘食': ['拼到忘記吃飯', '超投入', '整個人栽進去'],
  
  // 結果相關
  '事半功倍': ['輕鬆很多', '省力', '效率變高'],
  '事倍功半': ['白費力氣', '做白工', '效率超差'],
  '功虧一簣': ['差一點就成功', '最後關頭失敗', '可惜了'],
  '水到渠成': ['自然就成了', '順理成章', '時機到了'],
  
  // 情緒相關
  '心力交瘁': ['累到不行', '身心俱疲', '整個人被掏空'],
  '焦頭爛額': ['忙到炸', '焦慮爆表', '頭很痛'],
  '欲哭無淚': ['想哭都哭不出來', '無言', '心很累'],
  '喜出望外': ['超驚喜', '太開心了', '沒想到'],
  
  // 關係相關
  '志同道合': ['理念相同', '想法一樣', '頻率對'],
  '同舟共濟': ['一起撐過去', '互相幫忙', '共患難'],
  '患難與共': ['一起扛', '有難同當', '不離不棄'],
  
  // 其他常見
  '一針見血': ['說到重點', '超準', '直接戳中'],
  '醍醐灌頂': ['突然懂了', '被點醒', '恍然大悟'],
  '茅塞頓開': ['突然通了', '想通了', '開竅了'],
  '如魚得水': ['超順', '很自在', '很適合'],
  '游刃有餘': ['輕鬆搞定', '很順手', '沒壓力'],
  '得心應手': ['很順', '上手了', '熟練了'],
  '循序漸進': ['一步一步來', '慢慢來', '按部就班'],
  '深入淺出': ['講得很白話', '好懂', '簡單易懂'],
  '言簡意賅': ['講重點', '簡潔', '不囉嗦'],
  '一語中的': ['說到點上', '超準', '正中紅心'],
  
  // ==================== 新增成語（基於爆款資料庫分析） ====================
  // AI 常用的「正向」成語
  '蛻變成長': ['變強了', '進步了', '不一樣了'],
  '煥然一新': ['整個變了', '不一樣了', '換了一個人'],
  '脫胎換骨': ['完全變了', '像換了一個人', '整個不同'],
  '浴火重生': ['從谷底爬起來', '重新開始', '再站起來'],
  '破繭成蝶': ['終於成功了', '熬出頭了', '變強了'],
  '涅槃重生': ['重新開始', '再站起來', '活過來了'],
  
  // AI 常用的「努力」成語
  '砥礪前行': ['繼續努力', '繼續走', '不放棄'],
  '奮發圖強': ['努力變強', '拼命努力', '很拼'],
  '勇往直前': ['衝就對了', '不怕', '繼續走'],
  '堅持不懈': ['一直堅持', '不放棄', '撐下去'],
  '持之以恆': ['一直做', '堅持下去', '不間斷'],
  '百折不撓': ['怎麼打都不倒', '超堅強', '打不死'],
  
  // AI 常用的「關係」成語
  '相濡以沫': ['互相扶持', '一起撐', '不離不棄'],
  '風雨同舟': ['一起扛', '共患難', '不離不棄'],
  '肝膽相照': ['超真心', '真朋友', '真兄弟'],
  '推心置腹': ['說真心話', '掏心掏肺', '很真誠'],
  
  // AI 常用的「智慧」成語
  '高瞻遠矚': ['看得很遠', '很有遠見', '想得遠'],
  '洞若觀火': ['看得很清楚', '一眼看穿', '超懂'],
  '明察秋毫': ['超細心', '什麼都看到', '很敏銳'],
  '見微知著': ['從小地方看出大問題', '很敏銳', '觀察力強'],
  
  // AI 常用的「成功」成語
  '功成名就': ['成功了', '出名了', '做到了'],
  '名利雙收': ['錢和名都有了', '什麼都有了', '人生贏家'],
  '飛黃騰達': ['發達了', '起飛了', '成功了'],
  '一帆風順': ['超順', '沒遇到什麼問題', '很順利'],
  '心想事成': ['想要的都有了', '願望成真', '超順'],
  
  // AI 常用的「困難」成語
  '舉步維艱': ['每一步都很難', '超難走', '很辛苦'],
  '寸步難行': ['動彈不得', '卡住了', '走不動'],
  '進退兩難': ['不知道怎麼辦', '卡住了', '左右為難'],
  '左右為難': ['不知道選哪個', '很難選', '兩邊都不行'],
  '騎虎難下': ['停不下來', '不能退', '只能繼續'],
  
  // AI 常用的「時間」成語
  '時光荏苒': ['時間過好快', '一轉眼', '不知不覺'],
  '歲月如梭': ['時間飛快', '一轉眼', '好快'],
  '光陰似箭': ['時間過超快', '一轉眼', '好快'],
  '白駒過隙': ['時間過超快', '一瞬間', '好快'],
  
  // AI 常用的「學習」成語
  '學無止境': ['永遠學不完', '一直有東西學', '學不完'],
  '博學多才': ['什麼都會', '超厲害', '很強'],
  '融會貫通': ['全部串起來了', '懂了', '通了'],
  '觸類旁通': ['一通百通', '舉一反三', '懂了'],
  
  // AI 常用的「態度」成語
  '腳踏實地': ['一步一步來', '踏實', '不走捷徑'],
  '實事求是': ['看事實', '不騙人', '誠實'],
  '兢兢業業': ['很認真', '很努力', '很拼'],
  '任勞任怨': ['不抱怨', '默默做', '很能忍'],
};

// ============================================
// 廢話刪除：AI 連接詞和冗詞（分層處理）
// ============================================

// 第一層：絕對刪除（AI 痕跡明顯）
const FILLER_WORDS_CRITICAL: string[] = [
  // AI 常用開頭
  '身為一個',
  '身為一位',
  '作為一個',
  '作為一位',
  '這句話聽起來很殘酷，但',
  '這聽起來可能有點',
  '我必須承認',
  '我想說的是',
  '不得不說',
  
  // AI 常用結尾
  '希望對你有幫助',
  '希望這篇文章對你有幫助',
  '希望能幫助到你',
  '以上就是我的分享',
  '感謝你的閱讀',
  '謝謝你看到這裡',
  '如果你喜歡這篇文章',
  '歡迎留言告訴我',
  '期待你的留言',
  
  // AI 常用連接詞
  '總而言之',
  '綜上所述',
  '由此可見',
  '換言之',
  '簡而言之',
  '總的來說',
  '歸根結底',
  '值得一提的是',
  '不可否認',
  '毋庸置疑',
  '顯而易見',
  '眾所周知',
  
  // 新增：AI 常用的過度正向詞
  '親愛的朋友們',
  '親愛的讀者',
  '各位朋友',
  '各位讀者',
  '在這個快節奏的時代',
  '在當今社會',
  '在這個資訊爆炸的時代',
  '讓我們一起',
  '讓我們共同',
  '一起加油吧',
  '加油，你可以的',
  '相信自己',
  '你一定可以',
  '你值得更好的',
  '你值得被愛',
];

// 第二層：視情況刪除（可能是用戶風格）
const FILLER_WORDS_OPTIONAL: string[] = [
  // 連接詞（過度正式）
  '此外',
  '因此',
  '然而',
  '不僅如此',
  '與此同時',
  
  // 冗詞
  '事實上',
  '實際上',
  '基本上',
  '本質上',
  '某種程度上',
  '在某種意義上',
  '從某種角度來看',
  '從這個角度來說',
  
  // 可能是用戶風格的詞
  '說實話',
  '坦白說',
  '老實說',
  '我認為',
  '我覺得',
  '我相信',
];

// 合併所有廢話詞（向後兼容）
const FILLER_WORDS: string[] = [...FILLER_WORDS_CRITICAL, ...FILLER_WORDS_OPTIONAL];

// 需要替換而非刪除的詞
const FILLER_REPLACEMENTS: Record<string, string> = {
  '首先': '',
  '其次': '',
  '再者': '',
  '最後': '',
  '第一': '',
  '第二': '',
  '第三': '',
  '接下來': '',
  '緊接著': '',
  '隨後': '',
};

// ============================================
// 情緒暴衝：陳述句 → 情緒句（擴充版）
// ============================================

const EMOTION_PATTERNS: Array<{
  pattern: RegExp;
  replacements: string[];
}> = [
  // ==================== 原有模式 ====================
  {
    // 「他跟我說」→ 「他跟我抱怨」
    pattern: /他跟我說[：:「]?(.+?)[」]?[。，,]/g,
    replacements: [
      '他跟我抱怨：「$1」',
      '他很無奈地說：「$1」',
      '他嘆了口氣說：「$1」',
    ],
  },
  {
    // 「很多人」→ 「超多人」
    pattern: /很多人/g,
    replacements: ['超多人', '一堆人', '太多人'],
  },
  {
    // 「非常」→ 「超」「很」
    pattern: /非常/g,
    replacements: ['超', '很', '超級'],
  },
  {
    // 「十分」→ 「超」「很」
    pattern: /十分/g,
    replacements: ['超', '很', '真的很'],
  },
  {
    // 「相當」→ 「蠻」「還蠻」
    pattern: /相當/g,
    replacements: ['蠻', '還蠻', '真的蠻'],
  },
  
  // ==================== 新增模式（基於爆款資料庫分析） ====================
  {
    // 「我認為」→ 「我覺得」「我發現」
    pattern: /我認為/g,
    replacements: ['我覺得', '我發現', '我真心覺得'],
  },
  {
    // 「我們應該」→ 「其實可以」
    pattern: /我們應該/g,
    replacements: ['其實可以', '不如試試', '可以考慮'],
  },
  {
    // 「你應該」→ 「你可以試試」
    pattern: /你應該/g,
    replacements: ['你可以試試', '不如試試', '可以考慮'],
  },
  {
    // 「你必須」→ 「你真的要」
    pattern: /你必須/g,
    replacements: ['你真的要', '你一定要', '拜託你'],
  },
  {
    // 「這是因為」→ 「其實是因為」
    pattern: /這是因為/g,
    replacements: ['其實是因為', '說白了就是', '簡單說就是'],
  },
  {
    // 「我們需要」→ 「我們要」
    pattern: /我們需要/g,
    replacements: ['我們要', '我們得', '我們必須'],
  },
  {
    // 「這個問題」→ 「這件事」
    pattern: /這個問題/g,
    replacements: ['這件事', '這個', '這'],
  },
  {
    // 「在這裡」→ 「這邊」
    pattern: /在這裡/g,
    replacements: ['這邊', '這裡', '這'],
  },
  {
    // 「進行」→ 「做」
    pattern: /進行/g,
    replacements: ['做', '弄', '搞'],
  },
  {
    // 「實現」→ 「做到」
    pattern: /實現/g,
    replacements: ['做到', '達成', '完成'],
  },
  {
    // 「獲得」→ 「拿到」
    pattern: /獲得/g,
    replacements: ['拿到', '得到', '有了'],
  },
  {
    // 「提升」→ 「變好」
    pattern: /提升/g,
    replacements: ['變好', '進步', '變強'],
  },
  {
    // 「優化」→ 「改善」
    pattern: /優化/g,
    replacements: ['改善', '調整', '變好'],
  },
  {
    // 「解決」→ 「搞定」
    pattern: /解決/g,
    replacements: ['搞定', '處理', '解決掉'],
  },
];

// ============================================
// 髒話過濾器（絕對禁止）
// ============================================

const PROFANITY_LIST: string[] = [
  // 英文髒話（各種變體）
  'Fuck', 'fuck', 'FUCK', 'F*ck', 'f*ck', 'F**k', 'f**k',
  'FK', 'fk', 'Fk', 'fK',
  'Shit', 'shit', 'SHIT', 'sh*t', 'Sh*t', 'SH*T',
  'Damn', 'damn', 'DAMN',
  'Ass', 'ass', 'ASS',
  'Bitch', 'bitch', 'BITCH',
  'WTF', 'wtf', 'Wtf', 'STFU', 'stfu',
  // 中文髒話（各種變體）
  '靠', '靠北', '靠幸', '靠啊', '靠夫', '靠杯',
  '幹', '幹你', '幹他', '幹嗎', '幹拍', '幹話',
  '媽的', '他媽的', '你媽的', '他媽', '你媽',
  '操', '操你',
  '屁', '屁話', '放屁', '屁啦', '屁嗆',
  '賤', '賤人',
  '婊', '婊子',
  '屎', '狗屎',
  '去死', '死開',
  '白癡', '白吃',
  '智障', '弱智',
  // 變體和諧音
  'X', 'x', '×', // 常用來代替髒話
  '幹！', '靠！', '屁！',
  'F!', 'FK!', 'fk!',
];

// 髮話替代詞（用於替換而非刪除）- 使用多樣化替換詞避免重複
const PROFANITY_REPLACEMENTS_ARRAY: Record<string, string[]> = {
  // 中文髮話替代 - 「靠」系列
  '靠': ['我的天', '真的假的', '傻眼'],
  '靠北': ['我的天', '真的假的', '傻眼'],
  '靠幸': ['我的天', '真的假的', '傻眼'],
  '靠啊': ['我的天', '真的假的', '傻眼'],
  '靠夫': ['我的天', '真的假的', '傻眼'],
  '靠杯': ['我的天', '真的假的', '傻眼'],
  // 中文髮話替代 - 「幹」系列
  '幹': ['傻眼', '無言', '暈'],
  '幹嗎': ['怎樣', '幹嘴', '怕什麼'],
  '幹拍': ['傻眼', '無言', '暈'],
  '幹話': ['傻話', '廢話', '鬼話'],
  '幹！': ['傻眼！', '無言！', '暈！'],
  // 中文髮話替代 - 「媽」系列
  '媽的': ['真的假的', '誠實說', '老實說'],
  '他媽的': ['真的假的', '誠實說', '老實說'],
  '你媽的': ['真的假的', '誠實說', '老實說'],
  '他媽': ['真的', '誠實', '老實'],
  '你媽': ['真的', '誠實', '老實'],
  // 中文髮話替代 - 「屁」系列
  '屁': ['傻眼', '無言', '暈'],
  '屁話': ['傻話', '廢話', '鬼話'],
  '放屁': ['胡說', '亂講', '鬼抉'],
  '屁啦': ['傻眼啦', '無言啦', '暈啦'],
  '屁嗆': ['傻眼嗆', '無言嗆', '暈嗆'],
  '屁！': ['傻眼！', '無言！', '暈！'],
  // 中文髮話替代 - 侵犯性詞彙
  '白癡': ['傻眼', '無言', '暈'],
  '白吃': ['傻眼', '無言', '暈'],
  '智障': ['傻眼', '無言', '暈'],
  '弱智': ['傻眼', '無言', '暈'],
  // 英文髮話替代 - F 系列
  'Fuck': ['我的天', '傻眼', '無言'],
  'fuck': ['我的天', '傻眼', '無言'],
  'FUCK': ['我的天', '傻眼', '無言'],
  'F*ck': ['我的天', '傻眼', '無言'],
  'f*ck': ['我的天', '傻眼', '無言'],
  'F**k': ['我的天', '傻眼', '無言'],
  'f**k': ['我的天', '傻眼', '無言'],
  'FK': ['我的天', '傻眼', '無言'],
  'fk': ['我的天', '傻眼', '無言'],
  'Fk': ['我的天', '傻眼', '無言'],
  'fK': ['我的天', '傻眼', '無言'],
  'FK!': ['我的天！', '傻眼！', '無言！'],
  'fk!': ['我的天！', '傻眼！', '無言！'],
  'F!': ['我的天！', '傻眼！', '無言！'],
  // 英文髮話替代 - S 系列
  'Shit': ['傻眼', '無言', '暈'],
  'shit': ['傻眼', '無言', '暈'],
  'SHIT': ['傻眼', '無言', '暈'],
  'sh*t': ['傻眼', '無言', '暈'],
  'Sh*t': ['傻眼', '無言', '暈'],
  'SH*T': ['傻眼', '無言', '暈'],
  // 英文髮話替代 - D 系列
  'Damn': ['我的天', '真的假的', '傻眼'],
  'damn': ['我的天', '真的假的', '傻眼'],
  'DAMN': ['我的天', '真的假的', '傻眼'],
  // 英文髮話替代 - WTF 系列
  'WTF': ['傻眼', '無言', '暈'],
  'wtf': ['傻眼', '無言', '暈'],
  'Wtf': ['傻眼', '無言', '暈'],
};

// 特殊字元替代（常用來代替髮話）
const SPECIAL_CHAR_REPLACEMENTS: Record<string, string> = {
  'X': '',
  'x': '',
  '×': '',
};

// ============================================
// 強度係數配置
// ============================================

// 說話風格 → 過濾強度係數
const VOICE_TONE_COEFFICIENTS: Record<string, number> = {
  '溫暖真誠': 0.5,      // 溫和過濾
  '專業權威': 0.6,      // 中等過濾
  '幽默風趣': 0.8,      // 較強過濾
  '犀利直接': 1.0,      // 最強過濾
  '療癒陪伴': 0.4,      // 最溫和
  '激勵鼓舞': 0.7,      // 中上過濾
};

// 內容類型 → 過濾強度係數
const CONTENT_TYPE_COEFFICIENTS: Record<string, number> = {
  // 需要較完整邏輯的類型
  'knowledge': 0.5,     // 知識型：保留邏輯連接
  'organize': 0.5,      // 整理型：保留結構
  'summary': 0.5,       // 整理型：保留結構
  'quote': 0.6,         // 引用型：保留引用格式
  
  // 可以更口語化的類型
  'story': 0.8,         // 故事型：可以更隨性
  'viewpoint': 0.9,     // 觀點型：可以更直接
  'dialogue': 0.9,      // 對話型：應該很口語
  'contrast': 0.8,      // 反差型：可以更衝擊
  'casual': 1.0,        // 閒聊型：最口語
  'question': 0.9,      // 提問型：簡短直接
  'poll': 0.9,          // 投票型：簡短直接
  'humor': 1.0,         // 幽默型：最口語
  'diagnosis': 0.8,     // 診斷型：可以口語
  
  // 變現內容
  'self_intro': 0.6,    // 自我介紹：稍微專業
  'lead_magnet': 0.7,   // 引流品：可以口語
  'core_product': 0.6,  // 核心品：稍微專業
  'vip_service': 0.5,   // VIP：較專業
  'success_story': 0.8, // 成功案例：可以口語
};

// 編輯模式 → 過濾強度係數（新增）
const EDIT_MODE_COEFFICIENTS: Record<string, number> = {
  'light': 0.3,         // 輕度優化：只過濾最明顯的 AI 痕跡
  'style': 0.6,         // 風格保留：中等過濾
  'rewrite': 1.0,       // 爆款改寫：最強過濾
};

// ============================================
// 過濾器函數
// ============================================

/**
 * 髮話過濾器（絕對禁止，不受強度影響）
 * 使用多樣化替換詞避免重複
 * 
 * @param content - 要過濾的內容
 * @param userEmotionWords - 用戶自己的情緒詞彙（優先使用）
 */
export function filterProfanity(
  content: string, 
  userEmotionWords: string[] = []
): string {
  let result = content;
  
  // 輔助函數：轉義正則表達式特殊字元
  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  
  // 記錄已使用的替換詞，避免連續重複
  const usedReplacements: string[] = [];
  
  // 過濾用戶情緒詞，只保留適合用作替換的詞彙
  // 排除太長的詞（超過 4 字）或包含特殊字元的詞
  const validUserWords = userEmotionWords.filter(word => 
    word && 
    word.length >= 1 && 
    word.length <= 4 && 
    !/[\n\r\t]/.test(word)
  );
  
  // 如果用戶有自己的情緒詞，優先使用
  const hasUserWords = validUserWords.length > 0;
  
  // 替換有替代詞的髮話（使用多樣化替換）
  for (const [profanity, defaultReplacements] of Object.entries(PROFANITY_REPLACEMENTS_ARRAY)) {
    const escaped = escapeRegex(profanity);
    const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'gi');
    
    // 對每個匹配項隨機選擇替換詞
    result = result.replace(regex, () => {
      // 建構替換詞池：用戶詞彙優先，然後是預設詞彙
      let replacementPool: string[];
      
      if (hasUserWords) {
        // 用戶有自己的情緒詞：70% 機率使用用戶詞彙，30% 使用預設
        if (Math.random() < 0.7) {
          replacementPool = validUserWords;
        } else {
          replacementPool = defaultReplacements;
        }
      } else {
        // 沒有用戶詞彙，使用預設
        replacementPool = defaultReplacements;
      }
      
      // 找出未使用過的替換詞
      const unusedReplacements = replacementPool.filter(r => !usedReplacements.includes(r));
      const availableReplacements = unusedReplacements.length > 0 ? unusedReplacements : replacementPool;
      
      // 隨機選擇一個
      const replacement = availableReplacements[Math.floor(Math.random() * availableReplacements.length)];
      usedReplacements.push(replacement);
      
      // 保持最近 5 個使用過的替換詞，避免連續重複
      if (usedReplacements.length > 5) {
        usedReplacements.shift();
      }
      
      return replacement;
    });
  }
  
  // 替換特殊字元
  for (const [char, replacement] of Object.entries(SPECIAL_CHAR_REPLACEMENTS)) {
    const escaped = escapeRegex(char);
    const regex = new RegExp(escaped, 'g');
    result = result.replace(regex, replacement);
  }
  
  // 刪除沒有替代詞的髮話
  for (const profanity of PROFANITY_LIST) {
    if (!PROFANITY_REPLACEMENTS_ARRAY[profanity]) {
      const escaped = escapeRegex(profanity);
      const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'gi');
      result = result.replace(regex, '');
    }
  }
  
  // 清理可能產生的多餘空格
  result = result.replace(/  +/g, ' ');
  
  return result;
}

/**
 * 成語殺手過濾器
 */
export function filterIdioms(
  content: string, 
  intensity: number = 1.0,
  userPreservedWords: string[] = []
): string {
  let result = content;
  
  for (const [idiom, replacements] of Object.entries(IDIOM_REPLACEMENTS)) {
    // 如果是用戶保留的詞，跳過
    if (userPreservedWords.includes(idiom)) continue;
    
    // 根據強度決定是否替換
    if (Math.random() < intensity) {
      const replacement = replacements[Math.floor(Math.random() * replacements.length)];
      result = result.replace(new RegExp(idiom, 'g'), replacement);
    }
  }
  
  return result;
}

/**
 * 廢話刪除過濾器（分層處理版）
 */
export function filterFillerWords(
  content: string,
  intensity: number = 1.0,
  userPreservedWords: string[] = [],
  editMode?: string
): string {
  let result = content;
  
  // 根據編輯模式決定過濾範圍
  const isLightMode = editMode === 'light';
  const fillerWordsToProcess = isLightMode ? FILLER_WORDS_CRITICAL : FILLER_WORDS;
  
  // 刪除廢話
  for (const filler of fillerWordsToProcess) {
    if (userPreservedWords.includes(filler)) continue;
    
    // 輕度模式：100% 刪除關鍵廢話
    // 其他模式：根據強度決定
    const shouldDelete = isLightMode ? true : Math.random() < intensity;
    
    if (shouldDelete) {
      // 刪除廢話，但保留標點
      result = result.replace(new RegExp(filler + '[，,]?', 'g'), '');
    }
  }
  
  // 替換結構詞（只在非輕度模式下執行）
  if (!isLightMode) {
    for (const [word, replacement] of Object.entries(FILLER_REPLACEMENTS)) {
      if (userPreservedWords.includes(word)) continue;
      
      if (Math.random() < intensity) {
        result = result.replace(new RegExp(word + '[，,：:]?', 'g'), replacement);
      }
    }
  }
  
  // 清理多餘空格和換行
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/  +/g, ' ');
  
  return result;
}

/**
 * 情緒暴衝過濾器
 */
export function filterToEmotional(
  content: string,
  intensity: number = 1.0
): string {
  let result = content;
  
  for (const { pattern, replacements } of EMOTION_PATTERNS) {
    if (Math.random() < intensity) {
      const replacement = replacements[Math.floor(Math.random() * replacements.length)];
      result = result.replace(pattern, replacement);
    }
  }
  
  return result;
}

/**
 * 暴力降維：刪減字數
 */
export function aggressiveSimplify(
  content: string,
  targetReduction: number = 0.3 // 目標刪減 30%
): string {
  // 這個功能需要 AI 來做，這裡只做基本處理
  let result = content;
  
  // 刪除括號內的補充說明（如果太長）
  result = result.replace(/（[^）]{20,}）/g, '');
  result = result.replace(/\([^)]{20,}\)/g, '');
  
  // 刪除「也就是說」後面的解釋
  result = result.replace(/也就是說[，,]?[^。\n]+[。]/g, '');
  
  // 刪除「換句話說」後面的重複
  result = result.replace(/換句話說[，,]?[^。\n]+[。]/g, '');
  
  return result;
}

/**
 * 計算過濾強度（優化版 - 支援編輯模式）
 */
export function calculateFilterIntensity(
  voiceTone?: string,
  contentType?: string,
  hasUserStyle: boolean = false,
  editMode?: string
): number {
  // 如果用戶有上傳爆款貼文，降低過濾強度
  let baseIntensity = hasUserStyle ? 0.5 : 1.0;
  
  // 根據說話風格調整
  const voiceCoef = voiceTone 
    ? (VOICE_TONE_COEFFICIENTS[voiceTone] || 0.7)
    : 0.7;
  
  // 根據內容類型調整
  const contentCoef = contentType
    ? (CONTENT_TYPE_COEFFICIENTS[contentType] || 0.7)
    : 0.7;
  
  // 根據編輯模式調整（新增）
  const editModeCoef = editMode
    ? (EDIT_MODE_COEFFICIENTS[editMode] || 1.0)
    : 1.0;
  
  return baseIntensity * voiceCoef * contentCoef * editModeCoef;
}

/**
 * 主過濾函數：整合所有過濾器（優化版）
 */
export function applyContentFilters(
  content: string,
  options: {
    voiceTone?: string;
    contentType?: string;
    hasUserStyle?: boolean;
    userPreservedWords?: string[];
    userEmotionWords?: string[];  // 用戶的情緒詞彙（用於髮話替換）
    enableIdiomFilter?: boolean;
    enableFillerFilter?: boolean;
    enableEmotionFilter?: boolean;
    enableSimplify?: boolean;
    editMode?: string;  // 新增：編輯模式
  } = {}
): string {
  const {
    voiceTone,
    contentType,
    hasUserStyle = false,
    userPreservedWords = [],
    userEmotionWords = [],
    enableIdiomFilter = true,
    enableFillerFilter = true,
    enableEmotionFilter = true,
    enableSimplify = false,
    editMode,
  } = options;
  
  // 計算過濾強度（考慮編輯模式）
  const intensity = calculateFilterIntensity(voiceTone, contentType, hasUserStyle, editMode);
  
  let result = content;
  
  // 0. 髮話過濾（最優先，絕對禁止，不受強度影響）
  // 如果用戶有自己的情緒詞彙，優先使用這些詞彙來替換髮話
  result = filterProfanity(result, userEmotionWords);
  
  // 1. 成語殺手
  if (enableIdiomFilter) {
    result = filterIdioms(result, intensity, userPreservedWords);
  }
  
  // 2. 廢話刪除（分層處理）
  if (enableFillerFilter) {
    result = filterFillerWords(result, intensity, userPreservedWords, editMode);
  }
  
  // 3. 情緒暴衝（輕度模式下不執行）
  if (enableEmotionFilter && editMode !== 'light') {
    result = filterToEmotional(result, intensity);
  }
  
  // 4. 暴力降維（可選）
  if (enableSimplify) {
    result = aggressiveSimplify(result);
  }
  
  return result;
}

// ============================================
// AI 內部標記清理器
// ============================================

/**
 * 清理 AI 生成內容中的內部標記和提示詞殘留
 * 採用精準匹配策略，只移除特定格式的內部標記
 */
export function cleanAIInternalMarkers(content: string): string {
  let result = content;
  
  // 1. 移除「(自我檢查：...)」格式的內部標記
  result = result.replace(/[\(\uff08]自我檢查[\uff1a:][^\)\uff09]+[\)\uff09]/g, '');
  
  // 2. 移除「(字數約...)」格式的字數統計
  result = result.replace(/[\(\uff08]字數約[^\)\uff09]+[\)\uff09]/g, '');
  
  // 3. 移除「--- (字數...)」格式的分隔線和字數統計
  result = result.replace(/---\s*[\(\uff08]字數[^\)\uff09]+[\)\uff09]/g, '');
  
  // 4. 移除「情境模擬：」開頭的整個段落（到下一個空行為止）
  result = result.replace(/情境模擬[\uff1a:][\s\S]*?(?=\n\n|$)/g, '');
  
  // 5. 移除「[內部標記]」格式
  result = result.replace(/\[內部標記\][^\n]*/g, '');
  
  // 6. 移除「【提示】」格式
  result = result.replace(/【提示】[^\n]*/g, '');
  
  // 7. 移除「注意：」開頭的內部提醒（通常是 AI 的自我提醒）
  result = result.replace(/\n注意[\uff1a:][^\n]+\n/g, '\n');
  
  // 8. 移除「(符合要求...)」格式
  result = result.replace(/[\(\uff08]符合要求[^\)\uff09]+[\)\uff09]/g, '');
  
  // 9. 移除「(語氣到位...)」格式
  result = result.replace(/[\(\uff08]語氣到位[^\)\uff09]*[\)\uff09]/g, '');
  
  // 10. 移除「(模擬...)」格式
  result = result.replace(/[\(\uff08]模擬[^\)\uff09]+[\)\uff09]/g, '');
  
  // 11. 移除「好的，教練」、「好的，我來...」等 AI 回應前綴
  result = result.replace(/^好的[，,][^\n]*\n/gm, '');
  result = result.replace(/^收到[，,][^\n]*\n/gm, '');
  result = result.replace(/^我來幫你[^\n]*\n/gm, '');
  result = result.replace(/^讓我來[^\n]*\n/gm, '');
  
  // 12. 移除「---」獨立分隔線（如果前後是空行）
  result = result.replace(/\n---\n/g, '\n');
  
  // 13. 移除「👉 **邏輯X：...**」格式的標題（AI 常用的教學文章格式）
  // 匹配：👉 **邏輯一：...**、👉 **邏輯二：...**、👉 **邏輯三：...**
  result = result.replace(/👉\s*\*\*邏輯[一二三四五六七八九十\d]+[：:][^*]+\*\*/g, '');
  
  // 14. 移除「第X點：」、「重點X：」等編號格式
  result = result.replace(/第[一二三四五六七八九十\d]+[點個條][：:]/g, '');
  result = result.replace(/重點[一二三四五六七八九十\d]+[：:]/g, '');
  result = result.replace(/邏輯[一二三四五六七八九十\d]+[：:]/g, '');
  
  // 15. 移除「**...**」粗體標題後的「。**」（保留內容）
  // 例如：**內容就是「篩選器」，不是「流量密碼」。** → 內容就是「篩選器」，不是「流量密碼」。
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  // 清理多餘的空行
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // 清理開頭和結尾的空白
  result = result.trim();
  
  return result;
}

// ============================================
// 內容去重複器
// ============================================

/**
 * 移除 AI 生成內容中的重複段落
 * 只移除「完全相同」且「超過 20 字」的重複段落
 */
export function removeDuplicateParagraphs(content: string): string {
  // 分割成段落
  const paragraphs = content.split(/\n\n+/);
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    
    // 空段落跳過
    if (!trimmed) continue;
    
    // 短段落（20 字以內）不檢查重複（可能是修轭手法）
    if (trimmed.length <= 20) {
      result.push(paragraph);
      continue;
    }
    
    // 檢查是否重複
    if (seen.has(trimmed)) {
      // 跳過重複段落
      continue;
    }
    
    seen.add(trimmed);
    result.push(paragraph);
  }
  
  return result.join('\n\n');
}

/**
 * 移除連續重複的句子（在同一段落內）
 */
export function removeDuplicateSentences(content: string): string {
  // 分割成段落
  const paragraphs = content.split(/\n/);
  const result: string[] = [];
  
  for (const paragraph of paragraphs) {
    // 分割成句子
    const sentences = paragraph.split(/(?<=[\u3002\uff01\uff1f。!?])/);
    const seen = new Set<string>();
    const cleanSentences: string[] = [];
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      
      // 空句子跳過
      if (!trimmed) continue;
      
      // 短句子（10 字以內）不檢查重複
      if (trimmed.length <= 10) {
        cleanSentences.push(sentence);
        continue;
      }
      
      // 檢查是否重複
      if (seen.has(trimmed)) {
        continue;
      }
      
      seen.add(trimmed);
      cleanSentences.push(sentence);
    }
    
    result.push(cleanSentences.join(''));
  }
  
  return result.join('\n');
}

// ============================================
// 綜合清理函數
// ============================================

/**
 * 綜合清理 AI 輸出：移除內部標記 + 去重複 + 髒話過濾
 */
export function cleanAIOutput(content: string): string {
  let result = content;
  
  // 1. 清理內部標記
  result = cleanAIInternalMarkers(result);
  
  // 2. 移除重複段落
  result = removeDuplicateParagraphs(result);
  
  // 3. 移除重複句子
  result = removeDuplicateSentences(result);
  
  // 4. 髒話過濾
  result = filterProfanity(result);
  
  return result;
}

// ============================================
// 工具函數
// ============================================

// 安全地將值轉換為陣列的輔助函數
const toArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string') {
    return value.split(/[,;，；]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
};

/**
 * 從用戶風格分析中提取保留詞
 * 安全處理各種可能的資料格式（陣列、字串、物件等）
 */
export function extractPreservedWords(userStyle: {
  commonPhrases?: string[] | string | null;
  catchphrases?: string[] | string | null;
  viralElements?: {
    identityTags?: string[];
    emotionWords?: string[];
    ctaStyles?: string[];
  } | string[] | string | null;
} | null): string[] {
  if (!userStyle) return [];
  
  const preserved: string[] = [];
  
  // 處理 commonPhrases
  preserved.push(...toArray(userStyle.commonPhrases));
  
  // 處理 catchphrases
  preserved.push(...toArray(userStyle.catchphrases));
  
  // 處理 viralElements（可能是物件或陣列）
  if (userStyle.viralElements) {
    if (typeof userStyle.viralElements === 'object' && !Array.isArray(userStyle.viralElements)) {
      // viralElements 是物件，提取其中的陣列
      const ve = userStyle.viralElements as {
        identityTags?: string[];
        emotionWords?: string[];
        ctaStyles?: string[];
      };
      preserved.push(...toArray(ve.identityTags));
      preserved.push(...toArray(ve.emotionWords));
      preserved.push(...toArray(ve.ctaStyles));
    } else {
      // viralElements 是陣列或字串
      preserved.push(...toArray(userStyle.viralElements));
    }
  }
  
  return preserved;
}

/**
 * 從用戶風格分析中提取情緒詞彙
 * 用於髮話過濾器的替換詞
 */
export function extractEmotionWords(userStyle: {
  viralElements?: {
    identityTags?: string[];
    emotionWords?: string[];
    ctaStyles?: string[];
  } | string[] | string | null;
  catchphrases?: string[] | string | null;
} | null): string[] {
  if (!userStyle) return [];
  
  const emotionWords: string[] = [];
  
  // 優先從 viralElements.emotionWords 提取
  if (userStyle.viralElements) {
    if (typeof userStyle.viralElements === 'object' && !Array.isArray(userStyle.viralElements)) {
      const ve = userStyle.viralElements as {
        emotionWords?: string[];
      };
      if (ve.emotionWords) {
        emotionWords.push(...toArray(ve.emotionWords));
      }
    }
  }
  
  // 如果沒有情緒詞，從 catchphrases 中提取短詞（可能是情緒表達）
  if (emotionWords.length === 0 && userStyle.catchphrases) {
    const catchphrases = toArray(userStyle.catchphrases);
    // 只保留 1-4 字的短詞（可能是情緒表達）
    const shortPhrases = catchphrases.filter(p => p.length >= 1 && p.length <= 4);
    emotionWords.push(...shortPhrases);
  }
  
  return emotionWords;
}
