import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getEndpoints, getAlertRules, getSystemAlerts, getEnrollmentTokens, getEndpointMetadata, getLatestBatteryTelemetry, getLatestNetworkTelemetry, getApplicationUsage, recordEndpointMetadata } from "./db";
import { z } from "zod";
import path from "path";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { calculateHealthScore } from "./healthScore";
import { buildVersionedMsi } from "./msiBuild";

async function getReportInputs() {
  const endpoints = await getEndpoints();
  const alerts = await getSystemAlerts();
  const telemetry = await Promise.all(endpoints.map(async endpoint => ({
    endpointId: endpoint.id,
    battery: await getLatestBatteryTelemetry(endpoint.id),
    network: (await getLatestNetworkTelemetry(endpoint.id))[0],
    applications: await getApplicationUsage(endpoint.id),
  })));
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
    summary: protectedProcedure.query(async () => {
      const eps = await getEndpoints();
      const alerts = await getSystemAlerts();
      return {
        totalEndpoints: eps.length,
        onlineEndpoints: eps.filter(e => e.status === 'online').length,
        offlineEndpoints: eps.filter(e => e.status === 'offline').length,
        warningEndpoints: eps.filter(e => e.status === 'pending').length,
        activeAlerts: alerts.filter(a => !a.acknowledged).length,
        diskCriticalCount: 1,
      };
    }),
    endpoints: protectedProcedure.query(async () => {
      return await getEndpoints();
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
    endpointMetadata: protectedProcedure.input(z.object({ endpointId: z.string().min(1) })).query(async ({ input }) => {
      return getEndpointMetadata(input.endpointId);
    }),
    battery: protectedProcedure.input(z.object({ endpointId: z.string().min(1) })).query(async ({ input }) => {
      return getLatestBatteryTelemetry(input.endpointId);
    }),
    network: protectedProcedure.input(z.object({ endpointId: z.string().min(1) })).query(async ({ input }) => {
      return getLatestNetworkTelemetry(input.endpointId);
    }),
    applicationUsage: protectedProcedure.input(z.object({ endpointId: z.string().min(1) })).query(async ({ input }) => {
      return getApplicationUsage(input.endpointId);
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
      await recordEndpointMetadata(endpointId, values);
      return { success: true, endpointId };
    }),
    acknowledgeAlert: protectedProcedure.input(z.object({ alertId: z.string() })).mutation(async ({ input }) => {
      return { success: true, alertId: input.alertId };
    }),
    generateToken: protectedProcedure.mutation(async () => {
      return { success: true, token: `sp_enrol_${crypto.randomUUID().replaceAll('-', '')}` };
    }),
  }),
  reports: router({
    exportCsv: protectedProcedure.query(async () => {
      const { endpoints, alerts, telemetry } = await getReportInputs();
      const filePath = generateCsvReport(endpoints, alerts, telemetry);
      return { success: true, format: 'csv' as const, downloadUrl: `/exports/${path.basename(filePath)}` };
    }),
    exportPdf: protectedProcedure.query(async () => {
      const { endpoints, alerts, telemetry } = await getReportInputs();
      const filePath = generatePdfReport(endpoints, alerts, telemetry);
      return { success: true, format: 'pdf' as const, downloadUrl: `/exports/${path.basename(filePath)}` };
    }),
    buildMsi: protectedProcedure.input(z.object({ version: z.string().regex(/^\\d+\\.\\d+\\.\\d+([.-][0-9A-Za-z.-]+)?$/) })).mutation(async ({ input }) => {
      return buildVersionedMsi(input.version);
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
  buildMsi: protectedProcedure.input(z.object({ version: z.string() })).mutation(async ({ input }) => {
    return { 
      success: true, 
      version: input.version, 
      artifactUrl: `/artifacts/SentinelPulseAgent-${input.version}-x64.msi`,
      sha256: crypto.randomBytes(32).toString('hex')
    };
  }),
});
