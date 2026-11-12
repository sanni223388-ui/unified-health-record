import React from 'react';
import { Activity, ShieldCheck, Heart, Users, FileText, ArrowRight } from 'lucide-react';

export const LandingPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white/90 backdrop-blur-md sticky top-0 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center text-white"><Activity className="w-6 h-6"/></div>
          <span className="text-xl font-bold">Health<span className="text-cyan-600">Unified</span></span>
        </div>
        <div className="space-x-3">
          <button onClick={() => onNavigate('login')} className="px-4 py-2 text-sm font-semibold text-slate-700">Sign In</button>
          <button onClick={() => onNavigate('register')} className="px-4 py-2 text-sm font-semibold bg-cyan-600 text-white rounded-lg">Get Started</button>
        </div>
      </nav>

      <section className="py-20 text-center max-w-4xl mx-auto px-4">
        <span className="bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold px-3 py-1 rounded-full">UN SDG 3: Good Health and Well-Being</span>
        <h1 className="text-5xl font-extrabold text-slate-900 mt-6 leading-tight">Your Health Records.<br/><span className="text-cyan-600">Unified. Secure. Accessible.</span></h1>
        <p className="text-slate-600 mt-4 text-base max-w-2xl mx-auto">Eliminate fragmented paper files, avoid repeated tests, and give doctors continuous clinical history on one verified portal.</p>
        <div className="mt-8 flex justify-center gap-4">
          <button onClick={() => onNavigate('register')} className="px-6 py-3 bg-cyan-600 text-white font-semibold rounded-xl flex items-center space-x-2"><span>Create Patient Account</span><ArrowRight className="w-4 h-4"/></button>
          <button onClick={() => onNavigate('login')} className="px-6 py-3 bg-white border border-slate-300 font-semibold rounded-xl">Demo Credentials</button>
        </div>
      </section>

      <section className="bg-teal-700 text-white py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-2xl font-bold flex items-center space-x-2"><Heart className="text-rose-300 w-6 h-6"/><span>SDG 3 Impact Architecture</span></h3>
            <p className="text-teal-100 text-sm mt-2 max-w-xl">Enables universal access to digital healthcare records, prevents prescription overlaps, and delivers critical allergy histories during emergencies.</p>
          </div>
          <div className="bg-white/10 p-4 rounded-xl text-xs space-y-1">
            <div>✓ Continuous patient electronic health records</div>
            <div>✓ Safe, traceable e-prescriptions</div>
            <div>✓ Rapid diagnostic laboratory data accessibility</div>
          </div>
        </div>
      </section>
    </div>
  );
};
