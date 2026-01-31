/**
 * 用戶互動追蹤服務
 * 
 * 功能：
 * 1. 記錄用戶採納/修改/發布行為
 * 2. 計算建議採納率
 * 3. 分析用戶偏好（常刪除/保留的句型）
 * 4. 更新用戶成長階段
 */

import { getDb } from "./db";
import { 
  userInteractionEvents, 
  userGrowthStages, 
  type UserInteractionEvent,
  type UserGrowthStage,
  type InsertUserInteractionEvent,
  type InsertUserGrowthStage
} from "../drizzle/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";

// ============================================
// 事件記錄
// ============================================

type EventType = 
  | "hook_selected"
  | "hook_rejected"
  | "draft_accepted"
  | "draft_modified"
  | "draft_rejected"
  | "suggestion_adopted"
  | "suggestion_ignored"
  | "content_published"
  | "content_deleted"
  | "style_preference"
  | "phrase_deleted"
  | "phrase_kept";

interface EventDetails {
  originalContent?: string;
  modifiedContent?: string;
  deletedPhrases?: string[];
  keptPhrases?: string[];
  hookStyle?: string;
  contentType?: string;
  reason?: string;
}

/**
 * 記錄用戶互動事件
 */
export async function recordInteractionEvent(data: {
  userId: number;
  eventType: EventType;
  draftId?: number;
  hookId?: number;
  suggestionId?: number;
  details?: EventDetails;
}): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const [result] = await db.insert(userInteractionEvents).values({
    userId: data.userId,
    eventType: data.eventType,
    draftId: data.draftId,
    hookId: data.hookId,
    suggestionId: data.suggestionId,
    details: data.details,
  });

  // 異步更新用戶成長階段
  updateUserGrowthStage(data.userId).catch(console.error);

  return result.insertId;
}

/**
 * 記錄 Hook 選擇事件
 */
export async function recordHookSelection(
  userId: number,
  hookId: number,
  hookStyle: string,
  selected: boolean
): Promise<void> {
  await recordInteractionEvent({
    userId,
    eventType: selected ? "hook_selected" : "hook_rejected",
    hookId,
    details: { hookStyle },
  });
}

/**
 * 記錄草稿修改事件
 */
export async function recordDraftModification(
  userId: number,
  draftId: number,
  originalContent: string,
  modifiedContent: string
): Promise<void> {
  // 分析刪除和保留的句型
  const { deletedPhrases, keptPhrases } = analyzePhraseChanges(originalContent, modifiedContent);

  await recordInteractionEvent({
    userId,
    eventType: "draft_modified",
    draftId,
    details: {
      originalContent,
      modifiedContent,
      deletedPhrases,
      keptPhrases,
    },
  });

  // 記錄刪除的句型
  for (const phrase of deletedPhrases) {
    await recordInteractionEvent({
      userId,
      eventType: "phrase_deleted",
      draftId,
      details: { originalContent: phrase },
    });
  }
}

/**
 * 記錄建議採納事件
 */
export async function recordSuggestionAdoption(
  userId: number,
  suggestionId: number,
  adopted: boolean,
  reason?: string
): Promise<void> {
  await recordInteractionEvent({
    userId,
    eventType: adopted ? "suggestion_adopted" : "suggestion_ignored",
    suggestionId,
    details: { reason },
  });
}

/**
 * 記錄內容發布事件
 */
export async function recordContentPublished(
  userId: number,
  draftId: number,
  contentType: string
): Promise<void> {
  await recordInteractionEvent({
    userId,
    eventType: "content_published",
    draftId,
    details: { contentType },
  });
}

// ============================================
// 句型分析
// ============================================

/**
 * 分析句型變化
 */
function analyzePhraseChanges(original: string, modified: string): {
  deletedPhrases: string[];
  keptPhrases: string[];
} {
  // 將內容分割成句子
  const originalSentences = splitIntoSentences(original);
  const modifiedSentences = splitIntoSentences(modified);

  const deletedPhrases: string[] = [];
  const keptPhrases: string[] = [];

  // 找出被刪除的句子
  for (const sentence of originalSentences) {
    if (sentence.length < 10) continue; // 忽略太短的句子
    
    const isKept = modifiedSentences.some(
      (s) => s.includes(sentence) || sentence.includes(s) || similarity(s, sentence) > 0.8
    );

    if (isKept) {
      keptPhrases.push(sentence);
    } else {
      deletedPhrases.push(sentence);
    }
  }

  return { deletedPhrases, keptPhrases };
}

/**
 * 將內容分割成句子
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 簡單的字串相似度計算
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  const longerLength = longer.length;
  if (longerLength === 0) return 1;

  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

/**
 * 編輯距離計算
 */
function editDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ============================================
// 用戶成長階段
// ============================================

type GrowthStage = "new" | "growing" | "mature";

/**
 * 更新用戶成長階段
 */
export async function updateUserGrowthStage(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[UserInteraction] Database not available");
    return;
  }

  // 獲取用戶的互動統計
  const stats = await getUserInteractionStats(userId);

  // 判定成長階段
  const stage = determineGrowthStage(stats);

  // 計算 Humanizer 嚴格度
  const humanizerStrictness = determineHumanizerStrictness(stage, stats);

  // 更新或插入用戶成長階段
  const existing = await db
    .select()
    .from(userGrowthStages)
    .where(eq(userGrowthStages.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userGrowthStages)
      .set({
        stage,
        totalPosts: stats.totalPosts,
        totalDrafts: stats.totalDrafts,
        adoptionRate: stats.adoptionRate.toString(),
        selfEditRate: stats.selfEditRate.toString(),
        avgAiScore: stats.avgAiScore.toString(),
        preferredHookStyles: stats.preferredHookStyles,
        preferredContentTypes: stats.preferredContentTypes,
        deletedPhrasePatterns: stats.deletedPhrasePatterns,
        keptPhrasePatterns: stats.keptPhrasePatterns,
        humanizerStrictness,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userGrowthStages.userId, userId));
  } else {
    await db.insert(userGrowthStages).values({
      userId,
      stage,
      totalPosts: stats.totalPosts,
      totalDrafts: stats.totalDrafts,
      adoptionRate: stats.adoptionRate.toString(),
      selfEditRate: stats.selfEditRate.toString(),
      avgAiScore: stats.avgAiScore.toString(),
      preferredHookStyles: stats.preferredHookStyles,
      preferredContentTypes: stats.preferredContentTypes,
      deletedPhrasePatterns: stats.deletedPhrasePatterns,
      keptPhrasePatterns: stats.keptPhrasePatterns,
      humanizerStrictness,
      lastCalculatedAt: new Date(),
    });
  }
}

interface UserInteractionStats {
  totalPosts: number;
  totalDrafts: number;
  adoptionRate: number;
  selfEditRate: number;
  avgAiScore: number;
  preferredHookStyles: string[];
  preferredContentTypes: string[];
  deletedPhrasePatterns: string[];
  keptPhrasePatterns: string[];
}

/**
 * 獲取用戶互動統計
 */
async function getUserInteractionStats(userId: number): Promise<UserInteractionStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalPosts: 0,
      totalDrafts: 0,
      adoptionRate: 0,
      selfEditRate: 0,
      avgAiScore: 0,
      preferredHookStyles: [],
      preferredContentTypes: [],
      deletedPhrasePatterns: [],
      keptPhrasePatterns: [],
    };
  }

  // 獲取所有互動事件
  const events = await db
    .select()
    .from(userInteractionEvents)
    .where(eq(userInteractionEvents.userId, userId));

  // 計算統計數據
  const totalPosts = events.filter((e) => e.eventType === "content_published").length;
  const totalDrafts = events.filter(
    (e) => e.eventType === "draft_accepted" || e.eventType === "draft_modified"
  ).length;

  // 計算採納率
  const adoptedCount = events.filter((e) => e.eventType === "suggestion_adopted").length;
  const ignoredCount = events.filter((e) => e.eventType === "suggestion_ignored").length;
  const adoptionRate = adoptedCount + ignoredCount > 0
    ? adoptedCount / (adoptedCount + ignoredCount)
    : 0;

  // 計算自主修改率
  const modifiedCount = events.filter((e) => e.eventType === "draft_modified").length;
  const acceptedCount = events.filter((e) => e.eventType === "draft_accepted").length;
  const selfEditRate = modifiedCount + acceptedCount > 0
    ? modifiedCount / (modifiedCount + acceptedCount)
    : 0;

  // 分析偏好的 Hook 風格
  const hookEvents = events.filter((e) => e.eventType === "hook_selected");
  const hookStyleCounts: Record<string, number> = {};
  for (const event of hookEvents) {
    const style = (event.details as EventDetails)?.hookStyle;
    if (style) {
      hookStyleCounts[style] = (hookStyleCounts[style] || 0) + 1;
    }
  }
  const preferredHookStyles = Object.entries(hookStyleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([style]) => style);

  // 分析偏好的內容類型
  const publishEvents = events.filter((e) => e.eventType === "content_published");
  const contentTypeCounts: Record<string, number> = {};
  for (const event of publishEvents) {
    const type = (event.details as EventDetails)?.contentType;
    if (type) {
      contentTypeCounts[type] = (contentTypeCounts[type] || 0) + 1;
    }
  }
  const preferredContentTypes = Object.entries(contentTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);

  // 分析刪除的句型模式
  const deletedEvents = events.filter((e) => e.eventType === "phrase_deleted");
  const deletedPhrasePatterns = deletedEvents
    .map((e) => (e.details as EventDetails)?.originalContent)
    .filter((p): p is string => !!p)
    .slice(0, 10);

  // 分析保留的句型模式
  const modifyEvents = events.filter((e) => e.eventType === "draft_modified");
  const keptPhrasePatterns: string[] = [];
  for (const event of modifyEvents) {
    const kept = (event.details as EventDetails)?.keptPhrases;
    if (kept) {
      keptPhrasePatterns.push(...kept);
    }
  }

  return {
    totalPosts,
    totalDrafts,
    adoptionRate,
    selfEditRate,
    avgAiScore: 0, // 需要從草稿表獲取
    preferredHookStyles,
    preferredContentTypes,
    deletedPhrasePatterns: deletedPhrasePatterns.slice(0, 10),
    keptPhrasePatterns: keptPhrasePatterns.slice(0, 10),
  };
}

/**
 * 判定成長階段
 */
export function determineGrowthStage(stats: UserInteractionStats): GrowthStage {
  // 新手：發文數 < 5 或 草稿數 < 10
  if (stats.totalPosts < 5 || stats.totalDrafts < 10) {
    return "new";
  }

  // 成熟：發文數 >= 20 且 自主修改率 >= 0.5 且 採納率 >= 0.3
  if (stats.totalPosts >= 20 && stats.selfEditRate >= 0.5 && stats.adoptionRate >= 0.3) {
    return "mature";
  }

  // 成長中
  return "growing";
}

/**
 * 判定 Humanizer 嚴格度
 */
function determineHumanizerStrictness(
  stage: GrowthStage,
  stats: UserInteractionStats
): "strict" | "moderate" | "relaxed" {
  switch (stage) {
    case "new":
      return "strict"; // 新手需要嚴格過濾
    case "growing":
      return stats.selfEditRate > 0.4 ? "moderate" : "strict";
    case "mature":
      return "relaxed"; // 成熟用戶可以寬鬆
    default:
      return "strict";
  }
}

// ============================================
// 用戶偏好上下文
// ============================================

export interface UserPreferenceContext {
  stage: GrowthStage;
  humanizerStrictness: "strict" | "moderate" | "relaxed";
  preferredHookStyles: string[];
  preferredContentTypes: string[];
  deletedPhrasePatterns: string[];
  keptPhrasePatterns: string[];
  adoptionRate: number;
  selfEditRate: number;
}

/**
 * 獲取用戶偏好上下文（用於 Prompt Builder 注入）
 */
export async function getUserPreferenceContext(userId: number): Promise<UserPreferenceContext | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const [growthStage] = await db
    .select()
    .from(userGrowthStages)
    .where(eq(userGrowthStages.userId, userId))
    .limit(1);

  if (!growthStage) {
    return null;
  }

  return {
    stage: growthStage.stage as GrowthStage,
    humanizerStrictness: growthStage.humanizerStrictness as "strict" | "moderate" | "relaxed",
    preferredHookStyles: (growthStage.preferredHookStyles as string[]) || [],
    preferredContentTypes: (growthStage.preferredContentTypes as string[]) || [],
    deletedPhrasePatterns: (growthStage.deletedPhrasePatterns as string[]) || [],
    keptPhrasePatterns: (growthStage.keptPhrasePatterns as string[]) || [],
    adoptionRate: parseFloat(growthStage.adoptionRate?.toString() || "0"),
    selfEditRate: parseFloat(growthStage.selfEditRate?.toString() || "0"),
  };
}

/**
 * 生成用戶偏好提示詞片段
 */
export function buildUserPreferencePrompt(context: UserPreferenceContext): string {
  const lines: string[] = [];

  // 用戶階段
  const stageDesc = {
    new: "新手創作者，需要更多引導和範例",
    growing: "成長中的創作者，正在發展個人風格",
    mature: "成熟創作者，有明確的個人風格和偏好",
  };
  lines.push(`【用戶階段】${stageDesc[context.stage]}`);

  // 偏好的 Hook 風格
  if (context.preferredHookStyles.length > 0) {
    lines.push(`【偏好的開頭風格】${context.preferredHookStyles.join("、")}`);
  }

  // 偏好的內容類型
  if (context.preferredContentTypes.length > 0) {
    lines.push(`【偏好的內容類型】${context.preferredContentTypes.join("、")}`);
  }

  // 常刪除的句型（需要避免）
  if (context.deletedPhrasePatterns.length > 0) {
    lines.push(`【此用戶常刪除的句型，請避免】`);
    for (const pattern of context.deletedPhrasePatterns.slice(0, 5)) {
      lines.push(`  - ${pattern.substring(0, 50)}...`);
    }
  }

  // 常保留的句型（可以參考）
  if (context.keptPhrasePatterns.length > 0) {
    lines.push(`【此用戶偏好的句型風格】`);
    for (const pattern of context.keptPhrasePatterns.slice(0, 5)) {
      lines.push(`  - ${pattern.substring(0, 50)}...`);
    }
  }

  return lines.join("\n");
}
