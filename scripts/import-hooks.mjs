#!/usr/bin/env node
/**
 * 將開頭鉤子匯入資料庫
 */

import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

// 讀取真實鉤子數據
const realHooks = JSON.parse(
  readFileSync('/home/ubuntu/real_hooks_data.json', 'utf-8')
);

// 讀取手動整理的鉤子模式
const manualHooks = JSON.parse(
  readFileSync('/home/ubuntu/hooks_data.json', 'utf-8')
);

console.log(`準備匯入 ${realHooks.length} 個真實鉤子 + ${manualHooks.length} 個模式鉤子...`);

// 連接資料庫
const connection = await mysql.createConnection(process.env.DATABASE_URL);

// 建立 INSERT 語句
const insertSQL = `
  INSERT INTO content_hooks 
  (hookPattern, hookType, avgLikes, sampleCount, source, isActive)
  VALUES (?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    hookType = VALUES(hookType),
    avgLikes = VALUES(avgLikes),
    sampleCount = VALUES(sampleCount),
    updatedAt = NOW()
`;

let successCount = 0;
let errorCount = 0;

// 匯入真實鉤子
for (const hook of realHooks) {
  try {
    await connection.execute(insertSQL, [
      hook.pattern.substring(0, 500), // 限制長度
      hook.type,
      hook.avgLikes,
      hook.sampleCount,
      'viral_analysis',
      true
    ]);
    successCount++;
  } catch (error) {
    console.error(`匯入真實鉤子失敗:`, error.message);
    errorCount++;
  }
}

// 匯入手動整理的模式鉤子
for (const hook of manualHooks) {
  try {
    await connection.execute(insertSQL, [
      hook.pattern,
      hook.type,
      0, // 模式鉤子沒有具體讚數
      0,
      'manual',
      true
    ]);
    successCount++;
  } catch (error) {
    // 忽略重複的
    if (!error.message.includes('Duplicate')) {
      console.error(`匯入模式鉤子失敗:`, error.message);
      errorCount++;
    }
  }
}

await connection.end();

console.log(`\n匯入完成！成功: ${successCount}, 失敗: ${errorCount}`);
