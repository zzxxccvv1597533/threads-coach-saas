/**
 * 只為爆款貼文生成 Embedding
 * 
 * 策略：只處理 isViral = 1 的貼文（約 1,780 篇）
 * 這樣可以更快完成，而且對於爆款成功因素分析最有價值
 */

import { getDb } from '../server/db';
import { ipPosts, ipPostEmbeddings } from '../drizzle/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { generateEmbedding } from '../server/embedding-service';

const BATCH_SIZE = 50;
const DELAY_MS = 500;

async function main() {
  console.log('開始為爆款貼文生成 Embedding...\n');
  
  const db = await getDb();
  if (!db) {
    console.error('無法連接資料庫');
    process.exit(1);
  }
  
  // 檢查已有多少 Embedding
  const existingCount = await db.execute(sql`SELECT COUNT(*) as count FROM ip_post_embeddings`);
  const existing = (existingCount as any)[0][0].count;
  console.log(`已有 ${existing} 個 Embedding`);
  
  // 只取得爆款貼文中還沒有 Embedding 的
  const viralPostsWithoutEmbedding = await db.execute(sql`
    SELECT p.id, p.postText, p.accountId, p.likes
    FROM ip_posts p
    LEFT JOIN ip_post_embeddings e ON p.id = e.postId
    WHERE p.isViral = 1 AND e.id IS NULL
    ORDER BY p.likes DESC
  `);
  
  const posts = (viralPostsWithoutEmbedding as any)[0];
  console.log(`需要生成 ${posts.length} 個爆款貼文 Embedding\n`);
  
  if (posts.length === 0) {
    console.log('所有爆款貼文都已有 Embedding！');
    process.exit(0);
  }
  
  let processed = 0;
  let errors = 0;
  
  // 分批處理
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    console.log(`處理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posts.length / BATCH_SIZE)} (${batch.length} 篇)`);
    
    for (const post of batch) {
      try {
        const text = post.postText.substring(0, 500);
        const embedding = await generateEmbedding(text);
        
        if (embedding && embedding.length > 0) {
          await db.insert(ipPostEmbeddings).values({
            postId: post.id,
            accountId: post.accountId,
            embedding: JSON.stringify(embedding),
            textHash: text.substring(0, 50),
          });
          processed++;
        } else {
          errors++;
        }
      } catch (error: any) {
        errors++;
      }
    }
    
    console.log(`  完成 ${processed}/${posts.length}，錯誤 ${errors}`);
    
    if (i + BATCH_SIZE < posts.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  console.log(`\n========================================`);
  console.log(`爆款貼文 Embedding 生成完成！`);
  console.log(`成功: ${processed}`);
  console.log(`錯誤: ${errors}`);
  console.log(`========================================`);
  
  process.exit(0);
}

main();
