import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

// 找出所有重複的記錄
const duplicates = await connection.execute(`
  SELECT userId, templateCategory, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
  FROM user_template_preferences
  GROUP BY userId, templateCategory
  HAVING COUNT(*) > 1
`);

console.log('發現的重複記錄：');
console.log(duplicates[0]);

// 對於每組重複記錄，保留 id 最小的那筆，刪除其他的
for (const row of duplicates[0]) {
  const ids = row.ids.split(',').map(Number);
  const keepId = Math.min(...ids);
  const deleteIds = ids.filter(id => id !== keepId);
  
  console.log(`\n用戶 ${row.userId} 的 ${row.templateCategory}：保留 id=${keepId}，刪除 ids=[${deleteIds.join(', ')}]`);
  
  for (const deleteId of deleteIds) {
    await db.delete(schema.userTemplatePreferences)
      .where(eq(schema.userTemplatePreferences.id, deleteId));
    console.log(`  已刪除 id=${deleteId}`);
  }
}

// 驗證結果
const remaining = await db
  .select()
  .from(schema.userTemplatePreferences)
  .where(eq(schema.userTemplatePreferences.userId, 1));

console.log('\n清理後用戶 1 的偏好：');
console.log(remaining.map(p => ({ id: p.id, category: p.templateCategory })));

await connection.end();
console.log('\n✅ 重複記錄清理完成');
