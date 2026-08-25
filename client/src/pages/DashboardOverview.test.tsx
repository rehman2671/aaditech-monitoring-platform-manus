/** @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Router } from 'wouter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardOverview, { buildFleetTrendData } from './DashboardOverview';
import type { Endpoint } from '@/types';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub);

afterEach(() => {
  document.body.innerHTML = '';
});

function endpoint(overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    id: 'endpoint-1',
    organizationId: 'org-1',
    hostname: 'DESKTOP-TEST',
    serialNumber: 'SERIAL-1',
    ipAddress: '127.0.0.1',
    macAddress: '00:00:00:00:00:00',
    osVersion: 'Windows 11',
    osBuild: '26200',
    domainOrWorkgroup: 'WORKGROUP',
    agentVersion: '2.4.16.0',
    status: 'online',
    lastSeenAt: '2026-08-25T08:05:00.000Z',
    createdAt: '2026-08-25T08:00:00.000Z',
    hardware: { cpuModel: 'CPU', cpuCores: 4, cpuLogicalProcessors: 8, gpuModel: 'GPU', ramTotalMb: 32768, motherboardModel: 'Board', biosVersion: '1' },
    disks: [],
    osHealth: { osVersion: 'Windows 11', osBuild: '26200', dismStatus: 'Healthy', sfcStatus: 'No Integrity Violations', driverIssuesCount: 0, reliabilityScore: 8 },
    software: [],
    processes: [],
    eventLogs: [],
    metricsHistory: [],
    ...overrides,
  };
}

describe('DashboardOverview evidence labels', () => {
  it('shows an explicit limitation and timestamp when evidence is partial', () => {
    render(
      <Router>
        <DashboardOverview
          endpoints={[endpoint({ collectorEvidence: [{ collector: 'drivers', status: 'partial', capturedAt: '2026-08-25T08:05:00.000Z' }] })]}
          alerts={[]}
          onAcknowledgeAlert={vi.fn()}
        />
      </Router>,
    );

    expect(screen.getByText('DIAGNOSTIC LIMITATIONS PRESENT')).toBeTruthy();
    expect(screen.getByText(`Latest evidence: ${new Date('2026-08-25T08:05:00.000Z').toLocaleString()}`)).toBeTruthy();
    expect(screen.getByText(/1 collector evidence records/)).toBeTruthy();
  });

  it('shows observed status for successful explicit evidence', () => {
    render(
      <Router>
        <DashboardOverview
          endpoints={[endpoint({ collectorEvidence: [{ collector: 'performance', status: 'success', capturedAt: '2026-08-25T08:05:00.000Z' }] })]}
          alerts={[]}
          onAcknowledgeAlert={vi.fn()}
        />
      </Router>,
    );

    expect(screen.getByText('TELEMETRY STATUS OBSERVED')).toBeTruthy();
    expect(screen.queryByText('COLLECTOR EVIDENCE NOT SUPPLIED')).toBeNull();
  });

  it('computes fleet CPU and RAM averages per real timestamp bucket', () => {
    const result = buildFleetTrendData([
      endpoint({ metricsHistory: [{ timestamp: '2026-08-25T08:00:00.000Z', cpu: 20, ram: 40, diskIO: 0 }] }),
      endpoint({ id: 'endpoint-2', metricsHistory: [{ timestamp: '2026-08-25T08:00:00.000Z', cpu: 40, ram: 60, diskIO: 0 }] }),
    ]);
    expect(result).toEqual([{ time: '2026-08-25T08:00:00.000Z', cpuAvg: 30, ramAvg: 50 }]);
  });

  it('shows a no-evidence state when no performance samples exist', () => {
    render(
      <Router>
        <DashboardOverview endpoints={[endpoint()]} alerts={[]} onAcknowledgeAlert={vi.fn()} />
      </Router>,
    );
    expect(screen.getByText('No performance telemetry evidence received.')).toBeTruthy();
  });

  it('does not claim nominal collectors when no evidence is supplied', () => {
    render(
      <Router>
        <DashboardOverview endpoints={[endpoint()]} alerts={[]} onAcknowledgeAlert={vi.fn()} />
      </Router>,
    );

    expect(screen.getByText('COLLECTOR EVIDENCE NOT SUPPLIED')).toBeTruthy();
    expect(screen.getByText(/Latest evidence: No timestamp supplied/)).toBeTruthy();
    expect(screen.queryByText('ALL WMI COLLECTORS NOMINAL')).toBeNull();
  });
});
