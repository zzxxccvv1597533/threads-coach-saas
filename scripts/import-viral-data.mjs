/**
 * 匯入爆款數據優化系統的所有數據
 * - Top200 爆款貼文
 * - Top20_by_Keyword (1040 筆)
 * - 選題模板庫 (48 筆)
 * - 內容群集 (8 筆)
 * - 群集漏斗分布
 */

import 'dotenv/config';
import XLSX from 'xlsx';
import mysql from 'mysql2/promise';

const EXCEL_FILE = '/home/ubuntu/upload/2_爆款分析儀表板_7大成果物_Part1(1).xlsx';

// Excel 日期轉換函數
function parseExcelDate(value) {
  if (!value) return null;
  
  // 如果是 Excel 序列號（數字）
  if (typeof value === 'number') {
    // Excel 日期序列號轉換（從 1900-01-01 開始）
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    // 確保日期在有效範圍內
    if (date.getFullYear() < 2000 || date.getFullYear() > 2030) {
      return null;
    }
    return date;
  }
  
  // 如果是字串
  if (typeof value === 'string') {
    const date = new Date(value);
    if (isNaN(date.getTime()) || date.getFullYear() < 2000 || date.getFullYear() > 2030) {
      return null;
    }
    return date;
  }
  
  return null;
}

// 資料庫連線 - 使用 DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('錯誤: DATABASE_URL 環境變數未設定');
  process.exit(1);
}

const pool = mysql.createPool({
  uri: DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
});

async function importViralExamples() {
  console.log('\\n=== 匯入爆款貼文範例 ===');
  
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  // 1. 匯入 Top200
  console.log('匯入 Top200 爆款貼文...');
  const top200Sheet = workbook.Sheets['4_Top貼文素材庫_Top200'];
  const top200Data = XLSX.utils.sheet_to_json(top200Sheet);
  
  let top200Count = 0;
  for (const row of top200Data) {
    try {
      await pool.execute(`
        INSERT INTO viral_examples 
        (keyword, postText, likes, likesPerDay, postDate, account, threadUrl, 
         funnelStage, opener50, charLen,
         hasNumber, questionMark, exclaimMark, youFlag, iFlag, ctaFlag, 
         timePressureFlag, resultFlag, turnFlag, isTop200, isTop20, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        row.keyword || '',
        row.post_text || '',
        row.likes || 0,
        row.likes_per_day || 0,
        parseExcelDate(row.post_date),
        row.account || '',
        row['Thread URL'] || '',
        row.funnel_stage || '',
        row.opener_50 || '',
        row.char_len || 0,
        row.has_number === 1,
        row.question_mark === 1,
        row.exclaim_mark === 1,
        row.you_flag === 1,
        row.i_flag === 1,
        row.cta_flag === 1,
        row.time_pressure_flag === 1,
        row.result_flag === 1,
        row.turn_flag === 1,
        true, // isTop200
        false, // isTop20
        'excel_top200'
      ]);
      top200Count++;
    } catch (err) {
      console.error('Top200 匯入錯誤:', err.message);
    }
  }
  console.log(`Top200 匯入完成: ${top200Count} 筆`);
  
  // 2. 匯入 Top20_by_Keyword
  console.log('\\n匯入 Top20_by_Keyword...');
  const top20Sheet = workbook.Sheets['5_Top20_by_Keyword'];
  const top20Data = XLSX.utils.sheet_to_json(top20Sheet);
  
  let top20Count = 0;
  for (const row of top20Data) {
    try {
      // 檢查是否已存在（避免與 Top200 重複）
      const [existing] = await pool.execute(
        'SELECT id FROM viral_examples WHERE postText = ? LIMIT 1',
        [row.post_text || '']
      );
      
      if (existing.length === 0) {
        await pool.execute(`
          INSERT INTO viral_examples 
          (keyword, postText, likes, likesPerDay, postDate, account, threadUrl, 
           funnelStage, cluster, charLen,
           hasNumber, questionMark, exclaimMark, youFlag, iFlag, ctaFlag, 
           timePressureFlag, resultFlag, turnFlag, isTop200, isTop20, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          row.keyword || '',
          row.post_text || '',
          row.likes || 0,
          row.likes_per_day || 0,
          parseExcelDate(row.post_date),
          row.account || '',
          row['Thread URL'] || '',
          row.funnel_stage || '',
          row.cluster || null,
          row.char_len || 0,
          row.has_number === 1,
          row.question_mark === 1,
          row.exclaim_mark === 1,
          row.you_flag === 1,
          row.i_flag === 1,
          row.cta_flag === 1,
          row.time_pressure_flag === 1,
          row.result_flag === 1,
          row.turn_flag === 1,
          false, // isTop200
          true, // isTop20
          'excel_top20'
        ]);
        top20Count++;
      }
    } catch (err) {
      console.error('Top20 匯入錯誤:', err.message);
    }
  }
  console.log(`Top20_by_Keyword 匯入完成: ${top20Count} 筆（排除重複）`);
  
  return { top200Count, top20Count };
}

async function importTopicTemplates() {
  console.log('\\n=== 匯入選題模板庫 ===');
  
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheet = workbook.Sheets['9_選題庫_Cluster模板'];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  // 先清空舊數據
  await pool.execute('DELETE FROM topic_templates WHERE source = ?', ['excel_import']);
  
  let count = 0;
  for (const row of data) {
    try {
      await pool.execute(`
        INSERT INTO topic_templates (cluster, theme, template, source)
        VALUES (?, ?, ?, ?)
      `, [
        row.cluster || null,
        row.theme || '',
        row.idea || '',
        'excel_import'
      ]);
      count++;
    } catch (err) {
      console.error('選題模板匯入錯誤:', err.message);
    }
  }
  
  console.log(`選題模板匯入完成: ${count} 筆`);
  return count;
}

async function importContentClusters() {
  console.log('\\n=== 匯入內容群集 ===');
  
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  // 讀取群集基本資料
  const clusterSheet = workbook.Sheets['6_ContentMap_Clusters'];
  const clusterData = XLSX.utils.sheet_to_json(clusterSheet);
  
  // 讀取群集漏斗分布
  const funnelSheet = workbook.Sheets['6B_Cluster_Funnel'];
  const funnelData = XLSX.utils.sheet_to_json(funnelSheet);
  
  // 建立漏斗分布 Map
  const funnelMap = {};
  for (const row of funnelData) {
    funnelMap[row.cluster] = {
      tofuShare: row.TOFU_share || 0,
      mofuShare: row.MOFU_share || 0,
      bofuShare: row.BOFU_share || 0,
    };
  }
  
  // 先清空舊數據
  await pool.execute('DELETE FROM content_clusters WHERE source = ?', ['excel_import']);
  
  let count = 0;
  for (const row of clusterData) {
    const funnel = funnelMap[row.cluster] || {};
    try {
      await pool.execute(`
        INSERT INTO content_clusters 
        (clusterId, themeKeywords, postsCount, top10Rate, medianLikes, medianLpd, topTerms,
         tofuShare, mofuShare, bofuShare, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        row.cluster,
        row.cluster_theme_keywords || '',
        row.posts || 0,
        row.top10_rate || 0,
        row.median_likes || 0,
        row.median_lpd || 0,
        row.top_terms || '',
        funnel.tofuShare || 0,
        funnel.mofuShare || 0,
        funnel.bofuShare || 0,
        'excel_import'
      ]);
      count++;
    } catch (err) {
      console.error('群集匯入錯誤:', err.message);
    }
  }
  
  console.log(`內容群集匯入完成: ${count} 筆`);
  return count;
}

async function main() {
  console.log('開始匯入爆款數據優化系統數據...');
  console.log('Excel 檔案:', EXCEL_FILE);
  
  try {
    // 測試連線
    const [rows] = await pool.execute('SELECT 1');
    console.log('資料庫連線成功');
    
    // 匯入各類數據
    const viralResult = await importViralExamples();
    const templateCount = await importTopicTemplates();
    const clusterCount = await importContentClusters();
    
    // 統計結果
    console.log('\\n========================================');
    console.log('匯入完成！統計結果：');
    console.log(`- Top200 爆款貼文: ${viralResult.top200Count} 筆`);
    console.log(`- Top20_by_Keyword: ${viralResult.top20Count} 筆`);
    console.log(`- 選題模板: ${templateCount} 筆`);
    console.log(`- 內容群集: ${clusterCount} 筆`);
    console.log('========================================');
    
    // 驗證
    const [viralCount] = await pool.execute('SELECT COUNT(*) as count FROM viral_examples');
    const [topicCount] = await pool.execute('SELECT COUNT(*) as count FROM topic_templates');
    const [clusterCountDb] = await pool.execute('SELECT COUNT(*) as count FROM content_clusters');
    
    console.log('\\n資料庫驗證：');
    console.log(`- viral_examples: ${viralCount[0].count} 筆`);
    console.log(`- topic_templates: ${topicCount[0].count} 筆`);
    console.log(`- content_clusters: ${clusterCountDb[0].count} 筆`);
    
  } catch (err) {
    console.error('匯入失敗:', err);
  } finally {
    await pool.end();
  }
}

main();
