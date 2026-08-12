import { useState } from 'react';
import { AlertRule, SystemAlert } from '../types';
import { Bell, AlertTriangle, CheckCircle2, ShieldAlert, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AlertsCenterProps {
  alertRules: AlertRule[];
  systemAlerts: SystemAlert[];
  onToggleRule: (ruleId: string) => void;
  onAcknowledgeAlert: (alertId: string) => void;
}

export default function AlertsCenter({ alertRules, systemAlerts, onToggleRule, onAcknowledgeAlert }: AlertsCenterProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'rules'>('active');

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Alerts & Threshold Rules</h2>
          <p className="text-sm text-slate-400 mt-1">Configure automated metric threshold triggers and review active system warnings.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'active' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Alerts ({systemAlerts.filter(a => !a.acknowledged).length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'rules' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Threshold Rules ({alertRules.length})
          </button>
        </div>
      </div>

      {activeTab === 'active' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <h3 className="text-base font-bold text-white mb-2">Unresolved System Alerts</h3>
          <div className="space-y-3">
            {systemAlerts.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                No active system alerts. All endpoints operating within nominal parameters.
              </div>
            ) : (
              systemAlerts.map(alert => (
                <div key={alert.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                        alert.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="font-mono font-bold text-white text-sm">{alert.hostname}</span>
                      <span className="text-xs text-slate-400 font-mono">• {alert.ruleName}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono">{alert.message}</p>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Triggered at: {new Date(alert.triggeredAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    {alert.acknowledged ? (
                      <span className="text-xs text-slate-500 font-mono px-3 py-1 bg-slate-900 rounded-lg border border-slate-800">
                        Acknowledged
                      </span>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={() => {
                          onAcknowledgeAlert(alert.id);
                          toast.success('Alert acknowledged');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs h-8"
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-white">Configured Threshold Rules</h3>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Rule
            </Button>
          </div>
          <div className="space-y-3">
            {alertRules.map(rule => (
              <div key={rule.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{rule.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                      Metric: {rule.metric}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                      rule.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {rule.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Condition: {rule.metric} {rule.condition} {rule.thresholdValue}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onToggleRule(rule.id);
                    toast.success(`Rule "${rule.name}" status toggled`);
                  }}
                  className="flex items-center gap-2 text-xs font-mono text-slate-300"
                >
                  {rule.enabled ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/30">
                      ENABLED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-500 font-bold bg-slate-800 px-3 py-1 rounded-lg">
                      DISABLED
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
