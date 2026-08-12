import { useState } from 'react';
import { Settings, Shield, Bell, Database, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [retentionDays, setRetentionDays] = useState('90');
  const [heartbeatInterval, setHeartbeatInterval] = useState('60');

  const handleSave = () => {
    toast.success('Platform configuration saved successfully');
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Platform Settings</h2>
        <p className="text-sm text-slate-400 mt-1">Configure TimescaleDB metric retention, agent heartbeat frequency, and API gateways.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
        <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          Data Retention & Ingestion
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-2">
            <label className="font-semibold text-slate-300">Metrics Retention (TimescaleDB Hypertables)</label>
            <select
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono"
            >
              <option value="30">30 Days</option>
              <option value="90">90 Days (Recommended)</option>
              <option value="180">180 Days</option>
              <option value="365">1 Year</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="font-semibold text-slate-300">Default Agent Heartbeat Interval</label>
            <select
              value={heartbeatInterval}
              onChange={(e) => setHeartbeatInterval(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono"
            >
              <option value="30">30 Seconds</option>
              <option value="60">60 Seconds (Default)</option>
              <option value="300">5 Minutes</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 font-semibold gap-2">
            <Save className="w-4 h-4" /> Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
