import type { Endpoint, BatteryInfo, NetworkAdapterInfo, ExtendedHardwareInfo, ExtendedDiskInfo } from '@/types';
import { BatteryCharging, Cpu, Gauge, HardDrive, Network, Plug, Thermometer } from 'lucide-react';

type ExtendedEndpoint = Endpoint & {
  extendedHardware?: ExtendedHardwareInfo;
  extendedDisks?: ExtendedDiskInfo[];
  battery?: BatteryInfo;
  networkAdapters?: NetworkAdapterInfo[];
  healthScore?: number;
};

export default function ExtendedTelemetryPanel({ endpoint }: { endpoint: ExtendedEndpoint }) {
  const hardware = endpoint.extendedHardware;
  const battery = endpoint.battery;
  const adapter = endpoint.networkAdapters?.[0];
  const healthScore = endpoint.healthScore ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <Cpu className="w-4 h-4 text-blue-400 mb-2" />
          <p className="text-[10px] uppercase text-slate-500">Clock Speed</p>
          <p className="font-mono text-white text-sm">{hardware?.cpuClockSpeedMhz ? `${hardware.cpuClockSpeedMhz} MHz` : 'Awaiting agent'}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <Thermometer className="w-4 h-4 text-amber-400 mb-2" />
          <p className="text-[10px] uppercase text-slate-500">CPU Temp</p>
          <p className="font-mono text-white text-sm">{hardware?.cpuTemperatureCelsius ? `${hardware.cpuTemperatureCelsius}°C` : 'Unavailable'}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <Gauge className="w-4 h-4 text-violet-400 mb-2" />
          <p className="text-[10px] uppercase text-slate-500">GPU / VRAM</p>
          <p className="font-mono text-white text-sm">{hardware?.gpuVramMb ? `${hardware.gpuVramMb} MB` : 'Awaiting agent'}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <Gauge className="w-4 h-4 text-emerald-400 mb-2" />
          <p className="text-[10px] uppercase text-slate-500">Health Score</p>
          <p className="font-mono text-white text-sm">{healthScore ? `${healthScore}/100` : 'Not calculated'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2"><BatteryCharging className="w-4 h-4 text-emerald-400" /> Battery</h4>
          {battery ? (
            <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
              <p>Charge: {battery.chargePercent}%</p><p>Health: {battery.healthPercent}%</p><p>Status: {battery.chargingStatus}</p><p>Cycles: {battery.cycleCount}</p>
            </div>
          ) : <p className="mt-4 text-xs text-slate-500">No battery telemetry received from the agent.</p>}
        </section>
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2"><Network className="w-4 h-4 text-blue-400" /> Network</h4>
          {adapter ? (
            <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
              <p>{adapter.name} · {adapter.ssid ?? 'Ethernet'}</p><p>Down: {Math.round(adapter.downloadBps / 1_000_000)} Mbps</p><p>Up: {Math.round(adapter.uploadBps / 1_000_000)} Mbps</p><p>Latency: {adapter.latencyMs} ms</p>
            </div>
          ) : <p className="mt-4 text-xs text-slate-500">No adapter telemetry received from the agent.</p>}
        </section>
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2"><Plug className="w-4 h-4 text-amber-400" /> Peripherals</h4>
          {hardware?.peripherals?.length ? (
            <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">{hardware.peripherals.map(item => <p key={item.id}>{item.deviceType}: {item.name}</p>)}</div>
          ) : <p className="mt-4 text-xs text-slate-500">No peripheral inventory received from the agent.</p>}
        </section>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h4 className="text-sm font-bold text-white flex items-center gap-2"><HardDrive className="w-4 h-4 text-cyan-400" /> Extended Disk Inventory</h4>
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {(endpoint.extendedDisks ?? []).map(disk => <div key={disk.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300"><p className="text-white">{disk.model || disk.driveLetter} · {disk.diskType}</p><p>{disk.totalGb} GB total · {disk.freeGb} GB free</p><p>IOPS: {disk.iops ?? '—'} · Throughput: {disk.throughputMbps ?? '—'} MB/s</p></div>)}
          {!endpoint.extendedDisks?.length && <p className="text-xs text-slate-500">Awaiting extended disk telemetry.</p>}
        </div>
      </section>
    </div>
  );
}
