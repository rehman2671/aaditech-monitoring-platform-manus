import { useState } from 'react';
import { Endpoint } from '../types';
import { 
  ArrowLeft, 
  Server, 
  Cpu, 
  HardDrive, 
  ShieldCheck, 
  Package, 
  Terminal, 
  RefreshCw, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText,
  Layers,
  Database
} from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import ExtendedTelemetryPanel from '@/components/ExtendedTelemetryPanel';

interface EndpointDetailProps {
  endpoints: Endpoint[];
  onTriggerOnDemandRefresh: (endpointId: string) => void | Promise<void>;
}

export default function EndpointDetail({ endpoints, onTriggerOnDemandRefresh }: EndpointDetailProps) {
  const [, params] = useRoute('/endpoints/:id');
  const endpointId = params?.id;

  const endpoint = endpoints.find(e => e.id === endpointId) || endpoints[0];
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleOnDemandClick = async () => {
    setIsRefreshing(true);
    try {
      await Promise.resolve(onTriggerOnDemandRefresh(endpoint.id));
      toast.success('On-Demand Collection Queued', {
        description: `The backend will request fresh telemetry from ${endpoint.hostname}.`
      });
    } catch (error) {
      toast.error('Unable to queue collection', { description: error instanceof Error ? error.message : 'Request failed' });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!endpoint) {
    return (
      <div className="p-12 text-center text-slate-400">
        <h3 className="text-xl font-bold text-white mb-2">Endpoint Not Found</h3>
        <p className="text-xs mb-6">The requested endpoint ID does not exist or was deregistered.</p>
        <Link href="/endpoints">
          <Button>Back to Endpoints</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/endpoints">
            <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white h-9">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-white font-mono tracking-tight">{endpoint.hostname}</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono ${
                endpoint.status === 'online' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                endpoint.status === 'warning' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${endpoint.status === 'online' ? 'bg-emerald-400 animate-pulse' : endpoint.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                {endpoint.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Serial: <span className="text-slate-300">{endpoint.serialNumber}</span> • IP: <span className="text-slate-300">{endpoint.ipAddress}</span> • Domain: <span className="text-slate-300">{endpoint.domainOrWorkgroup}</span>
            </p>
          </div>
        </div>

        {/* On-Demand Refresh Button */}
        <Button 
          onClick={handleOnDemandClick}
          disabled={isRefreshing}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 shadow-lg shadow-blue-600/20"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Polling WMI / Agent...' : 'Trigger On-Demand Refresh'}</span>
        </Button>
      </div>

      {/* Tabs Navigation */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex flex-wrap gap-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs px-4 py-2 rounded-xl font-medium">
            Overview & Telemetry
          </TabsTrigger>
          <TabsTrigger value="hardware" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs px-4 py-2 rounded-xl font-medium">
            Hardware & Disks
          </TabsTrigger>
          <TabsTrigger value="oshealth" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs px-4 py-2 rounded-xl font-medium">
            OS Health & Drivers
          </TabsTrigger>
          <TabsTrigger value="software" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs px-4 py-2 rounded-xl font-medium">
            Software Inventory ({endpoint.software.length})
          </TabsTrigger>
          <TabsTrigger value="processes" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs px-4 py-2 rounded-xl font-medium">
            Active Processes ({endpoint.processes.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs px-4 py-2 rounded-xl font-medium">
            Event Viewer Logs ({endpoint.eventLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview & Telemetry */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Realtime Metrics Chart (2 cols) */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Live Performance Telemetry</h3>
                  <p className="text-xs text-slate-400">CPU and RAM consumption history captured by Windows Performance Counters.</p>
                </div>
                <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                  Agent v{endpoint.agentVersion}
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={endpoint.metricsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="epCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="epRam" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} font-family="JetBrains Mono" />
                    <YAxis stroke="#64748b" fontSize={11} font-family="JetBrains Mono" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="cpu" name="CPU Usage (%)" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#epCpu)" />
                    <Area type="monotone" dataKey="ram" name="RAM Usage (%)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#epRam)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
              <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">Endpoint Identity & Specs</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">OS Version:</span>
                  <span className="font-mono text-slate-200">{endpoint.osVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">OS Build:</span>
                  <span className="font-mono text-slate-200">{endpoint.osBuild}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">MAC Address:</span>
                  <span className="font-mono text-slate-200">{endpoint.macAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total RAM:</span>
                  <span className="font-mono text-slate-200">{Math.round(endpoint.hardware.ramTotalMb / 1024)} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CPU Cores:</span>
                  <span className="font-mono text-slate-200">{endpoint.hardware.cpuCores} Cores ({endpoint.hardware.cpuLogicalProcessors} Threads)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last Seen:</span>
                  <span className="font-mono text-emerald-400">{new Date(endpoint.lastSeenAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          <ExtendedTelemetryPanel endpoint={endpoint} />
        </TabsContent>

        {/* Tab 2: Hardware & Disks */}
        <TabsContent value="hardware" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hardware Inventory */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                Hardware Inventory
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">CPU Model</span>
                  <span className="text-white font-bold">{endpoint.hardware.cpuModel}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">GPU Model</span>
                  <span className="text-white font-bold">{endpoint.hardware.gpuModel}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Motherboard</span>
                  <span className="text-white font-bold">{endpoint.hardware.motherboardModel}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">BIOS Version</span>
                  <span className="text-white font-bold">{endpoint.hardware.biosVersion}</span>
                </div>
              </div>
            </div>

            {/* Storage & Disks */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-emerald-400" />
                Storage & SMART Health
              </h3>
              <div className="space-y-3">
                {endpoint.disks.map((disk) => {
                  const percentUsed = Math.round((disk.usedGb / disk.totalGb) * 100);
                  return (
                    <div key={disk.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-white text-sm">{disk.driveLetter} ({disk.filesystem})</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          disk.smartHealth === 'Healthy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          SMART: {disk.smartHealth}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-mono text-slate-400">
                        <span>Used: {disk.usedGb} GB / {disk.totalGb} GB ({percentUsed}%)</span>
                        <span>Free: {disk.freeGb} GB</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${percentUsed > 85 ? 'bg-rose-500' : percentUsed > 70 ? 'bg-amber-500' : 'bg-blue-600'}`} 
                          style={{ width: `${percentUsed}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: OS Health & Drivers */}
        <TabsContent value="oshealth" className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Windows Image Health & Reliability
              <span className="text-[10px] font-mono font-normal text-slate-500">Checked: {endpoint.osHealth.checkedAt ? new Date(endpoint.osHealth.checkedAt).toLocaleString() : 'Timestamp unavailable'}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-xs uppercase">DISM Image Status</span>
                <div className={`text-lg font-bold ${endpoint.osHealth.dismStatus === 'Healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>{endpoint.osHealth.dismStatus}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-xs uppercase">SFC Integrity Check</span>
                <div className={`text-base font-bold ${endpoint.osHealth.sfcStatus === 'No Integrity Violations' ? 'text-emerald-400' : 'text-amber-400'}`}>{endpoint.osHealth.sfcStatus}</div>
                <div className="text-[10px] text-slate-500">{endpoint.osHealth.sfcDetail ?? 'No execution detail supplied'}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-xs uppercase">Driver Issues</span>
                <div className={`text-lg font-bold ${endpoint.osHealth.driverIssuesCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {endpoint.osHealth.driverIssuesCount} Detected
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-xs uppercase">Reliability Score</span>
                <div className="text-lg font-bold text-blue-400">{typeof endpoint.osHealth.reliabilityScore === 'number' ? `${endpoint.osHealth.reliabilityScore} / 10` : 'Unavailable'}</div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Software Inventory */}
        <TabsContent value="software" className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-base font-bold text-white mb-4">Installed Software Applications</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 font-mono text-slate-400 uppercase">
                    <th className="py-3 px-4">Application Name</th>
                    <th className="py-3 px-4">Publisher</th>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">Installed Date</th>
                    <th className="py-3 px-4 text-right">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {endpoint.software.map(sw => (
                    <tr key={sw.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-white">{sw.name}</td>
                      <td className="py-3 px-4 text-slate-400">{sw.publisher}</td>
                      <td className="py-3 px-4 text-slate-300">{sw.version}</td>
                      <td className="py-3 px-4 text-slate-400">{sw.installedAt}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{sw.sizeMb} MB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Active Processes */}
        <TabsContent value="processes" className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-base font-bold text-white mb-1">Process Snapshot</h3>
            <p className="text-xs text-slate-500 mb-4">{endpoint.processes.length ? (endpoint.processes.every(proc => proc.cpuPercent === 0) ? 'CPU sampling unavailable or rounded to zero in this snapshot.' : 'CPU values are from the latest process sample.') : 'No process snapshot received from the agent.'}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 font-mono text-slate-400 uppercase">
                    <th className="py-3 px-4">PID</th>
                    <th className="py-3 px-4">Process Name</th>
                    <th className="py-3 px-4">CPU %</th>
                    <th className="py-3 px-4">RAM Usage</th>
                    <th className="py-3 px-4 text-right">Security Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {endpoint.processes.map(proc => (
                    <tr key={proc.pid} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-400">{proc.pid}</td>
                      <td className="py-3 px-4 font-bold text-white">{proc.name}</td>
                      <td className="py-3 px-4 text-blue-400">{proc.cpuPercent}%</td>
                      <td className="py-3 px-4 text-emerald-400">{proc.ramMb} MB</td>
                      <td className="py-3 px-4 text-right text-slate-400 text-[11px]">{proc.username ?? 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 6: Event Viewer Logs */}
        <TabsContent value="logs" className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-base font-bold text-white mb-1">Windows Event Viewer (System & Application Logs)</h3>
            <p className="text-xs text-slate-500 mb-4">{endpoint.eventLogs.length ? `${endpoint.eventLogs.length} events in the current snapshot; channel and raw record detail are shown when supplied.` : 'No event snapshot received from the agent.'}</p>
            <div className="space-y-3">
              {endpoint.eventLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">No recent critical event logs recorded.</div>
              ) : (
                endpoint.eventLogs.map(log => (
                  <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.level === 'Error' ? 'bg-rose-500/20 text-rose-400' :
                          log.level === 'Warning' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {log.level}
                        </span>
                        <span className="text-white font-bold">{log.provider} (Event ID: {log.eventId}){log.channel ? ` · ${log.channel}` : ''}{typeof log.recordId === 'number' ? ` · Record ${log.recordId}` : ''}</span>
                      </div>
                      <span className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      {log.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
