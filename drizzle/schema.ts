import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

// ==================== 用戶系統 ====================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("Asia/Taipei"),
  locale: varchar("locale", { length: 10 }).default("zh-TW"),
  marketingOptIn: boolean("marketingOptIn").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ==================== IP 地基模組 ====================

export const ipProfiles = mysqlTable("ip_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  occupation: varchar("occupation", { length: 120 }),
  voiceTone: varchar("voiceTone", { length: 120 }),
  viewpointStatement: text("viewpointStatement"),
  goalPrimary: mysqlEnum("goalPrimary", ["monetize", "influence", "expression"]).default("monetize"),
  personaExpertise: text("personaExpertise"),
  personaEmotion: text("personaEmotion"),
  personaViewpoint: text("personaViewpoint"),
  ipAnalysisComplete: boolean("ipAnalysisComplete").default(false),
  currentVersion: int("currentVersion").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IpProfile = typeof ipProfiles.$inferSelect;
export type InsertIpProfile = typeof ipProfiles.$inferInsert;

export const ipProfileVersions = mysqlTable("ip_profile_versions", {
  id: int("id").autoincrement().primaryKey(),
  ipProfileId: int("ipProfileId").notNull(),
  version: int("version").notNull(),
  snapshotJson: json("snapshotJson"),
  note: varchar("note", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const audienceSegments = mysqlTable("audience_segments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  segmentName: varchar("segmentName", { length: 80 }),
  painPoint: text("painPoint"),
  desiredOutcome: text("desiredOutcome"),
  priority: int("priority").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AudienceSegment = typeof audienceSegments.$inferSelect;
export type InsertAudienceSegment = typeof audienceSegments.$inferInsert;

// ==================== 內容支柱 ====================

export const contentPillars = mysqlTable("content_pillars", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 120 }),
  description: text("description"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentPillar = typeof contentPillars.$inferSelect;
export type InsertContentPillar = typeof contentPillars.$inferInsert;

// ==================== 對話與 AI 產出 ====================

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mode: mysqlEnum("mode", ["onboarding", "writing", "optimize", "report"]).default("writing"),
  state: varchar("state", { length: 50 }),
  title: varchar("title", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const conversationMessages = mysqlTable("conversation_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).default("user"),
  content: text("content"),
  meta: json("meta"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const rawMaterials = mysqlTable("raw_materials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conversationId: int("conversationId"),
  sourceType: mysqlEnum("sourceType", ["event", "dialogue", "insight"]).default("event"),
  content: text("content"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 草稿庫 ====================

export const draftPosts = mysqlTable("draft_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contentType: mysqlEnum("contentType", [
    "knowledge", "summary", "story", "viewpoint", "contrast",
    "casual", "dialogue", "question", "poll", "quote"
  ]).default("story"),
  title: varchar("title", { length: 120 }),
  body: text("body"),
  cta: text("cta"),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DraftPost = typeof draftPosts.$inferSelect;
export type InsertDraftPost = typeof draftPosts.$inferInsert;

export const draftHooks = mysqlTable("draft_hooks", {
  id: int("id").autoincrement().primaryKey(),
  draftPostId: int("draftPostId").notNull(),
  hookStyle: mysqlEnum("hookStyle", ["mirror", "contrast", "scene", "question", "data"]).default("mirror"),
  hookText: text("hookText"),
  isSelected: boolean("isSelected").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DraftHook = typeof draftHooks.$inferSelect;
export type InsertDraftHook = typeof draftHooks.$inferInsert;

export const draftVersions = mysqlTable("draft_versions", {
  id: int("id").autoincrement().primaryKey(),
  draftPostId: int("draftPostId").notNull(),
  version: int("version").notNull(),
  body: text("body"),
  cta: text("cta"),
  changeNote: varchar("changeNote", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 文案健檢 ====================

export const optimizationSessions = mysqlTable("optimization_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  draftPostId: int("draftPostId"),
  inputText: text("inputText"),
  outputA: text("outputA"),
  outputB: text("outputB"),
  feedbackJson: json("feedbackJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OptimizationSession = typeof optimizationSessions.$inferSelect;
export type InsertOptimizationSession = typeof optimizationSessions.$inferInsert;

// ==================== 發布與戰報 ====================

export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  draftPostId: int("draftPostId"),
  threadUrl: text("threadUrl"),
  postedAt: timestamp("postedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

export const postMetrics = mysqlTable("post_metrics", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  capturedAt: timestamp("capturedAt"),
  reach: int("reach").default(0),
  likes: int("likes").default(0),
  comments: int("comments").default(0),
  reposts: int("reposts").default(0),
  saves: int("saves").default(0),
  profileVisits: int("profileVisits").default(0),
  linkClicks: int("linkClicks").default(0),
  inquiries: int("inquiries").default(0),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PostMetric = typeof postMetrics.$inferSelect;
export type InsertPostMetric = typeof postMetrics.$inferInsert;

// ==================== 互動任務 ====================

export const interactionTasks = mysqlTable("interaction_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskType: mysqlEnum("taskType", ["reply_comments", "comment_others", "sea_patrol"]).default("reply_comments"),
  taskDetail: text("taskDetail"),
  dueDate: timestamp("dueDate"),
  status: mysqlEnum("taskStatus", ["todo", "done", "skipped"]).default("todo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InteractionTask = typeof interactionTasks.$inferSelect;
export type InsertInteractionTask = typeof interactionTasks.$inferInsert;

// ==================== 商品與訂單 ====================

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 50 }).unique(),
  name: varchar("name", { length: 120 }),
  description: text("description"),
  productType: mysqlEnum("productType", ["lead", "core", "vip", "passive"]).default("core"),
  deliveryType: mysqlEnum("deliveryType", ["digital", "service", "community"]).default("digital"),
  price: int("price").default(0),
  currency: varchar("currency", { length: 10 }).default("TWD"),
  billingType: mysqlEnum("billingType", ["one_time", "subscription"]).default("one_time"),
  billingInterval: mysqlEnum("billingInterval", ["month", "year"]),
  status: mysqlEnum("productStatus", ["active", "inactive"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("orderStatus", ["pending", "paid", "failed", "refunded"]).default("pending"),
  currency: varchar("currency", { length: 10 }).default("TWD"),
  subtotalAmount: int("subtotalAmount").default(0),
  discountAmount: int("discountAmount").default(0),
  totalAmount: int("totalAmount").default(0),
  paymentProvider: varchar("paymentProvider", { length: 30 }),
  providerRef: varchar("providerRef", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  priceAmount: int("priceAmount").default(0),
  quantity: int("quantity").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  status: mysqlEnum("subscriptionStatus", ["active", "canceled", "past_due"]).default("active"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  providerRef: varchar("providerRef", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ==================== 知識庫與提示詞 ====================

export const kbDocuments = mysqlTable("kb_documents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }),
  version: varchar("version", { length: 50 }),
  sourceUri: text("sourceUri"),
  content: text("content"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const promptTemplates = mysqlTable("prompt_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }),
  version: int("version").default(1),
  template: text("template"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = typeof promptTemplates.$inferInsert;

// ==================== 用量與稽核 ====================

export const apiUsageLogs = mysqlTable("api_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: varchar("endpoint", { length: 80 }),
  model: varchar("model", { length: 80 }),
  tokensIn: int("tokensIn").default(0),
  tokensOut: int("tokensOut").default(0),
  costEstimate: int("costEstimate").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 80 }),
  targetType: varchar("targetType", { length: 50 }),
  targetId: int("targetId"),
  meta: json("meta"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
