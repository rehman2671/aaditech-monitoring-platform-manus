import { Endpoint, AlertRule, SystemAlert, EnrollmentToken } from './types';

export const initialEndpoints: Endpoint[] = [
  {
    id: 'ep-001-uuid',
    organizationId: 'org-enterprise-01',
    hostname: 'WS-CORP-EXEC01',
    serialNumber: 'SN-9982-XCV7',
    ipAddress: '10.104.12.45',
    macAddress: '68:05:CA:8B:12:90',
    osVersion: 'Windows 11 Enterprise',
    osBuild: '22631.3527',
    domainOrWorkgroup: 'CORP.INTERNAL',
    agentVersion: '2.4.1-lts',
    status: 'online',
    lastSeenAt: new Date(Date.now() - 15000).toISOString(),
    createdAt: '2025-11-10T08:30:00Z',
    hardware: {
      cpuModel: 'Intel(R) Core(TM) i7-13700H',
      cpuCores: 14,
      cpuLogicalProcessors: 20,
      gpuModel: 'NVIDIA GeForce RTX 4065 Laptop GPU',
      ramTotalMb: 32768,
      motherboardModel: 'Dell Inc. 0M6C7Y A00',
      biosVersion: 'Dell BIOS v1.14.2',
    },
    disks: [
      { id: 'd-1', driveLetter: 'C:', filesystem: 'NTFS', totalGb: 953, freeGb: 412, usedGb: 541, smartHealth: 'Healthy' },
      { id: 'd-2', driveLetter: 'D:', filesystem: 'NTFS', totalGb: 1907, freeGb: 1250, usedGb: 657, smartHealth: 'Healthy' }
    ],
    osHealth: {
      osVersion: 'Windows 11 Enterprise',
      osBuild: '22631.3527',
      dismStatus: 'Healthy',
      sfcStatus: 'No Integrity Violations',
      driverIssuesCount: 0,
      reliabilityScore: 9.8,
    },
    software: [
      { id: 'sw-1', name: 'Microsoft 365 Apps for enterprise', publisher: 'Microsoft Corporation', version: '16.0.17328.20184', installedAt: '2025-11-12', sizeMb: 3420 },
      { id: 'sw-2', name: 'Visual Studio Code', publisher: 'Microsoft Corporation', version: '1.89.0', installedAt: '2025-11-15', sizeMb: 450 },
      { id: 'sw-3', name: 'Docker Desktop', publisher: 'Docker Inc.', version: '4.29.0', installedAt: '2025-12-01', sizeMb: 1800 },
      { id: 'sw-4', name: 'Google Chrome', publisher: 'Google LLC', version: '124.0.6367.91', installedAt: '2025-11-11', sizeMb: 320 }
    ],
    processes: [
      { pid: 4820, name: 'code.exe', cpuPercent: 12.4, ramMb: 1420, username: 'CORP\\jdoe' },
      { pid: 3192, name: 'chrome.exe', cpuPercent: 8.1, ramMb: 2150, username: 'CORP\\jdoe' },
      { pid: 1402, name: 'ms-teams.exe', cpuPercent: 2.3, ramMb: 850, username: 'CORP\\jdoe' },
      { pid: 820, name: 'explorer.exe', cpuPercent: 1.1, ramMb: 310, username: 'CORP\\jdoe' },
      { pid: 512, name: 'SentinelAgent.exe', cpuPercent: 0.8, ramMb: 75, username: 'NT AUTHORITY\\SYSTEM' }
    ],
    eventLogs: [
      { id: 'ev-1', timestamp: new Date(Date.now() - 3600000).toISOString(), level: 'Information', provider: 'Microsoft-Windows-W32Time', eventId: 35, message: 'The time service has synchronized the system time with time source time.windows.com.' },
      { id: 'ev-2', timestamp: new Date(Date.now() - 7200000).toISOString(), level: 'Warning', provider: 'Disk', eventId: 51, message: 'An error was detected on device \\Device\\Harddisk0\\DR0 during a paging operation.' }
    ],
    metricsHistory: [
      { timestamp: '10:00', cpu: 22, ram: 58, diskIO: 4.2 },
      { timestamp: '10:10', cpu: 34, ram: 60, diskIO: 12.1 },
      { timestamp: '10:20', cpu: 18, ram: 59, diskIO: 2.3 },
      { timestamp: '10:30', cpu: 45, ram: 63, diskIO: 18.5 },
      { timestamp: '10:40', cpu: 28, ram: 61, diskIO: 5.6 },
      { timestamp: '10:50', cpu: 31, ram: 62, diskIO: 6.8 },
    ]
  },
  {
    id: 'ep-002-uuid',
    organizationId: 'org-enterprise-01',
    hostname: 'WS-CORP-SQL04',
    serialNumber: 'SN-4412-BB29',
    ipAddress: '10.104.12.88',
    macAddress: '00:15:5D:01:23:45',
    osVersion: 'Windows Server 2022 Datacenter',
    osBuild: '20348.2402',
    domainOrWorkgroup: 'CORP.INTERNAL',
    agentVersion: '2.4.1-lts',
    status: 'warning',
    lastSeenAt: new Date(Date.now() - 5000).toISOString(),
    createdAt: '2025-09-01T10:00:00Z',
    hardware: {
      cpuModel: 'AMD EPYC 7763 64-Core Processor',
      cpuCores: 32,
      cpuLogicalProcessors: 64,
      gpuModel: 'Microsoft Basic Display Adapter',
      ramTotalMb: 131072,
      motherboardModel: 'HPE ProLiant DL385 Gen10 Plus',
      biosVersion: 'HPE A41 v2.40',
    },
    disks: [
      { id: 'd-3', driveLetter: 'C:', filesystem: 'NTFS', totalGb: 500, freeGb: 32, usedGb: 468, smartHealth: 'Healthy' },
      { id: 'd-4', driveLetter: 'E:', filesystem: 'NTFS', totalGb: 4096, freeGb: 820, usedGb: 3276, smartHealth: 'Warning' }
    ],
    osHealth: {
      osVersion: 'Windows Server 2022 Datacenter',
      osBuild: '20348.2402',
      dismStatus: 'Healthy',
      sfcStatus: 'No Integrity Violations',
      driverIssuesCount: 1,
      reliabilityScore: 8.2,
    },
    software: [
      { id: 'sw-5', name: 'Microsoft SQL Server 2022 Enterprise', publisher: 'Microsoft Corporation', version: '16.0.1000.6', installedAt: '2025-09-05', sizeMb: 8500 },
      { id: 'sw-6', name: 'SQL Server Management Studio', publisher: 'Microsoft Corporation', version: '19.1', installedAt: '2025-09-05', sizeMb: 1200 }
    ],
    processes: [
      { pid: 1420, name: 'sqlservr.exe', cpuPercent: 68.4, ramMb: 64200, username: 'NT AUTHORITY\\SYSTEM' },
      { pid: 412, name: 'sqlwriter.exe', cpuPercent: 0.2, ramMb: 42, username: 'NT AUTHORITY\\SYSTEM' },
      { pid: 902, name: 'SentinelAgent.exe', cpuPercent: 0.5, ramMb: 88, username: 'NT AUTHORITY\\SYSTEM' }
    ],
    eventLogs: [
      { id: 'ev-3', timestamp: new Date(Date.now() - 1800000).toISOString(), level: 'Warning', provider: 'Perflib', eventId: 1008, message: 'The Open Procedure for service "Lsa" in DLL "C:\\Windows\\System32\\secur32.dll" failed. Performance data for this service will not be available.' },
      { id: 'ev-4', timestamp: new Date(Date.now() - 5400000).toISOString(), level: 'Error', provider: 'SQLSERVERAGENT', eventId: 208, message: 'SQL Server Scheduled Job \'Nightly Backup\' (0x5A8E...) - Status: Failed.' }
    ],
    metricsHistory: [
      { timestamp: '10:00', cpu: 74, ram: 88, diskIO: 64.2 },
      { timestamp: '10:10', cpu: 82, ram: 89, diskIO: 82.5 },
      { timestamp: '10:20', cpu: 65, ram: 88, diskIO: 45.1 },
      { timestamp: '10:30', cpu: 91, ram: 92, diskIO: 110.4 },
      { timestamp: '10:40', cpu: 78, ram: 90, diskIO: 58.2 },
      { timestamp: '10:50', cpu: 72, ram: 89, diskIO: 51.0 },
    ]
  },
  {
    id: 'ep-003-uuid',
    organizationId: 'org-enterprise-01',
    hostname: 'WS-CORP-DEV09',
    serialNumber: 'SN-7721-QQ12',
    ipAddress: '10.104.14.102',
    macAddress: '1C:69:7A:4F:88:10',
    osVersion: 'Windows 11 Pro',
    osBuild: '22631.3447',
    domainOrWorkgroup: 'CORP.INTERNAL',
    agentVersion: '2.4.0',
    status: 'online',
    lastSeenAt: new Date(Date.now() - 8000).toISOString(),
    createdAt: '2025-10-12T14:20:00Z',
    hardware: {
      cpuModel: 'Intel(R) Core(TM) i9-14900K',
      cpuCores: 24,
      cpuLogicalProcessors: 32,
      gpuModel: 'NVIDIA GeForce RTX 4090',
      ramTotalMb: 65536,
      motherboardModel: 'ASUSTeK COMPUTER INC. ROG STRIX Z790-E',
      biosVersion: 'American Megatrends Inc. 1602',
    },
    disks: [
      { id: 'd-5', driveLetter: 'C:', filesystem: 'NTFS', totalGb: 1907, freeGb: 840, usedGb: 1067, smartHealth: 'Healthy' }
    ],
    osHealth: {
      osVersion: 'Windows 11 Pro',
      osBuild: '22631.3447',
      dismStatus: 'Healthy',
      sfcStatus: 'No Integrity Violations',
      driverIssuesCount: 0,
      reliabilityScore: 9.5,
    },
    software: [
      { id: 'sw-7', name: 'JetBrains Rider 2024.1', publisher: 'JetBrains s.r.o.', version: '2024.1', installedAt: '2025-10-15', sizeMb: 2100 },
      { id: 'sw-8', name: 'Node.js LTS', publisher: 'Node.js Foundation', version: '20.12.0', installedAt: '2025-10-12', sizeMb: 110 }
    ],
    processes: [
      { pid: 5120, name: 'rider64.exe', cpuPercent: 18.2, ramMb: 3400, username: 'CORP\\mchen' },
      { pid: 6102, name: 'node.exe', cpuPercent: 5.4, ramMb: 680, username: 'CORP\\mchen' }
    ],
    eventLogs: [
      { id: 'ev-5', timestamp: new Date(Date.now() - 10000000).toISOString(), level: 'Information', provider: 'Kernel-General', eventId: 12, message: 'The operating system is starting at system time ‎2025‎-‎10‎-‎12T...' }
    ],
    metricsHistory: [
      { timestamp: '10:00', cpu: 15, ram: 42, diskIO: 2.1 },
      { timestamp: '10:10', cpu: 25, ram: 44, diskIO: 5.3 },
      { timestamp: '10:20', cpu: 19, ram: 43, diskIO: 3.1 },
      { timestamp: '10:30', cpu: 32, ram: 45, diskIO: 8.9 },
      { timestamp: '10:40', cpu: 21, ram: 43, diskIO: 4.0 },
      { timestamp: '10:50', cpu: 22, ram: 43, diskIO: 3.5 },
    ]
  },
  {
    id: 'ep-004-uuid',
    organizationId: 'org-enterprise-01',
    hostname: 'WS-CORP-FIN12',
    serialNumber: 'SN-1182-AA99',
    ipAddress: '10.104.18.210',
    macAddress: '74:83:53:22:11:44',
    osVersion: 'Windows 11 Enterprise',
    osBuild: '22621.2506',
    domainOrWorkgroup: 'CORP.INTERNAL',
    agentVersion: '2.3.8',
    status: 'offline',
    lastSeenAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    createdAt: '2025-08-15T09:00:00Z',
    hardware: {
      cpuModel: 'Intel(R) Core(TM) i5-1235U',
      cpuCores: 10,
      cpuLogicalProcessors: 12,
      gpuModel: 'Intel(R) Iris(R) Xe Graphics',
      ramTotalMb: 16384,
      motherboardModel: 'Lenovo 21CB001RUS',
      biosVersion: 'Lenovo N3ET42W (1.26)',
    },
    disks: [
      { id: 'd-6', driveLetter: 'C:', filesystem: 'NTFS', totalGb: 475, freeGb: 12, usedGb: 463, smartHealth: 'Healthy' }
    ],
    osHealth: {
      osVersion: 'Windows 11 Enterprise',
      osBuild: '22621.2506',
      dismStatus: 'Healthy',
      sfcStatus: 'No Integrity Violations',
      driverIssuesCount: 0,
      reliabilityScore: 7.1,
    },
    software: [
      { id: 'sw-9', name: 'Microsoft Excel 365', publisher: 'Microsoft Corporation', version: '16.0.17328', installedAt: '2025-08-16', sizeMb: 1500 }
    ],
    processes: [],
    eventLogs: [],
    metricsHistory: [
      { timestamp: '10:00', cpu: 0, ram: 0, diskIO: 0 },
    ]
  },
  {
    id: 'ep-005-uuid',
    organizationId: 'org-enterprise-01',
    hostname: 'WS-CORP-DC01',
    serialNumber: 'SN-5520-DC01',
    ipAddress: '10.104.1.10',
    macAddress: '00:0C:29:4F:EE:81',
    osVersion: 'Windows Server 2022 Datacenter',
    osBuild: '20348.2227',
    domainOrWorkgroup: 'CORP.INTERNAL',
    agentVersion: '2.4.1-lts',
    status: 'online',
    lastSeenAt: new Date(Date.now() - 12000).toISOString(),
    createdAt: '2025-07-01T00:00:00Z',
    hardware: {
      cpuModel: 'Intel(R) Xeon(R) Gold 6330 CPU @ 2.00GHz',
      cpuCores: 28,
      cpuLogicalProcessors: 56,
      gpuModel: 'Microsoft Basic Display Adapter',
      ramTotalMb: 65536,
      motherboardModel: 'VMware Virtual Platform',
      biosVersion: 'VMware, Inc. VMW21.71R.20842881.0',
    },
    disks: [
      { id: 'd-7', driveLetter: 'C:', filesystem: 'NTFS', totalGb: 200, freeGb: 95, usedGb: 105, smartHealth: 'Healthy' },
      { id: 'd-8', driveLetter: 'SYSVOL', filesystem: 'NTFS', totalGb: 50, freeGb: 38, usedGb: 12, smartHealth: 'Healthy' }
    ],
    osHealth: {
      osVersion: 'Windows Server 2022 Datacenter',
      osBuild: '20348.2227',
      dismStatus: 'Healthy',
      sfcStatus: 'No Integrity Violations',
      driverIssuesCount: 0,
      reliabilityScore: 10.0,
    },
    software: [
      { id: 'sw-10', name: 'Active Directory Domain Services', publisher: 'Microsoft Corporation', version: '10.0.20348', installedAt: '2025-07-01', sizeMb: 450 }
    ],
    processes: [
      { pid: 624, name: 'lsass.exe', cpuPercent: 1.5, ramMb: 340, username: 'NT AUTHORITY\\SYSTEM' },
      { pid: 580, name: 'ntdsatq.exe', cpuPercent: 2.1, ramMb: 1200, username: 'NT AUTHORITY\\SYSTEM' }
    ],
    eventLogs: [
      { id: 'ev-6', timestamp: new Date(Date.now() - 4000000).toISOString(), level: 'Information', provider: 'NTDS General', eventId: 1105, message: 'The Active Directory Database has successfully completed a background consistency check.' }
    ],
    metricsHistory: [
      { timestamp: '10:00', cpu: 12, ram: 65, diskIO: 1.5 },
      { timestamp: '10:10', cpu: 14, ram: 65, diskIO: 2.1 },
      { timestamp: '10:20', cpu: 11, ram: 66, diskIO: 1.2 },
      { timestamp: '10:30', cpu: 19, ram: 68, diskIO: 4.5 },
      { timestamp: '10:40', cpu: 13, ram: 66, diskIO: 1.8 },
      { timestamp: '10:50', cpu: 12, ram: 66, diskIO: 1.4 },
    ]
  }
];

export const initialAlertRules: AlertRule[] = [
  { id: 'rule-1', name: 'CPU Utilization Sustained High', metric: 'cpu', condition: '>', thresholdValue: 95, severity: 'warning', enabled: true, durationMinutes: 15 },
  { id: 'rule-2', name: 'RAM Usage Critical Threshold', metric: 'ram', condition: '>', thresholdValue: 90, severity: 'critical', enabled: true, durationMinutes: 15 },
  { id: 'rule-3', name: 'Disk Space Low (< 10% Free)', metric: 'disk_free', condition: '<', thresholdValue: 10, severity: 'critical', enabled: true, durationMinutes: 0 },
  { id: 'rule-4', name: 'Endpoint Offline Heartbeat Loss', metric: 'offline', condition: '>', thresholdValue: 5, severity: 'warning', enabled: true, durationMinutes: 5 },
  { id: 'rule-5', name: 'Driver or Hardware Error Detected', metric: 'driver_error', condition: '>', thresholdValue: 0, severity: 'warning', enabled: true, durationMinutes: 0 }
];

export const initialSystemAlerts: SystemAlert[] = [
  {
    id: 'alt-101',
    endpointId: 'ep-002-uuid',
    hostname: 'WS-CORP-SQL04',
    ruleName: 'Disk Space Low (< 15% Free)',
    severity: 'critical',
    message: 'Drive E: on WS-CORP-SQL04 has only 820 GB free out of 4096 GB (20%), and storage growth rate indicates threshold breach within 48h.',
    triggeredAt: new Date(Date.now() - 1200000).toISOString(),
    acknowledged: false
  },
  {
    id: 'alt-102',
    endpointId: 'ep-004-uuid',
    hostname: 'WS-CORP-FIN12',
    ruleName: 'Endpoint Offline Heartbeat Loss',
    severity: 'warning',
    message: 'Endpoint WS-CORP-FIN12 has missed 4 consecutive heartbeat cycles (last seen 2 days ago).',
    triggeredAt: new Date(Date.now() - 172800000).toISOString(),
    acknowledged: true
  },
  {
    id: 'alt-103',
    endpointId: 'ep-002-uuid',
    hostname: 'WS-CORP-SQL04',
    ruleName: 'CPU Utilization Sustained High',
    severity: 'warning',
    message: 'SQL Server process (sqlservr.exe) sustained > 75% CPU utilization over a 30-minute window.',
    triggeredAt: new Date(Date.now() - 3600000).toISOString(),
    acknowledged: false
  }
];

export const initialEnrollmentTokens: EnrollmentToken[] = [
  {
    id: 'tok-901a-uuid',
    tokenHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    plainToken: 'sp_enrol_99f81a7b6c2d4e8f9a0b1c2d3e4f5a6b',
    expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(), // 14 days
    usedByEndpointId: null,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'tok-902b-uuid',
    tokenHash: 'sha256:8f4343466482bb9811fbf4c8996fb92427ae41e4649b934ca495991b7852b123',
    plainToken: 'sp_enrol_44e22b1c9a8f7e6d5c4b3a2f1e0d9c8b',
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    usedByEndpointId: 'ep-001-uuid',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString()
  }
];
