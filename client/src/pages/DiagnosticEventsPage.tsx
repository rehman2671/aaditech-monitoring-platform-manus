import React, { useEffect, useState } from 'react';
import { Terminal, ShieldAlert, CheckCircle2, AlertTriangle, Info, RefreshCw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DiagnosticEvent {
  id: number;
  tenant_id: string;
  component: string;
  level: string;
  category: string;
  message: string;
  details?: string;
  correlation_id?: string;
  created_at: string;
}

interface DiagnosticEventsPageProps {
  accessToken?: string;
  canWrite: boolean;
}

export default function DiagnosticEventsPage({ accessToken, canWrite }: DiagnosticEventsPageProps) {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchEvents = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/diagnostics', {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(await response.text() || response.statusText);
      }
      const data = await response.json() as DiagnosticEvent[];
      setEvents(data);
    } catch (error) {
      toast.error('Failed to load diagnostic events', { description: error instanceof Error ? error.message : 'Check backend connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchEvents();
    const timer = window.setInterval(() => void fetchEvents(), 5000);
    return () => window.clearInterval(timer);
  }, [accessToken]);

  const filteredEvents = events.filter(ev => {
    if (levelFilter !== 'all' && ev.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && ev.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Terminal className="w-7 h-7 text-blue-500" />
            Diagnostic Audit Trail
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time step-by-step telemetry, build queueing, Windows runner execution, and agent enrollment logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => void fetchEvents()}
            disabled={isLoading}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold gap-2 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Events
          </Button>
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300">Filters:</span>
        </div>
        <select
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Levels</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="build">Build</option>
          <option value="enrollment">Enrollment</option>
          <option value="ingestion">Ingestion</option>
          <option value="telemetry">Telemetry</option>
        </select>
        <div className="ml-auto text-xs text-slate-400 font-mono">
          Showing {filteredEvents.length} of {events.length} events
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 bg-slate-950/40">
                <th className="py-4 px-6">Timestamp</th>
                <th className="py-4 px-6">Component</th>
                <th className="py-4 px-6">Level</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">Message & Details</th>
                <th className="py-4 px-6">Correlation ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm font-mono">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No diagnostic audit events recorded yet. Trigger an MSI build or agent heartbeat to populate logs.
                  </td>
                </tr>
              ) : (
                filteredEvents.map(ev => {
                  const levelColor =
                    ev.level === 'error' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                    ev.level === 'warn' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                    ev.level === 'success' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                    'text-blue-400 bg-blue-500/10 border-blue-500/20';
                  
                  const LevelIcon =
                    ev.level === 'error' ? ShieldAlert :
                    ev.level === 'warn' ? AlertTriangle :
                    ev.level === 'success' ? CheckCircle2 :
                    Info;

                  return (
                    <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors text-xs">
                      <td className="py-4 px-6 text-slate-400 whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-4 px-6 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                        {ev.component}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${levelColor}`}>
                          <LevelIcon className="w-3.5 h-3.5" />
                          {ev.level}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-300 uppercase tracking-wider text-[11px]">
                        {ev.category}
                      </td>
                      <td className="py-4 px-6 text-slate-200 space-y-1">
                        <div className="font-semibold">{ev.message}</div>
                        {ev.details && <div className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800">{ev.details}</div>}
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-[11px] font-mono">
                        {ev.correlation_id ?? '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
