import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export const BookAppointment: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetch('https://unified-health-record.onrender.com/api/doctors').then(r => r.json()).then(d => {
      setDoctors(d);
      if (d.length) setDoctorId(d[0].id.toString());
    });
  }, []);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('https://unified-health-record.onrender.com/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ doctorId, appointmentDate, appointmentTime, reason })
    });
    onNavigate('patient-dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white border p-6 rounded-xl max-w-md w-full">
        <h2 className="text-lg font-bold mb-4">Book Appointment</h2>
        <form onSubmit={handleBook} className="space-y-3 text-sm">
          <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="w-full border p-2 rounded">
            {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.specialization})</option>)}
          </select>
          <input type="date" value={appointmentDate} onChange={e=>setAppointmentDate(e.target.value)} required className="w-full border p-2 rounded"/>
          <input type="time" value={appointmentTime} onChange={e=>setAppointmentTime(e.target.value)} required className="w-full border p-2 rounded"/>
          <textarea placeholder="Reason" value={reason} onChange={e=>setReason(e.target.value)} required className="w-full border p-2 rounded"/>
          <button className="w-full py-2 bg-cyan-600 text-white rounded font-semibold">Confirm Booking</button>
        </form>
      </div>
    </div>
  );
};
