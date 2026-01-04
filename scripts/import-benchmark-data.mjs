/**
 * 匯入爆文分析數據到資料庫
 * 執行方式: node scripts/import-benchmark-data.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 讀取 JSON 數據
const keywordData = JSON.parse(
  fs.readFileSync('/home/ubuntu/keyword_benchmarks_data.json', 'utf-8')
);

const hooksData = JSON.parse(
  fs.readFileSync('/home/ubuntu/content_hooks_data.json', 'utf-8')
);

const liftData = JSON.parse(
  fs.readFileSync('/home/ubuntu/viral_factors_lift.json', 'utf-8')
);

// 生成 SQL 語句
function generateKeywordSQL(data) {
  const values = data.map(item => {
    const viralFactors = JSON.stringify(item.viralFactors).replace(/'/g, "''");
    const funnelSuggestions = JSON.stringify(item.funnelSuggestions).replace(/'/g, "''");
    
    return `(
      '${item.keyword}',
      '${item.category || ''}',
      ${item.totalPosts},
      ${item.avgLikes},
      ${item.medianLikes},
      ${item.maxLikes},
      ${item.viralRate},
      ${item.optimalLengthMin || 200},
      ${item.optimalLengthMax || 400},
      '${viralFactors}',
      '${funnelSuggestions}',
      ${Math.round((item.stabilityScore || 0) * 10000)},
      ${Math.round((item.burstScore || 0) * 100)},
      'excel_import_2025Q1'
    )`;
  }).join(',\n');

  return `
-- 清空現有數據
DELETE FROM keyword_benchmarks;

-- 匯入新數據
INSERT INTO keyword_benchmarks (
  keyword, category, totalPosts, avgLikes, medianLikes, maxLikes,
  viralRate, optimalLengthMin, optimalLengthMax,
  viralFactors, funnelSuggestions, stabilityScore, burstScore, dataSource
) VALUES
${values};
`;
}

function generateHooksSQL(data) {
  // 只取前 50 個最有效的鉤子
  const topHooks = data.slice(0, 50);
  
  const values = topHooks.map(item => {
    const hookPattern = item.hookPattern.replace(/'/g, "''");
    
    return `(
      '${hookPattern}',
      '${item.hookType || 'extracted'}',
      ${item.avgLikes || 0},
      ${Math.round((item.avgLpd || 0) * 100)},
      ${item.sampleCount || 1},
      '${item.source || 'viral_analysis'}',
      1
    )`;
  }).join(',\n');

  return `
-- 清空現有數據
DELETE FROM content_hooks;

-- 匯入新數據
INSERT INTO content_hooks (
  hookPattern, hookType, avgLikes, viralRate, sampleCount, source, isActive
) VALUES
${values};
`;
}

// 輸出 SQL 檔案
const keywordSQL = generateKeywordSQL(keywordData);
const hooksSQL = generateHooksSQL(hooksData);

fs.writeFileSync(
  path.join(__dirname, '../drizzle/seed-keywords.sql'),
  keywordSQL
);

fs.writeFileSync(
  path.join(__dirname, '../drizzle/seed-hooks.sql'),
  hooksSQL
);

console.log('✅ SQL 檔案已生成:');
console.log('   - drizzle/seed-keywords.sql');
console.log('   - drizzle/seed-hooks.sql');
console.log('');
console.log(`📊 統計:`);
console.log(`   - 關鍵字數據: ${keywordData.length} 筆`);
console.log(`   - 鉤子數據: ${hooksData.length} 筆`);
console.log('');
console.log('🚀 爆文因子 Lift 分析:');
liftData.forEach(item => {
  const icon = item.lift > 0 ? '✅' : '❌';
  console.log(`   ${icon} ${item.feature}: ${item.impact}`);
});
