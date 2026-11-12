import React, { useState } from 'react';
import { useHealthRecord } from '../../context/HealthRecordContext';
import { ShieldAlert, Users, Crown, UserPlus, CheckCircle2, AlertCircle, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';

const API_BASE = 'https://unified-health-record.onrender.com';

export const AdminPortalAdvanced: React.FC = () => {
  const { doctors, auditLogs, adminStats, refreshData } = useHealthRecord();
  const [activeTab, setActiveTab] = useState<'telemetry' | 'doctors' | 'audit'>('doctors');

  // New Real Doctor Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState('General Physician');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [hospitalAffiliation, setHospitalAffiliation] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('Bengaluru Central');
  const [latitude, setLatitude] = useState('12.9716');
  const [longitude, setLongitude] = useState('77.5946');
  const [consultationRadiusKm, setConsultationRadiusKm] = useState('15');
  const [consultationFee, setConsultationFee] = useState('₹700');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const useCurrentGpsForClinic = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLatitude(pos.coords.latitude.toFixed(6));
      setLongitude(pos.coords.longitude.toFixed(6));
    });
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const token = localStorage.getItem('uhr_jwt_token');
      const res = await fetch(`${API_BASE}/api/admin/doctors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
          specialization,
          licenseNumber,
          hospitalAffiliation,
          phone,
          area,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          consultationRadiusKm: parseInt(consultationRadiusKm, 10) || 15,
          consultationFee
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.message || 'Failed to register doctor.' });
      } else {
        setFeedback({ type: 'ok', text: data.message });
        confetti({ particleCount: 60, spread: 70 });
        setFullName('');
        setEmail('');
        setPassword('');
        setLicenseNumber('');
        await refreshData();
      }
    } catch {
      setFeedback({ type: 'err', text: 'Network error connecting to Render backend.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/60 p-4 shrink-0">
        <div className="px-3 py-3 mb-4 flex items-center space-x-2 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white text-xs">
            <Crown className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Hospital Admin</div>
            <div className="text-[10px] text-purple-400">Real Doctor & Governance Node</div>
          </div>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('doctors')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold ${
              activeTab === 'doctors' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Register & Manage Doctors</span>
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold ${
              activeTab === 'telemetry' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>Hospital Telemetry</span>
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

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-6xl mx-auto space-y-6 w-full">
        {activeTab === 'doctors' && (
          <div className="space-y-6">
            {/* Register New Real Doctor Form */}
            <form onSubmit={handleCreateDoctor} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-purple-400" />
                    <span>Register Real Hospital Doctor</span>
                  </h2>
                  <p className="text-xs text-slate-400">Creates live doctor login credentials and adds the doctor to the patient radius radar.</p>
                </div>
                <button
                  type="button"
                  onClick={useCurrentGpsForClinic}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Use My Clinic GPS</span>
                </button>
              </div>

              {feedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  feedback.type === 'ok'
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                }`}>
                  {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{feedback.text}</span>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Doctor Full Name *</label>
                  <input required placeholder="Dr. Rajesh Kumar" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Login Email ID *</label>
                  <input required type="email" placeholder="dr.rajesh@hospital.org" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Login Password *</label>
                  <input required type="password" placeholder="Assign password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Specialization *</label>
                  <input required placeholder="Cardiologist / General Physician" value={specialization} onChange={e => setSpecialization(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Medical License No. *</label>
                  <input required placeholder="KMC-90124" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Hospital / Clinic Name *</label>
                  <input required placeholder="Apollo Clinic, Hebbal" value={hospitalAffiliation} onChange={e => setHospitalAffiliation(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Area / Locality</label>
                  <input placeholder="Hebbal / Indiranagar" value={area} onChange={e => setArea(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Phone & Consultation Fee</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="+91 98..." value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                    <input placeholder="₹700" value={consultationFee} onChange={e => setConsultationFee(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">GPS Lat / Lng & Radius (km)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input placeholder="Lat" value={latitude} onChange={e => setLatitude(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
                    <input placeholder="Lng" value={longitude} onChange={e => setLongitude(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
                    <input type="number" placeholder="km" value={consultationRadiusKm} onChange={e => setConsultationRadiusKm(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg disabled:opacity-50"
              >
                {submitting ? 'Saving Doctor to Database...' : 'Create Real Doctor Account'}
              </button>
            </form>

            {/* Live Doctor Directory */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white">Active Hospital Doctors ({doctors.length})</h2>
              <div className="divide-y divide-slate-800">
                {doctors.map(doc => (
                  <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs">
                    <div>
                      <div className="font-bold text-white text-sm">{doc.name} <span className="text-xs text-slate-400 font-mono">({doc.email})</span></div>
                      <div className="text-slate-400">{doc.specialty} • {doc.hospital} ({doc.area})</div>
                      <div className="font-mono text-[10px] text-purple-300">
                        License: {doc.licenseNumber} • Service Radius: {doc.radiusKm} km • Fee: {doc.fee}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded font-bold text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 self-start sm:self-center">
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-white">Live Hospital Analytics</h1>
              <p className="text-xs text-slate-400 mt-1">Real-time row counts from Aiven Cloud MySQL</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Registered Patients</span>
                <div className="text-3xl font-black text-cyan-400 mt-1">{adminStats.totalPatients}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Active Doctors</span>
                <div className="text-3xl font-black text-purple-400 mt-1">{adminStats.totalDoctors}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Medical Records</span>
                <div className="text-3xl font-black text-teal-400 mt-1">{adminStats.totalRecords}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Appointments</span>
                <div className="text-3xl font-black text-emerald-400 mt-1">{adminStats.totalAppointments}</div>
              </div>
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
