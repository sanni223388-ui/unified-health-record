import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Heart, Activity, Plus } from 'lucide-react';

export const PatientDashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { token, logout } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('https://unified-health-record.onrender.com/api/patient/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => res.json()).then(setData);
  }, []);

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Good morning, {data?.patient?.full_name || 'Patient'}</h1>
          <p className="text-xs text-slate-500">Unified Medical Record ID: #{data?.patient?.id || '1'}</p>
        </div>
        <div className="space-x-3">
          <button onClick={() => onNavigate('book-appointment')} className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold">+ Book Visit</button>
          <button onClick={logout} className="px-3 py-2 text-rose-600 text-sm font-semibold">Sign Out</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 bg-white border rounded-xl"><span className="text-xs text-slate-400">Blood Group</span><div className="text-2xl font-bold">{data?.patient?.blood_group || 'O+'}</div></div>
        <div className="p-5 bg-white border rounded-xl"><span className="text-xs text-slate-400">Allergies</span><div className="text-sm font-bold text-amber-600">{data?.patient?.allergies || 'None logged'}</div></div>
        <div className="p-5 bg-white border rounded-xl"><span className="text-xs text-slate-400">Active Prescriptions</span><div className="text-2xl font-bold text-teal-600">{data?.activePrescriptions?.length || 0}</div></div>
      </div>

      <div className="bg-white border rounded-xl p-6">
        <h3 className="font-bold text-base mb-4">Medical Record History</h3>
        <div className="space-y-3 text-sm">
          {data?.recentRecords?.map((r: any) => (
            <div key={r.id} className="p-3 bg-slate-50 rounded-lg">
              <div className="font-semibold">{r.diagnosis} - <span className="text-slate-500 text-xs">{r.record_date}</span></div>
              <p className="text-xs text-slate-600 mt-1">{r.clinical_notes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
