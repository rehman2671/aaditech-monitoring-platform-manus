import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here

import { decimal, boolean } from "drizzle-orm/mysql-core";

export const organizations = mysqlTable("organizations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const endpoints = mysqlTable("endpoints", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 64 }).notNull(),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  serialNumber: varchar("serialNumber", { length: 128 }).notNull(),
  osVersion: varchar("osVersion", { length: 128 }),
  osBuild: varchar("osBuild", { length: 64 }),
  domainOrWorkgroup: varchar("domainOrWorkgroup", { length: 128 }),
  agentVersion: varchar("agentVersion", { length: 64 }),
  status: mysqlEnum("status", ["pending", "online", "offline", "disabled"]).default("online").notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const enrollmentTokens = mysqlTable("enrollment_tokens", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 64 }).notNull(),
  tokenHash: text("tokenHash").notNull(),
  plainToken: text("plainToken"),
  expiresAt: timestamp("expiresAt").notNull(),
  usedByEndpointId: varchar("usedByEndpointId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const alertRules = mysqlTable("alert_rules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 64 }).notNull(),
  name: text("name").notNull(),
  metric: varchar("metric", { length: 64 }).notNull(),
  condition: varchar("condition", { length: 16 }).notNull(),
  thresholdValue: decimal("thresholdValue", { precision: 10, scale: 2 }).notNull(),
  severity: mysqlEnum("severity", ["warning", "critical"]).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  durationMinutes: int("durationMinutes").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const systemAlerts = mysqlTable("system_alerts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 64 }).notNull(),
  endpointId: varchar("endpointId", { length: 64 }).notNull(),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  ruleName: text("ruleName").notNull(),
  severity: mysqlEnum("severity", ["warning", "critical"]).notNull(),
  message: text("message").notNull(),
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
  acknowledged: boolean("acknowledged").default(false).notNull(),
});

export type EndpointRecord = typeof endpoints.$inferSelect;
export type AlertRuleRecord = typeof alertRules.$inferSelect;
export type SystemAlertRecord = typeof systemAlerts.$inferSelect;
export type EnrollmentTokenRecord = typeof enrollmentTokens.$inferSelect;
