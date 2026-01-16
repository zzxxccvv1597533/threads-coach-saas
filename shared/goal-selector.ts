/**
 * 目的導向選擇器模組
 * 
 * 根據知識庫「目的導向內容策略」設計
 * 讓用戶先選擇「想達成什麼目標」，再推薦適合的內容類型、結尾策略、開頭模式
 * 
 * 四大目標：
 * 1. 讓人更懂我（建立情感連結）
 * 2. 讓人信任我（建立專業權威）
 * 3. 有人留言互動（提升互動率）
 * 4. 慢慢賣產品（軟性銷售）
 */

export interface GoalOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  // 推薦的內容類型（按優先順序）
  recommendedTypes: string[];
  // 推薦的結尾策略
  endingStrategy: {
    type: 'interactive' | 'reflective' | 'open' | 'guiding';
    name: string;
    description: string;
    examples: string[];
  };
  // 推薦的開頭模式（按優先順序）
  recommendedOpeners: string[];
  // 爆款範例篩選關鍵字
  viralExampleKeywords: string[];
  // 提示詞調整
  promptAdjustment: {
    tone: string;
    focus: string;
    avoid: string[];
  };
}

/**
 * 四大目標定義
 */
export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'connect',
    name: '讓人更懂我',
    description: '建立情感連結，讓讀者感受到你是真實的人',
    icon: '💝',
    recommendedTypes: ['story', 'casual', 'dialogue', 'humor'],
    endingStrategy: {
      type: 'reflective',
      name: '內省型收尾',
      description: '引導讀者內省，產生情感共鳴',
      examples: [
        '你有過類似的經歷嗎？',
        '這讓我想了很久...',
        '不知道你懂不懂這種感覺',
        '有時候，我們都需要這樣的時刻'
      ]
    },
    recommendedOpeners: ['家庭故事', '自白坦承', '時間點', '對話引用', '情緒爆發'],
    viralExampleKeywords: ['故事', '經歷', '感受', '心情', '生活'],
    promptAdjustment: {
      tone: '真實、溫暖、有人味，像在跟朋友聊天',
      focus: '分享真實經歷和感受，展現脆弱和不完美的一面',
      avoid: ['說教', '過度正向', '太完美', '太專業']
    }
  },
  {
    id: 'trust',
    name: '讓人信任我',
    description: '建立專業權威，讓讀者相信你的專業能力',
    icon: '🎯',
    recommendedTypes: ['knowledge', 'curation', 'summary', 'series', 'contrast'],
    endingStrategy: {
      type: 'guiding',
      name: '引導型收尾',
      description: '引導讀者採取行動或收藏',
      examples: [
        '收藏起來，下次用得到',
        '哪一點對你最有幫助？',
        '想知道更多可以追蹤我',
        '有問題留言，我會回覆'
      ]
    },
    recommendedOpeners: ['數字開頭', '冒號斷言', '禁忌/警告詞', '結果導向'],
    viralExampleKeywords: ['方法', '技巧', '秘訣', '整理', '教學', '分享'],
    promptAdjustment: {
      tone: '專業但不說教，有料但好懂',
      focus: '提供實用價值，用簡單的話解釋複雜的事',
      avoid: ['太學術', '太長', '沒有例子', '只有理論']
    }
  },
  {
    id: 'engage',
    name: '有人留言互動',
    description: '提升互動率，讓讀者想要留言回應',
    icon: '💬',
    recommendedTypes: ['question', 'poll', 'dialogue', 'diagnosis', 'contrast'],
    endingStrategy: {
      type: 'interactive',
      name: '互動型收尾',
      description: '直接邀請讀者參與討論',
      examples: [
        '你怎麼看？留言告訴我',
        '選 A 還是 B？',
        '你是哪一種？對號入座',
        '有人跟我一樣嗎？舉手'
      ]
    },
    recommendedOpeners: ['對話式「你」', '情緒爆發', '身分標籤', '反直覺陳述'],
    viralExampleKeywords: ['問題', '選擇', '投票', '你覺得', '怎麼看'],
    promptAdjustment: {
      tone: '好奇、開放、邀請參與',
      focus: '提出容易回答的問題，讓讀者有話想說',
      avoid: ['問題太難', '問題太模糊', '沒有明確的互動邀請']
    }
  },
  {
    id: 'sell',
    name: '慢慢賣產品',
    description: '軟性銷售，讓讀者對你的產品/服務產生興趣',
    icon: '🛒',
    recommendedTypes: ['story', 'series', 'contrast', 'diagnosis', 'knowledge'],
    endingStrategy: {
      type: 'open',
      name: '開放型收尾',
      description: '不直接推銷，留下好奇心',
      examples: [
        '想知道更多可以私訊我',
        '這是我這幾年摸索出來的方法',
        '如果你也有這個困擾...',
        '有興趣的話，我可以分享更多'
      ]
    },
    recommendedOpeners: ['時間點', '結果導向', '自白坦承', '家庭故事', '朋友故事'],
    viralExampleKeywords: ['改變', '結果', '方法', '發現', '學到'],
    promptAdjustment: {
      tone: '分享者而非銷售者，真誠而非推銷',
      focus: '分享使用經驗和改變，而非產品功能',
      avoid: ['直接推銷', '太像廣告', '強調價格', '急迫感']
    }
  }
];

/**
 * 根據目標 ID 取得目標選項
 */
export function getGoalOption(goalId: string): GoalOption | null {
  return GOAL_OPTIONS.find(g => g.id === goalId) || null;
}

/**
 * 取得所有目標選項
 */
export function getAllGoalOptions(): GoalOption[] {
  return GOAL_OPTIONS;
}

/**
 * 根據目標建構提示詞調整
 */
export function buildGoalPromptAdjustment(goalId: string): string {
  const goal = getGoalOption(goalId);
  
  if (!goal) {
    return '';
  }
  
  return `
=== 目的導向調整 ===

【你的目標】${goal.name}
【目標說明】${goal.description}

【語氣調整】${goal.promptAdjustment.tone}

【內容重點】${goal.promptAdjustment.focus}

【避免事項】
${goal.promptAdjustment.avoid.map(a => `• ${a}`).join('\n')}

【結尾策略】${goal.endingStrategy.name}
${goal.endingStrategy.description}
建議結尾：${goal.endingStrategy.examples.slice(0, 2).join(' / ')}

【推薦開頭模式】${goal.recommendedOpeners.slice(0, 3).join('、')}
`;
}

/**
 * 根據目標推薦內容類型
 */
export function getRecommendedTypesForGoal(goalId: string): {
  primary: string[];
  secondary: string[];
} {
  const goal = getGoalOption(goalId);
  
  if (!goal) {
    return {
      primary: ['casual', 'story'],
      secondary: ['viewpoint', 'dialogue']
    };
  }
  
  return {
    primary: goal.recommendedTypes.slice(0, 3),
    secondary: goal.recommendedTypes.slice(3)
  };
}

/**
 * 根據目標取得爆款範例篩選關鍵字
 */
export function getViralKeywordsForGoal(goalId: string): string[] {
  const goal = getGoalOption(goalId);
  return goal?.viralExampleKeywords || [];
}

/**
 * 根據目標取得結尾策略
 */
export function getEndingStrategyForGoal(goalId: string): GoalOption['endingStrategy'] | null {
  const goal = getGoalOption(goalId);
  return goal?.endingStrategy || null;
}

/**
 * 根據內容類型反推適合的目標
 */
export function suggestGoalsForContentType(contentType: string): {
  primary: string;
  alternatives: string[];
} {
  // 根據內容類型找出最適合的目標
  const typeToGoalMap: Record<string, { primary: string; alternatives: string[] }> = {
    story: { primary: 'connect', alternatives: ['sell'] },
    casual: { primary: 'connect', alternatives: ['engage'] },
    dialogue: { primary: 'connect', alternatives: ['engage'] },
    humor: { primary: 'connect', alternatives: ['engage'] },
    knowledge: { primary: 'trust', alternatives: ['sell'] },
    curation: { primary: 'trust', alternatives: ['sell'] },
    summary: { primary: 'trust', alternatives: ['sell'] },
    series: { primary: 'trust', alternatives: ['sell', 'connect'] },
    question: { primary: 'engage', alternatives: ['connect'] },
    poll: { primary: 'engage', alternatives: ['connect'] },
    diagnosis: { primary: 'engage', alternatives: ['sell'] },
    contrast: { primary: 'trust', alternatives: ['engage'] },
    viewpoint: { primary: 'connect', alternatives: ['trust', 'engage'] },
    quote: { primary: 'trust', alternatives: ['connect'] }
  };
  
  return typeToGoalMap[contentType] || { primary: 'connect', alternatives: ['engage'] };
}

/**
 * 結尾策略類型定義
 */
export const ENDING_STRATEGIES = {
  interactive: {
    id: 'interactive',
    name: '互動型收尾',
    description: '直接邀請讀者參與討論、投票或分享',
    examples: [
      '你怎麼看？',
      '你會怎麼選？',
      '留言告訴我',
      '有人跟我一樣嗎？',
      '選 A 還是 B？',
      '你是哪一種？'
    ],
    bestFor: ['question', 'poll', 'dialogue', 'diagnosis']
  },
  reflective: {
    id: 'reflective',
    name: '內省型收尾',
    description: '引導讀者內省，產生情感共鳴',
    examples: [
      '你有過類似的經歷嗎？',
      '這讓我想了很久...',
      '不知道你懂不懂這種感覺',
      '有時候，我們都需要這樣的時刻',
      '懂的人自然懂'
    ],
    bestFor: ['story', 'casual', 'viewpoint', 'humor']
  },
  open: {
    id: 'open',
    name: '開放型收尾',
    description: '不直接推銷，留下好奇心和想像空間',
    examples: [
      '想知道更多可以私訊我',
      '這是我這幾年摸索出來的方法',
      '如果你也有這個困擾...',
      '有興趣的話，我可以分享更多'
    ],
    bestFor: ['story', 'series', 'contrast']
  },
  guiding: {
    id: 'guiding',
    name: '引導型收尾',
    description: '引導讀者採取行動或收藏',
    examples: [
      '收藏起來，下次用得到',
      '哪一點對你最有幫助？',
      '想知道更多可以追蹤我',
      '有問題留言，我會回覆',
      '先存再說'
    ],
    bestFor: ['knowledge', 'curation', 'summary', 'series']
  }
};

/**
 * 根據內容類型推薦結尾策略
 */
export function recommendEndingStrategy(contentType: string): {
  primary: keyof typeof ENDING_STRATEGIES;
  alternatives: (keyof typeof ENDING_STRATEGIES)[];
} {
  const typeToEndingMap: Record<string, { primary: keyof typeof ENDING_STRATEGIES; alternatives: (keyof typeof ENDING_STRATEGIES)[] }> = {
    story: { primary: 'reflective', alternatives: ['open', 'interactive'] },
    casual: { primary: 'reflective', alternatives: ['interactive'] },
    dialogue: { primary: 'interactive', alternatives: ['reflective'] },
    humor: { primary: 'reflective', alternatives: ['interactive'] },
    knowledge: { primary: 'guiding', alternatives: ['interactive'] },
    curation: { primary: 'guiding', alternatives: ['interactive'] },
    summary: { primary: 'guiding', alternatives: ['interactive'] },
    series: { primary: 'guiding', alternatives: ['open'] },
    question: { primary: 'interactive', alternatives: ['reflective'] },
    poll: { primary: 'interactive', alternatives: [] },
    diagnosis: { primary: 'interactive', alternatives: ['reflective'] },
    contrast: { primary: 'interactive', alternatives: ['reflective', 'open'] },
    viewpoint: { primary: 'interactive', alternatives: ['reflective'] },
    quote: { primary: 'reflective', alternatives: ['interactive'] }
  };
  
  return typeToEndingMap[contentType] || { primary: 'interactive', alternatives: ['reflective'] };
}

/**
 * 建構結尾策略提示詞
 */
export function buildEndingStrategyPrompt(strategyType: keyof typeof ENDING_STRATEGIES): string {
  const strategy = ENDING_STRATEGIES[strategyType];
  
  if (!strategy) {
    return '';
  }
  
  return `
=== 結尾策略 ===

【策略類型】${strategy.name}
【策略說明】${strategy.description}

【建議結尾範例】
${strategy.examples.map(e => `• ${e}`).join('\n')}

【重要提醒】
• 結尾要自然，不要太刻意
• 避免「追蹤我」「按讚」等直接要求
• 避免「希望對你有幫助」「感謝閱讀」等 AI 感結尾
`;
}
