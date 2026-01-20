/**
 * K-means 聚類分析腳本（優化版）
 * 
 * 使用方式：
 * pnpm tsx scripts/runKMeansClustering.ts
 */

import { 
  performKMeansClustering, 
  getEmbeddingStats
} from "../server/viral-embedding-service";
import { invokeLLM } from "../server/_core/llm";
import { getDb } from "../server/db";
import { viralClusters, viralExampleClusterMappings, viralExamples, viralExampleEmbeddings } from "../drizzle/schema";
import { eq, inArray, desc } from "drizzle-orm";

/**
 * 計算歐幾里得距離
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

async function main() {
  console.log("=".repeat(60));
  console.log("K-means 聚類分析");
  console.log("=".repeat(60));

  // 檢查 Embedding 狀態
  const stats = await getEmbeddingStats();
  console.log("\n📊 Embedding 狀態：");
  console.log(`  - 總爆款數量：${stats.totalViralExamples}`);
  console.log(`  - 已生成 Embedding：${stats.embeddedCount}`);

  if (stats.embeddedCount === 0) {
    console.log("\n❌ 尚未生成 Embedding，請先執行 generateViralEmbeddings.ts");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.log("\n❌ 資料庫連線失敗");
    process.exit(1);
  }

  // 執行 K-means 聚類
  console.log("\n🔄 執行 K-means 聚類（K=12）...");
  const startTime = Date.now();
  
  const { clusters, iterations } = await performKMeansClustering(12, 100);
  
  const clusterTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ 聚類完成，共 ${iterations} 次迭代，耗時 ${clusterTime} 秒`);

  // 清空舊的聚類結果
  console.log("\n💾 清空舊的聚類結果...");
  await db.delete(viralExampleClusterMappings);
  await db.delete(viralClusters);

  // 儲存聚類結果（優化版：批量處理）
  console.log("\n💾 儲存聚類結果...");
  
  for (const cluster of clusters) {
    if (cluster.size === 0) continue;
    
    console.log(`  處理群組 ${cluster.clusterId}（${cluster.size} 篇）...`);

    // 取得該聚類的爆款範例
    const members = await db
      .select()
      .from(viralExamples)
      .where(inArray(viralExamples.id, cluster.memberIds));

    // 計算統計資訊
    const avgLikes = Math.round(
      members.reduce((sum, m) => sum + (m.likes || 0), 0) / members.length
    );
    const avgCharLen = Math.round(
      members.reduce((sum, m) => sum + (m.charLen || 0), 0) / members.length
    );

    // 統計內容類型分布
    const typeCounts: Record<string, number> = {};
    for (const m of members) {
      const type = m.contentType || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    const dominantContentType = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    // 統計關鍵字分布
    const keywordCounts: Record<string, number> = {};
    for (const m of members) {
      const kw = m.keyword || 'unknown';
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    }
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);

    // 儲存聚類資訊
    await db.insert(viralClusters).values({
      clusterId: cluster.clusterId,
      centroid: JSON.stringify(cluster.centroid),
      size: cluster.size,
      topKeywords: JSON.stringify(topKeywords),
      avgLikes,
      avgCharLen,
      dominantContentType,
    });

    // 批量取得所有成員的 Embedding
    const memberEmbeddings = await db
      .select({
        viralExampleId: viralExampleEmbeddings.viralExampleId,
        embedding: viralExampleEmbeddings.embedding,
      })
      .from(viralExampleEmbeddings)
      .where(inArray(viralExampleEmbeddings.viralExampleId, cluster.memberIds));

    // 批量準備 mapping 資料
    const mappings = memberEmbeddings.map(me => {
      const distance = euclideanDistance(
        JSON.parse(me.embedding as string) as number[],
        cluster.centroid
      );
      return {
        viralExampleId: me.viralExampleId,
        clusterId: cluster.clusterId,
        distance: distance.toFixed(6),
      };
    });

    // 批量插入 mappings（每 100 筆一批）
    for (let i = 0; i < mappings.length; i += 100) {
      const batch = mappings.slice(i, i + 100);
      await db.insert(viralExampleClusterMappings).values(batch);
    }
  }

  console.log("\n✅ 聚類結果儲存完成！");

  // 取得聚類摘要
  const summary = await db
    .select()
    .from(viralClusters)
    .orderBy(desc(viralClusters.size));

  console.log("\n📈 聚類摘要：");
  for (const cluster of summary) {
    const keywords = cluster.topKeywords ? JSON.parse(cluster.topKeywords as string) : [];
    console.log(`  群組 ${cluster.clusterId}：${cluster.size} 篇，平均 ${cluster.avgLikes} 讚，關鍵字：${keywords.slice(0, 3).join('、')}`);
  }

  // 使用 LLM 提煉爆款公式
  console.log("\n🤖 使用 LLM 提煉爆款公式...");
  
  for (const cluster of summary) {
    if (cluster.size < 5) continue; // 跳過太小的聚類
    
    console.log(`\n分析群組 ${cluster.clusterId}（${cluster.size} 篇）...`);
    
    // 取得代表性範例（距離最近的 5 個）
    const mappings = await db
      .select({
        viralExampleId: viralExampleClusterMappings.viralExampleId,
      })
      .from(viralExampleClusterMappings)
      .where(eq(viralExampleClusterMappings.clusterId, cluster.clusterId))
      .orderBy(viralExampleClusterMappings.distance)
      .limit(5);

    if (mappings.length === 0) {
      console.log(`  跳過（無代表性範例）`);
      continue;
    }

    const representatives = await db
      .select()
      .from(viralExamples)
      .where(inArray(viralExamples.id, mappings.map(m => m.viralExampleId)));

    // 準備範例文字
    const examplesText = representatives
      .map((r, i) => `【範例 ${i + 1}】（${r.likes || 0} 讚）\n${r.postText.substring(0, 300)}...`)
      .join("\n\n");

    const keywords = cluster.topKeywords ? JSON.parse(cluster.topKeywords as string) : [];

    // 調用 LLM 分析
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `你是一位專業的社群內容分析師，專門研究 Threads 爆款貼文的模式。
請分析以下同一群組的爆款貼文，提煉出它們的共同「爆款公式」。

輸出格式（JSON）：
{
  "formulaName": "公式名稱（簡短有力，例如：反差揭露法、情緒共鳴法）",
  "formulaDescription": "公式描述（100字內，說明這個公式的核心邏輯）",
  "formulaExample": "公式範例（提供一個可套用的開頭模板）"
}`
          },
          {
            role: "user",
            content: `群組特徵：
- 主要內容類型：${cluster.dominantContentType}
- 高頻關鍵字：${keywords.join('、')}
- 平均讚數：${cluster.avgLikes}
- 平均字數：${cluster.avgCharLen}

代表性範例：
${examplesText}

請提煉這個群組的爆款公式。`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "viral_formula",
            strict: true,
            schema: {
              type: "object",
              properties: {
                formulaName: { type: "string", description: "公式名稱" },
                formulaDescription: { type: "string", description: "公式描述" },
                formulaExample: { type: "string", description: "公式範例" }
              },
              required: ["formulaName", "formulaDescription", "formulaExample"],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content === 'string') {
        const formula = JSON.parse(content);
        
        // 更新資料庫
        await db.update(viralClusters)
          .set({
            formulaName: formula.formulaName,
            formulaDescription: formula.formulaDescription,
            formulaExample: formula.formulaExample,
          })
          .where(eq(viralClusters.clusterId, cluster.clusterId));

        console.log(`  ✅ ${formula.formulaName}`);
        console.log(`     ${formula.formulaDescription.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error(`  ❌ 分析失敗:`, error);
    }
  }

  // 最終摘要
  const finalSummary = await db
    .select()
    .from(viralClusters)
    .orderBy(desc(viralClusters.size));

  console.log("\n" + "=".repeat(60));
  console.log("📊 最終結果：");
  console.log("=".repeat(60));
  
  for (const cluster of finalSummary) {
    if (cluster.formulaName) {
      console.log(`\n【${cluster.formulaName}】（${cluster.size} 篇，平均 ${cluster.avgLikes} 讚）`);
      console.log(`  ${cluster.formulaDescription}`);
      console.log(`  範例：${cluster.formulaExample?.substring(0, 50)}...`);
    }
  }

  console.log("\n✅ 聚類分析完成！");
  process.exit(0);
}

main().catch(error => {
  console.error("執行失敗：", error);
  process.exit(1);
});
