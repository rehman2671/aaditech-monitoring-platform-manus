import { useState } from 'react';
import { Database, Save, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/** Precision Enterprise Glass: settings use crisp operator controls with explicit permission boundaries. */
interface SettingsPageProps { canWrite: boolean; }

export default function SettingsPage({ canWrite }: SettingsPageProps) {
  const [retentionDays, setRetentionDays] = useState('90');
  const [heartbeatInterval, setHeartbeatInterval] = useState('60');

  const handleSave = () => {
    if (!canWrite) {
      toast.error('Viewer role is read-only', { description: 'Ask an admin to change platform configuration.' });
      return;
    }
    toast.success('Platform configuration saved successfully');
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Platform Settings</h2>
        <p className="text-sm text-slate-400 mt-1">Configure metric retention, agent heartbeat frequency, and diagnostic operating policies.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4"><p className="text-xs text-blue-300 font-mono uppercase">Database</p><p className="text-lg text-white font-bold mt-1">TimescaleDB</p><p className="text-[10px] text-slate-400 font-mono mt-1">30d raw retention</p></div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><p className="text-xs text-emerald-300 font-mono uppercase">Queue</p><p className="text-lg text-white font-bold mt-1">Redis Streams</p><p className="text-[10px] text-slate-400 font-mono mt-1">Stateless workers</p></div>
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4"><p className="text-xs text-indigo-300 font-mono uppercase">Session</p><p className="text-lg text-white font-bold mt-1">JWT + Refresh</p><p className="text-[10px] text-slate-400 font-mono mt-1">15m / 7d rotation</p></div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2"><Database className="w-5 h-5 text-blue-400" /> Data Retention & Ingestion</h3>
          {!canWrite && <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1"><LockKeyhole className="w-3 h-3" /> Viewer mode</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <label className="space-y-2"><span className="font-semibold text-slate-300 block">Metrics retention</span><select disabled={!canWrite} value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono disabled:opacity-50"><option value="30">30 Days</option><option value="90">90 Days</option><option value="180">180 Days</option><option value="365">1 Year</option></select></label>
          <label className="space-y-2"><span className="font-semibold text-slate-300 block">Agent heartbeat interval</span><select disabled={!canWrite} value={heartbeatInterval} onChange={(e) => setHeartbeatInterval(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono disabled:opacity-50"><option value="30">30 Seconds</option><option value="60">60 Seconds</option><option value="300">5 Minutes</option></select></label>
        </div>
        <div className="pt-4 border-t border-slate-800 flex justify-end"><Button onClick={handleSave} disabled={!canWrite} className="bg-blue-600 hover:bg-blue-500 font-semibold gap-2 disabled:opacity-50"><Save className="w-4 h-4" /> {canWrite ? 'Save Changes' : 'Admin Role Required'}</Button></div>
      </div>
    </div>
  );
}
