/**
 * 完整四階段測試腳本（含語言風格和爆款文案）
 * 
 * 測試目標：驗證不同互動數的用戶在讀取語言風格和爆款文案的情況下，
 * 生成的貼文是否會有所不同
 */

import { invokeLLM } from './_core/llm';
import { 
  determineUserStage, 
  calculateAdaptiveThreshold, 
  calculateExampleCounts,
  STAGE_CONFIGS,
  type UserMetrics,
} from './services/adaptiveThreshold';

// ============================================
// 模擬的語言風格設定（所有階段共用）
// ============================================
const sharedLanguageStyle = {
  toneStyle: '溫暖療癒、直接有力',
  commonPhrases: ['其實', '說真的', '你有沒有發現'],
  catchphrases: ['這就是人生啊', '慢慢來比較快'],
  hookStylePreference: 'mirror',
  metaphorStyle: '生活化比喻',
  emotionRhythm: '先低後高',
  viralElements: {
    identityTags: ['創業者', '自媒體經營者', '斜槓青年'],
    emotionWords: ['超', '居然', '真的', '太', '好想'],
    ctaStyles: ['留言告訴我', '你也是這樣嗎', '分享給需要的人'],
  },
};

// ============================================
// 模擬的爆款文案範例（所有階段共用）
// ============================================
const sharedViralExamples = [
  {
    content: '「你不適合創業」這句話，我聽了三年。\n\n三年前，我辭掉月薪八萬的工作，所有人都說我瘋了。\n\n現在回頭看，那些說我瘋了的人，還在原地抱怨薪水太低。\n\n不是我比較厲害，是我比較願意承受不確定性。',
    likes: 2500,
    comments: 180,
    shares: 95,
  },
  {
    content: '創業第一年，我每天工作16小時，月收入只有3萬。\n\n第二年，我學會了說「不」，月收入變成30萬。\n\n差別在哪？\n\n我不再什麼都想做，而是專注做好一件事。',
    likes: 1800,
    comments: 120,
    shares: 65,
  },
  {
    content: '昨天有人問我：「你怎麼總是這麼有動力？」\n\n我說：「因為我每天都會想起那個在便利商店哭的自己。」\n\n那時候戶頭只剩387塊，連一碗泡麵都要猶豫。\n\n現在的我，不是為了成功而努力，是為了不再回到那個時刻。',
    likes: 3200,
    comments: 250,
    shares: 130,
  },
];

// ============================================
// 四個成長階段的模擬資料（不同互動數）
// ============================================
const testStages = {
  // 新手期：貼文少、互動低
  newbie: {
    name: '新手期',
    samplePosts: [
      { content: '今天開始經營自媒體，希望能幫助更多人', likes: 15, comments: 3, shares: 0 },
      { content: '分享一個小技巧，希望對大家有幫助', likes: 25, comments: 5, shares: 1 },
      { content: '第一次嘗試寫長文，有點緊張', likes: 20, comments: 4, shares: 0 },
    ],
    expectedStage: 'newbie',
  },
  
  // 成長期：貼文中等、互動中等
  growing: {
    name: '成長期',
    samplePosts: [
      { content: '這個方法幫我省了很多時間，分享給大家', likes: 80, comments: 15, shares: 5 },
      { content: '分享我的創業心得，希望對你有幫助', likes: 120, comments: 25, shares: 8 },
      { content: '三個步驟讓你提升效率，我自己試過超有效', likes: 150, comments: 30, shares: 10 },
      { content: '我是怎麼從零開始的，這段路真的不容易', likes: 100, comments: 20, shares: 6 },
      { content: '這件事改變了我的人生，想分享給你們', likes: 200, comments: 40, shares: 15 },
    ],
    expectedStage: 'growing',
  },
  
  // 成熟期：貼文多、互動高
  mature: {
    name: '成熟期',
    samplePosts: [
      { content: '五年創業經驗總結，這些坑我都踩過', likes: 300, comments: 50, shares: 20 },
      { content: '這個觀點可能會顛覆你的認知，但我必須說', likes: 400, comments: 80, shares: 30 },
      { content: '我是怎麼做到月入百萬的，不是靠運氣', likes: 350, comments: 60, shares: 25 },
      { content: '給新手的十個建議，每一個都是血淚教訓', likes: 280, comments: 45, shares: 18 },
      { content: '這個錯誤我犯了三年，希望你不要重蹈覆轍', likes: 320, comments: 55, shares: 22 },
      { content: '成功的關鍵只有這一點，其他都是假的', likes: 380, comments: 70, shares: 28 },
      { content: '為什麼大多數人做不到，因為他們不願意', likes: 420, comments: 85, shares: 35 },
      { content: '我的失敗經驗分享，這些錢都是學費', likes: 290, comments: 48, shares: 19 },
      { content: '這個習慣讓我效率翻倍，你也可以試試', likes: 340, comments: 58, shares: 24 },
      { content: '給自己的一封信，寫給三年前的我', likes: 260, comments: 42, shares: 16 },
    ],
    expectedStage: 'mature',
  },
  
  // 專家級：貼文多、有爆款
  expert: {
    name: '專家級',
    samplePosts: [
      { content: '這篇文章改變了十萬人的想法，我很榮幸', likes: 1500, comments: 300, shares: 150 },
      { content: '我的方法論完整公開，不藏私', likes: 800, comments: 150, shares: 80 },
      { content: '十年經驗濃縮成這一篇，價值百萬', likes: 1200, comments: 250, shares: 120 },
      { content: '這個秘密我藏了五年，今天決定公開', likes: 900, comments: 180, shares: 90 },
      { content: '為什麼我能持續成功，因為我從不停止學習', likes: 700, comments: 140, shares: 70 },
      { content: '給年輕人的忠告，這是我最想說的話', likes: 1100, comments: 220, shares: 110 },
      { content: '這個思維模式價值百萬，免費送給你', likes: 950, comments: 190, shares: 95 },
      { content: '我是怎麼突破瓶頸的，這個方法超有效', likes: 850, comments: 170, shares: 85 },
      { content: '成功者的共同特質，我觀察了十年', likes: 1000, comments: 200, shares: 100 },
      { content: '這個習慣讓我與眾不同，你也可以', likes: 750, comments: 150, shares: 75 },
      { content: '我的人生轉捩點，那一天改變了一切', likes: 1300, comments: 260, shares: 130 },
      { content: '給創業者的建議，這些話我只說一次', likes: 880, comments: 176, shares: 88 },
      { content: '這個觀念改變了一切，希望你也能理解', likes: 1050, comments: 210, shares: 105 },
      { content: '我的失敗與成功，都是寶貴的經驗', likes: 920, comments: 184, shares: 92 },
      { content: '為什麼堅持很重要，因為放棄太容易了', likes: 780, comments: 156, shares: 78 },
      { content: '這個方法我用了十年，從未失敗過', likes: 1150, comments: 230, shares: 115 },
      { content: '給自己的承諾，我會一直走下去', likes: 680, comments: 136, shares: 68 },
      { content: '我的成長故事，從零到一的過程', likes: 1400, comments: 280, shares: 140 },
      { content: '這個決定改變了我，也希望能改變你', likes: 970, comments: 194, shares: 97 },
      { content: '給後輩的一封信，這是我最真誠的話', likes: 820, comments: 164, shares: 82 },
    ],
    expectedStage: 'expert',
  },
};

// ============================================
// 計算貼文統計資料
// ============================================
function calculatePostStats(posts: Array<{ likes: number; comments: number; shares: number }>) {
  const engagements = posts.map(p => p.likes + p.comments + p.shares);
  const totalPosts = posts.length;
  const avgEngagement = engagements.reduce((a, b) => a + b, 0) / totalPosts;
  const maxEngagement = Math.max(...engagements);
  
  return { totalPosts, avgEngagement, maxEngagement, engagements };
}

// ============================================
// 建立完整的 Prompt（包含語言風格和爆款文案）
// ============================================
function buildFullPrompt(
  stage: string,
  stageName: string,
  systemWeight: number,
  userWeight: number,
  languageStyle: typeof sharedLanguageStyle,
  viralExamples: typeof sharedViralExamples,
  userSamplePosts: Array<{ content: string; likes: number; comments: number; shares: number }>,
  topic: string
): string {
  // 根據權重選擇範例
  const systemExampleCount = Math.round((systemWeight / 100) * 3);
  const userExampleCount = Math.round((userWeight / 100) * 3);
  
  // 選擇系統爆款範例
  const selectedSystemExamples = viralExamples.slice(0, systemExampleCount);
  
  // 選擇用戶樣本（按互動數排序，取最高的）
  const sortedUserPosts = [...userSamplePosts]
    .sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))
    .slice(0, userExampleCount);
  
  // 建立 Prompt
  let prompt = `你是一位專業的 Threads 內容創作教練。

## 用戶成長階段
- 階段：${stageName}（${stage}）
- 系統範例權重：${systemWeight}%
- 用戶範例權重：${userWeight}%

## 用戶語言風格
- 語氣風格：${languageStyle.toneStyle}
- 常用語：${languageStyle.commonPhrases.join('、')}
- 口頭禪：${languageStyle.catchphrases.join('、')}
- 開頭偏好：${languageStyle.hookStylePreference}
- 比喻風格：${languageStyle.metaphorStyle}
- 情緒節奏：${languageStyle.emotionRhythm}
- 身份標籤：${languageStyle.viralElements.identityTags.join('、')}
- 情緒詞：${languageStyle.viralElements.emotionWords.join('、')}
- CTA 風格：${languageStyle.viralElements.ctaStyles.join('、')}

`;

  // 加入系統爆款範例
  if (selectedSystemExamples.length > 0) {
    prompt += `## 系統爆款範例（權重 ${systemWeight}%）\n`;
    selectedSystemExamples.forEach((ex, i) => {
      prompt += `\n### 範例 ${i + 1}（讚 ${ex.likes}）\n${ex.content}\n`;
    });
    prompt += '\n';
  }
  
  // 加入用戶樣本
  if (sortedUserPosts.length > 0) {
    prompt += `## 用戶個人範例（權重 ${userWeight}%）\n`;
    sortedUserPosts.forEach((post, i) => {
      const engagement = post.likes + post.comments + post.shares;
      prompt += `\n### 範例 ${i + 1}（互動 ${engagement}）\n${post.content}\n`;
    });
    prompt += '\n';
  }
  
  prompt += `## 任務
請根據以上風格和範例，為主題「${topic}」生成一個吸引人的開頭（約 30-50 字）。

要求：
1. 符合用戶的語言風格
2. 參考範例的成功模式
3. 根據用戶階段調整風格：
   - 新手期：較為探索性、謙虛
   - 成長期：有經驗分享、實用
   - 成熟期：有深度、有洞察
   - 專家級：有權威感、有影響力

請直接輸出開頭，不要加任何解釋。`;

  return prompt;
}

// ============================================
// 測試主函數
// ============================================
async function runFullGrowthStageTests() {
  console.log('='.repeat(80));
  console.log('完整四階段測試（含語言風格和爆款文案）');
  console.log('='.repeat(80));
  console.log('');
  
  const topic = '創業初期面對自我懷疑的心路歷程';
  const results: Array<{
    stage: string;
    name: string;
    stats: { totalPosts: number; avgEngagement: number; maxEngagement: number };
    detectedStage: string;
    systemWeight: number;
    userWeight: number;
    generatedOpener: string;
    promptLength: number;
  }> = [];
  
  for (const [stageKey, stageData] of Object.entries(testStages)) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`測試階段：${stageData.name}`);
    console.log(`${'─'.repeat(60)}`);
    
    // 1. 計算統計資料
    const stats = calculatePostStats(stageData.samplePosts);
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
    const stageConfig = STAGE_CONFIGS[detectedStage];
    console.log(`\n🎯 判定階段：${detectedStage}`);
    console.log(`   預期階段：${stageData.expectedStage}`);
    console.log(`   判定結果：${detectedStage === stageData.expectedStage ? '✅ 正確' : '❌ 不符'}`);
    
    // 4. 計算權重
    const systemWeight = Math.round(stageConfig.systemWeight * 100);
    const userWeight = Math.round(stageConfig.userWeight * 100);
    console.log(`\n⚖️ 範例權重：`);
    console.log(`   系統範例：${systemWeight}%`);
    console.log(`   用戶範例：${userWeight}%`);
    
    // 5. 建立完整 Prompt
    const prompt = buildFullPrompt(
      detectedStage,
      stageData.name,
      systemWeight,
      userWeight,
      sharedLanguageStyle,
      sharedViralExamples,
      stageData.samplePosts,
      topic
    );
    console.log(`\n📝 Prompt 長度：${prompt.length} 字`);
    
    // 6. 調用 LLM 生成開頭
    console.log(`\n🤖 生成開頭中...`);
    try {
      const response = await invokeLLM({
        messages: [
          { role: 'user', content: prompt }
        ],
      });
      
      const generatedOpener = response.choices[0]?.message?.content?.toString() || '生成失敗';
      console.log(`\n✨ 生成的開頭：`);
      console.log(`   ${generatedOpener}`);
      
      results.push({
        stage: stageKey,
        name: stageData.name,
        stats,
        detectedStage,
        systemWeight,
        userWeight,
        generatedOpener,
        promptLength: prompt.length,
      });
    } catch (error) {
      console.error(`   生成失敗：${error}`);
      results.push({
        stage: stageKey,
        name: stageData.name,
        stats,
        detectedStage,
        systemWeight,
        userWeight,
        generatedOpener: '生成失敗',
        promptLength: prompt.length,
      });
    }
  }
  
  // 輸出總結
  console.log('\n');
  console.log('='.repeat(80));
  console.log('測試結果總結');
  console.log('='.repeat(80));
  console.log('');
  
  console.log('| 階段 | 總貼文 | 平均互動 | 最高互動 | 系統% | 用戶% | 生成的開頭 |');
  console.log('|------|--------|----------|----------|-------|-------|------------|');
  
  for (const result of results) {
    const openerPreview = result.generatedOpener.substring(0, 30) + (result.generatedOpener.length > 30 ? '...' : '');
    console.log(`| ${result.name} | ${result.stats.totalPosts} | ${result.stats.avgEngagement.toFixed(0)} | ${result.stats.maxEngagement} | ${result.systemWeight}% | ${result.userWeight}% | ${openerPreview} |`);
  }
  
  console.log('\n');
  console.log('='.repeat(80));
  console.log('各階段生成的完整開頭');
  console.log('='.repeat(80));
  
  for (const result of results) {
    console.log(`\n【${result.name}】（系統 ${result.systemWeight}% / 用戶 ${result.userWeight}%）`);
    console.log(`${result.generatedOpener}`);
  }
  
  console.log('\n');
  console.log('測試完成！');
}

// 執行測試
runFullGrowthStageTests().catch(console.error);
