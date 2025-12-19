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
  invitationCodes, InsertInvitationCode, InvitationCode,
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
  activationStatus?: 'pending' | 'activated' | 'expired';
  expiresAt?: Date;
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
  
  const { followerCount, avgReach, totalSales } = metrics;
  
  // 規模化：粉絲 5000+，有成交紀錄
  if ((followerCount || 0) >= 5000 && (totalSales || 0) > 0) {
    return 'scale';
  }
  
  // 變現期：粉絲 1000+，有穩定互動
  if ((followerCount || 0) >= 1000) {
    return 'monetize';
  }
  
  // 成長期：粉絲 100-1000，流量穩定破千
  if ((followerCount || 0) >= 100 && (avgReach || 0) >= 1000) {
    return 'growth';
  }
  
  // 起步期
  return 'startup';
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
export async function useInvitationCode(code: string, userId: number): Promise<{ success: boolean; message: string; validDays?: number }> {
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
  
  // 更新用戶的開通狀態
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + invitation.validDays);
  
  await db.update(users)
    .set({
      activationStatus: 'activated',
      activatedAt: new Date(),
      expiresAt: expiresAt,
      activationNote: `使用邀請碼 ${code} 開通`,
    })
    .where(eq(users.id, userId));
  
  return { success: true, message: '開通成功', validDays: invitation.validDays };
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


