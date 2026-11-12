import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const AdminDashboard: React.FC<{ onNavigate: (page: string) => void }> = () => {
  const { token, logout } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('http://localhost:5001/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(setData);
  }, []);

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">System Administration (SDG 3 Governance)</h1>
        <button onClick={logout} className="text-rose-600 font-semibold text-sm">Sign Out</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white border rounded-xl"><span className="text-xs text-slate-400">Total Patients</span><div className="text-2xl font-bold">{data?.stats?.totalPatients || 0}</div></div>
        <div className="p-4 bg-white border rounded-xl"><span className="text-xs text-slate-400">Total Doctors</span><div className="text-2xl font-bold text-teal-600">{data?.stats?.totalDoctors || 0}</div></div>
        <div className="p-4 bg-white border rounded-xl"><span className="text-xs text-slate-400">Medical Encounters</span><div className="text-2xl font-bold text-cyan-600">{data?.stats?.totalRecords || 0}</div></div>
      </div>
    </div>
  );
};
