import { useState } from 'react';
import { Endpoint } from '../types';
import { Server, Search, Filter, ShieldCheck, AlertTriangle, XCircle, Plus, Terminal, Copy, Check } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface EndpointsListProps {
  endpoints: Endpoint[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function EndpointsList({ endpoints, searchQuery, onSearchChange }: EndpointsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const filteredEndpoints = endpoints.filter(ep => {
    const matchesSearch = ep.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ep.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ep.ipAddress.includes(searchQuery) ||
                          ep.osVersion.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const installScript = `Invoke-WebRequest -Uri "http://10.73.99.58:8080/agent/install.ps1" -OutFile "$env:TEMP\\install.ps1"; & "$env:TEMP\\install.ps1" -Token "sp-enrol-00000000-0000-0000-0000-000000000000"`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(installScript);
    setCopied(true);
    toast.success('Agent deployment script copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Endpoints Fleet Inventory</h2>
          <p className="text-sm text-slate-400 mt-1">Manage all registered Windows machines, agent versions, and hardware inventory.</p>
        </div>
        <Dialog open={isInstallModalOpen} onOpenChange={setIsInstallModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 shadow-lg shadow-blue-600/20">
              <Plus className="w-4 h-4" />
              Deploy New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-400" />
                Windows Agent Deployment Script (.NET 8 Worker)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2 text-xs text-slate-300">
              <p>Run the following PowerShell command as Administrator on any target Windows 10/11 or Windows Server 2019/2022 machine to automatically enroll and install the SentinelPulse background service.</p>
              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-blue-300 font-mono overflow-x-auto text-[11px] leading-relaxed">
                  {installScript}
                </pre>
                <button
                  onClick={handleCopyScript}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Prerequisites:</p>
                <p>• Windows PowerShell 5.1 or PowerShell 7+</p>
                <p>• Outbound HTTPS (443) connectivity to ingestion API gateway</p>
                <p>• Local Administrator privileges for Windows Service registration</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status:</span>
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {['all', 'online', 'warning', 'offline'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-lg text-xs font-mono uppercase transition-all ${
                  statusFilter === status 
                    ? 'bg-blue-600 text-white font-bold shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="font-bold text-white">{filteredEndpoints.length}</span> of {endpoints.length} endpoints
        </div>
      </div>

      {/* Endpoints Table Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider bg-slate-950/50">
                <th className="py-3.5 px-5">Hostname & IP / Serial</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">OS Build & Domain</th>
                <th className="py-3.5 px-5">Hardware Specs</th>
                <th className="py-3.5 px-5">Agent Ver</th>
                <th className="py-3.5 px-5">Last Seen</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredEndpoints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-500">
                    <Server className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
                    No matching endpoints found for your search criteria.
                  </td>
                </tr>
              ) : (
                filteredEndpoints.map((ep) => (
                  <tr key={ep.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-4 px-5">
                      <Link href={`/endpoints/${ep.id}`} className="font-bold text-white hover:text-blue-400 font-mono text-sm block">
                        {ep.hostname}
                      </Link>
                      <span className="text-[11px] text-slate-400 font-mono">{ep.ipAddress} • <span className="text-slate-400">{ep.serialNumber}</span></span>
                    </td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium font-mono ${
                        ep.status === 'online' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                        ep.status === 'warning' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                        'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ep.status === 'online' ? 'bg-emerald-400 animate-pulse' : ep.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                        {ep.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="text-slate-200 font-medium">{ep.osVersion}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{ep.domainOrWorkgroup} • Build {ep.osBuild}</span>
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-300">
                      <div>{ep.hardware.cpuModel.split(' ')[0]} ({typeof ep.hardware.cpuCores === 'number' ? `${ep.hardware.cpuCores}C` : 'cores unavailable'} / {typeof ep.hardware.cpuLogicalProcessors === 'number' ? `${ep.hardware.cpuLogicalProcessors}T` : 'threads unavailable'})</div>
                      <div className="text-[10px] text-slate-400">{typeof ep.hardware.ramTotalMb === 'number' ? `${Math.round(ep.hardware.ramTotalMb / 1024)} GB RAM` : 'RAM unavailable'} • {ep.disks.length} Disk(s)</div>
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">{ep.agentVersion}</span>
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-400">
                      {new Date(ep.lastSeenAt).toLocaleTimeString()}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <Link href={`/endpoints/${ep.id}`}>
                        <Button size="sm" variant="outline" className="h-8 px-3 bg-slate-800 border-slate-700 text-slate-200 hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-all text-xs">
                          Inspect &rarr;
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
