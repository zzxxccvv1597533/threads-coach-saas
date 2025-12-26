import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

// ==================== 用戶系統 ====================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // 保留但不再必填
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 255 }), // bcrypt 加密後的密碼
  loginMethod: varchar("loginMethod", { length: 64 }).default("password"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
  // 學員開通狀態: pending=待開通, activated=已開通, expired=已過期, rejected=已拒絕
  activationStatus: mysqlEnum("activationStatus", ["pending", "activated", "expired", "rejected"]).default("pending").notNull(),
  activatedAt: timestamp("activatedAt"),
  activatedBy: int("activatedBy"),
  expiresAt: timestamp("expiresAt"),
  activationNote: text("activationNote"),
  // 拒絕相關
  rejectedAt: timestamp("rejectedAt"),
  rejectedBy: int("rejectedBy"),
  rejectionReason: text("rejectionReason"),
  // 邀請碼額度（使用邀請碼註冊時記錄，開通時套用）
  invitationCodeId: int("invitationCodeId"),
  invitationBonusDays: int("invitationBonusDays"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 邀請碼系統
export const invitationCodes = mysqlTable("invitation_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  createdBy: int("createdBy").notNull(), // 創建者 (admin)
  usedBy: int("usedBy"), // 使用者
  usedAt: timestamp("usedAt"),
  validDays: int("validDays").default(90).notNull(), // 有效天數，預設 90 天
  note: text("note"), // 備註（例如學員姓名）
  status: mysqlEnum("status", ["active", "used", "expired", "revoked"]).default("active").notNull(),
  expiresAt: timestamp("expiresAt"), // 邀請碼本身的過期時間
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvitationCode = typeof invitationCodes.$inferSelect;
export type InsertInvitationCode = typeof invitationCodes.$inferInsert;

// 付款紀錄（藍新金流預留）
export const paymentRecords = mysqlTable("payment_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subscriptionId: int("subscriptionId"),
  // 藍新金流回傳資訊
  merchantOrderNo: varchar("merchantOrderNo", { length: 64 }).notNull(),
  tradeNo: varchar("tradeNo", { length: 64 }),
  paymentType: varchar("paymentType", { length: 32 }),
  payTime: timestamp("payTime"),
  // 付款資訊
  amount: int("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("TWD"),
  status: mysqlEnum("paymentStatus", ["pending", "success", "failed", "refunded"]).default("pending").notNull(),
  rawResponse: text("rawResponse"), // 藍新金流原始回傳資料
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertPaymentRecord = typeof paymentRecords.$inferInsert;

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
  // 英雄旅程四階段
  heroJourneyOrigin: text("heroJourneyOrigin"), // 緣起：你為什麼開始做這件事
  heroJourneyProcess: text("heroJourneyProcess"), // 過程：你經歷了什麼挑戰
  heroJourneyHero: text("heroJourneyHero"), // 英雄登場：轉折點是什麼
  heroJourneyMission: text("heroJourneyMission"), // 結局與使命：你現在的使命是什麼
  // 身份標籤
  identityTags: json("identityTags").$type<string[]>(), // 身份標籤陣列
  // 九宮格內容矩陣
  contentMatrixAudiences: json("contentMatrixAudiences").$type<{core: string; potential: string; opportunity: string}>(),
  contentMatrixThemes: json("contentMatrixThemes").$type<string[]>(), // 三大主題
  ipAnalysisComplete: boolean("ipAnalysisComplete").default(false),
  currentVersion: int("currentVersion").default(1),
  // AI 策略總結（從戰報數據學習）
  aiStrategySummary: text("aiStrategySummary"), // AI 生成的策略總結
  aiStrategyUpdatedAt: timestamp("aiStrategyUpdatedAt"), // 策略總結更新時間
  bestPerformingType: varchar("bestPerformingType", { length: 50 }), // 表現最好的內容類型
  bestPostingTime: varchar("bestPostingTime", { length: 20 }), // 最佳發文時段
  viralPatterns: text("viralPatterns"), // 爆文模式分析
  // LINE 官方帳號
  lineOfficialUrl: varchar("lineOfficialUrl", { length: 255 }), // LINE 官方帳號連結
  lineOfficialName: varchar("lineOfficialName", { length: 100 }), // LINE 官方帳號名稱
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
    "casual", "dialogue", "question", "poll", "quote",
    // 診斷型貼文
    "diagnosis",
    // 變現內容類型
    "profile_intro", "service_intro", "lead_promo", "success_story", "limited_offer", "plus_one", "lead_magnet", "free_value"
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
  // 戰報閉環學習欄位
  postingTime: varchar("postingTime", { length: 10 }), // 發文時段：morning/noon/evening/night
  topComment: text("topComment"), // 最熱門留言
  selfReflection: text("selfReflection"), // 自我反思：什麼有效/什麼可以改進
  aiInsight: text("aiInsight"), // AI 生成的策略洞察
  performanceLevel: mysqlEnum("performanceLevel", ["hit", "normal", "low"]), // 表現等級：爆文/正常/低迷
  // 爆文標記與分析
  isViral: boolean("isViral").default(false), // 用戶標記為爆文
  viralAnalysis: text("viralAnalysis"), // AI 分析爆文成功原因
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

// 訂閱系統（藍新金流預留）
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId"),
  plan: mysqlEnum("plan", ["free", "monthly", "yearly"]).default("free").notNull(),
  status: mysqlEnum("subscriptionStatus", ["active", "cancelled", "expired", "pending"]).default("pending").notNull(),
  // 藍新金流相關欄位
  newebpayMerchantOrderNo: varchar("newebpayMerchantOrderNo", { length: 64 }),
  newebpayTradeNo: varchar("newebpayTradeNo", { length: 64 }),
  newebpayPaymentType: varchar("newebpayPaymentType", { length: 32 }),
  // 訂閱資訊
  amount: int("amount"), // 金額（元）
  currency: varchar("currency", { length: 3 }).default("TWD"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  nextBillingDate: timestamp("nextBillingDate"),
  providerRef: varchar("providerRef", { length: 120 }),
  cancelledAt: timestamp("cancelledAt"),
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


// ==================== 用戶產品矩陣 ====================

export const userProducts = mysqlTable("user_products", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productType: mysqlEnum("userProductType", ["lead", "core", "vip", "passive"]).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  priceRange: varchar("priceRange", { length: 50 }), // e.g., "800-1500", "3000-8000"
  deliveryTime: varchar("deliveryTime", { length: 50 }), // e.g., "15分鐘", "1小時", "1週"
  uniqueValue: text("uniqueValue"), // 服務特色/差異化
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProduct = typeof userProducts.$inferSelect;
export type InsertUserProduct = typeof userProducts.$inferInsert;

// 成功案例故事
export const successStories = mysqlTable("success_stories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 120 }),
  clientBackground: text("clientBackground"), // 客戶背景（匿名）
  challenge: text("challenge"), // 面臨的挑戰
  transformation: text("transformation"), // 轉變過程
  outcome: text("outcome"), // 成果（避免療效承諾）
  testimonialQuote: text("testimonialQuote"), // 客戶見證語錄
  isPublic: boolean("isPublic").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SuccessStory = typeof successStories.$inferSelect;
export type InsertSuccessStory = typeof successStories.$inferInsert;

// ==================== AI 記憶系統 ====================

// 對話摘要（用於 AI 記憶）
export const conversationSummaries = mysqlTable("conversation_summaries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  summaryType: mysqlEnum("summaryType", [
    "writing_preference",  // 寫作偏好
    "content_success",     // 成功內容特徵
    "modification_pattern", // 修改模式
    "topic_interest",      // 主題興趣
    "style_feedback"       // 風格反饋
  ]).notNull(),
  content: text("content").notNull(),
  metadata: json("metadata"), // 額外結構化數據
  relevanceScore: int("relevanceScore").default(100), // 相關性分數，用於排序
  expiresAt: timestamp("expiresAt"), // 可選的過期時間
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConversationSummary = typeof conversationSummaries.$inferSelect;
export type InsertConversationSummary = typeof conversationSummaries.$inferInsert;

// 用戶經營狀態（用於階段判斷）
export const userGrowthMetrics = mysqlTable("user_growth_metrics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  followerCount: int("followerCount").default(0),
  avgReach: int("avgReach").default(0), // 平均觸及
  avgEngagement: int("avgEngagement").default(0), // 平均互動
  // 新增指標
  avgEngagementRate: int("avgEngagementRate").default(0), // 平均互動率（百分比 * 100，例如 5% = 500）
  postFrequency: int("postFrequency").default(0), // 週發文數
  totalPosts: int("totalPosts").default(0), // 總發文數
  hasProfileSetup: boolean("hasProfileSetup").default(false), // 是否已設置首頁自介
  hasLineLink: boolean("hasLineLink").default(false), // 是否已設置 LINE 連結
  hasProduct: boolean("hasProduct").default(false), // 是否已設定產品
  firstSaleAt: timestamp("firstSaleAt"), // 首次成交時間
  totalSales: int("totalSales").default(0), // 總成交數
  // 手動覆寫階段
  manualStage: mysqlEnum("manualStage", [
    "startup",    // 起步期
    "growth",     // 成長期
    "monetize",   // 變現期
    "scale"       // 規模化
  ]), // 用戶手動選擇的階段（優先於自動計算）
  currentStage: mysqlEnum("currentStage", [
    "startup",    // 起步期：粉絲 < 100
    "growth",     // 成長期：粉絲 100-1000，流量穩定破千
    "monetize",   // 變現期：粉絲 1000+，有穩定互動
    "scale"       // 規模化：粉絲 5000+，有成交紀錄
  ]).default("startup"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserGrowthMetric = typeof userGrowthMetrics.$inferSelect;
export type InsertUserGrowthMetric = typeof userGrowthMetrics.$inferInsert;


// ==================== 用戶風格分析 ====================

export const userWritingStyles = mysqlTable("user_writing_styles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 語氣特徵
  toneStyle: varchar("toneStyle", { length: 50 }), // 溫暖真誠 / 犀利直接 / 幽默風趣
  // 常用句式（JSON 陣列）
  commonPhrases: json("commonPhrases").$type<string[]>(), // 例如：["你有沒有發現...", "說真的..."]
  // 口頭禪（JSON 陣列）
  catchphrases: json("catchphrases").$type<string[]>(), // 例如：["真的", "欸", "吧"]
  // Hook 風格偏好
  hookStylePreference: varchar("hookStylePreference", { length: 50 }), // 反差型 / 提問型 / 場景型
  // 比喻風格
  metaphorStyle: varchar("metaphorStyle", { length: 50 }), // 生活化比喻 / 專業術語白話
  // 情緒節奏
  emotionRhythm: varchar("emotionRhythm", { length: 50 }), // 快節奏短句 / 娓娓道來長句
  // 爆款元素（JSON 物件）
  viralElements: json("viralElements").$type<{
    identityTags: string[]; // 常用身分標籤
    emotionWords: string[]; // 常用情緒詞
    ctaStyles: string[]; // 常用 CTA 類型
  }>(),
  // 原始爆款貼文（用於分析的素材）
  samplePosts: json("samplePosts").$type<Array<{
    content: string;
    engagement?: number; // 互動數（可選）
    addedAt: string; // 新增時間
  }>>(),
  // 分析狀態
  analysisStatus: mysqlEnum("analysisStatus", ["pending", "analyzing", "completed", "failed"]).default("pending"),
  lastAnalyzedAt: timestamp("lastAnalyzedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserWritingStyle = typeof userWritingStyles.$inferSelect;
export type InsertUserWritingStyle = typeof userWritingStyles.$inferInsert;
