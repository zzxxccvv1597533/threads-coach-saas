/**
 * Demo 資料 Seed 腳本
 * 為指定用戶建立完整的 Demo 資料，用於展示所有功能
 * 
 * 使用方式: node scripts/seed-demo-data.mjs <userId>
 * 例如: node scripts/seed-demo-data.mjs 1
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 環境變數未設定');
  process.exit(1);
}

const userId = parseInt(process.argv[2]);
if (!userId) {
  console.error('❌ 請提供用戶 ID，例如: node scripts/seed-demo-data.mjs 1');
  process.exit(1);
}

// 解析 DATABASE_URL
const url = new URL(DATABASE_URL);
const connectionConfig = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
};

async function seedDemoData() {
  const connection = await mysql.createConnection(connectionConfig);
  
  try {
    console.log(`🚀 開始為用戶 ${userId} 建立 Demo 資料...`);

    // ==================== 1. IP 地基 ====================
    console.log('\n📝 建立 IP 地基...');
    
    // 先檢查是否已有 IP Profile
    const [existingProfile] = await connection.execute(
      'SELECT id FROM ip_profiles WHERE userId = ?',
      [userId]
    );
    
    let ipProfileId;
    if (existingProfile.length > 0) {
      ipProfileId = existingProfile[0].id;
      // 更新現有的 IP Profile
      await connection.execute(`
        UPDATE ip_profiles SET
          occupation = ?,
          voiceTone = ?,
          viewpointStatement = ?,
          goalPrimary = ?,
          personaExpertise = ?,
          personaEmotion = ?,
          personaViewpoint = ?,
          heroJourneyOrigin = ?,
          heroJourneyProcess = ?,
          heroJourneyHero = ?,
          heroJourneyMission = ?,
          identityTags = ?,
          contentMatrixAudiences = ?,
          contentMatrixThemes = ?,
          ipAnalysisComplete = ?,
          aiStrategySummary = ?,
          aiStrategyUpdatedAt = NOW(),
          bestPerformingType = ?,
          bestPostingTime = ?,
          viralPatterns = ?,
          lineOfficialUrl = ?,
          lineOfficialName = ?
        WHERE id = ?
      `, [
        '品牌行銷顧問',
        '溫暖真誠但直接',
        '我相信每個人都值得被看見，而好的內容是最好的名片',
        'monetize',
        '10年品牌行銷經驗，輔導超過200位創業者建立個人品牌，擅長將複雜概念轉化為易懂內容',
        '曾經也是不敢露臉的內向者，理解從零開始的恐懼與掙扎，用同理心陪伴每一位學員',
        '不追求爆紅，追求持續被需要。真誠比技巧重要，價值比流量重要',
        '2018年，我在廣告公司做到主管，卻發現自己越來越不快樂。每天幫品牌說故事，卻說不出自己的故事。',
        '離職後嘗試經營自媒體，前3個月粉絲不到100人。被質疑「你憑什麼教別人」，差點放棄。',
        '直到我停止模仿別人，開始說自己的故事。第一篇真誠分享失敗經驗的貼文，意外獲得5000+互動。',
        '現在我的使命是幫助更多人找到自己的聲音，用內容建立被動收入，實現時間自由。',
        JSON.stringify(['品牌行銷顧問', '內容創作教練', '前廣告人', '內向者', '二寶媽']),
        JSON.stringify({
          core: '想經營個人品牌但不知道從何開始的創業者',
          potential: '已經在經營但卡在變現階段的內容創作者',
          opportunity: '企業內部想要建立個人影響力的專業人士'
        }),
        JSON.stringify(['個人品牌經營', '內容創作技巧', '變現策略']),
        true,
        '根據最近20篇貼文分析，你的故事型內容表現最佳，平均互動率達8.5%。建議維持每週3-4篇的發文頻率，並在晚上8-10點發文。你的爆文特徵：開頭使用反差句式、中間有具體數字、結尾有明確CTA。',
        'story',
        '20:00-22:00',
        '1. 反差開頭：用「我以為...結果...」句式\n2. 具體數字：提到具體成果如「3個月」「5000+互動」\n3. 情感共鳴：分享失敗經驗比成功更容易引起共鳴\n4. 明確CTA：直接告訴讀者下一步行動',
        'https://line.me/R/ti/p/@demo-brand',
        'Demo品牌官方帳號',
        ipProfileId
      ]);
      console.log('  ✅ 更新 IP 地基');
    } else {
      // 建立新的 IP Profile
      const [result] = await connection.execute(`
        INSERT INTO ip_profiles (
          userId, occupation, voiceTone, viewpointStatement, goalPrimary,
          personaExpertise, personaEmotion, personaViewpoint,
          heroJourneyOrigin, heroJourneyProcess, heroJourneyHero, heroJourneyMission,
          identityTags, contentMatrixAudiences, contentMatrixThemes,
          ipAnalysisComplete, aiStrategySummary, aiStrategyUpdatedAt,
          bestPerformingType, bestPostingTime, viralPatterns,
          lineOfficialUrl, lineOfficialName
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
      `, [
        userId,
        '品牌行銷顧問',
        '溫暖真誠但直接',
        '我相信每個人都值得被看見，而好的內容是最好的名片',
        'monetize',
        '10年品牌行銷經驗，輔導超過200位創業者建立個人品牌，擅長將複雜概念轉化為易懂內容',
        '曾經也是不敢露臉的內向者，理解從零開始的恐懼與掙扎，用同理心陪伴每一位學員',
        '不追求爆紅，追求持續被需要。真誠比技巧重要，價值比流量重要',
        '2018年，我在廣告公司做到主管，卻發現自己越來越不快樂。每天幫品牌說故事，卻說不出自己的故事。',
        '離職後嘗試經營自媒體，前3個月粉絲不到100人。被質疑「你憑什麼教別人」，差點放棄。',
        '直到我停止模仿別人，開始說自己的故事。第一篇真誠分享失敗經驗的貼文，意外獲得5000+互動。',
        '現在我的使命是幫助更多人找到自己的聲音，用內容建立被動收入，實現時間自由。',
        JSON.stringify(['品牌行銷顧問', '內容創作教練', '前廣告人', '內向者', '二寶媽']),
        JSON.stringify({
          core: '想經營個人品牌但不知道從何開始的創業者',
          potential: '已經在經營但卡在變現階段的內容創作者',
          opportunity: '企業內部想要建立個人影響力的專業人士'
        }),
        JSON.stringify(['個人品牌經營', '內容創作技巧', '變現策略']),
        true,
        '根據最近20篇貼文分析，你的故事型內容表現最佳，平均互動率達8.5%。建議維持每週3-4篇的發文頻率，並在晚上8-10點發文。你的爆文特徵：開頭使用反差句式、中間有具體數字、結尾有明確CTA。',
        'story',
        '20:00-22:00',
        '1. 反差開頭：用「我以為...結果...」句式\n2. 具體數字：提到具體成果如「3個月」「5000+互動」\n3. 情感共鳴：分享失敗經驗比成功更容易引起共鳴\n4. 明確CTA：直接告訴讀者下一步行動',
        'https://line.me/R/ti/p/@demo-brand',
        'Demo品牌官方帳號'
      ]);
      ipProfileId = result.insertId;
      console.log('  ✅ 建立 IP 地基');
    }

    // ==================== 2. 受眾分群 ====================
    console.log('\n👥 建立受眾分群...');
    
    // 先刪除現有資料
    await connection.execute('DELETE FROM audience_segments WHERE userId = ?', [userId]);
    
    const audienceSegments = [
      {
        segmentName: '新手創業者',
        painPoint: '想經營個人品牌但不知道從何開始，害怕露臉、不知道要分享什麼',
        desiredOutcome: '建立清晰的個人定位，知道每天要發什麼內容',
        priority: 1
      },
      {
        segmentName: '卡關創作者',
        painPoint: '已經在發文但互動很低，不知道如何提升，感覺在自嗨',
        desiredOutcome: '找到爆款公式，穩定產出高互動內容',
        priority: 2
      },
      {
        segmentName: '變現困難者',
        painPoint: '有粉絲但不知道怎麼變現，害怕推銷、不敢開口賣東西',
        desiredOutcome: '建立自然的變現流程，讓粉絲主動詢問',
        priority: 3
      }
    ];
    
    for (const segment of audienceSegments) {
      await connection.execute(`
        INSERT INTO audience_segments (userId, segmentName, painPoint, desiredOutcome, priority)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, segment.segmentName, segment.painPoint, segment.desiredOutcome, segment.priority]);
    }
    console.log('  ✅ 建立 3 個受眾分群');

    // ==================== 3. 內容支柱 ====================
    console.log('\n📚 建立內容支柱...');
    
    await connection.execute('DELETE FROM content_pillars WHERE userId = ?', [userId]);
    
    const contentPillars = [
      {
        title: '個人品牌經營',
        description: '分享如何從零開始建立個人品牌，包含定位、人設、內容策略'
      },
      {
        title: '內容創作技巧',
        description: '教學如何寫出高互動貼文，包含 Hook 技巧、故事結構、CTA 設計'
      },
      {
        title: '變現策略',
        description: '分享如何將流量轉換為收入，包含產品設計、銷售文案、客戶經營'
      }
    ];
    
    for (const pillar of contentPillars) {
      await connection.execute(`
        INSERT INTO content_pillars (userId, title, description, isActive)
        VALUES (?, ?, ?, true)
      `, [userId, pillar.title, pillar.description]);
    }
    console.log('  ✅ 建立 3 個內容支柱');

    // ==================== 4. 產品矩陣 ====================
    console.log('\n🛍️ 建立產品矩陣...');
    
    await connection.execute('DELETE FROM user_products WHERE userId = ?', [userId]);
    
    const userProducts = [
      {
        productType: 'lead',
        name: '《Threads 新手起步指南》電子書',
        description: '30頁完整攻略，從0到1建立你的Threads帳號',
        priceRange: '免費',
        deliveryTime: '即時下載',
        uniqueValue: '濃縮我3年經營經驗，新手最容易犯的10個錯誤一次避開'
      },
      {
        productType: 'core',
        name: '1對1品牌諮詢',
        description: '60分鐘深度諮詢，幫你找到個人品牌定位',
        priceRange: '3,000-5,000',
        deliveryTime: '60分鐘',
        uniqueValue: '不只給建議，還會幫你產出可執行的30天行動計畫'
      },
      {
        productType: 'vip',
        name: '品牌陪跑計畫',
        description: '3個月深度陪伴，從定位到變現全程輔導',
        priceRange: '30,000-50,000',
        deliveryTime: '3個月',
        uniqueValue: '每週1對1諮詢 + 無限次文案健檢 + 專屬社群'
      }
    ];
    
    for (const product of userProducts) {
      await connection.execute(`
        INSERT INTO user_products (userId, userProductType, name, description, priceRange, deliveryTime, uniqueValue, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, true)
      `, [userId, product.productType, product.name, product.description, product.priceRange, product.deliveryTime, product.uniqueValue]);
    }
    console.log('  ✅ 建立 3 個產品');

    // ==================== 5. 成功案例 ====================
    console.log('\n🏆 建立成功案例...');
    
    await connection.execute('DELETE FROM success_stories WHERE userId = ?', [userId]);
    
    const successStories = [
      {
        title: '從0到月入3萬的斜槓媽媽',
        clientBackground: '全職媽媽，想在家帶小孩同時建立副業收入',
        challenge: '不知道自己有什麼專長可以分享，害怕被認識的人看到',
        transformation: '透過3個月陪跑，找到「育兒x時間管理」的獨特定位，建立匿名帳號開始分享',
        outcome: '6個月後粉絲破萬，開始接業配和開設線上課程',
        testimonialQuote: '原來我的日常經驗也能幫助到別人，現在每天都很期待創作！'
      },
      {
        title: '工程師轉型內容創作者',
        clientBackground: '科技業工程師，想要建立個人品牌為未來轉職鋪路',
        challenge: '覺得自己的專業太硬、太無聊，不知道怎麼讓一般人感興趣',
        transformation: '學會用故事包裝技術知識，把「程式碼」變成「人生哲學」',
        outcome: '現在是科技圈知名KOL，出版了一本書，還受邀到企業演講',
        testimonialQuote: '沒想到寫程式的經驗也能變成這麼有趣的內容！'
      }
    ];
    
    for (const story of successStories) {
      await connection.execute(`
        INSERT INTO success_stories (userId, title, clientBackground, challenge, transformation, outcome, testimonialQuote, isPublic)
        VALUES (?, ?, ?, ?, ?, ?, ?, true)
      `, [userId, story.title, story.clientBackground, story.challenge, story.transformation, story.outcome, story.testimonialQuote]);
    }
    console.log('  ✅ 建立 2 個成功案例');

    // ==================== 6. 草稿 ====================
    console.log('\n📝 建立草稿...');
    
    await connection.execute('DELETE FROM draft_posts WHERE userId = ?', [userId]);
    
    const draftPosts = [
      {
        contentType: 'story',
        title: '我如何從月薪3萬到月入10萬',
        body: '3年前的我，還在廣告公司領著3萬月薪\n每天加班到11點，卻看不到未來\n\n直到我開始在下班後經營自媒體\n一開始只是想記錄生活\n沒想到3個月後，第一個客戶主動找上門\n\n現在回頭看，改變人生的不是什麼大決定\n而是每天下班後的那2小時\n\n如果你也想開始，但不知道從何下手\n留言「開始」，我分享我的起步清單給你',
        cta: '留言「開始」領取起步清單',
        status: 'draft'
      },
      {
        contentType: 'knowledge',
        title: '寫出爆款貼文的3個秘訣',
        body: '研究了100篇爆款貼文後\n我發現它們都有這3個共同點：\n\n1️⃣ 開頭製造懸念\n不是「今天要分享...」\n而是「我以為...結果...」\n\n2️⃣ 中間有具體數字\n不是「很多人」\n而是「87%的人」\n\n3️⃣ 結尾有明確行動\n不是「希望對你有幫助」\n而是「留言+1，我私訊你」\n\n存起來，下次發文前對照檢查！',
        cta: '存起來，下次發文前對照檢查',
        status: 'draft'
      },
      {
        contentType: 'viewpoint',
        title: '為什麼我不建議新手追求爆紅',
        body: '「我想要一篇貼文就爆紅」\n\n這是我最常聽到的願望\n但說實話，我不建議新手追求爆紅\n\n因為爆紅之後呢？\n如果你的定位不清楚\n來的粉絲也不是你的目標客群\n最後只會變成「有流量沒收入」\n\n我寧願你每篇貼文都有10個精準粉絲\n也不要一篇爆文帶來1000個路人\n\n先把基本功練好\n爆紅只是時間問題',
        cta: '你同意嗎？留言告訴我你的想法',
        status: 'draft'
      }
    ];
    
    const draftIds = [];
    for (const draft of draftPosts) {
      const [result] = await connection.execute(`
        INSERT INTO draft_posts (userId, contentType, title, body, cta, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, draft.contentType, draft.title, draft.body, draft.cta, draft.status]);
      draftIds.push(result.insertId);
    }
    console.log('  ✅ 建立 3 篇草稿');

    // ==================== 7. 戰報資料 ====================
    console.log('\n📊 建立戰報資料...');
    
    // 先刪除現有的 posts 和 postMetrics
    const [existingPosts] = await connection.execute('SELECT id FROM posts WHERE userId = ?', [userId]);
    for (const post of existingPosts) {
      await connection.execute('DELETE FROM post_metrics WHERE postId = ?', [post.id]);
    }
    await connection.execute('DELETE FROM posts WHERE userId = ?', [userId]);
    
    const posts = [
      {
        threadUrl: 'https://threads.net/@demo/post/1',
        postedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
        metrics: {
          reach: 15000,
          likes: 850,
          comments: 120,
          reposts: 45,
          saves: 200,
          profileVisits: 300,
          linkClicks: 50,
          inquiries: 5,
          postingTime: 'evening',
          topComment: '這篇太有共鳴了！我也是這樣過來的',
          selfReflection: '反差開頭效果很好，下次可以多用',
          aiInsight: '這篇貼文成功的關鍵在於：1) 用具體數字建立可信度 2) 分享真實的掙扎過程引起共鳴 3) 結尾的CTA明確且有價值',
          performanceLevel: 'hit',
          isViral: true,
          viralAnalysis: '這篇爆文成功的原因：\n1. 開頭用「3年前」製造時間對比\n2. 具體數字「月薪3萬→月入10萬」建立可信度\n3. 「每天下班後的2小時」讓人覺得可複製\n4. CTA「留言開始」降低行動門檻'
        }
      },
      {
        threadUrl: 'https://threads.net/@demo/post/2',
        postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5天前
        metrics: {
          reach: 8000,
          likes: 420,
          comments: 65,
          reposts: 30,
          saves: 150,
          profileVisits: 180,
          linkClicks: 25,
          inquiries: 2,
          postingTime: 'evening',
          topComment: '第2點超重要！我之前都沒注意到',
          selfReflection: '知識型內容存檔率高，適合建立專業形象',
          aiInsight: '知識型內容的存檔率（1.9%）高於平均，建議每週至少發一篇這類內容來累積專業形象',
          performanceLevel: 'normal',
          isViral: false,
          viralAnalysis: null
        }
      },
      {
        threadUrl: 'https://threads.net/@demo/post/3',
        postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3天前
        metrics: {
          reach: 5000,
          likes: 280,
          comments: 45,
          reposts: 15,
          saves: 80,
          profileVisits: 100,
          linkClicks: 10,
          inquiries: 1,
          postingTime: 'noon',
          topComment: '說得太好了，我也這樣想',
          selfReflection: '觀點型內容互動率還可以，但轉發較少',
          aiInsight: '觀點型內容適合建立個人立場，但要注意不要太過極端。建議搭配故事來支撐觀點',
          performanceLevel: 'normal',
          isViral: false,
          viralAnalysis: null
        }
      },
      {
        threadUrl: 'https://threads.net/@demo/post/4',
        postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1天前
        metrics: {
          reach: 2000,
          likes: 100,
          comments: 15,
          reposts: 5,
          saves: 20,
          profileVisits: 30,
          linkClicks: 3,
          inquiries: 0,
          postingTime: 'morning',
          topComment: '',
          selfReflection: '早上發文效果不好，下次試試晚上',
          aiInsight: '這篇表現低於平均，可能原因：1) 發文時間不佳 2) 開頭不夠吸引人 3) 主題太常見',
          performanceLevel: 'low',
          isViral: false,
          viralAnalysis: null
        }
      }
    ];
    
    for (const post of posts) {
      const [postResult] = await connection.execute(`
        INSERT INTO posts (userId, threadUrl, postedAt)
        VALUES (?, ?, ?)
      `, [userId, post.threadUrl, post.postedAt]);
      
      const postId = postResult.insertId;
      
      await connection.execute(`
        INSERT INTO post_metrics (
          postId, capturedAt, reach, likes, comments, reposts, saves,
          profileVisits, linkClicks, inquiries, postingTime, topComment,
          selfReflection, aiInsight, performanceLevel, isViral, viralAnalysis
        ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        postId,
        post.metrics.reach,
        post.metrics.likes,
        post.metrics.comments,
        post.metrics.reposts,
        post.metrics.saves,
        post.metrics.profileVisits,
        post.metrics.linkClicks,
        post.metrics.inquiries,
        post.metrics.postingTime,
        post.metrics.topComment,
        post.metrics.selfReflection,
        post.metrics.aiInsight,
        post.metrics.performanceLevel,
        post.metrics.isViral,
        post.metrics.viralAnalysis
      ]);
    }
    console.log('  ✅ 建立 4 篇戰報（含 1 篇爆文）');

    // ==================== 8. 經營數據 ====================
    console.log('\n📈 建立經營數據...');
    
    // 先檢查是否已有經營數據
    const [existingMetrics] = await connection.execute(
      'SELECT id FROM user_growth_metrics WHERE userId = ?',
      [userId]
    );
    
    if (existingMetrics.length > 0) {
      await connection.execute(`
        UPDATE user_growth_metrics SET
          followerCount = ?,
          avgReach = ?,
          avgEngagement = ?,
          avgEngagementRate = ?,
          postFrequency = ?,
          totalPosts = ?,
          hasProfileSetup = ?,
          hasLineLink = ?,
          hasProduct = ?,
          totalSales = ?,
          currentStage = ?
        WHERE userId = ?
      `, [
        2500, // 粉絲數
        7500, // 平均觸及
        400, // 平均互動
        530, // 平均互動率 5.3%
        4, // 週發文數
        45, // 總發文數
        true,
        true,
        true,
        8, // 總成交數
        'growth',
        userId
      ]);
      console.log('  ✅ 更新經營數據');
    } else {
      await connection.execute(`
        INSERT INTO user_growth_metrics (
          userId, followerCount, avgReach, avgEngagement, avgEngagementRate,
          postFrequency, totalPosts, hasProfileSetup, hasLineLink, hasProduct,
          totalSales, currentStage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        2500,
        7500,
        400,
        530,
        4,
        45,
        true,
        true,
        true,
        8,
        'growth'
      ]);
      console.log('  ✅ 建立經營數據');
    }

    // ==================== 9. 寫作風格 ====================
    console.log('\n✍️ 建立寫作風格...');
    
    const [existingStyle] = await connection.execute(
      'SELECT id FROM user_writing_styles WHERE userId = ?',
      [userId]
    );
    
    const styleData = {
      toneStyle: '溫暖真誠',
      commonPhrases: JSON.stringify(['你有沒有發現...', '說真的...', '我以前也是這樣...']),
      catchphrases: JSON.stringify(['真的', '欸', '吧', '啊']),
      hookStylePreference: '反差型',
      metaphorStyle: '生活化比喻',
      emotionRhythm: '娓娓道來長句',
      viralElements: JSON.stringify({
        identityTags: ['品牌行銷顧問', '前廣告人', '內向者'],
        emotionWords: ['掙扎', '害怕', '終於', '原來'],
        ctaStyles: ['留言領取', '存起來', '追蹤看更多']
      }),
      samplePosts: JSON.stringify([
        {
          content: '3年前的我，還在廣告公司領著3萬月薪...',
          engagement: 1015,
          addedAt: new Date().toISOString()
        }
      ]),
      analysisStatus: 'completed'
    };
    
    if (existingStyle.length > 0) {
      await connection.execute(`
        UPDATE user_writing_styles SET
          toneStyle = ?, commonPhrases = ?, catchphrases = ?,
          hookStylePreference = ?, metaphorStyle = ?, emotionRhythm = ?,
          viralElements = ?, samplePosts = ?, analysisStatus = ?, lastAnalyzedAt = NOW()
        WHERE userId = ?
      `, [
        styleData.toneStyle,
        styleData.commonPhrases,
        styleData.catchphrases,
        styleData.hookStylePreference,
        styleData.metaphorStyle,
        styleData.emotionRhythm,
        styleData.viralElements,
        styleData.samplePosts,
        styleData.analysisStatus,
        userId
      ]);
      console.log('  ✅ 更新寫作風格');
    } else {
      await connection.execute(`
        INSERT INTO user_writing_styles (
          userId, toneStyle, commonPhrases, catchphrases,
          hookStylePreference, metaphorStyle, emotionRhythm,
          viralElements, samplePosts, analysisStatus, lastAnalyzedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        userId,
        styleData.toneStyle,
        styleData.commonPhrases,
        styleData.catchphrases,
        styleData.hookStylePreference,
        styleData.metaphorStyle,
        styleData.emotionRhythm,
        styleData.viralElements,
        styleData.samplePosts,
        styleData.analysisStatus
      ]);
      console.log('  ✅ 建立寫作風格');
    }

    // ==================== 10. 互動任務 ====================
    console.log('\n✅ 建立互動任務...');
    
    await connection.execute('DELETE FROM interaction_tasks WHERE userId = ?', [userId]);
    
    const tasks = [
      { taskType: 'reply_comments', taskDetail: '回覆昨天貼文的5則留言', status: 'todo' },
      { taskType: 'comment_others', taskDetail: '去3位同領域創作者的貼文留言互動', status: 'todo' },
      { taskType: 'sea_patrol', taskDetail: '在Threads搜尋「個人品牌」，找5篇可以互動的貼文', status: 'done' }
    ];
    
    for (const task of tasks) {
      await connection.execute(`
        INSERT INTO interaction_tasks (userId, taskType, taskDetail, taskStatus, dueDate)
        VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))
      `, [userId, task.taskType, task.taskDetail, task.status]);
    }
    console.log('  ✅ 建立 3 個互動任務');

    console.log('\n🎉 Demo 資料建立完成！');
    console.log('\n📋 建立的資料摘要：');
    console.log('  - IP 地基：完整人設三支柱、英雄旅程、AI策略總結');
    console.log('  - 受眾分群：3 個目標受眾');
    console.log('  - 內容支柱：3 個主題');
    console.log('  - 產品矩陣：引流產品、核心產品、VIP產品');
    console.log('  - 成功案例：2 個客戶故事');
    console.log('  - 草稿庫：3 篇待發布草稿');
    console.log('  - 戰報數據：4 篇貼文（含 1 篇爆文）');
    console.log('  - 經營數據：粉絲 2500、成長期階段');
    console.log('  - 寫作風格：完整風格分析');
    console.log('  - 互動任務：3 個今日任務');

  } catch (error) {
    console.error('❌ 建立 Demo 資料時發生錯誤:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

seedDemoData().catch(console.error);
