/**
 * 匯出所有已分類的爆款文章
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { viralExamples } from "../drizzle/schema.ts";
import { eq, desc } from "drizzle-orm";
import * as fs from "fs";

type ContentType = "knowledge" | "story" | "opinion" | "interaction" | "casual" | "diagnostic";

const typeNames: Record<ContentType, string> = {
  knowledge: "知識型",
  story: "故事型",
  opinion: "觀點型",
  interaction: "互動型",
  casual: "閒聊型",
  diagnostic: "診斷型"
};

async function main() {
  console.log("開始匯出已分類的爆款文章...\n");
  
  // 建立資料庫連線
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);
  
  // 取得所有爆款文章，按讚數排序
  const examples = await db.select().from(viralExamples).orderBy(desc(viralExamples.likes));
  console.log(`總共 ${examples.length} 篇爆款文章\n`);
  
  // 按類型分組
  const grouped: Record<ContentType, typeof examples> = {
    knowledge: [],
    story: [],
    opinion: [],
    interaction: [],
    casual: [],
    diagnostic: []
  };
  
  for (const example of examples) {
    const type = (example.contentType || "casual") as ContentType;
    if (grouped[type]) {
      grouped[type].push(example);
    } else {
      grouped.casual.push(example);
    }
  }
  
  // 生成 Markdown 文件
  let markdown = `# 爆款文章分類總覽\n\n`;
  markdown += `> 總共 ${examples.length} 篇爆款文章，按內容類型分類整理\n\n`;
  markdown += `## 分類統計\n\n`;
  markdown += `| 類型 | 數量 | 比例 |\n`;
  markdown += `|------|------|------|\n`;
  
  for (const type of Object.keys(grouped) as ContentType[]) {
    const count = grouped[type].length;
    const percent = (count / examples.length * 100).toFixed(1);
    markdown += `| ${typeNames[type]} (${type}) | ${count} 篇 | ${percent}% |\n`;
  }
  
  markdown += `\n---\n\n`;
  
  // 輸出每種類型的文章
  for (const type of Object.keys(grouped) as ContentType[]) {
    const articles = grouped[type];
    markdown += `## ${typeNames[type]}（${type}）- ${articles.length} 篇\n\n`;
    
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const likes = article.likes?.toLocaleString() || "0";
      const comments = article.comments?.toLocaleString() || "0";
      const charLen = article.charLen || 0;
      
      markdown += `### ${i + 1}. 讚數：${likes} | 留言：${comments} | 字數：${charLen}\n\n`;
      
      // 關鍵字
      if (article.keyword) {
        markdown += `**關鍵字**：${article.keyword}\n\n`;
      }
      
      // 完整內容
      markdown += `**內容**：\n\n`;
      markdown += `${article.postText || "(無內容)"}\n\n`;
      
      markdown += `---\n\n`;
    }
  }
  
  // 寫入文件
  const outputPath = "/home/ubuntu/爆款文章分類總覽.md";
  fs.writeFileSync(outputPath, markdown, "utf-8");
  console.log(`\n已匯出到：${outputPath}`);
  
  // 同時生成 CSV 格式
  let csv = "類型,類型中文,讚數,留言數,字數,關鍵字,開頭50字,完整內容\n";
  
  for (const type of Object.keys(grouped) as ContentType[]) {
    const articles = grouped[type];
    for (const article of articles) {
      const escapedContent = (article.postText || "").replace(/"/g, '""').replace(/\n/g, " ");
      const escapedOpener = (article.opener50 || "").replace(/"/g, '""').replace(/\n/g, " ");
      csv += `"${type}","${typeNames[type]}",${article.likes || 0},${article.comments || 0},${article.charLen || 0},"${article.keyword || ""}","${escapedOpener}","${escapedContent}"\n`;
    }
  }
  
  const csvPath = "/home/ubuntu/爆款文章分類總覽.csv";
  fs.writeFileSync(csvPath, csv, "utf-8");
  console.log(`已匯出 CSV 到：${csvPath}`);
  
  await connection.end();
  process.exit(0);
}

main().catch(console.error);
