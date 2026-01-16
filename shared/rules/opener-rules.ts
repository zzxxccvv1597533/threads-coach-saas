/**
 * 開頭規則模組
 * 將規則抽離為純資料，支援動態選擇和維護
 */

export interface AvoidPattern {
  pattern: string;
  type: 'opener' | 'phrase' | 'structure';
  severity: 'block' | 'warn';
  reason: string;
  replacement?: string;
}

export interface OpenerTemplate {
  id: string;
  name: string;
  style: 'mirror' | 'scene' | 'dialogue' | 'contrast' | 'casual' | 'emotion' | 'story' | 'label' | 'suspense' | 'conflict';
  pattern: string;
  example: string;
  effectMultiplier: number; // 效果倍數
  suitableFor: string[]; // 適合的內容類型
  weight: number; // 權重（用於隨機選擇）
}

/**
 * 禁止句式清單
 * severity: 'block' = 絕對禁止，'warn' = 警告但允許
 */
export const AVOID_PATTERNS: AvoidPattern[] = [
  // 開頭禁止句式
  { pattern: '你是不是也', type: 'opener', severity: 'block', reason: 'AI 感過重', replacement: '我發現' },
  { pattern: '你有沒有發現', type: 'opener', severity: 'block', reason: 'AI 感過重', replacement: '最近' },
  { pattern: '你有沒有想過', type: 'opener', severity: 'block', reason: 'AI 感過重', replacement: '說真的' },
  { pattern: '在這個時代', type: 'opener', severity: 'block', reason: '陳腔濫調', replacement: '現在' },
  { pattern: '在這個快節奏', type: 'opener', severity: 'block', reason: '陳腔濫調', replacement: '現在' },
  { pattern: '在這個資訊爆炸', type: 'opener', severity: 'block', reason: '陳腔濫調', replacement: '現在' },
  { pattern: '其實我也', type: 'opener', severity: 'warn', reason: '感傷語調', replacement: '我' },
  { pattern: '可是我', type: 'opener', severity: 'warn', reason: '感傷語調', replacement: '但' },
  { pattern: '卻總是', type: 'opener', severity: 'warn', reason: '感傷語調', replacement: '但' },
  { pattern: '卻還是', type: 'opener', severity: 'warn', reason: '感傷語調', replacement: '但' },
  { pattern: '真的！', type: 'opener', severity: 'warn', reason: '刻意口語', replacement: '' },
  { pattern: '真的，', type: 'opener', severity: 'warn', reason: '刻意口語', replacement: '' },
  
  // 結構禁止句式
  { pattern: '首先', type: 'structure', severity: 'block', reason: 'AI 結構詞', replacement: '' },
  { pattern: '其次', type: 'structure', severity: 'block', reason: 'AI 結構詞', replacement: '' },
  { pattern: '最後', type: 'structure', severity: 'warn', reason: 'AI 結構詞', replacement: '' },
  { pattern: '總結來說', type: 'structure', severity: 'block', reason: 'AI 結構詞', replacement: '' },
  { pattern: '綜上所述', type: 'structure', severity: 'block', reason: 'AI 結構詞', replacement: '' },
  { pattern: '讓我們', type: 'structure', severity: 'block', reason: 'AI 常用詞', replacement: '' },
  { pattern: '一起來', type: 'structure', severity: 'warn', reason: 'AI 常用詞', replacement: '' },
  
  // 短語禁止
  { pattern: '不得不說', type: 'phrase', severity: 'warn', reason: 'AI 常用詞', replacement: '說真的' },
  { pattern: '值得一提', type: 'phrase', severity: 'warn', reason: 'AI 常用詞', replacement: '' },
  { pattern: '毋庸置疑', type: 'phrase', severity: 'block', reason: 'AI 常用詞', replacement: '' },
  { pattern: '不可否認', type: 'phrase', severity: 'warn', reason: 'AI 常用詞', replacement: '' },
  { pattern: '眾所周知', type: 'phrase', severity: 'block', reason: 'AI 常用詞', replacement: '' },
  { pattern: '事實上', type: 'phrase', severity: 'warn', reason: 'AI 常用詞', replacement: '其實' },
];

/**
 * 開頭模板庫
 */
export const OPENER_TEMPLATES: OpenerTemplate[] = [
  // 鏡像心理型
  {
    id: 'mirror_1',
    name: '鏡像心理 - 共鳴開頭',
    style: 'mirror',
    pattern: '我發現很多人都有這個問題：{問題描述}',
    example: '我發現很多人都有這個問題：明明很努力，卻總是看不到成果',
    effectMultiplier: 1.8,
    suitableFor: ['story', 'viewpoint', 'knowledge'],
    weight: 1.5,
  },
  {
    id: 'mirror_2',
    name: '鏡像心理 - 直擊痛點',
    style: 'mirror',
    pattern: '{痛點描述}，是不是很熟悉？',
    example: '每天加班到很晚，回家只想躺平，是不是很熟悉？',
    effectMultiplier: 1.6,
    suitableFor: ['story', 'casual'],
    weight: 1.2,
  },
  
  // 情境化帶入型
  {
    id: 'scene_1',
    name: '情境化 - 時間場景',
    style: 'scene',
    pattern: '昨天{時間}，我{動作}',
    example: '昨天深夜，我收到一則訊息',
    effectMultiplier: 1.7,
    suitableFor: ['story', 'dialogue', 'casual'],
    weight: 1.4,
  },
  {
    id: 'scene_2',
    name: '情境化 - 地點場景',
    style: 'scene',
    pattern: '在{地點}，我看到{觀察}',
    example: '在咖啡廳，我看到隔壁桌的人一直嘆氣',
    effectMultiplier: 1.5,
    suitableFor: ['story', 'observation'],
    weight: 1.2,
  },
  
  // 對話型
  {
    id: 'dialogue_1',
    name: '對話型 - 引用對話',
    style: 'dialogue',
    pattern: '「{對話內容}」',
    example: '「你怎麼又加班？」',
    effectMultiplier: 1.9,
    suitableFor: ['story', 'dialogue', 'casual'],
    weight: 1.6,
  },
  {
    id: 'dialogue_2',
    name: '對話型 - 內心對話',
    style: 'dialogue',
    pattern: '我心裡想：{內心話}',
    example: '我心裡想：這次一定要成功',
    effectMultiplier: 1.4,
    suitableFor: ['story', 'casual'],
    weight: 1.0,
  },
  
  // 反差型
  {
    id: 'contrast_1',
    name: '反差型 - 對比開頭',
    style: 'contrast',
    pattern: '以前我以為{舊觀念}，後來發現{新觀念}',
    example: '以前我以為努力就會成功，後來發現方向比努力更重要',
    effectMultiplier: 2.0,
    suitableFor: ['viewpoint', 'knowledge', 'story'],
    weight: 1.8,
  },
  {
    id: 'contrast_2',
    name: '反差型 - 打臉開頭',
    style: 'contrast',
    pattern: '很多人說{常見觀點}，但{反駁}',
    example: '很多人說要堅持到底，但有時候放棄才是對的',
    effectMultiplier: 1.8,
    suitableFor: ['viewpoint', 'knowledge'],
    weight: 1.5,
  },
  
  // 閒聊型
  {
    id: 'casual_1',
    name: '閒聊型 - 情緒開頭',
    style: 'casual',
    pattern: '天啊，{情緒事件}',
    example: '天啊，今天的會議也太長了',
    effectMultiplier: 1.3,
    suitableFor: ['casual', 'observation'],
    weight: 1.0,
  },
  {
    id: 'casual_2',
    name: '閒聊型 - 碎碎念',
    style: 'casual',
    pattern: '突然想到{想法}',
    example: '突然想到上週那件事',
    effectMultiplier: 1.2,
    suitableFor: ['casual'],
    weight: 0.8,
  },
  
  // 情緒爆發型
  {
    id: 'emotion_1',
    name: '情緒爆發 - 強烈感受',
    style: 'emotion',
    pattern: '我真的受夠了{事情}',
    example: '我真的受夠了無效社交',
    effectMultiplier: 1.9,
    suitableFor: ['viewpoint', 'casual'],
    weight: 1.4,
  },
  
  // 懸念引導型
  {
    id: 'suspense_1',
    name: '懸念型 - 留白開頭',
    style: 'suspense',
    pattern: '那天之後，我再也沒有{動作}',
    example: '那天之後，我再也沒有熬夜過',
    effectMultiplier: 2.1,
    suitableFor: ['story'],
    weight: 1.6,
  },
  
  // 認知衝突型
  {
    id: 'conflict_1',
    name: '認知衝突 - 顛覆開頭',
    style: 'conflict',
    pattern: '{常識}？錯了。',
    example: '努力就會成功？錯了。',
    effectMultiplier: 2.2,
    suitableFor: ['viewpoint', 'knowledge'],
    weight: 1.7,
  },
];

/**
 * 根據內容類型取得適合的開頭模板
 */
export function getTemplatesForContentType(contentType: string): OpenerTemplate[] {
  return OPENER_TEMPLATES.filter(t => 
    t.suitableFor.includes(contentType) || t.suitableFor.includes('*')
  );
}

/**
 * 根據風格取得開頭模板
 */
export function getTemplatesByStyle(style: string): OpenerTemplate[] {
  return OPENER_TEMPLATES.filter(t => t.style === style);
}

/**
 * 加權隨機選擇模板
 */
export function selectWeightedTemplate(templates: OpenerTemplate[]): OpenerTemplate | null {
  if (templates.length === 0) return null;
  
  const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const template of templates) {
    random -= template.weight;
    if (random <= 0) {
      return template;
    }
  }
  
  return templates[templates.length - 1];
}

/**
 * 檢查內容是否包含禁止句式
 */
export function checkAvoidPatterns(content: string): {
  hasBlocked: boolean;
  hasWarnings: boolean;
  matches: Array<{ pattern: AvoidPattern; position: number }>;
} {
  const matches: Array<{ pattern: AvoidPattern; position: number }> = [];
  
  for (const pattern of AVOID_PATTERNS) {
    const position = content.indexOf(pattern.pattern);
    if (position !== -1) {
      matches.push({ pattern, position });
    }
  }
  
  return {
    hasBlocked: matches.some(m => m.pattern.severity === 'block'),
    hasWarnings: matches.some(m => m.pattern.severity === 'warn'),
    matches,
  };
}

/**
 * 替換禁止句式
 */
export function replaceAvoidPatterns(content: string): string {
  let result = content;
  
  for (const pattern of AVOID_PATTERNS) {
    if (pattern.replacement !== undefined) {
      result = result.replace(new RegExp(pattern.pattern, 'g'), pattern.replacement);
    }
  }
  
  return result;
}
