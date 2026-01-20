import { getDb } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.log('無法連接資料庫');
    process.exit(1);
  }
  
  const accounts = await db.execute(sql`SELECT COUNT(*) as count FROM ip_accounts`);
  const posts = await db.execute(sql`SELECT COUNT(*) as count FROM ip_posts`);
  const viral = await db.execute(sql`SELECT COUNT(*) as count FROM ip_posts WHERE isViral = 1`);
  
  console.log('帳號數:', accounts);
  console.log('貼文數:', posts);
  console.log('爆款數:', viral);
  process.exit(0);
}

main();
