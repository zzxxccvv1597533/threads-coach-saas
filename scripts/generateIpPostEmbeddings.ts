/**
 * 為 IP 貼文生成 Embedding
 * 
 * 這個腳本會：
 * 1. 讀取所有 IP 貼文
 * 2. 為每篇貼文生成 Embedding
 * 3. 儲存到 ip_post_embeddings 資料表
 */

import { getDb } from '../server/db';
import { ipPosts, ipPostEmbeddings } from '../drizzle/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { generateEmbedding } from '../server/embedding-service';

const BATCH_SIZE = 50; // 每批處理 50 篇
const DELAY_MS = 1000; // 每批之間延遲 1 秒

async function main() {
  console.log('開始為 IP 貼文生成 Embedding...\n');
  
  const db = await getDb();
  if (!db) {
    console.error('無法連接資料庫');
    process.exit(1);
  }
  
  // 檢查已有多少 Embedding
  const existingCount = await db.execute(sql`SELECT COUNT(*) as count FROM ip_post_embeddings`);
  const existing = (existingCount as any)[0][0].count;
  console.log(`已有 ${existing} 個 Embedding`);
  
  // 取得所有還沒有 Embedding 的貼文
  const postsWithoutEmbedding = await db.execute(sql`
    SELECT p.id, p.postText, p.accountId
    FROM ip_posts p
    LEFT JOIN ip_post_embeddings e ON p.id = e.postId
    WHERE e.id IS NULL
    ORDER BY p.id
  `);
  
  const posts = (postsWithoutEmbedding as any)[0];
  console.log(`需要生成 ${posts.length} 個 Embedding\n`);
  
  if (posts.length === 0) {
    console.log('所有貼文都已有 Embedding！');
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
        // 取前 500 字生成 Embedding
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
          console.log(`  跳過 ID ${post.id}（無法生成 Embedding）`);
          errors++;
        }
      } catch (error: any) {
        console.log(`  錯誤 ID ${post.id}: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`  完成 ${processed}/${posts.length}，錯誤 ${errors}`);
    
    // 延遲避免 API 限制
    if (i + BATCH_SIZE < posts.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  console.log(`\n========================================`);
  console.log(`Embedding 生成完成！`);
  console.log(`成功: ${processed}`);
  console.log(`錯誤: ${errors}`);
  console.log(`========================================`);
  
  process.exit(0);
}

main();
