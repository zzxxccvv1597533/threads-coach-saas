/**
 * 漸進式去 AI 化過濾器系統
 * 
 * 設計原則：
 * 1. 用戶風格優先：如果用戶有上傳爆款貼文，優先使用學習到的風格
 * 2. 動態強度：根據說話風格和內容類型調整過濾強度
 * 3. 漸進式：只過濾「明確的 AI 痕跡」，保留用戶可能會用的表達
 */

// ============================================
// 成語殺手：AI 常用成語 → 白話替換
// ============================================

const IDIOM_REPLACEMENTS: Record<string, string[]> = {
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
};

// ============================================
// 廢話刪除：AI 連接詞和冗詞
// ============================================

const FILLER_WORDS: string[] = [
  // 連接詞（過度正式）
  '此外',
  '因此',
  '然而',
  '總而言之',
  '綜上所述',
  '由此可見',
  '換言之',
  '簡而言之',
  '總的來說',
  '歸根結底',
  '不僅如此',
  '與此同時',
  '值得一提的是',
  '不可否認',
  '毋庸置疑',
  '顯而易見',
  '眾所周知',
  
  // AI 常用開頭
  '身為一個',
  '身為一位',
  '作為一個',
  '作為一位',
  '這句話聽起來很殘酷，但',
  '這聽起來可能有點',
  '說實話',
  '坦白說',
  '老實說',
  '不得不說',
  '我必須承認',
  '我想說的是',
  '我認為',
  '我覺得',
  '我相信',
  
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
  
  // 冗詞
  '事實上',
  '實際上',
  '基本上',
  '本質上',
  '某種程度上',
  '在某種意義上',
  '從某種角度來看',
  '從這個角度來說',
];

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
// 情緒暴衝：陳述句 → 情緒句
// ============================================

const EMOTION_PATTERNS: Array<{
  pattern: RegExp;
  replacements: string[];
}> = [
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

// 髒話替代詞（用於替換而非刪除）
const PROFANITY_REPLACEMENTS: Record<string, string> = {
  // 中文髒話替代
  '靠': '天啊',
  '靠北': '天啊',
  '靠幸': '天啊',
  '靠啊': '天啊',
  '靠夫': '天啊',
  '靠杯': '天啊',
  '幹': '天啊',
  '幹嗎': '天啊',
  '幹拍': '天啊',
  '幹話': '傻話',
  '幹！': '天啊！',
  '媽的': '真的假的',
  '他媽的': '真的假的',
  '你媽的': '真的假的',
  '他媽': '真的',
  '你媽': '真的',
  '屁': '傻眼',
  '屁話': '傻話',
  '放屁': '胡說',
  '屁啦': '傻眼啦',
  '屁嗆': '傻眼嗆',
  '屁！': '傻眼！',
  '白癡': '傻眼',
  '白吃': '傻眼',
  '智障': '傻眼',
  '弱智': '傻眼',
  // 英文髒話替代（各種變體）
  'Fuck': '天啊',
  'fuck': '天啊',
  'FUCK': '天啊',
  'F*ck': '天啊',
  'f*ck': '天啊',
  'F**k': '天啊',
  'f**k': '天啊',
  'FK': '天啊',
  'fk': '天啊',
  'Fk': '天啊',
  'fK': '天啊',
  'FK!': '天啊！',
  'fk!': '天啊！',
  'F!': '天啊！',
  'Shit': '傻眼',
  'shit': '傻眼',
  'SHIT': '傻眼',
  'sh*t': '傻眼',
  'Sh*t': '傻眼',
  'SH*T': '傻眼',
  'Damn': '天啊',
  'damn': '天啊',
  'DAMN': '天啊',
  'WTF': '傻眼',
  'wtf': '傻眼',
  'Wtf': '傻眼',
  // 特殊字元替代（常用來代替髒話）
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
  'quote': 0.6,         // 引用型：保留引用格式
  
  // 可以更口語化的類型
  'story': 0.8,         // 故事型：可以更隨性
  'viewpoint': 0.9,     // 觀點型：可以更直接
  'dialogue': 0.9,      // 對話型：應該很口語
  'contrast': 0.8,      // 反差型：可以更衝擊
  'casual': 1.0,        // 閒聊型：最口語
  'question': 0.9,      // 提問型：簡短直接
  'poll': 0.9,          // 投票型：簡短直接
  
  // 變現內容
  'self_intro': 0.6,    // 自我介紹：稍微專業
  'lead_magnet': 0.7,   // 引流品：可以口語
  'core_product': 0.6,  // 核心品：稍微專業
  'vip_service': 0.5,   // VIP：較專業
  'success_story': 0.8, // 成功案例：可以口語
};

// ============================================
// 過濾器函數
// ============================================

/**
 * 髒話過濾器（絕對禁止，不受強度影響）
 */
export function filterProfanity(content: string): string {
  let result = content;
  
  // 輔助函數：轉義正則表達式特殊字元
  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  
  // 優先替換有替代詞的髒話
  for (const [profanity, replacement] of Object.entries(PROFANITY_REPLACEMENTS)) {
    // 轉義特殊字元後再建立正則表達式
    const escaped = escapeRegex(profanity);
    const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'gi');
    result = result.replace(regex, replacement);
  }
  
  // 刪除沒有替代詞的髒話
  for (const profanity of PROFANITY_LIST) {
    if (!PROFANITY_REPLACEMENTS[profanity]) {
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
 * 廢話刪除過濾器
 */
export function filterFillerWords(
  content: string,
  intensity: number = 1.0,
  userPreservedWords: string[] = []
): string {
  let result = content;
  
  // 刪除廢話
  for (const filler of FILLER_WORDS) {
    if (userPreservedWords.includes(filler)) continue;
    
    if (Math.random() < intensity) {
      // 刪除廢話，但保留標點
      result = result.replace(new RegExp(filler + '[，,]?', 'g'), '');
    }
  }
  
  // 替換結構詞
  for (const [word, replacement] of Object.entries(FILLER_REPLACEMENTS)) {
    if (userPreservedWords.includes(word)) continue;
    
    if (Math.random() < intensity) {
      result = result.replace(new RegExp(word + '[，,：:]?', 'g'), replacement);
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
 * 計算過濾強度
 */
export function calculateFilterIntensity(
  voiceTone?: string,
  contentType?: string,
  hasUserStyle: boolean = false
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
  
  return baseIntensity * voiceCoef * contentCoef;
}

/**
 * 主過濾函數：整合所有過濾器
 */
export function applyContentFilters(
  content: string,
  options: {
    voiceTone?: string;
    contentType?: string;
    hasUserStyle?: boolean;
    userPreservedWords?: string[];
    enableIdiomFilter?: boolean;
    enableFillerFilter?: boolean;
    enableEmotionFilter?: boolean;
    enableSimplify?: boolean;
  } = {}
): string {
  const {
    voiceTone,
    contentType,
    hasUserStyle = false,
    userPreservedWords = [],
    enableIdiomFilter = true,
    enableFillerFilter = true,
    enableEmotionFilter = true,
    enableSimplify = false,
  } = options;
  
  // 計算過濾強度
  const intensity = calculateFilterIntensity(voiceTone, contentType, hasUserStyle);
  
  let result = content;
  
  // 0. 髒話過濾（最優先，絕對禁止，不受強度影響）
  result = filterProfanity(result);
  
  // 1. 成語殺手
  if (enableIdiomFilter) {
    result = filterIdioms(result, intensity, userPreservedWords);
  }
  
  // 2. 廢話刪除
  if (enableFillerFilter) {
    result = filterFillerWords(result, intensity, userPreservedWords);
  }
  
  // 3. 情緒暴衝
  if (enableEmotionFilter) {
    result = filterToEmotional(result, intensity);
  }
  
  // 4. 暴力降維（可選）
  if (enableSimplify) {
    result = aggressiveSimplify(result);
  }
  
  return result;
}

/**
 * 從用戶風格分析中提取保留詞
 * 安全處理各種可能的資料格式（陣列、字串、物件等）
 */
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
  result = result.replace(/^好的[\uff0c,][^\n]*\n/gm, '');
  result = result.replace(/^收到[\uff0c,][^\n]*\n/gm, '');
  result = result.replace(/^我來幫你[^\n]*\n/gm, '');
  result = result.replace(/^讓我來[^\n]*\n/gm, '');
  
  // 12. 移除「---」獨立分隔線（如果前後是空行）
  result = result.replace(/\n---\n/g, '\n');
  
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
  
  // 安全地將值轉換為陣列
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
