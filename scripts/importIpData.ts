/**
 * 匯入 50 個 IP 帳號數據到資料庫
 */
import { getDb } from "../server/db";
import { ipAccounts, ipPosts } from "../drizzle/schema";
import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const UPLOAD_DIR = "/home/ubuntu/upload";

// IP 帳號領域分類
const IP_CATEGORIES: Record<string, { primary: string; sub: string }> = {
  "簡少年": { primary: "身心靈", sub: "命理玄學" },
  "大正｜紫微命盤分析": { primary: "身心靈", sub: "命理玄學" },
  "馬丁老師｜八字識人顧問": { primary: "身心靈", sub: "命理玄學" },
  "Anna安娜塔羅": { primary: "身心靈", sub: "命理玄學" },
  "喜真_能量管理": { primary: "身心靈", sub: "能量療癒" },
  "蘇予昕諮商心理師": { primary: "身心靈", sub: "心理諮商" },
  "周慕姿心理師": { primary: "身心靈", sub: "心理諮商" },
  "XuanShiuanLiu劉軒": { primary: "身心靈", sub: "心理諮商" },
  "海苔熊": { primary: "身心靈", sub: "心理諮商" },
  "雪力的心理學筆記": { primary: "身心靈", sub: "心理諮商" },
  "PetsMurMur寵物溝通": { primary: "身心靈", sub: "寵物溝通" },
  "艾兒莎": { primary: "身心靈", sub: "自我成長" },
  "Jasmine佳穎": { primary: "身心靈", sub: "自我成長" },
  "婕西l聲音表達教練": { primary: "身心靈", sub: "自我成長" },
  "自律派溫蒂": { primary: "身心靈", sub: "自我成長" },
  "林育聖": { primary: "自媒體", sub: "文案寫作" },
  "Willy自媒體AI顧問": { primary: "自媒體", sub: "AI應用" },
  "Threads脆行銷顧問世豐": { primary: "自媒體", sub: "社群行銷" },
  "瓦基｜閱讀前哨站": { primary: "閱讀", sub: "書評分享" },
  "推書手L": { primary: "閱讀", sub: "書評分享" },
  "有魚｜閱讀𝗑AI學習𝗑文字力": { primary: "閱讀", sub: "學習方法" },
  "蕾咪Rami🌍": { primary: "財經", sub: "投資理財" },
  "財女珍妮": { primary: "財經", sub: "投資理財" },
  "法律白話文運動": { primary: "法律", sub: "法律知識" },
  "我媽叫我不要創業": { primary: "創業", sub: "創業經驗" },
  "葳老闆｜周品均": { primary: "創業", sub: "創業經驗" },
  "尤魚學姐": { primary: "職場", sub: "職涯發展" },
  "我是S姐｜Web3職涯教練": { primary: "職場", sub: "職涯發展" },
  "侯智薰（雷蒙）": { primary: "生產力", sub: "效率工具" },
  "研究生Keith": { primary: "生產力", sub: "學習方法" },
  "KaminaliHayako神成迅子": { primary: "生活風格", sub: "日本文化" },
  "YingC.陳穎": { primary: "美食", sub: "甜點烘焙" },
  "EmilyChu空姐報報": { primary: "旅遊", sub: "航空旅遊" },
  "朱弟JudyChu": { primary: "生活風格", sub: "生活分享" },
  "𝐌𝐫.𝐃𝐞𝐫𝐞𝐤": { primary: "生活風格", sub: "生活分享" },
  "老獅說Lion": { primary: "商業", sub: "商業觀察" },
  "李靚蕾Jinglei": { primary: "生活風格", sub: "生活分享" },
  "陳修平": { primary: "身心靈", sub: "身心健康" },
  "樊松蒲Dennis-數據運營": { primary: "自媒體", sub: "數據分析" },
  "王可樂日語": { primary: "語言學習", sub: "日語教學" },
  "LeedsMayi里茲螞蟻": { primary: "語言學習", sub: "英語教學" },
  "無聊就學AILab": { primary: "自媒體", sub: "AI應用" },
  "AI.TJB偷吃步": { primary: "自媒體", sub: "AI應用" },
  "資訊學院techtip_s": { primary: "科技", sub: "科技新知" },
  "Willy": { primary: "自媒體", sub: "AI應用" },
  "BarbieChen": { primary: "生活風格", sub: "生活分享" },
  "Kim｜阿金！人生進化中": { primary: "自我成長", sub: "個人成長" },
  "鋼鐵V（薇琪）": { primary: "自媒體", sub: "社群經營" },
  "MannyLi(曼報)": { primary: "商業", sub: "商業觀察" },
  "Coach喬（George）": { primary: "運動健身", sub: "健身教練" },
};

async function importIpData() {
  console.log("開始匯入 50 個 IP 帳號數據...\n");

  // 取得資料庫連線
  const db = await getDb();

  // 取得所有 Excel 檔案
  const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith(".xlsx"));
  console.log(`找到 ${files.length} 個 Excel 檔案\n`);

  let totalPosts = 0;
  let totalAccounts = 0;

  for (const file of files) {
    const filePath = path.join(UPLOAD_DIR, file);
    
    // 從檔名提取帳號名稱（移除編號和副檔名）
    const accountName = file.replace(/^\d+_/, "").replace(".xlsx", "");
    
    console.log(`處理: ${accountName}`);

    try {
      // 讀取 Excel
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet) as any[];

      if (data.length === 0) {
        console.log(`  跳過（無數據）`);
        continue;
      }

      // 分析帳號數據
      const posts = data.filter(row => row["文章內容"] || row["貼文內容"] || row["content"] || row["text"]);
      const likes = posts.map(row => {
        const likeValue = row["讚數"] || row["愛心數"] || row["likes"] || 0;
        return typeof likeValue === "number" ? likeValue : parseInt(likeValue) || 0;
      });
      
      const viralPosts = likes.filter(l => l >= 1000).length;
      const avgLikes = likes.length > 0 ? Math.round(likes.reduce((a, b) => a + b, 0) / likes.length) : 0;
      
      // 計算平均字數
      const charLens = posts.map(row => {
        const content = row["文章內容"] || row["貼文內容"] || row["content"] || row["text"] || "";
        return content.length;
      });
      const avgCharLen = charLens.length > 0 ? Math.round(charLens.reduce((a, b) => a + b, 0) / charLens.length) : 0;

      // 計算成長率（比較前 20% 和後 20%）
      const parseDate = (dateStr: any): number => {
        if (!dateStr) return 0;
        try {
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        } catch { return 0; }
      };
      const sortedByDate = [...posts].sort((a, b) => {
        const dateA = parseDate(a["發布時間"] || a["發文日期"] || a["date"]);
        const dateB = parseDate(b["發布時間"] || b["發文日期"] || b["date"]);
        return dateA - dateB;
      });
      
      const earlyCount = Math.max(1, Math.floor(sortedByDate.length * 0.2));
      const recentCount = Math.max(1, Math.floor(sortedByDate.length * 0.2));
      
      const earlyPosts = sortedByDate.slice(0, earlyCount);
      const recentPosts = sortedByDate.slice(-recentCount);
      
      const earlyAvgLikes = earlyPosts.length > 0 
        ? Math.round(earlyPosts.reduce((sum, p) => sum + (parseInt(p["讚數"] || p["愛心數"] || p["likes"]) || 0), 0) / earlyPosts.length)
        : 0;
      const recentAvgLikes = recentPosts.length > 0
        ? Math.round(recentPosts.reduce((sum, p) => sum + (parseInt(p["讚數"] || p["愛心數"] || p["likes"]) || 0), 0) / recentPosts.length)
        : 0;
      
      const growthRate = earlyAvgLikes > 0 ? ((recentAvgLikes - earlyAvgLikes) / earlyAvgLikes * 100) : 0;

      // 分析風格特徵
      const shortPosts = posts.filter(p => (p["文章內容"] || p["貼文內容"] || p["content"] || p["text"] || "").length <= 100).length;
      const longPosts = posts.filter(p => (p["文章內容"] || p["貼文內容"] || p["content"] || p["text"] || "").length > 200).length;
      const storyPosts = posts.filter(p => (p["文章內容"] || p["貼文內容"] || p["content"] || p["text"] || "").startsWith("我")).length;
      const questionPosts = posts.filter(p => (p["文章內容"] || p["貼文內容"] || p["content"] || p["text"] || "").includes("？")).length;

      const contentMix = {
        shortPost: posts.length > 0 ? Math.round(shortPosts / posts.length * 100) : 0,
        longPost: posts.length > 0 ? Math.round(longPosts / posts.length * 100) : 0,
        storyPost: posts.length > 0 ? Math.round(storyPosts / posts.length * 100) : 0,
        questionPost: posts.length > 0 ? Math.round(questionPosts / posts.length * 100) : 0,
      };

      // 判斷風格類型
      let styleType = "混合型";
      if (contentMix.shortPost > 60) styleType = "短文型";
      else if (contentMix.longPost > 40) styleType = "長文型";
      else if (contentMix.storyPost > 30) styleType = "故事型";
      else if (contentMix.questionPost > 20) styleType = "提問型";

      // 取得領域分類
      const category = IP_CATEGORIES[accountName] || { primary: "其他", sub: "其他" };

      // 插入帳號資料
      const [insertedAccount] = await db.insert(ipAccounts).values({
        accountName,
        primaryCategory: category.primary,
        subCategory: category.sub,
        totalPosts: posts.length,
        viralPosts,
        viralRate: posts.length > 0 ? (viralPosts / posts.length).toFixed(4) : "0",
        avgLikes,
        avgCharLen,
        styleType,
        contentMix,
        growthRate: growthRate.toFixed(2),
        earlyAvgLikes,
        recentAvgLikes,
        sourceFile: file,
      });

      const accountId = insertedAccount.insertId;

      // 批量插入貼文（每批 100 筆）
      const batchSize = 100;
      for (let i = 0; i < posts.length; i += batchSize) {
        const batch = posts.slice(i, i + batchSize);
        const postValues = batch.map((row, idx) => {
          const content = row["文章內容"] || row["貼文內容"] || row["content"] || row["text"] || "";
          const likeValue = row["讚數"] || row["愛心數"] || row["likes"] || 0;
          const postLikes = typeof likeValue === "number" ? likeValue : parseInt(likeValue) || 0;
          
          return {
            accountId: Number(accountId),
            postText: content,
            opener50: content.slice(0, 50),
            charLen: content.length,
            likes: postLikes,
            comments: parseInt(row["留言數"] || row["comments"] || 0) || 0,
            shares: parseInt(row["分享數"] || row["shares"] || 0) || 0,
            reach: parseInt(row["觸及數"] || row["reach"] || 0) || 0,
            postDate: (() => {
              const dateStr = row["發布時間"] || row["發文日期"] || row["date"];
              if (!dateStr) return null;
              try {
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? null : d;
              } catch { return null; }
            })(),
            postUrl: row["貼文連結"] || row["url"] || null,
            isViral: postLikes >= 1000,
            isSuperViral: postLikes >= 5000,
            hasNumber: /\d/.test(content),
            hasQuestion: content.includes("？"),
            hasExclaim: content.includes("！"),
            startsWithI: content.startsWith("我"),
            startsWithYou: content.startsWith("你"),
            sourceFile: file,
            rowIndex: i + idx + 1,
          };
        });

        await db.insert(ipPosts).values(postValues);
      }

      totalPosts += posts.length;
      totalAccounts++;
      console.log(`  ✓ ${posts.length} 篇貼文，${viralPosts} 篇爆款（${(viralPosts/posts.length*100).toFixed(1)}%）`);

    } catch (error) {
      console.error(`  ✗ 錯誤: ${error}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`匯入完成！`);
  console.log(`總帳號數: ${totalAccounts}`);
  console.log(`總貼文數: ${totalPosts}`);
  console.log(`========================================`);
  
  process.exit(0);
}

importIpData().catch(console.error);
