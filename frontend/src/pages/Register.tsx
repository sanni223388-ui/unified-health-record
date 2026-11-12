import React, { useState } from 'react';

export const Register: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('https://unified-health-record.onrender.com/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, fullName, email, password })
    });
    if (res.ok) {
      setMsg('Account created! Redirecting to login...');
      setTimeout(() => onNavigate('login'), 1200);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Register Account</h2>
        {msg && <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded mb-4">{msg}</div>}
        <div className="flex bg-slate-100 p-1 rounded-lg mb-4 text-xs font-semibold">
          <button type="button" onClick={() => setRole('patient')} className={`flex-1 py-1.5 rounded ${role==='patient'?'bg-white shadow':''}`}>Patient</button>
          <button type="button" onClick={() => setRole('doctor')} className={`flex-1 py-1.5 rounded ${role==='doctor'?'bg-white shadow':''}`}>Doctor</button>
        </div>
        <form onSubmit={handleRegister} className="space-y-3 text-sm">
          <input className="w-full border p-2.5 rounded-lg" placeholder="Full Name" value={fullName} onChange={e=>setFullName(e.target.value)} required/>
          <input className="w-full border p-2.5 rounded-lg" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>
          <input className="w-full border p-2.5 rounded-lg" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/>
          <button className="w-full py-2.5 bg-cyan-600 text-white rounded-lg font-semibold">Create Account</button>
        </form>
        <button onClick={() => onNavigate('login')} className="mt-4 text-xs text-cyan-600 block text-center w-full">Back to Login</button>
      </div>
    </div>
  );
};
