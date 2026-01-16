import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';
import { eq, sql } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

// 查詢用戶 1 的所有偏好
const prefs = await db
  .select()
  .from(schema.userTemplatePreferences)
  .where(eq(schema.userTemplatePreferences.userId, 1));

console.log('用戶 1 的模板偏好：');
console.log(JSON.stringify(prefs, null, 2));

// 檢查是否有重複
const categories = prefs.map(p => p.templateCategory);
const duplicates = categories.filter((item, index) => categories.indexOf(item) !== index);
if (duplicates.length > 0) {
  console.log('\n發現重複的 templateCategory:', duplicates);
}

await connection.end();
