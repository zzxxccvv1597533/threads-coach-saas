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
export function buildViralFactorsPrompt(benchmarks: KeywordBenchmark[]): string {
  if (benchmarks.length === 0) return '';
  
  const topBenchmark = benchmarks[0];
  
  let prompt = `
=== 市場數據參考（隱性優化，不要在內容中提及） ===
`;

  if (topBenchmark.keyword) {
    prompt += `相關主題：${topBenchmark.keyword}\n`;
  }
  
  if (topBenchmark.avgLikes) {
    prompt += `市場平均讚數：${topBenchmark.avgLikes}\n`;
  }
  
  if (topBenchmark.optimalLengthMin && topBenchmark.optimalLengthMax) {
    prompt += `建議字數範圍：${topBenchmark.optimalLengthMin}-${topBenchmark.optimalLengthMax} 字\n`;
  }
  
  if (topBenchmark.bestContentType) {
    prompt += `最佳內容類型：${topBenchmark.bestContentType}\n`;
  }

  // 爆文因子建議
  prompt += `
【爆文因子建議】
- 有結果導向（「結果」「後來」「最後」）的內容表現較好
- 避免硬塞 CTA（會降低爆文率）
- 保持自然的情緒流動，不要刻意轉折
`;

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
