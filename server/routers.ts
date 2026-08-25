import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getEndpoints, getEnrichedEndpoints, getAlertRules, getSystemAlerts, getEnrollmentTokens, getEndpointMetadata, getLatestBatteryTelemetry, getLatestNetworkTelemetry, getApplicationUsage, recordEndpointMetadata, acknowledgeSystemAlert, setAlertRuleEnabled, listDepartmentCatalog, listLocationCatalog, createDepartmentCatalogEntry, createLocationCatalogEntry } from "./db";
import { z } from "zod";
import path from "path";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { calculateHealthScore } from "./healthScore";
import { broadcastRealtimeEvent } from './realtime';

function getOrganizationId(user: NonNullable<TrpcContext['user']>) {
  return user.organizationId;
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Administrator role required.' });
  }
  return next();
});

async function getReportInputs(orgId: string) {
  const endpoints = await getEnrichedEndpoints(orgId);
  const alerts = await getSystemAlerts(orgId);
  const telemetry = endpoints.map(endpoint => ({
    endpointId: endpoint.id,
    battery: endpoint.battery,
    network: endpoint.networkAdapters?.[0],
    applications: endpoint.applicationUsage,
  }));
  return { endpoints, alerts, telemetry };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  monitoring: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const organizationId = getOrganizationId(ctx.user);
      const eps = await getEndpoints(organizationId);
      const alerts = await getSystemAlerts(organizationId);
      return {
        totalEndpoints: eps.length,
        onlineEndpoints: eps.filter(e => e.status === 'online').length,
        offlineEndpoints: eps.filter(e => e.status === 'offline').length,
        warningEndpoints: eps.filter(e => e.status === 'pending').length,
        activeAlerts: alerts.filter(a => !a.acknowledged).length,
        // Disk-critical evidence is not persisted by this dashboard schema yet;
        // report zero rather than inventing a critical device count.
        diskCriticalCount: 0,
      };
    }),
    endpoints: protectedProcedure.query(async ({ ctx }) => {
      return await getEnrichedEndpoints(getOrganizationId(ctx.user));
    }),
    alertRules: protectedProcedure.query(async () => {
      return await getAlertRules();
    }),
    systemAlerts: protectedProcedure.query(async () => {
      return await getSystemAlerts();
    }),
    enrollmentTokens: protectedProcedure.query(async () => {
      return await getEnrollmentTokens();
    }),
    endpointMetadata: protectedProcedure.input(z.object({ endpointId: z.string().min(1) })).query(async ({ ctx, input }) => {
      return getEndpointMetadata(input.endpointId, getOrganizationId(ctx.user));
    }),
    battery: protectedProcedure.input(z.object({ endpointId: z.string().min(1) })).query(async ({ ctx, input }) => {
      return getLatestBatteryTelemetry(input.endpointId, getOrganizationId(ctx.user));
    }),
    network: protectedProcedure.input(z.object({ endpointId: z.string().min(1) })).query(async ({ ctx, input }) => {
      return getLatestNetworkTelemetry(input.endpointId, getOrganizationId(ctx.user));
    }),
    applicationUsage: protectedProcedure.input(z.object({ endpointId: z.string().min(1) })).query(async ({ ctx, input }) => {
      return getApplicationUsage(input.endpointId, getOrganizationId(ctx.user));
    }),
    departments: protectedProcedure.query(async ({ ctx }) => listDepartmentCatalog(getOrganizationId(ctx.user))),
    locations: protectedProcedure.query(async ({ ctx }) => listLocationCatalog(getOrganizationId(ctx.user))),
    createDepartment: adminProcedure.input(z.object({ name: z.string().trim().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const entry = { id: crypto.randomUUID(), organizationId: getOrganizationId(ctx.user), name: input.name, createdAt: new Date() };
      await createDepartmentCatalogEntry(entry);
      return entry;
    }),
    createLocation: adminProcedure.input(z.object({ name: z.string().trim().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const entry = { id: crypto.randomUUID(), organizationId: getOrganizationId(ctx.user), name: input.name, createdAt: new Date() };
      await createLocationCatalogEntry(entry);
      return entry;
    }),
    healthScore: protectedProcedure.input(z.object({
      cpuUtilizationPercent: z.number().min(0).max(100).optional(),
      memoryUtilizationPercent: z.number().min(0).max(100).optional(),
      diskFreePercent: z.number().min(0).max(100).optional(),
      batteryHealthPercent: z.number().min(0).max(100).optional(),
      networkLatencyMs: z.number().min(0).optional(),
      securityScore: z.number().min(0).max(100).optional(),
    })).query(({ input }) => calculateHealthScore(input)),
    updateEndpointMetadata: protectedProcedure.input(z.object({
      endpointId: z.string().min(1),
      department: z.string().max(128).nullable().optional(),
      location: z.string().max(128).nullable().optional(),
      assignedUser: z.string().max(255).nullable().optional(),
      assetId: z.string().max(128).nullable().optional(),
      tags: z.string().max(2048).nullable().optional(),
      maintenanceMode: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
      const { endpointId, ...values } = input;
      const result = await recordEndpointMetadata(endpointId, values, getOrganizationId(ctx.user));
      return { success: true, ...result };
    }),
    acknowledgeAlert: protectedProcedure.input(z.object({ alertId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
      await acknowledgeSystemAlert(input.alertId, getOrganizationId(ctx.user));
      return { success: true, alertId: input.alertId };
    }),
    setAlertRuleEnabled: protectedProcedure.input(z.object({ ruleId: z.string().min(1), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
      await setAlertRuleEnabled(input.ruleId, input.enabled, getOrganizationId(ctx.user));
      return { success: true, ruleId: input.ruleId, enabled: input.enabled };
    }),
    generateToken: protectedProcedure.mutation(async () => {
      return { success: true, token: `sp_enrol_${crypto.randomUUID().replaceAll('-', '')}` };
    }),
    requestRefresh: protectedProcedure.input(z.object({ endpointId: z.string().min(1).optional(), modules: z.array(z.string().min(1)).min(1).max(20) })).mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' });
      const requestId = crypto.randomUUID();
      broadcastRealtimeEvent({ type: 'refresh_request', endpointId: input.endpointId, modules: input.modules, requestId, organizationId: String((ctx.user as typeof ctx.user & { organizationId?: string }).organizationId ?? ctx.user.openId) });
      return { success: true, requestId };
    }),
  }),
  reports: router({
    exportCsv: protectedProcedure.query(async ({ ctx }) => {
      const { endpoints, alerts, telemetry } = await getReportInputs(getOrganizationId(ctx.user));
      const filePath = generateCsvReport(endpoints, alerts, telemetry);
      return { success: true, format: 'csv' as const, downloadUrl: `/exports/${path.basename(filePath)}` };
    }),
    exportPdf: protectedProcedure.query(async ({ ctx }) => {
      const { endpoints, alerts, telemetry } = await getReportInputs(getOrganizationId(ctx.user));
      const filePath = generatePdfReport(endpoints, alerts, telemetry);
      return { success: true, format: 'pdf' as const, downloadUrl: `/exports/${path.basename(filePath)}` };
    }),
    buildMsi: protectedProcedure.input(z.object({ version: z.string().regex(/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/, "Invalid semver version format") })).mutation(async () => {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'MSI builds are handled by the authenticated Windows builder runner in the local Go deployment.' });
    }),
  }),
});

export type AppRouter = typeof appRouter;

import { generateCsvReport, generatePdfReport } from "./generateReports";

export const reportRouter = router({
  exportCsv: protectedProcedure.query(async () => {
    const eps = await getEndpoints();
    const alerts = await getSystemAlerts();
    const filePath = generateCsvReport(eps, alerts);
    return { success: true, downloadUrl: `/exports/${path.basename(filePath)}` };
  }),
  buildMsi: protectedProcedure.input(z.object({ version: z.string() })).mutation(async () => {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'MSI builds are handled by the authenticated Windows builder runner in the local Go deployment.' });
  }),
});
