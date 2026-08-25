import React from 'react';
import type { Endpoint, BatteryInfo, NetworkAdapterInfo, ExtendedHardwareInfo, ExtendedDiskInfo } from '@/types';
import { BatteryCharging, Cpu, Gauge, HardDrive, MemoryStick, Network, Plug, Thermometer } from 'lucide-react';

type ExtendedEndpoint = Endpoint & {
  extendedHardware?: ExtendedHardwareInfo;
  extendedDisks?: ExtendedDiskInfo[];
  battery?: BatteryInfo;
  networkAdapters?: NetworkAdapterInfo[];
  healthScore?: number;
  metadata?: { department?: string; location?: string; assignedUser?: string; assetId?: string; tags?: string; maintenanceMode?: boolean };
  applicationUsage?: { appName: string; activeSeconds: number; cpuTimeSeconds: number; networkBytes?: number; launchCount: number; lastUsedAt: string }[];
};

function formatMb(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)} MB` : 'Unavailable';
}

export default function ExtendedTelemetryPanel({ endpoint }: { endpoint: ExtendedEndpoint }) {
  const hardware = endpoint.extendedHardware;
  const battery = endpoint.battery;
  const adapters = endpoint.networkAdapters ?? [];
  const healthScore = endpoint.healthScore;
  const memoryModules = hardware?.memoryModules ?? endpoint.hardware.memoryModules ?? [];
  const graphicsAdapters = hardware?.graphicsAdapters ?? endpoint.hardware.graphicsAdapters ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <Cpu className="w-4 h-4 text-blue-400 mb-2" />
          <p className="text-[10px] uppercase text-slate-500">Current Clock</p>
          <p className="font-mono text-white text-sm">{hardware?.cpuClockSpeedMhz ? `${hardware.cpuClockSpeedMhz} MHz` : 'Unavailable'}</p>
          <p className="text-[10px] text-slate-500 mt-1">Current reading, not maximum speed</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <Thermometer className="w-4 h-4 text-amber-400 mb-2" />
          <p className="text-[10px] uppercase text-slate-500">CPU Temp</p>
          <p className="font-mono text-white text-sm">{typeof hardware?.cpuTemperatureCelsius === 'number' ? `${hardware.cpuTemperatureCelsius}°C` : 'Unavailable'}</p>
          <p className="text-[10px] text-slate-500 mt-1">Validated Windows sensor only</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <Gauge className="w-4 h-4 text-violet-400 mb-2" />
          <p className="text-[10px] uppercase text-slate-500">GPU Memory</p>
          <p className="font-mono text-white text-sm">{graphicsAdapters.length ? `${graphicsAdapters.length} adapter${graphicsAdapters.length === 1 ? '' : 's'}` : 'Per-adapter data unavailable'}</p>
          <p className="text-[10px] text-slate-500 mt-1">Dedicated/shared values shown below</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <Gauge className="w-4 h-4 text-emerald-400 mb-2" />
          <p className="text-[10px] uppercase text-slate-500">Health Score</p>
          <p className="font-mono text-white text-sm">{typeof healthScore === 'number' && healthScore > 0 ? `${healthScore}/100` : 'Not calculated'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2"><MemoryStick className="w-4 h-4 text-cyan-400" /> RAM Modules</h4>
          <p className="mt-2 text-xs font-mono text-slate-400">Slots: {typeof hardware?.memorySlotsUsed === 'number' && typeof hardware?.memorySlotsTotal === 'number' ? `${hardware.memorySlotsUsed} / ${hardware.memorySlotsTotal} occupied` : 'Unavailable'}</p>
          {memoryModules.length ? (
            <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
              {memoryModules.map((module, index) => <div key={module.id || `memory-${index}`} className="border-b border-slate-800 pb-2 last:border-0"><p className="text-white">Module {index + 1}: {formatMb(module.capacityMb)}</p><p>Speed: {module.speedMtps ? `${module.speedMtps} MT/s` : 'Unavailable'} · Form: {module.formFactor ?? 'Unknown'}</p></div>)}
            </div>
          ) : <p className="mt-4 text-xs text-slate-500">RAM module telemetry unavailable; total memory is not a substitute for slot or speed evidence.</p>}
        </section>
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2"><Gauge className="w-4 h-4 text-violet-400" /> Graphics Adapters</h4>
          {graphicsAdapters.length ? (
            <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
              {graphicsAdapters.map(adapter => <div key={adapter.id} className="border-b border-slate-800 pb-2 last:border-0"><p className="text-white">{adapter.model}</p><p>Dedicated: {formatMb(adapter.dedicatedMemoryMb)} · Shared: {formatMb(adapter.sharedMemoryMb)}</p><p>Source: {adapter.memorySource ?? 'unknown'} · Utilization: {typeof adapter.utilizationPercent === 'number' ? `${adapter.utilizationPercent}%` : 'Unavailable'}</p></div>)}
            </div>
          ) : <p className="mt-4 text-xs text-slate-500">No per-adapter GPU telemetry received. No aggregate VRAM value is shown.</p>}
        </section>
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2"><BatteryCharging className="w-4 h-4 text-emerald-400" /> Battery</h4>
          {battery ? (
            <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
              <p>Charge: {typeof battery.chargePercent === 'number' ? `${battery.chargePercent}%` : 'Unavailable'}</p><p>Health: {typeof battery.healthPercent === 'number' ? `${battery.healthPercent}%` : 'Unavailable'}</p><p>Status: {battery.chargingStatus}</p><p>Cycles: {typeof battery.cycleCount === 'number' ? battery.cycleCount : 'Unavailable'}</p>
            </div>
          ) : <p className="mt-4 text-xs text-slate-500">No battery telemetry received from the agent.</p>}
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2"><Network className="w-4 h-4 text-blue-400" /> Network</h4>
          {adapters.length ? <div className="mt-4 space-y-3 text-xs font-mono text-slate-300">{adapters.map(adapter => <div key={`${adapter.name}-${adapter.macAddress}`} className="border-b border-slate-800 pb-2 last:border-0"><p className="text-white">{adapter.name} · {adapter.ssid ?? 'Ethernet'}</p><p>Down: {Math.round(adapter.downloadBps / 1_000_000)} Mbps · Up: {Math.round(adapter.uploadBps / 1_000_000)} Mbps · Latency: {adapter.latencyMs} ms</p></div>)}</div> : <p className="mt-4 text-xs text-slate-500">No adapter telemetry received from the agent.</p>}
        </section>
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2"><Plug className="w-4 h-4 text-amber-400" /> Peripherals</h4>
          {hardware?.peripherals?.length ? <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">{hardware.peripherals.map(item => <p key={item.id}>{item.deviceType}: {item.name}</p>)}</div> : <p className="mt-4 text-xs text-slate-500">No peripheral inventory received from the agent.</p>}
        </section>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white mb-4">Device Management</h4>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono text-slate-300">
            <p>Asset ID: <span className="text-white">{endpoint.metadata?.assetId ?? 'Unassigned'}</span></p>
            <p>Owner: <span className="text-white">{endpoint.metadata?.assignedUser ?? 'Unassigned'}</span></p>
            <p>Department: <span className="text-white">{endpoint.metadata?.department ?? 'Unassigned'}</span></p>
            <p>Location: <span className="text-white">{endpoint.metadata?.location ?? 'Unassigned'}</span></p>
          </div>
          <p className="mt-3 text-xs text-slate-500">Tags: {endpoint.metadata?.tags ?? 'No tags'} · Maintenance: {endpoint.metadata?.maintenanceMode ? 'ON' : 'OFF'}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white mb-4">Application Usage</h4>
          {endpoint.applicationUsage?.length ? <div className="space-y-2 text-xs font-mono text-slate-300">{endpoint.applicationUsage.slice(0, 4).map(app => <p key={app.appName} className="flex justify-between"><span>{app.appName}</span><span>{Math.round(app.activeSeconds / 60)}m active · {app.launchCount} launches</span></p>)}</div> : <p className="text-xs text-slate-500">No usage telemetry received from the agent.</p>}
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h4 className="text-sm font-bold text-white flex items-center gap-2"><HardDrive className="w-4 h-4 text-cyan-400" /> Extended Disk Inventory</h4>
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {(endpoint.extendedDisks ?? []).map(disk => <div key={disk.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300"><p className="text-white">{disk.model || disk.driveLetter} · {disk.diskType}</p><p>{disk.totalGb} GB total · {disk.freeGb} GB free</p><p>SMART: {disk.smartHealth} · IOPS: {disk.iops ?? 'Unavailable'} · Throughput: {disk.throughputMbps ?? 'Unavailable'} MB/s</p></div>)}
          {!endpoint.extendedDisks?.length && <p className="text-xs text-slate-500">Awaiting extended disk telemetry.</p>}
        </div>
      </section>
    </div>
  );
}
