import { Link, useLocation } from 'wouter';
import type { UserRole } from '../types';
import { 
  LayoutDashboard, 
  Server, 
  AlertTriangle, 
  KeyRound, 
  Settings, 
  ShieldCheck, 
  Cpu,
  Terminal,
  Activity
} from 'lucide-react';

interface SidebarProps {
  endpointsCount: number;
  criticalAlertsCount: number;
  userRole: UserRole;
  onExportFleet: () => void;
}

export default function Sidebar({ endpointsCount, criticalAlertsCount, userRole, onExportFleet }: SidebarProps) {
  const [location] = useLocation();

  const navItems = [
    { href: '/', label: 'Dashboard Overview', icon: LayoutDashboard },
    { href: '/endpoints', label: 'Endpoints Fleet', icon: Server, badge: endpointsCount },
    { href: '/alerts', label: 'Alerts & Rules', icon: AlertTriangle, alertBadge: criticalAlertsCount },
    { href: '/tokens', label: 'Enrollment Tokens', icon: KeyRound },
    { href: '/settings', label: 'Platform Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
          <Activity className="w-5 h-5 text-blue-100 animate-pulse" />
        </div>
        <div>
          <h1 className="font-extrabold text-white text-base tracking-tight">Sentinel<span className="text-blue-500">Pulse</span></h1>
          <p className="text-[11px] text-slate-400 font-mono tracking-wider">WINDOWS EDR & WMI v2.4</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="px-4 py-6 flex-1 space-y-1.5">
        <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-2">Platform Control</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive 
                  ? 'bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/30 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300 font-mono">
                  {item.badge}
                </span>
              )}
              {item.alertBadge !== undefined && item.alertBadge > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500/20 text-rose-400 font-mono border border-rose-500/30">
                  {item.alertBadge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-5 mt-5 border-t border-slate-800/80">
          <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-2">Data Portability</p>
          <button onClick={onExportFleet} className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-all">
            <span className="flex items-center gap-3"><Terminal className="w-4 h-4 text-slate-500" /> Export Fleet JSON</span>
            <span className="text-[10px] font-mono text-slate-600 uppercase">{userRole}</span>
          </button>
        </div>
      </div>

      {/* Agent Status Footer Widget */}
      <div className="p-4 m-3 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Ingestion Gateway
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            ACTIVE
          </span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-800 flex justify-between">
          <span>TimescaleDB 2.14</span>
          <span className="text-slate-400">Node 20 LTS</span>
        </div>
      </div>
    </aside>
  );
}
