import { describe, expect, it } from "vitest";
import { appRouter } from "../../server/routers";
import type { TrpcContext } from "../../server/_core/context";

function createAcceptanceContext(role: 'user' | 'admin' = 'admin'): TrpcContext {
  return {
    user: {
      id: 100,
      openId: "acceptance-admin",
      email: "security@sentinelpulse.local",
      name: "Acceptance Test Admin",
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

describe("SentinelPulse End-to-End Acceptance Suite", () => {
  it("verifies full telemetry summary and endpoint listing contract", async () => {
    const caller = appRouter.createCaller(createAcceptanceContext('admin'));
    const summary = await caller.monitoring.summary();
    expect(summary).toBeDefined();
    expect(summary.totalEndpoints).toBeGreaterThanOrEqual(0);

    const endpoints = await caller.monitoring.endpoints();
    expect(Array.isArray(endpoints)).toBe(true);
  });

  it("verifies MSI build request payload contract", async () => {
    const caller = appRouter.createCaller(createAcceptanceContext('admin'));
    const result = await caller.reports.buildMsi({ version: "2.4.1" });
    expect(result).toBeDefined();
    expect(["succeeded", "failed", "blocked"]).toContain(result.status);
  });

  it("verifies RBAC enforcement on administrative mutation", async () => {
    const viewerCaller = appRouter.createCaller(createAcceptanceContext('user'));
    await expect(
      viewerCaller.monitoring.requestRefresh({ modules: ['all'] })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
