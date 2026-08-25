import { and, eq, sql, or, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import crypto from "crypto";
import { InsertUser, users, departmentCatalog, locationCatalog, endpointMetadataAudit } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (user.organizationId !== undefined) {
      values.organizationId = user.organizationId;
      updateSet.organizationId = user.organizationId;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function listDepartmentCatalog(orgId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(departmentCatalog).where(eq(departmentCatalog.organizationId, orgId)).orderBy(sql`name ASC`);
}

export async function listLocationCatalog(orgId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locationCatalog).where(eq(locationCatalog.organizationId, orgId)).orderBy(sql`name ASC`);
}

export async function createDepartmentCatalogEntry(entry: typeof departmentCatalog.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  await db.insert(departmentCatalog).values(entry);
  return entry;
}

export async function createLocationCatalogEntry(entry: typeof locationCatalog.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  await db.insert(locationCatalog).values(entry);
  return entry;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

import { endpoints, alertRules, systemAlerts, enrollmentTokens, endpointMetadata, batteryTelemetry, networkTelemetry, appUsageTelemetry } from "../drizzle/schema";

export async function getEndpoints(orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(endpoints).where(eq(endpoints.organizationId, orgId));
}

/**
 * Returns the endpoint list together with the latest evidence that the detail
 * view needs. Each child query is scoped by the endpoint IDs already selected
 * from the organization-scoped endpoint query; no child record can broaden the
 * tenant boundary.
 */
export async function getEnrichedEndpoints(orgId = 'org-enterprise-01') {
  const rows = await getEndpoints(orgId);
  return Promise.all(rows.map(async endpoint => {
    const [metadata, battery, network, applicationUsage] = await Promise.all([
      getEndpointMetadata(endpoint.id, orgId).catch(error => {
        console.warn(`[Database] Endpoint metadata unavailable for ${endpoint.id}:`, error);
        return undefined;
      }),
      getLatestBatteryTelemetry(endpoint.id, orgId).catch(error => {
        console.warn(`[Database] Battery telemetry unavailable for ${endpoint.id}:`, error);
        return undefined;
      }),
      getLatestNetworkTelemetry(endpoint.id, orgId).catch(error => {
        console.warn(`[Database] Network telemetry unavailable for ${endpoint.id}:`, error);
        return [];
      }),
      getApplicationUsage(endpoint.id, orgId).catch(error => {
        console.warn(`[Database] Application usage unavailable for ${endpoint.id}:`, error);
        return [];
      }),
    ]);
    return { ...endpoint, metadata, battery, networkAdapters: network, applicationUsage };
  }));
}

export async function getAlertRules(orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertRules).where(eq(alertRules.organizationId, orgId));
}

export async function getSystemAlerts(orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ alert: systemAlerts, maintenanceMode: endpointMetadata.maintenanceMode })
    .from(systemAlerts)
    .leftJoin(endpointMetadata, eq(systemAlerts.endpointId, endpointMetadata.endpointId))
    .where(and(eq(systemAlerts.organizationId, orgId), or(isNull(endpointMetadata.maintenanceMode), eq(endpointMetadata.maintenanceMode, false))));
  return rows.map(row => row.alert);
}

export async function getEnrollmentTokens(orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(enrollmentTokens).where(eq(enrollmentTokens.organizationId, orgId));
}

export async function acknowledgeSystemAlert(alertId: string, orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  await db.update(systemAlerts).set({ acknowledged: true }).where(and(eq(systemAlerts.id, alertId), eq(systemAlerts.organizationId, orgId)));
}

export async function setAlertRuleEnabled(ruleId: string, enabled: boolean, orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  await db.update(alertRules).set({ enabled }).where(and(eq(alertRules.id, ruleId), eq(alertRules.organizationId, orgId)));
}

export async function recordEndpointHeartbeat(endpointId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(endpoints)
    .set({ lastSeenAt: new Date(), status: 'online' })
    .where(eq(endpoints.id, endpointId));
}

export async function getStaleEndpoints(thresholdMinutes = 15) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  return await db.select().from(endpoints).where(sql`lastSeenAt < ${cutoff} AND status = 'online'`);
}

export async function getEndpointMetadata(endpointId: string, orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const rows = await db.select({ metadata: endpointMetadata })
      .from(endpointMetadata)
      .innerJoin(endpoints, eq(endpointMetadata.endpointId, endpoints.id))
      .where(and(eq(endpointMetadata.endpointId, endpointId), eq(endpoints.organizationId, orgId)))
      .limit(1);
    return rows[0]?.metadata;
  } catch (error) {
    console.warn(`[Database] Endpoint metadata table unavailable for ${endpointId}:`, error);
    return undefined;
  }
}

export async function getLatestBatteryTelemetry(endpointId: string, orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const rows = await db.select({ battery: batteryTelemetry })
      .from(batteryTelemetry)
      .innerJoin(endpoints, eq(batteryTelemetry.endpointId, endpoints.id))
      .where(and(eq(batteryTelemetry.endpointId, endpointId), eq(endpoints.organizationId, orgId)))
      .orderBy(sql`capturedAt DESC`)
      .limit(1);
    return rows[0]?.battery;
  } catch (error) {
    console.warn(`[Database] Battery telemetry table unavailable for ${endpointId}:`, error);
    return undefined;
  }
}

export async function getLatestNetworkTelemetry(endpointId: string, orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select({ network: networkTelemetry })
      .from(networkTelemetry)
      .innerJoin(endpoints, eq(networkTelemetry.endpointId, endpoints.id))
      .where(and(eq(networkTelemetry.endpointId, endpointId), eq(endpoints.organizationId, orgId)))
      .orderBy(sql`capturedAt DESC`)
      .limit(10);
    return rows.map(row => row.network);
  } catch (error) {
    console.warn(`[Database] Network telemetry table unavailable for ${endpointId}:`, error);
    return [];
  }
}

export async function getApplicationUsage(endpointId: string, orgId = 'org-enterprise-01') {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select({ application: appUsageTelemetry })
      .from(appUsageTelemetry)
      .innerJoin(endpoints, eq(appUsageTelemetry.endpointId, endpoints.id))
      .where(and(eq(appUsageTelemetry.endpointId, endpointId), eq(endpoints.organizationId, orgId)))
      .orderBy(sql`lastUsedAt DESC`)
      .limit(100);
    return rows.map(row => row.application);
  } catch (error) {
    console.warn(`[Database] Application usage table unavailable for ${endpointId}:`, error);
    return [];
  }
}

export function resolveImmutableAssetId(existingAssetId?: string | null, _clientAssetId?: string | null) {
  return existingAssetId || `SP-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export async function recordEndpointMetadata(endpointId: string, values: Partial<typeof endpointMetadata.$inferInsert>, orgId = 'org-enterprise-01', actorOpenId = 'system') {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  return db.transaction(async tx => {
    const owned = await tx.select({ id: endpoints.id })
      .from(endpoints)
      .where(and(eq(endpoints.id, endpointId), eq(endpoints.organizationId, orgId)))
      .limit(1);
    if (!owned.length) throw new Error('Endpoint is outside the authenticated organization');
    const existingRows = await tx.select().from(endpointMetadata).where(eq(endpointMetadata.endpointId, endpointId)).limit(1);
    const existing = existingRows[0];
    const immutableAssetId = resolveImmutableAssetId(existing?.assetId, values.assetId);
    const { assetId: _ignoredClientAssetId, ...mutableValues } = values;
    await tx.insert(endpointMetadata).values({ endpointId, ...mutableValues, assetId: immutableAssetId }).onDuplicateKeyUpdate({ set: { ...mutableValues, assetId: immutableAssetId } });
    await tx.insert(endpointMetadataAudit).values({
      organizationId: orgId,
      endpointId,
      actorOpenId,
      action: existing ? 'metadata_updated' : 'metadata_created',
      changedFields: JSON.stringify(Object.keys(mutableValues).sort()),
    });
    return { endpointId, assetId: immutableAssetId };
  });
}
