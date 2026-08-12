export type EndpointStatus = 'online' | 'offline' | 'pending' | 'warning' | 'critical';
export type UserRole = 'admin' | 'viewer';
export type AlertLifecycle = 'firing' | 'resolved';

export interface StandardErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
}

export interface DashboardSummary {
  totalEndpoints: number;
  onlineEndpoints: number;
  offlineEndpoints: number;
  warningEndpoints: number;
  activeAlerts: number;
  diskCriticalCount: number;
}

export interface AlertRuleContract {
  id: string;
  organizationId: string;
  metric: 'disk_free_percent' | 'ram_usage_percent' | 'cpu_usage_percent' | 'endpoint_offline' | 'driver_status' | 'smart_health_status';
  condition: 'gt' | 'lt' | 'eq';
  threshold: number | null;
  durationMinutes: number;
  enabled: boolean;
}

export interface AlertContract {
  id: string;
  endpointId: string;
  alertRuleId: string;
  triggeredAt: string;
  resolvedAt: string | null;
  status: AlertLifecycle;
  details: Record<string, unknown>;
}

export interface ApiRequestEnvelope {
  endpoint_id: string;
  module: 'performance' | 'disks' | 'drivers' | 'software' | 'hardware' | 'os_health' | 'event_logs' | 'identity';
  captured_at: string;
  on_demand: boolean;
  request_id?: string;
  payload: Record<string, unknown>;
}

export type RealtimeEvent =
  | { type: 'endpoint_status_changed'; endpointId: string; status: EndpointStatus; lastSeenAt: string }
  | { type: 'new_alert'; alert: AlertContract }
  | { type: 'alert_resolved'; alertId: string; resolvedAt: string }
  | { type: 'metrics_updated'; endpointId: string; capturedAt: string }
  | { type: 'refresh_request'; modules: string[]; requestId: string };

export interface DiskInfo {
  id: string;
  driveLetter: string;
  filesystem: string;
  totalGb: number;
  freeGb: number;
  usedGb: number;
  smartHealth: 'Healthy' | 'Warning' | 'Failing';
}

export interface HardwareInfo {
  cpuModel: string;
  cpuCores: number;
  cpuLogicalProcessors: number;
  gpuModel: string;
  ramTotalMb: number;
  motherboardModel: string;
  biosVersion: string;
  serialNumber?: string;
}

export interface OsHealthInfo {
  osVersion: string;
  osBuild: string;
  dismStatus: 'Healthy' | 'Repairable' | 'Corrupt';
  sfcStatus: 'No Integrity Violations' | 'Corrupt Files Repaired' | 'Unresolved Issues';
  driverIssuesCount: number;
  reliabilityScore: number; // out of 10
}

export interface SoftwareApp {
  id: string;
  name: string;
  publisher: string;
  version: string;
  installedAt: string;
  sizeMb: number;
}

export interface ProcessMetric {
  pid: number;
  name: string;
  cpuPercent: number;
  ramMb: number;
  username: string;
}

export interface EventLogItem {
  id: string;
  timestamp: string;
  level: 'Information' | 'Warning' | 'Error' | 'Critical';
  provider: string;
  eventId: number;
  message: string;
}

export interface Endpoint {
  id: string;
  organizationId: string;
  hostname: string;
  serialNumber: string;
  ipAddress: string;
  macAddress: string;
  osVersion: string;
  osBuild: string;
  domainOrWorkgroup: string;
  agentVersion: string;
  status: EndpointStatus;
  lastSeenAt: string;
  createdAt: string;
  hardware: HardwareInfo;
  disks: DiskInfo[];
  osHealth: OsHealthInfo;
  software: SoftwareApp[];
  processes: ProcessMetric[];
  eventLogs: EventLogItem[];
  metricsHistory: {
    timestamp: string;
    cpu: number;
    ram: number;
    diskIO: number;
  }[];
}

export interface AlertRule {
  id: string;
  name: string;
  metric: 'cpu' | 'ram' | 'disk_free' | 'offline' | 'driver_error';
  condition: '>' | '<' | '=';
  thresholdValue: number;
  severity: 'warning' | 'critical';
  enabled: boolean;
  durationMinutes?: number;
}

export interface SystemAlert {
  id: string;
  endpointId: string;
  hostname: string;
  ruleName: string;
  severity: 'warning' | 'critical';
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
}

export interface EnrollmentToken {
  id: string;
  tokenHash: string;
  plainToken?: string;
  expiresAt: string;
  usedByEndpointId?: string | null;
  createdAt: string;
}
