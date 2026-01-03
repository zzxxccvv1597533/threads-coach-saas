#!/usr/bin/env node
/**
 * 將 Benchmark 數據匯入資料庫
 */

import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

// 讀取 JSON 數據
const benchmarkData = JSON.parse(
  readFileSync('/home/ubuntu/benchmark_data.json', 'utf-8')
);

console.log(`準備匯入 ${benchmarkData.length} 個關鍵字的 Benchmark 數據...`);

// 連接資料庫
const connection = await mysql.createConnection(process.env.DATABASE_URL);

// 建立 INSERT 語句
const insertSQL = `
  INSERT INTO keyword_benchmarks 
  (keyword, category, totalPosts, avgLikes, medianLikes, maxLikes, viralCount, viralRate, avgLength, optimalLengthMin, optimalLengthMax, dataSource)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    category = VALUES(category),
    totalPosts = VALUES(totalPosts),
    avgLikes = VALUES(avgLikes),
    medianLikes = VALUES(medianLikes),
    maxLikes = VALUES(maxLikes),
    viralCount = VALUES(viralCount),
    viralRate = VALUES(viralRate),
    avgLength = VALUES(avgLength),
    optimalLengthMin = VALUES(optimalLengthMin),
    optimalLengthMax = VALUES(optimalLengthMax),
    dataSource = VALUES(dataSource),
    lastUpdatedAt = NOW()
`;

let successCount = 0;
let errorCount = 0;

for (const item of benchmarkData) {
  try {
    await connection.execute(insertSQL, [
      item.keyword,
      item.category,
      item.totalPosts,
      item.avgLikes,
      item.medianLikes,
      item.maxLikes,
      item.viralCount,
      item.viralRate,
      item.avgLength,
      item.optimalLengthMin,
      item.optimalLengthMax,
      item.dataSource
    ]);
    successCount++;
  } catch (error) {
    console.error(`匯入 "${item.keyword}" 失敗:`, error.message);
    errorCount++;
  }
}

await connection.end();

console.log(`\n匯入完成！成功: ${successCount}, 失敗: ${errorCount}`);
