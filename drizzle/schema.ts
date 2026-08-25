import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  organizationId: varchar("organizationId", { length: 64 }).default("org-enterprise-01").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const platformSettings = mysqlTable("platformSettings", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  localIp: varchar("localIp", { length: 255 }).notNull(),
  setupCompleted: boolean("setupCompleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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

export const departmentCatalog = mysqlTable("department_catalog", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const locationCatalog = mysqlTable("location_catalog", {
  id: varchar("id", { length: 64 }).primaryKey(),
  organizationId: varchar("organizationId", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
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

export const endpointMetadata = mysqlTable("endpoint_metadata", {
  endpointId: varchar("endpointId", { length: 64 }).primaryKey(),
  department: varchar("department", { length: 128 }),
  location: varchar("location", { length: 128 }),
  assignedUser: varchar("assignedUser", { length: 255 }),
  assetId: varchar("assetId", { length: 128 }),
  ownership: mysqlEnum("ownership", ["company_owned", "employee_owned", "leased"]).default("company_owned").notNull(),
  tags: text("tags"), // JSON comma-separated tags
  maintenanceMode: boolean("maintenanceMode").default(false).notNull(),
});

export const endpointMetadataAudit = mysqlTable("endpoint_metadata_audit", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: varchar("organizationId", { length: 64 }).notNull(),
  endpointId: varchar("endpointId", { length: 64 }).notNull(),
  actorOpenId: varchar("actorOpenId", { length: 255 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  changedFields: text("changedFields").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const batteryTelemetry = mysqlTable("battery_telemetry", {
  id: int("id").autoincrement().primaryKey(),
  endpointId: varchar("endpointId", { length: 64 }).notNull(),
  chargePercent: int("chargePercent").notNull(),
  healthPercent: int("healthPercent").notNull(),
  chargingStatus: varchar("chargingStatus", { length: 32 }).notNull(),
  designCapacityMah: int("designCapacityMah"),
  fullChargeCapacityMah: int("fullChargeCapacityMah"),
  cycleCount: int("cycleCount"),
  temperatureCelsius: decimal("temperatureCelsius", { precision: 5, scale: 2 }),
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
});

export const networkTelemetry = mysqlTable("network_telemetry", {
  id: int("id").autoincrement().primaryKey(),
  endpointId: varchar("endpointId", { length: 64 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  macAddress: varchar("macAddress", { length: 64 }),
  gateway: varchar("gateway", { length: 64 }),
  ssid: varchar("ssid", { length: 128 }),
  signalStrengthPercent: int("signalStrengthPercent"),
  downloadBps: decimal("downloadBps", { precision: 15, scale: 2 }),
  uploadBps: decimal("uploadBps", { precision: 15, scale: 2 }),
  latencyMs: decimal("latencyMs", { precision: 8, scale: 2 }),
  vpnActive: boolean("vpnActive").default(false).notNull(),
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
});

export const appUsageTelemetry = mysqlTable("app_usage_telemetry", {
  id: int("id").autoincrement().primaryKey(),
  endpointId: varchar("endpointId", { length: 64 }).notNull(),
  appName: varchar("appName", { length: 255 }).notNull(),
  activeSeconds: int("activeSeconds").notNull(),
  cpuTimeSeconds: int("cpuTimeSeconds").notNull(),
  networkBytes: decimal("networkBytes", { precision: 15, scale: 0 }),
  launchCount: int("launchCount").notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
});
