/**
 * Embedding 服務 - 向量生成與語意檢索
 * 
 * 功能：
 * 1. 生成文本向量（使用 LLM API）
 * 2. 語意檢索（semanticSearch）
 * 3. 多樣性重排（MMR - Maximal Marginal Relevance）
 * 4. 同質性檢查
 */

import { getDb } from "./db";
import { viralEmbeddings, userPostEmbeddings, type ViralEmbedding, type UserPostEmbedding } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { ENV } from "./_core/env";

// ============================================
// 向量生成
// ============================================

/**
 * 生成文本向量
 * 使用 OpenAI text-embedding-3-small 模型
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${ENV.forgeApiUrl}/v1/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Embedding] API error:", error);
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * 批量生成向量
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch(`${ENV.forgeApiUrl}/v1/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Embedding] API error:", error);
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

// ============================================
// 向量相似度計算
// ============================================

/**
 * 計算餘弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================
// 語意檢索
// ============================================

interface SearchResult {
  id: number;
  content: string;
  hook: string | null;
  contentType: string | null;
  similarity: number;
  metrics?: {
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  tags?: string[];
}

interface CandidateWithEmbedding extends SearchResult {
  embedding: number[];
}

/**
 * 語意檢索 - 從爆款庫中找出最相似的內容
 * @param query 查詢文本
 * @param k 返回結果數量
 * @param contentType 可選：篩選特定內容類型
 */
export async function semanticSearch(
  query: string,
  k: number = 5,
  contentType?: string
): Promise<SearchResult[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Embedding] Database not available");
    return [];
  }

  // 生成查詢向量
  const queryEmbedding = await generateEmbedding(query);

  // 獲取所有爆款範例
  const whereClause = contentType
    ? and(eq(viralEmbeddings.isActive, true), eq(viralEmbeddings.contentType, contentType))
    : eq(viralEmbeddings.isActive, true);

  const examples = await db
    .select()
    .from(viralEmbeddings)
    .where(whereClause);

  // 計算相似度並排序
  const results: SearchResult[] = examples
    .filter((ex: ViralEmbedding) => ex.embedding && Array.isArray(ex.embedding))
    .map((ex: ViralEmbedding) => ({
      id: ex.id,
      content: ex.content,
      hook: ex.hook,
      contentType: ex.contentType,
      similarity: cosineSimilarity(queryEmbedding, ex.embedding as number[]),
      metrics: ex.metrics as SearchResult["metrics"],
      tags: ex.tags as string[],
    }))
    .sort((a: SearchResult, b: SearchResult) => b.similarity - a.similarity)
    .slice(0, k);

  return results;
}

// ============================================
// MMR 多樣性重排
// ============================================

/**
 * MMR (Maximal Marginal Relevance) 多樣性重排
 * 在保持相關性的同時，增加結果的多樣性
 * 
 * @param query 查詢文本
 * @param k 返回結果數量
 * @param lambda 多樣性參數（0-1，越小越多樣）
 * @param candidatePool 候選池大小（從中選取 k 個）
 */
export async function mmrSearch(
  query: string,
  k: number = 5,
  lambda: number = 0.5,
  candidatePool: number = 20
): Promise<SearchResult[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Embedding] Database not available");
    return [];
  }

  // 生成查詢向量
  const queryEmbedding = await generateEmbedding(query);

  // 獲取候選池
  const examples = await db
    .select()
    .from(viralEmbeddings)
    .where(eq(viralEmbeddings.isActive, true))
    .limit(candidatePool * 2); // 多取一些以確保有足夠的候選

  // 計算與查詢的相似度
  const candidates: CandidateWithEmbedding[] = examples
    .filter((ex: ViralEmbedding) => ex.embedding && Array.isArray(ex.embedding))
    .map((ex: ViralEmbedding) => ({
      id: ex.id,
      content: ex.content,
      hook: ex.hook,
      contentType: ex.contentType,
      embedding: ex.embedding as number[],
      similarity: cosineSimilarity(queryEmbedding, ex.embedding as number[]),
      metrics: ex.metrics as SearchResult["metrics"],
      tags: ex.tags as string[],
    }))
    .sort((a: CandidateWithEmbedding, b: CandidateWithEmbedding) => b.similarity - a.similarity)
    .slice(0, candidatePool);

  if (candidates.length === 0) {
    return [];
  }

  // MMR 選擇
  const selected: CandidateWithEmbedding[] = [];
  const remaining = [...candidates];

  // 第一個選最相關的
  selected.push(remaining.shift()!);

  // 迭代選擇剩餘的
  while (selected.length < k && remaining.length > 0) {
    let bestScore = -Infinity;
    let bestIndex = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // 計算與已選擇項目的最大相似度
      let maxSimToSelected = 0;
      for (const s of selected) {
        const sim = cosineSimilarity(candidate.embedding, s.embedding);
        if (sim > maxSimToSelected) {
          maxSimToSelected = sim;
        }
      }

      // MMR 分數 = λ * 相關性 - (1-λ) * 與已選項目的最大相似度
      const mmrScore = lambda * candidate.similarity - (1 - lambda) * maxSimToSelected;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  // 返回結果（移除 embedding）
  return selected.map(({ embedding: _embedding, ...rest }: CandidateWithEmbedding) => rest);
}

// ============================================
// 同質性檢查
// ============================================

interface SimilarityCheckResult {
  isTooSimilar: boolean;
  maxSimilarity: number;
  similarContent?: string;
  recommendation?: string;
}

/**
 * 同質性檢查 - 檢查生成的內容是否與現有內容太相似
 * @param content 待檢查的內容
 * @param threshold 相似度閾值（預設 0.88）
 * @param userId 可選：只檢查特定用戶的歷史內容
 */
export async function checkSimilarity(
  content: string,
  threshold: number = 0.88,
  userId?: number
): Promise<SimilarityCheckResult> {
  const db = await getDb();
  if (!db) {
    console.warn("[Embedding] Database not available");
    return { isTooSimilar: false, maxSimilarity: 0 };
  }

  // 生成內容向量
  const contentEmbedding = await generateEmbedding(content);

  // 檢查爆款庫
  const viralExamples = await db
    .select()
    .from(viralEmbeddings)
    .where(eq(viralEmbeddings.isActive, true));

  let maxSimilarity = 0;
  let similarContent: string | undefined;

  for (const ex of viralExamples) {
    if (ex.embedding && Array.isArray(ex.embedding)) {
      const sim = cosineSimilarity(contentEmbedding, ex.embedding as number[]);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        similarContent = ex.content;
      }
    }
  }

  // 如果指定了用戶，也檢查用戶的歷史內容
  if (userId) {
    const userPosts = await db
      .select()
      .from(userPostEmbeddings)
      .where(eq(userPostEmbeddings.userId, userId));

    for (const post of userPosts) {
      if (post.embedding && Array.isArray(post.embedding)) {
        const sim = cosineSimilarity(contentEmbedding, post.embedding as number[]);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          similarContent = post.content;
        }
      }
    }
  }

  const isTooSimilar = maxSimilarity > threshold;

  return {
    isTooSimilar,
    maxSimilarity,
    similarContent: isTooSimilar ? similarContent : undefined,
    recommendation: isTooSimilar
      ? `內容與現有內容相似度達 ${(maxSimilarity * 100).toFixed(1)}%，建議調整角度或增加個人觀點`
      : undefined,
  };
}

// ============================================
// 向量存儲
// ============================================

/**
 * 存儲爆款範例向量
 */
export async function storeViralEmbedding(data: {
  content: string;
  hook?: string;
  contentType?: string;
  source?: string;
  metrics?: {
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  tags?: string[];
  cluster?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const embedding = await generateEmbedding(data.content);

  const [result] = await db.insert(viralEmbeddings).values({
    content: data.content,
    hook: data.hook,
    contentType: data.contentType,
    embedding,
    source: data.source,
    metrics: data.metrics,
    tags: data.tags,
    cluster: data.cluster,
    isActive: true,
  });

  return result.insertId;
}

/**
 * 存儲用戶貼文向量
 */
export async function storeUserPostEmbedding(data: {
  userId: number;
  draftId?: number;
  content: string;
  hook?: string;
  contentType?: string;
  generationConfig?: {
    mode?: string;
    hookStyle?: string;
    contentType?: string;
    promptVersion?: string;
  };
}): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const embedding = await generateEmbedding(data.content);

  const [result] = await db.insert(userPostEmbeddings).values({
    userId: data.userId,
    draftId: data.draftId,
    content: data.content,
    hook: data.hook,
    contentType: data.contentType,
    embedding,
    generationConfig: data.generationConfig,
    isPublished: false,
  });

  return result.insertId;
}

// ============================================
// 推薦 Hooks
// ============================================

/**
 * 獲取推薦的 Hooks（用於 Prompt Builder 整合）
 * @param topic 主題
 * @param k 返回數量
 * @param diversity 多樣性參數
 */
export async function getRecommendedHooks(
  topic: string,
  k: number = 3,
  diversity: number = 0.5
): Promise<Array<{
  hook: string;
  style: string;
  similarity: number;
}>> {
  const results = await mmrSearch(topic, k * 2, diversity);

  // 過濾出有 hook 的結果
  const hooksWithStyle = results
    .filter((r) => r.hook)
    .map((r) => ({
      hook: r.hook!,
      style: inferHookStyle(r.hook!),
      similarity: r.similarity,
    }))
    .slice(0, k);

  return hooksWithStyle;
}

/**
 * 推斷 Hook 風格
 */
function inferHookStyle(hook: string): string {
  if (hook.includes("？") || hook.includes("?")) {
    return "question";
  }
  if (hook.includes("「") || hook.includes("」") || hook.includes('"') || hook.includes("'")) {
    return "dialogue";
  }
  if (/\d+/.test(hook)) {
    return "data";
  }
  if (hook.includes("不是") || hook.includes("而是") || hook.includes("但")) {
    return "contrast";
  }
  return "scene";
}

// ============================================
// 語意保真檢查
// ============================================

interface StylePolishResult {
  isPreserved: boolean;
  similarity: number;
  preservedWordsRatio: number;
  issues?: string[];
}

/**
 * 語意保真檢查 - 確保潤飾後的內容保留原意
 * @param original 原始內容
 * @param polished 潤飾後的內容
 * @param preservedWords 必須保留的關鍵詞
 * @param similarityThreshold 相似度閾值（預設 0.80）
 * @param preservedWordsThreshold 關鍵詞覆蓋率閾值（預設 0.60）
 */
export async function checkStylePolish(
  original: string,
  polished: string,
  preservedWords: string[] = [],
  similarityThreshold: number = 0.80,
  preservedWordsThreshold: number = 0.60
): Promise<StylePolishResult> {
  // 計算語意相似度
  const [originalEmbedding, polishedEmbedding] = await generateEmbeddings([original, polished]);
  const similarity = cosineSimilarity(originalEmbedding, polishedEmbedding);

  // 計算關鍵詞覆蓋率
  let preservedCount = 0;
  for (const word of preservedWords) {
    if (polished.includes(word)) {
      preservedCount++;
    }
  }
  const preservedWordsRatio = preservedWords.length > 0
    ? preservedCount / preservedWords.length
    : 1;

  const issues: string[] = [];

  if (similarity < similarityThreshold) {
    issues.push(`語意相似度 ${(similarity * 100).toFixed(1)}% 低於閾值 ${(similarityThreshold * 100).toFixed(1)}%`);
  }

  if (preservedWordsRatio < preservedWordsThreshold) {
    const missingWords = preservedWords.filter((w) => !polished.includes(w));
    issues.push(`關鍵詞覆蓋率 ${(preservedWordsRatio * 100).toFixed(1)}% 低於閾值，缺少：${missingWords.join("、")}`);
  }

  return {
    isPreserved: issues.length === 0,
    similarity,
    preservedWordsRatio,
    issues: issues.length > 0 ? issues : undefined,
  };
}
