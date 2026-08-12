import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
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
import NotFound from './pages/NotFound';

import { initialEndpoints, initialAlertRules, initialSystemAlerts, initialEnrollmentTokens } from './mockData';
import { Endpoint, AlertRule, SystemAlert, EnrollmentToken } from './types';
import { toast } from 'sonner';

export default function App() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>(initialEndpoints);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(initialAlertRules);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>(initialSystemAlerts);
  const [tokens, setTokens] = useState<EnrollmentToken[]>(initialEnrollmentTokens);

  const [searchQuery, setSearchQuery] = useState('');
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

  // Simulate live WebSocket telemetry updates if live streaming is active
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      setEndpoints(prev => prev.map(ep => {
        if (ep.status === 'offline') return ep;
        const randomCpu = Math.floor(Math.random() * 35) + 15;
        const randomRam = Math.floor(Math.random() * 5) + 55;
        const newTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const updatedHistory = [...ep.metricsHistory.slice(1), { timestamp: newTime, cpu: randomCpu, ram: randomRam, diskIO: Math.floor(Math.random() * 20) }];
        return {
          ...ep,
          metricsHistory: updatedHistory,
          lastSeenAt: new Date().toISOString()
        };
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  const handleAcknowledgeAlert = (alertId: string) => {
    setSystemAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
  };

  const handleToggleRule = (ruleId: string) => {
    setAlertRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  const handleCreateToken = () => {
    const newToken: EnrollmentToken = {
      id: `tok-${Math.random().toString(36).substring(2, 6)}-uuid`,
      tokenHash: `sha256:${Math.random().toString(36).substring(2)}`,
      plainToken: `sp_enrol_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      usedByEndpointId: null,
      createdAt: new Date().toISOString()
    };
    setTokens([newToken, ...tokens]);
  };

  const handleTriggerGlobalRefresh = () => {
    // Simulate re-collecting
  };

  const handleTriggerOnDemandRefresh = (endpointId: string) => {
    setEndpoints(prev => prev.map(ep => ep.id === endpointId ? { ...ep, lastSeenAt: new Date().toISOString() } : ep));
  };

  const criticalAlertsCount = systemAlerts.filter(a => !a.acknowledged && a.severity === 'critical').length;

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-row overflow-hidden font-sans">
            {/* Persistent Sidebar */}
            <Sidebar endpointsCount={endpoints.length} criticalAlertsCount={criticalAlertsCount} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
              <Header 
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isLiveStreaming={isLiveStreaming}
                onToggleLiveStream={() => setIsLiveStreaming(!isLiveStreaming)}
                unreadAlertsCount={systemAlerts.filter(a => !a.acknowledged).length}
                onTriggerGlobalRefresh={handleTriggerGlobalRefresh}
              />

              <div className="flex-1">
                <Switch>
                  <Route path="/">
                    <DashboardOverview 
                      endpoints={endpoints} 
                      alerts={systemAlerts} 
                      onAcknowledgeAlert={handleAcknowledgeAlert}
                    />
                  </Route>
                  <Route path="/endpoints">
                    <EndpointsList 
                      endpoints={endpoints} 
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                    />
                  </Route>
                  <Route path="/endpoints/:id">
                    <EndpointDetail 
                      endpoints={endpoints}
                      onTriggerOnDemandRefresh={handleTriggerOnDemandRefresh}
                    />
                  </Route>
                  <Route path="/alerts">
                    <AlertsCenter 
                      alertRules={alertRules}
                      systemAlerts={systemAlerts}
                      onToggleRule={handleToggleRule}
                      onAcknowledgeAlert={handleAcknowledgeAlert}
                    />
                  </Route>
                  <Route path="/tokens">
                    <EnrollmentTokens 
                      tokens={tokens}
                      onCreateToken={handleCreateToken}
                    />
                  </Route>
                  <Route path="/settings" component={SettingsPage} />
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
