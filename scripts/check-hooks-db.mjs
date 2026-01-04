import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  // 檢查 content_hooks 表
  const [rows] = await connection.execute('SELECT COUNT(*) as count FROM content_hooks');
  console.log('content_hooks 表現有數據:', rows[0].count, '筆');
  
  // 顯示前 5 筆
  const [samples] = await connection.execute('SELECT * FROM content_hooks LIMIT 5');
  console.log('\n前 5 筆數據:');
  samples.forEach((row, i) => {
    console.log(`${i+1}. hookPattern: ${row.hookPattern?.substring(0, 50) || 'N/A'}...`);
    console.log(`   hookType: ${row.hookType}, avgLikes: ${row.avgLikes}, source: ${row.source}`);
  });
  
  // 檢查 keyword_benchmarks 表
  const [kbRows] = await connection.execute('SELECT COUNT(*) as count FROM keyword_benchmarks');
  console.log('\n\nkeyword_benchmarks 表現有數據:', kbRows[0].count, '筆');
  
  // 顯示前 5 筆
  const [kbSamples] = await connection.execute('SELECT keyword, top10Rate, medianLpd, viralFactors FROM keyword_benchmarks LIMIT 5');
  console.log('\n前 5 筆數據:');
  kbSamples.forEach((row, i) => {
    console.log(`${i+1}. keyword: ${row.keyword}`);
    console.log(`   top10Rate: ${row.top10Rate}, medianLpd: ${row.medianLpd}`);
    console.log(`   viralFactors: ${JSON.stringify(row.viralFactors)?.substring(0, 100)}...`);
  });
  
  await connection.end();
}

main().catch(console.error);
