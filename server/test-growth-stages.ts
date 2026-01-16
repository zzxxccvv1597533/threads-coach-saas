/**
 * 四個成長階段文案差異測試腳本
 * 測試新手期、成長期、成熟期、專家級在文案生成上的差異
 */

import { 
  determineUserStage, 
  calculateAdaptiveThreshold, 
  STAGE_CONFIGS,
  type UserMetrics,
  type AdaptiveThresholdResult 
} from './services/adaptiveThreshold';
// buildAdaptiveFewShotContext 需要從 fewShotLearning 中建立
// 這裡使用簡化版本進行測試
import { invokeLLM } from './_core/llm';

// 四個成長階段的模擬資料
const testStages = {
  // 新手期：貼文少、互動低
  newbie: {
    name: '新手期',
    posts: [
      { content: '今天開始經營自媒體，希望能幫助更多人', likes: 15, comments: 3, shares: 0 },
      { content: '分享一個小技巧，希望對大家有幫助', likes: 25, comments: 5, shares: 1 },
      { content: '第一次嘗試寫長文，有點緊張', likes: 20, comments: 4, shares: 0 },
    ],
    expectedStage: 'newbie',
    expectedSystemWeight: 70,
    expectedUserWeight: 30,
  },
  
  // 成長期：貼文中等、互動中等
  growing: {
    name: '成長期',
    posts: [
      { content: '這個方法幫我省了很多時間', likes: 80, comments: 15, shares: 5 },
      { content: '分享我的創業心得', likes: 120, comments: 25, shares: 8 },
      { content: '三個步驟讓你提升效率', likes: 150, comments: 30, shares: 10 },
      { content: '我是怎麼從零開始的', likes: 100, comments: 20, shares: 6 },
      { content: '這件事改變了我的人生', likes: 200, comments: 40, shares: 15 },
    ],
    expectedStage: 'growing',
    expectedSystemWeight: 50,
    expectedUserWeight: 50,
  },
  
  // 成熟期：貼文多、互動高
  mature: {
    name: '成熟期',
    posts: [
      { content: '五年創業經驗總結', likes: 300, comments: 50, shares: 20 },
      { content: '這個觀點可能會顛覆你的認知', likes: 400, comments: 80, shares: 30 },
      { content: '我是怎麼做到月入百萬的', likes: 350, comments: 60, shares: 25 },
      { content: '給新手的十個建議', likes: 280, comments: 45, shares: 18 },
      { content: '這個錯誤我犯了三年', likes: 320, comments: 55, shares: 22 },
      { content: '成功的關鍵只有這一點', likes: 380, comments: 70, shares: 28 },
      { content: '為什麼大多數人做不到', likes: 420, comments: 85, shares: 35 },
      { content: '我的失敗經驗分享', likes: 290, comments: 48, shares: 19 },
      { content: '這個習慣讓我效率翻倍', likes: 340, comments: 58, shares: 24 },
      { content: '給自己的一封信', likes: 260, comments: 42, shares: 16 },
    ],
    expectedStage: 'mature',
    expectedSystemWeight: 30,
    expectedUserWeight: 70,
  },
  
  // 專家級：貼文多、有爆款
  expert: {
    name: '專家級',
    posts: [
      { content: '這篇文章改變了十萬人', likes: 1500, comments: 300, shares: 150 },
      { content: '我的方法論完整公開', likes: 800, comments: 150, shares: 80 },
      { content: '十年經驗濃縮成這一篇', likes: 1200, comments: 250, shares: 120 },
      { content: '這個秘密我藏了五年', likes: 900, comments: 180, shares: 90 },
      { content: '為什麼我能持續成功', likes: 700, comments: 140, shares: 70 },
      { content: '給年輕人的忠告', likes: 1100, comments: 220, shares: 110 },
      { content: '這個思維模式價值百萬', likes: 950, comments: 190, shares: 95 },
      { content: '我是怎麼突破瓶頸的', likes: 850, comments: 170, shares: 85 },
      { content: '成功者的共同特質', likes: 1000, comments: 200, shares: 100 },
      { content: '這個習慣讓我與眾不同', likes: 750, comments: 150, shares: 75 },
      { content: '我的人生轉捩點', likes: 1300, comments: 260, shares: 130 },
      { content: '給創業者的建議', likes: 880, comments: 176, shares: 88 },
      { content: '這個觀念改變了一切', likes: 1050, comments: 210, shares: 105 },
      { content: '我的失敗與成功', likes: 920, comments: 184, shares: 92 },
      { content: '為什麼堅持很重要', likes: 780, comments: 156, shares: 78 },
      { content: '這個方法我用了十年', likes: 1150, comments: 230, shares: 115 },
      { content: '給自己的承諾', likes: 680, comments: 136, shares: 68 },
      { content: '我的成長故事', likes: 1400, comments: 280, shares: 140 },
      { content: '這個決定改變了我', likes: 970, comments: 194, shares: 97 },
      { content: '給後輩的一封信', likes: 820, comments: 164, shares: 82 },
    ],
    expectedStage: 'expert',
    expectedSystemWeight: 10,
    expectedUserWeight: 90,
  },
};

// 計算貼文統計資料
function calculatePostStats(posts: Array<{ likes: number; comments: number; shares: number }>) {
  const engagements = posts.map(p => p.likes + p.comments + p.shares);
  const totalPosts = posts.length;
  const avgEngagement = engagements.reduce((a, b) => a + b, 0) / totalPosts;
  const maxEngagement = Math.max(...engagements);
  
  return { totalPosts, avgEngagement, maxEngagement, engagements };
}

// 測試主函數
async function runGrowthStageTests() {
  console.log('='.repeat(80));
  console.log('四個成長階段文案差異測試');
  console.log('='.repeat(80));
  console.log('');
  
  const results: Array<{
    stage: string;
    name: string;
    stats: { totalPosts: number; avgEngagement: number; maxEngagement: number };
    detectedStage: string;
    thresholdResult: AdaptiveThresholdResult;
    fewShotContext: string;
    generatedOpener: string;
  }> = [];
  
  for (const [stageKey, stageData] of Object.entries(testStages)) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`測試階段：${stageData.name}`);
    console.log(`${'─'.repeat(60)}`);
    
    // 1. 計算統計資料
    const stats = calculatePostStats(stageData.posts);
    console.log(`\n📊 統計資料：`);
    console.log(`   總貼文數：${stats.totalPosts}`);
    console.log(`   平均互動：${stats.avgEngagement.toFixed(0)}`);
    console.log(`   最高互動：${stats.maxEngagement}`);
    
    // 2. 建立 UserMetrics
    const metrics: UserMetrics = {
      totalPosts: stats.totalPosts,
      avgEngagement: stats.avgEngagement,
      maxEngagement: stats.maxEngagement,
    };
    
    // 3. 判斷成長階段
    const detectedStage = determineUserStage(metrics);
    console.log(`\n🎯 判定階段：${detectedStage}`);
    console.log(`   預期階段：${stageData.expectedStage}`);
    console.log(`   判定結果：${detectedStage === stageData.expectedStage ? '✅ 正確' : '❌ 不符'}`);
    
    // 4. 計算自適應門檻
    const thresholdResult = calculateAdaptiveThreshold(metrics, stats.engagements);
    console.log(`\n📏 自適應門檻：${thresholdResult.threshold}`);
    console.log(`   相對門檻：${thresholdResult.relativeThreshold}`);
    console.log(`   絕對門檻：${thresholdResult.absoluteThreshold}`);
    console.log(`   說明：${thresholdResult.reasoning}`);
    
    // 5. 獲取權重
    const stageConfig = STAGE_CONFIGS[detectedStage];
    console.log(`\n⚖️ 範例權重：`);
    console.log(`   系統範例：${(stageConfig.systemWeight * 100).toFixed(0)}%（預期：${stageData.expectedSystemWeight}%）`);
    console.log(`   用戶範例：${(stageConfig.userWeight * 100).toFixed(0)}%（預期：${stageData.expectedUserWeight}%）`);
    
    // 6. 建構 Few-Shot 上下文
    const userSamples = stageData.posts.map((p, i) => ({
      id: i + 1,
      content: p.content,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      engagement: p.likes + p.comments + p.shares,
    }));
    
    const systemExamples = [
      { content: '月收六十萬的那天，我卻哭了。', likes: 2500, tier: 'S' },
      { content: '「你不適合創業」這句話我聽了三年。', likes: 1800, tier: 'A' },
      { content: '我用三個月，把負債變成資產。', likes: 1500, tier: 'A' },
    ];
    
    // 建構簡化版 Few-Shot 上下文
    const qualifiedUserSamples = userSamples.filter(s => s.engagement >= thresholdResult.threshold);
    const userExampleCount = Math.ceil(qualifiedUserSamples.length * stageConfig.userWeight);
    const systemExampleCount = Math.ceil(systemExamples.length * stageConfig.systemWeight);
    
    let fewShotContext = `【範例權重】系統 ${(stageConfig.systemWeight * 100).toFixed(0)}% / 用戶 ${(stageConfig.userWeight * 100).toFixed(0)}%\n\n`;
    
    if (systemExampleCount > 0) {
      fewShotContext += `【系統爆款範例】\n`;
      systemExamples.slice(0, systemExampleCount).forEach((ex, i) => {
        fewShotContext += `${i + 1}. ${ex.content}（${ex.likes} 讚，${ex.tier} 級）\n`;
      });
      fewShotContext += `\n`;
    }
    
    if (userExampleCount > 0 && qualifiedUserSamples.length > 0) {
      fewShotContext += `【用戶高品質範例】（門檻：${thresholdResult.threshold} 互動）\n`;
      qualifiedUserSamples.slice(0, userExampleCount).forEach((ex, i) => {
        fewShotContext += `${i + 1}. ${ex.content}（${ex.engagement} 互動）\n`;
      });
    } else {
      fewShotContext += `【用戶範例】無符合門檻的範例\n`;
    }
    console.log(`\n📝 Few-Shot 上下文長度：${fewShotContext.length} 字`);
    
    // 7. 生成開頭（使用 LLM）
    console.log(`\n🤖 生成開頭中...`);
    
    const prompt = `你是一位 Threads 爆款文案專家。請根據以下用戶的成長階段和風格，生成一個適合的開頭。

用戶成長階段：${stageData.name}
用戶特徵：
- 總貼文數：${stats.totalPosts}
- 平均互動：${stats.avgEngagement.toFixed(0)}
- 最高互動：${stats.maxEngagement}

${fewShotContext}

主題：創業初期的自我懷疑

請生成一個符合用戶風格的開頭（30字以內），不要加任何解釋。`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: '你是一位 Threads 爆款文案專家，擅長根據用戶的成長階段調整文案風格。' },
          { role: 'user', content: prompt },
        ],
      });
      
      const generatedOpener = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content.trim()
        : '';
      
      console.log(`   生成結果：${generatedOpener}`);
      
      results.push({
        stage: stageKey,
        name: stageData.name,
        stats,
        detectedStage,
        thresholdResult,
        fewShotContext,
        generatedOpener,
      });
    } catch (error) {
      console.log(`   生成失敗：${error}`);
      results.push({
        stage: stageKey,
        name: stageData.name,
        stats,
        detectedStage,
        thresholdResult,
        fewShotContext,
        generatedOpener: '生成失敗',
      });
    }
  }
  
  // 輸出總結報告
  console.log('\n');
  console.log('='.repeat(80));
  console.log('測試結果總結');
  console.log('='.repeat(80));
  
  console.log('\n| 階段 | 總貼文 | 平均互動 | 最高互動 | 判定階段 | 門檻 | 系統% | 用戶% |');
  console.log('|------|--------|----------|----------|----------|------|-------|-------|');
  
  for (const r of results) {
    const stageConfig = STAGE_CONFIGS[r.detectedStage as keyof typeof STAGE_CONFIGS];
    console.log(`| ${r.name} | ${r.stats.totalPosts} | ${r.stats.avgEngagement.toFixed(0)} | ${r.stats.maxEngagement} | ${r.detectedStage} | ${r.thresholdResult.threshold} | ${(stageConfig.systemWeight * 100).toFixed(0)}% | ${(stageConfig.userWeight * 100).toFixed(0)}% |`);
  }
  
  console.log('\n生成的開頭對比：');
  console.log('─'.repeat(60));
  for (const r of results) {
    console.log(`${r.name}：${r.generatedOpener}`);
  }
  
  return results;
}

// 執行測試
runGrowthStageTests()
  .then((results) => {
    console.log('\n✅ 測試完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 測試失敗：', error);
    process.exit(1);
  });
