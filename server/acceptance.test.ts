import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAcceptanceContext(role: 'user' | 'admin' = 'admin'): TrpcContext {
  return {
    user: {
      id: 200,
      openId: "acceptance-admin-user",
      email: "audit@sentinelpulse.local",
      name: "Acceptance Validator",
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
  }, 15_000);

  it("verifies local Go mode rejects the legacy tRPC MSI mutation", async () => {
    const caller = appRouter.createCaller(createAcceptanceContext('admin'));
    await expect(caller.reports.buildMsi({ version: "2.4.1" })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'MSI builds are handled by the authenticated Windows builder runner in the local Go deployment.',
    });
  });

  it("verifies RBAC enforcement on administrative mutation", async () => {
    const viewerCaller = appRouter.createCaller(createAcceptanceContext('user'));
    await expect(
      viewerCaller.monitoring.requestRefresh({ modules: ['all'] })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
