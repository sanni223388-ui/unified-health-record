import React, { useState, useEffect } from 'react';
import { useHealthRecord } from '../context/HealthRecordContext';
import { Activity, ShieldCheck, Lock, Mail, ArrowRight, UserCheck, Stethoscope, Crown, AlertCircle, CheckCircle2, UserPlus, User } from 'lucide-react';

const API_BASE = 'https://unified-health-record.onrender.com';

export const UniversalLoginPage: React.FC = () => {
  const { setActiveRole, setIsAuthenticated, setCurrentUser } = useHealthRecord();
  const [mode, setMode] = useState<'login' | 'register' | 'setup-admin'>('login');
  const [role, setRole] = useState<'patient' | 'doctor' | 'admin'>('patient');
  const [hasAdmin, setHasAdmin] = useState<boolean>(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`).then(r => r.json()).then(d => {
      if (typeof d.hasAdmin === 'boolean') setHasAdmin(d.hasAdmin);
    }).catch(() => {});
  }, []);

  const handleRoleSelect = (r: 'patient' | 'doctor' | 'admin') => {
    setRole(r); setMode('login'); setError(null); setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccessMsg(null);

    try {
      if (mode === 'register' || mode === 'setup-admin') {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountType: mode === 'setup-admin' ? 'admin' : 'patient', fullName, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        
        setSuccessMsg(data.message);
        if (mode === 'setup-admin') setHasAdmin(true);
        setMode('login'); setPassword('');
      } else if (mode === 'login') {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, expectedRole: role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        localStorage.setItem('uhr_jwt_token', data.token);
        localStorage.setItem('uhr_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setActiveRole(data.user.role);
        setIsAuthenticated(true);
              }
    } catch (err: any) {
      setError(err.message || 'Server error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Activity className="w-10 h-10 text-cyan-400 mx-auto mb-2" />
          <h1 className="text-2xl font-black">Unified<span className="text-cyan-400">Health</span></h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Government Compliant Clinical Network</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl">
          <div className="flex gap-2 mb-6 bg-slate-950 p-1 rounded-xl">
            {(['patient', 'doctor', 'admin'] as const).map(r => (
              <button key={r} type="button" onClick={() => handleRoleSelect(r)} className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize flex flex-col items-center gap-1 ${role === r ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>
                {r === 'patient' && <UserCheck className="w-4 h-4"/>}
                {r === 'doctor' && <Stethoscope className="w-4 h-4"/>}
                {r === 'admin' && <Crown className="w-4 h-4"/>}
                {r}
              </button>
            ))}
          </div>

          {error && <div className="mb-4 p-3 bg-rose-950 border border-rose-500 text-rose-300 text-xs rounded-xl">{error}</div>}
          {successMsg && <div className="mb-4 p-3 bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs rounded-xl">{successMsg}</div>}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {mode !== 'login' && (
              <div>
                <label className="block text-slate-400 uppercase font-bold mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" placeholder="John Doe" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-slate-400 uppercase font-bold mb-1">Email ID</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" placeholder="you@domain.com" />
              </div>
            </div>
            <div>
              <label className="block text-slate-400 uppercase font-bold mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none" placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
              {loading ? 'Processing...' : mode === 'login' ? 'Secure Sign In' : 'Create Account'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {role === 'patient' && (
            <div className="mt-4 text-center text-xs">
              <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-cyan-400 font-bold">
                {mode === 'login' ? 'New Patient? Create Account' : 'Back to Sign In'}
              </button>
            </div>
          )}
          {role === 'admin' && !hasAdmin && (
            <div className="mt-4 text-center text-xs">
              <button onClick={() => setMode(mode === 'login' ? 'setup-admin' : 'login')} className="text-purple-400 font-bold">
                {mode === 'login' ? 'First-Time Setup: Register Admin' : 'Back to Sign In'}
              </button>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-center items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Unique Health ID • Role-Based Privacy Enforced</span>
        </div>
      </div>
    </div>
  );
};
