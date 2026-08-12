export type EndpointStatus = 'online' | 'offline' | 'pending' | 'warning' | 'critical';

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
