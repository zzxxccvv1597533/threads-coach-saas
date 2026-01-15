import { eq, desc, and, or, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  ipProfiles, InsertIpProfile, IpProfile,
  ipProfileVersions,
  audienceSegments, InsertAudienceSegment, AudienceSegment,
  contentPillars, InsertContentPillar, ContentPillar,
  draftPosts, InsertDraftPost, DraftPost,
  draftHooks, InsertDraftHook, DraftHook,
  draftVersions,
  optimizationSessions, InsertOptimizationSession,
  posts, InsertPost, Post,
  postMetrics, InsertPostMetric, PostMetric,
  interactionTasks, InsertInteractionTask, InteractionTask,
  products, InsertProduct, Product,
  orders, InsertOrder, Order,
  orderItems,
  subscriptions, InsertSubscription, Subscription,
  promptTemplates, InsertPromptTemplate,
  apiUsageLogs,
  conversations,
  conversationMessages,
  rawMaterials,
  invitationCodes, InsertInvitationCode, InvitationCode,
  userWritingStyles, InsertUserWritingStyle, UserWritingStyle,
  keywordBenchmarks, KeywordBenchmark,
  contentHooks, ContentHook,
  viralLearnings, InsertViralLearning,
  viralExamples,
  topicTemplates,
  contentClusters,
  openerTemplates, InsertOpenerTemplate, OpenerTemplate,
  promptAvoidList, InsertPromptAvoidList, PromptAvoidList,
  templateStats, InsertTemplateStats, TemplateStats,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== 用戶相關 ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.email) {
    throw new Error("User email is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      email: user.email,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "openId", "loginMethod", "password"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      (values as Record<string, unknown>)[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserWithPassword(data: {
  email: string;
  password: string;
  name?: string;
  role?: 'user' | 'admin';
  activationStatus?: 'pending' | 'activated' | 'expired' | 'rejected';
  expiresAt?: Date;
  invitationCodeId?: number;
  invitationBonusDays?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 檢查 email 是否已存在
  const existing = await getUserByEmail(data.email);
  if (existing) {
    throw new Error("此 Email 已被註冊");
  }

  await db.insert(users).values({
    email: data.email,
    password: data.password,
    name: data.name || null,
    role: data.role || 'user',
    activationStatus: data.activationStatus || 'pending',
    expiresAt: data.expiresAt || null,
    loginMethod: 'password',
    invitationCodeId: data.invitationCodeId || null,
    invitationBonusDays: data.invitationBonusDays || null,
  });

  return getUserByEmail(data.email);
}

export async function updateUserPassword(userId: number, hashedPassword: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ password: hashedPassword })
    .where(eq(users.id, userId));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// 學員開通相關函數
export async function activateUser(userId: number, activatedBy: number, expiresAt?: Date, note?: string) {
  const db = await getDb();
  if (!db) return;
  
  // 先取得用戶資料，檢查是否有邀請碼額度
  const user = await getUserById(userId);
  let finalExpiresAt = expiresAt;
  
  // 如果用戶有邀請碼額度且沒有指定過期時間，套用邀請碼額度
  if (user?.invitationBonusDays && !expiresAt) {
    finalExpiresAt = new Date();
    finalExpiresAt.setDate(finalExpiresAt.getDate() + user.invitationBonusDays);
    
    // 標記邀請碼為已使用
    if (user.invitationCodeId) {
      await db.update(invitationCodes)
        .set({
          status: 'used',
          usedBy: userId,
          usedAt: new Date(),
        })
        .where(eq(invitationCodes.id, user.invitationCodeId));
    }
  }
  
  await db.update(users)
    .set({
      activationStatus: 'activated',
      activatedAt: new Date(),
      activatedBy,
      expiresAt: finalExpiresAt || null,
      activationNote: note || null,
    })
    .where(eq(users.id, userId));
}

export async function deactivateUser(userId: number, note?: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({
      activationStatus: 'expired',
      activationNote: note || null,
    })
    .where(eq(users.id, userId));
}

export async function rejectUser(userId: number, rejectedBy: number, reason?: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({
      activationStatus: 'rejected',
      rejectedAt: new Date(),
      rejectedBy,
      rejectionReason: reason || null,
    })
    .where(eq(users.id, userId));
}

export async function extendUserExpiry(userId: number, newExpiresAt: Date) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ expiresAt: newExpiresAt })
    .where(eq(users.id, userId));
}

export async function getPendingUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users)
    .where(eq(users.activationStatus, 'pending'))
    .orderBy(desc(users.createdAt));
}

export async function getActivatedUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users)
    .where(eq(users.activationStatus, 'activated'))
    .orderBy(desc(users.activatedAt));
}

export async function checkUserActivation(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!result[0]) return false;
  
  const user = result[0];
  
  // 檢查是否已開通
  if (user.activationStatus !== 'activated') return false;
  
  // 檢查是否過期
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    // 自動更新狀態為過期
    await db.update(users)
      .set({ activationStatus: 'expired' })
      .where(eq(users.id, userId));
    return false;
  }
  
  return true;
}

// ==================== IP 地基相關 ====================

export async function getIpProfileByUserId(userId: number): Promise<IpProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ipProfiles).where(eq(ipProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 別名
 export const getIpProfile = getIpProfileByUserId;

export async function upsertIpProfile(profile: InsertIpProfile): Promise<IpProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const existing = await getIpProfileByUserId(profile.userId);
  
  if (existing) {
    await db.update(ipProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(ipProfiles.id, existing.id));
    return { ...existing, ...profile };
  } else {
    await db.insert(ipProfiles).values(profile);
    return getIpProfileByUserId(profile.userId);
  }
}

export async function createIpProfileVersion(ipProfileId: number, note?: string) {
  const db = await getDb();
  if (!db) return;

  const profile = await db.select().from(ipProfiles).where(eq(ipProfiles.id, ipProfileId)).limit(1);
  if (!profile[0]) return;

  const currentVersion = profile[0].currentVersion || 1;
  
  await db.insert(ipProfileVersions).values({
    ipProfileId,
    version: currentVersion,
    snapshotJson: profile[0],
    note,
  });

  await db.update(ipProfiles)
    .set({ currentVersion: currentVersion + 1 })
    .where(eq(ipProfiles.id, ipProfileId));
}

// ==================== 受眾分析相關 ====================

export async function getAudienceSegmentsByUserId(userId: number): Promise<AudienceSegment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(audienceSegments).where(eq(audienceSegments.userId, userId)).orderBy(audienceSegments.priority);
}

export async function createAudienceSegment(segment: InsertAudienceSegment): Promise<AudienceSegment | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(audienceSegments).values(segment);
  const result = await db.select().from(audienceSegments).where(eq(audienceSegments.userId, segment.userId)).orderBy(desc(audienceSegments.id)).limit(1);
  return result[0];
}

export async function updateAudienceSegment(id: number, segment: Partial<InsertAudienceSegment>) {
  const db = await getDb();
  if (!db) return;
  await db.update(audienceSegments).set(segment).where(eq(audienceSegments.id, id));
}

export async function deleteAudienceSegment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(audienceSegments).where(eq(audienceSegments.id, id));
}

// ==================== 內容支柱相關 ====================

export async function getContentPillarsByUserId(userId: number): Promise<ContentPillar[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentPillars).where(eq(contentPillars.userId, userId));
}

export async function createContentPillar(pillar: InsertContentPillar): Promise<ContentPillar | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(contentPillars).values(pillar);
  const result = await db.select().from(contentPillars).where(eq(contentPillars.userId, pillar.userId)).orderBy(desc(contentPillars.id)).limit(1);
  return result[0];
}

export async function updateContentPillar(id: number, pillar: Partial<InsertContentPillar>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentPillars).set(pillar).where(eq(contentPillars.id, id));
}

export async function deleteContentPillar(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(contentPillars).where(eq(contentPillars.id, id));
}

// ==================== 草稿相關 ====================

export async function getDraftsByUserId(userId: number): Promise<DraftPost[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(draftPosts).where(eq(draftPosts.userId, userId)).orderBy(desc(draftPosts.updatedAt));
}

// 統計內容類型分佈
export async function getContentTypeStats(userId: number): Promise<{ contentType: string; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const drafts = await db.select().from(draftPosts).where(eq(draftPosts.userId, userId));
  
  const stats: Record<string, number> = {};
  for (const draft of drafts) {
    const type = draft.contentType || 'unknown';
    stats[type] = (stats[type] || 0) + 1;
  }
  
  return Object.entries(stats).map(([contentType, count]) => ({ contentType, count }));
}

export async function getDraftById(id: number): Promise<DraftPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(draftPosts).where(eq(draftPosts.id, id)).limit(1);
  return result[0];
}

export async function createDraft(draft: InsertDraftPost): Promise<DraftPost | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(draftPosts).values(draft);
  const result = await db.select().from(draftPosts).where(eq(draftPosts.userId, draft.userId)).orderBy(desc(draftPosts.id)).limit(1);
  return result[0];
}

export async function updateDraft(id: number, draft: Partial<InsertDraftPost>) {
  const db = await getDb();
  if (!db) return;
  await db.update(draftPosts).set({ ...draft, updatedAt: new Date() }).where(eq(draftPosts.id, id));
}

export async function deleteDraft(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(draftPosts).where(eq(draftPosts.id, id));
}

// ==================== Hook 相關 ====================

export async function getHooksByDraftId(draftPostId: number): Promise<DraftHook[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(draftHooks).where(eq(draftHooks.draftPostId, draftPostId));
}

export async function createHook(hook: InsertDraftHook): Promise<DraftHook | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(draftHooks).values(hook);
  const result = await db.select().from(draftHooks).where(eq(draftHooks.draftPostId, hook.draftPostId)).orderBy(desc(draftHooks.id)).limit(1);
  return result[0];
}

export async function selectHook(id: number, draftPostId: number) {
  const db = await getDb();
  if (!db) return;
  // 先取消所有選擇
  await db.update(draftHooks).set({ isSelected: false }).where(eq(draftHooks.draftPostId, draftPostId));
  // 選擇指定的 hook
  await db.update(draftHooks).set({ isSelected: true }).where(eq(draftHooks.id, id));
}

// ==================== 文案健檢相關 ====================

export async function createOptimizationSession(session: InsertOptimizationSession) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(optimizationSessions).values(session);
  const result = await db.select().from(optimizationSessions).where(eq(optimizationSessions.userId, session.userId)).orderBy(desc(optimizationSessions.id)).limit(1);
  return result[0];
}

export async function getOptimizationSessionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(optimizationSessions).where(eq(optimizationSessions.userId, userId)).orderBy(desc(optimizationSessions.createdAt));
}

// ==================== 貼文與戰報相關 ====================

export async function getPostsByUserId(userId: number): Promise<Post[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).where(eq(posts.userId, userId)).orderBy(desc(posts.postedAt));
}

export async function createPost(post: InsertPost): Promise<Post | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(posts).values(post);
  const result = await db.select().from(posts).where(eq(posts.userId, post.userId)).orderBy(desc(posts.id)).limit(1);
  return result[0];
}

export async function getPostById(postId: number): Promise<Post | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return result[0];
}

export async function deletePost(postId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // 先刪除相關的 metrics
  await db.delete(postMetrics).where(eq(postMetrics.postId, postId));
  // 再刪除貼文
  await db.delete(posts).where(eq(posts.id, postId));
  return true;
}

export async function getPostMetricsByPostId(postId: number): Promise<PostMetric[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(postMetrics).where(eq(postMetrics.postId, postId)).orderBy(desc(postMetrics.capturedAt));
}

export async function createPostMetric(metric: InsertPostMetric): Promise<PostMetric | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(postMetrics).values(metric);
  const result = await db.select().from(postMetrics).where(eq(postMetrics.postId, metric.postId)).orderBy(desc(postMetrics.id)).limit(1);
  return result[0];
}

export async function updatePostMetric(metricId: number, updates: Partial<InsertPostMetric>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(postMetrics).set(updates).where(eq(postMetrics.id, metricId));
}

export async function getWeeklyReport(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const userPosts = await db.select().from(posts).where(eq(posts.userId, userId));
  const postIds = userPosts.map(p => p.id);
  
  if (postIds.length === 0) return { posts: [], metrics: [], summary: null };
  
  const metrics = await db.select().from(postMetrics).where(sql`${postMetrics.postId} IN (${postIds.join(',')})`);
  
  const summary = {
    totalPosts: userPosts.length,
    totalReach: metrics.reduce((sum, m) => sum + (m.reach || 0), 0),
    totalLikes: metrics.reduce((sum, m) => sum + (m.likes || 0), 0),
    totalComments: metrics.reduce((sum, m) => sum + (m.comments || 0), 0),
    totalSaves: metrics.reduce((sum, m) => sum + (m.saves || 0), 0),
    avgEngagement: metrics.length > 0 ? metrics.reduce((sum, m) => sum + (m.likes || 0) + (m.comments || 0) * 2, 0) / metrics.length : 0,
  };
  
  return { posts: userPosts, metrics, summary };
}

// ==================== 互動任務相關 ====================

export async function getInteractionTasksByUserId(userId: number): Promise<InteractionTask[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(interactionTasks).where(eq(interactionTasks.userId, userId)).orderBy(desc(interactionTasks.dueDate));
}

export async function getTodayTasks(userId: number): Promise<InteractionTask[]> {
  const db = await getDb();
  if (!db) return [];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return db.select().from(interactionTasks)
    .where(and(
      eq(interactionTasks.userId, userId),
      sql`${interactionTasks.dueDate} >= ${today} AND ${interactionTasks.dueDate} < ${tomorrow}`
    ));
}

export async function createInteractionTask(task: InsertInteractionTask): Promise<InteractionTask | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(interactionTasks).values(task);
  const result = await db.select().from(interactionTasks).where(eq(interactionTasks.userId, task.userId)).orderBy(desc(interactionTasks.id)).limit(1);
  return result[0];
}

export async function updateInteractionTask(id: number, task: Partial<InsertInteractionTask>) {
  const db = await getDb();
  if (!db) return;
  await db.update(interactionTasks).set(task).where(eq(interactionTasks.id, id));
}

// ==================== 商品相關 ====================

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.status, 'active'));
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function createProduct(product: InsertProduct): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(products).values(product);
  const result = await db.select().from(products).orderBy(desc(products.id)).limit(1);
  return result[0];
}

export async function updateProduct(id: number, product: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set(product).where(eq(products.id, id));
}

// ==================== 訂單相關 ====================

export async function getOrdersByUserId(userId: number): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function createOrder(order: InsertOrder): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(orders).values(order);
  const result = await db.select().from(orders).where(eq(orders.userId, order.userId)).orderBy(desc(orders.id)).limit(1);
  return result[0];
}

export async function updateOrderStatus(id: number, status: 'pending' | 'paid' | 'failed' | 'refunded') {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ status }).where(eq(orders.id, id));
}

// ==================== 訂閱相關 ====================

export async function getActiveSubscription(userId: number): Promise<Subscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .limit(1);
  return result[0];
}

export async function createSubscription(subscription: InsertSubscription): Promise<Subscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(subscriptions).values(subscription);
  const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, subscription.userId)).orderBy(desc(subscriptions.id)).limit(1);
  return result[0];
}

// ==================== 提示詞模板相關 ====================

export async function getActivePromptTemplate(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(promptTemplates)
    .where(and(eq(promptTemplates.name, name), eq(promptTemplates.isActive, true)))
    .orderBy(desc(promptTemplates.version))
    .limit(1);
  return result[0];
}

export async function createPromptTemplate(template: InsertPromptTemplate) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(promptTemplates).values(template);
}

// ==================== API 用量記錄 ====================

export async function logApiUsage(userId: number, endpoint: string, model: string, tokensIn: number, tokensOut: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(apiUsageLogs).values({
    userId,
    endpoint,
    model,
    tokensIn,
    tokensOut,
    costEstimate: Math.round((tokensIn * 0.001 + tokensOut * 0.002) * 100), // 估算成本（分）
  });
}

export async function getApiUsageByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiUsageLogs).where(eq(apiUsageLogs.userId, userId)).orderBy(desc(apiUsageLogs.createdAt));
}


// ==================== 用戶產品矩陣 ====================

import { 
  userProducts, InsertUserProduct, UserProduct,
  successStories, InsertSuccessStory, SuccessStory,
  conversationSummaries, InsertConversationSummary, ConversationSummary,
  userGrowthMetrics, InsertUserGrowthMetric, UserGrowthMetric,
} from "../drizzle/schema";

export async function getUserProductsByUserId(userId: number): Promise<UserProduct[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userProducts)
    .where(and(eq(userProducts.userId, userId), eq(userProducts.isActive, true)))
    .orderBy(userProducts.productType);
}

export async function getUserProductByType(userId: number, productType: string): Promise<UserProduct | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userProducts)
    .where(and(
      eq(userProducts.userId, userId),
      eq(userProducts.productType, productType as any),
      eq(userProducts.isActive, true)
    ))
    .limit(1);
  return result[0];
}

export async function createUserProduct(product: InsertUserProduct): Promise<UserProduct | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(userProducts).values(product);
  const result = await db.select().from(userProducts)
    .where(eq(userProducts.userId, product.userId))
    .orderBy(desc(userProducts.id))
    .limit(1);
  return result[0];
}

export async function updateUserProduct(id: number, product: Partial<InsertUserProduct>) {
  const db = await getDb();
  if (!db) return;
  await db.update(userProducts).set({ ...product, updatedAt: new Date() }).where(eq(userProducts.id, id));
}

export async function deleteUserProduct(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(userProducts).set({ isActive: false }).where(eq(userProducts.id, id));
}

// ==================== 成功案例故事 ====================

export async function getSuccessStoriesByUserId(userId: number): Promise<SuccessStory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(successStories)
    .where(eq(successStories.userId, userId))
    .orderBy(desc(successStories.createdAt));
}

export async function createSuccessStory(story: InsertSuccessStory): Promise<SuccessStory | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(successStories).values(story);
  const result = await db.select().from(successStories)
    .where(eq(successStories.userId, story.userId))
    .orderBy(desc(successStories.id))
    .limit(1);
  return result[0];
}

export async function updateSuccessStory(id: number, story: Partial<InsertSuccessStory>) {
  const db = await getDb();
  if (!db) return;
  await db.update(successStories).set({ ...story, updatedAt: new Date() }).where(eq(successStories.id, id));
}

export async function deleteSuccessStory(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(successStories).where(eq(successStories.id, id));
}

// ==================== AI 記憶系統 ====================

export async function getConversationSummariesByUserId(userId: number): Promise<ConversationSummary[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversationSummaries)
    .where(eq(conversationSummaries.userId, userId))
    .orderBy(desc(conversationSummaries.relevanceScore), desc(conversationSummaries.updatedAt));
}

export async function getConversationSummariesByType(userId: number, summaryType: string): Promise<ConversationSummary[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversationSummaries)
    .where(and(
      eq(conversationSummaries.userId, userId),
      eq(conversationSummaries.summaryType, summaryType as any)
    ))
    .orderBy(desc(conversationSummaries.relevanceScore));
}

export async function createConversationSummary(summary: InsertConversationSummary): Promise<ConversationSummary | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(conversationSummaries).values(summary);
  const result = await db.select().from(conversationSummaries)
    .where(eq(conversationSummaries.userId, summary.userId))
    .orderBy(desc(conversationSummaries.id))
    .limit(1);
  return result[0];
}

export async function updateConversationSummary(id: number, summary: Partial<InsertConversationSummary>) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversationSummaries).set({ ...summary, updatedAt: new Date() }).where(eq(conversationSummaries.id, id));
}

export async function deleteConversationSummary(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(conversationSummaries).where(eq(conversationSummaries.id, id));
}

// 獲取用戶的 AI 記憶摘要（用於注入 prompt）
export async function getUserAIMemory(userId: number): Promise<string> {
  const summaries = await getConversationSummariesByUserId(userId);
  if (summaries.length === 0) return '';
  
  const memoryParts: string[] = [];
  
  const writingPrefs = summaries.filter(s => s.summaryType === 'writing_preference');
  if (writingPrefs.length > 0) {
    memoryParts.push(`【寫作偏好】\n${writingPrefs.map(s => s.content).join('\n')}`);
  }
  
  const successPatterns = summaries.filter(s => s.summaryType === 'content_success');
  if (successPatterns.length > 0) {
    memoryParts.push(`【成功內容特徵】\n${successPatterns.map(s => s.content).join('\n')}`);
  }
  
  const modPatterns = summaries.filter(s => s.summaryType === 'modification_pattern');
  if (modPatterns.length > 0) {
    memoryParts.push(`【修改偏好】\n${modPatterns.map(s => s.content).join('\n')}`);
  }
  
  const styleFeedback = summaries.filter(s => s.summaryType === 'style_feedback');
  if (styleFeedback.length > 0) {
    memoryParts.push(`【風格反饋】\n${styleFeedback.map(s => s.content).join('\n')}`);
  }
  
  return memoryParts.join('\n\n');
}

// ==================== 用戶經營狀態 ====================

export async function getUserGrowthMetrics(userId: number): Promise<UserGrowthMetric | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userGrowthMetrics)
    .where(eq(userGrowthMetrics.userId, userId))
    .limit(1);
  return result[0];
}

export async function upsertUserGrowthMetrics(metrics: InsertUserGrowthMetric): Promise<UserGrowthMetric | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const existing = await getUserGrowthMetrics(metrics.userId);
  
  if (existing) {
    await db.update(userGrowthMetrics)
      .set({ ...metrics, updatedAt: new Date() })
      .where(eq(userGrowthMetrics.id, existing.id));
    return { ...existing, ...metrics };
  } else {
    await db.insert(userGrowthMetrics).values(metrics);
    return getUserGrowthMetrics(metrics.userId);
  }
}

// 根據數據自動判斷經營階段
export async function calculateUserStage(userId: number): Promise<string> {
  const metrics = await getUserGrowthMetrics(userId);
  if (!metrics) return 'startup';
  
  // 如果用戶有手動設定階段，優先使用
  if (metrics.manualStage) {
    return metrics.manualStage;
  }
  
  const { 
    followerCount, 
    avgReach, 
    avgEngagementRate, 
    postFrequency,
    totalPosts,
    totalSales,
    hasLineLink,
    hasProduct
  } = metrics;
  
  // 計算經營分數（綜合評估）
  let score = 0;
  
  // 粉絲數評分（20分）
  const followers = followerCount || 0;
  if (followers >= 5000) score += 20;
  else if (followers >= 2000) score += 15;
  else if (followers >= 1000) score += 12;
  else if (followers >= 500) score += 8;
  else if (followers >= 100) score += 4;
  
  // 平均觸及評分（15分）
  const reach = avgReach || 0;
  if (reach >= 2000) score += 15;
  else if (reach >= 1000) score += 12;
  else if (reach >= 500) score += 8;
  else if (reach >= 200) score += 4;
  
  // 互動率評分（15分）- avgEngagementRate 是百分比 * 100
  const engagementRate = avgEngagementRate || 0;
  if (engagementRate >= 1000) score += 15; // 10%+
  else if (engagementRate >= 500) score += 12; // 5%+
  else if (engagementRate >= 300) score += 8; // 3%+
  else if (engagementRate >= 100) score += 4; // 1%+
  
  // 發文頻率評分（10分）- 週發文數
  const frequency = postFrequency || 0;
  if (frequency >= 7) score += 10; // 每天發文
  else if (frequency >= 5) score += 8;
  else if (frequency >= 3) score += 5;
  else if (frequency >= 1) score += 2;
  
  // 總發文數評分（10分）
  const posts = totalPosts || 0;
  if (posts >= 100) score += 10;
  else if (posts >= 50) score += 7;
  else if (posts >= 20) score += 4;
  else if (posts >= 10) score += 2;
  
  // 變現準備評分（30分）
  if (hasLineLink) score += 10;
  if (hasProduct) score += 10;
  if ((totalSales || 0) > 0) score += 10;
  
  // 根據總分判斷階段
  // 規模化：80+ 分
  if (score >= 80) {
    return 'scale';
  }
  
  // 變現期：55+ 分
  if (score >= 55) {
    return 'monetize';
  }
  
  // 成長期：30+ 分
  if (score >= 30) {
    return 'growth';
  }
  
  // 起步期
  return 'startup';
}

// 從戰報數據自動計算經營指標
export async function calculateMetricsFromReports(userId: number): Promise<{
  avgReach: number;
  avgEngagementRate: number;
  postFrequency: number;
  totalPosts: number;
}> {
  const db = await getDb();
  if (!db) return { avgReach: 0, avgEngagementRate: 0, postFrequency: 0, totalPosts: 0 };
  
  // 獲取用戶所有貼文
  const userPosts = await db.select().from(posts).where(eq(posts.userId, userId)).orderBy(desc(posts.postedAt));
  const totalPosts = userPosts.length;
  
  if (totalPosts === 0) {
    return { avgReach: 0, avgEngagementRate: 0, postFrequency: 0, totalPosts: 0 };
  }
  
  // 獲取最近 10 篇貼文的 metrics
  const recentPostIds = userPosts.slice(0, 10).map(p => p.id);
  const allMetrics = await db.select().from(postMetrics)
    .where(sql`${postMetrics.postId} IN (${recentPostIds.join(',')})`);
  
  // 計算平均觸及
  const totalReach = allMetrics.reduce((sum, m) => sum + (m.reach || 0), 0);
  const avgReach = allMetrics.length > 0 ? Math.round(totalReach / allMetrics.length) : 0;
  
  // 計算平均互動率 (愛心+留言+轉發) / 觸及 * 100
  let avgEngagementRate = 0;
  if (allMetrics.length > 0 && totalReach > 0) {
    const totalEngagement = allMetrics.reduce((sum, m) => 
      sum + (m.likes || 0) + (m.comments || 0) + (m.reposts || 0), 0);
    avgEngagementRate = Math.round((totalEngagement / totalReach) * 10000); // 乘 100 後再乘 100 儲存
  }
  
  // 計算過去 30 天的發文頻率（週發文數）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentPosts = userPosts.filter(p => p.postedAt && new Date(p.postedAt) >= thirtyDaysAgo);
  const postFrequency = Math.round((recentPosts.length / 30) * 7); // 轉換為週發文數
  
  return { avgReach, avgEngagementRate, postFrequency, totalPosts };
}

// 更新用戶經營指標（從戰報自動計算）
export async function updateMetricsFromReports(userId: number): Promise<void> {
  const calculatedMetrics = await calculateMetricsFromReports(userId);
  
  // 獲取現有指標
  const existing = await getUserGrowthMetrics(userId);
  
  // 自動判定 hasLineLink（從 IP 地基檢查）
  const ipProfile = await getIpProfile(userId);
  const hasLineLink = !!(ipProfile?.lineOfficialUrl && ipProfile.lineOfficialUrl.trim().length > 0);
  
  // 自動判定 hasProduct（從 userProducts 檢查是否有核心產品）
  const userProductsList = await getUserProductsByUserId(userId);
  const hasProduct = userProductsList.some((p: UserProduct) => p.productType === 'core');
  
  // 更新指標（保留用戶手動設定的欄位，如 followerCount、manualStage）
  await upsertUserGrowthMetrics({
    userId,
    followerCount: existing?.followerCount || 0,
    avgReach: calculatedMetrics.avgReach,
    avgEngagementRate: calculatedMetrics.avgEngagementRate,
    postFrequency: calculatedMetrics.postFrequency,
    totalPosts: calculatedMetrics.totalPosts,
    hasLineLink,
    hasProduct,
    totalSales: existing?.totalSales || 0,
    manualStage: existing?.manualStage || null,
  });
}

// ==================== 邀請碼相關 ====================

// 生成隨機邀請碼
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 創建邀請碼
export async function createInvitationCode(data: {
  createdBy: number;
  validDays?: number;
  cohort?: string; // 期別
  note?: string;
  expiresAt?: Date;
}): Promise<InvitationCode | null> {
  const db = await getDb();
  if (!db) return null;
  
  const code = generateInviteCode();
  const result = await db.insert(invitationCodes).values({
    code,
    createdBy: data.createdBy,
    validDays: data.validDays ?? 90,
    cohort: data.cohort,
    note: data.note,
    expiresAt: data.expiresAt,
    status: 'active',
  });
  
  const insertId = Number(result[0].insertId);
  const [created] = await db.select().from(invitationCodes).where(eq(invitationCodes.id, insertId));
  return created ?? null;
}

// 批量創建邀請碼
export async function createBatchInvitationCodes(data: {
  createdBy: number;
  count: number;
  validDays?: number;
  cohort?: string; // 期別
  note?: string;
  expiresAt?: Date;
}): Promise<InvitationCode[]> {
  const db = await getDb();
  if (!db) return [];
  
  const codes: InvitationCode[] = [];
  for (let i = 0; i < data.count; i++) {
    const code = await createInvitationCode({
      createdBy: data.createdBy,
      validDays: data.validDays,
      cohort: data.cohort,
      note: data.note,
      expiresAt: data.expiresAt,
    });
    if (code) codes.push(code);
  }
  return codes;
}

// 根據邀請碼查詢
export async function getInvitationCodeByCode(code: string): Promise<InvitationCode | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select().from(invitationCodes).where(eq(invitationCodes.code, code));
  return result ?? null;
}

// 驗證並使用邀請碼
export async function useInvitationCode(code: string, userId: number): Promise<{ success: boolean; message: string; validDays?: number; cohort?: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: '資料庫連接失敗' };
  
  const invitation = await getInvitationCodeByCode(code);
  if (!invitation) {
    return { success: false, message: '邀請碼不存在' };
  }
  
  if (invitation.status !== 'active') {
    return { success: false, message: '邀請碼已被使用或已失效' };
  }
  
  if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
    // 更新狀態為過期
    await db.update(invitationCodes)
      .set({ status: 'expired' })
      .where(eq(invitationCodes.id, invitation.id));
    return { success: false, message: '邀請碼已過期' };
  }
  
  // 使用邀請碼
  await db.update(invitationCodes)
    .set({ 
      usedBy: userId, 
      usedAt: new Date(),
      status: 'used',
    })
    .where(eq(invitationCodes.id, invitation.id));
  
  // 更新用戶的開通狀態和期別
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + invitation.validDays);
  
  // 如果邀請碼有設定期別，自動帶入學員資料
  const updateData: any = {
    activationStatus: 'activated',
    activatedAt: new Date(),
    expiresAt: expiresAt,
    activationNote: `使用邀請碼 ${code} 開通`,
  };
  
  if (invitation.cohort) {
    updateData.cohort = invitation.cohort;
  }
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId));
  
  return { success: true, message: '開通成功', validDays: invitation.validDays, cohort: invitation.cohort || undefined };
}

// 獲取所有邀請碼（管理員用）
export async function getAllInvitationCodes(): Promise<InvitationCode[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(invitationCodes).orderBy(desc(invitationCodes.createdAt));
}

// 撤銷邀請碼
export async function revokeInvitationCode(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(invitationCodes)
    .set({ status: 'revoked' })
    .where(eq(invitationCodes.id, id));
  return true;
}

// 獲取用戶列表（管理員用，包含開通狀態）
export async function getAllUsersWithActivation(): Promise<(typeof users.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(users).orderBy(desc(users.createdAt));
}


// ==================== 用戶風格分析 ====================

export async function getUserWritingStyle(userId: number): Promise<UserWritingStyle | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userWritingStyles)
    .where(eq(userWritingStyles.userId, userId))
    .limit(1);
  return result[0] || null;
}

export async function upsertUserWritingStyle(style: InsertUserWritingStyle): Promise<UserWritingStyle | null> {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await getUserWritingStyle(style.userId);
  
  if (existing) {
    await db.update(userWritingStyles)
      .set({ ...style, updatedAt: new Date() })
      .where(eq(userWritingStyles.id, existing.id));
    return { ...existing, ...style } as UserWritingStyle;
  } else {
    await db.insert(userWritingStyles).values(style);
    return getUserWritingStyle(style.userId);
  }
}

export async function addSamplePost(userId: number, content: string, engagement?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const existing = await getUserWritingStyle(userId);
  const newPost = {
    content,
    engagement,
    addedAt: new Date().toISOString(),
  };
  
  if (existing) {
    const currentPosts = existing.samplePosts || [];
    await db.update(userWritingStyles)
      .set({ 
        samplePosts: [...currentPosts, newPost],
        analysisStatus: 'pending', // 新增貼文後需要重新分析
        updatedAt: new Date(),
      })
      .where(eq(userWritingStyles.id, existing.id));
  } else {
    await db.insert(userWritingStyles).values({
      userId,
      samplePosts: [newPost],
      analysisStatus: 'pending',
    });
  }
  
  return true;
}

export async function removeSamplePost(userId: number, index: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const existing = await getUserWritingStyle(userId);
  if (!existing || !existing.samplePosts) return false;
  
  const updatedPosts = [...existing.samplePosts];
  updatedPosts.splice(index, 1);
  
  await db.update(userWritingStyles)
    .set({ 
      samplePosts: updatedPosts,
      analysisStatus: 'pending', // 移除貼文後需要重新分析
      updatedAt: new Date(),
    })
    .where(eq(userWritingStyles.id, existing.id));
  
  return true;
}

export async function updateWritingStyleAnalysis(
  userId: number, 
  analysis: Partial<InsertUserWritingStyle>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const existing = await getUserWritingStyle(userId);
  if (!existing) return false;
  
  await db.update(userWritingStyles)
    .set({ 
      ...analysis,
      analysisStatus: 'completed',
      lastAnalyzedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userWritingStyles.id, existing.id));
  
  return true;
}


// ==================== 教練專區 ====================

// 更新學員標註資料
export async function updateUserCoachInfo(
  userId: number,
  data: {
    cohort?: string | null;
    coachNote?: string | null;
    coachTags?: string[] | null;
    threadsHandle?: string | null;
  }
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(users)
    .set({
      cohort: data.cohort,
      coachNote: data.coachNote,
      coachTags: data.coachTags ? JSON.stringify(data.coachTags) : null,
      threadsHandle: data.threadsHandle,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  
  return true;
}

// 依期別取得學員列表
export async function getUsersByCohort(cohort: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(users)
    .where(eq(users.cohort, cohort))
    .orderBy(desc(users.createdAt));
}

// 取得所有期別列表
export async function getAllCohorts(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.selectDistinct({ cohort: users.cohort })
    .from(users)
    .where(sql`${users.cohort} IS NOT NULL AND ${users.cohort} != ''`);
  
  return result.map(r => r.cohort).filter((c): c is string => c !== null);
}

// 取得學員詳細資料（含 IP 地基、戰報統計）
export async function getStudentDetail(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // 取得用戶基本資料
  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userResult.length === 0) return null;
  const user = userResult[0];
  
  // 取得 IP 地基
  const ipProfile = await getIpProfile(userId);
  
  // 取得戰報統計
  const postsResult = await db.select().from(posts).where(eq(posts.userId, userId));
  const postIds = postsResult.map(p => p.id);
  
  let metricsStats = {
    totalPosts: postsResult.length,
    totalReach: 0,
    totalLikes: 0,
    totalComments: 0,
    avgEngagement: 0,
    viralPosts: 0,
  };
  
  if (postIds.length > 0) {
    const metricsResult = await db.select().from(postMetrics)
      .where(sql`${postMetrics.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`);
    
    for (const m of metricsResult) {
      metricsStats.totalReach += m.reach || 0;
      metricsStats.totalLikes += m.likes || 0;
      metricsStats.totalComments += m.comments || 0;
      if (m.isViral) metricsStats.viralPosts++;
    }
    
    if (metricsResult.length > 0) {
      metricsStats.avgEngagement = Math.round(
        (metricsStats.totalLikes + metricsStats.totalComments) / metricsResult.length
      );
    }
  }
  
  return {
    user,
    ipProfile,
    stats: metricsStats,
  };
}

// 取得所有學員的戰報列表（教練專區用）
export async function getAllStudentReports(options?: {
  cohort?: string;
  userId?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { reports: [], total: 0 };
  
  // 先取得符合條件的用戶
  let userQuery = db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    cohort: users.cohort,
    threadsHandle: users.threadsHandle,
    coachTags: users.coachTags,
  }).from(users);
  
  const conditions = [];
  if (options?.cohort) {
    conditions.push(eq(users.cohort, options.cohort));
  }
  if (options?.userId) {
    conditions.push(eq(users.id, options.userId));
  }
  
  if (conditions.length > 0) {
    userQuery = userQuery.where(and(...conditions)) as any;
  }
  
  const usersResult = await userQuery;
  const userMap = new Map(usersResult.map(u => [u.id, u]));
  const userIds = usersResult.map(u => u.id);
  
  if (userIds.length === 0) {
    return { reports: [], total: 0 };
  }
  
  // 取得這些用戶的所有貼文和戰報
  const postsWithMetrics = await db
    .select({
      post: posts,
      metrics: postMetrics,
    })
    .from(posts)
    .leftJoin(postMetrics, eq(posts.id, postMetrics.postId))
    .where(sql`${posts.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(desc(posts.createdAt))
    .limit(options?.limit || 100)
    .offset(options?.offset || 0);
  
  // 計算總數
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(posts)
    .where(sql`${posts.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
  
  const total = countResult[0]?.count || 0;
  
  // 組合結果
  const reports = postsWithMetrics.map(({ post, metrics }) => {
    const user = userMap.get(post.userId);
    return {
      postId: post.id,
      userId: post.userId,
      userName: user?.name || '未知',
      userEmail: user?.email || '',
      cohort: user?.cohort || '',
      threadsHandle: user?.threadsHandle || '',
      threadUrl: post.threadUrl,
      postedAt: post.postedAt,
      createdAt: post.createdAt,
      // 戰報數據
      reach: metrics?.reach || 0,
      likes: metrics?.likes || 0,
      comments: metrics?.comments || 0,
      reposts: metrics?.reposts || 0,
      saves: metrics?.saves || 0,
      profileVisits: metrics?.profileVisits || 0,
      linkClicks: metrics?.linkClicks || 0,
      inquiries: metrics?.inquiries || 0,
      notes: metrics?.notes || '',
      postingTime: metrics?.postingTime || '',
      topComment: metrics?.topComment || '',
      selfReflection: metrics?.selfReflection || '',
      aiInsight: metrics?.aiInsight || '',
      performanceLevel: metrics?.performanceLevel || 'normal',
      isViral: metrics?.isViral || false,
      viralAnalysis: metrics?.viralAnalysis || '',
    };
  });
  
  return { reports, total };
}

// 取得學員戰報詳情（含貼文內容）
export async function getStudentReportDetail(postId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // 取得貼文
  const postResult = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (postResult.length === 0) return null;
  const post = postResult[0];
  
  // 取得用戶資料
  const userResult = await db.select().from(users).where(eq(users.id, post.userId)).limit(1);
  const user = userResult[0];
  
  // 取得戰報數據
  const metricsResult = await db.select().from(postMetrics).where(eq(postMetrics.postId, postId)).limit(1);
  const metrics = metricsResult[0];
  
  // 取得草稿內容（如果有）
  let draftContent = null;
  if (post.draftPostId) {
    const draftResult = await db.select().from(draftPosts).where(eq(draftPosts.id, post.draftPostId)).limit(1);
    if (draftResult.length > 0) {
      draftContent = draftResult[0];
    }
  }
  
  return {
    post,
    user: {
      id: user?.id,
      name: user?.name,
      email: user?.email,
      cohort: user?.cohort,
      threadsHandle: user?.threadsHandle,
      coachNote: user?.coachNote,
      coachTags: user?.coachTags ? JSON.parse(user.coachTags as string) : [],
    },
    metrics,
    draftContent,
  };
}

// 取得學員列表（含統計資料，教練專區用）
export async function getStudentsWithStats(options?: {
  cohort?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  // 取得用戶列表
  let query = db.select().from(users);
  
  const conditions = [];
  // 只取已開通的學員
  conditions.push(eq(users.activationStatus, 'activated'));
  
  if (options?.cohort) {
    conditions.push(eq(users.cohort, options.cohort));
  }
  if (options?.search) {
    conditions.push(
      or(
        sql`${users.name} LIKE ${`%${options.search}%`}`,
        sql`${users.email} LIKE ${`%${options.search}%`}`,
        sql`${users.threadsHandle} LIKE ${`%${options.search}%`}`
      )
    );
  }
  
  query = query.where(and(...conditions)) as any;
  const usersResult = await query.orderBy(desc(users.createdAt));
  
  // 為每個用戶取得統計資料
  const studentsWithStats = await Promise.all(
    usersResult.map(async (user) => {
      // 取得貼文數量
      const postsResult = await db.select({ count: sql<number>`COUNT(*)` })
        .from(posts)
        .where(eq(posts.userId, user.id));
      const postCount = postsResult[0]?.count || 0;
      
      // 取得最近一篇戰報
      const latestPostResult = await db.select()
        .from(posts)
        .leftJoin(postMetrics, eq(posts.id, postMetrics.postId))
        .where(eq(posts.userId, user.id))
        .orderBy(desc(posts.createdAt))
        .limit(1);
      
      const latestPost = latestPostResult[0];
      
      // 取得 IP 地基完成度
      const ipProfile = await getIpProfile(user.id);
      const ipCompleteness = calculateIpCompleteness(ipProfile);
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        cohort: user.cohort,
        threadsHandle: user.threadsHandle,
        coachNote: user.coachNote,
        coachTags: user.coachTags ? JSON.parse(user.coachTags as string) : [],
        activatedAt: user.activatedAt,
        expiresAt: user.expiresAt,
        lastSignedIn: user.lastSignedIn,
        // 統計資料
        postCount,
        latestPostDate: latestPost?.posts?.createdAt || null,
        latestPostReach: latestPost?.post_metrics?.reach || 0,
        ipCompleteness,
      };
    })
  );
  
  return studentsWithStats;
}

// 計算 IP 地基完成度
function calculateIpCompleteness(ipProfile: any): number {
  if (!ipProfile) return 0;
  
  const fields = [
    'occupation',
    'voiceTone',
    'viewpointStatement',
    'personaExpertise',
    'personaEmotion',
    'personaViewpoint',
    'heroJourneyOrigin',
    'heroJourneyProcess',
    'heroJourneyHero',
    'heroJourneyMission',
  ];
  
  let filled = 0;
  for (const field of fields) {
    if (ipProfile[field]) filled++;
  }
  
  return Math.round((filled / fields.length) * 100);
}


// ==================== 批次操作函數 ====================

// 批次更新學員期別
export async function batchUpdateUserCohort(userIds: number[], cohort: string | null) {
  const db = await getDb();
  if (!db || userIds.length === 0) return;
  
  await db.update(users)
    .set({ cohort })
    .where(inArray(users.id, userIds));
}

// 批次新增學員標籤
export async function batchAddUserTags(userIds: number[], newTags: string[]) {
  const db = await getDb();
  if (!db || userIds.length === 0 || newTags.length === 0) return;
  
  // 取得現有標籤並合併
  const usersData = await db.select({ id: users.id, coachTags: users.coachTags })
    .from(users)
    .where(inArray(users.id, userIds));
  
  for (const user of usersData) {
    const existingTags: string[] = user.coachTags ? JSON.parse(user.coachTags as string) : [];
    const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
    await db.update(users)
      .set({ coachTags: JSON.stringify(mergedTags) })
      .where(eq(users.id, user.id));
  }
}

// 批次撤銷邀請碼
export async function batchRevokeInvitationCodes(ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  
  await db.update(invitationCodes)
    .set({ status: 'revoked' })
    .where(and(
      inArray(invitationCodes.id, ids),
      eq(invitationCodes.status, 'active')
    ));
}

// 批次標記戰報已閱讀（在 postMetrics 新增 isRead 欄位或使用其他方式追蹤）
export async function batchMarkReportsAsRead(postIds: number[]) {
  const db = await getDb();
  if (!db || postIds.length === 0) return;
  
  // 使用 coachNote 欄位標記已閱讀（或可以新增專門欄位）
  await db.update(postMetrics)
    .set({ notes: sql`CONCAT(IFNULL(${postMetrics.notes}, ''), ' [已閱讀]')` })
    .where(inArray(postMetrics.postId, postIds));
}

// 匯出學員資料
export async function exportStudentsData(options?: {
  userIds?: number[];
  cohort?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    cohort: users.cohort,
    threadsHandle: users.threadsHandle,
    coachNote: users.coachNote,
    coachTags: users.coachTags,
    activatedAt: users.activatedAt,
    expiresAt: users.expiresAt,
    lastSignedIn: users.lastSignedIn,
    createdAt: users.createdAt,
  }).from(users);
  
  const conditions = [eq(users.activationStatus, 'activated')];
  
  if (options?.userIds && options.userIds.length > 0) {
    conditions.push(inArray(users.id, options.userIds));
  }
  if (options?.cohort) {
    conditions.push(eq(users.cohort, options.cohort));
  }
  
  query = query.where(and(...conditions)) as any;
  const result = await query.orderBy(desc(users.createdAt));
  
  return result.map(user => ({
    ...user,
    coachTags: user.coachTags ? JSON.parse(user.coachTags as string) : [],
  }));
}

// 匯出戰報資料
export async function exportReportsData(options?: {
  postIds?: number[];
  cohort?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  // 取得貼文和戰報數據
  let query = db.select({
    postId: posts.id,
    userId: posts.userId,
    threadUrl: posts.threadUrl,
    postedAt: posts.postedAt,
    createdAt: posts.createdAt,
    reach: postMetrics.reach,
    likes: postMetrics.likes,
    comments: postMetrics.comments,
    reposts: postMetrics.reposts,
    saves: postMetrics.saves,
    profileVisits: postMetrics.profileVisits,
    linkClicks: postMetrics.linkClicks,
    inquiries: postMetrics.inquiries,
    notes: postMetrics.notes,
    postingTime: postMetrics.postingTime,
    topComment: postMetrics.topComment,
    selfReflection: postMetrics.selfReflection,
    aiInsight: postMetrics.aiInsight,
    performanceLevel: postMetrics.performanceLevel,
    isViral: postMetrics.isViral,
    viralAnalysis: postMetrics.viralAnalysis,
  })
  .from(posts)
  .leftJoin(postMetrics, eq(posts.id, postMetrics.postId));
  
  const conditions = [];
  
  if (options?.postIds && options.postIds.length > 0) {
    conditions.push(inArray(posts.id, options.postIds));
  }
  if (options?.userId) {
    conditions.push(eq(posts.userId, options.userId));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const postsResult = await query.orderBy(desc(posts.createdAt));
  
  // 取得用戶資料
  const userIds = Array.from(new Set(postsResult.map(p => p.userId)));
  const usersData = userIds.length > 0 
    ? await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        cohort: users.cohort,
        threadsHandle: users.threadsHandle,
      })
      .from(users)
      .where(inArray(users.id, userIds))
    : [];
  
  const userMap = new Map(usersData.map(u => [u.id, u]));
  
  // 如果有 cohort 篩選，過濾結果
  let filteredPosts = postsResult;
  if (options?.cohort) {
    filteredPosts = postsResult.filter(p => {
      const user = userMap.get(p.userId);
      return user?.cohort === options.cohort;
    });
  }
  
  return filteredPosts.map(post => {
    const user = userMap.get(post.userId);
    return {
      ...post,
      userName: user?.name || '',
      userEmail: user?.email || '',
      userCohort: user?.cohort || '',
      threadsHandle: user?.threadsHandle || '',
    };
  });
}


// ===== 草稿批次操作 =====

// 批次刪除草稿
export async function batchDeleteDrafts(userId: number, draftIds: number[]): Promise<number> {
  if (draftIds.length === 0) return 0;
  const database = await getDb();
  if (!database) return 0;
  await database.delete(draftPosts)
    .where(and(
      eq(draftPosts.userId, userId),
      inArray(draftPosts.id, draftIds)
    ));
  return draftIds.length;
}

// 批次移動草稿分類
export async function batchMoveDrafts(userId: number, draftIds: number[], contentType: string): Promise<number> {
  if (draftIds.length === 0) return 0;
  const database = await getDb();
  if (!database) return 0;
  await database.update(draftPosts)
    .set({ contentType: contentType as any })
    .where(and(
      eq(draftPosts.userId, userId),
      inArray(draftPosts.id, draftIds)
    ));
  return draftIds.length;
}

// 批次封存草稿
export async function batchArchiveDrafts(userId: number, draftIds: number[]): Promise<number> {
  if (draftIds.length === 0) return 0;
  const database = await getDb();
  if (!database) return 0;
  await database.update(draftPosts)
    .set({ status: 'archived' })
    .where(and(
      eq(draftPosts.userId, userId),
      inArray(draftPosts.id, draftIds)
    ));
  return draftIds.length;
}


// ==================== 爆文數據分析系統 ====================

// 取得關鍵字 Benchmark 數據
export async function getKeywordBenchmark(keyword: string): Promise<KeywordBenchmark | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(keywordBenchmarks)
    .where(eq(keywordBenchmarks.keyword, keyword))
    .limit(1);
  
  return result[0] || null;
}

// 取得所有關鍵字 Benchmark 列表
export async function getAllKeywordBenchmarks(): Promise<KeywordBenchmark[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(keywordBenchmarks)
    .orderBy(desc(keywordBenchmarks.viralRate));
}

// 根據分類取得關鍵字 Benchmark
export async function getKeywordBenchmarksByCategory(category: string): Promise<KeywordBenchmark[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(keywordBenchmarks)
    .where(eq(keywordBenchmarks.category, category))
    .orderBy(desc(keywordBenchmarks.viralRate));
}

// 模糊匹配關鍵字（用於從內容中識別關鍵字）
export async function findMatchingKeywords(content: string): Promise<KeywordBenchmark[]> {
  const db = await getDb();
  if (!db) return [];
  
  // 取得所有關鍵字
  const allKeywords = await db.select().from(keywordBenchmarks);
  
  // 找出內容中包含的關鍵字
  const matches = allKeywords.filter(kw => 
    content.toLowerCase().includes(kw.keyword.toLowerCase())
  );
  
  // 按爆文率排序
  return matches.sort((a, b) => (b.viralRate || 0) - (a.viralRate || 0));
}

// 取得開頭鉤子庫
export async function getContentHooks(options?: {
  type?: string;
  limit?: number;
}): Promise<ContentHook[]> {
  const database = await getDb();
  if (!database) return [];
  
  const conditions = [eq(contentHooks.isActive, true)];
  
  if (options?.type) {
    conditions.push(eq(contentHooks.hookType, options.type));
  }
  
  let query = database.select().from(contentHooks)
    .where(and(...conditions))
    .orderBy(desc(contentHooks.avgLikes));
  
  if (options?.limit) {
    query = query.limit(options.limit) as any;
  }
  
  return query;
}

// 根據內容類型取得推薦鉤子
export async function getRecommendedHooks(contentType: string, limit: number = 5): Promise<ContentHook[]> {
  const db = await getDb();
  if (!db) return [];
  
  // 根據內容類型映射到鉤子類型
  const hookTypeMap: Record<string, string[]> = {
    'story': ['story', 'contrast', 'result'],
    'knowledge': ['number', 'solution', 'list'],
    'viewpoint': ['contrast', 'direct', 'mirror'],
    'dialogue': ['dialogue', 'story', 'question'],
    'question': ['question', 'mirror'],
    'casual': ['emotion', 'direct', 'story'],
    'quote': ['quote', 'contrast'],
    'contrast': ['contrast', 'result'],
    'diagnosis': ['identity', 'question'],
  };
  
  const preferredTypes = hookTypeMap[contentType] || ['general'];
  
  // 取得符合的鉤子
  const hooks = await db.select().from(contentHooks)
    .where(and(
      eq(contentHooks.isActive, true),
      inArray(contentHooks.hookType, preferredTypes)
    ))
    .orderBy(desc(contentHooks.avgLikes))
    .limit(limit * 2); // 多取一些以便隨機選擇
  
  // 隨機選擇
  const shuffled = hooks.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

// 記錄學員爆文學習
export async function recordViralLearning(data: InsertViralLearning): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(viralLearnings).values(data);
}

// 取得學員的爆文學習記錄
export async function getUserViralLearnings(userId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(viralLearnings)
    .where(eq(viralLearnings.userId, userId))
    .orderBy(desc(viralLearnings.createdAt))
    .limit(limit);
}

// 取得未整合的爆文學習記錄（用於知識庫更新）
export async function getUnintegratedViralLearnings(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(viralLearnings)
    .where(eq(viralLearnings.isIntegrated, false))
    .orderBy(desc(viralLearnings.likes))
    .limit(limit);
}

// 標記爆文學習為已整合
export async function markViralLearningAsIntegrated(learningId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(viralLearnings)
    .set({ 
      isIntegrated: true,
      integratedAt: new Date()
    })
    .where(eq(viralLearnings.id, learningId));
}

// 建構爆文因子提示（用於 AI 生成）
// 爆文因子 Lift 分析結果（從 Excel 數據中提取）
const VIRAL_FACTORS_LIFT = {
  // 應該加入的因子（正面影響）
  positive: [
    { feature: 'result_flag', lift: 0.023, description: '結果導向詞（「結果」「後來」「最後」）', impact: 'Top10 命中率提升 2.3%' },
    { feature: 'exclaim_mark', lift: 0.006, description: '驚嘆號使用', impact: 'Top10 命中率提升 0.6%' },
    { feature: 'you_flag', lift: 0.003, description: '「你」字使用（跟讀者對話）', impact: 'Top10 命中率提升 0.3%' },
  ],
  // 應該避免的因子（負面影響）
  negative: [
    { feature: 'cta_flag', lift: -0.057, description: 'CTA 硬塞', impact: 'Top10 命中率下降 5.7%' },
    { feature: 'turn_flag', lift: -0.042, description: '轉折詞過多（「但是」「然而」）', impact: 'Top10 命中率下降 4.2%' },
    { feature: 'question_mark', lift: -0.039, description: '問號過多', impact: 'Top10 命中率下降 3.9%' },
    { feature: 'has_number', lift: -0.007, description: '數字過多', impact: 'Top10 命中率下降 0.7%' },
  ],
};

export function buildViralFactorsPrompt(benchmarks: KeywordBenchmark[]): string {
  if (benchmarks.length === 0) {
    // 即使沒有匹配到關鍵字，也提供通用的爆文因子建議
    return `
=== 爆文因子建議（數據驗證，隱性優化） ===

【✅ 應該加入的元素】
1. 結果導向詞：使用「結果」「後來」「最後」等詞彙（Top10 命中率 +2.3%）
2. 驚嘆號：適當使用「！」增加情緒張力（Top10 命中率 +0.6%）
3. 「你」字：跟讀者直接對話（Top10 命中率 +0.3%）

【❌ 應該避免的元素】
1. CTA 硬塞：不要強迫推銷或引導追蹤（Top10 命中率 -5.7%）
2. 轉折詞過多：減少「但是」「然而」（Top10 命中率 -4.2%）
3. 問號過多：不要連續提問（Top10 命中率 -3.9%）
`;
  }
  
  const topBenchmark = benchmarks[0];
  const factors = topBenchmark.viralFactors;
  const funnel = (topBenchmark as any).funnelSuggestions;
  
  let prompt = `
=== 市場數據參考（隱性優化，不要在內容中提及） ===
`;

  // 基本資訊
  if (topBenchmark.keyword) {
    prompt += `相關主題：${topBenchmark.keyword}\n`;
  }
  
  if (topBenchmark.category) {
    prompt += `主題分類：${topBenchmark.category}\n`;
  }
  
  if (topBenchmark.avgLikes) {
    prompt += `市場平均讚數：${topBenchmark.avgLikes.toLocaleString()}\n`;
  }
  
  if (topBenchmark.viralRate) {
    const viralRatePct = (topBenchmark.viralRate / 100).toFixed(1);
    prompt += `Top10 爆文率：${viralRatePct}%\n`;
  }

  // 根據該關鍵字的實際數據生成建議
  prompt += `\n【✅ 應該加入的元素】\n`;
  
  // 結果導向
  if (factors?.resultFlag !== undefined) {
    const resultPct = (factors.resultFlag * 100).toFixed(1);
    if (factors.resultFlag > 0.1) {
      prompt += `1. ⭐ 結果導向詞：該主題爆文中 ${resultPct}% 使用結果導向，強烈建議使用「結果」「後來」「最後」\n`;
    } else if (factors.resultFlag > 0.05) {
      prompt += `1. 結果導向詞：建議使用「結果」「後來」「最後」（爆文中使用率 ${resultPct}%）\n`;
    } else {
      prompt += `1. 結果導向詞：可適度使用（通用建議，Top10 命中率 +2.3%）\n`;
    }
  } else {
    prompt += `1. 結果導向詞：使用「結果」「後來」「最後」（Top10 命中率 +2.3%）\n`;
  }
  
  // 驚嘆號和「你」字
  prompt += `2. 驚嘆號：適當使用「！」增加情緒張力（Top10 命中率 +0.6%）\n`;
  prompt += `3. 「你」字：跟讀者直接對話，增加親切感（Top10 命中率 +0.3%）\n`;

  // 應該避免的元素
  prompt += `\n【❌ 應該避免的元素】\n`;
  
  // CTA
  if (factors?.ctaFlag !== undefined) {
    const ctaPct = (factors.ctaFlag * 100).toFixed(1);
    if (factors.ctaFlag > 0.2) {
      prompt += `1. ⚠️ CTA 硬塞：該主題 CTA 使用率達 ${ctaPct}%，但爆文通常不硬塞 CTA（Top10 命中率 -5.7%）\n`;
    } else if (factors.ctaFlag > 0.1) {
      prompt += `1. CTA 硬塞：避免強迫推銷或引導追蹤（Top10 命中率 -5.7%）\n`;
    } else {
      prompt += `1. CTA 硬塞：該主題爆文很少用 CTA（僅 ${ctaPct}%），保持自然\n`;
    }
  } else {
    prompt += `1. CTA 硬塞：不要強迫推銷或引導追蹤（Top10 命中率 -5.7%）\n`;
  }
  
  // 問號
  if (factors?.questionMark !== undefined) {
    const qPct = (factors.questionMark * 100).toFixed(1);
    if (factors.questionMark > 0.3) {
      prompt += `2. ⚠️ 問號過多：該主題問號使用率 ${qPct}%，但過多問號會降低爆文率（Top10 命中率 -3.9%）\n`;
    } else {
      prompt += `2. 問號過多：不要連續提問（Top10 命中率 -3.9%）\n`;
    }
  } else {
    prompt += `2. 問號過多：不要連續提問（Top10 命中率 -3.9%）\n`;
  }
  
  // 轉折詞
  prompt += `3. 轉折詞過多：減少「但是」「然而」（Top10 命中率 -4.2%）\n`;

  // 漏斗建議（如果有）
  if (funnel && (funnel.tofu || funnel.mofu || funnel.bofu)) {
    prompt += `\n【🎯 內容策略建議】\n`;
    if (funnel.tofu) {
      prompt += `TOFU（吸引流量）：${funnel.tofu}\n`;
    }
    if (funnel.mofu) {
      prompt += `MOFU（建立信任）：${funnel.mofu}\n`;
    }
    if (funnel.bofu) {
      prompt += `BOFU（引導轉化）：${funnel.bofu}\n`;
    }
  }

  return prompt;
}

// 建構開頭鉤子提示（用於 AI 生成）
export function buildHooksPrompt(hooks: ContentHook[]): string {
  if (hooks.length === 0) return '';
  
  const hookPatterns = hooks
    .filter(h => h.hookPattern && h.hookPattern.length < 50) // 只取短的模式
    .slice(0, 5)
    .map(h => `- ${h.hookPattern}`)
    .join('\n');
  
  if (!hookPatterns) return '';
  
  return `
=== 開頭參考模式（可參考但不要照抄） ===
${hookPatterns}

【注意】這些只是參考模式，請根據內容自然發揮，不要生硬套用。
`;
}


// ============================================
// 知識庫自動更新功能
// ============================================

// 檢查鉤子是否已存在（去重機制）
export async function isHookPatternExists(hookPattern: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // 清理鉤子模式（移除空白、標點符號差異）
  const cleanPattern = hookPattern.trim().toLowerCase();
  
  // 取得所有現有鉤子
  const existingHooks = await db.select({ hookPattern: contentHooks.hookPattern })
    .from(contentHooks);
  
  // 檢查是否有相似的鉤子（使用簡單的相似度比較）
  for (const hook of existingHooks) {
    if (!hook.hookPattern) continue;
    const existingClean = hook.hookPattern.trim().toLowerCase();
    
    // 完全相同
    if (existingClean === cleanPattern) return true;
    
    // 相似度超過 80%（簡單的字元比較）
    const similarity = calculateSimilarity(existingClean, cleanPattern);
    if (similarity > 0.8) return true;
  }
  
  return false;
}

// 簡單的字串相似度計算
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  // 計算編輯距離
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Levenshtein 距離計算
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
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
  
  return matrix[str1.length][str2.length];
}

// 從爆文學習記錄中提取並新增鉤子到知識庫
export async function integrateViralLearningToHooks(learning: {
  id: number;
  extractedHook: string | null;
  contentType: string | null;
  likes: number | null;
  successFactors: string[] | null;
}): Promise<{ success: boolean; reason: string }> {
  const db = await getDb();
  if (!db) return { success: false, reason: '資料庫連線失敗' };
  
  // 檢查是否有提取到鉤子
  if (!learning.extractedHook || learning.extractedHook.length < 5) {
    await markViralLearningAsIntegrated(learning.id);
    return { success: false, reason: '沒有有效的鉤子模式' };
  }
  
  // 檢查鉤子是否已存在
  const exists = await isHookPatternExists(learning.extractedHook);
  if (exists) {
    await markViralLearningAsIntegrated(learning.id);
    return { success: false, reason: '鉤子模式已存在' };
  }
  
  // 推斷鉤子類型
  const hookType = inferHookType(learning.extractedHook);
  
  // 新增到 content_hooks
  await db.insert(contentHooks).values({
    hookPattern: learning.extractedHook,
    hookType: hookType,
    applicableContentTypes: learning.contentType ? [learning.contentType] : null,
    avgLikes: learning.likes || 0,
    sampleCount: 1,
    source: 'viral_analysis',
    isActive: true,
  });
  
  // 標記為已整合
  await markViralLearningAsIntegrated(learning.id);
  
  return { success: true, reason: '成功新增到知識庫' };
}

// 推斷鉤子類型
function inferHookType(hookPattern: string): string {
  const pattern = hookPattern.toLowerCase();
  
  // 問句型
  if (pattern.includes('？') || pattern.includes('嗎') || pattern.includes('有沒有') || pattern.includes('是不是')) {
    return 'question';
  }
  
  // 反差型
  if (pattern.includes('但') || pattern.includes('卻') || pattern.includes('沒想到') || pattern.includes('結果')) {
    return 'contrast';
  }
  
  // 故事型
  if (pattern.includes('那天') || pattern.includes('有一次') || pattern.includes('記得') || pattern.includes('曾經')) {
    return 'story';
  }
  
  // 鏡像型（說出受眾心聲）
  if (pattern.includes('你是不是') || pattern.includes('你有沒有') || pattern.includes('很多人')) {
    return 'mirror';
  }
  
  // 數字型
  if (/\d+/.test(pattern)) {
    return 'number';
  }
  
  // 情緒型
  if (pattern.includes('真的') || pattern.includes('超') || pattern.includes('好') || pattern.includes('傻眼')) {
    return 'emotion';
  }
  
  // 預設為一般型
  return 'general';
}

// 批次處理未整合的爆文學習記錄
export async function processUnintegratedViralLearnings(): Promise<{
  processed: number;
  integrated: number;
  skipped: number;
  details: Array<{ id: number; success: boolean; reason: string }>;
}> {
  const unintegrated = await getUnintegratedViralLearnings(50);
  
  const results = {
    processed: 0,
    integrated: 0,
    skipped: 0,
    details: [] as Array<{ id: number; success: boolean; reason: string }>,
  };
  
  for (const learning of unintegrated) {
    const result = await integrateViralLearningToHooks({
      id: learning.id,
      extractedHook: learning.extractedHook,
      contentType: learning.contentType,
      likes: learning.likes,
      successFactors: learning.successFactors,
    });
    
    results.processed++;
    if (result.success) {
      results.integrated++;
    } else {
      results.skipped++;
    }
    results.details.push({ id: learning.id, ...result });
  }
  
  return results;
}

// 更新現有鉤子的效果數據（當有新的爆文使用相同鉤子時）
export async function updateHookStats(hookId: number, newLikes: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // 取得現有數據
  const [hook] = await db.select().from(contentHooks).where(eq(contentHooks.id, hookId));
  if (!hook) return;
  
  // 計算新的平均讚數
  const currentAvg = hook.avgLikes || 0;
  const currentCount = hook.sampleCount || 1;
  const newAvg = Math.round((currentAvg * currentCount + newLikes) / (currentCount + 1));
  
  // 更新
  await db.update(contentHooks)
    .set({
      avgLikes: newAvg,
      sampleCount: currentCount + 1,
    })
    .where(eq(contentHooks.id, hookId));
}

// 取得知識庫更新統計
export async function getKnowledgeBaseStats(): Promise<{
  totalHooks: number;
  manualHooks: number;
  extractedHooks: number;
  viralAnalysisHooks: number;
  pendingLearnings: number;
  integratedLearnings: number;
}> {
  const db = await getDb();
  if (!db) return {
    totalHooks: 0,
    manualHooks: 0,
    extractedHooks: 0,
    viralAnalysisHooks: 0,
    pendingLearnings: 0,
    integratedLearnings: 0,
  };
  
  // 統計鉤子
  const allHooks = await db.select().from(contentHooks);
  const manualHooks = allHooks.filter(h => h.source === 'manual' || !h.source).length;
  const extractedHooks = allHooks.filter(h => h.source === 'extracted').length;
  const viralAnalysisHooks = allHooks.filter(h => h.source === 'viral_analysis').length;
  
  // 統計學習記錄
  const allLearnings = await db.select().from(viralLearnings);
  const pendingLearnings = allLearnings.filter(l => !l.isIntegrated).length;
  const integratedLearnings = allLearnings.filter(l => l.isIntegrated).length;
  
  return {
    totalHooks: allHooks.length,
    manualHooks,
    extractedHooks,
    viralAnalysisHooks,
    pendingLearnings,
    integratedLearnings,
  };
}


// ==================== 爆款數據優化系統 ====================

// 取得爆款貼文範例（用於 Few-Shot Learning）
export async function getViralExamples(options: {
  keyword?: string;
  cluster?: number;
  funnelStage?: string;
  isTop200?: boolean;
  isTop20?: boolean;
  limit?: number;
  sortBy?: 'likes' | 'likesPerDay';
}): Promise<Array<{
  id: number;
  keyword: string;
  postText: string;
  likes: number;
  likesPerDay: number | null;
  funnelStage: string | null;
  cluster: number | null;
  opener50: string | null;
  charLen: number | null;
  hasNumber: boolean;
  resultFlag: boolean;
  ctaFlag: boolean;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options.keyword) {
    conditions.push(eq(viralExamples.keyword, options.keyword));
  }
  if (options.cluster !== undefined) {
    conditions.push(eq(viralExamples.cluster, options.cluster));
  }
  if (options.funnelStage) {
    conditions.push(eq(viralExamples.funnelStage, options.funnelStage));
  }
  if (options.isTop200 !== undefined) {
    conditions.push(eq(viralExamples.isTop200, options.isTop200));
  }
  if (options.isTop20 !== undefined) {
    conditions.push(eq(viralExamples.isTop20, options.isTop20));
  }
  
  const orderColumn = options.sortBy === 'likesPerDay' 
    ? viralExamples.likesPerDay 
    : viralExamples.likes;
  
  const query = db.select({
    id: viralExamples.id,
    keyword: viralExamples.keyword,
    postText: viralExamples.postText,
    likes: viralExamples.likes,
    likesPerDay: viralExamples.likesPerDay,
    funnelStage: viralExamples.funnelStage,
    cluster: viralExamples.cluster,
    opener50: viralExamples.opener50,
    charLen: viralExamples.charLen,
    hasNumber: viralExamples.hasNumber,
    resultFlag: viralExamples.resultFlag,
    ctaFlag: viralExamples.ctaFlag,
  }).from(viralExamples);
  
  if (conditions.length > 0) {
    query.where(and(...conditions));
  }
  
  query.orderBy(desc(orderColumn));
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  const results = await query;
  return results.map(r => ({
    ...r,
    likes: r.likes || 0,
    likesPerDay: r.likesPerDay ? parseFloat(String(r.likesPerDay)) : null,
    hasNumber: r.hasNumber || false,
    resultFlag: r.resultFlag || false,
    ctaFlag: r.ctaFlag || false,
  }));
}

// 根據關鍵字取得最佳範例（用於 Few-Shot）
export async function getBestExamplesForKeyword(keyword: string, limit: number = 3): Promise<Array<{
  postText: string;
  likes: number;
  opener50: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  // 先找完全匹配的關鍵字
  let results = await db.select({
    postText: viralExamples.postText,
    likes: viralExamples.likes,
    opener50: viralExamples.opener50,
  })
    .from(viralExamples)
    .where(eq(viralExamples.keyword, keyword))
    .orderBy(desc(viralExamples.likes))
    .limit(limit);
  
  // 如果沒有完全匹配，找相關的
  if (results.length === 0) {
    results = await db.select({
      postText: viralExamples.postText,
      likes: viralExamples.likes,
      opener50: viralExamples.opener50,
    })
      .from(viralExamples)
      .where(sql`${viralExamples.keyword} LIKE ${`%${keyword}%`}`)
      .orderBy(desc(viralExamples.likes))
      .limit(limit);
  }
  
  // 如果還是沒有，返回 Top200 中最熱門的
  if (results.length === 0) {
    results = await db.select({
      postText: viralExamples.postText,
      likes: viralExamples.likes,
      opener50: viralExamples.opener50,
    })
      .from(viralExamples)
      .where(eq(viralExamples.isTop200, true))
      .orderBy(desc(viralExamples.likes))
      .limit(limit);
  }
  
  return results.map(r => ({
    ...r,
    likes: r.likes || 0,
  }));
}

// 取得選題模板
export async function getTopicTemplates(options?: {
  cluster?: number;
  theme?: string;
  limit?: number;
}): Promise<Array<{
  id: number;
  cluster: number | null;
  theme: string | null;
  template: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options?.cluster !== undefined) {
    conditions.push(eq(topicTemplates.cluster, options.cluster));
  }
  if (options?.theme) {
    conditions.push(sql`${topicTemplates.theme} LIKE ${`%${options.theme}%`}`);
  }
  
  const query = db.select({
    id: topicTemplates.id,
    cluster: topicTemplates.cluster,
    theme: topicTemplates.theme,
    template: topicTemplates.template,
  }).from(topicTemplates);
  
  if (conditions.length > 0) {
    query.where(and(...conditions));
  }
  
  if (options?.limit) {
    query.limit(options.limit);
  }
  
  return query;
}

// 取得隨機選題建議（用於「沒靈感」流程）
export async function getRandomTopicSuggestions(count: number = 5): Promise<Array<{
  cluster: number | null;
  theme: string | null;
  template: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  // 隨機取得選題模板
  const results = await db.select({
    cluster: topicTemplates.cluster,
    theme: topicTemplates.theme,
    template: topicTemplates.template,
  })
    .from(topicTemplates)
    .orderBy(sql`RAND()`)
    .limit(count);
  
  return results;
}

// 取得內容群集資訊
export async function getContentClusters(): Promise<Array<{
  id: number;
  clusterId: number | null;
  themeKeywords: string | null;
  postsCount: number | null;
  top10Rate: number | null;
  medianLikes: number | null;
  medianLpd: number | null;
  topTerms: string | null;
  tofuShare: number | null;
  mofuShare: number | null;
  bofuShare: number | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db.select().from(contentClusters);
  return results.map(r => ({
    ...r,
    top10Rate: r.top10Rate ? parseFloat(String(r.top10Rate)) : null,
    medianLpd: r.medianLpd ? parseFloat(String(r.medianLpd)) : null,
    tofuShare: r.tofuShare ? parseFloat(String(r.tofuShare)) : null,
    mofuShare: r.mofuShare ? parseFloat(String(r.mofuShare)) : null,
    bofuShare: r.bofuShare ? parseFloat(String(r.bofuShare)) : null,
  }));
}

// 根據群集 ID 取得群集資訊
export async function getClusterById(clusterId: number): Promise<{
  id: number;
  clusterId: number | null;
  themeKeywords: string | null;
  postsCount: number | null;
  top10Rate: number | null;
  medianLikes: number | null;
  topTerms: string | null;
  tofuShare: number | null;
  mofuShare: number | null;
  bofuShare: number | null;
} | null> {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select()
    .from(contentClusters)
    .where(eq(contentClusters.clusterId, clusterId))
    .limit(1);
  
  if (results.length === 0) return null;
  
  const r = results[0];
  return {
    ...r,
    top10Rate: r.top10Rate ? parseFloat(String(r.top10Rate)) : null,
    tofuShare: r.tofuShare ? parseFloat(String(r.tofuShare)) : null,
    mofuShare: r.mofuShare ? parseFloat(String(r.mofuShare)) : null,
    bofuShare: r.bofuShare ? parseFloat(String(r.bofuShare)) : null,
  };
}

// 根據內容推薦最適合的群集
export async function suggestClusterForContent(content: string): Promise<{
  clusterId: number;
  themeKeywords: string;
  confidence: number;
  top10Rate: number | null;
} | null> {
  const db = await getDb();
  if (!db) return null;
  
  const clusters = await getContentClusters();
  if (clusters.length === 0) return null;
  
  // 簡單的關鍵字匹配算法
  let bestMatch: { clusterId: number; themeKeywords: string; score: number; top10Rate: number | null } | null = null;
  
  for (const cluster of clusters) {
    if (!cluster.themeKeywords || !cluster.clusterId) continue;
    
    const keywords = cluster.themeKeywords.toLowerCase().split(/[,、，\s]+/);
    const contentLower = content.toLowerCase();
    
    let score = 0;
    for (const keyword of keywords) {
      if (keyword && contentLower.includes(keyword.trim())) {
        score += 1;
      }
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        clusterId: cluster.clusterId,
        themeKeywords: cluster.themeKeywords,
        score,
        top10Rate: cluster.top10Rate,
      };
    }
  }
  
  if (!bestMatch) return null;
  
  return {
    clusterId: bestMatch.clusterId,
    themeKeywords: bestMatch.themeKeywords,
    confidence: Math.min(bestMatch.score / 3, 1), // 正規化為 0-1
    top10Rate: bestMatch.top10Rate ?? null,
  };
}

// 取得群集的選題模板
export async function getClusterTopicTemplates(clusterId: number): Promise<Array<{
  theme: string | null;
  template: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    theme: topicTemplates.theme,
    template: topicTemplates.template,
  })
    .from(topicTemplates)
    .where(eq(topicTemplates.cluster, clusterId));
}

// 建立 Few-Shot Prompt（用於草稿生成）
export async function buildFewShotPrompt(keyword: string, count: number = 3): Promise<string> {
  const examples = await getBestExamplesForKeyword(keyword, count);
  
  if (examples.length === 0) {
    return '';
  }
  
  let prompt = `\n【參考範例】以下是「${keyword}」主題的高讚貼文範例：\n\n`;
  
  examples.forEach((example, index) => {
    prompt += `範例 ${index + 1}（${example.likes} 讚）：\n`;
    prompt += `${example.postText.substring(0, 500)}${example.postText.length > 500 ? '...' : ''}\n\n`;
  });
  
  prompt += `請參考以上範例的寫作風格和結構，但不要直接複製內容。\n`;
  
  return prompt;
}

// 取得爆款開頭範例（用於 Hook 生成）
export async function getViralOpeners(options?: {
  keyword?: string;
  limit?: number;
}): Promise<Array<{
  opener50: string;
  likes: number;
  keyword: string;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    sql`${viralExamples.opener50} IS NOT NULL`,
    sql`${viralExamples.opener50} != ''`,
  ];
  
  if (options?.keyword) {
    conditions.push(eq(viralExamples.keyword, options.keyword));
  }
  
  const results = await db.select({
    opener50: viralExamples.opener50,
    likes: viralExamples.likes,
    keyword: viralExamples.keyword,
  })
    .from(viralExamples)
    .where(and(...conditions))
    .orderBy(desc(viralExamples.likes))
    .limit(options?.limit || 10);
  
  return results.map(r => ({
    opener50: r.opener50 || '',
    likes: r.likes || 0,
    keyword: r.keyword,
  }));
}

// 統計爆款數據
export async function getViralDataStats(): Promise<{
  totalExamples: number;
  top200Count: number;
  top20Count: number;
  topicTemplatesCount: number;
  clustersCount: number;
  keywordsCount: number;
}> {
  const db = await getDb();
  if (!db) return {
    totalExamples: 0,
    top200Count: 0,
    top20Count: 0,
    topicTemplatesCount: 0,
    clustersCount: 0,
    keywordsCount: 0,
  };
  
  const [totalResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(viralExamples);
  const [top200Result] = await db.select({ count: sql<number>`COUNT(*)` }).from(viralExamples).where(eq(viralExamples.isTop200, true));
  const [top20Result] = await db.select({ count: sql<number>`COUNT(*)` }).from(viralExamples).where(eq(viralExamples.isTop20, true));
  const [templatesResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(topicTemplates);
  const [clustersResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(contentClusters);
  const [keywordsResult] = await db.select({ count: sql<number>`COUNT(DISTINCT keyword)` }).from(viralExamples);
  
  return {
    totalExamples: Number(totalResult?.count) || 0,
    top200Count: Number(top200Result?.count) || 0,
    top20Count: Number(top20Result?.count) || 0,
    topicTemplatesCount: Number(templatesResult?.count) || 0,
    clustersCount: Number(clustersResult?.count) || 0,
    keywordsCount: Number(keywordsResult?.count) || 0,
  };
}


// ==================== 模板管理 ====================

// 取得所有開頭模板
export async function getAllOpenerTemplates(): Promise<OpenerTemplate[]> {
  const database = await getDb();
  if (!database) return [];
  
  const result = await database
    .select()
    .from(openerTemplates)
    .orderBy(desc(openerTemplates.weight));
  
  return result;
}

// 新增開頭模板
export async function createOpenerTemplate(data: {
  name: string;
  category: string;
  description?: string;
  promptTemplate: string;
  exampleOutput?: string;
  weight?: number;
}): Promise<OpenerTemplate | null> {
  const database = await getDb();
  if (!database) return null;
  
  // 映射 category 到 schema 允許的值
  const categoryMap: Record<string, "mirror" | "contrast" | "scene" | "question" | "data" | "story" | "emotion"> = {
    '鏡像策略': 'mirror',
    '反差策略': 'contrast',
    '場景策略': 'scene',
    '提問策略': 'question',
    '數據策略': 'data',
    '故事策略': 'story',
    '情緒策略': 'emotion',
    'mirror': 'mirror',
    'contrast': 'contrast',
    'scene': 'scene',
    'question': 'question',
    'data': 'data',
    'story': 'story',
    'emotion': 'emotion',
  };
  const mappedCategory = categoryMap[data.category] || 'mirror';
  
  await database.insert(openerTemplates).values({
    name: data.name,
    category: mappedCategory,
    template: data.promptTemplate, // schema 使用 template 不是 promptTemplate
    description: data.description || null,
    example: data.exampleOutput || null, // schema 使用 example 不是 exampleOutput
    weight: String(data.weight ?? 1.0), // decimal 需要 string
    isActive: true,
    usageCount: 0,
    successCount: 0,
  });
  
  // 取得剛插入的記錄
  const [inserted] = await database
    .select()
    .from(openerTemplates)
    .where(eq(openerTemplates.name, data.name))
    .orderBy(desc(openerTemplates.id))
    .limit(1);
  
  return inserted || null;
}

// 更新開頭模板
export async function updateOpenerTemplate(
  id: number,
  data: Partial<{
    name: string;
    category: string;
    description: string;
    promptTemplate: string;
    exampleOutput: string;
    weight: number;
    isActive: boolean;
  }>
): Promise<OpenerTemplate | null> {
  const database = await getDb();
  if (!database) return null;
  
  // 映射欄位名稱
  const categoryMap: Record<string, "mirror" | "contrast" | "scene" | "question" | "data" | "story" | "emotion"> = {
    '鏡像策略': 'mirror',
    '反差策略': 'contrast',
    '場景策略': 'scene',
    '提問策略': 'question',
    '數據策略': 'data',
    '故事策略': 'story',
    '情緒策略': 'emotion',
    'mirror': 'mirror',
    'contrast': 'contrast',
    'scene': 'scene',
    'question': 'question',
    'data': 'data',
    'story': 'story',
    'emotion': 'emotion',
  };
  
  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.category) updateData.category = categoryMap[data.category] || data.category;
  if (data.description) updateData.description = data.description;
  if (data.promptTemplate) updateData.template = data.promptTemplate;
  if (data.exampleOutput) updateData.example = data.exampleOutput;
  if (data.weight !== undefined) updateData.weight = String(data.weight);
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  await database
    .update(openerTemplates)
    .set(updateData)
    .where(eq(openerTemplates.id, id));
  
  const [updated] = await database
    .select()
    .from(openerTemplates)
    .where(eq(openerTemplates.id, id));
  
  return updated || null;
}

// 切換模板啟用狀態
export async function toggleOpenerTemplateActive(id: number): Promise<OpenerTemplate | null> {
  const database = await getDb();
  if (!database) return null;
  
  // 先取得當前狀態
  const [current] = await database
    .select()
    .from(openerTemplates)
    .where(eq(openerTemplates.id, id));
  
  if (!current) return null;
  
  // 切換狀態
  await database
    .update(openerTemplates)
    .set({ isActive: !current.isActive, updatedAt: new Date() })
    .where(eq(openerTemplates.id, id));
  
  const [updated] = await database
    .select()
    .from(openerTemplates)
    .where(eq(openerTemplates.id, id));
  
  return updated || null;
}

// 取得所有禁止句式
export async function getAllAvoidList(): Promise<PromptAvoidList[]> {
  const database = await getDb();
  if (!database) return [];
  
  const result = await database
    .select()
    .from(promptAvoidList)
    .orderBy(desc(promptAvoidList.severity), promptAvoidList.patternType);
  
  return result;
}

// 新增禁止句式
export async function createAvoidPhrase(data: {
  phrase: string;
  category: string;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
}): Promise<PromptAvoidList | null> {
  const database = await getDb();
  if (!database) return null;
  
  // 映射 category 到 patternType
  const patternTypeMap: Record<string, "opener" | "transition" | "ending" | "ai_phrase" | "filler"> = {
    '開頭句式': 'opener',
    '過渡句式': 'transition',
    '結尾句式': 'ending',
    'AI特徵詞': 'ai_phrase',
    '填充詞': 'filler',
    'opener': 'opener',
    'transition': 'transition',
    'ending': 'ending',
    'ai_phrase': 'ai_phrase',
    'filler': 'filler',
  };
  const mappedPatternType = patternTypeMap[data.category] || 'opener';
  
  // 映射 severity
  const severityMap: Record<string, "block" | "warn" | "suggest"> = {
    'high': 'block',
    'medium': 'warn',
    'low': 'suggest',
    'block': 'block',
    'warn': 'warn',
    'suggest': 'suggest',
  };
  const mappedSeverity = severityMap[data.severity || 'medium'] || 'warn';
  
  await database.insert(promptAvoidList).values({
    pattern: data.phrase, // schema 使用 pattern 不是 phrase
    patternType: mappedPatternType,
    description: data.reason || null, // schema 使用 description 不是 reason
    severity: mappedSeverity,
    isActive: true,
    matchCount: 0,
  });
  
  const [inserted] = await database
    .select()
    .from(promptAvoidList)
    .where(eq(promptAvoidList.pattern, data.phrase))
    .orderBy(desc(promptAvoidList.id))
    .limit(1);
  
  return inserted || null;
}

// 更新禁止句式
export async function updateAvoidPhrase(
  id: number,
  data: Partial<{
    phrase: string;
    category: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
    isActive: boolean;
  }>
): Promise<PromptAvoidList | null> {
  const database = await getDb();
  if (!database) return null;
  
  // 映射欄位名稱
  const patternTypeMap: Record<string, "opener" | "transition" | "ending" | "ai_phrase" | "filler"> = {
    '開頭句式': 'opener',
    '過渡句式': 'transition',
    '結尾句式': 'ending',
    'AI特徵詞': 'ai_phrase',
    '填充詞': 'filler',
    'opener': 'opener',
    'transition': 'transition',
    'ending': 'ending',
    'ai_phrase': 'ai_phrase',
    'filler': 'filler',
  };
  
  const severityMap: Record<string, "block" | "warn" | "suggest"> = {
    'high': 'block',
    'medium': 'warn',
    'low': 'suggest',
    'block': 'block',
    'warn': 'warn',
    'suggest': 'suggest',
  };
  
  const updateData: Record<string, unknown> = {};
  if (data.phrase) updateData.pattern = data.phrase;
  if (data.category) updateData.patternType = patternTypeMap[data.category] || data.category;
  if (data.reason) updateData.description = data.reason;
  if (data.severity) updateData.severity = severityMap[data.severity] || data.severity;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  await database
    .update(promptAvoidList)
    .set(updateData)
    .where(eq(promptAvoidList.id, id));
  
  const [updated] = await database
    .select()
    .from(promptAvoidList)
    .where(eq(promptAvoidList.id, id));
  
  return updated || null;
}

// 切換禁止句式啟用狀態
export async function toggleAvoidPhraseActive(id: number): Promise<PromptAvoidList | null> {
  const database = await getDb();
  if (!database) return null;
  
  const [current] = await database
    .select()
    .from(promptAvoidList)
    .where(eq(promptAvoidList.id, id));
  
  if (!current) return null;
  
  await database
    .update(promptAvoidList)
    .set({ isActive: !current.isActive, updatedAt: new Date() })
    .where(eq(promptAvoidList.id, id));
  
  const [updated] = await database
    .select()
    .from(promptAvoidList)
    .where(eq(promptAvoidList.id, id));
  
  return updated || null;
}

// 刪除禁止句式
export async function deleteAvoidPhrase(id: number): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  
  await database
    .delete(promptAvoidList)
    .where(eq(promptAvoidList.id, id));
  
  return true;
}

// 取得模板統計數據
export async function getTemplateStats(): Promise<{
  totalTemplates: number;
  activeTemplates: number;
  totalAvoidPhrases: number;
  activeAvoidPhrases: number;
  topTemplates: Array<{ name: string; usageCount: number; successRate: number }>;
}> {
  const database = await getDb();
  if (!database) {
    return {
      totalTemplates: 0,
      activeTemplates: 0,
      totalAvoidPhrases: 0,
      activeAvoidPhrases: 0,
      topTemplates: [],
    };
  }
  
  const templates = await database.select().from(openerTemplates);
  const avoidPhrases = await database.select().from(promptAvoidList);
  
  const topTemplates = templates
    .filter(t => t.usageCount && t.usageCount > 0)
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    .slice(0, 5)
    .map(t => ({
      name: t.name,
      usageCount: t.usageCount || 0,
      successRate: t.usageCount && t.usageCount > 0 
        ? ((t.successCount || 0) / t.usageCount) * 100 
        : 0,
    }));
  
  return {
    totalTemplates: templates.length,
    activeTemplates: templates.filter(t => t.isActive).length,
    totalAvoidPhrases: avoidPhrases.length,
    activeAvoidPhrases: avoidPhrases.filter(p => p.isActive).length,
    topTemplates,
  };
}
