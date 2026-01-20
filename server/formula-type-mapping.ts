/**
 * 開頭公式與貼文類型動態對應表
 * 
 * 設計原則：
 * 1. 每種貼文類型選擇 5 種最適合的開頭公式
 * 2. 根據類型特性選擇（情緒型適合情緒爆發、知識型適合冒號斷言等）
 * 3. 避免提示詞過長，只提供最相關的公式
 */

import { HIGH_EFFECT_OPENER_PATTERNS, type OpenerPattern } from '../shared/opener-rules';

// 貼文類型定義
export type ContentType = 
  | 'story'      // 故事型
  | 'knowledge'  // 知識型
  | 'organize'   // 整理型
  | 'opinion'    // 觀點型
  | 'dialogue'   // 對話型
  | 'quote'      // 引用型
  | 'contrast'   // 反差型
  | 'casual'     // 閒聊型
  | 'question'   // 提問型
  | 'poll';      // 投票型

// 公式名稱定義（對應 opener-rules.ts 中的 13 種）
export type FormulaName = 
  | '冒號斷言'
  | '禁忌/警告詞'
  | '數字開頭'
  | '時間點'
  | '對話式「你」'
  | '結果導向'
  | '反直覺陳述'
  | '情緒爆發'
  | '家庭故事'
  | '自白坦承'
  | '對話引用'
  | '身分標籤'
  | '朋友故事';

// 類型與公式的適配度矩陣
// 分數 1-5：1=不適合, 3=普通, 5=非常適合
const FORMULA_TYPE_MATRIX: Record<ContentType, Record<FormulaName, number>> = {
  // 故事型：適合時間點、家庭故事、自白坦承、情緒爆發、朋友故事
  story: {
    '冒號斷言': 2,
    '禁忌/警告詞': 2,
    '數字開頭': 2,
    '時間點': 5,        // ★ 故事需要時間背景
    '對話式「你」': 3,
    '結果導向': 4,      // ★ 故事可以從結果開始
    '反直覺陳述': 3,
    '情緒爆發': 5,      // ★ 故事需要情緒張力
    '家庭故事': 5,      // ★ 故事型最適合
    '自白坦承': 5,      // ★ 故事型最適合
    '對話引用': 4,      // ★ 故事可以從對話開始
    '身分標籤': 2,
    '朋友故事': 5,      // ★ 故事型最適合
  },
  
  // 知識型：適合冒號斷言、數字開頭、禁忌/警告詞、反直覺陳述
  knowledge: {
    '冒號斷言': 5,      // ★ 知識型最適合
    '禁忌/警告詞': 5,   // ★ 知識型最適合
    '數字開頭': 5,      // ★ 知識型最適合
    '時間點': 3,
    '對話式「你」': 4,
    '結果導向': 3,
    '反直覺陳述': 5,    // ★ 知識型最適合
    '情緒爆發': 2,
    '家庭故事': 2,
    '自白坦承': 3,
    '對話引用': 2,
    '身分標籤': 3,
    '朋友故事': 2,
  },
  
  // 整理型：適合數字開頭、冒號斷言、禁忌/警告詞
  organize: {
    '冒號斷言': 4,
    '禁忌/警告詞': 4,
    '數字開頭': 5,      // ★ 整理型最適合（N個重點）
    '時間點': 2,
    '對話式「你」': 4,
    '結果導向': 3,
    '反直覺陳述': 3,
    '情緒爆發': 2,
    '家庭故事': 1,
    '自白坦承': 2,
    '對話引用': 2,
    '身分標籤': 3,
    '朋友故事': 2,
  },
  
  // 觀點型：適合冒號斷言、反直覺陳述、情緒爆發、自白坦承
  opinion: {
    '冒號斷言': 5,      // ★ 觀點型最適合
    '禁忌/警告詞': 3,
    '數字開頭': 2,
    '時間點': 3,
    '對話式「你」': 4,
    '結果導向': 3,
    '反直覺陳述': 5,    // ★ 觀點型最適合
    '情緒爆發': 5,      // ★ 觀點型最適合
    '家庭故事': 2,
    '自白坦承': 5,      // ★ 觀點型最適合
    '對話引用': 3,
    '身分標籤': 3,
    '朋友故事': 2,
  },
  
  // 對話型：適合對話引用、家庭故事、朋友故事、時間點
  dialogue: {
    '冒號斷言': 2,
    '禁忌/警告詞': 2,
    '數字開頭': 1,
    '時間點': 4,
    '對話式「你」': 4,
    '結果導向': 3,
    '反直覺陳述': 2,
    '情緒爆發': 3,
    '家庭故事': 5,      // ★ 對話型最適合
    '自白坦承': 3,
    '對話引用': 5,      // ★ 對話型最適合
    '身分標籤': 2,
    '朋友故事': 5,      // ★ 對話型最適合
  },
  
  // 引用型：適合對話引用、情緒爆發、反直覺陳述
  quote: {
    '冒號斷言': 3,
    '禁忌/警告詞': 2,
    '數字開頭': 2,
    '時間點': 3,
    '對話式「你」': 3,
    '結果導向': 3,
    '反直覺陳述': 4,
    '情緒爆發': 4,
    '家庭故事': 2,
    '自白坦承': 3,
    '對話引用': 5,      // ★ 引用型最適合
    '身分標籤': 3,
    '朋友故事': 3,
  },
  
  // 反差型：適合反直覺陳述、冒號斷言、情緒爆發
  contrast: {
    '冒號斷言': 4,
    '禁忌/警告詞': 3,
    '數字開頭': 3,
    '時間點': 3,
    '對話式「你」': 4,
    '結果導向': 4,
    '反直覺陳述': 5,    // ★ 反差型最適合
    '情緒爆發': 4,
    '家庭故事': 3,
    '自白坦承': 4,
    '對話引用': 3,
    '身分標籤': 2,
    '朋友故事': 3,
  },
  
  // 閒聊型：適合時間點、情緒爆發、自白坦承
  casual: {
    '冒號斷言': 2,
    '禁忌/警告詞': 1,
    '數字開頭': 1,
    '時間點': 5,        // ★ 閒聊型最適合
    '對話式「你」': 4,
    '結果導向': 3,
    '反直覺陳述': 2,
    '情緒爆發': 5,      // ★ 閒聊型最適合
    '家庭故事': 4,
    '自白坦承': 5,      // ★ 閒聊型最適合
    '對話引用': 3,
    '身分標籤': 2,
    '朋友故事': 4,
  },
  
  // 提問型：適合對話式「你」、身分標籤、冒號斷言
  question: {
    '冒號斷言': 4,
    '禁忌/警告詞': 3,
    '數字開頭': 2,
    '時間點': 3,
    '對話式「你」': 5,  // ★ 提問型最適合
    '結果導向': 2,
    '反直覺陳述': 3,
    '情緒爆發': 3,
    '家庭故事': 2,
    '自白坦承': 3,
    '對話引用': 3,
    '身分標籤': 5,      // ★ 提問型最適合（致...的你）
    '朋友故事': 2,
  },
  
  // 投票型：適合對話式「你」、數字開頭、反直覺陳述
  poll: {
    '冒號斷言': 3,
    '禁忌/警告詞': 2,
    '數字開頭': 4,
    '時間點': 2,
    '對話式「你」': 5,  // ★ 投票型最適合
    '結果導向': 2,
    '反直覺陳述': 4,
    '情緒爆發': 3,
    '家庭故事': 2,
    '自白坦承': 3,
    '對話引用': 3,
    '身分標籤': 4,
    '朋友故事': 2,
  },
};

/**
 * 根據貼文類型取得推薦的開頭公式（前 5 名）
 */
export function getRecommendedFormulasForType(contentType: ContentType): OpenerPattern[] {
  const scores = FORMULA_TYPE_MATRIX[contentType];
  
  if (!scores) {
    // 如果類型不存在，返回預設的 5 種公式
    return HIGH_EFFECT_OPENER_PATTERNS.slice(0, 5);
  }
  
  // 將公式按適配度排序
  const sortedFormulas = HIGH_EFFECT_OPENER_PATTERNS
    .map(formula => ({
      formula,
      score: scores[formula.name as FormulaName] || 3
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.formula);
  
  return sortedFormulas;
}

/**
 * 建構動態開頭公式提示詞
 */
export function buildDynamicOpenerFormulasPrompt(contentType: ContentType): string {
  const formulas = getRecommendedFormulasForType(contentType);
  
  const formulaLines = formulas.map((f, i) => {
    const example = f.examples[Math.floor(Math.random() * f.examples.length)];
    return `${i + 1}. 「${f.name}」：${f.templateFormula || f.pattern}\n   例：「${example}」`;
  }).join('\n\n');
  
  return `【第一行最重要 - 決定 80% 成敗】

參考以下開頭公式，選擇最適合素材的方式自然開場：

${formulaLines}

→ 不要刻意套用，根據素材自然表達即可`;
}

/**
 * 取得類型的中文名稱
 */
export function getContentTypeName(contentType: ContentType): string {
  const names: Record<ContentType, string> = {
    story: '故事型',
    knowledge: '知識型',
    organize: '整理型',
    opinion: '觀點型',
    dialogue: '對話型',
    quote: '引用型',
    contrast: '反差型',
    casual: '閒聊型',
    question: '提問型',
    poll: '投票型',
  };
  return names[contentType] || contentType;
}
