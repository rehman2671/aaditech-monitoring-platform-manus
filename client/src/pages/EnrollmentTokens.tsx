import { useState } from 'react';
import { EnrollmentToken } from '../types';
import { KeyRound, Plus, Copy, Check, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface EnrollmentTokensProps {
  tokens: EnrollmentToken[];
  onCreateToken: () => void;
  canWrite: boolean;
}

export default function EnrollmentTokens({ tokens, onCreateToken, canWrite }: EnrollmentTokensProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (tokenStr: string, id: string) => {
    navigator.clipboard.writeText(tokenStr);
    setCopiedId(id);
    toast.success('Enrollment token copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Agent Enrollment Tokens</h2>
          <p className="text-sm text-slate-400 mt-1">Secure enrollment tokens used by Windows background agents during initial registration.</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono outline-none focus:border-blue-500">
            <option value="v2.4.1">Agent v2.4.1 (LTS)</option>
            <option value="v2.5.0">Agent v2.5.0 (Beta)</option>
          </select>
          <Button
            disabled={!canWrite}
            onClick={() => {
              toast.promise(new Promise(r => setTimeout(r, 2000)), {
                loading: 'Compiling versioned MSI package...',
                success: 'MSI Build Ready: sentinelpulse-agent-v2.4.1.msi',
                error: 'Build pipeline failed',
              });
            }}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold gap-2 border border-slate-700"
          >
            Build & Download MSI
          </Button>
          <Button
            disabled={!canWrite}
            onClick={() => {
              onCreateToken();
              if (canWrite) toast.success('New enrollment token generated successfully');
            }}
            title={canWrite ? 'Generate enrollment token' : 'Admin role required'}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {canWrite ? 'New Token' : 'Admin Required'}
          </Button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <h3 className="text-base font-bold text-white mb-4">Active & Historical Tokens</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase">
                <th className="py-3 px-4">Token ID / Hash</th>
                <th className="py-3 px-4">Plain Token Secret</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4">Expires At</th>
                <th className="py-3 px-4">Usage Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tokens.map(tok => (
                <tr key={tok.id} className="hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-bold text-white">
                    {tok.id}
                  </td>
                  <td className="py-3.5 px-4 text-blue-400">
                    {tok.plainToken ? tok.plainToken : '••••••••••••••••••••••••••••••••'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {new Date(tok.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    {new Date(tok.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4">
                    {tok.usedByEndpointId ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">
                        Used by Endpoint
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">
                        Active / Unused
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {tok.plainToken && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(tok.plainToken!, tok.id)}
                        className="bg-slate-800 border-slate-700 text-slate-200 h-7 text-xs gap-1"
                      >
                        {copiedId === tok.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === tok.id ? 'Copied' : 'Copy'}</span>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
