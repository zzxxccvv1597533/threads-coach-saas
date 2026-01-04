/**
 * 使用 Drizzle ORM 匯入爆文分析數據
 * 執行方式: node scripts/seed-benchmarks.mjs
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';

// 載入環境變數
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 未設定');
  process.exit(1);
}

// 讀取 JSON 數據
const keywordData = JSON.parse(
  fs.readFileSync('/home/ubuntu/keyword_benchmarks_data.json', 'utf-8')
);

const hooksData = JSON.parse(
  fs.readFileSync('/home/ubuntu/content_hooks_data.json', 'utf-8')
);

async function main() {
  console.log('🔗 連接資料庫...');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // 清空現有數據
    console.log('🗑️  清空現有數據...');
    await connection.execute('DELETE FROM keyword_benchmarks');
    await connection.execute('DELETE FROM content_hooks');
    
    // 匯入關鍵字數據
    console.log(`📊 匯入 ${keywordData.length} 筆關鍵字數據...`);
    
    for (const item of keywordData) {
      await connection.execute(
        `INSERT INTO keyword_benchmarks (
          keyword, category, totalPosts, avgLikes, medianLikes, maxLikes,
          viralRate, optimalLengthMin, optimalLengthMax,
          viralFactors, funnelSuggestions, stabilityScore, burstScore, dataSource
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.keyword,
          item.category || '',
          item.totalPosts,
          item.avgLikes,
          item.medianLikes,
          item.maxLikes,
          item.viralRate,
          item.optimalLengthMin || 200,
          item.optimalLengthMax || 400,
          JSON.stringify(item.viralFactors),
          JSON.stringify(item.funnelSuggestions),
          Math.round((item.stabilityScore || 0) * 10000),
          Math.round((item.burstScore || 0) * 100),
          'excel_import_2025Q1'
        ]
      );
    }
    
    console.log(`✅ 關鍵字數據匯入完成`);
    
    // 匯入鉤子數據（只取前 50 個）
    const topHooks = hooksData.slice(0, 50);
    console.log(`🪝 匯入 ${topHooks.length} 筆鉤子數據...`);
    
    for (const item of topHooks) {
      await connection.execute(
        `INSERT INTO content_hooks (
          hookPattern, hookType, avgLikes, viralRate, sampleCount, source, isActive
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.hookPattern,
          item.hookType || 'extracted',
          item.avgLikes || 0,
          Math.round((item.avgLpd || 0) * 100),
          item.sampleCount || 1,
          item.source || 'viral_analysis',
          true
        ]
      );
    }
    
    console.log(`✅ 鉤子數據匯入完成`);
    
    // 驗證匯入結果
    const [keywordCount] = await connection.execute('SELECT COUNT(*) as count FROM keyword_benchmarks');
    const [hooksCount] = await connection.execute('SELECT COUNT(*) as count FROM content_hooks');
    
    console.log('');
    console.log('📈 匯入結果:');
    console.log(`   - keyword_benchmarks: ${keywordCount[0].count} 筆`);
    console.log(`   - content_hooks: ${hooksCount[0].count} 筆`);
    
  } catch (error) {
    console.error('❌ 匯入失敗:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
