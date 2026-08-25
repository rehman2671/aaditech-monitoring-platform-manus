import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(role: 'user' | 'admin' = 'admin', organizationId = 'org-enterprise-01'): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin",
      email: "admin@enterprise.local",
      name: "Test Admin",
      loginMethod: "manus",
      role,
      organizationId,
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
    if (endpoints.length > 0) {
      expect(endpoints[0]).toHaveProperty('metadata');
      expect(endpoints[0]).toHaveProperty('battery');
      expect(endpoints[0]).toHaveProperty('networkAdapters');
      expect(endpoints[0]).toHaveProperty('applicationUsage');
    }
  });
});

  it("does not expose endpoints from another organization", async () => {
    const caller = appRouter.createCaller(createMockContext('admin', 'org-does-not-exist'));
    const endpoints = await caller.monitoring.endpoints();
    expect(endpoints).toEqual([]);
  });

  it("blocks child evidence queries for an endpoint outside the authenticated organization", async () => {
    const caller = appRouter.createCaller(createMockContext('admin', 'org-does-not-exist'));
    const endpointId = 'ep-001-uuid';
    await expect(caller.monitoring.endpointMetadata({ endpointId })).resolves.toBeUndefined();
    await expect(caller.monitoring.battery({ endpointId })).resolves.toBeUndefined();
    await expect(caller.monitoring.network({ endpointId })).resolves.toEqual([]);
    await expect(caller.monitoring.applicationUsage({ endpointId })).resolves.toEqual([]);
  });

  it("rejects metadata writes outside the authenticated organization", async () => {
    const caller = appRouter.createCaller(createMockContext('admin', 'org-does-not-exist'));
    await expect(caller.monitoring.updateEndpointMetadata({ endpointId: 'ep-001-uuid', assetId: 'CLIENT-CONTROLLED' })).rejects.toThrow('outside the authenticated organization');
  });

  it("allows an admin to issue a tenant-scoped refresh request", async () => {
    const caller = appRouter.createCaller(createMockContext('admin'));
    const result = await caller.monitoring.requestRefresh({ modules: ['performance'] });
    expect(result.success).toBe(true);
    expect(result.requestId).toMatch(/[0-9a-f-]{36}/);
  });

  it("rejects refresh requests for viewer roles", async () => {
    const caller = appRouter.createCaller(createMockContext('user'));
    await expect(caller.monitoring.requestRefresh({ modules: ['performance'] })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
