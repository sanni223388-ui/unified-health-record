import React from 'react';
import { useHealthRecord } from '../context/HealthRecordContext';
import { Activity, ShieldCheck, UserCheck, Stethoscope, Crown, LogOut, Sun, Moon } from 'lucide-react';

export const VFXNavbar: React.FC = () => {
  const { activeRole, currentUser, logout, theme, toggleTheme } = useHealthRecord();
  const isLight = theme === 'light';

  return (
    <header className={`sticky top-0 z-50 transition-colors duration-300 backdrop-blur-xl px-6 py-3 border-b shadow-xs ${
      isLight 
        ? 'bg-white/90 border-slate-200/90 text-slate-800 shadow-slate-100' 
        : 'bg-slate-900/85 border-cyan-500/20 text-slate-100 shadow-2xl'
    }`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 blur-sm opacity-60 animate-pulse" />
            <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isLight ? 'bg-cyan-50 border border-cyan-200 text-teal-600' : 'bg-slate-950 border border-cyan-400/30 text-cyan-400'
            }`}>
              <Activity className="w-6 h-6 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-lg font-black tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                UNIFIED<span className="text-teal-600">HEALTH</span>
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                isLight ? 'bg-teal-50 text-teal-700 border border-teal-200 font-bold' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
              }`}>
                SDG 3
              </span>
            </div>
            <p className={`text-[11px] font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Decentralized Healthcare Mesh & Clinical Ledger
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isLight 
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
            }`}
            title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
          >
            {isLight ? (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light Mode</span>
              </>
            )}
          </button>

          {/* Current Role Identity Badge */}
          {activeRole === 'patient' && (
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
              isLight 
                ? 'bg-teal-50/80 border-teal-200 text-teal-800' 
                : 'bg-gradient-to-r from-cyan-950 to-teal-950 border-cyan-500/40 text-cyan-300'
            }`}>
              <UserCheck className="w-4 h-4 text-teal-600" />
              <span>Patient Portal</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                isLight ? 'bg-teal-100 text-teal-800' : 'bg-cyan-900/60 text-cyan-200'
              }`}>
                {currentUser?.name || 'John Doe'}
              </span>
            </div>
          )}

          {activeRole === 'doctor' && (
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-teal-950 border-teal-500/40 text-teal-300'
            }`}>
              <Stethoscope className="w-4 h-4 text-emerald-600" />
              <span>Doctor Portal</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">
                {currentUser?.name || 'Dr. Ananya Sharma'}
              </span>
            </div>
          )}

          {activeRole === 'admin' && (
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              isLight ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-purple-950 border-purple-500/40 text-purple-300'
            }`}>
              <Crown className="w-4 h-4 text-purple-600" />
              <span>Admin Governance</span>
            </div>
          )}

          <div className={`hidden lg:flex items-center space-x-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border ${
            isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>FIPS-140-3 Active</span>
          </div>

          <button
            onClick={logout}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
              isLight 
                ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700' 
                : 'bg-rose-950/50 hover:bg-rose-900/70 border-rose-800/60 text-rose-300'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
