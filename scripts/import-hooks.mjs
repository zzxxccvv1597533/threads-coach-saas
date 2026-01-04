import Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 讀取 Excel 檔案
const excelFile = '/home/ubuntu/upload/2_爆款分析儀表板_7大成果物_Part1(1).xlsx';
const workbook = XLSX.readFile(excelFile);
const sheet = workbook.Sheets['3_開頭鉤子庫_Top80'];
const data = XLSX.utils.sheet_to_json(sheet);

console.log('讀取到', data.length, '個鉤子');

// 連接資料庫
const dbPath = path.join(__dirname, '..', 'local.db');
const db = new Database(dbPath);

// 檢查 content_hooks 表是否存在
const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='content_hooks'").get();
console.log('content_hooks 表存在:', !!tableExists);

if (!tableExists) {
  console.log('創建 content_hooks 表...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_hooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hook_text TEXT NOT NULL,
      hook_type TEXT DEFAULT 'general',
      source TEXT DEFAULT 'excel_import',
      effectiveness_score REAL,
      usage_count INTEGER DEFAULT 0,
      median_likes REAL,
      median_lpd REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// 清空現有數據
db.exec('DELETE FROM content_hooks');
console.log('已清空現有數據');

// 插入新數據
const insertStmt = db.prepare(`
  INSERT INTO content_hooks (hook_text, hook_type, source, median_likes, median_lpd, created_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
`);

let inserted = 0;
for (const row of data) {
  const hookText = row.first_line || '';
  if (hookText.trim()) {
    insertStmt.run(
      hookText.trim(),
      'top80',
      'excel_import',
      row.median_likes || 0,
      row.median_lpd || 0
    );
    inserted++;
  }
}

console.log('成功匯入', inserted, '個鉤子');

// 驗證
const count = db.prepare('SELECT COUNT(*) as count FROM content_hooks').get();
console.log('資料庫中現有鉤子數量:', count.count);

// 顯示前 5 個
const samples = db.prepare('SELECT * FROM content_hooks LIMIT 5').all();
console.log('\n前 5 個鉤子:');
samples.forEach((h, i) => {
  console.log(`${i+1}. ${h.hook_text.substring(0, 50)}... (likes: ${h.median_likes})`);
});

db.close();
