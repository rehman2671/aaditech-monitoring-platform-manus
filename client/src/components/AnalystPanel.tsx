import React, { useState } from 'react';
import { BrainCircuit, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AnalystResponse,
  fetchLatestEndpointAnalyst,
  runEndpointAnalyst,
} from '@/lib/sentinelApi';

type AnalystPanelProps = { endpointId: string };

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export default function AnalystPanel({ endpointId }: AnalystPanelProps) {
  const [result, setResult] = useState<AnalystResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const runAnalysis = async () => {
    setBusy(true);
    try {
      setResult(await runEndpointAnalyst(endpointId));
      toast.success('Analyst snapshot complete');
    } catch (error) {
      toast.error('Analyst analysis unavailable', { description: error instanceof Error ? error.message : 'Request failed' });
    } finally {
      setBusy(false);
    }
  };

  const loadCached = async () => {
    setBusy(true);
    try {
      setResult(await fetchLatestEndpointAnalyst(endpointId));
    } catch (error) {
      toast.error('No cached analyst result', { description: error instanceof Error ? error.message : 'Request failed' });
    } finally {
      setBusy(false);
    }
  };

  const assessment = result?.assessment;
  const findings = safeArray(assessment?.findings);
  const positiveFindings = safeArray(assessment?.positive_findings);
  const dataQualityIssues = safeArray(assessment?.data_quality_issues);
  const recommendedSteps = safeArray(assessment?.recommended_steps);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-300 flex items-center justify-center"><BrainCircuit className="w-5 h-5" /></div>
          <div>
            <h3 className="text-base font-bold text-white">AI Analyst</h3>
            <p className="text-xs text-slate-400 mt-1">Optional local Ollama explanation over tenant-scoped collected evidence. It cannot change measurements or execute remediation.</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={loadCached} disabled={busy} variant="outline" className="bg-slate-950 border-slate-700 text-slate-300">Load cached</Button>
          <Button onClick={runAnalysis} disabled={busy} className="bg-blue-600 hover:bg-blue-500">{busy ? 'Analyzing…' : 'Analyze evidence'}</Button>
        </div>
      </div>

      {!result && <div className="border border-dashed border-slate-700 rounded-xl p-5 text-sm text-slate-400">No analyst result loaded. Run analysis only when you need a local, evidence-bound interpretation.</div>}

      {result && !result.available && (
        <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl p-5 flex gap-3 text-sm text-amber-200">
          <Clock3 className="w-5 h-5 shrink-0" />
          <div><p className="font-semibold">AI analysis unavailable</p><p className="text-amber-200/75 mt-1">{result.reason || 'No valid local analyst result was returned.'} Deterministic telemetry remains authoritative.</p></div>
        </div>
      )}

      {result?.available && assessment && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-950 rounded-xl p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500">Overall risk</p><p className="text-xl font-bold text-white mt-1">{assessment.overall_risk || 'UNKNOWN'}</p></div>
            <div className="bg-slate-950 rounded-xl p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500">AI confidence</p><p className="text-xl font-bold text-white mt-1">{Math.round((Number.isFinite(assessment.confidence) ? assessment.confidence : 0) * 100)}%</p></div>
            <div className="bg-slate-950 rounded-xl p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500">Evidence reviewed</p><p className="text-xl font-bold text-white mt-1">{result.evidence_count || 'Cached'}</p></div>
          </div>
          <div><p className="text-sm text-slate-200 leading-6">{assessment.summary || 'No analyst summary was returned.'}</p><p className="text-[11px] text-slate-500 font-mono mt-2">Evidence hash: {result.evidence_hash || 'Unavailable'}</p></div>

          {findings.length > 0 ? <div className="space-y-3"><h4 className="text-sm font-semibold text-white">Evidence-linked findings</h4>{findings.map((finding) => <div key={finding.finding_id} className="border border-slate-800 rounded-xl p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-100">{finding.title}</p><span className="text-[11px] font-mono text-slate-400">{finding.severity} · {Math.round((Number.isFinite(finding.confidence) ? finding.confidence : 0) * 100)}%</span></div><p className="text-xs text-slate-400 mt-2">{finding.description}</p><p className="text-[11px] text-slate-500 font-mono mt-2">Evidence: {safeArray(finding.evidence_ids).join(', ') || 'Unavailable'}</p></div>)}</div> : <div className="flex gap-2 text-sm text-emerald-300"><CheckCircle2 className="w-4 h-4" />No actionable finding was returned for the supplied evidence.</div>}

          {positiveFindings.length > 0 && <div><h4 className="text-sm font-semibold text-white mb-2">Positive observations</h4><ul className="text-xs text-slate-400 space-y-1 list-disc pl-5">{positiveFindings.map(item => <li key={item}>{item}</li>)}</ul></div>}
          {dataQualityIssues.length > 0 && <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4"><h4 className="text-sm font-semibold text-amber-200 flex items-center gap-2"><ShieldAlert className="w-4 h-4" />Data-quality limitations</h4><ul className="text-xs text-amber-100/70 space-y-1 list-disc pl-5 mt-2">{dataQualityIssues.map(item => <li key={item}>{item}</li>)}</ul></div>}
          {recommendedSteps.length > 0 && <div><h4 className="text-sm font-semibold text-white mb-2">Read-only next steps</h4><ul className="text-xs text-slate-400 space-y-1 list-disc pl-5">{recommendedSteps.map(item => <li key={item}>{item}</li>)}</ul></div>}
        </div>
      )}
    </div>
  );
}
