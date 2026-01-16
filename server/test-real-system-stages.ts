/**
 * 四個成長階段實際系統測試
 * 
 * 在資料庫中建立完整的測試用戶資料，包含：
 * - IP 地基（職業、人設三支柱、英雄旅程、受眾）
 * - 語言風格（語氣、口頭禪、說話風格範例）
 * - 樣本貼文（不同互動數）
 * 
 * 然後執行文案生成，觀察各階段的差異
 */

import * as db from './db';
import { determineUserStage, calculateAdaptiveThreshold, STAGE_CONFIGS, UserMetrics } from './services/adaptiveThreshold';
import { buildEnhancedFewShotContext } from './fewShotLearning';
import { invokeLLM } from './_core/llm';

// 樣本貼文類型
interface SamplePost {
  content: string;
  engagement?: number;
  addedAt: string;
}

// 測試用戶資料定義
const testUsers = [
  {
    stage: 'newbie',
    name: '新手小明',
    email: 'test_newbie@test.com',
    ipProfile: {
      occupation: '剛離職的上班族，想嘗試自媒體創業',
      voiceTone: '真誠、有點不確定、探索中',
      viewpointStatement: '我相信每個人都有自己的故事值得被聽見',
      personaExpertise: '職場轉型經驗',
      personaEmotion: '迷惘但充滿希望',
      personaUnique: '30歲轉職的勇氣',
      heroJourneyOrigin: '在公司工作了五年，每天都覺得自己只是一顆螺絲釘',
      heroJourneyProcess: '開始在下班後經營自己的社群，慢慢累積一些讀者',
      heroJourneyMoment: '第一次收到讀者私訊說我的文章幫助了他',
      heroJourneyMission: '希望能幫助更多像我一樣迷惘的人找到方向',
      audienceWho: '想轉職但害怕改變的上班族',
      audiencePainPoints: JSON.stringify(['不知道自己適合什麼', '害怕改變', '對未來感到焦慮']),
      coreProduct: '個人成長分享'
    },
    writingStyle: {
      toneStyle: '溫暖真誠',
      commonPhrases: ['說真的', '其實我也', '慢慢來'],
      catchphrases: ['真的', '欸', '吧'],
      hookStylePreference: '場景型',
      metaphorStyle: '生活化比喻',
      emotionRhythm: '娓娓道來長句'
    },
    samplePosts: [
      { content: '今天終於鼓起勇氣遞出辭呈了，心裡其實很忐忑...', engagement: 35, addedAt: new Date().toISOString() },
      { content: '開始經營社群第一個月，粉絲數：47。雖然很少，但每一個都很珍貴', engagement: 24, addedAt: new Date().toISOString() },
      { content: '收到第一則私訊說我的文章幫助了他，眼眶有點濕...', engagement: 46, addedAt: new Date().toISOString() }
    ] as SamplePost[]
  },
  {
    stage: 'growing',
    name: '成長期小華',
    email: 'test_growing@test.com',
    ipProfile: {
      occupation: '自媒體創作者，專注個人品牌經營',
      voiceTone: '溫暖、有洞察、偶爾幽默',
      viewpointStatement: '個人品牌不是包裝，是真實的自己加上系統化的呈現',
      personaExpertise: '個人品牌經營',
      personaEmotion: '自信但謙虛',
      personaUnique: '從零到一的實戰經驗',
      heroJourneyOrigin: '從零開始經營社群，第一年幾乎沒有任何成效',
      heroJourneyProcess: '開始研究爆款文案，找到自己的獨特切角',
      heroJourneyMoment: '第一篇破萬觸及的貼文，讓我確信這條路是對的',
      heroJourneyMission: '幫助更多創作者找到自己的聲音',
      audienceWho: '想經營個人品牌但不知道怎麼開始的人',
      audiencePainPoints: JSON.stringify(['不知道怎麼定位', '內容沒有流量', '不知道怎麼變現']),
      coreProduct: '個人品牌諮詢'
    },
    writingStyle: {
      toneStyle: '溫暖真誠',
      commonPhrases: ['你知道嗎', '重點來了', '這很重要'],
      catchphrases: ['真的', '欸', '啦'],
      hookStylePreference: '反差型',
      metaphorStyle: '生活化比喻',
      emotionRhythm: '快節奏短句'
    },
    samplePosts: [
      { content: '經營社群一年，我學到最重要的一件事：不是你發什麼，是你為誰發。', engagement: 227, addedAt: new Date().toISOString() },
      { content: '「你的內容很好，但就是沒人看」這句話我聽了無數次。後來我發現問題出在...', engagement: 280, addedAt: new Date().toISOString() },
      { content: '今天有學員跟我說，用了我教的方法，觸及從 500 變成 5000。這就是我做這件事的意義。', engagement: 186, addedAt: new Date().toISOString() },
      { content: '很多人問我怎麼找到自己的定位。我的答案是：先發 100 篇，答案就會出現。', engagement: 335, addedAt: new Date().toISOString() },
      { content: '個人品牌最大的誤解：以為要很厲害才能開始。其實是開始了才會變厲害。', engagement: 152, addedAt: new Date().toISOString() }
    ] as SamplePost[]
  },
  {
    stage: 'mature',
    name: '成熟期小美',
    email: 'test_mature@test.com',
    ipProfile: {
      occupation: '個人品牌顧問，專注於內容策略與變現',
      voiceTone: '專業、有溫度、直接但不尖銳',
      viewpointStatement: '內容是資產，不是消耗品。每一篇文章都應該為你工作。',
      personaExpertise: '內容變現策略',
      personaEmotion: '專業自信',
      personaUnique: '三年從小編到顧問的蛻變',
      heroJourneyOrigin: '曾經是廣告公司的小編，每天寫著別人的故事',
      heroJourneyProcess: '決定離開，開始寫自己的故事，三年內建立了自己的品牌',
      heroJourneyMoment: '第一次開課，三天內報名額滿，那一刻我知道我找到了使命',
      heroJourneyMission: '幫助 1000 位創作者建立可持續的內容事業',
      audienceWho: '有內容但不知道怎麼變現的創作者',
      audiencePainPoints: JSON.stringify(['內容做了但沒變現', '不知道怎麼定價', '害怕被說太商業']),
      coreProduct: '內容變現系統課程'
    },
    writingStyle: {
      toneStyle: '犀利直接',
      commonPhrases: ['說白了', '這是關鍵', '別再糾結了'],
      catchphrases: ['真的', '欸', '啊'],
      hookStylePreference: '反差型',
      metaphorStyle: '專業術語白話',
      emotionRhythm: '快節奏短句'
    },
    samplePosts: [
      { content: '說白了，90% 的創作者不是沒才華，是不懂定價。今天來聊聊怎麼讓你的內容值得付費。', engagement: 550, addedAt: new Date().toISOString() },
      { content: '「我怕被說太商業」這句話我聽太多次了。但你知道嗎？不敢收費才是對自己專業的不尊重。', engagement: 490, addedAt: new Date().toISOString() },
      { content: '三年前我還在幫別人寫文案，現在我教別人怎麼寫。改變的不是能力，是定位。', engagement: 687, addedAt: new Date().toISOString() },
      { content: '今天學員跟我說，用了我的定價策略，客單價從 3000 變成 30000。這不是魔法，是方法。', engagement: 415, addedAt: new Date().toISOString() },
      { content: '內容創作最大的陷阱：一直在「準備」，永遠沒「開始」。', engagement: 360, addedAt: new Date().toISOString() },
      { content: '很多人問我怎麼做到的。答案很無聊：持續三年，每週至少發三篇。沒有捷徑。', engagement: 586, addedAt: new Date().toISOString() },
      { content: '如果你的內容只是「分享」，那永遠只能換來「讚」。要變現，你需要的是「解決問題」。', engagement: 485, addedAt: new Date().toISOString() },
      { content: '今天開課第一天，看到學員們的眼神，我知道這一切都值得。', engagement: 315, addedAt: new Date().toISOString() },
      { content: '別再問「我可以嗎」，開始問「我怎麼做」。', engagement: 386, addedAt: new Date().toISOString() },
      { content: '三年經營社群，我最大的收穫不是粉絲數，是那些因為我的內容而改變的人。', engagement: 622, addedAt: new Date().toISOString() }
    ] as SamplePost[]
  },
  {
    stage: 'expert',
    name: '專家級老王',
    email: 'test_expert@test.com',
    ipProfile: {
      occupation: '內容創業導師，幫助創作者建立百萬級內容事業',
      voiceTone: '權威、有深度、偶爾犀利',
      viewpointStatement: '內容創業不是夢想，是一門可以學習的生意。',
      personaExpertise: '百萬級內容事業建立',
      personaEmotion: '權威但親切',
      personaUnique: '十年從月薪三萬到年收千萬的蛻變',
      heroJourneyOrigin: '十年前我還是一個月薪三萬的上班族，對未來充滿迷惘',
      heroJourneyProcess: '開始寫作、經營社群、出書、開課，一步步建立自己的事業版圖',
      heroJourneyMoment: '第一本書賣破十萬本，我知道內容真的可以改變命運',
      heroJourneyMission: '培養 100 位百萬級創作者，證明內容創業是可複製的',
      audienceWho: '想要規模化內容事業的創作者',
      audiencePainPoints: JSON.stringify(['想要規模化但不知道怎麼做', '團隊管理問題', '如何持續創新']),
      coreProduct: '百萬創作者培訓計畫'
    },
    writingStyle: {
      toneStyle: '犀利直接',
      commonPhrases: ['這是真相', '別騙自己', '醒醒吧'],
      catchphrases: ['真的', '欸', '啊'],
      hookStylePreference: '反差型',
      metaphorStyle: '專業術語白話',
      emotionRhythm: '快節奏短句'
    },
    samplePosts: [
      { content: '十年前月薪三萬，現在年收入破千萬。改變的不是運氣，是認知。', engagement: 2298, addedAt: new Date().toISOString() },
      { content: '「我沒有資源」是最大的謊言。你有時間、有網路、有腦袋，這就是最大的資源。', engagement: 1930, addedAt: new Date().toISOString() },
      { content: '今天有學員跟我說，跟著我的方法做了一年，月收入從 5 萬變成 50 萬。這不是個案，是系統。', engagement: 2500, addedAt: new Date().toISOString() },
      { content: '很多人問我成功的秘訣。答案很簡單：做別人不願意做的事，堅持別人堅持不了的時間。', engagement: 1540, addedAt: new Date().toISOString() },
      { content: '內容創業最大的風險不是失敗，是你從來沒有認真嘗試過。', engagement: 2120, addedAt: new Date().toISOString() },
      { content: '我見過太多有才華的人，死在「完美主義」這四個字上。', engagement: 1800, addedAt: new Date().toISOString() },
      { content: '如果你還在問「這個領域還有機會嗎」，那你已經輸了。機會永遠屬於行動的人。', engagement: 1410, addedAt: new Date().toISOString() },
      { content: '今天新書發布會，看到排隊的讀者，我想起十年前那個迷惘的自己。一切都值得。', engagement: 2235, addedAt: new Date().toISOString() },
      { content: '別再追求「被動收入」了。真正的財富自由，是你做喜歡的事還能賺錢。', engagement: 1670, addedAt: new Date().toISOString() },
      { content: '我培養的學員中，已經有 23 位年收入破百萬。這證明了一件事：方法是可以複製的。', engagement: 2050, addedAt: new Date().toISOString() },
      { content: '創業最難的不是開始，是在沒有成果的時候還能堅持。', engagement: 1865, addedAt: new Date().toISOString() },
      { content: '很多人說我運氣好。但他們沒看到我連續三年每天工作 16 小時。', engagement: 1990, addedAt: new Date().toISOString() },
      { content: '如果你的目標是「不用工作」，那你永遠不會成功。真正的目標應該是「做有意義的工作」。', engagement: 1605, addedAt: new Date().toISOString() },
      { content: '今天回顧這十年，最感謝的是那個不放棄的自己。', engagement: 2365, addedAt: new Date().toISOString() },
      { content: '內容創業的本質是什麼？是用你的經驗，幫助別人少走彎路。這就是價值。', engagement: 1735, addedAt: new Date().toISOString() },
      { content: '別再問「我可以嗎」。你當然可以。問題是你願不願意付出代價。', engagement: 2175, addedAt: new Date().toISOString() },
      { content: '我見過太多人，想要結果卻不想付出過程。這個世界很公平，沒有捷徑。', engagement: 1475, addedAt: new Date().toISOString() },
      { content: '今天有個學員跟我說，因為我的一篇文章，他決定離職創業。現在他的收入是以前的十倍。', engagement: 2430, addedAt: new Date().toISOString() },
      { content: '成功不是終點，是起點。真正的挑戰是如何持續成長。', engagement: 1350, addedAt: new Date().toISOString() },
      { content: '十年了，我還是每天在學習、在創作。因為我知道，停下來的那一天，就是退步的開始。', engagement: 2115, addedAt: new Date().toISOString() }
    ] as SamplePost[]
  }
];

async function createTestUsers() {
  console.log('=== 開始建立測試用戶 ===\n');
  
  const createdUsers: { stage: string; userId: number; email: string }[] = [];
  
  for (const testUser of testUsers) {
    console.log(`\n--- 建立 ${testUser.stage} 階段用戶: ${testUser.name} ---`);
    
    // 1. 檢查用戶是否已存在
    const existingUser = await db.getUserByEmail(testUser.email);
    
    let userId: number;
    
    if (existingUser) {
      console.log(`用戶已存在，使用現有 ID: ${existingUser.id}`);
      userId = existingUser.id;
    } else {
      // 建立新用戶
      await db.upsertUser({
        email: testUser.email,
        name: testUser.name,
        role: 'user',
        status: 'active',
        activationStatus: 'activated'
      });
      
      const newUser = await db.getUserByEmail(testUser.email);
      if (!newUser) {
        throw new Error(`Failed to create user: ${testUser.email}`);
      }
      userId = newUser.id;
      console.log(`建立新用戶，ID: ${userId}`);
    }
    
    // 2. 建立 IP 地基
    await db.upsertIpProfile({
      userId,
      occupation: testUser.ipProfile.occupation,
      voiceTone: testUser.ipProfile.voiceTone,
      viewpointStatement: testUser.ipProfile.viewpointStatement,
      personaExpertise: testUser.ipProfile.personaExpertise,
      personaEmotion: testUser.ipProfile.personaEmotion,
      personaViewpoint: testUser.ipProfile.personaUnique,
      heroJourneyOrigin: testUser.ipProfile.heroJourneyOrigin,
      heroJourneyProcess: testUser.ipProfile.heroJourneyProcess,
      heroJourneyHero: testUser.ipProfile.heroJourneyMoment,
      heroJourneyMission: testUser.ipProfile.heroJourneyMission,
      // 受眾資訊存在 audience_segments 表中，此處省略
    });
    console.log(`建立 IP 地基完成`);
    
    // 3. 建立語言風格（包含樣本貼文）
    await db.upsertUserWritingStyle({
      userId,
      toneStyle: testUser.writingStyle.toneStyle,
      commonPhrases: testUser.writingStyle.commonPhrases,
      catchphrases: testUser.writingStyle.catchphrases,
      hookStylePreference: testUser.writingStyle.hookStylePreference,
      metaphorStyle: testUser.writingStyle.metaphorStyle,
      emotionRhythm: testUser.writingStyle.emotionRhythm,
      samplePosts: testUser.samplePosts,
      analysisStatus: 'completed'
    });
    console.log(`建立語言風格完成（含 ${testUser.samplePosts.length} 篇樣本貼文）`);
    
    createdUsers.push({ stage: testUser.stage, userId, email: testUser.email });
  }
  
  console.log('\n=== 測試用戶建立完成 ===\n');
  return createdUsers;
}

async function runGenerationTest(userId: number, stage: string) {
  console.log(`\n=== 測試 ${stage} 階段文案生成 ===\n`);
  
  // 1. 獲取用戶資料
  const user = await db.getUserById(userId);
  const ipProfile = await db.getIpProfile(userId);
  const writingStyle = await db.getUserWritingStyle(userId);
  
  // 2. 從 samplePosts JSON 欄位獲取樣本貼文
  const userSamplePosts = (writingStyle?.samplePosts || []) as SamplePost[];
  
  // 3. 計算成長階段和門檻
  const engagements = userSamplePosts.map((p: SamplePost) => p.engagement || 0);
  const avgEngagement = engagements.length > 0 ? engagements.reduce((a: number, b: number) => a + b, 0) / engagements.length : 0;
  const maxEngagement = engagements.length > 0 ? Math.max(...engagements) : 0;
  const totalPosts = userSamplePosts.length;
  
  const metrics: UserMetrics = { totalPosts, avgEngagement, maxEngagement };
  const userStage = determineUserStage(metrics);
  const stageConfig = STAGE_CONFIGS[userStage];
  const thresholdResult = calculateAdaptiveThreshold(metrics, engagements);
  
  console.log(`用戶: ${user?.name}`);
  console.log(`總貼文: ${totalPosts}, 平均互動: ${avgEngagement.toFixed(0)}, 最高互動: ${maxEngagement}`);
  console.log(`判定階段: ${userStage}`);
  console.log(`系統範例權重: ${(stageConfig.systemWeight * 100).toFixed(0)}%, 用戶範例權重: ${(stageConfig.userWeight * 100).toFixed(0)}%`);
  console.log(`品質門檻: ${thresholdResult.threshold}`);
  
  // 4. 建立 Few-Shot 上下文
  const fewShotContext = await buildEnhancedFewShotContext(userId);
  
  console.log(`\nFew-Shot 上下文長度: ${fewShotContext.personalizedPrompt.length} 字`);
  
  // 5. 生成開頭
  const topic = '創業初期面對自我懷疑的心路歷程';
  
  const systemPrompt = `你是一位專業的 Threads 內容創作教練。

## 用戶 IP 地基
- 職業/身份: ${ipProfile?.occupation}
- 語氣風格: ${ipProfile?.voiceTone}
- 觀點宣言: ${ipProfile?.viewpointStatement}
- 專業人設: ${ipProfile?.personaExpertise}
- 情感人設: ${ipProfile?.personaEmotion}
- 獨特人設: ${ipProfile?.personaViewpoint}

## 用戶英雄旅程
- 起點: ${ipProfile?.heroJourneyOrigin}
- 過程: ${ipProfile?.heroJourneyProcess}
- 高光時刻: ${ipProfile?.heroJourneyHero}
- 使命: ${ipProfile?.heroJourneyMission}

## 用戶語言風格
- 語氣: ${writingStyle?.toneStyle}
- 常用句式: ${JSON.stringify(writingStyle?.commonPhrases)}
- 口頭禪: ${JSON.stringify(writingStyle?.catchphrases)}
- Hook 風格: ${writingStyle?.hookStylePreference}

## 用戶成長階段
- 階段: ${userStage}（${stageConfig.nameChinese}）
- 系統範例權重: ${(stageConfig.systemWeight * 100).toFixed(0)}%
- 用戶範例權重: ${(stageConfig.userWeight * 100).toFixed(0)}%

## Few-Shot 範例
${fewShotContext.personalizedPrompt}

## 任務
根據以上資訊，為主題「${topic}」生成一個吸引人的開頭（30 字以內）。

要求：
1. 符合用戶的語氣風格和口頭禪
2. 使用用戶範例中的成功模式
3. 避免 AI 痕跡（不要用「你是不是也」「你有沒有發現」等句式）
4. 開頭要有吸引力，讓人想繼續看下去

只輸出開頭內容，不要有任何解釋。`;

  const response = await invokeLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `請為主題「${topic}」生成一個開頭。` }
    ]
  });
  
  const generatedOpener = response.choices[0]?.message?.content || '';
  
  console.log(`\n生成的開頭: ${generatedOpener}`);
  
  return {
    stage,
    userId,
    userName: user?.name,
    totalPosts,
    avgEngagement: avgEngagement.toFixed(0),
    maxEngagement,
    detectedStage: userStage,
    stageName: stageConfig.nameChinese,
    systemWeight: (stageConfig.systemWeight * 100).toFixed(0),
    userWeight: (stageConfig.userWeight * 100).toFixed(0),
    threshold: thresholdResult.threshold,
    fewShotLength: fewShotContext.personalizedPrompt.length,
    generatedOpener,
    ipProfile: {
      occupation: ipProfile?.occupation,
      voiceTone: ipProfile?.voiceTone,
      viewpointStatement: ipProfile?.viewpointStatement
    },
    writingStyle: {
      toneStyle: writingStyle?.toneStyle,
      commonPhrases: writingStyle?.commonPhrases,
      hookStylePreference: writingStyle?.hookStylePreference
    }
  };
}

async function main() {
  try {
    // 1. 建立測試用戶
    const createdUsers = await createTestUsers();
    
    // 2. 執行生成測試
    const results: any[] = [];
    
    for (const user of createdUsers) {
      const result = await runGenerationTest(user.userId, user.stage);
      results.push(result);
    }
    
    // 3. 輸出結果對比
    console.log('\n\n========================================');
    console.log('=== 四個成長階段文案差異對比 ===');
    console.log('========================================\n');
    
    console.log('| 階段 | 總貼文 | 平均互動 | 最高互動 | 判定階段 | 系統% | 用戶% | 門檻 |');
    console.log('|------|--------|----------|----------|----------|-------|-------|------|');
    
    for (const r of results) {
      console.log(`| ${r.stage} | ${r.totalPosts} | ${r.avgEngagement} | ${r.maxEngagement} | ${r.detectedStage} | ${r.systemWeight}% | ${r.userWeight}% | ${r.threshold} |`);
    }
    
    console.log('\n\n=== 生成的開頭對比 ===\n');
    
    for (const r of results) {
      console.log(`【${r.stage}】${r.userName}（${r.stageName}）`);
      console.log(`IP 地基: ${r.ipProfile.occupation}`);
      console.log(`語氣風格: ${r.writingStyle.toneStyle}`);
      console.log(`常用句式: ${JSON.stringify(r.writingStyle.commonPhrases)}`);
      console.log(`開頭: ${r.generatedOpener}`);
      console.log(`Few-Shot 上下文長度: ${r.fewShotLength} 字`);
      console.log('');
    }
    
    console.log('\n=== 測試完成 ===');
    
  } catch (error) {
    console.error('測試失敗:', error);
    throw error;
  }
}

main();
