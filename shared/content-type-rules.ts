/**
 * 貼文類型專屬規則模組
 * 定義 12 種貼文類型的專屬規則，包括字數範圍、推薦開頭模式、結構模板等
 * 
 * 優化版本 v2.0 - 根據 17,850 篇爆款資料庫分析調整
 * 
 * 主要調整：
 * 1. 字數設定：根據資料分析，150-200 字成功率最高（5.5%），超過 500 字成功率為 0
 * 2. 新增幽默型：平均讚數 47,907，遠超其他類型
 * 3. 調整推薦開頭：新增情緒爆發、家庭故事、自白坦承等高效模式
 */

export interface ContentTypeRule {
  id: string;
  name: string;
  description: string;
  wordLimit: {
    min: number;
    max: number;
    optimal: number; // 最佳字數（基於資料分析）
    reason: string;
  };
  recommendedOpeners: string[];
  structureTemplate: string[];
  ctaSuggestions: string[];
  keyFeatures: string[];
  avoidPatterns: string[];
  successRate?: number; // 成功率（基於爆款資料庫分析）
  avgLikes?: number; // 平均讚數（基於爆款資料庫分析）
}

// 12 種貼文類型的專屬規則（優化版）
export const CONTENT_TYPE_RULES: Record<string, ContentTypeRule> = {
  viewpoint: {
    id: 'viewpoint',
    name: '觀點型',
    description: '表達個人觀點、立場或看法的貼文',
    wordLimit: {
      min: 150,
      max: 250,
      optimal: 180,
      reason: '觀點要精準有力，太長會稀釋力道。資料顯示 150-200 字成功率最高（5.5%）'
    },
    successRate: 4.2,
    avgLikes: 3800,
    recommendedOpeners: ['冒號斷言', '情緒爆發', '自白坦承', '禁忌/警告詞', '反直覺陳述'],
    structureTemplate: [
      '第一行：直接拋出觀點（用冒號斷言或情緒爆發格式）',
      '第二段：用 1-2 個經歷或論點支撐（不要超過 3 句）',
      '第三段：強化觀點或轉折',
      '結尾：「你怎麼看？」或「你同意嗎？」'
    ],
    ctaSuggestions: ['你怎麼看？', '你同意嗎？', '你覺得呢？', '懂的人自然懂'],
    keyFeatures: ['觀點鮮明', '立場清晰', '有理有據', '情緒真實'],
    avoidPatterns: ['長篇大論', '模糊立場', '說教口吻', '過度正向']
  },
  
  story: {
    id: 'story',
    name: '故事型',
    description: '分享個人經歷或故事的貼文',
    wordLimit: {
      min: 200,
      max: 350,
      optimal: 280,
      reason: '故事需要「場景 → 衝突 → 轉折 → 啟發」完整結構，但資料顯示超過 400 字成功率下降'
    },
    successRate: 6.8,
    avgLikes: 5200,
    recommendedOpeners: ['家庭故事', '時間點', '對話引用', '自白坦承', '朋友故事', '情緒爆發'],
    structureTemplate: [
      '第一行：家庭故事或時間點開頭（如「我媽昨天跟我說...」）',
      '第二段：場景描述（2-3 句，簡短有畫面）',
      '第三段：衝突或問題（1-2 句）',
      '第四段：轉折點（關鍵一句話）',
      '第五段：啟發或收穫（不要說教）',
      '結尾：邀請分享類似經歷'
    ],
    ctaSuggestions: ['你有過類似經歷嗎？', '你會怎麼做？', '分享你的故事', '懂的人留言'],
    keyFeatures: ['有場景感', '有轉折', '有啟發', '情緒真實'],
    avoidPatterns: ['流水帳', '沒有重點', '說教結尾', '太長']
  },
  
  knowledge: {
    id: 'knowledge',
    name: '知識型',
    description: '分享專業知識或技巧的貼文',
    wordLimit: {
      min: 250,
      max: 400,
      optimal: 320,
      reason: '知識需要分點說明，但資料顯示 3-4 個重點 × 每點 60-80 字最有效，超過 500 字成功率為 0'
    },
    successRate: 3.5,
    avgLikes: 2800,
    recommendedOpeners: ['數字開頭', '禁忌/警告詞', '冒號斷言', '情緒爆發'],
    structureTemplate: [
      '第一行：數字開頭或冒號斷言（如「3 個讓你學了還是不會的原因」）',
      '第二段：為什麼這很重要（痛點，1-2 句）',
      '第三段起：分點說明（每點一個小標 + 1-2 句解釋，最多 4 點）',
      '結尾：總結或行動呼籲'
    ],
    ctaSuggestions: ['收藏起來！', '哪一點對你最有用？', '還想知道什麼？', '先存再說'],
    keyFeatures: ['結構清晰', '實用性強', '有具體方法', '精簡有力'],
    avoidPatterns: ['太抽象', '沒有例子', '專業術語太多', '太長']
  },
  
  summary: {
    id: 'summary',
    name: '整理型',
    description: '整理清單、懶人包類型的貼文',
    wordLimit: {
      min: 200,
      max: 350,
      optimal: 280,
      reason: '清單型內容，4-5 個點 × 每點 50-60 字最有效，資料顯示超過 400 字成功率下降'
    },
    successRate: 4.0,
    avgLikes: 3200,
    recommendedOpeners: ['數字開頭', '冒號斷言', '禁忌/警告詞'],
    structureTemplate: [
      '第一行：數字開頭（N 個...）',
      '第二段：簡短說明為什麼整理這個（1 句）',
      '第三段起：清單項目（每項一行或一小段，最多 5 項）',
      '結尾：收藏提醒或補充邀請'
    ],
    ctaSuggestions: ['先收藏！', '還有什麼要補充的？', '哪個最實用？', '存起來'],
    keyFeatures: ['條理分明', '易於收藏', '實用價值高', '精簡'],
    avoidPatterns: ['項目太多', '每項太長', '沒有分類', '超過 5 項']
  },
  
  contrast: {
    id: 'contrast',
    name: '反差型',
    description: '打破常見認知、製造反差的貼文',
    wordLimit: {
      min: 200,
      max: 300,
      optimal: 250,
      reason: '需要「常見認知 → 轉折 → 真相解釋」的空間，但要精簡有力'
    },
    successRate: 5.5,
    avgLikes: 4100,
    recommendedOpeners: ['冒號斷言', '情緒爆發', '禁忌/警告詞', '反直覺陳述', '自白坦承'],
    structureTemplate: [
      '第一行：點出常見認知是錯的（用冒號斷言或情緒爆發）',
      '第二段：描述大家以為的樣子（1-2 句）',
      '第三段：轉折（但其實...）',
      '第四段：解釋真相（精簡）',
      '結尾：邀請討論'
    ],
    ctaSuggestions: ['你以前也這樣想嗎？', '被打臉了嗎？', '你怎麼看？', '懂的人舉手'],
    keyFeatures: ['反差明顯', '有說服力', '顛覆認知', '情緒真實'],
    avoidPatterns: ['反差太弱', '沒有解釋', '為反而反', '太長']
  },
  
  casual: {
    id: 'casual',
    name: '閒聊型',
    description: '輕鬆隨意的日常分享',
    wordLimit: {
      min: 100,
      max: 180,
      optimal: 150,
      reason: '輕鬆隨意，像傳訊息，資料顯示 150 字以內成功率最高'
    },
    successRate: 5.8,
    avgLikes: 4500,
    recommendedOpeners: ['情緒爆發', '時間點', '家庭故事', '對話引用', '朋友故事'],
    structureTemplate: [
      '第一行：情緒爆發或時間點開頭（如「我真的受夠了...」）',
      '第二段：簡短描述發生什麼（1-2 句）',
      '第三段：你的感受或想法（1 句）',
      '結尾：輕鬆的互動邀請'
    ],
    ctaSuggestions: ['你呢？', '有人跟我一樣嗎？', '懂的舉手', '誰懂'],
    keyFeatures: ['輕鬆自然', '有人味', '易共鳴', '短'],
    avoidPatterns: ['太正式', '太長', '說教', '過度正向']
  },
  
  dialogue: {
    id: 'dialogue',
    name: '對話型',
    description: '引用對話或問答形式的貼文',
    wordLimit: {
      min: 120,
      max: 200,
      optimal: 160,
      reason: '對話 + 簡短回應，太長會失去對話感'
    },
    successRate: 5.2,
    avgLikes: 4000,
    recommendedOpeners: ['對話引用', '時間點', '家庭故事', '朋友故事'],
    structureTemplate: [
      '第一行：對話引用開頭（如「『你為什麼要這樣？』」）',
      '第二段：對話內容（用引號，2-3 句）',
      '第三段：你的回應或想法（1-2 句）',
      '結尾：邀請讀者分享'
    ],
    ctaSuggestions: ['你會怎麼回？', '你遇過這種問題嗎？', '你的答案是？', '換你說'],
    keyFeatures: ['對話真實', '有互動感', '引發思考', '短'],
    avoidPatterns: ['對話太長', '回應太說教', '沒有重點', '太正式']
  },
  
  question: {
    id: 'question',
    name: '提問型',
    description: '向讀者提問、徵求意見的貼文',
    wordLimit: {
      min: 100,
      max: 180,
      optimal: 140,
      reason: '問題 + 背景說明，太長讀者就不想回答了'
    },
    successRate: 4.5,
    avgLikes: 3500,
    recommendedOpeners: ['對話式「你」', '情緒爆發', '身分標籤'],
    structureTemplate: [
      '第一行：對話式開頭或直接提問',
      '第二段：為什麼想問這個（背景，1 句）',
      '第三段：你的初步想法（可選，1 句）',
      '結尾：明確的問題'
    ],
    ctaSuggestions: ['你怎麼看？', '你會怎麼選？', '留言告訴我', '認真問'],
    keyFeatures: ['問題明確', '有背景', '易回答', '短'],
    avoidPatterns: ['問題太模糊', '背景太長', '問太多問題', '太正式']
  },
  
  poll: {
    id: 'poll',
    name: '投票型',
    description: '讓讀者選擇的投票類貼文',
    wordLimit: {
      min: 80,
      max: 150,
      optimal: 120,
      reason: '選項 + 簡短說明，重點是讓人快速選擇'
    },
    successRate: 5.0,
    avgLikes: 3800,
    recommendedOpeners: ['對話式「你」', '數字開頭', '情緒爆發'],
    structureTemplate: [
      '第一行：對話式開頭或直接問題',
      '第二段：選項列表（A/B 或 1/2/3，最多 3 個）',
      '第三段：簡短說明或你的選擇（可選）',
      '結尾：邀請投票'
    ],
    ctaSuggestions: ['你選哪個？', '留言 A 或 B', '投票！', '選一個'],
    keyFeatures: ['選項清晰', '易於選擇', '有趣味性', '超短'],
    avoidPatterns: ['選項太多', '選項太相似', '沒有說明', '太長']
  },
  
  quote: {
    id: 'quote',
    name: '引用型',
    description: '引用名言或他人觀點並加以延伸',
    wordLimit: {
      min: 180,
      max: 300,
      optimal: 240,
      reason: '引用 + 個人解讀，需要空間展開觀點，但要精簡'
    },
    successRate: 3.8,
    avgLikes: 3000,
    recommendedOpeners: ['對話引用', '冒號斷言', '情緒爆發'],
    structureTemplate: [
      '第一行：對話引用或冒號斷言',
      '第二段：引用來源（可選，1 句）',
      '第三段：你的解讀（2-3 句）',
      '第四段：延伸觀點或應用（1-2 句）',
      '結尾：邀請討論'
    ],
    ctaSuggestions: ['你怎麼理解這句話？', '你同意嗎？', '分享你的解讀', '這句話打中你了嗎'],
    keyFeatures: ['引用有力', '解讀獨特', '有延伸', '精簡'],
    avoidPatterns: ['只有引用沒有解讀', '解讀太淺', '引用太長', '太正式']
  },
  
  diagnosis: {
    id: 'diagnosis',
    name: '診斷型',
    description: '列舉特徵讓讀者自我診斷的貼文',
    wordLimit: {
      min: 200,
      max: 350,
      optimal: 280,
      reason: '特徵列舉 + 標籤揭曉 + 解析，需要完整結構，但每項要精簡'
    },
    successRate: 5.5,
    avgLikes: 4200,
    recommendedOpeners: ['對話式「你」', '數字開頭', '身分標籤', '情緒爆發'],
    structureTemplate: [
      '第一行：對話式開頭（你是不是...）或身分標籤（致...）',
      '第二段：特徵列舉（3-4 個，每個 1 句）',
      '第三段：診斷結果/標籤',
      '第四段：解析或建議（1-2 句）',
      '結尾：邀請對號入座'
    ],
    ctaSuggestions: ['中了幾個？', '你是哪一種？', '對號入座', '全中的舉手'],
    keyFeatures: ['特徵明確', '有共鳴', '有解析', '精簡'],
    avoidPatterns: ['特徵太模糊', '沒有診斷結果', '太負面', '太長']
  },
  
  // 新增：幽默型（基於爆款資料庫分析，平均讚數最高）
  humor: {
    id: 'humor',
    name: '幽默型',
    description: '用幽默、吐槽、自嘲的方式表達觀點或分享經歷',
    wordLimit: {
      min: 100,
      max: 200,
      optimal: 150,
      reason: '幽默要精準，太長會失去笑點。資料顯示幽默型平均讚數 47,907，遠超其他類型'
    },
    successRate: 8.5,
    avgLikes: 47907,
    recommendedOpeners: ['情緒爆發', '自白坦承', '對話引用', '家庭故事', '朋友故事'],
    structureTemplate: [
      '第一行：情緒爆發或自白坦承（如「我真的受夠了...」「我承認我...」）',
      '第二段：鋪陳（1-2 句，製造期待）',
      '第三段：笑點/吐槽/反轉（關鍵一句）',
      '結尾：輕鬆收尾或邀請共鳴'
    ],
    ctaSuggestions: ['誰懂', '有人跟我一樣嗎', '笑死', '懂的舉手', '不要笑'],
    keyFeatures: ['有笑點', '自嘲', '吐槽', '反轉', '真實'],
    avoidPatterns: ['太刻意', '笑點太弱', '太長', '說教', '過度正向']
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
 * 根據成功率排序取得貼文類型
 */
export function getContentTypesBySuccessRate(): ContentTypeRule[] {
  return Object.values(CONTENT_TYPE_RULES)
    .sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
}

/**
 * 根據平均讚數排序取得貼文類型
 */
export function getContentTypesByAvgLikes(): ContentTypeRule[] {
  return Object.values(CONTENT_TYPE_RULES)
    .sort((a, b) => (b.avgLikes || 0) - (a.avgLikes || 0));
}

/**
 * 建構貼文類型專屬規則提示詞（優化版）
 */
export function buildContentTypePrompt(contentType: string): string {
  const rule = getContentTypeRule(contentType);
  
  if (!rule) {
    return `
=== 第二層：貼文類型規則 ===
【類型】未知類型
【字數範圍】150-250 字（根據資料分析，這是最佳區間）
`;
  }
  
  return `
=== 第二層：${rule.name}專屬規則 ===

【類型說明】${rule.description}
${rule.successRate ? `【成功率】${rule.successRate}%（基於 17,850 篇爆款貼文分析）` : ''}
${rule.avgLikes ? `【平均讚數】${rule.avgLikes.toLocaleString()}` : ''}

【字數範圍】${rule.wordLimit.min}-${rule.wordLimit.max} 字
【最佳字數】${rule.wordLimit.optimal} 字
【字數原因】${rule.wordLimit.reason}

【推薦開頭模式】${rule.recommendedOpeners.join('、')}

【結構模板】
${rule.structureTemplate.map((s, i) => `${i + 1}. ${s}`).join('\n')}

【CTA 建議】${rule.ctaSuggestions.join(' / ')}

【關鍵特徵】${rule.keyFeatures.join('、')}

【⚠️ 避免模式】${rule.avoidPatterns.join('、')}

【重要提醒】
• 字數超過 ${rule.wordLimit.max} 字會降低成功率
• 優先使用「我」開頭，而非「你」開頭
• 避免說教口吻和過度正向
`;
}

/**
 * 驗證內容是否符合類型規則（優化版）
 */
export function validateContentTypeRules(
  content: string,
  contentType: string
): {
  isValid: boolean;
  wordCountValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const rule = getContentTypeRule(contentType);
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  if (!rule) {
    return {
      isValid: true,
      wordCountValid: true,
      score: 100,
      issues: [],
      suggestions: []
    };
  }
  
  // 檢查字數
  const wordCount = content.length;
  let wordCountValid = true;
  
  if (wordCount < rule.wordLimit.min) {
    wordCountValid = false;
    issues.push(`字數不足：目前 ${wordCount} 字，建議至少 ${rule.wordLimit.min} 字`);
    suggestions.push('可以增加更多細節或例子');
    score -= 15;
  }
  
  if (wordCount > rule.wordLimit.max) {
    wordCountValid = false;
    issues.push(`字數過多：目前 ${wordCount} 字，建議不超過 ${rule.wordLimit.max} 字`);
    suggestions.push('可以精簡內容，保留核心觀點');
    score -= 20;
  }
  
  // 超過 500 字嚴重扣分
  if (wordCount > 500) {
    issues.push(`字數嚴重過多：目前 ${wordCount} 字，資料顯示超過 500 字成功率為 0`);
    suggestions.push('強烈建議精簡到 300 字以內');
    score -= 30;
  }
  
  // 檢查是否有 CTA
  const hasCTA = rule.ctaSuggestions.some(cta => content.includes(cta)) ||
                 /你(怎麼看|同意嗎|覺得呢|有過|會怎麼)|留言|分享|舉手|誰懂/.test(content);
  
  if (!hasCTA) {
    issues.push('缺少互動引導（CTA）');
    suggestions.push(`建議結尾加入：${rule.ctaSuggestions[0]}`);
    score -= 10;
  }
  
  // 檢查是否有避免模式
  for (const avoid of rule.avoidPatterns) {
    if (avoid === '太長' && wordCount > rule.wordLimit.max) {
      // 已經在字數檢查中處理
      continue;
    }
    if (avoid === '說教' || avoid === '說教口吻' || avoid === '說教結尾') {
      if (/你(應該|必須|一定要|需要)|請(記住|注意)/.test(content)) {
        issues.push('內容有說教口吻');
        suggestions.push('建議改用分享語氣，而非說教語氣');
        score -= 10;
      }
    }
    if (avoid === '過度正向') {
      if (/太棒了|好幸福|好開心|感謝|謝謝大家/.test(content)) {
        issues.push('內容過度正向');
        suggestions.push('建議加入真實情緒，不要過度正向');
        score -= 5;
      }
    }
  }
  
  // 檢查人稱使用
  const firstLine = content.split('\n')[0] || '';
  if (firstLine.startsWith('你應該') || firstLine.startsWith('你必須') || firstLine.startsWith('你一定要')) {
    issues.push('開頭使用說教語氣的「你」');
    suggestions.push('建議改用「我」開頭，成功率更高');
    score -= 10;
  }
  
  return {
    isValid: issues.length === 0,
    wordCountValid,
    score: Math.max(0, score),
    issues,
    suggestions
  };
}

/**
 * 根據素材推薦最適合的貼文類型
 */
export function recommendContentType(material: string): {
  recommended: string;
  alternatives: string[];
  reason: string;
} {
  // 檢測素材特徵
  const hasStory = /我(以前|曾經|那時|記得)|有一次|那天|昨天|上週/.test(material);
  const hasOpinion = /我(覺得|認為|發現)|其實|真相是|事實上/.test(material);
  const hasHumor = /笑死|傻眼|崩潰|受夠|無言|暈|誇張|扯/.test(material);
  const hasQuestion = /為什麼|怎麼|如何|是不是/.test(material);
  const hasList = /第一|第二|首先|其次|\d\.|[一二三四五]、/.test(material);
  const hasContrast = /但是|然而|其實|不是.*而是|以為.*沒想到/.test(material);
  const hasDialogue = /[「『"'].*[」』"']|說：|問我|跟我說/.test(material);
  
  // 根據特徵推薦
  if (hasHumor) {
    return {
      recommended: 'humor',
      alternatives: ['casual', 'story'],
      reason: '素材包含幽默/吐槽元素，幽默型平均讚數最高（47,907）'
    };
  }
  
  if (hasDialogue) {
    return {
      recommended: 'dialogue',
      alternatives: ['story', 'casual'],
      reason: '素材包含對話內容，適合對話型'
    };
  }
  
  if (hasStory) {
    return {
      recommended: 'story',
      alternatives: ['casual', 'contrast'],
      reason: '素材包含故事/經歷元素，故事型成功率較高'
    };
  }
  
  if (hasContrast) {
    return {
      recommended: 'contrast',
      alternatives: ['viewpoint', 'story'],
      reason: '素材包含反差/轉折元素，適合反差型'
    };
  }
  
  if (hasList) {
    return {
      recommended: 'summary',
      alternatives: ['knowledge', 'diagnosis'],
      reason: '素材包含列表/分點元素，適合整理型'
    };
  }
  
  if (hasQuestion) {
    return {
      recommended: 'question',
      alternatives: ['poll', 'viewpoint'],
      reason: '素材包含問題元素，適合提問型'
    };
  }
  
  if (hasOpinion) {
    return {
      recommended: 'viewpoint',
      alternatives: ['contrast', 'casual'],
      reason: '素材包含觀點/看法元素，適合觀點型'
    };
  }
  
  // 預設推薦
  return {
    recommended: 'casual',
    alternatives: ['viewpoint', 'story'],
    reason: '素材特徵不明顯，建議使用閒聊型（成功率較高）'
  };
}
