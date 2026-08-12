import { useState } from 'react';
import { 
  Search, 
  Bell, 
  RefreshCw, 
  Radio, 
  CheckCircle2, 
  AlertTriangle,
  User,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface HeaderProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
  isLiveStreaming: boolean;
  onToggleLiveStream: () => void;
  unreadAlertsCount: number;
  onTriggerGlobalRefresh: () => void;
}

export default function Header({ 
  onSearchChange, 
  searchQuery, 
  isLiveStreaming, 
  onToggleLiveStream,
  unreadAlertsCount,
  onTriggerGlobalRefresh
}: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onTriggerGlobalRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Global Telemetry Synced', {
        description: 'All agent endpoints successfully pushed latest metrics.'
      });
    }, 1200);
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-10 sticky top-0">
      {/* Search Bar */}
      <div className="flex items-center gap-4 w-96">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search hostname, serial, IP, or software..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-xs"
          />
        </div>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-4">
        {/* Live WebSocket Simulator Toggle */}
        <button
          onClick={onToggleLiveStream}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            isLiveStreaming 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
          title="Toggle simulated real-time WebSocket telemetry stream"
        >
          <Radio className={`w-3.5 h-3.5 ${isLiveStreaming ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
          <span>{isLiveStreaming ? 'Live Stream Active' : 'Stream Paused'}</span>
        </button>

        {/* Global Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white h-9 text-xs gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          <span>{isRefreshing ? 'Polling Endpoints...' : 'Refresh All'}</span>
        </Button>

        {/* Notifications / Alerts Indicator */}
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer transition-colors relative">
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold font-mono flex items-center justify-center shadow-md">
                {unreadAlertsCount}
              </span>
            )}
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs font-mono">
            OP
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-slate-200">Ops Admin</div>
            <div className="text-[10px] text-slate-400 font-mono">ORG-ENTERPRISE-01</div>
          </div>
        </div>
      </div>
    </header>
  );
}
