import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const DoctorDashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { token, logout } = useAuth();
  const [appts, setAppts] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:5001/api/appointments', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(setAppts);
  }, []);

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Physician Consultation Ledger</h1>
        <button onClick={logout} className="text-rose-600 font-semibold text-sm">Sign Out</button>
      </div>
      <div className="bg-white border rounded-xl p-6">
        <h3 className="font-bold text-sm mb-4">Assigned Consultations</h3>
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b"><th className="pb-2">Patient</th><th className="pb-2">Date</th><th className="pb-2">Reason</th></tr></thead>
          <tbody className="divide-y">
            {appts.map(a => (
              <tr key={a.id}><td className="py-2.5 font-bold">{a.patient_name}</td><td>{a.appointment_date}</td><td>{a.reason}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
