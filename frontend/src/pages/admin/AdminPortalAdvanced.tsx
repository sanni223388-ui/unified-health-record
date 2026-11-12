import React, { useState } from 'react';
import { useHealthRecord } from '../../context/HealthRecordContext';
import { ShieldAlert, Users, Crown } from 'lucide-react';

export const AdminPortalAdvanced: React.FC = () => {
  const { doctors, appointments, consultations, auditLogs, verifyDoctor } = useHealthRecord();
  const [activeTab, setActiveTab] = useState<'telemetry' | 'doctors' | 'audit'>('telemetry');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 shrink-0">
        <div className="px-3 py-3 mb-4 flex items-center space-x-2 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white text-xs">
            👑
          </div>
          <div>
            <div className="text-xs font-bold text-white">System Admin</div>
            <div className="text-[10px] text-purple-400">Governance Node</div>
          </div>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold ${
              activeTab === 'telemetry' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>Telemetry</span>
          </button>
          <button
            onClick={() => setActiveTab('doctors')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold ${
              activeTab === 'doctors' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Doctor Management</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold ${
              activeTab === 'audit' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto space-y-6">
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-white">System Analytics & Telemetry</h1>
              <p className="text-xs text-slate-400 mt-1">Real-time metrics without exposing clinical patient history</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Doctors</span>
                <div className="text-3xl font-black text-purple-400 mt-1">{doctors.length}</div>
                <span className="text-[10px] text-slate-500">Credentialed</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Consultations</span>
                <div className="text-3xl font-black text-teal-400 mt-1">{consultations.length}</div>
                <span className="text-[10px] text-teal-500">Committed</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Appointments</span>
                <div className="text-3xl font-black text-cyan-400 mt-1">{appointments.length}</div>
                <span className="text-[10px] text-cyan-500">Live roster</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Audit Events</span>
                <div className="text-3xl font-black text-emerald-400 mt-1">{auditLogs.length}</div>
                <span className="text-[10px] text-emerald-500">Security logged</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'doctors' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white">Doctor Credential Verification</h2>
            <div className="divide-y divide-slate-800">
              {doctors.map(doc => (
                <div key={doc.id} className="py-4 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-white text-sm">{doc.name}</div>
                    <div className="text-slate-400">{doc.specialty} • {doc.hospital}</div>
                    <div className="font-mono text-[10px] text-purple-300">License: {doc.licenseNumber}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      doc.status === 'Verified' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      doc.status === 'Pending Verification' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {doc.status}
                    </span>
                    {doc.status !== 'Verified' && (
                      <button onClick={() => verifyDoctor(doc.id, 'Verified')} className="px-3 py-1 bg-emerald-600 text-white rounded font-bold">Verify</button>
                    )}
                    {doc.status !== 'Suspended' && (
                      <button onClick={() => verifyDoctor(doc.id, 'Suspended')} className="px-3 py-1 bg-rose-600 text-white rounded font-bold">Suspend</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white">Cryptographic Audit Trail</h2>
            <div className="space-y-2">
              {auditLogs.map(log => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-500">{log.timestamp}</span>
                    <span className="font-bold text-cyan-400">[{log.role}]</span>
                    <span className="text-slate-300">{log.action}</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">{log.actor}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
