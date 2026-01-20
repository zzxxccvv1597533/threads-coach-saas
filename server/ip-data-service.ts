/**
 * IP 數據服務模組
 * 
 * 提供查詢 50 個 IP 帳號數據的功能：
 * 1. 查詢成功因素
 * 2. 查詢相似爆款
 * 3. 取得內容類型建議
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';
import { generateEmbedding, cosineSimilarity } from './embedding-service';

// 成功因素類型
export interface SuccessFactor {
  id: number;
  accountId: number;
  accountName: string;
  analysisType: 'topic' | 'angle' | 'content_type' | 'presentation';
  factorName: string;
  factorDescription: string;
  viralCount: number;
  totalCount: number;
  viralRate: number;
  avgLikes: number;
}

// 相似爆款
export interface SimilarViralPost {
  id: number;
  postText: string;
  likes: number;
  comments: number;
  accountName: string;
  similarity: number;
}

/**
 * 取得所有成功因素（按類型分組）
 */
export async function getSuccessFactorsByType(type: 'topic' | 'angle' | 'content_type' | 'presentation'): Promise<SuccessFactor[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.execute(sql`
    SELECT f.*, a.accountName
    FROM ip_success_factors f
    JOIN ip_accounts a ON f.accountId = a.id
    WHERE f.analysisType = ${type}
    ORDER BY f.viralRate DESC
    LIMIT 50
  `);
  
  return (result as any)[0].map((row: any) => ({
    id: row.id,
    accountId: row.accountId,
    accountName: row.accountName,
    analysisType: row.analysisType,
    factorName: row.factorName,
    factorDescription: row.factorDescription,
    viralCount: row.viralCount,
    totalCount: row.totalCount,
    viralRate: parseFloat(row.viralRate) || 0,
    avgLikes: row.avgLikes,
  }));
}

/**
 * 取得身心靈領域的成功因素
 */
export async function getSpiritualSuccessFactors(): Promise<{
  topics: SuccessFactor[];
  angles: SuccessFactor[];
  contentTypes: SuccessFactor[];
  presentations: SuccessFactor[];
}> {
  const db = await getDb();
  if (!db) return { topics: [], angles: [], contentTypes: [], presentations: [] };
  
  // 身心靈相關帳號 ID（從帳號名稱判斷）
  const spiritualKeywords = ['命理', '塔羅', '心理', '能量', '療癒', '玄學', '紫微', '八字', '占卜', '靈性', '溝通'];
  
  const result = await db.execute(sql`
    SELECT f.*, a.accountName
    FROM ip_success_factors f
    JOIN ip_accounts a ON f.accountId = a.id
    WHERE a.accountName REGEXP ${spiritualKeywords.join('|')}
       OR a.accountName LIKE '%心理%'
       OR a.accountName LIKE '%塔羅%'
       OR a.accountName LIKE '%命理%'
       OR a.accountName LIKE '%能量%'
    ORDER BY f.viralRate DESC
  `);
  
  const factors = (result as any)[0].map((row: any) => ({
    id: row.id,
    accountId: row.accountId,
    accountName: row.accountName,
    analysisType: row.analysisType,
    factorName: row.factorName,
    factorDescription: row.factorDescription,
    viralCount: row.viralCount,
    totalCount: row.totalCount,
    viralRate: parseFloat(row.viralRate) || 0,
    avgLikes: row.avgLikes,
  }));
  
  return {
    topics: factors.filter((f: SuccessFactor) => f.analysisType === 'topic'),
    angles: factors.filter((f: SuccessFactor) => f.analysisType === 'angle'),
    contentTypes: factors.filter((f: SuccessFactor) => f.analysisType === 'content_type'),
    presentations: factors.filter((f: SuccessFactor) => f.analysisType === 'presentation'),
  };
}

/**
 * 根據用戶素材找出相似的爆款貼文
 */
export async function findSimilarViralPosts(
  userContent: string,
  limit: number = 5
): Promise<SimilarViralPost[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    // 生成用戶內容的 Embedding
    const userEmbedding = await generateEmbedding(userContent.substring(0, 500));
    if (!userEmbedding || userEmbedding.length === 0) return [];
    
    // 取得所有爆款貼文的 Embedding
    const embeddingsResult = await db.execute(sql`
      SELECT e.postId, e.embedding, p.postText, p.likes, p.comments, a.accountName
      FROM ip_post_embeddings e
      JOIN ip_posts p ON e.postId = p.id
      JOIN ip_accounts a ON p.accountId = a.id
      WHERE p.isViral = 1
    `);
    
    const embeddings = (embeddingsResult as any)[0];
    
    // 計算相似度
    const similarities: Array<{
      postId: number;
      postText: string;
      likes: number;
      comments: number;
      accountName: string;
      similarity: number;
    }> = [];
    
    for (const row of embeddings) {
      try {
        const embedding = JSON.parse(row.embedding);
        const similarity = cosineSimilarity(userEmbedding, embedding);
        
        if (similarity > 0.3) { // 只保留相似度 > 0.3 的
          similarities.push({
            postId: row.postId,
            postText: row.postText,
            likes: row.likes,
            comments: row.comments,
            accountName: row.accountName,
            similarity,
          });
        }
      } catch (e) {
        // 跳過解析失敗的
      }
    }
    
    // 按相似度排序，取前 N 個
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, limit).map(s => ({
      id: s.postId,
      postText: s.postText,
      likes: s.likes,
      comments: s.comments,
      accountName: s.accountName,
      similarity: s.similarity,
    }));
  } catch (error) {
    console.error('[findSimilarViralPosts] Error:', error);
    return [];
  }
}

/**
 * 取得內容類型建議（基於數據分析）
 */
export async function getContentTypeRecommendations(): Promise<{
  shortPost: { viralRate: number; avgLikes: number; recommendation: string };
  mediumPost: { viralRate: number; avgLikes: number; recommendation: string };
  longPost: { viralRate: number; avgLikes: number; recommendation: string };
}> {
  const db = await getDb();
  if (!db) {
    return {
      shortPost: { viralRate: 0, avgLikes: 0, recommendation: '' },
      mediumPost: { viralRate: 0, avgLikes: 0, recommendation: '' },
      longPost: { viralRate: 0, avgLikes: 0, recommendation: '' },
    };
  }
  
  // 統計不同長度的爆款率
  const shortResult = await db.execute(sql`
    SELECT COUNT(*) as total, SUM(isViral) as viral, AVG(likes) as avgLikes
    FROM ip_posts WHERE charLen <= 100
  `);
  const mediumResult = await db.execute(sql`
    SELECT COUNT(*) as total, SUM(isViral) as viral, AVG(likes) as avgLikes
    FROM ip_posts WHERE charLen > 100 AND charLen <= 200
  `);
  const longResult = await db.execute(sql`
    SELECT COUNT(*) as total, SUM(isViral) as viral, AVG(likes) as avgLikes
    FROM ip_posts WHERE charLen > 200
  `);
  
  const short = (shortResult as any)[0][0];
  const medium = (mediumResult as any)[0][0];
  const long = (longResult as any)[0][0];
  
  const shortViralRate = short.total > 0 ? short.viral / short.total : 0;
  const mediumViralRate = medium.total > 0 ? medium.viral / medium.total : 0;
  const longViralRate = long.total > 0 ? long.viral / long.total : 0;
  
  return {
    shortPost: {
      viralRate: shortViralRate,
      avgLikes: Math.round(short.avgLikes || 0),
      recommendation: shortViralRate > mediumViralRate && shortViralRate > longViralRate
        ? '數據顯示短文（≤100字）爆款率最高，建議嘗試精簡內容'
        : '短文適合情緒直球、金句型內容',
    },
    mediumPost: {
      viralRate: mediumViralRate,
      avgLikes: Math.round(medium.avgLikes || 0),
      recommendation: mediumViralRate > shortViralRate && mediumViralRate > longViralRate
        ? '數據顯示中等長度（100-200字）爆款率最高，建議維持這個長度'
        : '中等長度適合故事型、觀點型內容',
    },
    longPost: {
      viralRate: longViralRate,
      avgLikes: Math.round(long.avgLikes || 0),
      recommendation: longViralRate > shortViralRate && longViralRate > mediumViralRate
        ? '數據顯示長文（>200字）爆款率最高，建議深度輸出'
        : '長文適合教學型、深度分析型內容',
    },
  };
}

/**
 * 取得呈現方式建議（基於數據分析）
 */
export async function getPresentationRecommendations(): Promise<Array<{
  name: string;
  viralRate: number;
  avgLikes: number;
  recommendation: string;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const recommendations: Array<{
    name: string;
    viralRate: number;
    avgLikes: number;
    recommendation: string;
  }> = [];
  
  // 含數字
  const withNumber = await db.execute(sql`
    SELECT COUNT(*) as total, SUM(isViral) as viral, AVG(likes) as avgLikes
    FROM ip_posts WHERE hasNumber = 1
  `);
  const numberData = (withNumber as any)[0][0];
  if (numberData.total > 0) {
    recommendations.push({
      name: '含數字',
      viralRate: numberData.viral / numberData.total,
      avgLikes: Math.round(numberData.avgLikes || 0),
      recommendation: '在內容中加入具體數字（如：3個方法、5年經驗）可提升可信度',
    });
  }
  
  // 含問句
  const withQuestion = await db.execute(sql`
    SELECT COUNT(*) as total, SUM(isViral) as viral, AVG(likes) as avgLikes
    FROM ip_posts WHERE hasQuestion = 1
  `);
  const questionData = (withQuestion as any)[0][0];
  if (questionData.total > 0) {
    recommendations.push({
      name: '含問句',
      viralRate: questionData.viral / questionData.total,
      avgLikes: Math.round(questionData.avgLikes || 0),
      recommendation: '在開頭或結尾加入問句可引發讀者思考和互動',
    });
  }
  
  // 以「我」開頭
  const startsWithI = await db.execute(sql`
    SELECT COUNT(*) as total, SUM(isViral) as viral, AVG(likes) as avgLikes
    FROM ip_posts WHERE startsWithI = 1
  `);
  const iData = (startsWithI as any)[0][0];
  if (iData.total > 0) {
    recommendations.push({
      name: '以「我」開頭',
      viralRate: iData.viral / iData.total,
      avgLikes: Math.round(iData.avgLikes || 0),
      recommendation: '以第一人稱開頭可建立個人連結，適合故事型內容',
    });
  }
  
  // 以「你」開頭
  const startsWithYou = await db.execute(sql`
    SELECT COUNT(*) as total, SUM(isViral) as viral, AVG(likes) as avgLikes
    FROM ip_posts WHERE startsWithYou = 1
  `);
  const youData = (startsWithYou as any)[0][0];
  if (youData.total > 0) {
    recommendations.push({
      name: '以「你」開頭',
      viralRate: youData.viral / youData.total,
      avgLikes: Math.round(youData.avgLikes || 0),
      recommendation: '以第二人稱開頭可直接對話讀者，適合教學型內容',
    });
  }
  
  // 按爆款率排序
  recommendations.sort((a, b) => b.viralRate - a.viralRate);
  
  return recommendations;
}

/**
 * 取得隨機的爆款公式（用於靈感發想）
 */
export async function getRandomViralFormulas(count: number = 5): Promise<Array<{
  accountName: string;
  formula: string;
  topics: string[];
  angles: string[];
}>> {
  const db = await getDb();
  if (!db) return [];
  
  // 取得所有帳號的成功因素
  const result = await db.execute(sql`
    SELECT a.accountName, f.analysisType, f.factorName, f.factorDescription
    FROM ip_success_factors f
    JOIN ip_accounts a ON f.accountId = a.id
    WHERE f.analysisType IN ('topic', 'angle')
    ORDER BY RAND()
    LIMIT ${count * 6}
  `);
  
  const rows = (result as any)[0];
  
  // 按帳號分組
  const accountMap = new Map<string, { topics: string[]; angles: string[] }>();
  
  for (const row of rows) {
    if (!accountMap.has(row.accountName)) {
      accountMap.set(row.accountName, { topics: [], angles: [] });
    }
    const account = accountMap.get(row.accountName)!;
    if (row.analysisType === 'topic' && account.topics.length < 2) {
      account.topics.push(row.factorName);
    } else if (row.analysisType === 'angle' && account.angles.length < 2) {
      account.angles.push(row.factorName);
    }
  }
  
  // 轉換為結果
  const formulas: Array<{
    accountName: string;
    formula: string;
    topics: string[];
    angles: string[];
  }> = [];
  
  for (const [accountName, data] of Array.from(accountMap)) {
    if (data.topics.length > 0 && data.angles.length > 0) {
      formulas.push({
        accountName,
        formula: `${data.topics[0]} + ${data.angles[0]}`,
        topics: data.topics,
        angles: data.angles,
      });
    }
    if (formulas.length >= count) break;
  }
  
  return formulas;
}
