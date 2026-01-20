import { getDb } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.log('無法連接資料庫');
    process.exit(1);
  }
  
  const embeddings = await db.execute(sql`SELECT COUNT(*) as count FROM ip_post_embeddings`);
  console.log('IP 貼文 Embedding 數:', (embeddings as any)[0][0].count);
  process.exit(0);
}

main();
