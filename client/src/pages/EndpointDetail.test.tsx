/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Router } from 'wouter';
import { describe, expect, it, vi } from 'vitest';
import EndpointDetail from './EndpointDetail';
import { endpointLifecyclePresentation } from '../lib/endpointLifecyclePresentation';
import type { Endpoint } from '@/types';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub);

vi.mock('@/_core/hooks/useAuth', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ monitoring: { endpoints: { invalidate: vi.fn() } } }),
    monitoring: {
      departments: { useQuery: () => ({ data: [] }) },
      locations: { useQuery: () => ({ data: [] }) },
      updateEndpointMetadata: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

function endpointWithUnavailableEvidence(): Endpoint {
  return {
    id: 'endpoint-1', organizationId: 'org-1', hostname: 'DESKTOP-TEST', serialNumber: 'Unavailable',
    ipAddress: 'Unavailable', macAddress: 'Unavailable', osVersion: 'Unavailable', osBuild: 'Unavailable',
    domainOrWorkgroup: 'Unavailable', agentVersion: 'Unavailable', status: 'offline',
    statusReason: 'Authentication failed', statusChangedAt: '2026-08-25T08:10:00.000Z',
    lastSeenAt: 'Unavailable', createdAt: 'Unavailable',
    hardware: { cpuModel: 'Unavailable', gpuModel: 'Unavailable', motherboardModel: 'Unavailable', biosVersion: 'Unavailable' },
    disks: [], osHealth: { osVersion: 'Unavailable', osBuild: 'Unavailable', dismStatus: 'Unavailable', sfcStatus: 'Unavailable' },
    software: [], processes: [], eventLogs: [], metricsHistory: [],
  };
}

describe('Endpoint lifecycle presentation', () => {
  it.each([
    ['pending', 'PENDING EVIDENCE'],
    ['enrollment_failed', 'ENROLLMENT FAILED'],
    ['auth_error', 'AUTH ERROR'],
    ['disabled', 'DISABLED'],
  ] as const)('keeps %s explicit', (status, label) => {
    expect(endpointLifecyclePresentation(status)).toMatchObject({ label });
  });
});

describe('EndpointDetail unavailable evidence', () => {
  it('renders missing RAM, CPU, driver, and reliability evidence as unavailable', () => {
    render(
      <Router>
        <EndpointDetail endpoints={[endpointWithUnavailableEvidence()]} onTriggerOnDemandRefresh={vi.fn()} />
      </Router>,
    );

    fireEvent.click(screen.getByRole('tab', { name: /OS Health & Drivers/ }));
    const ramField = screen.getByText('Total RAM:').parentElement;
    const cpuField = screen.getByText('CPU Cores:').parentElement;
    const driverField = screen.getAllByText('Driver Issues')[0].parentElement;
    const reliabilityField = screen.getAllByText('Reliability Score')[0].parentElement;
    expect(ramField?.textContent).toContain('Unavailable');
    expect(cpuField?.textContent).toContain('Cores unavailable');
    expect(cpuField?.textContent).toContain('Threads unavailable');
    expect(driverField?.textContent).toContain('Unavailable');
    expect(reliabilityField?.textContent).toContain('Unavailable');
    expect(ramField?.textContent).not.toContain('0 GB');
    expect(driverField?.textContent).not.toContain('0 Detected');
    expect(screen.queryByText('SMART:')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Software Inventory (0)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Active Processes (0)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Event Viewer Logs (0)' })).toBeTruthy();
  });

  it('renders explicit lifecycle reason and transition timestamp', () => {
    render(
      <Router>
        <EndpointDetail endpoints={[endpointWithUnavailableEvidence()]} onTriggerOnDemandRefresh={vi.fn()} />
      </Router>,
    );

    expect(screen.getAllByText(/Lifecycle evidence:/).some(element => element.textContent?.includes('Authentication failed'))).toBe(true);
  });
});
