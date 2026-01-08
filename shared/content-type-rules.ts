/**
 * 貼文類型專屬規則模組
 * 定義 11 種貼文類型的專屬規則，包括字數範圍、推薦開頭模式、結構模板等
 */

export interface ContentTypeRule {
  id: string;
  name: string;
  description: string;
  wordLimit: {
    min: number;
    max: number;
    reason: string;
  };
  recommendedOpeners: string[];
  structureTemplate: string[];
  ctaSuggestions: string[];
  keyFeatures: string[];
  avoidPatterns: string[];
}

// 11 種貼文類型的專屬規則
export const CONTENT_TYPE_RULES: Record<string, ContentTypeRule> = {
  viewpoint: {
    id: 'viewpoint',
    name: '觀點型',
    description: '表達個人觀點、立場或看法的貼文',
    wordLimit: {
      min: 150,
      max: 200,
      reason: '觀點要精準有力，太長會稀釋力道。讀者只需要「一個觀點 + 簡短支撐」'
    },
    recommendedOpeners: ['冒號斷言', '禁忌/警告詞', '對話式「你」', '反直覺陳述'],
    structureTemplate: [
      '第一行：直接拋出觀點（用冒號斷言格式）',
      '第二段：用 1-2 個經歷或論點支撐',
      '第三段：強化觀點或轉折',
      '結尾：「你怎麼看？」或「你同意嗎？」'
    ],
    ctaSuggestions: ['你怎麼看？', '你同意嗎？', '你覺得呢？'],
    keyFeatures: ['觀點鮮明', '立場清晰', '有理有據'],
    avoidPatterns: ['長篇大論', '模糊立場', '說教口吻']
  },
  
  story: {
    id: 'story',
    name: '故事型',
    description: '分享個人經歷或故事的貼文',
    wordLimit: {
      min: 300,
      max: 400,
      reason: '故事需要「場景 → 衝突 → 轉折 → 啟發」完整結構，但不能太長變流水帳'
    },
    recommendedOpeners: ['時間點', '結果導向', '對話式「你」'],
    structureTemplate: [
      '第一行：時間點或結果導向開頭',
      '第二段：場景描述（簡短）',
      '第三段：衝突或問題',
      '第四段：轉折點',
      '第五段：啟發或收穫',
      '結尾：邀請分享類似經歷'
    ],
    ctaSuggestions: ['你有過類似經歷嗎？', '你會怎麼做？', '分享你的故事'],
    keyFeatures: ['有場景感', '有轉折', '有啟發'],
    avoidPatterns: ['流水帳', '沒有重點', '說教結尾']
  },
  
  knowledge: {
    id: 'knowledge',
    name: '知識型',
    description: '分享專業知識或技巧的貼文',
    wordLimit: {
      min: 400,
      max: 500,
      reason: '知識需要分點說明，但每點要精簡。3-5 個重點 × 每點 80-100 字'
    },
    recommendedOpeners: ['數字開頭', '禁忌/警告詞', '冒號斷言'],
    structureTemplate: [
      '第一行：數字開頭或冒號斷言',
      '第二段：為什麼這很重要（痛點）',
      '第三段起：分點說明（每點一個小標 + 解釋）',
      '結尾：總結或行動呼籲'
    ],
    ctaSuggestions: ['收藏起來！', '哪一點對你最有用？', '還想知道什麼？'],
    keyFeatures: ['結構清晰', '實用性強', '有具體方法'],
    avoidPatterns: ['太抽象', '沒有例子', '專業術語太多']
  },
  
  summary: {
    id: 'summary',
    name: '整理型',
    description: '整理清單、懶人包類型的貼文',
    wordLimit: {
      min: 400,
      max: 500,
      reason: '清單型內容，5-7 個點 × 每點 60-80 字'
    },
    recommendedOpeners: ['數字開頭', '冒號斷言'],
    structureTemplate: [
      '第一行：數字開頭（N 個...）',
      '第二段：簡短說明為什麼整理這個',
      '第三段起：清單項目（每項一行或一小段）',
      '結尾：收藏提醒或補充邀請'
    ],
    ctaSuggestions: ['先收藏！', '還有什麼要補充的？', '哪個最實用？'],
    keyFeatures: ['條理分明', '易於收藏', '實用價值高'],
    avoidPatterns: ['項目太多', '每項太長', '沒有分類']
  },
  
  contrast: {
    id: 'contrast',
    name: '反差型',
    description: '打破常見認知、製造反差的貼文',
    wordLimit: {
      min: 300,
      max: 400,
      reason: '需要「常見認知 → 轉折 → 真相解釋」的空間'
    },
    recommendedOpeners: ['冒號斷言', '禁忌/警告詞', '反直覺陳述'],
    structureTemplate: [
      '第一行：點出常見認知是錯的',
      '第二段：描述大家以為的樣子',
      '第三段：轉折（但其實...）',
      '第四段：解釋真相',
      '結尾：邀請討論'
    ],
    ctaSuggestions: ['你以前也這樣想嗎？', '被打臉了嗎？', '你怎麼看？'],
    keyFeatures: ['反差明顯', '有說服力', '顛覆認知'],
    avoidPatterns: ['反差太弱', '沒有解釋', '為反而反']
  },
  
  casual: {
    id: 'casual',
    name: '閒聊型',
    description: '輕鬆隨意的日常分享',
    wordLimit: {
      min: 150,
      max: 200,
      reason: '輕鬆隨意，像傳訊息，太長就不像閒聊了'
    },
    recommendedOpeners: ['時間點', '對話式「你」'],
    structureTemplate: [
      '第一行：時間點或對話式開頭',
      '第二段：簡短描述發生什麼',
      '第三段：你的感受或想法',
      '結尾：輕鬆的互動邀請'
    ],
    ctaSuggestions: ['你呢？', '有人跟我一樣嗎？', '懂的舉手'],
    keyFeatures: ['輕鬆自然', '有人味', '易共鳴'],
    avoidPatterns: ['太正式', '太長', '說教']
  },
  
  dialogue: {
    id: 'dialogue',
    name: '對話型',
    description: '引用對話或問答形式的貼文',
    wordLimit: {
      min: 150,
      max: 200,
      reason: '對話 + 簡短回應，太長會失去對話感'
    },
    recommendedOpeners: ['時間點', '對話式「你」'],
    structureTemplate: [
      '第一行：時間點開頭（昨天有人問我...）',
      '第二段：對話內容（可用引號）',
      '第三段：你的回應或想法',
      '結尾：邀請讀者分享'
    ],
    ctaSuggestions: ['你會怎麼回？', '你遇過這種問題嗎？', '你的答案是？'],
    keyFeatures: ['對話真實', '有互動感', '引發思考'],
    avoidPatterns: ['對話太長', '回應太說教', '沒有重點']
  },
  
  question: {
    id: 'question',
    name: '提問型',
    description: '向讀者提問、徵求意見的貼文',
    wordLimit: {
      min: 150,
      max: 200,
      reason: '問題 + 背景說明，太長讀者就不想回答了'
    },
    recommendedOpeners: ['對話式「你」', '反直覺陳述'],
    structureTemplate: [
      '第一行：對話式開頭或直接提問',
      '第二段：為什麼想問這個（背景）',
      '第三段：你的初步想法（可選）',
      '結尾：明確的問題'
    ],
    ctaSuggestions: ['你怎麼看？', '你會怎麼選？', '留言告訴我'],
    keyFeatures: ['問題明確', '有背景', '易回答'],
    avoidPatterns: ['問題太模糊', '背景太長', '問太多問題']
  },
  
  poll: {
    id: 'poll',
    name: '投票型',
    description: '讓讀者選擇的投票類貼文',
    wordLimit: {
      min: 150,
      max: 200,
      reason: '選項 + 簡短說明，重點是讓人快速選擇'
    },
    recommendedOpeners: ['對話式「你」', '數字開頭'],
    structureTemplate: [
      '第一行：對話式開頭或直接問題',
      '第二段：選項列表（A/B 或 1/2/3）',
      '第三段：簡短說明或你的選擇',
      '結尾：邀請投票'
    ],
    ctaSuggestions: ['你選哪個？', '留言 A 或 B', '投票！'],
    keyFeatures: ['選項清晰', '易於選擇', '有趣味性'],
    avoidPatterns: ['選項太多', '選項太相似', '沒有說明']
  },
  
  quote: {
    id: 'quote',
    name: '引用型',
    description: '引用名言或他人觀點並加以延伸',
    wordLimit: {
      min: 300,
      max: 400,
      reason: '引用 + 個人解讀，需要空間展開觀點'
    },
    recommendedOpeners: ['冒號斷言', '反直覺陳述'],
    structureTemplate: [
      '第一行：冒號斷言或直接引用',
      '第二段：引用來源（可選）',
      '第三段：你的解讀',
      '第四段：延伸觀點或應用',
      '結尾：邀請討論'
    ],
    ctaSuggestions: ['你怎麼理解這句話？', '你同意嗎？', '分享你的解讀'],
    keyFeatures: ['引用有力', '解讀獨特', '有延伸'],
    avoidPatterns: ['只有引用沒有解讀', '解讀太淺', '引用太長']
  },
  
  diagnosis: {
    id: 'diagnosis',
    name: '診斷型',
    description: '列舉特徵讓讀者自我診斷的貼文',
    wordLimit: {
      min: 300,
      max: 400,
      reason: '特徵列舉 + 標籤揭曉 + 解析，需要完整結構'
    },
    recommendedOpeners: ['對話式「你」', '數字開頭'],
    structureTemplate: [
      '第一行：對話式開頭（你是不是...）',
      '第二段：特徵列舉（3-5 個）',
      '第三段：診斷結果/標籤',
      '第四段：解析或建議',
      '結尾：邀請對號入座'
    ],
    ctaSuggestions: ['中了幾個？', '你是哪一種？', '對號入座'],
    keyFeatures: ['特徵明確', '有共鳴', '有解析'],
    avoidPatterns: ['特徵太模糊', '沒有診斷結果', '太負面']
  }
};

/**
 * 根據貼文類型取得規則
 */
export function getContentTypeRule(contentType: string): ContentTypeRule | null {
  return CONTENT_TYPE_RULES[contentType] || null;
}

/**
 * 取得所有貼文類型
 */
export function getAllContentTypes(): ContentTypeRule[] {
  return Object.values(CONTENT_TYPE_RULES);
}

/**
 * 建構貼文類型專屬規則提示詞
 */
export function buildContentTypePrompt(contentType: string): string {
  const rule = getContentTypeRule(contentType);
  
  if (!rule) {
    return `
=== 第二層：貼文類型規則 ===
【類型】未知類型
【字數範圍】150-400 字
`;
  }
  
  return `
=== 第二層：${rule.name}專屬規則 ===

【類型說明】${rule.description}

【字數範圍】${rule.wordLimit.min}-${rule.wordLimit.max} 字
【字數原因】${rule.wordLimit.reason}

【推薦開頭模式】${rule.recommendedOpeners.join('、')}

【結構模板】
${rule.structureTemplate.map((s, i) => `${i + 1}. ${s}`).join('\n')}

【CTA 建議】${rule.ctaSuggestions.join(' / ')}

【關鍵特徵】${rule.keyFeatures.join('、')}

【避免模式】${rule.avoidPatterns.join('、')}
`;
}

/**
 * 驗證內容是否符合類型規則
 */
export function validateContentTypeRules(
  content: string,
  contentType: string
): {
  isValid: boolean;
  wordCountValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const rule = getContentTypeRule(contentType);
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  if (!rule) {
    return {
      isValid: true,
      wordCountValid: true,
      issues: [],
      suggestions: []
    };
  }
  
  // 檢查字數
  const wordCount = content.length;
  const wordCountValid = wordCount >= rule.wordLimit.min && wordCount <= rule.wordLimit.max;
  
  if (wordCount < rule.wordLimit.min) {
    issues.push(`字數不足：目前 ${wordCount} 字，建議至少 ${rule.wordLimit.min} 字`);
    suggestions.push('可以增加更多細節或例子');
  }
  
  if (wordCount > rule.wordLimit.max) {
    issues.push(`字數過多：目前 ${wordCount} 字，建議不超過 ${rule.wordLimit.max} 字`);
    suggestions.push('可以精簡內容，保留核心觀點');
  }
  
  // 檢查是否有 CTA
  const hasCTA = rule.ctaSuggestions.some(cta => content.includes(cta)) ||
                 /你(怎麼看|同意嗎|覺得呢|有過|會怎麼)|留言|分享/.test(content);
  
  if (!hasCTA) {
    issues.push('缺少互動引導（CTA）');
    suggestions.push(`建議結尾加入：${rule.ctaSuggestions[0]}`);
  }
  
  return {
    isValid: issues.length === 0,
    wordCountValid,
    issues,
    suggestions
  };
}
