import { useEffect, useState } from 'react';
import { Search, Bell, RefreshCw, Radio, LogOut, UserCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { AuthUser, RealtimeEvent } from '../types';
import { RealtimeClient, type RealtimeStatus } from '../lib/realtime';

/** Precision Enterprise Glass: Plus Jakarta Sans leads; mono is reserved for transport and identity telemetry. */
interface HeaderProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
  isLiveStreaming: boolean;
  onToggleLiveStream: () => void;
  unreadAlertsCount: number;
  onTriggerGlobalRefresh: () => void;
  user: AuthUser;
  onSignOut: () => void;
  realtimeEventHandler: (event: RealtimeEvent) => void;
}

export default function Header({ onSearchChange, searchQuery, isLiveStreaming, onToggleLiveStream, unreadAlertsCount, onTriggerGlobalRefresh, user, onSignOut, realtimeEventHandler }: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [transportStatus, setTransportStatus] = useState<RealtimeStatus>('closed');

  useEffect(() => {
    if (!isLiveStreaming) {
      setTransportStatus('closed');
      return;
    }
    const websocketUrl = import.meta.env.VITE_DASHBOARD_WS_URL;
    if (!websocketUrl) {
      setTransportStatus('closed');
      return;
    }
    const client = new RealtimeClient({ url: websocketUrl, token: 'preview-session-token', onEvent: realtimeEventHandler, onStatus: setTransportStatus });
    client.connect();
    return () => client.close();
  }, [isLiveStreaming, realtimeEventHandler]);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onTriggerGlobalRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Global Telemetry Synced', { description: 'Refresh request broadcast to all online agents.' });
    }, 800);
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-10 sticky top-0">
      <div className="flex items-center gap-4 w-96">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search hostname, serial, IP, or software..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-xs" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden xl:flex items-center gap-1.5 text-[10px] font-mono text-slate-500" title="Dashboard WebSocket transport status">
          {transportStatus === 'open' ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-slate-500" />}
          {transportStatus === 'open' ? 'WSS CONNECTED' : 'SIMULATED STREAM'}
        </span>
        <button onClick={onToggleLiveStream} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isLiveStreaming ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'}`} title="Toggle live telemetry stream">
          <Radio className={`w-3.5 h-3.5 ${isLiveStreaming ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
          <span>{isLiveStreaming ? 'Live Stream Active' : 'Stream Paused'}</span>
        </button>
        <Button variant="outline" size="sm" onClick={handleRefreshClick} disabled={isRefreshing} className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white h-9 text-xs gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          <span>{isRefreshing ? 'Polling...' : 'Refresh All'}</span>
        </Button>
        <div className="relative">
          <button aria-label="View notifications" className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors relative">
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold font-mono flex items-center justify-center shadow-md">{unreadAlertsCount}</span>}
          </button>
        </div>
        <div className="relative pl-3 border-l border-slate-800">
          <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2.5 text-left rounded-xl px-2 py-1 hover:bg-slate-800 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs font-mono">{user.role === 'admin' ? 'OP' : 'VW'}</div>
            <div className="hidden md:block"><div className="text-xs font-semibold text-slate-200">{user.email.split('@')[0]}</div><div className="text-[10px] text-blue-400 font-mono uppercase">{user.role} • ORG-ENTERPRISE-01</div></div>
          </button>
          {isProfileOpen && <div className="absolute right-0 top-12 w-56 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-2 z-20">
            <div className="px-3 py-2 border-b border-slate-800 mb-1"><p className="text-xs text-slate-200 font-semibold">{user.email}</p><p className="text-[10px] text-slate-500 font-mono mt-1">JWT SESSION • 15 MIN ACCESS</p></div>
            <button onClick={onSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl"><LogOut className="w-3.5 h-3.5" /> Sign out</button>
          </div>}
        </div>
      </div>
    </header>
  );
}
