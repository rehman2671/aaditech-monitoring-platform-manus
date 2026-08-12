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
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import NotFound from './pages/NotFound';
import { initialEndpoints, initialAlertRules, initialSystemAlerts, initialEnrollmentTokens } from './mockData';
import type { AuthSession, Endpoint, AlertRule, SystemAlert, EnrollmentToken, RealtimeEvent } from './types';
import { toast } from 'sonner';
import { SseRealtimeClient } from '@/lib/sseRealtime';

/** Precision Enterprise Glass: persistent control shell, typed transport seams, and role-aware operator actions. */
const previewSession: AuthSession = {
  accessToken: 'preview-session-token',
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  user: { id: 'preview-admin', email: 'ops.admin@enterprise.local', role: 'admin', organizationId: 'org-enterprise-01' },
};
export default function App() {
  const [location, navigate] = useLocation();
  const auth = useAuth({ redirectOnUnauthenticated: false });
  const endpointQuery = trpc.monitoring.endpoints.useQuery(undefined, { enabled: Boolean(auth.user), retry: false });
  const alertRulesQuery = trpc.monitoring.alertRules.useQuery(undefined, { enabled: Boolean(auth.user), retry: false });
  const systemAlertsQuery = trpc.monitoring.systemAlerts.useQuery(undefined, { enabled: Boolean(auth.user), retry: false });
  const tokenQuery = trpc.monitoring.enrollmentTokens.useQuery(undefined, { enabled: Boolean(auth.user), retry: false });
  const acknowledgeMutation = trpc.monitoring.acknowledgeAlert.useMutation();
  const generateTokenMutation = trpc.monitoring.generateToken.useMutation();
  const [session, setSession] = useState<AuthSession | null>(() => {
    const stored = sessionStorage.getItem('sentinelpulse.session');
    return stored ? JSON.parse(stored) as AuthSession : previewSession;
  });
  const [endpoints, setEndpoints] = useState<Endpoint[]>(initialEndpoints);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(initialAlertRules);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>(initialSystemAlerts);
  const [tokens, setTokens] = useState<EnrollmentToken[]>(initialEnrollmentTokens);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

  useEffect(() => {
    if (!auth.user) return;
    const nextSession: AuthSession = {
      accessToken: 'oauth-session',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      user: {
        id: String(auth.user.id),
        email: auth.user.email ?? 'operator@enterprise.local',
        role: auth.user.role === 'admin' ? 'admin' : 'viewer',
        organizationId: 'org-enterprise-01',
      },
    };
    setSession(nextSession);
  }, [auth.user]);

  useEffect(() => {
    if (!endpointQuery.data?.length) return;
    setEndpoints(prev => endpointQuery.data.map(record => {
      const fallback = prev.find(endpoint => endpoint.id === record.id) ?? prev[0];
      const mappedStatus = record.status === 'pending' ? 'warning' : record.status === 'disabled' ? 'offline' : record.status;
      return {
        ...fallback,
        id: record.id,
        organizationId: record.organizationId,
        hostname: record.hostname,
        serialNumber: record.serialNumber,
        osVersion: record.osVersion ?? fallback.osVersion,
        osBuild: record.osBuild ?? fallback.osBuild,
        domainOrWorkgroup: record.domainOrWorkgroup ?? fallback.domainOrWorkgroup,
        agentVersion: record.agentVersion ?? fallback.agentVersion,
        status: mappedStatus,
        lastSeenAt: new Date(record.lastSeenAt).toISOString(),
      };
    }));
  }, [endpointQuery.data]);

  useEffect(() => {
    if (!alertRulesQuery.data?.length) return;
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
    if (!systemAlertsQuery.data?.length) return;
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
    if (!tokenQuery.data?.length) return;
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
    sessionStorage.setItem('sentinelpulse.session', JSON.stringify(nextSession));
    navigate('/');
  };

  const signOut = () => {
    setSession(null);
    sessionStorage.removeItem('sentinelpulse.session');
    navigate('/login');
  };

  useEffect(() => {
    if (!isLiveStreaming || !session) return;
    const interval = setInterval(() => {
      setEndpoints(prev => prev.map(ep => {
        if (ep.status === 'offline') return ep;
        const randomCpu = Math.floor(Math.random() * 35) + 15;
        const randomRam = Math.floor(Math.random() * 5) + 55;
        const newTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const updatedHistory = [...ep.metricsHistory.slice(1), { timestamp: newTime, cpu: randomCpu, ram: randomRam, diskIO: Math.floor(Math.random() * 20) }];
        return { ...ep, metricsHistory: updatedHistory, lastSeenAt: new Date().toISOString() };
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, [isLiveStreaming, session]);

  const handleRealtimeEvent = (event: RealtimeEvent) => {
    if (event.type === 'endpoint_status_changed') {
      setEndpoints(prev => prev.map(endpoint => endpoint.id === event.endpointId ? { ...endpoint, status: event.status, lastSeenAt: event.lastSeenAt } : endpoint));
    }
    if (event.type === 'metrics_updated') toast.info(`Telemetry updated for ${event.endpointId}`);
    if (event.type === 'new_alert') toast.warning('New alert received from alerting engine');
    if (event.type === 'alert_resolved') toast.success('Alert resolved by processing worker');
  };

  useEffect(() => {
    if (!session || typeof window === 'undefined') return;
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
    if (auth.user) void acknowledgeMutation.mutateAsync({ alertId });
    setSystemAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
  };

  const handleToggleRule = (ruleId: string) => {
    if (!isAdmin) {
      toast.error('Admin role required', { description: 'Only admins can change threshold rules.' });
      return;
    }
    setAlertRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  const handleCreateToken = () => {
    if (!isAdmin) {
      toast.error('Admin role required', { description: 'Only admins can issue enrollment tokens.' });
      return;
    }
    const newToken: EnrollmentToken = {
      id: `tok-${Math.random().toString(36).substring(2, 6)}-uuid`,
      tokenHash: `sha256:${Math.random().toString(36).substring(2)}`,
      plainToken: `sp_enrol_${crypto.randomUUID().replaceAll('-', '')}`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      usedByEndpointId: null,
      createdAt: new Date().toISOString()
    };
    if (auth.user) void generateTokenMutation.mutateAsync();
    setTokens(prev => [newToken, ...prev]);
  };

  const handleTriggerGlobalRefresh = () => toast.info('Refresh request broadcast to all online agents');
  const handleTriggerOnDemandRefresh = (endpointId: string) => setEndpoints(prev => prev.map(ep => ep.id === endpointId ? { ...ep, lastSeenAt: new Date().toISOString() } : ep));

  const exportFleet = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), organizationId: session?.user.organizationId, endpoints }, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `sentinelpulse-endpoints-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
    toast.success('Fleet export downloaded', { description: 'This mirrors GET /api/v1/export/endpoints.' });
  };

  const shell = useMemo(() => ({
    endpoints,
    alertRules,
    systemAlerts,
    tokens,
    isAdmin: Boolean(isAdmin),
    userRole: session?.user.role ?? 'viewer',
  }), [endpoints, alertRules, systemAlerts, tokens, isAdmin, session?.user.role]);

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
                realtimeEventHandler={handleRealtimeEvent}
              />
              <div className="flex-1">
                <Switch>
                  <Route path="/"><DashboardOverview endpoints={shell.endpoints} alerts={shell.systemAlerts} onAcknowledgeAlert={handleAcknowledgeAlert} /></Route>
                  <Route path="/endpoints"><EndpointsList endpoints={shell.endpoints} searchQuery={searchQuery} onSearchChange={setSearchQuery} /></Route>
                  <Route path="/endpoints/:id"><EndpointDetail endpoints={shell.endpoints} onTriggerOnDemandRefresh={handleTriggerOnDemandRefresh} /></Route>
                  <Route path="/alerts"><AlertsCenter alertRules={shell.alertRules} systemAlerts={shell.systemAlerts} onToggleRule={handleToggleRule} onAcknowledgeAlert={handleAcknowledgeAlert} canWrite={shell.isAdmin} /></Route>
                  <Route path="/tokens"><EnrollmentTokens tokens={shell.tokens} onCreateToken={handleCreateToken} canWrite={shell.isAdmin} /></Route>
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
