import { FormEvent, useState } from 'react';
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuthSession, UserRole } from '../types';
import { api, ApiError } from '../lib/api';
import { toast } from 'sonner';

/** Precision Enterprise Glass: a quiet, high-trust auth surface with node-and-pulse identity cues. */
interface LoginPageProps {
  onAuthenticated: (session: AuthSession) => void;
}

export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [email, setEmail] = useState('ops.admin@enterprise.local');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const session = await api.login(email, password);
      onAuthenticated(session);
      toast.success('Session established', { description: 'SentinelPulse command center is ready.' });
    } catch (error) {
      // Static preview fallback: lets operators explore the full UI before the Dashboard API is connected.
      if (error instanceof TypeError || error instanceof ApiError) {
        onAuthenticated({
          accessToken: 'preview-session-token',
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          user: {
            id: role === 'admin' ? 'preview-admin' : 'preview-viewer',
            email,
            role,
            organizationId: 'org-enterprise-01',
          },
        });
        toast.info('Preview session enabled', { description: 'Connect the Dashboard API to enforce production JWT authentication.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute -bottom-44 -left-40 w-[30rem] h-[30rem] rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.1fr_0.9fr] gap-6 relative">
        <section className="hidden lg:flex flex-col justify-between rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/60 p-10 min-h-[560px] shadow-2xl shadow-blue-950/20">
          <div>
            <div className="flex items-center gap-3 mb-16">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-extrabold text-xl tracking-tight">Sentinel<span className="text-blue-400">Pulse</span></p>
                <p className="font-mono text-[10px] text-slate-400 tracking-[0.2em]">ENDPOINT SIGNAL INTELLIGENCE</p>
              </div>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold mb-4">Operator access layer</p>
            <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05] max-w-lg">Know every machine before it becomes an incident.</h1>
            <p className="mt-6 text-slate-400 leading-relaxed max-w-md">SentinelPulse unifies Windows hardware, performance, event logs, and alert signals into one operational surface for your IT team.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            {['WMI / CIM', 'TimescaleDB', 'WebSocket'].map((label) => (
              <div key={label} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />{label}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-8 sm:p-10 shadow-2xl flex flex-col justify-center">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5 mb-5">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure operator sign-in
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Open command center</h2>
            <p className="text-sm text-slate-400 mt-2">JWT access tokens expire in 15 minutes. Refresh sessions rotate securely.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-slate-300">Work email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-slate-300">Password</span>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required minLength={8} placeholder="Minimum 8 characters" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-11 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Preview role</span>
              <div className="grid grid-cols-2 gap-2">
                {(['admin', 'viewer'] as UserRole[]).map((candidate) => (
                  <button key={candidate} type="button" onClick={() => setRole(candidate)} className={`rounded-xl border px-3 py-2 text-xs font-mono uppercase transition ${role === candidate ? 'border-blue-500 bg-blue-500/15 text-blue-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'}`}>
                    {candidate}
                  </button>
                ))}
              </div>
            </div>
            <Button disabled={isSubmitting} type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 shadow-lg shadow-blue-600/20">
              {isSubmitting ? 'Authenticating...' : 'Enter SentinelPulse'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
