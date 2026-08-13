import React, { useState, type FormEvent } from 'react';
import { Activity, ShieldCheck, Building2, Server, UserCheck, LockKeyhole, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SetupPageProps {
  onSetupCompleted: () => void;
}

export default function SetupPage({ onSetupCompleted }: SetupPageProps) {
  const [companyName, setCompanyName] = useState('Acme Enterprise Corp');
  const [localIp, setLocalIp] = useState('127.0.0.1:8080');
  const [adminEmail, setAdminEmail] = useState('admin@enterprise.local');
  const [adminPassword, setAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    if (adminPassword.length < 8) {
      toast.error('Password too short', { description: 'Admin password must be at least 8 characters.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          local_ip: localIp,
          admin_email: adminEmail,
          admin_password: adminPassword,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error?.message || 'Setup initialization failed.');
      }
      toast.success('Platform initialized', { description: 'Company profile and admin account created successfully.' });
      onSetupCompleted();
    } catch (error) {
      toast.error('Setup failed', { description: error instanceof Error ? error.message : 'Unable to complete setup.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute -bottom-44 -left-40 w-[30rem] h-[30rem] rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-8 sm:p-10 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-extrabold text-xl tracking-tight">Sentinel<span className="text-blue-400">Pulse</span></p>
            <p className="font-mono text-[10px] text-slate-400 tracking-[0.2em]">FIRST-RUN PLATFORM SETUP</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1.5 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Initial Configuration Wizard
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Configure your monitoring gateway</h1>
          <p className="text-sm text-slate-400 mt-1">Define your organization identity, local server binding, and administrative credentials.</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-blue-400" /> Company Name</span>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><Server className="w-3.5 h-3.5 text-blue-400" /> Local Server IP / Base URL</span>
            <input value={localIp} onChange={(e) => setLocalIp(e.target.value)} required placeholder="127.0.0.1:8080" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-blue-400" /> Admin Email / Username</span>
            <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} type="email" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><LockKeyhole className="w-3.5 h-3.5 text-blue-400" /> Admin Password</span>
            <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} type="password" required minLength={8} placeholder="Min 8 characters" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </label>

          <Button disabled={isSubmitting} type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 shadow-lg shadow-blue-600/20 mt-2">
            {isSubmitting ? 'Initializing Gateway...' : 'Complete Setup & Enter Login'}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}
