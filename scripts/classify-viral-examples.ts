/**
 * 爆款文章內容類型分類腳本
 * 使用規則分類 1,240 篇爆款文章
 */

import { drizzle } from "drizzle-orm/mysql2";
import { viralExamples } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";

type ContentType = "knowledge" | "story" | "opinion" | "interaction" | "casual" | "diagnostic";

// 分類規則
function classifyContent(postText: string, opener50: string | null, charLen: number | null, hasNumber: boolean | null, questionMark: boolean | null, iFlag: boolean | null, ctaFlag: boolean | null): ContentType {
  const text = postText || "";
  const opener = opener50 || "";
  const length = charLen || text.length;
  
  // 規則 1：互動型（提問、投票）
  const hasQuestionInOpener = opener.includes("？") || opener.includes("?");
  const hasVotePattern = /[AB]選|二選一|選哪|你會選|你選|投票|哪一個|哪個/.test(text);
  const hasYouPattern = /^你/.test(opener) || /你覺得|你認為|你會|你有沒有|你是不是/.test(opener);
  
  if ((hasQuestionInOpener && length < 300) || hasVotePattern) {
    return "interaction";
  }
  
  // 規則 2：知識型（教學、清單、總結）
  const hasListPattern = /[1-9][\.、\)]|第[一二三四五六七八九十]|✅|✨|🔮|📌|💡/.test(text);
  const hasTeachPattern = /教你|分享|整理|方法|步驟|技巧|秘訣|攻略|懶人包|重點|必看|必學/.test(text);
  const hasNumberInOpener = hasNumber === true;
  
  if ((hasListPattern && length > 350) || (hasTeachPattern && hasNumberInOpener)) {
    return "knowledge";
  }
  
  // 規則 3：診斷型（分析、檢測）
  const hasDiagnosticPattern = /測試|檢測|診斷|看看你|測一測|你是哪種|屬於哪|是不是|有沒有中/.test(text);
  
  if (hasDiagnosticPattern) {
    return "diagnostic";
  }
  
  // 規則 4：故事型（個人經歷、觀察）
  const startsWithI = /^我/.test(opener);
  const hasStoryPattern = /我曾經|我以前|我記得|那天|那時候|後來|結果|沒想到|突然|終於/.test(text);
  const hasEmotionPattern = /感動|難過|開心|驚訝|害怕|焦慮|崩潰|療癒|溫暖/.test(text);
  
  if ((startsWithI && hasStoryPattern) || (iFlag === true && hasEmotionPattern && length > 300)) {
    return "story";
  }
  
  // 規則 5：觀點型（反差、金句）
  const hasContrastPattern = /不是.*而是|但是|其實|真相是|事實上|很多人以為|大家都說|別再/.test(text);
  const hasOpinionPattern = /我認為|我覺得|我相信|我堅持|我反對|我支持/.test(text);
  
  if (hasContrastPattern || hasOpinionPattern) {
    return "opinion";
  }
  
  // 規則 6：閒聊型（日常分享）
  if (length < 200 && !hasListPattern && !hasTeachPattern) {
    return "casual";
  }
  
  // 規則 7：以「我」開頭的長文傾向故事型
  if (startsWithI && length > 250) {
    return "story";
  }
  
  // 規則 8：有問號結尾傾向互動型
  if (hasYouPattern && questionMark === true) {
    return "interaction";
  }
  
  // 規則 9：有 CTA 且有列表傾向知識型
  if (ctaFlag === true && hasListPattern) {
    return "knowledge";
  }
  
  // 預設：根據長度判斷
  if (length > 400) {
    return "knowledge";
  } else if (length > 250) {
    return "story";
  } else {
    return "casual";
  }
}

async function main() {
  console.log("開始分類爆款文章...\n");
  
  // 直接建立資料庫連線
  const db = drizzle(process.env.DATABASE_URL!);
  
  // 取得所有爆款文章
  const examples = await db.select().from(viralExamples);
  console.log(`總共 ${examples.length} 篇爆款文章\n`);
  
  // 統計
  const stats: Record<ContentType, number> = {
    knowledge: 0,
    story: 0,
    opinion: 0,
    interaction: 0,
    casual: 0,
    diagnostic: 0
  };
  
  // 批量更新
  let updated = 0;
  for (const example of examples) {
    const contentType = classifyContent(
      example.postText,
      example.opener50,
      example.charLen,
      example.hasNumber,
      example.questionMark,
      example.iFlag,
      example.ctaFlag
    );
    
    stats[contentType]++;
    
    // 更新資料庫
    await db.update(viralExamples)
      .set({ contentType: contentType as any })
      .where(eq(viralExamples.id, example.id));
    
    updated++;
    if (updated % 100 === 0) {
      console.log(`已處理 ${updated}/${examples.length} 篇...`);
    }
  }
  
  console.log(`\n分類完成！共更新 ${updated} 篇\n`);
  
  // 輸出統計
  console.log("=== 分類統計 ===");
  console.log(`知識型 (knowledge)：${stats.knowledge} 篇 (${(stats.knowledge / examples.length * 100).toFixed(1)}%)`);
  console.log(`故事型 (story)：${stats.story} 篇 (${(stats.story / examples.length * 100).toFixed(1)}%)`);
  console.log(`觀點型 (opinion)：${stats.opinion} 篇 (${(stats.opinion / examples.length * 100).toFixed(1)}%)`);
  console.log(`互動型 (interaction)：${stats.interaction} 篇 (${(stats.interaction / examples.length * 100).toFixed(1)}%)`);
  console.log(`閒聊型 (casual)：${stats.casual} 篇 (${(stats.casual / examples.length * 100).toFixed(1)}%)`);
  console.log(`診斷型 (diagnostic)：${stats.diagnostic} 篇 (${(stats.diagnostic / examples.length * 100).toFixed(1)}%)`);
  
  // 輸出每種類型的範例
  console.log("\n=== 各類型範例（供人工校正參考）===\n");
  
  for (const type of Object.keys(stats) as ContentType[]) {
    const sample = examples.find(e => classifyContent(e.postText, e.opener50, e.charLen, e.hasNumber, e.questionMark, e.iFlag, e.ctaFlag) === type);
    if (sample) {
      console.log(`【${type}】`);
      console.log(`開頭：${sample.opener50?.substring(0, 50)}...`);
      console.log(`讚數：${sample.likes}`);
      console.log("");
    }
  }
  
  process.exit(0);
}

main().catch(console.error);
