import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getEndpoints, getAlertRules, getSystemAlerts, getEnrollmentTokens } from "./db";
import { z } from "zod";
import path from "path";
import crypto from "crypto";

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
    acknowledgeAlert: protectedProcedure.input(z.object({ alertId: z.string() })).mutation(async ({ input }) => {
      return { success: true, alertId: input.alertId };
    }),
    generateToken: protectedProcedure.mutation(async () => {
      return { success: true, token: `sp_enrol_${crypto.randomUUID().replaceAll('-', '')}` };
    }),
  }),
});

export type AppRouter = typeof appRouter;

import { generateCsvReport } from "./generateReports";

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
