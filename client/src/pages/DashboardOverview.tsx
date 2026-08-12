import { useState } from 'react';
import { Endpoint, SystemAlert } from '../types';
import { 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Cpu, 
  HardDrive, 
  Activity, 
  ArrowUpRight, 
  ShieldCheck, 
  Clock, 
  Terminal,
  Zap
} from 'lucide-react';
import { Link } from 'wouter';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';

interface DashboardOverviewProps {
  endpoints: Endpoint[];
  alerts: SystemAlert[];
  onAcknowledgeAlert: (alertId: string) => void;
}

export default function DashboardOverview({ endpoints, alerts, onAcknowledgeAlert }: DashboardOverviewProps) {
  const onlineCount = endpoints.filter(e => e.status === 'online').length;
  const warningCount = endpoints.filter(e => e.status === 'warning').length;
  const offlineCount = endpoints.filter(e => e.status === 'offline').length;
  const totalCount = endpoints.length;

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);

  // Aggregate telemetry trend across endpoints
  const trendData = [
    { time: '10:00', cpuAvg: 26, ramAvg: 58, networkIO: 14.2 },
    { time: '10:10', cpuAvg: 38, ramAvg: 61, networkIO: 22.4 },
    { time: '10:20', cpuAvg: 28, ramAvg: 59, networkIO: 11.0 },
    { time: '10:30', cpuAvg: 47, ramAvg: 67, networkIO: 34.8 },
    { time: '10:40', cpuAvg: 35, ramAvg: 63, networkIO: 18.2 },
    { time: '10:50', cpuAvg: 34, ramAvg: 62, networkIO: 16.5 },
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Fleet Operations Command</h2>
          <p className="text-sm text-slate-400 mt-1">Real-time Windows endpoint telemetry, hardware health, and automated diagnostics.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ALL WMI COLLECTORS NOMINAL
          </span>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Endpoints */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Monistered Endpoints</p>
              <h3 className="text-3xl font-extrabold text-white mt-2 font-mono">{totalCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Server className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {onlineCount} Online
            </span>
            <span className="text-slate-500 font-mono">100% WMI Coverage</span>
          </div>
        </div>

        {/* Warning / Degraded */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Degraded / Warnings</p>
              <h3 className="text-3xl font-extrabold text-amber-400 mt-2 font-mono">{warningCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            <span className="text-amber-400 font-medium">SMART / Disk threshold</span>
            <span className="text-slate-500 font-mono">Requires review</span>
          </div>
        </div>

        {/* Offline / Unresponsive */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Offline Endpoints</p>
              <h3 className="text-3xl font-extrabold text-rose-400 mt-2 font-mono">{offlineCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XCircle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            <span className="text-rose-400 font-medium">Heartbeat missed (&gt;15m)</span>
            <span className="text-slate-500 font-mono">Auto-retry active</span>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Active System Alerts</p>
              <h3 className="text-3xl font-extrabold text-indigo-400 mt-2 font-mono">{unacknowledgedAlerts.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Zap className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            <span className="text-indigo-400 font-medium">Threshold rules triggered</span>
            <Link href="/alerts" className="text-blue-400 hover:underline flex items-center gap-1 font-semibold">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Charts & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fleet Telemetry Trends (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Fleet Resource Utilization (CPU & RAM Avg)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Aggregated performance telemetry across all active Windows agents.</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              TimescaleDB Hypertable
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="ramColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" textAnchor="end" fontSize={11} font-family="JetBrains Mono" />
                <YAxis stroke="#64748b" fontSize={11} font-family="JetBrains Mono" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="cpuAvg" name="CPU Avg (%)" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#cpuColor)" />
                <Area type="monotone" dataKey="ramAvg" name="RAM Avg (%)" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#ramColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Alerts Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Active System Alerts</h3>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono text-xs font-semibold">
                {unacknowledgedAlerts.length} Unresolved
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-64 pr-1">
              {unacknowledgedAlerts.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  No unresolved alerts. All endpoints healthy.
                </div>
              ) : (
                unacknowledgedAlerts.map(alert => (
                  <div key={alert.id} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-200">{alert.hostname}</span>
                      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                        alert.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{alert.message}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(alert.triggeredAt).toLocaleTimeString()}
                      </span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="h-6 px-2 text-[11px] text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                      >
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-slate-800 mt-4">
            <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center justify-center gap-1">
              Configure Alert Threshold Rules <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Endpoints Fleet Summary Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Monitored Endpoints Fleet</h3>
            <p className="text-xs text-slate-400 mt-0.5">Active Windows machines reporting telemetry via .NET Worker agents.</p>
          </div>
          <Link href="/endpoints">
            <Button size="sm" variant="outline" className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 text-xs">
              View All Endpoints ({endpoints.length})
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Hostname / IP</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">OS Version</th>
                <th className="py-3 px-4">Hardware CPU / RAM</th>
                <th className="py-3 px-4">Last Seen</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {endpoints.slice(0, 4).map((ep) => (
                <tr key={ep.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <Link href={`/endpoints/${ep.id}`} className="font-bold text-white hover:text-blue-400 font-mono block">
                      {ep.hostname}
                    </Link>
                    <span className="text-[11px] text-slate-500 font-mono">{ep.ipAddress} • {ep.serialNumber}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium font-mono ${
                      ep.status === 'online' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                      ep.status === 'warning' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                      'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ep.status === 'online' ? 'bg-emerald-400 animate-pulse' : ep.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                      {ep.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    {ep.osVersion} <span className="text-slate-500 font-mono text-[10px]">({ep.osBuild})</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-mono">
                    {ep.hardware.cpuModel.split(' ')[0]} ({ep.hardware.cpuCores}C) • {Math.round(ep.hardware.ramTotalMb / 1024)} GB
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono">
                    {new Date(ep.lastSeenAt).toLocaleTimeString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link href={`/endpoints/${ep.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 text-xs">
                        Inspect &rarr;
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
