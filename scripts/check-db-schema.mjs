import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // 檢查 content_hooks 表結構
  console.log('=== content_hooks 表結構 ===');
  const [hooksCols] = await connection.execute('DESCRIBE content_hooks');
  hooksCols.forEach(col => console.log(`  ${col.Field}: ${col.Type}`));
  
  // 檢查 content_hooks 數據量
  const [hooksCount] = await connection.execute('SELECT COUNT(*) as count FROM content_hooks');
  console.log(`\ncontent_hooks 數據量: ${hooksCount[0].count} 筆`);
  
  // 檢查 keyword_benchmarks 表結構
  console.log('\n=== keyword_benchmarks 表結構 ===');
  const [kbCols] = await connection.execute('DESCRIBE keyword_benchmarks');
  kbCols.forEach(col => console.log(`  ${col.Field}: ${col.Type}`));
  
  // 檢查 keyword_benchmarks 數據量
  const [kbCount] = await connection.execute('SELECT COUNT(*) as count FROM keyword_benchmarks');
  console.log(`\nkeyword_benchmarks 數據量: ${kbCount[0].count} 筆`);
  
  // 顯示 keyword_benchmarks 前 3 筆
  const [kbSamples] = await connection.execute('SELECT * FROM keyword_benchmarks LIMIT 3');
  console.log('\nkeyword_benchmarks 前 3 筆:');
  kbSamples.forEach((row, i) => {
    console.log(`${i+1}. keyword: ${row.keyword}`);
    console.log(`   viralFactors: ${JSON.stringify(row.viralFactors)?.substring(0, 200)}...`);
  });
  
  await connection.end();
}

main().catch(console.error);
