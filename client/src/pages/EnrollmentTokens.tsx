import { useState } from 'react';
import { EnrollmentToken } from '../types';
import { KeyRound, Plus, Copy, Check, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface EnrollmentTokensProps {
  tokens: EnrollmentToken[];
  onCreateToken: () => void;
  canWrite: boolean;
}

export default function EnrollmentTokens({ tokens, onCreateToken, canWrite }: EnrollmentTokensProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [agentVersion, setAgentVersion] = useState('2.4.1');
  const buildMsiMutation = trpc.reports.buildMsi.useMutation({
    onSuccess: result => {
      if (result.status !== 'succeeded') {
        toast.error('MSI build did not produce an artifact', { description: result.reason });
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = `/artifacts/${result.artifactPath.split('/').pop()}`;
      anchor.download = '';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success(`MSI ${agentVersion} is ready`, { description: 'The versioned installer download has started.' });
    },
    onError: error => toast.error('MSI build failed', { description: error.message }),
  });

  const handleCopy = (tokenStr: string, id: string) => {
    navigator.clipboard.writeText(tokenStr);
    setCopiedId(id);
    toast.success('Enrollment token copied to clipboard');
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Agent Enrollment Tokens</h2>
          <p className="text-sm text-slate-400 mt-1">Secure enrollment tokens used by Windows background agents during initial registration.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={agentVersion} onChange={event => setAgentVersion(event.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono outline-none focus:border-blue-500">
            <option value="2.4.1">Agent v2.4.1 (LTS)</option>
            <option value="2.5.0">Agent v2.5.0 (Beta)</option>
          </select>
          <Button
            disabled={!canWrite || buildMsiMutation.isPending}
            onClick={() => buildMsiMutation.mutate({ version: agentVersion })}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold gap-2 border border-slate-700"
          >
            {buildMsiMutation.isPending ? 'Building MSI...' : 'Build & Download MSI'}
          </Button>
          <Button
            disabled={!canWrite}
            onClick={() => {
              onCreateToken();
              if (canWrite) toast.success('New enrollment token generated successfully');
            }}
            title={canWrite ? 'Generate enrollment token' : 'Admin role required'}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 shadow-lg shadow-blue-900/20"
          >
            <Plus className="w-4 h-4" />
            Generate New Token
          </Button>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Active Cryptographic Tokens</h3>
              <p className="text-xs text-slate-400">Tokens are hashed with SHA-256 in PostgreSQL. Plaintext values are shown only once upon generation.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            DPAPI Protected
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 bg-slate-950/40">
                <th className="py-4 px-6">Token ID</th>
                <th className="py-4 px-6">Token Prefix / Hash</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Created At</th>
                <th className="py-4 px-6">Expires At</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {tokens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No active enrollment tokens found. Generate one to onboard Windows agents.
                  </td>
                </tr>
              ) : (
                tokens.map(token => (
                  <tr key={token.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 font-mono text-xs text-slate-300">
                      TOKEN-{token.id}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-slate-400">
                      {token.plainToken ? (
                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 select-all">
                          {token.plainToken}
                        </span>
                      ) : (
                        <span className="text-slate-500">sha256:{token.tokenHash.substring(0, 16)}...</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {token.usedByEndpointId ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Consumed (Endpoint #{token.usedByEndpointId})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active & Ready
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      {new Date(token.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      {new Date(token.expiresAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {token.plainToken && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(token.plainToken!, token.id.toString())}
                          className="h-8 text-slate-300 hover:text-white hover:bg-slate-800"
                        >
                          {copiedId === token.id.toString() ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copy Secret
                            </>
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
