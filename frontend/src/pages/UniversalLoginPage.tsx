import React, { useState } from 'react';
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
  MapPin
} from 'lucide-react';
import confetti from 'canvas-confetti';

const API_BASE = 'https://unified-health-record.onrender.com';

export const UniversalLoginPage: React.FC = () => {
  const { setActiveRole, setIsAuthenticated, setCurrentUser } = useHealthRecord();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'patient' | 'doctor' | 'admin'>('patient');

  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Patient self-registration states
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('1998-01-01');
  const [gender, setGender] = useState('male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [allergies, setAllergies] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const roleDescriptions = {
    patient: 'View your personal medical reports, prescriptions & book nearby doctors',
    doctor: 'Register patients, verify patient email IDs & issue clinical records',
    admin: 'Add real hospital doctors, configure clinic radius & monitor audit logs'
  };

  const handleRoleSelect = (selectedRole: 'patient' | 'doctor' | 'admin') => {
    setRole(selectedRole);
    setMode('login');
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'register') {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            email,
            password,
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
          setError(data.message || 'Registration failed.');
          setLoading(false);
          return;
        }
        setSuccessMsg('Patient account created! Please sign in with your email and password.');
        setMode('login');
        setPassword('');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, expectedRole: role })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Invalid credentials.');
        setLoading(false);
        return;
      }

      localStorage.setItem('uhr_jwt_token', data.token);
      localStorage.setItem('uhr_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setActiveRole(data.user.role);
      setIsAuthenticated(true);
      confetti({ particleCount: 75, spread: 80, origin: { y: 0.6 } });
    } catch {
      setError('Unable to reach server. If Render free tier was sleeping, wait 30 seconds and try again.');
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
            Hospital Clinical Record & Appointment Network
          </p>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-5">
          {/* Role Chooser */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Select Portal Role
            </label>
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
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-slate-400 uppercase font-bold mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-cyan-500"
                      placeholder="Enter patient full name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">DOB</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">Blood</label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">Phone</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-8 pr-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                        placeholder="+91 98765..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">City / Area</label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full pl-8 pr-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                        placeholder="Bengaluru"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 uppercase font-bold mb-1 text-[10px]">Known Allergies (Optional)</label>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    placeholder="e.g. Penicillin, Sulfa drugs (or leave blank)"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-slate-400 uppercase font-bold mb-1">
                Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-cyan-500 font-mono"
                  placeholder="Enter your registered email"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 uppercase font-bold mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-cyan-500 font-mono"
                  placeholder="Enter password"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 via-teal-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <span>
                {loading
                  ? 'Connecting to Hospital Database...'
                  : mode === 'register'
                  ? 'Create Real Patient Account'
                  : `Sign In as ${role.toUpperCase()}`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {role === 'patient' && (
            <div className="pt-3 border-t border-slate-800/80 text-center text-xs">
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); setSuccessMsg(null); }}
                  className="text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>New Patient? Create Real Account</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  Already have an account? Back to Sign In
                </button>
              )}
            </div>
          )}

          {role !== 'patient' && (
            <div className="pt-2 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
              {role === 'doctor'
                ? 'Doctor credentials are issued by the Hospital System Admin.'
                : 'Sign in with your Hospital Administrator account.'}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center space-x-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>End-to-End MySQL Role-Based Access Control Active</span>
        </div>
      </div>
    </div>
  );
};
