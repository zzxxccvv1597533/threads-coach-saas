import { eq, desc, and, sql } from "drizzle-orm";
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
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
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
  
  await db.update(users)
    .set({
      activationStatus: 'activated',
      activatedAt: new Date(),
      activatedBy,
      expiresAt: expiresAt || null,
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
