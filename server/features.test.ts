import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
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

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Knowledge Base API", () => {
  it("returns content types from knowledge base", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.knowledge.contentTypes();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
  });

  it("returns four lens framework from knowledge base", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.knowledge.fourLens();

    expect(result).toBeDefined();
    expect(result).toHaveProperty("emotion");
    expect(result).toHaveProperty("persona");
    expect(result).toHaveProperty("structure");
    expect(result).toHaveProperty("conversion");
  });

  it("returns task types from knowledge base", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.knowledge.taskTypes();

    expect(result).toBeDefined();
    expect(result).toHaveProperty("reply_comments");
    expect(result).toHaveProperty("comment_others");
    expect(result).toHaveProperty("sea_patrol");
  });

  it("returns hook styles from knowledge base", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.knowledge.hookStyles();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("IP Profile API", () => {
  it("requires authentication for getting IP profile", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.ipProfile.get()).rejects.toThrow();
  });

  it("requires authentication for updating IP profile", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ipProfile.update({ occupation: "塔羅師" })
    ).rejects.toThrow();
  });
});

describe("Draft API", () => {
  it("requires authentication for listing drafts", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.draft.list()).rejects.toThrow();
  });

  it("requires authentication for creating drafts", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.draft.create({
        contentType: "story",
        body: "Test draft content",
      })
    ).rejects.toThrow();
  });
});

describe("Task API", () => {
  it("requires authentication for getting today's tasks", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.task.today()).rejects.toThrow();
  });

  it("requires authentication for generating daily tasks", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.task.generateDaily()).rejects.toThrow();
  });
});

describe("Post API", () => {
  it("requires authentication for listing posts", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.post.list()).rejects.toThrow();
  });

  it("requires authentication for creating posts", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.post.create({ threadUrl: "https://threads.net/test" })
    ).rejects.toThrow();
  });
});

describe("Admin API", () => {
  it("requires admin role for listing users", async () => {
    const ctx = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.users()).rejects.toThrow();
  });

  it("allows admin to list users", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    // This may fail if DB is not available, but should not throw auth error
    try {
      const result = await caller.admin.users();
      expect(Array.isArray(result)).toBe(true);
    } catch (error: any) {
      // If it fails, it should not be an authorization error
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("AI API", () => {
  it("requires authentication for brainstorming", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.ai.brainstorm({})).rejects.toThrow();
  });

  it("requires authentication for analyzing angles", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ai.analyzeAngles({ material: "Test material" })
    ).rejects.toThrow();
  });

  it("requires authentication for generating drafts", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ai.generateDraft({
        material: "Test material",
        contentType: "story",
      })
    ).rejects.toThrow();
  });

  it("requires authentication for optimizing text", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ai.optimize({ text: "Test text to optimize" })
    ).rejects.toThrow();
  });
});
