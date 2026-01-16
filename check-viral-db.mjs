import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// 1. 總數量
const [countResult] = await db.execute(sql`SELECT COUNT(*) as total FROM viral_examples`);
console.log('=== 爆款資料庫統計 ===');
console.log('總筆數:', countResult[0].total);

// 2. 關鍵字分布
const keywords = await db.execute(sql`SELECT keyword, COUNT(*) as count FROM viral_examples GROUP BY keyword ORDER BY count DESC LIMIT 20`);
console.log('\n=== 關鍵字分布（前 20） ===');
keywords[0].forEach(k => console.log(`${k.keyword}: ${k.count} 筆`));

// 3. 讚數分布
const likesStats = await db.execute(sql`
  SELECT 
    CASE 
      WHEN likes >= 50000 THEN 'S級 (≥50K)'
      WHEN likes >= 10000 THEN 'A級 (10K-50K)'
      WHEN likes >= 3000 THEN 'B級 (3K-10K)'
      ELSE 'C級 (<3K)'
    END as tier,
    COUNT(*) as count
  FROM viral_examples 
  GROUP BY tier
  ORDER BY MIN(likes) DESC
`);
console.log('\n=== 讚數分布 ===');
likesStats[0].forEach(s => console.log(`${s.tier}: ${s.count} 筆`));

// 4. 範例資料
const samples = await db.execute(sql`SELECT id, keyword, opener50, likes FROM viral_examples ORDER BY likes DESC LIMIT 5`);
console.log('\n=== 高讚範例（前 5） ===');
samples[0].forEach(s => {
  console.log(`[${s.keyword}] ${s.opener50} (${s.likes} 讚)`);
});

await connection.end();
