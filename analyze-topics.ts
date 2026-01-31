import { getDb } from './server/db';
import { viralExamples } from './drizzle/schema';
import { desc, gte, isNotNull } from 'drizzle-orm';

async function analyzeTopics() {
  const db = await getDb();
  if (!db) {
    console.log('無法連接資料庫');
    return;
  }
  
  // 取得高互動的爆款貼文
  const posts = await db.select({
    postText: viralExamples.postText,
    likes: viralExamples.likes,
    keyword: viralExamples.keyword,
    opener50: viralExamples.opener50,
  })
  .from(viralExamples)
  .where(gte(viralExamples.likes, 500))
  .orderBy(desc(viralExamples.likes))
  .limit(50);

  console.log('=== 高互動爆款貼文分析 ===\n');
  console.log(`共找到 ${posts.length} 篇高互動貼文\n`);
  
  posts.forEach((post, i) => {
    // 取得貼文的前 150 字
    const firstPart = post.postText.substring(0, 150).replace(/\n/g, ' ');
    console.log(`${i+1}. [${post.likes} 讚] [${post.keyword}]`);
    console.log(`   ${firstPart}...`);
    console.log('---');
  });
}

analyzeTopics().catch(console.error).finally(() => process.exit(0));
