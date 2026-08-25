import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './pages/DashboardOverview';
import EndpointsList from './pages/EndpointsList';
import EndpointDetail from './pages/EndpointDetail';
import AlertsCenter from './pages/AlertsCenter';
import EnrollmentTokens from './pages/EnrollmentTokens';
import DiagnosticEventsPage from './pages/DiagnosticEventsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import NotFound from './pages/NotFound';
import type { AuthSession, Endpoint, AlertRule, SystemAlert, EnrollmentToken, RealtimeEvent } from './types';
import { toast } from 'sonner';
import { SseRealtimeClient } from '@/lib/sseRealtime';
import { api } from '@/lib/api';

function createClientRowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Precision Enterprise Glass: persistent control shell, typed transport seams, and role-aware operator actions. */
export default function App() {
  const [location, navigate] = useLocation();
  const auth = useAuth({ redirectOnUnauthenticated: false, enabled: false });
  const endpointQuery = trpc.monitoring.endpoints.useQuery(undefined, { enabled: Boolean(auth.user), retry: false });
  const alertRulesQuery = trpc.monitoring.alertRules.useQuery(undefined, { enabled: Boolean(auth.user), retry: false });
  const systemAlertsQuery = trpc.monitoring.systemAlerts.useQuery(undefined, { enabled: Boolean(auth.user), retry: false });
  const tokenQuery = trpc.monitoring.enrollmentTokens.useQuery(undefined, { enabled: Boolean(auth.user), retry: false });
  const trpcUtils = trpc.useUtils();
  const acknowledgeMutation = trpc.monitoring.acknowledgeAlert.useMutation({
    onSuccess: () => { void trpcUtils.monitoring.systemAlerts.invalidate(); },
    onError: error => toast.error('Alert acknowledgement failed', { description: error.message }),
  });
  const setAlertRuleEnabledMutation = trpc.monitoring.setAlertRuleEnabled.useMutation({
    onSuccess: () => { void trpcUtils.monitoring.alertRules.invalidate(); },
    onError: error => toast.error('Alert rule update failed', { description: error.message }),
  });
  const [session, setSession] = useState<AuthSession | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [tokens, setTokens] = useState<EnrollmentToken[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (setupComplete !== null) return;
    let cancelled = false;
    fetch('/api/v1/auth/setup-status')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('setup status unavailable')))
      .then((data: { setup_complete?: boolean }) => {
        if (cancelled) return;
        const complete = Boolean(data.setup_complete);
        setSetupComplete(complete);
        if (complete) window.localStorage.setItem('sentinelpulse.setupComplete', 'true');
        else window.localStorage.removeItem('sentinelpulse.setupComplete');
      })
      .catch(() => {
        if (!cancelled) setSetupComplete(false);
      });
    return () => { cancelled = true; };
  }, [setupComplete]);

  useEffect(() => {
    if (!endpointQuery.data) return;
    setEndpoints(prev => endpointQuery.data.map(record => {
      const fallback = prev.find(endpoint => endpoint.id === record.id);
      const candidate = record as typeof record & Partial<Endpoint> & { extendedHardware?: Endpoint['hardware']; extendedDisks?: Endpoint['disks']; metadata?: Endpoint['metadata'] };
      const mappedStatus = record.status === 'pending' ? 'warning' : record.status === 'disabled' ? 'offline' : record.status;
      return {
        ...fallback,
        ...candidate,
        id: record.id,
        organizationId: record.organizationId,
        hostname: record.hostname,
        serialNumber: record.serialNumber,
        ipAddress: candidate.ipAddress ?? fallback?.ipAddress ?? '',
        macAddress: candidate.macAddress ?? fallback?.macAddress ?? '',
        osVersion: record.osVersion ?? fallback?.osVersion ?? 'Unknown',
        osBuild: record.osBuild ?? fallback?.osBuild ?? 'Unknown',
        domainOrWorkgroup: record.domainOrWorkgroup ?? fallback?.domainOrWorkgroup ?? 'Unknown',
        agentVersion: record.agentVersion ?? fallback?.agentVersion ?? 'Unknown',
        status: mappedStatus,
        lastSeenAt: new Date(record.lastSeenAt).toISOString(),
        createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : fallback?.createdAt ?? new Date().toISOString(),
        hardware: candidate.hardware ?? fallback?.hardware ?? { cpuModel: 'Unknown', cpuCores: 0, cpuLogicalProcessors: 0, gpuModel: 'Unknown', ramTotalMb: 0, motherboardModel: 'Unknown', biosVersion: 'Unknown' },
        disks: candidate.disks ?? fallback?.disks ?? [],
        osHealth: candidate.osHealth ?? fallback?.osHealth ?? { osVersion: record.osVersion ?? 'Unknown', osBuild: record.osBuild ?? 'Unknown', dismStatus: 'Healthy', sfcStatus: 'No Integrity Violations', driverIssuesCount: 0, reliabilityScore: 0 },
        software: candidate.software ?? fallback?.software ?? [],
        processes: candidate.processes ?? fallback?.processes ?? [],
        eventLogs: candidate.eventLogs ?? fallback?.eventLogs ?? [],
        metricsHistory: candidate.metricsHistory ?? fallback?.metricsHistory ?? [],
      };
    }));
  }, [endpointQuery.data]);

  useEffect(() => {
    if (!alertRulesQuery.data) return;
    setAlertRules(alertRulesQuery.data.map(record => ({
      id: record.id,
      name: record.name,
      metric: record.metric === 'cpu_usage_percent' ? 'cpu' : record.metric === 'ram_usage_percent' ? 'ram' : record.metric === 'disk_free_percent' ? 'disk_free' : 'offline',
      condition: record.condition === 'gt' ? '>' : record.condition === 'lt' ? '<' : '=',
      thresholdValue: Number(record.thresholdValue),
      severity: record.severity,
      enabled: record.enabled,
      durationMinutes: record.durationMinutes,
    })));
  }, [alertRulesQuery.data]);

  useEffect(() => {
    if (!systemAlertsQuery.data) return;
    setSystemAlerts(systemAlertsQuery.data.map(record => ({
      id: record.id,
      endpointId: record.endpointId,
      hostname: record.hostname,
      ruleName: record.ruleName,
      severity: record.severity,
      message: record.message,
      triggeredAt: new Date(record.triggeredAt).toISOString(),
      acknowledged: record.acknowledged,
    })));
  }, [systemAlertsQuery.data]);

  useEffect(() => {
    if (!tokenQuery.data) return;
    setTokens(tokenQuery.data.map(record => ({
      id: record.id,
      tokenHash: record.tokenHash,
      plainToken: record.plainToken ?? undefined,
      expiresAt: new Date(record.expiresAt).toISOString(),
      usedByEndpointId: record.usedByEndpointId,
      createdAt: new Date(record.createdAt).toISOString(),
    })));
  }, [tokenQuery.data]);

  const isAdmin = session?.user.role === 'admin';
  const criticalAlertsCount = systemAlerts.filter(a => !a.acknowledged && a.severity === 'critical').length;
  const activeAlertCount = systemAlerts.filter(a => !a.acknowledged).length;

  const signIn = (nextSession: AuthSession) => {
    setSession(nextSession);
    navigate('/');
  };

  const signOut = () => {
    void auth.logout();
    setSession(null);
    navigate('/login');
  };

  const handleSetupCompleted = () => {
    window.localStorage.setItem('sentinelpulse.setupComplete', 'true');
    setSetupComplete(true);
    navigate('/login');
  };

  const handleRealtimeEvent = (event: RealtimeEvent) => {
    if (event.type === 'endpoint_status_changed') {
      setEndpoints(prev => prev.map(endpoint => endpoint.id === event.endpointId ? { ...endpoint, status: event.status, lastSeenAt: event.lastSeenAt } : endpoint));
    }
    if (event.type === 'metrics_updated') toast.info(`Telemetry updated for ${event.endpointId}`);
    if (event.type === 'new_alert') toast.warning('New alert received from alerting engine');
    if (event.type === 'alert_resolved') toast.success('Alert resolved by processing worker');
  };

  useEffect(() => {
    // The local Docker stack serves the canonical Go REST API; it does not expose
    // the separate Node/tRPC realtime stream. Keep SSE disabled in this runtime
    // instead of repeatedly opening a known 404 endpoint.
    const localGoRuntime = import.meta.env.VITE_LOCAL_GO_API !== 'false';
    if (localGoRuntime || !session || typeof window === 'undefined') return;
    const client = new SseRealtimeClient({
      url: `${window.location.origin}/api/realtime/stream`,
      onEvent: handleRealtimeEvent,
      onStatus: status => {
        if (status === 'error') toast.error('Live telemetry connection unavailable', { description: 'The dashboard will continue using cached endpoint state.' });
      },
    });
    client.connect();
    return () => client.close();
  }, [session]);

  const handleAcknowledgeAlert = (alertId: string) => {
    if (!isAdmin) {
      toast.error('Viewer role is read-only', { description: 'Ask an admin to acknowledge system alerts.' });
      return;
    }
    void acknowledgeMutation.mutateAsync({ alertId });
  };

  const handleToggleRule = (ruleId: string) => {
    if (!isAdmin) {
      toast.error('Admin role required', { description: 'Only admins can change threshold rules.' });
      return;
    }
    const rule = alertRules.find(candidate => candidate.id === ruleId);
    if (!rule) return;
    void setAlertRuleEnabledMutation.mutateAsync({ ruleId, enabled: !rule.enabled });
  };

  const handleCreateToken = async () => {
    if (!isAdmin || !session) {
      toast.error('Admin role required', { description: 'Only admins can issue enrollment tokens.' });
      return;
    }
    try {
      const result = await api.createEnrollmentToken(session.accessToken);
      setTokens(prev => [{
        id: createClientRowId('token'),
        tokenHash: 'sha256-generated',
        plainToken: result.enrollment_token,
        expiresAt: result.expires_at,
        createdAt: new Date().toISOString(),
      }, ...prev]);
      toast.success('Enrollment token generated successfully', { description: 'Copy it now; the plaintext token is shown only once.' });
    } catch (error) {
      toast.error('Enrollment token generation failed', { description: error instanceof Error ? error.message : 'The backend rejected the request.' });
    }
  };

  const handleTriggerGlobalRefresh = async () => {
    if (!session || endpoints.length === 0) {
      toast.info('No enrolled endpoints are available for refresh.');
      return;
    }
    try {
      await Promise.all(endpoints.map(endpoint => api.requestEndpointRefresh(session.accessToken, endpoint.id, ['performance', 'hardware', 'os_health'])));
      toast.success('Refresh command queued for all enrolled endpoints.');
    } catch (error) {
      toast.error('Refresh request failed', { description: error instanceof Error ? error.message : 'The backend rejected the refresh command.' });
    }
  };
  const handleTriggerOnDemandRefresh = async (endpointId: string) => {
    if (!session) return;
    try {
      await api.requestEndpointRefresh(session.accessToken, endpointId, ['performance', 'hardware', 'os_health', 'event_logs']);
      toast.success('On-demand refresh command queued.');
    } catch (error) {
      toast.error('Refresh request failed', { description: error instanceof Error ? error.message : 'The backend rejected the refresh command.' });
    }
  };

  const exportFleet = () => {
    toast.info('Use CSV or PDF export from the authenticated report controls.');
  };

  const shell = useMemo(() => ({
    endpoints,
    alertRules,
    systemAlerts,
    tokens,
    isAdmin: Boolean(isAdmin),
    userRole: session?.user.role ?? 'viewer',
  }), [endpoints, alertRules, systemAlerts, tokens, isAdmin, session?.user.role]);

  if (setupComplete === null) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono text-sm">Checking platform setup...</div>;
  }

  if (!setupComplete) {
    return <SetupPage onSetupCompleted={handleSetupCompleted} />;
  }

  if (!session || location === '/login') {
    return <LoginPage onAuthenticated={signIn} />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-row overflow-hidden font-sans">
            <Sidebar endpointsCount={shell.endpoints.length} criticalAlertsCount={criticalAlertsCount} userRole={shell.userRole} onExportFleet={exportFleet} />
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
              <Header
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isLiveStreaming={isLiveStreaming}
                onToggleLiveStream={() => setIsLiveStreaming(!isLiveStreaming)}
                unreadAlertsCount={activeAlertCount}
                onTriggerGlobalRefresh={handleTriggerGlobalRefresh}
                user={session.user}
                onSignOut={signOut}
              />
              <div className="flex-1">
                <Switch>
                  <Route path="/"><DashboardOverview endpoints={shell.endpoints} alerts={shell.systemAlerts} onAcknowledgeAlert={handleAcknowledgeAlert} /></Route>
                  <Route path="/endpoints"><EndpointsList endpoints={shell.endpoints} searchQuery={searchQuery} onSearchChange={setSearchQuery} /></Route>
                  <Route path="/endpoints/:id"><EndpointDetail endpoints={shell.endpoints} onTriggerOnDemandRefresh={handleTriggerOnDemandRefresh} /></Route>
                  <Route path="/alerts"><AlertsCenter alertRules={shell.alertRules} systemAlerts={shell.systemAlerts} onToggleRule={handleToggleRule} onAcknowledgeAlert={handleAcknowledgeAlert} canWrite={shell.isAdmin} /></Route>
                  <Route path="/alert-rules" component={AlertRules} />
                  <Route path="/tokens"><EnrollmentTokens tokens={shell.tokens} onCreateToken={handleCreateToken} canWrite={shell.isAdmin} accessToken={session.accessToken} /></Route>
                  <Route path="/diagnostics"><DiagnosticEventsPage accessToken={session.accessToken} canWrite={shell.isAdmin} /></Route>
                  <Route path="/settings"><SettingsPage canWrite={shell.isAdmin} /></Route>
                  <Route component={NotFound} />
                </Switch>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

import AlertRules from './pages/AlertRules';
// inside routes:
// <Route path="/alert-rules" component={AlertRules} />
