import { useEffect, useState } from 'react';
import { EnrollmentToken, MSIBuilderStatus, MSIBuildJob, MSISignMode } from '../types';

export const getMSIBuildStatusLabel = (job: MSIBuildJob) => {
  if (job.status === 'pending') return 'queued';
  if (job.status === 'running') return 'building';
  if (job.status === 'succeeded') return job.isSigned && job.certificateTrusted ? 'trusted-signed' : 'unsigned-test';
  return 'failed';
};
import { KeyRound, Plus, Copy, Check, ShieldCheck, Download, Hammer, AlertTriangle, Loader2, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '../lib/api';

interface EnrollmentTokensProps {
  tokens: EnrollmentToken[];
  onCreateToken: () => void;
  canWrite: boolean;
  accessToken?: string;
}

function formatBytes(value: number) {
  if (!value) return '—';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function EnrollmentTokens({ tokens, onCreateToken, canWrite, accessToken }: EnrollmentTokensProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [agentVersion, setAgentVersion] = useState('2.4.5');
  const [apiBaseUrl, setApiBaseUrl] = useState(() => window.localStorage.getItem('sentinelpulse.apiBaseUrl') ?? 'http://127.0.0.1:8080');
  const [endpointId, setEndpointId] = useState(() => window.localStorage.getItem('sentinelpulse.endpointId') || 'DESKTOP-1E02MC9');
  const [signMode, setSignMode] = useState<MSISignMode>('self_signed_test');
  const [builderStatus, setBuilderStatus] = useState<MSIBuilderStatus | null>(null);
  const [builds, setBuilds] = useState<MSIBuildJob[]>([]);
  const [isLoadingBuildState, setIsLoadingBuildState] = useState(false);
  const [isQueueingBuild, setIsQueueingBuild] = useState(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  const loadBuildState = async () => {
    if (!accessToken || !canWrite) return;
    setIsLoadingBuildState(true);
    try {
      const [status, history] = await Promise.all([
        api.msiBuilderStatus(accessToken),
        api.listMSIBuilds(accessToken),
      ]);
      setBuilderStatus(status);
      setBuilds(history);
    } catch (error) {
      console.error('[MSI Builder Status Error]', error);
    } finally {
      setIsLoadingBuildState(false);
    }
  };

  useEffect(() => {
    void loadBuildState();
    if (!accessToken || !canWrite) return;
    const timer = window.setInterval(() => void loadBuildState(), 5000);
    return () => window.clearInterval(timer);
  }, [accessToken, canWrite]);

  const handleQueueBuild = async () => {
    if (!canWrite || !accessToken) {
      toast.error('Admin role required', { description: 'Only admins can build and sign installers.' });
      return;
    }
    let effectiveSignMode = signMode;
    if (signMode === 'trusted' && (!builderStatus?.available || !builderStatus.certificateTrusted)) {
      effectiveSignMode = 'self_signed_test';
    }
    const normalizedApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, '');
    const normalizedEndpointId = endpointId.trim();
    if (!/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(normalizedApiBaseUrl)) {
      toast.error('Enter a valid local API base URL', { description: 'Example: http://127.0.0.1:8080 or http://10.73.99.58:8080' });
      return;
    }
    if (!normalizedEndpointId || /\s/.test(normalizedEndpointId)) {
      toast.error('Enter an endpoint name', { description: 'Use the Windows computer name or another stable identifier without spaces.' });
      return;
    }
    window.localStorage.setItem('sentinelpulse.apiBaseUrl', normalizedApiBaseUrl);
    window.localStorage.setItem('sentinelpulse.endpointId', normalizedEndpointId);
    setIsQueueingBuild(true);
    try {
      await api.createMSIBuild(accessToken, agentVersion, effectiveSignMode, {
        apiBaseUrl: normalizedApiBaseUrl,
        endpointId: normalizedEndpointId,
        automaticEnrollment: true,
      });
      toast.success(`SentinelPulse Agent ${agentVersion} build queued`, { description: effectiveSignMode === 'trusted' ? 'The Windows runner will compile and sign the executable and MSI.' : 'This build is for internal testing and is not trusted by Windows by default.' });
      await loadBuildState();
    } catch (error) {
      toast.error('MSI build could not be queued', { description: error instanceof Error ? error.message : 'The backend rejected the build request.' });
    } finally {
      setIsQueueingBuild(false);
    }
  };

  const handleDownload = async (job: MSIBuildJob) => {
    if (!accessToken || job.status !== 'succeeded') return;
    setDownloadingJobId(job.id);
    try {
      await api.downloadMSI(accessToken, job.id);
      toast.success(`${job.artifactFilename ?? 'MSI'} download started`, { description: `SHA-256: ${job.sha256 ?? 'available in the build manifest'}` });
    } catch (error) {
      toast.error('MSI download failed', { description: error instanceof Error ? error.message : 'The artifact is unavailable.' });
    } finally {
      setDownloadingJobId(null);
    }
  };

  const handleDownloadManifest = async (job: MSIBuildJob) => {
    if (!accessToken || job.status !== 'succeeded' || !job.checksumFilename) return;
    try {
      await api.downloadMSIManifest(accessToken, job.id);
      toast.success(`${job.checksumFilename} download started`);
    } catch (error) {
      toast.error('Checksum manifest download failed', { description: error instanceof Error ? error.message : 'The checksum manifest is unavailable.' });
    }
  };

  const handleDownloadLatest = async () => {
    if (!accessToken || !canWrite) {
      toast.error('Admin role required', { description: 'Only admins can download MSI installers.' });
      return;
    }
    try {
      await api.downloadLatestMSI(accessToken);
      toast.success('Latest MSI download started', { description: 'Check your browser Downloads folder.' });
    } catch (error) {
      toast.error('No compiled MSI is available', { description: error instanceof Error ? error.message : 'Build an MSI first and make sure the Windows runner has reported it.' });
    }
  };

  const handleCopy = (tokenStr: string, id: string) => {
    void navigator.clipboard.writeText(tokenStr);
    setCopiedId(id);
    toast.success('Enrollment token copied to clipboard');
  };

  const trustedReady = Boolean(builderStatus?.available && builderStatus.certificateTrusted);
  const buildStatusLabel = (job: MSIBuildJob) => getMSIBuildStatusLabel(job);
  const testReady = Boolean(builderStatus?.available);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Agent Enrollment & Installers</h2>
          <p className="text-sm text-slate-400 mt-1">Issue tenant-scoped enrollment credentials and create versioned Windows installers from the connected build host.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            disabled={!canWrite || isQueueingBuild}
            onClick={handleQueueBuild}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 shadow-lg shadow-blue-900/20"
          >
            {isQueueingBuild ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}
            Compile MSI
          </Button>
          <Button
            disabled={!canWrite || !accessToken}
            onClick={() => void handleDownloadLatest()}
            title="Download the newest compiled MSI from the shared artifact folder"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 shadow-lg shadow-emerald-900/20"
          >
            <Download className="w-4 h-4" />
            Download generated MSI
          </Button>
          <Button
            disabled={!canWrite}
            onClick={onCreateToken}
            title={canWrite ? 'Generate enrollment token' : 'Admin role required'}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold gap-2 border border-slate-700"
          >
            <Plus className="w-4 h-4" />
            Generate Token
          </Button>
        </div>
      </div>

      {canWrite && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-blue-400" /> Versioned Windows MSI builder</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">The Docker backend queues the build. A Windows runner performs dotnet publish, WiX packaging, Authenticode signing, checksum generation, and manifest reporting without exposing the private signing key.</p>
            </div>
            <div className={`inline-flex items-center gap-2 text-[10px] font-mono uppercase px-3 py-1.5 rounded-full border ${builderStatus?.available ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
              <span className={`w-2 h-2 rounded-full ${builderStatus?.available ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {builderStatus?.available ? 'Windows runner online' : 'Windows runner offline'}
            </div>
          </div>

          {!builderStatus?.available && <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-400"><p className="font-semibold text-slate-200">Manual builder key setup</p><p className="mt-1">Generate the platform-to-runner key once on the Windows host, store it in the ignored <code className="text-blue-300">deployment/.env</code>, restart the backend and runner, then refresh this page.</p><code className="mt-3 block rounded-lg bg-black/40 p-3 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\agent\\packaging\\generate-builder-key.ps1\n# then restart deployment backend and SentinelPulse MSI Builder</code></div>}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <label className="space-y-2 text-xs"><span className="font-semibold text-slate-300 block">Agent version</span><input value={agentVersion} onChange={event => setAgentVersion(event.target.value)} placeholder="2.4.4" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono focus:outline-none focus:border-blue-500" /></label>
            <label className="space-y-2 text-xs"><span className="font-semibold text-slate-300 block">Local Server API URL</span><input value={apiBaseUrl} onChange={event => setApiBaseUrl(event.target.value)} placeholder="http://127.0.0.1:8080" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono focus:outline-none focus:border-blue-500" /></label>
            <label className="space-y-2 text-xs"><span className="font-semibold text-slate-300 block">Endpoint name</span><input value={endpointId} onChange={event => setEndpointId(event.target.value)} placeholder="DESKTOP-1E02MC9" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono focus:outline-none focus:border-blue-500" /></label>
            <label className="space-y-2 text-xs"><span className="font-semibold text-slate-300 block">Signing mode</span><select value={signMode} onChange={event => setSignMode(event.target.value as MSISignMode)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 font-mono focus:outline-none focus:border-blue-500"><option value="trusted">Trusted certificate (production)</option><option value="self_signed_test">Self-signed test certificate (untrusted)</option><option value="unsigned_test">Unsigned test MSI</option></select></label>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs space-y-1"><p className="text-slate-400">Certificate status</p><p className={trustedReady ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>{builderStatus?.certificateTrusted ? 'Trusted code-signing certificate ready' : 'No trusted certificate reported'}</p><p className="text-slate-500 truncate" title={builderStatus?.certificateSubject}>{builderStatus?.certificateSubject ?? builderStatus?.message ?? 'Waiting for runner heartbeat'}</p></div>
          </div>

          {signMode === 'trusted' && !trustedReady && <div className="flex gap-2 items-start text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>Trusted mode is intentionally blocked until a real code-signing certificate is installed on the Windows runner. Do not treat a self-signed certificate as production trust.</span></div>}
          {signMode !== 'trusted' && !testReady && <div className="flex gap-2 items-start text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>Start the Windows runner before queuing a test build. Test mode does not provide Windows publisher trust.</span></div>}

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-3"><Download className="w-4 h-4 text-emerald-400 mt-0.5" /><div><p className="text-sm font-semibold text-slate-100">Download latest compiled MSI</p><p className="text-xs text-slate-400 mt-1">Downloads the newest `.msi` file from the shared artifact folder. If no build exists yet, the button will explain what is missing.</p></div></div>
            <Button size="sm" onClick={() => void handleDownloadLatest()} disabled={!canWrite || !accessToken} className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"><Download className="w-3.5 h-3.5" />Download latest MSI</Button>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3"><p className="text-xs font-semibold text-slate-300">Recent build jobs</p><Button variant="ghost" size="sm" onClick={() => void loadBuildState()} disabled={isLoadingBuildState} className="text-xs text-slate-400 hover:text-white">{isLoadingBuildState ? 'Refreshing…' : 'Refresh'}</Button></div>
            {builds.length === 0 ? <p className="text-xs text-slate-500">No MSI builds have been queued for this organization.</p> : <div className="space-y-2">{builds.slice(0, 5).map(job => <div key={job.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-slate-200 font-semibold">v{job.agentVersion}</span><span className={`rounded-full px-2.5 py-0.5 border text-[11px] font-medium ${job.status === 'succeeded' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : job.status === 'failed' ? 'text-rose-400 border-rose-500/20 bg-rose-500/10' : 'text-amber-400 border-amber-500/20 bg-amber-500/10'}`}>{buildStatusLabel(job)}</span><span className="text-slate-400 font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{job.signMode}</span>{job.isSigned ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"><BadgeCheck className="w-3.5 h-3.5" /> Authenticode Signed</span> : <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Unsigned Test</span>}</div><p className="text-slate-400 truncate">{job.artifactFilename ?? job.errorMessage ?? `Queued ${formatDate(job.createdAt)}`}</p>{job.sha256 && <p className="text-[11px] text-slate-500 font-mono truncate" title={job.sha256}>SHA-256: {job.sha256}{job.checksumFilename ? ` • ${job.checksumFilename}` : ''}</p>}{job.certificateSubject && <p className="text-[11px] text-slate-500 font-mono truncate">Cert: {job.certificateSubject}</p>}</div>
<div className="flex items-center gap-3 shrink-0"><span className="text-slate-500 font-mono">{formatBytes(job.sizeBytes)}</span>{job.status === 'succeeded' ? <><Button size="sm" onClick={() => void handleDownload(job)} disabled={downloadingJobId === job.id} className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5">{downloadingJobId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download MSI</Button>{job.checksumFilename && <Button size="sm" variant="outline" onClick={() => void handleDownloadManifest(job)} className="h-8 border-slate-700 bg-slate-900 text-slate-200 gap-1.5"><Download className="w-3.5 h-3.5" /> Manifest</Button>}</> : <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-500"><Download className="w-3.5 h-3.5" /> Download after success</span>}</div></div>)}</div>}
          </div>
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20"><KeyRound className="w-5 h-5" /></div><div><h3 className="text-base font-semibold text-white">Active Cryptographic Tokens</h3><p className="text-xs text-slate-400">Tokens are hashed with SHA-256 in PostgreSQL. Plaintext values are shown only once upon generation.</p></div></div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-mono"><ShieldCheck className="w-3.5 h-3.5" /> DPAPI Protected</div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 bg-slate-950/40"><th className="py-4 px-6">Token ID</th><th className="py-4 px-6">Token Prefix / Hash</th><th className="py-4 px-6">Status</th><th className="py-4 px-6">Created At</th><th className="py-4 px-6">Expires At</th><th className="py-4 px-6 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-800/60 text-sm">{tokens.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-500">No active enrollment tokens found. Generate one to onboard Windows agents.</td></tr> : tokens.map(token => <tr key={token.id} className="hover:bg-slate-800/30 transition-colors"><td className="py-4 px-6 font-mono text-xs text-slate-300">TOKEN-{token.id}</td><td className="py-4 px-6 font-mono text-xs text-slate-400">{token.plainToken ? <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 select-all">{token.plainToken}</span> : <span className="text-slate-500">sha256:{token.tokenHash.substring(0, 16)}...</span>}</td><td className="py-4 px-6">{token.usedByEndpointId ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">Consumed (Endpoint #{token.usedByEndpointId})</span> : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active & Ready</span>}</td><td className="py-4 px-6 text-xs text-slate-400">{new Date(token.createdAt).toLocaleString()}</td><td className="py-4 px-6 text-xs text-slate-400">{new Date(token.expiresAt).toLocaleString()}</td><td className="py-4 px-6 text-right">{token.plainToken && <Button variant="ghost" size="sm" onClick={() => handleCopy(token.plainToken!, token.id.toString())} className="h-8 text-slate-300 hover:text-white hover:bg-slate-800">{copiedId === token.id.toString() ? <><Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />Copied</> : <><Copy className="w-3.5 h-3.5 mr-1" />Copy Secret</>}</Button>}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
}
