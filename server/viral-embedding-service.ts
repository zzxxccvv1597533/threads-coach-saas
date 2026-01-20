/**
 * 爆款 Embedding 服務
 * 用於爆款資料庫的語意匹配和 K-means 聚類分析
 */

import { getDb } from "./db";
import { 
  viralExamples, 
  viralExampleEmbeddings, 
  viralClusters,
  viralExampleClusterMappings,
  ViralExample 
} from "../drizzle/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "./embedding-service";

// ============================================
// 爆款 Embedding 生成與儲存
// ============================================

/**
 * 為單個爆款範例生成並儲存 Embedding
 */
export async function generateAndSaveViralEmbedding(
  viralExample: ViralExample
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 使用完整內容生成 Embedding
  const embedding = await generateEmbedding(viralExample.postText);

  await db.insert(viralExampleEmbeddings).values({
    viralExampleId: viralExample.id,
    embedding: JSON.stringify(embedding),
    contentType: viralExample.contentType || null,
    keyword: viralExample.keyword,
  });
}

/**
 * 批量為爆款範例生成 Embedding
 * @param batchSize 每批處理數量
 * @param delayMs 每批之間的延遲（毫秒）
 */
export async function batchGenerateViralEmbeddings(
  batchSize: number = 50,
  delayMs: number = 100,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 取得所有爆款範例
  const allExamples = await db.select().from(viralExamples);
  
  // 取得已有 Embedding 的範例 ID
  const existingEmbeddings = await db
    .select({ viralExampleId: viralExampleEmbeddings.viralExampleId })
    .from(viralExampleEmbeddings);
  const existingIds = new Set(existingEmbeddings.map(e => e.viralExampleId));

  // 過濾出需要處理的範例
  const toProcess = allExamples.filter(e => !existingIds.has(e.id));
  
  let success = 0;
  let failed = 0;
  const skipped = existingIds.size;

  console.log(`[ViralEmbedding] 開始處理 ${toProcess.length} 筆爆款（已跳過 ${skipped} 筆）`);

  // 分批處理
  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);
    
    for (const example of batch) {
      try {
        await generateAndSaveViralEmbedding(example);
        success++;
      } catch (error) {
        console.error(`[ViralEmbedding] 處理失敗 ID=${example.id}:`, error);
        failed++;
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, toProcess.length), toProcess.length);
    }

    // 批次間延遲
    if (i + batchSize < toProcess.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[ViralEmbedding] 完成：成功 ${success}，失敗 ${failed}，跳過 ${skipped}`);
  return { success, failed, skipped };
}

// ============================================
// 語意相似度匹配
// ============================================

/**
 * 根據輸入內容找出最相似的爆款範例
 * @param inputText 輸入的文字（主題、素材等）
 * @param topK 返回前 K 個最相似的結果
 * @param contentType 可選的內容類型篩選
 */
export async function findSimilarViralExamples(
  inputText: string,
  topK: number = 5,
  contentType?: string
): Promise<Array<{
  viralExample: ViralExample;
  similarity: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  // 生成輸入文字的 Embedding
  const inputEmbedding = await generateEmbedding(inputText);

  // 取得所有爆款的 Embedding
  let query = db
    .select({
      embedding: viralExampleEmbeddings,
      viral: viralExamples,
    })
    .from(viralExampleEmbeddings)
    .innerJoin(viralExamples, eq(viralExampleEmbeddings.viralExampleId, viralExamples.id));

  // 如果指定了內容類型，加入篩選條件
  if (contentType) {
    query = query.where(eq(viralExampleEmbeddings.contentType, contentType)) as typeof query;
  }

  const results = await query;

  // 計算相似度並排序
  const withSimilarity = results.map(({ embedding, viral }) => ({
    viralExample: viral,
    similarity: cosineSimilarity(
      inputEmbedding,
      JSON.parse(embedding.embedding as string) as number[]
    ),
  }));

  // 按相似度排序並取前 K 個
  return withSimilarity
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * 根據主題和內容類型智能選取 Few-Shot 範例
 * 結合語意匹配和內容類型篩選
 */
export async function getSmartFewShotExamples(
  topic: string,
  contentType: string,
  maxExamples: number = 3
): Promise<Array<{
  postText: string;
  likes: number;
  similarity: number;
  matchReason: string;
}>> {
  // 先嘗試語意匹配 + 類型篩選
  let results = await findSimilarViralExamples(topic, maxExamples * 2, contentType);
  
  // 如果結果不足，放寬到只用語意匹配
  if (results.length < maxExamples) {
    const additionalResults = await findSimilarViralExamples(topic, maxExamples * 2);
    results = [...results, ...additionalResults.filter(
      r => !results.some(existing => existing.viralExample.id === r.viralExample.id)
    )];
  }

  // 過濾掉相似度太低的結果（閾值 0.3）
  const filtered = results.filter(r => r.similarity >= 0.3);

  return filtered.slice(0, maxExamples).map(r => ({
    postText: r.viralExample.postText,
    likes: r.viralExample.likes || 0,
    similarity: r.similarity,
    matchReason: r.viralExample.contentType === contentType 
      ? `類型匹配（${contentType}）+ 語意相似度 ${Math.round(r.similarity * 100)}%`
      : `語意相似度 ${Math.round(r.similarity * 100)}%`,
  }));
}

// ============================================
// K-means 聚類分析
// ============================================

/**
 * 執行 K-means 聚類
 * @param k 聚類數量
 * @param maxIterations 最大迭代次數
 */
export async function performKMeansClustering(
  k: number = 12,
  maxIterations: number = 100
): Promise<{
  clusters: Array<{
    clusterId: number;
    centroid: number[];
    memberIds: number[];
    size: number;
  }>;
  iterations: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 取得所有爆款的 Embedding
  const allEmbeddings = await db
    .select({
      id: viralExampleEmbeddings.viralExampleId,
      embedding: viralExampleEmbeddings.embedding,
    })
    .from(viralExampleEmbeddings);

  if (allEmbeddings.length === 0) {
    throw new Error("No embeddings found. Please run batch embedding first.");
  }

  // 解析 Embedding 向量
  const vectors = allEmbeddings.map(e => ({
    id: e.id,
    vector: JSON.parse(e.embedding as string) as number[],
  }));

  const dimension = vectors[0].vector.length;

  // 初始化聚類中心（隨機選取 k 個樣本）
  const shuffled = [...vectors].sort(() => Math.random() - 0.5);
  let centroids = shuffled.slice(0, k).map(v => [...v.vector]);

  // 分配結果
  let assignments: number[] = new Array(vectors.length).fill(0);
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    let changed = false;

    // 步驟 1：分配每個樣本到最近的聚類中心
    for (let i = 0; i < vectors.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let c = 0; c < k; c++) {
        const dist = euclideanDistance(vectors[i].vector, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }

      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    // 如果沒有變化，提前結束
    if (!changed) {
      console.log(`[K-means] 收斂於第 ${iterations} 次迭代`);
      break;
    }

    // 步驟 2：更新聚類中心
    const newCentroids: number[][] = [];
    for (let c = 0; c < k; c++) {
      const members = vectors.filter((_, i) => assignments[i] === c);
      if (members.length === 0) {
        // 空聚類：隨機重新初始化
        newCentroids.push([...shuffled[Math.floor(Math.random() * shuffled.length)].vector]);
      } else {
        // 計算平均值
        const mean = new Array(dimension).fill(0);
        for (const member of members) {
          for (let d = 0; d < dimension; d++) {
            mean[d] += member.vector[d];
          }
        }
        for (let d = 0; d < dimension; d++) {
          mean[d] /= members.length;
        }
        newCentroids.push(mean);
      }
    }
    centroids = newCentroids;
  }

  // 整理聚類結果
  const clusters = centroids.map((centroid, clusterId) => {
    const memberIds = vectors
      .filter((_, i) => assignments[i] === clusterId)
      .map(v => v.id);
    return {
      clusterId,
      centroid,
      memberIds,
      size: memberIds.length,
    };
  });

  return { clusters, iterations };
}

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

/**
 * 儲存聚類結果到資料庫
 */
export async function saveClusteringResults(
  clusters: Array<{
    clusterId: number;
    centroid: number[];
    memberIds: number[];
    size: number;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 清空舊的聚類結果
  await db.delete(viralClusters);
  await db.delete(viralExampleClusterMappings);

  // 為每個聚類計算統計資訊
  for (const cluster of clusters) {
    if (cluster.size === 0) continue;

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

    // 儲存範例與聚類的關聯
    for (const memberId of cluster.memberIds) {
      const member = members.find(m => m.id === memberId);
      if (!member) continue;

      // 計算與聚類中心的距離
      const memberEmbedding = await db
        .select({ embedding: viralExampleEmbeddings.embedding })
        .from(viralExampleEmbeddings)
        .where(eq(viralExampleEmbeddings.viralExampleId, memberId))
        .limit(1);

      if (memberEmbedding.length > 0) {
        const distance = euclideanDistance(
          JSON.parse(memberEmbedding[0].embedding as string) as number[],
          cluster.centroid
        );

        await db.insert(viralExampleClusterMappings).values({
          viralExampleId: memberId,
          clusterId: cluster.clusterId,
          distance: distance.toFixed(6),
        });
      }
    }
  }

  console.log(`[K-means] 已儲存 ${clusters.length} 個聚類結果`);
}

/**
 * 取得聚類分析摘要
 */
export async function getClusteringSummary(): Promise<Array<{
  clusterId: number;
  size: number;
  avgLikes: number;
  avgCharLen: number;
  dominantContentType: string;
  topKeywords: string[];
  formulaName?: string;
  formulaDescription?: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  const clusters = await db
    .select()
    .from(viralClusters)
    .orderBy(desc(viralClusters.size));

  return clusters.map(c => ({
    clusterId: c.clusterId,
    size: c.size,
    avgLikes: c.avgLikes || 0,
    avgCharLen: c.avgCharLen || 0,
    dominantContentType: c.dominantContentType || 'unknown',
    topKeywords: c.topKeywords ? JSON.parse(c.topKeywords as string) : [],
    formulaName: c.formulaName || undefined,
    formulaDescription: c.formulaDescription || undefined,
  }));
}

/**
 * 取得聚類的代表性範例（最接近聚類中心的 N 個）
 */
export async function getClusterRepresentatives(
  clusterId: number,
  topN: number = 3
): Promise<ViralExample[]> {
  const db = await getDb();
  if (!db) return [];

  // 取得該聚類中距離最近的範例
  const mappings = await db
    .select({
      viralExampleId: viralExampleClusterMappings.viralExampleId,
      distance: viralExampleClusterMappings.distance,
    })
    .from(viralExampleClusterMappings)
    .where(eq(viralExampleClusterMappings.clusterId, clusterId))
    .orderBy(viralExampleClusterMappings.distance)
    .limit(topN);

  if (mappings.length === 0) return [];

  const exampleIds = mappings.map(m => m.viralExampleId);
  const examples = await db
    .select()
    .from(viralExamples)
    .where(inArray(viralExamples.id, exampleIds));

  // 按距離排序
  return examples.sort((a, b) => {
    const distA = mappings.find(m => m.viralExampleId === a.id)?.distance || '999';
    const distB = mappings.find(m => m.viralExampleId === b.id)?.distance || '999';
    return parseFloat(distA) - parseFloat(distB);
  });
}

// ============================================
// Embedding 統計
// ============================================

/**
 * 取得 Embedding 統計資訊
 */
export async function getEmbeddingStats(): Promise<{
  totalViralExamples: number;
  embeddedCount: number;
  pendingCount: number;
  clusterCount: number;
  estimatedCost: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalViralExamples: 0,
      embeddedCount: 0,
      pendingCount: 0,
      clusterCount: 0,
      estimatedCost: 0,
    };
  }

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(viralExamples);

  const [embeddedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(viralExampleEmbeddings);

  const [clusterResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(viralClusters);

  const totalViralExamples = totalResult?.count || 0;
  const embeddedCount = embeddedResult?.count || 0;
  const pendingCount = totalViralExamples - embeddedCount;
  const clusterCount = clusterResult?.count || 0;

  // 使用本地特徵提取，成本為 0
  const estimatedCost = 0;

  return {
    totalViralExamples,
    embeddedCount,
    pendingCount,
    clusterCount,
    estimatedCost,
  };
}
