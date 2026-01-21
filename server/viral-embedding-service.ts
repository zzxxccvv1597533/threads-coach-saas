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
import { expandSemanticKeywords } from "./semantic-expansion-service";

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
 * @param useSemanticExpansion 是否使用語意擴展（預設 true）
 */
export async function findSimilarViralExamples(
  inputText: string,
  topK: number = 5,
  contentType?: string,
  useSemanticExpansion: boolean = true
): Promise<Array<{
  viralExample: ViralExample;
  similarity: number;
  matchedKeyword?: string;
}>> {
  const db = await getDb();
  if (!db) return [];

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

  // 如果啟用語意擴展，用多個關鍵詞匹配
  if (useSemanticExpansion) {
    const expandedKeywords = await expandSemanticKeywords(inputText);
    console.log(`[語意擴展] "${inputText}" → ${expandedKeywords.join(", ")}`);
    
    // 為每個關鍵詞生成 Embedding 並匹配
    const allMatches: Array<{
      viralExample: ViralExample;
      similarity: number;
      matchedKeyword: string;
    }> = [];

    for (const keyword of expandedKeywords) {
      const keywordEmbedding = await generateEmbedding(keyword);
      
      for (const { embedding, viral } of results) {
        const similarity = cosineSimilarity(
          keywordEmbedding,
          JSON.parse(embedding.embedding as string) as number[]
        );
        
        allMatches.push({
          viralExample: viral,
          similarity,
          matchedKeyword: keyword,
        });
      }
    }

    // 去重（同一個爆款可能被多個關鍵詞匹配到，保留最高相似度）
    const uniqueMatches = new Map<number, typeof allMatches[0]>();
    for (const match of allMatches) {
      const existing = uniqueMatches.get(match.viralExample.id);
      if (!existing || match.similarity > existing.similarity) {
        uniqueMatches.set(match.viralExample.id, match);
      }
    }

    // 排序並返回
    return Array.from(uniqueMatches.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // 不使用語意擴展，直接匹配
  const inputEmbedding = await generateEmbedding(inputText);
  
  const withSimilarity = results.map(({ embedding, viral }) => ({
    viralExample: viral,
    similarity: cosineSimilarity(
      inputEmbedding,
      JSON.parse(embedding.embedding as string) as number[]
    ),
  }));

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


// ============================================
// 類型智能推薦
// ============================================

/**
 * 根據主題分析相似爆款的類型分佈，推薦最適合的內容類型
 * @param topic 輸入的主題
 * @param topK 查詢的相似爆款數量
 */
export async function getContentTypeRecommendation(
  topic: string,
  topK: number = 20
): Promise<{
  recommendations: Array<{
    contentType: string;
    contentTypeName: string;
    count: number;
    percentage: number;
    avgLikes: number;
    isRecommended: boolean;
    reason: string;
  }>;
  totalMatched: number;
  topicRelevance: 'high' | 'medium' | 'low';
}> {
  // 先找出相似的爆款
  const similarExamples = await findSimilarViralExamples(topic, topK, undefined, true);
  
  if (similarExamples.length === 0) {
    return {
      recommendations: [],
      totalMatched: 0,
      topicRelevance: 'low',
    };
  }
  
  // 計算最高相似度，判斷主題相關性
  const maxSimilarity = Math.max(...similarExamples.map(ex => ex.similarity));
  const topicRelevance = maxSimilarity >= 0.6 ? 'high' : maxSimilarity >= 0.4 ? 'medium' : 'low';
  
  // 統計各類型的數量和平均讚數
  const typeStats = new Map<string, { count: number; totalLikes: number }>();
  
  for (const example of similarExamples) {
    const contentType = example.viralExample.contentType || 'unknown';
    const likes = example.viralExample.likes || 0;
    
    const existing = typeStats.get(contentType) || { count: 0, totalLikes: 0 };
    typeStats.set(contentType, {
      count: existing.count + 1,
      totalLikes: existing.totalLikes + likes,
    });
  }
  
  // 類型名稱對照表
  const typeNames: Record<string, string> = {
    story: '故事型',
    knowledge: '知識型',
    opinion: '觀點型',
    dialogue: '對話型',
    list: '清單型',
    question: '提問型',
    unknown: '其他',
  };
  
  // 轉換為推薦列表
  const recommendations = Array.from(typeStats.entries())
    .map(([contentType, stats]) => ({
      contentType,
      contentTypeName: typeNames[contentType] || contentType,
      count: stats.count,
      percentage: Math.round((stats.count / similarExamples.length) * 100),
      avgLikes: Math.round(stats.totalLikes / stats.count),
      isRecommended: false,
      reason: '',
    }))
    .sort((a, b) => b.count - a.count);
  
  // 標記推薦項目（數量最多且平均讚數不低於平均值的類型）
  if (recommendations.length > 0) {
    const avgLikesOverall = recommendations.reduce((sum, r) => sum + r.avgLikes * r.count, 0) / similarExamples.length;
    
    // 找出數量最多的類型
    const maxCount = recommendations[0].count;
    
    // 在數量最多的類型中，選擇平均讚數最高的
    const topTypes = recommendations.filter(r => r.count === maxCount);
    const bestType = topTypes.sort((a, b) => b.avgLikes - a.avgLikes)[0];
    
    if (bestType) {
      bestType.isRecommended = true;
      bestType.reason = `在 ${similarExamples.length} 篇相似爆款中，${bestType.contentTypeName}佔 ${bestType.percentage}%，平均 ${bestType.avgLikes.toLocaleString()} 讚`;
    }
  }
  
  return {
    recommendations,
    totalMatched: similarExamples.length,
    topicRelevance,
  };
}

/**
 * 獲取特定類型的相似爆款範例
 * @param topic 主題
 * @param contentType 內容類型
 * @param limit 返回數量
 */
export async function getSimilarViralsByType(
  topic: string,
  contentType: string,
  limit: number = 3
): Promise<Array<{
  opener: string;
  likes: number;
  similarity: number;
}>> {
  const similarExamples = await findSimilarViralExamples(topic, 20, contentType, true);
  
  return similarExamples.slice(0, limit).map(ex => ({
    opener: ex.viralExample.opener50 || (ex.viralExample.postText || '').substring(0, 50),
    likes: ex.viralExample.likes || 0,
    similarity: ex.similarity,
  }));
}


// ============================================
// 今日高潛力推薦
// ============================================

/**
 * 根據用戶領域和近期爆款趨勢，推薦高潛力選題
 * @param userDomain 用戶領域
 * @param existingTopics 用戶已發過的主題（避免重複）
 * @param count 推薦數量
 */
export async function getHighPotentialTopics(
  userDomain: string,
  existingTopics: string[] = [],
  count: number = 5
): Promise<Array<{
  topic: string;
  reason: string;
  relatedVirals: Array<{
    opener: string;
    likes: number;
  }>;
  suggestedType: string;
  suggestedTypeName: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  // 從爆款庫中找出與用戶領域相關的高讚爆款
  const domainKeywords = getDomainKeywords(userDomain);
  
  // 用領域關鍵字搜尋相關爆款
  const relatedVirals: Array<{
    viralExample: ViralExample;
    similarity: number;
    matchedKeyword?: string;
  }> = [];
  
  for (const keyword of domainKeywords.slice(0, 3)) {
    const examples = await findSimilarViralExamples(keyword, 10, undefined, true);
    relatedVirals.push(...examples);
  }
  
  // 去重並按讚數排序
  const uniqueVirals = new Map<number, typeof relatedVirals[0]>();
  for (const viral of relatedVirals) {
    const existing = uniqueVirals.get(viral.viralExample.id);
    if (!existing || (viral.viralExample.likes || 0) > (existing.viralExample.likes || 0)) {
      uniqueVirals.set(viral.viralExample.id, viral);
    }
  }
  
  const sortedVirals = Array.from(uniqueVirals.values())
    .sort((a, b) => (b.viralExample.likes || 0) - (a.viralExample.likes || 0))
    .slice(0, 30);
  
  // 從爆款中提取主題方向
  const topicSuggestions: Array<{
    topic: string;
    reason: string;
    relatedVirals: Array<{ opener: string; likes: number }>;
    suggestedType: string;
    suggestedTypeName: string;
  }> = [];
  
  // 類型名稱對照表
  const typeNames: Record<string, string> = {
    story: '故事型',
    knowledge: '知識型',
    opinion: '觀點型',
    dialogue: '對話型',
    list: '清單型',
    question: '提問型',
  };
  
  // 根據爆款內容生成主題建議
  const usedTopics = new Set(existingTopics.map(t => t.toLowerCase()));
  
  for (const viral of sortedVirals) {
    if (topicSuggestions.length >= count) break;
    
    // 從爆款開頭提取主題方向
    const opener = viral.viralExample.opener50 || (viral.viralExample.postText || '').substring(0, 50);
    const contentType = viral.viralExample.contentType || 'story';
    
    // 生成主題建議（基於爆款的關鍵詞）
    const topicHint = extractTopicFromOpener(opener, userDomain);
    
    // 避免重複主題
    if (usedTopics.has(topicHint.toLowerCase())) continue;
    usedTopics.add(topicHint.toLowerCase());
    
    topicSuggestions.push({
      topic: topicHint,
      reason: `相似爆款獲得 ${(viral.viralExample.likes || 0).toLocaleString()} 讚`,
      relatedVirals: [{
        opener: opener,
        likes: viral.viralExample.likes || 0,
      }],
      suggestedType: contentType,
      suggestedTypeName: typeNames[contentType] || contentType,
    });
  }
  
  return topicSuggestions;
}

/**
 * 根據領域取得相關關鍵字
 */
function getDomainKeywords(domain: string): string[] {
  const domainKeywordMap: Record<string, string[]> = {
    '身心靈': ['冥想', '覺察', '療癒', '內在', '成長', '情緒', '放下', '接納'],
    '商業創業': ['創業', '經營', '客戶', '營收', '品牌', '市場', '商業模式', '獲利'],
    '職場發展': ['職場', '工作', '升遷', '主管', '同事', '離職', '轉職', '面試'],
    '人際關係': ['關係', '溝通', '朋友', '家人', '伴侶', '社交', '人脈', '信任'],
    '健康養生': ['健康', '運動', '飲食', '睡眠', '養生', '減重', '體態', '習慣'],
    '教育學習': ['學習', '讀書', '技能', '知識', '成長', '進修', '考試', '教育'],
    '理財投資': ['理財', '投資', '存錢', '財務', '被動收入', '資產', '股票', '基金'],
    '生活風格': ['生活', '日常', '習慣', '效率', '時間', '整理', '極簡', '質感'],
    '創作藝術': ['創作', '寫作', '設計', '藝術', '靈感', '作品', '表達', '美學'],
  };
  
  return domainKeywordMap[domain] || ['成長', '學習', '分享', '經驗', '心得'];
}

/**
 * 從開頭提取主題方向
 */
function extractTopicFromOpener(opener: string, domain: string): string {
  // 簡單的主題提取邏輯
  // 移除常見的開頭詞彙，保留核心主題
  const cleanOpener = opener
    .replace(/^(我發現|我覺得|很多人|有時候|其實|說真的|最近|昨天|今天)/g, '')
    .replace(/[。，、！？\n]/g, ' ')
    .trim();
  
  // 取前 15 個字作為主題方向
  const topic = cleanOpener.substring(0, 15).trim();
  
  // 如果太短，補充領域關鍵字
  if (topic.length < 5) {
    const keywords = getDomainKeywords(domain);
    return `${keywords[0]}的${topic || '心得'}`;
  }
  
  return topic;
}


/**
 * 生成優化建議 - 根據相似爆款特徵分析，告訴學員如何調整主題更容易被看見
 */
export async function generateOptimizationSuggestions(
  topic: string,
  similarPosts: Array<{ content: string; likes: number; similarity: number }>
): Promise<{
  suggestions: string[];
  features: {
    hasQuestion: { count: number; percentage: number };
    hasNumber: { count: number; percentage: number };
    hasContrast: { count: number; percentage: number };
    hasStory: { count: number; percentage: number };
    avgLength: number;
  };
  topFeatures: string[];
}> {
  if (similarPosts.length === 0) {
    return {
      suggestions: ['目前沒有足夠的相似爆款可供分析，建議嘗試不同的主題方向'],
      features: {
        hasQuestion: { count: 0, percentage: 0 },
        hasNumber: { count: 0, percentage: 0 },
        hasContrast: { count: 0, percentage: 0 },
        hasStory: { count: 0, percentage: 0 },
        avgLength: 0,
      },
      topFeatures: [],
    };
  }

  // 分析特徵
  let questionCount = 0;
  let numberCount = 0;
  let contrastCount = 0;
  let storyCount = 0;
  let totalLength = 0;

  const questionPatterns = /[？?]|為什麼|怎麼|如何|是不是|有沒有|嗎$/;
  const numberPatterns = /\d+|一|二|三|四|五|六|七|八|九|十|百|千|萬/;
  const contrastPatterns = /但是|然而|可是|不過|卻|vs|以前.*現在|過去.*現在|從.*到|原本.*後來/;
  const storyPatterns = /那天|有一次|記得|當時|那時候|曾經|有個|故事|經歷/;

  for (const post of similarPosts) {
    const content = post.content;
    totalLength += content.length;

    if (questionPatterns.test(content)) questionCount++;
    if (numberPatterns.test(content)) numberCount++;
    if (contrastPatterns.test(content)) contrastCount++;
    if (storyPatterns.test(content)) storyCount++;
  }

  const total = similarPosts.length;
  const features = {
    hasQuestion: { count: questionCount, percentage: Math.round((questionCount / total) * 100) },
    hasNumber: { count: numberCount, percentage: Math.round((numberCount / total) * 100) },
    hasContrast: { count: contrastCount, percentage: Math.round((contrastCount / total) * 100) },
    hasStory: { count: storyCount, percentage: Math.round((storyCount / total) * 100) },
    avgLength: Math.round(totalLength / total),
  };

  // 找出高於平均的特徵
  const avgPercentage = 30; // 基準線
  const topFeatures: string[] = [];
  const suggestions: string[] = [];

  if (features.hasQuestion.percentage > avgPercentage) {
    topFeatures.push('問句');
    suggestions.push(`相似爆款中有 ${features.hasQuestion.percentage}% 使用問句，建議在開頭或結尾加入引發思考的問題`);
  }

  if (features.hasNumber.percentage > avgPercentage) {
    topFeatures.push('數字');
    suggestions.push(`相似爆款中有 ${features.hasNumber.percentage}% 包含具體數字，建議加入數據或時間讓內容更有說服力`);
  }

  if (features.hasContrast.percentage > avgPercentage) {
    topFeatures.push('對比');
    suggestions.push(`相似爆款中有 ${features.hasContrast.percentage}% 使用對比手法，建議用「以前 vs 現在」或「大多數人 vs 我」的對比`);
  }

  if (features.hasStory.percentage > avgPercentage) {
    topFeatures.push('故事');
    suggestions.push(`相似爆款中有 ${features.hasStory.percentage}% 包含故事元素，建議加入你自己的真實經歷`);
  }

  // 長度建議
  if (features.avgLength > 0) {
    if (features.avgLength < 150) {
      suggestions.push(`相似爆款平均長度約 ${features.avgLength} 字，建議保持簡潔有力`);
    } else if (features.avgLength < 300) {
      suggestions.push(`相似爆款平均長度約 ${features.avgLength} 字，這是最佳長度區間`);
    } else {
      suggestions.push(`相似爆款平均長度約 ${features.avgLength} 字，可以寫得更詳細深入`);
    }
  }

  // 如果沒有明顯特徵，給出通用建議
  if (suggestions.length === 0) {
    suggestions.push('建議加入你自己的獨特觀點和真實經歷，讓內容更有個人特色');
  }

  return {
    suggestions,
    features,
    topFeatures,
  };
}
