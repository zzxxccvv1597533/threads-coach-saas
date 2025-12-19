import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getUserProductsByUserId: vi.fn().mockResolvedValue([]),
  createUserProduct: vi.fn().mockImplementation((data) => Promise.resolve({
    id: 1,
    userId: data.userId,
    productType: data.productType,
    name: data.name,
    description: data.description || null,
    priceRange: data.priceRange || null,
    deliveryTime: data.deliveryTime || null,
    uniqueValue: data.uniqueValue || null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  updateUserProduct: vi.fn().mockResolvedValue(undefined),
  deleteUserProduct: vi.fn().mockResolvedValue(undefined),
  getSuccessStoriesByUserId: vi.fn().mockResolvedValue([]),
  createSuccessStory: vi.fn().mockImplementation((data) => Promise.resolve({
    id: 1,
    userId: data.userId,
    title: data.title,
    clientBackground: data.clientBackground || null,
    challenge: data.challenge || null,
    transformation: data.transformation || null,
    outcome: data.outcome || null,
    testimonialQuote: data.testimonialQuote || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  updateSuccessStory: vi.fn().mockResolvedValue(undefined),
  deleteSuccessStory: vi.fn().mockResolvedValue(undefined),
  getUserGrowthMetrics: vi.fn().mockResolvedValue(null),
  upsertUserGrowthMetrics: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    followerCount: 150,
    avgReach: 1200,
    currentStage: 'growth',
  }),
  calculateUserStage: vi.fn().mockResolvedValue('growth'),
  getConversationSummariesByUserId: vi.fn().mockResolvedValue([]),
  createConversationSummary: vi.fn().mockImplementation((data) => Promise.resolve({
    id: 1,
    userId: data.userId,
    summaryType: data.summaryType,
    content: data.content,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  getUserAIMemory: vi.fn().mockResolvedValue(''),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@test.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe('User Product API', () => {
  let ctx: TrpcContext;

  beforeEach(() => {
    ctx = createUserContext();
    vi.clearAllMocks();
  });

  it('should list user products', async () => {
    const caller = appRouter.createCaller(ctx);
    const products = await caller.userProduct.list();
    expect(Array.isArray(products)).toBe(true);
  });

  it('should create a core product', async () => {
    const caller = appRouter.createCaller(ctx);
    
    const product = await caller.userProduct.create({
      productType: 'core',
      name: '完整命盤解讀',
      description: '深度解讀你的命盤，找到人生方向',
      priceRange: '3000-5000元',
      deliveryTime: '60分鐘',
      uniqueValue: '我是命理界的閨蜜，用聊天的方式解讀',
    });
    
    expect(product).toBeDefined();
    expect(product?.name).toBe('完整命盤解讀');
    expect(product?.productType).toBe('core');
  });

  it('should delete a product', async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.userProduct.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe('Success Story API', () => {
  let ctx: TrpcContext;

  beforeEach(() => {
    ctx = createUserContext();
    vi.clearAllMocks();
  });

  it('should list success stories', async () => {
    const caller = appRouter.createCaller(ctx);
    const stories = await caller.successStory.list();
    expect(Array.isArray(stories)).toBe(true);
  });

  it('should create a success story', async () => {
    const caller = appRouter.createCaller(ctx);
    
    const story = await caller.successStory.create({
      title: '從迷茫到找到方向的小美',
      clientBackground: '30歲上班族，對工作感到迷茫',
      challenge: '不知道自己適合什麼工作',
      transformation: '透過命盤解讀，找到自己的天賦',
      outcome: '現在對未來有了清晰的方向',
      testimonialQuote: '謝謝老師讓我看見自己的可能性',
    });
    
    expect(story).toBeDefined();
    expect(story?.title).toBe('從迷茫到找到方向的小美');
  });

  it('should delete a story', async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.successStory.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe('Growth Metrics API', () => {
  let ctx: TrpcContext;

  beforeEach(() => {
    ctx = createUserContext();
    vi.clearAllMocks();
  });

  it('should get growth metrics', async () => {
    const caller = appRouter.createCaller(ctx);
    const metrics = await caller.growthMetrics.get();
    // May be null initially
    expect(metrics === null || typeof metrics === 'object').toBe(true);
  });

  it('should update growth metrics', async () => {
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.growthMetrics.update({
      followerCount: 150,
      avgReach: 1200,
      hasProfileSetup: true,
    });
    
    expect(result.success).toBe(true);
    expect(result.stage).toBeDefined();
  });

  it('should calculate user stage', async () => {
    const caller = appRouter.createCaller(ctx);
    const stage = await caller.growthMetrics.getStage();
    expect(['startup', 'growth', 'monetize', 'scale']).toContain(stage);
  });
});

describe('AI Memory API', () => {
  let ctx: TrpcContext;

  beforeEach(() => {
    ctx = createUserContext();
    vi.clearAllMocks();
  });

  it('should get AI memory summaries', async () => {
    const caller = appRouter.createCaller(ctx);
    const summaries = await caller.aiMemory.getSummaries();
    expect(Array.isArray(summaries)).toBe(true);
  });

  it('should add a memory summary', async () => {
    const caller = appRouter.createCaller(ctx);
    
    const summary = await caller.aiMemory.addSummary({
      summaryType: 'writing_preference',
      content: '學員偏好口語化、溫暖的語氣',
    });
    
    expect(summary).toBeDefined();
    expect(summary?.summaryType).toBe('writing_preference');
  });

  it('should get memory context string', async () => {
    const caller = appRouter.createCaller(ctx);
    const memoryContext = await caller.aiMemory.getMemoryContext();
    expect(typeof memoryContext).toBe('string');
  });
});
