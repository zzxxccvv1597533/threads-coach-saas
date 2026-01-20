/**
 * 爆款成功因素分析
 * 
 * 分析每個 IP 帳號中，哪些因素更容易導致爆款：
 * 1. 主題選擇
 * 2. 選題方向
 * 3. 內容類型
 * 4. 呈現方式
 */

import { getDb } from '../server/db';
import { ipAccounts, ipPosts, ipSuccessFactors } from '../drizzle/schema';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import { invokeLLM } from '../server/_core/llm';

interface FactorAnalysis {
  type: 'topic' | 'angle' | 'content_type' | 'presentation';
  name: string;
  description: string;
  viralCount: number;
  totalCount: number;
  viralRate: number;
  avgLikes: number;
  examples: Array<{ postId: number; opener: string; likes: number }>;
}

async function analyzeAccount(db: any, accountId: number, accountName: string): Promise<FactorAnalysis[]> {
  console.log(`\n分析帳號: ${accountName}`);
  
  // 取得該帳號所有貼文
  const postsResult = await db.execute(sql`
    SELECT id, postText, likes, comments, shares, charLen, isViral,
           hasNumber, hasQuestion, hasExclaim, startsWithI, startsWithYou
    FROM ip_posts WHERE accountId = ${accountId}
  `);
  const posts = (postsResult as any)[0];
  
  if (posts.length < 20) {
    console.log(`  跳過（貼文數量不足：${posts.length}）`);
    return [];
  }
  
  const viralPosts = posts.filter((p: any) => p.isViral);
  const normalPosts = posts.filter((p: any) => !p.isViral);
  
  console.log(`  總貼文: ${posts.length}, 爆款: ${viralPosts.length}`);
  
  const factors: FactorAnalysis[] = [];
  
  // === 內容類型分析 ===
  // 短文 vs 長文
  const shortPosts = posts.filter((p: any) => p.charLen <= 100);
  const longPosts = posts.filter((p: any) => p.charLen > 200);
  const mediumPosts = posts.filter((p: any) => p.charLen > 100 && p.charLen <= 200);
  
  if (shortPosts.length >= 5) {
    const viralShort = shortPosts.filter((p: any) => p.isViral);
    factors.push({
      type: 'content_type',
      name: '短文（≤100字）',
      description: `短文內容，字數在 100 字以內`,
      viralCount: viralShort.length,
      totalCount: shortPosts.length,
      viralRate: viralShort.length / shortPosts.length,
      avgLikes: shortPosts.reduce((sum: number, p: any) => sum + p.likes, 0) / shortPosts.length,
      examples: viralShort.slice(0, 3).map((p: any) => ({
        postId: p.id,
        opener: p.postText.substring(0, 50),
        likes: p.likes
      }))
    });
  }
  
  if (mediumPosts.length >= 5) {
    const viralMedium = mediumPosts.filter((p: any) => p.isViral);
    factors.push({
      type: 'content_type',
      name: '中等長度（100-200字）',
      description: `中等長度內容，字數在 100-200 字之間`,
      viralCount: viralMedium.length,
      totalCount: mediumPosts.length,
      viralRate: viralMedium.length / mediumPosts.length,
      avgLikes: mediumPosts.reduce((sum: number, p: any) => sum + p.likes, 0) / mediumPosts.length,
      examples: viralMedium.slice(0, 3).map((p: any) => ({
        postId: p.id,
        opener: p.postText.substring(0, 50),
        likes: p.likes
      }))
    });
  }
  
  if (longPosts.length >= 5) {
    const viralLong = longPosts.filter((p: any) => p.isViral);
    factors.push({
      type: 'content_type',
      name: '長文（>200字）',
      description: `長文內容，字數超過 200 字`,
      viralCount: viralLong.length,
      totalCount: longPosts.length,
      viralRate: viralLong.length / longPosts.length,
      avgLikes: longPosts.reduce((sum: number, p: any) => sum + p.likes, 0) / longPosts.length,
      examples: viralLong.slice(0, 3).map((p: any) => ({
        postId: p.id,
        opener: p.postText.substring(0, 50),
        likes: p.likes
      }))
    });
  }
  
  // === 呈現方式分析 ===
  // 有數字
  const withNumber = posts.filter((p: any) => p.hasNumber);
  if (withNumber.length >= 5) {
    const viralWithNumber = withNumber.filter((p: any) => p.isViral);
    factors.push({
      type: 'presentation',
      name: '含數字',
      description: `內容中包含數字（如：3個方法、5年經驗）`,
      viralCount: viralWithNumber.length,
      totalCount: withNumber.length,
      viralRate: viralWithNumber.length / withNumber.length,
      avgLikes: withNumber.reduce((sum: number, p: any) => sum + p.likes, 0) / withNumber.length,
      examples: viralWithNumber.slice(0, 3).map((p: any) => ({
        postId: p.id,
        opener: p.postText.substring(0, 50),
        likes: p.likes
      }))
    });
  }
  
  // 有問句
  const withQuestion = posts.filter((p: any) => p.hasQuestion);
  if (withQuestion.length >= 5) {
    const viralWithQuestion = withQuestion.filter((p: any) => p.isViral);
    factors.push({
      type: 'presentation',
      name: '含問句',
      description: `內容中包含問句（引發思考或互動）`,
      viralCount: viralWithQuestion.length,
      totalCount: withQuestion.length,
      viralRate: viralWithQuestion.length / withQuestion.length,
      avgLikes: withQuestion.reduce((sum: number, p: any) => sum + p.likes, 0) / withQuestion.length,
      examples: viralWithQuestion.slice(0, 3).map((p: any) => ({
        postId: p.id,
        opener: p.postText.substring(0, 50),
        likes: p.likes
      }))
    });
  }
  
  // 以「我」開頭
  const startsWithI = posts.filter((p: any) => p.startsWithI);
  if (startsWithI.length >= 5) {
    const viralStartsWithI = startsWithI.filter((p: any) => p.isViral);
    factors.push({
      type: 'presentation',
      name: '以「我」開頭',
      description: `以第一人稱「我」開頭，建立個人連結`,
      viralCount: viralStartsWithI.length,
      totalCount: startsWithI.length,
      viralRate: viralStartsWithI.length / startsWithI.length,
      avgLikes: startsWithI.reduce((sum: number, p: any) => sum + p.likes, 0) / startsWithI.length,
      examples: viralStartsWithI.slice(0, 3).map((p: any) => ({
        postId: p.id,
        opener: p.postText.substring(0, 50),
        likes: p.likes
      }))
    });
  }
  
  // 以「你」開頭
  const startsWithYou = posts.filter((p: any) => p.startsWithYou);
  if (startsWithYou.length >= 5) {
    const viralStartsWithYou = startsWithYou.filter((p: any) => p.isViral);
    factors.push({
      type: 'presentation',
      name: '以「你」開頭',
      description: `以第二人稱「你」開頭，直接對話讀者`,
      viralCount: viralStartsWithYou.length,
      totalCount: startsWithYou.length,
      viralRate: viralStartsWithYou.length / startsWithYou.length,
      avgLikes: startsWithYou.reduce((sum: number, p: any) => sum + p.likes, 0) / startsWithYou.length,
      examples: viralStartsWithYou.slice(0, 3).map((p: any) => ({
        postId: p.id,
        opener: p.postText.substring(0, 50),
        likes: p.likes
      }))
    });
  }
  
  // === 用 LLM 分析主題和選題方向 ===
  const viralPostsContent = viralPosts.slice(0, 15).map((p: any) => p.postText.substring(0, 300)).join('\n---\n');
  const normalPostsContent = normalPosts.slice(0, 10).map((p: any) => p.postText.substring(0, 300)).join('\n---\n');
  
  try {
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `你是一位專業的社群內容分析師。請分析以下爆款貼文和普通貼文的差異，找出成功因素。

請用 JSON 格式回覆，包含：
1. topics: 這個帳號最成功的 3 個主題類型
2. angles: 這個帳號最成功的 3 個選題方向/切角
3. bestFormula: 這個帳號的最佳爆款公式（一句話）

每個 topic 和 angle 都要包含 name（名稱）和 description（為什麼這個主題/切角容易爆）`
        },
        {
          role: 'user',
          content: `帳號：${accountName}
爆款率：${(viralPosts.length / posts.length * 100).toFixed(1)}%

【爆款貼文範例】
${viralPostsContent}

【普通貼文範例】
${normalPostsContent}

請分析這個帳號的爆款成功因素。`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'success_factors',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              topics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' }
                  },
                  required: ['name', 'description'],
                  additionalProperties: false
                }
              },
              angles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' }
                  },
                  required: ['name', 'description'],
                  additionalProperties: false
                }
              },
              bestFormula: { type: 'string' }
            },
            required: ['topics', 'angles', 'bestFormula'],
            additionalProperties: false
          }
        }
      }
    });
    
    const analysis = JSON.parse(llmResponse.choices[0].message.content || '{}');
    
    // 加入主題分析
    for (const topic of (analysis.topics || []).slice(0, 3)) {
      factors.push({
        type: 'topic',
        name: topic.name,
        description: topic.description,
        viralCount: 0,
        totalCount: 0,
        viralRate: 0,
        avgLikes: 0,
        examples: []
      });
    }
    
    // 加入選題方向分析
    for (const angle of (analysis.angles || []).slice(0, 3)) {
      factors.push({
        type: 'angle',
        name: angle.name,
        description: angle.description,
        viralCount: 0,
        totalCount: 0,
        viralRate: 0,
        avgLikes: 0,
        examples: []
      });
    }
    
    console.log(`  爆款公式: ${analysis.bestFormula}`);
  } catch (error: any) {
    console.log(`  LLM 分析失敗: ${error.message}`);
  }
  
  return factors;
}

async function main() {
  console.log('開始爆款成功因素分析...\n');
  
  const db = await getDb();
  if (!db) {
    console.error('無法連接資料庫');
    process.exit(1);
  }
  
  // 清空舊的分析結果
  await db.execute(sql`DELETE FROM ip_success_factors`);
  console.log('已清空舊的分析結果\n');
  
  // 取得所有帳號
  const accountsResult = await db.execute(sql`
    SELECT id, accountName, totalPosts, viralPosts, viralRate 
    FROM ip_accounts 
    WHERE totalPosts >= 50
    ORDER BY viralRate DESC
  `);
  const accounts = (accountsResult as any)[0];
  
  console.log(`找到 ${accounts.length} 個帳號需要分析\n`);
  
  let totalFactors = 0;
  
  for (const account of accounts) {
    const factors = await analyzeAccount(db, account.id, account.accountName);
    
    // 儲存到資料庫
    for (const factor of factors) {
      await db.insert(ipSuccessFactors).values({
        accountId: account.id,
        analysisType: factor.type,
        factorName: factor.name,
        factorDescription: factor.description,
        viralCount: factor.viralCount,
        totalCount: factor.totalCount,
        viralRate: factor.viralRate.toFixed(4),
        avgLikes: Math.round(factor.avgLikes),
        examples: factor.examples,
      });
      totalFactors++;
    }
    
    // 延遲避免 API 限制
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n========================================`);
  console.log(`分析完成！共分析 ${accounts.length} 個帳號`);
  console.log(`產生 ${totalFactors} 個成功因素`);
  console.log(`========================================`);
  
  process.exit(0);
}

main();
