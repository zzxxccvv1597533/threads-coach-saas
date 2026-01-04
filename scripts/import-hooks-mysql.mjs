import mysql from 'mysql2/promise';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // 讀取 Excel 檔案
  const excelFile = '/home/ubuntu/upload/2_爆款分析儀表板_7大成果物_Part1(1).xlsx';
  const workbook = XLSX.readFile(excelFile);
  const sheet = workbook.Sheets['3_開頭鉤子庫_Top80'];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log('讀取到', data.length, '個鉤子');
  console.log('欄位名稱:', Object.keys(data[0]));
  
  // 連接資料庫
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // 檢查現有數據
  const [existingCount] = await connection.execute('SELECT COUNT(*) as count FROM content_hooks');
  console.log('現有鉤子數量:', existingCount[0].count);
  
  // 清空現有數據（來源為 excel_import 的）
  await connection.execute("DELETE FROM content_hooks WHERE source = 'excel_import'");
  console.log('已清空 excel_import 來源的數據');
  
  // 插入新數據 - 使用正確的欄位名稱 opener_24, avg_likes, avg_lpd
  let inserted = 0;
  for (const row of data) {
    const hookText = row.opener_24 || '';  // 修正欄位名稱
    if (hookText.trim()) {
      await connection.execute(
        `INSERT INTO content_hooks (hookPattern, hookType, source, avgLikes, sampleCount, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          hookText.trim(),
          'top80',
          'excel_import',
          Math.round(row.avg_likes || 0),  // 修正欄位名稱
          row.posts || 1  // 修正欄位名稱
        ]
      );
      inserted++;
    }
  }
  
  console.log('成功匯入', inserted, '個鉤子');
  
  // 驗證
  const [newCount] = await connection.execute('SELECT COUNT(*) as count FROM content_hooks');
  console.log('資料庫中現有鉤子總數:', newCount[0].count);
  
  // 顯示前 5 個
  const [samples] = await connection.execute('SELECT * FROM content_hooks WHERE source = "excel_import" LIMIT 5');
  console.log('\n前 5 個匯入的鉤子:');
  samples.forEach((h, i) => {
    console.log(`${i+1}. ${h.hookPattern.substring(0, 50)}... (likes: ${h.avgLikes})`);
  });
  
  await connection.end();
  console.log('\n匯入完成！');
}

main().catch(console.error);
