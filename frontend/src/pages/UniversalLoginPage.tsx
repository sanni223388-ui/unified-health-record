import React, { useState, useEffect } from 'react';
import { useHealthRecord } from '../context/HealthRecordContext';
import {
  Activity,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  UserCheck,
  Stethoscope,
  Crown,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  User,
  Phone,
  MapPin,
  KeyRound,
  Send
} from 'lucide-react';
import confetti from 'canvas-confetti';

const API_BASE = 'https://unified-health-record.onrender.com';

async function fetchWithWakeRetry(url: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch {
    // Render free tier cold-start wake-up retry after 6 seconds
    await new Promise(r => setTimeout(r, 6000));
    return await fetch(url, options);
  }
}

export const UniversalLoginPage: React.FC = () => {
  const { setActiveRole, setIsAuthenticated, setCurrentUser } = useHealthRecord();
  const [mode, setMode] = useState<'login' | 'verify-2fa' | 'register' | 'setup-admin'>('login');
  const [role, setRole] = useState<'patient' | 'doctor' | 'admin'>('patient');
  const [hasAdmin, setHasAdmin] = useState<boolean>(true);
  const [serverStatus, setServerStatus] = useState<'waking' | 'online'>('waking');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('1998-01-01');
  const [gender, setGender] = useState('male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [allergies, setAllergies] = useState('');

  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchWithWakeRetry(`${API_BASE}/api/health`)
      .then(r => r.json())
      .then(d => {
        setServerStatus('online');
        if (typeof d.hasAdmin === 'boolean') setHasAdmin(d.hasAdmin);
      })
      .catch(() => {});
  }, []);

  const roleDescriptions = {
    patient: '2FA-protected personal medical reports, prescriptions & real doctor booking',
    doctor: '2FA-protected clinical ward: verify patient emails & commit medical records',
    admin: '2FA-protected hospital governance: register real doctors & view audit logs'
  };

  const handleRoleSelect = (selectedRole: 'patient' | 'doctor' | 'admin') => {
    setRole(selectedRole);
    setMode('login');
    setOtpCode('');
    setOtpSent(false);
    setError(null);
    setSuccessMsg(null);
  };

  const handleRequestRegistrationOtp = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!email.trim()) {
      setError('Enter your real email ID first to receive the 6-digit verification code.');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await fetchWithWakeRetry(`${API_BASE}/api/auth/request-register-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          accountType: mode === 'setup-admin' ? 'admin' : 'patient'
        })
      });
      const data = await res.json();
      setServerStatus('online');
      if (!res.ok) {
        const reference = typeof data.eventId === 'string' ? ` Reference: ${data.eventId}` : '';
        setError(`${data.message || 'Could not send verification code.'}${reference}`);
      } else {
        setOtpSent(true);
        setSuccessMsg(data.message);
      }
    } catch {
      setError('Backend is still starting up on Render. Wait 15 seconds and click Send OTP again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'register' || mode === 'setup-admin') {
        const res = await fetchWithWakeRetry(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountType: mode === 'setup-admin' ? 'admin' : 'patient',
            fullName,
            email,
            password,
            otp: otpCode,
            dob,
            gender,
            bloodGroup,
            phone,
            address,
            allergies
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || 'Verification failed.');
          setLoading(false);
          return;
        }
        if (mode === 'setup-admin') setHasAdmin(true);
        setSuccessMsg(data.message);
        setMode('login');
        setPassword('');
        setOtpCode('');
        setOtpSent(false);
        setLoading(false);
        return;
      }

      if (mode === 'login') {
        const response = await fetchWithWakeRetry(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, expectedRole: role })
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.message || 'Authentication failed.');
          setLoading(false);
          return;
        }
        if (data.requires2FA) {
          setMode('verify-2fa');
          setOtpCode('');
          setSuccessMsg(data.message);
          setLoading(false);
          return;
        }
      }

      if (mode === 'verify-2fa') {
        const response = await fetchWithWakeRetry(`${API_BASE}/api/auth/verify-2fa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: otpCode, expectedRole: role })
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.message || 'Invalid 2FA code.');
          setLoading(false);
          return;
        }
        localStorage.setItem('uhr_jwt_token', data.token);
        localStorage.setItem('uhr_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setActiveRole(data.user.role);
        setIsAuthenticated(true);
        confetti({ particleCount: 75, spread: 80, origin: { y: 0.6 } });
      }
    } catch {
      setError('Backend is still waking up on Render. Wait 15 seconds and click Submit again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 shadow-xl shadow-cyan-500/25 mb-3 border border-cyan-400/30">
            <Activity className="w-8 h-8 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Unified<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300">Health</span>
          </h1>
          <p className="text-[11px] text-cyan-400/80 font-mono tracking-widest uppercase mt-0.5 font-bold">
            2-Step Verified Hospital Clinical Network
          </p>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-5">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Select Portal Role
              </label>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                serverStatus === 'online'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {serverStatus === 'online' ? '● Server Online' : '◌ Connecting Server...'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleRoleSelect('patient')}
                className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  role === 'patient'
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Patient</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('doctor')}
                className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  role === 'doctor'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>Doctor</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('admin')}
                className={`py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                  role === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>Admin</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 text-center">
              {roleDescriptions[role]}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {mode === 'verify-2fa' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-[11px]">
                  2-Step Verification active for <strong className="font-mono">{email}</strong>. Even with your password, login is blocked without this email OTP.
                </div>
                <div>
                  <label className="block text-slate-400 uppercase font-bold mb-1">
                    Enter 6-Digit 2FA Code
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-cyan-500/50 rounded-xl text-white font-mono text-base tracking-[0.4em] outline-none"
                      placeholder="000000"
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-slate-400 uppercase font-bold mb-1">Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-cyan-500"
                      placeholder="Enter real full name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">DOB</label>
                    <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white" />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">Gender</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">Blood</label>
                    <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white">
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">Phone *</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full pl-8 pr-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white" placeholder="+91 98..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">City / Area</label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full pl-8 pr-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white" placeholder="Bengaluru" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">Known Allergies (Optional)</label>
                  <input type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white" placeholder="e.g. Penicillin (or leave blank)" />
                </div>
              </>
            )}

            {mode !== 'verify-2fa' && (
              <>
                <div>
                  <label className="block text-slate-400 uppercase font-bold mb-1">
                    Real Email ID (No Fake or Duplicate IDs) *
                  </label>
                  <div className="space-y-2">
                    <div className="relative w-full">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setOtpSent(false);
                        }}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-cyan-500 font-mono"
                        placeholder="yourname@gmail.com"
                      />
                    </div>
                    {(mode === 'register' || mode === 'setup-admin') && (
                      <button
                        type="button"
                        onClick={handleRequestRegistrationOtp}
                        disabled={sendingOtp}
                        className="w-full py-2 px-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 rounded-xl font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{sendingOtp ? 'Sending Verification Code...' : otpSent ? 'Resend 6-Digit Email OTP' : 'Send 6-Digit Verification OTP to Email'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {(mode === 'register' || mode === 'setup-admin') && (
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1">
                      Email Verification OTP (6 Digits) *
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        pattern="\d{6}"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono tracking-[0.3em] outline-none focus:border-cyan-500"
                        placeholder="Enter 6-digit code from email"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 uppercase font-bold mb-1">
                    Password (Min 8 Characters) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-cyan-500 font-mono"
                      placeholder="Enter strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 via-teal-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <span>
                {loading
                  ? 'Verifying Security Credentials...'
                  : mode === 'verify-2fa'
                  ? 'Verify 2FA Code & Enter Portal'
                  : mode === 'register'
                  ? 'Verify Email & Create Patient Account'
                  : mode === 'setup-admin'
                  ? 'Verify Email & Register Hospital Admin'
                  : 'Continue to 2-Step Verification'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {mode === 'verify-2fa' && (
            <div className="pt-2 border-t border-slate-800/80 text-center text-xs">
              <button
                type="button"
                onClick={() => { setMode('login'); setOtpCode(''); setError(null); setSuccessMsg(null); }}
                className="text-slate-400 hover:text-white font-bold"
              >
                ← Back to Password Entry
              </button>
            </div>
          )}

          {role === 'patient' && mode !== 'verify-2fa' && (
            <div className="pt-3 border-t border-slate-800/80 text-center text-xs">
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => { setMode('register'); setOtpCode(''); setOtpSent(false); setError(null); setSuccessMsg(null); }}
                  className="text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>New Patient? Register with Real Email OTP</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setOtpCode(''); setError(null); }}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  Already registered? Back to Sign In
                </button>
              )}
            </div>
          )}

          {role === 'admin' && !hasAdmin && mode !== 'verify-2fa' && (
            <div className="pt-3 border-t border-slate-800/80 text-center text-xs">
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => { setMode('setup-admin'); setOtpCode(''); setOtpSent(false); setError(null); }}
                  className="text-purple-400 hover:text-purple-300 font-bold"
                >
                  First-Time Setup: Register Primary Hospital Admin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setOtpCode(''); setError(null); }}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  Back to Admin Sign In
                </button>
              )}
            </div>
          )}

          {role === 'doctor' && mode !== 'verify-2fa' && (
            <div className="pt-2 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
              Doctor accounts are created by the Hospital Admin and protected by 2-Step Email OTP.
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center space-x-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>DNS MX Email Validation + Mandatory 2FA OTP Active</span>
        </div>
      </div>
    </div>
  );
};
