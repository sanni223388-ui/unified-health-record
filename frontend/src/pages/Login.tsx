import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, AlertCircle } from 'lucide-react';

export const Login: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      login(data.token, data.user);
      if (data.user.role === 'patient') onNavigate('patient-dashboard');
      else if (data.user.role === 'doctor') onNavigate('doctor-dashboard');
      else onNavigate('admin-dashboard');
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const setDemo = (eMail: string) => {
    setEmail(eMail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-6">Portal Sign In</h2>
        {err && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg mb-4">{err}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full border p-2.5 rounded-lg text-sm" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required/>
          <input className="w-full border p-2.5 rounded-lg text-sm" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required/>
          <button className="w-full py-2.5 bg-cyan-600 text-white rounded-lg font-semibold text-sm">Sign In</button>
        </form>
        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-xs text-slate-500 mb-2">Demo Logins (Password: Password123!)</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button onClick={() => setDemo('patient@example.com')} className="p-1.5 bg-slate-100 rounded">Patient</button>
            <button onClick={() => setDemo('dr.smith@example.com')} className="p-1.5 bg-slate-100 rounded">Doctor</button>
            <button onClick={() => setDemo('admin@example.com')} className="p-1.5 bg-slate-100 rounded">Admin</button>
          </div>
        </div>
      </div>
    </div>
  );
};
