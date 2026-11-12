import React, { useState } from 'react';
import { useHealthRecord } from '../../context/HealthRecordContext';
import { HospitalIDImporter } from '../../components/HospitalIDImporter';
import { EmergencyQRModal } from '../../components/EmergencyQRModal';
import { NearbyDoctorRadar } from '../../components/NearbyDoctorRadar';
import { ExternalHospitalReport } from '../../services/HospitalExchangeService';
import {
  LayoutDashboard, User, History, Pill, FileCheck, CalendarCheck,
  Stethoscope, Syringe, AlertTriangle, HeartPulse, FolderOpen,
  Bell, Settings, LogOut, Plus, Printer, Download, PhoneCall,
  ShieldAlert, FileText, Upload, Calendar, QrCode, CheckCircle2,
  Lock, Smartphone, ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const PatientPortalAdvanced: React.FC = () => {
  const {
    profile, updateProfile, consultations, appointments,
    labReports, vaccinations, documents, addDocument, addConsultation,
    bookAppointment, cancelAppointment, logout, theme
  } = useHealthRecord();

  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'profile' | 'history' | 'prescriptions' | 'lab' | 'appointments' |
    'doctors' | 'vaccines' | 'allergies' | 'emergency' | 'documents' | 'notifications' | 'settings'
  >('dashboard');

  const safeProfile = profile || {
    fullName: 'John Doe',
    dob: '1992-05-14',
    gender: 'Male',
    bloodGroup: 'O+',
    phone: '+91 98765 43210',
    email: 'patient@example.com',
    address: '742 Evergreen Terrace, Bengaluru, Karnataka, India',
    allergies: ['Penicillin (Severe Anaphylaxis)'],
    chronicConditions: ['Stage 1 Essential Hypertension'],
    emergencyContact: {
      name: 'Mary Doe',
      relationship: 'Spouse',
      phone: '+91 98765 43211',
      alternatePhone: '+91 80 2345 6789'
    }
  };

  const [phone, setPhone] = useState(safeProfile.phone);
  const [address, setAddress] = useState(safeProfile.address);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [showBookModal, setShowBookModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [doctorChoice, setDoctorChoice] = useState('Dr. Ananya Sharma');
  const [apptDate, setApptDate] = useState('2026-10-25');
  const [apptTime, setApptTime] = useState('10:00 AM');
  const [apptReason, setApptReason] = useState('Routine Check-up');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('Radiology');
  const [syncAlert, setSyncAlert] = useState<string | null>(null);

  // Settings state
  const [hospitalSharing, setHospitalSharing] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [triageBroadcast, setTriageBroadcast] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Prescription Refill Approved', time: '10 mins ago', msg: 'Dr. Ananya Sharma approved Lisinopril 10mg renewal for 90 days.', unread: true },
    { id: 2, title: 'Upcoming Cardiovascular Appointment', time: 'Yesterday', msg: 'Your appointment is confirmed for Oct 15 at 09:00 AM.', unread: false }
  ]);

  const handleHospitalReportImport = (report: ExternalHospitalReport) => {
    addConsultation({
      patientId: 'PAT-1',
      patientName: safeProfile.fullName,
      doctorId: 'DOC-EXT',
      doctorName: `${report.doctorName} (${report.hospitalName})`,
      chiefComplaint: `Referred hospital study: ${report.department}`,
      symptoms: ['External diagnostic study', report.accessionId],
      vitals: {
        bloodPressure: report.vitals.bloodPressure,
        heartRate: report.vitals.heartRate,
        temperature: '98.6 °F',
        oxygenSaturation: report.vitals.spo2
      },
      clinicalFindings: report.summary,
      diagnosis: report.diagnosis,
      treatment: `Hospital Record ${report.accessionId} imported into patient record ledger.`,
      prescriptions: [],
      followUpDate: 'As advised by specialist'
    });

    addDocument({
      title: report.pdfName,
      type: report.department,
      size: report.pdfSize
    });

    setSyncAlert(`Successfully imported ${report.hospitalName} record (#${report.accessionId}) into your unified timeline and document vault.`);
    setTimeout(() => setSyncAlert(null), 6000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ phone, address });
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 3000);
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    bookAppointment({
      patientId: 'PAT-1',
      patientName: safeProfile.fullName,
      doctorId: 'DOC-1',
      doctorName: doctorChoice,
      doctorSpecialty: doctorChoice.includes('Ananya') ? 'Cardiologist' : doctorChoice.includes('Rajesh') ? 'Endocrinologist' : 'Pulmonologist',
      date: apptDate,
      time: apptTime,
      type: apptReason
    });
    setShowBookModal(false);
    confetti({ particleCount: 60, spread: 70 });
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle) return;
    addDocument({
      title: docTitle.endsWith('.pdf') ? docTitle : `${docTitle}.pdf`,
      type: docCategory,
      size: `${(Math.random() * 3 + 1.2).toFixed(1)} MB`
    });
    setDocTitle('');
    setShowUploadModal(false);
    confetti({ particleCount: 40, spread: 50 });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
    confetti({ particleCount: 30, spread: 50 });
  };

  const menu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'history', label: 'Medical History', icon: History },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { id: 'lab', label: 'Lab Reports & HIE Sync', icon: FileCheck },
    { id: 'appointments', label: 'Appointments', icon: CalendarCheck },
    { id: 'doctors', label: 'My Doctors & GPS Radar', icon: Stethoscope },
    { id: 'vaccines', label: 'Vaccinations', icon: Syringe },
    { id: 'allergies', label: 'Allergies & Conditions', icon: AlertTriangle },
    { id: 'emergency', label: 'Emergency Info & QR', icon: HeartPulse },
    { id: 'documents', label: 'Documents Vault', icon: FolderOpen },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.filter(n => n.unread).length },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 flex font-sans ${
      isLight 
        ? 'bg-gradient-to-br from-slate-50 via-teal-50/20 to-cyan-50/30 text-slate-900' 
        : 'bg-slate-950 text-slate-100'
    }`}>
      {/* Sidebar */}
      <aside className={`w-64 border-r transition-colors duration-300 p-4 flex flex-col justify-between shrink-0 ${
        isLight ? 'bg-white/80 backdrop-blur-md border-slate-200 shadow-xs' : 'bg-slate-900/60 backdrop-blur-md border-slate-800'
      }`}>
        <div>
          <div className={`px-3 py-3 mb-3 flex items-center space-x-2.5 border-b rounded-2xl ${
            isLight ? 'border-slate-100 bg-slate-50/80' : 'border-slate-800 bg-slate-950/40'
          }`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-teal-500/20">
              JD
            </div>
            <div>
              <div className={`text-xs font-bold leading-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {safeProfile.fullName}
              </div>
              <div className="text-[10px] text-teal-600 font-mono font-bold">
                UHR-883902 • {safeProfile.bloodGroup}
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {menu.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                    active
                      ? isLight
                        ? 'bg-teal-50 text-teal-800 shadow-xs border border-teal-200'
                        : 'bg-gradient-to-r from-cyan-600/30 to-teal-600/20 text-cyan-300 border border-cyan-500/30 shadow-md'
                      : isLight
                        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${
                      active 
                        ? (isLight ? 'text-teal-600' : 'text-cyan-400') 
                        : 'text-slate-400'
                    }`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={`pt-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <button
            onClick={logout}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              isLight 
                ? 'text-rose-600 hover:bg-rose-50' 
                : 'text-rose-400 hover:bg-rose-950/40 hover:text-rose-300'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto space-y-6">
        {syncAlert && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs rounded-2xl flex items-center space-x-2 font-medium shadow-sm animate-in fade-in">
            <span>✅ {syncAlert}</span>
          </div>
        )}

        {/* 1. DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Good Morning, {safeProfile.fullName} 👋
                </h1>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Verified Unified Health Record #UHR-883902
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowQRModal(true)}
                  className={`px-3.5 py-2 border rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all ${
                    isLight 
                      ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700' 
                      : 'bg-rose-950 hover:bg-rose-900 border-rose-800 text-rose-300'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Offline Triage QR</span>
                </button>
                <button
                  onClick={() => setShowBookModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Book Appointment</span>
                </button>
              </div>
            </div>

            <HospitalIDImporter onImportComplete={handleHospitalReportImport} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-4 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900 border-slate-800'
              }`}>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Blood Group
                </span>
                <div className="text-2xl font-black text-rose-500 mt-1">{safeProfile.bloodGroup}</div>
                <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Verified Pathology</span>
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900 border-slate-800'
              }`}>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Primary Allergy
                </span>
                <div className="text-sm font-bold text-amber-600 dark:text-amber-300 mt-1 truncate">
                  {safeProfile.allergies[0]}
                </div>
                <span className="text-[10px] text-amber-600 font-semibold">Critical Medical Alert</span>
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900 border-slate-800'
              }`}>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Active Regimens
                </span>
                <div className="text-2xl font-black text-teal-600 dark:text-cyan-400 mt-1">
                  {consultations.reduce((acc, c) => acc + c.prescriptions.length, 0)} Meds
                </div>
                <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Signed by Physician</span>
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900 border-slate-800'
              }`}>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Next Visit
                </span>
                <div className={`text-sm font-bold mt-1 ${isLight ? 'text-slate-800' : 'text-teal-300'}`}>
                  {appointments.find(a => a.status === 'Confirmed')?.date || 'None scheduled'}
                </div>
                <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {appointments.find(a => a.status === 'Confirmed')?.doctorName || 'Dr. Ananya Sharma'}
                </span>
              </div>
            </div>

            <div className={`p-6 rounded-2xl border transition-all ${
              isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <h2 className={`text-sm font-bold flex justify-between items-center mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                <span>Recent Clinical Diagnoses Timeline</span>
                <span className="text-[10px] text-teal-600 font-mono font-bold">Live Synced</span>
              </h2>
              <div className="space-y-3">
                {consultations.map(c => (
                  <div key={c.id} className={`p-4 rounded-xl border space-y-1.5 transition-all ${
                    isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950 border-slate-800/80'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className={`text-sm font-bold ${isLight ? 'text-teal-700' : 'text-cyan-300'}`}>
                          {c.diagnosis}
                        </div>
                        <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {c.doctorName} • {c.date}
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                        isLight ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-cyan-950 text-cyan-400 border-cyan-800'
                      }`}>
                        BP: {c.vitals.bloodPressure}
                      </span>
                    </div>
                    <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{c.treatment}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. MY PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h1 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Personal Patient Profile
              </h1>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Legal demographic information, identity tokens, and editable primary contacts.
              </p>
            </div>

            {profileSuccess && (
              <div className="p-3.5 bg-emerald-500/15 border border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl font-bold flex items-center space-x-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Contact details successfully updated and synchronized.</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className={`p-6 rounded-2xl border space-y-5 transition-all ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className={`block font-bold mb-1 uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Full Legal Name (Locked)
                  </label>
                  <input
                    disabled
                    value={safeProfile.fullName}
                    className={`w-full p-2.5 rounded-lg border font-medium cursor-not-allowed ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-bold mb-1 uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Date of Birth
                  </label>
                  <input
                    disabled
                    value={safeProfile.dob}
                    className={`w-full p-2.5 rounded-lg border font-medium cursor-not-allowed ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-bold mb-1 uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Blood Group (Verified)
                  </label>
                  <input
                    disabled
                    value={safeProfile.bloodGroup}
                    className={`w-full p-2.5 rounded-lg border font-black text-rose-600 cursor-not-allowed ${
                      isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-bold mb-1 uppercase ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Primary Contact Number (Editable)
                  </label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border outline-none font-mono ${
                      isLight 
                        ? 'bg-slate-50 border-slate-300 focus:border-teal-600 text-slate-900' 
                        : 'bg-slate-950 border-slate-700 focus:border-cyan-500 text-white'
                    }`}
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className={`block font-bold mb-1 uppercase ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Residential Home Address (Editable)
                </label>
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border outline-none ${
                    isLight 
                      ? 'bg-slate-50 border-slate-300 focus:border-teal-600 text-slate-900' 
                      : 'bg-slate-950 border-slate-700 focus:border-cyan-500 text-white'
                  }`}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Save Profile Updates
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 7. MY DOCTORS & NEARBY GPS RADAR */}
        {activeTab === 'doctors' && (
          <div className="space-y-6">
            <div>
              <h1 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Doctor Directory & Nearby GPS Radar
              </h1>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Scan verified clinics and physicians closest to your real-time location.
              </p>
            </div>

            {/* LIVE GPS RADAR COMPONENT */}
            <NearbyDoctorRadar
              isLight={isLight}
              onBookSpecialist={(docName, specialty) => {
                setDoctorChoice(docName);
                setApptReason(`Consultation with ${specialty}`);
                setShowBookModal(true);
              }}
            />
          </div>
        )}

        {/* 3. MEDICAL HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div>
              <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Full Medical History & Encounters
              </h1>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Complete clinical consultations recorded by licensed physicians or imported via HIE.
              </p>
            </div>
            <div className="space-y-4">
              {consultations.map(c => (
                <div key={c.id} className={`p-6 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className={`flex justify-between items-start pb-2 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                    <div>
                      <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{c.diagnosis}</h3>
                      <div className="text-xs text-slate-400">{c.doctorName} • {c.date}</div>
                    </div>
                    <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border font-bold ${
                      isLight ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-950 text-cyan-300 border-slate-800'
                    }`}>
                      BP: {c.vitals.bloodPressure} | HR: {c.vitals.heartRate}
                    </span>
                  </div>
                  <div className="text-xs space-y-2">
                    <div><span className="font-bold text-slate-400">Chief Complaint:</span> <span className={isLight ? 'text-slate-700' : 'text-slate-200'}>{c.chiefComplaint}</span></div>
                    <div><span className="font-bold text-slate-400">Clinical Findings:</span> <span className={isLight ? 'text-slate-700' : 'text-slate-200'}>{c.clinicalFindings}</span></div>
                    <div><span className="font-bold text-slate-400">Treatment Plan:</span> <span className={isLight ? 'text-slate-700' : 'text-slate-200'}>{c.treatment}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. PRESCRIPTIONS */}
        {activeTab === 'prescriptions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Active Prescriptions & Regimens
                </h1>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Authorized e-prescriptions with verified doctor signatures.
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className={`px-3 py-1.5 border text-xs font-bold rounded-lg flex items-center space-x-1.5 ${
                  isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Rx</span>
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {consultations.flatMap(c => c.prescriptions.map(p => ({ ...p, doctor: c.doctorName, date: c.date }))).map(rx => (
                <div key={rx.id} className={`p-5 rounded-2xl border space-y-2 ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-teal-600 dark:text-cyan-400">{rx.medicine}</span>
                      <div className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{rx.dosage}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      ACTIVE
                    </span>
                  </div>
                  <div className={`text-xs space-y-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    <div>Frequency: <span className="font-bold">{rx.frequency}</span></div>
                    <div>Duration: <span className="font-bold">{rx.duration}</span></div>
                    <div className="italic text-slate-400">"{rx.instructions}"</div>
                  </div>
                  <div className={`pt-2 border-t text-[10px] text-slate-400 ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                    Prescribed by {rx.doctor} • {rx.date}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. LAB REPORTS */}
        {activeTab === 'lab' && (
          <div className="space-y-6">
            <div>
              <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Laboratory Diagnostic Reports & Hospital Network
              </h1>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Sync external hospital records using their accession numbers or view laboratory tests.
              </p>
            </div>
            <HospitalIDImporter onImportComplete={handleHospitalReportImport} />
            <div className="grid md:grid-cols-2 gap-4">
              {labReports.map(lab => (
                <div key={lab.id} className={`p-5 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-slate-400">{lab.category}</span>
                      <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{lab.testName}</h3>
                      <div className="text-[11px] text-slate-500">{lab.laboratory} • {lab.date}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      lab.status === 'Normal' 
                        ? (isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950 text-emerald-300 border-emerald-800')
                        : (isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-950 text-amber-300 border-amber-800')
                    }`}>
                      {lab.status}
                    </span>
                  </div>
                  <p className={`text-xs p-2.5 rounded-xl font-mono border ${
                    isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-950 text-slate-300 border-slate-800'
                  }`}>
                    {lab.result}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Appointments & Consultations
                </h1>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Manage your clinical bookings with doctors.
                </p>
              </div>
              <button
                onClick={() => setShowBookModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Book Appointment</span>
              </button>
            </div>
            <div className="space-y-3">
              {appointments.map(a => (
                <div key={a.id} className={`p-4 rounded-2xl border flex justify-between items-center ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div>
                    <div className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {a.doctorName} ({a.doctorSpecialty})
                    </div>
                    <div className="text-xs text-slate-400">{a.date} at {a.time} • {a.type}</div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                      a.status === 'Confirmed' ? 'bg-cyan-100 text-cyan-800 border-cyan-300' :
                      a.status === 'Pending' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      a.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {a.status}
                    </span>
                    {a.status !== 'Cancelled' && a.status !== 'Completed' && (
                      <button
                        onClick={() => cancelAppointment(a.id)}
                        className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. VACCINATIONS */}
        {activeTab === 'vaccines' && (
          <div className="space-y-6">
            <div>
              <h1 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Vaccination History & Records
              </h1>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Immunization passes with batch tracking.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {vaccinations.map(v => (
                <div key={v.id} className={`p-5 rounded-2xl border space-y-2 transition-all ${
                  isLight ? 'bg-white border-slate-200/90 shadow-sm' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex justify-between items-start">
                    <h3 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {v.vaccineName}
                    </h3>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold border ${
                      isLight ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-950 text-teal-300 border-slate-800'
                    }`}>
                      {v.batchNumber}
                    </span>
                  </div>
                  <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Administered: {v.dateAdministered} • {v.clinic}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. ALLERGIES & CONDITIONS */}
        {activeTab === 'allergies' && (
          <div className="space-y-6">
            <div>
              <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Allergies & Chronic Health Conditions
              </h1>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Critical constraints active on clinical encounters.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-6 rounded-2xl border space-y-3 ${
                isLight ? 'bg-rose-50/50 border-rose-200 shadow-sm' : 'bg-slate-900 border-rose-900/60'
              }`}>
                <div className="flex items-center space-x-2 text-rose-600 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5" />
                  <span>ALLERGIC SENSITIVITIES</span>
                </div>
                <div className="space-y-2">
                  {safeProfile.allergies.map((alg, i) => (
                    <div key={i} className={`p-3 rounded-xl text-xs border ${
                      isLight ? 'bg-white border-rose-200 text-rose-900 shadow-xs' : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}>
                      ⚠ {alg}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-6 rounded-2xl border space-y-3 ${
                isLight ? 'bg-teal-50/50 border-teal-200 shadow-sm' : 'bg-slate-900 border-cyan-900/60'
              }`}>
                <div className="flex items-center space-x-2 text-teal-700 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5" />
                  <span>CHRONIC CONDITIONS</span>
                </div>
                <div className="space-y-2">
                  {safeProfile.chronicConditions.map((con, i) => (
                    <div key={i} className={`p-3 rounded-xl text-xs border ${
                      isLight ? 'bg-white border-teal-200 text-teal-900 shadow-xs' : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}>
                      🩺 {con}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 10. EMERGENCY INFO & QR */}
        {activeTab === 'emergency' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Emergency Triage Access Card & QR
                </h1>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Emergency responders access this card during trauma care.
                </p>
              </div>
              <button
                onClick={() => setShowQRModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Launch Paramedic QR Card</span>
              </button>
            </div>

            <div className={`p-6 rounded-2xl border space-y-4 ${
              isLight 
                ? 'bg-gradient-to-r from-rose-50 via-white to-rose-50/30 border-rose-200 shadow-sm' 
                : 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-slate-900 border-rose-800/60'
            }`}>
              <div className="flex items-center space-x-3 text-rose-600">
                <HeartPulse className="w-7 h-7 animate-pulse" />
                <div>
                  <h2 className="text-lg font-black text-rose-700 dark:text-white">EMERGENCY FIRST RESPONDER PASSPORT</h2>
                  <span className="text-xs text-rose-600 dark:text-rose-300 font-mono font-bold">
                    Blood: {safeProfile.bloodGroup} • Anaphylaxis Flag: Penicillin
                  </span>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-xs pt-2">
                <div className={`p-4 rounded-xl border space-y-1 ${
                  isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-950 border-slate-800'
                }`}>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Primary Contact</span>
                  <div className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {safeProfile.emergencyContact.name} ({safeProfile.emergencyContact.relationship})
                  </div>
                  <div className="flex items-center space-x-2 text-teal-600 dark:text-cyan-400 pt-1 font-mono font-bold">
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{safeProfile.emergencyContact.phone}</span>
                  </div>
                </div>
                <div className={`p-4 rounded-xl border space-y-1 ${
                  isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-950 border-slate-800'
                }`}>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Trauma Hotline</span>
                  <div className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Apollo Heart Emergency Dispatch
                  </div>
                  <div className="flex items-center space-x-2 text-rose-600 pt-1 font-mono font-bold">
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>108 / +91 80 2200 9999</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 11. DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Health Documents Vault
                </h1>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Store and download health insurance, discharge summaries, and scans.
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {documents.map(d => (
                <div key={d.id} className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{d.title}</h3>
                      <div className="text-[11px] text-slate-400">{d.type} • {d.uploadedAt} • {d.size}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => alert(`Downloading verified record: ${d.title}`)}
                    className="p-2 text-slate-400 hover:text-teal-600 rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 12. NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Notifications & Alerts
                </h1>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Real-time alerts regarding prescriptions and appointments.
                </p>
              </div>
              <button
                onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))}
                className="text-xs text-teal-600 font-bold hover:underline"
              >
                Mark all as read
              </button>
            </div>
            <div className="space-y-3">
              {notifications.map(n => (
                <div key={n.id} className={`p-4 rounded-2xl border ${
                  n.unread 
                    ? (isLight ? 'bg-teal-50/50 border-teal-300' : 'bg-slate-900 border-cyan-500/40') 
                    : (isLight ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800')
                }`}>
                  <div className="flex justify-between items-center">
                    <h3 className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{n.title}</h3>
                    <span className="text-[10px] text-slate-400">{n.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{n.msg}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 13. SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h1 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Portal Privacy, Security & Data Governance
              </h1>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Control role-based doctor access, multi-factor authentication, and hospital data sharing.
              </p>
            </div>

            {settingsSaved && (
              <div className="p-3.5 bg-emerald-500/15 border border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl font-bold flex items-center space-x-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Security preferences successfully saved and updated in the sovereign registry.</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className={`p-6 rounded-2xl border space-y-5 ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="space-y-4">
                <div className={`flex items-center justify-between py-3 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-teal-600" />
                      <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        Allow Authorized Hospital Networks to Read Medical History
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Enables Apollo, Manipal, Fortis, and Narayana nodes to view verified diagnoses & prescriptions.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={hospitalSharing}
                    onChange={e => setHospitalSharing(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 cursor-pointer"
                  />
                </div>

                <div className={`flex items-center justify-between py-3 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <Smartphone className="w-4 h-4 text-cyan-600" />
                      <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        SMS & Instant Push Notifications for Prescription Refills
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Dispatches instant SMS notifications when doctors sign renewed medication orders.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={smsAlerts}
                    onChange={e => setSmsAlerts(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 cursor-pointer"
                  />
                </div>

                <div className={`flex items-center justify-between py-3 ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        FIPS-140-3 Two-Factor Authentication (2FA) Gate
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Requires biometric confirmation or one-time code on every cross-hospital authorization.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={twoFactorAuth}
                    onChange={e => setTwoFactorAuth(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  Save Security Preferences
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Modals */}
      {showQRModal && (
        <EmergencyQRModal profile={safeProfile} onClose={() => setShowQRModal(false)} />
      )}

      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border p-6 rounded-2xl max-w-md w-full space-y-4 shadow-xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <h3 className="text-base font-bold">Schedule Physician Appointment</h3>
            <form onSubmit={handleBook} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Physician</label>
                <input
                  disabled
                  value={doctorChoice}
                  className={`w-full p-2.5 rounded-lg border font-bold ${
                    isLight ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-teal-400'
                  }`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Date</label>
                  <input 
                    type="date" 
                    value={apptDate} 
                    onChange={e => setApptDate(e.target.value)} 
                    className={`w-full p-2 rounded border ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Time</label>
                  <input 
                    type="text" 
                    value={apptTime} 
                    onChange={e => setApptTime(e.target.value)} 
                    className={`w-full p-2 rounded border ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-white'
                    }`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Reason for Visit</label>
                <input 
                  value={apptReason} 
                  onChange={e => setApptReason(e.target.value)} 
                  className={`w-full p-2.5 rounded-lg border ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowBookModal(false)} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg font-bold">Confirm Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border p-6 rounded-2xl max-w-md w-full space-y-4 shadow-xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <h3 className="text-base font-bold">Upload Health File to Vault</h3>
            <form onSubmit={handleUpload} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">File Title</label>
                <input required placeholder="e.g. Chest CT Scan Summary" value={docTitle} onChange={e => setDocTitle(e.target.value)} className="w-full p-2.5 rounded-lg border" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Category</label>
                <select value={docCategory} onChange={e => setDocCategory(e.target.value)} className="w-full p-2.5 rounded-lg border">
                  <option value="Radiology">Radiology Imaging</option>
                  <option value="ECG / Cardiology">ECG / Cardiology</option>
                  <option value="Insurance Policy">Insurance Document</option>
                  <option value="Discharge Summary">Discharge Summary</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowUploadModal(false)} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg font-bold">Add to Vault</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
