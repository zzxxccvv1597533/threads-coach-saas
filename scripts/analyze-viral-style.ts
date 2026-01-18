/**
 * 爆款語言風格分析腳本
 * 驗證優化方向是否符合市場
 */

import { getDb } from '../server/db';
import { viralExamples } from '../drizzle/schema';
import { sql } from 'drizzle-orm';

// 語氣詞清單
const TONE_WORDS = {
  casual: ['欸', '啊', '吧', '呢', '喔', '嘛', '啦', '耶', '哦', '嗯', '唉', '哎', '欸'],
  emotion: ['救命', '天啊', '笑死', '傻眼', '崩潰', '哭', '嗚嗚', '吐血', '暈', '昏'],
  colloquial: ['真的', '超', '很', '好', '太', '根本', '完全', '整個', '直接', '馬上'],
  filler: ['其實', '就是', '然後', '所以', '不過', '但是', '可是', '而且', '因為'],
};

// 教學語氣詞彙
const TEACHING_WORDS = [
  '首先', '其次', '最後', '第一', '第二', '第三',
  '總結', '結論', '重點', '關鍵', '核心',
  '讓我們', '一起', '分享', '教你', '告訴你',
  '必須', '應該', '需要', '要', '得',
];

// 行銷術語
const MARKETING_WORDS = [
  '變現', '流量', '轉化', '漏斗', '痛點', '賦能',
  '賽道', '打法', '抓手', '閉環', '矩陣', '私域',
  '引流', '種草', '拔草', '爆款', '破圈',
];

// 書面情緒詞
const FORMAL_EMOTION_WORDS = [
  '心裡一沉', '不禁', '深感', '頗為', '甚為',
  '令人', '使人', '讓人感到', '不由得', '情不自禁',
];

// 刻意比喻詞
const METAPHOR_PATTERNS = [
  '就像', '如同', '彷彿', '宛如', '好比', '猶如',
  '是...的...', '不是...而是...',
];

// 結構標記
const STRUCTURE_MARKERS = {
  hook: ['你知道嗎', '說真的', '我發現', '有一天', '昨天', '今天', '剛剛'],
  cta: ['你覺得呢', '你說呢', '你們說', '留言告訴我', '你也是嗎', '有沒有人'],
  question: ['？', '?'],
};

interface AnalysisResult {
  totalPosts: number;
  avgLength: number;
  toneWordStats: Record<string, { count: number; avgPerPost: number; postsWithWord: number }>;
  teachingWordStats: { count: number; avgPerPost: number; postsWithWord: number };
  marketingWordStats: { count: number; avgPerPost: number; postsWithWord: number };
  formalEmotionStats: { count: number; avgPerPost: number; postsWithWord: number };
  metaphorStats: { count: number; avgPerPost: number; postsWithWord: number };
  structureStats: {
    hasHook: number;
    hasCta: number;
    hasQuestion: number;
    avgParagraphs: number;
    avgSentenceLength: number;
  };
  topToneWords: { word: string; count: number }[];
  samplePosts: { content: string; likes: number; features: string[] }[];
}

async function analyzeViralStyle(): Promise<AnalysisResult> {
  console.log('開始分析爆款語言風格...\n');

  // 取得所有爆款文章
  const db = await getDb();
  if (!db) throw new Error('資料庫連接失敗');
  const posts = await db.select().from(viralExamples);
  console.log(`共有 ${posts.length} 篇爆款文章\n`);

  const result: AnalysisResult = {
    totalPosts: posts.length,
    avgLength: 0,
    toneWordStats: {},
    teachingWordStats: { count: 0, avgPerPost: 0, postsWithWord: 0 },
    marketingWordStats: { count: 0, avgPerPost: 0, postsWithWord: 0 },
    formalEmotionStats: { count: 0, avgPerPost: 0, postsWithWord: 0 },
    metaphorStats: { count: 0, avgPerPost: 0, postsWithWord: 0 },
    structureStats: {
      hasHook: 0,
      hasCta: 0,
      hasQuestion: 0,
      avgParagraphs: 0,
      avgSentenceLength: 0,
    },
    topToneWords: [],
    samplePosts: [],
  };

  // 語氣詞統計
  const toneWordCounts: Record<string, number> = {};
  const toneWordPosts: Record<string, Set<number>> = {};

  let totalLength = 0;
  let totalTeachingWords = 0;
  let postsWithTeaching = 0;
  let totalMarketingWords = 0;
  let postsWithMarketing = 0;
  let totalFormalEmotion = 0;
  let postsWithFormalEmotion = 0;
  let totalMetaphor = 0;
  let postsWithMetaphor = 0;
  let totalParagraphs = 0;
  let totalSentences = 0;
  let totalSentenceLength = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const content = post.postText || '';
    totalLength += content.length;

    // 語氣詞分析
    for (const [category, words] of Object.entries(TONE_WORDS)) {
      for (const word of words) {
        const regex = new RegExp(word, 'g');
        const matches = content.match(regex);
        if (matches) {
          toneWordCounts[word] = (toneWordCounts[word] || 0) + matches.length;
          if (!toneWordPosts[word]) toneWordPosts[word] = new Set();
          toneWordPosts[word].add(i);
        }
      }
    }

    // 教學語氣分析
    let teachingCount = 0;
    for (const word of TEACHING_WORDS) {
      const regex = new RegExp(word, 'g');
      const matches = content.match(regex);
      if (matches) teachingCount += matches.length;
    }
    totalTeachingWords += teachingCount;
    if (teachingCount > 0) postsWithTeaching++;

    // 行銷術語分析
    let marketingCount = 0;
    for (const word of MARKETING_WORDS) {
      const regex = new RegExp(word, 'g');
      const matches = content.match(regex);
      if (matches) marketingCount += matches.length;
    }
    totalMarketingWords += marketingCount;
    if (marketingCount > 0) postsWithMarketing++;

    // 書面情緒詞分析
    let formalEmotionCount = 0;
    for (const word of FORMAL_EMOTION_WORDS) {
      const regex = new RegExp(word, 'g');
      const matches = content.match(regex);
      if (matches) formalEmotionCount += matches.length;
    }
    totalFormalEmotion += formalEmotionCount;
    if (formalEmotionCount > 0) postsWithFormalEmotion++;

    // 刻意比喻分析
    let metaphorCount = 0;
    for (const pattern of METAPHOR_PATTERNS) {
      const regex = new RegExp(pattern, 'g');
      const matches = content.match(regex);
      if (matches) metaphorCount += matches.length;
    }
    totalMetaphor += metaphorCount;
    if (metaphorCount > 0) postsWithMetaphor++;

    // 結構分析
    const hasHook = STRUCTURE_MARKERS.hook.some(h => content.startsWith(h) || content.slice(0, 50).includes(h));
    const hasCta = STRUCTURE_MARKERS.cta.some(c => content.slice(-100).includes(c));
    const hasQuestion = content.includes('？') || content.includes('?');
    
    if (hasHook) result.structureStats.hasHook++;
    if (hasCta) result.structureStats.hasCta++;
    if (hasQuestion) result.structureStats.hasQuestion++;

    // 段落和句子分析
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    totalParagraphs += paragraphs.length;

    const sentences = content.split(/[。！？\n]+/).filter(s => s.trim());
    totalSentences += sentences.length;
    for (const sentence of sentences) {
      totalSentenceLength += sentence.length;
    }
  }

  // 計算統計結果
  result.avgLength = Math.round(totalLength / posts.length);
  
  result.teachingWordStats = {
    count: totalTeachingWords,
    avgPerPost: Math.round((totalTeachingWords / posts.length) * 100) / 100,
    postsWithWord: postsWithTeaching,
  };

  result.marketingWordStats = {
    count: totalMarketingWords,
    avgPerPost: Math.round((totalMarketingWords / posts.length) * 100) / 100,
    postsWithWord: postsWithMarketing,
  };

  result.formalEmotionStats = {
    count: totalFormalEmotion,
    avgPerPost: Math.round((totalFormalEmotion / posts.length) * 100) / 100,
    postsWithWord: postsWithFormalEmotion,
  };

  result.metaphorStats = {
    count: totalMetaphor,
    avgPerPost: Math.round((totalMetaphor / posts.length) * 100) / 100,
    postsWithWord: postsWithMetaphor,
  };

  result.structureStats.avgParagraphs = Math.round((totalParagraphs / posts.length) * 100) / 100;
  result.structureStats.avgSentenceLength = Math.round(totalSentenceLength / totalSentences);

  // 語氣詞排名
  result.topToneWords = Object.entries(toneWordCounts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // 找出最具代表性的爆款（高讚數 + 口語化特徵多）
  const postsWithFeatures = posts.map((post, i) => {
    const content = post.postText || '';
    const features: string[] = [];
    
    // 檢查口語化特徵
    let casualCount = 0;
    for (const word of TONE_WORDS.casual) {
      if (content.includes(word)) {
        casualCount++;
        features.push(`語氣詞:${word}`);
      }
    }
    
    for (const word of TONE_WORDS.emotion) {
      if (content.includes(word)) {
        features.push(`情緒詞:${word}`);
      }
    }

    // 檢查是否有問句
    if (content.includes('？') || content.includes('?')) {
      features.push('有問句');
    }

    // 檢查是否有省略號
    if (content.includes('...') || content.includes('⋯')) {
      features.push('有省略號');
    }

    return {
      content: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
      likes: post.likes || 0,
      features,
      featureCount: features.length,
    };
  });

  // 選出最具代表性的 10 篇
  result.samplePosts = postsWithFeatures
    .filter(p => p.featureCount >= 3)
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 10);

  return result;
}

async function main() {
  try {
    const result = await analyzeViralStyle();

    console.log('='.repeat(60));
    console.log('爆款語言風格分析報告');
    console.log('='.repeat(60));
    
    console.log(`\n📊 基本統計`);
    console.log(`總文章數：${result.totalPosts} 篇`);
    console.log(`平均字數：${result.avgLength} 字`);
    console.log(`平均段落數：${result.structureStats.avgParagraphs} 段`);
    console.log(`平均句子長度：${result.structureStats.avgSentenceLength} 字`);

    console.log(`\n📝 結構特徵`);
    console.log(`有 Hook 開頭：${result.structureStats.hasHook} 篇 (${Math.round(result.structureStats.hasHook / result.totalPosts * 100)}%)`);
    console.log(`有 CTA 結尾：${result.structureStats.hasCta} 篇 (${Math.round(result.structureStats.hasCta / result.totalPosts * 100)}%)`);
    console.log(`有問句：${result.structureStats.hasQuestion} 篇 (${Math.round(result.structureStats.hasQuestion / result.totalPosts * 100)}%)`);

    console.log(`\n🗣️ 語氣詞使用 Top 30`);
    for (const { word, count } of result.topToneWords) {
      console.log(`  ${word}: ${count} 次`);
    }

    console.log(`\n⚠️ 教學語氣詞`);
    console.log(`總出現次數：${result.teachingWordStats.count} 次`);
    console.log(`平均每篇：${result.teachingWordStats.avgPerPost} 次`);
    console.log(`有使用的文章：${result.teachingWordStats.postsWithWord} 篇 (${Math.round(result.teachingWordStats.postsWithWord / result.totalPosts * 100)}%)`);

    console.log(`\n⚠️ 行銷術語`);
    console.log(`總出現次數：${result.marketingWordStats.count} 次`);
    console.log(`平均每篇：${result.marketingWordStats.avgPerPost} 次`);
    console.log(`有使用的文章：${result.marketingWordStats.postsWithWord} 篇 (${Math.round(result.marketingWordStats.postsWithWord / result.totalPosts * 100)}%)`);

    console.log(`\n⚠️ 書面情緒詞`);
    console.log(`總出現次數：${result.formalEmotionStats.count} 次`);
    console.log(`平均每篇：${result.formalEmotionStats.avgPerPost} 次`);
    console.log(`有使用的文章：${result.formalEmotionStats.postsWithWord} 篇 (${Math.round(result.formalEmotionStats.postsWithWord / result.totalPosts * 100)}%)`);

    console.log(`\n⚠️ 刻意比喻`);
    console.log(`總出現次數：${result.metaphorStats.count} 次`);
    console.log(`平均每篇：${result.metaphorStats.avgPerPost} 次`);
    console.log(`有使用的文章：${result.metaphorStats.postsWithWord} 篇 (${Math.round(result.metaphorStats.postsWithWord / result.totalPosts * 100)}%)`);

    console.log(`\n🌟 代表性爆款範例（高讚數 + 口語化特徵多）`);
    for (let i = 0; i < result.samplePosts.length; i++) {
      const post = result.samplePosts[i];
      console.log(`\n--- 範例 ${i + 1} (讚數: ${post.likes}) ---`);
      console.log(`特徵: ${post.features.join(', ')}`);
      console.log(`內容: ${post.content}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('分析完成');
    console.log('='.repeat(60));

    // 輸出 JSON 結果
    const fs = await import('fs');
    fs.writeFileSync(
      '/home/ubuntu/threads-coach-saas/docs/viral-style-analysis.json',
      JSON.stringify(result, null, 2)
    );
    console.log('\n結果已保存到 docs/viral-style-analysis.json');

  } catch (error) {
    console.error('分析失敗:', error);
    process.exit(1);
  }
}

main();
