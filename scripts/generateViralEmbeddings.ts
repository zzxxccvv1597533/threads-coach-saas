/**
 * 爆款 Embedding 批量生成腳本
 * 
 * 使用方式：
 * pnpm tsx scripts/generateViralEmbeddings.ts
 * 
 * 預估成本：
 * - 1,240 篇爆款 × 700 tokens/篇 ≈ 868,000 tokens
 * - text-embedding-3-small: $0.00002/1K tokens
 * - 總成本 ≈ $0.02（約 0.6 台幣）
 */

import { 
  batchGenerateViralEmbeddings, 
  getEmbeddingStats 
} from "../server/viral-embedding-service";

async function main() {
  console.log("=".repeat(60));
  console.log("爆款 Embedding 批量生成");
  console.log("=".repeat(60));

  // 檢查當前狀態
  const stats = await getEmbeddingStats();
  console.log("\n📊 當前狀態：");
  console.log(`  - 總爆款數量：${stats.totalViralExamples}`);
  console.log(`  - 已生成 Embedding：${stats.embeddedCount}`);
  console.log(`  - 待處理：${stats.pendingCount}`);
  console.log(`  - 預估成本：$${stats.estimatedCost.toFixed(4)}`);

  if (stats.pendingCount === 0) {
    console.log("\n✅ 所有爆款已完成 Embedding 生成！");
    process.exit(0);
  }

  console.log("\n🚀 開始批量生成 Embedding...");
  console.log("（每批 10 筆，間隔 500ms）\n");

  const startTime = Date.now();

  const result = await batchGenerateViralEmbeddings(
    10, // 每批 10 筆
    500, // 間隔 500ms
    (current, total) => {
      const progress = Math.round((current / total) * 100);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r進度：${current}/${total} (${progress}%) - 已用時 ${elapsed}s`);
    }
  );

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n\n" + "=".repeat(60));
  console.log("📈 執行結果：");
  console.log(`  - 成功：${result.success}`);
  console.log(`  - 失敗：${result.failed}`);
  console.log(`  - 跳過（已存在）：${result.skipped}`);
  console.log(`  - 總耗時：${totalTime} 秒`);
  console.log("=".repeat(60));

  // 再次檢查狀態
  const finalStats = await getEmbeddingStats();
  console.log("\n📊 最終狀態：");
  console.log(`  - 已生成 Embedding：${finalStats.embeddedCount}/${finalStats.totalViralExamples}`);
  console.log(`  - 完成率：${Math.round((finalStats.embeddedCount / finalStats.totalViralExamples) * 100)}%`);

  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error("執行失敗：", error);
  process.exit(1);
});
