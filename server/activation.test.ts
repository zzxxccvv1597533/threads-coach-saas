import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  activateUser: vi.fn().mockResolvedValue(undefined),
  deactivateUser: vi.fn().mockResolvedValue(undefined),
  extendUserExpiry: vi.fn().mockResolvedValue(undefined),
  getPendingUsers: vi.fn().mockResolvedValue([
    { id: 2, name: "待開通學員", email: "pending@test.com", activationStatus: "pending" }
  ]),
  getActivatedUsers: vi.fn().mockResolvedValue([
    { id: 3, name: "已開通學員", email: "activated@test.com", activationStatus: "activated" }
  ]),
  getAllUsers: vi.fn().mockResolvedValue([
    { id: 1, name: "Admin", email: "admin@test.com", role: "admin", activationStatus: "activated" },
    { id: 2, name: "待開通學員", email: "pending@test.com", role: "user", activationStatus: "pending" },
    { id: 3, name: "已開通學員", email: "activated@test.com", role: "user", activationStatus: "activated" },
  ]),
  getApiUsageByUserId: vi.fn().mockResolvedValue([]),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@test.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
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

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@test.com",
    name: "Regular User",
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

describe("admin.activateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows admin to activate a user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.activateUser({
      userId: 2,
      note: "已確認付款",
    });

    expect(result).toEqual({ success: true });
  });

  it("allows admin to activate a user with expiry date", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const expiryDate = new Date("2025-12-31");

    const result = await caller.admin.activateUser({
      userId: 2,
      expiresAt: expiryDate,
      note: "一年期課程",
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects non-admin users from activating", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.activateUser({ userId: 3 })
    ).rejects.toThrow();
  });
});

describe("admin.deactivateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows admin to deactivate a user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.deactivateUser({
      userId: 3,
      note: "課程到期",
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects non-admin users from deactivating", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.deactivateUser({ userId: 3 })
    ).rejects.toThrow();
  });
});

describe("admin.extendUserExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows admin to extend user expiry", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const newExpiryDate = new Date("2026-12-31");

    const result = await caller.admin.extendUserExpiry({
      userId: 3,
      newExpiresAt: newExpiryDate,
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects non-admin users from extending expiry", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.extendUserExpiry({
        userId: 3,
        newExpiresAt: new Date("2026-12-31"),
      })
    ).rejects.toThrow();
  });
});

describe("admin.pendingUsers", () => {
  it("returns list of pending users for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.pendingUsers();

    expect(result).toHaveLength(1);
    expect(result[0].activationStatus).toBe("pending");
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.pendingUsers()).rejects.toThrow();
  });
});

describe("admin.activatedUsers", () => {
  it("returns list of activated users for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.activatedUsers();

    expect(result).toHaveLength(1);
    expect(result[0].activationStatus).toBe("activated");
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.activatedUsers()).rejects.toThrow();
  });
});

describe("admin.users", () => {
  it("returns all users for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.users();

    expect(result).toHaveLength(3);
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.users()).rejects.toThrow();
  });
});
