/**
 * Embedding 服務
 * 使用 Manus Forge API 生成文字向量，並儲存在 MySQL 資料庫中
 * 用於同質性檢測和語意保真功能
 */

import { ENV } from "./_core/env";
import { getDb } from "./db";
import { openerEmbeddings, OpenerEmbedding } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// Embedding 向量維度（OpenAI text-embedding-3-small 為 1536 維）
const EMBEDDING_DIMENSION = 1536;

// 同質性閾值：超過此值視為相似
const HOMOGENEITY_THRESHOLD = 0.85;

// 語意保真閾值：超過此距離視為語意改變
const SEMANTIC_FIDELITY_THRESHOLD = 0.15;

/**
 * 生成文字的 Embedding 向量
 * 使用 Forge API 的 embedding endpoint
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiUrl = ENV.forgeApiUrl 
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/embeddings`
    : "https://forge.manus.im/v1/embeddings";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as {
    data: Array<{ embedding: number[] }>;
  };

  return result.data[0].embedding;
}

/**
 * 計算兩個向量的 Cosine Similarity
 * 返回值範圍：-1 到 1，1 表示完全相同
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same dimension");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * 儲存用戶開頭的 Embedding
 */
export async function saveOpenerEmbedding(
  userId: string,
  opener: string,
  draftId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const embedding = await generateEmbedding(opener);
  
  await db.insert(openerEmbeddings).values({
    userId,
    opener,
    embedding: JSON.stringify(embedding),
    draftId: draftId || null,
  });
}

/**
 * 取得用戶最近的開頭 Embedding
 */
export async function getUserRecentOpenerEmbeddings(
  userId: string,
  limit: number = 10
): Promise<Array<{ opener: string; embedding: number[] }>> {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db
    .select()
    .from(openerEmbeddings)
    .where(eq(openerEmbeddings.userId, userId))
    .orderBy(desc(openerEmbeddings.createdAt))
    .limit(limit);

  return results.map((row: OpenerEmbedding) => ({
    opener: row.opener,
    embedding: JSON.parse(row.embedding as string) as number[],
  }));
}

/**
 * 同質性檢測 V2（使用 Embedding）
 * 比對新開頭與用戶最近 10 篇開頭的語意相似度
 */
export async function checkOpenerHomogeneityV2(
  userId: string,
  newOpener: string
): Promise<{
  isHomogeneous: boolean;
  maxSimilarity: number;
  similarOpeners: Array<{ opener: string; similarity: number }>;
  suggestion?: string;
}> {
  // 生成新開頭的 Embedding
  const newEmbedding = await generateEmbedding(newOpener);
  
  // 取得用戶最近的開頭
  const recentOpeners = await getUserRecentOpenerEmbeddings(userId, 10);
  
  if (recentOpeners.length === 0) {
    return {
      isHomogeneous: false,
      maxSimilarity: 0,
      similarOpeners: [],
    };
  }

  // 計算與每個歷史開頭的相似度
  const similarities = recentOpeners.map(({ opener, embedding }) => ({
    opener,
    similarity: cosineSimilarity(newEmbedding, embedding),
  }));

  // 找出最相似的開頭
  const sortedSimilarities = similarities.sort((a, b) => b.similarity - a.similarity);
  const maxSimilarity = sortedSimilarities[0].similarity;
  
  // 找出所有超過閾值的相似開頭
  const similarOpeners = sortedSimilarities.filter(
    s => s.similarity >= HOMOGENEITY_THRESHOLD
  );

  const isHomogeneous = maxSimilarity >= HOMOGENEITY_THRESHOLD;

  let suggestion: string | undefined;
  if (isHomogeneous) {
    suggestion = `這個開頭和你最近的貼文太相似了（相似度 ${Math.round(maxSimilarity * 100)}%）。建議嘗試不同的開頭方式，例如：情緒爆發、時間點、或反差式開頭。`;
  }

  return {
    isHomogeneous,
    maxSimilarity,
    similarOpeners,
    suggestion,
  };
}

/**
 * 語意保真檢測
 * 比對潤飾前後的語意距離，確保不會偏離原意
 */
export async function checkSemanticFidelity(
  originalText: string,
  polishedText: string
): Promise<{
  isFaithful: boolean;
  semanticDistance: number;
  warning?: string;
}> {
  // 生成兩段文字的 Embedding
  const [originalEmbedding, polishedEmbedding] = await Promise.all([
    generateEmbedding(originalText),
    generateEmbedding(polishedText),
  ]);

  // 計算語意相似度
  const similarity = cosineSimilarity(originalEmbedding, polishedEmbedding);
  
  // 語意距離 = 1 - 相似度
  const semanticDistance = 1 - similarity;
  
  const isFaithful = semanticDistance <= SEMANTIC_FIDELITY_THRESHOLD;

  let warning: string | undefined;
  if (!isFaithful) {
    warning = `潤飾後的內容可能偏離原意（語意距離 ${Math.round(semanticDistance * 100)}%）。建議檢查是否加入了新觀點或改變了原本的立場。`;
  }

  return {
    isFaithful,
    semanticDistance,
    warning,
  };
}

/**
 * 批量檢測多個候選的同質性
 * 用於候選生成後選擇最多樣的版本
 */
export async function rankCandidatesByDiversity(
  userId: string,
  candidates: string[]
): Promise<Array<{ content: string; diversityScore: number }>> {
  // 取得用戶最近的開頭
  const recentOpeners = await getUserRecentOpenerEmbeddings(userId, 10);
  
  // 生成所有候選的 Embedding
  const candidateEmbeddings = await Promise.all(
    candidates.map(c => generateEmbedding(c.substring(0, 100))) // 只取前 100 字作為開頭
  );

  // 計算每個候選的多樣性分數
  const rankedCandidates = candidates.map((content, index) => {
    const candidateEmbedding = candidateEmbeddings[index];
    
    // 計算與所有歷史開頭的平均相似度
    let avgSimilarity = 0;
    if (recentOpeners.length > 0) {
      const similarities = recentOpeners.map(({ embedding }) =>
        cosineSimilarity(candidateEmbedding, embedding)
      );
      avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    }
    
    // 多樣性分數 = 1 - 平均相似度
    const diversityScore = 1 - avgSimilarity;
    
    return { content, diversityScore };
  });

  // 按多樣性分數排序（高到低）
  return rankedCandidates.sort((a, b) => b.diversityScore - a.diversityScore);
}
