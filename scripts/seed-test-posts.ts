import { getDb } from "../server/db";
import { draftPosts, posts, postMetrics } from "../drizzle/schema";
import { drizzle } from "drizzle-orm/mysql2";

async function seedTestPosts() {
  const db = await getDb();
  // 使用 userId = 1 (假設是管理員)
  const userId = 1;
  
  const testPosts = [
    {
      body: "經營自媒體最重要的一件事：不是學更多技巧，而是先搞懂自己想說什麼。很多人問我，為什麼學了這麼多課程，還是不知道怎麼開始？因為你還沒找到自己的聲音。",
      contentType: "viewpoint" as const,
      reach: 12500,
      likes: 847,
      comments: 156,
      reposts: 45,
      saves: 234,
      isViral: true,
    },
    {
      body: "前幾天，有個學員私訊我。她說：「老師，我覺得自己不夠好。」我問她：「妳覺得什麼是『夠好』？」她想了很久，說不出來。這就是問題所在。",
      contentType: "story" as const,
      reach: 8900,
      likes: 523,
      comments: 89,
      reposts: 23,
      saves: 167,
      isViral: false,
    },
    {
      body: "3 個讓你的 Threads 貼文更有互動的技巧：1. 第一行要有鉤子 2. 用「你」開頭增加對話感 3. 結尾問一個開放式問題。試試看，效果會很明顯。",
      contentType: "knowledge" as const,
      reach: 15600,
      likes: 1023,
      comments: 234,
      reposts: 78,
      saves: 456,
      isViral: true,
    },
    {
      body: "今天心情有點低落。不是因為什麼大事，就是突然覺得，經營自媒體好累。但轉念一想，能做自己喜歡的事，已經很幸福了。你們有沒有這種時候？",
      contentType: "casual" as const,
      reach: 6700,
      likes: 412,
      comments: 178,
      reposts: 12,
      saves: 89,
      isViral: false,
    },
    {
      body: "90% 的人都搞錯了：成功不是賺多少錢，而是找到屬於自己的節奏。我以前在廣告公司，每天加班到半夜，身體搞壞了，人也變得焦慮。直到離職後才明白這個道理。",
      contentType: "contrast" as const,
      reach: 18200,
      likes: 1456,
      comments: 312,
      reposts: 89,
      saves: 567,
      isViral: true,
    },
    {
      body: "如果你正在考慮要不要開始經營自媒體，我的建議是：先開始，再說。不要等到準備好，因為你永遠不會覺得自己準備好。開始了，才會知道下一步該怎麼走。",
      contentType: "viewpoint" as const,
      reach: 9800,
      likes: 678,
      comments: 145,
      reposts: 34,
      saves: 289,
      isViral: false,
    },
  ];

  console.log("開始插入測試數據...");

  for (const testPost of testPosts) {
    // 1. 建立草稿
    const [draft] = await db.insert(draftPosts).values({
      userId,
      body: testPost.body,
      contentType: testPost.contentType,
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).$returningId();

    console.log(`建立草稿 ID: ${draft.id}`);

    // 2. 建立貼文記錄
    const postedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // 過去 30 天內隨機
    const [post] = await db.insert(posts).values({
      userId,
      draftPostId: draft.id,
      threadUrl: `https://www.threads.net/@test/post/${Math.random().toString(36).substring(7)}`,
      postedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).$returningId();

    console.log(`建立貼文 ID: ${post.id}`);

    // 3. 建立互動數據
    await db.insert(postMetrics).values({
      postId: post.id,
      capturedAt: new Date(),
      reach: testPost.reach,
      likes: testPost.likes,
      comments: testPost.comments,
      reposts: testPost.reposts,
      saves: testPost.saves,
      isViral: testPost.isViral,
    });

    console.log(`建立互動數據完成`);
  }

  console.log("測試數據插入完成！共插入 " + testPosts.length + " 篇貼文");
  process.exit(0);
}

seedTestPosts().catch(console.error);
