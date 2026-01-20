/**
 * Few-Shot 品質閘
 * 
 * 功能：
 * 1. 過濾低品質範例（likes < 50）
 * 2. 主題匹配度計算（使用關鍵詞比對）
 * 3. 標注範例來源（user/system）
 * 4. 限制範例數量（最多 2 個）
 */

import * as db from './db';

// 品質閘配置
const QUALITY_GATE_CONFIG = {
  MIN_LIKES: 50,           // 最低讚數門檻
  MAX_EXAMPLES: 2,         // 最多範例數量
  MIN_MATCH_SCORE: 0.3,    // 最低匹配分數（0-1）
  PREFER_USER_EXAMPLES: true, // 優先使用用戶自己的範例
};

// 範例來源類型
export type ExampleSource = 'user' | 'system';

// 品質過濾後的範例
export interface QualifiedExample {
  postText: string;
  likes: number;
  source: ExampleSource;
  matchScore: number;
  keyword?: string;
}

/**
 * 計算關鍵詞匹配分數
 * 使用 Jaccard 相似度
 */
function calculateMatchScore(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0.5; // 沒有關鍵詞時給中等分數
  
  const textLower = text.toLowerCase();
  const matchedCount = keywords.filter(kw => 
    textLower.includes(kw.toLowerCase())
  ).length;
  
  return matchedCount / keywords.length;
}

/**
 * 從文本中提取關鍵詞
 */
function extractKeywords(material: string): string[] {
  // 移除標點符號和空白
  const cleaned = material
    .replace(/[，。！？、；：""''（）【】《》\s]+/g, ' ')
    .trim();
  
  // 分詞（簡單實作：按空格和常見連接詞分割）
  const words = cleaned.split(/[\s,，。！？、；：]+/).filter(w => w.length >= 2);
  
  // 去重並取前 10 個
  return Array.from(new Set(words)).slice(0, 10);
}

/**
 * 取得品質過濾後的 Few-Shot 範例
 */
export async function getQualifiedFewShotSamples(
  contentType: string,
  material: string,
  userId?: string
): Promise<QualifiedExample[]> {
  const keywords = extractKeywords(material);
  const qualifiedExamples: QualifiedExample[] = [];
  
  // 1. 優先從用戶的爆款貼文中取得範例
  // 註：目前系統尚未實作 getUserTopPerformingPosts，先跳過
  // TODO: 實作用戶爆款貼文查詢功能
  if (userId && QUALITY_GATE_CONFIG.PREFER_USER_EXAMPLES) {
    // 未來實作：從 draft_posts 中查詢用戶的高互動貼文
    console.log('[FewShotQualityGate] User examples feature pending implementation');
  }
  
  // 2. 從系統範例庫中取得範例
  // 註：使用現有的 getContentHooks 函數
  try {
    // 從 contentHooks 中取得範例（取前 10 個高讚數的）
    const hooks = await db.getContentHooks({ limit: 10 });
    
    for (const hook of hooks) {
      // 從 hook.examples 中取得範例貼文
      if (hook.examples && Array.isArray(hook.examples)) {
        for (const example of hook.examples) {
          if (example.likes >= QUALITY_GATE_CONFIG.MIN_LIKES) {
            const matchScore = calculateMatchScore(example.content, keywords);
            
            if (matchScore >= QUALITY_GATE_CONFIG.MIN_MATCH_SCORE) {
              qualifiedExamples.push({
                postText: example.content,
                likes: example.likes,
                source: 'system',
                matchScore,
                keyword: example.keyword,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('[FewShotQualityGate] Failed to get system examples:', error);
  }
  
  // 3. 排序：優先用戶範例，然後按匹配分數和讚數排序
  qualifiedExamples.sort((a, b) => {
    // 用戶範例優先
    if (a.source !== b.source) {
      return a.source === 'user' ? -1 : 1;
    }
    // 匹配分數高的優先
    if (Math.abs(a.matchScore - b.matchScore) > 0.1) {
      return b.matchScore - a.matchScore;
    }
    // 讚數高的優先
    return b.likes - a.likes;
  });
  
  // 4. 限制數量
  return qualifiedExamples.slice(0, QUALITY_GATE_CONFIG.MAX_EXAMPLES);
}

/**
 * 建構品質過濾後的 Few-Shot 提示詞
 */
export function buildQualifiedFewShotPrompt(examples: QualifiedExample[]): string {
  if (examples.length === 0) {
    return '';
  }
  
  const exampleLines = examples.map((ex, i) => {
    const truncated = ex.postText.length > 200 
      ? ex.postText.substring(0, 200) + '...' 
      : ex.postText;
    const sourceLabel = ex.source === 'user' ? '（你的爆款）' : '';
    return `${i + 1}. ${sourceLabel}\n${truncated}`;
  }).join('\n\n');
  
  return `【氛圍參考】（感受說話方式，不要模仿結構）

${exampleLines}

→ 這些是高互動貼文的氛圍，感受語氣和節奏即可`;
}

/**
 * 取得品質閘統計資訊（用於監控）
 */
export function getQualityGateStats(examples: QualifiedExample[]): {
  totalCount: number;
  userCount: number;
  systemCount: number;
  avgMatchScore: number;
  avgLikes: number;
} {
  const userExamples = examples.filter(e => e.source === 'user');
  const systemExamples = examples.filter(e => e.source === 'system');
  
  const avgMatchScore = examples.length > 0
    ? examples.reduce((sum, e) => sum + e.matchScore, 0) / examples.length
    : 0;
    
  const avgLikes = examples.length > 0
    ? examples.reduce((sum, e) => sum + e.likes, 0) / examples.length
    : 0;
  
  return {
    totalCount: examples.length,
    userCount: userExamples.length,
    systemCount: systemExamples.length,
    avgMatchScore: Math.round(avgMatchScore * 100) / 100,
    avgLikes: Math.round(avgLikes),
  };
}
