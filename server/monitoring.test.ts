import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(role: 'user' | 'admin' = 'admin'): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin",
      email: "admin@enterprise.local",
      name: "Test Admin",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("monitoring router", () => {
  it("returns dashboard summary", async () => {
    const ctx = createMockContext('admin');
    const caller = appRouter.createCaller(ctx);
    const summary = await caller.monitoring.summary();
    expect(summary).toBeDefined();
    expect(typeof summary.totalEndpoints).toBe("number");
  });

  it("returns endpoint list", async () => {
    const ctx = createMockContext('admin');
    const caller = appRouter.createCaller(ctx);
    const endpoints = await caller.monitoring.endpoints();
    expect(Array.isArray(endpoints)).toBe(true);
  });
});
