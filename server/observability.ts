/**
 * Observability - 系統監控和日誌記錄
 * 
 * 功能：
 * - logEvent(): 記錄系統事件
 * - logGeneration(): 記錄內容生成事件
 * - logAiDetection(): 記錄 AI 檢測事件
 * - getMetrics(): 取得系統指標
 */

import { getDb } from "./db";
import { systemEventLogs, openersCandidates, templateStats, aiDetectorLogs } from "../drizzle/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

// ==================== 類型定義 ====================

export type EventType = 
  | 'generation'      // 內容生成
  | 'ai_detection'    // AI 檢測
  | 'template'        // 模板使用
  | 'user_action'     // 用戶操作
  | 'system'          // 系統事件
  | 'error';          // 錯誤

export type EventStatus = 'success' | 'error' | 'warning';

export interface EventData {
  eventType: EventType;
  eventName: string;
  userId?: number;
  metadata?: Record<string, unknown>;
  status?: EventStatus;
  durationMs?: number;
  draftId?: number;
  candidateId?: number;
  templateId?: number;
  errorMessage?: string;
}

export interface GenerationMetrics {
  totalGenerations: number;
  averageAiScore: number;
  passRate: number;
  topTemplates: { templateId: number; name: string; count: number; successRate: number }[];
  recentTrend: { date: string; count: number; avgScore: number }[];
}

// ==================== 事件記錄 ====================

/**
 * 記錄系統事件
 */
export async function logEvent(event: EventData): Promise<void> {
  const db = await getDb();
  if (!db) {
    // 如果資料庫不可用，輸出到 console
    console.log(`[${event.eventType.toUpperCase()}] ${event.eventName}`, event.metadata);
    return;
  }
  
  try {
    await db.insert(systemEventLogs).values({
      eventType: event.eventType,
      eventName: event.eventName,
      userId: event.userId || null,
      metadata: event.metadata || {},
      status: event.status || 'success',
      durationMs: event.durationMs || null,
      draftId: event.draftId || null,
      candidateId: event.candidateId || null,
      templateId: event.templateId || null,
      errorMessage: event.errorMessage || null,
    });
  } catch (error) {
    console.error('[Observability] Failed to log event:', error);
  }
}

/**
 * 記錄內容生成事件
 */
export async function logGeneration(data: {
  userId: number;
  contentType: string;
  templateId?: number;
  opener: string;
  fullContent: string;
  aiScore: number;
  isSelected?: boolean;
  topic?: string;
  hookStyle?: string;
}): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.log('[Generation]', data.contentType, 'AI Score:', data.aiScore);
    return null;
  }
  
  try {
    const [result] = await db.insert(openersCandidates).values({
      userId: data.userId,
      contentType: data.contentType,
      templateId: data.templateId || null,
      openerText: data.opener,
      fullContent: data.fullContent,
      aiScore: data.aiScore.toFixed(4),
      isSelected: data.isSelected || false,
      topic: data.topic || null,
      hookStyle: data.hookStyle || null,
    });
    
    // 同時記錄事件
    await logEvent({
      eventType: 'generation',
      eventName: 'content_generated',
      userId: data.userId,
      templateId: data.templateId,
      metadata: {
        contentType: data.contentType,
        aiScore: data.aiScore,
      },
    });
    
    return (result as any).insertId || null;
  } catch (error) {
    console.error('[Observability] Failed to log generation:', error);
    return null;
  }
}

/**
 * 記錄模板使用
 */
export async function logTemplateUsage(data: {
  templateId: number;
  userId: number;
  isSelected: boolean;
  isViral?: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    // 更新模板統計
    const today = new Date();
    
    // 嘗試更新現有記錄
    const [existing] = await db.select()
      .from(templateStats)
      .where(
        and(
          eq(templateStats.templateId, data.templateId),
          eq(templateStats.statPeriod, 'daily')
        )
      );
    
    if (existing) {
      await db.update(templateStats)
        .set({
          usageCount: (existing.usageCount || 0) + 1,
          selectionCount: data.isSelected ? (existing.selectionCount || 0) + 1 : existing.selectionCount,
          viralCount: data.isViral ? (existing.viralCount || 0) + 1 : existing.viralCount,
        })
        .where(eq(templateStats.id, existing.id));
    } else {
      await db.insert(templateStats).values({
        templateId: data.templateId,
        statDate: today,
        statPeriod: 'daily',
        usageCount: 1,
        selectionCount: data.isSelected ? 1 : 0,
        viralCount: data.isViral ? 1 : 0,
      });
    }
    
    // 記錄事件
    await logEvent({
      eventType: 'template',
      eventName: 'template_used',
      userId: data.userId,
      templateId: data.templateId,
      metadata: {
        isSelected: data.isSelected,
        isViral: data.isViral,
      },
    });
  } catch (error) {
    console.error('[Observability] Failed to log template usage:', error);
  }
}

/**
 * 更新候選內容的選擇狀態
 */
export async function markCandidateSelected(candidateId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.update(openersCandidates)
      .set({
        isSelected: true,
        selectedAt: new Date(),
      })
      .where(eq(openersCandidates.id, candidateId));
  } catch (error) {
    console.error('[Observability] Failed to mark candidate selected:', error);
  }
}

/**
 * 更新候選內容的發布狀態和成效
 */
export async function updateCandidatePerformance(data: {
  candidateId: number;
  reach: number;
  likes: number;
  comments: number;
  isViral: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.update(openersCandidates)
      .set({
        isViral: data.isViral,
        wasPublished: true,
        reach: data.reach,
        likes: data.likes,
        comments: data.comments,
        publishedAt: new Date(),
      })
      .where(eq(openersCandidates.id, data.candidateId));
  } catch (error) {
    console.error('[Observability] Failed to update candidate performance:', error);
  }
}

// ==================== 指標查詢 ====================

/**
 * 取得生成指標
 */
export async function getGenerationMetrics(userId?: number, days: number = 7): Promise<GenerationMetrics> {
  const db = await getDb();
  if (!db) {
    return {
      totalGenerations: 0,
      averageAiScore: 0,
      passRate: 0,
      topTemplates: [],
      recentTrend: [],
    };
  }
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // 查詢基本統計
    let query = db.select({
      count: sql<number>`count(*)`,
      avgScore: sql<number>`avg(cast(${openersCandidates.aiScore} as decimal(10,4)))`,
      passCount: sql<number>`sum(case when cast(${openersCandidates.aiScore} as decimal(10,4)) < 0.4 then 1 else 0 end)`,
    }).from(openersCandidates);
    
    if (userId) {
      query = query.where(eq(openersCandidates.userId, userId)) as any;
    }
    
    const [stats] = await query;
    
    const totalGenerations = Number(stats?.count) || 0;
    const averageAiScore = Number(stats?.avgScore) || 0;
    const passRate = totalGenerations > 0 ? (Number(stats?.passCount) || 0) / totalGenerations : 0;
    
    return {
      totalGenerations,
      averageAiScore,
      passRate,
      topTemplates: [], // 需要 join 查詢，暫時返回空
      recentTrend: [], // 需要 group by 查詢，暫時返回空
    };
  } catch (error) {
    console.error('[Observability] Failed to get generation metrics:', error);
    return {
      totalGenerations: 0,
      averageAiScore: 0,
      passRate: 0,
      topTemplates: [],
      recentTrend: [],
    };
  }
}

/**
 * 取得 AI 檢測統計
 */
export async function getAiDetectionStats(userId?: number, days: number = 7): Promise<{
  totalChecks: number;
  averageScore: number;
  passRate: number;
  topPatterns: { pattern: string; count: number }[];
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalChecks: 0,
      averageScore: 0,
      passRate: 0,
      topPatterns: [],
    };
  }
  
  try {
    let query = db.select({
      count: sql<number>`count(*)`,
      avgScore: sql<number>`avg(cast(${aiDetectorLogs.overallScore} as decimal(10,4)))`,
      passCount: sql<number>`sum(case when ${aiDetectorLogs.action} = 'pass' then 1 else 0 end)`,
    }).from(aiDetectorLogs);
    
    if (userId) {
      query = query.where(eq(aiDetectorLogs.userId, userId)) as any;
    }
    
    const [stats] = await query;
    
    const totalChecks = Number(stats?.count) || 0;
    const averageScore = Number(stats?.avgScore) || 0;
    const passRate = totalChecks > 0 ? (Number(stats?.passCount) || 0) / totalChecks : 0;
    
    return {
      totalChecks,
      averageScore,
      passRate,
      topPatterns: [], // 需要 JSON 解析，暫時返回空
    };
  } catch (error) {
    console.error('[Observability] Failed to get AI detection stats:', error);
    return {
      totalChecks: 0,
      averageScore: 0,
      passRate: 0,
      topPatterns: [],
    };
  }
}

/**
 * 取得最近的系統事件
 */
export async function getRecentEvents(
  eventType?: EventType,
  limit: number = 50
): Promise<{ id: number; eventType: string; eventName: string; userId: number | null; createdAt: Date }[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    let query = db.select({
      id: systemEventLogs.id,
      eventType: systemEventLogs.eventType,
      eventName: systemEventLogs.eventName,
      userId: systemEventLogs.userId,
      createdAt: systemEventLogs.createdAt,
    })
    .from(systemEventLogs)
    .orderBy(desc(systemEventLogs.createdAt))
    .limit(limit);
    
    if (eventType) {
      query = query.where(eq(systemEventLogs.eventType, eventType)) as any;
    }
    
    return await query;
  } catch (error) {
    console.error('[Observability] Failed to get recent events:', error);
    return [];
  }
}

// ==================== 便捷函數 ====================

/**
 * 記錄錯誤
 */
export async function logError(
  eventName: string,
  error: Error | string,
  userId?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    eventType: 'error',
    eventName,
    userId,
    status: 'error',
    errorMessage: error instanceof Error ? error.message : error,
    metadata: {
      ...metadata,
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
}

/**
 * 記錄用戶操作
 */
export async function logUserAction(
  eventName: string,
  userId: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    eventType: 'user_action',
    eventName,
    userId,
    metadata,
  });
}

/**
 * 記錄系統事件
 */
export async function logSystemEvent(
  eventName: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    eventType: 'system',
    eventName,
    metadata,
  });
}

/**
 * 計時器 - 用於測量執行時間
 */
export function createTimer(): { stop: () => number } {
  const start = Date.now();
  return {
    stop: () => Date.now() - start,
  };
}

/**
 * 包裝函數 - 自動記錄執行時間和錯誤
 */
export async function withObservability<T>(
  eventName: string,
  fn: () => Promise<T>,
  options?: {
    userId?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<T> {
  const timer = createTimer();
  
  try {
    const result = await fn();
    
    await logEvent({
      eventType: 'system',
      eventName,
      userId: options?.userId,
      durationMs: timer.stop(),
      status: 'success',
      metadata: options?.metadata,
    });
    
    return result;
  } catch (error) {
    await logEvent({
      eventType: 'error',
      eventName,
      userId: options?.userId,
      durationMs: timer.stop(),
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: options?.metadata,
    });
    
    throw error;
  }
}
